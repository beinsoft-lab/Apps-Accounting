import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

export function useBalanceSheet() {
  return useQuery({
    queryKey: ['balance-sheet'],
    queryFn: api.getBalanceSheet,
  })
}
