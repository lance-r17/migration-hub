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
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import { useDataMigrationCycleBlocks } from '@/hooks/use-data-migration-cycle-blocks'
import { markDataMigrationSurveySubmitted } from '@/services/projects'
import type { Project, DataMigrationSchedule } from '@/types'
import type { DataMigrationCycleBlock } from '@/services/projects'

interface DataMigrationSurveyModalProps {
  open: boolean
  onClose: () => void
  project: Project
  onSave: <K extends keyof Project>(key: K, value: Project[K]) => Promise<void>
  onSubmitted?: () => void | Promise<void>
}

interface FormState {
  startDate?: string
  endDate?: string
  cycleCount: number
  cycleJustification: string
  dtsInstanceCount: number
  dtsJustification: string
  needAsrDr: boolean
  asrDrJustification: string
}

export function DataMigrationSurveyModal({
  open,
  onClose,
  project,
  onSave,
  onSubmitted,
}: DataMigrationSurveyModalProps) {
  const { settings, loading } = useMigrationSettings()
  const dm = settings?.dataMigration

  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  const defaults = useMemo(() => {
    return {
      cycleCount: dm?.minCycle ?? 1,
      dtsInstanceCount: dm?.minDtsInstanceCount ?? 1,
    }
  }, [dm])

  const existing = project.dataMigrationSchedule

  const [form, setForm] = useState<FormState>({
    startDate: existing?.startDate,
    endDate: existing?.endDate,
    cycleCount: existing?.cycleCount ?? defaults.cycleCount,
    cycleJustification: existing?.cycleJustification ?? '',
    dtsInstanceCount: existing?.dtsInstanceCount ?? defaults.dtsInstanceCount,
    dtsJustification: existing?.dtsJustification ?? '',
    needAsrDr: existing?.needAsrDr ?? false,
    asrDrJustification: existing?.asrDrJustification ?? '',
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
    setForm({
      startDate: existing?.startDate,
      endDate: existing?.endDate,
      cycleCount: existing?.cycleCount ?? dm.minCycle,
      cycleJustification: existing?.cycleJustification ?? '',
      dtsInstanceCount: existing?.dtsInstanceCount ?? dm.minDtsInstanceCount,
      dtsJustification: existing?.dtsJustification ?? '',
      needAsrDr: existing?.needAsrDr ?? false,
      asrDrJustification: existing?.asrDrJustification ?? '',
    })
  }, [loading, dm, existing])

  useEffect(() => {
    if (blocksError) {
      toast.error('Failed to load migration cycle blocks')
    }
  }, [blocksError])

  const cycleOptions = useMemo(() => {
    const min = dm?.minCycle ?? 1
    const max = dm?.maxCycle ?? 3
    return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
  }, [dm])

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

  const showCycleJustification = form.cycleCount > (dm?.minCycle ?? 1)
  const showDtsJustification = form.dtsInstanceCount > (dm?.minDtsInstanceCount ?? 1)

  const isValidForm = useMemo(() => {
    if (!form.startDate || !form.endDate) return false
    if (dateError) return false
    if (showCycleJustification && !form.cycleJustification.trim()) return false
    if (showDtsJustification && !form.dtsJustification.trim()) return false
    return true
  }, [form, dateError, showCycleJustification, showDtsJustification])

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

  const handleSubmit = useCallback(async () => {
    if (!isValidForm) return
    setSubmitting(true)
    try {
      const payload: DataMigrationSchedule = {
        startDate: form.startDate,
        endDate: form.endDate,
        cycleCount: form.cycleCount,
        ...(showCycleJustification && { cycleJustification: form.cycleJustification.trim() }),
        dtsInstanceCount: form.dtsInstanceCount,
        ...(showDtsJustification && { dtsJustification: form.dtsJustification.trim() }),
        needAsrDr: form.needAsrDr,
        ...(form.asrDrJustification.trim() && { asrDrJustification: form.asrDrJustification.trim() }),
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
  }, [isValidForm, form, showCycleJustification, showDtsJustification, onSave, project.id, onSubmitted])

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
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">
                      Data Migration Schedule
                    </h2>
                    <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                      Help us plan your data migration by confirming the schedule, cycle count, and DTS capacity needed for {project.name}.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-6xl w-full mx-auto">
                  <div className="rounded-2xl bg-muted/50 border border-border/50 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Database size={16} />
                      </div>
                      <h3 className="text-sm font-semibold">Migration Week</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Selecting a week means the project is planned to complete the full set of migration activities within that week.
                    </p>
                    <div className="rounded-lg bg-background border border-border/50 p-3 space-y-1">
                      <h4 className="text-xs font-semibold">DTS — Database Migration</h4>
                      <p className="text-xs text-muted-foreground">Included by default for all projects.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-muted/50 border border-border/50 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Shield size={16} />
                      </div>
                      <h3 className="text-sm font-semibold">ASR-DR — Optional</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Only required for big data products.
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 pl-1">
                      <li>No quota assigned by default</li>
                      <li>Max 1 protection group per project</li>
                      <li>Only {asrDrLicenseCapacity} groups available in total</li>
                      <li>Comments can explain usage scenario</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-muted/50 border border-border/50 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Cloud size={16} />
                      </div>
                      <h3 className="text-sm font-semibold">AMC — Default Quota: 1</h3>
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 pl-1">
                      <li>Applies to OSS / SLS / ACR migration</li>
                      <li>Total available quota: {capacity}</li>
                      <li>No flexible quota option available</li>
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
                        value={String(form.cycleCount)}
                        onValueChange={(v) => updateForm({ cycleCount: parseInt(v, 10) })}
                        modal={false}
                      >
                        <SelectTrigger className="h-10 w-full justify-between">
                          <SelectValue placeholder="Select cycle count" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[400] w-[--radix-select-trigger-width]">
                          {cycleOptions.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Default: {dm?.minCycle ?? 1} cycle(s)</p>
                    </div>

                    {/* Cycle Justification */}
                    {showCycleJustification && (
                      <div className="space-y-1.5">
                        <Label>Cycle Count Justification *</Label>
                        <textarea
                          value={form.cycleJustification}
                          onChange={(e) => updateForm({ cycleJustification: e.target.value })}
                          placeholder="Why do you need more than the default cycle count?"
                          rows={3}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        />
                      </div>
                    )}

                    {/* DTS Instance Count */}
                    <div className="space-y-1.5">
                      <Label>DTS Instance Count *</Label>
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
                      <p className="text-xs text-muted-foreground">Default: {dm?.minDtsInstanceCount ?? 1} instance(s)</p>
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
