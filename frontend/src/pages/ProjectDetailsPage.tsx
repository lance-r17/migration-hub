import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BadgeCheck, History } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SignOffWorkflowBar } from '@/components/project/SignOffWorkflowBar'
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
import { useCurrentUser } from '@/context/UserContext'
import type { Project, ProjectStatus } from '@/types'

export function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { user } = useCurrentUser()
  const { project, loading, saveSection } = useProject(id)
  const [modalOpen, setModalOpen] = useState(false)
  const [auditLogOpen, setAuditLogOpen] = useState(false)

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

  const handleSave = async <K extends keyof Project>(key: K, value: Project[K]) => {
    try {
      await saveSection(key, value)
      toast.success('Changes saved')
    } catch {
      toast.error('Failed to save changes. Please try again.')
    }
  }

  const handleConfirm = async (approvedRole: string) => {
    setModalOpen(false)
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    try {
      await saveSection('approvals', project.approvals.map(a =>
        a.role === approvedRole
          ? { ...a, status: 'approved' as const, approver: user?.name ?? '', timestamp: now }
          : a
      ))
      toast.success('Sign-off submitted successfully', {
        description: 'Approval recorded. Jira issues will be created shortly.',
      })
    } catch {
      toast.error('Failed to submit sign-off. Please try again.')
    }
  }

  const preSignOffStatuses: ProjectStatus[] = ['planning', 'in-progress', 'blocked']
  const currentUserRole =
    project.approvals.find(a => a.userId === user?.id)?.role
    ?? (user?.role ?? null)
  const canSignOff =
    preSignOffStatuses.includes(project.status) &&
    currentUserRole !== null &&
    project.approvals.find(a => a.role === currentUserRole)?.status !== 'approved'
  const hasMetadata = project.migrationWave || project.jiraTicket || project.profileOwner || project.lastUpdated

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
            <StatusBadge status={project.status} />
            <button
              onClick={() => setAuditLogOpen(true)}
              className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="size-4" />
              Change History
            </button>
          </div>
          <p className="text-muted-foreground">
            {project.description ?? 'No description provided.'}
          </p>
        </div>

        {/* Metadata strip */}
        {(hasMetadata || preSignOffStatuses.includes(project.status)) && (
          <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {project.migrationWave && (
                <span>Wave: <strong className="text-foreground">{project.migrationWave}</strong></span>
              )}
              {project.jiraTicket && (
                <span>Jira: <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">{project.jiraTicket}</code></span>
              )}
              {project.profileOwner && (
                <span>Profile Owner: <strong className="text-foreground">{project.profileOwner}</strong></span>
              )}
              {project.lastUpdated && (
                <span>Last Updated: <strong className="text-foreground">{project.lastUpdated}</strong></span>
              )}
            </div>
            {canSignOff && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded shadow-sm hover:opacity-90 transition-all text-sm flex-shrink-0"
              >
                <BadgeCheck size={16} /> Sign-off
              </button>
            )}
          </div>
        )}

        {/* Sign-off Workflow Bar */}
        <SignOffWorkflowBar approvals={project.approvals} />

        {/* Sections */}
        <div>
          <ApplicationOverviewSection
            data={project.applicationOverview}
            projectId={project.id}
            onSave={(d) => handleSave('applicationOverview', d)}
          />
          <RisksBlockersSection
            risks={project.risks}
            onSave={(risks) => handleSave('risks', risks)}
          />
          <CurrentInfrastructureSection
            data={project.currentInfrastructure}
            onSave={(d) => handleSave('currentInfrastructure', d)}
            projectStatus={project.status}
          />
          <DataPersistenceSection
            data={project.dataPersistence}
            onSave={(d) => handleSave('dataPersistence', d)}
          />
          <AvailabilityResilienceSection
            data={project.availability}
            onSave={(d) => handleSave('availability', d)}
          />
          <DependenciesSection
            data={project.dependencies}
            onSave={(d) => handleSave('dependencies', d)}
          />
          <NonFunctionalRequirementsSection
            data={project.nfrs}
            onSave={(d) => handleSave('nfrs', d)}
          />
          <MigrationConstraintsSection
            data={project.migrationConstraints}
            onSave={(d) => handleSave('migrationConstraints', d)}
          />
          <TargetArchitectureSection
            data={project.targetArchitecture}
            onSave={(d) => handleSave('targetArchitecture', d)}
          />
        </div>
      </div>

      <SignOffModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        approvals={project.approvals}
        currentUserRole={currentUserRole}
      />

      <AuditLogDrawer
        projectId={project.id}
        open={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
      />
    </AppShell>
  )
}
