'use client'

import { useRoles } from '@/hooks/useUsers'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { Shield, Check } from 'lucide-react'

export default function AdminRolesPage() {
  const { data: response, isLoading, isError, refetch } = useRoles()

  if (isError) return <ErrorState onRetry={refetch} />

  const roles = response || []

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-section-padding gap-4">
        <div>
          <h2 className="text-headline-lg font-bold text-on-surface">Role Management</h2>
          <p className="text-body-md text-body-grey mt-1">Configure access control policies and role permissions.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded text-label-sm font-medium shadow-ambient hover:bg-primary-container transition-colors">
          <Shield className="w-4 h-4" />
          Create Custom Role
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LoadingSkeleton rows={4} className="card p-6" />
          <LoadingSkeleton rows={4} className="card p-6" />
          <LoadingSkeleton rows={4} className="card p-6" />
          <LoadingSkeleton rows={4} className="card p-6" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map((role) => (
            <div key={role.role} className="card p-gutter-lg hover:border-primary/30 transition-colors flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-headline-md font-bold text-on-surface flex items-center gap-2">
                    {role.label}
                    {role.role === 'super_admin' && (
                      <span className="badge bg-error/10 text-error border border-error/20 text-[10px]">SYSTEM</span>
                    )}
                  </h3>
                  <p className="text-label-sm text-body-grey mt-1">{role.description}</p>
                </div>
                <button className="text-label-sm text-primary hover:underline font-medium">Edit</button>
              </div>

              <div className="mt-4 pt-4 border-t border-outline-variant/30 flex-1">
                <h4 className="text-label-sm font-semibold text-on-surface mb-3 uppercase tracking-wider">Permissions</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {role.permissions.map((perm) => (
                    <div key={perm} className="flex items-center gap-2 text-body-md text-on-surface-variant">
                      <Check className="w-4 h-4 text-success-green flex-shrink-0" />
                      <span className="truncate" title={perm}>{perm.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
