import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, FolderOpen, ArrowRight, ChevronDown, Network, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/layout/AppShell'
import { OverallProgressCard } from '@/components/home/OverallProgressCard'
import { ProjectStatusChartCard } from '@/components/home/ProjectStatusChartCard'
import { ProjectCard } from '@/components/home/ProjectCard'
import { ActivityTimeline } from '@/components/home/ActivityTimeline'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { useDashboard } from '@/hooks/use-dashboard'
import { useProjects } from '@/hooks/use-projects'
import { useWaves } from '@/hooks/use-waves'
import { useCurrentUser } from '@/context/UserContext'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { getSurveyDraftProjectIds } from '@/services/projects'
import { getBgiHierarchy } from '@/services/bgi'
import { BgiTree } from '@/components/bgi/BgiTree'
import {
  exportEstimatedEffortReport,
  exportProjectResourcesReport,
  exportProjectDependenciesReport,
  exportProjectDetailsReport,
  exportProjectRisksAndBlockersReport,
  exportProjectEngagementReport,
  exportDataMigrationReport,
} from '@/lib/export-report'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import type { OverallStats } from '@/types'
import type { BgiNode } from '@/types/bgi'

function filterBgiTree(nodes: BgiNode[], query: string): BgiNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  function walk(node: BgiNode): BgiNode | null {
    const matches = node.name.toLowerCase().includes(q)
    if (matches) {
      return { ...node }
    }
    const children = node.children?.map(walk).filter(Boolean) as BgiNode[] | undefined
    if (children && children.length > 0) {
      return { ...node, children }
    }
    return null
  }

  return nodes.map(walk).filter(Boolean) as BgiNode[]
}

function collectAllIds(node: BgiNode): string[] {
  return [node.id, ...(node.children?.flatMap(collectAllIds) ?? [])]
}

function findNodeById(node: BgiNode, id: string): BgiNode | null {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id)
    if (found) return found
  }
  return null
}

function isDescendantOf(root: BgiNode, targetId: string, ancestorId: string): boolean {
  if (targetId === ancestorId) return false
  const ancestor = findNodeById(root, ancestorId)
  if (!ancestor) return false
  return collectAllIds(ancestor).includes(targetId)
}

function getAncestorIds(root: BgiNode, targetId: string): string[] {
  const result: string[] = []
  function walk(node: BgiNode, path: string[]): boolean {
    if (node.id === targetId) {
      result.push(...path)
      return true
    }
    for (const child of node.children ?? []) {
      if (walk(child, [...path, node.id])) return true
    }
    return false
  }
  walk(root, [])
  return result
}

function hasCoveredDescendants(
  root: BgiNode,
  nodeId: string,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
): boolean {
  const node = findNodeById(root, nodeId)
  if (!node?.children || node.children.length === 0) return false

  function walk(n: BgiNode, ancestorSelected: boolean): boolean {
    const covered = selectedIds.has(n.id) || (ancestorSelected && !excludedIds.has(n.id))
    if (covered) return true
    const nowSelected = selectedIds.has(n.id)
    for (const child of n.children ?? []) {
      if (walk(child, nowSelected || ancestorSelected)) return true
    }
    return false
  }

  for (const child of node.children) {
    if (walk(child, selectedIds.has(node.id))) return true
  }
  return false
}

function pruneEmptySelections(
  root: BgiNode,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
): Set<string> {
  const result = new Set(selectedIds)
  let changed = true
  while (changed) {
    changed = false
    for (const id of result) {
      const node = findNodeById(root, id)
      if (node?.children && node.children.length > 0 && !hasCoveredDescendants(root, id, result, excludedIds)) {
        result.delete(id)
        changed = true
        break
      }
    }
  }
  return result
}

function isFullySelected(
  node: BgiNode,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
  ancestorSelected: boolean,
): boolean {
  const covered = selectedIds.has(node.id) || (ancestorSelected && !excludedIds.has(node.id))
  if (covered) return true
  if (!node.children || node.children.length === 0) return false
  const nowSelected = selectedIds.has(node.id)
  return node.children.every(child =>
    isFullySelected(child, selectedIds, excludedIds, nowSelected || ancestorSelected),
  )
}

function promoteFullSelections(
  root: BgiNode,
  selectedIds: Set<string>,
  excludedIds: Set<string>,
  changedId: string,
): { selected: Set<string>; excluded: Set<string> } {
  let currentSelected = new Set(selectedIds)
  let currentExcluded = new Set(excludedIds)

  const ancestors = getAncestorIds(root, changedId)
  for (const parentId of ancestors) {
    const parent = findNodeById(root, parentId)
    if (!parent?.children) continue

    const allChildrenFullySelected = parent.children.every(child =>
      isFullySelected(child, currentSelected, currentExcluded, currentSelected.has(parent.id)),
    )

    if (allChildrenFullySelected) {
      // Promote: remove all descendants from selected, add parent
      for (const child of parent.children) {
        collectAllIds(child).forEach(id => currentSelected.delete(id))
      }
      currentSelected.add(parent.id)
      // Clear exclusions under this parent
      for (const ex of currentExcluded) {
        if (isDescendantOf(root, ex, parent.id)) {
          currentExcluded.delete(ex)
        }
      }
    }
  }

  return { selected: currentSelected, excluded: currentExcluded }
}

type SortKey = 'progress' | 'status'

export function HomePage() {
  const [sortKey, setSortKey] = useState<SortKey>('progress')
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const isBgiCloudLead = user?.role.includes('bgi_cloud_lead') ?? false
  const isLead = isPlatformLead || isBgiCloudLead

  const { stats: globalStats, activity: allActivity, loading: dashLoading } = useDashboard({ enabled: isPlatformLead })
  const { projects, loading: projectsLoading } = useProjects({
    home: true,
    fields: ['basic', 'progress', 'planning', 'risks', 'team', 'approvals', 'engagement'],
  })
  const { waves, loading: wavesLoading } = useWaves({ enabled: isPlatformLead })
  const { settings: migrationSettings } = useMigrationSettings()
  const [draftProjectIds, setDraftProjectIds] = useState<string[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [bgiOpen, setBgiOpen] = useState(false)
  const [bgiSearchQuery, setBgiSearchQuery] = useState('')
  const [bgiRoot, setBgiRoot] = useState<BgiNode | null>(null)
  const [selectedBgiIds, setSelectedBgiIds] = useState<Set<string>>(new Set(user?.bgi_ids ?? []))
  const [excludedBgiIds, setExcludedBgiIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setDraftsLoading(true)
    getSurveyDraftProjectIds()
      .then(ids => {
        if (!cancelled) {
          setDraftProjectIds(ids)
          setDraftsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraftProjectIds([])
          setDraftsLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isBgiCloudLead) return
    let cancelled = false
    getBgiHierarchy()
      .then(data => {
        if (!cancelled) setBgiRoot(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isBgiCloudLead])

  useEffect(() => {
    if (user?.bgi_ids?.length) {
      setSelectedBgiIds(new Set(user.bgi_ids))
      setExcludedBgiIds(new Set())
    }
  }, [user?.bgi_ids])

  const filteredBgiRoot = useMemo(() => {
    if (!bgiRoot) return null
    const filtered = filterBgiTree([bgiRoot], bgiSearchQuery)
    return filtered[0] ?? null
  }, [bgiRoot, bgiSearchQuery])

  const selectedBgiDescendantIds = useMemo(() => {
    if (!bgiRoot) return null
    if (selectedBgiIds.size === 0) return new Set<string>()
    const allIds = new Set<string>()
    for (const id of selectedBgiIds) {
      const node = findNodeById(bgiRoot, id)
      if (node) {
        collectAllIds(node).forEach(i => allIds.add(i))
      }
    }
    // Remove excluded nodes and their descendants
    for (const eid of excludedBgiIds) {
      const node = findNodeById(bgiRoot, eid)
      if (node) {
        collectAllIds(node).forEach(i => allIds.delete(i))
      }
    }
    return allIds
  }, [bgiRoot, selectedBgiIds, excludedBgiIds])

  const loading = dashLoading || projectsLoading || wavesLoading || draftsLoading

  // For non-platform-leads: filter activity to their assigned projects only
  const projectIds = useMemo(() => projects.map(p => p.id), [projects])
  const activity = useMemo(
    () => isPlatformLead
      ? allActivity
      : allActivity.filter(a => a.projectId != null && projectIds.includes(a.projectId)),
    [isPlatformLead, allActivity, projectIds],
  )

  // For bgi_cloud_lead / non-platform-leads: compute stats scoped to their visible projects
  const scopedStats = useMemo((): OverallStats | null => {
    if (isPlatformLead || projects.length === 0) return null
    const completed = projects.filter(p => p.status === 'completed').length
    const inProgress = projects.filter(p => ['in-progress', 'migrating', 'signed-off'].includes(p.status)).length
    const progress = Math.round(
      projects.reduce((sum, p) => sum + p.progress, 0) / projects.length,
    )
    return {
      progress,
      totalAssets: projects.length,
      targetCloud: globalStats?.targetCloud ?? 'Azure',
      completed,
      inProgress,
    }
  }, [isPlatformLead, projects, globalStats?.targetCloud])

  const displayStats = isPlatformLead ? globalStats : scopedStats

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortKey === 'progress') return b.progress - a.progress
    if (sortKey === 'status') return a.status.localeCompare(b.status)
    return 0
  })

  const bgiFilteredSortedProjects = useMemo(() => {
    if (!selectedBgiDescendantIds) return sortedProjects
    return sortedProjects.filter(p => p.bgi_id && selectedBgiDescendantIds.has(p.bgi_id))
  }, [sortedProjects, selectedBgiDescendantIds])

  // For platform leads / bgi leads: show latest 5 active projects on the home grid
  const homeProjects = useMemo(() => {
    if (!isLead) return bgiFilteredSortedProjects
    const active = bgiFilteredSortedProjects.filter(p => p.status !== 'completed')
    // Sort by updatedAt descending for "latest"
    const latestActive = [...active].sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    )
    return latestActive.slice(0, 5)
  }, [isLead, bgiFilteredSortedProjects])



  return (
    <AppShell>
      <div className="max-w-7xl w-full mx-auto space-y-8">
        {/* Section 1: Global Progress */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground leading-tight">
                {isLead ? 'Migration Workspace' : 'My Projects'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isPlatformLead
                  ? 'Real-time oversight of enterprise-wide cloud transformation.'
                  : isBgiCloudLead
                    ? 'Projects within your assigned BGI subtree.'
                    : 'Projects assigned to you.'}
              </p>
            </div>
            {isPlatformLead && (
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2 cursor-pointer">
                      <Download size={14} /> Export Report <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[280px]">
                    <DropdownMenuItem onClick={() => exportEstimatedEffortReport()}>
                      Estimated Effort Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportProjectResourcesReport()}>
                      Project Resources Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportProjectDependenciesReport()}>
                      Project Dependencies Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportProjectDetailsReport()}>
                      Project Details Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportProjectRisksAndBlockersReport()}>
                      Project Risks & Blockers Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportProjectEngagementReport()}>
                      Project Engagement Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportDataMigrationReport()}>
                      Data Migration Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
                  <Plus size={14} /> New Migration
                </button>
              </div>
            )}
            {isBgiCloudLead && (
              <Popover open={bgiOpen} onOpenChange={setBgiOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="size-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                    title="Browse BGI tiers"
                  >
                    <Network size={18} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-96 p-0">
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-semibold">BGI Hierarchy</p>
                    <p className="text-xs text-muted-foreground">
                      Select a tier to filter projects
                    </p>
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
                        onSelect={(node, action) => {
                          if (action === 'select') {
                            let nextSelected = new Set([...selectedBgiIds, node.id])
                            let nextExcluded = new Set(excludedBgiIds)
                            if (bgiRoot) {
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
                          } else if (action === 'exclude') {
                            const nextExcluded = new Set(excludedBgiIds)
                            nextExcluded.add(node.id)
                            if (bgiRoot) {
                              const pruned = pruneEmptySelections(bgiRoot, selectedBgiIds, nextExcluded)
                              setSelectedBgiIds(pruned)
                            }
                            setExcludedBgiIds(nextExcluded)
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
                          }
                        }}
                        readOnly
                        scopeIds={user?.bgi_ids ?? null}
                        maxDepth={migrationSettings?.bgiTierDepth}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No BGI hierarchy available.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {isLead && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {loading || !displayStats ? (
                <>
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </>
              ) : (
                <>
                  <OverallProgressCard stats={displayStats} projects={bgiFilteredSortedProjects} waves={waves} />
                  <ProjectStatusChartCard projects={bgiFilteredSortedProjects} draftProjectIds={draftProjectIds} />
                </>
              )}
            </div>
          )}
        </section>

        {/* Section 2: Projects Grid */}
        <section className="space-y-6 w-full">
          <div className={cn('flex items-center', isLead ? 'justify-between' : 'justify-end')}>
            {isLead && (
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">Active Projects</h2>
                {bgiRoot && Array.from(selectedBgiIds).map(id => {
                  const node = findNodeById(bgiRoot, id)
                  if (!node) return null
                  return (
                    <span key={id} className="inline-flex items-center gap-1.5 text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-full">
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
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Sort by:</span>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="bg-transparent border-none text-xs font-bold text-foreground focus:ring-0 cursor-pointer outline-none"
              >
                <option value="progress">Progress (%)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <div className={cn('grid gap-6 w-full', isLead ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2')}>
            {loading ? (
              <>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                {!isLead && <Skeleton className="h-40 rounded-xl" />}
              </>
            ) : homeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">
                No projects are assigned to you yet.
              </p>
            ) : (
              <>
                {homeProjects.map(project => (
                  <ProjectCard key={project.id} project={project} rich={!isLead} />
                ))}
                {isLead && bgiFilteredSortedProjects.length > 0 && (
                  <div
                    onClick={() => navigate('/projects')}
                    className="cursor-pointer rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/50 transition-colors flex flex-col items-center justify-center gap-3 p-6 min-h-[160px]"
                  >
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <FolderOpen className="size-6 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">View All Projects</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{bgiFilteredSortedProjects.length} total projects</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <span>Go to Projects</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Section 3: Activity Timeline — only for platform leads */}
        {isPlatformLead && (
          <section>
            {loading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : (
              <ActivityTimeline activities={activity} />
            )}
          </section>
        )}
      </div>


    </AppShell>
  )
}
