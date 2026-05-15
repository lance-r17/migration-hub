import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bell, Clock, Play, Save } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getEmailEventConfig,
  updateEmailEventConfig,
  triggerCutoverReminder,
  type EmailEventConfig,
} from '@/services/adminEmailService'

const DEFAULT_REMINDER_DAYS = [1, 3, 7, 14, 30]

export function NotificationSettingsPage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<EmailEventConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    getEmailEventConfig()
      .then(setConfig)
      .catch(() => toast.error('Failed to load notification settings'))
      .finally(() => setLoading(false))
  }, [])

  const toggleDay = (day: number) => {
    if (!config) return
    const current = config.cutover_reminder?.reminder_days ?? []
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    setConfig({
      ...config,
      cutover_reminder: {
        ...config.cutover_reminder,
        reminder_days: next,
      },
    })
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const saved = await updateEmailEventConfig(config)
      setConfig(saved)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      const result = await triggerCutoverReminder()
      toast.success(`Triggered scan — ${result.enqueued} job(s) enqueued`)
    } catch {
      toast.error('Trigger failed')
    } finally {
      setTriggering(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const cutover = config?.cutover_reminder

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/admin')} className="cursor-pointer">
              Admin
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Notifications</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Notification Settings</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Configure event-driven email triggers and cron behavior.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="size-4 mr-1.5" />
            Save
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-muted-foreground" />
              Cutover Reminder
            </CardTitle>
            <CardDescription>
              Automatically email project stakeholders before a wave cutover date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Enabled</p>
                <p className="text-muted-foreground text-xs">Send reminder emails for upcoming cutovers.</p>
              </div>
              <Switch
                checked={cutover?.enabled ?? true}
                onCheckedChange={(v) =>
                  setConfig({
                    ...config,
                    cutover_reminder: { ...cutover, enabled: v },
                  })
                }
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm">Reminder days</p>
                <p className="text-muted-foreground text-xs">How many days before cutover to send reminders.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_REMINDER_DAYS.map((day) => (
                  <Badge
                    key={day}
                    variant={cutover?.reminder_days?.includes(day) ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleDay(day)}
                  >
                    {day} day{day > 1 ? 's' : ''}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm">Run time (UTC)</p>
                <p className="text-muted-foreground text-xs">Daily scan time in 24-hour format.</p>
              </div>
              <Input
                type="time"
                value={cutover?.run_time_utc ?? '09:00'}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    cutover_reminder: { ...cutover, run_time_utc: e.target.value },
                  })
                }
                className="w-32"
              />
            </div>

            <div className="pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={handleTrigger} disabled={triggering}>
                <Play className="size-3.5 mr-1.5" />
                {triggering ? 'Running…' : 'Trigger manual scan'}
              </Button>
              <p className="text-muted-foreground text-xs mt-2">
                Manual scan checks all waves immediately and enqueues matching reminders.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
