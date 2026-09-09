# Plan: Provision page enhancements — resource set label, wave-scoped export, CLI copy

## Context

Three enhancements to `frontend/src/pages/EnvironmentProvisionPage.tsx`:

1. **Target resource set label** in the provision sheet (`ProvisionSheet`), shown above the provision date in
   each env card. Pattern: base id = `applicationOverview.newProjectId ?? project.id`, with any trailing
   `-dev`/`-prod` suffix stripped, then `-{env}` appended.
   - `demo-123456-sampleapp-prod` → dev: `demo-123456-sampleapp-dev`, prod: `demo-123456-sampleapp-prod`
   - `M-80178` → dev: `M-80178-dev`, prod: `M-80178-prod`
2. **Wave-scoped export**: clicking Export opens a dialog with a checkbox per wave (all selected by default);
   only projects in the selected waves are exported.
3. **Copy CLI command**: a copy icon button beside "Mark {env} Completed" that copies:
   `migrate vpc create-vpc --resource-set '{target resource set}' --cidrs '{"zoneA":"...","zoneB":"...","zoneC":"..."}'`

## Key findings (reuse)

- Sheet env card markup: `renderEnvSection` (~line 1095); "Mark Completed" button at ~line 1153.
- `newProjectId` lives at `project.applicationOverview?.newProjectId` (string | null) — already used in the
  table (~line 833).
- Clipboard pattern: `navigator.clipboard.writeText(...)` + toast/copied state — see
  `frontend/src/pages/ServiceAccountsPage.tsx:151` (`handleCopyKey`).
- Export: `handleExportProvisions` (~line 342) maps `liveProjects`; waves available via `sortedWaves` and
  groups already compute wave membership (`p.waveId`); `toast` from sonner already imported.
- Copy icon: `Copy` from lucide-react; `Button` with `size="sm"` variant `"outline"` already used in the card.

## Approach

### 1. Target resource set label

- Add helper at module level:
  ```ts
  function targetResourceSet(project: Project, env: ProvisionEnvironment): string {
    const base = (project.applicationOverview?.newProjectId ?? project.id).replace(/-(dev|prod)$/i, '')
    return `${base}-${env}`
  }
  ```
- In `renderEnvSection`, when `draft.checked`, render a read-only row above the Provision Date block:
  label "Target Resource Set" + mono value (same Label styling as other sections).

### 2. Wave-scoped export dialog

- New state: `exportDialogOpen`, `exportWaveIds: Set<string>` (wave ids + `'__unassigned__'`).
- Export toolbar button now opens the dialog instead of exporting immediately.
- Dialog lists all non-deleted waves (`sortedWaves`) + an "Unassigned" row (only if unassigned projects
  exist), each with a `Checkbox` — **all selected by default, Unassigned included**; "Select all / Clear"
  affordance; footer: Cancel + Export (disabled when nothing selected).
- On confirm: `handleExportProvisions(selectedIds)` filters `liveProjects` by wave membership
  (`p.waveId` in set, or `!p.waveId` for `'__unassigned__'`), keeps existing JSON shape/file name, toasts
  "No projects to export" when the selection matches no projects.

### 3. Copy CLI command button

- In `renderEnvSection`, next to the Mark Completed/Reopen button (flex row), add an icon `Button`
  (variant outline, size sm, `Copy` icon, tooltip "Copy create-vpc command").
- Command built from the **current draft CIDRs** of that env card (including unsaved edits) and
  `targetResourceSet(project, env)`, including **only zones that have values**:
  ```ts
  const cidrs = Object.fromEntries(
    ZONE_OPTIONS.map(z => [z.value, (draft.cidrs[z.value] ?? '').trim()]).filter(([, v]) => v)
  )
  const cmd = `migrate vpc create-vpc --resource-set '${trs}' --cidrs '${JSON.stringify(cidrs)}'`
  ```
  e.g. `migrate vpc create-vpc --resource-set 'M-80178-dev' --cidrs '{"zoneA":"10.248.32.0/26"}'`.
- On click: `navigator.clipboard.writeText(cmd)` + `toast.success('Command copied')`.
- Disabled when the env has no CIDR values at all.

## Files to modify

- `frontend/src/pages/EnvironmentProvisionPage.tsx` — all three features

## Steps

- [ ] 1. `targetResourceSet` helper + label row in env cards
- [ ] 2. Copy CLI button beside Mark Completed (draft CIDRs, clipboard + toast, disabled when empty)
- [ ] 3. Export dialog with per-wave checkboxes (default all) + filtered export

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` + eslint on the touched file
- Manual:
  - Sheet: project with/without `newProjectId` and with ids ending in `-prod`/`-dev`/no suffix show the
    correct target resource set per env
  - Copy button produces e.g. `migrate vpc create-vpc --resource-set 'M-80178-dev' --cidrs '{"zoneA":"10.248.32.0/26"}'`
    (only zones with values); clipboard contains it; disabled with no CIDRs
  - Export dialog: deselect a wave → exported JSON excludes its projects; Unassigned checkbox (default
    selected) controls unassigned projects
