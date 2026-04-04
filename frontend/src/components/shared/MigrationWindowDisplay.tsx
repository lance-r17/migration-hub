interface MigrationWindowEntry {
  day: string
  startTime: string
  endTime: string
}

interface Props {
  value: string | undefined
}

export function MigrationWindowDisplay({ value }: Props) {
  if (!value) return <span className="text-muted-foreground text-sm">—</span>

  let entries: MigrationWindowEntry[] | null = null
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.length > 0) {
      entries = parsed as MigrationWindowEntry[]
    }
  } catch {
    // not JSON — render as plain text below
  }

  if (!entries) {
    return <span>{value}</span>
  }

  return (
    <div className="space-y-1">
      {entries.map(entry => (
        <div key={entry.day} className="flex items-center gap-2 text-sm">
          <span className="font-semibold w-8 shrink-0">{entry.day}</span>
          <span className="text-muted-foreground">
            {entry.startTime} – {entry.endTime}
          </span>
          <span className="text-xs text-muted-foreground/60">HKT</span>
        </div>
      ))}
    </div>
  )
}
