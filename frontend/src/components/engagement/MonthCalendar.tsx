import { useMemo, useRef, useEffect, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  getISOWeek,
  addHours,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Engagement, Project } from '@/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_HEIGHT = 48
const DAY_START_HOUR = 0
const DAY_END_HOUR = 24
const GRID_TOP_PADDING = 12
const WORKING_HOUR_START = 8

const STATUS_COLORS: Record<Engagement['status'], string> = {
  pending:    'bg-amber-100 text-amber-700 border-amber-200',
  scheduled:  'bg-sky-100 text-sky-700 border-sky-200',
  completed:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled:  'bg-slate-100 text-slate-500 border-slate-200 line-through',
  no_show:    'bg-rose-100 text-rose-700 border-rose-200',
}

const STATUS_OPTIONS: Engagement['status'][] = ['pending', 'scheduled', 'completed', 'cancelled', 'no_show']

const STATUS_PILL_COLORS: Record<Engagement['status'], { bg: string; text: string; border: string; activeBg: string; activeText: string }> = {
  pending:    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', activeBg: 'bg-amber-100', activeText: 'text-amber-700' },
  scheduled:  { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200', activeBg: 'bg-sky-100', activeText: 'text-sky-700' },
  completed:  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', activeBg: 'bg-emerald-100', activeText: 'text-emerald-700' },
  cancelled:  { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', activeBg: 'bg-slate-100', activeText: 'text-slate-500' },
  no_show:    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', activeBg: 'bg-rose-100', activeText: 'text-rose-700' },
}

interface MonthCalendarProps {
  anchorDate: Date
  onAnchorChange: (d: Date) => void
  viewMode: 'month' | 'week'
  onViewModeChange: (mode: 'month' | 'week') => void
  projects: Project[]
  onSelectProject: (project: Project) => void
  onSelectDate: (date: Date) => void
  onSelectDateTime?: (date: Date, hour: number) => void
  canCreate?: boolean
  statusFilters: Engagement['status'][]
  onToggleStatus: (status: Engagement['status']) => void
  onUpdateEngagement?: (project: Project, engagement: Engagement) => Promise<void>
}

function getEngagementsForDay(
  projects: Project[],
  day: Date,
  statusFilters: Engagement['status'][]
): { project: Project; engagement: Engagement; sortTime: number }[] {
  const result: { project: Project; engagement: Engagement; sortTime: number }[] = []
  for (const project of projects) {
    const engagement = project.engagement
    if (!engagement) continue
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)

    const inRange = (slot: { start: string; end: string }) => {
      const s = new Date(slot.start)
      const e = new Date(slot.end)
      return s <= dayEnd && e >= dayStart
    }

    const hasSlot = engagement.plannedSlots?.some(inRange)
    if (!hasSlot) continue
    if (!statusFilters.includes(engagement.status)) continue

    const actualSlot = engagement.plannedSlots?.find(s => s.isActual && inRange(s))
    const earliestPlanned = engagement.plannedSlots
      ?.filter(inRange)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]

    let sortTime = Infinity
    if (actualSlot) {
      sortTime = new Date(actualSlot.start).getTime()
    } else if (earliestPlanned) {
      sortTime = new Date(earliestPlanned.start).getTime()
    }

    result.push({ project, engagement, sortTime })
  }
  return result.sort((a, b) => a.sortTime - b.sortTime)
}

function getEventsForDay(
  projects: Project[],
  day: Date,
  statusFilters: Engagement['status'][]
): { project: Project; engagement: Engagement; slot: { start: string; end: string }; top: number; height: number }[] {
  const result: { project: Project; engagement: Engagement; slot: { start: string; end: string }; top: number; height: number }[] = []
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day)
  dayEnd.setHours(23, 59, 59, 999)

  for (const project of projects) {
    const engagement = project.engagement
    if (!engagement) continue
    if (!statusFilters.includes(engagement.status)) continue

    const slots = engagement.plannedSlots ?? []

    for (const slot of slots) {
      const s = new Date(slot.start)
      const e = new Date(slot.end)
      if (s > dayEnd || e < dayStart) continue

      const startHour = Math.max(s.getHours() + s.getMinutes() / 60, DAY_START_HOUR)
      const endHour = Math.min(e.getHours() + e.getMinutes() / 60, DAY_END_HOUR)
      if (endHour <= startHour) continue

      const top = (startHour - DAY_START_HOUR) * HOUR_HEIGHT + GRID_TOP_PADDING
      const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 20)

      result.push({ project, engagement, slot, top, height })
    }
  }

  return result.sort((a, b) => a.top - b.top)
}

export function MonthCalendar({
  anchorDate,
  onAnchorChange,
  viewMode,
  onViewModeChange,
  projects,
  onSelectProject,
  onSelectDate,
  onSelectDateTime,
  canCreate,
  statusFilters,
  onToggleStatus,
  onUpdateEngagement,
}: MonthCalendarProps) {
  const [hoveredHour, setHoveredHour] = useState<{ dayIndex: number; hour: number } | null>(null)
  const headerTitle = useMemo(() => {
    if (viewMode === 'month') {
      return format(anchorDate, 'MMMM yyyy')
    }
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 0 })
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
    if (sameMonth) {
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`
    }
    const sameYear = weekStart.getFullYear() === weekEnd.getFullYear()
    if (sameYear) {
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
    }
    return `${format(weekStart, 'MMM d, yyyy')} – ${format(weekEnd, 'MMM d, yyyy')}`
  }, [anchorDate, viewMode])

  const handlePrev = () => {
    if (viewMode === 'month') {
      onAnchorChange(subMonths(anchorDate, 1))
    } else {
      onAnchorChange(subWeeks(anchorDate, 1))
    }
  }

  const handleNext = () => {
    if (viewMode === 'month') {
      onAnchorChange(addMonths(anchorDate, 1))
    } else {
      onAnchorChange(addWeeks(anchorDate, 1))
    }
  }

  // ─── Drag-and-drop for week view events ─────────────────────────────────────

  interface EventDragState {
    project: Project
    slotId: string
    originalStart: Date
    originalEnd: Date
    originalTop: number
    originalHeight: number
    startY: number
    startX: number
    currentDeltaY: number
    originalColumn: number
    newColumn: number
    dayColumnWidth: number
  }

  const [eventDrag, setEventDrag] = useState<EventDragState | null>(null)
  const onSelectProjectRef = useRef(onSelectProject)
  onSelectProjectRef.current = onSelectProject
  const onUpdateEngagementRef = useRef(onUpdateEngagement)
  onUpdateEngagementRef.current = onUpdateEngagement

  function onEventPointerDown(
    e: React.PointerEvent,
    project: Project,
    engagement: Engagement,
    slot: { id: string; start: string; end: string },
    dayIndex: number,
    top: number,
    height: number
  ) {
    e.preventDefault()
    e.stopPropagation()
    const originalStart = new Date(slot.start)
    const originalEnd = new Date(slot.end)
    const grid = weekScrollRef.current?.firstElementChild as HTMLElement | null
    const firstDayCol = grid?.children[1] as HTMLElement | null
    const dayColumnWidth = firstDayCol?.getBoundingClientRect().width ?? 0
    setEventDrag({
      project,
      slotId: slot.id,
      originalStart,
      originalEnd,
      originalTop: top,
      originalHeight: height,
      startY: e.clientY,
      startX: e.clientX,
      currentDeltaY: 0,
      originalColumn: dayIndex,
      newColumn: dayIndex,
      dayColumnWidth,
    })
    document.body.style.cursor = 'grabbing'
  }

  useEffect(() => {
    if (!eventDrag) return
    const onMove = (e: PointerEvent) => {
      const rawDeltaY = e.clientY - eventDrag.startY
      const rawDeltaX = e.clientX - eventDrag.startX
      const snapPx = HOUR_HEIGHT / 2
      const snappedDeltaY = Math.round(rawDeltaY / snapPx) * snapPx
      const columnDelta = eventDrag.dayColumnWidth > 0
        ? Math.round(rawDeltaX / eventDrag.dayColumnWidth)
        : 0
      const newColumn = Math.max(0, Math.min(6, eventDrag.originalColumn + columnDelta))
      setEventDrag(prev => prev ? { ...prev, currentDeltaY: snappedDeltaY, newColumn } : null)
    }
    const onUp = async () => {
      const deltaHours = eventDrag.currentDeltaY / HOUR_HEIGHT
      const movedDay = eventDrag.newColumn !== eventDrag.originalColumn
      const movedTime = Math.abs(deltaHours) >= 0.5
      const wasClick = !movedDay && Math.abs(eventDrag.currentDeltaY) < 3

      if (wasClick) {
        onSelectProjectRef.current(eventDrag.project)
      } else if (movedDay || movedTime) {
        const duration = eventDrag.originalEnd.getTime() - eventDrag.originalStart.getTime()

        // Compute new time-of-day from vertical drag
        const newTime = addHours(eventDrag.originalStart, deltaHours)

        // Apply that time to the target day
        const targetDay = weekDays[eventDrag.newColumn]
        const newStart = new Date(targetDay)
        newStart.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0)
        let newEnd = new Date(newStart.getTime() + duration)

        // Clamp to day boundaries
        const minStart = new Date(newStart)
        minStart.setHours(0, 0, 0, 0)
        const maxEnd = new Date(newStart)
        maxEnd.setHours(23, 59, 59, 999)

        if (newStart < minStart) {
          newStart = new Date(minStart)
          newEnd = new Date(newStart.getTime() + duration)
        }
        if (newEnd > maxEnd) {
          newEnd = new Date(maxEnd)
          newStart = new Date(newEnd.getTime() - duration)
        }

        const engagement = eventDrag.project.engagement!
        const updatedEngagement: Engagement = {
          ...engagement,
          plannedSlots: engagement.plannedSlots!.map(s =>
            s.id === eventDrag.slotId
              ? { ...s, start: newStart.toISOString(), end: newEnd.toISOString() }
              : s
          )
        }

        const updatedProject = { ...eventDrag.project, engagement: updatedEngagement }
        await onUpdateEngagementRef.current?.(updatedProject, updatedEngagement)
      }
      document.body.style.cursor = ''
      setEventDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [eventDrag])

  // Month view data
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(anchorDate)
    const monthEnd = endOfMonth(anchorDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [anchorDate])

  const monthWeeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < monthDays.length; i += 7) {
      result.push(monthDays.slice(i, i + 7))
    }
    return result
  }, [monthDays])

  // Week view data
  const weekDays = useMemo(() => {
    const ws = startOfWeek(anchorDate, { weekStartsOn: 0 })
    const we = endOfWeek(anchorDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: ws, end: we })
  }, [anchorDate])

  const timeLabels = useMemo(() => {
    const labels: string[] = []
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
      labels.push(`${h.toString().padStart(2, '0')}:00`)
    }
    return labels
  }, [])

  const weekScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (viewMode === 'week' && weekScrollRef.current) {
      weekScrollRef.current.scrollTop = WORKING_HOUR_START * HOUR_HEIGHT
    }
  }, [viewMode, anchorDate])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">
            {headerTitle}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => onViewModeChange('month')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <CalendarIcon className="size-3" />
              Month
            </button>
            <button
              onClick={() => onViewModeChange('week')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors',
                viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <Clock className="size-3" />
              Week
            </button>
          </div>
          {/* Status filters */}
          <div className="flex items-center gap-2 shrink-0">
            {STATUS_OPTIONS.map(status => {
              const active = statusFilters.includes(status)
              const colors = STATUS_PILL_COLORS[status]
              return (
                <button
                  key={status}
                  onClick={() => onToggleStatus(status)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-opacity ${
                    active
                      ? `${colors.activeBg} ${colors.activeText} ${colors.border}`
                      : 'bg-muted text-muted-foreground/50 border-border opacity-50 hover:opacity-80'
                  }`}
                >
                  <span className={`size-1.5 rounded-full border ${active ? colors.bg : 'bg-muted-foreground/30'}`} />
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="flex-1 border rounded-lg overflow-hidden bg-background min-h-0">
          <table className="w-full h-full border-collapse table-fixed">
            <thead className="shrink-0">
              <tr className="border-b bg-muted/40">
                <th className="py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-12 border-r">
                  Wk
                </th>
                {WEEKDAYS.map(d => (
                  <th
                    key={d}
                    className="py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide border-r last:border-r-0"
                    style={{ width: 'calc((100% - 3rem) / 7)' }}
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="h-full">
              {monthWeeks.map((week, wi) => (
                <tr
                  key={wi}
                  className="border-b last:border-b-0"
                  style={{ height: `${100 / monthWeeks.length}%` }}
                >
                  <td className="border-r p-2 align-middle w-12 text-center">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      W{getISOWeek(week[0])}
                    </span>
                  </td>
                  {week.map(day => {
                    const items = getEngagementsForDay(projects, day, statusFilters)
                    const isCurrentMonth = isSameMonth(day, anchorDate)
                    const isToday = isSameDay(day, new Date())
                    return (
                      <td
                        key={day.toISOString()}
                        className={cn(
                          'border-r last:border-r-0 p-2 align-top overflow-hidden',
                          wi > 0 && 'border-t',
                          !isCurrentMonth && 'bg-muted text-muted-foreground/60',
                          isToday && 'bg-primary/5'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn('text-sm font-semibold', isToday && 'text-primary', !isCurrentMonth && 'text-muted-foreground/40')}>
                            {format(day, 'd')}
                          </span>
                          {canCreate && (
                            <button
                              onClick={() => onSelectDate(day)}
                              className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-opacity opacity-70 hover:opacity-100 shrink-0"
                              title="Add engagement"
                            >
                              <Plus className="size-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 24px)' }}>
                          {items.map(({ project, engagement }) => (
                            <button
                              key={project.id}
                              onClick={() => onSelectProject(project)}
                              className={cn(
                                'text-left text-[11px] px-2 py-1 rounded border truncate font-medium hover:opacity-80 transition-opacity w-full shrink-0',
                                STATUS_COLORS[engagement.status]
                              )}
                              title={`${project.name} — ${engagement.status}`}
                            >
                              {project.name}
                            </button>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-background flex flex-col">
          {/* Week header */}
          <div className="grid shrink-0" style={{ gridTemplateColumns: `48px repeat(7, 1fr)` }}>
            <div className="border-b border-r bg-muted/40" />
            {weekDays.map(day => {
              const isToday = isSameDay(day, new Date())
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-b border-r py-2 text-center',
                    isToday && 'bg-primary/5'
                  )}
                >
                  <div className={cn('text-xs font-medium', isToday && 'text-primary')}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn('text-sm font-semibold', isToday && 'text-primary')}>
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Time grid */}
          <div ref={weekScrollRef} className="flex-1 min-h-0 overflow-auto relative">
            <div className="grid" style={{
              gridTemplateColumns: `48px repeat(7, 1fr)`,
              height: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT + GRID_TOP_PADDING}px`
            }}>
              {/* Time labels column */}
              <div className="relative border-r bg-muted/20">
                {timeLabels.map((label, i) => (
                  <div
                    key={label}
                    className="absolute right-1 text-[10px] text-muted-foreground text-right leading-none"
                    style={{ top: `${i * HOUR_HEIGHT + GRID_TOP_PADDING - 6}px` }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIndex) => {
                const isToday = isSameDay(day, new Date())
                const events = getEventsForDay(projects, day, statusFilters)
                return (
                  <div
                    key={day.toISOString()}
                    className={cn('relative border-r', isToday && 'bg-primary/[0.02]')}
                  >
                    {/* Hour blocks (clickable + hoverable) */}
                    {timeLabels.map((_, i) => {
                      const hour = DAY_START_HOUR + i
                      const isHovered = hoveredHour?.dayIndex === dayIndex && hoveredHour?.hour === hour
                      return (
                        <div
                          key={i}
                          className={cn(
                            'absolute left-0 right-0 cursor-pointer transition-colors border-b border-border/50',
                            isHovered && 'bg-primary/10'
                          )}
                          style={{ top: `${i * HOUR_HEIGHT + GRID_TOP_PADDING}px`, height: `${HOUR_HEIGHT}px` }}
                          onMouseEnter={() => setHoveredHour({ dayIndex, hour })}
                          onMouseLeave={() => setHoveredHour(null)}
                          onClick={() => {
                            if (canCreate) {
                              onSelectDateTime?.(day, hour)
                            }
                          }}
                        />
                      )
                    })}

                    {/* Events */}
                    {events.map(({ project, engagement, slot, top, height }) => {
                      const isDragging = eventDrag?.slotId === slot.id
                      return (
                        <button
                          key={`${project.id}-${slot.id}`}
                          onPointerDown={(e) => {
                            if (!onUpdateEngagementRef.current) return
                            onEventPointerDown(e, project, engagement, slot, dayIndex, top, height)
                          }}
                          className={cn(
                            'absolute left-0.5 right-0.5 rounded border text-[10px] px-1 py-0.5 text-left font-medium hover:opacity-80 transition-opacity overflow-hidden leading-tight cursor-grab active:cursor-grabbing select-none touch-none',
                            STATUS_COLORS[engagement.status],
                            isDragging && 'opacity-30'
                          )}
                          style={{ top: `${top}px`, height: `${height}px` }}
                          title={`${project.name} — ${engagement.status}`}
                        >
                          <span className="truncate block">{project.name}</span>
                          {height >= 36 && (
                            <span className="truncate block text-[9px] opacity-70">
                              {engagement.interviewSubject || engagement.status}
                            </span>
                          )}
                        </button>
                      )
                    })}

                    {/* Drag ghost */}
                    {eventDrag?.newColumn === dayIndex && (
                      <div
                        className={cn(
                          'absolute left-0.5 right-0.5 rounded border text-[10px] px-1 py-0.5 text-left font-medium overflow-hidden leading-tight z-20 shadow-lg opacity-90 pointer-events-none select-none',
                          STATUS_COLORS[eventDrag.project.engagement!.status]
                        )}
                        style={{
                          top: `${eventDrag.originalTop + eventDrag.currentDeltaY}px`,
                          height: `${eventDrag.originalHeight}px`,
                        }}
                      >
                        <span className="truncate block">{eventDrag.project.name}</span>
                        {eventDrag.originalHeight >= 36 && (
                          <span className="truncate block text-[9px] opacity-70">
                            {eventDrag.project.engagement!.interviewSubject || eventDrag.project.engagement!.status}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Add button on hover — month view only */}
                    {canCreate && viewMode === 'month' && (
                      <button
                        onClick={() => onSelectDate(day)}
                        className="absolute top-1 right-1 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-opacity opacity-0 hover:opacity-100 shrink-0 z-10"
                        title="Add engagement"
                      >
                        <Plus className="size-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
