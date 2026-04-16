import { History, AlertCircle, TriangleAlert, Info } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { JiraJobLog } from '@/services/jiraJobs'

function LogLevelIcon({ level }: { level: JiraJobLog['level'] }) {
  if (level === 'error') return <AlertCircle className="size-3.5 text-red-500" />
  if (level === 'warning') return <TriangleAlert className="size-3.5 text-amber-500" />
  return <Info className="size-3.5 text-blue-500" />
}

function getIconBgClass(level: JiraJobLog['level']) {
  if (level === 'error') return 'bg-red-100 dark:bg-red-900/30'
  if (level === 'warning') return 'bg-amber-100 dark:bg-amber-900/30'
  return 'bg-blue-100 dark:bg-blue-900/30'
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

interface Props {
  open: boolean
  onClose: () => void
  logs: JiraJobLog[]
  projectName: string
}

export function JobLogsDrawer({ open, onClose, logs, projectName }: Props) {
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[600px] sm:!max-w-[600px] flex flex-col gap-0 p-0" showCloseButton={false}>
        <SheetHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <div className="flex border-none items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <SheetTitle className="text-base font-semibold">Job Logs: {projectName}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!logs.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <Info className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No logs recorded yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Logs for this job will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {logs.map((log, i) => {
                const isLast = i === logs.length - 1
                return (
                  <div key={log.id} className="flex gap-3">
                    {/* Icon column */}
                    <div className="flex flex-col items-center">
                      <div className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', getIconBgClass(log.level))}>
                        <LogLevelIcon level={log.level} />
                      </div>
                      {!isLast && <div className="mt-1 w-px grow bg-border min-h-4" />}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 pb-5 pt-1">
                      <div className="text-sm font-medium text-foreground">
                        {log.message}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatTs(log.timestamp)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
