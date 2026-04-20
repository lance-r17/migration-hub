import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
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
import { updateWave, syncWaveFromJira } from '@/services/waves'
import type { Wave } from '@/types/wave'
import { WAVE_COLORS } from '@/types/wave'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  wave: Wave | null
  onUpdated: (wave: Wave) => void
}

export function EditWaveDrawer({ open, onOpenChange, wave, onUpdated }: Props) {
  const [color, setColor] = useState<string>(WAVE_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (wave) setColor(wave.color ?? WAVE_COLORS[0])
  }, [wave])

  const handleClose = () => {
    if (saving || syncing) return
    onOpenChange(false)
  }

  const handleSaveColor = async () => {
    if (!wave) return
    setSaving(true)
    try {
      const updated = await updateWave(wave.id, { color })
      onUpdated(updated)
      toast.success('Wave color updated')
      onOpenChange(false)
    } catch {
      toast.error('Failed to update wave color')
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    if (!wave) return
    setSyncing(true)
    try {
      const updated = await syncWaveFromJira(wave.id)
      onUpdated(updated)
      toast.success('Synced from Jira', {
        description: 'Name, description, dates, and status updated.',
      })
    } catch {
      toast.error('Failed to sync from Jira')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>{wave?.name ?? 'Edit Wave'}</SheetTitle>
              <SheetDescription>Update wave color or sync from Jira.</SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} disabled={saving || syncing}>
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Color picker */}
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

          {/* Jira sync */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Jira Sync
            </label>
            <p className="text-sm text-muted-foreground">
              Pull the latest start date, cutover date, and status from the linked Jira epic.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={!wave?.jiraEpicKey || syncing || saving}
              className="mt-2"
            >
              {syncing ? (
                <><Loader2 className="size-4 animate-spin mr-2" />Syncing…</>
              ) : (
                <><RefreshCw className="size-4 mr-2" />Sync from Jira</>
              )}
            </Button>
            {!wave?.jiraEpicKey && (
              <p className="text-xs text-muted-foreground mt-1">No Jira epic linked to this wave.</p>
            )}
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={saving || syncing}>Cancel</Button>
          <Button onClick={handleSaveColor} disabled={saving || syncing} className="min-w-[120px]">
            {saving ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Saving…</>
            ) : 'Save Color'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
