import { useState, useMemo, useEffect } from 'react'
import { CalendarDays, Pencil, Tag, Network, SlidersHorizontal, Check, Search, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { MonthCalendar } from '@/components/engagement/MonthCalendar'
import { EngagementDrawer } from '@/components/engagement/EngagementDrawer'
import { AppShell } from '@/components/layout/AppShell'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { useCategoryMilestones } from '@/hooks/use-category-milestones'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { getGbiHierarchy } from '@/services/gbi'
import { apiClient } from '@/services/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiAutocomplete } from '@/components/ui/multi-autocomplete'
import { GbiTree } from '@/components/gbi/GbiTree'
import { cn } from '@/lib/utils'
import {
  filterGbiTree,
  collectAllIds,
  findNodeById,
  isDescendantOf,
  pruneEmptySelections,
  promoteFullSelections,
} from '@/lib/gbi-utils'
import type { Project, User, Engagement, MigrationStrategy, ApplicationTier } from '@/types'
import type { GbiNode } from '@/types/gbi'
import type { SelectAction } from '@/components/gbi/GbiTree'

function generateSlotId() {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function buildDefaultEngagement(date: Date, project: Project, startHour?: number | null): Engagement {
  const start = new Date(date)
  start.setHours(startHour ?? 10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(start.getHours() + 1, 0, 0, 0)
  const baId = project.applicationOverview?.baId
  const subject = baId
    ? `Migration Solution Review - ${project.id} - ${baId}`
    : `Migration Solution Review - ${project.id}`
  return {
    status: 'pending',
    interviewSubject: subject,
    plannedSlots: [{ id: generateSlotId(), start: start.toISOString(), end: end.toISOString(), isActual: true }],
    participantIds: [],
  }
}

export function EngagementCalendarPage() {
  const { user } = useCurrentUser()
  const { projects, loading, refresh } = useProjects({ fields: ['basic', 'engagement', 'team', 'availability', 'target_architecture'] })
  const { categoryMilestones } = useCategoryMilestones()
  const { settings: migrationSettings } = useMigrationSettings()
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [createDate, setCreateDate] = useState<Date | null>(null)
  const [createHour, setCreateHour] = useState<number | null>(null)
  const [createProjectId, setCreateProjectId] = useState<string>('')
  const [projectSearch, setProjectSearch] = useState('')
  const [statusFilters, setStatusFilters] = useState<Engagement['status'][]>(['pending', 'scheduled', 'completed', 'cancelled', 'no_show', 'no_demand'])

  // ─── Category Milestone filter ──────────────────────────────────────────────
  const [cmFilter, setCmFilter] = useState<Set<string>>(new Set())

  // ─── GBI filter ─────────────────────────────────────────────────────────────
  const [gbiRoot, setGbiRoot] = useState<GbiNode | null>(null)
  const [gbiFilterOpen, setGbiFilterOpen] = useState(false)
  const [dialogGbiFilterOpen, setDialogGbiFilterOpen] = useState(false)
  const [gbiFilterSearch, setGbiFilterSearch] = useState('')
  const [selectedGbiIds, setSelectedGbiIds] = useState<Set<string>>(new Set())
  const [excludedGbiIds, setExcludedGbiIds] = useState<Set<string>>(new Set())

  // ─── Advanced filter ────────────────────────────────────────────────────────
  const [advFilterOpen, setAdvFilterOpen] = useState(false)
  const [dialogAdvFilterOpen, setDialogAdvFilterOpen] = useState(false)
  const [selectedMigrationStrategies, setSelectedMigrationStrategies] = useState<Set<MigrationStrategy>>(new Set())
  const [selectedApplicationTiers, setSelectedApplicationTiers] = useState<Set<ApplicationTier>>(new Set())
  const [selectedReArch, setSelectedReArch] = useState<Set<'yes' | 'no' | 'unset'>>(new Set())
  const [selectedRtos, setSelectedRtos] = useState<Set<string>>(new Set())
  const [selectedRpos, setSelectedRpos] = useState<Set<string>>(new Set())
  const [rtoSearch, setRtoSearch] = useState('')
  const [rpoSearch, setRpoSearch] = useState('')

  // ─── Engagement Manager filter ──────────────────────────────────────────────
  const [selectedEngagementManagerIds, setSelectedEngagementManagerIds] = useState<Set<string>>(new Set())

  // Fetch all users for participant/manager selection
  useEffect(() => {
    apiClient.get<User[]>('/api/v1/users').then(setAllUsers).catch(() => {})
  }, [])

  // Fetch GBI hierarchy
  useEffect(() => {
    let cancelled = false
    getGbiHierarchy()
      .then(data => { if (!cancelled) setGbiRoot(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const isGbiCloudLead = user?.role.includes('gbi_cloud_lead') ?? false
  const canUseGbiFilter = isPlatformLead || isGbiCloudLead
  const gbiScopeIds = isPlatformLead ? null : (user?.gbi_ids ?? null)
  const gbiMaxDepth = migrationSettings?.gbiTierDepth ?? null

  // ─── Filter computations ────────────────────────────────────────────────────
  const hasCmFilter = cmFilter.size > 0
  const matchingCmIds = useMemo(() => {
    if (!hasCmFilter) return null
    const set = new Set<string>()
    for (const p of projects) {
      if (p.categoryMilestoneIds?.some(id => cmFilter.has(id))) set.add(p.id)
    }
    return set
  }, [hasCmFilter, cmFilter, projects])

  const filteredGbiRoot = useMemo(() => {
    if (!gbiRoot) return null
    const filtered = filterGbiTree([gbiRoot], gbiFilterSearch)
    return filtered[0] ?? null
  }, [gbiRoot, gbiFilterSearch])

  const selectedGbiDescendantIds = useMemo(() => {
    if (!gbiRoot || selectedGbiIds.size === 0) return null
    const allIds = new Set<string>()
    for (const id of selectedGbiIds) {
      const node = findNodeById(gbiRoot, id)
      if (node) collectAllIds(node).forEach(i => allIds.add(i))
    }
    for (const eid of excludedGbiIds) {
      const node = findNodeById(gbiRoot, eid)
      if (node) collectAllIds(node).forEach(i => allIds.delete(i))
    }
    return allIds
  }, [gbiRoot, selectedGbiIds, excludedGbiIds])

  const hasGbiFilter = selectedGbiIds.size > 0

  const hasAdvFilter = selectedMigrationStrategies.size > 0 || selectedApplicationTiers.size > 0 || selectedReArch.size > 0 || selectedRtos.size > 0 || selectedRpos.size > 0
  const advFilterCount = selectedMigrationStrategies.size + selectedApplicationTiers.size + selectedReArch.size + selectedRtos.size + selectedRpos.size

  const hasEngagementManagerFilter = selectedEngagementManagerIds.size > 0
  const availableEngagementManagers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const p of projects) {
      const mgrId = p.engagement?.engagementManagerId
      if (mgrId) {
        const u = allUsers.find(user => user.id === mgrId)
        if (u) map.set(mgrId, { id: mgrId, name: u.name })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, allUsers])

  const matchingEngagementManagerIds = useMemo(() => {
    if (!hasEngagementManagerFilter) return null
    const set = new Set<string>()
    for (const p of projects) {
      if (p.engagement?.engagementManagerId && selectedEngagementManagerIds.has(p.engagement.engagementManagerId)) {
        set.add(p.id)
      }
    }
    return set
  }, [hasEngagementManagerFilter, selectedEngagementManagerIds, projects])

  const availableRtos = useMemo(() => [...new Set(projects.map(p => p.availability?.rto).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b)), [projects])
  const availableRpos = useMemo(() => [...new Set(projects.map(p => p.availability?.rpo).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b)), [projects])

  const matchingAdvIds = useMemo(() => {
    if (!hasAdvFilter) return null
    const set = new Set<string>()
    for (const p of projects) {
      const strategy = p.applicationOverview?.migrationStrategy
      const tier = p.applicationOverview?.applicationTier
      const reArch = p.targetArchitecture?.reArchitectureNeeded
      const rto = p.availability?.rto
      const rpo = p.availability?.rpo
      let ok = true
      if (selectedMigrationStrategies.size > 0 && (!strategy || !selectedMigrationStrategies.has(strategy))) ok = false
      if (selectedApplicationTiers.size > 0 && (!tier || !selectedApplicationTiers.has(tier))) ok = false
      if (selectedReArch.size > 0) {
        if (reArch === true && !selectedReArch.has('yes')) ok = false
        else if (reArch === false && !selectedReArch.has('no')) ok = false
        else if (reArch === undefined && !selectedReArch.has('unset')) ok = false
      }
      if (selectedRtos.size > 0 && (!rto || !selectedRtos.has(rto))) ok = false
      if (selectedRpos.size > 0 && (!rpo || !selectedRpos.has(rpo))) ok = false
      if (ok) set.add(p.id)
    }
    return set
  }, [hasAdvFilter, selectedMigrationStrategies, selectedApplicationTiers, selectedReArch, selectedRtos, selectedRpos, projects])

  const projectsWithEngagement = useMemo(() => {
    return projects.filter(p => {
      if (!p.engagement) return false
      if (hasCmFilter && !matchingCmIds?.has(p.id)) return false
      if (hasGbiFilter && (!p.gbi_id || !selectedGbiDescendantIds!.has(p.gbi_id))) return false
      if (hasAdvFilter && !matchingAdvIds?.has(p.id)) return false
      if (hasEngagementManagerFilter && !matchingEngagementManagerIds?.has(p.id)) return false
      return true
    })
  }, [projects, hasCmFilter, matchingCmIds, hasGbiFilter, selectedGbiDescendantIds, hasAdvFilter, matchingAdvIds, hasEngagementManagerFilter, matchingEngagementManagerIds])

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setDrawerOpen(true)
  }

  const handleSave = async (updatedProject: Project) => {
    try {
      await apiClient.patch(`/api/v1/projects/${updatedProject.id}/sections/engagement`, {
        value: updatedProject.engagement,
      })
      toast.success('Engagement saved')
      setDrawerOpen(false)
      setCreateDate(null)
      setCreateProjectId('')
      refresh()
    } catch {
      toast.error('Failed to save engagement')
    }
  }

  const handleSelectDate = (date: Date) => {
    setCreateDate(date)
    setCreateHour(null)
    setCreateProjectId('')
    setProjectSearch('')
  }

  const handleSelectDateTime = (date: Date, hour: number) => {
    setCreateDate(date)
    setCreateHour(hour)
    setCreateProjectId('')
    setProjectSearch('')
  }

  const handleCreateEngagement = () => {
    if (!createDate || !createProjectId) return
    const project = projects.find(p => p.id === createProjectId)
    if (!project) return
    const updated: Project = {
      ...project,
      engagement: buildDefaultEngagement(createDate, project, createHour),
    }
    setSelectedProject(updated)
    setDrawerOpen(true)
    setCreateDate(null)
    setCreateProjectId('')
    setProjectSearch('')
  }

  const dialogFilteredProjects = useMemo(() => {
    let result = projects
    const q = projectSearch.trim().toLowerCase()
    if (q) {
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    }
    if (cmFilter.size > 0) {
      result = result.filter(p => p.categoryMilestoneIds?.some(id => cmFilter.has(id)))
    }
    if (hasGbiFilter) {
      result = result.filter(p => p.gbi_id && selectedGbiDescendantIds!.has(p.gbi_id))
    }
    if (hasAdvFilter) {
      result = result.filter(p => matchingAdvIds?.has(p.id))
    }
    return result
  }, [projects, projectSearch, cmFilter, hasGbiFilter, selectedGbiDescendantIds, hasAdvFilter, matchingAdvIds])

  const selectedProjectHasEngagement = useMemo(() => {
    return projects.find(p => p.id === createProjectId)?.engagement != null
  }, [projects, createProjectId])

  const handleEditEngagement = (project: Project) => {
    setSelectedProject(project)
    setDrawerOpen(true)
    setCreateDate(null)
    setCreateProjectId('')
  }

  const handleUpdateEngagement = async (project: Project, engagement: Engagement) => {
    try {
      await apiClient.patch(`/api/v1/projects/${project.id}/sections/engagement`, {
        value: engagement,
      })
      toast.success('Engagement updated')
      refresh()
    } catch {
      toast.error('Failed to update engagement')
    }
  }

  return (
    <AppShell title="Engagement Calendar">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Engagement Calendar</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Schedule and manage migration interviews across all projects.
            </p>
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Loading projects...
          </div>
        ) : (
          <MonthCalendar
            anchorDate={anchorDate}
            onAnchorChange={setAnchorDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            projects={projectsWithEngagement}
            onSelectProject={handleSelectProject}
            onSelectDate={handleSelectDate}
            onSelectDateTime={handleSelectDateTime}
            canCreate={isPlatformLead}
            statusFilters={statusFilters}
            onToggleStatus={status => {
              setStatusFilters(prev =>
                prev.includes(status)
                  ? prev.filter(s => s !== status)
                  : [...prev, status]
              )
            }}
            onUpdateEngagement={handleUpdateEngagement}
            leftFilters={
              <>
                {/* Engagement Manager filter */}
                {availableEngagementManagers.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn(
                        "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-sm text-muted-foreground",
                        selectedEngagementManagerIds.size > 0 && "text-primary"
                      )}>
                        <UserIcon size={14} className={selectedEngagementManagerIds.size > 0 ? 'text-primary' : ''} />
                        <span>Engagement Manager</span>
                        {selectedEngagementManagerIds.size > 0 && (
                          <span className="absolute -top-1.5 -right-3 text-[10px] bg-primary text-primary-foreground rounded-full size-4 flex items-center justify-center">
                            {selectedEngagementManagerIds.size}
                          </span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[200px]">
                      {availableEngagementManagers.map(mgr => (
                        <DropdownMenuItem
                          key={mgr.id}
                          onClick={() => {
                            setSelectedEngagementManagerIds(prev => {
                              const next = new Set(prev)
                              if (next.has(mgr.id)) next.delete(mgr.id)
                              else next.add(mgr.id)
                              return next
                            })
                          }}
                          className={cn(
                            'text-xs flex items-center gap-2',
                            selectedEngagementManagerIds.has(mgr.id) && 'bg-primary/10 text-primary font-medium',
                          )}
                        >
                          <span className="w-3.5 flex items-center justify-center">
                            {selectedEngagementManagerIds.has(mgr.id) && <Check size={12} />}
                          </span>
                          {mgr.name}
                        </DropdownMenuItem>
                      ))}
                      {selectedEngagementManagerIds.size > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setSelectedEngagementManagerIds(new Set())}
                            className="text-xs text-muted-foreground"
                          >
                            Clear filter
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            }
            extraFilters={
              <>
                <div className="w-px h-3 bg-border" />
                {/* Advanced filter */}
                <Popover open={advFilterOpen} onOpenChange={setAdvFilterOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-sm text-muted-foreground",
                        hasAdvFilter && "text-primary"
                      )}
                    >
                      <SlidersHorizontal size={14} className={hasAdvFilter ? 'text-primary' : ''} />
                      <span>Advanced</span>
                      {advFilterCount > 0 && (
                        <span className="absolute -top-1.5 -right-3 text-[10px] bg-primary text-primary-foreground rounded-full size-4 flex items-center justify-center">
                          {advFilterCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[28rem] p-0" align="end">
                    <div className="p-3 border-b border-border">
                      <p className="text-sm font-semibold">Advanced Filters</p>
                      <p className="text-xs text-muted-foreground">Filter projects by application details</p>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto p-4 space-y-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Migration Strategy</p>
                        <div className="flex flex-wrap gap-2">
                          {(['Lift & Shift', 'Refactor', 'Deboard'] as MigrationStrategy[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setSelectedMigrationStrategies(prev => {
                                const next = new Set(prev)
                                if (next.has(s)) next.delete(s)
                                else next.add(s)
                                return next
                              })}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors",
                                selectedMigrationStrategies.has(s)
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-background border-border text-foreground hover:bg-muted"
                              )}
                            >
                              {selectedMigrationStrategies.has(s) && <Check size={12} />}
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Application Tier</p>
                        <div className="flex flex-wrap gap-2">
                          {(['T0', 'T1', 'T2', 'T3'] as ApplicationTier[]).map(t => (
                            <button
                              key={t}
                              onClick={() => setSelectedApplicationTiers(prev => {
                                const next = new Set(prev)
                                if (next.has(t)) next.delete(t)
                                else next.add(t)
                                return next
                              })}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors",
                                selectedApplicationTiers.has(t)
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-background border-border text-foreground hover:bg-muted"
                              )}
                            >
                              {selectedApplicationTiers.has(t) && <Check size={12} />}
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Re-Architecture Needed</p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: 'yes' as const, label: 'Yes' },
                            { key: 'no' as const, label: 'No' },
                            { key: 'unset' as const, label: 'Not Set' },
                          ]).map(o => (
                            <button
                              key={o.key}
                              onClick={() => setSelectedReArch(prev => {
                                const next = new Set(prev)
                                if (next.has(o.key)) next.delete(o.key)
                                else next.add(o.key)
                                return next
                              })}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors",
                                selectedReArch.has(o.key)
                                  ? "bg-primary/10 border-primary/30 text-primary"
                                  : "bg-background border-border text-foreground hover:bg-muted"
                              )}
                            >
                              {selectedReArch.has(o.key) && <Check size={12} />}
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <MultiAutocomplete
                        label="RTO"
                        available={availableRtos}
                        selected={selectedRtos}
                        onChange={setSelectedRtos}
                        search={rtoSearch}
                        onSearchChange={setRtoSearch}
                      />
                      <MultiAutocomplete
                        label="RPO"
                        available={availableRpos}
                        selected={selectedRpos}
                        onChange={setSelectedRpos}
                        search={rpoSearch}
                        onSearchChange={setRpoSearch}
                      />
                    </div>
                    {hasAdvFilter && (
                      <div className="p-3 border-t border-border flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => {
                            setSelectedMigrationStrategies(new Set())
                            setSelectedApplicationTiers(new Set())
                            setSelectedReArch(new Set())
                            setSelectedRtos(new Set())
                            setSelectedRpos(new Set())
                            setRtoSearch('')
                            setRpoSearch('')
                          }}
                        >
                          Clear all
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                {/* GBI filter */}
                {canUseGbiFilter && gbiRoot && (
                  <>
                    <div className="w-px h-3 bg-border" />
                    <Popover open={gbiFilterOpen} onOpenChange={setGbiFilterOpen}>
                      <PopoverTrigger asChild>
                        <button className={cn(
                          "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-sm text-muted-foreground",
                          selectedGbiIds.size > 0 && "text-primary"
                        )}>
                          <Network size={14} className={selectedGbiIds.size > 0 ? 'text-primary' : ''} />
                          <span>GBI</span>
                          {selectedGbiIds.size > 0 && (
                            <span className="absolute -top-1.5 -right-3 text-[10px] bg-primary text-primary-foreground rounded-full size-4 flex items-center justify-center">
                              {selectedGbiIds.size}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 p-0" align="end">
                        <div className="p-3 border-b border-border">
                          <p className="text-sm font-semibold">GBI Hierarchy</p>
                          <p className="text-xs text-muted-foreground">Select tiers to filter projects</p>
                        </div>
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search GBI..."
                              value={gbiFilterSearch}
                              onChange={(e) => setGbiFilterSearch(e.target.value)}
                              className="pl-8 h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto p-2">
                          {filteredGbiRoot ? (
                            <GbiTree
                              nodes={[filteredGbiRoot]}
                              selectedIds={selectedGbiIds}
                              excludedIds={excludedGbiIds}
                              scopeIds={gbiScopeIds}
                              onSelect={(node, action: SelectAction) => {
                                if (action === 'select') {
                                  let nextSelected = new Set([...selectedGbiIds, node.id])
                                  let nextExcluded = new Set(excludedGbiIds)
                                  if (gbiRoot) {
                                    const selectedNode = findNodeById(gbiRoot, node.id)
                                    if (selectedNode) {
                                      collectAllIds(selectedNode).forEach((id) => {
                                        if (id !== node.id) nextSelected.delete(id)
                                      })
                                    }
                                    for (const ex of excludedGbiIds) {
                                      if (isDescendantOf(gbiRoot, ex, node.id)) {
                                        nextExcluded.delete(ex)
                                      }
                                    }
                                    const promoted = promoteFullSelections(gbiRoot, nextSelected, nextExcluded, node.id)
                                    nextSelected = promoted.selected
                                    nextExcluded = promoted.excluded
                                  }
                                  setSelectedGbiIds(nextSelected)
                                  setExcludedGbiIds(nextExcluded)
                                } else if (action === 'unselect') {
                                  const nextSelected = new Set(selectedGbiIds)
                                  nextSelected.delete(node.id)
                                  const nextExcluded = new Set(excludedGbiIds)
                                  if (gbiRoot) {
                                    for (const ex of excludedGbiIds) {
                                      if (isDescendantOf(gbiRoot, ex, node.id)) {
                                        nextExcluded.delete(ex)
                                      }
                                    }
                                    const pruned = pruneEmptySelections(gbiRoot, nextSelected, nextExcluded)
                                    setSelectedGbiIds(pruned)
                                  } else {
                                    setSelectedGbiIds(nextSelected)
                                  }
                                  setExcludedGbiIds(nextExcluded)
                                } else if (action === 'exclude') {
                                  const nextExcluded = new Set(excludedGbiIds)
                                  nextExcluded.add(node.id)
                                  if (gbiRoot) {
                                    const pruned = pruneEmptySelections(gbiRoot, selectedGbiIds, nextExcluded)
                                    setSelectedGbiIds(pruned)
                                  }
                                  setExcludedGbiIds(nextExcluded)
                                } else if (action === 'unexclude') {
                                  const nextExcluded = new Set(excludedGbiIds)
                                  nextExcluded.delete(node.id)
                                  if (gbiRoot) {
                                    const promoted = promoteFullSelections(gbiRoot, selectedGbiIds, nextExcluded, node.id)
                                    setSelectedGbiIds(promoted.selected)
                                    setExcludedGbiIds(promoted.excluded)
                                  } else {
                                    setExcludedGbiIds(nextExcluded)
                                  }
                                }
                              }}
                              readOnly
                              maxDepth={gbiMaxDepth}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground py-4 text-center">No GBI hierarchy available.</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}

                {/* Category Milestones filter */}
                {categoryMilestones.length > 0 && (
                  <>
                    <div className="w-px h-3 bg-border" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(
                          "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-sm text-muted-foreground",
                          cmFilter.size > 0 && "text-primary"
                        )}>
                          <Tag size={14} className={cmFilter.size > 0 ? 'text-primary' : ''} />
                          <span>Category Milestones</span>
                          {cmFilter.size > 0 && (
                            <span className="absolute -top-1.5 -right-3 text-[10px] bg-primary text-primary-foreground rounded-full size-4 flex items-center justify-center">
                              {cmFilter.size}
                            </span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[240px]">
                        {[...categoryMilestones].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(cm => (
                          <DropdownMenuItem
                            key={cm.id}
                            onClick={() => {
                              setCmFilter(prev => {
                                const next = new Set(prev)
                                if (next.has(cm.id)) next.delete(cm.id)
                                else next.add(cm.id)
                                return next
                              })
                            }}
                            className={cn(
                              'text-xs flex items-center gap-2',
                              cmFilter.has(cm.id) && 'bg-primary/10 text-primary font-medium',
                            )}
                          >
                            <span className="w-3.5 flex items-center justify-center">
                              {cmFilter.has(cm.id) && <Check size={12} />}
                            </span>
                            <span
                              className="shrink-0 size-2.5 rounded-full"
                              style={{ background: cm.color ?? '#3B82F6' }}
                            />
                            {cm.name}
                          </DropdownMenuItem>
                        ))}
                        {cmFilter.size > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setCmFilter(new Set())}
                              className="text-xs text-muted-foreground"
                            >
                              Clear filter
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </>
            }
          />
        )}
      </div>

      {/* Create Engagement Dialog */}
      <Dialog open={!!createDate} onOpenChange={open => { if (!open) { setCreateDate(null); setCreateHour(null); setProjectSearch('') } }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>New Engagement</DialogTitle>
            <DialogDescription>
              Select a project to schedule an engagement for {createDate ? createDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}.
            </DialogDescription>
          </DialogHeader>

          {/* Dialog filters */}
          <div className="flex items-center gap-2 flex-wrap shrink-0 pb-2 border-b">
            {/* Advanced filter */}
            <Popover open={dialogAdvFilterOpen} onOpenChange={setDialogAdvFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs text-muted-foreground",
                    hasAdvFilter && "text-primary"
                  )}
                >
                  <SlidersHorizontal size={12} className={hasAdvFilter ? 'text-primary' : ''} />
                  <span>Advanced</span>
                  {advFilterCount > 0 && (
                    <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0 font-medium">{advFilterCount}</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[24rem] p-0" align="start">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-semibold">Advanced Filters</p>
                  <p className="text-xs text-muted-foreground">Filter projects by application details</p>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Migration Strategy</p>
                    <div className="flex flex-wrap gap-2">
                      {(['Lift & Shift', 'Refactor', 'Deboard'] as MigrationStrategy[]).map(s => (
                        <button
                          key={s}
                          onClick={() => setSelectedMigrationStrategies(prev => {
                            const next = new Set(prev)
                            if (next.has(s)) next.delete(s)
                            else next.add(s)
                            return next
                          })}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors",
                            selectedMigrationStrategies.has(s)
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          )}
                        >
                          {selectedMigrationStrategies.has(s) && <Check size={12} />}
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Application Tier</p>
                    <div className="flex flex-wrap gap-2">
                      {(['T0', 'T1', 'T2', 'T3'] as ApplicationTier[]).map(t => (
                        <button
                          key={t}
                          onClick={() => setSelectedApplicationTiers(prev => {
                            const next = new Set(prev)
                            if (next.has(t)) next.delete(t)
                            else next.add(t)
                            return next
                          })}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors",
                            selectedApplicationTiers.has(t)
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          )}
                        >
                          {selectedApplicationTiers.has(t) && <Check size={12} />}
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Re-Architecture Needed</p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'yes' as const, label: 'Yes' },
                        { key: 'no' as const, label: 'No' },
                        { key: 'unset' as const, label: 'Not Set' },
                      ]).map(o => (
                        <button
                          key={o.key}
                          onClick={() => setSelectedReArch(prev => {
                            const next = new Set(prev)
                            if (next.has(o.key)) next.delete(o.key)
                            else next.add(o.key)
                            return next
                          })}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors",
                            selectedReArch.has(o.key)
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-background border-border text-foreground hover:bg-muted"
                          )}
                        >
                          {selectedReArch.has(o.key) && <Check size={12} />}
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <MultiAutocomplete
                    label="RTO"
                    available={availableRtos}
                    selected={selectedRtos}
                    onChange={setSelectedRtos}
                    search={rtoSearch}
                    onSearchChange={setRtoSearch}
                  />
                  <MultiAutocomplete
                    label="RPO"
                    available={availableRpos}
                    selected={selectedRpos}
                    onChange={setSelectedRpos}
                    search={rpoSearch}
                    onSearchChange={setRpoSearch}
                  />
                </div>
                {hasAdvFilter && (
                  <div className="p-3 border-t border-border flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        setSelectedMigrationStrategies(new Set())
                        setSelectedApplicationTiers(new Set())
                        setSelectedReArch(new Set())
                        setSelectedRtos(new Set())
                        setSelectedRpos(new Set())
                        setRtoSearch('')
                        setRpoSearch('')
                      }}
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* GBI filter */}
            {canUseGbiFilter && gbiRoot && (
              <>
                <div className="w-px h-3 bg-border" />
                <Popover open={dialogGbiFilterOpen} onOpenChange={setDialogGbiFilterOpen} modal>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs text-muted-foreground",
                      selectedGbiIds.size > 0 && "text-primary"
                    )}>
                      <Network size={12} className={selectedGbiIds.size > 0 ? 'text-primary' : ''} />
                      <span>GBI</span>
                      {selectedGbiIds.size > 0 && (
                        <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0 font-medium">{selectedGbiIds.size}</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-3 border-b border-border">
                      <p className="text-sm font-semibold">GBI Hierarchy</p>
                      <p className="text-xs text-muted-foreground">Select tiers to filter projects</p>
                    </div>
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search GBI..."
                          value={gbiFilterSearch}
                          onChange={(e) => setGbiFilterSearch(e.target.value)}
                          className="pl-8 h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2" onWheel={(e) => e.stopPropagation()}>
                      {filteredGbiRoot ? (
                        <GbiTree
                          nodes={[filteredGbiRoot]}
                          selectedIds={selectedGbiIds}
                          excludedIds={excludedGbiIds}
                          scopeIds={gbiScopeIds}
                          onSelect={(node, action: SelectAction) => {
                            if (action === 'select') {
                              let nextSelected = new Set([...selectedGbiIds, node.id])
                              let nextExcluded = new Set(excludedGbiIds)
                              if (gbiRoot) {
                                const selectedNode = findNodeById(gbiRoot, node.id)
                                if (selectedNode) {
                                  collectAllIds(selectedNode).forEach((id) => {
                                    if (id !== node.id) nextSelected.delete(id)
                                  })
                                }
                                for (const ex of excludedGbiIds) {
                                  if (isDescendantOf(gbiRoot, ex, node.id)) {
                                    nextExcluded.delete(ex)
                                  }
                                }
                                const promoted = promoteFullSelections(gbiRoot, nextSelected, nextExcluded, node.id)
                                nextSelected = promoted.selected
                                nextExcluded = promoted.excluded
                              }
                              setSelectedGbiIds(nextSelected)
                              setExcludedGbiIds(nextExcluded)
                            } else if (action === 'unselect') {
                              const nextSelected = new Set(selectedGbiIds)
                              nextSelected.delete(node.id)
                              const nextExcluded = new Set(excludedGbiIds)
                              if (gbiRoot) {
                                for (const ex of excludedGbiIds) {
                                  if (isDescendantOf(gbiRoot, ex, node.id)) {
                                    nextExcluded.delete(ex)
                                  }
                                }
                                const pruned = pruneEmptySelections(gbiRoot, nextSelected, nextExcluded)
                                setSelectedGbiIds(pruned)
                              } else {
                                setSelectedGbiIds(nextSelected)
                              }
                              setExcludedGbiIds(nextExcluded)
                            } else if (action === 'exclude') {
                              const nextExcluded = new Set(excludedGbiIds)
                              nextExcluded.add(node.id)
                              if (gbiRoot) {
                                const pruned = pruneEmptySelections(gbiRoot, selectedGbiIds, nextExcluded)
                                setSelectedGbiIds(pruned)
                              }
                              setExcludedGbiIds(nextExcluded)
                            } else if (action === 'unexclude') {
                              const nextExcluded = new Set(excludedGbiIds)
                              nextExcluded.delete(node.id)
                              if (gbiRoot) {
                                const promoted = promoteFullSelections(gbiRoot, selectedGbiIds, nextExcluded, node.id)
                                setSelectedGbiIds(promoted.selected)
                                setExcludedGbiIds(promoted.excluded)
                              } else {
                                setExcludedGbiIds(nextExcluded)
                              }
                            }
                          }}
                          readOnly
                          maxDepth={gbiMaxDepth}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">No GBI hierarchy available.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}

            {/* Category Milestones filter */}
            {categoryMilestones.length > 0 && (
              <>
                <div className="w-px h-3 bg-border" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "relative flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs text-muted-foreground",
                      cmFilter.size > 0 && "text-primary"
                    )}>
                      <Tag size={12} className={cmFilter.size > 0 ? 'text-primary' : ''} />
                      <span>Category Milestones</span>
                      {cmFilter.size > 0 && (
                        <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0 font-medium">{cmFilter.size}</span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {[...categoryMilestones].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(cm => (
                      <DropdownMenuItem
                        key={cm.id}
                        onClick={() => {
                          setCmFilter(prev => {
                            const next = new Set(prev)
                            if (next.has(cm.id)) next.delete(cm.id)
                            else next.add(cm.id)
                            return next
                          })
                        }}
                        className={cn(
                          'text-xs flex items-center gap-2',
                          cmFilter.has(cm.id) && 'bg-primary/10 text-primary font-medium',
                        )}
                      >
                        <span className="w-3.5 flex items-center justify-center">
                          {cmFilter.has(cm.id) && <Check size={12} />}
                        </span>
                        <span className="shrink-0 size-2.5 rounded-full" style={{ background: cm.color ?? '#3B82F6' }} />
                        {cm.name}
                      </DropdownMenuItem>
                    ))}
                    {cmFilter.size > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setCmFilter(new Set())}
                          className="text-xs text-muted-foreground"
                        >
                          Clear filter
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative shrink-0 mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by project ID or name..."
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              className="pl-8 bg-background"
            />
          </div>

          {/* Project list */}
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-md mt-2">
            {dialogFilteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm py-8">
                <Search className="size-8 mb-2 opacity-40" />
                <p>No projects match your filters.</p>
              </div>
            ) : (
              dialogFilteredProjects.map(p => {
                const hasEngagement = !!p.engagement
                const isSelected = createProjectId === p.id
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 transition-colors',
                      isSelected && 'bg-primary/10',
                      !isSelected && 'hover:bg-muted/50'
                    )}
                  >
                    <button
                      className={cn(
                        'flex-1 text-left min-w-0',
                        hasEngagement ? 'cursor-default' : 'cursor-pointer'
                      )}
                      onClick={() => {
                        if (hasEngagement) return
                        setCreateProjectId(p.id)
                      }}
                      disabled={hasEngagement}
                    >
                      <div className={cn('font-medium text-sm truncate', isSelected && 'text-primary')}>{p.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{p.id}</div>
                    </button>
                    {hasEngagement && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Has engagement</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary"
                          onClick={() => handleEditEngagement(p)}
                        >
                          <Pencil className="size-3" />
                          Edit
                        </Button>
                      </div>
                    )}
                    {!hasEngagement && isSelected && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter className="shrink-0 mt-2">
            <Button variant="outline" onClick={() => { setCreateDate(null); setCreateHour(null); setProjectSearch('') }}>Cancel</Button>
            <Button
              onClick={handleCreateEngagement}
              disabled={!createProjectId || selectedProjectHasEngagement}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EngagementDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        project={selectedProject}
        allUsers={allUsers}
        onSave={handleSave}
        readOnly={!isPlatformLead}
      />
    </AppShell>
  )
}
