import { useState, useEffect } from 'react'
import { Database, Network, RefreshCw, CheckCircle2, AlertOctagon, Clock } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { cn } from '@/lib/utils'
import { NetworkConfigurationDrawer } from '@/components/drawers/NetworkConfigurationDrawer'
import { CloudResourceEditDrawer } from '@/components/drawers/CloudResourceEditDrawer'
import type { CloudResource, CurrentInfrastructure, ProjectStatus } from '@/types'

const PAGE_SIZE = 10

interface CurrentInfrastructureSectionProps {
  data?: CurrentInfrastructure
  onSave?: (data: CurrentInfrastructure) => void
  projectStatus?: ProjectStatus
  isProjectMember?: boolean
}

function SyncIcon({ status }: { status: CloudResource['syncStatus'] }) {
  if (status === 'synced') return <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
  if (status === 'out-of-sync') return <AlertOctagon size={18} className="text-destructive" />
  return <Clock size={18} className="text-secondary-foreground" />
}

function StatusChip({ label, variant }: { label: string; variant: 'green' | 'blue' | 'default' }) {
  return (
    <span className={cn(
      'px-2 py-0.5 rounded text-xs font-medium',
      variant === 'green' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      variant === 'blue' && 'bg-secondary text-secondary-foreground',
      variant === 'default' && 'bg-muted text-muted-foreground',
    )}>
      {label}
    </span>
  )
}

function getStatusVariant(status: string): 'green' | 'blue' | 'default' {
  if (['Online', 'Live', 'Ready', 'Active'].includes(status)) return 'green'
  if (['Provisioning', 'In Progress', 'Starting'].includes(status)) return 'blue'
  return 'default'
}

export function CurrentInfrastructureSection({ data, onSave, projectStatus, isProjectMember = false }: CurrentInfrastructureSectionProps) {
  const [networkDrawerOpen, setNetworkDrawerOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [editingResource, setEditingResource] = useState<CloudResource | null>(null)

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
          {!data || data.resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources documented yet. Run a discovery scan to populate this section.</p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {['Resource Name', 'Category', 'Specs', 'Qty', 'Availability Zones', 'Existing', 'Target', 'Sync'].map(h => (
                      <th key={h} className="pb-3 pr-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.resources.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((resource) => (
                    <tr
                      key={resource.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors border-b border-border last:border-0',
                        onSave && 'cursor-pointer',
                        resource.needMigration === false && 'opacity-40 line-through',
                      )}
                      onClick={() => onSave && setEditingResource(resource)}
                    >
                      <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{resource.name}</td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">{resource.category}</td>
                      <td className="py-3 pr-4 text-sm">
                        {resource.specs ? (
                          <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono">{resource.specs}</span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-sm text-foreground font-medium">
                        {resource.quantity != null ? resource.quantity : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {resource.availabilityZones?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {resource.availabilityZones.map(az => (
                              <span key={az} className="px-1.5 py-0.5 bg-secondary/30 text-secondary-foreground text-xs rounded border border-secondary/50 whitespace-nowrap">{az}</span>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 pr-4"><StatusChip label={resource.existingStatus} variant={getStatusVariant(resource.existingStatus)} /></td>
                      <td className="py-3 pr-4"><StatusChip label={resource.targetStatus} variant={getStatusVariant(resource.targetStatus)} /></td>
                      <td className="py-3"><SyncIcon status={resource.syncStatus} /></td>
                    </tr>
                  ))}
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

        {/* Card B: Network Configuration — edit button enabled */}
        <SectionCard
          icon={Network}
          title="Network Configuration"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setNetworkDrawerOpen(true) : undefined}
        >
          {!data?.network ? (
            <p className="text-sm text-muted-foreground">No network configuration documented yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-0">
              {data.network.loadBalancerType && (
                <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border">
                  <span className="text-sm text-muted-foreground shrink-0">Load Balancer Type</span>
                  <span className="text-sm font-medium text-foreground text-right">{data.network.loadBalancerType}</span>
                </div>
              )}
              {data.network.bandwidthRequirements && (
                <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border">
                  <span className="text-sm text-muted-foreground shrink-0">Bandwidth</span>
                  <span className="text-sm font-medium text-foreground text-right">{data.network.bandwidthRequirements}</span>
                </div>
              )}
              {data.network.hardcodedIps != null && (
                <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border">
                  <span className="text-sm text-muted-foreground shrink-0">Hardcoded IPs?</span>
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded',
                    data.network.hardcodedIps ? 'bg-destructive/15 text-destructive' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  )}>
                    {data.network.hardcodedIps ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {data.network.privateConnectivity && (
                <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border">
                  <span className="text-sm text-muted-foreground shrink-0">Private Connectivity</span>
                  <span className="text-sm font-medium text-foreground text-right max-w-xs">{data.network.privateConnectivity}</span>
                </div>
              )}
              {data.network.vipDnsNames?.length && (
                <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border md:col-span-2">
                  <span className="text-sm text-muted-foreground shrink-0">VIP / DNS Names</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {data.network.vipDnsNames.map(v => (
                      <span key={v} className="px-1.5 py-0.5 bg-muted text-xs font-mono rounded">{v}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.network.firewallZones?.length && (
                <div className="flex justify-between items-start gap-4 py-2.5 md:col-span-2">
                  <span className="text-sm text-muted-foreground shrink-0">Firewall Zones</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {data.network.firewallZones.map(z => (
                      <span key={z} className="px-1.5 py-0.5 bg-muted text-xs rounded">{z}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <NetworkConfigurationDrawer
          open={networkDrawerOpen}
          onOpenChange={(o) => !o && setNetworkDrawerOpen(false)}
          data={data}
          onSave={(updated) => { onSave(updated); setNetworkDrawerOpen(false) }}
        />
      )}
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
