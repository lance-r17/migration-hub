import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DateRange } from 'react-day-picker'
import { CalendarRange, Database, CloudCog } from 'lucide-react'
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

const DEFAULTS: MigrationSettings = {
  durationOptions: [15, 30, 45],
  cloudSetupPeriod: { startDate: '2026-04-01', endDate: '2026-12-12' },
  dataMigration: {
    cycleDurationDays: 7,
    minCycle: 1,
    maxCycle: 3,
    minDtsInstanceCount: 1,
    maxDtsInstanceCount: 5,
    cycleCapacity: 20,
    asrDrLicenseCapacity: 2,
  },
}

function rangeLabel(range?: { startDate?: string; endDate?: string }): string {
  const from = range?.startDate ? new Date(range.startDate) : undefined
  const to = range?.endDate ? new Date(range.endDate) : undefined
  if (!from && !to) return 'Pick a date range'
  const f = format(from!, 'MMM d, y')
  if (!to) return f
  return `${f} – ${format(to, 'MMM d, y')}`
}

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

  const selectedCloudSetupRange: DateRange = {
    from: config.cloudSetupPeriod?.startDate ? new Date(config.cloudSetupPeriod.startDate) : undefined,
    to: config.cloudSetupPeriod?.endDate ? new Date(config.cloudSetupPeriod.endDate) : undefined,
  }

  const handleCloudSetupRangeSelect = (range: DateRange | undefined) => {
    setConfig(prev => ({
      ...prev,
      cloudSetupPeriod: {
        startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
        endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
      },
    }))
  }

  const selectedDataMigrationRange: DateRange = {
    from: config.dataMigration?.cyclePeriod?.startDate ? new Date(config.dataMigration.cyclePeriod.startDate) : undefined,
    to: config.dataMigration?.cyclePeriod?.endDate ? new Date(config.dataMigration.cyclePeriod.endDate) : undefined,
  }

  const handleDataMigrationRangeSelect = (range: DateRange | undefined) => {
    setConfig(prev => ({
      ...prev,
      dataMigration: {
        ...prev.dataMigration,
        cyclePeriod: {
          startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
          endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
        },
      },
    }))
  }

  const updateDataMigrationNumber = (key: keyof NonNullable<MigrationSettings['dataMigration']>, value: string) => {
    const parsed = value === '' ? undefined : parseInt(value, 10)
    setConfig(prev => ({
      ...prev,
      dataMigration: {
        ...prev.dataMigration,
        [key]: Number.isFinite(parsed) ? parsed : prev.dataMigration?.[key],
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
          Configure the platform migration period, new cloud setup period, and allowed migration durations.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-7xl">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start max-w-7xl">
          <div className="rounded-lg border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <CloudCog className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Platform Migration</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure the platform migration period, new cloud setup period, and allowed migration durations.
            </p>

            {/* New Cloud Setup Period */}
            <div className="space-y-1.5">
              <Label>New Cloud Setup Period</Label>
              <p className="text-xs text-muted-foreground">
                The window for setting up the new cloud environment. Wave start dates can begin from this period.
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start text-left text-sm font-normal',
                      !config.cloudSetupPeriod?.startDate && !config.cloudSetupPeriod?.endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon size={14} className="mr-2 shrink-0" />
                    {rangeLabel(config.cloudSetupPeriod)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    defaultMonth={selectedCloudSetupRange.from}
                    selected={selectedCloudSetupRange}
                    onSelect={handleCloudSetupRangeSelect}
                  />
                </PopoverContent>
              </Popover>
              {config.cloudSetupPeriod?.startDate && config.cloudSetupPeriod?.endDate &&
                new Date(config.cloudSetupPeriod.startDate) > new Date(config.cloudSetupPeriod.endDate) && (
                <p className="text-xs text-destructive">End date must be after start date.</p>
              )}
            </div>

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
              <Label>Migration Duration Options (days)</Label>
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

          {/* Data Migration Parameters */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Database className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Data Migration</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure defaults and constraints for the data migration schedule survey.
            </p>

            {/* Cycle Period */}
            <div className="space-y-1.5">
              <Label>Cycle Period</Label>
              <p className="text-xs text-muted-foreground">
                The window within which data migration start and end dates can be selected.
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-9 w-full justify-start text-left text-sm font-normal',
                      !config.dataMigration?.cyclePeriod?.startDate && !config.dataMigration?.cyclePeriod?.endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon size={14} className="mr-2 shrink-0" />
                    {rangeLabel(config.dataMigration?.cyclePeriod)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    defaultMonth={selectedDataMigrationRange.from}
                    selected={selectedDataMigrationRange}
                    onSelect={handleDataMigrationRangeSelect}
                  />
                </PopoverContent>
              </Popover>
              {config.dataMigration?.cyclePeriod?.startDate && config.dataMigration?.cyclePeriod?.endDate &&
                new Date(config.dataMigration.cyclePeriod.startDate) > new Date(config.dataMigration.cyclePeriod.endDate) && (
                <p className="text-xs text-destructive">End date must be after start date.</p>
              )}
            </div>

            {/* Cycle Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="cycle-duration">Cycle Duration (days)</Label>
              <Input
                id="cycle-duration"
                type="number"
                min={1}
                value={config.dataMigration?.cycleDurationDays ?? ''}
                onChange={(e) => updateDataMigrationNumber('cycleDurationDays', e.target.value)}
              />
            </div>

            {/* Min / Max Cycle */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-cycle">Min Cycle</Label>
                <Input
                  id="min-cycle"
                  type="number"
                  min={1}
                  value={config.dataMigration?.minCycle ?? ''}
                  onChange={(e) => updateDataMigrationNumber('minCycle', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-cycle">Max Cycle</Label>
                <Input
                  id="max-cycle"
                  type="number"
                  min={1}
                  value={config.dataMigration?.maxCycle ?? ''}
                  onChange={(e) => updateDataMigrationNumber('maxCycle', e.target.value)}
                />
              </div>
            </div>

            {/* Min / Max DTS Instance Count */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-dts">Min DTS Instances</Label>
                <Input
                  id="min-dts"
                  type="number"
                  min={1}
                  value={config.dataMigration?.minDtsInstanceCount ?? ''}
                  onChange={(e) => updateDataMigrationNumber('minDtsInstanceCount', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-dts">Max DTS Instances</Label>
                <Input
                  id="max-dts"
                  type="number"
                  min={1}
                  value={config.dataMigration?.maxDtsInstanceCount ?? ''}
                  onChange={(e) => updateDataMigrationNumber('maxDtsInstanceCount', e.target.value)}
                />
              </div>
            </div>

            {/* Cycle Capacity */}
            <div className="space-y-1.5">
              <Label htmlFor="cycle-capacity">Cycle Capacity</Label>
              <Input
                id="cycle-capacity"
                type="number"
                min={1}
                value={config.dataMigration?.cycleCapacity ?? ''}
                onChange={(e) => updateDataMigrationNumber('cycleCapacity', e.target.value)}
              />
            </div>

            {/* ASR-DR License Capacity */}
            <div className="space-y-1.5">
              <Label htmlFor="asr-dr-license-capacity">ASR-DR License Capacity</Label>
              <Input
                id="asr-dr-license-capacity"
                type="number"
                min={0}
                value={config.dataMigration?.asrDrLicenseCapacity ?? ''}
                onChange={(e) => updateDataMigrationNumber('asrDrLicenseCapacity', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum ASR-DR licenses available per data migration cycle block.
              </p>
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
