import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2, AlertOctagon, Clock } from 'lucide-react'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import type { CloudResource, ProjectStatus, SyncStatus } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  resources: CloudResource[]
  editingResource: CloudResource | null
  projectStatus?: ProjectStatus
  isProjectMember: boolean
  onSave?: (resources: CloudResource[]) => void
  onMarkSyncCompleted?: (resourceId: string) => void
}

function formatSpecKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function ReadOnlyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{children}</span>
    </div>
  )
}

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === 'synced') return (
    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 size={14} /> Synced
    </span>
  )
  if (status === 'out-of-sync') return (
    <span className="flex items-center gap-1 text-destructive">
      <AlertOctagon size={14} /> Out of Sync
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-secondary-foreground">
      <Clock size={14} /> Provisioning
    </span>
  )
}


const isSignedOff = (status?: ProjectStatus) =>
  status === 'signed-off' || status === 'migrating' || status === 'completed'

export function CloudResourceEditDrawer({ open, onOpenChange, resources, editingResource, projectStatus, isProjectMember, onSave, onMarkSyncCompleted }: Props) {
  const [needMigration, setNeedMigration] = useState(true)
  const [subApplication, setSubApplication] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { getCategoryForProduct, getNameForProduct } = useProductCategoryMap()

  useEffect(() => {
    if (open && editingResource) {
      setNeedMigration(editingResource.needMigration ?? true)
      setSubApplication(editingResource.subApplication ?? '')
    }
  }, [open, editingResource])

  if (!editingResource) return null

  function handleSave() {
    onSave?.(resources.map(r =>
      r.id === editingResource!.id ? { ...editingResource!, needMigration, subApplication: subApplication || undefined } : r
    ))
    onOpenChange(false)
  }

  function handleMarkSyncCompleted() {
    if (onMarkSyncCompleted) {
      onMarkSyncCompleted(editingResource!.id)
    } else {
      onSave?.(resources.map(r =>
        r.id === editingResource!.id ? { ...editingResource!, needMigration, subApplication: subApplication || undefined, syncStatus: 'synced' } : r
      ))
    }
    onOpenChange(false)
  }

  const canSave = !!onSave && isProjectMember && !isSignedOff(projectStatus)
  const canMarkSynced = (!!onSave || !!onMarkSyncCompleted) && isProjectMember && isSignedOff(projectStatus) && editingResource.syncStatus !== 'synced' && editingResource.needMigration !== false

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>{editingResource.name}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
          {/* Read-only details */}
          {editingResource.resourceId && (
            <ReadOnlyRow label="Resource ID">
              <code className="font-mono text-xs">{editingResource.resourceId}</code>
            </ReadOnlyRow>
          )}
          {editingResource.product && (
            <ReadOnlyRow label="Product">{getNameForProduct(editingResource.product)}</ReadOnlyRow>
          )}
          <ReadOnlyRow label="Category">{getCategoryForProduct(editingResource.product)}</ReadOnlyRow>
          {editingResource.resourceSet && (
            <ReadOnlyRow label="Resource Set">
              <code className="font-mono text-xs">{editingResource.resourceSet}</code>
            </ReadOnlyRow>
          )}
          {editingResource.targetResourceId && (
            <ReadOnlyRow label="Target Resource ID">
              <code className="font-mono text-xs">{editingResource.targetResourceId}</code>
            </ReadOnlyRow>
          )}
          <ReadOnlyRow label="Sync Status">
            <SyncBadge status={editingResource.syncStatus} />
          </ReadOnlyRow>

          {editingResource.specs && Object.keys(editingResource.specs).length > 0 && (
            <>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">Specs</p>
              {Object.entries(editingResource.specs).map(([key, val]) => (
                <ReadOnlyRow key={key} label={formatSpecKey(key)}>
                  {typeof val === 'boolean'
                    ? val ? 'Yes' : 'No'
                    : typeof val === 'object'
                      ? JSON.stringify(val)
                      : String(val ?? '—')}
                </ReadOnlyRow>
              ))}
            </>
          )}

          {/* Editable fields */}
          <div className="flex items-center gap-3 py-4 mt-2 border-t border-border">
            <Checkbox
              id="cr-need-migration"
              checked={needMigration}
              onCheckedChange={(checked) => setNeedMigration(!!checked)}
              disabled={!canSave}
            />
            <Label htmlFor="cr-need-migration" className="cursor-pointer text-sm">
              Needs Migration
            </Label>
          </div>
          <div className="space-y-1.5 pb-4">
            <Label htmlFor="cr-sub-app">Sub Application</Label>
            <Input
              id="cr-sub-app"
              value={subApplication}
              onChange={(e) => setSubApplication(e.target.value)}
              placeholder="e.g. billing-service"
              disabled={!canSave}
            />
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-between">
          <div>
            {canMarkSynced && (
              <Button variant="outline" onClick={() => setConfirmOpen(true)} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30">
                Mark Sync Completed
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            {canSave && <Button onClick={handleSave}>Save Changes</Button>}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Sync Complete?</DialogTitle>
            <DialogDescription>
              Are you sure? Marking sync complete indicates the resource has been fully verified in the target environment. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                handleMarkSyncCompleted()
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
