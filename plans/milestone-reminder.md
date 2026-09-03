# Plan: Milestone Reminder email event

## Context
Add a new predefined "Milestone Reminder" email template + event. When a milestone of a project in the wave Gantt chart approaches:
- status `todo` → reminder targets the milestone **start date**
- status `in-progress` → reminder targets the milestone **end date**
- first reminder when within `{reminder_days}` of the target date, then **repeat every `{frequency_days}` until the status changes** — including overdue (confirmed).

Also restructure `NotificationSettingsPage` into a 2-column card grid (Cutover Reminder + Milestone Reminder), each card with its own bottom Save button styled like `AdminProvisionCidrsPage` (primary: `{saving ? 'Saving...' : 'Save'}`).

## Key findings
- Planning milestones: `Project.planning` (JSONB) → `milestones[]` with `id, name, type, start, end, status ('todo'|'in-progress'|'done')`.
- Auto-derived milestones (frontend logic in `WaveGanttChart.tsx` → port to backend):
  - `env-provision`: from `Project.environment_provision` JSONB `{dev|prod: {date, completedAt}}`; status: done if `completedAt`, in-progress if `date <= today`, else todo; single-day.
  - `data-migration-period`: from `Project.data_migration_plan ?? data_migration_schedule` (`startDate/endDate/cycleBlocks/completedAt`); status derived the same way.
- Category milestones: `CategoryMilestone` table + `project_category_milestone` assoc; per-project overrides in `planning.categoryMilestoneOverrides` (`{start, end, status?}`, default status `todo`). Frontend filters planning milestones whose id is an assigned CM id — backend scan must replicate to avoid dupes.
- Role strings in `project_users.role` (comma-separated, matched by `_resolve_recipients`): user said bgi_champion — actual stored strings are `gbi_champion` / `gbi_champion_delegate` (displayed as "BGI Champion"). New template recipient_list: `itso, itso_delegate, gbi_champion, gbi_champion_delegate`.
- Config: `email_event_config` in `ConfigStore`, `_DEFAULT` merge in `email_event_config_service.py`; `PUT /admin/email/events/config` shallow-merges top-level keys (per-card saves send only their sub-object).
- `get_last_run`/`set_last_run` hardcoded to `_LAST_RUN_KEY` — generalize with a key param.
- Monitor pattern: `start_cutover_reminder_monitor` registered in `backend/app/main.py` lifespan.
- Predefined templates from `backend/scripts/seed_data/email_templates.json` (seed skips existing ids → also insert into live DB). Snapshot generated with the real frontend `generateEmailHtml` via jiti one-off script (same as the cutover snapshot fix).
- `TEMPLATE_VARIABLES` (`frontend/src/types/email.ts`) + `SAMPLE_DATA_SETS` (`EmailPreviewPage.tsx`) lack `milestone.*` — add.

## Approach

### Backend
1. **Config** (`email_event_config_service.py`): add `_DEFAULT["milestone_reminder"] = { enabled: True, reminder_days: 7, frequency_days: 3, run_time_utc: "09:00", scopes: { planning: True, auto_derived: True, category: False } }`; generalize `get_last_run`/`set_last_run` with `key` param.
2. **New `backend/app/services/milestone_reminder_service.py`** (mirrors cutover service structure):
   - `_collect_milestones(project, scopes, today)` → unified list `{id, name, status, target_date}`:
     - planning: `planning.milestones` (excluding ids assigned as category milestones); todo→start, in-progress→end.
     - auto_derived: env-provision + data-migration-period with the frontend's status derivation.
     - category: assigned CMs with override dates/status (default todo); target = override.start/end or CM start/end.
   - `scan_milestone_reminders(session, *, respect_enabled=True)` → matches: project/wave info, milestone id/name/status, target_date, days_until, to_addrs (via `_resolve_recipients`), subject, `on_cooldown` + `last_sent_at`.
   - Due rule: `days_until <= reminder_days` (covers overdue). Frequency gate: latest `EmailJob` with `idempotency_key LIKE 'milestone-reminder-{pid}-{mid}-%'`; if `created_at > now - frequency_days` → `on_cooldown`.
   - `enqueue_milestone_reminders(session, matches)`: skips cooldown matches; idempotency key `milestone-reminder-{pid}-{mid}-{today}`; context `{project, wave, milestone{name,status,statusLabel,targetDate}, daysUntil, platform, user{name:''}}`.
   - `scan_and_enqueue_milestones(session)` + `start_milestone_reminder_monitor()` (daily gate, own last-run key `milestone_reminder_cron_last_run`); register in `main.py` lifespan.
3. **Endpoints** (`admin_email.py`): `GET /events/milestone-reminder/scan` and `POST /events/milestone-reminder/enqueue` — same shape as cutover's (manual scan works regardless of `enabled`; enqueue re-scans and filters to selected `{project_id, milestone_id}` pairs).
4. **Seed + live DB**: add `tpl-milestone-reminder` to `email_templates.json` (event_type `milestone_reminder`, recipient_list itso/itso_delegate/gbi_champion/gbi_champion_delegate, rows: heading + body text with `{{milestone.*}}` vars + CTA to `{{platform.url}}` + footer); generate `html_snapshot` via the real renderer (jiti one-off); insert into live DB.

### Frontend
5. **`adminEmailService.ts`**: `MilestoneReminderConfig` (`enabled?, reminder_days?, frequency_days?, run_time_utc?, scopes?`); extend `EmailEventConfig`; `MilestoneReminderMatch` type + `scanMilestoneReminders()` + `enqueueMilestoneReminders(selections)`.
6. **`NotificationSettingsPage.tsx`** restructure:
   - Remove the global top-right Save button.
   - `grid gap-6 lg:grid-cols-2` with two card components: `CutoverReminderCard` (existing fields, own save) and `MilestoneReminderCard`.
   - Each card: local state + `handleSave` calling `updateEmailEventConfig({ <key>: {...} })`; bottom primary Save button (`{saving ? 'Saving...' : 'Save'}` — AdminProvisionCidrsPage style).
   - Milestone card fields: Enabled switch; **Scope** checkboxes (Planning milestones ✓ / Auto-derived milestones ✓ / Category milestones ☐); "Remind days before" number Input; "Repeat every (days)" number Input; Run time (UTC); "Trigger manual scan" button.
   - Manual scan dialog: same review pattern as cutover (checkbox list, select-all, recipients `+n` popover, enqueue with toast + "View email jobs" action). Rows show project name, milestone name + status badge, target date, "in N days" (or "N days overdue"), cooldown rows disabled with "Sent {date}" badge.
7. **`types/email.ts`**: add milestone TEMPLATE_VARIABLES (`milestone.name`, `milestone.statusLabel`, `milestone.targetDate`, `daysUntil`). **`EmailPreviewPage.tsx`**: add milestone sample values to each sample data set so preview resolves.

## Files to modify
- `backend/app/services/email_event_config_service.py`
- `backend/app/services/milestone_reminder_service.py` (new)
- `backend/app/routers/admin_email.py`
- `backend/app/main.py` (register monitor)
- `backend/scripts/seed_data/email_templates.json` (+ live DB insert)
- `frontend/src/services/adminEmailService.ts`
- `frontend/src/pages/NotificationSettingsPage.tsx`
- `frontend/src/types/email.ts`, `frontend/src/pages/EmailPreviewPage.tsx`

## Reuse
- `enqueue_email`, `render_snapshot` — `backend/app/services/email_service.py`
- `_resolve_recipients`, monitor/config patterns — `backend/app/services/cutover_reminder_service.py`
- Auto-derived milestone logic — `frontend/src/components/waves/WaveGanttChart.tsx` (port to backend)
- Scan dialog pattern + `RecipientsCell` — `NotificationSettingsPage.tsx`, `frontend/src/components/RecipientsCell.tsx`

## Steps
- [ ] Backend: config defaults + generalized last-run keys
- [ ] Backend: `milestone_reminder_service.py` (collect/scan/enqueue/monitor) + register monitor in `main.py`
- [ ] Backend: scan/enqueue endpoints in `admin_email.py`
- [ ] Seed + live DB: `tpl-milestone-reminder` with generated snapshot
- [ ] Frontend: service types + functions
- [ ] Frontend: NotificationSettingsPage 2-col cards, per-card save, milestone card fields + manual scan dialog
- [ ] Frontend: TEMPLATE_VARIABLES + preview sample data
- [ ] Verify end-to-end

## Verification
- Backend scan against real DB: projects with todo milestones starting within reminder_days appear; in-progress target end date; overdue included; cooldown respected (enqueue once → re-scan flags it); scope toggles filter milestone sources.
- `tsc --noEmit` clean; backend tests pass (except 2 known pre-existing failures).
- UI: both cards side-by-side, each saves independently; milestone template appears in Email Templates with correct preview (banner, styles) and resolves sample variables; manual scan dialog → enqueue → jobs on Email Jobs page.
