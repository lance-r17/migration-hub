import { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { UpstreamDependenciesDrawer } from '@/components/drawers/UpstreamDependenciesDrawer'
import { DownstreamDependenciesDrawer } from '@/components/drawers/DownstreamDependenciesDrawer'
import type { Dependencies, DependencyEntry } from '@/types'

interface DependenciesSectionProps {
  data?: Dependencies
  onSave?: (data: Dependencies) => void
}

function DependencyTable({ entries }: { entries: DependencyEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">None</p>
  }
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Application Name', 'EIM ID', 'Contact Email', 'Hosting', 'Notes'].map(h => (
              <th key={h} className="pb-3 pr-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{entry.name}</td>
              <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{entry.eimId ?? '—'}</td>
              <td className="py-3 pr-4 text-muted-foreground">{entry.contactEmail ?? '—'}</td>
              <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{entry.hosting ?? '—'}</td>
              <td className="py-3 text-muted-foreground text-xs">{entry.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type EditingCard = 'upstream' | 'downstream' | null

export function DependenciesSection({ data, onSave }: DependenciesSectionProps) {
  const [editingCard, setEditingCard] = useState<EditingCard>(null)

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Dependencies</h2>
      <div className="space-y-6">
        <SectionCard
          icon={ArrowUpRight}
          title="Upstream"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('upstream') : undefined}
        >
          <DependencyTable entries={data?.upstream ?? []} />
        </SectionCard>
        <SectionCard
          icon={ArrowDownLeft}
          title="Downstream"
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          onEdit={onSave ? () => setEditingCard('downstream') : undefined}
        >
          <DependencyTable entries={data?.downstream ?? []} />
        </SectionCard>
      </div>

      {onSave && (
        <>
          <UpstreamDependenciesDrawer
            open={editingCard === 'upstream'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
          <DownstreamDependenciesDrawer
            open={editingCard === 'downstream'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
        </>
      )}
    </div>
  )
}
