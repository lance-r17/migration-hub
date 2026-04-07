import { AlertTriangle } from 'lucide-react'
import { format, parseISO, isWithinInterval, differenceInDays } from 'date-fns'
import type { EmbargoRecord } from '@/types/embargo'

interface Props {
  serviceLine: string | undefined
  embargos: EmbargoRecord[]
}

function classifyEmbargo(embargo: EmbargoRecord, today: Date): 'active' | 'upcoming' | null {
  const start = parseISO(embargo.startDate)
  const end = parseISO(embargo.endDate)
  if (isWithinInterval(today, { start, end })) return 'active'
  const daysUntil = differenceInDays(start, today)
  if (daysUntil > 0 && daysUntil <= 30) return 'upcoming'
  return null
}

export function EmbargoBanner({ serviceLine, embargos }: Props) {
  if (!serviceLine?.trim()) return null

  const today = new Date()
  const normalizedLine = serviceLine.trim().toLowerCase()

  const relevant = embargos.flatMap(embargo => {
    const matches = embargo.affectedServiceLines.some(
      sl => sl.trim().toLowerCase() === normalizedLine,
    )
    if (!matches) return []
    const kind = classifyEmbargo(embargo, today)
    if (!kind) return []
    return [{ embargo, kind }]
  })

  if (relevant.length === 0) return null

  return (
    <div className="space-y-2">
      {relevant.map(({ embargo, kind }) => (
        <div
          key={embargo.id}
          className={[
            'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
            kind === 'active'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
          ].join(' ')}
        >
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">
              {kind === 'active' ? 'Active Embargo: ' : 'Upcoming Embargo: '}
            </span>
            {embargo.name}
            {' — '}
            {format(parseISO(embargo.startDate), 'MMM d, y')}
            {' – '}
            {format(parseISO(embargo.endDate), 'MMM d, y')}
          </div>
        </div>
      ))}
    </div>
  )
}
