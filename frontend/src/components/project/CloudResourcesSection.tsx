import { useState, useEffect } from 'react'
import { Database, RefreshCw, CheckCircle2, AlertOctagon, Clock, Loader2, CheckCircle, Info } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CloudResourceEditDrawer } from '@/components/drawers/CloudResourceEditDrawer'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import type { CloudResource, CurrentInfrastructure, ProjectStatus } from '@/types'

const PAGE_SIZE = 10

interface CurrentInfrastructureSectionProps {
  data?: CurrentInfrastructure
  onSave?: (data: CurrentInfrastructure) => void
  projectStatus?: ProjectStatus
  isProjectMember?: boolean
  jiraJobStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  jiraStoryKey?: string
  jiraBaseUrl?: string
}

function SyncIcon({ status }: { status: CloudResource['syncStatus'] }) {
  if (status === 'synced') return <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
  if (status === 'out-of-sync') return <AlertOctagon size={18} className="text-destructive" />
  return <Clock size={18} className="text-secondary-foreground" />
}


export function CurrentInfrastructureSection({ data, onSave, projectStatus, isProjectMember = false, jiraJobStatus, jiraStoryKey, jiraBaseUrl }: CurrentInfrastructureSectionProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [editingResource, setEditingResource] = useState<CloudResource | null>(null)
  const { getCategoryForProduct } = useProductCategoryMap()

  useEffect(() => { setCurrentPage(0) }, [data])

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Current Infrastructure</h2>
      <div className="space-y-6">
        {/* Card A: Compute & Resources — no edit button (uses discovery scan) */}
        <SectionCard
          icon={Database}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-700 dark:text-emerald-300"
          title="Compute & Resources"
          headerRight={
            <button className="text-xs font-bold bg-primary/10 text-primary px-4 py-2 rounded flex items-center gap-2 hover:bg-primary/20 transition-colors">
              <RefreshCw size={14} /> RUN DISCOVERY SCAN
            </button>
          }
        >
          {(jiraJobStatus === 'pending' || jiraJobStatus === 'processing') && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
              <Loader2 size={16} className="shrink-0 animate-spin" />
              <span>Creating Jira story &amp; sub-tasks… This may take up to 30 seconds.</span>
            </div>
          )}
          {jiraJobStatus === 'completed' && jiraStoryKey && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300">
              <CheckCircle size={16} className="shrink-0" />
              <span>
                Jira story{' '}
                {jiraBaseUrl ? (
                  <a href={`${jiraBaseUrl}/browse/${jiraStoryKey}`} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold hover:underline">{jiraStoryKey}</a>
                ) : (
                  <code className="font-mono font-semibold">{jiraStoryKey}</code>
                )}{' '}
                created.{' '}
                {new Set(data?.resources.map(r => r.jiraSubtaskKey).filter(Boolean)).size} sub-tasks linked to resources.
              </span>
            </div>
          )}
          {!data || data.resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources documented yet. Run a discovery scan to populate this section.</p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {['Resource ID', 'Resource Name', 'Product', 'Category', 'Resource Set', 'Sub Application', 'Target Resource ID', 'Sync', 'Jira Sub-task'].map(h => (
                      <th key={h} className="pb-3 pr-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.resources.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((resource) => {
                    const inScope = resource.needMigration !== false
                    const isProcessing = jiraJobStatus === 'pending' || jiraJobStatus === 'processing'
                    const specsEntries = resource.specs ? Object.entries(resource.specs) : []
                    return (
                    <tr
                      key={resource.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors border-b border-border last:border-0',
                        onSave && 'cursor-pointer',
                        resource.needMigration === false && 'opacity-40 line-through',
                      )}
                      onClick={() => onSave && setEditingResource(resource)}
                    >
                      <td className="py-3 pr-4">
                        {resource.resourceId
                          ? <code className="font-mono text-xs text-muted-foreground">{resource.resourceId}</code>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {resource.name}
                          {specsEntries.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info size={13} className="text-muted-foreground/60 shrink-0 cursor-default" onClick={e => e.stopPropagation()} />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="font-mono text-xs max-w-xs">
                                {specsEntries.map(([k, v]) => (
                                  <div key={k}>{k}: {String(v)}</div>
                                ))}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">{resource.product ?? <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">{getCategoryForProduct(resource.product)}</td>
                      <td className="py-3 pr-4 text-sm">
                        {resource.resourceSet
                          ? <code className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono whitespace-nowrap">{resource.resourceSet}</code>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {resource.subApplication ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {resource.targetResourceId
                          ? <code className="font-mono text-xs text-muted-foreground">{resource.targetResourceId}</code>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 pr-4"><SyncIcon status={resource.syncStatus} /></td>
                      <td className="py-3">
                        {resource.jiraSubtaskKey ? (
                          jiraBaseUrl ? (
                            <a href={`${jiraBaseUrl}/browse/${resource.jiraSubtaskKey}`} target="_blank" rel="noopener noreferrer" className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded hover:underline">{resource.jiraSubtaskKey}</a>
                          ) : (
                            <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">{resource.jiraSubtaskKey}</code>
                          )
                        ) : isProcessing && inScope ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 size={13} className="animate-spin shrink-0" />
                            Creating…
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
              {data.resources.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
                  <span>
                    Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, data.resources.length)} of {data.resources.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 0}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      disabled={(currentPage + 1) * PAGE_SIZE >= data.resources.length}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

      </div>

      {onSave && (
        <CloudResourceEditDrawer
          open={!!editingResource}
          onOpenChange={(o) => !o && setEditingResource(null)}
          resources={data?.resources ?? []}
          editingResource={editingResource}
          projectStatus={projectStatus}
          isProjectMember={isProjectMember}
          onSave={(updated) => { onSave({ ...(data ?? { resources: [] }), resources: updated }); setEditingResource(null) }}
        />
      )}
    </div>
  )
}
