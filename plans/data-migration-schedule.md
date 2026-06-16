# Data Migration Schedule Feature Plan

## Context

The project details page currently displays migration constraints and offers a single application survey. We need to add a new read-only **Data Migration Schedule** section that captures:

- migration start date
- migration end date
- cycle count (default = configured min cycle)
- justification when cycle count exceeds default
- DTS instance count (default = configured min DTS instance count)
- justification when DTS instance count exceeds default

A new standalone **Data Migration Survey** will collect this information. On the project details page the existing "Fill Survey" button becomes a dropdown with two options:

1. **Application Survey** — existing survey modal.
2. **Data Migration Survey** — new survey modal.

The existing Migration Settings page will be extended with a **Data Migration** card that configures the parameters that drive defaults and validation:

- migration cycle duration (days) — default 7
- min cycle — default 1
- max cycle — default 3
- min DTS instance count — default 1
- max DTS instance count — default 5
- cycle start date — earliest selectable schedule start date in the survey
- cycle end date — latest selectable schedule end date in the survey
- cycle capacity — default 20

## Decisions (Confirmed)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Section placement | New card **inside** the existing "Migration Constraints" section |
| 2 | Settings placement | Added to existing **Migration Settings** page (`/settings/migration`) |
| 3 | Storage model | New JSONB column `data_migration_schedule` on `projects` |
| 4 | Submission semantics | Own timestamp column `data_migration_survey_submitted_at`; does **not** affect stage-progress "survey" stage |
| 5 | Date validation | Schedule start/end dates must fall within the configured cycle period (cycle start date → cycle end date) |
| 6 | Cycle/DTS input style | `Select` dropdowns populated from configured min/max range |
| 7 | Welcome slide copy | To be provided later |
| 8 | Access control | Same as existing application survey (project members + platform lead, unless locked) |

## Assumptions

- New Data Migration Survey has exactly two slides: a welcome slide and a single form slide containing all fields.
- Cycle count and DTS instance count options are inclusive integers from `minCycle` to `maxCycle` and `minDtsInstanceCount` to `maxDtsInstanceCount`.
- Justification fields are required only when the selected value is greater than the configured minimum.
- Defaults for cycle count and DTS instance count are the configured minimums.
- Schedule start/end date pickers are constrained to the configured cycle period.
- Same access rules as the existing application survey.
- Submission updates `data_migration_schedule` and sets `data_migration_survey_submitted_at`; it does not affect `survey_submitted_at` or stage progress.

## Approach

### Backend

1. **Database migration** — add `data_migration_schedule` JSONB column and `data_migration_survey_submitted_at` timestamp column to `projects`.
2. **Settings storage** — extend the existing `migration_settings` config store with a new `data_migration` block: `cycle_duration_days`, `min_cycle`, `max_cycle`, `min_dts_instance_count`, `max_dts_instance_count`, `cycle_period` (`start_date`, `end_date`), and `cycle_capacity`.
3. **Schemas** — add Pydantic models for the data-migration settings and the new section shape.
4. **Project service** — add `dataMigrationSchedule` to `SECTION_COLUMN_MAP` / `SECTION_LABELS` so the existing `update_section` endpoint can persist it.
5. **Project schema/response** — include `data_migration_schedule` and `data_migration_survey_submitted_at` in `ProjectDetail`, `ProjectListItem`, and `_project_detail` / `_project_list_item` helpers.
6. **Settings router** — extend the existing `/settings/migration` GET/PUT endpoints to include the new `data_migration` block.
7. **Validation** — add a service helper to validate schedule dates against the configured `cycle_period`.
8. **Submission endpoint** — add `POST /projects/{project_id}/data-migration-survey-submitted` to set `data_migration_survey_submitted_at`.

### Frontend

1. **Types** — add `DataMigrationSchedule`, `DataMigrationSettings`, and update `Project` / `MigrationSettings` interfaces.
2. **Settings page** — extend `MigrationSettingsPage.tsx` with a new card for data-migration parameters.
3. **Service layer** — extend `migrationSettings.ts` to send/receive the `data_migration` block.
4. **Project details** — add a new read-only `DataMigrationScheduleCard` inside `MigrationCutoverSection.tsx`; omit `onSave` so it cannot be edited inline.
5. **Survey dropdown** — replace the "Fill Survey" button in `ProjectDetailsPage.tsx` with a `DropdownMenu` offering "Application Survey" and "Data Migration Survey".
6. **New survey modal** — create `DataMigrationSurveyModal.tsx`:
   - welcome slide
   - single form slide with start date, end date, cycle select, conditional justification, DTS count select, conditional justification
   - load/save via existing section PATCH endpoint
   - call new submission endpoint after successful save
   - defaults and options from settings
   - date pickers constrained to the configured cycle period
7. **Stage progress** — no changes required.

## Files to Modify

### Backend

- `backend/alembic/versions/0034_add_data_migration_schedule.py` *(new)*
- `backend/app/models/project.py`
- `backend/app/schemas/migration_settings.py`
- `backend/app/schemas/project.py`
- `backend/app/services/migration_settings_service.py`
- `backend/app/services/project_service.py`
- `backend/app/routers/billing.py` (settings router)
- `backend/app/routers/projects.py` (submission endpoint)

### Frontend

- `frontend/src/types/settings.ts`
- `frontend/src/types/index.ts`
- `frontend/src/services/migrationSettings.ts`
- `frontend/src/pages/MigrationSettingsPage.tsx`
- `frontend/src/components/project/MigrationCutoverSection.tsx`
- `frontend/src/pages/ProjectDetailsPage.tsx`
- `frontend/src/components/survey/DataMigrationSurveyModal.tsx` *(new)*
- `frontend/src/hooks/use-migration-settings.ts`

## Reuse

- `backend/app/models/config_store.py` + `migration_settings_service.py` pattern for storing settings.
- `backend/app/services/project_service.py` `SECTION_COLUMN_MAP`/`SECTION_LABELS` + `update_section` for persisting the new section.
- `frontend/src/components/ui/dropdown-menu.tsx` for the split survey button.
- `frontend/src/components/ui/calendar.tsx` + `Popover` for date inputs.
- `frontend/src/components/ui/select.tsx` for cycle/DTS count selectors.
- `frontend/src/components/shared/SectionCard.tsx` for the read-only section display.
- Existing `useMigrationSettings` hook will be extended.

## Steps

- [x] Confirm open questions with user.
- [ ] Write backend migration for `data_migration_schedule` and `data_migration_survey_submitted_at`.
- [ ] Update backend models and schemas.
- [ ] Extend `migration_settings` service and router endpoints with data-migration block (cycle period, capacity, etc.).
- [ ] Wire `dataMigrationSchedule` into project service / routers / responses.
- [ ] Add schedule date validation against the configured cycle period.
- [ ] Add `POST /projects/{project_id}/data-migration-survey-submitted` endpoint.
- [ ] Add frontend types and extend migration settings service.
- [ ] Extend `MigrationSettingsPage` with data-migration parameter card (cycle period calendar, capacity).
- [ ] Add read-only `DataMigrationScheduleCard` inside `MigrationCutoverSection`.
- [ ] Add survey dropdown to project details.
- [ ] Build `DataMigrationSurveyModal` with welcome + single form slide.
- [ ] Add validation, defaults, conditional justification fields, and cycle-period date constraints.
- [ ] Verify end-to-end manually and run existing tests.

## Open Items

- Welcome slide copy for the Data Migration Survey is pending and can be added before UI implementation.

## Verification

- Open `/settings/migration` and confirm the data-migration parameter card shows defaults (including cycle period and capacity) and can be changed/persisted.
- Open a project details page and verify the new schedule card appears read-only inside migration constraints.
- Click the survey dropdown and choose "Data Migration Survey".
- Confirm welcome slide renders, then the single form slide with all fields.
- Confirm cycle/DTS selects default to configured minimums and options span min to max.
- Confirm date pickers only allow selection within the configured cycle period.
- Confirm justification fields appear only when value exceeds default and are required before submit.
- Submit the survey and verify the project details page reflects the saved schedule and submission timestamp.
- Run `npm run test:e2e` (or targeted tests) and backend tests to ensure no regressions.
