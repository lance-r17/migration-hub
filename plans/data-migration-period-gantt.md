# Plan: Render Data Migration Period as an Immutable Gantt Milestone

## Context

In `frontend/src/pages/WaveGanttPage.tsx`, the Wave Gantt chart renders each project and its planning milestones. Projects can also have a data migration schedule defined either by the submitted survey (`project.dataMigrationSchedule`) or by the platform-lead-adjusted plan (`project.dataMigrationPlan`). Today that schedule only appears on the dedicated **Data Migration** page, not on the Gantt chart.

The requirement is to surface that period as a dedicated milestone row under each project in the Gantt, with these constraints:

- It is **immutable** from the Gantt: users cannot change its start/end dates, cannot reorder it, and cannot remove it.
- It uses an **exclusive icon** that clearly distinguishes it from the existing `dev-data-migration` and `prd-data-migration` milestone types.
- The **Add milestone** dropdown should no longer offer the old `dev-data-migration` and `prd-data-migration` stage options, because the new data-migration period is the authoritative representation.

## Decisions Confirmed

| Topic | Decision |
|-------|----------|
| Multiple cycle blocks | Render **one combined milestone** spanning the earliest start → latest end across `cycleBlocks` or `startDate`/`endDate`. |
| Icon | `DatabaseBackup` from `lucide-react` (distinct from existing data-migration icons). |
| Label | **“Data Migration”** regardless of whether it comes from the adjusted plan or the survey. |
| Status | `done` if `completedAt` is present, otherwise `in-progress` if today falls within the period, otherwise `todo`. |
| Placement | **First** under the project (before category milestones). |
| Unassigned projects | **Yes**, render it for any project that has a data migration period. |
| Add-milestone dropdown | Remove `dev-data-migration` and `prd-data-migration` presets from the menu; keep their type metadata so existing milestones still render. |

## Proposed Approach

1. Add a new, internal-only milestone type `data-migration-period` to the existing `MilestoneType` union and to the Gantt type metadata (`MILESTONE_TYPE_META`).
2. In `WaveGanttChart`, derive a synthetic `PlanningMilestone` from `project.dataMigrationPlan ?? project.dataMigrationSchedule` whenever a period exists. Use the earliest start and latest end from the plan/schedule fields.
3. Insert that synthetic milestone at the top of the milestone list returned by `getMilestonesForProject` so it appears first under each project.
4. Give the synthetic milestone a per-project unique ID (e.g. `data-migration-period-${project.id}`) so it never collides with real milestones or dependency edges.
5. Make it visually immutable:
   - No drag/reorder grip in the left panel.
   - No date-drag or resize pointer handlers on the bar.
   - No resize handles.
   - No dependency-connector dot.
   - No status-change or remove actions in the row menu.
   - Show a small lock indicator / read-only tooltip.
6. Use `DatabaseBackup` with a distinct color pair so it is not confused with the existing data-migration icons.
7. Remove the `dev-data-migration` and `prd-data-migration` entries from `MILESTONE_PRESETS` (the “Add milestone” dropdown) while keeping their `MILESTONE_TYPE_META` entries so existing milestones still render correctly.

## Files to Modify

- `frontend/src/types/index.ts` — extend `MilestoneType` with `'data-migration-period'`.
- `frontend/src/components/waves/WaveGanttChart.tsx` — add metadata, derive the synthetic milestone, render it as immutable, and filter the add-milestone dropdown.

## Reuse

- `MILESTONE_TYPE_META`, `MILESTONE_STATUS_META`, `MILESTONE_STATUS_PROGRESS` already exist in `WaveGanttChart.tsx` and drive the label/color/status rendering for every milestone row.
- `MILESTONE_PRESETS` already defines the “Add milestone” menu; we will filter it rather than invent a new mechanism.
- `getMilestonesForProject` already composes category milestones and project planning milestones into a single rendered list; this is the natural place to inject the data-migration period.
- `DataMigrationSchedule` type is already defined in `frontend/src/types/index.ts` and both `dataMigrationPlan` and `dataMigrationSchedule` are already present on `Project`.
- `Lock` icon is already imported in `WaveGanttChart.tsx` for embargos; we can reuse it for the read-only indicator.

## Implementation Steps

- [ ] Extend `MilestoneType` union in `frontend/src/types/index.ts` with `'data-migration-period'`.
- [ ] Import `DatabaseBackup` from `lucide-react` at the top of `WaveGanttChart.tsx`.
- [ ] Add a new metadata entry to `MILESTONE_TYPE_META` in `WaveGanttChart.tsx` using `DatabaseBackup` and a unique color pair.
- [ ] Filter `MILESTONE_PRESETS` in `WaveGanttChart.tsx` to exclude `dev-data-migration` and `prd-data-migration` (or remove them from the array), while keeping their `MILESTONE_TYPE_META` entries.
- [ ] Add a helper inside `WaveGanttChart.tsx` that:
  - Reads `project.dataMigrationPlan ?? project.dataMigrationSchedule`.
  - Computes `startDate` and `endDate`:
    - If `startDate`/`endDate` exist, use them.
    - Else if `cycleBlocks` exist, use the earliest `startDate` and latest `endDate` among the blocks.
  - Derives `status`:
    - `done` if `completedAt` is present.
    - Else `in-progress` if today is within the computed period.
    - Else `todo`.
  - Builds a `PlanningMilestone` with `type: 'data-migration-period'`, `name: 'Data Migration'`, and a unique ID `data-migration-period-${project.id}`.
  - Returns `undefined` if no valid period exists.
- [ ] Update `getMilestonesForProject` to prepend the synthetic milestone when a period exists.
- [ ] In the milestone row render path, detect `milestone.type === 'data-migration-period'` and:
  - omit the drag/reorder grip,
  - attach no date-drag or resize pointer handlers on the bar,
  - omit the resize handles,
  - omit the dependency connector dot,
  - replace the action-column dropdown with a `Lock` icon + tooltip (“Data migration period is managed on the Data Migration page”).
- [ ] Add defensive guards in `onPointerDown` / `onRowMilestonePointerDown` to ignore `data-migration-period` rows even if events are accidentally attached.
- [ ] Verify that the synthetic milestone does not break dependency rendering, row numbering, or search matching.
- [ ] Run type-check and the relevant test suites:
  - `pnpm tsc --noEmit`
  - `pnpm test -- WaveGanttChart` (or any related Gantt tests)

## Verification

- Open `/waves/gantt` (or wherever `WaveGanttPage` is mounted).
- Expand a project that has a `dataMigrationSchedule` or `dataMigrationPlan`.
- Confirm a new row appears first under the project with the `DatabaseBackup` icon and the label **“Data Migration”**.
- Confirm the dates match the effective period (adjusted plan takes precedence over the survey).
- Confirm:
  - the bar cannot be dragged or resized,
  - the row cannot be reordered via the grip,
  - the action column shows a lock icon instead of a menu,
  - the connector dot does not appear on the right of the bar.
- Expand a project with an active period and confirm the status pill shows **“In Progress”**; if completed, **“Completed”**; otherwise **“To Do”**.
- Open the **Add milestone** dropdown on a project row and confirm “DEV Data Migration Stage” and “PRD Data Migration Stage” are gone, while existing milestones of those types still render correctly.
- Check that normal milestones still drag, resize, reorder, and delete as before.
- Run `pnpm tsc` and `pnpm test` to catch regressions.
