import type { DashboardData, ChartDataPoint, Transaction } from '@/types'

const chartData: ChartDataPoint[] = [
  { month: 'Jan', revenue: 980000000, expenses: 650000000, profit: 330000000 },
  { month: 'Feb', revenue: 1050000000, expenses: 710000000, profit: 340000000 },
  { month: 'Mar', revenue: 1180000000, expenses: 720000000, profit: 460000000 },
  { month: 'Apr', revenue: 1120000000, expenses: 780000000, profit: 340000000 },
  { month: 'May', revenue: 1320000000, expenses: 810000000, profit: 510000000 },
  { month: 'Jun', revenue: 1250000000, expenses: 850000000, profit: 400000000 },
  { month: 'Jul', revenue: 1380000000, expenses: 870000000, profit: 510000000 },
  { month: 'Aug', revenue: 1290000000, expenses: 830000000, profit: 460000000 },
  { month: 'Sep', revenue: 1410000000, expenses: 890000000, profit: 520000000 },
  { month: 'Oct', revenue: 1350000000, expenses: 860000000, profit: 490000000 },
  { month: 'Nov', revenue: 1480000000, expenses: 920000000, profit: 560000000 },
  { month: 'Dec', revenue: 1560000000, expenses: 950000000, profit: 610000000 },
]

const recentTransactions: Transaction[] = [
  {
    id: 'TXN-001',
    date: '24 Okt 2023',
    description: 'Pembayaran Invoice - PT Jaya Abadi',
    category: 'Revenue',
    reference: 'INV-2023-1042',
    amount: 125000000,
    type: 'credit',
  },
  {
    id: 'TXN-002',
    date: '22 Okt 2023',
    description: 'Langganan Software (Tahunan)',
    category: 'Expense',
    reference: 'EXP-2023-089',
    amount: -45200000,
    type: 'debit',
  },
  {
    id: 'TXN-003',
    date: '20 Okt 2023',
    description: 'Depresiasi Peralatan',
    category: 'Journal',
    reference: 'JV-2023-10A',
    amount: -12500000,
    type: 'neutral',
  },
  {
    id: 'TXN-004',
    date: '18 Okt 2023',
    description: 'Pembayaran Invoice - CV Makmur Sejahtera',
    category: 'Revenue',
    reference: 'INV-2023-1039',
    amount: 85000000,
    type: 'credit',
  },
  {
    id: 'TXN-005',
    date: '15 Okt 2023',
    description: 'Pembayaran Gaji Oktober',
    category: 'Expense',
    reference: 'SAL-2023-10',
    amount: -320000000,
    type: 'debit',
  },
  {
    id: 'TXN-006',
    date: '12 Okt 2023',
    description: 'Penjualan Produk - PT Sinar Mas',
    category: 'Revenue',
    reference: 'INV-2023-1035',
    amount: 215000000,
    type: 'credit',
  },
]

export const mockDashboardData: DashboardData = {
  kpis: {
    revenue: { value: 1250000000, change: 12.5, trend: 'up' },
    expenses: { value: 850000000, change: 5.2, trend: 'up' },
    profit: { value: 400000000, change: 8.4, trend: 'up' },
    assets: { value: 5200000000, change: 0, trend: 'flat' },
    liabilities: { value: 1100000000, change: -2.1, trend: 'down' },
    equity: { value: 4100000000, change: 3.4, trend: 'up' },
  },
  chartData,
  recentTransactions,
  profitMargin: {
    current: 32.4,
    target: 40.0,
  },
}
