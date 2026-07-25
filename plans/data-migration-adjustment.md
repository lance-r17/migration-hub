# Data Migration Adjustment Settings & Report Plan

## Context

The **Migration Settings** page currently has a standalone card for *Data Migration Adjustment* that toggles whether the Data Migration page is enabled. Users want that toggle moved into the *Data Migration* card as the first field labeled **Allow Adjustment**, and an **Extended Adjustment Period** date range added under *Cycle Period*. The extended period should be combined with the cycle period to produce the total migration cycle-block period used by the **Data Migration** page.

The **HomePage** *Data Migration Report* export also needs to show whether a project's migration plan has been adjusted, and append adjusted plan fields to the right of that flag.

## Approach

1. **Settings schema & persistence**
   - Add `extendedAdjustmentPeriod?: { startDate?: string; endDate?: string }` to `DataMigrationSettings`.
   - Update the frontend service layer (`migrationSettings.ts`) to map `extended_adjustment_period` to/from the API.
   - Update the backend Pydantic schemas and service defaults so the new field is persisted.

2. **MigrationSettingsPage UI**
   - Remove the standalone *Data Migration Adjustment* card.
   - Move the toggle into the *Data Migration* card as the first input, labeled **Allow Adjustment**.
   - Add an **Extended Adjustment Period** date-range picker immediately after *Cycle Period*.

3. **DataMigrationPage block generation**
   - Compute a combined period from `dataMigration.cyclePeriod` and `dataMigration.extendedAdjustmentPeriod` as a union (earliest start → latest end).
   - Pass the combined start/end to `useDataMigrationCycleBlocks` so the block list covers the full range.
   - Update the cycle-block header to show the effective combined period.
   - The data-migration survey modal continues to use only `cyclePeriod`.

4. **HomePage report export**
   - Add an **Is Adjusted** column after **Accepts Time Adjustment**; value is `Yes` when `project.dataMigrationPlan` exists and differs from `project.dataMigrationSchedule`, otherwise `No`.
   - Append adjusted plan columns to the right of **Is Adjusted**: Adjusted Migration Start Date, Adjusted Migration End Date, Adjusted Allow Multiple Blocks, Adjusted Cycle Count, Adjusted DTS Instance Count, Adjusted ASR-DR Requested, Adjusted Accepts Time Adjustment. Blank when not adjusted.

## Files to modify

### Frontend
- `frontend/src/types/settings.ts`
- `frontend/src/services/migrationSettings.ts`
- `frontend/src/data/store.ts`
- `frontend/src/pages/MigrationSettingsPage.tsx`
- `frontend/src/pages/DataMigrationPage.tsx`
- `frontend/src/lib/export-report.ts`
- `frontend/src/pages/HomePage.tsx` (no structural change; export function updated)

### Backend
- `backend/app/schemas/migration_settings.py`
- `backend/app/services/migration_settings_service.py`

## Reuse

- Date-range helpers and range picker pattern from `MigrationSettingsPage.tsx` (`rangeLabel`, `Popover` + `Calendar`).
- Existing `useDataMigrationCycleBlocks` hook remains unchanged; caller passes the combined period.
- `exportDataMigrationReport` in `frontend/src/lib/export-report.ts` already fetches projects, BGI hierarchy, users, and settings; we extend its row/header/column definitions.
- The `isDifferent` comparison pattern from `DataMigrationPage.tsx` can be reused/exported to compute the report's `Is Adjusted` flag.

## Steps

- [ ] Add `extendedAdjustmentPeriod` to `DataMigrationSettings` type.
- [ ] Add `extended_adjustment_period` mapping in `frontend/src/services/migrationSettings.ts`.
- [ ] Add backend schema field and service default for `extended_adjustment_period`.
- [ ] Update mock store default in `frontend/src/data/store.ts`.
- [ ] Move the "Allow Adjustment" switch into the Data Migration card in `MigrationSettingsPage.tsx`.
- [ ] Add "Extended Adjustment Period" picker under "Cycle Period" in the same card.
- [ ] Implement combined-period helper in `DataMigrationPage.tsx` and feed it to `useDataMigrationCycleBlocks`.
- [ ] Update the cycle-block header label to reflect the combined period (survey modal stays on `cyclePeriod`).
- [ ] Extend `exportDataMigrationReport` with `Is Adjusted` and adjusted-plan columns, computing `Is Adjusted` by comparing `dataMigrationPlan` against `dataMigrationSchedule`.
- [ ] Verify type-check / lint passes and the report XLSX downloads correctly.

## Verification

- Open **Migration Settings** → confirm the standalone *Data Migration Adjustment* card is gone and the *Data Migration* card contains **Allow Adjustment** at the top and **Extended Adjustment Period** under **Cycle Period**.
- Save settings with an extended period, reload, and confirm values persist.
- Open **Data Migration** page and confirm the block list spans both the cycle period and the extended adjustment period.
- From **HomePage**, export **Data Migration Report** and verify `Is Adjusted` and adjusted-plan columns appear after `Accepts Time Adjustment`, with `Is Adjusted = Yes` only when the plan differs from the survey.

## Decisions

- **Period combination:** Union of `cyclePeriod` and `extendedAdjustmentPeriod` (earliest start → latest end).
- **Scope of combined period:** Applied only to the platform-lead **Data Migration** adjustment page; survey modal and backend schedule validation remain based on `cyclePeriod` only.
- **Report adjusted columns:** Add `Adjusted Allow Multiple Blocks` along with the other adjusted-plan columns.
- **Is Adjusted rule:** `Yes` only when `dataMigrationPlan` exists and differs from `dataMigrationSchedule`.
- **Persistence:** Update backend schemas and service to persist `extended_adjustment_period`.
