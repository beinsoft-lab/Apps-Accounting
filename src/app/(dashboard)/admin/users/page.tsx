'use client'

import { useUsers } from '@/hooks/useUsers'
import { DataTable } from '@/components/ui/DataTable'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { getRoleLabel, getRoleColor } from '@/lib/auth'
import { UserPlus, MoreVertical, Search, Edit2, Trash2 } from 'lucide-react'
import type { User } from '@/types'

export default function AdminUsersPage() {
  const { data: response, isLoading, isError, refetch } = useUsers()

  if (isError) return <ErrorState onRetry={refetch} />

  const users = response || []

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-section-padding gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">User Management</h2>
          <p className="text-body-md text-body-grey mt-1">Manage system users and their access roles.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-medium shadow-ambient hover:bg-primary-container transition-colors">
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="p-gutter-lg border-b border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-bright">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-body-grey" />
            <input
              type="text"
              placeholder="Search users..."
              className="w-full pl-9 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded focus:border-primary focus:ring-2 focus:ring-primary/20 text-body-md outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors font-medium">
              Export
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={5} /></div>
        ) : (
          <DataTable<User>
            data={users}
            keyExtractor={(u) => u.id}
            columns={[
              {
                header: 'Name',
                accessor: (row) => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-container text-primary font-bold flex items-center justify-center text-xs">
                      {row.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-on-surface">{row.name}</div>
                      <div className="text-xs text-body-grey">{row.email}</div>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Role',
                accessor: (row) => (
                  <span className={`badge ${getRoleColor(row.role)} uppercase tracking-wider`}>
                    {getRoleLabel(row.role)}
                  </span>
                ),
              },
              {
                header: 'Department',
                accessor: 'department',
              },
              {
                header: 'Status',
                accessor: () => (
                  <span className="badge bg-success-green/10 text-success-green border border-success-green/20">
                    Active
                  </span>
                ),
              },
              {
                header: 'Actions',
                align: 'right',
                accessor: () => (
                  <div className="flex items-center justify-end gap-2 text-body-grey">
                    <button className="p-1 hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button className="p-1 hover:text-error transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <button className="p-1 hover:text-on-surface transition-colors"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </>
  )
}
