import { useState, useEffect, useMemo } from 'react'
import {
  Layers,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
  GripVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { useResourceSurveyConfig } from '@/hooks/use-survey'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import { useCurrentUser } from '@/context/UserContext'
import type { ResourceQuestionGroup, ResourceQuestionDef, ResourceQuestionLevel, ResourceSurveyConfig, ResourceSurveyInputType } from '@/types/survey'
import type { ResourceCategory } from '@/types'
import { cn } from '@/lib/utils'

const RESOURCE_INPUT_TYPES: { value: ResourceSurveyInputType; label: string }[] = [
  { value: 'select', label: 'Select (single)' },
  { value: 'short_text', label: 'Short text' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'string_array', label: 'List (tags)' },
  { value: 'checkbox_select', label: 'Checkboxes (multi)' },
  { value: 'date', label: 'Date' },
  { value: 'date_range', label: 'Date range' },
]

const RESOURCE_CATEGORIES = ['VM', 'Database', 'Buckets', 'Network', 'Other']

const textareaClass =
  'min-h-[60px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupScopeLabel(group: ResourceQuestionGroup): string {
  if (group.level === 'resource') {
    if (group.resourceId) return `Per-resource · ID: ${group.resourceId}`
    if (group.products?.length) return `Per-resource · Products: ${group.products.join(', ')}`
    if (group.product) return `Per-resource · Product: ${group.product}`
    if (group.category) return `Per-resource · Category: ${group.category}`
    return 'Per-resource · All resources'
  }
  if (group.level === 'product') {
    if (group.products?.length) return `Once · Products: ${group.products.join(', ')}`
    return `Once · Product: ${group.product ?? '—'}`
  }
  if (group.level === 'category') return `Once · Category: ${group.category ?? '—'}`
  return group.level
}

// ─── Group Header ─────────────────────────────────────────────────────────────

function GroupHeader({
  label,
  questionCount,
  isCollapsed,
  onToggleCollapse,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  label: string
  questionCount: number
  isCollapsed: boolean
  onToggleCollapse: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        type="button"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span className="truncate">{label}</span>
      </button>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
        {questionCount}
      </Badge>
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Move group up"
        >
          <ChevronUp size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Move group down"
        >
          <ChevronDown size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          title="Remove group"
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  )
}

// ─── Question Card (static content) ───────────────────────────────────────────

function ResourceQuestionCardContent({
  question,
  optionDraft,
  setOptionDraft,
  updateQuestion,
  removeQuestion,
  dragHandleProps,
  isOverlay,
}: {
  question: ResourceQuestionDef
  optionDraft: string
  setOptionDraft: (val: string) => void
  updateQuestion: (patch: Partial<ResourceQuestionDef>) => void
  removeQuestion: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isOverlay?: boolean
}) {
  return (
    <Card className={cn('bg-muted/30', isOverlay ? 'shadow-xl ring-2 ring-primary/30' : '')}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div
            className="flex flex-col items-center gap-1 pt-1 shrink-0 cursor-grab active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical size={14} className="text-muted-foreground/60" />
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  {question.inputType === 'date_range' ? 'Start date specs key' : 'Specs key'}
                </label>
                <Input
                  value={question.specsKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateQuestion({ specsKey: e.target.value })
                  }
                  placeholder="e.g. usage_pattern"
                  className="text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Input type</label>
                <Select
                  value={question.inputType}
                  onValueChange={(v) => updateQuestion({ inputType: v as ResourceSurveyInputType })}
                >
                  <SelectTrigger className="text-sm h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_INPUT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {question.inputType === 'date_range' && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">End date specs key</label>
                <Input
                  value={question.toSpecsKey ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateQuestion({ toSpecsKey: e.target.value })
                  }
                  placeholder="e.g. end_date"
                  className="text-sm h-8"
                />
                {(!question.toSpecsKey || question.toSpecsKey === question.specsKey) && (
                  <p className="text-xs text-destructive">
                    {question.toSpecsKey === question.specsKey
                      ? 'End date key must differ from start date key'
                      : 'End date specs key is required for date range'}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Question</label>
              <Input
                value={question.label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateQuestion({ label: e.target.value })
                }
                placeholder="Enter question text…"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hint / Sample Answer</label>
              <textarea
                value={question.hintText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  updateQuestion({ hintText: e.target.value })
                }
                placeholder="e.g. sample answer or guidance…"
                className={textareaClass}
                rows={2}
              />
            </div>

            {(question.inputType === 'select' || question.inputType === 'checkbox_select') && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Options</label>
                <div
                  className="flex flex-wrap gap-1.5 min-h-[38px] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 cursor-text"
                  onClick={(e) => {
                    const input = (e.currentTarget as HTMLElement).querySelector('input')
                    input?.focus()
                  }}
                >
                  {(question.options ?? []).map((opt) => (
                    <Badge key={opt} variant="secondary" className="gap-1 pr-1 text-xs">
                      {opt}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateQuestion({
                            options: (question.options ?? []).filter((o) => o !== opt),
                          })
                        }}
                        className="rounded-sm hover:bg-destructive/20 p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value.replace(',', ''))}
                    onKeyDown={(e) => {
                      const raw = optionDraft.trim()
                      if ((e.key === 'Enter' || e.key === ',') && raw) {
                        e.preventDefault()
                        if (!(question.options ?? []).includes(raw)) {
                          updateQuestion({ options: [...(question.options ?? []), raw] })
                        }
                        setOptionDraft('')
                      } else if (
                        e.key === 'Backspace' &&
                        !optionDraft &&
                        (question.options ?? []).length > 0
                      ) {
                        updateQuestion({
                          options: (question.options ?? []).slice(0, -1),
                        })
                      }
                    }}
                    onBlur={() => {
                      const raw = optionDraft.trim()
                      if (raw && !(question.options ?? []).includes(raw)) {
                        updateQuestion({ options: [...(question.options ?? []), raw] })
                      }
                      setOptionDraft('')
                    }}
                    placeholder={(question.options ?? []).length === 0 ? 'e.g. cache-only' : ''}
                    className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground py-0.5"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Required</span>
              <Switch
                id={`required-${question.id}`}
                checked={question.required}
                onCheckedChange={(v) => updateQuestion({ required: v })}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={removeQuestion}
            className="text-muted-foreground hover:text-destructive shrink-0 mt-1"
            title="Remove"
          >
            <X size={14} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Sortable Question Card ───────────────────────────────────────────────────

function SortableResourceQuestionCard({
  question,
  optionDraft,
  setOptionDraft,
  updateQuestion,
  removeQuestion,
}: {
  question: ResourceQuestionDef
  optionDraft: string
  setOptionDraft: (val: string) => void
  updateQuestion: (patch: Partial<ResourceQuestionDef>) => void
  removeQuestion: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-30' : ''}>
      <ResourceQuestionCardContent
        question={question}
        optionDraft={optionDraft}
        setOptionDraft={setOptionDraft}
        updateQuestion={updateQuestion}
        removeQuestion={removeQuestion}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function ResourceQuestionsTab() {
  const { user } = useCurrentUser()
  const { resourceSurveyConfig, loading, saving, save } = useResourceSurveyConfig()
  const { map: productCategoryMap, getNameForProduct } = useProductCategoryMap()
  const knownProducts = Object.keys(productCategoryMap)

  const [groups, setGroups] = useState<ResourceQuestionGroup[]>([])
  const [optionDrafts, setOptionDrafts] = useState<Map<string, string>>(new Map())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  // New group form state
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newLevel, setNewLevel] = useState<ResourceQuestionLevel>('resource')
  const [newProducts, setNewProducts] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [newResourceId, setNewResourceId] = useState('')

  useEffect(() => {
    if (resourceSurveyConfig) setGroups(resourceSurveyConfig.groups)
  }, [resourceSurveyConfig])

  const getOptionDraft = (qid: string) => optionDrafts.get(qid) ?? ''
  const setOptionDraft = (qid: string, val: string) =>
    setOptionDrafts((prev) => new Map(prev).set(qid, val))

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const addGroup = () => {
    const id = `group_${Date.now()}`
    const group: ResourceQuestionGroup = {
      id,
      level: newLevel,
      ...(newLevel === 'category' && newCategory ? { category: newCategory as ResourceCategory } : {}),
      ...(newLevel !== 'category' && newProducts.length > 0 ? { products: newProducts } : {}),
      ...(newLevel === 'resource' && newResourceId ? { resourceId: newResourceId } : {}),
      questions: [],
    }
    setGroups((prev) => [...prev, group])
    setShowAddGroup(false)
    setNewLevel('resource')
    setNewProducts([])
    setNewCategory('')
    setNewResourceId('')
  }

  const removeGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
  }

  const moveGroup = (index: number, direction: 'up' | 'down') => {
    setGroups((prev) => {
      if (direction === 'up' && index === 0) return prev
      if (direction === 'down' && index === prev.length - 1) return prev
      const next = [...prev]
      const swapIdx = direction === 'up' ? index - 1 : index + 1
      const temp = next[index]!
      next[index] = next[swapIdx]!
      next[swapIdx] = temp
      return next
    })
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const addQuestion = (groupId: string) => {
    const qId = `q_${Date.now()}`
    const newQ: ResourceQuestionDef = {
      id: qId,
      specsKey: '',
      label: '',
      hintText: '',
      inputType: 'select',
      required: true,
    }
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, questions: [...g.questions, newQ] } : g))
    )
  }

  const updateQuestion = (groupId: string, questionId: string, patch: Partial<ResourceQuestionDef>) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, questions: g.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)) }
          : g
      )
    )
  }

  const removeQuestion = (groupId: string, questionId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, questions: g.questions.filter((q) => q.id !== questionId) } : g))
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (groupId: string) => (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g
        const oldIndex = g.questions.findIndex((q) => q.id === active.id)
        const newIndex = g.questions.findIndex((q) => q.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return g
        return { ...g, questions: arrayMove(g.questions, oldIndex, newIndex) }
      })
    )
  }

  const handleSave = async () => {
    for (const g of groups) {
      for (const q of g.questions) {
        if (q.inputType === 'date_range') {
          if (!q.toSpecsKey) {
            toast.error(`"${q.label}" is missing an end date specs key.`)
            return
          }
          if (q.toSpecsKey === q.specsKey) {
            toast.error(`"${q.label}" end date key must differ from start date key.`)
            return
          }
        }
      }
    }
    const config: ResourceSurveyConfig = {
      groups,
      updatedBy: user?.name ?? 'Unknown',
      updatedAt: new Date().toISOString(),
    }
    try {
      await save(config)
      toast.success('Resource questions saved', {
        description: `${groups.length} group${groups.length !== 1 ? 's' : ''} configured.`,
      })
    } catch {
      toast.error('Failed to save resource questions. Please try again.')
    }
  }

  const totalQuestions = useMemo(() => groups.reduce((sum, g) => sum + g.questions.length, 0), [groups])

  const activeQuestion = useMemo(() => {
    if (!activeId) return null
    for (const g of groups) {
      const q = g.questions.find((q) => q.id === activeId)
      if (q) return q
    }
    return null
  }, [activeId, groups])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure questions appended to the survey for specific cloud resources. Answers are saved to each
          resource&apos;s <code className="text-xs bg-muted px-1 py-0.5 rounded">specs</code> field.
        </p>
        <Button variant="outline" size="sm" onClick={() => setShowAddGroup((v) => !v)} className="gap-1.5 shrink-0 ml-4">
          <Plus size={14} /> Add Group
        </Button>
      </div>

      {/* Add Group form */}
      {showAddGroup && (
        <Card className="bg-muted/10 overflow-hidden py-0">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
            <Plus size={14} />
            <span className="text-sm font-semibold text-foreground">New question group</span>
          </div>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Presentation level</label>
                <Select value={newLevel} onValueChange={(v) => setNewLevel(v as ResourceQuestionLevel)}>
                  <SelectTrigger className="text-sm h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resource">Per-resource — asked once per matching resource</SelectItem>
                    <SelectItem value="product">Once per product — same answer for all resources of a product</SelectItem>
                    <SelectItem value="category">Once per category — same answer for all resources in a category</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newLevel === 'category' ? (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Category</label>
                  <Select value={newCategory} onValueChange={(v) => setNewCategory(v as ResourceCategory)}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Select category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Product filter (optional)</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between text-sm h-9 font-normal">
                        <span className="truncate">
                          {newProducts.length === 0 ? 'All products…' : newProducts.join(', ')}
                        </span>
                        <ChevronDown size={14} className="shrink-0 ml-2 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 max-h-72 overflow-y-auto">
                      {(() => {
                        const byCategory = knownProducts.reduce<Record<string, string[]>>(
                          (acc, p) => {
                            const cat = productCategoryMap[p] ?? 'other'
                            ;(acc[cat] ??= []).push(p)
                            return acc
                          },
                          {}
                        )
                        return Object.entries(byCategory).map(([cat, products], i) => {
                          const allSelected = products.every((p) => newProducts.includes(p))
                          const someSelected = !allSelected && products.some((p) => newProducts.includes(p))
                          return (
                            <div key={cat} className={i > 0 ? 'mt-2 pt-2 border-t border-border' : ''}>
                              <button
                                type="button"
                                className="flex items-center justify-between w-full px-2 py-1 rounded hover:bg-muted"
                                onClick={() =>
                                  setNewProducts((prev) =>
                                    allSelected
                                      ? prev.filter((p) => !products.includes(p))
                                      : [...new Set([...prev, ...products])]
                                  )
                                }
                              >
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {cat}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {allSelected ? 'Deselect all' : someSelected ? 'Select rest' : 'Select all'}
                                </span>
                              </button>
                              {products.map((p) => (
                                <label
                                  key={p}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                                >
                                  <Checkbox
                                    checked={newProducts.includes(p)}
                                    onCheckedChange={(checked) =>
                                      setNewProducts((prev) =>
                                        checked ? [...prev, p] : prev.filter((x) => x !== p)
                                      )
                                    }
                                  />
                                  <span className="font-medium">{p}</span>
                                  <span className="text-muted-foreground truncate">{getNameForProduct(p)}</span>
                                </label>
                              ))}
                            </div>
                          )
                        })
                      })()}
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {newLevel === 'resource' && (
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs text-muted-foreground">
                    Specific resource ID (optional — overrides product filter)
                  </label>
                  <Input
                    value={newResourceId}
                    onChange={(e) => setNewResourceId(e.target.value)}
                    placeholder="e.g. res-a24"
                    className="text-sm h-9"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAddGroup(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={addGroup}>
                Add Group
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups list */}
      {groups.length === 0 && !showAddGroup ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-16 text-center">
          <Layers size={32} className="text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No resource question groups yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click &quot;Add Group&quot; to configure resource-specific questions
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {groups.map((group, idx) => {
            const isCollapsed = collapsedGroups.has(group.id)
            return (
              <Card key={group.id} className="bg-muted/10 mb-4 py-0 overflow-hidden">
                <GroupHeader
                  label={groupScopeLabel(group)}
                  questionCount={group.questions.length}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleGroup(group.id)}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < groups.length - 1}
                  onMoveUp={() => moveGroup(idx, 'up')}
                  onMoveDown={() => moveGroup(idx, 'down')}
                  onRemove={() => removeGroup(group.id)}
                />
                {!isCollapsed && (
                  <div className="space-y-4 p-4 pt-0">
                    {group.questions.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1">No questions yet — add one below.</p>
                    )}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd(group.id)}
                    >
                      <SortableContext
                        items={group.questions.map((q) => q.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {group.questions.map((q) => (
                          <SortableResourceQuestionCard
                            key={q.id}
                            question={q}
                            optionDraft={getOptionDraft(q.id)}
                            setOptionDraft={(val) => setOptionDraft(q.id, val)}
                            updateQuestion={(patch) => updateQuestion(group.id, q.id, patch)}
                            removeQuestion={() => removeQuestion(group.id, q.id)}
                          />
                        ))}
                      </SortableContext>
                      <DragOverlay>
                        {activeQuestion ? (
                          <div className="opacity-95 rotate-1 scale-[1.01]">
                            <ResourceQuestionCardContent
                              question={activeQuestion}
                              optionDraft={getOptionDraft(activeQuestion.id)}
                              setOptionDraft={(val) => setOptionDraft(activeQuestion.id, val)}
                              updateQuestion={() => {}}
                              removeQuestion={() => {}}
                              isOverlay
                            />
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>

                    <Button variant="outline" size="sm" onClick={() => addQuestion(group.id)} className="gap-1.5 text-xs">
                      <Plus size={12} /> Add Question
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20 py-4 border-t -mx-6 px-6 flex items-center justify-between mt-8">
        <p className="text-xs text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? 's' : ''} · {totalQuestions} total question
          {totalQuestions !== 1 ? 's' : ''}
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Resource Questions'}
        </Button>
      </div>
    </div>
  )
}
