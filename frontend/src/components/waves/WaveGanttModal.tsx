import { useState, useEffect } from 'react'
import { X, GanttChart } from 'lucide-react'
import { toast } from 'sonner'
import { WaveGanttChart } from './WaveGanttChart'
import { updatePlanning, updateProject } from '@/services/projects'
import { updateProjectOrder } from '@/services/waves'
import type { Project, ProjectPlanning } from '@/types'
import type { Wave } from '@/types/wave'

interface Props {
  open: boolean
  onClose: () => void
  waves: Wave[]
  projects: Project[]
  onAssign?: (projectId: string, waveId: string | undefined) => void
}

export function WaveGanttModal({ open, onClose, waves: initialWaves, projects: initialProjects, onAssign }: Props) {
  const [liveProjects, setLiveProjects] = useState(initialProjects)
  const [liveWaves, setLiveWaves]       = useState(initialWaves)

  useEffect(() => { setLiveProjects(initialProjects) }, [initialProjects])
  useEffect(() => { setLiveWaves(initialWaves) }, [initialWaves])

  if (!open) return null

  async function handleAssign(projectId: string, waveId: string | undefined) {
    setLiveProjects(prev => prev.map(p => p.id === projectId ? { ...p, waveId } : p))
    try {
      await updateProject(projectId, 'waveId', waveId)
      onAssign?.(projectId, waveId)
    } catch {
      setLiveProjects(prev => prev.map(p => p.id === projectId ? { ...p, waveId: initialProjects.find(x => x.id === projectId)?.waveId } : p))
      toast.error('Failed to assign project to wave')
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

  async function handleUpdatePlanning(projectId: string, planning: ProjectPlanning) {
    // Optimistic update
    setLiveProjects(prev =>
      prev.map(p => p.id === projectId ? { ...p, planning } : p)
    )
    try {
      const updated = await updatePlanning(projectId, planning)
      setLiveProjects(prev => prev.map(p => p.id === projectId ? updated : p))
    } catch {
      // Revert
      setLiveProjects(prev =>
        prev.map(p => p.id === projectId ? { ...p, planning: p.planning } : p)
      )
      toast.error('Failed to save planning')
      throw new Error('Failed to save planning')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/40 backdrop-blur-md">
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

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <X size={22} strokeWidth={2.5} />
        </button>
      </div>

      {/* Gantt Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <WaveGanttChart
          waves={liveWaves}
          projects={liveProjects}
          onUpdatePlanning={handleUpdatePlanning}
          onUpdateProjectOrder={handleUpdateProjectOrder}
          onAssign={handleAssign}
        />
      </div>
    </div>
  )
}
