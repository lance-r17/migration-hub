import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { Dependencies, DependencyEntry } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: Dependencies | undefined
  onSave: (data: Dependencies) => void
}

function emptyEntry(): DependencyEntry {
  return { id: crypto.randomUUID(), name: '', eimId: '', contactEmail: '', hosting: '', notes: '' }
}

function DependencyTableEditor({
  entries,
  onChange,
}: {
  entries: DependencyEntry[]
  onChange: (entries: DependencyEntry[]) => void
}) {
  function update(id: string, field: keyof DependencyEntry, value: string) {
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  function remove(id: string) {
    onChange(entries.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dependency</span>
            <button type="button" onClick={() => remove(entry.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label>Application Name *</Label>
            <Input value={entry.name} onChange={(e) => update(entry.id, 'name', e.target.value)} placeholder="Application name" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>EIM ID</Label>
              <Input value={entry.eimId ?? ''} onChange={(e) => update(entry.id, 'eimId', e.target.value)} placeholder="e.g. EIM-1234" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input value={entry.contactEmail ?? ''} onChange={(e) => update(entry.id, 'contactEmail', e.target.value)} placeholder="owner@corp.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Hosting</Label>
            <Select value={entry.hosting ?? ''} onValueChange={(v) => update(entry.id, 'hosting', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select hosting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AliCloud">AliCloud</SelectItem>
                <SelectItem value="On-Premise">On-Premise</SelectItem>
                <SelectItem value="AWS">AWS</SelectItem>
                <SelectItem value="Azure">Azure</SelectItem>
                <SelectItem value="GCP">GCP</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={entry.notes ?? ''} onChange={(e) => update(entry.id, 'notes', e.target.value)} placeholder="Additional notes" />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onChange([...entries, emptyEntry()])}
      >
        <Plus size={14} className="mr-1" /> Add Dependency
      </Button>
    </div>
  )
}

export function UpstreamDependenciesDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState<DependencyEntry[]>([])

  useEffect(() => {
    if (open) setDraft(data?.upstream ?? [])
  }, [open, data])

  function handleSave() {
    onSave({ ...data, upstream: draft, downstream: data?.downstream ?? [] })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Upstream Dependencies" onSave={handleSave}>
      <DependencyTableEditor entries={draft} onChange={setDraft} />
    </SectionEditDrawer>
  )
}
