import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
type NormalBalance = 'DEBIT' | 'CREDIT'

interface LedgerEntry {
  debit: { toString(): string }
  credit: { toString(): string }
  transactionDate: Date
  account: { category: AccountCategory; normalBalance: NormalBalance }
}

function sumPL(entries: LedgerEntry[]) {
  let revenue = 0, expenses = 0
  for (const e of entries) {
    const debit = parseFloat(e.debit.toString())
    const credit = parseFloat(e.credit.toString())
    if (e.account.category === 'REVENUE') revenue += credit - debit
    else if (e.account.category === 'EXPENSE') expenses += debit - credit
  }
  return { revenue, expenses, profit: revenue - expenses }
}

function computeChange(curr: number, prev: number): number {
  if (prev === 0) return 0
  return parseFloat(((curr - prev) / prev * 100).toFixed(1))
}

function trend(change: number): 'up' | 'down' | 'flat' {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
}

export async function GET() {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() // 0-indexed

    const currMonthStart = new Date(year, month, 1)
    const currMonthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999)
    // Previous month — JS handles month=-1 correctly (wraps to Dec of prev year)
    const prevMonthStart = new Date(year, month - 1, 1)
    const prevMonthEnd = new Date(year, month, 0, 23, 59, 59, 999)
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

    const accountSelect = { select: { category: true, normalBalance: true } } as const

    const [currEntries, prevEntries, bsEntries, chartEntries, recentJournals] = await Promise.all([
      // Current month: for P&L KPIs
      prisma.generalLedger.findMany({
        where: { transactionDate: { gte: currMonthStart, lte: currMonthEnd } },
        include: { account: accountSelect },
      }),
      // Previous month: for KPI change %
      prisma.generalLedger.findMany({
        where: { transactionDate: { gte: prevMonthStart, lte: prevMonthEnd } },
        include: { account: accountSelect },
      }),
      // All-time cumulative: for balance sheet KPIs
      prisma.generalLedger.findMany({
        where: { transactionDate: { lte: currMonthEnd } },
        include: { account: accountSelect },
      }),
      // Current year: for monthly chart data
      prisma.generalLedger.findMany({
        where: { transactionDate: { gte: yearStart, lte: yearEnd } },
        include: { account: { select: { category: true } } },
      }),
      // Recent posted journals for transaction feed
      prisma.journal.findMany({
        where: { status: 'POSTED' },
        orderBy: { transactionDate: 'desc' },
        take: 6,
        select: {
          journalNumber: true,
          transactionDate: true,
          description: true,
          entries: { select: { debit: true } },
        },
      }),
    ])

    // P&L KPIs
    const currPL = sumPL(currEntries)
    const prevPL = sumPL(prevEntries)

    // Balance sheet totals (cumulative)
    let bsAssets = 0, bsLiabilities = 0, bsEquity = 0, bsRevenue = 0, bsExpenses = 0
    for (const e of bsEntries) {
      const debit = parseFloat(e.debit.toString())
      const credit = parseFloat(e.credit.toString())
      const acc = e.account
      const bal = acc.normalBalance === 'DEBIT' ? debit - credit : credit - debit
      if (acc.category === 'ASSET') bsAssets += bal
      else if (acc.category === 'LIABILITY') bsLiabilities += bal
      else if (acc.category === 'EQUITY') bsEquity += bal
      else if (acc.category === 'REVENUE') bsRevenue += bal
      else if (acc.category === 'EXPENSE') bsExpenses += bal
    }
    const totalEquity = bsEquity + (bsRevenue - bsExpenses)

    // Monthly chart data
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const monthly: Record<string, { revenue: number; expenses: number }> = {}
    for (const m of months) monthly[m] = { revenue: 0, expenses: 0 }

    for (const e of chartEntries) {
      const mKey = months[new Date(e.transactionDate).getUTCMonth()]
      const debit = parseFloat(e.debit.toString())
      const credit = parseFloat(e.credit.toString())
      if (e.account.category === 'REVENUE') monthly[mKey].revenue += credit - debit
      else if (e.account.category === 'EXPENSE') monthly[mKey].expenses += debit - credit
    }

    const chartData = months.map(m => ({
      month: m,
      revenue: monthly[m].revenue,
      expenses: monthly[m].expenses,
      profit: monthly[m].revenue - monthly[m].expenses,
    }))

    // Recent transactions from posted journals
    const recentTransactions = recentJournals.map(j => ({
      id: j.journalNumber,
      date: new Date(j.transactionDate).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
      }),
      description: j.description,
      category: 'Journal' as const,
      reference: j.journalNumber,
      amount: j.entries.reduce((s, e) => s + parseFloat(e.debit.toString()), 0),
      type: 'neutral' as const,
    }))

    const revenueChange = computeChange(currPL.revenue, prevPL.revenue)
    const expensesChange = computeChange(currPL.expenses, prevPL.expenses)
    const profitChange = computeChange(currPL.profit, prevPL.profit)
    const profitMarginCurrent = currPL.revenue > 0
      ? parseFloat(((currPL.profit / currPL.revenue) * 100).toFixed(1))
      : 0

    return NextResponse.json({
      data: {
        kpis: {
          revenue:     { value: currPL.revenue,     change: revenueChange,  trend: trend(revenueChange)  },
          expenses:    { value: currPL.expenses,    change: expensesChange, trend: trend(expensesChange) },
          profit:      { value: currPL.profit,      change: profitChange,   trend: trend(profitChange)   },
          assets:      { value: bsAssets,           change: 0,              trend: 'flat'                },
          liabilities: { value: bsLiabilities,      change: 0,              trend: 'flat'                },
          equity:      { value: totalEquity,        change: 0,              trend: 'flat'                },
        },
        chartData,
        recentTransactions,
        profitMargin: {
          current: profitMarginCurrent,
          target: 40.0,
        },
      },
      success: true,
    })
  } catch (error) {
    console.error('[GET /api/dashboard]', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data', success: false }, { status: 500 })
  }
}
