# Wave Gantt Milestone Enhancements

## Context

The Wave Gantt (`frontend/src/pages/WaveGanttPage.tsx` → `frontend/src/components/waves/WaveGanttChart.tsx`) manages per-project milestones. Today: user-added milestones get random UUIDs with mutable names; project start/end dates are manually dragged and stored in `planning.startDate/endDate`; milestones have no comments; the `dev-data-migration` type exists in `MilestoneType`/`MILESTONE_TYPE_META` but has no preset; and there is no bulk import.

The backend stores `planning` as an opaque JSONB blob (`backend/app/models/project.py`, `PlanningPatch`, PATCH `/api/v1/projects/{id}/planning` → `project_service.update_planning` saves verbatim). **All changes are frontend-only, plus docs.**

Five enhancements (user-approved decisions inline):

## 1. Fixed ids for preset milestones

- **Id scheme:** `<type>-<projectId>` (e.g. `dev-resource-provision-P001`) for every non-`custom` milestone added from `MILESTONE_PRESETS`. Rationale: dep graph, `data-bar-id`, and `milestoneRowIndexMap` are keyed by milestone id *globally across projects*, so bare type ids would collide. Matches existing synthetic pattern (`env-provision-date-<pid>`).
- Helper: `fixedMilestoneId(type: MilestoneType, projectId: string)` in WaveGanttChart.tsx.
- `addMilestone()`: presets use fixed id and are **disabled/hidden in the preset menu when already present** on that project (checked by fixed id); `custom` keeps `crypto.randomUUID()`.
- **Name immutability:** the inline name-edit input only opens for `type === 'custom'` (or legacy milestones — see below). Preset label is fixed.
- **Existing data left untouched** (user decision): no normalization/migration. Immutability is determined structurally — a milestone is "fixed" iff its id equals `fixedMilestoneId(m.type, project.id)` for a non-custom type. Legacy random-id milestones keep today's behavior (editable/deletable).
- Deleting a fixed milestone stays allowed (user can re-add via preset).

## 2. Project bar derived from milestone union

- **Derivation source (union):** persisted `planning.milestones` + auto-derived env-provision (`buildEnvironmentProvisionMilestone`) + data-migration period (`buildDataMigrationPeriodMilestone`) + assigned category milestones with per-project overrides applied. `start = min(all starts)`, `end = max(all ends)`.
- **`ProjectPlanning` interface update** (`frontend/src/types/index.ts`):
  - Keep `startDate`/`endDate` — now **auto-derived cached values**, recomputed and persisted on every milestone mutation (add/delete/drag-reorder/drag-resize/import) via a `withDerivedDates(project, planning)` helper. Keeping them persisted is required: they are consumed by backend scoring (`backend/app/services/project_service.py:400 get_migration_period_days`), projects-table trim (`routers/projects.py:481 _TABLE_PLANNING_KEYS`), `OverallProgressCard.tsx:23`, `frontend/src/lib/export-report.ts`, `services/projects.ts:486 mockMigrationPeriodDays`, and Jira date sync in the PATCH endpoint.
  - Remove `planStartDate`/`planEndDate` (update the two usages: `frontend/src/lib/export-report.ts:1144-1145` → use `startDate`/`endDate`; `frontend/src/data/mock.ts` seeds) and remove unused `estimatedStartDate`/`estimatedEndDate`.
- **Live display:** `effectiveProjectDates()` computes the union on the fly (not trusting stored values, so env-provision / data-migration / category-milestone changes made on other pages are reflected immediately). Fallback when a project has zero milestones: keep current behavior — `migrationConstraints` earliest/latest → wave start/cutover as a dashed "draft" bar.
- **Project bar becomes read-only:** remove project-level drag/resize/create interactions (`onPointerDownCreate`, the `milestoneId === null` branch of drag handling, `clampProjectDatesToWave`). First milestone is added via the existing preset menu. Milestone bars remain draggable, clamped to the derived project range (`clampMilestoneDatesToProject` now uses derived dates).
- Mock seed data (`frontend/src/data/mock.ts`): update `planning` blobs to the new interface (drop `tasks` legacy key while touching it, drop plan* fields).

## 3. Milestone comments

- **Types** (`types/index.ts`):
  ```ts
  interface MilestoneComment { id: string; text: string; author: string; createdAt: string }
  // PlanningMilestone gains: comments?: MilestoneComment[]
  ```
- **Scope (user decision):** persisted milestones only (presets + custom) — auto-derived milestones aren't persisted; category milestones live in a separate table. The "Add comment" menu item renders only for those rows (not `immutable`, not `category-milestone`).
- **UI (WaveGanttChart.tsx):**
  - "Add comment" `DropdownMenuItem` (MessageSquarePlus icon) in the existing 3-dots menu → Dialog with textarea → appends `{ id: crypto.randomUUID(), text, author: user?.name ?? 'Unknown', createdAt: new Date().toISOString() }` and persists via existing `onUpdatePlanning`. Author via `useCurrentUser`.
  - When `comments.length > 0`, a MessageSquare icon renders in the name column; hovering it opens a controlled `Popover` (onMouseEnter/onMouseLeave on trigger) listing comments (author · formatted date · text). **Add + view only** (no edit/delete).
- Persisted inside `planning.milestones[]` → flows through existing PATCH; no backend change.

## 4. New preset: Data Migration (Dev)

- Add `{ type: 'dev-data-migration', label: 'Data Migration (Dev)', icon: Database }` to `MILESTONE_PRESETS` between `dev-resource-provision` and `dev-cutover`. Type and `MILESTONE_TYPE_META` entry already exist. Gets fixed id `dev-data-migration-<projectId>` per enhancement 1.

## 5. JSON import of milestones

- **Entry point:** "Import" button (Upload icon) in the Gantt toolbar, visible only when not `readOnly` (i.e. platform migration lead). Hidden `<input type="file" accept="application/json">`.
- **Format** (documented template):
  ```json
  {
    "projects": [
      {
        "projectId": "P-001",
        "milestones": [
          { "type": "dev-resource-provision", "start": "2026-03-02", "end": "2026-03-13", "status": "todo", "deps": [] },
          { "type": "dev-data-migration", "start": "2026-03-16", "end": "2026-03-27", "status": "todo", "deps": ["dev-resource-provision-P-001"] },
          { "type": "custom", "name": "UAT sign-off", "start": "2026-04-01", "end": "2026-04-03", "status": "todo", "deps": [] }
        ]
      }
    ]
  }
  ```
  - Projects matched by exact `projectId`.
  - Preset milestones: id derived as `<type>-<projectId>`; `name` taken from preset label (ignored in file). One per type per project enforced (duplicates in file → latter skipped, reported).
  - Custom milestones: `name` required; optional `id` honored, otherwise fresh UUID generated.
  - `deps` reference milestone ids (fixed ids or custom ids from the same file / existing data); order of the array = display order.
- **Semantics (user-approved):** per listed project, `planning.milestones` is **fully overwritten** (order + deps); `categoryMilestoneOverrides` and other planning keys preserved; `startDate`/`endDate` recomputed via `withDerivedDates`; projects not in the file untouched.
- **Validation & reporting:** unknown project id → skip project; invalid type/date (`yyyy-MM-dd`, start < end) → skip milestone; dep to unknown id or creating a cycle → drop that dep. After processing, summary dialog (imported projects count, skipped entries with reasons). Each project saved via existing `onUpdatePlanning`.
- **Docs:** new `docs/frontend/wave-gantt-milestones.md` with the JSON template, field reference, id rules (`<type>-<projectId>`), overwrite semantics, and validation behavior; add entry to `docs/_sidebar.md` under **Frontend**.

## Files to modify

- `frontend/src/types/index.ts` — `MilestoneComment`, `PlanningMilestone.comments`, `ProjectPlanning` restructure
- `frontend/src/components/waves/WaveGanttChart.tsx` — fixed ids, preset menu gating, name immutability, derived dates + read-only project bar, comments UI, import button/logic
- `frontend/src/lib/export-report.ts` — plan date columns use `startDate`/`endDate`
- `frontend/src/data/mock.ts` — seed planning blobs to new shape
- `docs/frontend/wave-gantt-milestones.md` (new), `docs/_sidebar.md`

## Reuse

- `MILESTONE_TYPE_META['dev-data-migration']` already defined (WaveGanttChart.tsx:114)
- `buildEnvironmentProvisionMilestone` / `buildDataMigrationPeriodMilestone` / `getMilestonesForProject` / `getEffectivePlanning` (union derivation source)
- `isDAGSafe` (import cycle validation), `addDays`/`parseDate`/`daysBetween` date helpers
- `onUpdatePlanning` → `updatePlanning` service (`frontend/src/services/projects.ts:626`) → existing PATCH endpoint; mock mode via `store.updateProject`
- Existing `Dialog`, `Popover`, `DropdownMenu`, `Tooltip` imports in WaveGanttChart; `useCurrentUser` for comment author
- Existing dialog state pattern (`statusDialog`, `deleteDialog`) for comment + import-summary dialogs

## Steps

- [ ] 1. Types: `MilestoneComment`; `PlanningMilestone.comments`; `ProjectPlanning` (drop `planStartDate/planEndDate/estimatedStartDate/estimatedEndDate`); update `export-report.ts` and `mock.ts`
- [ ] 2. `fixedMilestoneId()` helper; `addMilestone` fixed ids; preset menu disabled when present; name editing restricted to custom + legacy
- [ ] 3. Add `dev-data-migration` preset between dev-resource-provision and dev-cutover
- [ ] 4. `withDerivedDates()` + live union in `effectiveProjectDates`; persist derived dates on every mutation; remove project-bar drag/resize/create; keep draft fallback
- [ ] 5. Comments: menu item + add dialog + hover popover in name column
- [ ] 6. Import: toolbar button (non-readOnly), file parse, validation, overwrite + derived dates, summary dialog
- [ ] 7. Docs page + sidebar entry

## Verification

- `cd frontend && npx tsc --noEmit` and lint pass
- Mock-mode dev server, manual checks:
  - Each preset addable once (menu item disabled after add); preset names not editable; custom milestones multi-add + rename still work; legacy mock milestones unchanged in behavior
  - Project bar = union of all milestone bars; moves automatically on milestone drag, env-provision date change, data-migration period change, category override change; draft fallback intact for milestone-less projects; project bar no longer draggable
  - "Data Migration (Dev)" appears in the preset menu in the correct position
  - Add comment → icon appears → hover popover lists it → persists across reload
  - Import the doc's template JSON: order + deps reproduced, `dev-data-migration` dep arrow renders, category overrides preserved; malformed file / unknown project / bad dep produce summary-report entries, no crash
