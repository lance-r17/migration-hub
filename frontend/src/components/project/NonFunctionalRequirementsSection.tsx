import { useState } from 'react'
import { Gauge, Eye } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { PerformanceScaleDrawer } from '@/components/drawers/PerformanceScaleDrawer'
import { ObservabilityGovernanceDrawer } from '@/components/drawers/ObservabilityGovernanceDrawer'
import type { NonFunctionalRequirements } from '@/types'

interface NonFunctionalRequirementsSectionProps {
  data?: NonFunctionalRequirements
  onSave?: (data: NonFunctionalRequirements) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pb-4 border-b border-border last:border-0 last:pb-0">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <div className="text-sm text-foreground leading-relaxed">{children}</div>
    </div>
  )
}

export function NonFunctionalRequirementsSection({ data, onSave }: NonFunctionalRequirementsSectionProps) {
  const [editingCard, setEditingCard] = useState<'perf' | 'obs' | null>(null)

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Non-Functional Requirements</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Performance & Scale */}
        <SectionCard
          icon={Gauge}
          title="Performance & Scale"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('perf') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No NFRs defined yet.</p>
          ) : (
            <div className="space-y-4">
              <Field label="Peak Load Profile">{data.peakLoad}</Field>
              <Field label="Autoscaling">{data.autoscaling}</Field>
              <Field label="Seasonal Patterns">{data.seasonalPatterns}</Field>
              <Field label="Latency Sensitivity">{data.latencySensitivity}</Field>
            </div>
          )}
        </SectionCard>

        {/* Card B: Observability & Governance */}
        <SectionCard
          icon={Eye}
          title="Observability & Governance"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('obs') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No NFRs defined yet.</p>
          ) : (
            <div className="space-y-4">
              <Field label="Monitoring & Alerting">{data.monitoring}</Field>
              <Field label="Log Aggregation">{data.logAggregation}</Field>
              <Field label="Compliance Requirements">
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {data.compliance.map(c => (
                    <span key={c} className="px-1.5 py-0.5 bg-muted text-[10px] font-bold text-muted-foreground rounded">{c}</span>
                  ))}
                </div>
              </Field>
              <Field label="Licensing Constraints">{data.licensing}</Field>
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <>
          <PerformanceScaleDrawer
            open={editingCard === 'perf'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
          <ObservabilityGovernanceDrawer
            open={editingCard === 'obs'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
        </>
      )}
    </div>
  )
}
