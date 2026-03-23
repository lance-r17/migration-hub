import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { StringListEditor } from './StringListEditor'
import type { DataPersistence } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: DataPersistence | undefined
  onSave: (data: DataPersistence) => void
}

export function DataGovernanceDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    dataResidency: '', encryptionAtRest: '', piiData: false, statefulComponents: [] as string[],
  })

  useEffect(() => {
    if (open) {
      setDraft({
        dataResidency: data?.dataResidency ?? '',
        encryptionAtRest: data?.encryptionAtRest ?? '',
        piiData: data?.piiData ?? false,
        statefulComponents: data?.statefulComponents ?? [],
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      databaseTypes: data?.databaseTypes ?? [],
      dataResidency: draft.dataResidency || undefined,
      encryptionAtRest: draft.encryptionAtRest || undefined,
      piiData: draft.piiData,
      statefulComponents: draft.statefulComponents.length ? draft.statefulComponents : undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Data Governance" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="dg-residency">Data Residency</Label>
        <Input id="dg-residency" value={draft.dataResidency} onChange={(e) => setDraft(d => ({ ...d, dataResidency: e.target.value }))} placeholder="e.g. EU only" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dg-enc">Encryption at Rest</Label>
        <Input id="dg-enc" value={draft.encryptionAtRest} onChange={(e) => setDraft(d => ({ ...d, encryptionAtRest: e.target.value }))} placeholder="e.g. AES-256" />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="dg-pii"
          checked={draft.piiData}
          onCheckedChange={(checked) => setDraft(d => ({ ...d, piiData: !!checked }))}
        />
        <Label htmlFor="dg-pii" className="cursor-pointer">Contains PII Data</Label>
      </div>
      <StringListEditor
        label="Stateful Components"
        values={draft.statefulComponents}
        onChange={(v) => setDraft(d => ({ ...d, statefulComponents: v }))}
        placeholder="e.g. PostgreSQL, Redis session store"
      />
    </SectionEditDrawer>
  )
}
