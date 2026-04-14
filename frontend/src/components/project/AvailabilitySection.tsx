import { useState } from 'react'
import { Zap, ShieldAlert } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { RecoveryTargetsDrawer } from '@/components/drawers/RecoveryTargetsDrawer'
import type { AvailabilityResilience } from '@/types'

interface AvailabilityResilienceSectionProps {
  data?: AvailabilityResilience
  onSave?: (data: AvailabilityResilience) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm font-medium text-foreground text-right">{children}</div>
    </div>
  )
}

export function AvailabilityResilienceSection({ data, onSave }: AvailabilityResilienceSectionProps) {
  const [editingCard, setEditingCard] = useState<'recovery' | null>(null)

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Availability & Resilience</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Recovery Targets */}
        <SectionCard
          icon={Zap}
          title="Recovery Targets"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('recovery') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No availability information added yet.</p>
          ) : (
            <div>
              <Row label="RTO">{data.rto}</Row>
              <Row label="RPO">{data.rpo}</Row>
            </div>
          )}
        </SectionCard>

        {/* Card B: AZ Resilience */}
        <SectionCard
          icon={ShieldAlert}
          title="AZ Resilience"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('recovery') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No availability information added yet.</p>
          ) : (
            <div className="space-y-4">
              {data.azReadiness3Az && (
                <div className="pb-4 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">3AZ Readiness</p>
                  <p className="text-sm text-foreground leading-relaxed">{data.azReadiness3Az}</p>
                </div>
              )}
              {data.healthCheckEndpoints?.length && (
                <div className="pb-4 border-b border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Health Check Endpoints</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.healthCheckEndpoints.map(ep => (
                      <span key={ep} className="px-2 py-0.5 bg-muted font-mono text-xs rounded">{ep}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <RecoveryTargetsDrawer
          open={editingCard === 'recovery'}
          onOpenChange={(o) => !o && setEditingCard(null)}
          data={data}
          onSave={(updated) => { onSave(updated); setEditingCard(null) }}
        />
      )}
    </div>
  )
}
