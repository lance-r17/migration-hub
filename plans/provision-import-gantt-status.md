# Plan: Provision JSON import + Gantt project status consistency

## Context

Two changes:

1. **Environment Provision Priority page** (`frontend/src/pages/EnvironmentProvisionPage.tsx`) currently only
   supports editing one project at a time via the side sheet. Add a bulk **Import** (JSON file) function that
   batch-updates `environmentProvision` for many projects, modeled on the milestone import in the Wave Gantt
   (`frontend/src/components/waves/WaveGanttChart.tsx` — the Import button lives in the chart component used by
   `WaveGanttPage.tsx`).

2. **Wave Gantt project-row status** currently renders the raw `p.status` string (e.g. `in-progress`,
   `signed-off`) with a local `PROJECT_STATUS_META` color map. `ProjectDetailsPage.tsx` uses the shared
   `StatusBadge` / `getStatusLabel` (`frontend/src/components/shared/StatusBadge.tsx`), which derives labels from
   `stageProgress` ("Awaiting Survey", "Survey Submitted", "Awaiting Sign-off") and remaps `signed-off` →
   "Ready for Migration" when the sign-off workflow is disabled. The Gantt status column should show the same
   value.

## Key findings (reuse)

- `WaveGanttChart.tsx` import pattern to mirror:
  - `IMPORT_SAMPLE_JSON` const + `downloadImportSample()` (Blob download) — lines ~1086
  - `handleImportFile(file)`: parse → validate → per-project apply via `onUpdatePlanning`, collects
    `{ imported, errors }` summary — lines ~1124–1281
  - Toolbar "Import" button (non-readOnly) + hidden `<input type="file" accept=".json,application/json">`
    — lines ~2189–2211
  - Import dialog: intro (how-it-works + Download sample + Open file) → spinner → summary with error list —
    lines ~3390–3456
- Provision persistence: `updateEnvironmentProvision(projectId, provision)` in
  `frontend/src/services/projects.ts` (line 727) — **replace semantics** (whole `EnvironmentProvision` object,
  omitted envs are discarded), returns updated `Project`.
- `EnvironmentProvision` shape: `{ dev?: { date?, cidrs?: { zoneA?, zoneB?, zoneC? }, completedAt? }, prod?: {...} }`
- CIDR validation helpers in `frontend/src/lib/provision-cidr.ts`: `parseCidr`, `isValidProvisionCidr`,
  `cidrRangesOverlap`, `formatAllowedPrefixes`. Page already computes `allocatedCidrs` (all projects' zone CIDRs)
  and gets `cidrParents` / `allowedPrefixes` from `useMigrationSettings`.
- Page already has optimistic `localOverrides` / `serverUpdates` state and a `handleSave` that toasts per save
  (import should use a summary dialog instead of per-project toasts).
- Status label: `getStatusLabel(status, stageProgress, hasSurveyDraft?, signoffEnabled)` exported from
  `StatusBadge.tsx`. WaveGanttPage already fetches `stageProgress` (`fields: ['basic', 'progress', ...]`) and
  already calls `useMigrationSettings()` (`signoffEnabled` available).
- Gantt project-row status rendered at ~line 2940–2966 (blocked reason tooltip) and drag ghost at ~line 3290.
  `PROJECT_STATUS_META` covers all six `ProjectStatus` keys.

## Approach

### 1. Provision import (EnvironmentProvisionPage.tsx)

- Add toolbar **Import** button (Upload icon) next to the existing toolbar controls + hidden file input.
- Add an Import dialog mirroring the Gantt one: intro text + "Download sample format" + "Open file" →
  importing spinner → summary (`{ imported, errors }`) with per-entry error list.
- JSON format (replace semantics per listed project, mirroring `updateEnvironmentProvision`):

  ```json
  {
    "projects": [
      {
        "projectId": "PRJ-2024-ALPHA",
        "dev":  { "date": "2026-04-06", "cidrs": { "zoneA": "10.248.32.0/26" } },
        "prod": { "date": "2026-05-18" }
      }
    ]
  }
  ```

  - `dev` / `prod` optional; an omitted env discards that env's data (same as unchecking in the sheet).
  - Fields merge with existing values: within a present env, `date` / `cidrs` that are not provided keep the
    env's existing value (no required fields). When `date` *is* provided it must match `yyyy-MM-dd`.
  - **`completedAt` is never imported** — completion state is only changed via the screen UI (Mark Completed /
    Reopen). Import preserves each env's existing `completedAt`; any `completed`/`completedAt` key in the file
    is silently ignored.
  - Effective (merged) CIDRs are what get validated.
- CIDR validation (same rules as the sheet): `parseCidr` format check → `isValidProvisionCidr`
  (parent containment + allowed prefixes from migration settings) → `cidrRangesOverlap` against all other
  allocations, i.e. existing projects **and** other entries earlier in the same file. Violations are collected
  as per-entry errors (`projects[i]...` style messages, like the Gantt import); invalid entries skipped, valid
  ones still applied.
- Apply: for each valid project, build `EnvironmentProvision` by merging file fields over the existing entry
  (`date`/`cidrs` fall back to existing; `completedAt` always kept), optimistic `localOverrides` +
  `updateEnvironmentProvision`; success → `serverUpdates`; failure → revert + error entry. Show summary dialog
  at the end (no per-project toasts).
- Sample file: `PROVISION_IMPORT_SAMPLE_JSON` const + Blob download (Gantt pattern); also add
  `docs/frontend/samples/provision-import.sample.json` to mirror it (as done for milestone import).

### 2. Gantt project-row status consistency (WaveGanttChart.tsx) — label only

- Replace raw `{p.status}` text in the project-row Status column (and the drag ghost) with
  `getStatusLabel(p.status, p.stageProgress, undefined, signoffEnabled)` from `StatusBadge.tsx`.
- **Keep the existing Gantt pill styling** (`PROJECT_STATUS_META[p.status]` colors + blocked-reason tooltip) —
  only the label value changes; the shared `StatusBadge` component is not used.
- `signoffEnabled`: call `useMigrationSettings()` inside `WaveGanttChart` (it already uses `useCurrentUser`
  internally; WaveGanttPage already reads the same settings).

## Files to modify

- `frontend/src/pages/EnvironmentProvisionPage.tsx` — Import button, file input, import dialog,
  `handleImportFile`, sample const
- `frontend/src/components/waves/WaveGanttChart.tsx` — status label via `getStatusLabel` (row + drag ghost)
- `docs/frontend/samples/provision-import.sample.json` — new sample file (mirrors the const)

## Steps

- [ ] 1. Gantt status: import `getStatusLabel` + `useMigrationSettings`; compute label in project row and drag ghost
- [ ] 2. Provision page: toolbar Import button + hidden file input
- [ ] 3. Provision page: sample JSON const + download handler
- [ ] 4. Provision page: `handleImportFile` — parse, validate (project exists, env shape, provided `date` is `yyyy-MM-dd`, CIDR rules incl. in-file conflicts on merged values), merge over existing entry keeping `completedAt`, apply per project, collect summary
- [ ] 5. Provision page: import dialog (intro → importing → summary)
- [ ] 6. `docs/frontend/samples/provision-import.sample.json`

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` (frontend) + eslint on touched files
- Manual: Gantt project row shows e.g. "Awaiting Sign-off" / "Ready for Migration" matching the project
  details badge; blocked tooltip still works
- Manual: provision page Import → sample file applies dates/CIDRs to listed projects (table pills update);
  existing `completedAt` is preserved even if the file contains `completed` keys; malformed JSON / unknown
  project / missing or bad date / invalid or conflicting CIDR appear in the summary error list, valid entries
  still apply
