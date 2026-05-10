# Draft Survey Feature Plan

## Context
The current survey flow (`SurveyModal`) requires users to complete all questions in one session before any data is persisted. Only on **Submit** does the modal call `updateProject` for each section and then `submitSurvey()` to set `survey_submitted_at`. Users who refresh or close the browser lose all progress. We need a persistent draft that:
- Is isolated from live project data until submission
- Supports one draft per user per project
- Cleans up on successful submit
- Resumes to the exact last-answered question
- Minimizes bandwidth and API calls

## Decisions (from user feedback)
1. **Isolation is mandatory** — draft lives in a separate table, never overwrites live project sections.
2. **Attachments stay pending** — uploaded files remain `pending` until submit; the existing `confirm_attachments` flow handles them on submit.
3. **Dual persistence** — backend draft + localStorage fallback; both cleared on submit.
4. **Independent drafts** — `(user_id, project_id)` is unique; no cross-user collision.

## Approach

### 1. Backend Data Model
Create `survey_drafts` table:
- `id` (PK, String)
- `user_id` (String, FK to `users.id` implied)
- `project_id` (String, FK to `projects.id`, ondelete=CASCADE)
- `payload` (JSONB) — stores entire draft state
- `updated_at` (DateTime timezone)
- Unique constraint on `(user_id, project_id)`

The `payload` JSONB shape mirrors the frontend state:
```json
{
  "currentIndex": 5,
  "answers": { "fieldId": "value", ... },
  "attachmentAnswers": { "fieldId": ["att-id", ...], ... },
  "removedAttachmentIds": ["att-id", ...],
  "resourceAnswers": { "stepKey": { "specsKey": "value", ... }, ... }
}
```
Using a single JSONB payload avoids schema churn when survey questions change.

### 2. Save Strategy (Bandwidth Optimized)
To balance consistency and network traffic:
- **Debounced auto-save**: 1.5s after the user stops typing/changing an answer → `PUT` to backend + update localStorage.
- **Navigation save**: Explicit save on **Next** and **Back** buttons → `PUT` + localStorage (guarantees progress is captured even if the user rapidly clicks through).
- **Page-lifecycle save**: On `beforeunload` / `pagehide`, use `fetch(..., { keepalive: true })` to fire a final `PUT` to the backend (synchronous enough for unload, works with PUT unlike `sendBeacon`).
- **localStorage key**: `survey-draft:{userId}:{projectId}` — includes user ID to prevent cross-user leakage on shared machines.

This hybrid means at most one API call per 1.5s of idle typing, plus one per navigation step, plus one on page close — very low bandwidth.

### 3. Resume / Hydration Flow
Draft resume is triggered only when the user explicitly opens the survey by clicking the **Fill Survey** button from the project details page (i.e., when `SurveyModal` mounts).

1. Fetch backend draft via `GET /api/v1/projects/{id}/survey-draft`.
2. Check localStorage for a local copy.
3. Use whichever copy has the later `updatedAt` timestamp.
4. If a draft exists:
   - Restore `answers`, `attachmentAnswers`, `removedAttachmentIds`, `resourceAnswers`, and `currentIndex`.
   - Clamp `currentIndex` to the valid range based on the current `surveyConfig` (in case questions were added/removed by an admin).
   - Pre-fill any missing answers from existing project data (same logic as today) so the draft merges gracefully with already-submitted section edits.
   - Show a toast notification: *"Your previous survey progress has been restored."*
5. If no draft exists, fall back to today’s pre-fill logic from project sections.

### 4. Attachment Lifecycle in Drafts
- **Upload**: `SurveyFileUpload` already calls `uploadAttachment(projectId, file)`, which creates a `ProjectAttachment` with `status = 'pending'`. This stays unchanged.
- **Remove in UI**: The attachment ID is added to `removedAttachmentIds` in the draft payload. It is **not** immediately deleted from the server (same as today’s deferred deletion).
- **On Submit**: The existing loop in `handleSubmit` calls `deleteAttachment` for each ID in `removedAttachmentIds`, and `confirm_attachments` runs automatically when sections are saved. No new attachment logic needed.
- **On Draft Cleanup (submit)**: The draft record is deleted. Pending attachments that are still referenced in `attachmentAnswers` will be confirmed by the normal section-save flow. Pending attachments in `removedAttachmentIds` are soft-deleted by the existing loop. Any other orphaned pending attachments are already cleaned up after 24h by the background monitor.

### 5. Survey Submission
After the existing `handleSubmit` succeeds and `submitSurvey(project.id)` returns:
1. Call `DELETE /api/v1/projects/{id}/survey-draft` (idempotent).
2. Remove localStorage key.
3. Reset modal state (today’s behavior).

## Files to Modify

| File | Change |
|------|--------|
| `backend/alembic/versions/0021_add_survey_drafts.py` | Create `survey_drafts` table |
| `backend/app/models/survey_draft.py` | New `SurveyDraft` SQLAlchemy model |
| `backend/app/models/__init__.py` | Export `SurveyDraft` |
| `backend/app/schemas/survey.py` | Add `SurveyDraftPayload`, `SurveyDraftOut` |
| `backend/app/routers/projects.py` | Add `GET`, `PUT`, `DELETE` endpoints for `/projects/{id}/survey-draft` |
| `backend/app/services/project_service.py` | Add `get_survey_draft`, `save_survey_draft`, `delete_survey_draft` |
| `frontend/src/services/projects.ts` | Add `getSurveyDraft`, `saveSurveyDraft`, `deleteSurveyDraft` API wrappers |
| `frontend/src/components/survey/SurveyModal.tsx` | Integrate draft load, debounced save, unload save, cleanup on submit |
| `frontend/src/hooks/use-survey-draft.ts` *(new)* | Reusable hook: `useSurveyDraft(projectId, userId)` encapsulating load/save/debounce/localStorage logic |

## Reuse
- **`backend/app/services/attachment_service.py`**: Existing `confirm_attachments` and background cleanup monitor handle pending attachment lifecycle; no changes needed.
- **`frontend/src/services/attachments.ts`**: `uploadAttachment` and `deleteAttachment` already work correctly with pending status.
- **`SurveyModal.tsx` existing pre-fill logic**: The `useEffect` that runs on `open` can be extended to hydrate from draft instead of only from project sections.
- **`backend/app/database.py`**: Standard `AsyncSessionLocal` pattern for DB access.

## Implementation Steps

- [ ] **Step 1 — Database Migration**
  - Write `0021_add_survey_drafts.py` creating the table with unique `(user_id, project_id)` constraint.
  - Run `alembic upgrade head` locally to verify.

- [ ] **Step 2 — Backend Model & Schema**
  - Create `backend/app/models/survey_draft.py` with `SurveyDraft(Base, TimestampMixin)` (or manual `updated_at`).
  - Export in `models/__init__.py`.
  - Add Pydantic schemas in `schemas/survey.py`:
    - `SurveyDraftPayload` — typed dict matching frontend state
    - `SurveyDraftSave` — input model (`payload: dict[str, Any]`)
    - `SurveyDraftOut` — response model (`id`, `user_id`, `project_id`, `payload`, `updated_at`)

- [ ] **Step 3 — Backend Service**
  - In `services/project_service.py`, add:
    - `get_survey_draft(session, user_id, project_id) -> SurveyDraft | None` — filter by both `user_id` and `project_id`
    - `save_survey_draft(session, user_id, project_id, payload) -> SurveyDraft` — upsert scoped to the given `user_id`; never overwrite another user's draft
    - `delete_survey_draft(session, user_id, project_id) -> None` — delete only if both `user_id` and `project_id` match

- [ ] **Step 4 — Backend Router**
  - In `routers/projects.py`, add three routes under the existing projects prefix:
    - `GET /{project_id}/survey-draft` → queries **only** the current user's draft for this project (`user_id == current_user.id`); returns `SurveyDraftOut | None`
    - `PUT /{project_id}/survey-draft` → upserts the current user's draft (`user_id` is taken from `current_user.id`, not the request body); returns `SurveyDraftOut`
    - `DELETE /{project_id}/survey-draft` → deletes **only** the current user's draft for this project; returns 204 No Content
  - All endpoints require `get_current_user`. The service layer must scope every query by `user_id` so users can never read or mutate another user's draft.

- [ ] **Step 5 — Frontend API Layer**
  - In `services/projects.ts`, add:
    - `getSurveyDraft(projectId)`
    - `saveSurveyDraft(projectId, payload)`
    - `deleteSurveyDraft(projectId)`

- [ ] **Step 6 — Frontend Draft Hook**
  - Create `hooks/use-survey-draft.ts`:
    - Loads draft from backend + localStorage on mount.
    - Returns `draftPayload | null`, `saveDraft(payload)` (debounced), `clearDraft()`.
    - Handles `beforeunload` / `pagehide` listener to call `fetch(..., { keepalive: true })`.
    - localStorage read/write with key `survey-draft:{userId}:{projectId}`.

- [ ] **Step 7 — SurveyModal Integration**
  - On `open`, after the existing pre-fill `useEffect`, check for a draft:
    - If draft exists and is newer than project section data, restore `answers`, `attachmentAnswers`, `removedAttachmentIds`, `resourceAnswers`, and `currentIndex` from draft.
    - Clamp `currentIndex` to `0 … totalSteps-1`.
  - Wire answer/attachment/resource-answer setters to trigger the debounced save from `useSurveyDraft`.
  - In `handleSubmit`, after `await submitSurvey(project.id)`, call `clearDraft()`.

- [ ] **Step 8 — Verification**
  - **Manual test**: Open survey, answer question 3, refresh browser → should resume at question 3 with answers intact.
  - **Manual test**: Upload attachment in draft, refresh, remove attachment, submit → attachment should be soft-deleted; no orphan pending files.
  - **Manual test**: Submit survey → draft disappears from DB and localStorage; `survey_submitted_at` is set.
  - **Network throttling test**: Simulate slow 3G; verify auto-save debounce prevents API spam.
  - **Cross-user test**: User A drafts on Project X; User B opens Project X → no draft loaded for User B.
  - **Run existing e2e tests** (`npm run test:e2e`) to ensure survey submission still works.

## Security & Privacy Notes
- **User isolation**: Every draft query is filtered by `user_id = current_user.id`. The `user_id` is never accepted from the client payload; it is always derived server-side from the authenticated session. This guarantees strict per-user isolation even if a client crafts requests with another user's ID.
- **Project isolation**: Draft endpoints live under `/projects/{project_id}/survey-draft`, and the service layer additionally filters by `project_id`, so a user cannot access drafts for projects they do not belong to.

## Performance & Consistency Notes
- **Payload size**: A typical draft payload is a few KB (mostly strings/booleans). Well under the 64KB `fetch(keepalive)` limit.
- **Consistency guarantee**: Because we save on every navigation step + page hide + debounced idle, the worst-case data loss is ~1.5s of typing on an unexpected crash.
- **Index accuracy**: `currentIndex` is saved with every draft PUT, so resume lands exactly on the last viewed question. If the survey config changed (questions added/removed), we clamp the index rather than trying to map old indices to new ones.
- **API call ceiling**: Even with 100 questions, max ~100 navigation saves + a few debounced saves = very light load.
