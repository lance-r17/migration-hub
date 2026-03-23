import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { NonFunctionalRequirements } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: NonFunctionalRequirements | undefined
  onSave: (data: NonFunctionalRequirements) => void
}

export function PerformanceScaleDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    peakLoad: '', autoscaling: '', seasonalPatterns: '', latencySensitivity: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        peakLoad: data?.peakLoad ?? '',
        autoscaling: data?.autoscaling ?? '',
        seasonalPatterns: data?.seasonalPatterns ?? '',
        latencySensitivity: data?.latencySensitivity ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      peakLoad: draft.peakLoad,
      autoscaling: draft.autoscaling,
      seasonalPatterns: draft.seasonalPatterns,
      latencySensitivity: draft.latencySensitivity,
      monitoring: data?.monitoring ?? '',
      logAggregation: data?.logAggregation ?? '',
      compliance: data?.compliance ?? [],
      licensing: data?.licensing ?? '',
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Performance & Scale" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="ps-peak">Peak Load</Label>
        <Input id="ps-peak" value={draft.peakLoad} onChange={(e) => setDraft(d => ({ ...d, peakLoad: e.target.value }))} placeholder="e.g. 10,000 req/s" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-auto">Autoscaling</Label>
        <Input id="ps-auto" value={draft.autoscaling} onChange={(e) => setDraft(d => ({ ...d, autoscaling: e.target.value }))} placeholder="e.g. HPA 2–20 pods" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-seasonal">Seasonal Patterns</Label>
        <Input id="ps-seasonal" value={draft.seasonalPatterns} onChange={(e) => setDraft(d => ({ ...d, seasonalPatterns: e.target.value }))} placeholder="e.g. 3× traffic in Q4" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-latency">Latency Sensitivity</Label>
        <Input id="ps-latency" value={draft.latencySensitivity} onChange={(e) => setDraft(d => ({ ...d, latencySensitivity: e.target.value }))} placeholder="e.g. p99 < 200ms" />
      </div>
    </SectionEditDrawer>
  )
}
