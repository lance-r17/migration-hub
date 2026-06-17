import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Database,
  Timer,
  CalendarRange,
  Users,
  Check,
  Shield,
  Cloud,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxPopover,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxItem,
} from '@/components/ui/combobox'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { useDataMigrationCycleBlocks } from '@/hooks/use-data-migration-cycle-blocks'
import { useCurrentUser } from '@/context/UserContext'
import { markDataMigrationSurveySubmitted } from '@/services/projects'
import { getBgiCloudLeads } from '@/services/adminUsers'
import { getBgiHierarchy } from '@/services/bgi'
import type { Project, DataMigrationSchedule } from '@/types'
import type { DataMigrationCycleBlock } from '@/services/projects'
import type { User, BgiNode } from '@/types'

interface DataMigrationSurveyModalProps {
  open: boolean
  onClose: () => void
  project: Project
  onSave: <K extends keyof Project>(key: K, value: Project[K]) => Promise<void>
  onSubmitted?: () => void | Promise<void>
}

const ENDPOINTS = {
  projects: '/api/v1/projects',
  dataMigrationSurveySubmitted: (id: string) => `/api/v1/projects/${id}/data-migration-survey-submitted`,
}

interface FormState {
  startDate?: string
  endDate?: string
  cycleCount: number
  cycleCountOption: 'min' | 'more'
  cycleJustification: string
  dtsInstanceCount: number
  dtsJustification: string
  needAsrDr: boolean
  asrDrJustification: string
  bgiCloudLeadId?: string
  approvalAcknowledged: boolean
  forwardAcknowledged: boolean
  confirmAcknowledged: boolean
  acceptsTimeAdjustment: boolean
}

export function DataMigrationSurveyModal({
  open,
  onClose,
  project,
  onSave,
  onSubmitted,
}: DataMigrationSurveyModalProps) {
  const { settings, loading } = useMigrationSettings()
  const { user } = useCurrentUser()
  const dm = settings?.dataMigration

  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [bgiCloudLeads, setBgiCloudLeads] = useState<User[]>([])
  const [bgiLeadsLoading, setBgiLeadsLoading] = useState(false)
  const [bgiRoot, setBgiRoot] = useState<BgiNode | null>(null)
  const [bgiSearch, setBgiSearch] = useState('')
  const [bgiDropdownOpen, setBgiDropdownOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setBgiLeadsLoading(true)
    Promise.all([
      getBgiCloudLeads(),
      getBgiHierarchy(),
    ])
      .then(([leads, root]) => {
        setBgiCloudLeads(leads)
        setBgiRoot(root)
      })
      .catch(() => { toast.error('Failed to load BGI cloud leads') })
      .finally(() => setBgiLeadsLoading(false))
  }, [open])

  const defaults = useMemo(() => {
    return {
      cycleCount: dm?.minCycle ?? 1,
      dtsInstanceCount: dm?.minDtsInstanceCount ?? 1,
    }
  }, [dm])

  const existing = project.dataMigrationSchedule
  const minCycle = dm?.minCycle ?? 1
  const maxCycle = dm?.maxCycle ?? 3
  const initialCycleCount = existing?.cycleCount ?? minCycle
  const initialCycleOption = existing?.cycleCountOption ?? (initialCycleCount > minCycle ? 'more' : 'min')

  const [form, setForm] = useState<FormState>({
    startDate: existing?.startDate,
    endDate: existing?.endDate,
    cycleCount: initialCycleCount,
    cycleCountOption: initialCycleOption,
    cycleJustification: existing?.cycleJustification ?? '',
    dtsInstanceCount: existing?.dtsInstanceCount ?? defaults.dtsInstanceCount,
    dtsJustification: existing?.dtsJustification ?? '',
    needAsrDr: existing?.needAsrDr ?? false,
    asrDrJustification: existing?.asrDrJustification ?? '',
    bgiCloudLeadId: existing?.bgiCloudLeadId,
    approvalAcknowledged: existing?.approvalAcknowledged ?? false,
    forwardAcknowledged: existing?.forwardAcknowledged ?? false,
    confirmAcknowledged: existing?.confirmAcknowledged ?? false,
    acceptsTimeAdjustment: existing?.acceptsTimeAdjustment ?? false,
  })

  const initializedRef = useRef(false)

  const {
    blocks,
    loading: blocksLoading,
    error: blocksError,
  } = useDataMigrationCycleBlocks({
    startDate: dm?.cyclePeriod?.startDate,
    endDate: dm?.cyclePeriod?.endDate,
    durationDays: dm?.cycleDurationDays,
    enabled: open && !loading && !!dm,
  })

  useEffect(() => {
    // Derive initial form state once from async-loaded settings and existing schedule.
    if (initializedRef.current || loading || !dm) return
    initializedRef.current = true
    const existingCycleCount = existing?.cycleCount ?? dm.minCycle
    const existingCycleOption = existing?.cycleCountOption ?? (existingCycleCount > dm.minCycle ? 'more' : 'min')
    setForm({
      startDate: existing?.startDate,
      endDate: existing?.endDate,
      cycleCount: existingCycleCount,
      cycleCountOption: existingCycleOption,
      cycleJustification: existing?.cycleJustification ?? '',
      dtsInstanceCount: existing?.dtsInstanceCount ?? dm.minDtsInstanceCount,
      dtsJustification: existing?.dtsJustification ?? '',
      needAsrDr: existing?.needAsrDr ?? false,
      asrDrJustification: existing?.asrDrJustification ?? '',
      bgiCloudLeadId: existing?.bgiCloudLeadId,
      approvalAcknowledged: existing?.approvalAcknowledged ?? false,
      forwardAcknowledged: existing?.forwardAcknowledged ?? false,
      confirmAcknowledged: existing?.confirmAcknowledged ?? false,
      acceptsTimeAdjustment: existing?.acceptsTimeAdjustment ?? false,
    })
  }, [loading, dm, existing])

  useEffect(() => {
    if (blocksError) {
      toast.error('Failed to load migration cycle blocks')
    }
  }, [blocksError])

  const dtsOptions = useMemo(() => {
    const min = dm?.minDtsInstanceCount ?? 1
    const max = dm?.maxDtsInstanceCount ?? 5
    return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
  }, [dm])

  const selectedBlock = useMemo(() => {
    if (!form.startDate || !form.endDate) return undefined
    return blocks.find(
      (b) => b.startDate === form.startDate && b.endDate === form.endDate
    )
  }, [blocks, form.startDate, form.endDate])

  const capacity = dm?.cycleCapacity ?? 20
  const asrDrLicenseCapacity = dm?.asrDrLicenseCapacity ?? 2

  const isCurrentProjectBookedForSelectedBlock = useMemo(() => {
    if (!form.startDate || !form.endDate || !existing?.startDate || !existing?.endDate) return false
    return form.startDate === existing.startDate && form.endDate === existing.endDate
  }, [form.startDate, form.endDate, existing?.startDate, existing?.endDate])

  const isCurrentProjectAsrDrBookedForSelectedBlock = useMemo(() => {
    if (!isCurrentProjectBookedForSelectedBlock) return false
    return Boolean(existing?.needAsrDr)
  }, [isCurrentProjectBookedForSelectedBlock, existing?.needAsrDr])

  const dateError = useMemo(() => {
    if (!form.startDate || !form.endDate) return 'Please select a migration cycle block.'
    if (selectedBlock && selectedBlock.bookedCount >= capacity && !isCurrentProjectBookedForSelectedBlock) {
      return 'Selected cycle block is fully booked. Please choose another block.'
    }
    return null
  }, [form.startDate, form.endDate, selectedBlock, capacity, isCurrentProjectBookedForSelectedBlock])

  const isAsrDrFullyBooked = useMemo(() => {
    if (!selectedBlock) return false
    return (
      selectedBlock.asrDrBookedCount >= asrDrLicenseCapacity &&
      !isCurrentProjectAsrDrBookedForSelectedBlock
    )
  }, [selectedBlock, asrDrLicenseCapacity, isCurrentProjectAsrDrBookedForSelectedBlock])

  const showDtsJustification = form.dtsInstanceCount > (dm?.minDtsInstanceCount ?? 1)
  const dbResources = useMemo(() => {
    const resources = project.currentInfrastructure?.resources ?? []
    const dbProducts = new Set([
      'polardb',
      'rds',
      'r-kvstore',
      'dds',
      'mongodb',
      'redis',
      'mysql',
      'postgres',
      'postgresql',
      'sqlserver',
      'oracle',
    ])
    return resources.filter(r =>
      r.product && dbProducts.has(r.product.toLowerCase()) && r.needMigration !== false
    )
  }, [project.currentInfrastructure])
  const dbResourceCount = dbResources.length
  const requiresCycleApproval = form.cycleCountOption === 'more'

  const isValidForm = useMemo(() => {
    if (!form.startDate || !form.endDate) return false
    if (dateError) return false
    if (showDtsJustification && !form.dtsJustification.trim()) return false
    if (requiresCycleApproval) {
      if (!form.bgiCloudLeadId) return false
      if (!form.approvalAcknowledged || !form.forwardAcknowledged || !form.confirmAcknowledged) return false
    }
    return true
  }, [form, dateError, showDtsJustification, requiresCycleApproval])

  const totalSteps = 2
  const isWelcomeSlide = currentIndex === 0
  const isLast = currentIndex === totalSteps - 1

  const selectBlock = useCallback((block: DataMigrationCycleBlock) => {
    setForm((prev) => {
      const matchesExisting =
        existing?.startDate === block.startDate && existing?.endDate === block.endDate
      return {
        ...prev,
        startDate: block.startDate,
        endDate: block.endDate,
        needAsrDr: matchesExisting ? (existing?.needAsrDr ?? false) : false,
        asrDrJustification: matchesExisting ? (existing?.asrDrJustification ?? '') : '',
      }
    })
  }, [existing?.startDate, existing?.endDate, existing?.needAsrDr, existing?.asrDrJustification])

  const toggleAsrDr = useCallback((checked: boolean | 'indeterminate') => {
    setForm((prev) => ({
      ...prev,
      needAsrDr: checked === true,
      asrDrJustification: checked === true ? prev.asrDrJustification : '',
    }))
  }, [])

  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }))
  }, [])

  const selectCycleOption = useCallback((option: 'min' | 'more') => {
    setForm(prev => ({
      ...prev,
      cycleCountOption: option,
      cycleCount: option === 'min' ? (dm?.minCycle ?? 1) : (dm?.maxCycle ?? 3),
      approvalAcknowledged: option === 'min' ? false : prev.approvalAcknowledged,
      forwardAcknowledged: option === 'min' ? false : prev.forwardAcknowledged,
      confirmAcknowledged: option === 'min' ? false : prev.confirmAcknowledged,
      bgiCloudLeadId: option === 'min' ? undefined : prev.bgiCloudLeadId,
      cycleJustification: option === 'min' ? '' : prev.cycleJustification,
    }))
  }, [dm])

  const getBgiTierLabel = useCallback((bgiId: string): string => {
    if (!bgiRoot) return bgiId
    function walk(node: BgiNode): string | null {
      if (node.id === bgiId) return node.name
      for (const child of node.children ?? []) {
        const found = walk(child)
        if (found) return found
      }
      return null
    }
    return walk(bgiRoot) ?? bgiId
  }, [bgiRoot])

  const filteredBgiCloudLeads = useMemo(() => {
    let leads = bgiCloudLeads
    if (project.bgi_id) {
      leads = bgiCloudLeads.filter(lead => lead.bgi_ids?.includes(project.bgi_id!))
    }
    const q = bgiSearch.trim().toLowerCase()
    if (!q) return leads
    return leads.filter(lead =>
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.bgi_ids?.some(id => getBgiTierLabel(id).toLowerCase().includes(q))
    )
  }, [bgiCloudLeads, project.bgi_id, bgiSearch, getBgiTierLabel])

  const handleSubmit = useCallback(async () => {
    if (!isValidForm) return
    setSubmitting(true)
    try {
      const payload: DataMigrationSchedule = {
        startDate: form.startDate,
        endDate: form.endDate,
        cycleCount: form.cycleCount,
        cycleCountOption: form.cycleCountOption,
        ...(form.cycleJustification.trim() && { cycleJustification: form.cycleJustification.trim() }),
        dtsInstanceCount: form.dtsInstanceCount,
        ...(showDtsJustification && { dtsJustification: form.dtsJustification.trim() }),
        needAsrDr: form.needAsrDr,
        ...(form.asrDrJustification.trim() && { asrDrJustification: form.asrDrJustification.trim() }),
        ...(requiresCycleApproval && {
          bgiCloudLeadId: form.bgiCloudLeadId,
          approvalAcknowledged: form.approvalAcknowledged,
          forwardAcknowledged: form.forwardAcknowledged,
          confirmAcknowledged: form.confirmAcknowledged,
        }),
        acceptsTimeAdjustment: form.acceptsTimeAdjustment,
      }
      await onSave('dataMigrationSchedule', payload)
      await markDataMigrationSurveySubmitted(project.id)
      await onSubmitted?.()
      setCompleted(true)
    } catch {
      toast.error('Failed to submit data migration survey. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [isValidForm, form, requiresCycleApproval, showDtsJustification, onSave, project.id, onSubmitted])

  const goNext = useCallback(() => {
    if (isLast) {
      void handleSubmit()
    } else {
      setCurrentIndex(i => i + 1)
    }
  }, [isLast, handleSubmit])

  const goBack = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1))
  }, [])

  if (!open) return null

  const progress = Math.round(((currentIndex + (completed ? 1 : 0)) / totalSteps) * 100)

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-background">
      {/* Progress bar */}
      <div className="h-1 bg-muted w-full shrink-0">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-primary" />
          <span className="font-semibold text-sm">{project.name} — Data Migration Survey</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-6">
        {loading || blocksLoading ? (
          <div className="h-full flex items-center justify-center">
            <Skeleton className="h-10 w-64" />
          </div>
        ) : (
          <div className="h-full w-full mx-auto max-w-5xl">
            {completed ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <CheckCircle2 size={56} className="text-primary mx-auto" />
                <h2 className="text-2xl font-semibold">Data migration survey complete!</h2>
                <p className="text-muted-foreground">
                  Your data migration schedule has been saved to the project record.
                </p>
                <Button onClick={onClose} size="lg" className="mt-4 px-10">Close</Button>
              </div>
            ) : isWelcomeSlide ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
                    <Database size={32} className="text-primary" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-bold tracking-tight">
                      Data Migration Schedule
                    </h2>
                    <div className="text-left space-y-4 max-w-3xl mx-auto">
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold">Purpose</h3>
                        <p className="text-base text-muted-foreground leading-relaxed">
                          Help us build the overall migration plan for project: {project.id}. Please confirm your proposed data migration schedule, including the migration cycle block and migration tool resources you'll need.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold">How to choose migration week / cycle block?</h3>
                        <ul className="text-base text-muted-foreground leading-relaxed list-disc space-y-1 pl-4">
                          <li>Selecting a migration week (cycle block) means your team plans to complete the full set of data migration activities, which means cutover completed, within that time window.</li>
                          <li>If your application depends on other systems, please align the schedule with the upstream / downstream teams first, then submit this questionnaire.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left w-full mx-auto">
                  <div className="rounded-2xl bg-muted/50 border border-border/50 p-5 space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Database size={16} />
                      </div>
                      <h3 className="text-sm font-semibold">DTS (Database Migration)</h3>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc space-y-1 pl-4 leading-relaxed">
                      <li>Please confirm the DB instances to be migrated (this may impact DTS license usage).</li>
                      <li>Each project can use {dm?.minDtsInstanceCount ?? 1} license{dm?.minDtsInstanceCount !== 1 ? 's' : ''} by default. If you need more, please provide justification for approval.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-muted/50 border border-border/50 p-5 space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Shield size={16} />
                      </div>
                      <h3 className="text-sm font-semibold">ASR-DR (Big Data Migration)</h3>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc space-y-1 pl-4 leading-relaxed">
                      <li>Default allocation per migration cycle block: 2 security groups</li>
                      <li>Maximum per project: 1 protection group</li>
                      <li>The final schedule may be adjusted with Alibaba Big Data Migration SMEs collaboration</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-muted/50 border border-border/50 p-5 space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Cloud size={16} />
                      </div>
                      <h3 className="text-sm font-semibold">AMC — ACR / SLS / OSS Migration</h3>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc space-y-1 pl-4 leading-relaxed">
                      <li>Default quota per migration cycle block: {capacity} total</li>
                      <li>Default quota per project: 1</li>
                      <li>No additional / flexible quota can be requested</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-muted/50 border border-border/50 p-5 space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Wrench size={16} />
                      </div>
                      <h3 className="text-sm font-semibold">Other Tools / Self-managed Migration</h3>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc space-y-1 pl-4 leading-relaxed">
                      <li>Use this option for migration approaches not covered by DTS, ASR-DR or AMC.</li>
                      <li>Examples include migrating EBS using OS utilities, or migrating other products using self-managed or third-party tools.</li>
                    </ul>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-sm font-medium text-primary border border-primary/10">
                  <Timer size={14} />
                  Estimated time: ~2 minutes
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col gap-5">
                <div className="space-y-1 shrink-0">
                  <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    Data Migration Schedule
                  </span>
                  <h2 className="text-2xl font-semibold leading-snug">
                    Enter your data migration details
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Select a cycle block, then configure cycles and DTS instances.
                  </p>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 [contain:layout]">
                  {/* Left column: cycle blocks */}
                  <div className="flex flex-col gap-3 min-h-0">
                    <div className="flex items-center justify-between shrink-0">
                      <Label>Migration Cycle Block *</Label>
                      {dm?.cyclePeriod?.startDate && dm?.cyclePeriod?.endDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(dm.cyclePeriod.startDate), 'MMM d, y')} – {format(new Date(dm.cyclePeriod.endDate), 'MMM d, y')}
                        </span>
                      )}
                    </div>

                    {blocksLoading ? (
                      <div className="flex flex-col gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-20 w-full" />
                        ))}
                      </div>
                    ) : blocks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No cycle blocks available. Please configure the cycle period and duration in Migration Settings.
                      </p>
                    ) : (
                      <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0 overscroll-contain">
                        <div className="flex flex-col gap-3 pb-2">
                          {blocks.map((block) => {
                            const isSelected = selectedBlock?.startDate === block.startDate && selectedBlock?.endDate === block.endDate
                            const isFull = block.bookedCount >= capacity
                            const isAsrDrFull = block.asrDrBookedCount >= asrDrLicenseCapacity
                            return (
                              <button
                                key={`${block.startDate}-${block.endDate}`}
                                type="button"
                                disabled={isFull}
                                onClick={() => selectBlock(block)}
                                className={cn(
                                  'relative flex items-center justify-between gap-3 rounded-lg border p-4 text-left transition-all',
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50',
                                  isFull && 'opacity-60 cursor-not-allowed hover:border-border hover:bg-card'
                                )}
                              >
                                <div className="flex flex-col items-start gap-2">
                                  <div className="flex items-center gap-2">
                                    <CalendarRange size={16} />
                                    <span className="text-sm font-medium">
                                      {format(new Date(block.startDate), 'MMM d, y')} – {format(new Date(block.endDate), 'MMM d, y')}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <Users size={12} />
                                    <span>
                                      {block.bookedCount} / {capacity} booked
                                    </span>
                                    {isFull && (
                                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-destructive">
                                        Full
                                      </span>
                                    )}
                                    <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5">
                                      <Shield size={10} className="mr-1" />
                                      ASR-DR {block.asrDrBookedCount} / {asrDrLicenseCapacity}
                                    </span>
                                    {isAsrDrFull && (
                                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-destructive">
                                        ASR-DR Full
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <span className="inline-flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
                                    <Check size={14} />
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right column: remaining inputs */}
                  <div className="flex flex-col gap-5 overflow-y-auto px-2 -mx-2 min-h-0 overscroll-contain">
                    {/* Cycle Count */}
                    <div className="space-y-1.5">
                      <Label>Cycle Count *</Label>
                      <Select
                        value={form.cycleCountOption}
                        onValueChange={(v) => selectCycleOption(v as 'min' | 'more')}
                        modal={false}
                      >
                        <SelectTrigger className="h-10 w-full justify-between">
                          <SelectValue placeholder="Select cycle count" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[400] w-[--radix-select-trigger-width]">
                          <SelectItem value="min">{dm?.minCycle ?? 1}</SelectItem>
                          <SelectItem value="more">&gt; {dm?.minCycle ?? 1}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Default: {dm?.minCycle ?? 1} cycle(s)</p>
                    </div>

                    {/* Cycle Approval Acknowledgements */}
                    {requiresCycleApproval && (
                      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          For applications requiring more than {dm?.minCycle ?? 1} cycle count, the following criteria must be met before submission:
                        </p>

                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="approval-ack"
                              checked={form.approvalAcknowledged}
                              onCheckedChange={(checked) => updateForm({ approvalAcknowledged: checked === true })}
                            />
                            <Label htmlFor="approval-ack" className="text-xs font-normal leading-relaxed">
                              Obtain approval email from your BGI Cloud Lead
                              {project.bgi_id && ' (select BGI Cloud Lead of your business line from below)'}
                            </Label>
                          </div>

                          <div className="pl-7">
                            <Combobox
                              open={bgiDropdownOpen}
                              onOpenChange={setBgiDropdownOpen}
                              search={bgiSearch}
                              onSearchChange={setBgiSearch}
                            >
                              <ComboboxPopover>
                                <ComboboxTrigger
                                  disabled={bgiLeadsLoading || filteredBgiCloudLeads.length === 0}
                                  className="h-9 text-xs"
                                  placeholder={
                                    bgiLeadsLoading
                                      ? 'Loading…'
                                      : form.bgiCloudLeadId
                                        ? (() => {
                                            const lead = bgiCloudLeads.find((l) => l.id === form.bgiCloudLeadId)
                                            return lead ? `${lead.name} (${lead.email})` : 'Select BGI Cloud Lead'
                                          })()
                                        : filteredBgiCloudLeads.length === 0
                                          ? 'No BGI Cloud Lead available'
                                          : 'Select BGI Cloud Lead'
                                  }
                                />
                                <ComboboxContent className="z-[400]">
                                  <ComboboxInput placeholder="Search by name, email or BGI tier…" />
                                  <ComboboxList>
                                    {filteredBgiCloudLeads.length === 0 ? (
                                      <ComboboxEmpty>No BGI Cloud Lead found.</ComboboxEmpty>
                                    ) : (
                                      filteredBgiCloudLeads.map((lead) => (
                                        <ComboboxItem
                                          key={lead.id}
                                          value={lead.id}
                                          selected={form.bgiCloudLeadId === lead.id}
                                          onSelect={(v) => {
                                            updateForm({ bgiCloudLeadId: v || undefined })
                                            setBgiDropdownOpen(false)
                                          }}
                                        >
                                          <div className="flex flex-col items-start gap-0.5">
                                            <span className="text-sm font-medium">{lead.name} ({lead.email})</span>
                                            {lead.bgi_ids && lead.bgi_ids.length > 0 && (
                                              <span className="text-xs text-muted-foreground">
                                                {lead.bgi_ids.map(getBgiTierLabel).join(', ')}
                                              </span>
                                            )}
                                          </div>
                                        </ComboboxItem>
                                      ))
                                    )}
                                  </ComboboxList>
                                </ComboboxContent>
                              </ComboboxPopover>
                            </Combobox>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="forward-ack"
                            checked={form.forwardAcknowledged}
                            onCheckedChange={(checked) => updateForm({ forwardAcknowledged: checked === true })}
                          />
                          <Label htmlFor="forward-ack" className="inline text-xs font-normal leading-relaxed">
                            Forward the approval email to migration support mailbox{' '}
                            {dm?.supportEmail ? (
                              <span className="inline font-medium text-primary underline decoration-primary/40">{dm.supportEmail}</span>
                            ) : (
                              <span className="inline text-destructive">(not configured)</span>
                            )}
                          </Label>
                        </div>

                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="confirm-ack"
                            checked={form.confirmAcknowledged}
                            onCheckedChange={(checked) => updateForm({ confirmAcknowledged: checked === true })}
                          />
                          <Label htmlFor="confirm-ack" className="inline text-xs font-normal leading-relaxed">
                            Communicate with migration support team{' '}
                            {dm?.supportEmail ? (
                              <span className="inline font-medium text-primary underline decoration-primary/40">({dm.supportEmail})</span>
                            ) : (
                              <span className="inline text-destructive">(not configured)</span>
                            )}{' '}
                            and obtain confirmation
                          </Label>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <Label htmlFor="cycle-notes" className="text-xs">
                            Additional notes (optional)
                          </Label>
                          <textarea
                            id="cycle-notes"
                            value={form.cycleJustification}
                            onChange={(e) => updateForm({ cycleJustification: e.target.value })}
                            placeholder="Any additional context for the cycle count request…"
                            rows={3}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* DTS Instance Count */}
                    <div className="space-y-1.5">
                      <Label>DTS Instance Count *</Label>
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs text-muted-foreground leading-relaxed">
                        <p>
                          This project currently has{' '}
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="font-medium text-primary underline decoration-primary/40 cursor-help">
                                  {dbResourceCount}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-medium">Database resources</p>
                                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                                    {dbResources.map(r => (
                                      <li key={r.resourceId}>
                                        {r.name} <span className="text-muted-foreground">({r.product})</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>{' '}
                          database resource{dbResourceCount !== 1 ? 's' : ''}.
                        </p>
                        <ul className="list-disc space-y-1 pl-4">
                          <li>For a full migration, {dm?.minDtsInstanceCount ?? 1} DTS license{dm?.minDtsInstanceCount !== 1 ? 's are' : ' is'} sufficient.</li>
                          <li>For instances that require incremental migration, an equivalent number of licenses is required.</li>
                        </ul>
                      </div>
                      <Select
                        value={String(form.dtsInstanceCount)}
                        onValueChange={(v) => updateForm({ dtsInstanceCount: parseInt(v, 10) })}
                        modal={false}
                      >
                        <SelectTrigger className="h-10 w-full justify-between">
                          <SelectValue placeholder="Select DTS instance count" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[400] w-[--radix-select-trigger-width]">
                          {dtsOptions.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* DTS Justification */}
                    {showDtsJustification && (
                      <div className="space-y-1.5">
                        <Label>DTS Instance Justification *</Label>
                        <textarea
                          value={form.dtsJustification}
                          onChange={(e) => updateForm({ dtsJustification: e.target.value })}
                          placeholder="Why do you need more than the default DTS instance count?"
                          rows={3}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                      </div>
                    )}

                    {/* ASR-DR Request */}
                    {selectedBlock && !isAsrDrFullyBooked && (
                      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="need-asr-dr"
                            checked={form.needAsrDr}
                            onCheckedChange={(checked) => toggleAsrDr(checked)}
                          />
                          <div className="space-y-1">
                            <Label htmlFor="need-asr-dr" className="font-medium">
                              Need ASR-DR
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Request an ASR-DR license for this cycle block ({selectedBlock.asrDrBookedCount} / {asrDrLicenseCapacity} booked).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedBlock && isAsrDrFullyBooked && (
                      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                            <Shield size={14} />
                            <span>ASR-DR license fully booked</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This cycle block has no remaining ASR-DR licenses ({selectedBlock.asrDrBookedCount} / {asrDrLicenseCapacity} booked). Please choose another cycle block to request ASR-DR. If you still require ASR-DR in this block, provide a justification below.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="asr-dr-justification">
                            ASR-DR Justification (optional)
                          </Label>
                          <textarea
                            id="asr-dr-justification"
                            value={form.asrDrJustification}
                            onChange={(e) => updateForm({ asrDrJustification: e.target.value })}
                            placeholder="Why is ASR-DR still required in this fully booked cycle block?"
                            rows={3}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          />
                          {form.needAsrDr && !form.asrDrJustification.trim() && (
                            <p className="text-xs text-amber-600">
                              You requested ASR-DR in a fully booked block. Consider adding a justification.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                      <Checkbox
                        id="time-adjustment"
                        checked={form.acceptsTimeAdjustment}
                        onCheckedChange={(checked) => updateForm({ acceptsTimeAdjustment: checked === true })}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="time-adjustment" className="font-medium">
                          Accept time adjustments (optional)
                        </Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          If accepted, the migration period may be extended and additional DTS licenses may be obtained.
                        </p>
                      </div>
                    </div>

                    {dateError && (
                      <p className="text-sm text-destructive">{dateError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      {!completed && !loading && !blocksLoading && (
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
          <Button variant="ghost" onClick={goBack} disabled={currentIndex === 0} className="gap-1.5">
            <ChevronLeft size={16} /> Back
          </Button>

          <Button onClick={goNext} disabled={isLast ? !isValidForm || submitting : false} className="gap-1.5 min-w-[120px]">
            {submitting ? 'Saving…' : isLast ? 'Submit' : <>Next <ChevronRight size={16} /></>}
          </Button>
        </div>
      )}
    </div>
  )
}
