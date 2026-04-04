import { useNavigate } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { Settings2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useCurrentUser } from '@/context/UserContext'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()

  if (user?.role !== 'Platform Migration Lead') {
    return (
      <AppShell title="Settings">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <Settings2 size={40} className="text-muted-foreground/30 mb-4" />
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm mb-6">
              Settings are only available to Platform Migration Leads.
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
      <div className="max-w-screen-xl mx-auto w-full">
        <Outlet />
      </div>
    </AppShell>
  )
}
