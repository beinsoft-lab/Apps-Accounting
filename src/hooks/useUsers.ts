import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: api.getRoles,
  })
}
