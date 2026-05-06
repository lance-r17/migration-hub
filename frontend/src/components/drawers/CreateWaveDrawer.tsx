import { useState } from 'react'
import { format, isBefore, isAfter } from 'date-fns'
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
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import type { Wave } from '@/types/wave'
import { WAVE_COLORS } from '@/types/wave'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (wave: Wave) => void
  onCreate?: (data: Omit<Wave, 'id' | 'createdAt' | 'jiraEpicKey'>) => Promise<Wave>
}

interface Draft {
  name: string
  startDate: string
  cutoverDate: string
  description: string
  color: string
}

const EMPTY: Draft = { name: '', startDate: '', cutoverDate: '', description: '', color: WAVE_COLORS[0] }

function formatRange(start: string, end: string): string {
  if (!start) return 'Pick a date range'
  const from = format(new Date(start), 'MMM d, y')
  if (!end) return from
  return `${from} – ${format(new Date(end), 'MMM d, y')}`
}

export function CreateWaveDrawer({ open, onOpenChange, onCreated, onCreate }: Props) {
  const { settings } = useMigrationSettings()
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

  const validateDates = (startDate: string, cutoverDate: string): string | null => {
    const pp = settings?.platformPeriod
    if (!pp?.startDate || !pp?.endDate) return null
    if (isBefore(new Date(startDate), new Date(pp.startDate)) || isAfter(new Date(cutoverDate), new Date(pp.endDate))) {
      return `Wave dates must fall within platform period (${format(new Date(pp.startDate), 'MMM d, y')} – ${format(new Date(pp.endDate), 'MMM d, y')}).`
    }
    return null
  }

  const handleSave = async () => {
    if (!draft.name || !draft.startDate || !draft.cutoverDate) {
      setError('Please fill in all required fields.')
      return
    }
    const dateError = validateDates(draft.startDate, draft.cutoverDate)
    if (dateError) {
      setError(dateError)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const wave = await (onCreate ?? createWave)({
        name: draft.name,
        startDate: draft.startDate,
        cutoverDate: draft.cutoverDate,
        description: draft.description || undefined,
        source: 'created',
        status: 'planned',
        color: draft.color,
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

  const pp = settings?.platformPeriod
  const disabledDates = pp?.startDate && pp?.endDate
    ? [
        { before: new Date(pp.startDate) },
        { after: new Date(pp.endDate) },
      ]
    : undefined

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
                  defaultMonth={draft.startDate ? new Date(draft.startDate) : pp?.startDate ? new Date(pp.startDate) : undefined}
                  selected={selectedRange}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                  disabled={disabledDates}
                />
              </PopoverContent>
            </Popover>
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
                  onClick={() => setDraft(prev => ({ ...prev, color: c }))}
                  className={cn(
                    'size-7 rounded-full transition-all',
                    draft.color === c && 'ring-2 ring-offset-2 ring-foreground'
                  )}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
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
