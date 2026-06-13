import type { DashboardData, BalanceSheetData, ProfitLossData } from '@/types'
import { mockUsers } from '@/mock/users'
import { mockRoles } from '@/mock/roles'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'API error')
  return json.data as T
}

export const api = {
  getDashboard: () => fetchJSON<DashboardData>('/api/dashboard'),
  getBalanceSheet: () => fetchJSON<BalanceSheetData>('/api/reports/balance-sheet'),
  getProfitLoss: () => fetchJSON<ProfitLossData>('/api/reports/profit-loss'),

  // Users and Roles remain mock until auth sprint
  getUsers: async () => mockUsers,
  getRoles: async () => mockRoles,
}
