import { useState, useMemo, Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Cloud, Lock, Search, Server, SlidersHorizontal, X } from 'lucide-react'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { useWaves } from '@/hooks/use-waves'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { updateEnvironmentProvision } from '@/services/projects'
import {
  DEFAULT_PROVISION_CIDR_PARENTS,
  DEFAULT_PROVISION_ALLOWED_PREFIXES,
  cidrRangesOverlap,
  formatAllowedPrefixes,
  isValidProvisionCidr,
  parseCidr,
} from '@/lib/provision-cidr'
import {
  getProvisionEntryStatus,
  type Project,
  type EnvironmentProvision,
  type EnvironmentProvisionEntry,
  type ProvisionEnvironment,
  type ProvisionZone,
  type EnvironmentProvisionStatus,
  type MigrationStrategy,
} from '@/types'
import type { ProvisionCidrParents } from '@/types/settings'

const ENV_OPTIONS: { value: ProvisionEnvironment; label: string }[] = [
  { value: 'dev', label: 'DEV' },
  { value: 'prod', label: 'PROD' },
]

const ZONE_OPTIONS: { value: ProvisionZone; label: string }[] = [
  { value: 'zoneA', label: 'Zone A' },
  { value: 'zoneB', label: 'Zone B' },
  { value: 'zoneC', label: 'Zone C' },
]

type StatusFilter = 'all' | EnvironmentProvisionStatus | 'not-scheduled'

const MIGRATION_STRATEGIES: MigrationStrategy[] = ['Lift & Shift', 'Refactor', 'Deboard']

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'not-scheduled', label: 'Not Scheduled' },
]

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${months[parseInt(month, 10) - 1]} ${year}`
}

const DEFAULT_WAVE_COLOR = '#6366F1'

function getStatusPillClasses(status: EnvironmentProvisionStatus) {
  switch (status) {
    case 'completed':
      return 'bg-primary text-primary-foreground'
    case 'in-progress':
      return 'bg-secondary text-secondary-foreground'
    case 'planned':
      return 'bg-muted text-muted-foreground'
  }
}

interface Group {
  id: string
  name: string
  color?: string
  projects: Project[]
}

export function EnvironmentProvisionPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { waves, loading: wavesLoading } = useWaves()
  const { projects: initialProjects, loading: projectsLoading } = useProjects({ fields: ['basic'] })

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)
  const [localOverrides, setLocalOverrides] = useState<Record<string, EnvironmentProvision>>({})
  const [serverUpdates, setServerUpdates] = useState<Record<string, Project>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [envFilter, setEnvFilter] = useState<ProvisionEnvironment[]>([])
  const [advFilterOpen, setAdvFilterOpen] = useState(false)
  const [selectedMigrationStrategies, setSelectedMigrationStrategies] = useState<Set<MigrationStrategy>>(new Set())
  const [provisionDateRange, setProvisionDateRange] = useState<DateRange | undefined>(undefined)
  const [provisionDateOpen, setProvisionDateOpen] = useState(false)

  const liveProjects = useMemo<Project[]>(() => {
    return initialProjects.map(project => {
      if (serverUpdates[project.id]) return serverUpdates[project.id]
      if (localOverrides[project.id]) {
        return { ...project, environmentProvision: localOverrides[project.id] }
      }
      return project
    })
  }, [initialProjects, localOverrides, serverUpdates])

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false

  const { settings: migrationSettings } = useMigrationSettings()
  const cidrParents = migrationSettings?.provisionCidrParents ?? DEFAULT_PROVISION_CIDR_PARENTS
  const allowedPrefixes = migrationSettings?.provisionAllowedPrefixes ?? DEFAULT_PROVISION_ALLOWED_PREFIXES

  /** All zone CIDRs allocated across projects — used for conflict detection in the sheet. */
  const allocatedCidrs = useMemo(() => {
    const list: { cidr: string; projectId: string; projectName: string; env: ProvisionEnvironment; zone: ProvisionZone }[] = []
    for (const p of liveProjects) {
      for (const opt of ENV_OPTIONS) {
        const entry = p.environmentProvision?.[opt.value]
        for (const zone of ZONE_OPTIONS) {
          const cidr = entry?.cidrs?.[zone.value]
          if (cidr) list.push({ cidr, projectId: p.id, projectName: p.name, env: opt.value, zone: zone.value })
        }
      }
    }
    return list
  }, [liveProjects])

  const sortedWaves = useMemo(() => {
    return [...waves].filter(w => !w.deleted).sort((a, b) => {
      const startCompare = a.startDate.localeCompare(b.startDate)
      if (startCompare !== 0) return startCompare
      return a.cutoverDate.localeCompare(b.cutoverDate)
    })
  }, [waves])

  const groups = useMemo<Group[]>(() => {
    const waveGroups = sortedWaves.map(wave => ({
      id: wave.id,
      name: wave.name,
      color: wave.color,
      projects: liveProjects.filter(p => p.waveId === wave.id).sort(sortByProvisionDate),
    }))

    const unassigned = liveProjects.filter(p => !p.waveId).sort(sortByProvisionDate)

    return [
      ...waveGroups,
      ...(unassigned.length > 0 ? [{ id: '__unassigned__', name: 'Unassigned', projects: unassigned }] : []),
    ]
  }, [sortedWaves, liveProjects])

  const filteredGroups = useMemo<Group[]>(() => {
    const term = searchTerm.trim().toLowerCase()
    return groups.map(group => {
      const filtered = group.projects.filter(project => {
        if (term) {
          const haystack = [
            project.name,
            project.id,
            project.applicationOverview?.newProjectId,
            project.applicationOverview?.migrationStrategy,
          ].filter(Boolean).join(' ').toLowerCase()
          if (!haystack.includes(term)) return false
        }

        if (statusFilter !== 'all') {
          const entries = ENV_OPTIONS.map(o => project.environmentProvision?.[o.value]).filter(Boolean)
          if (statusFilter === 'not-scheduled') {
            if (entries.some(e => e!.date)) return false
          } else {
            if (!entries.some(e => e!.date && getProvisionEntryStatus(e) === statusFilter)) return false
          }
        }

        if (envFilter.length > 0) {
          if (!envFilter.some(e => project.environmentProvision?.[e])) return false
        }

        if (selectedMigrationStrategies.size > 0) {
          const strategy = project.applicationOverview?.migrationStrategy
          if (!strategy || !selectedMigrationStrategies.has(strategy as MigrationStrategy)) return false
        }

        if (provisionDateRange?.from || provisionDateRange?.to) {
          const dates = ENV_OPTIONS.map(o => project.environmentProvision?.[o.value]?.date).filter((d): d is string => Boolean(d))
          if (dates.length === 0) return false
          const fromIso = provisionDateRange.from ? format(provisionDateRange.from, 'yyyy-MM-dd') : undefined
          const toIso = provisionDateRange.to ? format(provisionDateRange.to, 'yyyy-MM-dd') : undefined
          const anyInRange = dates.some(date => (!fromIso || date >= fromIso) && (!toIso || date <= toIso))
          if (!anyInRange) return false
        }

        return true
      })
      return { ...group, projects: filtered }
    }).filter(group => group.projects.length > 0 || (!term && statusFilter === 'all' && envFilter.length === 0 && selectedMigrationStrategies.size === 0 && !provisionDateRange?.from && !provisionDateRange?.to))
  }, [groups, searchTerm, statusFilter, envFilter, selectedMigrationStrategies, provisionDateRange])

  const allGroupIds = useMemo(() => filteredGroups.map(g => g.id), [filteredGroups])

  const isGroupCollapsed = (groupId: string) => collapsedGroups[groupId] ?? false

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const expandAll = () => {
    const next: Record<string, boolean> = {}
    for (const id of allGroupIds) next[id] = false
    setCollapsedGroups(next)
  }

  const collapseAll = () => {
    const next: Record<string, boolean> = {}
    for (const id of allGroupIds) next[id] = true
    setCollapsedGroups(next)
  }

  async function handleSave(projectId: string, provision: EnvironmentProvision): Promise<boolean> {
    setSaving(true)
    setLocalOverrides(prev => ({ ...prev, [projectId]: provision }))
    try {
      const updated = await updateEnvironmentProvision(projectId, provision)
      setServerUpdates(prev => ({ ...prev, [projectId]: updated }))
      setLocalOverrides(prev => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
      toast.success('Environment provision saved')
      return true
    } catch {
      setLocalOverrides(prev => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
      toast.error('Failed to save environment provision')
      return false
    } finally {
      setSaving(false)
    }
  }

  if (!isPlatformLead) {
    return (
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <Header />
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto p-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm mb-6">
              Environment provision priority management is only available to the Platform Migration Lead.
            </p>
            <button
              onClick={() => navigate('/waves')}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm"
            >
              Back to Waves
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = wavesLoading || projectsLoading
  const advancedFilterCount = (statusFilter !== 'all' ? 1 : 0) + envFilter.length + selectedMigrationStrategies.size
  const hasAdvancedFilter = advancedFilterCount > 0
  const hasProvisionDateFilter = provisionDateRange?.from != null || provisionDateRange?.to != null

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />

      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Filter / expand toolbar */}
            <div className="bg-background shrink-0 flex items-center gap-2 px-3 h-11 border-b">
              <div className="flex-1" />

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm w-[200px]"
                />
              </div>

              <div className="w-px h-3 bg-border" />

              <Popover open={provisionDateOpen} onOpenChange={setProvisionDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-[12px] text-muted-foreground",
                      hasProvisionDateFilter && "text-primary"
                    )}
                  >
                    <CalendarDays size={13} className={hasProvisionDateFilter ? 'text-primary' : ''} />
                    <span>
                      {provisionDateRange?.from || provisionDateRange?.to
                        ? `${provisionDateRange.from ? format(provisionDateRange.from, 'MMM d') : 'Start'}–${provisionDateRange.to ? format(provisionDateRange.to, 'MMM d') : 'End'}`
                        : 'Provision Date'}
                    </span>
                    {hasProvisionDateFilter && (
                      <span
                        className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full size-4 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation()
                          setProvisionDateRange(undefined)
                        }}
                      >
                        <X size={8} />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-semibold">Provision Date</p>
                    <p className="text-xs text-muted-foreground">Select a date range</p>
                  </div>
                  <div className="p-3">
                    <Calendar
                      mode="range"
                      selected={provisionDateRange}
                      onSelect={setProvisionDateRange}
                      numberOfMonths={1}
                    />
                  </div>
                  {hasProvisionDateFilter && (
                    <div className="p-3 border-t border-border flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => setProvisionDateRange(undefined)}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <div className="w-px h-3 bg-border" />

              <Popover open={advFilterOpen} onOpenChange={setAdvFilterOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-[12px] text-muted-foreground mr-2",
                      hasAdvancedFilter && "text-primary"
                    )}
                  >
                    <SlidersHorizontal size={13} className={hasAdvancedFilter ? 'text-primary' : ''} />
                    <span>Advanced</span>
                    {advancedFilterCount > 0 && (
                      <span className="absolute -top-1 -right-4 text-[10px] bg-primary text-primary-foreground rounded-full size-4 flex items-center justify-center">
                        {advancedFilterCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[28rem] p-0" align="end">
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-semibold">Advanced Filters</p>
                    <p className="text-xs text-muted-foreground">Filter by status, environment, and migration strategy</p>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto p-4 space-y-5">
                    {/* Status */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_FILTER_OPTIONS.filter(opt => opt.value !== 'all').map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setStatusFilter(prev => prev === opt.value ? 'all' : opt.value as StatusFilter)}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] transition-colors",
                              statusFilter === opt.value
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-border text-foreground hover:bg-muted"
                            )}
                          >
                            {statusFilter === opt.value && <Check size={12} />}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Environment */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Environment</p>
                      <div className="flex flex-wrap gap-2">
                        {ENV_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setEnvFilter(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] transition-colors",
                              envFilter.includes(opt.value)
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-border text-foreground hover:bg-muted"
                            )}
                          >
                            {envFilter.includes(opt.value) && <Check size={12} />}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Migration Strategy */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Migration Strategy</p>
                      <div className="flex flex-wrap gap-2">
                        {MIGRATION_STRATEGIES.map(s => (
                          <button
                            key={s}
                            onClick={() => setSelectedMigrationStrategies(prev => {
                              const next = new Set(prev)
                              if (next.has(s)) next.delete(s)
                              else next.add(s)
                              return next
                            })}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] transition-colors",
                              selectedMigrationStrategies.has(s)
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-border text-foreground hover:bg-muted"
                            )}
                          >
                            {selectedMigrationStrategies.has(s) && <Check size={12} />}
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {hasAdvancedFilter && (
                    <div className="p-3 border-t border-border flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          setStatusFilter('all')
                          setEnvFilter([])
                          setSelectedMigrationStrategies(new Set())
                        }}
                      >
                        Clear all
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <div className="w-px h-3 bg-border" />

              <button
                onClick={expandAll}
                className="text-[12px] text-muted-foreground bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                <ChevronsDownUp size={13} />
                <span>Expand all</span>
              </button>

              <div className="w-px h-3 bg-border" />

              <button
                onClick={collapseAll}
                className="text-[12px] text-muted-foreground bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                <ChevronsUpDown size={13} />
                <span>Collapse all</span>
              </button>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full caption-bottom text-[13px] bg-background">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow className="bg-background hover:bg-background border-b">
                    <TableHead className="w-12 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0 text-right">#</TableHead>
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">Name</TableHead>
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">Project ID</TableHead>
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">New Project ID</TableHead>
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">Migration Strategy</TableHead>
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">DEV Date</TableHead>
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">PROD Date</TableHead>
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">Provision Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.length > 0 && filteredGroups.some(g => g.projects.length > 0) ? (
                    filteredGroups.map(group => {
                      const collapsed = isGroupCollapsed(group.id)
                      return (
                        <Fragment key={group.id}>
                          <TableRow
                            className="bg-muted hover:bg-muted cursor-pointer border-b"
                            onClick={() => toggleGroup(group.id)}
                          >
                            <TableCell className="w-12 px-2 border-r border-border">
                              <div className="flex items-center justify-end h-full">
                                {group.id !== '__unassigned__' && (
                                  <span
                                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ background: group.color ?? DEFAULT_WAVE_COLOR }}
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell colSpan={7} className="px-2 border-r border-border last:border-r-0">
                              <div className="flex items-center gap-2">
                                {collapsed ? (
                                  <ChevronRight className="size-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="size-3.5 text-muted-foreground" />
                                )}
                                {group.id === '__unassigned__' ? (
                                  <Server className="size-3.5 text-muted-foreground" />
                                ) : null}
                                <span className="font-semibold text-[13px] text-foreground">{group.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {group.projects.length}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>

                          {!collapsed &&
                            group.projects.map((project, index) => {
                              const devEntry = project.environmentProvision?.dev
                              const prodEntry = project.environmentProvision?.prod
                              return (
                                <TableRow
                                  key={project.id}
                                  className="bg-background hover:bg-background cursor-pointer border-b"
                                  onClick={() => setSelectedProject(project)}
                                >
                                  <TableCell className="text-[12px] text-muted-foreground font-semibold text-right px-2 border-r border-border last:border-r-0">{index + 1}</TableCell>
                                  <TableCell className="text-[13px] text-foreground truncate px-2 border-r border-border last:border-r-0">
                                    <Link
                                      to={`/projects/${project.id}`}
                                      className="inline-block max-w-full truncate text-foreground hover:text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {project.name}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-[12px] text-muted-foreground font-mono px-2 border-r border-border last:border-r-0">{project.id}</TableCell>
                                  <TableCell className="text-[12px] text-muted-foreground font-mono px-2 border-r border-border last:border-r-0">
                                    {project.applicationOverview?.newProjectId ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-[12px] text-muted-foreground px-2 border-r border-border last:border-r-0">
                                    {project.applicationOverview?.migrationStrategy ?? '—'}
                                  </TableCell>
                                  <TableCell className="text-[12px] text-muted-foreground px-2 border-r border-border last:border-r-0">
                                    {formatDate(devEntry?.date)}
                                  </TableCell>
                                  <TableCell className="text-[12px] text-muted-foreground px-2 border-r border-border last:border-r-0">
                                    {formatDate(prodEntry?.date)}
                                  </TableCell>
                                  <TableCell className="px-2 border-r border-border last:border-r-0">
                                    <div className="flex flex-wrap gap-1">
                                      {ENV_OPTIONS.map(opt => {
                                        const entry = opt.value === 'dev' ? devEntry : prodEntry
                                        if (!entry?.date && !entry?.completedAt) return null
                                        const status = getProvisionEntryStatus(entry)
                                        return (
                                          <span key={opt.value} className={cn("py-0.5 px-[7px] rounded-full text-[11px] font-medium whitespace-nowrap border border-transparent capitalize", getStatusPillClasses(status))}>
                                            {opt.label} {status.replace('-', ' ')}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}

                          {!collapsed && group.projects.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-[13px] text-muted-foreground px-2">
                                No projects in this wave.
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-[13px] text-muted-foreground px-2">
                        No projects found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ProvisionSheet
        key={selectedProject?.id ?? 'empty'}
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onSave={handleSave}
        saving={saving}
        cidrParents={cidrParents}
        allowedPrefixes={allowedPrefixes}
        allocatedCidrs={allocatedCidrs}
      />
    </div>
  )
}

function Header() {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/40">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Cloud size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-lg leading-none">Environment Provision Priority</h2>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">
            Manage project environment provision dates and environments by wave.
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate('/waves')}
        className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back to Waves</span>
      </button>
    </div>
  )
}

interface AllocatedCidr {
  cidr: string
  projectId: string
  projectName: string
  env: ProvisionEnvironment
  zone: ProvisionZone
}

interface EnvDraft {
  checked: boolean
  date?: string
  cidrs: Partial<Record<ProvisionZone, string>>
  completedAt?: string | null
}

interface ProvisionSheetProps {
  project: Project | null
  onClose: () => void
  onSave: (projectId: string, provision: EnvironmentProvision) => Promise<boolean>
  saving: boolean
  cidrParents: ProvisionCidrParents
  allowedPrefixes: number[]
  allocatedCidrs: AllocatedCidr[]
}

function draftFromEntry(entry: EnvironmentProvisionEntry | undefined): EnvDraft {
  return {
    checked: !!entry,
    date: entry?.date,
    cidrs: { ...entry?.cidrs },
    completedAt: entry?.completedAt ?? null,
  }
}

function zoneLabel(zone: ProvisionZone): string {
  return ZONE_OPTIONS.find(z => z.value === zone)?.label ?? zone
}

function ProvisionSheet({ project, onClose, onSave, saving, cidrParents, allowedPrefixes, allocatedCidrs }: ProvisionSheetProps) {
  const [dev, setDev] = useState<EnvDraft>(() => draftFromEntry(project?.environmentProvision?.dev))
  const [prod, setProd] = useState<EnvDraft>(() => draftFromEntry(project?.environmentProvision?.prod))
  const [confirmEnv, setConfirmEnv] = useState<ProvisionEnvironment | null>(null)

  if (!project) return null

  const drafts: Record<ProvisionEnvironment, EnvDraft> = { dev, prod }

  function cidrError(env: ProvisionEnvironment, zone: ProvisionZone, value: string | undefined): string | null {
    const v = (value ?? '').trim()
    if (!v) return null
    if (!parseCidr(v)) return `Invalid CIDR format (expected e.g. 10.248.32.0/${allowedPrefixes[0] ?? 26})`
    if (!isValidProvisionCidr(v, cidrParents[env][zone], allowedPrefixes)) {
      return `Must be a ${formatAllowedPrefixes(allowedPrefixes)} block within: ${cidrParents[env][zone].join(', ')}`
    }
    const conflict = allocatedCidrs.find(a => a.projectId !== project!.id && cidrRangesOverlap(a.cidr, v))
    if (conflict) return `Conflicts with ${conflict.projectName} (${conflict.env.toUpperCase()} ${zoneLabel(conflict.zone)}: ${conflict.cidr})`
    return null
  }

  const hasCidrErrors = ENV_OPTIONS.some(o =>
    drafts[o.value].checked && ZONE_OPTIONS.some(z => cidrError(o.value, z.value, drafts[o.value].cidrs[z.value]))
  )
  const canSave =
    (dev.checked || prod.checked) &&
    (!dev.checked || !!dev.date) &&
    (!prod.checked || !!prod.date) &&
    !hasCidrErrors

  function buildProvision(nextDev: EnvDraft, nextProd: EnvDraft): EnvironmentProvision {
    const provision: EnvironmentProvision = {}
    for (const opt of ENV_OPTIONS) {
      const d = opt.value === 'dev' ? nextDev : nextProd
      if (!d.checked) continue  // unchecked environment discards its data
      const cidrs = Object.fromEntries(
        ZONE_OPTIONS.map(z => [z.value, (d.cidrs[z.value] ?? '').trim()]).filter(([, v]) => v)
      ) as Partial<Record<ProvisionZone, string>>
      provision[opt.value] = {
        date: d.date,
        cidrs: Object.keys(cidrs).length ? cidrs : undefined,
        completedAt: d.completedAt ?? null,
      }
    }
    return provision
  }

  function handleSave() {
    if (!project) return
    void onSave(project.id, buildProvision(dev, prod))
  }

  async function handleConfirmComplete() {
    if (!project || !confirmEnv) return
    const draft = drafts[confirmEnv]
    const next: EnvDraft = { ...draft, completedAt: draft.completedAt ? null : new Date().toISOString() }
    const [nextDev, nextProd] = confirmEnv === 'dev' ? [next, prod] : [dev, next]
    const success = await onSave(project.id, buildProvision(nextDev, nextProd))
    if (success) {
      if (confirmEnv === 'dev') setDev(next); else setProd(next)
      setConfirmEnv(null)
    }
  }

  function renderEnvSection(opt: { value: ProvisionEnvironment; label: string }, draft: EnvDraft, setDraft: (d: EnvDraft) => void) {
    const status = draft.checked && (draft.date || draft.completedAt)
      ? getProvisionEntryStatus({ date: draft.date, completedAt: draft.completedAt })
      : null
    return (
      <div key={opt.value} className="rounded-lg border border-border overflow-hidden">
        <label className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer transition-colors">
          <Checkbox
            checked={draft.checked}
            onCheckedChange={() => setDraft({ ...draft, checked: !draft.checked })}
          />
          <span className="text-sm font-medium flex-1">{opt.label}</span>
          {status && (
            <span className={cn("py-0.5 px-[7px] rounded-full text-[11px] font-medium capitalize", getStatusPillClasses(status))}>
              {status.replace('-', ' ')}
            </span>
          )}
        </label>
        {draft.checked && (
          <div className="border-t border-border px-3 py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-muted-foreground" />
                {opt.label} Provision Date
              </Label>
              <Calendar
                className="w-full mx-auto"
                mode="single"
                selected={draft.date ? new Date(draft.date + 'T00:00:00') : undefined}
                defaultMonth={draft.date ? new Date(draft.date + 'T00:00:00') : undefined}
                onSelect={d => setDraft({ ...draft, date: d ? format(d, 'yyyy-MM-dd') : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Zone CIDR Blocks <span className="text-muted-foreground font-normal">(optional, {formatAllowedPrefixes(allowedPrefixes)})</span>
              </Label>
              {ZONE_OPTIONS.map(z => {
                const value = draft.cidrs[z.value] ?? ''
                const error = cidrError(opt.value, z.value, value)
                const parentHint = cidrParents[opt.value][z.value][0]
                return (
                  <div key={z.value} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">{z.label}</span>
                      <Input
                        value={value}
                        onChange={e => setDraft({ ...draft, cidrs: { ...draft.cidrs, [z.value]: e.target.value } })}
                        placeholder={parentHint ? `${parentHint.replace(/\/\d+$/, `/${allowedPrefixes[0] ?? 26}`)}` : 'a.b.c.d/26'}
                        className={cn('h-8 text-xs font-mono', error && 'border-destructive')}
                      />
                    </div>
                    {error && <p className="text-[11px] text-destructive pl-16">{error}</p>}
                  </div>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmEnv(opt.value)}
              disabled={saving}
            >
              {draft.completedAt ? `Reopen ${opt.label} Provision` : `Mark ${opt.label} Completed`}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const confirmDraft = confirmEnv ? drafts[confirmEnv] : null
  const confirmLabel = confirmEnv === 'dev' ? 'DEV' : 'PROD'

  return (
    <>
      <Sheet open={!!project} onOpenChange={open => { if (!open) { setConfirmEnv(null); onClose() } }}>
      <SheetContent side="right" className="w-[540px] sm:!max-w-[540px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle className="text-lg">{project.name}</SheetTitle>
          <SheetDescription className="text-xs font-mono text-muted-foreground">
            {project.id}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Label className="text-sm font-medium">Environments to Provision</Label>
          {renderEnvSection(ENV_OPTIONS[0], dev, setDev)}
          {renderEnvSection(ENV_OPTIONS[1], prod, setProd)}
          {!canSave && (dev.checked || prod.checked) && !hasCidrErrors && (
            <p className="text-[11px] text-muted-foreground">Each checked environment requires a provision date.</p>
          )}
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-end">
          <SheetClose asChild>
            <Button variant="outline" disabled={saving}>Cancel</Button>
          </SheetClose>
          <Button
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

      <Dialog open={!!confirmEnv} onOpenChange={open => { if (!open) setConfirmEnv(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDraft?.completedAt ? `Reopen ${confirmLabel} provision?` : `Mark ${confirmLabel} provision as completed?`}
            </DialogTitle>
            <DialogDescription>
              {confirmDraft?.completedAt
                ? `Are you sure you want to reopen ${confirmLabel} environment provision for ${project.name}?`
                : `Are you sure you want to mark ${confirmLabel} environment provision as completed for ${project.name}? This action will be recorded in the audit log.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnv(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete} disabled={saving}>
              {saving ? 'Saving...' : (confirmDraft?.completedAt ? 'Reopen' : 'Mark Completed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function earliestProvisionDate(p: Project): string | undefined {
  const dates = [p.environmentProvision?.dev?.date, p.environmentProvision?.prod?.date]
    .filter((d): d is string => Boolean(d))
  return dates.length ? dates.sort()[0] : undefined
}

function sortByProvisionDate(a: Project, b: Project): number {
  const aDate = earliestProvisionDate(a)
  const bDate = earliestProvisionDate(b)
  if (aDate && bDate) return aDate.localeCompare(bDate)
  if (aDate && !bDate) return -1
  if (!aDate && bDate) return 1
  return a.name.localeCompare(b.name)
}
