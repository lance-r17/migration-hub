import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateRangeEntryEditor } from './DateRangeEntryEditor'
import { MigrationWindowPicker } from '@/components/shared/MigrationWindowPicker'
import type { MigrationConstraints, DateRangeEntry } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: MigrationConstraints | undefined
  onSave: (data: MigrationConstraints) => void
}

export function ScheduleWindowsDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    migrationWindow: '',
    maxCutoverWindow: '',
    blackoutDates: [] as DateRangeEntry[],
    changeFreezePeriods: [] as DateRangeEntry[],
  })

  useEffect(() => {
    if (open) {
      setDraft({
        migrationWindow: data?.migrationWindow ?? '',
        maxCutoverWindow: data?.maxCutoverWindow ?? '',
        blackoutDates: data?.blackoutDates ?? [],
        changeFreezePeriods: data?.changeFreezePeriods ?? [],
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      migrationWindow: draft.migrationWindow,
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

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Schedule & Windows" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label>Migration Window</Label>
        <MigrationWindowPicker
          value={draft.migrationWindow || undefined}
          onChange={(v) => setDraft(d => ({ ...d, migrationWindow: v ?? '' }))}
        />
      </div>
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
