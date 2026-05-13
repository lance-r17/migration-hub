import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, FolderOpen, ChevronRight, ChevronLeft, Calendar, ListFilter, Search, Download } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { getSurveyDraftProjectIds } from '@/services/projects'
import { getEffortTypeLabel } from '@/components/project/EffortTableEditor'
import { getStatusLabel } from '@/components/shared/StatusBadge'
import * as XLSX from 'xlsx'
import type { Project } from '@/types'

function formatDate(value: string | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getMigrationDates(project: Project) {
  const p = project.planning
  const mc = project.migrationConstraints
  const start = p?.startDate || mc?.earliestStartDate
  const end = p?.endDate || mc?.latestEndDate
  return { start, end }
}

function getMigrationPeriodDays(project: Project): number | null {
  const { start, end } = getMigrationDates(project)
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null
  const diffTime = e.getTime() - s.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function getProgressVariant(project: Project) {
  if (project.progress === 100) return 'tertiary'
  if (project.status === 'blocked') return 'error'
  if (project.status === 'planning') return 'muted'
  return 'primary'
}

function exportProjectsToExcel(projects: Project[], draftProjectIds: string[]) {
  const rows = projects.map((p) => {
    const { start, end } = getMigrationDates(p)
    const days = getMigrationPeriodDays(p)
    const period = !start && !end ? '—' : `${formatDate(start)} → ${formatDate(end)}${days !== null ? ` (${days} days)` : ''}`
    const { totalCost } = getMigrationEffortSummary(p)
    return {
      'Name': p.name,
      'ID': p.id,
      'Status': getStatusLabel(p.status, p.stageProgress, draftProjectIds.includes(p.id)),
      'Progress (%)': p.progress,
      'ITSO': p.itso ?? '—',
      'ITSO Delegate': p.itsoDelegate ?? '—',
      'BPS': p.applicationOverview?.systemImportanceClassification?.includes('BPS') ? 'Yes' : 'No',
      'IBS': p.applicationOverview?.systemImportanceClassification?.includes('IBS') ? 'Yes' : 'No',
      'IITA': p.applicationOverview?.iitaApplicability ? 'Yes' : 'No',
      'Migration Strategy': p.applicationOverview?.migrationStrategy ?? '—',
      'Migration Period': period,
      'Migration Effort': totalCost > 0 ? `$${Math.round(totalCost).toLocaleString()}` : '—',
      'Migration Story': p.jiraStoryKey ?? '—',
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
    { wch: 24 }, { wch: 24 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 14 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects')
  XLSX.writeFile(workbook, `projects-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function getMigrationEffortSummary(project: Project): {
  totalCost: number
  groups: {
    baId: string
    tasks: { type: string; effort: number; effortTime: number; rate: number; cost: number; thirdParty?: boolean; remarks?: string }[]
    subTotalCost: number
  }[]
} {
  const tables = project.migrationEffortEstimation?.tables ?? []
  const groupMap = new Map<string, typeof tables[number]['tasks']>()
  for (const table of tables) {
    const baId = table.baId || 'No BA'
    const existing = groupMap.get(baId) ?? []
    groupMap.set(baId, existing.concat(table.tasks ?? []))
  }

  const groups: {
    baId: string
    tasks: { type: string; effort: number; effortTime: number; rate: number; cost: number; thirdParty?: boolean; remarks?: string }[]
    subTotalCost: number
  }[] = []

  for (const [baId, tasks] of groupMap) {
    const breakdown = tasks.map(task => {
      const effort = task.effort ?? 0
      const effortTime = task.effortTime ?? 0
      const rate = task.rate ?? 0
      const cost = effort * effortTime * rate
      return { type: task.effortType, effort, effortTime, rate, cost, thirdParty: task.thirdParty, remarks: task.remarks }
    })
    const subTotalCost = breakdown.reduce((sum, t) => sum + t.cost, 0)
    groups.push({ baId, tasks: breakdown, subTotalCost })
  }

  const totalCost = groups.reduce((sum, g) => sum + g.subTotalCost, 0)
  return { totalCost, groups }
}

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { projects, loading } = useProjects({
    fields: ['basic', 'itso', 'itso_delegate', 'progress', 'planning', 'overview', 'effort'],
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [migrationRange, setMigrationRange] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [draftProjectIds, setDraftProjectIds] = useState<string[]>([])

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
      if (query) {
        const matchesName = p.name.toLowerCase().includes(query)
        const matchesId = p.id.toLowerCase().includes(query)
        if (!matchesName && !matchesId) return false
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
  }, [projects, migrationRange, statusFilter, searchQuery, draftProjectIds])

  const totalPages = Math.ceil(filteredProjects.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedProjects = useMemo(
    () => filteredProjects.slice(startIndex, endIndex),
    [filteredProjects, startIndex, endIndex]
  )

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false

  if (!isPlatformLead) {
    return (
      <AppShell title="Projects">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm mb-6">
              Projects listing is only available to Platform Migration Leads.
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
              placeholder="Search name / ID"
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
            onClick={() => exportProjectsToExcel(filteredProjects, draftProjectIds)}
          >
            <Download size={14} /> Export
          </button>
        </div>

        {/* Projects Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">ID</TableHead>
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
                <TableHead className="font-bold text-xs uppercase tracking-wider">Migration Story</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 13 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12 text-muted-foreground text-sm">
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
                                <p className="text-[10px] text-muted-foreground px-3 pt-2">* Third-party effort</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
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
                      <button
                        className="text-sm font-semibold text-primary flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/projects/${project.id}`)
                        }}
                      >
                        View
                        <ChevronRight size={14} />
                      </button>
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
      </div>
    </AppShell>
  )
}
