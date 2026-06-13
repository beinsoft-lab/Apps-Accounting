'use client'

import { Search, Bell, Grid } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { getRoleLabel, getRoleColor } from '@/lib/auth'

export function AppHeader() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-surface-bright border-b border-outline-variant flex justify-between items-center px-8 z-40">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-body-grey" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded focus:border-primary focus:ring-2 focus:ring-primary/20 text-label-sm outline-none transition-all"
          />
        </div>
      </div>

      {/* Actions & Profile */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-on-surface-variant">
          <button className="hover:text-primary transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-tertiary-container rounded-full border border-surface-bright"></span>
          </button>
          <button className="hover:text-primary transition-colors">
            <Grid className="w-5 h-5" />
          </button>
        </div>
        
        <div className="h-6 w-px bg-outline-variant"></div>
        
        <button className="text-label-sm text-on-surface-variant hover:text-primary transition-colors font-medium">
          Support
        </button>
        
        <button className="bg-primary text-on-primary px-4 py-2 rounded text-label-sm font-medium hover:bg-surface-tint transition-colors shadow-ambient">
          Quick Action
        </button>
        
        <div className="flex items-center gap-3 ml-2 border-l border-outline-variant pl-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-on-surface">{user.name}</span>
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${getRoleColor(user.role)}`}>
              {getRoleLabel(user.role)}
            </span>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary-container text-primary font-bold flex items-center justify-center overflow-hidden border border-primary/20">
            {user.avatar ? user.avatar : user.name.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  )
}
