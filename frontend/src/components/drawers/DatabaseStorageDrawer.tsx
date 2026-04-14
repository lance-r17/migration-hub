import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { StringListEditor } from './StringListEditor'
import type { DataPersistence } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: DataPersistence | undefined
  onSave: (data: DataPersistence) => void
}

export function DatabaseStorageDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    databaseTypes: [] as string[],
    totalDataVolume: '', dataGrowthRate: '',
    backupRequiredDuringMigration: '' as 'true' | 'false' | '',
    lastRestoreTest: '',
  })

  useEffect(() => {
    if (open) {
      setDraft({
        databaseTypes: data?.databaseTypes ?? [],
        totalDataVolume: data?.totalDataVolume ?? '',
        dataGrowthRate: data?.dataGrowthRate ?? '',
        backupRequiredDuringMigration: data?.backupRequiredDuringMigration != null
          ? (data.backupRequiredDuringMigration ? 'true' : 'false')
          : '',
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
      backupRequiredDuringMigration: draft.backupRequiredDuringMigration !== ''
        ? draft.backupRequiredDuringMigration === 'true'
        : undefined,
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
        <Label>Backup Required During Migration</Label>
        <Select
          value={draft.backupRequiredDuringMigration}
          onValueChange={(v) => setDraft(d => ({ ...d, backupRequiredDuringMigration: v as 'true' | 'false' }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="db-restore">Last Restore Test (BRETT URL)</Label>
        <Input id="db-restore" value={draft.lastRestoreTest} onChange={(e) => setDraft(d => ({ ...d, lastRestoreTest: e.target.value }))} placeholder="https://brett.corp.com/restore-tests/..." />
      </div>
    </SectionEditDrawer>
  )
}
