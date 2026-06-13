import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const asOf = dateParam ? new Date(dateParam) : new Date()
    asOf.setHours(23, 59, 59, 999)

    // Cumulative ledger balances up to the report date
    const entries = await prisma.generalLedger.findMany({
      where: { transactionDate: { lte: asOf } },
      include: {
        account: {
          select: { id: true, code: true, name: true, category: true, normalBalance: true },
        },
      },
    })

    // Aggregate net balance per account
    const accountBalance = new Map<number, {
      code: string; name: string; category: string; normalBalance: string; balance: number
    }>()

    for (const entry of entries) {
      const acc = entry.account
      if (!accountBalance.has(acc.id)) {
        accountBalance.set(acc.id, {
          code: acc.code, name: acc.name, category: acc.category,
          normalBalance: acc.normalBalance, balance: 0,
        })
      }
      const row = accountBalance.get(acc.id)!
      const debit = parseFloat(entry.debit.toString())
      const credit = parseFloat(entry.credit.toString())
      row.balance += acc.normalBalance === 'DEBIT' ? debit - credit : credit - debit
    }

    // Split into balance sheet sections
    // Asset split: code < 1500 = current, >= 1500 = fixed
    // Liability split: code < 2400 = current, >= 2400 = long-term
    const assetCurrent: { label: string; amount: number }[] = []
    const assetFixed: { label: string; amount: number }[] = []
    const liabCurrent: { label: string; amount: number }[] = []
    const liabLongTerm: { label: string; amount: number }[] = []
    const equityItems: { label: string; amount: number }[] = []
    let netRevenue = 0
    let netExpenses = 0

    for (const [, acc] of accountBalance) {
      if (acc.balance === 0) continue
      const codeNum = parseInt(acc.code)

      switch (acc.category) {
        case 'ASSET':
          if (codeNum < 1500) assetCurrent.push({ label: acc.name, amount: acc.balance })
          else assetFixed.push({ label: acc.name, amount: acc.balance })
          break
        case 'LIABILITY':
          if (codeNum < 2400) liabCurrent.push({ label: acc.name, amount: acc.balance })
          else liabLongTerm.push({ label: acc.name, amount: acc.balance })
          break
        case 'EQUITY':
          equityItems.push({ label: acc.name, amount: acc.balance })
          break
        case 'REVENUE':
          netRevenue += acc.balance
          break
        case 'EXPENSE':
          netExpenses += acc.balance
          break
      }
    }

    for (const arr of [assetCurrent, assetFixed, liabCurrent, liabLongTerm, equityItems]) {
      arr.sort((a, b) => a.label.localeCompare(b.label))
    }

    // Append current-period net income to equity section
    const netIncome = netRevenue - netExpenses
    if (netIncome !== 0) {
      equityItems.push({ label: 'Laba/Rugi Tahun Berjalan', amount: netIncome })
    }

    // Compute section totals
    const assetCurrentTotal = assetCurrent.reduce((s, i) => s + i.amount, 0)
    const assetFixedTotal = assetFixed.reduce((s, i) => s + i.amount, 0)
    const assetsTotal = assetCurrentTotal + assetFixedTotal
    const liabCurrentTotal = liabCurrent.reduce((s, i) => s + i.amount, 0)
    const liabLongTermTotal = liabLongTerm.reduce((s, i) => s + i.amount, 0)
    const liabilitiesTotal = liabCurrentTotal + liabLongTermTotal
    const equityTotal = equityItems.reduce((s, i) => s + i.amount, 0)

    const isBalanced = Math.abs(assetsTotal - (liabilitiesTotal + equityTotal)) < 0.01

    const period = `Per ${asOf.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`

    return NextResponse.json({
      data: {
        period,
        assets: {
          current: { items: assetCurrent, total: assetCurrentTotal },
          fixed: { items: assetFixed, total: assetFixedTotal },
          total: assetsTotal,
        },
        liabilities: {
          current: { items: liabCurrent, total: liabCurrentTotal },
          longTerm: { items: liabLongTerm, total: liabLongTermTotal },
          total: liabilitiesTotal,
        },
        equity: {
          items: equityItems,
          total: equityTotal,
        },
        isBalanced,
      },
      success: true,
    })
  } catch (error) {
    console.error('[GET /api/reports/balance-sheet]', error)
    return NextResponse.json({ error: 'Failed to generate balance sheet', success: false }, { status: 500 })
  }
}
