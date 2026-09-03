# Plan: StageProgressStepper enhancements

## Context
`StageProgressStepper` (used in `ProjectDetailsPage`) shows Setup → Survey → Sign-off → Migration. Three enhancements:
1. Hide the Sign-off step when the sign-off workflow is disabled in settings.
2. Migration step detail: replace `{n}/{m} migrated` with a progress bar + % of completed milestone duration — same metric as the Gantt project-row % (done milestone duration ÷ total milestone duration) — followed by an icon button that redirects to the wave Gantt chart filtered to this project (`/waves/gantt?projectId={project.id}`, using the `initialSearch` support built earlier).
3. Migration step icon becomes clickable/expandable (like Survey), revealing a combination bar: all project milestones as connected colored segments in one line; hover a segment → tooltip with name / status / percentage.

## Key findings
- Sign-off toggle: `getSignoffConfig()` → `{ enabled }` (`frontend/src/services/signoffConfig`); `ProjectDetailsPage` already loads it into `signoffEnabled` state (line ~139) — just pass it into the stepper.
- Expandable pattern: survey/signoff stages use `surveyExpanded`/`signoffExpanded` + `motion.div` panels with an arrow positioned at `left-[calc(25%+14px)]` / `50%` — will compute from stage index dynamically (signoff hidden shifts positions).
- Milestone data: `useProject(id)` → full project incl. `planning`, `categoryMilestoneIds`, `environmentProvision`, `dataMigrationPlan/Schedule`. Gantt math lives in `WaveGanttChart.tsx`: `getOrderedMilestoneRows`, `effectiveMilestoneDates`, `buildEnvironmentProvisionMilestones`, `buildDataMigrationPeriodMilestone`, `durationDays`, `MILESTONE_TYPE_META` (per-type colors), `MILESTONE_STATUS_META`.
- `StageProgressStepper` has no access to the category-milestone list — `ProjectDetailsPage` can load it via existing `useCategoryMilestones()` hook and pass it down.

## Approach
1. **Extract shared milestone math** to `frontend/src/lib/milestones.ts` (pure, no drag state):
   - `buildEnvironmentProvisionMilestones(project)`, `buildDataMigrationPeriodMilestone(project)` (copied verbatim from WaveGanttChart)
   - `getMilestoneRows(project, categoryMilestones, planning?)` — core of `getOrderedMilestoneRows` (CM injection + orderByIdList)
   - `milestoneRowDates(project, row, planning?)` — core of `effectiveMilestoneDates`
   - `milestoneDurationDays(row)` + `projectMilestoneDurationStats(project, categoryMilestones, planning?)` → `{ total, done }`
   - `WaveGanttChart` refactors its internal helpers to delegate to these (keeping `localPlanning` override behavior); `MILESTONE_TYPE_META` gets exported from WaveGanttChart for the stepper's colors (or moved to the lib — decide at implementation; lib preferred to avoid pulling the gantt module).
2. **Stepper changes** (`StageProgressStepper.tsx`):
   - New props: `signoffEnabled: boolean`, `categoryMilestones: CategoryMilestone[]`.
   - Filter out the `signoff` stage when `signoffEnabled` is false (also guard the signoff expansion panel).
   - Migration detail: progress bar + `{completedPct}%` (green fill, same as Gantt project row); fall back to current text when no milestones. Behind it, a small icon button (`GanttChart` icon, ghost/icon size, tooltip "View in wave Gantt chart") that navigates to `/waves/gantt?projectId=${project.id}` (via `useNavigate`).
   - Migration icon clickable when the project has ≥1 milestone row; toggles `migrationExpanded` (mutually exclusive with the other panels, same as existing).
   - Expanded panel: header ("Milestone Progress" + summary), then a single-line segmented bar — each segment width = its % of total duration, colored by type meta `bg` (CM color when present), connected flush; each segment wrapped in `Tooltip` → name, status label, percentage. Panel arrow positioned at the migration stage's index.
3. **`ProjectDetailsPage.tsx`**: pass `signoffEnabled` + `categoryMilestones` (via `useCategoryMilestones()`) to the stepper.

## Files to modify
- `frontend/src/lib/milestones.ts` (new)
- `frontend/src/components/waves/WaveGanttChart.tsx` (delegate to lib, export/move MILESTONE_TYPE_META)
- `frontend/src/components/project/StageProgressStepper.tsx`
- `frontend/src/pages/ProjectDetailsPage.tsx`

## Reuse
- `getSignoffConfig` — already loaded in `ProjectDetailsPage`
- `useCategoryMilestones` — `frontend/src/hooks/use-category-milestones.ts`
- Gantt milestone logic + colors — `WaveGanttChart.tsx`
- Expand/collapse + Tooltip patterns — existing stepper / `ui/tooltip`

## Steps
- [ ] Extract milestone math into `frontend/src/lib/milestones.ts`; refactor WaveGanttChart to use it (no behavior change)
- [ ] Stepper: signoffEnabled prop hides Sign-off stage
- [ ] Stepper: migration detail = progress bar + completed %
- [ ] Stepper: expandable migration panel with segmented combination bar + tooltips
- [ ] ProjectDetailsPage: wire signoffEnabled + categoryMilestones
- [ ] Verify (tsc filtered, eslint, manual)

## Verification
- Sign-off disabled → 3 stages, no signoff expansion; enabled → unchanged.
- Project with mixed milestone statuses → migration detail shows bar + % matching the Gantt project row %.
- Expand migration icon → segmented bar, colors match Gantt legend, hover shows name/status/%, segments sum to full width.
- `tsc -p tsconfig.app.json` + eslint on touched files: no new issues vs pre-existing.
