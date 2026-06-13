'use client'

import { useAuth } from '@/providers/AuthProvider'
import { getRoleLabel, getRoleColor } from '@/lib/auth'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <div className="mb-section-padding">
        <h2 className="text-headline-lg font-bold text-on-surface">Settings</h2>
        <p className="text-body-md text-body-grey mt-1">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Sidebar Navigation for Settings (Static) */}
        <div className="space-y-1">
          <button className="w-full flex items-center justify-between px-4 py-3 rounded text-primary font-bold border-l-4 border-primary bg-primary-container/10">
            Account Profile
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 rounded text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors">
            Preferences
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 rounded text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors">
            Notifications
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 rounded text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors">
            Security
          </button>
        </div>

        {/* Right Col: Form Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-gutter-lg">
            <h3 className="text-headline-md font-semibold text-on-surface mb-6">Profile Information</h3>
            
            <div className="flex items-center gap-6 mb-8">
              <div className="w-20 h-20 rounded-full bg-primary-container text-primary text-3xl font-bold flex items-center justify-center border-2 border-primary/20">
                {user.avatar ? user.avatar : user.name.charAt(0)}
              </div>
              <div>
                <button className="px-4 py-2 border border-outline-variant rounded text-label-sm text-on-surface hover:bg-surface-container-low transition-colors font-medium mb-2">
                  Change Avatar
                </button>
                <p className="text-xs text-body-grey">JPG, GIF or PNG. Max size of 800K</p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-label-sm text-on-surface-variant font-medium">Full Name</label>
                  <input type="text" defaultValue={user.name} className="input-field" />
                </div>
                <div className="space-y-2">
                  <label className="block text-label-sm text-on-surface-variant font-medium">Email Address</label>
                  <input type="email" defaultValue={user.email} className="input-field bg-surface-container-low" disabled />
                  <p className="text-xs text-body-grey">Email is managed by your administrator.</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-label-sm text-on-surface-variant font-medium">Department</label>
                  <input type="text" defaultValue={user.department} className="input-field" />
                </div>
                <div className="space-y-2">
                  <label className="block text-label-sm text-on-surface-variant font-medium">Current Role</label>
                  <div className="pt-2">
                    <span className={`badge ${getRoleColor(user.role)} uppercase tracking-wider px-3 py-1`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-outline-variant/30 flex justify-end">
                <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded text-label-sm font-bold shadow-ambient hover:bg-primary-container transition-colors">
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
