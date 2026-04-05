import { useState, useEffect, useRef } from 'react'
import { ClipboardList, ChevronUp, ChevronDown, X, Plus, GripVertical, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSurveyConfig, useSurveyFieldDefs } from '@/hooks/use-survey'
import { useCurrentUser } from '@/context/UserContext'
import type { SurveyQuestion, SurveyConfig } from '@/types/survey'

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
}

export function SurveyBuilderSection() {
  const { user } = useCurrentUser()
  const { surveyConfig, loading, saving, save } = useSurveyConfig()
  const { fieldDefs, loading: fieldsLoading, getFieldById, getFieldsBySection } = useSurveyFieldDefs()

  const [isActive, setIsActive] = useState(false)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [fieldSearch, setFieldSearch] = useState('')
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Sync state from loaded config
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

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index
  }

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Project Survey</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define the questionnaire shown to project teams when filling in their migration profile.
          </p>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <Checkbox
            checked={isActive}
            onCheckedChange={(v) => setIsActive(v === true)}
            id="survey-active"
          />
          <span className="text-sm font-medium">Survey active</span>
        </label>
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
                      {/* Drag handle + order indicator */}
                      <div className="flex flex-col items-center gap-1 pt-1 shrink-0 cursor-grab active:cursor-grabbing">
                        <GripVertical size={14} className="text-muted-foreground/60" />
                        <span className="text-xs font-mono text-muted-foreground/60 leading-none">
                          {idx + 1}
                        </span>
                      </div>

                      {/* Question config */}
                      <div className="flex-1 space-y-3 min-w-0">
                        {/* Field label + type */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            {def.sectionLabel} — {def.label}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                            {INPUT_TYPE_LABELS[def.inputType]}
                          </Badge>
                        </div>

                        {/* Question text */}
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

                        {/* Hint / sample answer */}
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

                        {/* Required checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            id={`required-${q.fieldId}`}
                            checked={q.required}
                            onCheckedChange={(v: boolean | 'indeterminate') =>
                              updateQuestion(q.fieldId, { required: v === true })
                            }
                          />
                          <span className="text-xs text-muted-foreground">Required</span>
                        </label>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveQuestion(idx, 'up')}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground"
                          title="Move up"
                        >
                          <ChevronUp size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => moveQuestion(idx, 'down')}
                          disabled={idx === questions.length - 1}
                          className="text-muted-foreground hover:text-foreground"
                          title="Move down"
                        >
                          <ChevronDown size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeQuestion(q.fieldId)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove"
                        >
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

      {/* Save footer */}
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
