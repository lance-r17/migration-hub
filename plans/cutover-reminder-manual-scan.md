# Plan: Interactive manual cutover reminder scan

## Context
`NotificationSettingsPage` "Trigger manual scan" currently calls `POST /admin/email/events/cutover-reminder/trigger` → `scan_and_enqueue()` which **immediately enqueues email jobs** for every matching wave/project. The user wants a two-step flow: scan → review matching reminders **listed by project** → select which projects to enqueue.

## Key findings
- Backend: `scan_and_enqueue(session)` in `backend/app/services/cutover_reminder_service.py` does config check → load template → find waves with matching `cutover_date` → resolve recipients (`_resolve_recipients`) → build context → `enqueue_email` with idempotency key `cutover-reminder-{wave.id}-{project.id}-{cutover_date}`.
- `enqueue_email` (`backend/app/services/email_service.py`) dedupes on idempotency key — returns existing job if already enqueued.
- Daily monitor `start_cutover_reminder_monitor` also calls `scan_and_enqueue` — must keep working unchanged.
- Frontend service: `triggerCutoverReminder()` in `frontend/src/services/adminEmailService.ts`.
- UI components available: `checkbox.tsx`, `dialog.tsx`, `badge.tsx`, `popover.tsx` (recipient overflow pattern from EmailJobsPage `RecipientsCell`).
- Route to jobs page: `/admin/email-jobs`.

## Approach

### Backend
1. Refactor `cutover_reminder_service.py`: extract match-finding from enqueueing:
   - `scan_cutover_reminders(session, *, respect_enabled: bool = True) -> list[dict]` — each match: `wave_id, wave_name, cutover_date, days_until, project_id, project_name, to_addrs, subject, idempotency_key, already_enqueued` (query existing `EmailJob` by idempotency key).
   - `enqueue_cutover_reminders(session, matches) -> list[str]` — builds context + subject/html via `render_snapshot` + calls `enqueue_email` per match; returns newly enqueued job IDs.
   - `scan_and_enqueue(session)` = `scan_cutover_reminders(session)` (respect_enabled=True) + enqueue all — unchanged behavior for the daily monitor.
2. New endpoints in `backend/app/routers/admin_email.py`:
   - `GET /events/cutover-reminder/scan` — dry-run, calls `scan_cutover_reminders(session, respect_enabled=False)` (manual scan works even when the toggle is off); returns `{ items: [...] }`.
   - `POST /events/cutover-reminder/enqueue` — body `{ "selections": [{ "wave_id": ..., "project_id": ... }] }`; re-scans with `respect_enabled=False`, filters matches to selected pairs, enqueues, commits; returns `{ enqueued, job_ids }`.
   - Keep the existing `/trigger` endpoint untouched.

### Frontend
3. `adminEmailService.ts`: add `CutoverReminderMatch` type + `scanCutoverReminders(): Promise<{ items: CutoverReminderMatch[] }>` + `enqueueCutoverReminders(selections): Promise<{ enqueued: number; job_ids: string[] }>`.
4. `NotificationSettingsPage.tsx`:
   - "Trigger manual scan" → `scanCutoverReminders()` → opens a Dialog (scrollable list).
   - Each match = one row with a `Checkbox`: project name (bold) + wave name · cutover date · "in N days", recipients shown as first + `+n` hover `Popover` (same pattern as EmailJobsPage `RecipientsCell`), subject in muted text.
   - `already_enqueued` matches: checkbox disabled + "Already enqueued" badge.
   - Header row: select-all checkbox (skips disabled rows) + selected count.
   - Footer: Cancel + "Enqueue (n)" button (disabled when 0 selected) → `enqueueCutoverReminders` → success toast with `action: { label: 'View email jobs', onClick: () => navigate('/admin/email-jobs') }` → close dialog.
   - Empty state inside dialog: "No matching reminders found for the configured reminder days."

## Files to modify
- `backend/app/services/cutover_reminder_service.py`
- `backend/app/routers/admin_email.py`
- `frontend/src/services/adminEmailService.ts`
- `frontend/src/pages/NotificationSettingsPage.tsx`

## Reuse
- `_resolve_recipients`, config/template loading — `backend/app/services/cutover_reminder_service.py`
- `enqueue_email`, `render_snapshot` — `backend/app/services/email_service.py`
- Recipients `+n` popover pattern — `frontend/src/pages/EmailJobsPage.tsx` (`RecipientsCell`)
- `Checkbox`, `Dialog`, `Badge` — `frontend/src/components/ui/`
- sonner toast `action` — existing `toast` usage in the page

## Decisions
1. Already-enqueued matches: shown with disabled checkbox + "Already enqueued" badge.
2. Manual scan ignores the `enabled` toggle (`respect_enabled=False`); the daily monitor still respects it.
3. After enqueue: success toast with "View email jobs" action → `/admin/email-jobs`.

## Steps
- [ ] Backend: refactor `cutover_reminder_service.py` into scan/enqueue split (monitor behavior unchanged)
- [ ] Backend: add `GET .../scan` and `POST .../enqueue` endpoints in `admin_email.py`
- [ ] Frontend: add types + `scanCutoverReminders` + `enqueueCutoverReminders` to `adminEmailService.ts`
- [ ] Frontend: scan dialog with checkbox list, select-all, already-enqueued badges, recipient popover in `NotificationSettingsPage.tsx`
- [ ] Verify end-to-end

## Verification
- With the `enabled` toggle OFF, manual scan still returns matches (monitor still gated).
- Trigger scan with waves near cutover → dialog lists projects with checkboxes; already-enqueued ones disabled + badged.
- Enqueue a subset → toast with "View email jobs" → Email Jobs page shows jobs only for selected projects; re-scan marks them "Already enqueued".
- `cd frontend && npx tsc --noEmit` passes; backend imports cleanly.
