# Wave Gantt Milestones

Technical reference for the milestone model used by the Wave Gantt chart
(`frontend/src/pages/WaveGanttPage.tsx` → `frontend/src/components/waves/WaveGanttChart.tsx`),
including the JSON bulk-import format.

## Milestone kinds

| Kind | Stored? | Source |
|---|---|---|
| Preset milestones (`dev-resource-provision`, `dev-data-migration`, `dev-cutover`, `prd-resource-provision`, `prd-cutover`) | Yes, in `projects.planning.milestones` | Added from the project row's "Add milestone" menu |
| Custom milestones (`custom`) | Yes, in `projects.planning.milestones` | Same menu; multiple allowed per project, name editable |
| Category milestones (`category-milestone`) | Separate `category_milestones` table, M:N with projects | Assigned via Category Milestones admin; per-project date/status overrides live in `planning.categoryMilestoneOverrides` |
| Environment Provision (`env-provision`) | No — derived per environment from `project.environmentProvision.dev/.prod` | Environment Provision page |
| Data Migration (Prod) (`data-migration-period`) | No — derived from `project.dataMigrationPlan ?? dataMigrationSchedule` | Data Migration page |

## ID rules

- Preset milestones get a **deterministic fixed id**: `<type>-<projectId>` (e.g. `dev-cutover-P001`).
  Each preset type can exist **at most once per project** and its **name is immutable** (the preset label).
- Custom milestones get a random UUID, can be added multiple times, and their names are editable.
- Auto-derived milestones use synthetic ids (`env-provision-date-<projectId>-dev` / `-prod`,
  `data-migration-period-<projectId>`) and are never persisted. Environment provision renders one
  milestone per checked environment with a date — "Environment Provision (Dev)" and
  "Environment Provision (Prod)" — each with its own date and status.

## ProjectPlanning structure

```ts
interface ProjectPlanning {
  startDate: string          // derived: min start across the milestone union (cached for backend consumers)
  endDate: string            // derived: max end across the milestone union
  milestones: PlanningMilestone[]
  milestoneRowOrder?: string[]   // ordered ids of all rendered milestone rows; see below
  categoryMilestoneOverrides?: Record<string, { start: string; end: string; status?: MilestoneStatus }>
}

interface PlanningMilestone {
  id: string
  name: string
  type: MilestoneType
  start: string              // yyyy-MM-dd
  end: string                // yyyy-MM-dd
  status: 'todo' | 'in-progress' | 'done'
  deps: string[]             // ids of predecessor milestones (DAG-enforced, cross-project allowed)
  immutable?: boolean
  comments?: MilestoneComment[]   // { id, text, author, createdAt }
}
```

The project timeline bar is **derived automatically** from the union of all milestone date ranges
(persisted milestones + env-provision + data-migration period + category milestones with overrides)
and is read-only in the UI. `startDate`/`endDate` are recomputed and persisted on every milestone
mutation so backend scoring, reports, and Jira sync keep working. If a project has no milestones,
the bar falls back to migration constraints → wave dates (shown as a draft).

### Row ordering

Milestone rows are user-reorderable via drag handles. The order persists in
`planning.milestoneRowOrder` (ordered ids of all rendered rows). Rules:

- **Category milestones are pinned**: they always render before other milestone types and can only
  be reordered within their own group (default: creation date ascending).
- Other rows (env provision, data-migration period, presets, custom) reorder freely below the
  category group.
- Ids of rows that no longer exist (unchecked environment, unassigned category milestone) stay in
  the list and are ignored at render — re-adding the row restores its saved position.
- Rows not present in the saved order (e.g. newly added milestones) append at the end of their group.
- **Import resets `milestoneRowOrder`**: the file's array order wins for persisted milestones and
  fixed rows return to default order.

## Milestone import (JSON)

Platform migration leads can bulk-overwrite milestones via the **Import** button in the Gantt toolbar.
For every project listed in the file, `planning.milestones` is **fully replaced** — array order becomes
display order and `deps` become the dependency arrows. Projects not listed are untouched, and
`categoryMilestoneOverrides` are preserved.

### Template

```json
{
  "projects": [
    {
      "projectId": "P-001",
      "milestones": [
        { "type": "dev-resource-provision", "start": "2026-03-02", "end": "2026-03-13", "status": "todo", "deps": [] },
        { "type": "dev-data-migration", "start": "2026-03-16", "end": "2026-03-27", "status": "todo", "deps": ["dev-resource-provision-P-001"] },
        { "type": "dev-cutover", "start": "2026-03-30", "end": "2026-04-02", "status": "todo", "deps": ["dev-data-migration-P-001"] },
        { "type": "prd-resource-provision", "start": "2026-04-06", "end": "2026-04-17", "status": "todo", "deps": [] },
        { "type": "prd-cutover", "start": "2026-04-20", "end": "2026-04-22", "status": "todo", "deps": ["prd-resource-provision-P-001"] },
        {
          "type": "custom",
          "id": "uat-signoff-P-001",
          "name": "UAT sign-off",
          "start": "2026-04-23",
          "end": "2026-04-24",
          "status": "todo",
          "deps": ["prd-cutover-P-001"],
          "comments": [
            { "text": "Confirmed with business owner", "author": "Sarah Jenkins", "createdAt": "2026-04-10T09:00:00.000Z" }
          ]
        }
      ]
    }
  ]
}
```

### Field reference

| Field | Required | Notes |
|---|---|---|
| `projects[].projectId` | Yes | Exact project id; unknown ids are skipped and reported |
| `projects[].milestones[]` | Yes | Empty array clears all milestones of that project |
| `type` | Yes | One of the preset types or `custom` (see table above). Auto-derived types are not importable |
| `start` / `end` | Yes | `yyyy-MM-dd`, must satisfy `start < end` |
| `status` | No | `todo` (default), `in-progress`, or `done` |
| `deps` | No | Milestone ids; may reference fixed preset ids (`<type>-<projectId>`), custom ids from the same file, or existing milestones of other projects. Unknown ids, self-references, and cycle-creating deps are dropped and reported |
| `id` | Custom only | Optional; generated when omitted. Provide it if other milestones need to reference this one in `deps` |
| `name` | Custom only | Required for `custom`; ignored for presets (fixed preset label is used) |
| `comments` | No | `{ text, author?, createdAt?, id? }[]`; entries without `text` are dropped |

### Validation behavior

Invalid files/entries never crash the import: the file must parse as JSON with a top-level
`projects` array; per-entry problems (unknown project, bad dates, duplicate preset type,
unknown/cyclic dep, duplicate id) are skipped and listed in the summary dialog shown after import.

### Sample files

Ready-to-import samples that match the mock seed data (project ids `PRJ-2024-ALPHA`, `M-77122`,
`M-88271`, `M-11029`):

- [milestone-import.sample.json](frontend/samples/milestone-import.sample.json) — fully valid:
  all preset types incl. Data Migration (Dev), custom milestones, deps (incl. a cross-project dep
  `prd-cutover-M-77122` → `alpha-uat-signoff`), statuses, and comments.
- [milestone-import-errors.sample.json](frontend/samples/milestone-import-errors.sample.json) — intentionally
  broken: unknown project, missing `milestones` array, invalid dates, unsupported type, duplicate preset,
  custom without name, a dep cycle (`loop-a` ↔ `loop-b`, second edge dropped), and a dangling dep.
