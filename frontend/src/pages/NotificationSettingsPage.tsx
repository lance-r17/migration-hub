import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Bell, Clock, Milestone, Play, X } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  getEmailEventConfig,
  updateEmailEventConfig,
  scanCutoverReminders,
  enqueueCutoverReminders,
  scanMilestoneReminders,
  enqueueMilestoneReminders,
  type CutoverReminderConfig,
  type CutoverReminderMatch,
  type MilestoneReminderConfig,
  type MilestoneReminderMatch,
  type EmailEventConfig,
  type ResolvedRecipient,
} from '@/services/adminEmailService'

const DEFAULT_REMINDER_DAYS = [1, 3, 7, 14, 30]

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
}

/** Editable recipient list for scan dialogs: one row per recipient with a
 *  role/custom badge and a remove button. */
function RecipientListEditor({
  recipients,
  removed,
  onRemove,
}: {
  recipients: ResolvedRecipient[]
  removed: string[]
  onRemove: (email: string) => void
}) {
  const visible = recipients.filter((r) => !removed.includes(r.email))
  if (visible.length === 0) {
    return <p className="text-xs text-destructive">All recipients removed — this row will be skipped.</p>
  }
  return (
    <div className="space-y-1">
      {visible.map((r) => (
        <div key={r.email} className="flex items-center gap-2">
          <Badge
            variant={r.badge === 'Custom' ? 'outline' : 'secondary'}
            className="text-[10px] shrink-0"
          >
            {r.badge}
          </Badge>
          <span className="text-xs text-foreground break-all">{r.email}</span>
          <button
            onClick={() => onRemove(r.email)}
            className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
            aria-label={`Remove ${r.email}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function NotificationSettingsPage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<EmailEventConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEmailEventConfig()
      .then(setConfig)
      .catch(() => toast.error('Failed to load notification settings'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

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

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bell className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Notification Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Configure event-driven email triggers and cron behavior.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <CutoverReminderCard initial={config?.cutover_reminder} />
        <MilestoneReminderCard initial={config?.milestone_reminder} />
      </div>
    </div>
  )
}

// ─── Cutover Reminder card ─────────────────────────────────────────────────────

function CutoverReminderCard({ initial }: { initial?: CutoverReminderConfig }) {
  const navigate = useNavigate()
  const [config, setConfig] = useState<CutoverReminderConfig>(initial ?? {})
  const [saving, setSaving] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [matches, setMatches] = useState<CutoverReminderMatch[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removed, setRemoved] = useState<Record<string, string[]>>({})
  const [enqueuing, setEnqueuing] = useState(false)

  const toggleDay = (day: number) => {
    const current = config.reminder_days ?? []
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    setConfig({ ...config, reminder_days: next })
  }

  const effectiveRecipients = (m: CutoverReminderMatch) =>
    m.recipients.filter((r) => !(removed[keyOf(m)] ?? []).includes(r.email))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateEmailEventConfig({ cutover_reminder: config })
      toast.success('Cutover reminder settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const keyOf = (m: CutoverReminderMatch) => `${m.waveId}::${m.projectId}`

  const removeRecipient = (m: CutoverReminderMatch, email: string) => {
    const key = keyOf(m)
    const next = { ...removed, [key]: [...(removed[key] ?? []), email] }
    setRemoved(next)
    // Deselect the row when its last recipient is removed
    if (m.recipients.every((r) => next[key].includes(r.email))) {
      setSelected((prev) => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      const result = await scanCutoverReminders()
      setMatches(result.items)
      setSelected(new Set(result.items.filter((m) => !m.alreadyEnqueued).map(keyOf)))
      setRemoved({})
      setScanOpen(true)
    } catch {
      toast.error('Scan failed')
    } finally {
      setTriggering(false)
    }
  }

  const selectable = matches.filter((m) => !m.alreadyEnqueued)
  const allSelected = selectable.length > 0 && selectable.every((m) => selected.has(keyOf(m)))

  const toggleSelect = (m: CutoverReminderMatch) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyOf(m))) next.delete(keyOf(m))
      else next.add(keyOf(m))
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectable.map(keyOf)))
  }

  const handleEnqueue = async () => {
    const chosen = matches
      .filter((m) => selected.has(keyOf(m)))
      .map((m) => ({
        waveId: m.waveId,
        projectId: m.projectId,
        recipients: effectiveRecipients(m).map((r) => r.email),
      }))
    setEnqueuing(true)
    try {
      const result = await enqueueCutoverReminders(chosen)
      setScanOpen(false)
      toast.success(`Enqueued ${result.enqueued} reminder(s)`, {
        action: { label: 'View email jobs', onClick: () => navigate('/admin/email-jobs') },
      })
    } catch {
      toast.error('Enqueue failed')
    } finally {
      setEnqueuing(false)
    }
  }

  return (
    <>
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
              checked={config.enabled ?? true}
              onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
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
                  variant={config.reminder_days?.includes(day) ? 'default' : 'outline'}
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
              value={config.run_time_utc ?? '09:00'}
              onChange={(e) => setConfig({ ...config, run_time_utc: e.target.value })}
              className="w-32"
            />
          </div>

          <div className="pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={handleTrigger} disabled={triggering}>
              <Play className="size-3.5 mr-1.5" />
              {triggering ? 'Scanning…' : 'Trigger manual scan'}
            </Button>
            <p className="text-muted-foreground text-xs mt-2">
              Manual scan lists matching reminders by project so you can choose which to enqueue.
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Matching Cutover Reminders</DialogTitle>
            <DialogDescription>
              Select which projects to enqueue reminder emails for.
            </DialogDescription>
          </DialogHeader>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No upcoming cutovers found within the configured reminder window.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  disabled={selectable.length === 0}
                />
                <span className="text-sm text-muted-foreground">
                  {selected.size} of {selectable.length} selected
                </span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-border">
                {matches.map((m) => (
                  <div key={keyOf(m)} className="flex items-start gap-3 py-3">
                    <Checkbox
                      checked={selected.has(keyOf(m))}
                      onCheckedChange={() => toggleSelect(m)}
                      disabled={m.alreadyEnqueued}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{m.projectName}</p>
                        {m.alreadyEnqueued && (
                          <Badge variant="secondary" className="text-xs">Already enqueued</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.waveName} · cutover {m.cutoverDate} · in {m.daysUntil} day{m.daysUntil === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.subject}</p>
                      <RecipientListEditor
                        recipients={m.recipients}
                        removed={removed[keyOf(m)] ?? []}
                        onRemove={(email) => removeRecipient(m, email)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>Cancel</Button>
            <Button onClick={handleEnqueue} disabled={selected.size === 0 || enqueuing}>
              {enqueuing ? 'Enqueuing…' : `Enqueue (${selected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Milestone Reminder card ───────────────────────────────────────────────────

const SCOPE_OPTIONS: { key: 'planning' | 'auto_derived' | 'category'; label: string; hint: string }[] = [
  { key: 'planning', label: 'Planning milestones', hint: 'Milestones added to a project plan' },
  { key: 'auto_derived', label: 'Auto-derived milestones', hint: 'Environment provision and data migration period' },
  { key: 'category', label: 'Category milestones', hint: 'Shared milestones assigned to projects' },
]

function MilestoneReminderCard({ initial }: { initial?: MilestoneReminderConfig }) {
  const navigate = useNavigate()
  const [config, setConfig] = useState<MilestoneReminderConfig>(() => {
    const c = initial ?? {}
    // Normalize legacy single-number reminder_days to a list
    const days = c.reminder_days as unknown as number[] | number | undefined
    return {
      ...c,
      reminder_days: Array.isArray(days) ? days : days != null ? [days] : [7, 3, 1],
    }
  })
  const [saving, setSaving] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [matches, setMatches] = useState<MilestoneReminderMatch[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removed, setRemoved] = useState<Record<string, string[]>>({})
  const [enqueuing, setEnqueuing] = useState(false)

  const scopes = config.scopes ?? {}
  const setScope = (key: keyof NonNullable<MilestoneReminderConfig['scopes']>, v: boolean) =>
    setConfig({ ...config, scopes: { ...scopes, [key]: v } })

  const toggleDay = (day: number) => {
    const current = config.reminder_days ?? []
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    setConfig({ ...config, reminder_days: next })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateEmailEventConfig({ milestone_reminder: config })
      toast.success('Milestone reminder settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const keyOf = (m: MilestoneReminderMatch) => `${m.projectId}::${m.milestoneId}`

  const effectiveRecipients = (m: MilestoneReminderMatch) =>
    m.recipients.filter((r) => !(removed[keyOf(m)] ?? []).includes(r.email))

  const removeRecipient = (m: MilestoneReminderMatch, email: string) => {
    const key = keyOf(m)
    const next = { ...removed, [key]: [...(removed[key] ?? []), email] }
    setRemoved(next)
    // Deselect the row when its last recipient is removed
    if (m.recipients.every((r) => next[key].includes(r.email))) {
      setSelected((prev) => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      const result = await scanMilestoneReminders()
      setMatches(result.items)
      setSelected(new Set(result.items.filter((m) => !m.onCooldown).map(keyOf)))
      setRemoved({})
      setScanOpen(true)
    } catch {
      toast.error('Scan failed')
    } finally {
      setTriggering(false)
    }
  }

  const selectable = matches.filter((m) => !m.onCooldown)
  const allSelected = selectable.length > 0 && selectable.every((m) => selected.has(keyOf(m)))

  const toggleSelect = (m: MilestoneReminderMatch) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyOf(m))) next.delete(keyOf(m))
      else next.add(keyOf(m))
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectable.map(keyOf)))
  }

  const handleEnqueue = async () => {
    const chosen = matches
      .filter((m) => selected.has(keyOf(m)))
      .map((m) => ({
        projectId: m.projectId,
        milestoneId: m.milestoneId,
        recipients: effectiveRecipients(m).map((r) => r.email),
      }))
    setEnqueuing(true)
    try {
      const result = await enqueueMilestoneReminders(chosen)
      setScanOpen(false)
      toast.success(`Enqueued ${result.enqueued} reminder(s)`, {
        action: { label: 'View email jobs', onClick: () => navigate('/admin/email-jobs') },
      })
    } catch {
      toast.error('Enqueue failed')
    } finally {
      setEnqueuing(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Milestone className="size-4 text-muted-foreground" />
            Milestone Reminder
          </CardTitle>
          <CardDescription>
            Email project stakeholders when a milestone start (to do) or end (in progress) date is approaching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Enabled</p>
              <p className="text-muted-foreground text-xs">Send reminder emails for approaching milestones.</p>
            </div>
            <Switch
              checked={config.enabled ?? true}
              onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
            />
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm">Scope</p>
              <p className="text-muted-foreground text-xs">Which milestones trigger reminders.</p>
            </div>
            <div className="space-y-2">
              {SCOPE_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={scopes[opt.key] ?? (opt.key !== 'category')}
                    onCheckedChange={(v) => setScope(opt.key, v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-sm">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm">Reminder days</p>
              <p className="text-muted-foreground text-xs">Start reminding this many days before the milestone target date.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_REMINDER_DAYS.map((day) => (
                <Badge
                  key={day}
                  variant={config.reminder_days?.includes(day) ? 'default' : 'outline'}
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
              <p className="font-medium text-sm">Repeat every (days)</p>
              <p className="text-muted-foreground text-xs">Re-send interval until the milestone status changes.</p>
            </div>
            <Input
              type="number"
              min={1}
              value={config.frequency_days ?? 3}
              onChange={(e) => setConfig({ ...config, frequency_days: Number(e.target.value) || 1 })}
              className="w-32"
            />
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium text-sm">Run time (UTC)</p>
              <p className="text-muted-foreground text-xs">Daily scan time in 24-hour format.</p>
            </div>
            <Input
              type="time"
              value={config.run_time_utc ?? '09:00'}
              onChange={(e) => setConfig({ ...config, run_time_utc: e.target.value })}
              className="w-32"
            />
          </div>

          <div className="pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={handleTrigger} disabled={triggering}>
              <Play className="size-3.5 mr-1.5" />
              {triggering ? 'Scanning…' : 'Trigger manual scan'}
            </Button>
            <p className="text-muted-foreground text-xs mt-2">
              Manual scan lists due milestone reminders so you can choose which to enqueue.
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Due Milestone Reminders</DialogTitle>
            <DialogDescription>
              Select which milestone reminders to enqueue.
            </DialogDescription>
          </DialogHeader>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No milestones are currently due for a reminder.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  disabled={selectable.length === 0}
                />
                <span className="text-sm text-muted-foreground">
                  {selected.size} of {selectable.length} selected
                </span>
              </div>
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-border">
                {matches.map((m) => (
                  <div key={keyOf(m)} className="flex items-start gap-3 py-3">
                    <Checkbox
                      checked={selected.has(keyOf(m))}
                      onCheckedChange={() => toggleSelect(m)}
                      disabled={m.onCooldown}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{m.projectName}</p>
                        <Badge variant="outline" className="text-xs">
                          {MILESTONE_STATUS_LABELS[m.milestoneStatus] ?? m.milestoneStatus}
                        </Badge>
                        {m.onCooldown && m.lastSentAt && (
                          <Badge variant="secondary" className="text-xs">
                            Sent {new Date(m.lastSentAt).toLocaleDateString(undefined, { dateStyle: 'short' })}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {m.milestoneName} · {m.waveName} · target {m.targetDate} ·{' '}
                        {m.daysUntil >= 0
                          ? `in ${m.daysUntil} day${m.daysUntil === 1 ? '' : 's'}`
                          : `${-m.daysUntil} day${m.daysUntil === -1 ? '' : 's'} overdue`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.subject}</p>
                      <RecipientListEditor
                        recipients={m.recipients}
                        removed={removed[keyOf(m)] ?? []}
                        onRemove={(email) => removeRecipient(m, email)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>Cancel</Button>
            <Button onClick={handleEnqueue} disabled={selected.size === 0 || enqueuing}>
              {enqueuing ? 'Enqueuing…' : `Enqueue (${selected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
