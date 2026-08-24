import { useState } from 'react'
import { Check, ClipboardList, FileText, ShieldCheck, Server, Clock, Hourglass, Wrench, CreditCard, Cloud, Database, Shield, UserCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { ensureAllRoles, getProjectApprovalSequence } from '@/lib/approvals'
import type { Project, StageProgress, Approval } from '@/types'

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
}

export function StageProgressStepper({ project }: StageProgressStepperProps) {
  const [surveyExpanded, setSurveyExpanded] = useState(false)
  const [signoffExpanded, setSignoffExpanded] = useState(false)

  const sp: StageProgress = project.stageProgress ?? { setup: 0, survey: 0, signoff: 0, migration: 0 }
  const approvedCount = project.approvals.filter(a => a.status === 'approved').length
  const inScopeResources = project.currentInfrastructure?.resources.filter(r => r.needMigration !== false) ?? []
  const completedResources = inScopeResources.filter(r => r.migrationCompleted).length

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

  const approvalSequence = getProjectApprovalSequence(project)
  const expectedApprovalCount = approvalSequence.length

  const stages = [
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
      detail: inScopeResources.length === 0
        ? 'No in-scope resources'
        : completedResources === inScopeResources.length
          ? 'Complete'
          : `${completedResources}/${inScopeResources.length} migrated`,
    },
  ]

  const allApprovals = ensureAllRoles(project.approvals, approvalSequence)
  const remaining = allApprovals.filter(a => a.status !== 'approved').length

  return (
    <div className="bg-muted/40 rounded-lg px-4 py-3 border border-border/50 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {stages.map((stage, i) => {
          const isSurveyStage = stage.key === 'survey'
          const isSignOffStage = stage.key === 'signoff'
          const complete = isSurveyStage ? surveyComplete : sp[stage.key] === 100
          const partial = isSurveyStage ? surveyPartial : sp[stage.key] > 0 && sp[stage.key] < 100
          const Icon = stage.icon

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 shrink-0">
                {(isSurveyStage && isSurveyClickable) || (isSignOffStage && isSignOffClickable) ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isSurveyStage) {
                        setSurveyExpanded(prev => !prev)
                        setSignoffExpanded(false)
                      } else {
                        setSignoffExpanded(prev => !prev)
                        setSurveyExpanded(false)
                      }
                    }}
                    aria-expanded={isSurveyStage ? surveyExpanded : signoffExpanded}
                    aria-label={isSurveyStage ? 'Toggle survey submission details' : 'Toggle sign-off workflow details'}
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
                  <div className="text-[11px] text-muted-foreground truncate">{stage.detail}</div>
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
              <div className="absolute -top-1.5 left-[calc(25%+14px)] -translate-x-1/2 w-3 h-3 bg-muted border-l border-t border-border/50 rotate-45" />
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
              <div className="absolute -top-1.5 left-[calc(50%+14px)] -translate-x-1/2 w-3 h-3 bg-muted border-l border-t border-border/50 rotate-45" />
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
      </AnimatePresence>
    </div>
  )
}
