import { useState, useEffect, useCallback, useMemo } from 'react'
import { DollarSign, Upload, Lock, CheckCircle2, X, Search } from 'lucide-react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ResourceComparisonDrawer } from '@/components/drawers/ResourceComparisonDrawer'
import { MonthPicker } from '@/components/ui/month-picker'
import { useCurrentUser } from '@/context/UserContext'
import { useProjects } from '@/hooks/use-projects'
import {
  getAvailableBillingMonths,
  getBillingRecords,
  uploadBillingRecords,
} from '@/services/billing'
import { getBillingThresholdConfig } from '@/services/billingConfig'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { BillingRecord, BillingThresholdConfig } from '@/types/finance'
import type { Project } from '@/types'

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCSV(text: string): BillingRecord[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rsIdx  = headers.indexOf('resource_set')
  const amtIdx = headers.indexOf('amount')
  if (rsIdx === -1 || amtIdx === -1)
    throw new Error('CSV must have "resource_set" and "amount" columns')
  return lines.slice(1).map((line, i) => {
    const cols   = line.split(',')
    const amount = parseFloat(cols[amtIdx]?.trim() ?? '')
    if (isNaN(amount)) throw new Error(`Row ${i + 2}: invalid amount value`)
    return { resourceSet: cols[rsIdx]?.trim() ?? '', amount }
  }).filter(r => r.resourceSet)
}

// ─── Ratio Badge ─────────────────────────────────────────────────────────────

function RatioBadge({ ratio, thresholds }: { ratio: number | null; thresholds: BillingThresholdConfig }) {
  if (ratio === null) return <span className="text-muted-foreground/40">—</span>

  const pct = `${ratio.toFixed(1)}%`
  const className =
    ratio < thresholds.healthyAtRiskThreshold
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : ratio <= thresholds.atRiskOverThreshold
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'

  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-bold tabular-nums', className)}>
      {pct}
    </span>
  )
}

// ─── Format Money ─────────────────────────────────────────────────────────────

function formatMoney(amount: number | null): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[(parseInt(month, 10) - 1)] ?? month} ${year}`
}

// ─── Ratio Status ─────────────────────────────────────────────────────────────

type RatioStatus = 'under' | 'at-risk' | 'over' | 'no-data'

function getStatus(ratio: number | null, thresholds: BillingThresholdConfig): RatioStatus {
  if (ratio === null) return 'no-data'
  if (ratio < thresholds.healthyAtRiskThreshold)   return 'under'
  if (ratio <= thresholds.atRiskOverThreshold)     return 'at-risk'
  return 'over'
}

const RATIO_STATUS_CONFIG: Record<RatioStatus, {
  label: string
  activeClass: string
  tooltipFn: (t: BillingThresholdConfig) => string
}> = {
  'under':   { label: 'Healthy', activeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700', tooltipFn: (t) => `Ratio < ${t.healthyAtRiskThreshold}%` },
  'at-risk': { label: 'At Risk', activeClass: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',             tooltipFn: (t) => `${t.healthyAtRiskThreshold}% ≤ Ratio ≤ ${t.atRiskOverThreshold}%` },
  'over':    { label: 'Over',    activeClass: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',                           tooltipFn: (t) => `Ratio > ${t.atRiskOverThreshold}%` },
  'no-data': { label: 'No Data', activeClass: 'bg-muted text-muted-foreground border-border',                                                                               tooltipFn: () => 'No data for one or both environments' },
}

// ─── Upload Card ─────────────────────────────────────────────────────────────

interface UploadCardProps {
  label: string
  env: 'existing' | 'target'
  uploadedFileName: string | null
  uploading: boolean
  onUpload: (env: 'existing' | 'target', month: string, records: BillingRecord[]) => Promise<void>
  onClear: (env: 'existing' | 'target') => void
}

function UploadCard({ label, env, uploadedFileName, uploading, onUpload, onClear }: UploadCardProps) {
  const [month, setMonth] = useState('')

  const handleFile = async (file: File) => {
    if (!month) {
      toast.error('No month selected', { description: 'Select a billing month before uploading.' })
      return
    }
    try {
      const text = await file.text()
      const records = parseCSV(text)
      await onUpload(env, month, records)
    } catch (err) {
      toast.error('Failed to parse CSV', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
          env === 'existing'
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary/10 text-primary',
        )}>
          {env === 'existing' ? 'E' : 'T'}
        </div>
        <p className="font-semibold text-sm">{label}</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Billing Month</label>
        <MonthPicker value={month} onChange={setMonth} disabled={uploading} />
      </div>

      {uploadedFileName ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 size={14} className="shrink-0" />
          <span className="flex-1 truncate text-xs font-medium">{uploadedFileName}</span>
          <button
            onClick={() => onClear(env)}
            className="shrink-0 hover:text-emerald-600"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <label className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-5 text-center transition-colors hover:border-primary/50 hover:bg-muted/30',
          uploading && 'opacity-50 pointer-events-none',
        )}>
          <Upload size={18} className="text-muted-foreground" />
          <div>
            <p className="text-xs font-medium text-foreground">Click to upload CSV</p>
            <p className="text-xs text-muted-foreground mt-0.5">resource_set, amount</p>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) { void handleFile(file); e.target.value = '' }
            }}
          />
        </label>
      )}
    </div>
  )
}

// ─── Row type ────────────────────────────────────────────────────────────────

interface ComparisonRow {
  resourceSet: string
  projectId: string
  existingAmount: number | null
  targetAmount: number | null
  ratio: number | null
}

interface ProjectGroup {
  projectId: string
  projectName: string
  rows: ComparisonRow[]
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FinancePage() {
  const { user } = useCurrentUser()
  const { projects } = useProjects()

  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [existingRecords, setExistingRecords] = useState<BillingRecord[]>([])
  const [targetRecords, setTargetRecords] = useState<BillingRecord[]>([])
  const [loadingMonths, setLoadingMonths] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)

  const [existingFileName, setExistingFileName] = useState<string | null>(null)
  const [targetFileName, setTargetFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [nameFilter, setNameFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<RatioStatus>>(new Set())

  const [thresholds, setThresholds] = useState<BillingThresholdConfig>({ healthyAtRiskThreshold: 100, atRiskOverThreshold: 120 })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedResourceSet, setSelectedResourceSet] = useState<string>('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const isPlatformLead = user?.role === 'Platform Migration Lead'

  // ── Load available months (union of existing + target) ──────────────────────
  const refreshMonths = useCallback(async () => {
    setLoadingMonths(true)
    try {
      const [existingMonths, targetMonths] = await Promise.all([
        getAvailableBillingMonths('existing'),
        getAvailableBillingMonths('target'),
      ])
      const union = Array.from(new Set([...existingMonths, ...targetMonths])).sort().reverse()
      setAvailableMonths(union)
      if (!selectedMonth && union.length > 0) setSelectedMonth(union[0]!)
    } finally {
      setLoadingMonths(false)
    }
  }, [selectedMonth])

  useEffect(() => { void refreshMonths() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load billing thresholds ─────────────────────────────────────────────────
  useEffect(() => {
    getBillingThresholdConfig().then(setThresholds).catch(() => { /* keep defaults */ })
  }, [])

  // ── Fetch records for the selected month ────────────────────────────────────
  useEffect(() => {
    if (!selectedMonth) return
    setLoadingRecords(true)
    Promise.all([
      getBillingRecords(selectedMonth, 'existing'),
      getBillingRecords(selectedMonth, 'target'),
    ])
      .then(([ex, tg]) => { setExistingRecords(ex); setTargetRecords(tg) })
      .catch(() => toast.error('Failed to load billing records'))
      .finally(() => setLoadingRecords(false))
  }, [selectedMonth])

  // ── Reset filters when month changes ────────────────────────────────────────
  useEffect(() => {
    setNameFilter('')
    setStatusFilter(new Set())
  }, [selectedMonth])

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleUpload = async (env: 'existing' | 'target', month: string, records: BillingRecord[]) => {
    setUploading(true)
    try {
      await uploadBillingRecords({ month, env, records })
      if (env === 'existing') setExistingFileName(`billing-existing-${month}.csv (${records.length} rows)`)
      else setTargetFileName(`billing-target-${month}.csv (${records.length} rows)`)

      // Refresh months list and switch to the newly uploaded month
      const [existingMonths, targetMonths] = await Promise.all([
        getAvailableBillingMonths('existing'),
        getAvailableBillingMonths('target'),
      ])
      const union = Array.from(new Set([...existingMonths, ...targetMonths])).sort().reverse()
      setAvailableMonths(union)
      setSelectedMonth(month)

      toast.success('Billing data uploaded', {
        description: `${records.length} records saved for ${formatMonth(month)} (${env} environment).`,
      })
    } catch {
      toast.error('Upload failed', { description: 'Could not save billing records.' })
    } finally {
      setUploading(false)
    }
  }

  const handleClear = (env: 'existing' | 'target') => {
    if (env === 'existing') setExistingFileName(null)
    else setTargetFileName(null)
  }

  // ── Build comparison rows per project ───────────────────────────────────────
  const projectGroups = useMemo<ProjectGroup[]>(() => {
    const existingMap = new Map(existingRecords.map(r => [r.resourceSet, r.amount]))
    const targetMap   = new Map(targetRecords.map(r => [r.resourceSet, r.amount]))

    // Collect all unique resourceSets per project from their resources
    const groups: ProjectGroup[] = []
    for (const project of projects) {
      const resources = project.currentInfrastructure?.resources ?? []
      const resourceSets = Array.from(new Set(resources.map(r => r.resourceSet).filter(Boolean))) as string[]
      if (resourceSets.length === 0) continue

      // Only include projects that have at least one billing record in either env
      const rows: ComparisonRow[] = resourceSets
        .filter(rs => existingMap.has(rs) || targetMap.has(rs))
        .map(rs => {
          const existingAmount = existingMap.get(rs) ?? null
          const targetAmount   = targetMap.get(rs) ?? null
          const ratio =
            existingAmount !== null && targetAmount !== null
              ? (targetAmount / existingAmount) * 100
              : null
          return { resourceSet: rs, projectId: project.id, existingAmount, targetAmount, ratio }
        })
        .filter(r => nameFilter === '' || r.resourceSet.toLowerCase().includes(nameFilter.toLowerCase()))
        .filter(r => statusFilter.size === 0 || statusFilter.has(getStatus(r.ratio, thresholds)))

      if (rows.length > 0) {
        groups.push({ projectId: project.id, projectName: project.name, rows })
      }
    }
    return groups
  }, [projects, existingRecords, targetRecords, nameFilter, statusFilter, thresholds])

  // ── Row click → open comparison drawer ─────────────────────────────────────
  const handleRowClick = (row: ComparisonRow) => {
    const project = projects.find(p => p.id === row.projectId) ?? null
    setSelectedResourceSet(row.resourceSet)
    setSelectedProject(project)
    setDrawerOpen(true)
  }

  const hasAnyData = availableMonths.length > 0

  if (!isPlatformLead) {
    return (
      <AppShell title="Finance">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold text-foreground mb-2">Access Restricted</p>
            <p className="text-muted-foreground text-sm">
              Finance is only accessible to the Platform Migration Lead.
            </p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Finance">
      <div className="max-w-screen-xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="size-5 text-muted-foreground" />
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing Comparison</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Compare cloud costs between existing and target environments per resource set
            </p>
          </div>
        </div>

        {/* Upload section */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Upload Monthly Billing Records
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UploadCard
              label="Existing Environment"
              env="existing"
              uploadedFileName={existingFileName}
              uploading={uploading}
              onUpload={handleUpload}
              onClear={handleClear}
            />
            <UploadCard
              label="Target Environment"
              env="target"
              uploadedFileName={targetFileName}
              uploading={uploading}
              onUpload={handleUpload}
              onClear={handleClear}
            />
          </div>
        </div>

        {/* Comparison section */}
        {loadingMonths ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !hasAnyData ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Upload billing CSVs above to see the comparison.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Month selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Billing Month
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  value={nameFilter}
                  onChange={e => setNameFilter(e.target.value)}
                  placeholder="Filter resource sets…"
                  className="pl-8 h-8 w-52 text-sm"
                />
              </div>
              <div className="h-5 w-px bg-border mx-2" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Ratio:</span>
              <TooltipProvider>
                <div className="flex items-center gap-1.5">
                  {(Object.entries(RATIO_STATUS_CONFIG) as [RatioStatus, typeof RATIO_STATUS_CONFIG[RatioStatus]][]).map(([status, cfg]) => {
                    const active = statusFilter.has(status)
                    return (
                      <Tooltip key={status}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setStatusFilter(prev => {
                                const next = new Set(prev)
                                active ? next.delete(status) : next.add(status)
                                return next
                              })
                            }}
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold transition-colors',
                              active
                                ? cn(cfg.activeClass, 'ring-1 ring-offset-1 ring-current')
                                : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted',
                            )}
                          >
                            {cfg.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{cfg.tooltipFn(thresholds)}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
              {(nameFilter !== '' || statusFilter.size > 0) && (
                <button
                  onClick={() => { setNameFilter(''); setStatusFilter(new Set()) }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Comparison table */}
            {loadingRecords ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : projectGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No billing records match any resource sets for {formatMonth(selectedMonth)}.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {projectGroups.map(group => (
                  <div key={group.projectId}>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{group.projectName}</h3>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="font-bold text-xs uppercase tracking-wider">Resource Set</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Existing Cost</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Target Cost</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Ratio (Target / Existing)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map(row => (
                            <TableRow
                              key={row.resourceSet}
                              className="cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => handleRowClick(row)}
                            >
                              <TableCell>
                                <code className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded font-mono whitespace-nowrap">
                                  {row.resourceSet}
                                </code>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums">
                                {row.existingAmount !== null
                                  ? formatMoney(row.existingAmount)
                                  : <span className="text-muted-foreground/40">—</span>}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm tabular-nums">
                                {row.targetAmount !== null
                                  ? formatMoney(row.targetAmount)
                                  : <span className="text-muted-foreground/40">—</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                <RatioBadge ratio={row.ratio} thresholds={thresholds} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ResourceComparisonDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        resourceSet={selectedResourceSet}
        project={selectedProject}
      />
    </AppShell>
  )
}
