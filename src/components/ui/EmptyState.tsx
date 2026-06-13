import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  message?: string
  icon?: React.ReactNode
}

export function EmptyState({
  title = 'Tidak Ada Data',
  message = 'Belum ada data yang tersedia untuk ditampilkan.',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-4 text-body-grey">
        {icon ?? <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-headline-md font-semibold text-on-surface mb-2">{title}</h3>
      <p className="text-body-md text-body-grey max-w-sm">{message}</p>
    </div>
  )
}
