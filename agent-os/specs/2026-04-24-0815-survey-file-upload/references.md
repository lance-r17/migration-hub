# References for Survey File Upload

## Similar Implementations

### 1. Survey Answer Flow
- **Location:** `frontend/src/components/survey/SurveyModal.tsx`
- **Relevance:** `handleSubmit` groups answers by `sectionKey`, merges with existing data via `deepSet`, and saves via `onSave`.
- **Key patterns:** `answers: Map<string, AnswerValue>`, `sectionUpdates: Map<keyof Project, Record<string, unknown>>`, `deepSet` for nested field paths.

### 2. QuestionInput Renderer
- **Location:** `frontend/src/components/survey/SurveyModal.tsx` (`QuestionInput` function)
- **Relevance:** Switches on `def.inputType` to render appropriate controls (short_text, long_text, select, boolean, etc.).
- **Key patterns:** Add new cases for `long_text_with_upload` and `file_upload`.

### 3. Attachment Upload Service
- **Location:** `frontend/src/services/attachments.ts`
- **Relevance:** Already built for the Migration Effort Estimation section. Reused here.
- **Key patterns:** `uploadAttachment(projectId, file)` via multipart POST, `getAttachments`, `deleteAttachment`.

### 4. Survey Field Definitions
- **Location:** `frontend/src/data/surveyFields.ts` and `backend/app/data/survey_field_defs.py`
- **Relevance:** Static definitions mapping survey questions to project section fields.
- **Key patterns:** `id`, `sectionKey`, `fieldPath`, `inputType`, `defaultQuestion`, `defaultHint` must match exactly.
