import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/ledger — Query General Ledger with filters
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    const dateFrom = searchParams.get('from')
    const dateTo = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: any = {}
    if (accountId) where.accountId = parseInt(accountId)
    if (dateFrom || dateTo) {
      where.transactionDate = {}
      if (dateFrom) where.transactionDate.gte = new Date(dateFrom)
      if (dateTo) where.transactionDate.lte = new Date(dateTo)
    }

    const [entries, total, aggregate] = await Promise.all([
      prisma.generalLedger.findMany({
        where,
        include: {
          account: { select: { id: true, code: true, name: true, category: true, normalBalance: true } },
          journal: { select: { id: true, journalNumber: true, description: true } },
        },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.generalLedger.count({ where }),
      prisma.generalLedger.aggregate({
        where,
        _sum: { debit: true, credit: true },
      }),
    ])

    const summary = {
      totalDebit: parseFloat(aggregate._sum.debit?.toString() ?? '0'),
      totalCredit: parseFloat(aggregate._sum.credit?.toString() ?? '0'),
    }

    return NextResponse.json({
      data: entries,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), ...summary },
      success: true,
    })
  } catch (error) {
    console.error('[GET /api/ledger]', error)
    return NextResponse.json({ error: 'Failed to fetch ledger', success: false }, { status: 500 })
  }
}
