import { useState } from 'react'
import { format } from 'date-fns'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { EmbargoFormDrawer } from '@/components/drawers/EmbargoFormDrawer'
import { useEmbargos } from '@/hooks/use-embargos'
import type { EmbargoRecord } from '@/types/embargo'

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start + 'T00:00:00'), 'MMM d, y')} – ${format(new Date(end + 'T00:00:00'), 'MMM d, y')}`
}

export function EmbargoSection() {
  const { embargos, loading, createEmbargo, updateEmbargo, deleteEmbargo } = useEmbargos()
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmbargo, setEditingEmbargo] = useState<EmbargoRecord | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<EmbargoRecord | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)

  const handleNew = () => {
    setEditingEmbargo(undefined)
    setFormOpen(true)
  }

  const handleEdit = (embargo: EmbargoRecord) => {
    setEditingEmbargo(embargo)
    setFormOpen(true)
  }

  const handleFormSave = async (data: Omit<EmbargoRecord, 'id' | 'createdAt'>) => {
    if (editingEmbargo) {
      await updateEmbargo(editingEmbargo.id, data)
      toast.success('Embargo period updated')
    } else {
      await createEmbargo(data)
      toast.success('Embargo period created')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteEmbargo(deleteTarget.id)
      toast.success('Embargo period deleted')
      setDeleteTarget(undefined)
    } catch {
      toast.error('Failed to delete embargo period. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Embargo Periods</h2>
          <p className="text-sm text-muted-foreground">
            Define periods during which migration activities should be restricted for specific service lines.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleNew} className="gap-1.5">
          <Plus className="size-4" />
          New Embargo Period
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Service Lines</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))
            ) : embargos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                  No embargo periods defined.
                </TableCell>
              </TableRow>
            ) : (
              embargos.map(embargo => (
                <TableRow key={embargo.id}>
                  <TableCell className="font-medium">{embargo.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateRange(embargo.startDate, embargo.endDate)}
                  </TableCell>
                  <TableCell>
                    {embargo.affectedServiceLines.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {embargo.affectedServiceLines.map(sl => (
                          <Badge key={sl} variant="secondary" className="text-xs">{sl}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleEdit(embargo)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(embargo)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EmbargoFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        editingEmbargo={editingEmbargo}
        onSave={handleFormSave}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(undefined) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Embargo Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(undefined)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
