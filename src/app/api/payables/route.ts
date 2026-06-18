import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateJournalNumber, generatePayableNumber } from '@/lib/accounting'
import { Decimal } from '@prisma/client/runtime/library'

const INCLUDE = {
  payableAccount: { select: { id: true, code: true, name: true, category: true } },
  journal: { select: { id: true, journalNumber: true, status: true } },
  createdBy: { select: { id: true, name: true } },
  payments: {
    include: {
      cashAccount: { select: { id: true, code: true, name: true } },
      journal: { select: { id: true, journalNumber: true, status: true } },
    },
    orderBy: { paymentDate: 'asc' as const },
  },
} as const

// GET /api/payables
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit  = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const skip   = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && ['OPEN', 'PARTIAL', 'PAID', 'VOID'].includes(status)) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { vendorName:    { contains: search } },
        { payableNumber: { contains: search } },
        { referenceNumber: { contains: search } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.payable.findMany({ where, include: INCLUDE, orderBy: [{ createdAt: 'desc' }], skip, take: limit }),
      prisma.payable.count({ where }),
    ])

    const agg = await prisma.payable.aggregate({
      where,
      _sum: { amount: true, paidAmount: true, remainingAmount: true },
    })

    const toNum = (d: Decimal | null) => parseFloat((d ?? new Decimal(0)).toString())

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalAmount:    toNum(agg._sum.amount),
        totalPaid:      toNum(agg._sum.paidAmount),
        totalRemaining: toNum(agg._sum.remainingAmount),
      },
    })
  } catch (error) {
    console.error('[GET /api/payables]', error)
    return NextResponse.json({ error: 'Gagal mengambil data hutang', success: false }, { status: 500 })
  }
}

// POST /api/payables
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      vendorName,
      description,
      referenceNumber,
      amount,
      dueDate,
      payableAccountId,
      expenseAccountId,
    } = body

    // ─── Validation ─────────────────────────────────────────
    if (!vendorName?.trim())     return NextResponse.json({ error: 'Nama vendor wajib diisi', success: false }, { status: 422 })
    if (!description?.trim())    return NextResponse.json({ error: 'Deskripsi wajib diisi', success: false }, { status: 422 })
    if (!dueDate)                return NextResponse.json({ error: 'Tanggal jatuh tempo wajib diisi', success: false }, { status: 422 })
    if (!payableAccountId)       return NextResponse.json({ error: 'Akun hutang wajib dipilih', success: false }, { status: 422 })
    if (!expenseAccountId)       return NextResponse.json({ error: 'Akun biaya/pengeluaran wajib dipilih', success: false }, { status: 422 })

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0', success: false }, { status: 422 })
    }

    const payableIdInt  = parseInt(payableAccountId)
    const expenseIdInt  = parseInt(expenseAccountId)

    if (payableIdInt === expenseIdInt) {
      return NextResponse.json({ error: 'Akun hutang dan akun biaya tidak boleh sama', success: false }, { status: 422 })
    }

    // Validate payable account (must be LIABILITY)
    const payAcct = await prisma.account.findUnique({
      where: { id: payableIdInt },
      include: { children: { select: { id: true } } },
    })
    if (!payAcct)                            return NextResponse.json({ error: 'Akun hutang tidak ditemukan', success: false }, { status: 422 })
    if (payAcct.category !== 'LIABILITY')    return NextResponse.json({ error: 'Akun hutang harus kategori LIABILITY', success: false }, { status: 422 })
    if (!payAcct.isActive)                   return NextResponse.json({ error: 'Akun hutang tidak aktif', success: false }, { status: 422 })
    if (payAcct.children.length > 0)         return NextResponse.json({ error: 'Akun hutang harus akun leaf (tanpa sub-akun)', success: false }, { status: 422 })

    // Validate expense account
    const expAcct = await prisma.account.findUnique({
      where: { id: expenseIdInt },
      include: { children: { select: { id: true } } },
    })
    if (!expAcct)                            return NextResponse.json({ error: 'Akun biaya tidak ditemukan', success: false }, { status: 422 })
    if (!expAcct.isActive)                   return NextResponse.json({ error: 'Akun biaya tidak aktif', success: false }, { status: 422 })
    if (expAcct.children.length > 0)         return NextResponse.json({ error: 'Akun biaya harus akun leaf', success: false }, { status: 422 })

    // ─── Atomic creation ────────────────────────────────────
    const amountDecimal = new Decimal(amountNum.toFixed(2))
    const zero          = new Decimal('0.00')
    const today         = new Date()
    const dueDateTime   = new Date(dueDate)

    const [payableNumber, journalNumber] = await Promise.all([
      generatePayableNumber(),
      generateJournalNumber(),
    ])

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Journal (DRAFT)
      const journal = await tx.journal.create({
        data: {
          journalNumber,
          transactionDate: today,
          description: `Hutang: ${vendorName} - ${description}`,
          referenceNumber: referenceNumber || null,
          status: 'DRAFT',
          createdById: 1,
          entries: {
            create: [
              // Debit: Biaya/Expense
              { accountId: expenseIdInt,  debit: amountDecimal, credit: zero },
              // Credit: Hutang Usaha (LIABILITY)
              { accountId: payableIdInt,  debit: zero,          credit: amountDecimal },
            ],
          },
        },
      })

      // 2. Create Payable
      const payable = await tx.payable.create({
        data: {
          payableNumber,
          vendorName:      vendorName.trim(),
          description:     description.trim(),
          referenceNumber: referenceNumber?.trim() || null,
          amount:          amountDecimal,
          paidAmount:      zero,
          remainingAmount: amountDecimal,
          dueDate:         dueDateTime,
          status:          'OPEN',
          payableAccountId: payableIdInt,
          journalId:       journal.id,
          createdById:     1,
        },
        include: INCLUDE,
      })

      return payable
    })

    return NextResponse.json({ success: true, data: result, message: 'Hutang berhasil dibuat.' }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/payables]', error)
    return NextResponse.json({ error: 'Gagal membuat hutang', success: false }, { status: 500 })
  }
}
