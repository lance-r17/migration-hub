import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { GanttChart, ArrowLeft, LayoutDashboard } from 'lucide-react'
import { toast } from 'sonner'
import { WaveGanttChart } from '@/components/waves/WaveGanttChart'
import { useWaves } from '@/hooks/use-waves'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { updatePlanning, updateProject } from '@/services/projects'
import { updateProjectOrder } from '@/services/waves'
import { appendAuditEntryMock } from '@/services/auditLog'
import { USE_MOCK } from '@/services/client'
import type { Project, ProjectPlanning } from '@/types'
import type { Wave } from '@/types/wave'

export function WaveGanttPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { waves: initialWaves, loading: wavesLoading } = useWaves()
  const { projects: initialProjects, loading: projectsLoading } = useProjects({
    fields: ['basic', 'progress', 'planning'],
  })

  const [liveWaves, setLiveWaves] = useState<Wave[]>(initialWaves)
  const [liveProjects, setLiveProjects] = useState<Project[]>(initialProjects)

  useEffect(() => { setLiveWaves(initialWaves) }, [initialWaves])
  useEffect(() => { setLiveProjects(initialProjects) }, [initialProjects])

  const sortedWaves = useMemo(() => {
    return [...liveWaves].sort((a, b) => {
      const startCompare = a.startDate.localeCompare(b.startDate)
      if (startCompare !== 0) return startCompare
      return a.cutoverDate.localeCompare(b.cutoverDate)
    })
  }, [liveWaves])

  async function handleUpdatePlanning(projectId: string, planning: ProjectPlanning) {
    setLiveProjects(prev => prev.map(p => p.id === projectId ? { ...p, planning } : p))
    try {
      const updated = await updatePlanning(projectId, planning)
      setLiveProjects(prev => prev.map(p => p.id === projectId ? updated : p))
    } catch {
      setLiveProjects(prev => prev.map(p => p.id === projectId ? { ...p, planning: p.planning } : p))
      toast.error('Failed to save planning')
      throw new Error('Failed to save planning')
    }
  }

  async function handleUpdateProjectOrder(waveId: string, projectIds: string[]) {
    setLiveWaves(prev => prev.map(w => w.id === waveId ? { ...w, projectOrder: projectIds } : w))
    try {
      const updated = await updateProjectOrder(waveId, projectIds)
      setLiveWaves(prev => prev.map(w => w.id === waveId ? updated : w))
    } catch {
      setLiveWaves(initialWaves)
      toast.error('Failed to save project order')
      throw new Error('Failed to save project order')
    }
  }

  async function handleAssign(projectId: string, waveId: string | undefined) {
    setLiveProjects(prev => prev.map(p => p.id === projectId ? { ...p, waveId } : p))
    try {
      await updateProject(projectId, 'waveId', waveId)
      if (USE_MOCK) {
        const p = initialProjects.find(x => x.id === projectId)
        appendAuditEntryMock({
          id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          projectId,
          timestamp: new Date().toISOString(),
          actor: {
            id: user?.id ?? 'unknown',
            name: user?.name ?? 'Unknown User',
            initials: user?.initials ?? '??',
          },
          eventType: 'wave_assigned',
          entityType: 'wave',
          sectionKey: 'waveId',
          sectionLabel: 'Wave Assignment',
          changes: [{ field: 'waveId', label: 'Wave', oldValue: p?.waveId, newValue: waveId }],
        })
      }
    } catch {
      setLiveProjects(prev => prev.map(p => p.id === projectId ? { ...p, waveId: initialProjects.find(x => x.id === projectId)?.waveId } : p))
      toast.error('Failed to assign project to wave')
    }
  }

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const isLoading = wavesLoading || projectsLoading

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GanttChart size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg leading-none">Wave Gantt Chart</h2>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
              Visualize and schedule your migration waves and projects.
            </p>
          </div>
        </div>

        {isPlatformLead ? (
          <button
            onClick={() => navigate('/waves')}
            className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back to Waves</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <LayoutDashboard size={18} />
            <span className="text-sm">Back to Dashboard</span>
          </button>
        )}
      </div>

      {/* Gantt Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <WaveGanttChart
            waves={sortedWaves}
            projects={liveProjects}
            onUpdatePlanning={handleUpdatePlanning}
            onUpdateProjectOrder={isPlatformLead ? handleUpdateProjectOrder : undefined}
            onAssign={isPlatformLead ? handleAssign : undefined}
            readOnly={!isPlatformLead}
          />
        )}
      </div>
    </div>
  )
}
