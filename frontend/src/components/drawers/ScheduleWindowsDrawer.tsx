import { useState, useEffect, useRef } from 'react'
import { format, addDays, isBefore, isAfter } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

import { DateRangeEntryEditor } from './DateRangeEntryEditor'
import { StringListEditor } from './StringListEditor'
import { MigrationWindowPicker } from '@/components/shared/MigrationWindowPicker'
import { cn } from '@/lib/utils'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import type { MigrationConstraints, DateRangeEntry } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MigrationConstraints | undefined
  onSave: (data: MigrationConstraints) => void
}

export function ScheduleWindowsDrawer({ open, onOpenChange, data, onSave }: Props) {
  const { settings } = useMigrationSettings()

  const [draft, setDraft] = useState({
    regularMigrationWindow: '',
    preferredMigrationWindow: [] as ('weekday' | 'weekend')[],
    earliestStartDate: '',
    latestEndDate: '',
    crDurationHours: '',
    snowCiGroups: [] as string[],
    changeFreezePeriods: [] as DateRangeEntry[],
    selectedDuration: '',
  })

  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const start = data?.earliestStartDate ?? ''
      const end = data?.latestEndDate ?? ''
      let duration = ''
      if (start && end) {
        const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))
        duration = String(days)
      }
      setDraft({
        regularMigrationWindow: data?.regularMigrationWindow ?? '',
        preferredMigrationWindow: data?.preferredMigrationWindow ?? [],
        earliestStartDate: start,
        latestEndDate: end,
        crDurationHours: data?.crDurationHours?.toString() ?? '',
        snowCiGroups: data?.snowCiGroups ?? [],
        changeFreezePeriods: data?.changeFreezePeriods ?? [],
        selectedDuration: duration,
      })
    }
    wasOpenRef.current = open
  }, [open, data])

  const platformStart = settings?.platformPeriod?.startDate
  const platformEnd = settings?.platformPeriod?.endDate

  const disabledDates = (() => {
    if (!platformStart || !platformEnd) return undefined
    const startBound = { before: new Date(platformStart) }
    const days = parseInt(draft.selectedDuration, 10)
    if (Number.isFinite(days) && days > 0) {
      const maxStart = addDays(new Date(platformEnd), -days)
      return [startBound, { after: maxStart }]
    }
    return [startBound, { after: new Date(platformEnd) }]
  })()

  function computeEndDate(start: string, durationDays: string): string {
    if (!start || !durationDays) return ''
    const days = parseInt(durationDays, 10)
    if (!Number.isFinite(days) || days <= 0) return ''
    return format(addDays(new Date(start), days), 'yyyy-MM-dd')
  }

  function isWithinPlatformPeriod(start: string, end: string): boolean {
    if (!platformStart || !platformEnd) return true
    if (!start || !end) return true
    const s = new Date(start)
    const e = new Date(end)
    const ps = new Date(platformStart)
    const pe = new Date(platformEnd)
    return !isBefore(s, ps) && !isAfter(e, pe)
  }

  const computedEndDate = computeEndDate(draft.earliestStartDate, draft.selectedDuration)
  const displayEndDate = computedEndDate || draft.latestEndDate

  const rangeError = (draft.earliestStartDate && displayEndDate)
    ? !isWithinPlatformPeriod(draft.earliestStartDate, displayEndDate)
      ? `Migration window must be within platform period${platformStart && platformEnd ? ` (${format(new Date(platformStart), 'MMM d, y')} – ${format(new Date(platformEnd), 'MMM d, y')})` : ''}.`
      : null
    : null

  function handleSave() {
    const end = computeEndDate(draft.earliestStartDate, draft.selectedDuration) || draft.latestEndDate
    onSave({
      ...data,
      regularMigrationWindow: draft.regularMigrationWindow,
      preferredMigrationWindow: draft.preferredMigrationWindow.length ? draft.preferredMigrationWindow : undefined,
      earliestStartDate: draft.earliestStartDate || undefined,
      latestEndDate: end || undefined,
      crDurationHours: draft.crDurationHours !== '' ? Number(draft.crDurationHours) : undefined,
      snowCiGroups: draft.snowCiGroups.length ? draft.snowCiGroups : undefined,
      changeFreezePeriods: draft.changeFreezePeriods.length ? draft.changeFreezePeriods : undefined,
    })
    onOpenChange(false)
  }

  function togglePreferred(opt: 'weekday' | 'weekend', checked: boolean) {
    setDraft(d => ({
      ...d,
      preferredMigrationWindow: checked
        ? [...d.preferredMigrationWindow, opt]
        : d.preferredMigrationWindow.filter(v => v !== opt),
    }))
  }

  const durationOptions = settings?.durationOptions ?? [15, 30, 45]

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Schedule & Windows" onSave={handleSave} saveDisabled={!!rangeError}>
      <div className="space-y-1.5">
        <Label>Regular Maintenance Window</Label>
        <MigrationWindowPicker
          value={draft.regularMigrationWindow || undefined}
          onChange={(v) => setDraft(d => ({ ...d, regularMigrationWindow: v ?? '' }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Preferred Migration Window</Label>
        <div className="flex gap-6">
          {(['weekday', 'weekend'] as const).map(opt => (
            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={draft.preferredMigrationWindow.includes(opt)}
                onCheckedChange={(checked) => togglePreferred(opt, !!checked)}
              />
              {opt === 'weekday' ? 'Weekday (Mon–Fri)' : 'Weekend (Sat–Sun)'}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Migration Duration</Label>
        <div className="flex flex-wrap gap-2">
          {durationOptions.map(days => {
            const selected = draft.selectedDuration === String(days)
            return (
              <button
                key={days}
                type="button"
                onClick={() => {
                  const val = selected ? '' : String(days)
                  setDraft(d => ({
                    ...d,
                    selectedDuration: val,
                    latestEndDate: computeEndDate(d.earliestStartDate, val),
                  }))
                }}
                className={cn(
                  'inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted'
                )}
              >
                {days} days
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Migration Start Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('h-9 w-full justify-start text-left text-sm font-normal', !draft.earliestStartDate && 'text-muted-foreground')}
            >
              <CalendarIcon size={14} className="mr-2 shrink-0" />
              {draft.earliestStartDate
                ? format(new Date(draft.earliestStartDate), 'MMM d, y')
                : 'Pick a start date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              defaultMonth={draft.earliestStartDate ? new Date(draft.earliestStartDate) : platformStart ? new Date(platformStart) : undefined}
              selected={draft.earliestStartDate ? new Date(draft.earliestStartDate) : undefined}
              onSelect={(date) => {
                const start = date ? format(date, 'yyyy-MM-dd') : ''
                setDraft(d => ({
                  ...d,
                  earliestStartDate: start,
                  latestEndDate: computeEndDate(start, d.selectedDuration),
                }))
              }}
              disabled={disabledDates}
            />
          </PopoverContent>
        </Popover>
      </div>

      {displayEndDate && (
        <div className="space-y-1.5">
          <Label>Migration End Date (auto-calculated)</Label>
          <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/50 text-sm text-foreground">
            {format(new Date(displayEndDate), 'MMM d, y')}
          </div>
        </div>
      )}

      {rangeError && (
        <p className="text-xs text-destructive">{rangeError}</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sw-cr-duration">CR Duration (hours)</Label>
        <Input
          id="sw-cr-duration"
          type="number"
          min={1}
          value={draft.crDurationHours}
          onChange={(e) => setDraft(d => ({ ...d, crDurationHours: e.target.value }))}
          placeholder="e.g. 4"
        />
        {Number(draft.crDurationHours) > 24 && (
          <p className="text-xs text-amber-600">Duration &gt; 24 hours — consider splitting into multiple CRs.</p>
        )}
      </div>

      <StringListEditor
        label="SNOW CI Groups"
        values={draft.snowCiGroups}
        onChange={(v) => setDraft(d => ({ ...d, snowCiGroups: v }))}
        placeholder="Add a CI group"
      />

      <DateRangeEntryEditor
        label="Embargo / Change freeze periods"
        values={draft.changeFreezePeriods}
        onChange={(v) => setDraft(d => ({ ...d, changeFreezePeriods: v }))}
      />
    </SectionEditDrawer>
  )
}
