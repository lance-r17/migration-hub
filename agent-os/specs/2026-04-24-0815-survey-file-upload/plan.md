# Plan: Survey File Upload for Migration Effort Estimation Notes

## Overview

Enhance the survey functionality so that the **Migration Effort Estimation Notes** field supports inline file upload (e.g. vendor quotes) directly within the survey modal. When a user is answering the `effort__notes` question, a file upload area appears below the textarea. Uploaded files are stored as project attachments and their IDs are saved into `migrationEffortEstimation.attachmentIds` alongside the notes text.

User explicitly chose: **inline with notes textarea** (not a separate survey question).

Additionally, the user wants a **general-purpose reusable approach**: a new `long_text_with_upload` input type that any long-text survey question can use to offer inline file attachments.

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-04-24-0815-survey-file-upload/` with:

- **plan.md** — This full plan
- **shape.md** — Shaping notes
- **standards.md** — Relevant standards
- **references.md** — Pointers to reference implementations
- **visuals/** — Empty (no mockups provided)

---

## Task 2: Extend Survey Type System

**Goal:** Add two new survey input types and the supporting field definition property.

**Files to modify:**

1. **`frontend/src/types/survey.ts`**
   - Update `SurveyInputType`:
     ```typescript
     export type SurveyInputType = 'short_text' | 'long_text' | 'long_text_with_upload' | 'select' | 'boolean' | 'string_array' | 'migration_window' | 'dependency_list' | 'date' | 'date_range' | 'checkbox_select' | 'file_upload'
     ```
   - Add to `SurveyFieldDef`:
     ```typescript
     attachmentFieldPath?: string  // dot-path within section where attachment IDs are stored (used by long_text_with_upload)
     ```

2. **`backend/app/data/survey_field_defs.py`**
   - Update `effort__notes` to use the new type:
     ```python
     {"id": "effort__notes", "sectionKey": "migrationEffortEstimation", "fieldPath": "notes", "label": "Notes (Breakdown & Rationale)", "sectionLabel": "Migration Effort Estimation", "inputType": "long_text_with_upload", "attachmentFieldPath": "attachmentIds", "defaultQuestion": "Provide a breakdown and rationale for the effort estimate.", "defaultHint": "Include scope, key assumptions, exclusions, risks and any vendor quotes."},
     ```
   - Also add a standalone `file_upload` field for future use:
     ```python
     {"id": "effort__attachments", "sectionKey": "migrationEffortEstimation", "fieldPath": "attachmentIds", "label": "Attachments", "sectionLabel": "Migration Effort Estimation", "inputType": "file_upload", "defaultQuestion": "Upload any supporting documents (e.g. vendor quotes).", "defaultHint": "You can upload multiple files."},
     ```

3. **`frontend/src/data/surveyFields.ts`**
   - Update `effort__notes` to match backend:
     ```typescript
     {
       id: 'effort__notes',
       sectionKey: 'migrationEffortEstimation',
       fieldPath: 'notes',
       attachmentFieldPath: 'attachmentIds',
       label: 'Notes (Breakdown & Rationale)',
       sectionLabel: 'Migration Effort Estimation',
       inputType: 'long_text_with_upload',
       defaultQuestion: 'Provide a breakdown and rationale for the effort estimate.',
       defaultHint: 'Include scope, key assumptions, exclusions, risks and any vendor quotes.',
     }
     ```
   - Add standalone `file_upload` field:
     ```typescript
     {
       id: 'effort__attachments',
       sectionKey: 'migrationEffortEstimation',
       fieldPath: 'attachmentIds',
       label: 'Attachments',
       sectionLabel: 'Migration Effort Estimation',
       inputType: 'file_upload',
       defaultQuestion: 'Upload any supporting documents (e.g. vendor quotes).',
       defaultHint: 'You can upload multiple files.',
     }
     ```

---

## Task 3: Create `SurveyFileUpload` Component

**Goal:** Build a reusable file upload widget for the survey context.

**New file:**

1. **`frontend/src/components/survey/SurveyFileUpload.tsx`**
   - Props:
     ```typescript
     interface Props {
       projectId: string
       value: string[]            // attachment IDs
       onChange: (ids: string[]) => void
     }
     ```
   - Features:
     - Upload files immediately via `uploadAttachment(projectId, file)`
     - Show upload spinner state
     - List uploaded files with filename and delete button
     - Download links via `/api/v1/projects/{projectId}/attachments/{id}`
   - Visual style: matches survey aesthetic (minimal, clean list below input)

---

## Task 4: Update `QuestionInput` for New Types

**Goal:** Teach `QuestionInput` how to render `long_text_with_upload` and `file_upload`.

**File to modify:**

1. **`frontend/src/components/survey/SurveyModal.tsx`** — Modify `QuestionInput`:
   - Add `projectId` prop:
     ```typescript
     function QuestionInput({
       question, value, onChange, onAttachmentChange, autoFocus, getFieldById, projectId,
     }: {
       question: SurveyQuestion
       value: AnswerValue
       onChange: (v: AnswerValue) => void
       onAttachmentChange?: (ids: string[]) => void  // NEW
       autoFocus?: boolean
       getFieldById: (id: string) => SurveyFieldDef | undefined
       projectId: string  // NEW
     })
     ```
   - Add `long_text_with_upload` case:
     ```tsx
     case 'long_text_with_upload': {
       const def = getFieldById(question.fieldId)
       return (
         <div className="space-y-4">
           <textarea
             value={(value as string) ?? ''}
             onChange={(e) => onChange(e.target.value)}
             placeholder="Type your answer…"
             rows={4}
             className={textareaClass}
             autoFocus={autoFocus}
           />
           <SurveyFileUpload
             projectId={projectId}
             value={/* attachment IDs passed from parent */}
             onChange={onAttachmentChange ?? (() => {})}
           />
         </div>
       )
     }
     ```
   - Add `file_upload` case:
     ```tsx
     case 'file_upload':
       return (
         <SurveyFileUpload
           projectId={projectId}
           value={(value as string[]) ?? []}
           onChange={onChange as (v: string[]) => void}
         />
       )
     ```

---

## Task 5: Update `SurveyModal` State & Submit Logic

**Goal:** Track attachment answers separately and merge them into section updates on submit.

**File to modify:**

1. **`frontend/src/components/survey/SurveyModal.tsx`**

   a. **New state for attachment answers:**
      ```typescript
      const [attachmentAnswers, setAttachmentAnswers] = useState<Map<string, string[]>>(new Map())
      ```

   b. **Pre-fill attachments on open:** In the `useEffect` that pre-fills answers, also check for `long_text_with_upload` fields and pre-fill their attachment answers:
      ```typescript
      if (def.inputType === 'long_text_with_upload' && def.attachmentFieldPath) {
        const existingIds = getExistingValue(project, def.sectionKey, def.attachmentFieldPath) as string[] | undefined
        if (existingIds !== undefined) prefilledAttachments.set(question.fieldId, existingIds)
      }
      if (def.inputType === 'file_upload') {
        const existingIds = getExistingValue(project, def.sectionKey, def.fieldPath) as string[] | undefined
        if (existingIds !== undefined) prefilledAttachments.set(question.fieldId, existingIds)
      }
      ```

   c. **Pass attachment state to `QuestionInput`:**
      ```tsx
      <QuestionInput
        question={currentQuestion}
        value={currentAnswer}
        onChange={setAnswer}
        onAttachmentChange={(ids) => {
          if (!currentQuestion) return
          setAttachmentAnswers(prev => {
            const next = new Map(prev)
            if (ids.length === 0) next.delete(currentQuestion.fieldId)
            else next.set(currentQuestion.fieldId, ids)
            return next
          })
        }}
        autoFocus
        getFieldById={getFieldById}
        projectId={project.id}
      />
      ```

   d. **Merge attachments into `handleSubmit`:** After building `sectionUpdates` from regular answers, iterate over `attachmentAnswers` and merge attachment IDs into the same sections:
      ```typescript
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
      ```

   e. **Keyboard handler exclusion:** Add check to prevent Enter-to-advance when file input is focused:
      ```typescript
      if ((e.target as HTMLElement).dataset.surveyFileInput) return
      ```

---

## Task 6: Update `use-projects` Hook Audit Labels

**Goal:** Ensure the audit log captures attachment changes with proper labels.

**File to modify:**

1. **`frontend/src/hooks/use-projects.ts`**
   - Verify `attachmentIds: 'Attachments'` exists under `migrationEffortEstimation` in `FIELD_LABEL_MAPS` (added in previous task).

---

## Task 7: Testing & Verification

**Backend:**
- `GET /api/v1/settings/survey/field-defs` returns updated `effort__notes` (now `long_text_with_upload`) and `effort__attachments` (`file_upload`)

**Frontend:**
- `npm run build` compiles without errors in modified files
- Survey modal renders textarea + file upload inline for `effort__notes`
- Files upload immediately and display with delete option
- On survey submit, both notes text and attachment IDs save to `migrationEffortEstimation`
- Re-opening the survey pre-fills existing text and attachments
- Standalone `file_upload` questions (if configured) also work correctly
