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
// Cash Transaction Types
// ============================================

export type CashType = 'IN' | 'OUT'
export type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID'

export interface CashAccountRef {
  id:       number
  code:     string
  name:     string
  category?: string
}

export interface CashTransaction {
  id:                  number
  transactionNumber:   string
  type:                CashType
  transactionDate:     string
  amount:              string
  description:         string
  referenceNumber?:    string
  partyName?:          string
  cashAccount:         CashAccountRef
  counterpartAccount:  CashAccountRef
  journal: {
    id:            number
    journalNumber: string
    status:        JournalStatus
  }
  createdAt: string
}

export interface CashListResponse {
  data: CashTransaction[]
  meta: {
    total:          number
    page:           number
    limit:          number
    totalPages:     number
    totalAmountIn:  number
    totalAmountOut: number
  }
  success: boolean
}

// ============================================
// Receivable (Piutang) Types
// ============================================

export type ReceivableStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'VOID'

export interface ReceivableAccountRef {
  id:       number
  code:     string
  name:     string
  category?: string
}

export interface ReceivablePayment {
  id:          number
  receivableId: number
  paymentDate: string
  amount:      string
  description: string | null
  cashAccount: ReceivableAccountRef
  journal: {
    id:            number
    journalNumber: string
    status:        JournalStatus
  }
  createdAt: string
}

export interface Receivable {
  id:               number
  receivableNumber: string
  customerName:     string
  description:      string
  referenceNumber?: string | null
  amount:           string
  paidAmount:       string
  remainingAmount:  string
  dueDate:          string
  status:           ReceivableStatus
  receivableAccount: ReceivableAccountRef
  journal: {
    id:            number
    journalNumber: string
    status:        JournalStatus
  }
  payments: ReceivablePayment[]
  createdAt: string
  updatedAt: string
}

export interface ReceivableListResponse {
  data: Receivable[]
  meta: {
    total:          number
    page:           number
    limit:          number
    totalPages:     number
    totalAmount:    number
    totalPaid:      number
    totalRemaining: number
  }
  success: boolean
}

// ============================================
// Payable (Hutang) Types
// ============================================

export type PayableStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'VOID'

export interface PayablePayment {
  id:          number
  payableId:   number
  paymentDate: string
  amount:      string
  description: string | null
  cashAccount: ReceivableAccountRef
  journal: {
    id:            number
    journalNumber: string
    status:        JournalStatus
  }
  createdAt: string
}

export interface Payable {
  id:             number
  payableNumber:  string
  vendorName:     string
  description:    string
  referenceNumber?: string | null
  amount:         string
  paidAmount:     string
  remainingAmount: string
  dueDate:        string
  status:         PayableStatus
  payableAccount: ReceivableAccountRef
  journal: {
    id:            number
    journalNumber: string
    status:        JournalStatus
  }
  payments:  PayablePayment[]
  createdAt: string
  updatedAt: string
}

export interface PayableListResponse {
  data: Payable[]
  meta: {
    total:          number
    page:           number
    limit:          number
    totalPages:     number
    totalAmount:    number
    totalPaid:      number
    totalRemaining: number
  }
  success: boolean
}

// ============================================
// Invoice (Faktur Penjualan) Types
// ============================================

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'VOID'

export interface InvoiceItem {
  id:          number
  invoiceId:   number
  description: string
  quantity:    string
  unitPrice:   string
  amount:      string
  createdAt:   string
}

export interface InvoicePayment {
  id:           number
  invoiceId:    number
  paymentDate:  string
  amount:       string
  description:  string | null
  cashAccount:  { id: number; code: string; name: string }
  journal: {
    id:            number
    journalNumber: string
    status:        JournalStatus
  }
  createdAt: string
}

export interface Invoice {
  id:              number
  invoiceNumber:   string
  customerName:    string
  customerAddress: string | null
  customerEmail:   string | null
  customerPhone:   string | null
  invoiceDate:     string
  dueDate:         string
  notes:           string | null
  taxRate:         string
  subtotal:        string
  taxAmount:       string
  totalAmount:     string
  paidAmount:      string
  remainingAmount: string
  status:          InvoiceStatus
  receivableAccount: { id: number; code: string; name: string; category?: string }
  revenueAccount:    { id: number; code: string; name: string; category?: string }
  journal?: {
    id:            number
    journalNumber: string
    status:        JournalStatus
    entries?: Array<{
      id:      number
      account: { id: number; code: string; name: string }
      debit:   string
      credit:  string
    }>
  } | null
  items:    InvoiceItem[]
  payments: InvoicePayment[]
  createdAt: string
  updatedAt: string
}

export interface InvoiceListResponse {
  data: Invoice[]
  meta: {
    total:          number
    page:           number
    limit:          number
    totalPages:     number
    totalAmount:    number
    totalPaid:      number
    totalRemaining: number
  }
  success: boolean
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}
