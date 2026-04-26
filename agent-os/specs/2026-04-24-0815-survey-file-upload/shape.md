# Survey File Upload — Shaping Notes

## Scope

Add inline file upload capability to the survey for the **Migration Effort Estimation Notes** field. When users fill in the notes textarea during the survey, they can also upload supporting documents (e.g. vendor quotes) directly in the same step.

Additionally, make this capability **general-purpose** via a new `long_text_with_upload` survey input type so any long-text field can support inline attachments in the future.

## Decisions

- **`long_text_with_upload` composite input type** — A single survey question that renders both a textarea and a file upload area. This is the general-purpose reusable approach the user requested.
- **`attachmentFieldPath` on `SurveyFieldDef`** — Specifies where attachment IDs are stored within the section JSONB, separate from the text value's `fieldPath`.
- **Standalone `file_upload` type also added** — For future use cases where only file upload is needed without text.
- **Immediate upload** — Files upload as soon as selected. Good UX, no batch complexity at submit time.
- **Reuses existing attachment API** — `services/attachments.ts` and backend `/projects/{id}/attachments` endpoints are reused.

## Context

- **Visuals:** None provided
- **References:**
  - `frontend/src/components/survey/SurveyModal.tsx` — survey answer flow, `QuestionInput`, `handleSubmit`
  - `frontend/src/data/surveyFields.ts` and `backend/app/data/survey_field_defs.py` — field definitions
  - `frontend/src/services/attachments.ts` — attachment upload service
- **Product alignment:** N/A

## Standards Applied

- N/A — No formal standards defined in `agent-os/standards/`.
