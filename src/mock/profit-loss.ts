import type { ProfitLossData } from '@/types'

export const mockProfitLossData: ProfitLossData = {
  period: 'Oktober 2023 (YTD)',
  revenue: {
    items: [
      { label: 'Penjualan Produk', amount: 980000000 },
      { label: 'Pendapatan Jasa', amount: 185000000 },
      { label: 'Pendapatan Lain-lain', amount: 45000000 },
      { label: 'Pendapatan Bunga', amount: 40000000 },
    ],
    total: 1250000000,
  },
  expenses: {
    items: [
      { label: 'Gaji & Tunjangan Karyawan', amount: 320000000 },
      { label: 'Biaya Operasional', amount: 185000000 },
      { label: 'Biaya Pemasaran & Iklan', amount: 95000000 },
      { label: 'Biaya Sewa Gedung', amount: 80000000 },
      { label: 'Biaya Listrik & Utilitas', amount: 45000000 },
      { label: 'Biaya Penyusutan', amount: 55000000 },
      { label: 'Biaya Administrasi', amount: 35000000 },
      { label: 'Biaya Lain-lain', amount: 35000000 },
    ],
    total: 850000000,
  },
  grossProfit: 400000000,
  netProfit: 400000000,
  netProfitMargin: 32.0,
  monthlyData: [
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
  ],
}
