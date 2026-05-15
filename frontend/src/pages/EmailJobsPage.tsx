import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Mail, RefreshCw, Loader2, Eye, MoreHorizontal } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  listEmailJobs,
  retryEmailJob,
  previewEmailJob,
  type EmailJob,
  type EmailJobPreview,
} from '@/services/adminEmailService'

function JobStatusBadge({ status }: { status: EmailJob['status'] }) {
  const config = {
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground border-border' },
    processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    sent: { label: 'Sent', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
  } as const
  const { label, className } = config[status] ?? config.pending
  return <Badge variant="outline" className={className}>{label}</Badge>
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

export function EmailJobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<EmailJob[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [retrying, setRetrying] = useState<string | null>(null)
  const [preview, setPreview] = useState<EmailJobPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const load = () => {
    setLoading(true)
    listEmailJobs({ status: statusFilter || undefined, limit: 50, offset: 0 })
      .then((res) => {
        setJobs(res.items)
        setTotal(res.total)
      })
      .catch(() => toast.error('Failed to load email jobs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'processing')
    if (!hasActive) return
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRetry(job: EmailJob) {
    setRetrying(job.id)
    try {
      await retryEmailJob(job.id)
      toast.success('Job re-queued')
      load()
    } catch {
      toast.error('Retry failed')
    } finally {
      setRetrying(null)
    }
  }

  async function handlePreview(job: EmailJob) {
    setPreviewLoading(true)
    try {
      const data = await previewEmailJob(job.id)
      setPreview(data)
    } catch {
      toast.error('Failed to load preview')
    } finally {
      setPreviewLoading(false)
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
            <BreadcrumbPage>Email Jobs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Email Jobs</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Background email delivery log and status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`size-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">No email jobs found.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Event</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Recipients</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Subject</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Created</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-sm">{job.eventType}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                      {job.status === 'failed' && job.errorMessage && (
                        <p className="text-xs text-destructive mt-1 max-w-[260px] truncate">
                          {job.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.toAddrs.join(', ')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {job.subject}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTs(job.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreview(job)}>
                            <Eye className="size-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          {job.status === 'failed' && (
                            <DropdownMenuItem
                              onClick={() => handleRetry(job)}
                              disabled={retrying === job.id}
                            >
                              {retrying === job.id ? (
                                <Loader2 className="size-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="size-4 mr-2" />
                              )}
                              Retry
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {total > 50 && (
              <p className="text-xs text-muted-foreground p-3 border-t border-border text-center">
                Showing {jobs.length} of {total} jobs
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              {preview?.subject}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">To:</span>{' '}
                {preview.toAddrs.join(', ')}
              </div>
              <div className="rounded border border-border overflow-hidden">
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><style>
                    ::-webkit-scrollbar { width: 8px; height: 8px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb {
                      background: rgba(100,90,80,0.12); border-radius: 9999px;
                      border: 1px solid transparent; background-clip: padding-box;
                      min-height: 32px;
                    }
                    ::-webkit-scrollbar-thumb:hover { background: rgba(100,90,80,0.28); }
                    ::-webkit-scrollbar-thumb:active { background: rgba(100,90,80,0.40); }
                    ::-webkit-scrollbar-corner { background: transparent; }
                    * { scrollbar-width: thin; scrollbar-color: rgba(100,90,80,0.12) transparent; }
                    body { margin: 0; }
                  </style></head><body>${preview.htmlBody}</body></html>`}
                  title="Email preview"
                  className="w-full min-h-[600px] border-0"
                  sandbox=""
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
