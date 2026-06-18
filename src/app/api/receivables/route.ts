import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateJournalNumber, generateReceivableNumber } from '@/lib/accounting'
import { Decimal } from '@prisma/client/runtime/library'

const INCLUDE = {
  receivableAccount: { select: { id: true, code: true, name: true, category: true } },
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

// GET /api/receivables
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status   = searchParams.get('status')   || ''
    const search   = searchParams.get('search')   || ''
    const page     = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit    = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const skip     = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && ['OPEN', 'PARTIAL', 'PAID', 'VOID'].includes(status)) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { customerName:     { contains: search } },
        { receivableNumber: { contains: search } },
        { referenceNumber:  { contains: search } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.receivable.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.receivable.count({ where }),
    ])

    // Summary aggregates (all matching records, not just current page)
    const agg = await prisma.receivable.aggregate({
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
        totalAmount:          toNum(agg._sum.amount),
        totalPaid:            toNum(agg._sum.paidAmount),
        totalRemaining:       toNum(agg._sum.remainingAmount),
      },
    })
  } catch (error) {
    console.error('[GET /api/receivables]', error)
    return NextResponse.json({ error: 'Gagal mengambil data piutang', success: false }, { status: 500 })
  }
}

// POST /api/receivables
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customerName,
      description,
      referenceNumber,
      amount,
      dueDate,
      receivableAccountId,
      revenueAccountId,
    } = body

    // ─── Validation ─────────────────────────────────────────
    if (!customerName?.trim())      return NextResponse.json({ error: 'Nama customer wajib diisi', success: false }, { status: 422 })
    if (!description?.trim())       return NextResponse.json({ error: 'Deskripsi wajib diisi', success: false }, { status: 422 })
    if (!dueDate)                   return NextResponse.json({ error: 'Tanggal jatuh tempo wajib diisi', success: false }, { status: 422 })
    if (!receivableAccountId)       return NextResponse.json({ error: 'Akun piutang wajib dipilih', success: false }, { status: 422 })
    if (!revenueAccountId)          return NextResponse.json({ error: 'Akun pendapatan wajib dipilih', success: false }, { status: 422 })

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0', success: false }, { status: 422 })
    }

    const cashIdInt      = parseInt(receivableAccountId)
    const revenueIdInt   = parseInt(revenueAccountId)

    if (cashIdInt === revenueIdInt) {
      return NextResponse.json({ error: 'Akun piutang dan pendapatan tidak boleh sama', success: false }, { status: 422 })
    }

    // Validate receivable account (must be ASSET)
    const arAccount = await prisma.account.findUnique({
      where: { id: cashIdInt },
      include: { children: { select: { id: true } } },
    })
    if (!arAccount)                              return NextResponse.json({ error: 'Akun piutang tidak ditemukan', success: false }, { status: 422 })
    if (arAccount.category !== 'ASSET')          return NextResponse.json({ error: 'Akun piutang harus kategori ASSET', success: false }, { status: 422 })
    if (!arAccount.isActive)                     return NextResponse.json({ error: 'Akun piutang tidak aktif', success: false }, { status: 422 })
    if (arAccount.children.length > 0)           return NextResponse.json({ error: 'Akun piutang harus akun leaf (tanpa sub-akun)', success: false }, { status: 422 })

    // Validate revenue account
    const revAccount = await prisma.account.findUnique({
      where: { id: revenueIdInt },
      include: { children: { select: { id: true } } },
    })
    if (!revAccount)                             return NextResponse.json({ error: 'Akun pendapatan tidak ditemukan', success: false }, { status: 422 })
    if (!revAccount.isActive)                    return NextResponse.json({ error: 'Akun pendapatan tidak aktif', success: false }, { status: 422 })
    if (revAccount.children.length > 0)          return NextResponse.json({ error: 'Akun pendapatan harus akun leaf', success: false }, { status: 422 })

    // ─── Atomic creation ────────────────────────────────────
    const amountDecimal = new Decimal(amountNum.toFixed(2))
    const zero          = new Decimal('0.00')
    const transDate     = new Date(dueDate)  // use dueDate as reference; journal date = today
    const today         = new Date()

    const [receivableNumber, journalNumber] = await Promise.all([
      generateReceivableNumber(),
      generateJournalNumber(),
    ])

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Journal (DRAFT)
      const journal = await tx.journal.create({
        data: {
          journalNumber,
          transactionDate: today,
          description: `Piutang: ${customerName} - ${description}`,
          referenceNumber: referenceNumber || null,
          status: 'DRAFT',
          createdById: 1,
          entries: {
            create: [
              // Debit: Piutang Usaha
              { accountId: cashIdInt,    debit: amountDecimal, credit: zero },
              // Credit: Pendapatan
              { accountId: revenueIdInt, debit: zero,          credit: amountDecimal },
            ],
          },
        },
      })

      // 2. Create Receivable
      const receivable = await tx.receivable.create({
        data: {
          receivableNumber,
          customerName: customerName.trim(),
          description:  description.trim(),
          referenceNumber: referenceNumber?.trim() || null,
          amount:          amountDecimal,
          paidAmount:      zero,
          remainingAmount: amountDecimal,
          dueDate:         transDate,
          status:          'OPEN',
          receivableAccountId: cashIdInt,
          journalId:       journal.id,
          createdById:     1,
        },
        include: INCLUDE,
      })

      return receivable
    })

    return NextResponse.json({ success: true, data: result, message: 'Piutang berhasil dibuat.' }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/receivables]', error)
    return NextResponse.json({ error: 'Gagal membuat piutang', success: false }, { status: 500 })
  }
}
