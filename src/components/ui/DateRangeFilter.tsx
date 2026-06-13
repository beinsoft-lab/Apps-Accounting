'use client'

import { useState } from 'react'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface DateRangeFilterProps {
  value?: Period
  onChange?: (period: Period) => void
}

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
]

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [internal, setInternal] = useState<Period>('monthly')
  const active = value ?? internal

  const handleChange = (p: Period) => {
    setInternal(p)
    onChange?.(p)
  }

  return (
    <div className="flex bg-surface-container-lowest border border-outline-variant rounded p-1 shadow-ambient">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          className={`seg-btn ${active === opt.value ? 'seg-btn-active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
