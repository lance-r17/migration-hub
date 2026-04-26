import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BadgeCheck, Ban, ClipboardList, History, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StageProgressStepper } from '@/components/project/StageProgressStepper'
import { ApplicationOverviewSection } from '@/components/project/ApplicationOverviewSection'
import { CurrentInfrastructureSection } from '@/components/project/CloudResourcesSection'
import { RisksBlockersSection } from '@/components/project/RisksBlockersSection'
import { DataPersistenceSection } from '@/components/project/DataSecuritySection'
import { AvailabilityResilienceSection } from '@/components/project/AvailabilitySection'
import { DependenciesSection } from '@/components/project/DependenciesSection'
import { NonFunctionalRequirementsSection } from '@/components/project/NonFunctionalRequirementsSection'
import { MigrationConstraintsSection } from '@/components/project/MigrationCutoverSection'
import { TargetArchitectureSection } from '@/components/project/TargetArchitectureSection'
import { SignOffModal } from '@/components/modals/SignOffModal'
import { AuditLogDrawer } from '@/components/drawers/AuditLogDrawer'
import { AssignWaveDrawer } from '@/components/drawers/AssignWaveDrawer'
import { OperationsDrawer } from '@/components/drawers/OperationsDrawer'
import { SurveyModal } from '@/components/survey/SurveyModal'
import { EmbargoBanner } from '@/components/project/EmbargoBanner'
import { useSurveyConfig, useResourceSurveyConfig } from '@/hooks/use-survey'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import { useEmbargos } from '@/hooks/use-embargos'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useProject } from '@/hooks/use-projects'
import { useWaves } from '@/hooks/use-waves'
import { useCurrentUser } from '@/context/UserContext'
import { createJiraJob } from '@/services/jiraJobs'
import { markResourceSyncComplete } from '@/services/projects'
import { getSignoffConfig } from '@/services/signoffConfig'
import { apiClient } from '@/services/client'
import { ensureAllRoles } from '@/lib/approvals'
import type { Project, ProjectStatus } from '@/types'
import type { JiraSubtaskConfig } from '@/types/wave'

export function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { user } = useCurrentUser()
  const { project, loading, saveSection, refreshProject } = useProject(id)
  const { waves } = useWaves()
  const { surveyConfig } = useSurveyConfig()
  const { resourceSurveyConfig } = useResourceSurveyConfig()
  const { getCategoryForProduct } = useProductCategoryMap()
  const { embargos } = useEmbargos()
  const [signoffEnabled, setSignoffEnabled] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [auditLogOpen, setAuditLogOpen] = useState(false)
  const [assignWaveOpen, setAssignWaveOpen] = useState(false)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [operationsOpen, setOperationsOpen] = useState(false)

  // Fire completion toast when jiraJobStatus transitions to 'completed'
  const prevJiraStatus = useRef(project?.jiraJobStatus)
  useEffect(() => {
    if (prevJiraStatus.current !== 'completed' && project?.jiraJobStatus === 'completed') {
      toast.success(`Jira story ${project.jiraStoryKey} created`, {
        description: 'All sub-tasks have been linked to cloud resources.',
      })
    }
    prevJiraStatus.current = project?.jiraJobStatus
  }, [project?.jiraJobStatus, project?.jiraStoryKey])

  // Poll backend for job completion when status is pending/processing (backend mode only)
  useEffect(() => {
    if (project?.jiraJobStatus !== 'pending' && project?.jiraJobStatus !== 'processing') return
    const interval = setInterval(() => { refreshProject() }, 2_000)
    return () => clearInterval(interval)
  }, [project?.jiraJobStatus, refreshProject])

  useEffect(() => {
    getSignoffConfig().then(cfg => setSignoffEnabled(cfg.enabled)).catch(() => {})
  }, [])

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-screen-xl mx-auto w-full space-y-8">
          <Skeleton className="h-5 w-48 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-9 w-96 rounded" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>
          <Skeleton className="h-16 rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!project) {
    return (
      <AppShell>
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <p className="text-2xl font-semibold text-foreground mb-2">Project not found</p>
            <p className="text-muted-foreground text-sm mb-6">
              The project with ID <span className="font-mono font-semibold">{id}</span> does not exist.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm"
            >
              Back to Workspace
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  const APPROVAL_SEQUENCE = ['technical_lead', 'business_owner', 'platform_migration_lead'] as const

  const handleSave = async <K extends keyof Project>(key: K, value: Project[K]) => {
    try {
      await saveSection(key, value)
      toast.success('Changes saved')
    } catch {
      toast.error('Failed to save changes. Please try again.')
    }
  }

  const applyApproval = async (approvedRole: string) => {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const idx = APPROVAL_SEQUENCE.indexOf(approvedRole as typeof APPROVAL_SEQUENCE[number])
    const nextRole = idx >= 0 ? APPROVAL_SEQUENCE[idx + 1] : undefined
    const allApprovals = ensureAllRoles(project.approvals)
    const updatedApprovals = allApprovals.map(a => {
      if (a.role === approvedRole)
        return { ...a, status: 'approved' as const, approver: user?.name ?? '', timestamp: now }
      if (a.role === nextRole && a.status === 'pending')
        return { ...a, status: 'waiting' as const }
      return a
    })
    await saveSection('approvals', updatedApprovals)
    if (updatedApprovals.every(a => a.status === 'approved')) {
      await saveSection('status', 'signed-off')
    }
    return updatedApprovals
  }

  const handleConfirm = async (approvedRole: string) => {
    setModalOpen(false)
    try {
      await applyApproval(approvedRole)
      await refreshProject()
      toast.success('Sign-off submitted successfully', {
        description: 'Approval recorded. Jira issues will be created shortly.',
      })
    } catch {
      toast.error('Failed to submit sign-off. Please try again.')
    }
  }

  const handleConfirmWithJira = async (approvedRole: string, config: JiraSubtaskConfig) => {
    setModalOpen(false)
    try {
      await applyApproval(approvedRole)
      await saveSection('jiraSubtaskConfig', config)
      await createJiraJob(
        project.id,
        config,
        project.currentInfrastructure?.resources ?? [],
        assignedWave?.jiraEpicKey,
      )
      await refreshProject()
      toast.success('Jira story creation queued', {
        description: 'Processing will begin shortly. Sub-tasks will appear in Compute & Resources.',
      })
    } catch {
      toast.error('Failed to submit sign-off. Please try again.')
    }
  }

  const handleRetryJiraJob = async () => {
    try {
      await apiClient.post(`/api/v1/jira/projects/${project.id}/retry-job`, {})
      await refreshProject()
    } catch {
      toast.error('Failed to retry Jira job. Please try again.')
    }
  }

  const handleAssignWave = async (waveId: string | undefined) => {
    await handleSave('waveId', waveId)
  }

  const handleMarkMigrationComplete = async (resourceId: string, completed: boolean) => {
    const resources = (project.currentInfrastructure?.resources ?? []).map(r =>
      r.id === resourceId ? { ...r, migrationCompleted: completed } : r
    )
    await handleSave('currentInfrastructure', { ...(project.currentInfrastructure ?? { resources: [] }), resources })
    await refreshProject()
  }

  const handleMarkSyncCompleted = async (resourceId: string) => {
    try {
      await markResourceSyncComplete(project.id, resourceId)
      await refreshProject()
      toast.success('Sync completed', {
        description: 'Jira subtask closure has been queued.',
      })
    } catch {
      toast.error('Failed to mark sync complete. Please try again.')
    }
  }

  const isProjectMember = project.team.some(m => m.id === user?.id)
  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const isLocked = project.approvals.find(a => a.role === 'technical_lead')?.status === 'approved'
  const isSurveyActive = !!(surveyConfig?.isActive && surveyConfig.questions.length > 0)
  const assignedWave = waves.find(w => w.id === project.waveId)

  const preSignOffStatuses: ProjectStatus[] = ['planning', 'in-progress', 'blocked']
  const overview = project.applicationOverview
  const isAssignedTL = !!overview?.technicalLeadId && overview.technicalLeadId === user?.id
  const isAssignedBO = !!overview?.businessOwnerId && overview.businessOwnerId === user?.id
  const currentUserRole = isPlatformLead
    ? 'platform_migration_lead'
    : isAssignedTL ? 'technical_lead'
    : isAssignedBO ? 'business_owner'
    : null
  const currentRoleIndex = currentUserRole ? APPROVAL_SEQUENCE.indexOf(currentUserRole) : -1
  const predecessorsApproved = currentRoleIndex <= 0 || APPROVAL_SEQUENCE
    .slice(0, currentRoleIndex)
    .every(role => project.approvals.find(a => a.role === role)?.status === 'approved')
  const eligibleForSignoff =
    preSignOffStatuses.includes(project.status) &&
    currentUserRole !== null &&
    predecessorsApproved &&
    project.approvals.find(a => a.role === currentUserRole)?.status !== 'approved'
  const canSignOff = signoffEnabled && eligibleForSignoff
  const showSignoffDisabledNotice = !signoffEnabled && eligibleForSignoff
  const hasMetadata = project.migrationWave || project.jiraTicket || project.profileOwner || project.updatedAt

  return (
    <AppShell title={project.name}>
      <div className="max-w-screen-xl mx-auto w-full space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate('/')} className="cursor-pointer">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Projects</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project.id}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{project.name}</h1>
            <StatusBadge status={project.status} stageProgress={project.stageProgress} />
            <div className="ml-auto flex items-center gap-3">
              {isSurveyActive && !isLocked && (isProjectMember || isPlatformLead) && (
                <button
                  onClick={() => setSurveyOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium"
                >
                  <ClipboardList className="size-4" />
                  Fill Survey
                </button>
              )}
              <button
                onClick={() => setAuditLogOpen(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="size-4" />
                Change History
              </button>
            </div>
          </div>
          <p className="text-muted-foreground">
            {project.description ?? 'No description provided.'}
          </p>
        </div>

        {/* Stage Progress Stepper */}
        <StageProgressStepper project={project} />

        {/* Metadata strip */}
        {(hasMetadata || preSignOffStatuses.includes(project.status)) && (
          <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {(assignedWave || project.migrationWave) && (
                <span className="flex items-center gap-2">
                  Wave: <strong className="text-foreground">{assignedWave?.name ?? project.migrationWave}</strong>
                  {isPlatformLead && (
                    <button
                      onClick={() => setAssignWaveOpen(true)}
                      className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                      {project.waveId ? 'Change' : 'Assign'}
                    </button>
                  )}
                </span>
              )}
              {!assignedWave && !project.migrationWave && isPlatformLead && (
                <span className="flex items-center gap-2">
                  Wave: <span className="text-muted-foreground">Unassigned</span>
                  <button
                    onClick={() => setAssignWaveOpen(true)}
                    className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                  >
                    Assign
                  </button>
                </span>
              )}
              {project.jiraStoryKey && (
                <span>Story:{' '}
                  {project.jiraBaseUrl ? (
                    <a href={`${project.jiraBaseUrl}/browse/${project.jiraStoryKey}`} target="_blank" rel="noopener noreferrer" className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded hover:underline">{project.jiraStoryKey}</a>
                  ) : (
                    <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">{project.jiraStoryKey}</code>
                  )}
                </span>
              )}
              {project.jiraTicket && (
                <span>Jira:{' '}
                  {project.jiraBaseUrl ? (
                    <a href={`${project.jiraBaseUrl}/browse/${project.jiraTicket}`} target="_blank" rel="noopener noreferrer" className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded hover:underline">{project.jiraTicket}</a>
                  ) : (
                    <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">{project.jiraTicket}</code>
                  )}
                </span>
              )}
              {project.profileOwner && (
                <span>Profile Owner: <strong className="text-foreground">{project.profileOwner}</strong></span>
              )}
              {project.updatedAt && (
                <span>Last Updated: <strong className="text-foreground">{project.updatedAt}</strong></span>
              )}
            </div>
            {isPlatformLead && project.status !== 'blocked' && (
              <button
                onClick={() => handleSave('status', 'blocked')}
                className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 text-destructive font-semibold rounded shadow-sm hover:bg-destructive/20 transition-all text-sm flex-shrink-0"
              >
                <Ban size={16} /> Block Project
              </button>
            )}
            {isPlatformLead && project.status === 'blocked' && (
              <button
                onClick={() => handleSave('status', 'in-progress')}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold rounded shadow-sm hover:opacity-90 transition-all text-sm flex-shrink-0"
              >
                <BadgeCheck size={16} /> Unblock Project
              </button>
            )}
            {canSignOff && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded shadow-sm hover:opacity-90 transition-all text-sm flex-shrink-0"
              >
                <BadgeCheck size={16} /> Sign-off
              </button>
            )}
            {showSignoffDisabledNotice && (
              <span className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground bg-muted rounded-lg flex-shrink-0">
                <Lock size={14} /> Sign-off disabled
              </span>
            )}
          </div>
        )}

        {/* Embargo Banner */}
        <EmbargoBanner
          serviceLine={project.applicationOverview?.serviceLine}
          embargos={embargos}
        />

        {/* Sections */}
        <div>
          <ApplicationOverviewSection
            data={project.applicationOverview}
            projectId={project.id}
            onSave={!isLocked ? (d) => handleSave('applicationOverview', d) : undefined}
          />
          <RisksBlockersSection
            risks={project.risks}
            onSave={!isLocked ? (risks) => handleSave('risks', risks) : undefined}
          />
          <CurrentInfrastructureSection
            data={project.currentInfrastructure}
            onSave={!isLocked ? (d) => handleSave('currentInfrastructure', d) : undefined}
            projectStatus={project.status}
            isProjectMember={isProjectMember}
            isPlatformLead={isPlatformLead}
            jiraJobStatus={project.jiraJobStatus}
            jiraStoryKey={project.jiraStoryKey}
            jiraBaseUrl={project.jiraBaseUrl}
            onRetryJiraJob={handleRetryJiraJob}
            onOpenOperations={() => setOperationsOpen(true)}
            onMarkMigrationComplete={(isProjectMember || isPlatformLead) ? handleMarkMigrationComplete : undefined}
            onMarkSyncCompleted={(isProjectMember || isPlatformLead) ? handleMarkSyncCompleted : undefined}
          />
          <DataPersistenceSection
            data={project.dataPersistence}
            onSave={!isLocked ? (d) => handleSave('dataPersistence', d) : undefined}
          />
          <AvailabilityResilienceSection
            data={project.availability}
            onSave={!isLocked ? (d) => handleSave('availability', d) : undefined}
          />
          <DependenciesSection
            data={project.dependencies}
            onSave={!isLocked ? (d) => handleSave('dependencies', d) : undefined}
          />
          <NonFunctionalRequirementsSection
            data={project.nfrs}
            onSave={!isLocked ? (d) => handleSave('nfrs', d) : undefined}
          />
          <MigrationConstraintsSection
            data={project.migrationConstraints}
            onSave={!isLocked ? (d) => handleSave('migrationConstraints', d) : undefined}
          />
          <TargetArchitectureSection
            data={project.targetArchitecture}
            onSave={!isLocked ? (d) => handleSave('targetArchitecture', d) : undefined}
          />
        </div>
      </div>

      <SignOffModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        onConfirmWithJira={handleConfirmWithJira}
        approvals={project.approvals}
        currentUserRole={currentUserRole}
        cloudResources={project.currentInfrastructure?.resources ?? []}
      />

      <AuditLogDrawer
        projectId={project.id}
        open={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
      />

      <AssignWaveDrawer
        open={assignWaveOpen}
        onOpenChange={setAssignWaveOpen}
        waves={waves}
        currentWaveId={project.waveId}
        onSave={handleAssignWave}
      />

      <OperationsDrawer
        open={operationsOpen}
        onOpenChange={setOperationsOpen}
        projectId={project.id}
        resources={project.currentInfrastructure?.resources ?? []}
        jiraBaseUrl={project.jiraBaseUrl}
      />

      {surveyConfig && (
        <SurveyModal
          open={surveyOpen}
          onClose={() => setSurveyOpen(false)}
          surveyConfig={surveyConfig}
          project={project}
          onSave={handleSave}
          onSubmitted={refreshProject}
          resourceSurveyConfig={resourceSurveyConfig ?? undefined}
          getCategoryForProduct={getCategoryForProduct}
        />
      )}
    </AppShell>
  )
}
