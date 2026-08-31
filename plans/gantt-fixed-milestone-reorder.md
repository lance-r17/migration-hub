# Gantt Milestone Reorder + Category-Milestones-First (Pinned)

## Context

Follow-up to the reorder feasibility analysis. Implement user-reorderable milestone rows in the Wave Gantt via a persisted order list, with **category milestones pinned before all other milestone types**.

Current hardcoded order (`getMilestonesForProject`, WaveGanttChart.tsx ~line 1486):
env-provision (dev, prod) → data-migration period → category milestones (createdAt ASC) → persisted `planning.milestones`.

## Decisions (confirmed)

- **Category milestones are pinned**: always rendered before other types; they cannot be dragged below the CM group, and non-CM rows cannot be dragged above them. CMs **are reorderable within their own group** (default: `createdAt` ASC).
- **Import reset**: on overwrite, delete `milestoneRowOrder` — the file's array order wins for persisted milestones and fixed rows return to default (otherwise stale positions leak through the `{...base, milestones}` spread).
- New rows not in a saved order list append at the end of their group; ids of removed rows (unchecked env, unassigned CM) stay in the list and are filtered at render — re-adding restores position.
- Backend unchanged (planning is opaque JSONB).

## Approach

**Data**: `ProjectPlanning.milestoneRowOrder?: string[]` — ordered ids of all rendered rows (CM ids, `env-provision-date-<pid>-dev|prd`, `data-migration-period-<pid>`, persisted milestone ids).

**Render** (`getMilestonesForProject` restructure):
1. Build groups as today: `cmRows` (createdAt ASC), `fixedRows` (env dev/prod, dm), `persisted` (planning.milestones minus CM-shadowed).
2. `orderByIdList(rows, savedOrder)` helper: ids present in saved order first (in that order), unknown ids appended in default order.
3. Result = `[...orderByIdList(cmRows, saved), ...orderByIdList([...fixedRows, ...persisted], saved)]`.
4. Drag preview applied on this full list with **group clamping** (CM rows clamp to `[0, cmCount)`, others to `[cmCount, rows.length]`).

**Drag commit** (`onRowMilestonePointerUp` rewrite): compute rendered list, clamp drop index by moved row's group, `arrayMove`, then write:
- `milestoneRowOrder: newRows.map(r => r.id)`
- `milestones`: persisted milestone objects re-sorted to their relative order in `newRows` (keeps `planning.milestones` consistent for raw readers)

This removes the `fixedCount` offset math in both preview and commit (source of the earlier env-row offset bug).

**Grip handles**: all rows get the drag grip in the name column (CMs too). Env/dm rows keep their Lock tooltip in the action column — only row position is draggable; bar/date editing stays locked.

**Import** (`handleImportFile`): write `{ ...base, milestones, milestoneRowOrder: undefined }`.

## Files to modify

- `frontend/src/types/index.ts` — `milestoneRowOrder?: string[]` on `ProjectPlanning`
- `frontend/src/components/waves/WaveGanttChart.tsx` — `orderByIdList` helper, `getMilestonesForProject` restructure (order + preview + clamping), `onRowMilestonePointerUp` rewrite, grip rendering for all rows, import reset
- `docs/frontend/wave-gantt-milestones.md` — document `milestoneRowOrder` + pinning rule

## Reuse

- `buildEnvironmentProvisionMilestones`, `buildDataMigrationPeriodMilestone`, assigned-CM block, existing drag plumbing (`rowMilestoneDragState`, `data-milestone-row-*` attrs, ghost ref), `onUpdatePlanning` PATCH

## Steps

- [ ] 1. Types: `milestoneRowOrder` field
- [ ] 2. `orderByIdList` + `getMilestonesForProject` restructure (CM-pinned default order + saved-order application + clamped drag preview)
- [ ] 3. `onRowMilestonePointerUp` rewrite (group-clamped full-list reorder, dual write) + grip on all rows
- [ ] 4. Import reset + docs update

## Verification

- `npm run build` diff vs baseline; eslint touched file
- Mock mode:
  - Default: CMs first (createdAt), then env dev/prod, dm period, persisted milestones
  - Drag CM within CM group only; drag env/dm/custom anywhere below CM group; drop above CM group rejected (clamped)
  - Order persists across reload (mock store); import resets order to default; uncheck env → row gone, re-check → saved position restored
  - `planning.milestones` array order matches rendered relative order of persisted milestones
