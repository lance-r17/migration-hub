import { useState, useEffect } from 'react'
import { format } from 'date-fns'
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
import type { MigrationConstraints, DateRangeEntry } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MigrationConstraints | undefined
  onSave: (data: MigrationConstraints) => void
}

export function ScheduleWindowsDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    regularMigrationWindow: '',
    preferredMigrationWindow: [] as ('weekday' | 'weekend')[],
    earliestStartDate: '',
    latestEndDate: '',
    crDurationHours: '',
    snowCiGroups: [] as string[],
    maxCutoverWindow: '',
    blackoutDates: [] as DateRangeEntry[],
    changeFreezePeriods: [] as DateRangeEntry[],
  })

  useEffect(() => {
    if (open) {
      setDraft({
        regularMigrationWindow: data?.regularMigrationWindow ?? '',
        preferredMigrationWindow: data?.preferredMigrationWindow ?? [],
        earliestStartDate: data?.earliestStartDate ?? '',
        latestEndDate: data?.latestEndDate ?? '',
        crDurationHours: data?.crDurationHours?.toString() ?? '',
        snowCiGroups: data?.snowCiGroups ?? [],
        maxCutoverWindow: data?.maxCutoverWindow ?? '',
        blackoutDates: data?.blackoutDates ?? [],
        changeFreezePeriods: data?.changeFreezePeriods ?? [],
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      regularMigrationWindow: draft.regularMigrationWindow,
      preferredMigrationWindow: draft.preferredMigrationWindow.length ? draft.preferredMigrationWindow : undefined,
      earliestStartDate: draft.earliestStartDate || undefined,
      latestEndDate: draft.latestEndDate || undefined,
      crDurationHours: draft.crDurationHours !== '' ? Number(draft.crDurationHours) : undefined,
      snowCiGroups: draft.snowCiGroups.length ? draft.snowCiGroups : undefined,
      blackoutDates: draft.blackoutDates,
      maxCutoverWindow: draft.maxCutoverWindow || undefined,
      changeFreezePeriods: draft.changeFreezePeriods.length ? draft.changeFreezePeriods : undefined,
      cutoverApproach: data?.cutoverApproach ?? '',
      rollbackPlan: data?.rollbackPlan ?? '',
      stakeholderComms: data?.stakeholderComms ?? '',
      preMigrationTesting: data?.preMigrationTesting ?? '',
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

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Schedule & Windows" onSave={handleSave}>
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
        <Label>Migration Date Range</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('h-9 w-full justify-start text-left text-sm font-normal', !draft.earliestStartDate && !draft.latestEndDate && 'text-muted-foreground')}
            >
              <CalendarIcon size={14} className="mr-2 shrink-0" />
              {draft.earliestStartDate && draft.latestEndDate
                ? `${format(new Date(draft.earliestStartDate), 'MMM d, y')} → ${format(new Date(draft.latestEndDate), 'MMM d, y')}`
                : draft.earliestStartDate
                ? `From ${format(new Date(draft.earliestStartDate), 'MMM d, y')}`
                : 'Pick a date range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={draft.earliestStartDate ? new Date(draft.earliestStartDate) : undefined}
              selected={{
                from: draft.earliestStartDate ? new Date(draft.earliestStartDate) : undefined,
                to: draft.latestEndDate ? new Date(draft.latestEndDate) : undefined,
              }}
              onSelect={(range) => setDraft(s => ({
                ...s,
                earliestStartDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
                latestEndDate: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
              }))}
            />
          </PopoverContent>
        </Popover>
      </div>

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

      <div className="space-y-1.5">
        <Label htmlFor="sw-max">Max Cutover Window</Label>
        <Input id="sw-max" value={draft.maxCutoverWindow} onChange={(e) => setDraft(d => ({ ...d, maxCutoverWindow: e.target.value }))} placeholder="e.g. 4 hours" />
      </div>
      <DateRangeEntryEditor
        label="Blackout Dates"
        values={draft.blackoutDates}
        onChange={(v) => setDraft(d => ({ ...d, blackoutDates: v }))}
      />
      <DateRangeEntryEditor
        label="Embargo / Change freeze periods"
        values={draft.changeFreezePeriods}
        onChange={(v) => setDraft(d => ({ ...d, changeFreezePeriods: v }))}
      />
    </SectionEditDrawer>
  )
}
