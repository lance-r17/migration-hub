import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StringListEditor } from './StringListEditor'
import type { AvailabilityResilience } from '@/types'

const textareaClass =
  'min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: AvailabilityResilience | undefined
  onSave: (data: AvailabilityResilience) => void
}

export function RecoveryTargetsDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({ rto: '', rpo: '', azReadiness3Az: '', healthCheckEndpoints: [] as string[] })

  useEffect(() => {
    if (open) {
      setDraft({
        rto: data?.rto ?? '',
        rpo: data?.rpo ?? '',
        azReadiness3Az: data?.azReadiness3Az ?? '',
        healthCheckEndpoints: data?.healthCheckEndpoints ?? [],
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      rto: draft.rto,
      rpo: draft.rpo,
      azReadiness3Az: draft.azReadiness3Az || undefined,
      healthCheckEndpoints: draft.healthCheckEndpoints.length ? draft.healthCheckEndpoints : undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Availability & Resilience" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="rt-rto">RTO (Recovery Time Objective)</Label>
        <Input id="rt-rto" value={draft.rto} onChange={(e) => setDraft(d => ({ ...d, rto: e.target.value }))} placeholder="e.g. 4 hours" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rt-rpo">RPO (Recovery Point Objective)</Label>
        <Input id="rt-rpo" value={draft.rpo} onChange={(e) => setDraft(d => ({ ...d, rpo: e.target.value }))} placeholder="e.g. 1 hour" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rt-az">3AZ Readiness</Label>
        <textarea id="rt-az" className={textareaClass} value={draft.azReadiness3Az} onChange={(e) => setDraft(d => ({ ...d, azReadiness3Az: e.target.value }))} placeholder="Describe 3-AZ readiness status" />
      </div>
      <StringListEditor
        label="Health Check Endpoints"
        values={draft.healthCheckEndpoints}
        onChange={(v) => setDraft(d => ({ ...d, healthCheckEndpoints: v }))}
        placeholder="e.g. /health, /readiness"
      />
    </SectionEditDrawer>
  )
}
