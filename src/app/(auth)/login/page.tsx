'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { mockUsers } from '@/mock/users'
import { getRoleLabel, getRoleColor } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // In this mock, password doesn't matter, just email
    const success = await login(email, password)
    
    if (success) {
      router.push('/dashboard')
    } else {
      setError('Email tidak ditemukan atau password salah.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-app p-container-margin">
      <div className="w-full max-w-md card p-section-padding space-y-8 animate-fade-in">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4 text-primary">
            <div className="w-16 h-16 rounded-xl bg-primary-container flex items-center justify-center text-primary font-bold text-2xl shadow-ambient">
              B
            </div>
          </div>
          <h1 className="text-headline-lg font-bold text-on-surface">Beinsoft Accounting</h1>
          <p className="text-body-md text-on-surface-variant">Sign in to manage your financial data</p>
        </div>

        {/* Demo Users Quick Login */}
        <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/30">
          <p className="text-xs font-semibold text-body-grey uppercase tracking-wider mb-3">
            Demo Users (Click to auto-fill)
          </p>
          <div className="space-y-2">
            {mockUsers.map(u => (
              <button 
                key={u.id}
                type="button"
                onClick={() => { setEmail(u.email); setPassword('password123'); setError('') }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-bright rounded border border-transparent hover:border-outline-variant/50 transition-colors flex justify-between items-center"
              >
                <span className="font-medium text-on-surface">{u.email}</span>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${getRoleColor(u.role)}`}>
                  {getRoleLabel(u.role)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded bg-error-container text-on-error-container text-sm font-medium border border-error/20">
              {error}
            </div>
          )}
          
          <div className="space-y-element-gap">
            <label htmlFor="email" className="block text-label-sm text-on-surface-variant">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@beinsoft.com"
              required
              className="input-field"
            />
          </div>

          <div className="space-y-element-gap">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-label-sm text-on-surface-variant">
                Password
              </label>
              <a href="#" className="text-label-sm text-primary hover:text-primary-fixed-dim transition-colors">
                Forgot Password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="input-field"
            />
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary focus:ring-primary border-outline-variant rounded bg-surface-bright cursor-pointer"
            />
            <label htmlFor="remember-me" className="ml-2 block text-body-md text-on-surface-variant cursor-pointer">
              Remember Me
            </label>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded shadow-sm text-label-sm font-bold text-on-primary bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 uppercase tracking-wider"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  )
}
