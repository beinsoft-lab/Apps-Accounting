'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User, Role, Permission } from '@/types'
import { mockUsers } from '@/mock/users'
import { hasPermission } from '@/lib/auth'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Restore session from localStorage
    try {
      const stored = localStorage.getItem('beinsoft_user')
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch {
      // ignore
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, _password: string): Promise<boolean> => {
    // Mock authentication — find user by email
    const found = mockUsers.find((u) => u.email === email)
    if (!found) return false
    setUser(found)
    localStorage.setItem('beinsoft_user', JSON.stringify(found))
    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('beinsoft_user')
  }, [])

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false
      return hasPermission(user.role as Role, permission)
    },
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
