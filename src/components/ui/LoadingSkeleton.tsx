export function LoadingSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-4 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  )
}

export function KPICardSkeleton() {
  return (
    <div className="card p-gutter-lg space-y-3">
      <div className="flex justify-between items-start">
        <div className="skeleton h-3 w-28 rounded" />
        <div className="skeleton h-6 w-6 rounded-full" />
      </div>
      <div className="skeleton h-10 w-40 rounded" />
      <div className="skeleton h-3 w-32 rounded" />
    </div>
  )
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="skeleton rounded-lg w-full"
      style={{ height }}
    />
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-[#F1F5F9] px-6 py-3 flex gap-6">
        {[120, 200, 100, 120, 100].map((w, i) => (
          <div key={i} className="skeleton h-3 rounded" style={{ width: w }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex gap-6 border-b border-outline-variant/30">
          {[100, 220, 80, 100, 80].map((w, j) => (
            <div key={j} className="skeleton h-4 rounded" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  )
}
