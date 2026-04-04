import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, CheckCircle2, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSurveyFieldDefs } from '@/hooks/use-survey'
import { MigrationWindowPicker } from '@/components/shared/MigrationWindowPicker'
import type { SurveyConfig, SurveyQuestion, SurveyFieldDef } from '@/types/survey'
import type { Project } from '@/types'

interface SurveyModalProps {
  open: boolean
  onClose: () => void
  surveyConfig: SurveyConfig
  project: Project
  onSave: <K extends keyof Project>(key: K, value: Project[K]) => Promise<void>
}

type AnswerValue = string | boolean | string[] | undefined

const textareaClass =
  'w-full bg-transparent border-0 border-b-2 border-input rounded-none px-0 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary resize-none transition-colors'

// ─── Deep get/set utilities ────────────────────────────────────────────────────

function deepGet(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur !== null && cur !== undefined && typeof cur === 'object' && !Array.isArray(cur)) {
      return (cur as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.')
  const result = { ...obj }
  let cur: Record<string, unknown> = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    const next = cur[key]
    cur[key] = next !== null && next !== undefined && typeof next === 'object' && !Array.isArray(next)
      ? { ...(next as Record<string, unknown>) }
      : {}
    cur = cur[key] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]!] = value
  return result
}

// ─── Pull existing project value for pre-filling ──────────────────────────────

function getExistingValue(project: Project, sectionKey: keyof Project, fieldPath: string): AnswerValue {
  const section = project[sectionKey]
  if (section === null || section === undefined || typeof section !== 'object' || Array.isArray(section)) {
    return undefined
  }
  const raw = deepGet(section as unknown as Record<string, unknown>, fieldPath)
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'boolean') return raw
  if (Array.isArray(raw)) return raw as string[]
  return String(raw)
}

// ─── String-array tag editor ──────────────────────────────────────────────────

function TagEditor({ value, onChange }: { value: string[], onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('')

  const addTag = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInputVal('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputVal)
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter(t => t !== tag))}
                className="hover:text-destructive transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={inputVal}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputVal.trim()) addTag(inputVal) }}
        placeholder="Type and press Enter to add…"
        data-tag-input="true"
        className="text-base border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0"
      />
      <p className="text-xs text-muted-foreground">Press Enter or comma to add each item</p>
    </div>
  )
}

// ─── Single question input ────────────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
  autoFocus,
  getFieldById,
}: {
  question: SurveyQuestion
  value: AnswerValue
  onChange: (v: AnswerValue) => void
  autoFocus?: boolean
  getFieldById: (id: string) => SurveyFieldDef | undefined
}) {
  const def = getFieldById(question.fieldId)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [autoFocus, question.fieldId])

  if (!def) return null

  switch (def.inputType) {
    case 'short_text':
      return (
        <Input
          ref={inputRef}
          value={(value as string) ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          placeholder="Type your answer…"
          className="text-base h-12 border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0"
        />
      )
    case 'long_text':
      return (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          placeholder="Type your answer…"
          rows={4}
          className={textareaClass}
          autoFocus={autoFocus}
        />
      )
    case 'select':
      return (
        <Select value={(value as string) ?? ''} onValueChange={(v: string) => onChange(v)}>
          <SelectTrigger className="text-base h-12 border-0 border-b-2 rounded-none focus:ring-0 bg-transparent px-0 w-full max-w-sm">
            <SelectValue placeholder="Select an option…" />
          </SelectTrigger>
          <SelectContent className="z-[400]">
            {def.options?.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'boolean':
      return (
        <div className="flex gap-3 pt-2">
          {(['Yes', 'No'] as const).map(choice => {
            const choiceVal = choice === 'Yes'
            const isSelected = value === choiceVal
            return (
              <button
                key={choice}
                type="button"
                onClick={() => onChange(isSelected ? undefined : choiceVal)}
                className={
                  'flex-1 max-w-[140px] py-3 rounded-xl border-2 font-semibold text-sm transition-all ' +
                  (isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')
                }
              >
                {choice}
              </button>
            )
          })}
        </div>
      )
    case 'string_array':
      return (
        <TagEditor
          value={(value as string[]) ?? []}
          onChange={onChange}
        />
      )
    case 'migration_window':
      return (
        <MigrationWindowPicker
          value={value as string | undefined}
          onChange={onChange}
        />
      )
    default:
      return null
  }
}

// ─── Ensure sections with required array fields retain them ───────────────────

function ensureRequiredArrayFields(
  sectionKey: keyof Project,
  data: Record<string, unknown>,
  project: Project,
): Record<string, unknown> {
  if (sectionKey === 'dataPersistence' && !Array.isArray(data.databaseTypes)) {
    return { ...data, databaseTypes: [] }
  }
  if (sectionKey === 'currentInfrastructure' && !Array.isArray(data.resources)) {
    const existing = project.currentInfrastructure
    return { ...data, resources: existing?.resources ?? [] }
  }
  if (sectionKey === 'dependencies') {
    const existing = project.dependencies
    return {
      upstream: existing?.upstream ?? [],
      downstream: existing?.downstream ?? [],
      ...data,
    }
  }
  return data
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function SurveyModal({ open, onClose, surveyConfig, project, onSave }: SurveyModalProps) {
  const { getFieldById } = useSurveyFieldDefs()
  const orderedQuestions = [...surveyConfig.questions].sort((a, b) => a.order - b.order)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, AnswerValue>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Reset + pre-fill when opened
  useEffect(() => {
    if (!open) return
    setCurrentIndex(0)
    setCompleted(false)
    setSubmitting(false)
    const prefilled = new Map<string, AnswerValue>()
    for (const q of orderedQuestions) {
      const def = getFieldById(q.fieldId)
      if (!def) continue
      const existing = getExistingValue(project, def.sectionKey, def.fieldPath)
      if (existing !== undefined) prefilled.set(q.fieldId, existing)
    }
    setAnswers(prefilled)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const currentQuestion = orderedQuestions[currentIndex]
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.fieldId) : undefined
  const isAnswered = currentAnswer !== undefined && currentAnswer !== '' &&
    !(Array.isArray(currentAnswer) && currentAnswer.length === 0)
  const canAdvance = !currentQuestion?.required || isAnswered
  const isLast = currentIndex === orderedQuestions.length - 1

  const setAnswer = (value: AnswerValue) => {
    if (!currentQuestion) return
    setAnswers(prev => {
      const next = new Map(prev)
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        next.delete(currentQuestion.fieldId)
      } else {
        next.set(currentQuestion.fieldId, value)
      }
      return next
    })
  }

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      // Group answers by sectionKey, deep-merge into existing section data
      const sectionUpdates = new Map<keyof Project, Record<string, unknown>>()

      for (const [fieldId, value] of answers.entries()) {
        const def = getFieldById(fieldId)
        if (!def) continue
        const sectionKey = def.sectionKey
        const existing = (project[sectionKey] ?? {}) as unknown as Record<string, unknown>
        const current = sectionUpdates.get(sectionKey) ?? { ...existing }
        sectionUpdates.set(sectionKey, deepSet(current, def.fieldPath, value))
      }

      for (const [sectionKey, merged] of sectionUpdates.entries()) {
        const safeMerged = ensureRequiredArrayFields(sectionKey, merged, project)
        await onSave(sectionKey, safeMerged as unknown as Project[typeof sectionKey])
      }

      setCompleted(true)
    } finally {
      setSubmitting(false)
    }
  }, [answers, project, onSave])

  const goNext = useCallback(() => {
    if (isLast) {
      void handleSubmit()
    } else {
      setCurrentIndex(i => i + 1)
    }
  }, [isLast, handleSubmit])

  const goBack = () => setCurrentIndex(i => Math.max(0, i - 1))

  const skip = () => {
    if (isLast) {
      void handleSubmit()
    } else {
      setCurrentIndex(i => i + 1)
    }
  }

  // Keyboard: Enter to advance
  useEffect(() => {
    if (!open || completed || submitting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'TEXTAREA') return
        if ((e.target as HTMLElement).dataset.tagInput) return
        e.preventDefault()
        if (canAdvance) goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, completed, submitting, canAdvance, goNext])

  if (!open) return null

  const progress = orderedQuestions.length > 0
    ? Math.round(((currentIndex + (completed ? 1 : 0)) / orderedQuestions.length) * 100)
    : 100

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-background">
      {/* Progress bar */}
      <div className="h-1 bg-muted w-full shrink-0">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-primary" />
          <span className="font-semibold text-sm">{project.name} — Survey</span>
        </div>
        <div className="flex items-center gap-4">
          {!completed && (
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {orderedQuestions.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">

          {completed ? (
            /* Completion screen */
            <div className="text-center space-y-4">
              <CheckCircle2 size={56} className="text-primary mx-auto" />
              <h2 className="text-2xl font-semibold">Survey complete!</h2>
              <p className="text-muted-foreground">
                Your answers have been saved to the project record. You can always update them by
                editing the individual sections or running the survey again.
              </p>
              <Button onClick={onClose} size="lg" className="mt-4 px-10">
                Close
              </Button>
            </div>
          ) : currentQuestion ? (
            /* Question screen */
            <div className="space-y-8">
              {/* Section badge */}
              {(() => {
                const def = getFieldById(currentQuestion.fieldId)
                if (!def) return null
                return (
                  <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    {def.sectionLabel}
                  </span>
                )
              })()}

              {/* Question text */}
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold leading-snug">
                  {currentQuestion.questionText}
                  {currentQuestion.required && (
                    <span className="text-destructive ml-1 text-sm align-super">*</span>
                  )}
                </h2>
                {currentQuestion.hintText && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentQuestion.hintText}
                  </p>
                )}
              </div>

              {/* Input */}
              <QuestionInput
                question={currentQuestion}
                value={currentAnswer}
                onChange={setAnswer}
                autoFocus
                getFieldById={getFieldById}
              />
            </div>
          ) : null}

        </div>
      </div>

      {/* Footer navigation */}
      {!completed && (
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={currentIndex === 0}
            className="gap-1.5"
          >
            <ChevronLeft size={16} />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {currentQuestion && !currentQuestion.required && (
              <Button
                variant="ghost"
                onClick={skip}
                className="text-muted-foreground text-sm"
              >
                Skip
              </Button>
            )}
            <Button
              onClick={goNext}
              disabled={!canAdvance || submitting}
              className="gap-1.5 min-w-[100px]"
            >
              {submitting ? (
                'Saving…'
              ) : isLast ? (
                'Submit'
              ) : (
                <>Next <ChevronRight size={16} /></>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
