import { useState, useEffect, useCallback, useRef } from 'react'
import { format, addDays, isBefore, isAfter } from 'date-fns'
import { X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, ClipboardList, Plus, CalendarIcon, Server, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { useSurveyFieldDefs } from '@/hooks/use-survey'
import { submitSurvey } from '@/services/projects'
import { MigrationWindowPicker } from '@/components/shared/MigrationWindowPicker'
import { SurveyFileUpload } from '@/components/survey/SurveyFileUpload'
import { EffortTableSurveyInput } from '@/components/survey/EffortTableSurveyInput'
import { deleteAttachment } from '@/services/attachments'
import { useMigrationSettings } from '@/hooks/use-migration-settings'
import type { SurveyConfig, SurveyQuestion, SurveyFieldDef, ResourceSurveyConfig, ResourceQuestionDef } from '@/types/survey'
import type { Project, DependencyEntry, CloudResource, ResourceCategory, EffortTable } from '@/types'

interface SurveyModalProps {
  open: boolean
  onClose: () => void
  surveyConfig: SurveyConfig
  project: Project
  onSave: <K extends keyof Project>(key: K, value: Project[K]) => Promise<void>
  onSubmitted?: () => void | Promise<void>
  resourceSurveyConfig?: ResourceSurveyConfig
  getCategoryForProduct?: (product?: string) => ResourceCategory
}

type DateRangeValue = { from?: string; to?: string }
type AnswerValue = string | boolean | string[] | DependencyEntry[] | DateRangeValue | { tables: EffortTable[]; tableMode: 'single' | 'multiple' } | undefined
type ResourceAnswerValue = string | boolean | string[] | undefined

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

function getExistingValue(project: Project, sectionKey: keyof Project, fieldPath: string): AnswerValue {
  const section = project[sectionKey]
  if (section === null || section === undefined || typeof section !== 'object' || Array.isArray(section)) {
    return undefined
  }
  const raw = deepGet(section as unknown as Record<string, unknown>, fieldPath)
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'boolean') return raw
  if (Array.isArray(raw)) return raw as string[] | DependencyEntry[]
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
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal) }
  }
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              {tag}
              <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} className="hover:text-destructive transition-colors">
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

// ─── Dependency-list entry editor ─────────────────────────────────────────────

const HOSTING_OPTIONS = ['AliCloud', 'On-Premise', 'AWS', 'Azure', 'GCP', 'Other'] as const

function DependencyListEditor({ value, onChange }: { value: DependencyEntry[]; onChange: (v: DependencyEntry[]) => void }) {
  function addEntry() {
    onChange([...value, { id: crypto.randomUUID(), name: '', baId: '', contactEmail: '', hosting: '', notes: '' }])
  }
  function updateEntry(id: string, field: keyof DependencyEntry, val: string) {
    onChange(value.map(e => (e.id === id ? { ...e, [field]: val } : e)))
  }
  function removeEntry(id: string) { onChange(value.filter(e => e.id !== id)) }

  return (
    <div className="space-y-3">
      {value.map(entry => (
        <div key={entry.id} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dependency</span>
            <button type="button" onClick={() => removeEntry(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors" data-dep-input="true">
              <X size={14} />
            </button>
          </div>
          <Input value={entry.name} onChange={e => updateEntry(entry.id, 'name', e.target.value)} placeholder="Application name *" data-dep-input="true" className="text-sm border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0" />
          <div className="grid grid-cols-2 gap-3">
            <Input value={entry.baId ?? ''} onChange={e => updateEntry(entry.id, 'baId', e.target.value)} placeholder="BA ID" data-dep-input="true" className="text-sm border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0" />
            <Input value={entry.contactEmail ?? ''} onChange={e => updateEntry(entry.id, 'contactEmail', e.target.value)} placeholder="Contact email" data-dep-input="true" className="text-sm border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0" />
          </div>
          <Select value={entry.hosting ?? ''} onValueChange={v => updateEntry(entry.id, 'hosting', v)}>
            <SelectTrigger className="text-sm border-0 border-b-2 rounded-none focus:ring-0 bg-transparent px-0 w-full">
              <SelectValue placeholder="Hosting platform…" />
            </SelectTrigger>
            <SelectContent className="z-[400]">
              {HOSTING_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={entry.notes ?? ''} onChange={e => updateEntry(entry.id, 'notes', e.target.value)} placeholder="Notes" data-dep-input="true" className="text-sm border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0" />
        </div>
      ))}
      <Button type="button" variant="outline" className="w-full" onClick={addEntry} data-dep-input="true">
        <Plus size={14} className="mr-1" /> Add Dependency
      </Button>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">No dependencies added yet — click "Add Dependency" to begin.</p>
      )}
    </div>
  )
}

// ─── Application question input ───────────────────────────────────────────────

function QuestionInput({
  question, value, onChange, attachmentValue, onAttachmentChange, onRemove, autoFocus, getFieldById, projectId, project,
}: {
  question: SurveyQuestion
  value: AnswerValue
  onChange: (v: AnswerValue) => void
  attachmentValue?: string[]
  onAttachmentChange?: (ids: string[]) => void
  onRemove?: (id: string) => void
  autoFocus?: boolean
  getFieldById: (id: string) => SurveyFieldDef | undefined
  projectId: string
  project: Project
}) {
  const def = getFieldById(question.fieldId)
  const inputRef = useRef<HTMLInputElement>(null)
  const { settings } = useMigrationSettings()
  const platformStart = settings?.platformPeriod?.startDate
  const platformEnd = settings?.platformPeriod?.endDate
  const disabledDates = platformStart && platformEnd
    ? [
        { before: new Date(platformStart) },
        { after: new Date(platformEnd) },
      ]
    : undefined
  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50)
  }, [autoFocus, question.fieldId])

  if (!def) return null

  switch (def.inputType) {
    case 'short_text':
      return (
        <Input ref={inputRef} value={(value as string) ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} placeholder="Type your answer…" className="text-base h-12 border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0" />
      )
    case 'long_text':
      return (
        <textarea value={(value as string) ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} placeholder="Type your answer…" rows={4} className={textareaClass} autoFocus={autoFocus} />
      )
    case 'long_text_with_upload':
      return (
        <div className="space-y-4">
          <textarea
            value={(value as string) ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            placeholder="Type your answer…"
            rows={4}
            className={textareaClass}
            autoFocus={autoFocus}
          />
          <SurveyFileUpload
            projectId={projectId}
            value={attachmentValue ?? []}
            onChange={onAttachmentChange ?? (() => {})}
            onRemove={onRemove}
          />
        </div>
      )
    case 'file_upload':
      return (
        <SurveyFileUpload
          projectId={projectId}
          value={(value as string[]) ?? []}
          onChange={onChange as (v: string[]) => void}
          onRemove={onRemove}
        />
      )
    case 'select':
      return (
        <div className="flex flex-col gap-3 pt-2">
          {def.options?.map((opt, idx) => {
            const isSelected = (value as string) === opt
            const keyLabel = String.fromCharCode(65 + idx)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(isSelected ? undefined : opt)}
                className={
                  'flex items-center w-full px-4 py-2.5 rounded-md border-2 text-left transition-all duration-200 ' +
                  (isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')
                }
              >
                <span className={
                  'flex-shrink-0 flex items-center justify-center w-6 h-6 text-xs font-bold mr-4 border rounded-md transition-colors ' +
                  (isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground')
                }>
                  {keyLabel}
                </span>
                <span className="text-sm">{opt}</span>
                {isSelected && <Check size={16} className="ml-auto flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )
    case 'boolean':
      return (
        <div className="flex gap-3 pt-2">
          {(['Yes', 'No'] as const).map(choice => {
            const choiceVal = choice === 'Yes'
            const isSelected = value === choiceVal
            return (
              <button key={choice} type="button" onClick={() => onChange(isSelected ? undefined : choiceVal)}
                className={'flex-1 max-w-[140px] py-3 rounded-xl border-2 font-semibold text-sm transition-all ' + (isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')}>
                {choice}
              </button>
            )
          })}
        </div>
      )
    case 'string_array':
      return <TagEditor value={(value as string[]) ?? []} onChange={onChange} />
    case 'checkbox_select': {
      const selected = (value as string[]) ?? []
      return (
        <div className="flex flex-col gap-3 pt-2">
          {def.options?.map((opt, idx) => {
            const isSelected = selected.includes(opt)
            const keyLabel = String.fromCharCode(65 + idx)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = isSelected ? selected.filter(v => v !== opt) : [...selected, opt]
                  onChange(next)
                }}
                className={
                  'flex items-center w-full px-4 py-2.5 rounded-md border-2 text-left transition-all duration-200 ' +
                  (isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')
                }
              >
                <span className={
                  'flex-shrink-0 flex items-center justify-center w-6 h-6 text-xs font-bold mr-4 border rounded-md transition-colors ' +
                  (isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground')
                }>
                  {keyLabel}
                </span>
                <span className="text-sm">{opt}</span>
                {isSelected && <Check size={16} className="ml-auto flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )
    }
    case 'migration_window':
      return <MigrationWindowPicker value={value as string | undefined} onChange={onChange} />
    case 'dependency_list':
      return <DependencyListEditor value={(value as DependencyEntry[]) ?? []} onChange={onChange as (v: DependencyEntry[]) => void} />
    case 'date': {
      const dateStr = value as string | undefined
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={cn('h-12 w-full max-w-xs justify-start text-left text-base font-normal border-0 border-b-2 rounded-none bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary', !dateStr && 'text-muted-foreground')}>
              <CalendarIcon size={16} className="mr-2 shrink-0" />
              {dateStr ? format(new Date(dateStr), 'MMM d, y') : 'Pick a date…'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[400]" align="start">
            <Calendar mode="single" defaultMonth={dateStr ? new Date(dateStr) : platformStart ? new Date(platformStart) : undefined} selected={dateStr ? new Date(dateStr) : undefined} onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : undefined)} disabled={disabledDates} />
          </PopoverContent>
        </Popover>
      )
    }
    case 'date_range': {
      const range = (value as DateRangeValue | undefined) ?? {}
      const { from, to } = range
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={cn('h-12 w-full max-w-sm justify-start text-left text-base font-normal border-0 border-b-2 rounded-none bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary', !from && !to && 'text-muted-foreground')}>
              <CalendarIcon size={16} className="mr-2 shrink-0" />
              {from && to ? `${format(new Date(from), 'MMM d, y')} → ${format(new Date(to), 'MMM d, y')}` : from ? `From ${format(new Date(from), 'MMM d, y')}` : 'Pick a date range…'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[400]" align="start">
            <Calendar mode="range" numberOfMonths={2} defaultMonth={from ? new Date(from) : platformStart ? new Date(platformStart) : undefined}
              selected={{ from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }}
              onSelect={(r) => onChange({ from: r?.from ? format(r.from, 'yyyy-MM-dd') : undefined, to: r?.to ? format(r.to, 'yyyy-MM-dd') : undefined })}
              disabled={disabledDates} />
          </PopoverContent>
        </Popover>
      )
    }
    case 'migration_date_range': {
      const range = (value as DateRangeValue | undefined) ?? {}
      const durationOptions = settings?.durationOptions ?? [15, 30, 45]
      const selectedDuration = range.from && range.to
        ? String(Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / (1000 * 60 * 60 * 24)))
        : ''

      function computeEndDate(start: string | undefined, dur: string): string | undefined {
        if (!start || !dur) return undefined
        const days = parseInt(dur, 10)
        if (!Number.isFinite(days) || days <= 0) return undefined
        return format(addDays(new Date(start), days), 'yyyy-MM-dd')
      }

      function isWithinPlatform(start?: string, end?: string): boolean {
        if (!platformStart || !platformEnd) return true
        if (!start || !end) return true
        return !isBefore(new Date(start), new Date(platformStart)) && !isAfter(new Date(end), new Date(platformEnd))
      }

      const computedEnd = computeEndDate(range.from, selectedDuration)
      const rangeError = range.from && computedEnd && !isWithinPlatform(range.from, computedEnd)
        ? `Must be within platform period${platformStart && platformEnd ? ` (${format(new Date(platformStart), 'MMM d, y')} – ${format(new Date(platformEnd), 'MMM d, y')})` : ''}`
        : null

      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {durationOptions.map(days => {
              const selected = selectedDuration === String(days)
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    const val = selected ? '' : String(days)
                    const end = computeEndDate(range.from, val)
                    onChange({ from: range.from, to: end })
                  }}
                  className={cn(
                    'inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  )}
                >
                  {days} days
                </button>
              )
            })}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className={cn('h-12 w-full max-w-xs justify-start text-left text-base font-normal border-0 border-b-2 rounded-none bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary', !range.from && 'text-muted-foreground')}>
                <CalendarIcon size={16} className="mr-2 shrink-0" />
                {range.from ? format(new Date(range.from), 'MMM d, y') : 'Pick a start date…'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[400]" align="start">
              <Calendar mode="single" defaultMonth={range.from ? new Date(range.from) : platformStart ? new Date(platformStart) : undefined} selected={range.from ? new Date(range.from) : undefined}
                onSelect={(d) => {
                  const start = d ? format(d, 'yyyy-MM-dd') : undefined
                  const end = computeEndDate(start, selectedDuration)
                  onChange({ from: start, to: end })
                }}
                disabled={(() => {
                  if (!platformStart || !platformEnd) return undefined
                  const startBound = { before: new Date(platformStart) }
                  const days = parseInt(selectedDuration, 10)
                  if (Number.isFinite(days) && days > 0) {
                    const maxStart = addDays(new Date(platformEnd), -days)
                    return [startBound, { after: maxStart }]
                  }
                  return [startBound, { after: new Date(platformEnd) }]
                })()} />
            </PopoverContent>
          </Popover>

          {computedEnd && (
            <div className="text-sm text-muted-foreground">
              End date: <span className="font-medium text-foreground">{format(new Date(computedEnd), 'MMM d, y')}</span>
            </div>
          )}
          {rangeError && <p className="text-xs text-destructive">{rangeError}</p>}
        </div>
      )
    }
    case 'effort_table': {
      const projectBaId = project.applicationOverview?.baId
      const softwareOrigin = project.applicationOverview?.softwareOrigin
      return (
        <EffortTableSurveyInput
          value={value as { tables?: EffortTable[]; tableMode?: 'single' | 'multiple' } | undefined}
          onChange={onChange as (v: { tables: EffortTable[]; tableMode: 'single' | 'multiple' }) => void}
          projectBaId={projectBaId}
          softwareOrigin={softwareOrigin}
        />
      )
    }
    default:
      return null
  }
}

// ─── Resource question input ──────────────────────────────────────────────────

function ResourceQuestionInput({
  questionDef, value, onChange,
}: {
  questionDef: ResourceQuestionDef
  value: ResourceAnswerValue
  onChange: (v: ResourceAnswerValue) => void
}) {
  const { settings } = useMigrationSettings()
  const platformStart = settings?.platformPeriod?.startDate
  const platformEnd = settings?.platformPeriod?.endDate
  const disabledDates = platformStart && platformEnd
    ? [
        { before: new Date(platformStart) },
        { after: new Date(platformEnd) },
      ]
    : undefined
  switch (questionDef.inputType) {
    case 'short_text':
      return (
        <Input value={(value as string) ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} placeholder="Type your answer…" className="text-base h-12 border-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent px-0" />
      )
    case 'select':
      return (
        <div className="flex flex-col gap-3 pt-2">
          {questionDef.options?.map((opt, idx) => {
            const isSelected = (value as string) === opt
            const keyLabel = String.fromCharCode(65 + idx)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(isSelected ? undefined : opt)}
                className={
                  'flex items-center w-full px-4 py-2.5 rounded-md border-2 text-left transition-all duration-200 ' +
                  (isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')
                }
              >
                <span className={
                  'flex-shrink-0 flex items-center justify-center w-6 h-6 text-xs font-bold mr-4 border rounded-md transition-colors ' +
                  (isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground')
                }>
                  {keyLabel}
                </span>
                <span className="text-sm">{opt}</span>
                {isSelected && <Check size={16} className="ml-auto flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )
    case 'boolean':
      return (
        <div className="flex gap-3 pt-2">
          {(['Yes', 'No'] as const).map(choice => {
            const choiceVal = choice === 'Yes'
            const isSelected = value === choiceVal
            return (
              <button key={choice} type="button" onClick={() => onChange(isSelected ? undefined : choiceVal)}
                className={'flex-1 max-w-[140px] py-3 rounded-xl border-2 font-semibold text-sm transition-all ' + (isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')}>
                {choice}
              </button>
            )
          })}
        </div>
      )
    case 'date': {
      const dateVal = (value as string) ?? ''
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal h-12">
              <CalendarIcon size={16} className="mr-2 shrink-0" />
              {dateVal ? format(new Date(dateVal), 'MMM d, y') : <span className="text-muted-foreground">Pick a date…</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[400]" align="start">
            <Calendar
              mode="single"
              defaultMonth={dateVal ? new Date(dateVal) : platformStart ? new Date(platformStart) : undefined}
              selected={dateVal ? new Date(dateVal) : undefined}
              onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : undefined)}
              disabled={disabledDates}
            />
          </PopoverContent>
        </Popover>
      )
    }
    case 'string_array':
      return <TagEditor value={(value as string[]) ?? []} onChange={onChange as (v: string[]) => void} />
    case 'checkbox_select': {
      const selected = (value as string[]) ?? []
      return (
        <div className="flex flex-col gap-3 pt-2">
          {questionDef.options?.map((opt, idx) => {
            const isSelected = selected.includes(opt)
            const keyLabel = String.fromCharCode(65 + idx)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = isSelected ? selected.filter(v => v !== opt) : [...selected, opt]
                  onChange(next)
                }}
                className={
                  'flex items-center w-full px-4 py-2.5 rounded-md border-2 text-left transition-all duration-200 ' +
                  (isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')
                }
              >
                <span className={
                  'flex-shrink-0 flex items-center justify-center w-6 h-6 text-xs font-bold mr-4 border rounded-md transition-colors ' +
                  (isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground')
                }>
                  {keyLabel}
                </span>
                <span className="text-sm">{opt}</span>
                {isSelected && <Check size={16} className="ml-auto flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )
    }
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
    return { upstream: existing?.upstream ?? [], downstream: existing?.downstream ?? [], ...data }
  }
  return data
}

// ─── Resource step computation ────────────────────────────────────────────────

type ResourceStep =
  | { kind: 'category'; category: ResourceCategory; questions: ResourceQuestionDef[]; matchingResources: CloudResource[] }
  | { kind: 'product';  product: string;            questions: ResourceQuestionDef[]; matchingResources: CloudResource[] }
  | { kind: 'resource'; resource: CloudResource;    questions: ResourceQuestionDef[] }

function stepKey(step: ResourceStep): string {
  if (step.kind === 'category') return `category:${step.category}`
  if (step.kind === 'product') return `product:${step.product}`
  return `resource:${step.resource.resourceId}`
}

function computeResourceSteps(
  config: ResourceSurveyConfig,
  resources: CloudResource[],
  getCategoryForProduct: (product?: string) => ResourceCategory,
): ResourceStep[] {
  const sortedResources = [...resources].sort((a, b) => {
    const catA = getCategoryForProduct(a.product)
    const catB = getCategoryForProduct(b.product)
    if (catA !== catB) return catA.localeCompare(catB)
    const prodA = a.product ?? ''
    const prodB = b.product ?? ''
    if (prodA !== prodB) return prodA.localeCompare(prodB)
    return a.resourceId.localeCompare(b.resourceId)
  })
  const steps: ResourceStep[] = []

  // 1. Category-level groups → one step per group (if any project resources match)
  for (const group of config.groups.filter(g => g.level === 'category')) {
    const matching = sortedResources.filter(r => getCategoryForProduct(r.product) === group.category)
    if (matching.length === 0 || group.questions.length === 0) continue
    steps.push({ kind: 'category', category: group.category!, questions: group.questions, matchingResources: matching })
  }

  // 2. Product-level groups → one step per group
  for (const group of config.groups.filter(g => g.level === 'product')) {
    const matching = sortedResources.filter(r => r.product === group.product)
    if (matching.length === 0 || group.questions.length === 0) continue
    steps.push({ kind: 'product', product: group.product!, questions: group.questions, matchingResources: matching })
  }

  // 3. Resource-level groups → expand to one step per matching resource
  // Collect all questions per resource ID first (additive merge from multiple groups)
  const resourceQuestionsMap = new Map<string, ResourceQuestionDef[]>()
  for (const group of config.groups.filter(g => g.level === 'resource')) {
    let matchingIds: string[]
    if (group.resourceId) {
      matchingIds = sortedResources.find(r => r.resourceId === group.resourceId) ? [group.resourceId] : []
    } else if (group.product || group.products?.length) {
      matchingIds = sortedResources.filter(r =>
        (group.product && r.product === group.product) ||
        (group.products && group.products.includes(r.product))
      ).map(r => r.resourceId)
    } else if (group.category) {
      matchingIds = sortedResources.filter(r => getCategoryForProduct(r.product) === group.category).map(r => r.resourceId)
    } else {
      matchingIds = sortedResources.map(r => r.resourceId)
    }
    for (const rid of matchingIds) {
      const existing = resourceQuestionsMap.get(rid) ?? []
      resourceQuestionsMap.set(rid, [...existing, ...group.questions])
    }
  }

  // One step per resource in sorted order — deduplicate by specsKey
  for (const resource of sortedResources) {
    const questions = resourceQuestionsMap.get(resource.resourceId)
    if (!questions || questions.length === 0) continue
    const seen = new Set<string>()
    const deduped = questions.filter(q => {
      if (seen.has(q.specsKey)) return false
      seen.add(q.specsKey)
      return true
    })
    steps.push({ kind: 'resource', resource, questions: deduped })
  }

  return steps
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function SurveyModal({
  open, onClose, surveyConfig, project, onSave, onSubmitted, resourceSurveyConfig, getCategoryForProduct,
}: SurveyModalProps) {
  const { getFieldById } = useSurveyFieldDefs()
  const { settings } = useMigrationSettings()
  const platformStart = settings?.platformPeriod?.startDate
  const platformEnd = settings?.platformPeriod?.endDate
  const orderedQuestions = [...surveyConfig.questions].sort((a, b) => a.order - b.order)

  // Determine visible app questions based on conditions
  function isQuestionVisible(q: SurveyQuestion): boolean {
    if (!q.condition) return true
    const answer = answers.get(q.condition.fieldId)
    // For array values (checkbox_select), check inclusion
    if (Array.isArray(answer)) {
      return answer.includes(q.condition.value as string)
    }
    return answer === q.condition.value
  }

  const resources = project.currentInfrastructure?.resources ?? []

  // Compute resource steps (stable reference while modal is open)
  const resourceSteps: ResourceStep[] = (resourceSurveyConfig && getCategoryForProduct)
    ? computeResourceSteps(resourceSurveyConfig, resources, getCategoryForProduct)
    : []

  // Survey structure: Welcome (0) -> App Questions -> Transition -> Resource Steps
  const welcomeSlideIndex = 0
  const appQuestionsStartIndex = 1

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, AnswerValue>>(new Map())
  // Attachment answers: fieldId → attachmentIds (for long_text_with_upload and file_upload)
  const [attachmentAnswers, setAttachmentAnswers] = useState<Map<string, string[]>>(new Map())
  // Track attachment IDs removed during the survey session (deferred deletion)
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<Set<string>>(new Set())
  // Resource answers: stepKey → { specsKey: value }
  const [resourceAnswers, setResourceAnswers] = useState<Map<string, Record<string, ResourceAnswerValue>>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [resourceListExpanded, setResourceListExpanded] = useState(false)

  const visibleQuestions = orderedQuestions.filter(isQuestionVisible)
  const appQuestionsEndIndex = visibleQuestions.length // (inclusive, e.g. if 3 questions: 1, 2, 3)

  // Transition slide sits between app questions and resource steps
  const hasTransitionSlide = resourceSteps.length > 0
  const transitionSlideIndex = visibleQuestions.length + 1
  const totalSteps = 1 + visibleQuestions.length + (hasTransitionSlide ? 1 : 0) + resourceSteps.length

  const isWelcomeSlide = currentIndex === welcomeSlideIndex
  const isMainStep = currentIndex >= appQuestionsStartIndex && currentIndex <= appQuestionsEndIndex
  const isTransitionSlide = hasTransitionSlide && currentIndex === transitionSlideIndex
  const resourceStepIndex = currentIndex - (visibleQuestions.length + 1 + (hasTransitionSlide ? 1 : 0))
  const currentResourceStep = (!isWelcomeSlide && !isMainStep && !isTransitionSlide) ? resourceSteps[resourceStepIndex] : undefined

  // Reset + pre-fill when opened
  useEffect(() => {
    if (!open) return
    setCurrentIndex(0)
    setCompleted(false)
    setSubmitting(false)

    // Pre-fill app survey answers
    const prefilled = new Map<string, AnswerValue>()
    const prefilledAttachments = new Map<string, string[]>()
    for (const q of orderedQuestions) {
      const def = getFieldById(q.fieldId)
      if (!def) continue
      if (def.inputType === 'date_range' || def.inputType === 'migration_date_range') {
        const from = getExistingValue(project, def.sectionKey, def.fieldPath) as string | undefined
        const to = def.toFieldPath ? getExistingValue(project, def.sectionKey, def.toFieldPath) as string | undefined : undefined
        if (from !== undefined || to !== undefined) prefilled.set(q.fieldId, { from, to })
      } else if (def.inputType === 'long_text_with_upload' && def.attachmentFieldPath) {
        const existing = getExistingValue(project, def.sectionKey, def.fieldPath)
        if (existing !== undefined) prefilled.set(q.fieldId, existing)
        const existingIds = getExistingValue(project, def.sectionKey, def.attachmentFieldPath) as string[] | undefined
        if (existingIds !== undefined) prefilledAttachments.set(q.fieldId, existingIds)
      } else if (def.inputType === 'file_upload') {
        const existingIds = getExistingValue(project, def.sectionKey, def.fieldPath) as string[] | undefined
        if (existingIds !== undefined) prefilledAttachments.set(q.fieldId, existingIds)
      } else if (def.inputType === 'effort_table') {
        const existingTables = getExistingValue(project, def.sectionKey, 'tables') as EffortTable[] | undefined
        const existingMode = getExistingValue(project, def.sectionKey, 'tableMode') as 'single' | 'multiple' | undefined
        if (existingTables !== undefined || existingMode !== undefined) {
          prefilled.set(q.fieldId, { tables: existingTables ?? [], tableMode: existingMode ?? 'single' })
        }
      } else {
        const existing = getExistingValue(project, def.sectionKey, def.fieldPath)
        if (existing !== undefined) prefilled.set(q.fieldId, existing)
      }
    }
    setAnswers(prefilled)
    setAttachmentAnswers(prefilledAttachments)

    // Pre-fill resource answers from existing specs
    const prefilledResource = new Map<string, Record<string, ResourceAnswerValue>>()
    for (const step of resourceSteps) {
      const key = stepKey(step)
      const stepAnswers: Record<string, ResourceAnswerValue> = {}
      if (step.kind === 'resource') {
        const existing = step.resource.specs ?? {}
        for (const q of step.questions) {
          const val = existing[q.specsKey]
          if (val !== undefined && val !== null) stepAnswers[q.specsKey] = val as ResourceAnswerValue
          if (q.inputType === 'date_range' && q.toSpecsKey) {
            const toVal = existing[q.toSpecsKey]
            if (toVal !== undefined && toVal !== null) stepAnswers[q.toSpecsKey] = toVal as ResourceAnswerValue
          }
        }
      } else {
        // Product/category: use first matching resource's specs as best-effort pre-fill
        const firstResource = step.matchingResources[0]
        if (firstResource?.specs) {
          for (const q of step.questions) {
            const val = firstResource.specs[q.specsKey]
            if (val !== undefined && val !== null) stepAnswers[q.specsKey] = val as ResourceAnswerValue
            if (q.inputType === 'date_range' && q.toSpecsKey) {
              const toVal = firstResource.specs[q.toSpecsKey]
              if (toVal !== undefined && toVal !== null) stepAnswers[q.toSpecsKey] = toVal as ResourceAnswerValue
            }
          }
        }
      }
      if (Object.keys(stepAnswers).length > 0) prefilledResource.set(key, stepAnswers)
    }
    setResourceAnswers(prefilledResource)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Collapse resource list whenever the step changes
  useEffect(() => { setResourceListExpanded(false) }, [currentIndex])

  // ─── App question state ─────────────────────────────────────────────────────

  const currentQuestion = isMainStep ? visibleQuestions[currentIndex - 1] : undefined
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.fieldId) : undefined
  const isAppAnswered = currentAnswer !== undefined && currentAnswer !== '' &&
    !(Array.isArray(currentAnswer) && currentAnswer.length === 0)

  const appCanAdvance = (() => {
    if (!currentQuestion?.required) return true
    if (currentQuestion.fieldId === 'effort__table') {
      const tableValue = currentAnswer as { tables?: EffortTable[] } | undefined
      const tables = tableValue?.tables
      if (!tables || tables.length === 0) return false
      return tables.some(t => t.tasks.some(task => task.effort !== undefined && task.effort > 0))
    }
    const def = currentQuestion ? getFieldById(currentQuestion.fieldId) : undefined
    if (def?.inputType === 'date_range' || def?.inputType === 'migration_date_range') {
      const range = currentAnswer as DateRangeValue | undefined
      const hasBoth = !!range?.from && !!range?.to
      if (!hasBoth) return false
      if (def.inputType === 'migration_date_range' && platformStart && platformEnd) {
        return !isBefore(new Date(range.from), new Date(platformStart)) &&
          !isAfter(new Date(range.to), new Date(platformEnd))
      }
      return true
    }
    return isAppAnswered
  })()

  // ─── Resource step state ────────────────────────────────────────────────────

  const currentResourceStepAnswers = currentResourceStep
    ? (resourceAnswers.get(stepKey(currentResourceStep)) ?? {})
    : {}

  const resourceStepCanAdvance = currentResourceStep
    ? currentResourceStep.questions.every(q => {
        if (!q.required) return true
        if (q.condition && currentResourceStepAnswers[q.condition.specsKey] !== q.condition.value) return true
        if (q.inputType === 'date_range' && q.toSpecsKey) {
          const from = currentResourceStepAnswers[q.specsKey]
          const to = currentResourceStepAnswers[q.toSpecsKey]
          return from !== undefined && from !== '' && to !== undefined && to !== ''
        }
        const val = currentResourceStepAnswers[q.specsKey]
        return val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0)
      })
    : true

  const canAdvance = isWelcomeSlide ? true : (isMainStep ? appCanAdvance : isTransitionSlide ? true : resourceStepCanAdvance)
  const isLast = currentIndex === totalSteps - 1

  // ─── Answer setters ─────────────────────────────────────────────────────────

  const setAnswer = (value: AnswerValue) => {
    if (!currentQuestion) return
    setAnswers(prev => {
      const next = new Map(prev)
      const def = getFieldById(currentQuestion.fieldId)
      const isDependencyList = def?.inputType === 'dependency_list'
      const isDateRange = def?.inputType === 'date_range' || def?.inputType === 'migration_date_range'
      if (isDateRange) {
        const range = value as DateRangeValue | undefined
        if (!range?.from && !range?.to) next.delete(currentQuestion.fieldId)
        else next.set(currentQuestion.fieldId, value)
      } else if (value === undefined || value === '' || (!isDependencyList && Array.isArray(value) && value.length === 0)) {
        next.delete(currentQuestion.fieldId)
      } else {
        next.set(currentQuestion.fieldId, value)
      }
      // Clear answers of dependent questions whose condition is no longer met
      for (const q of orderedQuestions) {
        if (!q.condition || q.condition.fieldId !== currentQuestion.fieldId) continue
        const condValue = next.get(currentQuestion.fieldId)
        const condMet = Array.isArray(condValue)
          ? condValue.includes(q.condition.value as string)
          : condValue === q.condition.value
        if (!condMet) {
          next.delete(q.fieldId)
        }
      }
      return next
    })
  }

  const setResourceAnswer = (specsKey: string, value: ResourceAnswerValue) => {
    if (!currentResourceStep) return
    const key = stepKey(currentResourceStep)
    setResourceAnswers(prev => {
      const next = new Map(prev)
      const existing = next.get(key) ?? {}
      if (value === undefined || value === '') {
        const updated = { ...existing }
        delete updated[specsKey]
        if (Object.keys(updated).length === 0) next.delete(key)
        else next.set(key, updated)
      } else {
        next.set(key, { ...existing, [specsKey]: value })
      }
      return next
    })
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      // Save app survey answers → project sections
      const sectionUpdates = new Map<keyof Project, Record<string, unknown>>()
      for (const [fieldId, value] of answers.entries()) {
        const def = getFieldById(fieldId)
        if (!def) continue
        // Skip answers for questions that are currently hidden by condition
        const question = orderedQuestions.find(q => q.fieldId === fieldId)
        if (question && question.condition) {
          const condAnswer = answers.get(question.condition.fieldId)
          const condMet = Array.isArray(condAnswer)
            ? condAnswer.includes(question.condition.value as string)
            : condAnswer === question.condition.value
          if (!condMet) continue
        }
        const sectionKey = def.sectionKey
        const existing = (project[sectionKey] ?? {}) as unknown as Record<string, unknown>
        let current = sectionUpdates.get(sectionKey) ?? { ...existing }
        if ((def.inputType === 'date_range' || def.inputType === 'migration_date_range') && def.toFieldPath) {
          const range = value as DateRangeValue
          current = deepSet(current, def.fieldPath, range.from)
          current = deepSet(current, def.toFieldPath, range.to)
        } else if (def.inputType === 'effort_table') {
          const tableValue = value as { tables: EffortTable[]; tableMode: 'single' | 'multiple' }
          current = deepSet(current, 'tables', tableValue.tables)
          current = deepSet(current, 'tableMode', tableValue.tableMode)
          // Auto-calculate effortEstimate as total cost
          const totalCost = tableValue.tables.reduce(
            (sum, t) => sum + t.tasks.reduce((s, task) => s + (task.effort ?? 0) * (task.effortTime ?? 0) * (task.rate ?? 0), 0),
            0
          )
          current = deepSet(current, 'effortEstimate', totalCost > 0 ? String(totalCost) : undefined)
        } else {
          current = deepSet(current, def.fieldPath, value)
        }
        sectionUpdates.set(sectionKey, current)
      }
      // Merge attachment answers into section updates
      for (const [fieldId, attachmentIds] of attachmentAnswers.entries()) {
        const def = getFieldById(fieldId)
        if (!def) continue
        const sectionKey = def.sectionKey
        const targetPath = def.attachmentFieldPath ?? def.fieldPath
        const existing = (project[sectionKey] ?? {}) as unknown as Record<string, unknown>
        let current = sectionUpdates.get(sectionKey) ?? { ...existing }
        current = deepSet(current, targetPath, attachmentIds)
        sectionUpdates.set(sectionKey, current)
      }

      // Clear hidden conditional fields from section data
      for (const q of orderedQuestions) {
        if (!q.condition) continue
        const condAnswer = answers.get(q.condition.fieldId)
        const condMet = Array.isArray(condAnswer)
          ? condAnswer.includes(q.condition.value as string)
          : condAnswer === q.condition.value
        if (condMet) continue
        const def = getFieldById(q.fieldId)
        if (!def) continue
        const sectionKey = def.sectionKey
        const existing = (project[sectionKey] ?? {}) as unknown as Record<string, unknown>
        let current = sectionUpdates.get(sectionKey) ?? { ...existing }
        current = deepSet(current, def.fieldPath, undefined)
        sectionUpdates.set(sectionKey, current)
      }

      for (const [sectionKey, merged] of sectionUpdates.entries()) {
        const safeMerged = ensureRequiredArrayFields(sectionKey, merged, project)
        await onSave(sectionKey, safeMerged as unknown as Project[typeof sectionKey])
      }

      // Delete attachments that were removed during the survey
      for (const id of removedAttachmentIds) {
        try { await deleteAttachment(project.id, id) } catch { /* ignore */ }
      }

      // Save resource survey answers → resource.specs
      if (resourceAnswers.size > 0) {
        const specsUpdates: { resourceId: string; specs: Record<string, unknown> }[] = []
        for (const [key, answers] of resourceAnswers.entries()) {
          if (Object.keys(answers).length === 0) continue
          if (key.startsWith('category:')) {
            const cat = key.slice('category:'.length) as ResourceCategory
            const matching = resources.filter(r => getCategoryForProduct?.(r.product) === cat)
            matching.forEach(r => specsUpdates.push({ resourceId: r.resourceId, specs: answers as Record<string, unknown> }))
          } else if (key.startsWith('product:')) {
            const prod = key.slice('product:'.length)
            const matching = resources.filter(r => r.product === prod)
            matching.forEach(r => specsUpdates.push({ resourceId: r.resourceId, specs: answers as Record<string, unknown> }))
          } else if (key.startsWith('resource:')) {
            const rid = key.slice('resource:'.length)
            specsUpdates.push({ resourceId: rid, specs: answers as Record<string, unknown> })
          }
        }

        if (specsUpdates.length > 0) {
          // Merge updates per resourceId (multiple steps may contribute different keys)
          const mergedSpecs = new Map<string, Record<string, unknown>>()
          for (const { resourceId, specs } of specsUpdates) {
            mergedSpecs.set(resourceId, { ...(mergedSpecs.get(resourceId) ?? {}), ...specs })
          }
          // Route through onSave so saveSection → classifyResourceEvents → audit log fires
          const updatedResources = resources.map(r => {
            const patch = mergedSpecs.get(r.resourceId)
            return patch ? { ...r, specs: { ...(r.specs ?? {}), ...patch } } : r
          })
          await onSave('currentInfrastructure', {
            ...(project.currentInfrastructure ?? {}),
            resources: updatedResources,
          } as Project['currentInfrastructure'])
        }
      }

      await submitSurvey(project.id)
      await onSubmitted?.()
      setCompleted(true)
    } finally {
      setSubmitting(false)
    }
  }, [answers, attachmentAnswers, removedAttachmentIds, resourceAnswers, project, onSave, resources, getCategoryForProduct, onSubmitted, getFieldById])

  const goNext = useCallback(() => {
    if (isLast) void handleSubmit()
    else setCurrentIndex(i => i + 1)
  }, [isLast, handleSubmit])

  const goBack = () => setCurrentIndex(i => Math.max(0, i - 1))

  const skip = () => {
    if (isLast) void handleSubmit()
    else setCurrentIndex(i => i + 1)
  }

  // Keyboard: Enter to advance (only on app question steps and transition slide)
  useEffect(() => {
    if (!open || completed || submitting || (!isWelcomeSlide && !isMainStep && !isTransitionSlide)) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'TEXTAREA') return
        if ((e.target as HTMLElement).dataset.tagInput) return
        if ((e.target as HTMLElement).dataset.depInput) return
        if ((e.target as HTMLElement).dataset.surveyFileInput) return
        e.preventDefault()
        if (canAdvance) goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, completed, submitting, canAdvance, goNext, isMainStep])

  if (!open) return null

  const progress = totalSteps > 0
    ? Math.round(((currentIndex + (completed ? 1 : 0)) / totalSteps) * 100)
    : 100

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
          <span className="font-semibold text-sm">{project.name} — Survey</span>
        </div>
        <div className="flex items-center gap-4">
          {!completed && !isWelcomeSlide && !isTransitionSlide && (
            <span className="text-sm text-muted-foreground">
              {currentIndex} / {totalSteps - 1}
            </span>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={cn('min-h-full flex flex-col items-center justify-center w-full transition-all duration-500 mx-auto', isWelcomeSlide ? 'max-w-5xl' : 'max-w-4xl')}
        >

          {completed ? (
            /* Completion screen */
            <div className="text-center space-y-4">
              <CheckCircle2 size={56} className="text-primary mx-auto" />
              <h2 className="text-2xl font-semibold">Survey complete!</h2>
              <p className="text-muted-foreground">
                Your answers have been saved to the project record. You can always update them by
                editing the individual sections or running the survey again.
              </p>
              <Button onClick={onClose} size="lg" className="mt-4 px-10">Close</Button>
            </div>

          ) : isWelcomeSlide ? (
            /* Welcome Slide */
            <div className="text-center space-y-10 animate-in fade-in zoom-in duration-500">
              <div className="space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mx-auto transition-transform hover:scale-105 duration-300">
                  <ClipboardList size={40} className="text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl font-bold tracking-tight">
                    Ready to migrate <span className="text-primary">{project.name}</span>?
                  </h2>
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                    This survey helps us understand your application's architecture and requirements to create a seamless migration path.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
                <div className="p-5 rounded-2xl bg-muted/50 border border-border/50 space-y-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">1</div>
                  <h3 className="font-semibold">App Architecture</h3>
                  <p className="text-xs text-muted-foreground">Versions, platform details, and business criticality.</p>
                </div>
                <div className="p-5 rounded-2xl bg-muted/50 border border-border/50 space-y-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">2</div>
                  <h3 className="font-semibold">Dependencies</h3>
                  <p className="text-xs text-muted-foreground">Upstream/downstream systems and integrations.</p>
                </div>
                <div className="p-5 rounded-2xl bg-muted/50 border border-border/50 space-y-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">3</div>
                  <h3 className="font-semibold">Infrastructure</h3>
                  <p className="text-xs text-muted-foreground">Specific configuration for your cloud resources.</p>
                </div>
              </div>

              <div className="pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-sm font-medium text-primary border border-primary/10">
                  <CalendarIcon size={14} />
                  Estimated time: ~5-10 minutes
                </div>
              </div>
            </div>

          ) : currentQuestion ? (
            /* App question screen */
            <div className="space-y-8">
              {(() => {
                const def = getFieldById(currentQuestion.fieldId)
                if (!def) return null
                return (
                  <span className="inline-flex items-center text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    {def.sectionLabel}
                  </span>
                )
              })()}
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold leading-snug">
                  {currentQuestion.questionText}
                  {currentQuestion.required && <span className="text-destructive ml-1 text-sm align-super">*</span>}
                </h2>
                {currentQuestion.hintText && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{currentQuestion.hintText}</p>
                )}
              </div>
              <QuestionInput
                question={currentQuestion}
                value={currentAnswer}
                onChange={setAnswer}
                attachmentValue={currentQuestion ? attachmentAnswers.get(currentQuestion.fieldId) : undefined}
                onAttachmentChange={(ids) => {
                  if (!currentQuestion) return
                  setAttachmentAnswers(prev => {
                    const next = new Map(prev)
                    if (ids.length === 0) next.delete(currentQuestion.fieldId)
                    else next.set(currentQuestion.fieldId, ids)
                    return next
                  })
                }}
                onRemove={(id) => setRemovedAttachmentIds(prev => new Set(prev).add(id))}
                autoFocus
                getFieldById={getFieldById}
                projectId={project.id}
                project={project}
              />
            </div>

          ) : isTransitionSlide ? (
            /* Transition slide — shown once between app questions and resource steps */
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
                <Server size={32} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Cloud Resource Questions</h2>
                <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
                  You've completed the application survey. We now have a few questions
                  about your specific cloud resources.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm text-muted-foreground">
                <Server size={13} />
                {(() => {
                  const uniqueResources = new Set(resourceSteps.flatMap(s =>
                    s.kind === 'resource' ? [s.resource.resourceId] : s.matchingResources.map(r => r.resourceId)
                  ))
                  return `${uniqueResources.size} resource${uniqueResources.size !== 1 ? 's' : ''} · ${resourceSteps.length} step${resourceSteps.length !== 1 ? 's' : ''}`
                })()}
              </div>
            </div>

          ) : currentResourceStep ? (
            /* Resource step screen */
            <div className="space-y-8">
              {/* Resource step badge */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  <Server size={11} />
                  {currentResourceStep.kind === 'resource'
                    ? 'Resource Questions'
                    : currentResourceStep.kind === 'product'
                    ? `Product: ${currentResourceStep.product}`
                    : `Category: ${currentResourceStep.category}`}
                </span>
                {currentResourceStep.kind !== 'resource' && (
                  <span className="text-xs text-muted-foreground">
                    Applies to {currentResourceStep.matchingResources.length} resource{currentResourceStep.matchingResources.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Collapsible affected resources panel (category/product steps only) */}
              {currentResourceStep.kind !== 'resource' && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setResourceListExpanded(v => !v)}
                  >
                    <span>Affected resources ({currentResourceStep.matchingResources.length})</span>
                    {resourceListExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {resourceListExpanded && (
                    <div className="divide-y divide-border">
                      {currentResourceStep.matchingResources.map(r => {
                        const specEntries = Object.entries(r.specs ?? {}).slice(0, 5)
                        return (
                          <div key={r.resourceId} className="px-3 py-2 flex flex-col gap-1 bg-muted/20">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium">{r.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">{r.resourceId}</span>
                            </div>
                            {specEntries.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {specEntries.map(([k, v]) => (
                                  <span key={k} className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                                    <span className="text-muted-foreground">{k}:</span>
                                    <span>{String(v)}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">no specs</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Resource name for resource-level steps */}
              {currentResourceStep.kind === 'resource' && (
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold leading-snug">
                    {currentResourceStep.resource.name}
                  </h2>
                  {currentResourceStep.resource.product && (
                    <p className="text-sm text-muted-foreground">
                      {currentResourceStep.resource.product.toUpperCase()} · {currentResourceStep.resource.resourceId}
                    </p>
                  )}
                </div>
              )}

              {/* Questions for this step */}
              <div className="space-y-8">
                {currentResourceStep.questions.filter(q =>
                  !q.condition || currentResourceStepAnswers[q.condition.specsKey] === q.condition.value
                ).map(q => (
                  <div key={q.id} className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold leading-snug">
                        {q.label}
                        {q.required && <span className="text-destructive ml-1 text-sm align-super">*</span>}
                      </p>
                      {q.hintText && <p className="text-sm text-muted-foreground">{q.hintText}</p>}
                    </div>
                    {q.inputType === 'date_range' && q.toSpecsKey ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-12">
                            <CalendarIcon size={16} className="mr-2 shrink-0" />
                            {(() => {
                              const from = currentResourceStepAnswers[q.specsKey] as string | undefined
                              const to = currentResourceStepAnswers[q.toSpecsKey] as string | undefined
                              if (from && to) return `${format(new Date(from), 'MMM d, y')} → ${format(new Date(to), 'MMM d, y')}`
                              if (from) return `From ${format(new Date(from), 'MMM d, y')}`
                              return <span className="text-muted-foreground">Pick a date range…</span>
                            })()}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[400]" align="start">
                          <Calendar
                            mode="range"
                            numberOfMonths={2}
                            defaultMonth={(() => {
                              const from = currentResourceStepAnswers[q.specsKey] as string | undefined
                              return from ? new Date(from) : undefined
                            })()}
                            selected={(() => {
                              const from = currentResourceStepAnswers[q.specsKey] as string | undefined
                              const to = currentResourceStepAnswers[q.toSpecsKey] as string | undefined
                              return { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }
                            })()}
                            onSelect={(r) => {
                              setResourceAnswer(q.specsKey, r?.from ? format(r.from, 'yyyy-MM-dd') : undefined)
                              setResourceAnswer(q.toSpecsKey, r?.to ? format(r.to, 'yyyy-MM-dd') : undefined)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <ResourceQuestionInput
                        questionDef={q}
                        value={currentResourceStepAnswers[q.specsKey] as ResourceAnswerValue}
                        onChange={(v) => setResourceAnswer(q.specsKey, v)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

        </div>
      </div>

      {/* Footer navigation */}
      {!completed && (
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
          <Button variant="ghost" onClick={goBack} disabled={currentIndex === 0} className="gap-1.5">
            <ChevronLeft size={16} /> Back
          </Button>

          <div className="flex items-center gap-2">
            {/* Skip button: only for optional app questions */}
            {isMainStep && currentQuestion && !currentQuestion.required && (
              <Button variant="ghost" onClick={skip} className="text-muted-foreground text-sm">
                Skip
              </Button>
            )}
            <Button onClick={goNext} disabled={!canAdvance || submitting} className="gap-1.5 min-w-[120px] transition-all duration-300">
              {submitting ? 'Saving…' : isLast ? 'Submit' : isWelcomeSlide ? <>Start Survey <ChevronRight size={16} /></> : <>Next <ChevronRight size={16} /></>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
