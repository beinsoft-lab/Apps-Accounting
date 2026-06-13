import type { ReactNode } from 'react'

export interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => ReactNode)
  align?: 'left' | 'center' | 'right'
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (row: T) => string
  emptyMessage?: string
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Tidak ada data.',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-body-grey text-body-md border border-outline-variant/30 rounded-lg bg-surface-bright">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="table-header">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`
                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                  ${col.className ?? ''}
                `}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30 bg-surface-container-lowest">
          {data.map((row) => (
            <tr key={keyExtractor(row)} className="table-row group">
              {columns.map((col, i) => (
                <td
                  key={i}
                  className={`py-4 px-6 text-body-md text-on-surface
                    ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                    ${col.className ?? ''}
                  `}
                >
                  {typeof col.accessor === 'function' ? col.accessor(row) : (row[col.accessor] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
