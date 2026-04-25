import { AlertTriangle, ShieldAlert, Lock, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SecurityHealthWidgetProps {
  openCriticalRisksCount: number
  openCriticalRisksTitles: string[]
  blockedProjectsCount: number
  securityResourcesOutOfSyncCount: number
  activeEmbargosCount: number
  activeEmbargoNames: string[]
}

interface MetricRowProps {
  icon: React.ElementType
  label: string
  count: number
  detail?: string
  variant: 'danger' | 'warning' | 'neutral'
}

function MetricRow({ icon: Icon, label, count, detail, variant }: MetricRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
        variant === 'danger' && 'bg-destructive/10',
        variant === 'warning' && 'bg-amber-100 dark:bg-amber-900/30',
        variant === 'neutral' && 'bg-muted',
      )}>
        <Icon size={14} className={cn(
          variant === 'danger' && 'text-destructive',
          variant === 'warning' && 'text-amber-700 dark:text-amber-300',
          variant === 'neutral' && 'text-muted-foreground',
        )} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className={cn(
            'text-sm font-bold tabular-nums',
            variant === 'danger' && 'text-destructive',
            variant === 'warning' && 'text-amber-700 dark:text-amber-300',
            variant === 'neutral' && 'text-muted-foreground',
          )}>
            {count}
          </span>
        </div>
        {detail && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}

export function SecurityHealthWidget({
  openCriticalRisksCount,
  openCriticalRisksTitles,
  blockedProjectsCount,
  securityResourcesOutOfSyncCount,
  activeEmbargosCount,
  activeEmbargoNames,
}: SecurityHealthWidgetProps) {
  const hasIssues = openCriticalRisksCount > 0 || blockedProjectsCount > 0
    || securityResourcesOutOfSyncCount > 0 || activeEmbargosCount > 0

  return (
    <div className="bg-card p-6 rounded-xl border border-border flex flex-col">
      <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-widest">Security Health</h3>

      <div className="flex-1 space-y-1">
        <MetricRow
          icon={AlertTriangle}
          label="Open Critical Risks"
          count={openCriticalRisksCount}
          detail={openCriticalRisksTitles.join(', ') || 'All clear'}
          variant={openCriticalRisksCount > 0 ? 'danger' : 'neutral'}
        />
        <div className="border-t border-border/50" />
        <MetricRow
          icon={Ban}
          label="Active Embargos"
          count={activeEmbargosCount}
          detail={activeEmbargoNames.join(', ') || 'None active'}
          variant={activeEmbargosCount > 0 ? 'warning' : 'neutral'}
        />
        <div className="border-t border-border/50" />
        <MetricRow
          icon={ShieldAlert}
          label="Blocked Projects"
          count={blockedProjectsCount}
          detail={blockedProjectsCount > 0 ? 'Migration halted' : 'No blockers'}
          variant={blockedProjectsCount > 0 ? 'warning' : 'neutral'}
        />
        <div className="border-t border-border/50" />
        <MetricRow
          icon={Lock}
          label="Security Resources Out of Sync"
          count={securityResourcesOutOfSyncCount}
          detail={securityResourcesOutOfSyncCount > 0 ? 'WAF / Firewall / KMS' : 'All synced'}
          variant={securityResourcesOutOfSyncCount > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            hasIssues ? 'bg-destructive' : 'bg-emerald-500',
          )} />
          <p className="text-xs font-medium text-foreground">
            {hasIssues ? 'Attention required' : 'All security checks passing'}
          </p>
        </div>
      </div>
    </div>
  )
}
