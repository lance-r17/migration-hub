import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronDown, Loader2, CheckCircle, AlertOctagon, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import { createOperationJob, getOperationJobs } from '@/services/jiraJobs'
import type { OperationJobOut } from '@/services/jiraJobs'
import type { CloudResource } from '@/types'

interface OperationsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  resources: CloudResource[]
  jiraBaseUrl?: string
}

interface SubtaskOption {
  key: string
  resourceNames: string[]
  products: string[]
  categories: string[]
}

function JobStatusIcon({ status }: { status: OperationJobOut['status'] }) {
  if (status === 'completed') return <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
  if (status === 'failed') return <AlertOctagon size={14} className="text-destructive shrink-0" />
  return <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />
}

function QuickSelectPopover({ products, categories, onApply, getNameForProduct }: {
  products: string[]
  categories: string[]
  onApply: (selectedProducts: string[], selectedCategories: string[]) => void
  getNameForProduct: (product?: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'product' | 'category'>('product')
  const [checkedProducts, setCheckedProducts] = useState<Set<string>>(new Set())
  const [checkedCategories, setCheckedCategories] = useState<Set<string>>(new Set())

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setCheckedProducts(new Set())
      setCheckedCategories(new Set())
      setActiveTab('product')
    }
    setOpen(next)
  }

  const toggleProduct = (val: string) => setCheckedProducts(prev => {
    const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next
  })

  const toggleCategory = (val: string) => setCheckedCategories(prev => {
    const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next
  })

  const totalChecked = checkedProducts.size + checkedCategories.size

  const handleApply = () => {
    onApply(Array.from(checkedProducts), Array.from(checkedCategories))
    setOpen(false)
    setCheckedProducts(new Set())
    setCheckedCategories(new Set())
    setActiveTab('product')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          Quick Select <ChevronDown size={11} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 flex flex-col max-h-80 overflow-hidden" align="end">
        {/* Tab bar */}
        <div className="flex border-b flex-shrink-0">
          {(['product', 'category'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'product' ? 'Product' : 'Category'}
            </button>
          ))}
        </div>
        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {activeTab === 'product'
            ? products.map(p => (
                <label key={p} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm">
                  <Checkbox checked={checkedProducts.has(p)} onCheckedChange={() => toggleProduct(p)} />
                  {getNameForProduct(p)}
                </label>
              ))
            : categories.map(c => (
                <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted text-sm">
                  <Checkbox checked={checkedCategories.has(c)} onCheckedChange={() => toggleCategory(c)} />
                  {c}
                </label>
              ))
          }
        </div>
        {/* Footer */}
        <div className="border-t p-2 flex-shrink-0">
          <Button size="sm" className="w-full h-7 text-xs" disabled={totalChecked === 0} onClick={handleApply}>
            Apply {totalChecked > 0 && `(${totalChecked})`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function OperationsDrawer({ open, onOpenChange, projectId, resources, jiraBaseUrl }: OperationsDrawerProps) {
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [jobs, setJobs] = useState<OperationJobOut[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState('Change Request')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { getCategoryForProduct, getNameForProduct } = useProductCategoryMap()

  // Build enriched subtask options: key → resource names, products, categories
  const subtaskOptions = useMemo<SubtaskOption[]>(() => {
    const groups: Record<string, { resourceNames: string[]; products: Set<string>; categories: Set<string> }> = {}
    for (const r of resources) {
      if (r.jiraSubtaskKey && r.needMigration !== false) {
        const key = r.jiraSubtaskKey
        if (!groups[key]) groups[key] = { resourceNames: [], products: new Set(), categories: new Set() }
        groups[key].resourceNames.push(r.name)
        if (r.product) groups[key].products.add(r.product)
        groups[key].categories.add(getCategoryForProduct(r.product))
      }
    }
    return Object.entries(groups).map(([key, data]) => ({
      key,
      resourceNames: data.resourceNames,
      products: Array.from(data.products),
      categories: Array.from(data.categories),
    }))
  }, [resources, getCategoryForProduct])

  const allProducts = useMemo(
    () => Array.from(new Set(subtaskOptions.flatMap(o => o.products))).sort(),
    [subtaskOptions],
  )
  const allCategories = useMemo(
    () => Array.from(new Set(subtaskOptions.flatMap(o => o.categories))).sort(),
    [subtaskOptions],
  )

  const fetchJobs = useCallback(async () => {
    try {
      const result = await getOperationJobs(projectId)
      setJobs(result)
    } catch {
      // Silently ignore — not critical
    }
  }, [projectId])

  // Fetch on open; reset create form
  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchJobs().finally(() => setLoading(false))
      setMode('list')
      setSelectedKeys(new Set())
      setSummary('Change Request')
    }
  }, [open, fetchJobs])

  // Poll while any job is in-flight
  useEffect(() => {
    const hasInFlight = jobs.some(j => j.status === 'pending' || j.status === 'processing')
    if (!hasInFlight) return
    const interval = setInterval(fetchJobs, 3_000)
    return () => clearInterval(interval)
  }, [jobs, fetchJobs])

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const handleQuickSelect = (products: string[], categories: string[]) => {
    const pSet = new Set(products)
    const cSet = new Set(categories)
    const matching = subtaskOptions
      .filter(opt => opt.products.some(p => pSet.has(p)) || opt.categories.some(c => cSet.has(c)))
      .map(opt => opt.key)
    setSelectedKeys(prev => {
      const next = new Set(prev)
      matching.forEach(k => next.add(k))
      return next
    })
  }

  const handleCreate = async () => {
    if (selectedKeys.size === 0) return
    setIsSubmitting(true)
    try {
      const job = await createOperationJob(projectId, Array.from(selectedKeys), summary)
      setJobs(prev => [job, ...prev])
      setMode('list')
      setSelectedKeys(new Set())
      setSummary('Change Request')
      toast.success('Change request queued', {
        description: 'The subtask will appear once the job completes.',
      })
    } catch {
      toast.error('Failed to create change request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => onOpenChange(false)

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[600px] sm:!max-w-[600px] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4 flex-shrink-0">
          {mode === 'list' ? (
            <div className="flex items-start justify-between gap-4 pr-6">
              <div>
                <SheetTitle>Operations</SheetTitle>
                <SheetDescription>Change request subtasks for this project</SheetDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setMode('create')}
                className="shrink-0 flex items-center gap-1.5 mt-0.5"
              >
                <Plus size={14} />
                New Change Request
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 pr-6">
              <button
                onClick={() => setMode('list')}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <SheetTitle className="text-base">New Change Request</SheetTitle>
            </div>
          )}
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {mode === 'list' ? (
            <>
              {loading && jobs.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Loading…
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Clock size={28} className="mx-auto mb-2 opacity-40" />
                  No change request subtasks yet.
                  <br />
                  Click <strong>New Change Request</strong> to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div
                      key={job.id}
                      className="flex items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm"
                    >
                      <JobStatusIcon status={job.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {job.crSubtaskKey ? (
                            jiraBaseUrl ? (
                              <a
                                href={`${jiraBaseUrl}/browse/${job.crSubtaskKey}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:underline"
                              >
                                {job.crSubtaskKey}
                              </a>
                            ) : (
                              <code className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {job.crSubtaskKey}
                              </code>
                            )
                          ) : (
                            <span className="text-muted-foreground italic">
                              {job.status === 'failed' ? 'Failed' : 'Creating…'}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {job.config.summary}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatTime(job.requestedAt)}
                          {job.config.selected_subtask_keys.length > 0 && (
                            <> · links {job.config.selected_subtask_keys.length} subtask{job.config.selected_subtask_keys.length !== 1 ? 's' : ''}</>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="cr-summary">Summary</Label>
                <Input
                  id="cr-summary"
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="Change Request"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Link to resource subtasks</Label>
                  {subtaskOptions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Quick select:</span>
                      <QuickSelectPopover
                        products={allProducts}
                        categories={allCategories}
                        onApply={handleQuickSelect}
                        getNameForProduct={getNameForProduct}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select one or more resource subtasks. The new CR subtask will be linked to each with the configured link type.
                </p>
                {subtaskOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">
                    No resource subtasks found. Sign off the project to generate them first.
                  </p>
                ) : (
                  <div className="space-y-1.5 mt-2">
                    {subtaskOptions.map(opt => (
                      <label
                        key={opt.key}
                        className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <Checkbox
                          checked={selectedKeys.has(opt.key)}
                          onCheckedChange={() => toggleKey(opt.key)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {jiraBaseUrl ? (
                              <a
                                href={`${jiraBaseUrl}/browse/${opt.key}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                {opt.key}
                              </a>
                            ) : (
                              <code className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{opt.key}</code>
                            )}
                            {opt.products.map(p => (
                              <span key={p} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                {getNameForProduct(p)}
                              </span>
                            ))}
                            {opt.categories.map(c => (
                              <span key={c} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {c}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {opt.resourceNames.join(', ')}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — only in create mode */}
        {mode === 'create' && (
          <div className="border-t px-6 py-4 flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setMode('list')}>
              Cancel
            </Button>
            <Button
              disabled={selectedKeys.size === 0 || !summary.trim() || isSubmitting}
              onClick={handleCreate}
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
              Create
            </Button>
          </div>
        )}

        {/* Close button (top-right corner) */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      </SheetContent>
    </Sheet>
  )
}
