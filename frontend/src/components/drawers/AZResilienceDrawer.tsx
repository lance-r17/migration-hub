import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
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

export function AZResilienceDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    azFailureBehaviour: '', azReadiness3Az: '', healthCheckEndpoints: [] as string[], currentTopologyDescription: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        azFailureBehaviour: data?.azFailureBehaviour ?? '',
        azReadiness3Az: data?.azReadiness3Az ?? '',
        healthCheckEndpoints: data?.healthCheckEndpoints ?? [],
        currentTopologyDescription: data?.currentTopologyDescription ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      rto: data?.rto ?? '',
      rpo: data?.rpo ?? '',
      availabilitySla: data?.availabilitySla ?? '',
      azFailureBehaviour: draft.azFailureBehaviour || undefined,
      azReadiness3Az: draft.azReadiness3Az || undefined,
      healthCheckEndpoints: draft.healthCheckEndpoints.length ? draft.healthCheckEndpoints : undefined,
      currentTopologyDescription: draft.currentTopologyDescription || undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit AZ Resilience" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="az-failure">AZ Failure Behaviour</Label>
        <textarea
          id="az-failure"
          className={textareaClass}
          value={draft.azFailureBehaviour}
          onChange={(e) => setDraft(d => ({ ...d, azFailureBehaviour: e.target.value }))}
          placeholder="How does the application behave during AZ failure?"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="az-readiness">AZ Readiness (3-AZ)</Label>
        <textarea
          id="az-readiness"
          className={textareaClass}
          value={draft.azReadiness3Az}
          onChange={(e) => setDraft(d => ({ ...d, azReadiness3Az: e.target.value }))}
          placeholder="Readiness for 3-AZ deployment"
        />
      </div>
      <StringListEditor
        label="Health Check Endpoints"
        values={draft.healthCheckEndpoints}
        onChange={(v) => setDraft(d => ({ ...d, healthCheckEndpoints: v }))}
        placeholder="/health, /ready, etc."
      />
      <div className="space-y-1.5">
        <Label htmlFor="az-topo">Current Topology Description</Label>
        <textarea
          id="az-topo"
          className={textareaClass}
          value={draft.currentTopologyDescription}
          onChange={(e) => setDraft(d => ({ ...d, currentTopologyDescription: e.target.value }))}
          placeholder="Describe the current topology"
        />
      </div>
    </SectionEditDrawer>
  )
}
