import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ProjectStatus } from '@/types'

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

interface StatusBadgeProps {
  status: ProjectStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, className: colorClass } = statusConfig[status]
  const variant = statusVariant[status]
  return (
    <Badge
      variant={variant}
      className={cn('text-[10px] font-bold uppercase tracking-wider', colorClass, className)}
    >
      {label}
    </Badge>
  )
}
