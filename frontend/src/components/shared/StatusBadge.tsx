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

export function getStatusLabel(
  status: ProjectStatus,
  stageProgress?: StageProgress,
  hasSurveyDraft?: boolean,
  signoffEnabled = true,
): string {
  // When the sign-off workflow is disabled, projects that would be "signed-off"
  // (survey complete, migration not started) are presented as ready for migration.
  if (!signoffEnabled && status === 'signed-off') return 'Ready for Migration'
  const config = statusConfig[status]
  if (status !== 'in-progress' || !stageProgress) return config.label

  const override = getInProgressOverride(stageProgress, hasSurveyDraft)
  return override ? override.label : config.label
}

function getInProgressOverride(stageProgress?: StageProgress, hasSurveyDraft?: boolean): { label: string; colorClass: string; variant: 'secondary' | 'destructive' | 'outline' } | null {
  if (!stageProgress) return null
  if (stageProgress.setup === 100 && stageProgress.survey < 100) {
    if (hasSurveyDraft) {
      return { label: 'Drafting Survey', colorClass: 'border-indigo-500 text-indigo-700 dark:text-indigo-300', variant: 'outline' }
    }
    return { label: 'Awaiting Survey', colorClass: 'border-blue-500 text-blue-700 dark:text-blue-300', variant: 'outline' }
  }
  if (stageProgress.setup === 100 && stageProgress.survey === 100 && stageProgress.signoff === 0) {
    return { label: 'Survey Submitted', colorClass: 'border-cyan-500 text-cyan-700 dark:text-cyan-300', variant: 'outline' }
  }
  if (stageProgress.setup === 100 && stageProgress.survey === 100 && stageProgress.signoff < 100) {
    return { label: 'Awaiting Sign-off', colorClass: 'border-amber-500 text-amber-700 dark:text-amber-300', variant: 'outline' }
  }
  return null
}

function formatSurveySubmittedAt(value: string | undefined): string {
  if (!value) return 'Survey submitted — awaiting sign-off'
  const d = new Date(value)
  if (isNaN(d.getTime())) return 'Survey submitted — awaiting sign-off'
  return `Survey submitted on ${d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function getStatusDetail(status: ProjectStatus, stageProgress?: StageProgress, surveySubmittedAt?: string): string | undefined {
  if (!stageProgress) return undefined

  switch (status) {
    case 'planning':
      return stageProgress.setup === 0 ? 'Awaiting setup' : 'Setup in progress'
    case 'in-progress': {
      if (stageProgress.setup < 100) return 'Awaiting setup'
      if (stageProgress.survey < 100) return 'Awaiting survey'
      if (stageProgress.signoff === 0) return formatSurveySubmittedAt(surveySubmittedAt)
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
  hasSurveyDraft?: boolean
  surveySubmittedAt?: string
  signoffEnabled?: boolean
  className?: string
}

export function StatusBadge({ status, stageProgress, hasSurveyDraft, surveySubmittedAt, signoffEnabled = true, className }: StatusBadgeProps) {
  let label = getStatusLabel(status, stageProgress, hasSurveyDraft, signoffEnabled)
  let { className: colorClass } = statusConfig[status]
  let variant = statusVariant[status]

  const inProgressOverride = status === 'in-progress' ? getInProgressOverride(stageProgress, hasSurveyDraft) : null
  if (inProgressOverride) {
    colorClass = inProgressOverride.colorClass
    variant = inProgressOverride.variant
  }

  const detail = getStatusDetail(status, stageProgress, surveySubmittedAt)

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
