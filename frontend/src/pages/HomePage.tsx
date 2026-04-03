import { useState, useMemo } from 'react'
import { Download, Plus, CheckCircle2, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { OverallProgressCard } from '@/components/home/OverallProgressCard'
import { StatCard } from '@/components/home/StatCard'
import { ProjectCard } from '@/components/home/ProjectCard'
import { ActivityTimeline } from '@/components/home/ActivityTimeline'
import { SecurityHealthWidget } from '@/components/home/SecurityHealthWidget'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/hooks/use-dashboard'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import type { OverallStats } from '@/types'

type SortKey = 'progress' | 'status'

export function HomePage() {
  const [sortKey, setSortKey] = useState<SortKey>('progress')
  const { user } = useCurrentUser()
  const isPlatformLead = user?.role === 'Platform Migration Lead'

  const { stats: globalStats, activity: allActivity, loading: dashLoading } = useDashboard()
  const { projects, loading: projectsLoading } = useProjects()

  const loading = dashLoading || projectsLoading

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
    const completed = projects.filter(p => p.status === 'signed-off').length
    const inProgress = projects.filter(p => ['in-progress', 'active'].includes(p.status)).length
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

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
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
                <button className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2">
                  <Download size={14} /> Export Report
                </button>
                <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
                  <Plus size={14} /> New Migration
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {loading || !displayStats ? (
              <>
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </>
            ) : (
              <>
                <OverallProgressCard stats={displayStats} />
                <StatCard
                  label="Completed Projects"
                  value={displayStats.completed}
                  icon={CheckCircle2}
                  iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                  iconColor="text-emerald-700 dark:text-emerald-300"
                />
                <StatCard
                  label="In Progress"
                  value={displayStats.inProgress}
                  icon={Clock}
                  iconBg="bg-secondary"
                  iconColor="text-secondary-foreground"
                />
              </>
            )}
          </div>
        </section>

        {/* Section 2: Projects Grid */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">
              {isPlatformLead ? 'Active Projects' : 'Your Projects'}
            </h2>
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
              <>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </>
            ) : sortedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-3">
                No projects are assigned to you yet.
              </p>
            ) : (
              sortedProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))
            )}
          </div>
        </section>

        {/* Section 3: Secondary */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {loading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : (
              <ActivityTimeline activities={activity} />
            )}
          </div>
          <SecurityHealthWidget />
        </section>
      </div>
    </AppShell>
  )
}
