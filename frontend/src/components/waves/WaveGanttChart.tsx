import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, GripVertical, RotateCcw, MoreHorizontal, Plus, Trash2, Pencil, Sparkles, ArrowRight, Unlink, CloudUpload, Database, HardDrive, ScrollText, BarChart2, Cpu, Lock, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { Project, ProjectPlanning, PlanningTask, TaskType, MigrationEffortEstimation } from '@/types'
import type { Wave } from '@/types/wave'
import type { EmbargoRecord } from '@/types/embargo'
import { useEmbargos } from '@/hooks/use-embargos'
import { getAttachments } from '@/services/attachments'
import type { Attachment } from '@/services/attachments'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ZoomLevel = 'days' | 'weeks' | 'months'
type DragType = 'move' | 'resize-start' | 'resize-end' | 'create'

interface DragState {
  projectId: string
  taskId: string | null
  type: DragType
  startX: number
  originalStart: string
  originalEnd: string
  originalTasks?: { id: string; start: string; end: string }[]
}

interface ConnState {
  fromId: string
  fromX: number
  fromY: number
  mouseX: number
  mouseY: number
  overId: string | null
}

interface RowDragState {
  projectId: string
  taskId: string
  sourceIndex: number
  overIndex: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LEFT_PANEL_W = 680
const ROW_H        = 38
const GROUP_H      = 42
const HEADER_H     = 40

const ZOOM_COL_PX: Record<ZoomLevel, number>      = { days: 28, weeks: 80, months: 120 }
const ZOOM_DAYS_PER_COL: Record<ZoomLevel, number> = { days: 1,  weeks: 7,  months: 30  }

const TASK_PRESETS: { type: TaskType; label: string; icon: LucideIcon }[] = [
  { type: 'onboarding',        label: 'Onboard to New Cloud', icon: CloudUpload },
  { type: 'migrate-computing', label: 'Migrate Computing',   icon: Cpu         },
  { type: 'migrate-database',  label: 'Migrate Database',    icon: Database    },
  { type: 'migrate-storage',  label: 'Migrate Storage',      icon: HardDrive   },
  { type: 'migrate-logs',     label: 'Migrate Logs',         icon: ScrollText  },
  { type: 'migrate-big-data', label: 'Migrate Big Data',     icon: BarChart2   },
  { type: 'custom',           label: 'Custom Task',          icon: Pencil      },
]

const TASK_TYPE_META: Record<TaskType, { bg: string; color: string; label: string; icon: LucideIcon }> = {
  'onboarding':        { bg: 'oklch(0.88 0.05 185)', color: 'oklch(0.35 0.10 185)', label: 'Onboard', icon: CloudUpload },
  'migrate-computing': { bg: 'oklch(0.91 0.05 200)', color: 'oklch(0.35 0.12 200)', label: 'Compute', icon: Cpu         },
  'migrate-database':  { bg: 'oklch(0.90 0.06 220)', color: 'oklch(0.35 0.13 260)', label: 'DB',      icon: Database    },
  'migrate-storage':  { bg: 'oklch(0.92 0.04 290)', color: 'oklch(0.35 0.12 300)', label: 'Storage', icon: HardDrive   },
  'migrate-logs':     { bg: 'oklch(0.91 0.05 20)',  color: 'oklch(0.40 0.14 20)',  label: 'Logs',    icon: ScrollText  },
  'migrate-big-data': { bg: 'oklch(0.92 0.04 240)', color: 'oklch(0.35 0.15 260)', label: 'BigData', icon: BarChart2   },
  'custom':           { bg: 'oklch(0.90 0.05 140)', color: 'oklch(0.35 0.12 150)', label: 'Custom',  icon: Pencil      },
}

const WAVE_STATUS_META: Record<string, { bg: string; color: string }> = {
  'planned':   { bg: 'var(--g-bg-alt)',      color: 'var(--g-text-muted)' },
  'active':    { bg: 'oklch(0.92 0.04 240)', color: 'oklch(0.35 0.13 260)' },
  'completed': { bg: 'oklch(0.90 0.05 140)', color: 'oklch(0.35 0.12 150)' },
}

const PROJECT_STATUS_META: Record<string, { bg: string; color: string }> = {
  'planning':    { bg: 'var(--g-bg-alt)',          color: 'var(--g-text-muted)' },
  'in-progress': { bg: 'oklch(0.92 0.04 240)',     color: 'oklch(0.35 0.13 260)' },
  'migrating':   { bg: 'oklch(0.92 0.04 290)',     color: 'oklch(0.35 0.12 300)' },
  'blocked':     { bg: 'oklch(0.93 0.05 20)',      color: 'oklch(0.40 0.14 20)'  },
  'completed':   { bg: 'oklch(0.90 0.05 140)',     color: 'oklch(0.35 0.12 150)' },
  'signed-off':  { bg: 'oklch(0.90 0.05 140)',     color: 'oklch(0.35 0.12 150)' },
}

const TASK_STATUS_PROGRESS: Record<string, number> = { 'todo': 0, 'in-progress': 50, 'done': 100 }

const DEFAULT_WAVE_COLOR = '#6366F1'

// ─── Date helpers ───────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

function parseDate(iso: string): Date { return new Date(iso + 'T00:00:00Z') }
function toIso(d: Date): string        { return d.toISOString().slice(0, 10) }
function addDays(iso: string, days: number): string {
  const d = parseDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toIso(d)
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}
function formatDate(iso: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}
function formatDDMM(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${String(parseInt(day)).padStart(2,'0')}.${String(parseInt(month)).padStart(2,'0')}`
}
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}
function isWeekend(iso: string): boolean {
  const d = parseDate(iso)
  const dow = d.getUTCDay()
  return dow === 0 || dow === 6
}
function isoWeekNumber(iso: string): number {
  const d = parseDate(iso)
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((thu.getTime() - yearStart.getTime()) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7)
}
function formatWeekRange(isoStart: string): string {
  const start = parseDate(isoStart)
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6))
  return `${start.getUTCDate()} - ${end.getUTCDate()} (${isoWeekNumber(isoStart)}w)`
}

// ─── Color helpers ──────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── Effort cell with lazy attachment fetch ────────────────────────────────────

function EffortCell({ projectId, estimation }: { projectId: string; estimation?: MigrationEffortEstimation }) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (loaded || !estimation?.attachmentIds?.length) return
    try {
      const list = await getAttachments(projectId)
      const ids = new Set(estimation.attachmentIds)
      setAttachments(list.filter(a => ids.has(a.id)))
    } catch { /* ignore */ }
    setLoaded(true)
  }, [loaded, projectId, estimation])

  const effortText = estimation?.effortEstimate
    ? estimation.effortEstimate.toLowerCase() === 'tbc'
      ? 'TBC'
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(estimation.effortEstimate))
    : '—'
  const hasTooltip = estimation && (estimation.notes || estimation.attachmentIds?.length)

  if (!hasTooltip) return <span>{effortText}</span>

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-2" onMouseEnter={load}>
          {effortText}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          {estimation.notes && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Notes</p>
              <p className="text-xs whitespace-pre-wrap">{estimation.notes}</p>
            </div>
          )}
          {attachments.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Attachments</p>
              <div className="flex flex-col gap-1">
                {attachments.map(att => (
                  <a
                    key={att.id}
                    href={`/api/v1/projects/${projectId}/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[200px]">{att.filename}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface ProjRowDragState {
  waveId: string
  projectId: string
  sourceIndex: number
  overIndex: number
}

interface Props {
  waves: Wave[]
  projects: Project[]
  onUpdatePlanning: (projectId: string, planning: ProjectPlanning) => Promise<void>
  onUpdateProjectOrder?: (waveId: string, projectIds: string[]) => Promise<void>
  onAssign?: (projectId: string, waveId: string | undefined) => void
}

export function WaveGanttChart({ waves, projects, onUpdatePlanning, onUpdateProjectOrder, onAssign }: Props) {
  const [showCompleted, setShowCompleted] = useState(true)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const ghostRef     = useRef<HTMLDivElement>(null)
  const projGhostRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<ZoomLevel>('weeks')

  const [collapsedWaves, setCollapsedWaves]       = useState<Set<string>>(new Set())
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [embargosCollapsed, setEmbargosCollapsed] = useState(false)

  const { embargos } = useEmbargos()

  const [dragState, setDragState]         = useState<DragState | null>(null)
  const [localPlanning, setLocalPlanning] = useState<Record<string, ProjectPlanning>>({})
  const [tooltip, setTooltip]             = useState<{ start: string; end: string } | null>(null)
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null)
  const [conn, setConn]                   = useState<ConnState | null>(null)
  const [hoveredArrow, setHoveredArrow]   = useState<{ fromId: string; toId: string } | null>(null)
  const [editingTaskId, setEditingTaskId]     = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [rowDragState, setRowDragState]         = useState<RowDragState | null>(null)
  const [projRowDragState, setProjRowDragState] = useState<ProjRowDragState | null>(null)

  const colPx      = ZOOM_COL_PX[zoom]
  const daysPerCol = ZOOM_DAYS_PER_COL[zoom]

  // ─── Timeline bounds ─────────────────────────────────────────────────────────

  const { timelineStart, timelineEnd, todayOffset } = useMemo(() => {
    const today      = toIso(new Date())
    const todayYear  = new Date().getUTCFullYear()
    const years = waves.flatMap(w => [
      parseInt(w.startDate.slice(0, 4)),
      parseInt(w.cutoverDate.slice(0, 4)),
    ])
    const minYear = years.length ? Math.min(...years) : todayYear
    const maxYear = years.length ? Math.max(...years) : todayYear
    const ts = parseDate(`${minYear - 1}-01-01`)
    const te = parseDate(`${maxYear + 1}-12-31`)
    return {
      timelineStart: ts,
      timelineEnd:   te,
      todayOffset:   daysBetween(ts, parseDate(today)) * (colPx / daysPerCol),
    }
  }, [waves, colPx, daysPerCol])

  const totalDays          = daysBetween(timelineStart, timelineEnd)
  const totalCols          = Math.ceil(totalDays / daysPerCol)
  const totalTimelineWidth = totalCols * colPx

  // ─── Auto-scroll to today ────────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      const vw = scrollRef.current.clientWidth - LEFT_PANEL_W
      scrollRef.current.scrollLeft = Math.max(0, LEFT_PANEL_W + todayOffset - vw / 2)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  // ─── Bar geometry ────────────────────────────────────────────────────────────

  function barLeft(isoDate: string): number {
    return daysBetween(timelineStart, parseDate(isoDate)) * (colPx / daysPerCol)
  }
  function barWidth(start: string, end: string): number {
    return Math.max(1, daysBetween(parseDate(start), parseDate(end))) * (colPx / daysPerCol)
  }

  // ─── Embargo helpers ─────────────────────────────────────────────────────────

  type EmbargoStatus = 'past' | 'active' | 'future'

  const EMBARGO_COLORS: Record<EmbargoStatus, string> = {
    future: '#F59E0B',
    active: '#EF4444',
    past:   '#9CA3AF',
  }

  function embargoStatus(startDate: string, endDate: string): EmbargoStatus {
    const today = new Date()
    if (today < parseDate(startDate)) return 'future'
    if (today > parseDate(endDate))   return 'past'
    return 'active'
  }

  function dateRangeProgress(startDate: string, endDate: string): number {
    const today = new Date()
    const start = parseDate(startDate)
    const end   = parseDate(endDate)
    if (today <= start) return 0
    if (today >= end)   return 100
    return Math.round(daysBetween(start, today) / daysBetween(start, end) * 100)
  }

  // ─── Effective dates ─────────────────────────────────────────────────────────

  function effectiveProjectDates(p: Project): { start: string; end: string; isDraft: boolean } | null {
    const local = localPlanning[p.id]
    if (local?.startDate && local?.endDate) return { start: local.startDate, end: local.endDate, isDraft: false }
    if (p.planning?.startDate && p.planning?.endDate) return { start: p.planning.startDate, end: p.planning.endDate, isDraft: false }
    const cs = p.migrationConstraints?.earliestStartDate
    const ce = p.migrationConstraints?.latestEndDate
    if (cs && ce) return { start: cs, end: ce, isDraft: true }
    if (p.waveId) {
      const wave = waveMap.get(p.waveId)
      if (wave?.startDate && wave?.cutoverDate) return { start: wave.startDate, end: wave.cutoverDate, isDraft: true }
    }
    return null
  }

  function effectiveTaskDates(projectId: string, task: PlanningTask): { start: string; end: string } {
    const t = (localPlanning[projectId]?.tasks ?? []).find(lt => lt.id === task.id)
    if (t) return { start: t.start, end: t.end }
    return { start: task.start, end: task.end }
  }

  function getEffectivePlanning(p: Project): ProjectPlanning {
    if (localPlanning[p.id]) return localPlanning[p.id]!
    if (p.planning) return p.planning
    const wave = p.waveId ? waveMap.get(p.waveId) : undefined
    const today = toIso(new Date())
    return { startDate: wave?.startDate ?? today, endDate: wave?.cutoverDate ?? addDays(today, 30), tasks: [] }
  }

  // ─── Client X → ISO date ─────────────────────────────────────────────────────

  function clientXToDate(clientX: number): string {
    const container = scrollRef.current
    if (!container) return toIso(new Date())
    const rect       = container.getBoundingClientRect()
    const xInTimeline = clientX - rect.left - LEFT_PANEL_W + container.scrollLeft
    const dayIndex    = Math.floor(xInTimeline / (colPx / daysPerCol))
    const clamped     = Math.max(0, Math.min(totalDays - 1, dayIndex))
    return toIso(new Date(timelineStart.getTime() + clamped * MS_PER_DAY))
  }

  // ─── Drag handlers ────────────────────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent, projectId: string, taskId: string | null, type: DragType, start: string, end: string) {
    e.preventDefault(); e.stopPropagation()
    setDragState({ projectId, taskId, type, startX: e.clientX, originalStart: start, originalEnd: end })
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'col-resize'
  }

  function onPointerDownCreate(e: React.PointerEvent, project: Project) {
    e.preventDefault(); e.stopPropagation()
    const clickDate = clientXToDate(e.clientX)
    const base = getEffectivePlanning(project)
    setLocalPlanning(prev => ({ ...prev, [project.id]: { ...base, startDate: clickDate, endDate: clickDate } }))
    setDragState({ projectId: project.id, taskId: null, type: 'create', startX: e.clientX, originalStart: clickDate, originalEnd: clickDate })
    document.body.style.cursor = 'crosshair'
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragState) return
    let newStart = dragState.originalStart
    let newEnd   = dragState.originalEnd

    if (dragState.type === 'create') {
      const curr = clientXToDate(e.clientX)
      if (curr >= dragState.originalStart) { newStart = dragState.originalStart; newEnd = curr }
      else                                  { newStart = curr; newEnd = dragState.originalStart }
    } else {
      const dx        = e.clientX - dragState.startX
      const deltaDays = Math.round(dx / (colPx / daysPerCol))
      if (deltaDays === 0) return
      if (dragState.type === 'move')              { newStart = addDays(dragState.originalStart, deltaDays); newEnd = addDays(dragState.originalEnd, deltaDays) }
      else if (dragState.type === 'resize-start') { newStart = addDays(dragState.originalStart, deltaDays); if (newStart >= dragState.originalEnd) return }
      else                                        { newEnd   = addDays(dragState.originalEnd, deltaDays);   if (newEnd <= dragState.originalStart) return }
    }

    setLocalPlanning(prev => {
      const { projectId, taskId } = dragState
      const base = prev[projectId] ?? projects.find(p => p.id === projectId)?.planning ?? { startDate: newStart, endDate: newEnd, tasks: [] }
      if (taskId === null) {
        if (dragState.type === 'move' && dragState.originalTasks) {
          const moveDelta = Math.round((e.clientX - dragState.startX) / (colPx / daysPerCol))
          const tasks = (base.tasks ?? []).map(t => {
            const orig = dragState.originalTasks!.find(ot => ot.id === t.id)
            if (!orig) return t
            return { ...t, start: addDays(orig.start, moveDelta), end: addDays(orig.end, moveDelta) }
          })
          return { ...prev, [projectId]: { ...base, startDate: newStart, endDate: newEnd, tasks } }
        }
        return { ...prev, [projectId]: { ...base, startDate: newStart, endDate: newEnd } }
      } else {
        const tasks = (base.tasks ?? []).map(t => t.id === taskId ? { ...t, start: newStart, end: newEnd } : t)
        return { ...prev, [projectId]: { ...base, tasks } }
      }
    })
    setTooltip({ start: newStart, end: newEnd })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState, colPx, daysPerCol, projects])

  const onPointerUp = useCallback(async () => {
    if (!dragState) return
    const local = localPlanning[dragState.projectId]
    document.body.style.cursor = ''
    setDragState(null)
    setTooltip(null)
    if (local) {
      try { await onUpdatePlanning(dragState.projectId, local) }
      catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[dragState.projectId]; return n }) }
    }
  }, [dragState, localPlanning, onUpdatePlanning])

  useEffect(() => {
    if (!dragState) return
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, onPointerMove, onPointerUp])

  // ─── Row drag (task reorder) ──────────────────────────────────────────────────

  const onRowPointerMove = useCallback((e: PointerEvent) => {
    if (!rowDragState) return
    if (ghostRef.current) {
      ghostRef.current.style.top = `${e.clientY - ROW_H / 2}px`
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-task-row-project]') as HTMLElement | null
    if (!el) return
    if (el.dataset.taskRowProject !== rowDragState.projectId) return
    const idx = parseInt(el.dataset.taskRowIndex ?? '0', 10)
    const rect = el.getBoundingClientRect()
    const overIndex = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1
    setRowDragState(prev => prev ? { ...prev, overIndex } : null)
  }, [rowDragState])

  const onRowPointerUp = useCallback(async () => {
    if (!rowDragState) return
    document.body.style.cursor = ''
    const { projectId, sourceIndex, overIndex } = rowDragState
    setRowDragState(null)
    if (overIndex === sourceIndex || overIndex === sourceIndex + 1) return
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base = getEffectivePlanning(project)
    const tasks = [...(base.tasks ?? [])]
    const [moved] = tasks.splice(sourceIndex, 1)
    if (!moved) return
    const insertAt = overIndex > sourceIndex ? overIndex - 1 : overIndex
    tasks.splice(insertAt, 0, moved)
    const updated = { ...base, tasks }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowDragState, projects, onUpdatePlanning])

  useEffect(() => {
    if (!rowDragState) return
    window.addEventListener('pointermove', onRowPointerMove)
    window.addEventListener('pointerup', onRowPointerUp)
    return () => {
      window.removeEventListener('pointermove', onRowPointerMove)
      window.removeEventListener('pointerup', onRowPointerUp)
    }
  }, [rowDragState, onRowPointerMove, onRowPointerUp])

  // ─── Connector drag ───────────────────────────────────────────────────────────

  function beginConn(barId: string, fromX: number, fromY: number, e: React.PointerEvent) {
    e.stopPropagation(); e.preventDefault()
    const container = scrollRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setConn({
      fromId: barId, fromX, fromY,
      mouseX: e.clientX - rect.left - LEFT_PANEL_W + container.scrollLeft,
      mouseY: e.clientY - rect.top  - HEADER_H     + container.scrollTop,
      overId: null,
    })
  }

  useEffect(() => {
    if (!conn) return
    const move = (e: PointerEvent) => {
      const container = scrollRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const mx   = e.clientX - rect.left - LEFT_PANEL_W + container.scrollLeft
      const my   = e.clientY - rect.top  - HEADER_H     + container.scrollTop
      const el   = document.elementFromPoint(e.clientX, e.clientY)
      const overId = el?.closest('[data-bar-id]')?.getAttribute('data-bar-id') ?? null
      setConn(c => c ? { ...c, mouseX: mx, mouseY: my, overId: overId !== c.fromId ? overId : null } : null)
    }
    const up = () => {
      if (conn.overId && conn.overId !== conn.fromId) void addDep(conn.fromId, conn.overId)
      setConn(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn])

  // ─── Close selection on outside click ────────────────────────────────────────

  useEffect(() => {
    if (!selectedBarId) return
    const handleClick = () => setSelectedBarId(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [selectedBarId])

  // ─── Task helpers ─────────────────────────────────────────────────────────────

  async function addTask(projectId: string, type: TaskType, label: string) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base  = getEffectivePlanning(project)
    const today = toIso(new Date())
    const projDates  = effectiveProjectDates(project)
    const rangeStart = projDates?.start ?? today
    const rangeEnd   = projDates?.end   ?? addDays(today, 30)
    const taskStart  = today < rangeStart ? rangeStart : today > rangeEnd ? rangeStart : today
    const taskEnd    = (() => { const e = addDays(taskStart, 7); return e > rangeEnd ? rangeEnd : e })()
    const task: PlanningTask = {
      id: crypto.randomUUID(), name: label, type,
      start: taskStart, end: taskEnd, status: 'todo', deps: [],
    }
    const updated: ProjectPlanning = { ...base, tasks: [...(base.tasks ?? []), task] }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  }

  async function deleteTask(projectId: string, taskId: string) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base = getEffectivePlanning(project)
    const updated: ProjectPlanning = {
      ...base,
      tasks: (base.tasks ?? [])
        .filter(t => t.id !== taskId)
        .map(t => ({ ...t, deps: t.deps.filter(d => d !== taskId) })),
    }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  }

  function isDAGSafe(fromId: string, toId: string): boolean {
    if (fromId === toId) return false
    const taskMap = new Map<string, PlanningTask>()
    for (const p of projects) {
      const tasks = (localPlanning[p.id] ?? p.planning)?.tasks ?? []
      for (const t of tasks) taskMap.set(t.id, t)
    }
    const visited = new Set<string>()
    const queue = [...(taskMap.get(fromId)?.deps ?? [])]
    while (queue.length) {
      const id = queue.shift()!
      if (id === toId) return false
      if (visited.has(id)) continue
      visited.add(id)
      queue.push(...(taskMap.get(id)?.deps ?? []))
    }
    return true
  }

  async function addDep(fromId: string, toId: string) {
    if (!isDAGSafe(fromId, toId)) return
    for (const p of projects) {
      const planning = localPlanning[p.id] ?? p.planning
      if (!planning?.tasks) continue
      const task = planning.tasks.find(t => t.id === toId)
      if (task && !task.deps.includes(fromId)) {
        const updated = { ...planning, tasks: planning.tasks.map(t => t.id === toId ? { ...t, deps: [...t.deps, fromId] } : t) }
        setLocalPlanning(prev => ({ ...prev, [p.id]: updated }))
        try { await onUpdatePlanning(p.id, updated) }
        catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[p.id]; return n }) }
        return
      }
    }
  }

  async function saveTaskName(projectId: string, taskId: string, name: string) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base = getEffectivePlanning(project)
    const updated: ProjectPlanning = {
      ...base,
      tasks: (base.tasks ?? []).map(t => t.id === taskId ? { ...t, name } : t),
    }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    setEditingTaskId(null)
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  }

  async function removeDep(fromId: string, toId: string) {
    for (const p of projects) {
      const planning = localPlanning[p.id] ?? p.planning
      if (!planning?.tasks) continue
      const task = planning.tasks.find(t => t.id === toId)
      if (task) {
        const updated = {
          ...planning,
          tasks: planning.tasks.map(t =>
            t.id === toId ? { ...t, deps: t.deps.filter(d => d !== fromId) } : t
          ),
        }
        setLocalPlanning(prev => ({ ...prev, [p.id]: updated }))
        try { await onUpdatePlanning(p.id, updated) }
        catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[p.id]; return n }) }
        return
      }
    }
  }

  // ─── Derived lists ───────────────────────────────────────────────────────────

  const waveMap = useMemo(() => new Map(waves.map(w => [w.id, w])), [waves])

  const sortedWaves = useMemo(() => {
    const filtered = showCompleted ? waves : waves.filter(w => w.status !== 'completed')
    return [...filtered].sort((a, b) => {
      const sc = a.startDate.localeCompare(b.startDate)
      return sc !== 0 ? sc : a.cutoverDate.localeCompare(b.cutoverDate)
    })
  }, [waves, showCompleted])

  const projectsByWave = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const w of waves) map.set(w.id, [])
    for (const p of projects) if (p.waveId && map.has(p.waveId)) map.get(p.waveId)!.push(p)
    for (const w of waves) {
      const projs = map.get(w.id) ?? []
      const order = w.projectOrder
      if (order?.length) {
        const idx = Object.fromEntries(order.map((id, i) => [id, i]))
        map.set(w.id, [...projs].sort((a, b) =>
          (idx[a.id] ?? Infinity) - (idx[b.id] ?? Infinity) || a.name.localeCompare(b.name)
        ))
      } else {
        map.set(w.id, [...projs].sort((a, b) => a.name.localeCompare(b.name)))
      }
    }
    return map
  }, [waves, projects])

  const unassignedProjects = useMemo(() =>
    [...projects].filter(p => !p.waveId).sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  )

  // ─── Project row drag (reorder within wave) ───────────────────────────────────

  const onProjRowPointerMove = useCallback((e: PointerEvent) => {
    if (!projRowDragState) return
    if (projGhostRef.current) {
      projGhostRef.current.style.top = `${e.clientY - ROW_H / 2}px`
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-proj-row-wave]') as HTMLElement | null
    if (!el) return
    if (el.dataset.projRowWave !== projRowDragState.waveId) return
    const idx = parseInt(el.dataset.projRowIndex ?? '0', 10)
    const rect = el.getBoundingClientRect()
    const overIndex = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1
    setProjRowDragState(prev => prev ? { ...prev, overIndex } : null)
  }, [projRowDragState])

  const onProjRowPointerUp = useCallback(async () => {
    if (!projRowDragState) return
    document.body.style.cursor = ''
    const { waveId, sourceIndex, overIndex } = projRowDragState
    setProjRowDragState(null)
    if (overIndex === sourceIndex || overIndex === sourceIndex + 1) return
    const waveProjects = [...(projectsByWave.get(waveId) ?? [])]
    const [moved] = waveProjects.splice(sourceIndex, 1)
    if (!moved) return
    const insertAt = overIndex > sourceIndex ? overIndex - 1 : overIndex
    waveProjects.splice(insertAt, 0, moved)
    const newOrder = waveProjects.map(p => p.id)
    try { await onUpdateProjectOrder?.(waveId, newOrder) } catch { /* handled by caller */ }
  }, [projRowDragState, projectsByWave, onUpdateProjectOrder])

  useEffect(() => {
    if (!projRowDragState) return
    window.addEventListener('pointermove', onProjRowPointerMove)
    window.addEventListener('pointerup', onProjRowPointerUp)
    return () => {
      window.removeEventListener('pointermove', onProjRowPointerMove)
      window.removeEventListener('pointerup', onProjRowPointerUp)
    }
  }, [projRowDragState, onProjRowPointerMove, onProjRowPointerUp])

  function toggleWave(id: string) {
    setCollapsedWaves(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleProject(id: string) {
    setCollapsedProjects(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function scrollToToday() {
    if (scrollRef.current) {
      const vw = scrollRef.current.clientWidth - LEFT_PANEL_W
      scrollRef.current.scrollLeft = Math.max(0, LEFT_PANEL_W + todayOffset - vw / 2)
    }
  }
  function scrollToBar(id: string) {
    if (!scrollRef.current) return
    const bar = scrollRef.current.querySelector(`[data-bar-id="${id}"]`) as HTMLElement | null
    if (!bar) return
    const containerRect = scrollRef.current.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    const barCenterX = barRect.left + barRect.width / 2 - containerRect.left + scrollRef.current.scrollLeft
    scrollRef.current.scrollLeft = barCenterX - scrollRef.current.clientWidth / 2
  }
  async function resetPlanning(p: Project) {
    setLocalPlanning(prev => { const n = { ...prev }; delete n[p.id]; return n })
    await onUpdatePlanning(p.id, { startDate: '', endDate: '', tasks: [] })
  }

  function findBestWave(p: Project): Wave | null {
    const pStart = p.planning?.startDate || p.migrationConstraints?.earliestStartDate
    const pEnd   = p.planning?.endDate   || p.migrationConstraints?.latestEndDate
    if (!pStart || !pEnd) return null
    const activeWaves = waves.filter(w => w.status !== 'completed')
    let best: Wave | null = null
    let maxOverlap = 0
    const ps = parseDate(pStart).getTime()
    const pe = parseDate(pEnd).getTime()
    for (const w of activeWaves) {
      const ws = parseDate(w.startDate).getTime()
      const we = parseDate(w.cutoverDate).getTime()
      const overlap = Math.max(0, Math.min(pe, we) - Math.max(ps, ws))
      if (overlap > maxOverlap) { maxOverlap = overlap; best = w }
      else if (overlap > 0 && overlap === maxOverlap && best && ws < parseDate(best.startDate).getTime()) { best = w }
    }
    return best
  }

  // ─── Column header labels ────────────────────────────────────────────────────

  const { monthLabels, subLabels, yearLabels, monthOnlyLabels } = useMemo(() => {
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const months: { key: string; label: string; widthPx: number }[] = []
    const cursor = new Date(timelineStart)
    while (cursor <= timelineEnd) {
      const y = cursor.getUTCFullYear()
      const m = cursor.getUTCMonth()
      const daysInM = daysInMonth(y, m)
      const widthPx = daysInM * (colPx / daysPerCol)
      months.push({ key: `${y}-${String(m+1).padStart(2,'0')}`, label: `${MONTH_NAMES[m]} ${y}`, widthPx })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }

    const yearMap = new Map<number, number>()
    for (const m of months) {
      const y = parseInt(m.key.slice(0, 4))
      yearMap.set(y, (yearMap.get(y) ?? 0) + m.widthPx)
    }
    const yearLabels = Array.from(yearMap.entries())
      .map(([y, widthPx]) => ({ key: String(y), label: String(y), widthPx }))

    const monthOnlyLabels = months.map(m => ({
      key: m.key,
      label: MONTH_NAMES[parseInt(m.key.slice(5, 7)) - 1],
      widthPx: m.widthPx,
    }))

    const sub: { key: string; label: string }[] = []
    let colIndex = 0
    const c2 = new Date(timelineStart)
    while (colIndex < totalCols) {
      sub.push({ key: toIso(c2), label: zoom === 'days' ? String(c2.getUTCDate()) : formatWeekRange(toIso(c2)) })
      c2.setUTCDate(c2.getUTCDate() + daysPerCol)
      colIndex++
    }

    return { monthLabels: months, subLabels: sub, yearLabels, monthOnlyLabels }
  }, [zoom, timelineStart, timelineEnd, totalCols, colPx, daysPerCol])

  // Weekend day keys for highlighting
  const weekendCols = useMemo(() => {
    if (zoom !== 'days') return []
    const result: number[] = []
    const d = new Date(timelineStart)
    for (let i = 0; i < totalCols; i++) {
      if (isWeekend(toIso(d))) result.push(i)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return result
  }, [zoom, timelineStart, totalCols])

  // ─── Flat row list ───────────────────────────────────────────────────────────

  type RowItem =
    | { type: 'embargo-header' }
    | { type: 'embargo';          embargo: EmbargoRecord }
    | { type: 'wave';             wave: Wave }
    | { type: 'project';          wave: Wave | null; project: Project; projectIndex: number; waveProjectIndex: number }
    | { type: 'task';             wave: Wave | null; project: Project; task: PlanningTask; projectIndex: number; taskIndex: number }
    | { type: 'unassigned-header' }

  function getTasksForProject(p: Project): PlanningTask[] {
    let tasks = (localPlanning[p.id] ?? p.planning)?.tasks ?? []
    if (rowDragState?.projectId === p.id && tasks.length > 0) {
      const arr = [...tasks]
      const [moved] = arr.splice(rowDragState.sourceIndex, 1)
      if (moved) {
        const insertAt = rowDragState.overIndex > rowDragState.sourceIndex
          ? rowDragState.overIndex - 1
          : rowDragState.overIndex
        arr.splice(Math.min(insertAt, arr.length), 0, moved)
        tasks = arr
      }
    }
    return tasks
  }

  const rows = useMemo<RowItem[]>(() => {
    const result: RowItem[] = []
    let projectCounter = 0

    if (embargos.length > 0) {
      result.push({ type: 'embargo-header' })
      if (!embargosCollapsed) {
        for (const e of embargos) {
          result.push({ type: 'embargo', embargo: e })
        }
      }
    }

    for (const wave of sortedWaves) {
      result.push({ type: 'wave', wave })
      if (!collapsedWaves.has(wave.id)) {
        let waveProjects = projectsByWave.get(wave.id) ?? []
        if (projRowDragState?.waveId === wave.id && waveProjects.length > 0) {
          const arr = [...waveProjects]
          const [moved] = arr.splice(projRowDragState.sourceIndex, 1)
          if (moved) {
            const insertAt = projRowDragState.overIndex > projRowDragState.sourceIndex
              ? projRowDragState.overIndex - 1
              : projRowDragState.overIndex
            arr.splice(Math.min(insertAt, arr.length), 0, moved)
            waveProjects = arr
          }
        }
        for (const [wpi, p] of waveProjects.entries()) {
          projectCounter++
          const projectIndex = projectCounter
          result.push({ type: 'project', wave, project: p, projectIndex, waveProjectIndex: wpi })
          if (!collapsedProjects.has(p.id)) {
            getTasksForProject(p).forEach((task, ti) => {
              result.push({ type: 'task', wave, project: p, task, projectIndex, taskIndex: ti + 1 })
            })
          }
        }
      }
    }

    if (unassignedProjects.length > 0) {
      result.push({ type: 'unassigned-header' })
      if (!collapsedWaves.has('__unassigned__')) {
        for (const [wpi, p] of unassignedProjects.entries()) {
          projectCounter++
          const projectIndex = projectCounter
          result.push({ type: 'project', wave: null, project: p, projectIndex, waveProjectIndex: wpi })
          if (!collapsedProjects.has(p.id)) {
            getTasksForProject(p).forEach((task, ti) => {
              result.push({ type: 'task', wave: null, project: p, task, projectIndex, taskIndex: ti + 1 })
            })
          }
        }
      }
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedWaves, collapsedWaves, collapsedProjects, projectsByWave, unassignedProjects, localPlanning, rowDragState, projRowDragState, embargos, embargosCollapsed])

  // ─── Row height helpers ──────────────────────────────────────────────────────

  function rowHeight(row: RowItem): number {
    return (row.type === 'wave' || row.type === 'embargo-header') ? GROUP_H : ROW_H
  }

  // Cumulative row tops for SVG overlay
  const rowTops = useMemo(() => {
    const tops: number[] = []
    let acc = 0
    for (const r of rows) { tops.push(acc); acc += rowHeight(r) }
    return tops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const totalBodyH = rowTops.length ? rowTops[rowTops.length - 1] + rowHeight(rows[rows.length - 1]) : 0

  // ─── Dep arrow data ──────────────────────────────────────────────────────────

  const depArrows = useMemo(() => {
    const arrows: { sx: number; sy: number; tx: number; ty: number; color: string; fromId: string; toId: string }[] = []
    rows.forEach((row, ri) => {
      if (row.type !== 'task') return
      const { project, task, wave } = row
      if (!task.deps?.length) return
      const { start: ts, end: te } = effectiveTaskDates(project.id, task)
      if (!ts || !te) return
      const tx = barLeft(ts)
      const ty = rowTops[ri] + ROW_H / 2

      for (const depId of task.deps) {
        const srcIdx = rows.findIndex(r => r.type === 'task' && r.task.id === depId)
        if (srcIdx < 0) continue
        const srcRow = rows[srcIdx]
        if (srcRow.type !== 'task') continue
        const { start: ss, end: se } = effectiveTaskDates(srcRow.project.id, srcRow.task)
        if (!ss || !se) continue
        const sx = barLeft(ss) + barWidth(ss, se)
        const sy = rowTops[srcIdx] + ROW_H / 2
        arrows.push({ sx, sy, tx, ty, color: wave?.color ?? DEFAULT_WAVE_COLOR, fromId: depId, toId: task.id })
      }
    })
    return arrows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowTops, colPx, daysPerCol])

  // ─── Left panel column grid ───────────────────────────────────────────────────
  const LP_GRID = '40px minmax(160px,1fr) 100px 80px 80px 32px'

  const cellClass = 'h-full flex items-center px-2 border-r min-w-0'

  const totalContentWidth = LEFT_PANEL_W + totalTimelineWidth

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full overflow-hidden antialiased bg-[var(--g-bg)] text-[var(--g-text)] text-[13px]"
      style={{
        '--g-bg':           '#fcfcfa',
        '--g-bg-alt':       '#f6f5f1',
        '--g-bg-sunken':    '#f1efe9',
        '--g-border':       '#e7e4dc',
        '--g-border-strong':'#d6d2c7',
        // '--g-text':         '#1d1c1a',
        '--g-text-muted':   '#6b6a64',
        '--g-text-subtle':  '#9a998f',
        '--g-accent':       'oklch(0.55 0.15 260)',
        '--g-accent-soft':  'oklch(0.96 0.02 260)',
        '--g-today':        'oklch(0.62 0.18 20)',
        '--g-weekend':      '#faf8f2',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      } as React.CSSProperties}
    >

      {/* Controls bar */}
      <div className="bg-background shrink-0 flex items-center gap-2 px-3 h-11 border-b">
        {/* Zoom buttons */}
        <ToggleGroup
          type="single"
          value={zoom}
          onValueChange={(v) => v && setZoom(v as ZoomLevel)}
          variant="outline"
          size="sm"
        >
          {(['days', 'weeks', 'months'] as ZoomLevel[]).map(z => (
            <ToggleGroupItem key={z} value={z} className="capitalize text-[12px]">
              {z}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          onClick={scrollToToday}
          className="text-xs"
        >
          Today
        </Button>
        <div className="flex items-center gap-1.5">
          <Switch
            id="gantt-show-completed"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
            className="scale-75 origin-left"
          />
          <Label htmlFor="gantt-show-completed" className="text-[12px] text-[var(--g-text-muted)] cursor-pointer whitespace-nowrap">
            Show completed waves
          </Label>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => { setCollapsedWaves(new Set()); setCollapsedProjects(new Set()) }}
          className="text-[12px] text-[var(--g-text-muted)] bg-transparent border-none cursor-pointer"
        >
          Expand all
        </button>
        <span className="text-[var(--g-text-subtle)] text-[12px]">·</span>
        <button
          onClick={() => {
            setCollapsedWaves(new Set(waves.map(w => w.id).concat(['__unassigned__'])))
            setCollapsedProjects(new Set(projects.map(p => p.id)))
          }}
          className="text-[12px] text-[var(--g-text-muted)] bg-transparent border-none cursor-pointer"
        >
          Collapse all
        </button>
      </div>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-background"
      >
        <div className="relative" style={{ width: totalContentWidth, minWidth: totalContentWidth }}>

          {/* Sticky header */}
          <div className="sticky top-0 z-30 flex h-[40px]">
            {/* Left panel header */}
            <div
              className="border-b sticky left-0 z-20 grid shrink-0 h-[40px] w-[680px] bg-background border-r "
              style={{ gridTemplateColumns: LP_GRID }}
            >
              {['', 'Project / Tasks', 'Status', 'Labels', 'Effort', ''].map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    cellClass,
                    'text-[11.5px] font-semibold text-[var(--g-text-muted)] uppercase tracking-[0.02em] ',
                    (i === 2 || i === 3 || i === 4) && 'justify-center',
                    i === 5 && 'border-r-0',
                  )}
                >
                  {col}
                </div>
              ))}
            </div>

            {/* Timeline header */}
            <div
              className="border-b relative flex flex-col"
              style={{ width: totalTimelineWidth }}
            >
              {/* Top row: year (months mode) or month+year (days/weeks mode) */}
              <div className="flex items-end pb-0.5 h-[18px] border-b bg-background">
                {(zoom === 'months' ? yearLabels : monthLabels).map(col => (
                  <div
                    key={col.key}
                    className="shrink-0 text-[10.5px] font-semibold text-[var(--g-text-muted)] uppercase tracking-[0.03em] px-2 overflow-hidden whitespace-nowrap border-l"
                    style={{ width: col.widthPx }}
                  >
                    {col.label}
                  </div>
                ))}
                {/* Today flag */}
                <div
                  className="absolute top-0.5 flex flex-col items-center pointer-events-none"
                  style={{ left: todayOffset }}
                >
                  <span className="bg-[var(--g-today)] text-white text-[9px] font-bold py-px px-1.5 rounded-[4px] whitespace-nowrap uppercase tracking-[0.03em]">
                    Today
                  </span>
                </div>
              </div>
              {/* Bottom row: always rendered */}
              <div className="flex items-center h-[22px] relative bg-card">
                {zoom === 'months' ? monthOnlyLabels.map(col => (
                  <div
                    key={col.key}
                    className="shrink-0 border-r overflow-hidden whitespace-nowrap text-center px-0.5 text-[11px] text-[var(--g-text-muted)] font-normal"
                    style={{ width: col.widthPx }}
                  >
                    {col.label}
                  </div>
                )) : subLabels.map((col, i) => {
                  const todayIso = toIso(new Date())
                  const isCurrentPeriod = zoom === 'weeks'
                    ? col.key <= todayIso && todayIso <= addDays(col.key, 6)
                    : col.key === todayIso
                  return (
                    <div
                      key={col.key}
                      className={cn(
                        'shrink-0 border-r overflow-hidden whitespace-nowrap text-center px-0.5 text-[11px]',
                        isCurrentPeriod ? 'text-[var(--g-today)] font-bold' : 'text-[var(--g-text-muted)] font-normal',
                        zoom === 'days' && weekendCols.includes(i) && 'bg-muted/25',
                      )}
                      style={{ width: colPx }}
                    >
                      {col.label}
                    </div>
                  )
                })}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[var(--g-today)] pointer-events-none"
                  style={{ left: todayOffset }}
                />
              </div>
            </div>
          </div>

          {/* Content rows */}
          {rows.map((row, rowIdx) => {
            const rowKey =
              row.type === 'embargo-header'      ? '__embargos__'
              : row.type === 'embargo'           ? `embargo-${row.embargo.id}`
              : row.type === 'wave'              ? row.wave.id
              : row.type === 'unassigned-header' ? '__unassigned__'
              : row.type === 'task'              ? `task-${row.task.id}`
              : row.project.id

            const rh = rowHeight(row)

            // ── Embargo header row ────────────────────────────────────────────
            if (row.type === 'embargo-header') {
              const headerAccent = EMBARGO_COLORS.active
              return (
                <div key={rowKey} className="flex border-b" style={{ height: rh }}>
                  <div
                    className="sticky left-0 z-10 grid shrink-0 w-[680px] border-r cursor-pointer bg-background"
                    style={{ gridTemplateColumns: LP_GRID }}
                    onClick={() => setEmbargosCollapsed(c => !c)}
                  >
                    <div className={cn(cellClass, 'justify-end')}>
                      <Lock size={14} style={{ color: headerAccent }} className="shrink-0" />
                    </div>
                    <div className={cn(cellClass, 'justify-between')}>
                      <div className="flex items-center gap-1 font-semibold text-[13px]">
                        {embargosCollapsed
                          ? <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--g-text-muted)]" />
                          : <ChevronDown  className="w-3.5 h-3.5 shrink-0 text-[var(--g-text-muted)]" />
                        }
                        <span>Embargos</span>
                      </div>
                      <span className="text-xs text-[var(--g-text-muted)]">{embargos.length}</span>
                    </div>
                    <div className={cn(cellClass, 'justify-center')} />
                    <div className={cn(cellClass, 'justify-center')} />
                    <div className={cn(cellClass, 'justify-center')} />
                    <div className={cn(cellClass, 'border-r-0')} />
                  </div>
                  <div
                    className="relative bg-background"
                    style={{ width: totalTimelineWidth }}
                  >
                    <div
                      className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                      style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }}
                    />
                  </div>
                </div>
              )
            }

            // ── Embargo row ───────────────────────────────────────────────────
            if (row.type === 'embargo') {
              const { embargo } = row
              const status       = embargoStatus(embargo.startDate, embargo.endDate)
              const barColor     = EMBARGO_COLORS[status]
              const softColor    = hexToRgba(barColor, 0.2)
              const progress     = dateRangeProgress(embargo.startDate, embargo.endDate)
              const isPast       = status === 'past'
              const visibleLines = embargo.affectedServiceLines.slice(0, 2)
              const extraCount   = embargo.affectedServiceLines.length - visibleLines.length

              return (
                <div key={rowKey} className="flex border-b" style={{ height: rh }}>
                  <div
                    className="sticky left-0 z-10 grid shrink-0 w-[680px] bg-card border-r cursor-pointer"
                    style={{ gridTemplateColumns: LP_GRID }}
                    onClick={() => scrollToBar(embargo.id)}
                  >
                    <div className={cellClass} />
                    <div className={cn(cellClass, 'gap-1.5 overflow-hidden')}>
                      <span
                        className={cn('text-[13px] truncate min-w-0', isPast && 'line-through text-[var(--g-text-subtle)]')}
                      >
                        {embargo.name}
                      </span>
                      {visibleLines.map(sl => (
                        <span
                          key={sl}
                          className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: hexToRgba(barColor, 0.12),
                            color: isPast ? 'var(--g-text-subtle)' : barColor,
                          }}
                        >
                          {sl}
                        </span>
                      ))}
                      {extraCount > 0 && (
                        <span className="shrink-0 text-[10px] text-[var(--g-text-muted)]">+{extraCount}</span>
                      )}
                    </div>
                    <div className={cn(cellClass, 'justify-center')} />
                    <div className={cn(cellClass, 'justify-center')} />
                    <div className={cn(cellClass, 'border-r-0')} />
                  </div>
                  <div className="relative flex items-center bg-card" style={{ width: totalTimelineWidth }}>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                      style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }}
                    />
                    <div
                      className="absolute top-1 inline-flex items-baseline pointer-events-none whitespace-nowrap z-[2]"
                      style={{ left: barLeft(embargo.startDate) }}
                    >
                      <span
                        className="text-[11px] font-medium"
                        style={{
                          color: isPast ? 'var(--g-text-subtle)' : barColor,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}
                      >
                        {formatDDMM(embargo.startDate)} – {formatDDMM(embargo.endDate)}
                      </span>
                    </div>
                    <div
                      data-bar-id={embargo.id}
                      className="absolute flex z-[1] overflow-hidden rounded-[2px]"
                      style={{
                        left:   barLeft(embargo.startDate),
                        width:  Math.max(8, barWidth(embargo.startDate, embargo.endDate)),
                        height: 9,
                        bottom: 5,
                      }}
                    >
                      <div className="h-full" style={{ width: `${progress}%`, background: barColor }} />
                      <div className="flex-1 h-full" style={{ background: softColor }} />
                    </div>
                  </div>
                </div>
              )
            }

            // ── Wave row ───────────────────────────────────────────────────────
            if (row.type === 'wave') {
              const w = row.wave
              const waveColor  = w.color ?? DEFAULT_WAVE_COLOR
              const softColor  = hexToRgba(waveColor, 0.25)
              const isExpanded = !collapsedWaves.has(w.id)
              const progress   = dateRangeProgress(w.startDate, w.cutoverDate)
              const projCount  = projectsByWave.get(w.id)?.length ?? 0

              return (
                <div key={rowKey} className="flex border-b" style={{ height: rh }}>
                  {/* Left cell */}
                  <div
                    className="sticky left-0 z-10 grid shrink-0 w-[680px] bg-muted cursor-pointer border-r"
                    style={{ gridTemplateColumns: LP_GRID }}
                    onClick={() => toggleWave(w.id)}
                  >
                    {/* # col */}
                    <div className={cn(cellClass, 'justify-end ')}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: waveColor }} />
                    </div>
                    {/* Name col */}
                    <div className={cn(cellClass, 'justify-between')}>
                      <div className="flex items-center gap-1 font-semibold text-[13px]">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--g-text-muted)]" />
                          : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--g-text-muted)]" />
                        }
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{w.name}</span>
                      </div>
                      <span className="text-xs">{projCount}</span>
                    </div>
                    {/* Status col */}
                    <div className={cn(cellClass, 'justify-center')}>
                      {WAVE_STATUS_META[w.status] && (
                        <span
                          className="py-0.5 px-[7px] rounded-full text-[11px] font-medium whitespace-nowrap border border-transparent"
                          style={{ background: WAVE_STATUS_META[w.status].bg, color: WAVE_STATUS_META[w.status].color }}
                        >
                          {w.status}
                        </span>
                      )}
                    </div>
                    {/* Labels col */}
                    <div className={cn(cellClass, 'justify-center')}>
                      {w.jiraEpicKey && (
                        w.jiraBaseUrl
                          ? <a
                              href={`${w.jiraBaseUrl}/browse/${w.jiraEpicKey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded hover:underline inline-flex items-center no-underline overflow-hidden text-ellipsis whitespace-nowrap max-w-full"
                            >
                              {w.jiraEpicKey}
                            </a>
                          : <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded overflow-hidden text-ellipsis whitespace-nowrap max-w-full">
                              {w.jiraEpicKey}
                            </code>
                      )}
                    </div>
                    {/* Action col */}
                    <div className={cn(cellClass, 'border-r-0')} />
                  </div>

                  {/* Bar cell */}
                  <div className="relative flex items-center bg-muted" style={{ width: totalTimelineWidth }}>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                      style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }}
                    />

                    {/* Group title: name + date range */}
                    <div
                      className="absolute top-1 inline-flex items-baseline gap-2 text-[12.5px] font-semibold pointer-events-none whitespace-nowrap z-[2]"
                      style={{ left: barLeft(w.startDate), color: waveColor }}
                    >
                      <span>{w.name}</span>
                      <span
                        className="text-[11px] font-medium text-[var(--g-text-muted)]"
                        style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                      >
                        {formatDDMM(w.startDate)} – {formatDDMM(w.cutoverDate)}
                      </span>
                    </div>

                    {/* Group bar (thin two-tone strip at bottom) */}
                    <div
                      className="absolute flex z-[1] overflow-hidden rounded-[2px]"
                      style={{
                        left: barLeft(w.startDate),
                        width: Math.max(8, barWidth(w.startDate, w.cutoverDate)),
                        height: 9,
                        bottom: 5,
                      }}
                    >
                      <div className="h-full" style={{ width: `${progress}%`, background: waveColor }} />
                      <div className="flex-1 h-full" style={{ background: softColor }} />
                    </div>
                  </div>
                </div>
              )
            }

            // ── Unassigned header row ──────────────────────────────────────────
            if (row.type === 'unassigned-header') {
              const isExpanded = !collapsedWaves.has('__unassigned__')
              return (
                <div key={rowKey} className="flex border-b bg-muted" style={{ height: rh }}>
                  {/* Left cell */}
                  <div
                    className="sticky left-0 z-10 grid shrink-0 w-[680px] bg-muted cursor-pointer border-r"
                    style={{ gridTemplateColumns: LP_GRID }}
                    onClick={() => toggleWave('__unassigned__')}
                  >
                    {/* # col */}
                    <div className={cn(cellClass, 'justify-end text-[var(--g-text-subtle)] text-[12px]')} />
                    {/* Name col */}
                    <div className={cn(cellClass, 'justify-between')}>
                      <div className="flex items-center gap-1 font-semibold text-[13px]">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--g-text-muted)]" />
                          : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--g-text-muted)]" />
                        }
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">Unassigned</span>
                      </div>
                      <span className="text-xs">
                        {unassignedProjects.length}
                      </span>
                    </div>
                    {/* Status col (wave: empty) */}
                    <div className={cn(cellClass, 'justify-center')} />
                    {/* Labels col */}
                    <div className={cn(cellClass, 'justify-center text-[11px] text-[var(--g-text-subtle)]')} />
                    {/* Effort col */}
                    <div className={cn(cellClass, 'justify-center')} />
                    {/* Action col */}
                    <div className={cn(cellClass, 'border-r-0')} />
                  </div>
                  <div className="relative" style={{ width: totalTimelineWidth }}>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                      style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }}
                    />
                  </div>
                </div>
              )
            }

            // ── Task row ───────────────────────────────────────────────────────
            if (row.type === 'task') {
              const { project, task, wave, projectIndex, taskIndex } = row
              const waveColor  = wave?.color ?? DEFAULT_WAVE_COLOR
              const softColor  = hexToRgba(waveColor, 0.25)
              const { start, end } = effectiveTaskDates(project.id, task)
              const progress   = TASK_STATUS_PROGRESS[task.status] ?? 0
              const isDragging = dragState?.projectId === project.id && dragState?.taskId === task.id
              const isSelected = selectedBarId === task.id
              const isConnTarget = conn?.overId === task.id
              const taskMeta      = TASK_TYPE_META[task.type]
              const taskIdx0      = taskIndex - 1
              const isDraggedTask = rowDragState?.taskId === task.id

              return (
                <div
                  key={rowKey}
                  className="flex border-b"
                  style={{
                    height: rh,
                    opacity: isDraggedTask ? 0.3 : 1,
                    background: isDraggedTask ? 'var(--g-accent-soft)' : undefined,
                  }}
                  data-task-row-project={project.id}
                  data-task-row-index={taskIdx0}
                >
                  {/* Left panel */}
                  <div
                    className={cn(
                      'sticky left-0 z-10 grid shrink-0 w-[680px] border-r',
                      isSelected ? 'bg-[var(--g-accent-soft)]' : 'bg-card',
                    )}
                    style={{ gridTemplateColumns: LP_GRID }}
                  >
                    {/* # col */}
                    <div
                      className={cn(cellClass, 'justify-end text-[12px] text-[var(--g-text-subtle)]')}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {projectIndex}.{taskIndex}
                    </div>
                    {/* Name col */}
                    <div className={cn(cellClass, 'pl-6 group/taskname gap-[5px] text-[13px] text-[var(--g-text)]')}>
                      <GripVertical
                        className="w-[13px] h-[13px] shrink-0 text-[var(--g-text-subtle)] cursor-grab"
                        onPointerDown={e => {
                          e.preventDefault(); e.stopPropagation()
                          setRowDragState({ projectId: project.id, taskId: task.id, sourceIndex: taskIdx0, overIndex: taskIdx0 })
                          document.body.style.cursor = 'grabbing'
                        }}
                      />
                      {editingTaskId === task.id ? (
                        <input
                          autoFocus
                          className="flex-1 min-w-0 bg-transparent border-b border-[var(--g-accent)] outline-none text-[13px] text-[var(--g-text)]"
                          value={editingTaskName}
                          onChange={e => setEditingTaskName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveTaskName(project.id, task.id, editingTaskName)
                            if (e.key === 'Escape') setEditingTaskId(null)
                          }}
                          onBlur={() => setEditingTaskId(null)}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span
                            className="overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer flex-1 min-w-0"
                            onClick={() => scrollToBar(task.id)}
                          >
                            {task.name}
                          </span>
                          <button
                            className="opacity-0 group-hover/taskname:opacity-100 shrink-0 bg-transparent border-none cursor-pointer text-[var(--g-text-subtle)] p-0.5 rounded-[4px] flex items-center transition-[opacity] duration-[100ms]"
                            onClick={e => {
                              e.stopPropagation()
                              setEditingTaskId(task.id)
                              setEditingTaskName(task.name)
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                    {/* Status col — removed */}
                    <div className={cn(cellClass, 'justify-center')} />
                    {/* Labels col */}
                    <div className={cn(cellClass, 'justify-center')}>
                      {taskMeta && (
                        <span
                          className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center shrink-0"
                          style={{ background: taskMeta.bg, color: taskMeta.color }}
                        >
                          <taskMeta.icon size={13} />
                        </span>
                      )}
                    </div>
                    {/* Effort col (task: empty) */}
                    <div className={cn(cellClass, 'justify-center')} />
                    {/* Action col */}
                    <div className={cn(cellClass, 'border-r-0 justify-center relative')}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="bg-transparent border-none cursor-pointer text-[var(--g-text-subtle)] p-0.5 rounded-[4px] flex items-center hover:text-[var(--g-text)]">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[160px]">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => void deleteTask(project.id, task.id)}
                          >
                            <Trash2 className="w-[13px] h-[13px]" />
                            Remove task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Bar cell */}
                  <div
                    className={cn('relative flex items-center bg-card', isSelected && 'bg-[var(--g-accent-soft)]')}
                    style={{ width: totalTimelineWidth }}
                    onClick={() => { setSelectedBarId(task.id); }}
                  >
                    {zoom === 'days' && weekendCols.map(ci => (
                      <div
                        key={ci}
                        className="absolute top-0 bottom-0 bg-muted/25 pointer-events-none z-0"
                        style={{ left: ci * colPx, width: colPx }}
                      />
                    ))}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                      style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }}
                    />

                    {start && end ? (
                      <div
                        data-bar-id={task.id}
                        className="group absolute top-1/2 -translate-y-1/2 cursor-grab select-none z-[1] rounded-[3px]"
                        style={{
                          left: barLeft(start),
                          width: Math.max(8, barWidth(start, end)),
                          height: 22,
                          background: taskMeta?.bg ?? softColor,
                          boxShadow: isConnTarget
                            ? '0 0 0 2px var(--g-bg), 0 0 0 4px var(--g-accent)'
                            : isSelected
                              ? '0 0 0 2px var(--g-bg), 0 0 0 3.5px var(--g-accent)'
                              : isDragging
                                ? '0 2px 8px rgba(0,0,0,0.2)'
                                : undefined,
                          opacity: isDragging ? 0.9 : 1,
                        }}
                        onPointerDown={e => { onPointerDown(e, project.id, task.id, 'move', start, end); setSelectedBarId(task.id) }}
                      >
                        {/* Progress fill */}
                        <div
                          className="absolute left-0 top-0 bottom-0 pointer-events-none"
                          style={{ width: `${progress}%`, background: taskMeta?.color ?? waveColor, borderRadius: '3px 0 0 3px' }}
                        />
                        {/* Resize handles */}
                        <div
                          className={cn(
                            'absolute left-0 top-0 bottom-0 w-[5px] cursor-ew-resize z-[2] rounded-tl-[3px] rounded-bl-[3px]',
                            isSelected ? 'bg-[rgba(0,0,0,0.18)]' : 'bg-transparent',
                          )}
                          onPointerDown={e => onPointerDown(e, project.id, task.id, 'resize-start', start, end)}
                        />
                        <div
                          className={cn(
                            'absolute right-0 top-0 bottom-0 w-[5px] cursor-ew-resize z-[2] rounded-tr-[3px] rounded-br-[3px]',
                            isSelected ? 'bg-[rgba(0,0,0,0.18)]' : 'bg-transparent',
                          )}
                          onPointerDown={e => onPointerDown(e, project.id, task.id, 'resize-end', start, end)}
                        />
                        {/* Connector dot (right = outward only) */}
                        <div
                          className={cn(
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                            'absolute cursor-crosshair z-[3] transition-[opacity] duration-[120ms] rounded-full',
                            'bg-[var(--g-bg)] border-2 border-[var(--g-accent)] w-[10px] h-[10px] top-1/2 -translate-y-1/2',
                          )}
                          style={{ left: 'calc(100% + 2px)' }}
                          onPointerDown={e => beginConn(task.id, barLeft(start) + barWidth(start, end), rowTops[rowIdx] + ROW_H / 2, e)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            }

            // ── Project row ────────────────────────────────────────────────────
            const p            = row.project
            const wave         = row.wave
            const waveColor    = wave?.color ?? DEFAULT_WAVE_COLOR
            const softColor    = hexToRgba(waveColor, 0.25)
            const isExpanded   = !collapsedProjects.has(p.id)
            const projectDates = effectiveProjectDates(p)
            const isDraft      = projectDates?.isDraft ?? false
            const isDragging      = dragState?.projectId === p.id && dragState?.taskId === null
            const isProjDragging  = projRowDragState?.projectId === p.id
            const isSelected      = selectedBarId === p.id
            const labelText       = p.jiraStoryKey ?? p.jiraTicket ?? null
            const statusMeta      = PROJECT_STATUS_META[p.status]
            const pct             = p.progress ?? 0

            return (
              <div key={rowKey} className="flex border-b" style={{ height: rh, opacity: isProjDragging ? 0.3 : 1 }}>
                {/* Left panel */}
                <div
                  className={cn(
                    'group/row sticky left-0 z-10 grid shrink-0 w-[680px] border-r cursor-pointer',
                    isSelected ? 'bg-[var(--g-accent-soft)]' : 'bg-background',
                    isProjDragging ? 'bg-[var(--g-accent-soft)]' : '',
                  )}
                  style={{ gridTemplateColumns: LP_GRID }}
                  onClick={() => scrollToBar(p.id)}
                  data-proj-row-wave={wave?.id ?? ''}
                  data-proj-row-index={row.waveProjectIndex}
                >
                  {/* # col */}
                  <div
                    className={cn(cellClass, 'justify-end text-[12px] text-[var(--g-text-subtle)] font-semibold')}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {row.projectIndex}
                  </div>
                  {/* Name col */}
                  <div className={cn(cellClass, 'gap-[5px] text-[13px]')}>
                    {wave && (
                      <GripVertical
                        className="w-[13px] h-[13px] shrink-0 opacity-0 group-hover/row:opacity-100 text-[var(--g-text-subtle)] cursor-grab"
                        onPointerDown={e => {
                          e.preventDefault(); e.stopPropagation()
                          setProjRowDragState({ waveId: wave.id, projectId: p.id, sourceIndex: row.waveProjectIndex, overIndex: row.waveProjectIndex })
                          document.body.style.cursor = 'grabbing'
                        }}
                      />
                    )}
                    <span
                      className="cursor-pointer shrink-0 flex items-center"
                      onClick={e => { e.stopPropagation(); toggleProject(p.id) }}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-[13px] h-[13px] text-[var(--g-text-muted)]" />
                        : <ChevronRight className="w-[13px] h-[13px] text-[var(--g-text-muted)]" />
                      }
                    </span>
                    <span
                      className="overflow-hidden text-ellipsis whitespace-nowrap text-[var(--g-text)] cursor-pointer"
                      onClick={() => scrollToBar(p.id)}
                    >
                      {p.name}
                    </span>
                  </div>
                  {/* Status col */}
                  <div className={cn(cellClass, 'justify-center')}>
                    {statusMeta && (
                      p.status === 'blocked' && p.blockedReason ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="py-0.5 px-[7px] rounded-full text-[11px] font-medium whitespace-nowrap border border-transparent cursor-help"
                              style={{ background: statusMeta.bg, color: statusMeta.color }}
                            >
                              {p.status}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            <p className="font-semibold mb-0.5">Blocked reason</p>
                            <p className="whitespace-pre-wrap">{p.blockedReason}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span
                          className="py-0.5 px-[7px] rounded-full text-[11px] font-medium whitespace-nowrap border border-transparent"
                          style={{ background: statusMeta.bg, color: statusMeta.color }}
                        >
                          {p.status}
                        </span>
                      )
                    )}
                  </div>
                  {/* Labels col */}
                  <div className={cn(cellClass, 'justify-center')}>
                    {labelText && (
                      p.jiraBaseUrl
                        ? <a
                            href={`${p.jiraBaseUrl}/browse/${labelText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded hover:underline inline-flex items-center no-underline overflow-hidden text-ellipsis whitespace-nowrap max-w-full"
                          >
                            {labelText}
                          </a>
                        : <span
                            className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded overflow-hidden text-ellipsis whitespace-nowrap max-w-full inline-block"
                          >
                            {labelText}
                          </span>
                    )}
                  </div>
                  {/* Effort col */}
                  <div className={cn(cellClass, 'justify-center text-[11px] text-[var(--g-text-subtle)] font-medium')}>
                    <EffortCell projectId={p.id} estimation={p.migrationEffortEstimation} />
                  </div>
                  {/* Action col */}
                  <div className={cn(cellClass, 'border-r-0 justify-center relative')}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="bg-transparent border-none cursor-pointer text-[var(--g-text-subtle)] p-0.5 rounded-[4px] flex items-center hover:text-[var(--g-text)]">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[200px]">
                        {!!p.waveId && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Plus className="w-[13px] h-[13px] text-[var(--g-text-muted)]" />
                              Add task
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                {TASK_PRESETS.map(preset => (
                                  <DropdownMenuItem key={preset.type} onClick={() => void addTask(p.id, preset.type, preset.label)}>
                                    <preset.icon size={14} />
                                    {preset.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                        )}
                        {!!p.waveId && onAssign && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onAssign(p.id, undefined)}
                            >
                              <Unlink className="w-[13px] h-[13px]" />
                              Remove from wave
                            </DropdownMenuItem>
                          </>
                        )}
                        {!p.waveId && onAssign && (() => {
                          const bestWave = findBestWave(p)
                          const assignableWaves = waves
                            .filter(w => w.status !== 'completed')
                            .sort((a, b) => a.startDate.localeCompare(b.startDate))
                          const orderedWaves = bestWave
                            ? [bestWave, ...assignableWaves.filter(w => w.id !== bestWave.id)]
                            : assignableWaves
                          return (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <ArrowRight className="w-[13px] h-[13px] text-[var(--g-text-muted)]" />
                                Assign to
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  {orderedWaves.map(w => (
                                    <DropdownMenuItem key={w.id} onClick={() => onAssign(p.id, w.id)}>
                                      {bestWave?.id === w.id
                                        ? <Sparkles className="w-[13px] h-[13px] text-primary shrink-0" />
                                        : <div className="w-[13px] shrink-0" />}
                                      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{w.name}</span>
                                      {bestWave?.id === w.id && (
                                        <span className="text-[10px] text-primary font-medium shrink-0 ml-2">Best match</span>
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                  {orderedWaves.length === 0 && (
                                    <div className="px-2 py-1.5 text-[13px] text-[var(--g-text-muted)]">No waves available</div>
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                          )
                        })()}
                        {!p.waveId && !!(p.planning || localPlanning[p.id]) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => void resetPlanning(p)}>
                              <RotateCcw className="w-[13px] h-[13px] text-[var(--g-text-muted)]" />
                              Reset planning
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Bar cell */}
                <div
                  className={cn('relative flex items-center bg-background', isSelected && 'bg-[var(--g-accent-soft)]')}
                  style={{ width: totalTimelineWidth }}
                  onClick={() => setSelectedBarId(p.id)}
                >
                  {zoom === 'days' && weekendCols.map(ci => (
                    <div
                      key={ci}
                      className="absolute top-0 bottom-0 bg-muted/25 pointer-events-none z-0"
                      style={{ left: ci * colPx, width: colPx }}
                    />
                  ))}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
                    style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }}
                  />

                  {projectDates ? (
                    <div
                      data-bar-id={p.id}
                      className="group absolute top-1/2 -translate-y-1/2 cursor-grab select-none z-[1] rounded-[11px]"
                      style={{
                        left: barLeft(projectDates.start),
                        width: Math.max(8, barWidth(projectDates.start, projectDates.end)),
                        height: 22,
                        background: softColor,
                        opacity: isDraft ? 0.4 : isDragging ? 0.9 : 1,
                        boxShadow: isSelected
                          ? '0 0 0 2px var(--g-bg), 0 0 0 3.5px var(--g-accent)'
                          : isDragging
                            ? '0 2px 8px rgba(0,0,0,0.2)'
                            : undefined,
                      }}
                      onPointerDown={e => {
                        e.preventDefault(); e.stopPropagation()
                        const origTasks = (getEffectivePlanning(p).tasks ?? []).map(t => ({ id: t.id, start: t.start, end: t.end }))
                        setDragState({ projectId: p.id, taskId: null, type: 'move', startX: e.clientX, originalStart: projectDates.start, originalEnd: projectDates.end, originalTasks: origTasks })
                        document.body.style.cursor = 'grabbing'
                        setSelectedBarId(p.id)
                      }}
                    >
                      {/* Progress fill */}
                      <div
                        className={cn(
                          'absolute left-0 top-0 bottom-0 pointer-events-none',
                          pct >= 100 ? 'rounded-[11px]' : 'rounded-tl-[11px] rounded-bl-[11px]',
                        )}
                        style={{ width: `${pct}%`, background: waveColor }}
                      />
                      {/* Resize handles */}
                      <div
                        className={cn(
                          'absolute left-0 top-0 bottom-0 w-[5px] cursor-ew-resize z-[2] rounded-tl-[11px] rounded-bl-[11px]',
                          isSelected ? 'bg-[rgba(0,0,0,0.18)]' : 'bg-transparent',
                        )}
                        onPointerDown={e => onPointerDown(e, p.id, null, 'resize-start', projectDates.start, projectDates.end)}
                      />
                      <div
                        className={cn(
                          'absolute right-0 top-0 bottom-0 w-[5px] cursor-ew-resize z-[2] rounded-tr-[11px] rounded-br-[11px]',
                          isSelected ? 'bg-[rgba(0,0,0,0.18)]' : 'bg-transparent',
                        )}
                        onPointerDown={e => onPointerDown(e, p.id, null, 'resize-end', projectDates.start, projectDates.end)}
                      />
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0 cursor-crosshair"
                      onPointerDown={e => onPointerDownCreate(e, p)}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {/* SVG dependency arrows + connector live line */}
          {(depArrows.length > 0 || conn) && (
            <div
              className="absolute"
              style={{ top: HEADER_H, left: LEFT_PANEL_W, width: totalTimelineWidth, height: totalBodyH }}
            >
              <svg width={totalTimelineWidth} height={totalBodyH} className="overflow-visible">
                {depArrows.map((d, i) => {
                  const stub = 10, approach = 10
                  const { sx, sy, tx, ty } = d
                  const midY  = (sy + ty) / 2
                  const isHovered = hoveredArrow?.fromId === d.fromId && hoveredArrow?.toId === d.toId
                  const color = isHovered ? 'oklch(0.55 0.18 25)' : 'oklch(0.75 0.13 65)'
                  let path: string
                  if (tx >= sx + stub + approach) {
                    path = `M ${sx} ${sy} L ${sx + stub} ${sy} L ${sx + stub} ${ty} L ${tx - 2} ${ty}`
                  } else {
                    path = `M ${sx} ${sy} L ${sx + stub} ${sy} L ${sx + stub} ${midY} L ${tx - approach} ${midY} L ${tx - approach} ${ty} L ${tx - 2} ${ty}`
                  }
                  return (
                    <g
                      key={i}
                      className="cursor-pointer"
                      onPointerEnter={() => setHoveredArrow({ fromId: d.fromId, toId: d.toId })}
                      onPointerLeave={() => setHoveredArrow(null)}
                      onClick={() => void removeDep(d.fromId, d.toId)}
                    >
                      {/* Wide invisible hit area */}
                      <path d={path} stroke="transparent" strokeWidth="8" fill="none" />
                      <path d={path} stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" fill="none" />
                      <polygon points={`${tx-6},${ty-3.5} ${tx-1},${ty} ${tx-6},${ty+3.5}`} fill={color} />
                    </g>
                  )
                })}
                {conn && (
                  <g className="pointer-events-none">
                    <path
                      d={`M ${conn.fromX} ${conn.fromY} L ${conn.mouseX} ${conn.mouseY}`}
                      stroke="var(--g-accent)" strokeWidth="2" strokeDasharray="4 3" fill="none"
                    />
                    <circle cx={conn.mouseX} cy={conn.mouseY} r="4" fill="var(--g-accent)" />
                  </g>
                )}
              </svg>
            </div>
          )}

        </div>
      </div>

      {/* Drag tooltip */}
      {tooltip && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--g-bg)] border rounded-[8px] px-[14px] py-1.5 text-[13px] font-medium pointer-events-none text-[var(--g-text)]"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
        >
          {formatDate(tooltip.start)} → {formatDate(tooltip.end)}
        </div>
      )}

      {/* Drag ghost */}
      {rowDragState && (() => {
        const ghostRow = rows.find(r => r.type === 'task' && r.task.id === rowDragState.taskId)
        if (!ghostRow || ghostRow.type !== 'task') return null
        const { task, projectIndex, taskIndex } = ghostRow
        const taskMeta = TASK_TYPE_META[task.type]
        return (
          <div
            ref={ghostRef}
            className="fixed pointer-events-none z-[100] overflow-hidden"
            style={{
              width: LEFT_PANEL_W,
              height: ROW_H,
              top: -100,
              left: 0,
              background: 'var(--g-bg)',
              opacity: 0.92,
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              border: '1px solid var(--g-border-strong)',
              borderRadius: 4,
              display: 'grid',
              gridTemplateColumns: LP_GRID,
            }}
          >
            <div className={cn(cellClass, 'justify-end text-[12px] text-[var(--g-text-subtle)]')} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {projectIndex}.{taskIndex}
            </div>
            <div className={cn(cellClass, 'gap-[5px] text-[13px] text-[var(--g-text)]')}>
              <GripVertical className="w-[13px] h-[13px] shrink-0 text-[var(--g-text-subtle)]" />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{task.name}</span>
            </div>
            <div className={cellClass} />
            <div className={cellClass}>
              {taskMeta && (
                <span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center shrink-0" style={{ background: taskMeta.bg, color: taskMeta.color }}>
                  <taskMeta.icon size={13} />
                </span>
              )}
            </div>
            <div className={cellClass} />
            <div className={cellClass} />
            <div className={cn(cellClass, 'border-r-0')} />
          </div>
        )
      })()}

      {/* Project row drag ghost */}
      {projRowDragState && (() => {
        const ghostRow = rows.find(r => r.type === 'project' && r.project.id === projRowDragState.projectId)
        if (!ghostRow || ghostRow.type !== 'project') return null
        const { project: gp } = ghostRow
        const gStatusMeta = PROJECT_STATUS_META[gp.status]
        return (
          <div
            ref={projGhostRef}
            className="fixed pointer-events-none z-[100] overflow-hidden"
            style={{
              width: LEFT_PANEL_W,
              height: ROW_H,
              top: -100,
              left: 0,
              background: 'var(--g-bg)',
              opacity: 0.92,
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              border: '1px solid var(--g-border-strong)',
              borderRadius: 4,
              display: 'grid',
              gridTemplateColumns: LP_GRID,
            }}
          >
            <div className={cn(cellClass, 'justify-end text-[12px] text-[var(--g-text-subtle)] font-semibold')} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {ghostRow.projectIndex}
            </div>
            <div className={cn(cellClass, 'gap-[5px] text-[13px] text-[var(--g-text)]')}>
              <GripVertical className="w-[13px] h-[13px] shrink-0 text-[var(--g-text-subtle)]" />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{gp.name}</span>
            </div>
            <div className={cellClass}>
              {gStatusMeta && (
                <span className="py-0.5 px-[7px] rounded-full text-[11px] font-medium whitespace-nowrap border border-transparent" style={{ background: gStatusMeta.bg, color: gStatusMeta.color }}>
                  {gp.status}
                </span>
              )}
            </div>
            <div className={cellClass} />
            <div className={cellClass} />
            <div className={cn(cellClass, 'border-r-0')} />
          </div>
        )
      })()}

    </div>
  )
}
