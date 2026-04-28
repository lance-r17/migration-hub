import { useState, useEffect } from 'react'
import { History } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuditLog } from '@/hooks/use-audit-log'
import { AuditLogTimeline } from '@/components/audit/AuditLogTimeline'
import type { AuditEventType } from '@/types/audit'

const FILTERS: Array<{ key: AuditEventType | 'all'; label: string }> = [
  { key: 'all',                   label: 'All' },
  { key: 'section_updated',       label: 'Sections' },
  { key: 'approval_submitted',    label: 'Approvals' },
  { key: 'risk_created',          label: 'Risks' },
  { key: 'resource_updated',      label: 'Resources' },
  { key: 'status_changed',        label: 'Status' },
]

// Consolidate related event types under a single filter key
const FILTER_GROUPS: Partial<Record<AuditEventType | 'all', AuditEventType[]>> = {
  risk_created:     ['risk_created', 'risk_updated', 'risk_deleted'],
  resource_updated: ['resource_updated', 'resource_sync_completed'],
}

interface Props {
  projectId: string
  open: boolean
  onClose: () => void
}

export function AuditLogDrawer({ projectId, open, onClose }: Props) {
  const { entries, loading, refresh } = useAuditLog(open ? projectId : undefined)
  const [activeFilter, setActiveFilter] = useState<AuditEventType | 'all'>('all')

  // Refresh when opened so new entries are visible immediately
  useEffect(() => {
    if (open) refresh()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = activeFilter === 'all'
    ? entries
    : entries.filter(e => {
        const group = FILTER_GROUPS[activeFilter]
        return group ? group.includes(e.eventType) : e.eventType === activeFilter
      })

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[600px] sm:!max-w-[600px] flex flex-col gap-0 p-0" showCloseButton={false}>
        <SheetHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <SheetTitle className="text-base font-semibold">Change History</SheetTitle>
          </div>
        </SheetHeader>

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto px-5 py-3 border-b scrollbar-hidden">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeFilter === f.key
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-3.5 w-40 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-3 w-56 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AuditLogTimeline entries={filtered} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
