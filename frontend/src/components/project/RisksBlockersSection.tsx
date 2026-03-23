import { useState } from 'react'
import { AlertTriangle, Plus } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { cn } from '@/lib/utils'
import { RiskEditDrawer } from '@/components/drawers/RiskEditDrawer'
import type { Risk } from '@/types'

interface RisksBlockersSectionProps {
  risks: Risk[]
  onSave?: (risks: Risk[]) => void
}

function RiskStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-bold uppercase',
      s === 'open' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      s === 'resolved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      s === 'in progress' && 'bg-secondary text-secondary-foreground',
      !['open', 'resolved', 'in progress'].includes(s) && 'bg-muted text-muted-foreground',
    )}>
      {status}
    </span>
  )
}

function severityIconStyle(severity: Risk['severity']): { iconBg: string; iconColor: string } {
  if (severity === 'critical') return { iconBg: 'bg-destructive/10', iconColor: 'text-destructive' }
  if (severity === 'medium') return { iconBg: 'bg-muted', iconColor: 'text-muted-foreground' }
  return { iconBg: 'bg-muted/50', iconColor: 'text-muted-foreground/60' }
}

function SeverityBadge({ severity }: { severity: Risk['severity'] }) {
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-bold text-white uppercase',
      severity === 'critical' && 'bg-destructive',
      severity === 'medium' && 'bg-muted-foreground',
      severity === 'low' && 'bg-muted-foreground/60',
    )}>
      {severity}
    </span>
  )
}

export function RisksBlockersSection({ risks, onSave }: RisksBlockersSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null)

  function openEdit(risk: Risk) {
    setEditingRisk(risk)
    setDrawerOpen(true)
  }

  function openCreate() {
    setEditingRisk(null)
    setDrawerOpen(true)
  }

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Risks & Blockers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {risks.map((risk) => {
          const { iconBg, iconColor } = severityIconStyle(risk.severity)
          return (
            <SectionCard
              key={risk.id}
              icon={AlertTriangle}
              title={risk.title}
              iconBg={iconBg}
              iconColor={iconColor}
              headerRight={<SeverityBadge severity={risk.severity} />}
              onEdit={onSave ? () => openEdit(risk) : undefined}
            >
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{risk.description}</p>
                {risk.mitigation && (
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    <span className="font-semibold text-muted-foreground">Mitigation:</span> {risk.mitigation}
                  </p>
                )}
                {(risk.owner || risk.riskStatus) && (
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    {risk.owner && (
                      <span className="text-[10px] text-muted-foreground">Owner: <span className="font-semibold">{risk.owner}</span></span>
                    )}
                    {risk.riskStatus && <RiskStatusBadge status={risk.riskStatus} />}
                  </div>
                )}
              </div>
            </SectionCard>
          )
        })}

        {/* Add placeholder */}
        <div
          onClick={onSave ? openCreate : undefined}
          className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[180px] gap-3 text-muted-foreground hover:text-primary"
        >
          <Plus size={24} />
          <span className="text-sm font-medium">Add Risk or Blocker</span>
        </div>
      </div>

      {onSave && (
        <RiskEditDrawer
          open={drawerOpen}
          onOpenChange={(o) => { setDrawerOpen(o); if (!o) setEditingRisk(null) }}
          risks={risks}
          editingRisk={editingRisk}
          onSave={(updated) => { onSave(updated); setDrawerOpen(false); setEditingRisk(null) }}
        />
      )}
    </div>
  )
}
