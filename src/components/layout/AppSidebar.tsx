'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  BarChart2, 
  Users, 
  Settings, 
  HelpCircle, 
  LogOut,
  FileText,
  PieChart as PieChartIcon
} from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'

export function AppSidebar() {
  const pathname = usePathname()
  const { logout, can } = useAuth()

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`)

  return (
    <nav className="h-screen w-64 fixed left-0 top-0 border-r border-outline-variant bg-surface-container-lowest shadow-sm flex flex-col py-6 z-50">
      {/* Brand */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-primary font-bold">
          B
        </div>
        <div>
          <h1 className="text-headline-md font-bold text-primary leading-tight">Beinsoft</h1>
          <p className="text-label-sm text-body-grey">Accounting Pro</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex-1 px-4 space-y-1 overflow-y-auto">
        <Link
          href="/dashboard"
          className={`nav-link ${isActive('/dashboard') ? 'nav-link-active' : ''}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </Link>

        {/* Master Group */}
        <div className="pt-4 pb-2">
          <p className="px-4 text-xs font-semibold text-body-grey uppercase tracking-wider mb-2">Master Data</p>
          <Link
            href="/master/coa"
            className={`nav-link ${isActive('/master/coa') ? 'nav-link-active' : ''}`}
          >
            <FileText className="w-5 h-5" />
            <span>Chart of Accounts</span>
          </Link>
        </div>

        {/* Accounting Group */}
        <div className="pt-2 pb-2">
          <p className="px-4 text-xs font-semibold text-body-grey uppercase tracking-wider mb-2">Akuntansi</p>
          <Link
            href="/accounting/journal"
            className={`nav-link ${isActive('/accounting/journal') ? 'nav-link-active' : ''}`}
          >
            <BarChart2 className="w-5 h-5" />
            <span>Jurnal Umum</span>
          </Link>
          <Link
            href="/accounting/ledger"
            className={`nav-link ${isActive('/accounting/ledger') ? 'nav-link-active' : ''}`}
          >
            <PieChartIcon className="w-5 h-5" />
            <span>Buku Besar</span>
          </Link>
        </div>

        {/* Reports Group */}
        {can('view_reports') && (
          <div className="pt-2 pb-2">
            <p className="px-4 text-xs font-semibold text-body-grey uppercase tracking-wider mb-2">Reports</p>
            {can('view_balance_sheet') && (
              <Link
                href="/reports/balance-sheet"
                className={`nav-link ${isActive('/reports/balance-sheet') ? 'nav-link-active' : ''}`}
              >
                <FileText className="w-5 h-5" />
                <span>Balance Sheet</span>
              </Link>
            )}
            {can('view_profit_loss') && (
              <Link
                href="/reports/profit-loss"
                className={`nav-link ${isActive('/reports/profit-loss') ? 'nav-link-active' : ''}`}
              >
                <PieChartIcon className="w-5 h-5" />
                <span>Profit & Loss</span>
              </Link>
            )}
          </div>
        )}

        {/* Admin Group */}
        {(can('manage_users') || can('manage_roles')) && (
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs font-semibold text-body-grey uppercase tracking-wider mb-2">Admin</p>
            {can('manage_users') && (
              <Link
                href="/admin/users"
                className={`nav-link ${isActive('/admin/users') ? 'nav-link-active' : ''}`}
              >
                <Users className="w-5 h-5" />
                <span>Users</span>
              </Link>
            )}
            {can('manage_roles') && (
              <Link
                href="/admin/roles"
                className={`nav-link ${isActive('/admin/roles') ? 'nav-link-active' : ''}`}
              >
                <BarChart2 className="w-5 h-5" />
                <span>Roles</span>
              </Link>
            )}
          </div>
        )}

        {/* Settings */}
        {can('view_settings') && (
          <div className="pt-4 pb-2">
            <Link
              href="/settings"
              className={`nav-link ${isActive('/settings') ? 'nav-link-active' : ''}`}
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </Link>
          </div>
        )}
      </div>

      {/* Footer Tabs */}
      <div className="mt-auto px-4 space-y-1 pt-6 border-t border-outline-variant/50">
        <Link
          href="#"
          className="flex items-center gap-3 px-4 py-2 rounded text-on-secondary-container font-medium hover:bg-surface-container-high transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
          <span>Help Center</span>
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded text-on-secondary-container font-medium hover:bg-error/10 hover:text-error transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  )
}
