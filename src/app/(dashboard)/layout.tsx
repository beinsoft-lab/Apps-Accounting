'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import { useAuth } from '@/providers/AuthProvider'
import { Role, Permission } from '@/types'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, can } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  // Simple route protection based on roles
  useEffect(() => {
    if (!isLoading && user) {
      if (pathname.startsWith('/admin') && !can('manage_users') && !can('manage_roles')) {
        router.replace('/dashboard')
      }
      if (pathname === '/reports/balance-sheet' && !can('view_balance_sheet')) {
        router.replace('/dashboard')
      }
      if (pathname === '/reports/profit-loss' && !can('view_profit_loss')) {
        router.replace('/dashboard')
      }
    }
  }, [user, isLoading, pathname, can, router])

  if (isLoading || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-app">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="bg-background-app text-on-surface font-body-md h-screen overflow-hidden flex">
      <AppSidebar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden relative">
        <AppHeader />
        <main className="flex-1 overflow-y-auto pt-24 pb-12 px-8">
          <div className="max-w-[1440px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
