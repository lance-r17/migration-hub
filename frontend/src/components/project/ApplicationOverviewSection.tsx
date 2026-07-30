import { useState } from 'react'
import { Info, Users } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { cn } from '@/lib/utils'
import { ApplicationProfileDrawer } from '@/components/drawers/ApplicationProfileDrawer'
import { ContactsOwnershipDrawer } from '@/components/drawers/ContactsOwnershipDrawer'
import type { ApplicationOverview, ApplicationTier, GovernanceRoles, MigrationStrategy } from '@/types'

interface ApplicationOverviewSectionProps {
  data?: ApplicationOverview
  governanceRoles?: GovernanceRoles
  bgiId?: string | null
  bgiName?: string | null
  canEditGovernanceRoles?: boolean
  projectId?: string
  onSave?: (data: ApplicationOverview) => void
  onSaveGovernanceRoles?: (payload: { technicalLeadId?: string; businessOwnerId?: string; dbaDataOwnerId?: string }) => void
}

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span className={cn(
      'text-xs font-bold px-2 py-0.5 rounded',
      value
        ? 'bg-destructive/15 text-destructive'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    )}>
      {value ? 'Yes' : 'No'}
    </span>
  )
}

function StrategyBadge({ strategy }: { strategy: MigrationStrategy }) {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
      {strategy}
    </span>
  )
}

function TierBadge({ tier }: { tier: ApplicationTier }) {
  const labels: Record<string, string> = {
    T0: 'T0 - Critical',
    T1: 'T1 - Important',
    T2: 'T2 - Standard',
    T3: 'T3 - Basic',
  }
  return (
    <span className={cn(
      'text-xs font-bold px-2 py-0.5 rounded',
      tier === 'T0' && 'bg-destructive/15 text-destructive',
      tier === 'T1' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      tier === 'T2' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      tier === 'T3' && 'bg-muted text-muted-foreground',
    )}>
      {labels[tier] ?? tier}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-1">{children}</p>
}

export function ApplicationOverviewSection({
  data,
  governanceRoles,
  bgiId,
  bgiName,
  canEditGovernanceRoles,
  projectId,
  onSave,
  onSaveGovernanceRoles,
}: ApplicationOverviewSectionProps) {
  const [editingCard, setEditingCard] = useState<'profile' | 'contacts' | null>(null)

  const technicalLead = governanceRoles?.technicalLead
  const businessOwner = governanceRoles?.businessOwner
  const dbaDataOwner  = governanceRoles?.dbaDataOwner
  const gbiChampion = governanceRoles?.gbiChampion
  const gbiChampionDelegate = governanceRoles?.gbiChampionDelegate

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Application Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Application Profile */}
        <SectionCard
          icon={Info}
          title="Application Profile"
          onEdit={onSave ? () => setEditingCard('profile') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No application details have been added yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label>Application Name</Label>
                <p className="text-sm font-medium text-foreground">
                  {data.applicationName}
                  {data.shortName && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal font-mono bg-muted px-1.5 py-0.5 rounded">
                      {data.shortName}
                    </span>
                  )}
                </p>
              </div>

              {data.baId && (
                <div>
                  <Label>BA ID</Label>
                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{data.baId}</code>
                </div>
              )}

              {(bgiId || bgiName) && (
                <div>
                  <Label>BGI</Label>
                  {bgiName ? (
                    <span className="text-sm font-medium text-foreground">{bgiName}</span>
                  ) : (
                    <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{bgiId}</code>
                  )}
                </div>
              )}

              {data.applicationTier && (
                <div>
                  <Label>Application Tier</Label>
                  <TierBadge tier={data.applicationTier} />
                </div>
              )}

              {data.userBase && (
                <div>
                  <Label>User Base</Label>
                  <span className="inline-flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded">
                      {data.userBase.type}
                    </span>
                    {data.userBase.count && (
                      <span className="text-xs text-muted-foreground">{data.userBase.count}</span>
                    )}
                  </span>
                </div>
              )}

              {data.systemImportanceClassification != null && data.systemImportanceClassification.length > 0 && (
                <div>
                  <Label>System Importance Classification</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {data.systemImportanceClassification.map(val => (
                      <span key={val} className="text-xs font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {val === 'IBS' ? 'IBS - Important Business Service' : 'BPS - Business Prioritised Service'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.iitaApplicability != null && (
                <div>
                  <Label>IITA Applicability</Label>
                  <YesNoBadge value={data.iitaApplicability} />
                </div>
              )}

              {data.softwareOrigin && (
                <div>
                  <Label>Software Origin</Label>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {data.softwareOrigin}
                  </span>
                </div>
              )}

              {data.migrationStrategy && (
                <div>
                  <Label>Migration Strategy</Label>
                  <StrategyBadge strategy={data.migrationStrategy} />
                </div>
              )}

              {data.serviceLine && (
                <div>
                  <Label>Service Line</Label>
                  <p className="text-sm text-foreground">{data.serviceLine}</p>
                </div>
              )}

              {data.businessFunction && (
                <div className="sm:col-span-2">
                  <Label>Business Function</Label>
                  <p className="text-sm text-foreground leading-relaxed">{data.businessFunction}</p>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Card B: Contacts */}
        <SectionCard
          icon={Users}
          title="Contacts & Ownership"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={canEditGovernanceRoles ? () => setEditingCard('contacts') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No contacts added yet.</p>
          ) : (
            <div className="space-y-5">
              {technicalLead && (
                <div>
                  <Label>Technical Lead</Label>
                  <p className="text-sm font-medium text-foreground">{technicalLead.name}</p>
                  <p className="text-xs text-muted-foreground">{technicalLead.department}</p>
                  <p className="text-xs text-muted-foreground">{technicalLead.email}</p>
                </div>
              )}
              {businessOwner && (
                <div>
                  <Label>Business Owner</Label>
                  <p className="text-sm font-medium text-foreground">{businessOwner.name}</p>
                  <p className="text-xs text-muted-foreground">{businessOwner.department}</p>
                  <p className="text-xs text-muted-foreground">{businessOwner.email}</p>
                </div>
              )}
              {dbaDataOwner && (
                <div>
                  <Label>DBA / Data Owner</Label>
                  <p className="text-sm font-medium text-foreground">{dbaDataOwner.name}</p>
                  <p className="text-xs text-muted-foreground">{dbaDataOwner.department}</p>
                </div>
              )}
              {gbiChampion && (
                <div>
                  <Label>GBI Champion</Label>
                  <p className="text-sm font-medium text-foreground">{gbiChampion.name}</p>
                  <p className="text-xs text-muted-foreground">{gbiChampion.department}</p>
                  <p className="text-xs text-muted-foreground">{gbiChampion.email}</p>
                </div>
              )}
              {gbiChampionDelegate && (
                <div>
                  <Label>GBI Champion Delegate</Label>
                  <p className="text-sm font-medium text-foreground">{gbiChampionDelegate.name}</p>
                  <p className="text-xs text-muted-foreground">{gbiChampionDelegate.department}</p>
                  <p className="text-xs text-muted-foreground">{gbiChampionDelegate.email}</p>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <ApplicationProfileDrawer
          open={editingCard === 'profile'}
          onOpenChange={(o) => !o && setEditingCard(null)}
          data={data}
          onSave={(updated) => { onSave(updated); setEditingCard(null) }}
        />
      )}
      {onSaveGovernanceRoles && (
        <ContactsOwnershipDrawer
          open={editingCard === 'contacts'}
          onOpenChange={(o) => !o && setEditingCard(null)}
          governanceRoles={governanceRoles}
          projectId={projectId ?? ''}
          onSave={(updated) => { onSaveGovernanceRoles(updated); setEditingCard(null) }}
        />
      )}
    </div>
  )
}
