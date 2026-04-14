import { useState } from 'react'
import { Gauge } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { PerformanceScaleDrawer } from '@/components/drawers/PerformanceScaleDrawer'
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
  const [editingCard, setEditingCard] = useState<'perf' | null>(null)

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Non-Functional Requirements</h2>
      <div className="grid grid-cols-1 gap-6">
        <SectionCard
          icon={Gauge}
          title="Performance & Licensing"
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
              <Field label="Licensing Constraints">{data.licensing}</Field>
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <PerformanceScaleDrawer
          open={editingCard === 'perf'}
          onOpenChange={(o) => !o && setEditingCard(null)}
          data={data}
          onSave={(updated) => { onSave(updated); setEditingCard(null) }}
        />
      )}
    </div>
  )
}
