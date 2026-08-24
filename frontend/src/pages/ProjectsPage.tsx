import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, FolderOpen, ChevronRight, ChevronLeft, Calendar, ListFilter, Search, Download, Network, X, MoreVertical } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { AppShell } from '@/components/layout/AppShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { getSurveyDraftProjectIds, updateApplicationOverview, updateSurveyNeed } from '@/services/projects'
import { getBgiHierarchy } from '@/services/bgi'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { BgiTree } from '@/components/bgi/BgiTree'
import { getEffortTypeLabel } from '@/components/project/EffortTableEditor'
import { InfraFootprintTooltip } from '@/components/project/InfraFootprintTooltip'
import { MigrationDriverTooltip } from '@/components/project/MigrationDriverTooltip'
import { getInfraFootprintScore, getMigrationDriverScore } from '@/lib/scoring'
import {
  exportProjectsToExcel,
  formatDate,
  getMigrationDates,
  getMigrationPeriodDays,
  getMigrationEffortSummary,
} from '@/lib/export-report'
import type { Project } from '@/types'
import type { BgiNode } from '@/types/bgi'
import type { SelectAction } from '@/components/bgi/BgiTree'
import {
  filterBgiTree,
  collectAllIds,
  findNodeById,
  isDescendantOf,
  pruneEmptySelections,
  promoteFullSelections,
} from '@/lib/bgi-utils'

function getProgressVariant(project: Project) {
  if (project.progress === 100) return 'tertiary'
  if (project.status === 'blocked') return 'error'
  if (project.status === 'planning') return 'muted'
  return 'primary'
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { projects, loading, refresh } = useProjects({
    fields: ['basic', 'itso', 'itso_delegate', 'progress', 'planning', 'overview', 'effort', 'resources', 'dependencies'],
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [migrationRange, setMigrationRange] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [draftProjectIds, setDraftProjectIds] = useState<string[]>([])
  const [bgiRoot, setBgiRoot] = useState<BgiNode | null>(null)
  const [bgiPopoverOpen, setBgiPopoverOpen] = useState(false)
  const [bgiSearchQuery, setBgiSearchQuery] = useState('')
  const [selectedBgiIds, setSelectedBgiIds] = useState<Set<string>>(new Set())
  const [excludedBgiIds, setExcludedBgiIds] = useState<Set<string>>(new Set())
  const [mappingDialogProject, setMappingDialogProject] = useState<Project | null>(null)
  const [mappingDialogValue, setMappingDialogValue] = useState('')
  const [mappingDialogSaving, setMappingDialogSaving] = useState(false)
  const [mappingDialogError, setMappingDialogError] = useState<string | null>(null)
  const [surveyNeedDialogProject, setSurveyNeedDialogProject] = useState<Project | null>(null)
  const [surveyNeedDialogValue, setSurveyNeedDialogValue] = useState(true)
  const [surveyNeedDialogJustification, setSurveyNeedDialogJustification] = useState('')
  const [surveyNeedDialogSaving, setSurveyNeedDialogSaving] = useState(false)
  const [surveyNeedDialogError, setSurveyNeedDialogError] = useState<string | null>(null)

  const isAdmin = user?.role.includes('admin') ?? false
  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const isBgiCloudLead = user?.role.includes('bgi_cloud_lead') ?? false
  const isGbiChampionOrDelegate = user?.projectRoles?.some(
    r => r === 'gbi_champion' || r === 'gbi_champion_delegate'
  ) ?? false

  const canViewProjects = isAdmin || isPlatformLead || isBgiCloudLead || isGbiChampionOrDelegate

  async function handleSaveMapping() {
    if (!mappingDialogProject) return
    const trimmed = mappingDialogValue.trim()
    setMappingDialogSaving(true)
    setMappingDialogError(null)
    try {
      await updateApplicationOverview(mappingDialogProject.id, { newProjectId: trimmed || null })
      setMappingDialogProject(null)
      setMappingDialogValue('')
      refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project ID mapping.'
      setMappingDialogError(message)
    } finally {
      setMappingDialogSaving(false)
    }
  }

  async function handleSaveSurveyNeed() {
    if (!surveyNeedDialogProject) return
    setSurveyNeedDialogSaving(true)
    setSurveyNeedDialogError(null)
    try {
      await updateSurveyNeed(surveyNeedDialogProject.id, {
        isSurveyNeeded: surveyNeedDialogValue,
        justificationWithoutSurvey: surveyNeedDialogValue ? null : surveyNeedDialogJustification.trim() || null,
      })
      setSurveyNeedDialogProject(null)
      setSurveyNeedDialogValue(true)
      setSurveyNeedDialogJustification('')
      refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update survey requirement.'
      setSurveyNeedDialogError(message)
    } finally {
      setSurveyNeedDialogSaving(false)
    }
  }

  const { settings: migrationSettings } = useMigrationSettings()

  useEffect(() => {
    let cancelled = false
    getSurveyDraftProjectIds()
      .then(ids => {
        if (!cancelled) setDraftProjectIds(ids)
      })
      .catch(() => {
        if (!cancelled) setDraftProjectIds([])
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    getBgiHierarchy()
      .then(data => {
        if (!cancelled) setBgiRoot(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isPlatformLead && user?.bgi_ids?.length) {
      setSelectedBgiIds(new Set(user.bgi_ids))
      setExcludedBgiIds(new Set())
    }
  }, [isPlatformLead, user?.bgi_ids])

  const filteredBgiRoot = useMemo(() => {
    if (!bgiRoot) return null
    const filtered = filterBgiTree([bgiRoot], bgiSearchQuery)
    return filtered[0] ?? null
  }, [bgiRoot, bgiSearchQuery])

  const bgiNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!bgiRoot) return map
    function walk(node: BgiNode) {
      map.set(node.id, node.name)
      node.children?.forEach(walk)
    }
    walk(bgiRoot)
    return map
  }, [bgiRoot])

  const selectedBgiDescendantIds = useMemo(() => {
    if (!bgiRoot || selectedBgiIds.size === 0) return null
    const allIds = new Set<string>()
    for (const id of selectedBgiIds) {
      const node = findNodeById(bgiRoot, id)
      if (node) {
        collectAllIds(node).forEach(i => allIds.add(i))
      }
    }
    for (const eid of excludedBgiIds) {
      const node = findNodeById(bgiRoot, eid)
      if (node) {
        collectAllIds(node).forEach(i => allIds.delete(i))
      }
    }
    return allIds
  }, [bgiRoot, selectedBgiIds, excludedBgiIds])

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return (projects || []).filter((p) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'drafting-survey') {
          const sp = p.stageProgress
          if (!(p.status === 'in-progress' && sp?.setup === 100 && sp?.survey < 100 && draftProjectIds.includes(p.id))) return false
        } else if (statusFilter === 'awaiting-survey') {
          const sp = p.stageProgress
          if (!(p.status === 'in-progress' && sp?.setup === 100 && sp?.survey < 100 && !draftProjectIds.includes(p.id))) return false
        } else if (statusFilter === 'survey-submitted') {
          const sp = p.stageProgress
          if (!(p.status === 'in-progress' && sp?.setup === 100 && sp?.survey === 100 && sp?.signoff === 0)) return false
        } else if (statusFilter === 'awaiting-signoff') {
          const sp = p.stageProgress
          if (!(p.status === 'in-progress' && sp?.setup === 100 && sp?.survey === 100 && sp?.signoff > 0 && sp?.signoff < 100)) return false
        } else if (p.status !== statusFilter) {
          return false
        }
      }
      if (selectedBgiDescendantIds != null) {
        if (!p.bgi_id || !selectedBgiDescendantIds.has(p.bgi_id)) return false
      }
      if (query) {
        const matchesName = p.name.toLowerCase().includes(query)
        const matchesId = p.id.toLowerCase().includes(query)
        const matchesAppName = p.applicationOverview?.applicationName?.toLowerCase().includes(query) ?? false
        const matchesBaId = p.applicationOverview?.baId?.toLowerCase().includes(query) ?? false
        if (!matchesName && !matchesId && !matchesAppName && !matchesBaId) return false
      }
      if (migrationRange === 'all') return true
      const days = getMigrationPeriodDays(p)
      if (days === null) return false
      switch (migrationRange) {
        case 'lt30':
          return days < 30
        case '30to90':
          return days >= 30 && days < 90
        case '90to180':
          return days >= 90 && days < 180
        case 'gte180':
          return days >= 180
        default:
          return true
      }
    })
  }, [projects, migrationRange, statusFilter, selectedBgiDescendantIds, searchQuery, draftProjectIds])

  const totalPages = Math.ceil(filteredProjects.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedProjects = useMemo(
    () => filteredProjects.slice(startIndex, endIndex),
    [filteredProjects, startIndex, endIndex]
  )

  if (!canViewProjects) {
    return (
      <AppShell title="Projects">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm mb-6">
              Projects listing is only available to Platform Migration Leads, BGI Cloud Leads, Admins, BGI Champions, and BGI Champion Delegates.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground shadow-sm"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Projects">
      <div className="max-w-screen-xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="size-5 text-muted-foreground" />
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Projects</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            All migration projects across the platform.
          </p>
        </div>

        {/* Filters (left) — right side reserved for export button */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Select
              value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[180px]" size="sm">
              <ListFilter className="size-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="awaiting-survey">Awaiting Survey</SelectItem>
              <SelectItem value="drafting-survey">Drafting Survey</SelectItem>
              <SelectItem value="survey-submitted">Survey Submitted</SelectItem>
              <SelectItem value="awaiting-signoff">Awaiting Sign-off</SelectItem>
              <SelectItem value="signed-off">Signed Off</SelectItem>
              <SelectItem value="migrating">Migrating</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Popover open={bgiPopoverOpen} onOpenChange={setBgiPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg border border-input bg-transparent text-sm whitespace-nowrap hover:bg-muted/50 transition-colors">
                <Network className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {selectedBgiIds.size === 0 ? 'Filter by BGI' : `${selectedBgiIds.size} selected`}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="start">
              <div className="p-3 border-b border-border">
                <p className="text-sm font-semibold">BGI Hierarchy</p>
                <p className="text-xs text-muted-foreground">Select tiers to filter projects</p>
              </div>
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search BGI..."
                    value={bgiSearchQuery}
                    onChange={(e) => setBgiSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {filteredBgiRoot ? (
                  <BgiTree
                    nodes={[filteredBgiRoot]}
                    selectedIds={selectedBgiIds}
                    excludedIds={excludedBgiIds}
                    scopeIds={isPlatformLead ? null : (user?.bgi_ids ?? null)}
                    onSelect={(node, action: SelectAction) => {
                      if (action === 'select') {
                        let nextSelected = new Set([...selectedBgiIds, node.id])
                        let nextExcluded = new Set(excludedBgiIds)
                        if (bgiRoot) {
                          const selectedNode = findNodeById(bgiRoot, node.id)
                          if (selectedNode) {
                            collectAllIds(selectedNode).forEach((id) => {
                              if (id !== node.id) nextSelected.delete(id)
                            })
                          }
                          for (const ex of excludedBgiIds) {
                            if (isDescendantOf(bgiRoot, ex, node.id)) {
                              nextExcluded.delete(ex)
                            }
                          }
                          const promoted = promoteFullSelections(bgiRoot, nextSelected, nextExcluded, node.id)
                          nextSelected = promoted.selected
                          nextExcluded = promoted.excluded
                        }
                        setSelectedBgiIds(nextSelected)
                        setExcludedBgiIds(nextExcluded)
                        setCurrentPage(1)
                      } else if (action === 'unselect') {
                        const nextSelected = new Set(selectedBgiIds)
                        nextSelected.delete(node.id)
                        const nextExcluded = new Set(excludedBgiIds)
                        if (bgiRoot) {
                          for (const ex of excludedBgiIds) {
                            if (isDescendantOf(bgiRoot, ex, node.id)) {
                              nextExcluded.delete(ex)
                            }
                          }
                          const pruned = pruneEmptySelections(bgiRoot, nextSelected, nextExcluded)
                          setSelectedBgiIds(pruned)
                        } else {
                          setSelectedBgiIds(nextSelected)
                        }
                        setExcludedBgiIds(nextExcluded)
                        setCurrentPage(1)
                      } else if (action === 'exclude') {
                        const nextExcluded = new Set(excludedBgiIds)
                        nextExcluded.add(node.id)
                        if (bgiRoot) {
                          const pruned = pruneEmptySelections(bgiRoot, selectedBgiIds, nextExcluded)
                          setSelectedBgiIds(pruned)
                        }
                        setExcludedBgiIds(nextExcluded)
                        setCurrentPage(1)
                      } else if (action === 'unexclude') {
                        let nextExcluded = new Set(excludedBgiIds)
                        nextExcluded.delete(node.id)
                        if (bgiRoot) {
                          const promoted = promoteFullSelections(bgiRoot, selectedBgiIds, nextExcluded, node.id)
                          setSelectedBgiIds(promoted.selected)
                          setExcludedBgiIds(promoted.excluded)
                        } else {
                          setExcludedBgiIds(nextExcluded)
                        }
                        setCurrentPage(1)
                      }
                    }}
                    readOnly
                    maxDepth={migrationSettings?.bgiTierDepth}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No BGI hierarchy available.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Select
            value={migrationRange}
            onValueChange={(value) => {
              setMigrationRange(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-[220px]" size="sm">
              <Calendar className="size-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter by migration period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All migration periods</SelectItem>
              <SelectItem value="lt30">{'< 30 days'}</SelectItem>
              <SelectItem value="30to90">30–90 days</SelectItem>
              <SelectItem value="90to180">90–180 days</SelectItem>
              <SelectItem value="gte180">{'≥ 180 days'}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search name / ID / app / BA"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-[220px] pl-9 h-7"
            />
          </div>
          </div>
          <button
            className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2"
            onClick={() => exportProjectsToExcel(filteredProjects, draftProjectIds, bgiRoot)}
          >
            <Download size={14} /> Export
          </button>
        </div>

        {/* Active BGI filters */}
        {selectedBgiIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 -mt-4">
            {Array.from(selectedBgiIds).map((id) => {
              const node = bgiRoot ? findNodeById(bgiRoot, id) : null
              if (!node) return null
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-full"
                >
                  <Network size={12} />
                  {node.name}
                  <button
                    onClick={() => {
                      const nextSelected = new Set(selectedBgiIds)
                      nextSelected.delete(id)
                      const nextExcluded = new Set(excludedBgiIds)
                      if (bgiRoot) {
                        for (const ex of excludedBgiIds) {
                          if (isDescendantOf(bgiRoot, ex, id)) {
                            nextExcluded.delete(ex)
                          }
                        }
                        const pruned = pruneEmptySelections(bgiRoot, nextSelected, nextExcluded)
                        setSelectedBgiIds(pruned)
                      } else {
                        setSelectedBgiIds(nextSelected)
                      }
                      setExcludedBgiIds(nextExcluded)
                      setCurrentPage(1)
                    }}
                    className="ml-0.5 hover:text-destructive transition-colors"
                    title="Remove filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* Projects Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">ID</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">New Project ID</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Application Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">BA ID</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">BGI</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Progress</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">ITSO</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">ITSO Delegate</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">BPS</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">IBS</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">IITA</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Migration Strategy</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Migration Period</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Migration Effort</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Infra Footprint</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Migration Driver</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Migration Story</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 20 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={20} className="text-center py-12 text-muted-foreground text-sm">
                    No projects found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {project.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {project.id}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {project.applicationOverview?.newProjectId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.applicationOverview?.applicationName ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {project.applicationOverview?.baId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.bgi_id ? (bgiNameMap.get(project.bgi_id) ?? project.bgi_id) : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} stageProgress={project.stageProgress} hasSurveyDraft={draftProjectIds.includes(project.id)} surveySubmittedAt={project.surveySubmittedAt} />
                    </TableCell>
                    <TableCell>
                      <div className="w-full max-w-[120px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground" />
                          <span className="font-medium">{project.progress}%</span>
                        </div>
                        <ProgressBar
                          value={project.progress}
                          variant={getProgressVariant(project)}
                          height="h-1.5"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.itso ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.itsoDelegate ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.applicationOverview?.systemImportanceClassification?.includes('BPS') ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.applicationOverview?.systemImportanceClassification?.includes('IBS') ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.applicationOverview?.iitaApplicability ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.applicationOverview?.migrationStrategy ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(() => {
                        const { start, end } = getMigrationDates(project)
                        if (!start && !end) return '—'
                        const days = getMigrationPeriodDays(project)
                        return `${formatDate(start)} → ${formatDate(end)}${days !== null ? ` (${days} days)` : ''}`
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {(() => {
                        const { totalCost, groups } = getMigrationEffortSummary(project)
                        if (groups.length === 0) return <span className="text-muted-foreground">—</span>
                        const summaryText = `$${Math.round(totalCost).toLocaleString()}`
                        const hasThirdParty = groups.some(g => g.tasks.some(t => t.thirdParty))
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dashed border-muted-foreground/50">{summaryText}</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-none bg-popover text-popover-foreground border border-border shadow-lg px-0 py-2" sideOffset={4} arrowClassName="fill-popover bg-popover">
                              <div className="flex flex-col">
                              <div className="overflow-auto max-h-[320px]">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground">
                                      <th className="text-left px-3 py-1 font-medium w-full">Type</th>
                                      <th className="text-right px-3 py-1 font-medium whitespace-nowrap">FTE</th>
                                      <th className="text-right px-3 py-1 font-medium whitespace-nowrap">Months</th>
                                      <th className="text-right px-3 py-1 font-medium whitespace-nowrap">Rate</th>
                                      <th className="text-right px-3 py-1 font-medium whitespace-nowrap">Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {groups.map((group) => (
                                      <>
                                        <tr className="bg-muted/40">
                                          <td colSpan={5} className="px-3 py-1 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                            {group.baId}
                                          </td>
                                        </tr>
                                        {group.tasks.map((task, idx) => (
                                          <tr key={`${group.baId}-${idx}`} className="border-t border-border/50">
                                            <td className="px-3 py-1.5">{getEffortTypeLabel(task.type)}{task.thirdParty ? ' *' : ''}</td>
                                            <td className="px-3 py-1.5 text-right whitespace-nowrap">{task.effort.toFixed(1)}</td>
                                            <td className="px-3 py-1.5 text-right whitespace-nowrap">{task.effortTime.toFixed(0)}</td>
                                            <td className="px-3 py-1.5 text-right whitespace-nowrap">${task.rate.toLocaleString()}</td>
                                            <td className="px-3 py-1.5 text-right font-medium whitespace-nowrap">${Math.round(task.cost).toLocaleString()}</td>
                                          </tr>
                                        ))}
                                        <tr className="border-t border-border/50 font-medium">
                                          <td className="px-3 py-1 text-muted-foreground">Subtotal</td>
                                          <td className="px-3 py-1 text-right whitespace-nowrap" />
                                          <td className="px-3 py-1 text-right whitespace-nowrap" />
                                          <td className="px-3 py-1 text-right whitespace-nowrap" />
                                          <td className="px-3 py-1 text-right whitespace-nowrap">${Math.round(group.subTotalCost).toLocaleString()}</td>
                                        </tr>
                                      </>
                                    ))}
                                    <tr className="border-t border-border font-semibold">
                                      <td className="px-3 py-1.5">Total</td>
                                      <td className="px-3 py-1.5 text-right whitespace-nowrap" />
                                      <td className="px-3 py-1.5 text-right whitespace-nowrap" />
                                      <td className="px-3 py-1.5 text-right whitespace-nowrap" />
                                      <td className="px-3 py-1.5 text-right whitespace-nowrap">${Math.round(totalCost).toLocaleString()}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              {hasThirdParty && (
                                <p className="text-[10px] text-muted-foreground italic px-3 pt-2 pb-1 border-t border-border/50 mt-1 bg-muted/50">* Third-party effort</p>
                              )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {(() => {
                        const result = getInfraFootprintScore(project)
                        if (!result.score) return <span className="text-muted-foreground">—</span>
                        return (
                          <InfraFootprintTooltip project={project}>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">{result.score}</span>
                          </InfraFootprintTooltip>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {(() => {
                        const result = getMigrationDriverScore(project)
                        if (!result.score) return <span className="text-muted-foreground">—</span>
                        return (
                          <MigrationDriverTooltip project={project}>
                            <span className="cursor-help border-b border-dashed border-muted-foreground/50">{result.score}</span>
                          </MigrationDriverTooltip>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.jiraStoryKey && project.jiraBaseUrl ? (
                        <a
                          href={`${project.jiraBaseUrl}/browse/${project.jiraStoryKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {project.jiraStoryKey}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPlatformLead && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="More actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                              className="whitespace-nowrap"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMappingDialogProject(project)
                                setMappingDialogValue(project.applicationOverview?.newProjectId ?? '')
                              }}
                            >
                              Update project ID mapping
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="whitespace-nowrap"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSurveyNeedDialogProject(project)
                                setSurveyNeedDialogValue(project.isSurveyNeeded ?? true)
                                setSurveyNeedDialogJustification(project.justificationWithoutSurvey ?? '')
                              }}
                            >
                              Set survey requirement
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && filteredProjects.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Update Project ID Mapping Dialog */}
        <Dialog open={!!mappingDialogProject} onOpenChange={(open) => {
          if (!open) {
            setMappingDialogProject(null)
            setMappingDialogValue('')
            setMappingDialogError(null)
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Update Project ID Mapping</DialogTitle>
              <DialogDescription>
                Set the new project ID for {mappingDialogProject?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-project-id">New Project ID</Label>
                <Input
                  id="new-project-id"
                  value={mappingDialogValue}
                  onChange={(e) => {
                    setMappingDialogValue(e.target.value)
                    setMappingDialogError(null)
                  }}
                  placeholder="e.g. new-resource-set-name"
                  aria-invalid={mappingDialogError ? 'true' : 'false'}
                />
                {mappingDialogError && (
                  <p className="text-xs text-destructive">{mappingDialogError}</p>
                )}
              </div>
              {mappingDialogProject?.applicationOverview?.newProjectId && (
                <p className="text-xs text-muted-foreground">
                  Current mapping: {mappingDialogProject.applicationOverview.newProjectId}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setMappingDialogProject(null)
                  setMappingDialogValue('')
                  setMappingDialogError(null)
                }}
                disabled={mappingDialogSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveMapping} disabled={mappingDialogSaving}>
                {mappingDialogSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Survey Requirement Dialog */}
        <Dialog open={!!surveyNeedDialogProject} onOpenChange={(open) => {
          if (!open) {
            setSurveyNeedDialogProject(null)
            setSurveyNeedDialogValue(true)
            setSurveyNeedDialogJustification('')
            setSurveyNeedDialogError(null)
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Survey Requirement</DialogTitle>
              <DialogDescription>
                Configure whether a survey is required for {surveyNeedDialogProject?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="survey-needed" className="cursor-pointer">
                  Survey needed
                </Label>
                <Switch
                  id="survey-needed"
                  checked={surveyNeedDialogValue}
                  onCheckedChange={(checked) => {
                    setSurveyNeedDialogValue(checked)
                    if (checked) setSurveyNeedDialogJustification('')
                    setSurveyNeedDialogError(null)
                  }}
                />
              </div>
              {!surveyNeedDialogValue && (
                <div className="space-y-1.5">
                  <Label htmlFor="survey-justification">
                    Justification without survey <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <textarea
                    id="survey-justification"
                    value={surveyNeedDialogJustification}
                    onChange={(e) => {
                      setSurveyNeedDialogJustification(e.target.value)
                      setSurveyNeedDialogError(null)
                    }}
                    rows={3}
                    placeholder="Provide a reason for waiving the survey..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              {surveyNeedDialogError && (
                <p className="text-xs text-destructive">{surveyNeedDialogError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSurveyNeedDialogProject(null)
                  setSurveyNeedDialogValue(true)
                  setSurveyNeedDialogJustification('')
                  setSurveyNeedDialogError(null)
                }}
                disabled={surveyNeedDialogSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveSurveyNeed} disabled={surveyNeedDialogSaving}>
                {surveyNeedDialogSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
