import { format, isToday, isYesterday, parseISO } from 'date-fns'
import {
  PenLine,
  ArrowRightLeft,
  BadgeCheck,
  ShieldAlert,
  Server,
  RefreshCw,
  ShieldX,
  Waves,
  ArrowDownToLine,
  ExternalLink,
  GitBranch,
  CircleDot,
  RotateCcw,
  History,
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
  wave_assigned: {
    icon: Waves,
    label: 'Wave assigned',
    iconClass: 'text-cyan-600 dark:text-cyan-400',
    dotClass: 'bg-cyan-500',
  },
  wave_created: {
    icon: GitBranch,
    label: 'Wave created',
    iconClass: 'text-cyan-600 dark:text-cyan-400',
    dotClass: 'bg-cyan-500',
  },
  wave_imported: {
    icon: ArrowDownToLine,
    label: 'Wave imported',
    iconClass: 'text-cyan-600 dark:text-cyan-400',
    dotClass: 'bg-cyan-500',
  },
  jira_story_created: {
    icon: ExternalLink,
    label: 'Jira story created',
    iconClass: 'text-indigo-600 dark:text-indigo-400',
    dotClass: 'bg-indigo-500',
  },
  survey_submitted: {
    icon: PenLine,
    label: 'Survey submitted',
    iconClass: 'text-teal-600 dark:text-teal-400',
    dotClass: 'bg-teal-500',
  },
  section_restored: {
    icon: History,
    label: 'Restored from history',
    iconClass: 'text-sky-600 dark:text-sky-400',
    dotClass: 'bg-sky-500',
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

const DEFAULT_CONFIG = {
  icon: CircleDot,
  label: 'Updated',
  iconClass: 'text-slate-600 dark:text-slate-400',
  dotClass: 'bg-slate-500',
}

function AuditEntry({ entry, showId, isAdmin, onRestore, restoredIds }: { entry: AuditLogEntry; showId?: boolean; isAdmin?: boolean; onRestore?: (entryId: string) => void; restoredIds?: Set<string> }) {
  const config = EVENT_CONFIG[entry.eventType] ?? DEFAULT_CONFIG
  const Icon = config.icon
  const time = format(parseISO(entry.timestamp), 'HH:mm')

  const title = entry.entityLabel ?? entry.sectionLabel ?? config.label

  const isRestored = restoredIds?.has(entry.id) ?? false
  const canRestore =
    !isRestored &&
    isAdmin &&
    entry.eventType === 'section_updated' &&
    entry.sectionKey === 'applicationOverview'

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
          {showId && (
            <>
              <span>·</span>
              <span className="font-mono opacity-50" title="Audit log entry ID">{entry.id}</span>
            </>
          )}
          {isRestored && (
            <span className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted">
              <History className="size-3 opacity-60" />
              Restored
            </span>
          )}
          {canRestore && (
            <button
              onClick={() => onRestore?.(entry.id)}
              className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950 transition-colors"
              title="Restore this version"
            >
              <RotateCcw className="size-3" />
              Restore
            </button>
          )}
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
  showIds?: boolean
  isAdmin?: boolean
  onRestore?: (entryId: string) => void
}

export function AuditLogTimeline({ entries, showIds, isAdmin, onRestore }: Props) {
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

  // Build a set of entry IDs that have been restored via section_restored events
  const restoredIds = new Set<string>()
  for (const e of entries) {
    if (e.eventType === 'section_restored') {
      const ref = e.changes.find(c => c.field === 'restored_from_entry')
      if (ref?.newValue && typeof ref.newValue === 'string') {
        restoredIds.add(ref.newValue)
      }
    }
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
              <AuditEntry key={entry.id} entry={entry} showId={showIds} isAdmin={isAdmin} onRestore={onRestore} restoredIds={restoredIds} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
