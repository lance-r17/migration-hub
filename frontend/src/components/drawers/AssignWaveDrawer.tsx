import { useState, useEffect, useMemo } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Wave } from '@/types/wave'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  waves: Wave[]
  currentWaveId: string | undefined
  onSave: (waveId: string | undefined) => void
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day} ${months[parseInt(month, 10) - 1]} ${year}`
}

export function AssignWaveDrawer({ open, onOpenChange, waves, currentWaveId, onSave }: Props) {
  const [selected, setSelected] = useState<string>(currentWaveId ?? '__none__')

  useEffect(() => {
    if (open) setSelected(currentWaveId ?? '__none__')
  }, [open, currentWaveId])

  const sortedWaves = useMemo(() => {
    return [...waves].sort((a, b) => {
      const startCompare = a.startDate.localeCompare(b.startDate)
      if (startCompare !== 0) return startCompare
      return a.cutoverDate.localeCompare(b.cutoverDate)
    })
  }, [waves])

  const selectedWave = waves.find(w => w.id === selected)

  const handleSave = () => {
    onSave(selected === '__none__' ? undefined : selected)
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Assign to Wave"
      description="Select the migration wave this project belongs to."
      onSave={handleSave}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Wave
          </label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a wave…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {sortedWaves.filter(w => w.status !== 'completed').map(wave => (
                <SelectItem key={wave.id} value={wave.id}>
                  {wave.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedWave && (
          <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium text-foreground">{formatDate(selectedWave.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cutover Date</span>
              <span className="font-medium text-foreground">{formatDate(selectedWave.cutoverDate)}</span>
            </div>
            {selectedWave.jiraEpicKey && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Jira Epic</span>
                <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">
                  {selectedWave.jiraEpicKey}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionEditDrawer>
  )
}
