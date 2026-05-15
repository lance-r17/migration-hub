# Event-Driven Background Email Sending

## Context

The platform already stores rich email templates (JSON row-based builder) and seeds them with `event_type` values that map to business lifecycle events:
- `wave_assigned`
- `sign_off_required`
- `project_signed_off`
- `risk_alert`
- `cutover_reminder`
- `approval_submitted`
- `jira_stories_created`
- `survey_submitted`

Today emails are **only sent manually** via:
- `POST /api/v1/email-templates/send-test` — test send with pre-rendered HTML from frontend
- `POST /api/v1/email-templates/send` — triggered send with pre-rendered HTML from frontend

There is **no automatic event-driven dispatch**. The goal is to make the backend emit emails in the background when these business events occur, without blocking the HTTP request.

## Current Architecture Relevant to This Plan

- **Backend**: Python FastAPI + async SQLAlchemy + PostgreSQL
- **Existing resilient background job pattern**: `JiraJob` table + `jira_service.process_job()` + periodic monitor (`start_pending_job_monitor`). Jobs survive crashes and retries because state is in DB.
- **Existing fire-and-forget pattern**: FastAPI `BackgroundTasks` (used for Jira date sync, immediate job dispatch).
- **Email transport**: `app.services.email_service.send_email()` uses `aiosmtplib` directly. A separate Node `email-server/` exists but is minimal and only exposes a manual send-test endpoint.
- **Template storage**: `email_templates` table with `event_type`, `subject`, `recipient_list` (JSONB array of role/email specs), `rows` (JSONB rich layout), `template_style`.
- **Kubernetes awareness**: `DISABLE_BACKGROUND_TASKS` flag already exists to prevent multiple API pods from running the same monitor loop.

## Decisions Made

| # | Decision |
|---|----------|
| 1 | **Queue**: New DB-backed `EmailJob` table + background monitor (mirrors `JiraJob`). |
| 3 | **Recipient resolution**: At enqueue time (store concrete emails in the job record). |
| 4 | **Scope**: Only `cutover_reminder` for this iteration. It requires a periodic cron-like monitor that scans waves. |
| 5 | **Transport**: Python backend sends via `aiosmtplib` directly (`app.services.email_service.send_email`). |

---

## Template Rendering Approach — Option B Selected

The frontend pre-renders HTML and saves a snapshot in a new `html_snapshot` column on `email_templates`. The backend reads the snapshot and performs simple variable substitution (`{{var}}`) at enqueue time.

**Why Option B**: It guarantees visual consistency with the frontend preview, avoids building a complex JSON-to-HTML renderer, and keeps the backend simple (string substitution only). The trade-off is a small frontend change to publish the snapshot on save.

**Snapshot contract**: The frontend builder emits fully rendered HTML (with platform styles, banner, footer) but leaves template variables as `{{variable}}` placeholders. The backend only replaces these placeholders with runtime context values (e.g. `{{wave.name}}`, `{{daysUntilCutover}}`). This means the snapshot does not need to be regenerated when context data changes — only when the layout or styling changes.

**Guardrails**: Event-driven enqueue will raise an error if a template has no `html_snapshot`, preventing silent failures.

---

## Tentative Architecture (post-rendering decision)

### Core components
1. **`EmailJob` model** — `id`, `event_type`, `template_id`, `to_addrs` (JSONB), `subject`, `html_body`, `context` (JSONB), `status` (`pending` → `processing` → `sent`/`failed`), `error_message`, `sent_at`, `created_at`.
2. **`EmailQueueService`** — `enqueue()`, `process_job()`, `start_email_job_monitor()` (sweeps pending jobs every 30s).
3. **`CutoverReminderService`** — `scan_and_enqueue()` (daily tick), finds waves with cutover date within configured reminder window, resolves project recipients, enqueues `EmailJob`s with idempotency key (`wave_id` + `cutover_date` + `project_id`).
4. **`app.services.email_service.render_snapshot()`** — reads `email_templates.html_snapshot`, substitutes `{{vars}}` from context dict, returns final HTML string.
5. **Lifespan wiring** — start both monitors in `main.py`, respecting `DISABLE_BACKGROUND_TASKS`.

### Idempotency for cutover reminders
A project should not receive multiple reminders for the same wave/cutover date. We'll use a deterministic `idempotency_key` (e.g. `cutover-reminder-{wave_id}-{project_id}-{cutover_date}`) and skip enqueue if a `sent` or `pending` job with that key already exists.

### Frontend admin for cron & event criteria
Administrators need UI control over event triggers without redeploying. We will expose a **Notification Settings** admin page and extend the existing **Email Templates** page.

**Configuration stored in `ConfigStore`** (reusing the existing `app.models.config_store` pattern used by `signoff_service`):
- `email_event_config` — JSON blob with per-event settings:
  ```json
  {
    "cutover_reminder": {
      "enabled": true,
      "reminder_days": [7, 3, 1],
      "run_time_utc": "09:00"
    }
  }
  ```
- `email_cron_state` — last-run timestamp so the periodic monitor can self-correct after restarts.

**Frontend pages**:
1. **Notification Settings (`/admin/notifications`)** — new admin-only page:
   - Toggle `cutover_reminder` on/off.
   - Configure `reminder_days` (multi-select chips: 1, 3, 7, 14, 30).
   - Configure `run_time_utc` (time picker, default 09:00).
   - View last-run timestamp and next-run estimate.
   - Test-run button (queues a manual scan for waves matching criteria).
2. **Email Templates (`/email`)** — extend existing page:
   - Show `event_type` badge per template.
   - Indicate whether `html_snapshot` is present (required for event sending).
   - Allow admins to "Publish snapshot" (trigger frontend render + save).
3. **Email Job Log (`/admin/email-jobs`)** — new admin-only page:
   - Filterable table of `EmailJob` records (pending / sent / failed).
   - Retry failed jobs.
   - View rendered HTML preview for any job.

**Backend endpoints**:
- `GET /api/v1/admin/email-events/config` — return current event config.
- `PUT /api/v1/admin/email-events/config` — update event config (admin only).
- `POST /api/v1/admin/email-events/cutover-reminder/trigger` — manually trigger scan (admin only).
- `GET /api/v1/admin/email-jobs` — list email jobs with pagination/filters.
- `POST /api/v1/admin/email-jobs/{job_id}/retry` — reset failed job to pending.

### Files to modify
- `backend/app/models/email_job.py` — new model
- `backend/app/models/email_template.py` — add `html_snapshot` column
- `backend/alembic/versions/...` — migration for `email_jobs` table + `email_templates.html_snapshot`
- `backend/app/services/email_service.py` — add `render_snapshot()`, `enqueue_email()`, `process_email_job()`, `start_email_job_monitor()`
- `backend/app/services/cutover_reminder_service.py` — new: scan waves, resolve recipients, enqueue
- `backend/app/services/email_event_config_service.py` — new: read/write `ConfigStore` for event settings
- `backend/app/routers/email_templates.py` — accept `htmlSnapshot` in create/update payloads
- `backend/app/routers/admin_email.py` — new router: email event config, manual trigger, job log, retry
- `backend/app/main.py` — start email job + cutover reminder monitors in lifespan
- `backend/scripts/seed_data/email_templates.json` — add `html_snapshot` values for each template
- `backend/scripts/seed.py` — seed `html_snapshot` field
- `frontend/src/services/emailService.ts` — include `htmlSnapshot` in create/update payloads; builder should generate snapshot before saving
- `frontend/src/types/email.ts` — add `htmlSnapshot?: string`
- `frontend/src/services/adminEmailService.ts` — new: CRUD for event config, trigger scan, list jobs, retry job
- `frontend/src/pages/admin/NotificationSettingsPage.tsx` — new: cron & event criteria management
- `frontend/src/pages/admin/EmailJobsPage.tsx` — new: email job log viewer
- `frontend/src/App.tsx` — add new admin routes
- `docs/` or `k8s/` architecture docs — update deployment docs to describe the two new background monitors and `DISABLE_BACKGROUND_TASKS` behavior
- `k8s/` manifests — ensure `DISABLE_BACKGROUND_TASKS` is documented for multi-replica API deployments

## Verification
- Unit test: `render_snapshot()` substitutes `{{wave.name}}` and `{{daysUntilCutover}}` correctly into `html_snapshot`.
- Unit test: `scan_and_enqueue()` with wave cutover date 3 days away → asserts `EmailJob` created with correct recipients.
- Unit test: idempotency — second scan for same wave/project creates no duplicate job.
- Integration test: run monitor → mock `aiosmtplib.send` → assert `sent` status and correct HTML body.
- Manual: `CONSOLE_EMAIL=true`, set wave cutover to tomorrow, trigger scan, verify rendered output in logs.
- Frontend: save template in builder → verify `htmlSnapshot` is persisted → backend event send uses snapshot HTML.
- Frontend: open Notification Settings → change reminder days → verify monitor picks up new config on next tick.
- Frontend: trigger manual scan from admin UI → verify `EmailJob` rows appear in Email Jobs page.
- Frontend: view Email Jobs page → filter by failed → click retry → verify status moves to pending then sent.

---

*Plan finalized — ready for implementation.*
