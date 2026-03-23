import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StringListEditor } from './StringListEditor'
import type { NonFunctionalRequirements } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: NonFunctionalRequirements | undefined
  onSave: (data: NonFunctionalRequirements) => void
}

export function ObservabilityGovernanceDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    monitoring: '', logAggregation: '', compliance: [] as string[], licensing: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        monitoring: data?.monitoring ?? '',
        logAggregation: data?.logAggregation ?? '',
        compliance: data?.compliance ?? [],
        licensing: data?.licensing ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      peakLoad: data?.peakLoad ?? '',
      autoscaling: data?.autoscaling ?? '',
      seasonalPatterns: data?.seasonalPatterns ?? '',
      latencySensitivity: data?.latencySensitivity ?? '',
      monitoring: draft.monitoring,
      logAggregation: draft.logAggregation,
      compliance: draft.compliance,
      licensing: draft.licensing,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Observability & Governance" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="og-mon">Monitoring</Label>
        <Input id="og-mon" value={draft.monitoring} onChange={(e) => setDraft(d => ({ ...d, monitoring: e.target.value }))} placeholder="e.g. Datadog, Prometheus" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="og-log">Log Aggregation</Label>
        <Input id="og-log" value={draft.logAggregation} onChange={(e) => setDraft(d => ({ ...d, logAggregation: e.target.value }))} placeholder="e.g. ELK Stack, Splunk" />
      </div>
      <StringListEditor
        label="Compliance Requirements"
        values={draft.compliance}
        onChange={(v) => setDraft(d => ({ ...d, compliance: v }))}
        placeholder="e.g. SOC2, PCI-DSS, GDPR"
      />
      <div className="space-y-1.5">
        <Label htmlFor="og-lic">Licensing</Label>
        <Input id="og-lic" value={draft.licensing} onChange={(e) => setDraft(d => ({ ...d, licensing: e.target.value }))} placeholder="e.g. Oracle DB license, BYOL" />
      </div>
    </SectionEditDrawer>
  )
}
