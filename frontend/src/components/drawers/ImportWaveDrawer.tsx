import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Wave } from '@/types/wave'
import { WAVE_COLORS } from '@/types/wave'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (wave: Wave) => void
  onImport: (epicKey: string, color?: string) => Promise<Wave>
}

export function ImportWaveDrawer({ open, onOpenChange, onImported, onImport }: Props) {
  const [epicKey, setEpicKey] = useState('')
  const [color, setColor] = useState<string>(WAVE_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (saving) return
    setEpicKey('')
    setColor(WAVE_COLORS[0])
    setError(null)
    onOpenChange(false)
  }

  const handleImport = async () => {
    const trimmed = epicKey.trim().toUpperCase()
    if (!trimmed) {
      setError('Please enter a Jira epic key.')
      return
    }
    if (!/^[A-Z]+-\d+$/.test(trimmed)) {
      setError('Epic key format should be like MIG-42.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const wave = await onImport(trimmed, color)
      onImported(wave)
      setEpicKey('')
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to import wave. Please check the epic key and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>Import Wave from Jira</SheetTitle>
          <SheetDescription>Provide an existing Jira epic key to import a wave.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Jira Epic Key <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={epicKey}
              onChange={e => setEpicKey(e.target.value)}
              placeholder="MIG-42"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground">
              Only Jira issues of type <strong>Epic</strong> can be imported as waves.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wave Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {WAVE_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'size-7 rounded-full transition-all',
                    color === c && 'ring-2 ring-offset-2 ring-foreground'
                  )}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            The wave name, dates, and project key will be fetched from the Jira epic.
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleImport} disabled={saving} className="min-w-[160px]">
            {saving ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Fetching from Jira…</>
            ) : 'Import Wave'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
