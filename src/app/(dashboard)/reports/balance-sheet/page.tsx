'use client'

import { useBalanceSheet } from '@/hooks/useBalanceSheet'
import { FinancialSummaryCard, FinancialLineItem } from '@/components/ui/FinancialSummaryCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatIDRFull } from '@/lib/auth'
import { CheckCircle2 } from 'lucide-react'

export default function BalanceSheetPage() {
  const { data: response, isLoading, isError, refetch } = useBalanceSheet()

  if (isError) return <ErrorState onRetry={refetch} />

  const data = response

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-section-padding gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Balance Sheet</h2>
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
          <LoadingSkeleton rows={10} />
          <LoadingSkeleton rows={8} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Formula Validation Header */}
          <div className={`p-4 rounded-lg border ${data.isBalanced ? 'bg-success-green/10 border-success-green/20' : 'bg-error-container border-error/20'} flex items-center justify-between`}>
            <div>
              <p className={`font-semibold ${data.isBalanced ? 'text-success-green' : 'text-error'}`}>
                {data.isBalanced ? 'Persamaan Akuntansi Seimbang' : 'Persamaan Akuntansi Tidak Seimbang'}
              </p>
              <p className="text-label-sm mt-1 text-on-surface-variant">
                Aset ({formatIDRFull(data.assets.total)}) = Kewajiban ({formatIDRFull(data.liabilities.total)}) + Modal ({formatIDRFull(data.equity.total)})
              </p>
            </div>
            {data.isBalanced && (
              <CheckCircle2 className="w-8 h-8 text-success-green" />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Assets */}
            <div className="space-y-8">
              <FinancialSummaryCard
                title="Aset (Harta)"
                total={`Rp ${formatIDRFull(data.assets.total)}`}
                totalLabel="Total Aset"
              >
                <div className="mb-6">
                  <h4 className="text-label-sm text-primary uppercase tracking-wider mb-2 font-bold">Aset Lancar</h4>
                  <div className="space-y-1">
                    {data.assets.current.items.map((item, i) => (
                      <FinancialLineItem key={i} label={item.label} amount={formatIDRFull(item.amount)} indent />
                    ))}
                    <FinancialLineItem label="Total Aset Lancar" amount={formatIDRFull(data.assets.current.total)} isSubtotal />
                  </div>
                </div>

                <div>
                  <h4 className="text-label-sm text-primary uppercase tracking-wider mb-2 font-bold">Aset Tetap</h4>
                  <div className="space-y-1">
                    {data.assets.fixed.items.map((item, i) => (
                      <FinancialLineItem 
                        key={i} 
                        label={item.label} 
                        amount={`${item.amount < 0 ? '(' : ''}${formatIDRFull(item.amount)}${item.amount < 0 ? ')' : ''}`} 
                        indent 
                        isNegative={item.amount < 0}
                      />
                    ))}
                    <FinancialLineItem label="Total Aset Tetap" amount={formatIDRFull(data.assets.fixed.total)} isSubtotal />
                  </div>
                </div>
              </FinancialSummaryCard>
            </div>

            {/* Right Column: Liabilities & Equity */}
            <div className="space-y-8">
              <FinancialSummaryCard
                title="Kewajiban (Utang)"
                total={`Rp ${formatIDRFull(data.liabilities.total)}`}
                totalLabel="Total Kewajiban"
              >
                <div className="mb-6">
                  <h4 className="text-label-sm text-tertiary-container uppercase tracking-wider mb-2 font-bold">Kewajiban Jangka Pendek</h4>
                  <div className="space-y-1">
                    {data.liabilities.current.items.map((item, i) => (
                      <FinancialLineItem key={i} label={item.label} amount={formatIDRFull(item.amount)} indent />
                    ))}
                    <FinancialLineItem label="Total Kewajiban Pendek" amount={formatIDRFull(data.liabilities.current.total)} isSubtotal />
                  </div>
                </div>

                <div>
                  <h4 className="text-label-sm text-tertiary-container uppercase tracking-wider mb-2 font-bold">Kewajiban Jangka Panjang</h4>
                  <div className="space-y-1">
                    {data.liabilities.longTerm.items.map((item, i) => (
                      <FinancialLineItem key={i} label={item.label} amount={formatIDRFull(item.amount)} indent />
                    ))}
                    <FinancialLineItem label="Total Kewajiban Panjang" amount={formatIDRFull(data.liabilities.longTerm.total)} isSubtotal />
                  </div>
                </div>
              </FinancialSummaryCard>

              <FinancialSummaryCard
                title="Modal (Ekuitas)"
                total={`Rp ${formatIDRFull(data.equity.total)}`}
                totalLabel="Total Modal"
              >
                <div className="space-y-1">
                  {data.equity.items.map((item, i) => (
                    <FinancialLineItem key={i} label={item.label} amount={formatIDRFull(item.amount)} indent />
                  ))}
                </div>
              </FinancialSummaryCard>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
