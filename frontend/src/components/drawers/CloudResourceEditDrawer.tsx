import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckCircle2, AlertOctagon, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CloudResource, ProjectStatus, SyncStatus } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  resources: CloudResource[]
  editingResource: CloudResource | null
  projectStatus?: ProjectStatus
  onSave: (resources: CloudResource[]) => void
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

function StatusChip({ label }: { label: string }) {
  const isActive = ['Online', 'Live', 'Ready', 'Active'].includes(label)
  const isProvisioning = ['Provisioning', 'In Progress', 'Starting'].includes(label)
  return (
    <span className={cn(
      'px-2 py-0.5 rounded text-xs font-medium',
      isActive && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      isProvisioning && 'bg-secondary text-secondary-foreground',
      !isActive && !isProvisioning && 'bg-muted text-muted-foreground',
    )}>
      {label}
    </span>
  )
}

const isMigrationPhase = (status?: ProjectStatus) =>
  status === 'in-progress' || status === 'migrating'

export function CloudResourceEditDrawer({ open, onOpenChange, resources, editingResource, projectStatus, onSave }: Props) {
  const [needMigration, setNeedMigration] = useState(true)

  useEffect(() => {
    if (open && editingResource) {
      setNeedMigration(editingResource.needMigration ?? true)
    }
  }, [open, editingResource])

  if (!editingResource) return null

  function handleSave() {
    onSave(resources.map(r =>
      r.id === editingResource!.id ? { ...editingResource!, needMigration } : r
    ))
    onOpenChange(false)
  }

  function handleMarkSyncCompleted() {
    onSave(resources.map(r =>
      r.id === editingResource!.id ? { ...editingResource!, needMigration, syncStatus: 'synced' } : r
    ))
    onOpenChange(false)
  }

  const canMarkSynced = isMigrationPhase(projectStatus) && editingResource.syncStatus !== 'synced'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>{editingResource.name}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
          {/* Read-only details */}
          <ReadOnlyRow label="Category">{editingResource.category}</ReadOnlyRow>
          {editingResource.specs && (
            <ReadOnlyRow label="Specs">
              <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono">
                {editingResource.specs}
              </span>
            </ReadOnlyRow>
          )}
          {editingResource.quantity != null && (
            <ReadOnlyRow label="Quantity">{editingResource.quantity}</ReadOnlyRow>
          )}
          {editingResource.availabilityZones?.length ? (
            <ReadOnlyRow label="Availability Zones">
              <div className="flex flex-wrap gap-1 justify-end">
                {editingResource.availabilityZones.map(az => (
                  <span key={az} className="px-1.5 py-0.5 bg-secondary/30 text-secondary-foreground text-xs rounded border border-secondary/50 whitespace-nowrap">{az}</span>
                ))}
              </div>
            </ReadOnlyRow>
          ) : null}
          <ReadOnlyRow label="Existing Status">
            <StatusChip label={editingResource.existingStatus} />
          </ReadOnlyRow>
          <ReadOnlyRow label="Target Status">
            <StatusChip label={editingResource.targetStatus} />
          </ReadOnlyRow>
          <ReadOnlyRow label="Sync Status">
            <SyncBadge status={editingResource.syncStatus} />
          </ReadOnlyRow>

          {/* Editable field */}
          <div className="flex items-center gap-3 py-4 mt-2 border-t border-border">
            <Checkbox
              id="cr-need-migration"
              checked={needMigration}
              onCheckedChange={(checked) => setNeedMigration(!!checked)}
            />
            <Label htmlFor="cr-need-migration" className="cursor-pointer text-sm">
              Needs Migration
            </Label>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-between">
          <div>
            {canMarkSynced && (
              <Button variant="outline" onClick={handleMarkSyncCompleted} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30">
                Mark Sync Completed
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
