import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { ChevronDown, ChevronRight, GripVertical, RotateCcw, MoreHorizontal, Plus, Trash2, Pencil, Sparkles, ArrowRight, Unlink, CloudUpload, Database, HardDrive, BarChart2, Cpu, Lock, Info, Search, X, Circle, CheckCircle2, Loader2, ListFilter, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

import type { Project, ProjectPlanning, PlanningMilestone, MilestoneType, MilestoneStatus } from '@/types'
import type { Wave } from '@/types/wave'
import type { EmbargoRecord } from '@/types/embargo'
import { useEmbargos } from '@/hooks/use-embargos'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  milestoneId: string | null
  type: DragType
  startX: number
  originalStart: string
  originalEnd: string
  originalMilestones?: { id: string; start: string; end: string }[]
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
  milestoneId: string
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

const MILESTONE_PRESETS: { type: MilestoneType; label: string; icon: LucideIcon }[] = [
  { type: 'env-provision',          label: 'Environment Provision Stage', icon: CloudUpload },
  { type: 'dev-resource-provision', label: 'DEV Resource Provision Stage', icon: Cpu         },
  { type: 'dev-data-migration',     label: 'DEV Data Migration Stage',    icon: Database    },
  { type: 'dev-cutover',            label: 'DEV Cutover',                 icon: ArrowRight  },
  { type: 'prd-resource-provision', label: 'PRD Resource Provision Stage', icon: HardDrive   },
  { type: 'prd-data-migration',     label: 'PRD Data Migration Stage',    icon: BarChart2   },
  { type: 'prd-cutover',            label: 'PRD Cutover',                 icon: Sparkles    },
  { type: 'custom',                 label: 'Custom Milestone',            icon: Pencil      },
]

const MILESTONE_TYPE_META: Record<MilestoneType, { bg: string; color: string; label: string; icon: LucideIcon }> = {
  'env-provision':          { bg: 'oklch(0.88 0.05 185)', color: 'oklch(0.35 0.10 185)', label: 'Env',    icon: CloudUpload },
  'dev-resource-provision': { bg: 'oklch(0.91 0.05 200)', color: 'oklch(0.35 0.12 200)', label: 'DevRes', icon: Cpu         },
  'dev-data-migration':     { bg: 'oklch(0.90 0.06 220)', color: 'oklch(0.35 0.13 260)', label: 'DevData', icon: Database    },
  'dev-cutover':            { bg: 'oklch(0.92 0.04 290)', color: 'oklch(0.35 0.12 300)', label: 'DevCut', icon: ArrowRight  },
  'prd-resource-provision': { bg: 'oklch(0.91 0.05 20)',  color: 'oklch(0.40 0.14 20)',  label: 'PrdRes', icon: HardDrive   },
  'prd-data-migration':     { bg: 'oklch(0.92 0.04 240)', color: 'oklch(0.35 0.15 260)', label: 'PrdData', icon: BarChart2   },
  'prd-cutover':            { bg: 'oklch(0.90 0.05 140)', color: 'oklch(0.35 0.12 150)', label: 'PrdCut', icon: Sparkles    },
  'custom':                 { bg: 'oklch(0.90 0.05 140)', color: 'oklch(0.35 0.12 150)', label: 'Custom', icon: Pencil      },
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

const MILESTONE_STATUS_PROGRESS: Record<string, number> = { 'todo': 0, 'in-progress': 50, 'done': 100 }

const MILESTONE_STATUS_META: Record<MilestoneStatus, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  'todo':        { label: 'To Do',       icon: Circle,       color: 'var(--g-text-subtle)',          bg: 'var(--g-bg-alt)' },
  'in-progress': { label: 'In Progress', icon: Loader2,      color: 'oklch(0.55 0.15 260)',          bg: 'oklch(0.96 0.02 260)' },
  'done':        { label: 'Completed',   icon: CheckCircle2, color: 'oklch(0.40 0.12 150)',          bg: 'oklch(0.90 0.05 140)' },
}

const DEFAULT_WAVE_COLOR = '#6366F1'

const LP_GRID = '40px minmax(160px,1fr) 100px 80px 100px 32px'
const CELL_CLASS = 'h-full flex items-center px-2 border-r min-w-0'

// ─── Memoized sub-components ───────────────────────────────────────────────────

interface TimelineHeaderProps {
  zoom: ZoomLevel
  colPx: number
  totalTimelineWidth: number
  todayOffset: number
  monthLabels: { key: string; label: string; widthPx: number }[]
  yearLabels: { key: string; label: string; widthPx: number }[]
  monthOnlyLabels: { key: string; label: string; widthPx: number }[]
  subHeaderCells: { key: string; label: string; className: string }[]
}

interface LeftPanelHeaderProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  durationFilter: string
  onDurationFilterChange: (v: string) => void
}

const LeftPanelHeader = memo(function LeftPanelHeader({ searchQuery, onSearchChange, durationFilter, onDurationFilterChange }: LeftPanelHeaderProps) {
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSearching) inputRef.current?.focus()
  }, [isSearching])

  return (
    <div
      className="border-b sticky left-0 z-20 grid shrink-0 h-[40px] w-[680px] bg-background border-r"
      style={{ gridTemplateColumns: LP_GRID }}
    >
      {['', 'Project / Milestones', 'Status', 'Labels', 'Duration', ''].map((col, i) => (
        <div
          key={i}
          className={cn(
            CELL_CLASS,
            'text-[11.5px] font-semibold text-[var(--g-text-muted)] uppercase tracking-[0.02em]',
            (i === 2 || i === 3 || i === 4) && 'justify-center',
            i === 5 && 'border-r-0',
          )}
        >
          {i === 1 && isSearching ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { onSearchChange(''); setIsSearching(false) } }}
                placeholder="Search projects..."
                className="flex-1 min-w-0 bg-transparent border-b border-[var(--g-accent)] outline-none text-[13px] text-[var(--g-text)] placeholder:text-[var(--g-text-subtle)]"
              />
              <button
                onClick={() => { onSearchChange(''); setIsSearching(false) }}
                className="shrink-0 p-0.5 rounded-full hover:bg-muted text-[var(--g-text-subtle)] hover:text-[var(--g-text)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : i === 1 ? (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="truncate">{col}</span>
              <button
                onClick={() => setIsSearching(true)}
                className="shrink-0 p-0.5 rounded-[4px] hover:bg-muted text-[var(--g-text-subtle)] hover:text-[var(--g-text)] transition-colors ml-1"
              >
                <Search size={14} />
              </button>
            </div>
          ) : i === 4 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 bg-transparent border-none cursor-pointer uppercase tracking-[0.02em] text-[var(--g-text-muted)]">
                  <span>{col}</span>
                  <ListFilter size={13} className={durationFilter !== 'all' ? 'text-[oklch(0.48_0.20_260)]' : ''} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[160px]">
                {[
                  { value: 'all', label: 'All durations' },
                  { value: 'lt30', label: '< 30 days' },
                  { value: '30to90', label: '30–90 days' },
                  { value: '90to180', label: '90–180 days' },
                  { value: 'gte180', label: '≥ 180 days' },
                ].map(opt => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onDurationFilterChange(opt.value)}
                    className={cn(
                      'text-[12px] flex items-center gap-2',
                      durationFilter === opt.value && 'bg-[var(--g-accent-soft)] text-[var(--g-accent)] font-medium',
                    )}
                  >
                    <span className="w-3.5 flex items-center justify-center">
                      {durationFilter === opt.value && <Check size={12} />}
                    </span>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            col
          )}
        </div>
      ))}
    </div>
  )
})

const TimelineHeader = memo(function TimelineHeader({
  zoom, colPx, totalTimelineWidth, todayOffset, monthLabels, yearLabels, monthOnlyLabels, subHeaderCells,
}: TimelineHeaderProps) {
  return (
    <div className="border-b relative flex flex-col" style={{ width: totalTimelineWidth }}>
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
          <div className="absolute top-0.5 flex flex-col items-center pointer-events-none" style={{ left: todayOffset }}>
            <span className="bg-[var(--g-today)] text-white text-[9px] font-bold py-px px-1.5 rounded-[4px] whitespace-nowrap uppercase tracking-[0.03em]">
              Today
            </span>
          </div>
        </div>
        <div className="flex items-center h-[22px] relative bg-card">
          {zoom === 'months' ? monthOnlyLabels.map(col => (
            <div
              key={col.key}
              className="shrink-0 border-r overflow-hidden whitespace-nowrap text-center px-0.5 text-[11px] text-[var(--g-text-muted)] font-normal"
              style={{ width: col.widthPx }}
            >
              {col.label}
            </div>
          )) : subHeaderCells.map(cell => (
            <div key={cell.key} className={cell.className} style={{ width: colPx }}>
              {cell.label}
            </div>
          ))}
          <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--g-today)] pointer-events-none" style={{ left: todayOffset }} />
        </div>
      </div>
    )
  })

interface TimelineBackgroundProps {
  zoom: ZoomLevel
  colPx: number
  totalTimelineWidth: number
  totalBodyH: number
  weekendSet: Set<number>
  todayOffset: number
}

const TimelineBackground = memo(function TimelineBackground({
  zoom, colPx, totalTimelineWidth, totalBodyH, weekendSet, todayOffset,
}: TimelineBackgroundProps) {
  if (zoom !== 'days') {
    return (
      <div className="absolute pointer-events-none z-[1]" style={{ top: HEADER_H, left: LEFT_PANEL_W, width: totalTimelineWidth, height: totalBodyH }}>
        <div className="absolute top-0 bottom-0 w-0.5" style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }} />
      </div>
    )
  }
  const weekendCols = Array.from(weekendSet)
  return (
    <div className="absolute pointer-events-none z-[1]" style={{ top: HEADER_H, left: LEFT_PANEL_W, width: totalTimelineWidth, height: totalBodyH }}>
      {weekendCols.map(ci => (
        <div key={ci} className="absolute top-0 bottom-0 bg-muted/25" style={{ left: ci * colPx, width: colPx }} />
      ))}
      <div className="absolute top-0 bottom-0 w-0.5" style={{ background: 'oklch(0.62 0.18 20 / 0.15)', left: todayOffset }} />
    </div>
  )
})

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
function formatDuration(start: string, end: string): string {
  const days = Math.max(1, daysBetween(parseDate(start), parseDate(end)))
  return `${days}d`
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
  readOnly?: boolean
}

export function WaveGanttChart({ waves, projects, onUpdatePlanning, onUpdateProjectOrder, onAssign, readOnly }: Props) {
  const [showCompleted, setShowCompleted] = useState(true)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const milestoneGhostRef     = useRef<HTMLDivElement>(null)
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
  const [editingTaskId, setEditingMilestoneId]     = useState<string | null>(null)
  const [editingTaskName, setEditingMilestoneName] = useState('')
  const [rowMilestoneDragState, setRowMilestoneDragState]         = useState<RowDragState | null>(null)
  const [projRowDragState, setProjRowDragState] = useState<ProjRowDragState | null>(null)
  const [searchQuery, setSearchQuery]           = useState('')
  const [durationFilter, setDurationFilter]     = useState('all')
  const [statusDialog, setStatusDialog]         = useState<{ open: boolean; projectId: string; milestoneId: string; nextStatus: MilestoneStatus } | null>(null)

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

  function effectiveMilestoneDates(projectId: string, milestone: PlanningMilestone): { start: string; end: string } {
    const t = (localPlanning[projectId]?.milestones ?? []).find(lt => lt.id === milestone.id)
    if (t) return { start: t.start, end: t.end }
    return { start: milestone.start, end: milestone.end }
  }

  function getEffectivePlanning(p: Project): ProjectPlanning {
    if (localPlanning[p.id]) return localPlanning[p.id]!
    if (p.planning) return p.planning
    const wave = p.waveId ? waveMap.get(p.waveId) : undefined
    const today = toIso(new Date())
    return { startDate: wave?.startDate ?? today, endDate: wave?.cutoverDate ?? addDays(today, 30), milestones: [] }
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

  function onPointerDown(e: React.PointerEvent, projectId: string, milestoneId: string | null, type: DragType, start: string, end: string) {
    if (readOnly && milestoneId === null) return
    e.preventDefault(); e.stopPropagation()
    setDragState({ projectId, milestoneId, type, startX: e.clientX, originalStart: start, originalEnd: end })
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'col-resize'
  }

  function waveBoundsForProject(projectId: string): { start?: string; end?: string } {
    const p = projects.find(x => x.id === projectId)
    if (!p?.waveId) return {}
    const wave = waveMap.get(p.waveId)
    return { start: wave?.startDate, end: wave?.cutoverDate }
  }

  function clampProjectDatesToWave(projectId: string, start: string, end: string): { start: string; end: string } {
    const bounds = waveBoundsForProject(projectId)
    if (!bounds.start && !bounds.end) return { start, end }

    const duration = daysBetween(parseDate(start), parseDate(end))
    let clampedStart = start
    let clampedEnd = end

    // Lower bound: start >= waveStart
    if (bounds.start && clampedStart < bounds.start) {
      clampedStart = bounds.start
      clampedEnd = addDays(clampedStart, duration)
    }

    // Upper bound: start <= waveEnd - 1
    if (bounds.end) {
      const maxStart = addDays(bounds.end, -1)
      if (clampedStart > maxStart) {
        clampedStart = maxStart
        clampedEnd = addDays(clampedStart, duration)
      }
    }

    // Ensure start < end (minimum 1 day); end may extend beyond waveEnd
    if (clampedStart >= clampedEnd) {
      clampedEnd = addDays(clampedStart, 1)
    }

    return { start: clampedStart, end: clampedEnd }
  }

  function projectDatesForMilestone(projectId: string): { start: string; end: string } | null {
    const p = projects.find(x => x.id === projectId)
    if (!p) return null
    return effectiveProjectDates(p) ?? null
  }

  function clampMilestoneDatesToProject(projectId: string, start: string, end: string): { start: string; end: string } {
    const pd = projectDatesForMilestone(projectId)
    if (!pd) return { start, end }

    let clampedStart = start
    let clampedEnd = end

    // Lower bound: start >= projectStart
    if (clampedStart < pd.start) {
      const duration = daysBetween(parseDate(start), parseDate(end))
      clampedStart = pd.start
      clampedEnd = addDays(clampedStart, duration)
    }

    // Upper bound: end <= projectEnd
    if (clampedEnd > pd.end) {
      const duration = daysBetween(parseDate(start), parseDate(end))
      clampedEnd = pd.end
      clampedStart = addDays(clampedEnd, -duration)
      if (clampedStart < pd.start) clampedStart = pd.start
    }

    // Ensure start < end (minimum 1 day)
    if (clampedStart >= clampedEnd) {
      clampedEnd = addDays(clampedStart, 1)
      if (clampedEnd > pd.end) {
        clampedEnd = pd.end
        clampedStart = addDays(clampedEnd, -1)
        if (clampedStart < pd.start) clampedStart = pd.start
      }
    }

    return { start: clampedStart, end: clampedEnd }
  }

  function onPointerDownCreate(e: React.PointerEvent, project: Project) {
    if (readOnly) return
    e.preventDefault(); e.stopPropagation()
    let clickDate = clientXToDate(e.clientX)
    const bounds = waveBoundsForProject(project.id)
    if (bounds.start && clickDate < bounds.start) clickDate = bounds.start
    if (bounds.end && clickDate >= bounds.end) clickDate = addDays(bounds.end, -1)
    const base = getEffectivePlanning(project)
    setLocalPlanning(prev => ({ ...prev, [project.id]: { ...base, startDate: clickDate, endDate: clickDate } }))
    setDragState({ projectId: project.id, milestoneId: null, type: 'create', startX: e.clientX, originalStart: clickDate, originalEnd: clickDate })
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

    // Clamp project-level dates to wave bounds
    if (dragState.milestoneId === null) {
      const clamped = clampProjectDatesToWave(dragState.projectId, newStart, newEnd)
      newStart = clamped.start
      newEnd   = clamped.end
    } else {
      // Clamp milestone dates to parent project range
      const clamped = clampMilestoneDatesToProject(dragState.projectId, newStart, newEnd)
      newStart = clamped.start
      newEnd   = clamped.end
    }

    setLocalPlanning(prev => {
      const { projectId, milestoneId } = dragState
      const base = prev[projectId] ?? projects.find(p => p.id === projectId)?.planning ?? { startDate: newStart, endDate: newEnd, milestones: [] }
      if (milestoneId === null) {
        if (dragState.type === 'move' && dragState.originalMilestones) {
          const actualMoveDelta = daysBetween(parseDate(dragState.originalStart), parseDate(newStart))
          const milestones = (base.milestones ?? []).map(t => {
            const orig = dragState.originalMilestones!.find(ot => ot.id === t.id)
            if (!orig) return t
            return { ...t, start: addDays(orig.start, actualMoveDelta), end: addDays(orig.end, actualMoveDelta) }
          })
          return { ...prev, [projectId]: { ...base, startDate: newStart, endDate: newEnd, milestones } }
        }
        return { ...prev, [projectId]: { ...base, startDate: newStart, endDate: newEnd } }
      } else {
        const milestones = (base.milestones ?? []).map(t => t.id === milestoneId ? { ...t, start: newStart, end: newEnd } : t)
        return { ...prev, [projectId]: { ...base, milestones } }
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

  // ─── Row drag (milestone reorder) ──────────────────────────────────────────────────

  const onRowMilestonePointerMove = useCallback((e: PointerEvent) => {
    if (!rowMilestoneDragState) return
    if (milestoneGhostRef.current) {
      milestoneGhostRef.current.style.top = `${e.clientY - ROW_H / 2}px`
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-milestone-row-project]') as HTMLElement | null
    if (!el) return
    if (el.dataset.milestoneRowProject !== rowMilestoneDragState.projectId) return
    const idx = parseInt(el.dataset.milestoneRowIndex ?? '0', 10)
    const rect = el.getBoundingClientRect()
    const overIndex = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1
    setRowMilestoneDragState(prev => prev ? { ...prev, overIndex } : null)
  }, [rowMilestoneDragState])

  const onRowMilestonePointerUp = useCallback(async () => {
    if (!rowMilestoneDragState) return
    document.body.style.cursor = ''
    const { projectId, sourceIndex, overIndex } = rowMilestoneDragState
    setRowMilestoneDragState(null)
    if (overIndex === sourceIndex || overIndex === sourceIndex + 1) return
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base = getEffectivePlanning(project)
    const milestones = [...(base.milestones ?? [])]
    const [moved] = milestones.splice(sourceIndex, 1)
    if (!moved) return
    const insertAt = overIndex > sourceIndex ? overIndex - 1 : overIndex
    milestones.splice(insertAt, 0, moved)
    const updated = { ...base, milestones }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowMilestoneDragState, projects, onUpdatePlanning])

  useEffect(() => {
    if (!rowMilestoneDragState) return
    window.addEventListener('pointermove', onRowMilestonePointerMove)
    window.addEventListener('pointerup', onRowMilestonePointerUp)
    return () => {
      window.removeEventListener('pointermove', onRowMilestonePointerMove)
      window.removeEventListener('pointerup', onRowMilestonePointerUp)
    }
  }, [rowMilestoneDragState, onRowMilestonePointerMove, onRowMilestonePointerUp])

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

  async function addMilestone(projectId: string, type: MilestoneType, label: string) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base  = getEffectivePlanning(project)
    const today = toIso(new Date())
    const projDates  = effectiveProjectDates(project)
    const rangeStart = projDates?.start ?? today
    const rangeEnd   = projDates?.end   ?? addDays(today, 30)
    const milestoneStart  = today < rangeStart ? rangeStart : today > rangeEnd ? rangeStart : today
    const milestoneEnd    = (() => { const e = addDays(milestoneStart, 7); return e > rangeEnd ? rangeEnd : e })()
    const milestone: PlanningMilestone = {
      id: crypto.randomUUID(), name: label, type,
      start: milestoneStart, end: milestoneEnd, status: 'todo', deps: [],
    }
    const updated: ProjectPlanning = { ...base, milestones: [...(base.milestones ?? []), milestone] }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  }

  async function deleteMilestone(projectId: string, milestoneId: string) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base = getEffectivePlanning(project)
    const updated: ProjectPlanning = {
      ...base,
      milestones: (base.milestones ?? [])
        .filter(t => t.id !== milestoneId)
        .map(t => ({ ...t, deps: t.deps.filter(d => d !== milestoneId) })),
    }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  }

  function isDAGSafe(fromId: string, toId: string): boolean {
    if (fromId === toId) return false
    const milestoneMap = new Map<string, PlanningMilestone>()
    for (const p of projects) {
      const milestones = (localPlanning[p.id] ?? p.planning)?.milestones ?? []
      for (const t of milestones) milestoneMap.set(t.id, t)
    }
    const visited = new Set<string>()
    const queue = [...(milestoneMap.get(fromId)?.deps ?? [])]
    while (queue.length) {
      const id = queue.shift()!
      if (id === toId) return false
      if (visited.has(id)) continue
      visited.add(id)
      queue.push(...(milestoneMap.get(id)?.deps ?? []))
    }
    return true
  }

  async function addDep(fromId: string, toId: string) {
    if (!isDAGSafe(fromId, toId)) return
    for (const p of projects) {
      const planning = localPlanning[p.id] ?? p.planning
      if (!planning?.milestones) continue
      const milestone = planning.milestones.find(t => t.id === toId)
      if (milestone && !milestone.deps.includes(fromId)) {
        const updated = { ...planning, milestones: planning.milestones.map(t => t.id === toId ? { ...t, deps: [...t.deps, fromId] } : t) }
        setLocalPlanning(prev => ({ ...prev, [p.id]: updated }))
        try { await onUpdatePlanning(p.id, updated) }
        catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[p.id]; return n }) }
        return
      }
    }
  }

  async function saveMilestoneName(projectId: string, milestoneId: string, name: string) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base = getEffectivePlanning(project)
    const updated: ProjectPlanning = {
      ...base,
      milestones: (base.milestones ?? []).map(t => t.id === milestoneId ? { ...t, name } : t),
    }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    setEditingMilestoneId(null)
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  }

  function nextMilestoneStatus(status: MilestoneStatus): MilestoneStatus | null {
    if (status === 'todo') return 'in-progress'
    if (status === 'in-progress') return 'done'
    return null
  }

  async function changeMilestoneStatus(projectId: string, milestoneId: string, status: MilestoneStatus) {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const base = getEffectivePlanning(project)
    const updated: ProjectPlanning = {
      ...base,
      milestones: (base.milestones ?? []).map(t => t.id === milestoneId ? { ...t, status } : t),
    }
    setLocalPlanning(prev => ({ ...prev, [projectId]: updated }))
    try { await onUpdatePlanning(projectId, updated) }
    catch { setLocalPlanning(prev => { const n = { ...prev }; delete n[projectId]; return n }) }
  }

  async function removeDep(fromId: string, toId: string) {
    for (const p of projects) {
      const planning = localPlanning[p.id] ?? p.planning
      if (!planning?.milestones) continue
      const milestone = planning.milestones.find(t => t.id === toId)
      if (milestone) {
        const updated = {
          ...planning,
          milestones: planning.milestones.map(t =>
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
    await onUpdatePlanning(p.id, { startDate: '', endDate: '', milestones: [] })
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

  const { monthLabels, yearLabels, monthOnlyLabels, weekendSet, subHeaderCells } = useMemo(() => {
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

    const weekendSet = new Set<number>()
    if (zoom === 'days') {
      const d = new Date(timelineStart)
      for (let i = 0; i < totalCols; i++) {
        if (isWeekend(toIso(d))) weekendSet.add(i)
        d.setUTCDate(d.getUTCDate() + 1)
      }
    }

    const todayIso = toIso(new Date())
    const subHeaderCells = zoom === 'months'
      ? []
      : sub.map((col, i) => {
          const isCurrentPeriod = zoom === 'weeks'
            ? col.key <= todayIso && todayIso <= addDays(col.key, 6)
            : col.key === todayIso
          const isWeekendCol = zoom === 'days' && weekendSet.has(i)
          const base = 'shrink-0 border-r overflow-hidden whitespace-nowrap text-center px-0.5 text-[11px]'
          const className = isCurrentPeriod
            ? base + ' text-[var(--g-today)] font-bold' + (isWeekendCol ? ' bg-muted/25' : '')
            : base + ' text-[var(--g-text-muted)] font-normal' + (isWeekendCol ? ' bg-muted/25' : '')
          return { key: col.key, label: col.label, className }
        })

    return { monthLabels: months, yearLabels, monthOnlyLabels, weekendSet, subHeaderCells }
  }, [zoom, timelineStart, timelineEnd, totalCols, colPx, daysPerCol])

  // ─── Flat row list ───────────────────────────────────────────────────────────

  type RowItem =
    | { type: 'embargo-header' }
    | { type: 'embargo';          embargo: EmbargoRecord }
    | { type: 'wave';             wave: Wave }
    | { type: 'project';          wave: Wave | null; project: Project; projectIndex: number; waveProjectIndex: number }
    | { type: 'milestone';             wave: Wave | null; project: Project; milestone: PlanningMilestone; projectIndex: number; milestoneIndex: number }
    | { type: 'unassigned-header' }

  function getMilestonesForProject(p: Project): PlanningMilestone[] {
    let milestones = (localPlanning[p.id] ?? p.planning)?.milestones ?? []
    if (rowMilestoneDragState?.projectId === p.id && milestones.length > 0) {
      const arr = [...milestones]
      const [moved] = arr.splice(rowMilestoneDragState.sourceIndex, 1)
      if (moved) {
        const insertAt = rowMilestoneDragState.overIndex > rowMilestoneDragState.sourceIndex
          ? rowMilestoneDragState.overIndex - 1
          : rowMilestoneDragState.overIndex
        arr.splice(Math.min(insertAt, arr.length), 0, moved)
        milestones = arr
      }
    }
    return milestones
  }

  // ─── Search filter ───────────────────────────────────────────────────────────
  const searchLower = searchQuery.trim().toLowerCase()
  const hasSearch = searchLower.length > 0
  const hasDurationFilter = durationFilter !== 'all'

  function getProjectDurationDays(p: Project): number | null {
    const dates = effectiveProjectDates(p)
    if (!dates?.start || !dates?.end) return null
    const s = parseDate(dates.start)
    const e = parseDate(dates.end)
    return Math.max(1, daysBetween(s, e))
  }

  function durationMatches(days: number | null): boolean {
    if (!hasDurationFilter || days === null) return false
    switch (durationFilter) {
      case 'lt30':    return days < 30
      case '30to90':  return days >= 30 && days < 90
      case '90to180': return days >= 90 && days < 180
      case 'gte180':  return days >= 180
      default:        return true
    }
  }

  const matchingProjectIds = useMemo(() => {
    if (!hasSearch) return new Set<string>()
    const set = new Set<string>()
    for (const p of projects) {
      if (p.id.toLowerCase().includes(searchLower) || p.name.toLowerCase().includes(searchLower)) {
        set.add(p.id)
      }
      const milestones = (localPlanning[p.id] ?? p.planning)?.milestones ?? []
      for (const t of milestones) {
        if (t.name.toLowerCase().includes(searchLower)) {
          set.add(p.id)
        }
      }
    }
    return set
  }, [hasSearch, searchLower, projects, localPlanning])

  const matchingEmbargoIds = useMemo(() => {
    if (!hasSearch) return new Set<string>()
    const set = new Set<string>()
    for (const e of embargos) {
      if (e.name.toLowerCase().includes(searchLower)) set.add(e.id)
    }
    return set
  }, [hasSearch, searchLower, embargos])

  const matchingDurationIds = useMemo(() => {
    if (!hasDurationFilter) return new Set<string>()
    const set = new Set<string>()
    for (const p of projects) {
      if (durationMatches(getProjectDurationDays(p))) set.add(p.id)
    }
    return set
  }, [hasDurationFilter, durationFilter, projects, localPlanning])

  const rows = useMemo<RowItem[]>(() => {
    const result: RowItem[] = []
    let projectCounter = 0

    if (embargos.length > 0) {
      const anyEmbargoMatch = !hasSearch || embargos.some(e => matchingEmbargoIds.has(e.id))
      if (anyEmbargoMatch) {
        result.push({ type: 'embargo-header' })
        if (!embargosCollapsed) {
          for (const e of embargos) {
            if (!hasSearch || matchingEmbargoIds.has(e.id)) {
              result.push({ type: 'embargo', embargo: e })
            }
          }
        }
      }
    }

    for (const wave of sortedWaves) {
      const waveProjectsRaw = projectsByWave.get(wave.id) ?? []
      const visibleWaveProjects = waveProjectsRaw.filter(p =>
        (!hasSearch || matchingProjectIds.has(p.id)) &&
        (!hasDurationFilter || matchingDurationIds.has(p.id))
      )

      if ((hasSearch || hasDurationFilter) && visibleWaveProjects.length === 0) continue

      result.push({ type: 'wave', wave })
      if (!collapsedWaves.has(wave.id)) {
        let waveProjects = visibleWaveProjects
        if (!hasSearch && !hasDurationFilter && projRowDragState?.waveId === wave.id && waveProjects.length > 0) {
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
            getMilestonesForProject(p).forEach((milestone, ti) => {
              result.push({ type: 'milestone', wave, project: p, milestone, projectIndex, milestoneIndex: ti + 1 })
            })
          }
        }
      }
    }

    const visibleUnassigned = unassignedProjects.filter(p =>
      (!hasSearch || matchingProjectIds.has(p.id)) &&
      (!hasDurationFilter || matchingDurationIds.has(p.id))
    )

    if (visibleUnassigned.length > 0) {
      result.push({ type: 'unassigned-header' })
      if (!collapsedWaves.has('__unassigned__')) {
        for (const [wpi, p] of visibleUnassigned.entries()) {
          projectCounter++
          const projectIndex = projectCounter
          result.push({ type: 'project', wave: null, project: p, projectIndex, waveProjectIndex: wpi })
          if (!collapsedProjects.has(p.id)) {
            getMilestonesForProject(p).forEach((milestone, ti) => {
              result.push({ type: 'milestone', wave: null, project: p, milestone, projectIndex, milestoneIndex: ti + 1 })
            })
          }
        }
      }
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedWaves, collapsedWaves, collapsedProjects, projectsByWave, unassignedProjects, localPlanning, rowMilestoneDragState, projRowDragState, embargos, embargosCollapsed, hasSearch, matchingProjectIds, matchingEmbargoIds, hasDurationFilter, matchingDurationIds])

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

  const milestoneRowIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    rows.forEach((row, i) => {
      if (row.type === 'milestone') map.set(row.milestone.id, i)
    })
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const depArrows = useMemo(() => {
    const arrows: { sx: number; sy: number; tx: number; ty: number; color: string; fromId: string; toId: string }[] = []
    rows.forEach((row, ri) => {
      if (row.type !== 'milestone') return
      const { project, milestone, wave } = row
      if (!milestone.deps?.length) return
      const { start: ts, end: te } = effectiveMilestoneDates(project.id, milestone)
      if (!ts || !te) return
      const tx = barLeft(ts)
      const ty = rowTops[ri] + ROW_H / 2

      for (const depId of milestone.deps) {
        const srcIdx = milestoneRowIndexMap.get(depId)
        if (srcIdx === undefined) continue
        const srcRow = rows[srcIdx]
        if (srcRow.type !== 'milestone') continue
        const { start: ss, end: se } = effectiveMilestoneDates(srcRow.project.id, srcRow.milestone)
        if (!ss || !se) continue
        const sx = barLeft(ss) + barWidth(ss, se)
        const sy = rowTops[srcIdx] + ROW_H / 2
        arrows.push({ sx, sy, tx, ty, color: wave?.color ?? DEFAULT_WAVE_COLOR, fromId: depId, toId: milestone.id })
      }
    })
    return arrows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowTops, colPx, daysPerCol, milestoneRowIndexMap])

  // ─── Left panel column grid ───────────────────────────────────────────────────
  const cellClass = CELL_CLASS

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

          <div className="sticky top-0 z-30 flex h-[40px]">
            <LeftPanelHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              durationFilter={durationFilter}
              onDurationFilterChange={setDurationFilter}
            />
            <TimelineHeader
              zoom={zoom}
              colPx={colPx}
              totalTimelineWidth={totalTimelineWidth}
              todayOffset={todayOffset}
              monthLabels={monthLabels}
              yearLabels={yearLabels}
              monthOnlyLabels={monthOnlyLabels}
              subHeaderCells={subHeaderCells}
            />
          </div>

          <TimelineBackground
            zoom={zoom}
            colPx={colPx}
            totalTimelineWidth={totalTimelineWidth}
            totalBodyH={totalBodyH}
            weekendSet={weekendSet}
            todayOffset={todayOffset}
          />

          {/* Content rows */}
          {rows.map((row, rowIdx) => {
            const rowKey =
              row.type === 'embargo-header'      ? '__embargos__'
              : row.type === 'embargo'           ? `embargo-${row.embargo.id}`
              : row.type === 'wave'              ? row.wave.id
              : row.type === 'unassigned-header' ? '__unassigned__'
              : row.type === 'milestone'              ? `milestone-${row.milestone.id}`
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
                  <div className="relative bg-background" style={{ width: totalTimelineWidth }} />
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
                    {/* Duration col */}
                    <div className={cn(cellClass, 'justify-center')} />
                    {/* Action col */}
                    <div className={cn(cellClass, 'border-r-0')} />
                  </div>
                  <div className="relative" style={{ width: totalTimelineWidth }} />
                </div>
              )
            }

            // ── Task row ───────────────────────────────────────────────────────
            if (row.type === 'milestone') {
              const { project, milestone, wave, projectIndex, milestoneIndex } = row
              const waveColor  = wave?.color ?? DEFAULT_WAVE_COLOR
              const softColor  = hexToRgba(waveColor, 0.25)
              const { start, end } = effectiveMilestoneDates(project.id, milestone)
              const progress   = MILESTONE_STATUS_PROGRESS[milestone.status] ?? 0
              const isDragging = dragState?.projectId === project.id && dragState?.milestoneId === milestone.id
              const isSelected = selectedBarId === milestone.id
              const isConnTarget = conn?.overId === milestone.id
              const taskMeta      = MILESTONE_TYPE_META[milestone.type]
              const milestoneIdx0      = milestoneIndex - 1
              const isDraggedMilestone = rowMilestoneDragState?.milestoneId === milestone.id

              return (
                <div
                  key={rowKey}
                  className="flex border-b"
                  style={{
                    height: rh,
                    opacity: isDraggedMilestone ? 0.3 : 1,
                    background: isDraggedMilestone ? 'var(--g-accent-soft)' : undefined,
                  }}
                  data-milestone-row-project={project.id}
                  data-milestone-row-index={milestoneIdx0}
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
                      {projectIndex}.{milestoneIndex}
                    </div>
                    {/* Name col */}
                    <div className={cn(cellClass, 'pl-6 group/taskname gap-[5px] text-[13px] text-[var(--g-text)]')}>
                      <GripVertical
                        className="w-[13px] h-[13px] shrink-0 text-[var(--g-text-subtle)] cursor-grab"
                        onPointerDown={e => {
                          e.preventDefault(); e.stopPropagation()
                          setRowMilestoneDragState({ projectId: project.id, milestoneId: milestone.id, sourceIndex: milestoneIdx0, overIndex: milestoneIdx0 })
                          document.body.style.cursor = 'grabbing'
                        }}
                      />
                      {editingTaskId === milestone.id ? (
                        <input
                          autoFocus
                          className="flex-1 min-w-0 bg-transparent border-b border-[var(--g-accent)] outline-none text-[13px] text-[var(--g-text)]"
                          value={editingTaskName}
                          onChange={e => setEditingMilestoneName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveMilestoneName(project.id, milestone.id, editingTaskName)
                            if (e.key === 'Escape') setEditingMilestoneId(null)
                          }}
                          onBlur={() => setEditingMilestoneId(null)}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span
                            className="overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer flex-1 min-w-0"
                            onClick={() => scrollToBar(milestone.id)}
                          >
                            {milestone.name}
                          </span>
                          <button
                            className="opacity-0 group-hover/taskname:opacity-100 shrink-0 bg-transparent border-none cursor-pointer text-[var(--g-text-subtle)] p-0.5 rounded-[4px] flex items-center transition-[opacity] duration-[100ms]"
                            onClick={e => {
                              e.stopPropagation()
                              setEditingMilestoneId(milestone.id)
                              setEditingMilestoneName(milestone.name)
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                    {/* Status col */}
                    <div className={cn(cellClass, 'justify-center')}>
                      {(() => {
                        const sMeta = MILESTONE_STATUS_META[milestone.status]
                        if (!sMeta) return null
                        const StatusIcon = sMeta.icon
                        return (
                          <span
                            className="inline-flex items-center gap-1 py-0.5 px-[7px] rounded-full text-[10px] font-medium whitespace-nowrap border border-transparent"
                            style={{ background: sMeta.bg, color: sMeta.color }}
                          >
                            <StatusIcon size={11} />
                            {sMeta.label}
                          </span>
                        )
                      })()}
                    </div>
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
                    {/* Duration col */}
                    <div className={cn(cellClass, 'justify-center text-[11px] text-[var(--g-text-subtle)] font-medium')}>
                      {formatDuration(start, end)}
                    </div>
                    {/* Action col */}
                    <div className={cn(cellClass, 'border-r-0 justify-center relative')}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="bg-transparent border-none cursor-pointer text-[var(--g-text-subtle)] p-0.5 rounded-[4px] flex items-center hover:text-[var(--g-text)]">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[240px]">
                          {(() => {
                            const nextStatus = nextMilestoneStatus(milestone.status)
                            if (!nextStatus) return null
                            const nextMeta = MILESTONE_STATUS_META[nextStatus]
                            const NextIcon = nextMeta.icon
                            return (
                              <DropdownMenuItem
                                onClick={() => setStatusDialog({ open: true, projectId: project.id, milestoneId: milestone.id, nextStatus })}
                              >
                                <NextIcon className="w-[13px] h-[13px] mr-1.5" />
                                Mark as {nextMeta.label}
                              </DropdownMenuItem>
                            )
                          })()}
                          {nextMilestoneStatus(milestone.status) && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => void deleteMilestone(project.id, milestone.id)}
                          >
                            <Trash2 className="w-[13px] h-[13px] mr-1.5" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Bar cell */}
                  <div
                    className={cn('relative flex items-center bg-card', isSelected && 'bg-[var(--g-accent-soft)]')}
                    style={{ width: totalTimelineWidth }}
                    onClick={() => { setSelectedBarId(milestone.id); }}
                  >

                    {start && end ? (
                      <div
                        data-bar-id={milestone.id}
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
                        onPointerDown={e => { onPointerDown(e, project.id, milestone.id, 'move', start, end); setSelectedBarId(milestone.id) }}
                      >
                        {/* Progress fill — status background color */}
                        <div
                          className="absolute left-0 top-0 bottom-0 pointer-events-none"
                          style={{ width: `${progress}%`, background: milestone.status !== 'todo'
                            ? MILESTONE_STATUS_META[milestone.status].bg
                            : (taskMeta?.color ?? waveColor), borderRadius: '3px 0 0 3px' }}
                        />
                        {/* Status icon */}
                        {(() => {
                          const sMeta = MILESTONE_STATUS_META[milestone.status]
                          if (!sMeta || milestone.status === 'todo') return null
                          const StatusIcon = sMeta.icon
                          return (
                            <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none z-[2]">
                              <StatusIcon size={12} style={{ color: sMeta.color }} />
                            </div>
                          )
                        })()}
                        {/* Resize handles */}
                        <div
                          className={cn(
                            'absolute left-0 top-0 bottom-0 w-[5px] cursor-ew-resize z-[2] rounded-tl-[3px] rounded-bl-[3px]',
                            isSelected ? 'bg-[rgba(0,0,0,0.18)]' : 'bg-transparent',
                          )}
                          onPointerDown={e => onPointerDown(e, project.id, milestone.id, 'resize-start', start, end)}
                        />
                        <div
                          className={cn(
                            'absolute right-0 top-0 bottom-0 w-[5px] cursor-ew-resize z-[2] rounded-tr-[3px] rounded-br-[3px]',
                            isSelected ? 'bg-[rgba(0,0,0,0.18)]' : 'bg-transparent',
                          )}
                          onPointerDown={e => onPointerDown(e, project.id, milestone.id, 'resize-end', start, end)}
                        />
                        {/* Connector dot (right = outward only) */}
                        <div
                          className={cn(
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                            'absolute cursor-crosshair z-[3] transition-[opacity] duration-[120ms] rounded-full',
                            'bg-[var(--g-bg)] border-2 border-[var(--g-accent)] w-[10px] h-[10px] top-1/2 -translate-y-1/2',
                          )}
                          style={{ left: 'calc(100% + 2px)' }}
                          onPointerDown={e => beginConn(milestone.id, barLeft(start) + barWidth(start, end), rowTops[rowIdx] + ROW_H / 2, e)}
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
            const isDragging      = dragState?.projectId === p.id && dragState?.milestoneId === null
            const isProjDragging  = projRowDragState?.projectId === p.id
            const isSelected      = selectedBarId === p.id
            const labelText       = p.jiraStoryKey ?? null
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
                      {p.id}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="shrink-0 inline-flex items-center justify-center cursor-help text-[var(--g-text-subtle)] hover:text-[var(--g-text-muted)]">
                          <Info size={13} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs font-medium">{p.name}</p>
                      </TooltipContent>
                    </Tooltip>
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
                  {/* Duration col */}
                  <div className={cn(cellClass, 'justify-center text-[11px] text-[var(--g-text-subtle)] font-medium')}>
                    {projectDates ? formatDuration(projectDates.start, projectDates.end) : '—'}
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
                              Add milestone
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                {MILESTONE_PRESETS.map(preset => (
                                  <DropdownMenuItem key={preset.type} onClick={() => void addMilestone(p.id, preset.type, preset.label)}>
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
                        {!readOnly && !p.waveId && !!(p.planning || localPlanning[p.id]) && (
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
                        if (readOnly) return
                        e.preventDefault(); e.stopPropagation()
                        const origTasks = (getEffectivePlanning(p).milestones ?? []).map(t => ({ id: t.id, start: t.start, end: t.end }))
                        setDragState({ projectId: p.id, milestoneId: null, type: 'move', startX: e.clientX, originalStart: projectDates.start, originalEnd: projectDates.end, originalMilestones: origTasks })
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
      {rowMilestoneDragState && (() => {
        const milestoneGhostRow = rows.find(r => r.type === 'milestone' && r.milestone.id === rowMilestoneDragState.milestoneId)
        if (!milestoneGhostRow || milestoneGhostRow.type !== 'milestone') return null
        const { milestone, projectIndex, milestoneIndex } = milestoneGhostRow
        const taskMeta = MILESTONE_TYPE_META[milestone.type]
        return (
          <div
            ref={milestoneGhostRef}
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
              {projectIndex}.{milestoneIndex}
            </div>
            <div className={cn(cellClass, 'gap-[5px] text-[13px] text-[var(--g-text)]')}>
              <GripVertical className="w-[13px] h-[13px] shrink-0 text-[var(--g-text-subtle)]" />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{milestone.name}</span>
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
        const milestoneGhostRow = rows.find(r => r.type === 'project' && r.project.id === projRowDragState.projectId)
        if (!milestoneGhostRow || milestoneGhostRow.type !== 'project') return null
        const { project: gp } = milestoneGhostRow
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
              {milestoneGhostRow.projectIndex}
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

      {/* Status change confirmation dialog */}
      {statusDialog && (
        <Dialog open={statusDialog.open} onOpenChange={open => { if (!open) setStatusDialog(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Milestone Status</DialogTitle>
              <DialogDescription>
                Are you sure you want to mark this milestone as{' '}
                <strong>{MILESTONE_STATUS_META[statusDialog.nextStatus].label}</strong>?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  void changeMilestoneStatus(statusDialog.projectId, statusDialog.milestoneId, statusDialog.nextStatus)
                  setStatusDialog(null)
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}
