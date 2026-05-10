# Draft Survey Feature — Implementation Summary

## What was built
A persistent "draft survey" feature that lets users save their survey progress incrementally, resume exactly where they left off after refreshing or closing the browser, and cleans up automatically on successful submission.

## Key decisions enforced
- **Isolation**: Draft data lives in a dedicated `survey_drafts` table and never overwrites live project sections.
- **Pending attachments**: Files uploaded during a draft remain in `pending` status until the survey is submitted.
- **Dual persistence**: Backend draft + localStorage fallback; both cleared on submit.
- **Per-user isolation**: `(user_id, project_id)` unique constraint guarantees independent drafts per user.

## Files changed

### Backend
| File | Change |
|------|--------|
| `backend/alembic/versions/0021_add_survey_drafts.py` | Migration creating `survey_drafts` table with FK to `projects` and unique `(user_id, project_id)` |
| `backend/app/models/survey_draft.py` | New `SurveyDraft` SQLAlchemy model (JSONB payload + updated_at) |
| `backend/app/models/__init__.py` | Exports `SurveyDraft` for Alembic metadata discovery |
| `backend/app/schemas/survey.py` | Adds `SurveyDraftPayload`, `SurveyDraftSave`, `SurveyDraftOut` |
| `backend/app/schemas/__init__.py` | Exports new draft schemas |
| `backend/app/services/project_service.py` | Adds `get_survey_draft`, `save_survey_draft`, `delete_survey_draft` (all scoped by `user_id`) |
| `backend/app/routers/projects.py` | Adds `GET /{id}/survey-draft`, `PUT /{id}/survey-draft`, `DELETE /{id}/survey-draft`; `user_id` always taken from `current_user` |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/services/projects.ts` | Adds `getSurveyDraft`, `saveSurveyDraft`, `deleteSurveyDraft` API wrappers |
| `frontend/src/hooks/use-survey-draft.ts` | New hook handling: backend/localStorage load, debounced save (1.5s), `fetch(keepalive)` on page hide, draft cleanup |
| `frontend/src/components/survey/SurveyModal.tsx` | Integrates draft restore on open (with toast), auto-save on state changes, immediate save on navigation, cleanup on submit |

## Save strategy (bandwidth optimized)
1. **Debounced auto-save**: 1.5s after the user stops changing answers → `PUT` to backend + localStorage update.
2. **Navigation save**: Explicit save on **Next** and **Back** buttons → `PUT` + localStorage.
3. **Page-lifecycle save**: On `visibilitychange` → `fetch(..., { keepalive: true })` to the backend.

## Resume flow
When the user clicks **Fill Survey** and `SurveyModal` opens:
1. The modal pre-fills answers from existing project sections (today’s behavior).
2. If a backend or localStorage draft exists, it overlays the draft state (answers, attachments, removed attachments, resource answers, current index).
3. `currentIndex` is clamped to the valid range based on the restored answers.
4. A toast appears: *"Your previous survey progress has been restored."*

## Cleanup
After `handleSubmit` succeeds and `submitSurvey(project.id)` returns:
1. `clearDraft()` is called, which deletes the backend record and removes localStorage.
2. The modal shows the completion screen as before.

## Verification
- `tsc --noEmit` passes with no survey/draft-related errors.
- Backend `create_app()` starts cleanly.
- Alembic migration `0021` applied successfully and is at `head`.
- Existing e2e tests have no survey-related regressions.
