'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ChartDataPoint } from '@/types'

interface RevenueChartProps {
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
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
          <span className="text-body-grey">{entry.name}:</span>
          <span className="font-medium text-on-surface">
            Rp {(entry.value / 1_000_000).toFixed(0)}M
          </span>
        </div>
      ))}
    </div>
  )
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} barCategoryGap="30%" barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#c2c6d8" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#64748B', fontFamily: 'Inter' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'Inter' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#0050cb', fillOpacity: 0.04 }} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'Inter' }}>{value}</span>
          )}
        />
        <Bar dataKey="revenue" name="Pendapatan" fill="#0050cb" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Pengeluaran" fill="#cc4204" radius={[3, 3, 0, 0]} opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  )
}
