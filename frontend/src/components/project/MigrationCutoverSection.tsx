import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarCheck, Clock, Ban, CalendarX, Timer, ArrowLeftRight, RotateCcw, Users, ListChecks, CalendarRange } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { MigrationWindowDisplay } from '@/components/shared/MigrationWindowDisplay'
import { ScheduleWindowsDrawer } from '@/components/drawers/ScheduleWindowsDrawer'
import { ExecutionStakeholdersDrawer } from '@/components/drawers/ExecutionStakeholdersDrawer'
import type { MigrationConstraints } from '@/types'

interface MigrationConstraintsSectionProps {
  data?: MigrationConstraints
  onSave?: (data: MigrationConstraints) => void
}

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="pb-4 border-b border-border last:border-0 last:pb-0">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={13} className="text-muted-foreground" />}
        {label}
      </p>
      <div className="text-sm text-foreground leading-relaxed">{children}</div>
    </div>
  )
}

export function MigrationConstraintsSection({ data, onSave }: MigrationConstraintsSectionProps) {
  const [editingCard, setEditingCard] = useState<'schedule' | 'execution' | null>(null)

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Migration Constraints</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: Schedule & Windows */}
        <SectionCard
          icon={CalendarCheck}
          title="Schedule & Windows"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('schedule') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No migration constraints defined yet.</p>
          ) : (
            <div className="space-y-5">
              <Field label="Regular Maintenance Window" icon={Clock}>
                <MigrationWindowDisplay value={data.regularMigrationWindow} />
              </Field>
              {data.preferredMigrationWindow?.length ? (
                <Field label="Preferred Migration Window" icon={Clock}>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {data.preferredMigrationWindow.map(opt => (
                      <span key={opt} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {opt === 'weekday' ? 'Weekday (Mon–Fri)' : 'Weekend (Sat–Sun)'}
                      </span>
                    ))}
                  </div>
                </Field>
              ) : null}
              {(data.earliestStartDate || data.latestEndDate) && (
                <Field label="Migration Date Range" icon={CalendarRange}>
                  <div className="space-y-0.5">
                    {data.earliestStartDate && (
                      <div>Earliest: <span className="font-medium">{format(new Date(data.earliestStartDate), 'MMM d, y')}</span></div>
                    )}
                    {data.latestEndDate && (
                      <div>Latest: <span className="font-medium">{format(new Date(data.latestEndDate), 'MMM d, y')}</span></div>
                    )}
                  </div>
                </Field>
              )}
              {data.crDurationHours !== undefined && (
                <Field label="CR Duration" icon={Timer}>
                  <span>{data.crDurationHours}h</span>
                  {data.crDurationHours > 24 && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Split CR required
                    </span>
                  )}
                </Field>
              )}
              {data.snowCiGroups?.length ? (
                <Field label="SNOW CI Groups" icon={Users}>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {data.snowCiGroups.map((group, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        {group}
                      </span>
                    ))}
                  </div>
                </Field>
              ) : null}
              {data.maxCutoverWindow && (
                <Field label="Max Cutover Window" icon={Timer}>
                  {data.maxCutoverWindow}
                </Field>
              )}
              <Field label="Blackout Dates" icon={Ban}>
                {data.blackoutDates?.length ? (
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    {data.blackoutDates.map((entry, i) => (
                      <li key={i}>
                        <span className="font-medium">{entry.name}</span>
                        {entry.from && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({format(new Date(entry.from), 'MMM d, y')}
                            {entry.to && ` – ${format(new Date(entry.to), 'MMM d, y')}`})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground text-xs">None defined</span>
                )}
              </Field>
              {data.changeFreezePeriods?.length && (
                <Field label="Embargo / Change freeze periods" icon={CalendarX}>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    {data.changeFreezePeriods.map((entry, i) => (
                      <li key={i}>
                        <span className="font-medium">{entry.name}</span>
                        {entry.from && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({format(new Date(entry.from), 'MMM d, y')}
                            {entry.to && ` – ${format(new Date(entry.to), 'MMM d, y')}`})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
            </div>
          )}
        </SectionCard>

        {/* Card B: Execution & Stakeholders */}
        <SectionCard
          icon={ArrowLeftRight}
          title="Execution & Stakeholders"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('execution') : undefined}
        >
          {!data ? (
            <p className="text-sm text-muted-foreground">No migration constraints defined yet.</p>
          ) : (
            <div className="space-y-5">
              <Field label="Cutover Approach" icon={ArrowLeftRight}>
                {data.cutoverApproach}
              </Field>
              <Field label="Rollback Plan" icon={RotateCcw}>
                {data.rollbackPlan}
              </Field>
              <Field label="Stakeholder Comms" icon={Users}>
                {data.stakeholderComms}
              </Field>
              <Field label="Pre-Migration Testing" icon={ListChecks}>
                {data.preMigrationTesting}
              </Field>
            </div>
          )}
        </SectionCard>
      </div>

      {onSave && (
        <>
          <ScheduleWindowsDrawer
            open={editingCard === 'schedule'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
          <ExecutionStakeholdersDrawer
            open={editingCard === 'execution'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
        </>
      )}
    </div>
  )
}
