// ============================================
// User & Auth Types
// ============================================

export type Role = 'super_admin' | 'owner' | 'accountant' | 'viewer'

export type Permission =
  | 'view_dashboard'
  | 'view_reports'
  | 'view_balance_sheet'
  | 'view_profit_loss'
  | 'manage_users'
  | 'manage_roles'
  | 'view_settings'
  | 'edit_settings'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string
  department?: string
}

export interface AuthSession {
  user: User
  token: string
}

// ============================================
// Dashboard Types
// ============================================

export interface KPIMetric {
  value: number
  change: number    // percentage change vs last period
  trend: 'up' | 'down' | 'flat'
}

export interface DashboardKPIs {
  revenue: KPIMetric
  expenses: KPIMetric
  profit: KPIMetric
  assets: KPIMetric
  liabilities: KPIMetric
  equity: KPIMetric
}

export interface ChartDataPoint {
  month: string
  revenue: number
  expenses: number
  profit: number
}

export interface Transaction {
  id: string
  date: string
  description: string
  category: 'Revenue' | 'Expense' | 'Journal'
  reference: string
  amount: number
  type: 'credit' | 'debit' | 'neutral'
}

export interface DashboardData {
  kpis: DashboardKPIs
  chartData: ChartDataPoint[]
  recentTransactions: Transaction[]
  profitMargin: {
    current: number
    target: number
  }
}

// ============================================
// Balance Sheet Types
// ============================================

export interface BalanceSheetItem {
  label: string
  amount: number
}

export interface BalanceSheetSection {
  items: BalanceSheetItem[]
  total: number
}

export interface BalanceSheetData {
  period: string
  assets: {
    current: BalanceSheetSection
    fixed: BalanceSheetSection
    total: number
  }
  liabilities: {
    current: BalanceSheetSection
    longTerm: BalanceSheetSection
    total: number
  }
  equity: {
    items: BalanceSheetItem[]
    total: number
  }
  isBalanced: boolean
}

// ============================================
// Profit & Loss Types
// ============================================

export interface PLItem {
  label: string
  amount: number
}

export interface PLSection {
  items: PLItem[]
  total: number
}

export interface ProfitLossData {
  period: string
  revenue: PLSection
  expenses: PLSection
  grossProfit: number
  netProfit: number
  netProfitMargin: number
  monthlyData: ChartDataPoint[]
}

// ============================================
// User Management Types
// ============================================

export interface RolePermission {
  role: Role
  label: string
  description: string
  permissions: Permission[]
  color: string
}

export interface UserListData {
  users: User[]
  total: number
}

export interface RolesData {
  roles: RolePermission[]
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}
