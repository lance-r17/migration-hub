import { useState } from 'react'
import { format } from 'date-fns'
import { Loader2, CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { createWave } from '@/services/waves'
import type { Wave } from '@/types/wave'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (wave: Wave) => void
}

interface Draft {
  name: string
  startDate: string
  cutoverDate: string
  description: string
}

const EMPTY: Draft = { name: '', startDate: '', cutoverDate: '', description: '' }

function formatRange(start: string, end: string): string {
  if (!start) return 'Pick a date range'
  const from = format(new Date(start), 'MMM d, y')
  if (!end) return from
  return `${from} – ${format(new Date(end), 'MMM d, y')}`
}

export function CreateWaveDrawer({ open, onOpenChange, onCreated }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [calOpen, setCalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft(prev => ({ ...prev, [field]: e.target.value }))

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDraft(prev => ({
      ...prev,
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      cutoverDate: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    }))
  }

  const handleClose = () => {
    if (saving) return
    setDraft(EMPTY)
    setError(null)
    onOpenChange(false)
  }

  const handleSave = async () => {
    if (!draft.name || !draft.startDate || !draft.cutoverDate) {
      setError('Please fill in all required fields.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const wave = await createWave({
        name: draft.name,
        startDate: draft.startDate,
        cutoverDate: draft.cutoverDate,
        description: draft.description || undefined,
        source: 'created',
        status: 'planned',
      })
      onCreated(wave)
      setDraft(EMPTY)
      onOpenChange(false)
    } catch {
      setError('Failed to create wave. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedRange: DateRange = {
    from: draft.startDate ? new Date(draft.startDate) : undefined,
    to: draft.cutoverDate ? new Date(draft.cutoverDate) : undefined,
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>Create Wave</SheetTitle>
          <SheetDescription>A Jira epic will be created for this wave.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wave Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={set('name')}
              placeholder="Wave 5 – Q1 2027"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Migration Window <span className="text-destructive">*</span>
            </label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !draft.startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon size={14} className="mr-2 shrink-0" />
                  {formatRange(draft.startDate, draft.cutoverDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  defaultMonth={draft.startDate ? new Date(draft.startDate) : undefined}
                  selected={selectedRange}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </label>
            <textarea
              value={draft.description}
              onChange={set('description')}
              rows={3}
              placeholder="Describe the scope of this migration wave…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
            {saving ? (
              <><Loader2 className="size-4 animate-spin mr-2" />Creating in Jira…</>
            ) : 'Create Wave'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
