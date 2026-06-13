'use client'

import { useState } from 'react'
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Building2, 
  Receipt, 
  Landmark,
  MoreVertical
} from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { KPICard } from '@/components/ui/KPICard'
import { DateRangeFilter } from '@/components/ui/DateRangeFilter'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { DataTable } from '@/components/ui/DataTable'
import { LoadingSkeleton, KPICardSkeleton, ChartSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatIDR } from '@/lib/auth'
import type { Transaction } from '@/types'

export default function DashboardPage() {
  const { data: response, isLoading, isError, refetch } = useDashboard()
  const [period, setPeriod] = useState<'daily'|'weekly'|'monthly'|'yearly'>('monthly')

  if (isError) return <ErrorState onRetry={refetch} />

  const data = response

  return (
    <>
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-section-padding gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Financial Overview</h2>
          <p className="text-body-md text-body-grey mt-1">Real-time snapshot of your company's financial health.</p>
        </div>
        <DateRangeFilter value={period} onChange={setPeriod} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-section-padding">
        {isLoading || !data ? (
          Array.from({ length: 6 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title="Total Pendapatan" data={data.kpis.revenue} icon={<Wallet className="w-6 h-6" />} />
            <KPICard title="Total Pengeluaran" data={data.kpis.expenses} icon={<ArrowUpRight className="w-6 h-6" />} />
            <KPICard title="Total Profit" data={data.kpis.profit} icon={<ArrowDownRight className="w-6 h-6" />} />
            <KPICard title="Total Aset" data={data.kpis.assets} icon={<Building2 className="w-6 h-6" />} />
            <KPICard title="Total Kewajiban" data={data.kpis.liabilities} icon={<Receipt className="w-6 h-6" />} />
            <KPICard title="Total Modal" data={data.kpis.equity} icon={<Landmark className="w-6 h-6" />} />
          </>
        )}
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-section-padding">
        {/* Revenue vs Expense Chart */}
        <div className="lg:col-span-2 card p-gutter-lg flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-headline-md font-semibold text-on-surface">Revenue vs Expenses</h3>
              <p className="text-label-sm text-body-grey mt-1">Monthly comparison for current fiscal year</p>
            </div>
            <button className="p-2 hover:bg-surface-container-high rounded text-body-grey transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          {isLoading || !data ? (
            <ChartSkeleton height={300} />
          ) : (
            <RevenueChart data={data.chartData} />
          )}
        </div>

        {/* Profit Trend Chart */}
        <div className="card p-gutter-lg flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-headline-md font-semibold text-on-surface">Net Profit Trend</h3>
              <p className="text-label-sm text-body-grey mt-1">YTD performance</p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center py-6">
            {isLoading || !data ? (
              <div className="skeleton w-40 h-40 rounded-full" />
            ) : (
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-surface-variant" />
                  <circle 
                    cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" 
                    className="text-success-green"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * data.profitMargin.current) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="kpi-value text-on-surface text-[28px] leading-tight">{data.profitMargin.current}%</span>
                  <span className="text-label-sm text-body-grey mt-1">Margin</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto space-y-3 pt-4 border-t border-outline-variant/30">
            <div className="flex justify-between items-center">
              <span className="text-label-sm text-body-grey">Current Margin</span>
              <span className="text-data-mono font-semibold text-on-surface">
                {isLoading ? '-' : `${data?.profitMargin.current}%`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-label-sm text-body-grey">Target Margin</span>
              <span className="text-data-mono font-semibold text-on-surface">
                {isLoading ? '-' : `${data?.profitMargin.target}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="card overflow-hidden">
        <div className="p-gutter-lg border-b border-outline-variant flex justify-between items-center bg-surface-bright">
          <div>
            <h3 className="text-headline-md font-semibold text-on-surface">Recent High-Level Movements</h3>
            <p className="text-label-sm text-body-grey mt-1">Latest significant transactions across accounts</p>
          </div>
          <button className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors font-medium">
            View All Reports
          </button>
        </div>
        
        {isLoading || !data ? (
          <div className="p-4"><LoadingSkeleton rows={5} /></div>
        ) : (
          <DataTable<Transaction>
            data={data.recentTransactions}
            keyExtractor={(t) => t.id}
            columns={[
              { header: 'Date', accessor: 'date', className: 'font-data-mono' },
              { header: 'Description', accessor: 'description', className: 'font-medium' },
              { 
                header: 'Category', 
                accessor: (row) => (
                  <span className={`badge ${
                    row.category === 'Revenue' ? 'bg-success-green/10 text-success-green' :
                    row.category === 'Expense' ? 'bg-tertiary-container/10 text-tertiary-container' :
                    'bg-surface-variant text-on-surface-variant'
                  }`}>
                    {row.category}
                  </span>
                ) 
              },
              { header: 'Reference', accessor: 'reference', className: 'font-data-mono text-body-grey text-xs' },
              { 
                header: 'Amount (IDR)', 
                align: 'right',
                accessor: (row) => {
                  const sign = row.type === 'credit' ? '+ ' : row.type === 'debit' ? '- ' : ''
                  const color = row.type === 'credit' ? 'text-success-green' : row.type === 'debit' ? 'text-on-surface' : 'text-body-grey'
                  return (
                    <span className={`font-data-mono font-semibold ${color}`}>
                      {sign}{new Intl.NumberFormat('id-ID').format(Math.abs(row.amount))}
                    </span>
                  )
                }
              },
            ]}
          />
        )}
      </div>
    </>
  )
}
