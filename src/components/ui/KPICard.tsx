'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { KPIMetric } from '@/types'
import { formatIDR, formatPercent } from '@/lib/auth'

interface KPICardProps {
  title: string
  data: KPIMetric
  icon: React.ReactNode
  period?: string
}

export function KPICard({ title, data, icon, period = 'vs bulan lalu' }: KPICardProps) {
  const isPositive = data.trend === 'up'
  const isNegative = data.trend === 'down'
  const isFlat = data.trend === 'flat'

  // For liabilities, down is good (green)
  const isLiability = title.toLowerCase().includes('kewajiban')
  const trendGood = isLiability ? isNegative : isPositive

  const trendColor = isFlat
    ? 'text-body-grey'
    : trendGood
    ? 'text-success-green'
    : 'text-tertiary-container'

  const TrendIcon = isFlat ? Minus : isPositive ? TrendingUp : TrendingDown

  return (
    <div className="card p-gutter-lg relative overflow-hidden group hover:border-primary/30 transition-all duration-200 animate-fade-in">
      {/* Subtle background accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/3 rounded-full -mr-8 -mt-8 group-hover:bg-primary/5 transition-colors" />

      <div className="flex justify-between items-start mb-4">
        <h3 className="text-label-sm text-body-grey uppercase tracking-wider">{title}</h3>
        <span className="text-primary/70 relative z-10">{icon}</span>
      </div>

      <div className="kpi-value text-on-surface mb-2">{formatIDR(data.value)}</div>

      <div className="flex items-center gap-2">
        <TrendIcon className={`w-4 h-4 ${trendColor}`} />
        <span className={`text-label-sm ${trendColor}`}>{formatPercent(data.change)}</span>
        <span className="text-label-sm text-body-grey">{period}</span>
      </div>
    </div>
  )
}
