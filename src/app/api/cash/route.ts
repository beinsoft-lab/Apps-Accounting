import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { generateJournalNumber, generateCashNumber } from '@/lib/accounting'

const TX_INCLUDE = {
  cashAccount:        { select: { id: true, code: true, name: true } },
  counterpartAccount: { select: { id: true, code: true, name: true } },
  journal:            { select: { id: true, journalNumber: true, status: true } },
} as const

// GET /api/cash — list cash transactions with filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type          = searchParams.get('type') as 'IN' | 'OUT' | null
    const status        = searchParams.get('status')
    const from          = searchParams.get('from')
    const to            = searchParams.get('to')
    const cashAccountId = searchParams.get('cashAccountId')
    const page          = parseInt(searchParams.get('page')  || '1')
    const limit         = parseInt(searchParams.get('limit') || '20')
    const skip          = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (type)          where.type          = type
    if (status)        where.journal        = { status }
    if (cashAccountId) where.cashAccountId  = parseInt(cashAccountId)
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to)   dateFilter.lte = new Date(to)
      where.transactionDate = dateFilter
    }

    const [data, total] = await Promise.all([
      prisma.cashTransaction.findMany({
        where,
        include:  TX_INCLUDE,
        orderBy:  { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.cashTransaction.count({ where }),
    ])

    // Summary totals — POSTED only, same date/cashAccount filter
    const summaryWhere: Record<string, unknown> = {}
    if (cashAccountId) summaryWhere.cashAccountId = parseInt(cashAccountId)
    if (from || to) summaryWhere.transactionDate  = where.transactionDate

    const [inAgg, outAgg] = await Promise.all([
      prisma.cashTransaction.aggregate({
        where: { ...summaryWhere, type: 'IN',  journal: { status: 'POSTED' } },
        _sum:  { amount: true },
      }),
      prisma.cashTransaction.aggregate({
        where: { ...summaryWhere, type: 'OUT', journal: { status: 'POSTED' } },
        _sum:  { amount: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages:     Math.ceil(total / limit),
        totalAmountIn:  parseFloat((inAgg._sum.amount  ?? 0).toString()),
        totalAmountOut: parseFloat((outAgg._sum.amount ?? 0).toString()),
      },
    })
  } catch (error) {
    console.error('[GET /api/cash]', error)
    return NextResponse.json({ error: 'Failed to fetch cash transactions', success: false }, { status: 500 })
  }
}

// POST /api/cash — create CashTransaction + auto DRAFT Journal (atomic)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      type,
      transactionDate,
      amount,
      cashAccountId,
      counterpartAccountId,
      description,
      referenceNumber,
      partyName,
    } = body

    // --- Validation ---
    if (!type || !['IN', 'OUT'].includes(type)) {
      return NextResponse.json({ error: 'type harus IN atau OUT', success: false }, { status: 400 })
    }
    if (!transactionDate) {
      return NextResponse.json({ error: 'transactionDate wajib diisi', success: false }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'description wajib diisi', success: false }, { status: 400 })
    }
    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'amount harus berupa angka positif', success: false }, { status: 422 })
    }
    if (!cashAccountId || !counterpartAccountId) {
      return NextResponse.json({ error: 'cashAccountId dan counterpartAccountId wajib diisi', success: false }, { status: 400 })
    }
    const cashIdInt       = parseInt(cashAccountId)
    const counterpartIdInt = parseInt(counterpartAccountId)
    if (cashIdInt === counterpartIdInt) {
      return NextResponse.json({ error: 'cashAccountId dan counterpartAccountId tidak boleh sama', success: false }, { status: 422 })
    }

    // Validate cashAccount: ASSET + leaf + active
    const cashAccount = await prisma.account.findUnique({
      where:   { id: cashIdInt },
      include: { children: { select: { id: true } } },
    })
    if (!cashAccount || !cashAccount.isActive) {
      return NextResponse.json({ error: 'cashAccountId tidak valid atau tidak aktif', success: false }, { status: 422 })
    }
    if (cashAccount.category !== 'ASSET') {
      return NextResponse.json({ error: 'cashAccountId harus berupa akun ASSET (Kas/Bank)', success: false }, { status: 422 })
    }
    if (cashAccount.children.length > 0) {
      return NextResponse.json({ error: 'cashAccountId harus akun detail (tidak punya sub-akun)', success: false }, { status: 422 })
    }

    // Validate counterpartAccount: leaf + active (any category)
    const counterpartAccount = await prisma.account.findUnique({
      where:   { id: counterpartIdInt },
      include: { children: { select: { id: true } } },
    })
    if (!counterpartAccount || !counterpartAccount.isActive) {
      return NextResponse.json({ error: 'counterpartAccountId tidak valid atau tidak aktif', success: false }, { status: 422 })
    }
    if (counterpartAccount.children.length > 0) {
      return NextResponse.json({ error: 'counterpartAccountId harus akun detail (tidak punya sub-akun)', success: false }, { status: 422 })
    }

    // Generate both numbers before the transaction (COUNT-based, @unique is the safety net)
    const [transactionNumber, journalNumber] = await Promise.all([
      generateCashNumber(type),
      generateJournalNumber(),
    ])

    const txDate       = new Date(transactionDate)
    const amountDecimal = new Decimal(amountNum)
    const zero          = new Decimal(0)

    // IN:  Debit cashAccount  | Credit counterpartAccount
    // OUT: Debit counterpart  | Credit cashAccount
    const entries =
      type === 'IN'
        ? [
            { accountId: cashIdInt,        debit: amountDecimal, credit: zero },
            { accountId: counterpartIdInt, debit: zero,          credit: amountDecimal },
          ]
        : [
            { accountId: counterpartIdInt, debit: amountDecimal, credit: zero },
            { accountId: cashIdInt,        debit: zero,          credit: amountDecimal },
          ]

    const cashTx = await prisma.$transaction(async (tx) => {
      const journal = await tx.journal.create({
        data: {
          journalNumber,
          transactionDate: txDate,
          referenceNumber: referenceNumber || null,
          description,
          status:      'DRAFT',
          createdById: 1,
          entries:     { create: entries },
        },
        include: {
          entries: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
      })

      return tx.cashTransaction.create({
        data: {
          transactionNumber,
          type,
          transactionDate: txDate,
          amount:               amountDecimal,
          cashAccountId:        cashIdInt,
          counterpartAccountId: counterpartIdInt,
          description,
          referenceNumber: referenceNumber || null,
          partyName:       partyName       || null,
          journalId:       journal.id,
          createdById:     1,
        },
        include: {
          cashAccount:        { select: { id: true, code: true, name: true } },
          counterpartAccount: { select: { id: true, code: true, name: true } },
          journal: {
            include: {
              entries: {
                include: { account: { select: { id: true, code: true, name: true } } },
              },
            },
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      data:    cashTx,
      message: 'Transaksi kas berhasil dibuat sebagai Draft.',
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/cash]', error)
    return NextResponse.json({ error: 'Gagal membuat transaksi kas', success: false }, { status: 500 })
  }
}
