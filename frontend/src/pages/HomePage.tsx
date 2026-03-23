import { useState } from 'react'
import { Download, Plus, CheckCircle2, Clock } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { OverallProgressCard } from '@/components/home/OverallProgressCard'
import { StatCard } from '@/components/home/StatCard'
import { ProjectCard } from '@/components/home/ProjectCard'
import { ActivityTimeline } from '@/components/home/ActivityTimeline'
import { SecurityHealthWidget } from '@/components/home/SecurityHealthWidget'
import { overallStats, recentActivity, mockProjects } from '@/data/mock'

type SortKey = 'progress' | 'status'

export function HomePage() {
  const [sortKey, setSortKey] = useState<SortKey>('progress')

  const sortedProjects = [...mockProjects].sort((a, b) => {
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
                Migration Workspace
              </h1>
              <p className="text-muted-foreground mt-1">
                Real-time oversight of enterprise-wide cloud transformation.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2">
                <Download size={14} /> Export Report
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
                <Plus size={14} /> New Migration
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <OverallProgressCard stats={overallStats} />
            <StatCard
              label="Completed Projects"
              value={overallStats.completed}
              icon={CheckCircle2}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-700 dark:text-emerald-300"
            />
            <StatCard
              label="In Progress"
              value={overallStats.inProgress}
              icon={Clock}
              iconBg="bg-secondary"
              iconColor="text-secondary-foreground"
            />
          </div>
        </section>

        {/* Section 2: Projects Grid */}
        <section className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-foreground">Active Projects</h2>
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
            {sortedProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>

        {/* Section 3: Secondary */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityTimeline activities={recentActivity} />
          </div>
          <SecurityHealthWidget />
        </section>
      </div>
    </AppShell>
  )
}
