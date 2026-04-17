import { CheckCircle2, AlertOctagon, Clock, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import type { CloudResource, Project } from '@/types'

interface ResourceComparisonDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceSet: string
  project: Project | null
}

function SyncBadge({ status }: { status: CloudResource['syncStatus'] }) {
  if (status === 'synced')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 size={12} /> Synced
      </span>
    )
  if (status === 'out-of-sync')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertOctagon size={12} /> Out of sync
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Clock size={12} /> Provisioning
    </span>
  )
}

export function ResourceComparisonDrawer({
  open,
  onOpenChange,
  resourceSet,
  project,
}: ResourceComparisonDrawerProps) {
  const resources = (project?.currentInfrastructure?.resources ?? []).filter(
    r => r.resourceSet === resourceSet,
  )
  const { getNameForProduct } = useProductCategoryMap()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[760px] sm:!max-w-[760px] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b px-6 py-4 pr-12 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-base">Resource Comparison</SheetTitle>
              <SheetDescription className="mt-1">
                <code className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono">
                  {resourceSet}
                </code>
                {project && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {project.name}
                  </span>
                )}
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X size={16} />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-center px-6 py-10">
              <p className="text-sm text-muted-foreground">
                No resources found for this resource set in the project.
              </p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="grid grid-cols-2 divide-x divide-border border-b bg-muted/50 sticky top-0">
                <div className="px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Existing Environment
                  </p>
                </div>
                <div className="px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Target Environment
                  </p>
                </div>
              </div>

              {/* Resource rows */}
              {resources.map((resource, idx) => (
                <div
                  key={resource.id}
                  className={cn(
                    'grid grid-cols-2 divide-x divide-border',
                    idx < resources.length - 1 && 'border-b border-border',
                  )}
                >
                  {/* Left — Existing */}
                  <div className="px-5 py-4 space-y-2">
                    <p className="font-medium text-sm text-foreground">{resource.name}</p>
                    <div className="space-y-1">
                      {resource.product && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="w-20 shrink-0 font-medium">Product</span>
                          <span>{getNameForProduct(resource.product)}</span>
                        </div>
                      )}
                      {resource.resourceId && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="w-20 shrink-0 font-medium">Resource ID</span>
                          <code className="font-mono text-xs">{resource.resourceId}</code>
                        </div>
                      )}
                      {resource.specs && Object.keys(resource.specs).length > 0 && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="w-20 shrink-0 font-medium pt-0.5">Specs</span>
                          <div className="space-y-0.5">
                            {Object.entries(resource.specs).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-muted-foreground/70">{k}:</span>{' '}
                                <span>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right — Target */}
                  <div className="px-5 py-4 space-y-2">
                    <p className="font-medium text-sm text-foreground">{resource.name}</p>
                    <div className="space-y-1">
                      {resource.product && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="w-20 shrink-0 font-medium">Product</span>
                          <span>{getNameForProduct(resource.product)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-20 shrink-0 font-medium">Resource ID</span>
                        {resource.targetResourceId ? (
                          <code className="font-mono text-xs">{resource.targetResourceId}</code>
                        ) : (
                          <span className="italic text-muted-foreground/50">Not assigned</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-20 shrink-0 font-medium">Sync</span>
                        <SyncBadge status={resource.syncStatus} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
