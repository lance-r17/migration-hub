import { useState } from 'react'
import { Layers, ExternalLink } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { cn } from '@/lib/utils'
import { TechnicalChangesDrawer } from '@/components/drawers/TechnicalChangesDrawer'
import type { TargetArchitecture } from '@/types'

interface TargetArchitectureSectionProps {
  data?: TargetArchitecture
  onSave?: (data: TargetArchitecture) => void
}

export function TargetArchitectureSection({ data, onSave }: TargetArchitectureSectionProps) {
  const [editingCard, setEditingCard] = useState<'changes' | null>(null)

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Target Architecture</h2>
      <div className="grid grid-cols-1 gap-6">
        <SectionCard
          icon={Layers}
          title="Technical Changes"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('changes') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No target architecture notes added yet.</p>
          ) : (
            <div className="space-y-4">
              {data.reArchitectureNeeded != null && (
                <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Re-Architecture Needed?</p>
                  <span className={cn(
                    'text-xs font-bold px-2 py-1 rounded',
                    data.reArchitectureNeeded
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  )}>
                    {data.reArchitectureNeeded ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
              {data.topology3Az && (
                <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">3AZ Target Topology</p>
                  <p className="text-sm text-foreground leading-relaxed">{data.topology3Az}</p>
                </div>
              )}
              {data.dnsIpChanges && (
                <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">DNS / IP Changes</p>
                  <p className="text-sm text-foreground leading-relaxed">{data.dnsIpChanges}</p>
                </div>
              )}
              {data.newServicesRequired?.length && (
                <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">New Services Required</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.newServicesRequired.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-muted text-xs rounded">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.architectureDiagram && (
                <div className="pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Architecture Diagram</p>
                  <a
                    href={data.architectureDiagram}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    View Diagram <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <TechnicalChangesDrawer
          open={editingCard === 'changes'}
          onOpenChange={(o) => !o && setEditingCard(null)}
          data={data}
          onSave={(updated) => { onSave(updated); setEditingCard(null) }}
        />
      )}
    </div>
  )
}
