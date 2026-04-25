import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProjectStatus, StageProgress } from '@/types'

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  'migrating':   { label: 'Migrating',   className: 'bg-secondary text-secondary-foreground hover:bg-secondary/80' },
  'signed-off':  { label: 'Signed-off',  className: 'border-emerald-600 text-emerald-700 dark:text-emerald-300' },
  'blocked':     { label: 'Blocked',     className: '' },
  'planning':    { label: 'Planning',    className: '' },
  'in-progress': { label: 'In Progress', className: 'bg-secondary text-secondary-foreground hover:bg-secondary/80' },
  'completed':   { label: 'Completed',   className: 'border-emerald-600 text-emerald-700 dark:text-emerald-300' },
}

const statusVariant: Record<ProjectStatus, 'secondary' | 'destructive' | 'outline'> = {
  'migrating':   'secondary',
  'signed-off':  'outline',
  'blocked':     'destructive',
  'planning':    'outline',
  'in-progress': 'secondary',
  'completed':   'outline',
}

function getStatusDetail(status: ProjectStatus, stageProgress?: StageProgress): string | undefined {
  if (!stageProgress) return undefined

  switch (status) {
    case 'planning':
      return stageProgress.setup === 0 ? 'Awaiting setup' : 'Setup in progress'
    case 'in-progress': {
      if (stageProgress.setup < 100) return 'Awaiting setup'
      if (stageProgress.survey < 100) return 'Awaiting survey'
      if (stageProgress.signoff < 100) return 'Awaiting sign-off'
      return 'In progress'
    }
    case 'signed-off':
      return 'Ready for migration'
    case 'migrating':
      return `Migration ${stageProgress.migration}%`
    case 'completed':
      return 'All done'
    case 'blocked':
      return 'Needs attention'
    default:
      return undefined
  }
}

interface StatusBadgeProps {
  status: ProjectStatus
  stageProgress?: StageProgress
  className?: string
}

export function StatusBadge({ status, stageProgress, className }: StatusBadgeProps) {
  const { label, className: colorClass } = statusConfig[status]
  const variant = statusVariant[status]
  const detail = getStatusDetail(status, stageProgress)

  const badge = (
    <Badge
      variant={variant}
      className={cn('text-[10px] font-bold uppercase tracking-wider', colorClass, className)}
    >
      {label}
    </Badge>
  )

  if (!detail) {
    return badge
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {detail}
      </TooltipContent>
    </Tooltip>
  )
}
