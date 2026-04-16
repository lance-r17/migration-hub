import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  rectIntersection,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'
import type { Wave } from '@/types/wave'
import { Sparkles, Calendar, Circle, CheckCircle2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ProjectPreviewDrawer } from '@/components/drawers/ProjectPreviewDrawer'

interface Props {
  projects: Project[]
  waves: Wave[]
  onAssign: (projectIds: string[], waveId: string | undefined) => void
}

function findBestWave(project: Project, waves: Wave[]): Wave | null {
  const pStart = project.migrationConstraints?.earliestStartDate
  const pEnd = project.migrationConstraints?.latestEndDate
  if (!pStart || !pEnd) return null

  const activeWaves = waves.filter(w => w.status !== 'completed')
  let bestWave: Wave | null = null
  let maxOverlap = 0

  const pStartTime = new Date(pStart).getTime()
  const pEndTime = new Date(pEnd).getTime()

  for (const wave of activeWaves) {
    const wStartTime = new Date(wave.startDate).getTime()
    const wEndTime = new Date(wave.cutoverDate).getTime()
    
    const overlapStart = Math.max(pStartTime, wStartTime)
    const overlapEnd = Math.min(pEndTime, wEndTime)
    
    const overlap = Math.max(0, overlapEnd - overlapStart)
    if (overlap > maxOverlap) {
      maxOverlap = overlap
      bestWave = wave
    } else if (overlap > 0 && overlap === maxOverlap) {
      if (bestWave && wStartTime < new Date(bestWave.startDate).getTime()) {
        bestWave = wave
      }
    }
  }
  
  return bestWave
}

function ProjectCard({ 
  project, 
  selected, 
  onToggle, 
  locked, 
  isDragOverlay,
  onClick,
  allWaves = [],
  onQuickAssign
}: { 
  project: Project
  selected: boolean
  onToggle: (id: string, checked: boolean) => void
  locked: boolean
  isDragOverlay?: boolean
  onClick?: () => void
  allWaves?: Wave[]
  onQuickAssign?: (waveId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { project },
    disabled: locked
  })

  const style = transform && !isDragOverlay ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition-all text-left cursor-pointer",
        locked ? "opacity-75 bg-muted/20" : "hover:border-primary/50",
        isDragging && !isDragOverlay && "opacity-30 border-dashed"
      )}
      onClick={isDragging ? undefined : onClick}
      {...(locked ? {} : listeners)}
      {...(locked ? {} : attributes)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={project.status} />
          </div>
        </div>
        {!locked && (
          <div
            onPointerDown={e => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(project.id, !selected)
            }}
            className={cn(
              "pt-0.5 transition-colors",
              selected ? "text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"
            )}
          >
            {selected ? (
              <CheckCircle2 className="size-5 fill-primary/10" />
            ) : (
              <Circle className="size-5" />
            )}
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
          {project.migrationConstraints?.earliestStartDate ? (
            <>
              <Calendar className="size-3 shrink-0" />
              <span className="flex items-center gap-1">
                <span className="opacity-70">Migration:</span>
                <span>
                  {formatDate(project.migrationConstraints.earliestStartDate)}
                  {project.migrationConstraints.latestEndDate && ` – ${formatDate(project.migrationConstraints.latestEndDate)}`}
                </span>
              </span>
            </>
          ) : (
            <span className="opacity-0">—</span>
          )}
        </div>

        {(() => {
          const bestWave = findBestWave(project, allWaves)
          if (!bestWave || bestWave.id === project.waveId || locked || isDragOverlay) return null
          
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickAssign?.(bestWave.id)
                    }}
                    className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors focus:outline-none"
                  >
                    <Sparkles className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Assign to {bestWave.name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })()}
      </div>

      {locked && (
        <div className="absolute top-2 right-2 flex items-center justify-center p-1 rounded-full bg-muted text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
      )}
    </div>
  )
}

function WaveColumn({ 
  id, 
  title, 
  projects, 
  selectedIds, 
  onToggleSelected,
  onProjectClick,
  disabled,
  allWaves,
  onQuickAssign
}: {
  id: string
  title: string | React.ReactNode
  projects: Project[]
  selectedIds: Set<string>
  onToggleSelected: (id: string, checked: boolean) => void
  onProjectClick: (p: Project) => void
  disabled?: boolean
  allWaves: Wave[]
  onQuickAssign: (projId: string, waveId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
    data: { waveId: id === 'unassigned' ? undefined : id }
  })

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex w-80 shrink-0 flex-col rounded-xl p-4 transition-all h-full border",
        disabled ? "bg-muted/20 border-dashed border-border shadow-none" : "bg-muted/40 border-border shadow-sm",
        isOver && !disabled && "bg-muted/70 border-primary/50 ring-1 ring-primary/20",
        id === 'unassigned' && !disabled && "bg-background/50 border-dashed"
      )}
    >
      <div className="mb-4 flex items-start justify-between min-h-10">
        <div className="min-w-0 pr-2">
          <div className="flex flex-col gap-1.5">
            {typeof title === 'string' ? (
              <h3 className="font-semibold tracking-tight text-sm text-foreground">{title}</h3>
            ) : title}
            
            {disabled && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm uppercase tracking-tight w-fit">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                Completed
              </div>
            )}
          </div>
        </div>
        <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0 mt-0.5 uppercase tracking-wider">
          {projects.length}
        </span>
      </div>
      <div className={cn(
        "flex flex-col gap-2 overflow-y-auto flex-1 pb-10",
        disabled && "opacity-80 grayscale-[0.2]"
      )}>
        {projects.map(p => (
          <ProjectCard 
            key={p.id} 
            project={p} 
            selected={selectedIds.has(p.id)}
            onToggle={onToggleSelected}
            locked={p.status === 'signed-off' || p.status === 'completed'}
            onClick={() => onProjectClick(p)}
            allWaves={allWaves}
            onQuickAssign={(wId) => onQuickAssign(p.id, wId)}
          />
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const [, month, day] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${day} ${months[parseInt(month, 10) - 1]}`
}

export function WavePlanningBoard({ projects, waves, onAssign }: Props) {
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchTargetWave, setBatchTargetWave] = useState<string>("")
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  const unassignedProjects = useMemo(() => 
    projects.filter(p => !p.waveId).sort((a,b) => a.name.localeCompare(b.name)),
  [projects])

  const sortedWaves = useMemo(() => {
    return [...waves].sort((a, b) => {
      const startCompare = a.startDate.localeCompare(b.startDate)
      if (startCompare !== 0) return startCompare
      return a.cutoverDate.localeCompare(b.cutoverDate)
    })
  }, [waves])

  const projectsByWave = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const w of sortedWaves) {
      map.set(w.id, projects.filter(p => p.waveId === w.id).sort((a,b) => a.name.localeCompare(b.name)))
    }
    return map
  }, [projects, sortedWaves])

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const proj = event.active.data.current?.project as Project
    if (proj) setActiveProject(proj)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProject(null)
    const { active, over } = event
    if (!over) return

    const proj = active.data.current?.project as Project
    const targetWaveId = over.data.current?.waveId

    if (proj && proj.waveId !== targetWaveId) {
      onAssign([proj.id], targetWaveId)
    }
  }

  const handleBatchAssign = () => {
    if (selectedIds.size === 0) return
    const targetId = batchTargetWave === 'unassigned' ? undefined : batchTargetWave
    onAssign(Array.from(selectedIds), targetId)
    setSelectedIds(new Set())
    setBatchTargetWave("")
  }

  return (
    <div className="relative flex flex-col w-full h-full">
      <DndContext 
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="h-full overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex h-full gap-4 px-1 items-stretch">
            <WaveColumn 
              id="unassigned"
              title={
                <div className="flex flex-col">
                  <span>Unassigned Projects</span>
                  <span className="text-xs font-normal text-muted-foreground mt-0.5">
                    Backlog
                  </span>
                </div>
              }
              projects={unassignedProjects}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onProjectClick={(p) => setPreviewProjectId(p.id)}
              allWaves={waves}
              onQuickAssign={(pId, wId) => onAssign([pId], wId)}
            />
            {sortedWaves.map(wave => (
              <WaveColumn 
                key={wave.id}
                id={wave.id}
                title={
                  <div className="flex flex-col">
                    <span>{wave.name}</span>
                    <span className="text-xs font-normal text-muted-foreground mt-0.5">
                      {formatDate(wave.startDate)} - {formatDate(wave.cutoverDate)}
                    </span>
                  </div>
                }
                projects={projectsByWave.get(wave.id) || []}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                onProjectClick={(p) => setPreviewProjectId(p.id)}
                disabled={wave.status === 'completed'}
                allWaves={waves}
                onQuickAssign={(pId, wId) => onAssign([pId], wId)}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeProject ? (
            <div className="w-[280px] shadow-xl rotate-3 scale-105 transition-transform cursor-grabbing">
              <ProjectCard 
                project={activeProject} 
                selected={selectedIds.has(activeProject.id)}
                onToggle={() => {}}
                locked={false}
                isDragOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover border border-border shadow-xl rounded-full px-6 py-3 flex items-center gap-6 z-50 min-w-max"
          >
            <span className="text-sm font-medium">
              {selectedIds.size} project{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Assign to:</span>
              <Select value={batchTargetWave} onValueChange={setBatchTargetWave}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select Wave" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {sortedWaves.filter(w => w.status !== 'completed').map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleBatchAssign} disabled={!batchTargetWave}>
                  Apply
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProjectPreviewDrawer 
        projectId={previewProjectId} 
        open={previewProjectId !== null} 
        onOpenChange={(open) => !open && setPreviewProjectId(null)} 
      />
    </div>
  )
}
