import { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Key, KeyRound } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { cn } from '@/lib/utils'
import { UpstreamDependenciesDrawer } from '@/components/drawers/UpstreamDependenciesDrawer'
import { DownstreamDependenciesDrawer } from '@/components/drawers/DownstreamDependenciesDrawer'
import { TLSCertificatesDrawer } from '@/components/drawers/TLSCertificatesDrawer'
import { SecretsManagementDrawer } from '@/components/drawers/SecretsManagementDrawer'
import { APIKeysDrawer } from '@/components/drawers/APIKeysDrawer'
import type { Dependencies, DependencyEntry } from '@/types'

interface DependenciesSectionProps {
  data?: Dependencies
  onSave?: (data: Dependencies) => void
}

function AccessBadge({ access }: { access?: 'Internal' | 'External' }) {
  if (!access) return <span className="text-muted-foreground/40">—</span>
  return (
    <span className={cn(
      'text-xs font-medium px-1.5 py-0.5 rounded',
      access === 'Internal' ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'
    )}>
      {access}
    </span>
  )
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
            {['Dependency', 'Protocol', 'Port', 'Access', 'Owner', 'Notes'].map(h => (
              <th key={h} className="pb-3 pr-4 text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{entry.name}</td>
              <td className="py-3 pr-4 text-muted-foreground">{entry.protocol ?? '—'}</td>
              <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{entry.port ?? '—'}</td>
              <td className="py-3 pr-4"><AccessBadge access={entry.access} /></td>
              <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">{entry.owner ?? '—'}</td>
              <td className="py-3 text-muted-foreground text-xs">{entry.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type EditingCard = 'upstream' | 'downstream' | 'tls' | 'secrets' | 'apikeys' | null

export function DependenciesSection({ data, onSave }: DependenciesSectionProps) {
  const [editingCard, setEditingCard] = useState<EditingCard>(null)

  const cs = data?.certificatesSecrets
  const certEntries = [
    { key: 'tls' as EditingCard,    title: 'TLS Certificates',   icon: ShieldCheck, value: cs?.tlsCertificates },
    { key: 'secrets' as EditingCard, title: 'Secrets Management', icon: Key,         value: cs?.secretsManagement },
    { key: 'apikeys' as EditingCard, title: 'API Keys / Tokens',  icon: KeyRound,    value: cs?.apiKeys },
  ]

  return (
    <div>
      <h2 className="mt-8 mb-4 text-2xl font-bold">Dependencies</h2>
      <div className="space-y-6">
        {/* Row 1: Upstream + Downstream */}
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

        {/* Row 2: Certificates & Secrets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certEntries.map(({ key, title, icon, value }) => (
            <SectionCard
              key={key}
              icon={icon}
              title={title}
              iconBg="bg-secondary"
              iconColor="text-secondary-foreground"
              onEdit={onSave ? () => setEditingCard(key) : undefined}
            >
              {value
                ? <p className="text-sm text-muted-foreground leading-relaxed">{value}</p>
                : <p className="text-sm text-muted-foreground italic">Not specified</p>
              }
            </SectionCard>
          ))}
        </div>
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
          <TLSCertificatesDrawer
            open={editingCard === 'tls'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
          <SecretsManagementDrawer
            open={editingCard === 'secrets'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
          <APIKeysDrawer
            open={editingCard === 'apikeys'}
            onOpenChange={(o) => !o && setEditingCard(null)}
            data={data}
            onSave={(updated) => { onSave(updated); setEditingCard(null) }}
          />
        </>
      )}
    </div>
  )
}
