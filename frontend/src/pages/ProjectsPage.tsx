import { useNavigate } from 'react-router-dom'
import { Lock, FolderOpen, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { TeamAvatars } from '@/components/shared/TeamAvatars'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { getSignoffCompletionDate } from '@/utils/dates'
import type { Project } from '@/types'

function getProgressVariant(project: Project) {
  if (project.progress === 100) return 'tertiary'
  if (project.status === 'blocked') return 'error'
  if (project.status === 'planning') return 'muted'
  return 'primary'
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { projects, loading } = useProjects()

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false

  if (!isPlatformLead) {
    return (
      <AppShell title="Projects">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm mb-6">
              Projects listing is only available to Platform Migration Leads.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Projects">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="size-5 text-muted-foreground" />
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Projects</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            All migration projects across the platform.
          </p>
        </div>

        {/* Projects Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">ID</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Progress</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Wave</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">ITSO</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Team</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Signoff Date</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                    No projects found.
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {project.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {project.id}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} stageProgress={project.stageProgress} />
                    </TableCell>
                    <TableCell>
                      <div className="w-full max-w-[120px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground" />
                          <span className="font-medium">{project.progress}%</span>
                        </div>
                        <ProgressBar
                          value={project.progress}
                          variant={getProgressVariant(project)}
                          height="h-1.5"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.migrationWave ?? project.waveId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.itso ?? '—'}
                    </TableCell>
                    <TableCell>
                      <TeamAvatars members={project.team} max={3} size="h-6 w-6" />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(() => {
                        const d = getSignoffCompletionDate(project)
                        if (!d) return '—'
                        return d.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      })()}
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-sm font-semibold text-primary flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/projects/${project.id}`)
                        }}
                      >
                        View
                        <ChevronRight size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  )
}
