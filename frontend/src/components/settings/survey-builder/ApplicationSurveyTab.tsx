import { useState, useEffect, useMemo } from 'react'
import {
  ClipboardList,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  GripVertical,
  Search,
  ChevronRight,
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
  type CollisionDetection,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrentUser } from '@/context/UserContext'
import { useSurveyFieldDefs } from '@/hooks/use-survey'
import type { SurveyQuestion, SurveyConfig, SurveyFieldDef } from '@/types/survey'
import { cn } from '@/lib/utils'

const textareaClass =
  'min-h-[60px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

const INPUT_TYPE_LABELS: Record<string, string> = {
  short_text: 'Short text',
  long_text: 'Long text',
  long_text_with_upload: 'Long text + upload',
  select: 'Select',
  boolean: 'Yes / No',
  string_array: 'List',
  migration_window: 'Migration Window',
  dependency_list: 'Dependency List',
  date: 'Date',
  date_range: 'Date Range',
  checkbox_select: 'Checkboxes',
  file_upload: 'File upload',
  effort_estimate: 'Effort estimate',
  effort_table: 'Effort table',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RenderItem = { type: 'question'; question: SurveyQuestion; index: number }

interface ApplicationSurveyTabProps {
  isActive: boolean
  surveyConfig: SurveyConfig | null
  loading: boolean
  saving: boolean
  save: (config: SurveyConfig) => Promise<SurveyConfig>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRenderItems(questions: SurveyQuestion[]): RenderItem[] {
  return questions.map((q, i) => ({ type: 'question', question: q, index: i }))
}

function flattenRenderItems(items: RenderItem[]): SurveyQuestion[] {
  return items.map((item) => item.question).map((q, i) => ({ ...q, order: i }))
}

function getSortableId(item: RenderItem): string {
  return item.question.fieldId
}

function getItemSectionLabel(
  item: RenderItem,
  getFieldById: (id: string) => SurveyFieldDef | undefined
): string {
  return getFieldById(item.question.fieldId)?.sectionLabel ?? 'Unknown'
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  sectionLabel,
  questionCount,
  isCollapsed,
  onToggleCollapse,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  sectionLabel: string
  questionCount: number
  isCollapsed: boolean
  onToggleCollapse: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        type="button"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span className="truncate">{sectionLabel}</span>
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
          title="Move section up"
        >
          <ChevronUp size={12} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Move section down"
        >
          <ChevronDown size={12} />
        </Button>
      </div>
    </div>
  )
}

// ─── Question Card (static content) ───────────────────────────────────────────

function QuestionCardContent({
  item,
  getFieldById,
  updateQuestion,
  removeQuestion,
  dragHandleProps,
  isOverlay,
}: {
  item: RenderItem
  getFieldById: (id: string) => SurveyFieldDef | undefined
  updateQuestion: (fieldId: string, patch: Partial<SurveyQuestion>) => void
  removeQuestion: (fieldId: string) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  isOverlay?: boolean
}) {
  const q = item.question
  const def = getFieldById(q.fieldId)
  if (!def) return null

  return (
    <Card className={cn("bg-muted/30", isOverlay ? 'shadow-xl ring-2 ring-primary/30' : '')}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div
            className="flex flex-col items-center gap-1 pt-1 shrink-0 cursor-grab active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical size={14} className="text-muted-foreground/60" />
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">
                {def.label}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                {INPUT_TYPE_LABELS[def.inputType]}
              </Badge>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Question</label>
              <Input
                value={q.questionText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateQuestion(q.fieldId, { questionText: e.target.value })
                }
                placeholder="Enter question text…"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hint / Sample Answer</label>
              <textarea
                value={q.hintText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  updateQuestion(q.fieldId, { hintText: e.target.value })
                }
                placeholder="e.g. sample answer or guidance…"
                className={textareaClass}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Required</span>
              <Switch
                id={`required-${q.fieldId}`}
                checked={q.required}
                onCheckedChange={(v) => updateQuestion(q.fieldId, { required: v })}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => removeQuestion(q.fieldId)}
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

function SortableQuestionCard({
  item,
  getFieldById,
  updateQuestion,
  removeQuestion,
}: {
  item: RenderItem
  getFieldById: (id: string) => SurveyFieldDef | undefined
  updateQuestion: (fieldId: string, patch: Partial<SurveyQuestion>) => void
  removeQuestion: (fieldId: string) => void
}) {
  const id = getSortableId(item)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-30' : ''}>
      <QuestionCardContent
        item={item}
        getFieldById={getFieldById}
        updateQuestion={updateQuestion}
        removeQuestion={removeQuestion}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function ApplicationSurveyTab({
  isActive,
  surveyConfig,
  loading,
  saving,
  save,
}: ApplicationSurveyTabProps) {
  const { user } = useCurrentUser()
  const { loading: fieldsLoading, getFieldById, getFieldsBySection } = useSurveyFieldDefs()

  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [fieldSearch, setFieldSearch] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (surveyConfig) {
      setQuestions([...surveyConfig.questions].sort((a, b) => a.order - b.order))
    }
  }, [surveyConfig])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const fieldsBySection = getFieldsBySection()
  const selectedFieldIds = useMemo(() => new Set(questions.map((q) => q.fieldId)), [questions])

  const query = fieldSearch.trim().toLowerCase()
  const filteredFieldsBySection: Record<string, SurveyFieldDef[]> = query
    ? Object.fromEntries(
        Object.entries(fieldsBySection)
          .map(([section, fields]) => [
            section,
            fields.filter(
              (f) =>
                f.label.toLowerCase().includes(query) ||
                f.sectionLabel.toLowerCase().includes(query)
            ),
          ])
          .filter(([, fields]) => (fields as SurveyFieldDef[]).length > 0)
      )
    : fieldsBySection

  const addField = (fieldId: string) => {
    if (selectedFieldIds.has(fieldId)) return
    const def = getFieldById(fieldId)
    if (!def) return

    setQuestions((prev) => {
      // Find insert position: end of this section's block
      let insertAt = prev.length
      let foundSection = false
      for (let i = 0; i < prev.length; i++) {
        const d = getFieldById(prev[i]!.fieldId)
        if (d?.sectionLabel === def.sectionLabel) {
          foundSection = true
          insertAt = i + 1
        } else if (foundSection) {
          break
        }
      }

      const newQuestion: SurveyQuestion = {
        fieldId: def.id,
        questionText: def.defaultQuestion,
        hintText: def.defaultHint,
        required: true,
        order: insertAt,
      }

      const next = [...prev]
      next.splice(insertAt, 0, newQuestion)

      return next.map((q, i) => ({ ...q, order: i }))
    })
  }

  const removeQuestion = (fieldId: string) => {
    setQuestions((prev) => {
      const filtered = prev.filter((q) => q.fieldId !== fieldId)
      return filtered.map((q, i) => ({ ...q, order: i }))
    })
  }

  const updateQuestion = (fieldId: string, patch: Partial<SurveyQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.fieldId === fieldId ? { ...q, ...patch } : q)))
  }

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const moveSection = (sectionLabel: string, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const items = buildRenderItems(prev)

      // Build contiguous blocks with their labels
      const blocks: { label: string; start: number; end: number }[] = []
      let currentLabel: string | null = null
      for (let i = 0; i < items.length; i++) {
        const label = getItemSectionLabel(items[i]!, getFieldById)
        if (label !== currentLabel) {
          currentLabel = label
          blocks.push({ label, start: i, end: i })
        } else {
          blocks[blocks.length - 1]!.end = i
        }
      }

      const blockIdx = blocks.findIndex((b) => b.label === sectionLabel)
      if (blockIdx === -1) return prev
      if (direction === 'up' && blockIdx === 0) return prev
      if (direction === 'down' && blockIdx === blocks.length - 1) return prev

      const swapIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1
      const current = blocks[blockIdx]!
      const swap = blocks[swapIdx]!

      const currentBlock = items.slice(current.start, current.end + 1)
      const swapBlock = items.slice(swap.start, swap.end + 1)

      let result: RenderItem[]
      if (direction === 'up') {
        const before = items.slice(0, swap.start)
        const between = items.slice(swap.end + 1, current.start)
        const after = items.slice(current.end + 1)
        result = [...before, ...currentBlock, ...between, ...swapBlock, ...after]
      } else {
        const before = items.slice(0, current.start)
        const between = items.slice(current.end + 1, swap.start)
        const after = items.slice(swap.end + 1)
        result = [...before, ...swapBlock, ...between, ...currentBlock, ...after]
      }

      return flattenRenderItems(result)
    })
  }

  const renderItems = buildRenderItems(questions)

  // Build sections: each section label appears exactly once as a contiguous block
  const sections = useMemo(() => {
    const result: { label: string; items: RenderItem[] }[] = []
    let currentLabel: string | null = null

    for (const item of renderItems) {
      const label = getItemSectionLabel(item, getFieldById)
      if (label !== currentLabel) {
        currentLabel = label
        result.push({ label, items: [item] })
      } else {
        result[result.length - 1]!.items.push(item)
      }
    }

    return result
  }, [renderItems, getFieldById])

  // Only include items from expanded sections in the sortable context
  const visibleSortableIds = useMemo(() => {
    return sections
      .filter((s) => !collapsedSections.has(s.label))
      .flatMap((s) => s.items.map(getSortableId))
  }, [sections, collapsedSections])

  const findItemBySortableId = (id: string): RenderItem | undefined => {
    return renderItems.find((item) => getSortableId(item) === id)
  }

  const sectionAwareCollisionDetection: CollisionDetection = (args) => {
    const activeItem = findItemBySortableId(args.active.id as string)
    if (!activeItem) return []

    const activeSection = getItemSectionLabel(activeItem, getFieldById)

    const filtered = args.droppableContainers.filter((container) => {
      const item = findItemBySortableId(container.id as string)
      if (!item) return false
      const section = getItemSectionLabel(item, getFieldById)
      return section === activeSection
    })

    return closestCenter({ ...args, droppableContainers: filtered })
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeItem = findItemBySortableId(active.id as string)
    const overItem = findItemBySortableId(over.id as string)
    if (!activeItem || !overItem) return

    const activeSection = getItemSectionLabel(activeItem, getFieldById)
    const overSection = getItemSectionLabel(overItem, getFieldById)
    if (activeSection !== overSection) return

    const oldIndex = renderItems.findIndex((item) => getSortableId(item) === active.id)
    const newIndex = renderItems.findIndex((item) => getSortableId(item) === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const movedItems = arrayMove(renderItems, oldIndex, newIndex)
    setQuestions(flattenRenderItems(movedItems))
  }

  const handleSave = async () => {
    const config: SurveyConfig = {
      isActive,
      questions: questions.map((q, i) => ({ ...q, order: i })),
      updatedBy: user?.name ?? 'Unknown',
      updatedAt: new Date().toISOString(),
    }
    try {
      await save(config)
      toast.success('Survey configuration saved', {
        description: isActive
          ? `${questions.length} question${questions.length !== 1 ? 's' : ''} will be shown to project teams.`
          : 'Survey is inactive — it will not appear on project pages.',
      })
    } catch {
      toast.error('Failed to save survey configuration. Please try again.')
    }
  }

  const activeItem = activeId ? findItemBySortableId(activeId) ?? null : null

  if (loading || fieldsLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={sectionAwareCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-[300px_1fr] gap-6 items-start">
          {/* Left: Field Picker */}
          <Card className="bg-muted/10 sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Available Fields
              </CardTitle>
              <p className="text-xs text-muted-foreground">Click a field to add it to its section</p>
            </CardHeader>
            <div className="px-6 pb-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields…"
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto pr-2 pt-0">
              {Object.keys(filteredFieldsBySection).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No fields match &quot;{fieldSearch}&quot;
                </p>
              )}
              {Object.entries(filteredFieldsBySection).map(([sectionLabel, fields]) => (
                <div key={sectionLabel}>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                    {sectionLabel}
                  </p>
                  <div className="space-y-1">
                    {fields.filter(def => !['effort__notes', 'effort__attachments'].includes(def.id)).map((def) => {
                      const isAdded = selectedFieldIds.has(def.id)
                      return (
                        <button
                          key={def.id}
                          onClick={() => addField(def.id)}
                          disabled={isAdded}
                          type="button"
                          className={
                            'w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ' +
                            (isAdded
                              ? 'opacity-40 cursor-not-allowed bg-muted/40'
                              : 'hover:bg-primary/5 hover:text-primary cursor-pointer')
                          }
                        >
                          <span className="truncate">{def.label}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                              {INPUT_TYPE_LABELS[def.inputType]}
                            </Badge>
                            {isAdded ? (
                              <span className="text-muted-foreground text-xs">Added</span>
                            ) : (
                              <Plus size={12} className="text-muted-foreground" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Right: Ordered Questions by Section */}
          <div className="space-y-0">
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-16 text-center">
                <ClipboardList size={32} className="text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No questions added yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Click fields on the left to build your survey
                </p>
              </div>
            ) : (
              <SortableContext items={visibleSortableIds} strategy={verticalListSortingStrategy}>
                {sections.map((section, sectionIdx) => {
                  const isCollapsed = collapsedSections.has(section.label)
                  return (
                    <Card key={section.label} className="bg-muted/10 mb-4 py-0 overflow-hidden">
                      <SectionHeader
                        sectionLabel={section.label}
                        questionCount={section.items.length}
                        isCollapsed={isCollapsed}
                        onToggleCollapse={() => toggleSection(section.label)}
                        canMoveUp={sectionIdx > 0}
                        canMoveDown={sectionIdx < sections.length - 1}
                        onMoveUp={() => moveSection(section.label, 'up')}
                        onMoveDown={() => moveSection(section.label, 'down')}
                      />
                      {!isCollapsed && (
                        <div className="space-y-4 p-4 pt-0">
                          {section.items.map((item) => (
                            <SortableQuestionCard
                              key={getSortableId(item)}
                              item={item}
                              getFieldById={getFieldById}
                              updateQuestion={updateQuestion}
                              removeQuestion={removeQuestion}
                            />
                          ))}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </SortableContext>
            )}

            <DragOverlay>
              {activeItem ? (
                <div className="opacity-95 rotate-1 scale-[1.01]">
                  <QuestionCardContent
                    item={activeItem}
                    getFieldById={getFieldById}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                    isOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>

            {questions.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                {questions.length} question{questions.length !== 1 ? 's' : ''} ·{' '}
                {questions.filter((q) => q.required).length} required,{' '}
                {questions.filter((q) => !q.required).length} optional
              </p>
            )}
          </div>
        </div>
      </DndContext>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20 py-4 border-t -mx-6 px-6 flex items-center justify-between mt-8">
        <p className="text-xs text-muted-foreground">
          {isActive
            ? 'Survey is active — project teams will see the "Fill Survey" button.'
            : 'Survey is inactive — it will not appear on project pages.'}
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Survey Config'}
        </Button>
      </div>
    </div>
  )
}
