import type { ReactNode } from 'react'

interface FinancialSummaryCardProps {
  title: string
  subtitle?: string
  total?: string
  totalLabel?: string
  children: ReactNode
  className?: string
}

export function FinancialSummaryCard({
  title,
  subtitle,
  total,
  totalLabel,
  children,
  className = '',
}: FinancialSummaryCardProps) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-gutter-lg py-4 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
        <div>
          <h3 className="text-headline-md font-semibold text-on-surface">{title}</h3>
          {subtitle && <p className="text-label-sm text-body-grey mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <div className="p-gutter-lg">{children}</div>

      {/* Total Footer */}
      {total && (
        <div className="px-gutter-lg py-4 border-t-2 border-primary/20 bg-primary/3 flex justify-between items-center">
          <span className="text-body-md font-semibold text-on-surface">{totalLabel ?? 'Total'}</span>
          <span className="kpi-value text-primary" style={{ fontSize: '20px', lineHeight: '28px' }}>
            {total}
          </span>
        </div>
      )}
    </div>
  )
}

interface FinancialLineItemProps {
  label: string
  amount: string
  isSubtotal?: boolean
  isPositive?: boolean
  isNegative?: boolean
  indent?: boolean
}

export function FinancialLineItem({
  label,
  amount,
  isSubtotal,
  isPositive,
  isNegative,
  indent,
}: FinancialLineItemProps) {
  return (
    <div
      className={`flex justify-between items-center py-2.5 border-b border-outline-variant/20 last:border-0
        ${indent ? 'pl-4' : ''}
        ${isSubtotal ? 'bg-surface-container-low -mx-gutter-lg px-gutter-lg font-semibold border-t border-outline-variant/40' : ''}
      `}
    >
      <span className={`text-body-md ${isSubtotal ? 'text-on-surface font-semibold' : 'text-body-grey'}`}>
        {label}
      </span>
      <span
        className={`text-data-mono font-medium tabular-nums
          ${isPositive ? 'text-success-green' : isNegative ? 'text-tertiary-container' : 'text-on-surface'}
          ${isSubtotal ? 'font-semibold text-on-surface' : ''}
        `}
      >
        {amount}
      </span>
    </div>
  )
}
