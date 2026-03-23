import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StringListEditor } from './StringListEditor'
import type { TargetArchitecture } from '@/types'

const textareaClass =
  'min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: TargetArchitecture | undefined
  onSave: (data: TargetArchitecture) => void
}

export function TechnicalChangesDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    topology3Az: '', replicationChanges: '', dnsIpChanges: '', newServicesRequired: [] as string[], architectureDiagram: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        topology3Az: data?.topology3Az ?? '',
        replicationChanges: data?.replicationChanges ?? '',
        dnsIpChanges: data?.dnsIpChanges ?? '',
        newServicesRequired: data?.newServicesRequired ?? [],
        architectureDiagram: data?.architectureDiagram ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      summary: data?.summary ?? '',
      constraints: data?.constraints ?? '',
      topology3Az: draft.topology3Az || undefined,
      replicationChanges: draft.replicationChanges || undefined,
      dnsIpChanges: draft.dnsIpChanges || undefined,
      newServicesRequired: draft.newServicesRequired.length ? draft.newServicesRequired : undefined,
      architectureDiagram: draft.architectureDiagram || undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Technical Changes" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="tc-topo">3-AZ Topology</Label>
        <textarea id="tc-topo" className={textareaClass} value={draft.topology3Az} onChange={(e) => setDraft(d => ({ ...d, topology3Az: e.target.value }))} placeholder="Describe 3-AZ topology changes" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tc-repl">Replication Changes</Label>
        <textarea id="tc-repl" className={textareaClass} value={draft.replicationChanges} onChange={(e) => setDraft(d => ({ ...d, replicationChanges: e.target.value }))} placeholder="Describe replication topology changes" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tc-dns">DNS / IP Changes</Label>
        <textarea id="tc-dns" className={textareaClass} value={draft.dnsIpChanges} onChange={(e) => setDraft(d => ({ ...d, dnsIpChanges: e.target.value }))} placeholder="Describe DNS and IP changes required" />
      </div>
      <StringListEditor
        label="New Services Required"
        values={draft.newServicesRequired}
        onChange={(v) => setDraft(d => ({ ...d, newServicesRequired: v }))}
        placeholder="e.g. AWS Aurora, Elasticache"
      />
      <div className="space-y-1.5">
        <Label htmlFor="tc-diag">Architecture Diagram URL</Label>
        <Input id="tc-diag" value={draft.architectureDiagram} onChange={(e) => setDraft(d => ({ ...d, architectureDiagram: e.target.value }))} placeholder="https://..." />
      </div>
    </SectionEditDrawer>
  )
}
