'use client'

import { useProfitLoss } from '@/hooks/useProfitLoss'
import { FinancialSummaryCard, FinancialLineItem } from '@/components/ui/FinancialSummaryCard'
import { LoadingSkeleton, ChartSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatIDRFull } from '@/lib/auth'
import { ProfitChart } from '@/components/charts/ProfitChart'
import { ExpenseChart } from '@/components/charts/ExpenseChart'

export default function ProfitLossPage() {
  const { data: response, isLoading, isError, refetch } = useProfitLoss()

  if (isError) return <ErrorState onRetry={refetch} />

  const data = response

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-section-padding gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Profit & Loss (Laba Rugi)</h2>
          <p className="text-body-md text-body-grey mt-1">
            {isLoading ? 'Loading...' : data?.period}
          </p>
        </div>
        <button className="px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-medium shadow-ambient hover:bg-primary-container transition-colors">
          Download PDF
        </button>
      </div>

      {isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </div>
          <LoadingSkeleton rows={12} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Charts Top Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card p-gutter-lg flex flex-col">
              <h3 className="text-headline-md font-semibold text-on-surface mb-6">Net Profit Trend</h3>
              <ProfitChart data={data.monthlyData} />
            </div>
            <div className="card p-gutter-lg flex flex-col">
              <h3 className="text-headline-md font-semibold text-on-surface mb-6">Expense Breakdown</h3>
              <ExpenseChart items={data.expenses.items} />
            </div>
          </div>

          {/* Data Table Section */}
          <div className="max-w-4xl mx-auto">
            <FinancialSummaryCard
              title="Laporan Laba Rugi"
              subtitle={`Periode: ${data.period}`}
            >
              {/* Revenue */}
              <div className="mb-8">
                <h4 className="text-label-sm text-primary uppercase tracking-wider mb-2 font-bold">Pendapatan (Revenue)</h4>
                <div className="space-y-1">
                  {data.revenue.items.map((item, i) => (
                    <FinancialLineItem key={i} label={item.label} amount={formatIDRFull(item.amount)} indent />
                  ))}
                  <FinancialLineItem label="Total Pendapatan" amount={formatIDRFull(data.revenue.total)} isSubtotal />
                </div>
              </div>

              {/* Expenses */}
              <div className="mb-8">
                <h4 className="text-label-sm text-tertiary-container uppercase tracking-wider mb-2 font-bold">Beban Operasional (Expenses)</h4>
                <div className="space-y-1">
                  {data.expenses.items.map((item, i) => (
                    <FinancialLineItem key={i} label={item.label} amount={formatIDRFull(item.amount)} indent />
                  ))}
                  <FinancialLineItem label="Total Beban Operasional" amount={formatIDRFull(data.expenses.total)} isSubtotal />
                </div>
              </div>

              {/* Profit */}
              <div className="pt-4 border-t border-outline-variant/50">
                <div className="flex justify-between items-center py-4 px-gutter-lg -mx-gutter-lg bg-success-green/5 border-b border-success-green/20">
                  <span className="text-body-lg font-bold text-on-surface">Laba Bersih (Net Profit)</span>
                  <span className="kpi-value text-success-green" style={{ fontSize: '24px', lineHeight: '32px' }}>
                    Rp {formatIDRFull(data.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-body-md text-body-grey">Net Profit Margin</span>
                  <span className="text-data-mono font-bold text-primary">
                    {data.netProfitMargin}%
                  </span>
                </div>
              </div>
            </FinancialSummaryCard>
          </div>
        </div>
      )}
    </>
  )
}
