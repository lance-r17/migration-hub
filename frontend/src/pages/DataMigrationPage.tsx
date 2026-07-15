import { useState, useEffect, useMemo, useCallback, type ComponentProps } from 'react'
import { Select as SelectPrimitive } from 'radix-ui'
import { useNavigate } from 'react-router-dom'
import { Database, ArrowLeft, LayoutDashboard, Save, CalendarRange, Users, Shield, Check, RotateCcw, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Combobox,
  ComboboxPopover,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox'
import { useDataMigrationCycleBlocks } from '@/hooks/use-data-migration-cycle-blocks'
import { useProjects } from '@/hooks/use-projects'
import { useCurrentUser } from '@/context/UserContext'
import { updateProject, markDataMigrationComplete, reopenDataMigration } from '@/services/projects'
import { getBgiCloudLeads } from '@/services/adminUsers'
import { getBgiHierarchy } from '@/services/bgi'
import { cn } from '@/lib/utils'
import { isDescendantOf } from '@/lib/bgi-utils'
import type { Project, DataMigrationSchedule, User } from '@/types'
import { useMigrationSettingsContext } from '@/context/MigrationSettingsContext'
import type { DataMigrationCycleBlock } from '@/services/projects'
import type { BgiNode } from '@/types/bgi'

function formatBlockRange(block: DataMigrationCycleBlock) {
  return `${format(new Date(block.startDate), 'MMM d, y')} – ${format(new Date(block.endDate), 'MMM d, y')}`
}

function CycleBlockSelectItem({
  isSelected,
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item> & { isSelected: boolean }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-2 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>
        <span className="flex items-center gap-2">
          {isSelected ? (
            <Check size={16} className="shrink-0" />
          ) : (
            <span className="size-4 shrink-0" />
          )}
          {children}
        </span>
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function CycleBlockMultiSelect({
  blocks,
  selected,
  onChange,
  disabled,
  capacity,
  blockBookedCounts,
  savedBlocks,
}: {
  blocks: DataMigrationCycleBlock[]
  selected: { startDate: string; endDate: string }[]
  onChange: (next: { startDate: string; endDate: string }[]) => void
  disabled?: boolean
  capacity: number
  blockBookedCounts: Map<string, number>
  savedBlocks: { startDate: string; endDate: string }[]
}) {
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(
    () => new Set(selected.map(b => `${b.startDate}|${b.endDate}`)),
    [selected]
  )

  const triggerLabel = useMemo(() => {
    if (selected.length === 0) return 'Select cycle blocks'
    const labels = selected.map(s => {
      const block = blocks.find(b => `${b.startDate}|${b.endDate}` === `${s.startDate}|${s.endDate}`)
      return block ? formatBlockRange(block) : `${s.startDate} – ${s.endDate}`
    })
    return labels.join(', ')
  }, [selected, blocks])

  const toggleBlock = (block: DataMigrationCycleBlock) => {
    const blockValue = `${block.startDate}|${block.endDate}`
    const exists = selectedSet.has(blockValue)
    const next = exists
      ? selected.filter(s => `${s.startDate}|${s.endDate}` !== blockValue)
      : [...selected, { startDate: block.startDate, endDate: block.endDate }]
    onChange(next)
  }

  return (
    <Combobox open={open} onOpenChange={setOpen}>
      <ComboboxPopover className="w-full">
        <ComboboxTrigger disabled={disabled} className="h-10 w-full">
          <span className="truncate text-left">{triggerLabel}</span>
        </ComboboxTrigger>
        <ComboboxContent align="start" className="w-full">
          <ComboboxList>
            {blocks.map(block => {
              const blockValue = `${block.startDate}|${block.endDate}`
              const isSelected = selectedSet.has(blockValue)
              const effectiveBookedCount = blockBookedCounts.get(blockValue) ?? block.bookedCount
              const isInSavedBlocks = savedBlocks.some(b => `${b.startDate}|${b.endDate}` === blockValue)
              const isFull = effectiveBookedCount >= capacity
              const isDisabled = isFull && !isInSavedBlocks && !isSelected
              return (
                <ComboboxItem
                  key={blockValue}
                  value={blockValue}
                  selected={isSelected}
                  onSelect={() => {
                    if (!isDisabled) toggleBlock(block)
                  }}
                  className={cn(isDisabled && 'opacity-50 pointer-events-none')}
                >
                  <span className="flex items-center justify-between w-full gap-4">
                    <span>{formatBlockRange(block)}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      ({effectiveBookedCount} / {capacity} booked)
                    </span>
                  </span>
                </ComboboxItem>
              )
            })}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxPopover>
    </Combobox>
  )
}

function isDifferent(a: unknown, b: unknown): boolean {
  if (a === b) return false
  if (a === undefined || a === null) return b !== undefined && b !== null
  if (b === undefined || b === null) return true
  return JSON.stringify(a) !== JSON.stringify(b)
}

function defaultPlanFromSurvey(survey: DataMigrationSchedule | undefined): DataMigrationSchedule {
  return { ...(survey ?? {}) }
}

export function DataMigrationPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { settings, loading: settingsLoading } = useMigrationSettingsContext()
  const dm = settings?.dataMigration

  useEffect(() => {
    if (!settingsLoading && !settings?.dataMigrationAdjustmentEnabled) {
      navigate('/', { replace: true })
    }
  }, [settingsLoading, settings, navigate])

  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false

  const { projects: initialProjects, loading: projectsLoading } = useProjects({
    fields: ['basic', 'progress', 'resources', 'team'],
  })

  const [projectOverrides, setProjectOverrides] = useState<Record<string, Partial<Project>>>({})
  const liveProjects = useMemo(() => {
    return initialProjects.map(p => ({ ...p, ...projectOverrides[p.id] }))
  }, [initialProjects, projectOverrides])

  const [selectedBlock, setSelectedBlock] = useState<DataMigrationCycleBlock | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [allowMultipleCycleBlocks, setAllowMultipleCycleBlocks] = useState(false)
  const [bgiRoot, setBgiRoot] = useState<BgiNode | null>(null)
  const [bgiCloudLeads, setBgiCloudLeads] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<DataMigrationSchedule | null>(null)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [completeRemark, setCompleteRemark] = useState('')
  const [completing, setCompleting] = useState(false)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopening, setReopening] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getBgiHierarchy(), getBgiCloudLeads()])
      .then(([root, leads]) => {
        if (!cancelled) {
          setBgiRoot(root)
          setBgiCloudLeads(leads)
        }
      })
      .catch(() => { toast.error('Failed to load BGI data') })
    return () => { cancelled = true }
  }, [])

  const {
    blocks,
    loading: blocksLoading,
    error: blocksError,
  } = useDataMigrationCycleBlocks({
    startDate: dm?.cyclePeriod?.startDate,
    endDate: dm?.cyclePeriod?.endDate,
    durationDays: dm?.cycleDurationDays,
    enabled: !settingsLoading && !!dm,
  })

  useEffect(() => {
    if (blocksError) toast.error('Failed to load migration cycle blocks')
  }, [blocksError])

  const capacity = dm?.cycleCapacity ?? 20
  const asrDrLicenseCapacity = dm?.asrDrLicenseCapacity ?? 2
  const minCycle = dm?.minCycle ?? 1
  const maxCycle = dm?.maxCycle ?? 3
  const minDts = dm?.minDtsInstanceCount ?? 1
  const maxDts = dm?.maxDtsInstanceCount ?? 5

  const dtsOptions = useMemo(() => {
    return Array.from({ length: Math.max(0, maxDts - minDts + 1) }, (_, i) => minDts + i)
  }, [minDts, maxDts])

  const userProjects = useMemo(() => {
    if (isPlatformLead) return liveProjects
    if (!user?.bgi_ids || user.bgi_ids.length === 0 || !bgiRoot) return liveProjects
    const userBgiIds = new Set(user.bgi_ids)
    return liveProjects.filter(p => {
      if (!p.bgi_id) return false
      if (userBgiIds.has(p.bgi_id)) return true
      return Array.from(userBgiIds).some(id => isDescendantOf(bgiRoot, id, p.bgi_id!))
    })
  }, [liveProjects, isPlatformLead, user, bgiRoot])

  const filteredProjects = useMemo(() => {
    if (!selectedBlock) return []
    return userProjects
      .filter(p => {
        const plan = p.dataMigrationPlan ?? p.dataMigrationSchedule
        if (!plan) return false
        const planBlocks =
          plan.cycleBlocks && plan.cycleBlocks.length > 0
            ? plan.cycleBlocks
            : plan.startDate && plan.endDate
              ? [{ startDate: plan.startDate, endDate: plan.endDate }]
              : []
        return planBlocks.some(
          b => b.startDate === selectedBlock.startDate && b.endDate === selectedBlock.endDate
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [userProjects, selectedBlock])

  const blockBookedCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const block of blocks) {
      counts.set(`${block.startDate}|${block.endDate}`, 0)
    }
    for (const project of userProjects) {
      const plan = project.dataMigrationPlan ?? project.dataMigrationSchedule
      if (!plan) continue
      const planBlocks =
        plan.cycleBlocks && plan.cycleBlocks.length > 0
          ? plan.cycleBlocks
          : plan.startDate && plan.endDate
            ? [{ startDate: plan.startDate, endDate: plan.endDate }]
            : []
      for (const cycleBlock of planBlocks) {
        const key = `${cycleBlock.startDate}|${cycleBlock.endDate}`
        if (counts.has(key)) {
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    }
    return counts
  }, [userProjects, blocks])

  const blockAsrDrCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const block of blocks) {
      counts.set(`${block.startDate}|${block.endDate}`, 0)
    }
    for (const project of userProjects) {
      const plan = project.dataMigrationPlan ?? project.dataMigrationSchedule
      if (!plan || !plan.needAsrDr) continue
      const planBlocks =
        plan.cycleBlocks && plan.cycleBlocks.length > 0
          ? plan.cycleBlocks
          : plan.startDate && plan.endDate
            ? [{ startDate: plan.startDate, endDate: plan.endDate }]
            : []
      for (const cycleBlock of planBlocks) {
        const key = `${cycleBlock.startDate}|${cycleBlock.endDate}`
        if (counts.has(key)) {
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
    }
    return counts
  }, [userProjects, blocks])

  const visibleBlocks = useMemo(() => {
    if (isPlatformLead) return blocks
    return blocks.filter(block => {
      const blockKey = `${block.startDate}|${block.endDate}`
      return userProjects.some(project => {
        const plan = project.dataMigrationPlan ?? project.dataMigrationSchedule
        if (!plan) return false
        const planBlocks =
          plan.cycleBlocks && plan.cycleBlocks.length > 0
            ? plan.cycleBlocks
            : plan.startDate && plan.endDate
              ? [{ startDate: plan.startDate, endDate: plan.endDate }]
              : []
        return planBlocks.some(b => `${b.startDate}|${b.endDate}` === blockKey)
      })
    })
  }, [blocks, userProjects, isPlatformLead])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedBlock) return
    if (!visibleBlocks.some(b => b.startDate === selectedBlock.startDate && b.endDate === selectedBlock.endDate)) {
      setSelectedBlock(null)
    }
  }, [selectedBlock, visibleBlocks])
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedProject = useMemo(() =>
    liveProjects.find(p => p.id === selectedProjectId) ?? null,
    [liveProjects, selectedProjectId]
  )

  const isProjectMember = useMemo(() =>
    selectedProject ? selectedProject.team.some(m => m.id === user?.id) : false,
    [selectedProject, user]
  )

  const savedBlocksForSelectedProject = useMemo(() => {
    if (!selectedProject) return []
    const savedPlan = selectedProject.dataMigrationPlan ?? selectedProject.dataMigrationSchedule
    return savedPlan?.cycleBlocks && savedPlan.cycleBlocks.length > 0
      ? savedPlan.cycleBlocks
      : savedPlan?.startDate && savedPlan?.endDate
        ? [{ startDate: savedPlan.startDate, endDate: savedPlan.endDate }]
        : []
  }, [selectedProject])

  const survey = selectedProject?.dataMigrationSchedule

  const [form, setForm] = useState<DataMigrationSchedule>({})
  const [hasPendingChanges, setHasPendingChanges] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedProject) {
      setForm({})
      setAllowMultipleCycleBlocks(false)
      setHasPendingChanges(false)
      return
    }
    const plan = selectedProject.dataMigrationPlan ?? defaultPlanFromSurvey(selectedProject.dataMigrationSchedule)
    setForm(plan)
    setAllowMultipleCycleBlocks((plan.cycleBlocks?.length ?? 0) > 1)
    setHasPendingChanges(false)
  }, [selectedProject])
  /* eslint-enable react-hooks/set-state-in-effect */

  const requiresCycleApproval = survey?.cycleCountOption === 'more'

  const showDtsJustification = form.dtsInstanceCount !== undefined && form.dtsInstanceCount > minDts

  const selectedBlocksInForm = useMemo(() => {
    if (allowMultipleCycleBlocks) {
      return form.cycleBlocks && form.cycleBlocks.length > 0 ? form.cycleBlocks : []
    }
    if (form.startDate && form.endDate) return [{ startDate: form.startDate, endDate: form.endDate }]
    return []
  }, [form, allowMultipleCycleBlocks])

  const isAsrDrFullyBooked = useMemo(() => {
    return selectedBlocksInForm.some(b => {
      const block = blocks.find(bl => bl.startDate === b.startDate && bl.endDate === b.endDate)
      if (!block) return false
      const effectiveAsrDrCount = blockAsrDrCounts.get(`${block.startDate}|${block.endDate}`) ?? block.asrDrBookedCount
      return effectiveAsrDrCount >= asrDrLicenseCapacity
    })
  }, [selectedBlocksInForm, blocks, blockAsrDrCounts, asrDrLicenseCapacity])

  const isAsrDrOverload = useMemo(() => {
    if (!selectedProject) return false
    const savedPlan = selectedProject.dataMigrationPlan ?? selectedProject.dataMigrationSchedule
    const savedBlocks =
      savedPlan?.cycleBlocks && savedPlan.cycleBlocks.length > 0
        ? savedPlan.cycleBlocks
        : savedPlan?.startDate && savedPlan?.endDate
          ? [{ startDate: savedPlan.startDate, endDate: savedPlan.endDate }]
          : []

    return selectedBlocksInForm.some(b => {
      const block = blocks.find(bl => bl.startDate === b.startDate && bl.endDate === b.endDate)
      if (!block) return false
      const blockKey = `${block.startDate}|${block.endDate}`
      const isBlockChanged = !savedBlocks.some(sb => sb.startDate === block.startDate && sb.endDate === block.endDate)
      if (!isBlockChanged) return false
      const baseCount = blockAsrDrCounts.get(blockKey) ?? block.asrDrBookedCount
      const willCountInTarget = form.needAsrDr ?? false
      return baseCount + (willCountInTarget ? 1 : 0) > asrDrLicenseCapacity
    })
  }, [selectedBlocksInForm, selectedProject, blocks, form.needAsrDr, blockAsrDrCounts, asrDrLicenseCapacity])

  const dbResources = useMemo(() => {
    const resources = selectedProject?.currentInfrastructure?.resources ?? []
    const dbProducts = new Set([
      'polardb', 'rds', 'r-kvstore', 'dds', 'mongodb', 'redis', 'mysql', 'postgres', 'postgresql', 'sqlserver', 'oracle',
    ])
    return resources.filter(r => r.product && dbProducts.has(r.product.toLowerCase()) && r.needMigration !== false)
  }, [selectedProject])
  const dbResourceCount = dbResources.length

  const updateForm = useCallback((patch: Partial<DataMigrationSchedule>) => {
    setForm(prev => ({ ...prev, ...patch }))
    setHasPendingChanges(true)
  }, [])

  const selectBlock = useCallback((block: DataMigrationCycleBlock) => {
    setForm(prev => ({ ...prev, startDate: block.startDate, endDate: block.endDate, cycleBlocks: [] }))
    setHasPendingChanges(true)
  }, [])

  const updateCycleBlocks = useCallback((next: { startDate: string; endDate: string }[]) => {
    const first = next[0]
    setForm(prev => ({
      ...prev,
      cycleBlocks: next,
      startDate: first?.startDate,
      endDate: first?.endDate,
    }))
    setHasPendingChanges(true)
  }, [])

  const handleAllowMultipleCycleBlocks = useCallback((checked: boolean) => {
    setAllowMultipleCycleBlocks(checked)
    setHasPendingChanges(true)
    setForm(prev => {
      if (checked) {
        if ((prev.cycleBlocks?.length ?? 0) === 0 && prev.startDate && prev.endDate) {
          return { ...prev, cycleBlocks: [{ startDate: prev.startDate, endDate: prev.endDate }] }
        }
        return prev
      }
      if (prev.cycleBlocks && prev.cycleBlocks.length > 0) {
        const first = prev.cycleBlocks[0]
        return { ...prev, startDate: first.startDate, endDate: first.endDate, cycleBlocks: [] }
      }
      return prev
    })
  }, [])

  const selectCycleOption = useCallback((option: 'min' | 'more') => {
    setForm(prev => ({
      ...prev,
      cycleCountOption: option,
      cycleCount: option === 'min' ? minCycle : maxCycle,
    }))
    setHasPendingChanges(true)
  }, [minCycle, maxCycle])

  const toggleAsrDr = useCallback((checked: boolean | 'indeterminate') => {
    setForm(prev => ({
      ...prev,
      needAsrDr: checked === true,
      asrDrJustification: checked === true ? prev.asrDrJustification : undefined,
    }))
    setHasPendingChanges(true)
  }, [])

  const executeSave = useCallback(async (payload: DataMigrationSchedule) => {
    if (!selectedProject) return
    const previous = selectedProject.dataMigrationPlan
    setProjectOverrides(prev => ({ ...prev, [selectedProject.id]: { dataMigrationPlan: payload } }))
    setSaving(true)
    try {
      const updated = await updateProject(selectedProject.id, 'dataMigrationPlan', payload)
      setProjectOverrides(prev => ({ ...prev, [selectedProject.id]: { dataMigrationPlan: updated.dataMigrationPlan } }))
      setHasPendingChanges(false)
      toast.success('Data migration plan saved')
    } catch {
      setProjectOverrides(prev => ({ ...prev, [selectedProject.id]: { dataMigrationPlan: previous } }))
      toast.error('Failed to save data migration plan')
    } finally {
      setSaving(false)
    }
  }, [selectedProject])

  const isPlanCompleted = useMemo(() => !!selectedProject?.dataMigrationPlan?.completedAt, [selectedProject])

  const handleSave = useCallback(async () => {
    if (!selectedProject || !isPlatformLead || isPlanCompleted) return
    const payload: DataMigrationSchedule = {
      startDate: form.startDate,
      endDate: form.endDate,
      cycleBlocks: form.cycleBlocks,
      cycleCount: form.cycleCount,
      cycleCountOption: form.cycleCountOption,
      ...(form.cycleJustification?.trim() && { cycleJustification: form.cycleJustification.trim() }),
      dtsInstanceCount: form.dtsInstanceCount,
      ...(showDtsJustification && form.dtsJustification?.trim() && { dtsJustification: form.dtsJustification.trim() }),
      needAsrDr: form.needAsrDr,
      ...(form.asrDrJustification?.trim() && { asrDrJustification: form.asrDrJustification.trim() }),
      ...(requiresCycleApproval && {
        bgiCloudLeadId: form.bgiCloudLeadId,
        approvalAcknowledged: form.approvalAcknowledged,
        forwardAcknowledged: form.forwardAcknowledged,
        confirmAcknowledged: form.confirmAcknowledged,
      }),
      acceptsTimeAdjustment: form.acceptsTimeAdjustment,
    }

    if (selectedBlocksInForm.length > 0 && isAsrDrOverload) {
      setPendingPayload(payload)
      setConfirmDialogOpen(true)
      return
    }

    await executeSave(payload)
  }, [selectedProject, form, isPlatformLead, isPlanCompleted, requiresCycleApproval, showDtsJustification, selectedBlocksInForm, isAsrDrOverload, executeSave])

  const handleConfirmSaveWithAsrDrUnchecked = useCallback(async () => {
    if (!pendingPayload) return
    await executeSave({ ...pendingPayload, needAsrDr: false })
    setPendingPayload(null)
    setConfirmDialogOpen(false)
  }, [pendingPayload, executeSave])

  const handleReset = useCallback(() => {
    if (!selectedProject) return
    const plan = selectedProject.dataMigrationPlan ?? defaultPlanFromSurvey(selectedProject.dataMigrationSchedule)
    setForm(plan)
    setAllowMultipleCycleBlocks((plan.cycleBlocks?.length ?? 0) > 1)
    setHasPendingChanges(false)
  }, [selectedProject])

  const handleMarkComplete = useCallback(async () => {
    if (!selectedProject) return
    setCompleting(true)
    try {
      const updated = await markDataMigrationComplete(selectedProject.id, { remark: completeRemark.trim() || undefined })
      setProjectOverrides(prev => ({ ...prev, [selectedProject.id]: { dataMigrationPlan: updated.dataMigrationPlan } }))
      setCompleteDialogOpen(false)
      setCompleteRemark('')
      toast.success('Data migration marked as complete')
    } catch {
      toast.error('Failed to mark data migration as complete')
    } finally {
      setCompleting(false)
    }
  }, [selectedProject, completeRemark])

  const handleReopen = useCallback(async () => {
    if (!selectedProject) return
    const reason = reopenReason.trim()
    if (!reason) {
      toast.error('Reopen reason is required')
      return
    }
    setReopening(true)
    try {
      const updated = await reopenDataMigration(selectedProject.id, { reason })
      setProjectOverrides(prev => ({ ...prev, [selectedProject.id]: { dataMigrationPlan: updated.dataMigrationPlan } }))
      setReopenDialogOpen(false)
      setReopenReason('')
      toast.success('Data migration plan reopened')
    } catch {
      toast.error('Failed to reopen data migration plan')
    } finally {
      setReopening(false)
    }
  }, [selectedProject, reopenReason])

  const isLoading = settingsLoading || projectsLoading || blocksLoading

  const readOnly = !isPlatformLead || isPlanCompleted

  const changed = (key: keyof DataMigrationSchedule) => isDifferent(form[key], survey?.[key])

  const bgiLeadName = useMemo(() => {
    if (!form.bgiCloudLeadId) return undefined
    const lead = bgiCloudLeads.find(l => l.id === form.bgiCloudLeadId)
    return lead ? `${lead.name} (${lead.email})` : form.bgiCloudLeadId
  }, [form.bgiCloudLeadId, bgiCloudLeads])

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Database size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg leading-none">Data Migration</h2>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">
              Maintain the data migration plan based on submitted survey results.
            </p>
          </div>
        </div>

        {isPlatformLead ? (
          <button
            onClick={() => navigate('/waves')}
            className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back to Waves</span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <LayoutDashboard size={18} />
            <span className="text-sm">Back to Dashboard</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-0">
            {/* Left column: cycle blocks */}
            <div className="lg:col-span-3 flex flex-col gap-3 min-h-0 p-4 lg:border-r lg:border-border">
              <div className="flex items-center justify-between shrink-0">
                <Label className="text-sm font-semibold">Migration Cycle Block</Label>
                {dm?.cyclePeriod?.startDate && dm?.cyclePeriod?.endDate && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(dm.cyclePeriod.startDate), 'MMM d')} – {format(new Date(dm.cyclePeriod.endDate), 'MMM d')}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-0">
                <div className="flex flex-col gap-2 pb-2">
                  {visibleBlocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {blocks.length === 0
                        ? 'No cycle blocks available. Configure the cycle period in Migration Settings.'
                        : 'No cycle blocks match your projects.'}
                    </p>
                  ) : (
                    visibleBlocks.map(block => {
                      const isSelected = selectedBlock?.startDate === block.startDate && selectedBlock?.endDate === block.endDate
                      const effectiveBookedCount = blockBookedCounts.get(`${block.startDate}|${block.endDate}`) ?? block.bookedCount
                      const effectiveAsrDrBookedCount = blockAsrDrCounts.get(`${block.startDate}|${block.endDate}`) ?? block.asrDrBookedCount
                      const isFull = effectiveBookedCount >= capacity
                      const isAsrDrFull = effectiveAsrDrBookedCount >= asrDrLicenseCapacity
                      return (
                        <button
                          key={`${block.startDate}-${block.endDate}`}
                          type="button"
                          onClick={() => setSelectedBlock(block)}
                          className={cn(
                            'relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarRange size={14} />
                            <span className="text-sm font-medium">
                              {formatBlockRange(block)}
                            </span>
                            {isSelected && <Check size={14} className="ml-auto" />}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <Users size={10} />
                            <span>{effectiveBookedCount} / {capacity} booked</span>
                            {isFull && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">Full</Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              <Shield size={8} className="mr-1" />
                              ASR-DR {effectiveAsrDrBookedCount} / {asrDrLicenseCapacity}
                            </Badge>
                            {isAsrDrFull && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">ASR-DR Full</Badge>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Middle column: project list */}
            <div className="lg:col-span-3 flex flex-col gap-3 min-h-0 p-4 lg:border-r lg:border-border">
              <Label className="text-sm font-semibold">
                Projects {selectedBlock ? `(${filteredProjects.length})` : ''}
              </Label>
              <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-0">
                <div className="flex flex-col gap-2 pb-2">
                  {!selectedBlock ? (
                    <p className="text-sm text-muted-foreground">Select a cycle block to see assigned projects.</p>
                  ) : filteredProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No projects assigned to this block.</p>
                  ) : (
                    filteredProjects.map(project => {
                      const isSelected = selectedProjectId === project.id
                      const plan = project.dataMigrationPlan ?? project.dataMigrationSchedule
                      const hasPlan = !!project.dataMigrationPlan
                      const isCompleted = !!project.dataMigrationPlan?.completedAt
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => setSelectedProjectId(project.id)}
                          className={cn(
                            'flex flex-col gap-1 rounded-lg border p-3 text-left transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50',
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{project.name}</span>
                            {isCompleted && (
                              <CheckCircle size={14} className="shrink-0 text-green-600" />
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">{project.id}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {hasPlan && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">Adjusted</Badge>
                            )}
                            {plan?.cycleCountOption === 'more' && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">{'>'} {minCycle} cycle</Badge>
                            )}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right column: form */}
            <div className="lg:col-span-6 flex flex-col min-h-0 p-4">
              {!selectedProject ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Select a project to view or edit its data migration plan.
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto px-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{selectedProject.name}</h3>
                      <p className="text-xs text-muted-foreground">{selectedProject.id}</p>
                      {isPlanCompleted && (
                        <p className="text-xs text-amber-600 mt-1">
                          Migration plan is completed and locked.
                        </p>
                      )}
                      {selectedProject.dataMigrationPlan?.completedAt && (
                        <p className="text-xs text-green-600 mt-1">
                          Completed on {format(new Date(selectedProject.dataMigrationPlan.completedAt), 'MMM d, y HH:mm')}
                          {selectedProject.dataMigrationPlan.completionRemark && ` • ${selectedProject.dataMigrationPlan.completionRemark}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isPlanCompleted ? (
                        isPlatformLead && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReopenDialogOpen(true)}
                            disabled={reopening}
                          >
                            <RotateCcw size={14} className="mr-1.5" />
                            Reopen
                          </Button>
                        )
                      ) : (
                        <>
                          {isPlatformLead && (
                            <>
                              <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasPendingChanges}>
                                <RotateCcw size={14} className="mr-1.5" />
                                Reset
                              </Button>
                              <Button size="sm" onClick={handleSave} disabled={saving || !hasPendingChanges}>
                                <Save size={14} className="mr-1.5" />
                                {saving ? 'Saving…' : 'Save'}
                              </Button>
                            </>
                          )}
                          {(isPlatformLead || isProjectMember) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCompleteDialogOpen(true)}
                              disabled={completing}
                            >
                              <CheckCircle size={14} className="mr-1.5" />
                              Mark complete
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Cycle Block */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Migration Cycle Block</Label>
                      <div className="flex items-center gap-2">
                        {!allowMultipleCycleBlocks && changed('startDate') && changed('endDate') && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                        )}
                        {allowMultipleCycleBlocks && changed('cycleBlocks') && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id="allow-multiple-cycle-blocks"
                            checked={allowMultipleCycleBlocks}
                            onCheckedChange={(checked) => handleAllowMultipleCycleBlocks(checked === true)}
                            disabled={readOnly}
                          />
                          <Label htmlFor="allow-multiple-cycle-blocks" className="text-xs font-normal cursor-pointer">
                            Multiple blocks
                          </Label>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Survey: {survey?.startDate && survey?.endDate ? formatBlockRange({ startDate: survey.startDate, endDate: survey.endDate, bookedCount: 0, asrDrBookedCount: 0 }) : 'Not submitted'}
                    </p>
                    {allowMultipleCycleBlocks ? (
                      <CycleBlockMultiSelect
                        blocks={blocks}
                        selected={form.cycleBlocks ?? []}
                        onChange={updateCycleBlocks}
                        disabled={readOnly}
                        capacity={capacity}
                        blockBookedCounts={blockBookedCounts}
                        savedBlocks={savedBlocksForSelectedProject}
                      />
                    ) : (
                      <Select
                        value={form.startDate && form.endDate ? `${form.startDate}|${form.endDate}` : ''}
                        onValueChange={(v) => {
                          const [start, end] = v.split('|')
                          const block = blocks.find(b => b.startDate === start && b.endDate === end)
                          if (block) selectBlock(block)
                        }}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select a cycle block" />
                        </SelectTrigger>
                        <SelectContent>
                          {blocks.map(block => {
                            const effectiveBookedCount = blockBookedCounts.get(`${block.startDate}|${block.endDate}`) ?? block.bookedCount
                            const blockValue = `${block.startDate}|${block.endDate}`
                            const isSelected = blockValue === (form.startDate && form.endDate ? `${form.startDate}|${form.endDate}` : '')
                            const isInSavedBlocks = savedBlocksForSelectedProject.some(b => `${b.startDate}|${b.endDate}` === blockValue)
                            const isFull = effectiveBookedCount >= capacity
                            const isDisabled = isFull && !isInSavedBlocks && !isSelected
                            return (
                              <CycleBlockSelectItem
                                key={`${block.startDate}-${block.endDate}`}
                                value={blockValue}
                                isSelected={isSelected}
                                disabled={isDisabled}
                              >
                                {formatBlockRange(block)} ({effectiveBookedCount} / {capacity} booked)
                              </CycleBlockSelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Cycle Count */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Cycle Count</Label>
                      {changed('cycleCount') && (
                        <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Survey: {survey?.cycleCountOption === 'more' ? `> ${minCycle}` : (survey?.cycleCount ?? minCycle)}
                    </p>
                    <Select
                      value={form.cycleCountOption ?? 'min'}
                      onValueChange={(v) => selectCycleOption(v as 'min' | 'more')}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="min">{minCycle}</SelectItem>
                        <SelectItem value="more">{'>'} {minCycle}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Acknowledgement block (read-only from survey when survey > 1) */}
                  {requiresCycleApproval && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Acknowledgements (read-only — survey selected {'>'} {minCycle} cycle{minCycle !== 1 ? 's' : ''})
                        </p>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <Checkbox id="approval-ack" checked={survey?.approvalAcknowledged ?? false} disabled />
                          <Label htmlFor="approval-ack" className="text-xs font-normal leading-relaxed">
                            Approval email obtained from BGI Cloud Lead
                          </Label>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          BGI Cloud Lead: {bgiLeadName ?? survey?.bgiCloudLeadId ?? '—'}
                        </div>

                        <div className="flex items-start gap-2">
                          <Checkbox id="forward-ack" checked={survey?.forwardAcknowledged ?? false} disabled />
                          <Label htmlFor="forward-ack" className="text-xs font-normal leading-relaxed">
                            Approval email forwarded to migration support
                          </Label>
                        </div>

                        <div className="flex items-start gap-2">
                          <Checkbox id="confirm-ack" checked={survey?.confirmAcknowledged ?? false} disabled />
                          <Label htmlFor="confirm-ack" className="text-xs font-normal leading-relaxed">
                            Confirmation obtained from migration support team
                          </Label>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Additional notes</Label>
                          <textarea
                            value={survey?.cycleJustification ?? ''}
                            disabled
                            rows={3}
                            className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DTS Instance Count */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>DTS Instance Count</Label>
                      {changed('dtsInstanceCount') && (
                        <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Survey: {survey?.dtsInstanceCount ?? minDts} ({dbResourceCount} DB resource{dbResourceCount !== 1 ? 's' : ''})
                    </p>
                    <Select
                      value={String(form.dtsInstanceCount ?? minDts)}
                      onValueChange={(v) => updateForm({ dtsInstanceCount: parseInt(v, 10) })}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dtsOptions.map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* DTS Justification */}
                  {showDtsJustification && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>DTS Instance Justification</Label>
                        {changed('dtsJustification') && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Survey: {survey?.dtsJustification || '—'}
                      </p>
                      <textarea
                        value={form.dtsJustification ?? ''}
                        onChange={(e) => updateForm({ dtsJustification: e.target.value })}
                        disabled={readOnly}
                        rows={3}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        placeholder="Why is more than the default DTS instance count needed?"
                      />
                    </div>
                  )}

                  {/* ASR-DR */}
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="need-asr-dr"
                        checked={form.needAsrDr ?? false}
                        onCheckedChange={(checked) => toggleAsrDr(checked)}
                        disabled={readOnly || isAsrDrFullyBooked}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="need-asr-dr" className="font-medium">Need ASR-DR</Label>
                          {changed('needAsrDr') && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Survey: {survey?.needAsrDr ? 'Yes' : 'No'}
                          {selectedBlocksInForm.length > 0 && (
                            ` (${selectedBlocksInForm.map(b => {
                              const block = blocks.find(bl => bl.startDate === b.startDate && bl.endDate === b.endDate)
                              if (!block) return null
                              const count = blockAsrDrCounts.get(`${block.startDate}|${block.endDate}`) ?? block.asrDrBookedCount
                              return `${formatBlockRange(block)}: ${count}/${asrDrLicenseCapacity}`
                            }).filter(Boolean).join(', ')})`
                          )}
                        </p>
                      </div>
                    </div>

                    {isAsrDrFullyBooked && !form.needAsrDr && (
                      <p className="text-xs text-destructive">
                        ASR-DR is fully booked in this cycle block.
                      </p>
                    )}

                    {(form.needAsrDr || isAsrDrFullyBooked) && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="asr-dr-justification" className="text-xs">ASR-DR Justification</Label>
                          {changed('asrDrJustification') && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Survey: {survey?.asrDrJustification || '—'}</p>
                        <textarea
                          id="asr-dr-justification"
                          value={form.asrDrJustification ?? ''}
                          onChange={(e) => updateForm({ asrDrJustification: e.target.value })}
                          disabled={readOnly}
                          rows={3}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          placeholder="Why is ASR-DR required?"
                        />
                      </div>
                    )}
                  </div>

                  {/* Accept Time Adjustment */}
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                    <Checkbox
                      id="time-adjustment"
                      checked={form.acceptsTimeAdjustment ?? false}
                      onCheckedChange={(checked) => updateForm({ acceptsTimeAdjustment: checked === true })}
                      disabled={readOnly}
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="time-adjustment" className="font-medium">Accept time adjustments</Label>
                        {changed('acceptsTimeAdjustment') && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Changed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Survey: {survey?.acceptsTimeAdjustment ? 'Yes' : 'No'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        If accepted, the migration period may be extended and additional DTS licenses may be obtained.
                      </p>
                    </div>
                  </div>

                  {!isPlatformLead && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
                      <Shield size={14} className="text-muted-foreground mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        You are viewing the data migration plan in read-only mode. Contact the platform migration lead to request changes.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ASR-DR Capacity Exceeded</DialogTitle>
            <DialogDescription>
              The target cycle block has reached its ASR-DR capacity. Continuing will uncheck "Need ASR-DR" for this project and save the plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSaveWithAsrDrUnchecked} disabled={saving}>
              {saving ? 'Saving…' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark data migration as complete</DialogTitle>
            <DialogDescription>
              Record that this project&apos;s data migration has been completed. This action will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="completion-remark" className="text-xs">Remark (optional)</Label>
            <textarea
              id="completion-remark"
              value={completeRemark}
              onChange={(e) => setCompleteRemark(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="Add an optional remark about the completion..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)} disabled={completing}>
              Cancel
            </Button>
            <Button onClick={handleMarkComplete} disabled={completing}>
              {completing ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen data migration plan</DialogTitle>
            <DialogDescription>
              Reopening will unlock the data migration plan so it can be edited again. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reopen-reason" className="text-xs">Reason for reopening *</Label>
            <textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="Explain why the migration plan needs to be reopened..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)} disabled={reopening}>
              Cancel
            </Button>
            <Button onClick={handleReopen} disabled={reopening || !reopenReason.trim()}>
              {reopening ? 'Reopening…' : 'Confirm reopen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
