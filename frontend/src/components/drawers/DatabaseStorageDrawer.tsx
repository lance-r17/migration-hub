import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StringListEditor } from './StringListEditor'
import type { DataPersistence } from '@/types'

const textareaClass =
  'min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: DataPersistence | undefined
  onSave: (data: DataPersistence) => void
}

export function DatabaseStorageDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    databaseTypes: [] as string[],
    totalDataVolume: '', dataGrowthRate: '', replicationTopology: '', backupMethod: '', lastRestoreTest: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        databaseTypes: data?.databaseTypes ?? [],
        totalDataVolume: data?.totalDataVolume ?? '',
        dataGrowthRate: data?.dataGrowthRate ?? '',
        replicationTopology: data?.replicationTopology ?? '',
        backupMethod: data?.backupMethod ?? '',
        lastRestoreTest: data?.lastRestoreTest ?? '',
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      ...data,
      databaseTypes: draft.databaseTypes,
      totalDataVolume: draft.totalDataVolume || undefined,
      dataGrowthRate: draft.dataGrowthRate || undefined,
      replicationTopology: draft.replicationTopology || undefined,
      backupMethod: draft.backupMethod || undefined,
      lastRestoreTest: draft.lastRestoreTest || undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Database & Storage" onSave={handleSave}>
      <StringListEditor
        label="Database Types"
        values={draft.databaseTypes}
        onChange={(v) => setDraft(d => ({ ...d, databaseTypes: v }))}
        placeholder="e.g. PostgreSQL, Redis"
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="db-vol">Total Data Volume</Label>
          <Input id="db-vol" value={draft.totalDataVolume} onChange={(e) => setDraft(d => ({ ...d, totalDataVolume: e.target.value }))} placeholder="e.g. 2TB" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="db-growth">Data Growth Rate</Label>
          <Input id="db-growth" value={draft.dataGrowthRate} onChange={(e) => setDraft(d => ({ ...d, dataGrowthRate: e.target.value }))} placeholder="e.g. 10% / month" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="db-repl">Replication Topology</Label>
        <textarea
          id="db-repl"
          className={textareaClass}
          value={draft.replicationTopology}
          onChange={(e) => setDraft(d => ({ ...d, replicationTopology: e.target.value }))}
          placeholder="Describe replication setup"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="db-backup">Backup Method</Label>
        <Input id="db-backup" value={draft.backupMethod} onChange={(e) => setDraft(d => ({ ...d, backupMethod: e.target.value }))} placeholder="e.g. Daily snapshots" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="db-restore">Last Restore Test</Label>
        <Input id="db-restore" value={draft.lastRestoreTest} onChange={(e) => setDraft(d => ({ ...d, lastRestoreTest: e.target.value }))} placeholder="e.g. 2024-01-15" />
      </div>
    </SectionEditDrawer>
  )
}
