import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

export function useProfitLoss() {
  return useQuery({
    queryKey: ['profit-loss'],
    queryFn: api.getProfitLoss,
  })
}
