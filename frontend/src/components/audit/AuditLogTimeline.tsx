import { format, isToday, isYesterday, parseISO } from 'date-fns'
import {
  PenLine,
  ArrowRightLeft,
  BadgeCheck,
  ShieldAlert,
  Server,
  RefreshCw,
  ShieldX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatValue } from '@/utils/diff'
import type { AuditLogEntry, AuditEventType } from '@/types/audit'

// ─── Event type display config ────────────────────────────────────────────────

const EVENT_CONFIG: Record<AuditEventType, {
  icon: React.ComponentType<{ className?: string }>
  label: string
  iconClass: string
  dotClass: string
}> = {
  section_updated: {
    icon: PenLine,
    label: 'Section updated',
    iconClass: 'text-blue-600 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  status_changed: {
    icon: ArrowRightLeft,
    label: 'Status changed',
    iconClass: 'text-violet-600 dark:text-violet-400',
    dotClass: 'bg-violet-500',
  },
  approval_submitted: {
    icon: BadgeCheck,
    label: 'Signed off',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  risk_created: {
    icon: ShieldAlert,
    label: 'Risk added',
    iconClass: 'text-amber-600 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  risk_updated: {
    icon: ShieldAlert,
    label: 'Risk updated',
    iconClass: 'text-amber-600 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  risk_deleted: {
    icon: ShieldX,
    label: 'Risk removed',
    iconClass: 'text-red-600 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
  resource_updated: {
    icon: Server,
    label: 'Resource updated',
    iconClass: 'text-slate-600 dark:text-slate-400',
    dotClass: 'bg-slate-500',
  },
  resource_sync_completed: {
    icon: RefreshCw,
    label: 'Sync completed',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
}

// ─── Date grouping ────────────────────────────────────────────────────────────

function groupByDate(entries: AuditLogEntry[]): Array<{ label: string; entries: AuditLogEntry[] }> {
  const map = new Map<string, AuditLogEntry[]>()

  for (const entry of entries) {
    const date = parseISO(entry.timestamp)
    let label: string
    if (isToday(date)) label = 'Today'
    else if (isYesterday(date)) label = 'Yesterday'
    else label = format(date, 'd MMM yyyy')

    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(entry)
  }

  return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }))
}

// ─── Single entry ─────────────────────────────────────────────────────────────

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  const config = EVENT_CONFIG[entry.eventType]
  const Icon = config.icon
  const time = format(parseISO(entry.timestamp), 'HH:mm')

  const title = entry.entityLabel ?? entry.sectionLabel ?? config.label

  return (
    <div className="flex gap-3">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted', config.iconClass)}>
          <Icon className="size-3.5" />
        </div>
        <div className="mt-1 w-px grow bg-border" />
      </div>

      {/* Content */}
      <div className="min-w-0 pb-5">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground">{config.label}</span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">{entry.actor.name}</span>
          <span>·</span>
          <span>{time}</span>
        </div>

        {entry.changes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {entry.changes.map((change, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground/80">{change.label}:</span>
                {' '}
                {change.oldValue !== undefined && change.oldValue !== null ? (
                  <>
                    <span className="line-through opacity-60">{formatValue(change.oldValue)}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                  </>
                ) : null}
                <span className="text-foreground">{formatValue(change.newValue)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

interface Props {
  entries: AuditLogEntry[]
}

export function AuditLogTimeline({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
          <PenLine className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No changes recorded yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Changes to this project will appear here.
        </p>
      </div>
    )
  }

  const groups = groupByDate(entries)

  return (
    <div className="space-y-6">
      {groups.map(({ label, entries: groupEntries }) => (
        <div key={label}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div>
            {groupEntries.map(entry => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
