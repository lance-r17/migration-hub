import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Trash2, Paperclip, X } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useAttachments } from '@/hooks/use-attachments'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString()
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'pending':
      return 'secondary'
    case 'deleted':
      return 'destructive'
    case 'confirmed':
      return 'default'
    default:
      return 'outline'
  }
}

export function AdminAttachmentsPage() {
  const navigate = useNavigate()
  const {
    attachments,
    loading,
    error,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkDelete,
  } = useAttachments()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const housekeepingAttachments = useMemo(
    () => attachments.filter((a) => a.status === 'pending' || a.status === 'deleted'),
    [attachments]
  )

  const confirmedAttachments = useMemo(
    () => attachments.filter((a) => a.status === 'confirmed'),
    [attachments]
  )

  const allHousekeepingSelected =
    housekeepingAttachments.length > 0 &&
    housekeepingAttachments.every((a) => selectedIds.includes(a.id))
  const someSelected = selectedIds.length > 0

  const handleToggleAllHousekeeping = () => {
    if (allHousekeepingSelected) {
      clearSelection()
    } else {
      selectAll(housekeepingAttachments.map((a) => a.id))
    }
  }

  const handleDeleteConfirm = async () => {
    if (selectedIds.length === 0) return
    setDeleting(true)
    try {
      await bulkDelete(selectedIds)
      toast.success(`${selectedIds.length} attachment(s) permanently deleted`)
      setDeleteDialogOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete attachments. Please try again.'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const renderSkeletonRows = (count: number, cols: number) =>
    Array.from({ length: count }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <TableCell key={j}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ))

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
            <BreadcrumbPage>Attachment Management</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Paperclip className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Attachment Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Review and permanently delete pending or soft-deleted project attachments.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ─── Housekeeping Table ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Needs Housekeeping</h2>
            {someSelected && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  <X className="size-3.5 mr-1" />
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Permanently Delete
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allHousekeepingSelected}
                      onCheckedChange={handleToggleAllHousekeeping}
                      aria-label="Select all housekeeping attachments"
                    />
                  </TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Filename</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Project</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletonRows(3, 5)
                ) : housekeepingAttachments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                      No pending or deleted attachments.
                    </TableCell>
                  </TableRow>
                ) : (
                  housekeepingAttachments.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(att.id)}
                          onCheckedChange={() => toggleSelection(att.id)}
                          aria-label={`Select ${att.filename}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Paperclip className="size-3.5 text-muted-foreground" />
                          {att.filename}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{att.projectName}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(att.status)}>{att.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(att.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ─── Confirmed Attachments Table ───────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Confirmed Attachments</h2>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Filename</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Project</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletonRows(3, 3)
                ) : confirmedAttachments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground text-sm">
                      No confirmed attachments.
                    </TableCell>
                  </TableRow>
                ) : (
                  confirmedAttachments.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Paperclip className="size-3.5 text-muted-foreground" />
                          {att.filename}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{att.projectName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(att.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Attachments</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold">{selectedIds.length}</span> attachment(s)?
              This will remove the database records and delete the files from disk. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
