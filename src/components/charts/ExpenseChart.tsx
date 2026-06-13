'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { PLItem } from '@/types'
import { formatIDR } from '@/lib/auth'

interface ExpenseChartProps {
  items: PLItem[]
}

const COLORS = [
  '#0050cb',
  '#cc4204',
  '#22C55E',
  '#00D2D3',
  '#525f72',
  '#b3c5ff',
  '#ffb59d',
  '#d3e0f7',
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 shadow-overlay text-sm">
      <p className="font-semibold text-on-surface">{item.name}</p>
      <p className="text-body-grey mt-1">{formatIDR(item.value)}</p>
    </div>
  )
}

export function ExpenseChart({ items }: ExpenseChartProps) {
  const data = items.map((item) => ({ name: item.label, value: item.amount }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'Inter' }}>
              {value.length > 20 ? value.substring(0, 20) + '...' : value}
            </span>
          )}
          iconSize={10}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
