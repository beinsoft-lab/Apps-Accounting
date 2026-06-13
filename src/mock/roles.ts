import type { RolePermission } from '@/types'

export const mockRoles: RolePermission[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Akses penuh ke semua fitur dan manajemen sistem',
    permissions: [
      'view_dashboard',
      'view_reports',
      'view_balance_sheet',
      'view_profit_loss',
      'manage_users',
      'manage_roles',
      'view_settings',
      'edit_settings',
    ],
    color: 'bg-primary/10 text-primary',
  },
  {
    role: 'owner',
    label: 'Owner',
    description: 'Akses dashboard dan laporan keuangan lengkap',
    permissions: [
      'view_dashboard',
      'view_reports',
      'view_balance_sheet',
      'view_profit_loss',
      'view_settings',
    ],
    color: 'bg-secondary-container text-secondary',
  },
  {
    role: 'accountant',
    label: 'Akuntan',
    description: 'Akses dashboard dan semua laporan keuangan',
    permissions: [
      'view_dashboard',
      'view_reports',
      'view_balance_sheet',
      'view_profit_loss',
    ],
    color: 'bg-success-green/10 text-success-green',
  },
  {
    role: 'viewer',
    label: 'Viewer',
    description: 'Akses read-only ke dashboard dan laporan',
    permissions: [
      'view_dashboard',
      'view_reports',
      'view_balance_sheet',
      'view_profit_loss',
    ],
    color: 'bg-surface-container-high text-body-grey',
  },
]
