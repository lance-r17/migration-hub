# Plan: Wave Gantt enhancements — URL project filter, percentage column, View Milestone link

## Context
Three linked enhancements so milestone reminder emails can deep-link into the Gantt chart:
1. `/waves/gantt` accepts a project filter param that prefills the "Project / Milestones" search.
2. New "Percentage" column right of Duration: milestone duration ÷ total duration of the project's milestones.
3. Milestone reminder email CTA becomes "View Milestone" linking to the Gantt chart with the project param.

## Key findings
- Route: `/waves/gantt` → `WaveGanttPage` → `WaveGanttChart` (`frontend/src/components/waves/WaveGanttChart.tsx`).
- Search: `searchQuery` state in `WaveGanttChart` (line ~519), matched against project **id**, name, and milestone names (`matchingProjectIds`). Left panel search input is hidden until the 🔍 icon is toggled (`isSearching` local state in `LeftPanelHeader`) — must auto-open when a param is provided.
- Left panel grid: `LP_GRID = '40px minmax(160px,1fr) 100px 80px 100px 32px'`, `LEFT_PANEL_W = 680`, used by header + wave/project/milestone/unassigned rows (all need the extra cell). Milestone row Duration cell ~line 2749, project row ~3022.
- Row dates: `effectiveMilestoneDates(projectId, milestone)`; rows per project: `getOrderedMilestoneRows(project)`; duration helper `formatDuration`/`daysBetween` (data-migration-period is inclusive).
- Milestone reminder template: `tpl-milestone-reminder` in seed JSON + live DB; CTA row `tmr-r6` currently buttonText "View Project →", linkUrl `{{platform.url}}`; snapshot regenerated via jiti script (established pattern).

## Approach (draft)
1. **URL param**: `WaveGanttPage` reads `useSearchParams().get('projectId')` → new optional prop `initialSearch` on `WaveGanttChart` → `useState(initialSearch ?? '')`; `LeftPanelHeader` initializes `isSearching` from non-empty `searchQuery` so the input is visible.
2. **Percentage column**: `LP_GRID` gains a `70px` column before the action col; `LEFT_PANEL_W` 680 → 750 (also `w-[680px]` occurrences). Header labels add `'%'` after Duration. Milestone rows: `pct = durationDays(m) / Σ durationDays(rows of project) * 100`, durations via `effectiveMilestoneDates` + `daysBetween` (inclusive for data-migration-period, matching `formatDuration`). Wave/project/unassigned rows get an empty cell.
3. **Email CTA**: seed JSON `tmr-r6` → buttonText "View Milestone →", linkUrl `{{platform.url}}/waves/gantt?projectId={{project.id}}`; regenerate `html_snapshot` with the real renderer; update live DB template row.

## Files to modify
- `frontend/src/pages/WaveGanttPage.tsx`
- `frontend/src/components/waves/WaveGanttChart.tsx`
- `backend/scripts/seed_data/email_templates.json` (+ live DB update)

## Decisions
1. Param name: `projectId` → `/waves/gantt?projectId=PRJ-2024-ALPHA`.
2. Percentage: rounded integer (`23%`); base = all displayed milestone rows of the project (planning + auto-derived + category).
3. Project/wave rows: % cell left blank.

## Steps
- [ ] `WaveGanttPage.tsx`: read `projectId` search param, pass `initialSearch` prop
- [ ] `WaveGanttChart.tsx`: `initialSearch` prop → `searchQuery` init + auto-open search input; add Percentage column (LP_GRID, LEFT_PANEL_W, header labels, milestone % cell, blank cells on other rows)
- [ ] Email template: CTA → "View Milestone →" with `{{platform.url}}/waves/gantt?projectId={{project.id}}`; regen snapshot; update live DB
- [ ] Verify end-to-end

## Verification
- `/waves/gantt?projectId=PRJ-2024-ALPHA` → search input open, prefilled, only that project (and its wave) visible.
- Milestone rows show integer % next to Duration; project/wave rows blank; layout intact at all zoom levels.
- Milestone reminder preview: CTA reads "View Milestone →", href contains `/waves/gantt?projectId=`.
- `npx tsc --noEmit -p tsconfig.app.json` filtered to touched files clean; eslint clean.
