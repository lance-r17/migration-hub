import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MonitorDot, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { getAllJobsAdmin, retryJiraJob, type AdminJiraJobRow, type JiraJobLog } from '@/services/jiraJobs'
import { JobLogsDrawer } from '@/components/drawers/JobLogsDrawer'

function JobStatusBadge({ status }: { status: AdminJiraJobRow['status'] }) {
  const config = {
    pending:    { label: 'Pending',    className: 'bg-muted text-muted-foreground border-border' },
    processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    completed:  { label: 'Completed',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    failed:     { label: 'Failed',     className: 'bg-red-100 text-red-700 border-red-200' },
  } as const
  const { label, className } = config[status] ?? config.pending
  return <Badge variant="outline" className={className}>{label}</Badge>
}

function latestError(logs: JiraJobLog[]): string | undefined {
  return [...logs].reverse().find(l => l.level === 'error')?.message
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

export function AdminJiraJobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<AdminJiraJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<AdminJiraJobRow | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getAllJobsAdmin()
      .then(setJobs)
      .catch(() => toast.error('Failed to load job data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 3 s while any job is in-flight
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'processing')
    if (!hasActive) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Expand is replaced by the drawer

  async function handleRetry(job: AdminJiraJobRow) {
    setRetrying(job.id)
    try {
      await retryJiraJob(job.projectId)
      toast.success('Job re-queued — live updates will appear below')
      load()
    } catch {
      toast.error('Retry failed')
    } finally {
      setRetrying(null)
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/admin')} className="cursor-pointer">
              Admin
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Job Monitor</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MonitorDot className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Jira Job Monitor</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Background job activity across all projects.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No Jira jobs found.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Project</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Story Key</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Requested</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Processed</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => {
                  return (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedJob(job)}
                    >
                      <TableCell className="font-medium">{job.projectName}</TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                        {job.status === 'failed' && latestError(job.logs) && (
                          <p className="text-xs text-destructive mt-1 max-w-[260px] truncate">
                            {latestError(job.logs)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.storyKey
                          ? <code className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono whitespace-nowrap">{job.storyKey}</code>
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatTs(job.requestedAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.processedAt ? formatTs(job.processedAt) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        {job.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={retrying === job.id}
                            onClick={() => handleRetry(job)}
                          >
                            {retrying === job.id
                              ? <Loader2 className="size-3.5 animate-spin mr-1" />
                              : <RefreshCw className="size-3.5 mr-1" />
                            }
                            Retry
                          </Button>
                        )}
                        {job.status === 'completed' && (
                          <CheckCircle2 className="size-4 text-emerald-500 ml-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <JobLogsDrawer
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        logs={selectedJob?.logs ?? []}
        projectName={selectedJob?.projectName ?? ''}
      />
    </div>
  )
}
