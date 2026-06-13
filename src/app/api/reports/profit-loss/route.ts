import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const periodStart = new Date(`${year}-01-01`)
    const periodEnd = new Date(`${year}-12-31T23:59:59.999`)

    const entries = await prisma.generalLedger.findMany({
      where: { transactionDate: { gte: periodStart, lte: periodEnd } },
      include: {
        account: {
          select: { id: true, code: true, name: true, category: true, normalBalance: true },
        },
      },
    })

    // Aggregate debit/credit totals per account
    const accountMap = new Map<number, {
      code: string; name: string; category: string; normalBalance: string
      totalDebit: number; totalCredit: number
    }>()

    for (const entry of entries) {
      const acc = entry.account
      if (!accountMap.has(acc.id)) {
        accountMap.set(acc.id, {
          code: acc.code, name: acc.name, category: acc.category,
          normalBalance: acc.normalBalance, totalDebit: 0, totalCredit: 0,
        })
      }
      const row = accountMap.get(acc.id)!
      row.totalDebit += parseFloat(entry.debit.toString())
      row.totalCredit += parseFloat(entry.credit.toString())
    }

    // Build P&L line items
    const revenueItems: { label: string; amount: number }[] = []
    const expenseItems: { label: string; amount: number }[] = []
    let totalRevenue = 0
    let totalExpenses = 0

    for (const [, acc] of accountMap) {
      if (acc.category === 'REVENUE') {
        const amount = acc.totalCredit - acc.totalDebit
        if (amount !== 0) {
          revenueItems.push({ label: acc.name, amount })
          totalRevenue += amount
        }
      } else if (acc.category === 'EXPENSE') {
        const amount = acc.totalDebit - acc.totalCredit
        if (amount !== 0) {
          expenseItems.push({ label: acc.name, amount })
          totalExpenses += amount
        }
      }
    }

    revenueItems.sort((a, b) => a.label.localeCompare(b.label))
    expenseItems.sort((a, b) => a.label.localeCompare(b.label))

    const netProfit = totalRevenue - totalExpenses
    const netProfitMargin = totalRevenue > 0
      ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2))
      : 0

    // Monthly chart data
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthly: Record<string, { revenue: number; expenses: number }> = {}
    for (const m of months) monthly[m] = { revenue: 0, expenses: 0 }

    for (const entry of entries) {
      const mIdx = new Date(entry.transactionDate).getUTCMonth()
      const mKey = months[mIdx]
      const debit = parseFloat(entry.debit.toString())
      const credit = parseFloat(entry.credit.toString())
      if (entry.account.category === 'REVENUE') monthly[mKey].revenue += credit - debit
      else if (entry.account.category === 'EXPENSE') monthly[mKey].expenses += debit - credit
    }

    const monthlyData = months.map(m => ({
      month: m,
      revenue: monthly[m].revenue,
      expenses: monthly[m].expenses,
      profit: monthly[m].revenue - monthly[m].expenses,
    }))

    return NextResponse.json({
      data: {
        period: `Januari – Desember ${year}`,
        revenue: { items: revenueItems, total: totalRevenue },
        expenses: { items: expenseItems, total: totalExpenses },
        grossProfit: netProfit,
        netProfit,
        netProfitMargin,
        monthlyData,
      },
      success: true,
    })
  } catch (error) {
    console.error('[GET /api/reports/profit-loss]', error)
    return NextResponse.json({ error: 'Failed to generate profit & loss report', success: false }, { status: 500 })
  }
}
