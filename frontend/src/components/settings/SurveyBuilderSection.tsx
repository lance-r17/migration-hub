import { useState, useEffect, useRef } from 'react'
import { ClipboardList, ChevronUp, ChevronDown, X, Plus, GripVertical, Search, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSurveyConfig, useSurveyFieldDefs, useResourceSurveyConfig } from '@/hooks/use-survey'
import { useProductCategoryMap } from '@/hooks/use-product-category'
import { useCurrentUser } from '@/context/UserContext'
import type { SurveyQuestion, SurveyConfig, ResourceQuestionGroup, ResourceQuestionDef, ResourceQuestionLevel, ResourceSurveyConfig, ResourceSurveyInputType } from '@/types/survey'
import type { ResourceCategory } from '@/types'

const textareaClass =
  'min-h-[60px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

const INPUT_TYPE_LABELS: Record<string, string> = {
  short_text: 'Short text',
  long_text: 'Long text',
  select: 'Select',
  boolean: 'Yes / No',
  string_array: 'List',
  migration_window: 'Migration Window',
  dependency_list: 'Dependency List',
  date: 'Date',
  date_range: 'Date Range',
  checkbox_select: 'Checkboxes',
}

const RESOURCE_INPUT_TYPES: { value: ResourceSurveyInputType; label: string }[] = [
  { value: 'select', label: 'Select (single)' },
  { value: 'short_text', label: 'Short text' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'string_array', label: 'List (tags)' },
  { value: 'checkbox_select', label: 'Checkboxes (multi)' },
  { value: 'date', label: 'Date' },
]

const RESOURCE_CATEGORIES: ResourceCategory[] = ['VM', 'Database', 'Buckets', 'Network', 'Other']

// ─── Application Survey tab ───────────────────────────────────────────────────

function ApplicationSurveyTab() {
  const { user } = useCurrentUser()
  const { surveyConfig, loading, saving, save } = useSurveyConfig()
  const { fieldDefs, loading: fieldsLoading, getFieldById, getFieldsBySection } = useSurveyFieldDefs()

  const [isActive, setIsActive] = useState(false)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [fieldSearch, setFieldSearch] = useState('')
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (surveyConfig) {
      setIsActive(surveyConfig.isActive)
      setQuestions([...surveyConfig.questions].sort((a, b) => a.order - b.order))
    }
  }, [surveyConfig])

  const fieldsBySection = getFieldsBySection()
  const selectedFieldIds = new Set(questions.map(q => q.fieldId))

  const query = fieldSearch.trim().toLowerCase()
  const filteredFieldsBySection = query
    ? Object.fromEntries(
        Object.entries(fieldsBySection)
          .map(([section, fields]) => [
            section,
            fields.filter(f =>
              f.label.toLowerCase().includes(query) ||
              f.sectionLabel.toLowerCase().includes(query)
            ),
          ])
          .filter(([, fields]) => (fields as unknown[]).length > 0)
      )
    : fieldsBySection

  const addField = (fieldId: string) => {
    if (selectedFieldIds.has(fieldId)) return
    const def = getFieldById(fieldId)
    if (!def) return
    const newQuestion: SurveyQuestion = {
      fieldId: def.id,
      questionText: def.defaultQuestion,
      hintText: def.defaultHint,
      required: true,
      order: questions.length,
    }
    setQuestions(prev => [...prev, newQuestion])
  }

  const removeQuestion = (fieldId: string) => {
    setQuestions(prev => {
      const filtered = prev.filter(q => q.fieldId !== fieldId)
      return filtered.map((q, i) => ({ ...q, order: i }))
    })
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    setQuestions(prev => {
      const arr = [...prev]
      const swapIdx = direction === 'up' ? index - 1 : index + 1
      if (swapIdx < 0 || swapIdx >= arr.length) return prev
      ;[arr[index], arr[swapIdx]] = [arr[swapIdx]!, arr[index]!]
      return arr.map((q, i) => ({ ...q, order: i }))
    })
  }

  const updateQuestion = (fieldId: string, patch: Partial<SurveyQuestion>) => {
    setQuestions(prev =>
      prev.map(q => q.fieldId === fieldId ? { ...q, ...patch } : q)
    )
  }

  const handleDragStart = (index: number) => { dragIndexRef.current = index }
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverIndex(null)
      dragIndexRef.current = null
      return
    }
    setQuestions(prev => {
      const arr = [...prev]
      const [removed] = arr.splice(dragIndex, 1)
      arr.splice(dropIndex, 0, removed!)
      return arr.map((q, i) => ({ ...q, order: i }))
    })
    dragIndexRef.current = null
    setDragOverIndex(null)
  }
  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDragOverIndex(null)
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
      <div className="flex items-center justify-end gap-2.5">
        <span className="text-sm font-medium">Survey active</span>
        <Switch checked={isActive} onCheckedChange={setIsActive} id="survey-active" />
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-6 items-start">
        {/* Left: Field Picker */}
        <Card className="sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Available Fields
            </CardTitle>
            <p className="text-xs text-muted-foreground">Click a field to add it to your survey</p>
          </CardHeader>
          <div className="px-6 pb-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={fieldSearch}
                onChange={e => setFieldSearch(e.target.value)}
                placeholder="Search fields…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <CardContent className="space-y-4 max-h-[600px] overflow-y-auto pr-2 pt-0">
            {Object.keys(filteredFieldsBySection).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No fields match "{fieldSearch}"</p>
            )}
            {Object.entries(filteredFieldsBySection).map(([sectionLabel, fields]) => (
              <div key={sectionLabel}>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {sectionLabel}
                </p>
                <div className="space-y-1">
                  {fields.map(def => {
                    const isAdded = selectedFieldIds.has(def.id)
                    return (
                      <button
                        key={def.id}
                        onClick={() => addField(def.id)}
                        disabled={isAdded}
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

        {/* Right: Ordered Questions */}
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-16 text-center">
              <ClipboardList size={32} className="text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No questions added yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Click fields on the left to build your survey
              </p>
            </div>
          ) : (
            questions.map((q, idx) => {
              const def = getFieldById(q.fieldId) ?? fieldDefs[0]
              if (!def) return null
              return (
                <Card
                  key={q.fieldId}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={dragOverIndex === idx ? 'ring-2 ring-primary/50 ring-offset-1' : ''}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 pt-1 shrink-0 cursor-grab active:cursor-grabbing">
                        <GripVertical size={14} className="text-muted-foreground/60" />
                        <span className="text-xs font-mono text-muted-foreground/60 leading-none">{idx + 1}</span>
                      </div>
                      <div className="flex-1 space-y-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {def.sectionLabel} — {def.label}
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
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon-sm" onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground" title="Move up">
                          <ChevronUp size={14} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => moveQuestion(idx, 'down')} disabled={idx === questions.length - 1} className="text-muted-foreground hover:text-foreground" title="Move down">
                          <ChevronDown size={14} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeQuestion(q.fieldId)} className="text-muted-foreground hover:text-destructive" title="Remove">
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
          {questions.length > 0 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              {questions.length} question{questions.length !== 1 ? 's' : ''} ·{' '}
              {questions.filter(q => q.required).length} required,{' '}
              {questions.filter(q => !q.required).length} optional
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
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

// ─── Resource Questions tab ───────────────────────────────────────────────────

const LEVEL_LABELS: Record<ResourceQuestionLevel, string> = {
  resource: 'Per-resource',
  product: 'Once · Product',
  category: 'Once · Category',
}

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

function ResourceQuestionsTab() {
  const { user } = useCurrentUser()
  const { resourceSurveyConfig, loading, saving, save } = useResourceSurveyConfig()
  const { map: productCategoryMap, getNameForProduct } = useProductCategoryMap()
  const knownProducts = Object.keys(productCategoryMap)

  const [groups, setGroups] = useState<ResourceQuestionGroup[]>([])
  const [optionDrafts, setOptionDrafts] = useState<Map<string, string>>(new Map())

  const getOptionDraft = (qid: string) => optionDrafts.get(qid) ?? ''
  const setOptionDraft = (qid: string, val: string) =>
    setOptionDrafts(prev => new Map(prev).set(qid, val))

  // Drag-and-drop state for group reordering
  const dragGroupIndexRef = useRef<number | null>(null)
  const [dragOverGroupIndex, setDragOverGroupIndex] = useState<number | null>(null)

  // New group form state
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newLevel, setNewLevel] = useState<ResourceQuestionLevel>('resource')
  const [newProducts, setNewProducts] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState<ResourceCategory | ''>('')
  const [newResourceId, setNewResourceId] = useState('')

  useEffect(() => {
    if (resourceSurveyConfig) setGroups(resourceSurveyConfig.groups)
  }, [resourceSurveyConfig])

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
    setGroups(prev => [...prev, group])
    setShowAddGroup(false)
    setNewLevel('resource')
    setNewProducts([])
    setNewCategory('')
    setNewResourceId('')
  }

  const removeGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId))
  }

  const handleGroupDragStart = (index: number) => { dragGroupIndexRef.current = index }
  const handleGroupDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverGroupIndex(index)
  }
  const handleGroupDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndex = dragGroupIndexRef.current
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverGroupIndex(null)
      dragGroupIndexRef.current = null
      return
    }
    setGroups(prev => {
      const arr = [...prev]
      const [removed] = arr.splice(dragIndex, 1)
      arr.splice(dropIndex, 0, removed!)
      return arr
    })
    dragGroupIndexRef.current = null
    setDragOverGroupIndex(null)
  }
  const handleGroupDragEnd = () => {
    dragGroupIndexRef.current = null
    setDragOverGroupIndex(null)
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
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, questions: [...g.questions, newQ] } : g
    ))
  }

  const updateQuestion = (groupId: string, questionId: string, patch: Partial<ResourceQuestionDef>) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, questions: g.questions.map(q => q.id === questionId ? { ...q, ...patch } : q) }
        : g
    ))
  }

  const removeQuestion = (groupId: string, questionId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, questions: g.questions.filter(q => q.id !== questionId) } : g
    ))
  }

  const handleSave = async () => {
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
          Configure questions appended to the survey for specific cloud resources. Answers are saved to each resource's <code className="text-xs bg-muted px-1 py-0.5 rounded">specs</code> field.
        </p>
        <Button variant="outline" size="sm" onClick={() => setShowAddGroup(v => !v)} className="gap-1.5 shrink-0 ml-4">
          <Plus size={14} /> Add Group
        </Button>
      </div>

      {/* Add Group form */}
      {showAddGroup && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 space-y-4">
            <p className="text-sm font-medium">New question group</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Presentation level</label>
                <Select value={newLevel} onValueChange={(v) => setNewLevel(v as ResourceQuestionLevel)}>
                  <SelectTrigger className="text-sm h-9">
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
                      {RESOURCE_CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
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
                        const byCategory = knownProducts.reduce<Record<string, string[]>>((acc, p) => {
                          const cat = productCategoryMap[p] ?? 'other'
                          ;(acc[cat] ??= []).push(p)
                          return acc
                        }, {})
                        return Object.entries(byCategory).map(([cat, products], i) => {
                          const allSelected = products.every(p => newProducts.includes(p))
                          const someSelected = !allSelected && products.some(p => newProducts.includes(p))
                          return (
                            <div key={cat} className={i > 0 ? 'mt-2 pt-2 border-t border-border' : ''}>
                              <button
                                type="button"
                                className="flex items-center justify-between w-full px-2 py-1 rounded hover:bg-muted"
                                onClick={() => setNewProducts(prev =>
                                  allSelected
                                    ? prev.filter(p => !products.includes(p))
                                    : [...new Set([...prev, ...products])]
                                )}
                              >
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</span>
                                <span className="text-xs text-muted-foreground">
                                  {allSelected ? 'Deselect all' : someSelected ? 'Select rest' : 'Select all'}
                                </span>
                              </button>
                              {products.map(p => (
                                <label
                                  key={p}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                                >
                                  <Checkbox
                                    checked={newProducts.includes(p)}
                                    onCheckedChange={(checked) =>
                                      setNewProducts(prev =>
                                        checked ? [...prev, p] : prev.filter(x => x !== p)
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
                  <label className="text-xs text-muted-foreground">Specific resource ID (optional — overrides product filter)</label>
                  <Input
                    value={newResourceId}
                    onChange={e => setNewResourceId(e.target.value)}
                    placeholder="e.g. res-a24"
                    className="text-sm h-9"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAddGroup(false)}>Cancel</Button>
              <Button size="sm" onClick={addGroup}>Add Group</Button>
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
            Click "Add Group" to configure resource-specific questions
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, idx) => (
            <Card
              key={group.id}
              draggable
              onDragStart={() => handleGroupDragStart(idx)}
              onDragOver={(e) => handleGroupDragOver(e, idx)}
              onDrop={(e) => handleGroupDrop(e, idx)}
              onDragEnd={handleGroupDragEnd}
              className={dragOverGroupIndex === idx ? 'ring-2 ring-primary/50 ring-offset-1' : ''}
            >
              <CardContent className="pt-4 pb-4 space-y-4">
                {/* Group header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0" />
                    <Badge variant="outline" className="text-xs font-normal">
                      {LEVEL_LABELS[group.level]}
                    </Badge>
                    <span className="text-sm font-medium">{groupScopeLabel(group)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeGroup(group.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove group"
                  >
                    <X size={14} />
                  </Button>
                </div>

                {/* Questions in this group */}
                <div className="space-y-3 pl-2 border-l-2 border-border">
                  {group.questions.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">No questions yet — add one below.</p>
                  )}
                  {group.questions.map(q => (
                    <div key={q.id} className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeQuestion(group.id, q.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove question"
                        >
                          <X size={12} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Specs key</label>
                          <Input
                            value={q.specsKey}
                            onChange={e => updateQuestion(group.id, q.id, { specsKey: e.target.value })}
                            placeholder="e.g. usage_pattern"
                            className="text-sm h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Input type</label>
                          <Select
                            value={q.inputType}
                            onValueChange={(v) => updateQuestion(group.id, q.id, { inputType: v as ResourceSurveyInputType })}
                          >
                            <SelectTrigger className="text-sm h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RESOURCE_INPUT_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Question text</label>
                        <Input
                          value={q.label}
                          onChange={e => updateQuestion(group.id, q.id, { label: e.target.value })}
                          placeholder="What is the usage pattern for this resource?"
                          className="text-sm h-8"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Hint</label>
                        <Input
                          value={q.hintText}
                          onChange={e => updateQuestion(group.id, q.id, { hintText: e.target.value })}
                          placeholder="e.g. cache-only"
                          className="text-sm h-8"
                        />
                      </div>

                      {(q.inputType === 'select' || q.inputType === 'checkbox_select') && (
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Options</label>
                          <div
                            className="flex flex-wrap gap-1.5 min-h-[38px] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 cursor-text"
                            onClick={e => {
                              const input = (e.currentTarget as HTMLElement).querySelector('input')
                              input?.focus()
                            }}
                          >
                            {(q.options ?? []).map(opt => (
                              <Badge key={opt} variant="secondary" className="gap-1 pr-1 text-xs">
                                {opt}
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation()
                                    updateQuestion(group.id, q.id, {
                                      options: (q.options ?? []).filter(o => o !== opt)
                                    })
                                  }}
                                  className="rounded-sm hover:bg-destructive/20 p-0.5"
                                >
                                  <X className="size-3" />
                                </button>
                              </Badge>
                            ))}
                            <input
                              value={getOptionDraft(q.id)}
                              onChange={e => setOptionDraft(q.id, e.target.value.replace(',', ''))}
                              onKeyDown={e => {
                                const raw = getOptionDraft(q.id).trim()
                                if ((e.key === 'Enter' || e.key === ',') && raw) {
                                  e.preventDefault()
                                  if (!(q.options ?? []).includes(raw)) {
                                    updateQuestion(group.id, q.id, { options: [...(q.options ?? []), raw] })
                                  }
                                  setOptionDraft(q.id, '')
                                } else if (e.key === 'Backspace' && !getOptionDraft(q.id) && (q.options ?? []).length > 0) {
                                  updateQuestion(group.id, q.id, {
                                    options: (q.options ?? []).slice(0, -1)
                                  })
                                }
                              }}
                              onBlur={() => {
                                const raw = getOptionDraft(q.id).trim()
                                if (raw && !(q.options ?? []).includes(raw)) {
                                  updateQuestion(group.id, q.id, { options: [...(q.options ?? []), raw] })
                                }
                                setOptionDraft(q.id, '')
                              }}
                              placeholder={(q.options ?? []).length === 0 ? 'e.g. cache-only' : ''}
                              className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground py-0.5"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Required</span>
                        <Switch
                          checked={q.required}
                          onCheckedChange={v => updateQuestion(group.id, q.id, { required: v })}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addQuestion(group.id)}
                    className="gap-1.5 text-xs"
                  >
                    <Plus size={12} /> Add Question
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? 's' : ''} ·{' '}
          {groups.reduce((sum, g) => sum + g.questions.length, 0)} total question{groups.reduce((s, g) => s + g.questions.length, 0) !== 1 ? 's' : ''}
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Resource Questions'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SurveyBuilderSection() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Project Survey</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define the questionnaire shown to project teams when filling in their migration profile.
        </p>
      </div>

      <Tabs defaultValue="application">
        <TabsList>
          <TabsTrigger value="application" className="gap-1.5">
            <ClipboardList size={14} />
            Application Survey
          </TabsTrigger>
          <TabsTrigger value="resource" className="gap-1.5">
            <Layers size={14} />
            Resource Questions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="application" className="mt-6">
          <ApplicationSurveyTab />
        </TabsContent>
        <TabsContent value="resource" className="mt-6">
          <ResourceQuestionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
