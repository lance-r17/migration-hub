# Plan: Migration Date Range & Platform Settings Enhancement

## Context
The current migration constraints section uses a calendar range picker for start/end dates. We are changing this to a duration-first approach: select a duration (e.g., 15/30/45 days), then pick a start date, and auto-calculate the end date. The allowed durations and overall platform migration period are maintainable by platform migration leads via a new settings page. This same flow applies to the survey's migration date range question. Wave dates must also fall within the platform period. The seed script should support selective refresh.

## Decisions

### 1. Settings Page Scope
- **Name**: "Migration Settings"
- **Duration options**: Simple array of numbers (e.g., `[15, 30, 45]`). Platform leads can add/remove freely.
- **Platform period**: Maintainable as a date range (start / end date)

### 2. Survey `date_range` Scope
- Only the **specific migration date range** question (`constraints__migrationDateRange`) uses the new duration+start flow.
- Other `date_range` questions remain as calendar pickers.
- **Approach**: Introduce a new survey input type `migration_date_range` to distinguish from generic `date_range`.

### 3. Wave Validation Strategy
- Enforce on **both backend and frontend**.
- If platform period is tightened, existing waves should be **flagged** (not rejected).

### 4. Seed.py Selective Refresh
- Selectable entities: `users`, `waves`, `projects`, `embargos`, `billing`, `config`, `email-templates`
- `--force` still exists as "clear all and reseed everything"
- Selective flags mean **clear and replace** for those specific entities (like `--force` but scoped)

## Approach

### Phase 1: Platform Migration Settings (Backend)
1. Create `MigrationSettings` schema and service backed by `ConfigStore` with key `"migration_settings"`.
2. Expose `GET /api/v1/settings/migration` and `PUT /api/v1/settings/migration` endpoints under `billing.settings_router` (or a new dedicated settings router if preferred).
3. Default settings: empty platform period (`null`), default duration options `[15, 30, 45]`.

### Phase 2: Platform Migration Settings (Frontend)
1. Create `MigrationSettingsPage` with form for platform period (start/end date pickers) and duration options (tag list editor for numbers).
2. Add route `/settings/migration` in `App.tsx` and link in `SettingsHome.tsx`.
3. Add `MigrationSettings` type, API service, and mock store entries.
4. Create a `useMigrationSettings` hook.

### Phase 3: Migration Constraints Section
1. Update `ScheduleWindowsDrawer`:
   - Replace the calendar range picker with a **duration selector** (dropdown of configured options) and a **single start date picker**.
   - Auto-calculate `latestEndDate = earliestStartDate + duration`.
   - Validate that the computed range falls within the platform migration period (show inline error if not).
   - Keep the same save format (`earliestStartDate`, `latestEndDate` in `MigrationConstraints`).
2. `MigrationCutoverSection` display remains unchanged (still shows computed start/end dates).

### Phase 4: Survey Integration
1. Add `migration_date_range` to `SurveyInputType` and `ResourceSurveyInputType`.
2. Change `constraints__migrationDateRange` field def `inputType` from `date_range` to `migration_date_range`.
3. Update `SurveyModal` to render `migration_date_range` with duration dropdown + start date picker (using configured options from settings), auto-calc end date, and store as `{ from, to }` mapped to `earliestStartDate`/`latestEndDate`.
4. Update `ApplicationSurveyTab` `INPUT_TYPE_LABELS` to include `migration_date_range`.
5. Resource survey builder does **not** need `migration_date_range` in its type list since it's an app-level constraint question only, but we can add it for completeness if it ever appears there.

### Phase 5: Wave Date Validation
1. **Backend**: In `routers/waves.py`, before `create_wave` and `update_wave`, fetch migration settings and validate `start_date`/`cutover_date` fall within the platform period. Return `422` with clear message if violated.
2. **Frontend**: In `CreateWaveDrawer` and `EditWaveDrawer` (or wherever wave dates are edited), validate against platform period and show error before submit.
3. **WavesPage**: Add a small warning badge/icon on waves whose dates fall outside the current platform period.

### Phase 6: Seed.py Enhancement
1. Add argparse flags: `--users`, `--waves`, `--projects`, `--embargos`, `--billing`, `--config`, `--email-templates`.
2. When any selective flag is present, skip the default "skip if already seeded" check and only seed the requested entities.
3. For each requested entity, delete its table rows (in correct FK order where needed) and re-seed.
4. `--force` continues to delete everything and reseed all.
5. If no flags provided, keep existing behavior (skip if users exist).

## Files to Modify

### Backend
| File | Change |
|------|--------|
| `backend/app/schemas/migration_settings.py` | **New** — Pydantic schemas for MigrationSettings |
| `backend/app/services/migration_settings_service.py` | **New** — ConfigStore service |
| `backend/app/routers/billing.py` | Add `/settings/migration` GET/PUT endpoints |
| `backend/app/routers/waves.py` | Add platform period validation for create/update |
| `backend/app/routers/projects.py` | Add platform period validation for `migrationConstraints` section update |
| `backend/scripts/seed.py` | Add selective refresh arguments |
| `backend/scripts/seed_data/migration_settings.json` | **New** — default seed data |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/types/settings.ts` | Add `MigrationSettings` interface |
| `frontend/src/services/migrationSettings.ts` | **New** — API service |
| `frontend/src/data/store.ts` | Add mock migration settings getters/setters |
| `frontend/src/hooks/use-migration-settings.ts` | **New** — hook |
| `frontend/src/pages/SettingsHome.tsx` | Add Migration Settings card |
| `frontend/src/App.tsx` | Add `/settings/migration` route |
| `frontend/src/pages/MigrationSettingsPage.tsx` | **New** — settings page UI |
| `frontend/src/components/drawers/ScheduleWindowsDrawer.tsx` | Replace range picker with duration + start date |
| `frontend/src/types/survey.ts` | Add `migration_date_range` to input types |
| `frontend/src/data/surveyFields.ts` | Change `constraints__migrationDateRange` input type |
| `frontend/src/components/survey/SurveyModal.tsx` | Add `migration_date_range` rendering logic |
| `frontend/src/components/settings/survey-builder/ApplicationSurveyTab.tsx` | Add label for `migration_date_range` |
| `frontend/src/components/drawers/CreateWaveDrawer.tsx` | Add platform period validation |
| `frontend/src/pages/WavesPage.tsx` | Flag out-of-range waves |

## Reuse
- **ConfigStore pattern**: Reuse existing `ConfigStore` model and service pattern from `billing_service.py`, `signoff_service.py`, `survey_service.py`.
- **Settings router pattern**: Reuse `settings_router` in `backend/app/routers/billing.py` (or create a new one following the same pattern).
- **Settings page UI pattern**: Reuse `BillingSettingsPage.tsx` layout and validation pattern.
- **Tag/number list editor**: Reuse `StringListEditor` or similar component patterns for duration options.
- **Date picker**: Reuse existing `Calendar` and `Popover` components.
- **Section edit drawer**: Reuse `SectionEditDrawer` and `ScheduleWindowsDrawer` structure.

## Steps

- [x] **Step 1**: Create backend schemas and service for migration settings
- [x] **Step 2**: Add backend API endpoints for migration settings
- [x] **Step 3**: Create frontend types, service, hook, and mock store for migration settings
- [x] **Step 4**: Build `MigrationSettingsPage` and wire routing
- [x] **Step 5**: Update `ScheduleWindowsDrawer` with duration + start date flow
- [x] **Step 6**: Add `migration_date_range` survey input type and update `SurveyModal`
- [x] **Step 7**: Update survey field defs and builder labels
- [x] **Step 8**: Add wave date validation (backend + frontend)
- [x] **Step 9**: Flag out-of-range waves in waves list
- [x] **Step 10**: Enhance `seed.py` with selective refresh flags
- [x] **Step 11**: End-to-end testing (TypeScript build + Python imports pass)

## Verification
1. Navigate to **Settings → Migration Settings** as platform lead. Configure platform period (e.g., 2027-01-01 to 2027-06-30) and duration options (15, 30, 45). Save and reload — values persist.
2. Open a project's **Migration Constraints → Edit Schedule & Windows**. Select 30-day duration and a start date. End date auto-calculates. Dates outside platform period show validation error.
3. Fill a project survey. The migration date range question shows duration dropdown + start date picker. Other date_range questions still show calendar range.
4. Create a wave with dates inside platform period — succeeds. Create a wave with dates outside — rejected with clear error.
5. Tighten platform period in settings. Existing waves outside range show warning badge in waves list.
6. Run `python scripts/seed.py --projects` — only projects are cleared and re-seeded. Run `python scripts/seed.py --force` — everything is cleared and re-seeded.
