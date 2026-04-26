import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { getSignoffConfig, saveSignoffConfig } from '@/services/signoffConfig'
import type { SignoffConfig } from '@/types/settings'

const DEFAULT: SignoffConfig = { enabled: true }

export function SignoffSettingsPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [config, setConfig]   = useState<SignoffConfig>(DEFAULT)

  useEffect(() => {
    getSignoffConfig()
      .then(setConfig)
      .catch(() => { /* keep default */ })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveSignoffConfig(config)
      toast.success('Sign-off setting saved', {
        description: config.enabled
          ? 'Sign-off workflow is now enabled for project team members.'
          : 'Sign-off workflow is now hidden from project team members.',
      })
    } catch {
      toast.error('Failed to save sign-off setting')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/settings')} className="cursor-pointer">
              Settings
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Sign-off Control</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <BadgeCheck className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign-off Control</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Control whether the sign-off workflow is available to project team members.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4 max-w-sm">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-24" />
        </div>
      ) : (
        <div className="space-y-6 max-w-sm">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="signoff-toggle" className="text-sm font-medium">
                  Enable sign-off workflow
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, eligible users see the Sign-off button on project detail pages.
                </p>
              </div>
              <Switch
                id="signoff-toggle"
                checked={config.enabled}
                onCheckedChange={checked => setConfig({ enabled: checked })}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  )
}
