import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, FolderOpen, ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/layout/AppShell'
import { OverallProgressCard } from '@/components/home/OverallProgressCard'
import { ProjectStatusChartCard } from '@/components/home/ProjectStatusChartCard'
import { ProjectCard } from '@/components/home/ProjectCard'
import { ActivityTimeline } from '@/components/home/ActivityTimeline'
import { SecurityHealthWidget } from '@/components/home/SecurityHealthWidget'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/hooks/use-dashboard'
import { useProjects } from '@/hooks/use-projects'
import { useWaves } from '@/hooks/use-waves'
import { useEmbargos } from '@/hooks/use-embargos'
import { useCurrentUser } from '@/context/UserContext'
import { getSurveyDraftProjectIds } from '@/services/projects'
import { exportEstimatedEffortReport } from '@/lib/export-report'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import type { OverallStats } from '@/types'

type SortKey = 'progress' | 'status'

export function HomePage() {
  const [sortKey, setSortKey] = useState<SortKey>('progress')
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false

  const { stats: globalStats, activity: allActivity, loading: dashLoading } = useDashboard({ enabled: isPlatformLead })
  const { projects, loading: projectsLoading } = useProjects({ home: true })
  const { waves, loading: wavesLoading } = useWaves({ enabled: isPlatformLead })
  const { embargos: allEmbargos, loading: embargosLoading } = useEmbargos({ enabled: isPlatformLead })
  const [draftProjectIds, setDraftProjectIds] = useState<string[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setDraftsLoading(true)
    getSurveyDraftProjectIds()
      .then(ids => {
        if (!cancelled) {
          setDraftProjectIds(ids)
          setDraftsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraftProjectIds([])
          setDraftsLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const loading = dashLoading || projectsLoading || wavesLoading || embargosLoading || draftsLoading

  // For non-platform-leads: filter activity to their assigned projects only
  const projectIds = useMemo(() => projects.map(p => p.id), [projects])
  const activity = useMemo(
    () => isPlatformLead
      ? allActivity
      : allActivity.filter(a => a.projectId != null && projectIds.includes(a.projectId)),
    [isPlatformLead, allActivity, projectIds],
  )

  // For non-platform-leads: compute stats scoped to their assigned projects
  const scopedStats = useMemo((): OverallStats | null => {
    if (isPlatformLead || projects.length === 0) return null
    const completed = projects.filter(p => p.status === 'completed').length
    const inProgress = projects.filter(p => ['in-progress', 'migrating', 'signed-off'].includes(p.status)).length
    const progress = Math.round(
      projects.reduce((sum, p) => sum + p.progress, 0) / projects.length,
    )
    return {
      progress,
      totalAssets: projects.length,
      targetCloud: globalStats?.targetCloud ?? 'Azure',
      completed,
      inProgress,
    }
  }, [isPlatformLead, projects, globalStats?.targetCloud])

  const displayStats = isPlatformLead ? globalStats : scopedStats

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortKey === 'progress') return b.progress - a.progress
    if (sortKey === 'status') return a.status.localeCompare(b.status)
    return 0
  })

  // For platform leads: show latest 5 active projects on the home grid
  const homeProjects = useMemo(() => {
    if (!isPlatformLead) return sortedProjects
    const active = sortedProjects.filter(p => p.status !== 'completed')
    // Sort by updatedAt descending for "latest"
    const latestActive = [...active].sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    )
    return latestActive.slice(0, 5)
  }, [isPlatformLead, sortedProjects])

  // Security metrics for the Security Health widget
  const securityMetrics = useMemo(() => {
    const openCriticalRisks = projects.flatMap(p => p.risks ?? [])
      .filter(r => r.severity === 'critical' && r.riskStatus?.toLowerCase() === 'open')
    const blockedProjectsList = projects.filter(p => p.status === 'blocked')
    const securityResourcesOutOfSync = projects.flatMap(p =>
      p.currentInfrastructure?.resources ?? []
    ).filter(r =>
      (r.product === 'kms' || r.product === 'vpc') && r.syncStatus !== 'synced'
    )

    const today = new Date().toISOString().slice(0, 10)
    const activeEmbargosList = allEmbargos.filter(e => e.startDate <= today && e.endDate >= today)

    return {
      openCriticalRisksCount: openCriticalRisks.length,
      openCriticalRisksTitles: openCriticalRisks.slice(0, 2).map(r => r.title),
      blockedProjectsCount: blockedProjectsList.length,
      securityResourcesOutOfSyncCount: securityResourcesOutOfSync.length,
      activeEmbargosCount: activeEmbargosList.length,
      activeEmbargoNames: activeEmbargosList.slice(0, 2).map(e => e.name),
    }
  }, [projects, allEmbargos])

  return (
    <AppShell>
      <div className="max-w-7xl w-full mx-auto space-y-8">
        {/* Section 1: Global Progress */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-tight">
                {isPlatformLead ? 'Migration Workspace' : 'My Projects'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isPlatformLead
                  ? 'Real-time oversight of enterprise-wide cloud transformation.'
                  : 'Projects assigned to you.'}
              </p>
            </div>
            {isPlatformLead && (
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2 cursor-pointer">
                      <Download size={14} /> Export Report <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportEstimatedEffortReport()}>
                      Estimated Effort Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
                  <Plus size={14} /> New Migration
                </button>
              </div>
            )}
          </div>

          {isPlatformLead && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {loading || !displayStats ? (
                <>
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </>
              ) : (
                <>
                  <OverallProgressCard stats={displayStats} projects={projects} waves={waves} />
                  <ProjectStatusChartCard projects={projects} draftProjectIds={draftProjectIds} />
                </>
              )}
            </div>
          )}
        </section>

        {/* Section 2: Projects Grid */}
        <section className="space-y-6 w-full">
          <div className={cn('flex items-center', isPlatformLead ? 'justify-between' : 'justify-end')}>
            {isPlatformLead && (
              <h2 className="text-xl font-semibold text-foreground">Active Projects</h2>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Sort by:</span>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="bg-transparent border-none text-xs font-bold text-foreground focus:ring-0 cursor-pointer outline-none"
              >
                <option value="progress">Progress (%)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <div className={cn('grid gap-6 w-full', isPlatformLead ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2')}>
            {loading ? (
              <>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                {!isPlatformLead && <Skeleton className="h-40 rounded-xl" />}
              </>
            ) : homeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">
                No projects are assigned to you yet.
              </p>
            ) : (
              <>
                {homeProjects.map(project => (
                  <ProjectCard key={project.id} project={project} rich={!isPlatformLead} />
                ))}
                {isPlatformLead && projects.length > 0 && (
                  <div
                    onClick={() => navigate('/projects')}
                    className="cursor-pointer rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/50 transition-colors flex flex-col items-center justify-center gap-3 p-6 min-h-[160px]"
                  >
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <FolderOpen className="size-6 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">View All Projects</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{projects.length} total projects</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <span>Go to Projects</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Section 3: Secondary — only for platform leads */}
        {isPlatformLead && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {loading ? (
                <Skeleton className="h-48 rounded-xl" />
              ) : (
                <ActivityTimeline activities={activity} />
              )}
            </div>
            {loading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : (
              <SecurityHealthWidget {...securityMetrics} />
            )}
          </section>
        )}
      </div>
    </AppShell>
  )
}
