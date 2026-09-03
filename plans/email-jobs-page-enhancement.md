# Plan: Enhance EmailJobsPage table & preview dialog

## Context
`frontend/src/pages/EmailJobsPage.tsx` lists background email jobs. Restructure the table to **Event | Recipients | Subject | Status | Schedule | Action**, enrich the Recipients/Schedule cells, and make the preview dialog match the `EmailPreviewPage` layout (shared `BrowserContainer`). To support "Gave up after {n} tries", add an `attempts` counter to the backend `EmailJob` model (schema change approved).

## Key findings from code study
- `EmailJob` type (`frontend/src/services/adminEmailService.ts`): `id, eventType, templateId, toAddrs[], subject, status, errorMessage?, createdAt, sentAt?` — no `attempts` field today.
- `process_email_job` (`backend/app/services/email_service.py`) sets `processing` → sends → `sent` (sets `sent_at`) or `failed` (sets `error_message`). Retry endpoint (`backend/app/routers/admin_email.py`) resets status to `pending` and clears `error_message`, then re-dispatches.
- Shared preview chrome: `frontend/src/components/email-builder/preview/BrowserContainer.tsx` — browser window frame + Desktop/Mobile toggle, with an internal `PhoneFrame`. Used by `EmailPreviewPage`. Desktop width is `min(1100, window.innerWidth - 48)`.
- `Popover` exists at `frontend/src/components/ui/popover.tsx` (shadcn/Radix) — use controlled `open` state with `onMouseEnter`/`onMouseLeave` for hover behavior.
- Alembic head: `ee32760c66e4_add_environment_provision.py` (revises `0036`). Migration numbering style: `0037_*.py` with `revision = "0037"`, `down_revision = "ee32760c66e4"`.

## Approach

### Backend — attempts counter
1. `backend/app/models/email_job.py`: add `attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")` (import `Integer`).
2. New migration `backend/alembic/versions/0037_add_email_job_attempts.py`: `op.add_column("email_jobs", sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))`; downgrade drops it.
3. `backend/app/services/email_service.py` `process_email_job`: increment `job.attempts += 1` when the job is picked up (alongside setting `status = "processing"`, in the same flush/commit). Do **not** reset on retry — retries accumulate, so "tries" reflects total attempts.
4. `backend/app/routers/admin_email.py` `_job_out`: add `"attempts": j.attempts`.
5. `frontend/src/services/adminEmailService.ts`: add `attempts: number` to `EmailJob`.

### Frontend — `EmailJobsPage.tsx`
1. **Columns** → Event, Recipients, Subject, Status, Schedule, Action (drop "Created" column).
2. **Recipients cell**: show `toAddrs[0]`; if more, render a `+n` badge next to it wrapped in a `Popover` (controlled open state, opened on `onMouseEnter`, closed on `onMouseLeave`) whose content lists `toAddrs.slice(1)` one per line.
3. **Status cell**: `JobStatusBadge` only — remove the inline error message (it moves to Schedule).
4. **Schedule cell** (two-row stack where applicable):
   - `sent` → `Sent {date} · {time}` using `sentAt` (fallback to `createdAt` if missing); reuse/split the existing `formatTs` helper (e.g. `formatTsParts(iso)` returning `{ date, time }` with `dateStyle: 'short'`, `timeStyle: 'medium'`).
   - `pending` / `processing` → row 1: "Ready to send"; row 2 (muted, xs): `Queued {date} {time}` from `createdAt`.
   - `failed` → row 1: `Gave up after {attempts} {attempts === 1 ? 'try' : 'tries'}`; row 2 (destructive, xs, truncated): `errorMessage`.
5. **Preview dialog**: replace the plain iframe block with `BrowserContainer`:
   - Add local `previewViewport: 'desktop' | 'mobile'` state (reset to `'desktop'` when dialog opens/closes).
   - Render `<BrowserContainer viewport={previewViewport} onViewportChange={setPreviewViewport} html={preview.htmlBody} />` inside the dialog, keeping the existing To/subject header. Dialog stays `max-w-6xl max-h-[92vh] overflow-y-auto` (BrowserContainer desktop width fits within `window.innerWidth - 48`).
   - Remove the now-unused inline scrollbar-style srcDoc wrapper.

## Files to modify
- `backend/app/models/email_job.py`
- `backend/alembic/versions/0037_add_email_job_attempts.py` (new)
- `backend/app/services/email_service.py`
- `backend/app/routers/admin_email.py`
- `frontend/src/services/adminEmailService.ts`
- `frontend/src/pages/EmailJobsPage.tsx`

## Reuse
- `BrowserContainer` — `frontend/src/components/email-builder/preview/BrowserContainer.tsx`
- `Popover` — `frontend/src/components/ui/popover.tsx`
- `JobStatusBadge`, `formatTs` — existing in `EmailJobsPage.tsx`

## Steps
- [ ] Backend: add `attempts` column (model + migration 0037), increment in `process_email_job`, expose in `_job_out`
- [ ] Frontend service: add `attempts` to `EmailJob` type
- [ ] Table: reorder columns to Event | Recipients | Subject | Status | Schedule | Action
- [ ] Recipients cell: first recipient + hover Popover for `+n`
- [ ] Status cell: badge only
- [ ] Schedule cell: sent / ready-to-send / gave-up rendering per status
- [ ] Preview dialog: swap iframe for `BrowserContainer` with viewport toggle
- [ ] Run migration, verify end-to-end

## Verification
- `cd backend && alembic upgrade head` (or app startup migration) — `email_jobs.attempts` exists, defaults to 0.
- Trigger/fail an email job (e.g. retry with SMTP unreachable): `attempts` increments per try; failed row shows "Gave up after n tries" + error below.
- Frontend: Admin → Email Jobs — column order correct; multi-recipient job shows first + `+n` with hover popover; pending shows "Ready to send" / "Queued ..."; sent shows "Sent <date> · <time>".
- Preview dialog: opens with browser chrome + Desktop/Mobile toggle, visually consistent with `/email/:id/preview`.
- `cd frontend && npx tsc --noEmit` (or project lint/build) passes.
