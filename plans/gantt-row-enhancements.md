# Plan: Wave Gantt row/menu enhancements

## Context

Three small UX enhancements on the Wave Gantt page. All changes are in
`frontend/src/components/waves/WaveGanttChart.tsx` (the page component
`WaveGanttPage.tsx` only wires data/callbacks into it). No backend changes.

## Approach

### 1. Menu order: "Download milestone data" directly under "Add milestone"

Current project-row action menu order: Add milestone → Remove from wave →
**Download milestone data** → Assign to → Reset planning.
Move the standalone `Download milestone data` `DropdownMenuItem` (currently
before the `{!p.waveId && onAssign ...}` block, ~line 3030) to immediately after
the "Add milestone" `DropdownMenuSub` block (~line 2993). Keep it visible
regardless of wave assignment.

### 2. Comment popover: newest first

Comments are appended chronologically (`addComment`, line ~993:
`[...(t.comments ?? []), comment]`) and rendered in that order in the popover
(line ~2646: `milestone.comments!.map(...)`). Render newest first by sorting
descending on `createdAt` at render time:
`[...milestone.comments!].sort((a, b) => b.createdAt.localeCompare(a.createdAt))`
(robust for imported comments with arbitrary order; ISO timestamps sort
lexicographically).

### 3. Project row: Info tooltip shows application name + redirect icon

At ~lines 2913–2923 (Name col):
- Info icon tooltip currently shows `p.name`. Change to the application name
  from the application profile: `p.applicationOverview?.applicationName`,
  falling back to `p.name` when absent. (`applicationOverview` is available —
  WaveGanttPage uses the `/projects` list endpoint whose `basic` field group
  includes `application_overview`, backend `routers/projects.py:233`; already
  used at line ~1608 for migration strategy.)
- Beside the Info icon, add an `ExternalLink` icon button that navigates to the
  project details page `/projects/${p.id}`, wrapped in a Tooltip
  ("View project details"), with `e.stopPropagation()` so it doesn't trigger the
  row's `scrollToBar` click. Add `useNavigate` from `react-router-dom` (not yet
  imported in this file) and `ExternalLink` to the lucide import.

## Files to modify

- `frontend/src/components/waves/WaveGanttChart.tsx` (only)

## Reuse

- Existing `downloadProjectMilestones(p)` handler (added previously, ~line 1092).
- Existing `Tooltip`/`TooltipContent`/`TooltipTrigger` pattern used by the Info icon.
- `formatDate`, lucide icons already imported.

## Steps

- [x] Move "Download milestone data" menu item directly under "Add milestone"
- [x] Sort comment popover list newest-first by `createdAt`
- [x] Info tooltip → `applicationOverview.applicationName` (fallback `p.name`);
      add ExternalLink redirect icon to `/projects/:id` next to it
- [x] Verify: `npx tsc --noEmit`, `npm run lint` (no new problems)

## Verification

- `cd frontend && npx tsc --noEmit` clean; lint problem count unchanged (199).
- Manual: open `/waves/gantt` —
  1. Project row "⋯" menu shows Download milestone data directly under Add milestone.
  2. Milestone with multiple comments → popover shows newest on top.
  3. Hover Info icon → shows application name; click ExternalLink icon → opens
     the project's details page without triggering bar scroll.
