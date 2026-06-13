import type { Role, Permission } from '@/types'

// Permission matrix
const rolePermissions: Record<Role, Permission[]> = {
  super_admin: [
    'view_dashboard',
    'view_reports',
    'view_balance_sheet',
    'view_profit_loss',
    'manage_users',
    'manage_roles',
    'view_settings',
    'edit_settings',
  ],
  owner: [
    'view_dashboard',
    'view_reports',
    'view_balance_sheet',
    'view_profit_loss',
    'view_settings',
  ],
  accountant: [
    'view_dashboard',
    'view_reports',
    'view_balance_sheet',
    'view_profit_loss',
  ],
  viewer: [
    'view_dashboard',
    'view_reports',
    'view_balance_sheet',
    'view_profit_loss',
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    super_admin: 'Super Admin',
    owner: 'Owner',
    accountant: 'Akuntan',
    viewer: 'Viewer',
  }
  return labels[role] ?? role
}

export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    super_admin: 'bg-primary/10 text-primary',
    owner: 'bg-secondary-container text-secondary',
    accountant: 'bg-success-green/10 text-success-green',
    viewer: 'bg-surface-container-high text-body-grey',
  }
  return colors[role] ?? 'bg-surface-container-high text-body-grey'
}

// Format currency in IDR
export function formatIDR(amount: number): string {
  const absAmount = Math.abs(amount)
  if (absAmount >= 1_000_000_000) {
    return `Rp ${(absAmount / 1_000_000_000).toFixed(1)}B`
  }
  if (absAmount >= 1_000_000) {
    return `Rp ${(absAmount / 1_000_000).toFixed(0)}M`
  }
  return `Rp ${absAmount.toLocaleString('id-ID')}`
}

export function formatIDRFull(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.abs(amount))
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '' : ''
  return `${sign}${value.toFixed(1)}%`
}
