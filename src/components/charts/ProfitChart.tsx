'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ChartDataPoint } from '@/types'

interface ProfitChartProps {
  data: ChartDataPoint[]
}

const formatYAxis = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`
  return `${value}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-overlay text-sm">
      <p className="font-semibold text-on-surface mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm bg-success-green" />
        <span className="text-body-grey">Net Profit:</span>
        <span className="font-medium text-on-surface">
          Rp {(payload[0].value / 1_000_000).toFixed(0)}M
        </span>
      </div>
    </div>
  )
}

export function ProfitChart({ data }: ProfitChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#c2c6d8" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Inter' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Inter' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#22C55E', strokeOpacity: 0.3 }} />
        <Area
          type="monotone"
          dataKey="profit"
          stroke="#22C55E"
          strokeWidth={2.5}
          fill="url(#profitGradient)"
          dot={{ fill: '#22C55E', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, strokeWidth: 0, fill: '#22C55E' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
