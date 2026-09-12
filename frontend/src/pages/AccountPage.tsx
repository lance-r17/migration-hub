import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff, CircleUserRound, KeyRound } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/context/UserContext'
import { getMyLocalAccount } from '@/services/users'
import type { MyLocalAccount } from '@/services/users'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0" title="Copy">
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  )
}

export function AccountPage() {
  const { user } = useCurrentUser()

  const [localAccount, setLocalAccount] = useState<MyLocalAccount | null>(null)
  const [localAccountLoading, setLocalAccountLoading] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyLocalAccount()
      .then((account) => {
        if (!cancelled) setLocalAccount(account)
      })
      .catch(() => {
        // ignore; section will show the empty state
      })
      .finally(() => {
        if (!cancelled) setLocalAccountLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <AppShell title="Account">
      <div className="max-w-screen-lg mx-auto w-full space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CircleUserRound className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your profile details and Early Access Experience credentials.
          </p>
        </div>

        {/* General */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">General</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" value={user?.name ?? ''} disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user?.email ?? ''} disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-department">Department</Label>
              <Input id="profile-department" value={user?.department ?? ''} disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-team">Team</Label>
              <Input id="profile-team" value={user?.team ?? ''} disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-initials">Initials</Label>
              <Input id="profile-initials" value={user?.initials ?? ''} disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-roles">Roles</Label>
              <Input id="profile-roles" value={user?.role.join(', ') ?? ''} disabled readOnly />
            </div>
          </div>
        </div>

        {/* Early Access Experience */}
        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Early Access Experience</h2>
          </div>
          {localAccountLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : !localAccount ? (
            <p className="text-sm text-muted-foreground">
              No local account has been provisioned for you yet. Please contact your administrator.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="local-account-name">Account Name</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="local-account-name"
                      value={localAccount.account_name}
                      disabled
                      readOnly
                    />
                    <CopyButton value={localAccount.account_name} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="local-account-password">Initial Password</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="local-account-password"
                      type={showPassword ? 'text' : 'password'}
                      value={localAccount.password}
                      disabled
                      readOnly
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowPassword((s) => !s)}
                      className="shrink-0"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <CopyButton value={localAccount.password} />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                This is the only place your initial password is displayed. It is intended for your{' '}
                <span className="font-medium text-foreground">first login</span> to the new cloud platform only —{' '}
                you must change it in the new cloud platform immediately after your first successful login.
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
