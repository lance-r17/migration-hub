import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { EmbargoRecord } from '@/types/embargo'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEmbargo?: EmbargoRecord
  onSave: (data: Omit<EmbargoRecord, 'id' | 'createdAt'>) => Promise<void>
}

interface Draft {
  name: string
  startDate: string
  endDate: string
  affectedServiceLines: string[]
}

const EMPTY: Draft = { name: '', startDate: '', endDate: '', affectedServiceLines: [] }

function formatRange(start: string, end: string): string {
  if (!start) return 'Pick a date range'
  const from = format(new Date(start + 'T00:00:00'), 'MMM d, y')
  if (!end) return from
  return `${from} – ${format(new Date(end + 'T00:00:00'), 'MMM d, y')}`
}

export function EmbargoFormDrawer({ open, onOpenChange, editingEmbargo, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [tagInput, setTagInput] = useState('')
  const [calOpen, setCalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setDraft(
        editingEmbargo
          ? {
              name: editingEmbargo.name,
              startDate: editingEmbargo.startDate,
              endDate: editingEmbargo.endDate,
              affectedServiceLines: [...editingEmbargo.affectedServiceLines],
            }
          : EMPTY,
      )
      setTagInput('')
      setError(null)
    }
  }, [open, editingEmbargo])

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDraft(prev => ({
      ...prev,
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    }))
  }

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || draft.affectedServiceLines.includes(trimmed)) return
    setDraft(prev => ({ ...prev, affectedServiceLines: [...prev.affectedServiceLines, trimmed] }))
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setDraft(prev => ({
      ...prev,
      affectedServiceLines: prev.affectedServiceLines.filter(t => t !== tag),
    }))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && draft.affectedServiceLines.length > 0) {
      removeTag(draft.affectedServiceLines[draft.affectedServiceLines.length - 1])
    }
  }

  const handleSave = async () => {
    if (tagInput.trim()) addTag(tagInput)
    if (!draft.name.trim()) { setError('Name is required.'); return }
    if (!draft.startDate) { setError('Start date is required.'); return }
    if (!draft.endDate) { setError('End date is required.'); return }
    if (draft.endDate < draft.startDate) { setError('End date must be after start date.'); return }
    setError(null)
    setSaving(true)
    try {
      await onSave({
        name: draft.name.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        affectedServiceLines: draft.affectedServiceLines,
      })
      onOpenChange(false)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedRange: DateRange = {
    from: draft.startDate ? new Date(draft.startDate + 'T00:00:00') : undefined,
    to: draft.endDate ? new Date(draft.endDate + 'T00:00:00') : undefined,
  }

  const title = editingEmbargo ? 'Edit Embargo Period' : 'New Embargo Period'

  return (
    <SectionEditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Define a period during which migration activities should be restricted."
      onSave={handleSave}
      saveDisabled={saving}
    >
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-1.5">
        <Label htmlFor="embargo-name">Name <span className="text-destructive">*</span></Label>
        <Input
          id="embargo-name"
          value={draft.name}
          onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
          placeholder="e.g. Q2 Finance Freeze"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Date Range <span className="text-destructive">*</span></Label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !draft.startDate && 'text-muted-foreground',
              )}
            >
              <CalendarIcon size={14} className="mr-2 shrink-0" />
              {formatRange(draft.startDate, draft.endDate)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={draft.startDate ? new Date(draft.startDate + 'T00:00:00') : undefined}
              selected={selectedRange}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="embargo-service-lines">Affected Service Lines</Label>
        <p className="text-xs text-muted-foreground">Press Enter to add each service line.</p>
        <div
          className="flex flex-wrap gap-1.5 min-h-[38px] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 cursor-text"
          onClick={() => tagInputRef.current?.focus()}
        >
          {draft.affectedServiceLines.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                className="rounded-sm hover:bg-destructive/20 p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <input
            ref={tagInputRef}
            id="embargo-service-lines"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
            placeholder={draft.affectedServiceLines.length === 0 ? 'e.g. Finance & Operations' : ''}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground py-0.5"
          />
        </div>
      </div>
    </SectionEditDrawer>
  )
}
