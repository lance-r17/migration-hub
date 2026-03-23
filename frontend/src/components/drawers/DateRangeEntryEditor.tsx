import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, Trash2, Plus } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { DateRangeEntry } from '@/types'

interface Props {
  label: string
  values: DateRangeEntry[]
  onChange: (values: DateRangeEntry[]) => void
}

function entryToDateRange(entry: DateRangeEntry): DateRange {
  return {
    from: entry.from ? new Date(entry.from) : undefined,
    to: entry.to ? new Date(entry.to) : undefined,
  }
}

function dateRangeToEntry(range: DateRange | undefined, name: string): DateRangeEntry {
  return {
    name,
    from: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
    to: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
  }
}

function formatDateRange(entry: DateRangeEntry): string {
  if (!entry.from) return 'Pick a date'
  const from = format(new Date(entry.from), 'MMM d, y')
  if (!entry.to) return from
  return `${from} – ${format(new Date(entry.to), 'MMM d, y')}`
}

interface EntryRowProps {
  entry: DateRangeEntry
  onChange: (entry: DateRangeEntry) => void
  onDelete: () => void
}

function EntryRow({ entry, onChange, onDelete }: EntryRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/30">
      <div className="flex items-center gap-2">
        <Input
          value={entry.name}
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
          placeholder="Label (e.g. Q4 Year-end)"
          className="flex-1 h-8 text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-8 w-full justify-start text-left text-sm font-normal',
              !entry.from && 'text-muted-foreground'
            )}
          >
            <CalendarIcon size={14} className="mr-2 shrink-0" />
            {formatDateRange(entry)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={entry.from ? new Date(entry.from) : undefined}
            selected={entryToDateRange(entry)}
            onSelect={(range) => {
              onChange(dateRangeToEntry(range, entry.name))
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function DateRangeEntryEditor({ label, values, onChange }: Props) {
  function updateEntry(index: number, updated: DateRangeEntry) {
    const next = [...values]
    next[index] = updated
    onChange(next)
  }

  function removeEntry(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }

  function addEntry() {
    onChange([...values, { name: '', from: '' }])
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {values.map((entry, i) => (
          <EntryRow
            key={i}
            entry={entry}
            onChange={(updated) => updateEntry(i, updated)}
            onDelete={() => removeEntry(i)}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-muted-foreground"
        onClick={addEntry}
      >
        <Plus size={14} />
        Add entry
      </Button>
    </div>
  )
}
