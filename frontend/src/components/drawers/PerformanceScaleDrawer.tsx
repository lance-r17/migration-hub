import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { NonFunctionalRequirements } from '@/types'

const textareaClass =
  'min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: NonFunctionalRequirements | undefined
  onSave: (data: NonFunctionalRequirements) => void
}

export function PerformanceScaleDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({ peakLoad: '', autoscaling: '', licensing: '' })

  useEffect(() => {
    if (open) {
      setDraft({
        peakLoad: data?.peakLoad ?? '',
        autoscaling: data?.autoscaling ?? '',
        licensing: data?.licensing ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      peakLoad: draft.peakLoad,
      autoscaling: draft.autoscaling,
      licensing: draft.licensing,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Performance & Licensing" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="ps-peak">Peak Load</Label>
        <Input id="ps-peak" value={draft.peakLoad} onChange={(e) => setDraft(d => ({ ...d, peakLoad: e.target.value }))} placeholder="e.g. 10,000 req/s" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-auto">Autoscaling</Label>
        <Input id="ps-auto" value={draft.autoscaling} onChange={(e) => setDraft(d => ({ ...d, autoscaling: e.target.value }))} placeholder="e.g. HPA 2–20 pods" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-lic">Licensing Constraints</Label>
        <textarea id="ps-lic" className={textareaClass} value={draft.licensing} onChange={(e) => setDraft(d => ({ ...d, licensing: e.target.value }))} placeholder="e.g. Oracle named-user licences, Windows Server per-core" />
      </div>
    </SectionEditDrawer>
  )
}
