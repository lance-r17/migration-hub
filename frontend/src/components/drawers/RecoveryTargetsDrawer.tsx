import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { AvailabilityResilience } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: AvailabilityResilience | undefined
  onSave: (data: AvailabilityResilience) => void
}

export function RecoveryTargetsDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    rto: '', rpo: '', availabilitySla: '', currentAzPattern: '', azAwareToday: false,
  })

  useEffect(() => {
    if (open) {
      setDraft({
        rto: data?.rto ?? '',
        rpo: data?.rpo ?? '',
        availabilitySla: data?.availabilitySla ?? '',
        currentAzPattern: data?.currentAzPattern ?? '',
        azAwareToday: data?.azAwareToday ?? false,
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      rto: draft.rto,
      rpo: draft.rpo,
      availabilitySla: draft.availabilitySla,
      currentAzPattern: draft.currentAzPattern || undefined,
      azAwareToday: draft.azAwareToday,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Recovery Targets" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="rt-rto">RTO (Recovery Time Objective)</Label>
        <Input id="rt-rto" value={draft.rto} onChange={(e) => setDraft(d => ({ ...d, rto: e.target.value }))} placeholder="e.g. 4 hours" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rt-rpo">RPO (Recovery Point Objective)</Label>
        <Input id="rt-rpo" value={draft.rpo} onChange={(e) => setDraft(d => ({ ...d, rpo: e.target.value }))} placeholder="e.g. 1 hour" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rt-sla">Availability SLA</Label>
        <Input id="rt-sla" value={draft.availabilitySla} onChange={(e) => setDraft(d => ({ ...d, availabilitySla: e.target.value }))} placeholder="e.g. 99.9%" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rt-az">Current AZ Pattern</Label>
        <Input id="rt-az" value={draft.currentAzPattern} onChange={(e) => setDraft(d => ({ ...d, currentAzPattern: e.target.value }))} placeholder="e.g. Single AZ" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="rt-az-aware"
          checked={draft.azAwareToday}
          onCheckedChange={(checked) => setDraft(d => ({ ...d, azAwareToday: !!checked }))}
        />
        <Label htmlFor="rt-az-aware" className="cursor-pointer">AZ-Aware Today</Label>
      </div>
    </SectionEditDrawer>
  )
}
