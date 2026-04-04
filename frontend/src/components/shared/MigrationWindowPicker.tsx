import { useState } from 'react'
import { X } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
type Day = typeof DAYS[number]

interface MigrationWindowEntry {
  day: Day
  startTime: string
  endTime: string
}

function parse(value: string | undefined): MigrationWindowEntry[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed as MigrationWindowEntry[]
    return []
  } catch {
    return []
  }
}

interface Props {
  value: string | undefined
  onChange: (v: string | undefined) => void
}

export function MigrationWindowPicker({ value, onChange }: Props) {
  const [entries, setEntries] = useState<MigrationWindowEntry[]>(() => parse(value))

  const selectedDays = new Set(entries.map(e => e.day))

  const update = (next: MigrationWindowEntry[]) => {
    const sorted = [...next].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
    setEntries(sorted)
    onChange(sorted.length > 0 ? JSON.stringify(sorted) : undefined)
  }

  const toggleDay = (day: Day) => {
    if (selectedDays.has(day)) {
      update(entries.filter(e => e.day !== day))
    } else {
      update([...entries, { day, startTime: '22:00', endTime: '06:00' }])
    }
  }

  const toggleAll = () => {
    if (selectedDays.size === 7) {
      update([])
    } else {
      const existing = new Map(entries.map(e => [e.day, e]))
      update(DAYS.map(d => existing.get(d) ?? { day: d, startTime: '22:00', endTime: '06:00' }))
    }
  }

  const updateTime = (day: Day, field: 'startTime' | 'endTime', val: string) => {
    update(entries.map(e => e.day === day ? { ...e, [field]: val } : e))
  }

  return (
    <div className="space-y-4">
      {/* Day toggle pills */}
      <div className="flex flex-wrap gap-2">
        {DAYS.map(day => (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            className={
              'px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ' +
              (selectedDays.has(day)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground')
            }
          >
            {day}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleAll}
          className={
            'px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ' +
            (selectedDays.size === 7
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground')
          }
        >
          All
        </button>
      </div>

      {/* Per-day time rows */}
      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.day}
              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40"
            >
              <span className="w-8 text-sm font-semibold text-foreground shrink-0">{entry.day}</span>
              <span className="text-xs text-muted-foreground shrink-0">Start</span>
              <input
                type="time"
                value={entry.startTime}
                onChange={e => updateTime(entry.day, 'startTime', e.target.value)}
                className="text-sm bg-transparent border-b border-input focus:border-primary outline-none px-1 w-24"
              />
              <span className="text-xs text-muted-foreground shrink-0">End</span>
              <input
                type="time"
                value={entry.endTime}
                onChange={e => updateTime(entry.day, 'endTime', e.target.value)}
                className="text-sm bg-transparent border-b border-input focus:border-primary outline-none px-1 w-24"
              />
              <span className="text-xs text-muted-foreground shrink-0">(HKT / UTC+8)</span>
              <button
                type="button"
                onClick={() => toggleDay(entry.day)}
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Select one or more days above to set time windows.
        </p>
      )}
    </div>
  )
}
