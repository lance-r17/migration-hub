import { useState } from 'react'
import { Info, Users } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { cn } from '@/lib/utils'
import { ApplicationProfileDrawer } from '@/components/drawers/ApplicationProfileDrawer'
import { ContactsOwnershipDrawer } from '@/components/drawers/ContactsOwnershipDrawer'
import { useUsers } from '@/hooks/use-users'
import type { ApplicationOverview, ApplicationTier, MigrationStrategy } from '@/types'

interface ApplicationOverviewSectionProps {
  data?: ApplicationOverview
  projectId?: string
  onSave?: (data: ApplicationOverview) => void
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
  return (
    <span className={cn(
      'text-xs font-bold px-2 py-0.5 rounded',
      tier === 'P1' && 'bg-destructive/15 text-destructive',
      tier === 'P2' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      tier === 'P3' && 'bg-muted text-muted-foreground',
    )}>
      {tier}
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs uppercase text-muted-foreground font-bold tracking-widest mb-1">{children}</p>
}

export function ApplicationOverviewSection({ data, projectId, onSave }: ApplicationOverviewSectionProps) {
  const [editingCard, setEditingCard] = useState<'profile' | 'contacts' | null>(null)
  const { users } = useUsers()

  const businessOwner = users.find(u => u.id === data?.businessOwnerId)
  const technicalLead = users.find(u => u.id === data?.technicalLeadId)
  const dbaDataOwner  = users.find(u => u.id === data?.dbaDataOwnerId)

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

              {data.eimId && (
                <div>
                  <Label>EIM ID</Label>
                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{data.eimId}</code>
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

              {data.ibsInScope != null && (
                <div>
                  <Label>IBS In Scope</Label>
                  <YesNoBadge value={data.ibsInScope} />
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
          onEdit={onSave ? () => setEditingCard('contacts') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No contacts added yet.</p>
          ) : (
            <div className="space-y-5">
              {businessOwner && (
                <div>
                  <Label>Business Owner</Label>
                  <p className="text-sm font-medium text-foreground">{businessOwner.name}</p>
                  <p className="text-xs text-muted-foreground">{businessOwner.department}</p>
                  <p className="text-xs text-muted-foreground">{businessOwner.email}</p>
                </div>
              )}
              {technicalLead && (
                <div>
                  <Label>Technical Lead</Label>
                  <p className="text-sm font-medium text-foreground">{technicalLead.name}</p>
                  {technicalLead.team && <p className="text-xs text-muted-foreground">{technicalLead.team}</p>}
                  <p className="text-xs text-muted-foreground">{technicalLead.email}</p>
                </div>
              )}
              {dbaDataOwner && (
                <div>
                  <Label>DBA / Data Owner</Label>
                  <p className="text-sm font-medium text-foreground">{dbaDataOwner.name}</p>
                  <p className="text-xs text-muted-foreground">{dbaDataOwner.department}</p>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <>
          <ApplicationProfileDrawer
            open={editingCard === 'profile'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
          <ContactsOwnershipDrawer
            open={editingCard === 'contacts'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            projectId={projectId ?? ''}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
        </>
      )}
    </div>
  )
}
