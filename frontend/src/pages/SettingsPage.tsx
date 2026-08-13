import { useNavigate } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useCurrentUser } from '@/context/UserContext'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  const canAccessSettings = user?.role.includes('platform_migration_lead') || user?.role.includes('admin')

  if (!canAccessSettings) {
    return (
      <AppShell title="Settings">
        <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm mb-6">
              Settings are only available to Platform Migration Leads or Administrators.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Settings">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </AppShell>
  )
}
