import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ClipboardList, FileText, ShieldCheck, Server, Clock, Hourglass, Wrench, CreditCard, Cloud, Database, Shield, UserCheck, GanttChart } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { ensureAllRoles, getProjectApprovalSequence } from '@/lib/approvals'
import {
  MILESTONE_TYPE_META,
  categoryMilestoneRowId,
  getMilestoneRows,
  milestoneDurationDays,
  milestoneRowDates,
  projectMilestoneDurationStats,
} from '@/lib/milestones'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Project, StageProgress, Approval } from '@/types'
import type { CategoryMilestone } from '@/types/categoryMilestone'

const ROLE_LABELS: Record<string, string> = {
  platform_migration_lead: 'Platform Migration Lead',
  technical_lead: 'Technical Lead',
  business_owner: 'Business Owner',
  gbi_champion: 'BGI Champion',
  gbi_champion_delegate: 'BGI Champion Delegate',
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  technical_lead: Wrench,
  business_owner: CreditCard,
  gbi_champion: Shield,
  gbi_champion_delegate: UserCheck,
  platform_migration_lead: Cloud,
}

function ApprovalNode({ approval }: { approval: Approval }) {
  const isApproved = approval.status === 'approved'
  const isWaiting = approval.status === 'waiting'
  const isPending = approval.status === 'pending'
  const PendingIcon = ROLE_ICONS[approval.role] ?? Hourglass

  return (
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
          isApproved && 'bg-emerald-500 text-white',
          isWaiting && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-400',
          isPending && 'bg-muted text-muted-foreground ring-1 ring-border'
        )}
      >
        {isApproved && <Check size={14} strokeWidth={3} />}
        {isWaiting && <Clock size={14} />}
        {isPending && <PendingIcon size={14} />}
      </div>
      <div className="text-center">
        <p className={cn('text-[11px] font-bold', isPending ? 'text-muted-foreground' : 'text-foreground')}>
          {ROLE_LABELS[approval.role] ?? approval.role}
        </p>
        {isApproved && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Approved</p>}
        {isWaiting && <p className="text-[10px] text-secondary-foreground font-bold uppercase">In Review</p>}
        {isPending && <p className="text-[10px] text-muted-foreground font-bold uppercase">Pending</p>}
      </div>
    </div>
  )
}

interface SurveyType {
  key: 'application' | 'data_migration'
  label: string
  icon: React.ElementType
  submittedAt?: string
}

function SurveyNode({ type }: { type: SurveyType }) {
  const submitted = !!type.submittedAt
  const Icon = type.icon

  return (
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
          submitted && 'bg-emerald-500 text-white',
          !submitted && 'bg-muted text-muted-foreground ring-1 ring-border'
        )}
      >
        {submitted ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
      </div>
      <div className="text-center">
        <p className={cn('text-[11px] font-bold', submitted ? 'text-foreground' : 'text-muted-foreground')}>
          {type.label}
        </p>
        {submitted && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Submitted</p>}
        {!submitted && <p className="text-[10px] text-muted-foreground font-bold uppercase">Pending</p>}
      </div>
    </div>
  )
}

interface StageProgressStepperProps {
  project: Project
  signoffEnabled?: boolean
  categoryMilestones?: CategoryMilestone[]
}

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Completed',
}

export function StageProgressStepper({ project, signoffEnabled = true, categoryMilestones = [] }: StageProgressStepperProps) {
  const navigate = useNavigate()
  const [surveyExpanded, setSurveyExpanded] = useState(false)
  const [signoffExpanded, setSignoffExpanded] = useState(false)
  const [migrationExpanded, setMigrationExpanded] = useState(false)

  // Milestone duration stats — same metric as the wave Gantt chart percentage column
  const milestoneRows = getMilestoneRows(project, categoryMilestones)
  const durationStats = projectMilestoneDurationStats(project, categoryMilestones)
  const completedPct = durationStats && durationStats.total > 0
    ? Math.round(durationStats.done / durationStats.total * 100)
    : null

  const sp: StageProgress = project.stageProgress ?? { setup: 0, survey: 0, signoff: 0, migration: 0 }
  const approvedCount = project.approvals.filter(a => a.status === 'approved').length

  const surveyTypes: SurveyType[] = [
    { key: 'application', label: 'Application Survey', icon: FileText, submittedAt: project.surveySubmittedAt },
    { key: 'data_migration', label: 'Data Migration Survey', icon: Database, submittedAt: project.dataMigrationSurveySubmittedAt },
  ]
  const submittedSurveyCount = surveyTypes.filter(s => s.submittedAt).length
  const totalSurveyCount = surveyTypes.length
  const surveyComplete = submittedSurveyCount === totalSurveyCount
  const surveyPartial = submittedSurveyCount > 0 && !surveyComplete

  const isSurveyClickable = sp.setup === 100 && !surveyComplete
  const isSignOffClickable = sp.signoff < 100
  const isMigrationClickable = milestoneRows.length > 0

  const approvalSequence = getProjectApprovalSequence(project)
  const expectedApprovalCount = approvalSequence.length

  const allStages = [
    {
      key: 'setup' as const,
      label: 'Setup',
      icon: ClipboardList,
      detail: sp.setup === 100 ? 'Complete' : 'Resources & team needed',
    },
    {
      key: 'survey' as const,
      label: 'Survey',
      icon: FileText,
      detail: surveyComplete ? 'Submitted' : `${submittedSurveyCount}/${totalSurveyCount} submitted`,
    },
    {
      key: 'signoff' as const,
      label: 'Sign-off',
      icon: ShieldCheck,
      detail: approvedCount === expectedApprovalCount ? 'Approved' : `${approvedCount}/${expectedApprovalCount} approved`,
    },
    {
      key: 'migration' as const,
      label: 'Migration',
      icon: Server,
      detail: '',
    },
  ]
  const stages = signoffEnabled ? allStages : allStages.filter(s => s.key !== 'signoff')

  const allApprovals = ensureAllRoles(project.approvals, approvalSequence)
  const remaining = allApprovals.filter(a => a.status !== 'approved').length

  // Arrow x-position of an expanded panel, aligned to its stage icon
  const stageArrowLeft = (key: string) => {
    const idx = stages.findIndex(s => s.key === key)
    return `calc(${(idx / stages.length) * 100}% + 14px)`
  }

  // Combination bar segments: one per milestone row, width = share of total duration.
  // Status is encoded via opacity: solid = completed, mid = in progress, faint = to do.
  const SEGMENT_STATUS_OPACITY: Record<string, number> = { done: 1, 'in-progress': 0.55, todo: 0.2 }
  const milestoneSegments = milestoneRows.map((r) => {
    const d = milestoneRowDates(project, r)
    const dur = milestoneDurationDays(d.start, d.end)
    const share = durationStats && durationStats.total > 0 ? (dur / durationStats.total) * 100 : 0
    const cm = r.type === 'category-milestone'
      ? categoryMilestones.find(c => categoryMilestoneRowId(project.id, c.id) === r.id)
      : undefined
    return {
      row: r,
      share,
      pctLabel: `${Math.round(share)}%`,
      color: cm?.color ?? MILESTONE_TYPE_META[r.type]?.color ?? 'var(--g-text-subtle)',
      statusOpacity: SEGMENT_STATUS_OPACITY[r.status] ?? 0.2,
    }
  })

  return (
    <div className="bg-muted/40 rounded-lg px-4 py-3 border border-border/50 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {stages.map((stage, i) => {
          const isSurveyStage = stage.key === 'survey'
          const isSignOffStage = stage.key === 'signoff'
          const isMigrationStage = stage.key === 'migration'
          const complete = isSurveyStage ? surveyComplete : sp[stage.key] === 100
          const partial = isSurveyStage ? surveyPartial : sp[stage.key] > 0 && sp[stage.key] < 100
          const Icon = stage.icon
          const clickable =
            (isSurveyStage && isSurveyClickable) ||
            (isSignOffStage && isSignOffClickable) ||
            (isMigrationStage && isMigrationClickable)

          const toggleStage = () => {
            if (isSurveyStage) {
              setSurveyExpanded(prev => !prev)
              setSignoffExpanded(false)
              setMigrationExpanded(false)
            } else if (isSignOffStage) {
              setSignoffExpanded(prev => !prev)
              setSurveyExpanded(false)
              setMigrationExpanded(false)
            } else {
              setMigrationExpanded(prev => !prev)
              setSurveyExpanded(false)
              setSignoffExpanded(false)
            }
          }

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                {clickable ? (
                  <button
                    type="button"
                    onClick={toggleStage}
                    aria-expanded={isSurveyStage ? surveyExpanded : isSignOffStage ? signoffExpanded : migrationExpanded}
                    aria-label={
                      isSurveyStage
                        ? 'Toggle survey submission details'
                        : isSignOffStage
                          ? 'Toggle sign-off workflow details'
                          : 'Toggle milestone progress details'
                    }
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      complete && 'bg-emerald-500 text-white',
                      partial && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-400',
                      !complete && !partial && 'bg-muted text-muted-foreground ring-1 ring-border',
                      'cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 active:ring-offset-2'
                    )}
                  >
                    {complete ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                  </button>
                ) : (
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      complete && 'bg-emerald-500 text-white',
                      partial && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 ring-1 ring-amber-400',
                      !complete && !partial && 'bg-muted text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    {complete ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                  </div>
                )}
                <div className="min-w-0">
                  <div className={cn(
                    'text-xs font-semibold',
                    complete ? 'text-foreground' : partial ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                  )}>
                    {stage.label}
                  </div>
                  {isMigrationStage ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${completedPct ?? 0}%`, background: 'oklch(0.50 0.13 150)' }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{completedPct ?? 0}%</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="View in wave Gantt chart"
                            className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/waves/gantt?projectId=${project.id}`)
                            }}
                          >
                            <GanttChart size={12} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">View in wave Gantt chart</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground truncate">{stage.detail}</div>
                  )}
                </div>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={cn(
                    'flex-1 mx-3 h-[1.5px]',
                    complete
                      ? 'bg-emerald-500'
                      : 'border-t-2 border-dashed border-muted-foreground/30',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {surveyExpanded && (
          <motion.div
            key="survey-timeline"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              role="region"
              aria-label="Survey submission timeline"
              className="relative mt-4 bg-muted rounded-lg border border-border/50 p-4"
            >
              {/* Arrow pointing to survey stage icon */}
              <div className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-muted border-l border-t border-border/50 rotate-45" style={{ left: stageArrowLeft('survey') }} />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1 shrink-0">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Survey Submission Status
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {totalSurveyCount - submittedSurveyCount} of {totalSurveyCount} surveys pending submission.
                  </p>
                </div>
                <div className="flex flex-1 max-w-2xl items-center justify-between relative px-4">
                  <div className="absolute h-0.25 top-3.5 left-12 right-10 bg-muted-foreground/20 z-0" />
                  {surveyTypes.map((type) => (
                    <SurveyNode key={type.key} type={type} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {signoffExpanded && (
          <motion.div
            key="signoff-timeline"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              role="region"
              aria-label="Sign-off workflow timeline"
              className="relative mt-4 bg-muted rounded-lg border border-border/50 p-4"
            >
              {/* Arrow pointing to sign-off stage icon */}
              <div className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-muted border-l border-t border-border/50 rotate-45" style={{ left: stageArrowLeft('signoff') }} />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1 shrink-0">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Multi-Role Sign-off Workflow
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {remaining} of {allApprovals.length} approvals remaining for migration execution.
                  </p>
                </div>
                <div className="flex flex-1 max-w-2xl items-center justify-between relative px-4">
                  <div className="absolute h-0.25 top-3.5 left-12 right-10 bg-muted-foreground/20 z-0" />
                  {allApprovals.map((approval) => (
                    <ApprovalNode key={approval.id} approval={approval} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {migrationExpanded && (
          <motion.div
            key="migration-timeline"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              role="region"
              aria-label="Milestone progress breakdown"
              className="relative mt-4 bg-muted rounded-lg border border-border/50 p-4"
            >
              {/* Arrow pointing to migration stage icon */}
              <div className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-muted border-l border-t border-border/50 rotate-45" style={{ left: stageArrowLeft('migration') }} />
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Milestone Progress
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {milestoneRows.filter(r => r.status === 'done').length} of {milestoneRows.length} milestones completed
                    {completedPct != null && ` · ${completedPct}% of total duration`}
                  </p>
                </div>
                <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted-foreground/10">
                  {milestoneSegments.map((seg) => (
                    <Tooltip key={seg.row.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="h-full transition-opacity hover:opacity-75 cursor-default"
                          style={{ width: `${seg.share}%`, background: seg.color, opacity: seg.statusOpacity }}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="flex-col items-start">
                        <p className="text-xs font-semibold">{seg.row.name}</p>
                        <p className="text-xs">
                          {MILESTONE_STATUS_LABELS[seg.row.status] ?? seg.row.status} · {seg.pctLabel}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  {(['done', 'in-progress', 'todo'] as const).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-[3px] bg-foreground"
                        style={{ opacity: SEGMENT_STATUS_OPACITY[s] }}
                      />
                      {MILESTONE_STATUS_LABELS[s]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
