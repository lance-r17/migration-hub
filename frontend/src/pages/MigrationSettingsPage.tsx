import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DateRange } from 'react-day-picker'
import { CalendarRange, Timer } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, X, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getMigrationSettings, saveMigrationSettings } from '@/services/migrationSettings'
import type { MigrationSettings } from '@/types/settings'

const DEFAULTS: MigrationSettings = { durationOptions: [15, 30, 45] }

export function MigrationSettingsPage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<MigrationSettings>(DEFAULTS)
  const [durationInput, setDurationInput] = useState('')

  useEffect(() => {
    getMigrationSettings()
      .then(setConfig)
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveMigrationSettings(config)
      toast.success('Migration settings saved')
    } catch {
      toast.error('Failed to save migration settings')
    } finally {
      setSaving(false)
    }
  }

  const addDuration = () => {
    const val = parseInt(durationInput, 10)
    if (!Number.isFinite(val) || val <= 0) return
    if (config.durationOptions.includes(val)) return
    setConfig(prev => ({ ...prev, durationOptions: [...prev.durationOptions, val].sort((a, b) => a - b) }))
    setDurationInput('')
  }

  const removeDuration = (val: number) => {
    setConfig(prev => ({ ...prev, durationOptions: prev.durationOptions.filter(v => v !== val) }))
  }

  const selectedPeriodRange: DateRange = {
    from: config.platformPeriod?.startDate ? new Date(config.platformPeriod.startDate) : undefined,
    to: config.platformPeriod?.endDate ? new Date(config.platformPeriod.endDate) : undefined,
  }

  const periodLabel = (() => {
    const { from, to } = selectedPeriodRange
    if (!from && !to) return 'Pick a date range'
    const f = format(from!, 'MMM d, y')
    if (!to) return f
    return `${f} – ${format(to, 'MMM d, y')}`
  })()

  const handlePeriodRangeSelect = (range: DateRange | undefined) => {
    setConfig(prev => ({
      ...prev,
      platformPeriod: {
        startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
        endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
      },
    }))
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
            <BreadcrumbPage>Migration Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarRange className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Migration Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Configure the platform migration period and allowed migration durations.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4 max-w-sm">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-24" />
        </div>
      ) : (
        <div className="space-y-6 max-w-lg">
          <div className="rounded-lg border border-border bg-card p-5 space-y-5">
            {/* Platform Period */}
            <div className="space-y-1.5">
              <Label>Platform Migration Period</Label>
              <p className="text-xs text-muted-foreground">
                The overall window during which all migrations must take place.
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start text-left text-sm font-normal',
                      !config.platformPeriod?.startDate && !config.platformPeriod?.endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon size={14} className="mr-2 shrink-0" />
                    {periodLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    defaultMonth={selectedPeriodRange.from}
                    selected={selectedPeriodRange}
                    onSelect={handlePeriodRangeSelect}
                  />
                </PopoverContent>
              </Popover>
              {config.platformPeriod?.startDate && config.platformPeriod?.endDate &&
                new Date(config.platformPeriod.startDate) > new Date(config.platformPeriod.endDate) && (
                <p className="text-xs text-destructive">End date must be after start date.</p>
              )}
            </div>

            {/* Duration Options */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Timer size={13} className="text-muted-foreground" />
                Migration Duration Options (days)
              </Label>
              <p className="text-xs text-muted-foreground">
                These durations will be available when selecting a migration window.
              </p>
              <div className="flex flex-wrap gap-2">
                {config.durationOptions.map((val) => (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm bg-primary/10 text-primary"
                  >
                    {val} days
                    <button
                      type="button"
                      onClick={() => removeDuration(val)}
                      className="hover:text-destructive"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Add duration in days…"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDuration() } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addDuration}>
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setConfig(DEFAULTS) }}
              disabled={saving}
            >
              Reset to defaults
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
