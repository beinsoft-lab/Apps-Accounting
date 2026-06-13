import type { BalanceSheetData } from '@/types'

export const mockBalanceSheetData: BalanceSheetData = {
  period: 'Per 31 Oktober 2023',
  assets: {
    current: {
      items: [
        { label: 'Kas & Setara Kas', amount: 850000000 },
        { label: 'Rekening Bank - BCA', amount: 1200000000 },
        { label: 'Rekening Bank - Mandiri', amount: 450000000 },
        { label: 'Piutang Usaha', amount: 680000000 },
        { label: 'Piutang Lain-lain', amount: 125000000 },
        { label: 'Persediaan Barang', amount: 420000000 },
        { label: 'Biaya Dibayar Dimuka', amount: 75000000 },
      ],
      total: 3800000000,
    },
    fixed: {
      items: [
        { label: 'Tanah & Bangunan', amount: 1800000000 },
        { label: 'Peralatan & Mesin', amount: 650000000 },
        { label: 'Kendaraan', amount: 280000000 },
        { label: 'Inventaris Kantor', amount: 120000000 },
        { label: 'Akumulasi Depresiasi', amount: -450000000 },
      ],
      total: 2400000000,
    },
    total: 6200000000,
  },
  liabilities: {
    current: {
      items: [
        { label: 'Utang Usaha', amount: 380000000 },
        { label: 'Utang Gaji', amount: 320000000 },
        { label: 'Utang Pajak (PPh 21)', amount: 85000000 },
        { label: 'Utang PPN', amount: 125000000 },
        { label: 'Biaya Akrual', amount: 90000000 },
      ],
      total: 1000000000,
    },
    longTerm: {
      items: [
        { label: 'Utang Bank Jangka Panjang', amount: 800000000 },
        { label: 'Utang Leasing', amount: 200000000 },
        { label: 'Jaminan Pelanggan', amount: 100000000 },
      ],
      total: 1100000000,
    },
    total: 2100000000,
  },
  equity: {
    items: [
      { label: 'Modal Pemilik', amount: 2500000000 },
      { label: 'Laba Ditahan', amount: 1350000000 },
      { label: 'Laba Tahun Berjalan', amount: 250000000 },
    ],
    total: 4100000000,
  },
  isBalanced: true, // 6,200,000,000 = 2,100,000,000 + 4,100,000,000
}
