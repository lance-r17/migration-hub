import { useState, useMemo, Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Cloud, Lock, Search, Server, SlidersHorizontal } from 'lucide-react'
import { format } from 'date-fns'
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
import { updateEnvironmentProvision } from '@/services/projects'
import {
  getEnvironmentProvisionStatus,
  type Project,
  type EnvironmentProvision,
  type ProvisionEnvironment,
  type EnvironmentProvisionStatus,
  type MigrationStrategy,
} from '@/types'

const ENV_OPTIONS: { value: ProvisionEnvironment; label: string }[] = [
  { value: 'dev', label: 'DEV' },
  { value: 'prod', label: 'PROD' },
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

  const sortedWaves = useMemo(() => {
    return [...waves].sort((a, b) => {
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
          const date = project.environmentProvision?.date
          if (statusFilter === 'not-scheduled') {
            if (date) return false
          } else {
            if (!date || getEnvironmentProvisionStatus(project.environmentProvision) !== statusFilter) return false
          }
        }

        if (envFilter.length > 0) {
          const envs = project.environmentProvision?.environments ?? []
          if (!envs.some(e => envFilter.includes(e))) return false
        }

        if (selectedMigrationStrategies.size > 0) {
          const strategy = project.applicationOverview?.migrationStrategy
          if (!strategy || !selectedMigrationStrategies.has(strategy as MigrationStrategy)) return false
        }

        return true
      })
      return { ...group, projects: filtered }
    }).filter(group => group.projects.length > 0 || (!term && statusFilter === 'all' && envFilter.length === 0 && selectedMigrationStrategies.size === 0))
  }, [groups, searchTerm, statusFilter, envFilter, selectedMigrationStrategies])

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
                    <TableHead className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.03em] px-2 border-r border-border last:border-r-0">Provision Date</TableHead>
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
                            <TableCell colSpan={6} className="px-2 border-r border-border last:border-r-0">
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
                              const provisionDate = project.environmentProvision?.date
                              const status = getEnvironmentProvisionStatus(project.environmentProvision)
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
                                    {formatDate(provisionDate)}
                                  </TableCell>
                                  <TableCell className="px-2 border-r border-border last:border-r-0">
                                    {provisionDate ? (
                                      <span className={cn("py-0.5 px-[7px] rounded-full text-[11px] font-medium whitespace-nowrap border border-transparent capitalize", getStatusPillClasses(status))}>
                                        {status.replace('-', ' ')}
                                      </span>
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                              )
                            })}

                          {!collapsed && group.projects.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-[13px] text-muted-foreground px-2">
                                No projects in this wave.
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-[13px] text-muted-foreground px-2">
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

interface ProvisionSheetProps {
  project: Project | null
  onClose: () => void
  onSave: (projectId: string, provision: EnvironmentProvision) => Promise<boolean>
  saving: boolean
}

function ProvisionSheet({ project, onClose, onSave, saving }: ProvisionSheetProps) {
  const [date, setDate] = useState<string | undefined>(project?.environmentProvision?.date)
  const [environments, setEnvironments] = useState<ProvisionEnvironment[]>(project?.environmentProvision?.environments ?? [])
  const [completedAt, setCompletedAt] = useState<string | null | undefined>(project?.environmentProvision?.completedAt)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!project) return null

  const isCompleted = !!completedAt

  function toggleEnvironment(value: ProvisionEnvironment) {
    setEnvironments(prev => {
      if (prev.includes(value)) return prev.filter(v => v !== value)
      return [...prev, value].sort()
    })
  }

  function handleMarkCompleted() {
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (!project) return
    const nextCompletedAt = isCompleted ? null : new Date().toISOString()
    const provision: EnvironmentProvision = {
      date,
      environments: environments.length > 0 ? environments : undefined,
      completedAt: nextCompletedAt,
    }
    const success = await onSave(project.id, provision)
    if (success) {
      setCompletedAt(nextCompletedAt)
      setConfirmOpen(false)
    }
  }

  function handleSave() {
    if (!project) return
    const provision: EnvironmentProvision = {
      date,
      environments: environments.length > 0 ? environments : undefined,
      completedAt: completedAt,
    }
    void onSave(project.id, provision)
  }

  return (
    <>
      <Sheet open={!!project} onOpenChange={open => { if (!open) { setConfirmOpen(false); onClose() } }}>
      <SheetContent side="right" className="w-[540px] sm:!max-w-[540px] flex flex-col p-0 gap-0" showCloseButton={false}>
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle className="text-lg">{project.name}</SheetTitle>
          <SheetDescription className="text-xs font-mono text-muted-foreground">
            {project.id}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              Provision Date
            </Label>
            <Calendar
              className="w-full mx-auto"
              mode="single"
              selected={date ? new Date(date + 'T00:00:00') : undefined}
              defaultMonth={date ? new Date(date + 'T00:00:00') : undefined}
              onSelect={(d) => setDate(d ? format(d, 'yyyy-MM-dd') : undefined)}
              initialFocus
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Environments to Provision</Label>
            <div className="flex flex-col gap-3">
              {ENV_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={environments.includes(opt.value)}
                    onCheckedChange={() => toggleEnvironment(opt.value)}
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-between">
          <Button
            variant="outline"
            onClick={handleMarkCompleted}
            disabled={saving}
          >
            {isCompleted ? 'Reopen Environment Provision' : 'Mark Completed'}
          </Button>
          <div className="flex items-center gap-2">
            <SheetClose asChild>
              <Button variant="outline" disabled={saving}>Cancel</Button>
            </SheetClose>
            <Button
              onClick={handleSave}
              disabled={saving || !date}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isCompleted ? 'Reopen environment provision?' : 'Mark environment provision as completed?'}
            </DialogTitle>
            <DialogDescription>
              {isCompleted
                ? `Are you sure you want to reopen environment provision for ${project.name}?`
                : `Are you sure you want to mark environment provision as completed for ${project.name}? This action will be recorded in the audit log.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? 'Saving...' : (isCompleted ? 'Reopen' : 'Mark Completed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function sortByProvisionDate(a: Project, b: Project): number {
  const aDate = a.environmentProvision?.date
  const bDate = b.environmentProvision?.date
  if (aDate && bDate) return aDate.localeCompare(bDate)
  if (aDate && !bDate) return -1
  if (!aDate && bDate) return 1
  return a.name.localeCompare(b.name)
}
