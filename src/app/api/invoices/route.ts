import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateJournalNumber, generateInvoiceNumber } from '@/lib/accounting'
import { Decimal } from '@prisma/client/runtime/library'

const INCLUDE = {
  receivableAccount: { select: { id: true, code: true, name: true, category: true } },
  revenueAccount:    { select: { id: true, code: true, name: true, category: true } },
  journal:           { select: { id: true, journalNumber: true, status: true } },
  createdBy:         { select: { id: true, name: true } },
  items:             { orderBy: { id: 'asc' as const } },
  payments: {
    include: {
      cashAccount: { select: { id: true, code: true, name: true } },
      journal:     { select: { id: true, journalNumber: true, status: true } },
    },
    orderBy: { paymentDate: 'asc' as const },
  },
} as const

// GET /api/invoices
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit  = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const skip   = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status && ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'VOID'].includes(status)) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { customerName:   { contains: search } },
        { invoiceNumber:  { contains: search } },
        { customerEmail:  { contains: search } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({ where, include: INCLUDE, orderBy: [{ createdAt: 'desc' }], skip, take: limit }),
      prisma.invoice.count({ where }),
    ])

    const agg = await prisma.invoice.aggregate({
      where,
      _sum: { totalAmount: true, paidAmount: true, remainingAmount: true },
    })
    const toNum = (d: Decimal | null) => parseFloat((d ?? new Decimal(0)).toString())

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total, page, limit,
        totalPages:     Math.ceil(total / limit),
        totalAmount:    toNum(agg._sum.totalAmount),
        totalPaid:      toNum(agg._sum.paidAmount),
        totalRemaining: toNum(agg._sum.remainingAmount),
      },
    })
  } catch (error) {
    console.error('[GET /api/invoices]', error)
    return NextResponse.json({ error: 'Gagal mengambil data invoice', success: false }, { status: 500 })
  }
}

// POST /api/invoices
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customerName,
      customerAddress,
      customerEmail,
      customerPhone,
      invoiceDate,
      dueDate,
      notes,
      taxRate,
      items,
      receivableAccountId,
      revenueAccountId,
    } = body

    // ─── Validation ─────────────────────────────────────────
    if (!customerName?.trim())  return NextResponse.json({ error: 'Nama customer wajib diisi', success: false }, { status: 422 })
    if (!invoiceDate)           return NextResponse.json({ error: 'Tanggal invoice wajib diisi', success: false }, { status: 422 })
    if (!dueDate)               return NextResponse.json({ error: 'Tanggal jatuh tempo wajib diisi', success: false }, { status: 422 })
    if (!receivableAccountId)   return NextResponse.json({ error: 'Akun piutang wajib dipilih', success: false }, { status: 422 })
    if (!revenueAccountId)      return NextResponse.json({ error: 'Akun pendapatan wajib dipilih', success: false }, { status: 422 })

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invoice harus memiliki minimal 1 item', success: false }, { status: 422 })
    }

    // Validate line items
    for (const item of items) {
      if (!item.description?.trim()) return NextResponse.json({ error: 'Deskripsi item wajib diisi', success: false }, { status: 422 })
      const qty   = parseFloat(item.quantity)
      const price = parseFloat(item.unitPrice)
      if (isNaN(qty)   || qty   <= 0) return NextResponse.json({ error: 'Qty item harus lebih dari 0', success: false }, { status: 422 })
      if (isNaN(price) || price <= 0) return NextResponse.json({ error: 'Harga item harus lebih dari 0', success: false }, { status: 422 })
    }

    const arId  = parseInt(receivableAccountId)
    const revId = parseInt(revenueAccountId)
    if (arId === revId) return NextResponse.json({ error: 'Akun piutang dan pendapatan tidak boleh sama', success: false }, { status: 422 })

    // Validate receivable account (ASSET leaf)
    const arAcct = await prisma.account.findUnique({ where: { id: arId }, include: { children: { select: { id: true } } } })
    if (!arAcct)                    return NextResponse.json({ error: 'Akun piutang tidak ditemukan', success: false }, { status: 422 })
    if (arAcct.category !== 'ASSET') return NextResponse.json({ error: 'Akun piutang harus kategori ASSET', success: false }, { status: 422 })
    if (!arAcct.isActive)            return NextResponse.json({ error: 'Akun piutang tidak aktif', success: false }, { status: 422 })
    if (arAcct.children.length > 0)  return NextResponse.json({ error: 'Akun piutang harus akun leaf', success: false }, { status: 422 })

    // Validate revenue account (leaf)
    const revAcct = await prisma.account.findUnique({ where: { id: revId }, include: { children: { select: { id: true } } } })
    if (!revAcct)                   return NextResponse.json({ error: 'Akun pendapatan tidak ditemukan', success: false }, { status: 422 })
    if (!revAcct.isActive)           return NextResponse.json({ error: 'Akun pendapatan tidak aktif', success: false }, { status: 422 })
    if (revAcct.children.length > 0) return NextResponse.json({ error: 'Akun pendapatan harus akun leaf', success: false }, { status: 422 })

    // ─── Compute totals ──────────────────────────────────────
    const taxRateNum = Math.max(0, Math.min(100, parseFloat(taxRate) || 0))
    const subtotalNum = items.reduce((sum: number, item: { quantity: string; unitPrice: string }) => {
      return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice)
    }, 0)
    const taxAmountNum  = subtotalNum * (taxRateNum / 100)
    const totalAmountNum = subtotalNum + taxAmountNum

    if (totalAmountNum <= 0) {
      return NextResponse.json({ error: 'Total invoice harus lebih dari 0', success: false }, { status: 422 })
    }

    const subtotalDec    = new Decimal(subtotalNum.toFixed(2))
    const taxAmountDec   = new Decimal(taxAmountNum.toFixed(2))
    const totalAmountDec = new Decimal(totalAmountNum.toFixed(2))
    const zero           = new Decimal('0.00')

    const invoiceNumber = await generateInvoiceNumber()

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerName:    customerName.trim(),
          customerAddress: customerAddress?.trim() || null,
          customerEmail:   customerEmail?.trim()   || null,
          customerPhone:   customerPhone?.trim()   || null,
          invoiceDate:     new Date(invoiceDate),
          dueDate:         new Date(dueDate),
          notes:           notes?.trim()           || null,
          taxRate:         new Decimal(taxRateNum.toFixed(2)),
          subtotal:        subtotalDec,
          taxAmount:       taxAmountDec,
          totalAmount:     totalAmountDec,
          paidAmount:      zero,
          remainingAmount: totalAmountDec,
          status:          'DRAFT',
          receivableAccountId: arId,
          revenueAccountId:    revId,
          createdById:     1,
          items: {
            create: items.map((item: { description: string; quantity: string; unitPrice: string }) => {
              const qty   = new Decimal(parseFloat(item.quantity).toFixed(2))
              const price = new Decimal(parseFloat(item.unitPrice).toFixed(2))
              const amt   = qty.mul(price)
              return {
                description: item.description.trim(),
                quantity:    qty,
                unitPrice:   price,
                amount:      amt,
              }
            }),
          },
        },
        include: INCLUDE,
      })
      return invoice
    })

    return NextResponse.json({ success: true, data: result, message: 'Invoice berhasil dibuat.' }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/invoices]', error)
    return NextResponse.json({ error: 'Gagal membuat invoice', success: false }, { status: 500 })
  }
}
