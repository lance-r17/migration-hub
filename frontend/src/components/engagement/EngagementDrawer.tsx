import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { CalendarIcon, Plus, Trash2, Video, FileText, Loader2, FilePenLine, Search, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { SectionEditDrawer } from '@/components/drawers/SectionEditDrawer'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { apiClient } from '@/services/client'
import { scheduleEngagementZoom } from '@/services/zoom'
import type { Project, User, Engagement, EngagementSlot } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  allUsers: User[]
  onSave: (project: Project) => Promise<void>
  readOnly?: boolean
}

const STATUS_OPTIONS: Engagement['status'][] = ['pending', 'scheduled', 'completed', 'cancelled', 'no_show', 'no_demand']

function generateSlotId() {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function parseDateTimeLocal(iso: string) {
  const d = parseISO(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toISODateTimeLocal(value: string) {
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toISOString()
}

/** Ensure a slot's start and end fall on the same calendar day. */
function clampToSameDay(startISO: string, endISO: string): { start: string; end: string } {
  if (startISO.slice(0, 10) === endISO.slice(0, 10)) {
    return { start: startISO, end: endISO }
  }
  const start = new Date(startISO)
  const clampedEnd = new Date(start)
  clampedEnd.setHours(23, 59, 0, 0)

  if (clampedEnd <= start) {
    const adjustedStart = new Date(clampedEnd)
    adjustedStart.setMinutes(adjustedStart.getMinutes() - 1)
    return { start: adjustedStart.toISOString(), end: clampedEnd.toISOString() }
  }
  return { start: startISO, end: clampedEnd.toISOString() }
}

function defaultEngagement(): Engagement {
  return {
    status: 'pending',
    plannedSlots: [],
    participantIds: [],
  }
}

export function EngagementDrawer({ open, onOpenChange, project, allUsers, onSave, readOnly }: Props) {
  const navigate = useNavigate()
  const [engagement, setEngagement] = useState<Engagement>(defaultEngagement())
  const [zoomConfigured, setZoomConfigured] = useState(false)
  const [zoomLoading, setZoomLoading] = useState(false)

  useEffect(() => {
    if (open && project?.engagement) {
      setEngagement(project.engagement)
    } else if (open) {
      setEngagement(defaultEngagement())
    }
  }, [open, project])

  useEffect(() => {
    apiClient.get<{ configured: boolean }>('/api/v1/zoom/status')
      .then(r => setZoomConfigured(r.configured))
      .catch(() => setZoomConfigured(false))
  }, [])

  const platformLeads = useMemo(
    () => allUsers.filter(u => u.role?.includes('platform_migration_lead')),
    [allUsers]
  )

  const teamMembers = useMemo(
    () => project?.team?.map(t => ({ id: t.id, name: t.name })) ?? [],
    [project]
  )

  const updateField = <K extends keyof Engagement>(key: K, value: Engagement[K]) => {
    setEngagement(prev => ({ ...prev, [key]: value }))
  }

  const addPlannedSlot = () => {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    const start = now.toISOString()
    const end = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    setEngagement(prev => ({
      ...prev,
      plannedSlots: [...(prev.plannedSlots ?? []), { id: generateSlotId(), start, end }],
    }))
  }

  const removePlannedSlot = (id: string) => {
    setEngagement(prev => ({
      ...prev,
      plannedSlots: prev.plannedSlots?.filter(s => s.id !== id) ?? [],
    }))
  }

  const updatePlannedSlot = (id: string, patch: Partial<EngagementSlot>) => {
    setEngagement(prev => ({
      ...prev,
      plannedSlots: prev.plannedSlots?.map(s => (s.id === id ? { ...s, ...patch } : s)) ?? [],
    }))
  }

  const toggleParticipant = (userId: string) => {
    setEngagement(prev => {
      const ids = new Set(prev.participantIds ?? [])
      if (ids.has(userId)) ids.delete(userId)
      else ids.add(userId)
      return { ...prev, participantIds: Array.from(ids) }
    })
  }

  const handleSave = async () => {
    if (!project) return
    if (!engagement.plannedSlots || engagement.plannedSlots.length === 0) {
      toast.error('At least one planned slot is required')
      return
    }
    const engagementToSave = { ...engagement }
    // Strip legacy actualSlot field (migrated into plannedSlots.isActual)
    delete (engagementToSave as Record<string, unknown>).actualSlot
    // Normalize every slot to the same calendar day
    engagementToSave.plannedSlots = engagementToSave.plannedSlots!.map(s => ({
      ...s,
      ...clampToSameDay(s.start, s.end),
    }))
    await onSave({ ...project, engagement: engagementToSave })
  }

  const isSaveDisabled = readOnly || !engagement.status || !engagement.plannedSlots || engagement.plannedSlots.length === 0

  const actualSlot = engagement.plannedSlots?.find(s => s.isActual)

  const setActualSlot = (id: string) => {
    setEngagement(prev => ({
      ...prev,
      plannedSlots: prev.plannedSlots?.map(s => ({ ...s, isActual: s.id === id })) ?? [],
    }))
  }

  return (
    <SectionEditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={project ? `Edit Engagement — ${project.name}` : 'Edit Engagement'}
      description="Schedule and manage migration interview arrangements."
      onSave={handleSave}
      saveDisabled={isSaveDisabled}
    >
      <div className="space-y-6">
        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </label>
          <Select
            value={engagement.status}
            onValueChange={v => updateField('status', v as Engagement['status'])}
            disabled={readOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>
                  <span className="capitalize">{s.replace('_', ' ')}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Interview Subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Interview Subject
          </label>
          <Input
            value={engagement.interviewSubject ?? ''}
            onChange={e => updateField('interviewSubject', e.target.value)}
            placeholder="e.g., Migration planning discussion"
            disabled={readOnly}
          />
        </div>

        {/* Planned Slots */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Planned Slots
            </label>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={addPlannedSlot} className="h-7 gap-1">
                <Plus className="size-3.5" />
                Add slot
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {(engagement.plannedSlots ?? []).map(slot => (
              <div key={slot.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={readOnly}>
                      <CalendarIcon className="size-3" />
                      {slot.start ? format(parseISO(slot.start), 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <Calendar
                      mode="single"
                      selected={slot.start ? parseISO(slot.start) : undefined}
                      onSelect={d => {
                        if (!d) return
                        const currentStart = slot.start ? parseISO(slot.start) : new Date()
                        const currentEnd = slot.end ? parseISO(slot.end) : new Date(currentStart.getTime() + 60 * 60 * 1000)
                        const durationMs = currentEnd.getTime() - currentStart.getTime()
                        d.setHours(currentStart.getHours(), currentStart.getMinutes())
                        const newStart = d
                        const newEnd = new Date(newStart.getTime() + durationMs)
                        const clamped = clampToSameDay(newStart.toISOString(), newEnd.toISOString())
                        updatePlannedSlot(slot.id, clamped)
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  className="h-8 w-[100px] text-xs"
                  value={slot.start ? parseDateTimeLocal(slot.start).slice(11, 16) : ''}
                  onChange={e => {
                    const datePart = slot.start ? parseDateTimeLocal(slot.start).slice(0, 10) : format(new Date(), 'yyyy-MM-dd')
                    const newStart = toISODateTimeLocal(`${datePart}T${e.target.value}`)
                    if (!newStart) return
                    let newEnd = slot.end
                    if (newStart >= (slot.end ?? '')) {
                      newEnd = new Date(new Date(newStart).getTime() + 60 * 60 * 1000).toISOString()
                    }
                    const clamped = clampToSameDay(newStart, newEnd)
                    updatePlannedSlot(slot.id, clamped)
                  }}
                  disabled={readOnly}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="time"
                  className="h-8 w-[100px] text-xs"
                  value={slot.end ? parseDateTimeLocal(slot.end).slice(11, 16) : ''}
                  onChange={e => {
                    const datePart = slot.end ? parseDateTimeLocal(slot.end).slice(0, 10) : format(new Date(), 'yyyy-MM-dd')
                    const newEnd = toISODateTimeLocal(`${datePart}T${e.target.value}`)
                    if (!newEnd) return
                    let newStart = slot.start
                    if (newEnd <= (slot.start ?? '')) {
                      newStart = new Date(new Date(newEnd).getTime() - 60 * 60 * 1000).toISOString()
                    }
                    const clamped = clampToSameDay(newStart, newEnd)
                    updatePlannedSlot(slot.id, clamped)
                  }}
                  disabled={readOnly}
                />
                {!readOnly && (
                  <Button
                    type="button"
                    variant={slot.isActual ? 'default' : 'ghost'}
                    size="sm"
                    className={cn('h-7 text-[10px] font-bold px-2', slot.isActual && 'bg-primary text-primary-foreground')}
                    onClick={() => setActualSlot(slot.id)}
                    title={slot.isActual ? 'Actual slot' : 'Set as actual slot'}
                  >
                    {slot.isActual ? 'ACT' : 'SET'}
                  </Button>
                )}
                {!readOnly && (engagement.plannedSlots?.length ?? 0) > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    onClick={() => removePlannedSlot(slot.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {(engagement.plannedSlots ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground italic">No planned slots yet.</p>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Participants
          </label>
          <div className="space-y-3">
            {platformLeads.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Platform Migration Leads</p>
                <div className="flex flex-wrap gap-2">
                  {platformLeads.map(u => (
                    <label
                      key={u.id}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs cursor-pointer transition-colors',
                        (engagement.participantIds ?? []).includes(u.id)
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-background border-input hover:bg-muted/50',
                        readOnly && 'pointer-events-none opacity-60'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-3 accent-primary"
                        checked={(engagement.participantIds ?? []).includes(u.id)}
                        onChange={() => toggleParticipant(u.id)}
                        disabled={readOnly}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {teamMembers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Project Team</p>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map(u => (
                    <label
                      key={u.id}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs cursor-pointer transition-colors',
                        (engagement.participantIds ?? []).includes(u.id)
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-background border-input hover:bg-muted/50',
                        readOnly && 'pointer-events-none opacity-60'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-3 accent-primary"
                        checked={(engagement.participantIds ?? []).includes(u.id)}
                        onChange={() => toggleParticipant(u.id)}
                        disabled={readOnly}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Engagement Manager */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Engagement Manager
          </label>
          <ManagerSelect
            value={engagement.engagementManagerId}
            options={platformLeads}
            onChange={v => updateField('engagementManagerId', v)}
            disabled={readOnly}
          />
        </div>

        {/* Notes */}
        {project?.engagement?.id && (
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              className="w-full h-9 gap-1.5 text-xs "
              onClick={() => navigate(`/engagements/${project.id}${readOnly ? '' : '/edit'}`)}
            >
              <FilePenLine className="size-3.5" />
              {readOnly ? 'View Notes' : 'Open Notes'}
            </Button>
          </div>
        )}

        {/* Confluence Page URL (read-only) */}
        {engagement.confluencePageUrl && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <FileText className="size-3" />
              Confluence Page
            </label>
            <a
              href={engagement.confluencePageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline break-all"
            >
              {engagement.confluencePageUrl}
            </a>
          </div>
        )}

        {/* Zoom Meeting */}
        {zoomConfigured && !readOnly && actualSlot && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Video className="size-3" />
              Zoom Meeting
            </label>
            {engagement.zoomMeetingUrl ? (
              <a
                href={engagement.zoomMeetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline break-all"
              >
                {engagement.zoomMeetingUrl}
              </a>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={zoomLoading}
                onClick={async () => {
                  if (!project) return
                  setZoomLoading(true)
                  try {
                    const result = await scheduleEngagementZoom(project.id)
                    setEngagement(prev => ({
                      ...prev,
                      zoomMeetingId: result.zoomMeetingId,
                      zoomMeetingUrl: result.zoomMeetingUrl,
                    }))
                    toast.success('Zoom meeting scheduled')
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : 'Failed to schedule Zoom meeting'
                    toast.error(msg)
                  } finally {
                    setZoomLoading(false)
                  }
                }}
              >
                {zoomLoading && <Loader2 className="size-3 animate-spin" />}
                Schedule Zoom Meeting
              </Button>
            )}
          </div>
        )}

        {engagement.zoomMeetingUrl && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Video className="size-3" />
              Zoom Meeting
            </label>
            <a
              href={engagement.zoomMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline break-all"
            >
              {engagement.zoomMeetingUrl}
            </a>
          </div>
        )}
      </div>
    </SectionEditDrawer>
  )
}

/* ── Searchable Manager Select ─────────────────────────────── */

interface ManagerSelectProps {
  value: string | undefined
  options: User[]
  onChange: (value: string | undefined) => void
  disabled?: boolean
}

function ManagerSelect({ value, options, onChange, disabled }: ManagerSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = options.find(u => u.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    )
  }, [options, query])

  const handleSelect = (id: string | undefined) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-8 text-sm font-normal"
          disabled={disabled}
        >
          {selected ? selected.name : 'Select manager...'}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search by name or ID..."
            className="h-7 border-0 shadow-none focus-visible:ring-0 text-sm px-0"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          <button
            className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
              !value ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
            }`}
            onClick={() => handleSelect(undefined)}
          >
            Unassigned
          </button>
          {filtered.map(u => (
            <button
              key={u.id}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between ${
                value === u.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleSelect(u.id)}
            >
              <span>{u.name}</span>
              {value === u.id && <Check className="size-3.5" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No results found.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
