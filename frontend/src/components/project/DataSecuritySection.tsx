import { useState } from 'react'
import { Database, Lock, ExternalLink } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { cn } from '@/lib/utils'
import { DatabaseStorageDrawer } from '@/components/drawers/DatabaseStorageDrawer'
import { DataGovernanceDrawer } from '@/components/drawers/DataGovernanceDrawer'
import type { DataPersistence } from '@/types'

interface DataPersistenceSectionProps {
  data?: DataPersistence
  onSave?: (data: DataPersistence) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-border last:border-0">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}

export function DataPersistenceSection({ data, onSave }: DataPersistenceSectionProps) {
  const [editingCard, setEditingCard] = useState<'db' | 'governance' | null>(null)

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Data & Persistence</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Database & Storage */}
        <SectionCard
          icon={Database}
          title="Database & Storage"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('db') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No data persistence information added yet.</p>
          ) : (
            <>
              {data.databaseTypes.length > 0 && (
                <Row label="Database Types">
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {data.databaseTypes.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-muted text-xs rounded font-mono">{t}</span>
                    ))}
                  </div>
                </Row>
              )}
              {data.totalDataVolume && <Row label="Total Data Volume">{data.totalDataVolume}</Row>}
              {data.dataGrowthRate && <Row label="Data Growth Rate">{data.dataGrowthRate}</Row>}
              {data.backupRequiredDuringMigration != null && (
                <Row label="Backup Required During Migration">
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded',
                    data.backupRequiredDuringMigration
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  )}>
                    {data.backupRequiredDuringMigration ? 'Yes' : 'No'}
                  </span>
                </Row>
              )}
              {data.lastRestoreTest && (
                <Row label="Last Restore Test">
                  {/^https?:\/\//i.test(data.lastRestoreTest) ? (
                    <a
                      href={data.lastRestoreTest}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      View Report <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-sm">{data.lastRestoreTest}</span>
                  )}
                </Row>
              )}
            </>
          )}
        </SectionCard>

        {/* Card B: Data Governance */}
        <SectionCard
          icon={Lock}
          title="Data Governance"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('governance') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No data persistence information added yet.</p>
          ) : (
            <>
              {data.dataResidency && <Row label="Data Residency Requirements">{data.dataResidency}</Row>}
              {data.encryptionAtRest && <Row label="Encryption at Rest">{data.encryptionAtRest}</Row>}
              {data.statefulComponents?.length && (
                <Row label="Stateful Components">
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {data.statefulComponents.map(c => (
                      <span key={c} className="px-2 py-0.5 bg-muted text-xs rounded">{c}</span>
                    ))}
                  </div>
                </Row>
              )}
            </>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <>
          <DatabaseStorageDrawer
            open={editingCard === 'db'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
          <DataGovernanceDrawer
            open={editingCard === 'governance'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
        </>
      )}
    </div>
  )
}
