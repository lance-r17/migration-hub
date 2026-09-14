# Projects Page Header Copy + CIDR Conflict Check on Environment Provision Page

## Context

Two UI enhancements requested:

1. **ProjectsPage header copy** — the current description under the "Projects" heading ("All migration projects across the platform.") should be replaced with a statement explaining list scope (projects identified since May 2026 only, demised-before-May-2026 projects not shown, one profile per project, use Deboard strategy to exclude demised projects from the migration engine). The wording needs optimization.
2. **CIDR conflict checker on EnvironmentProvisionPage** — platform leads currently only discover CIDR conflicts while editing a single project (the provision sheet validates against `allocatedCidrs`). A standalone checker lets them paste an arbitrary CIDR block and see every project allocation that overlaps it, before assigning anything.

## Task 1 — ProjectsPage header description

Current text (`frontend/src/pages/ProjectsPage.tsx`, header block):

```tsx
<p className="text-muted-foreground text-sm">
  All migration projects across the platform.
</p>
```

Confirmed statement (user-approved):

> This list includes only projects identified since May 2026 — projects demised before May 2026 are not shown. Each project has exactly one profile. If a project has been or will be demised after May 2026, set its migration strategy to Deboard to exclude it from the migration engine.

## Task 2 — CIDR conflict check icon button + dialog

### Placement

Toolbar on `frontend/src/pages/EnvironmentProvisionPage.tsx` (`div.h-11.border-b` — the middle row between the page header and the table). All existing controls are right-aligned after a `<div className="flex-1" />` spacer. **Confirmed:** the icon button goes at the **far-left edge of the toolbar, before the flex spacer**.

Icon-only button with a `Tooltip` (e.g. "Check CIDR conflicts"), styled consistently with the other toolbar controls. Candidate lucide icon: `Network` or `ScanSearch` (add to existing lucide-react import).

### Dialog behavior

- Opens on icon-button click; reuses existing `Dialog` / `Input` / `Button` / `Tooltip` UI components already imported in the file.
- Input field for a CIDR block (e.g. `10.248.32.0/26`) + **Analyze** button (also submit on Enter).
- Validation: `parseCidr()` format check only (do NOT restrict to configured parents/prefixes — users may probe a broad range like a `/20` parent). Inline error for malformed input.
- Analysis: filter the page's existing `allocatedCidrs` memo (already built from `liveProjects`: `{ cidr, projectId, projectName, env, zone }`) with `cidrRangesOverlap(a.cidr, input)`.
- Results rendered as a **flat table** with columns:
  - **Project ID** (project name intentionally omitted)
  - **Target Resource Set** — reuse `targetResourceSet(project, env)` (looks up `newProjectId`, strips trailing `-dev`/`-prod`, appends env); project looked up from `liveProjects` by id
  - **Zone** — reuse `zoneLabel()`
  - **Conflict CIDR** — the allocated block that overlaps the input
- Empty state: "No conflicts found for this CIDR block."
- Dialog resets (input, results, error) when closed.

## Files to modify

- `frontend/src/pages/ProjectsPage.tsx` — header description text only
- `frontend/src/pages/EnvironmentProvisionPage.tsx` — toolbar icon button, new state, conflict-check dialog component

## Reuse

- `parseCidr`, `cidrRangesOverlap` — `frontend/src/lib/provision-cidr.ts`
- `allocatedCidrs` memo — already computed in `EnvironmentProvisionPage` (projectId, projectName, env, zone, cidr)
- `targetResourceSet(project, env)` and `zoneLabel(zone)` — existing helpers at bottom of `EnvironmentProvisionPage.tsx`
- UI components already imported in the file: `Dialog*`, `Input`, `Button`, `Tooltip*`
- Existing dialog patterns in the same file: Import dialog (multi-state), Export dialog

## Steps

- [x] Task 1: replace header `<p>` text in `ProjectsPage.tsx` with the confirmed optimized statement
- [x] Task 2: add dialog state (`open`, `cidrInput`, `error`, `results`) to `EnvironmentProvisionPage`
- [x] Task 2: add icon button + tooltip to the toolbar at the confirmed placement
- [x] Task 2: implement analyze handler — validate via `parseCidr`, filter `allocatedCidrs` via `cidrRangesOverlap`
- [x] Task 2: build dialog UI (input row + Analyze button, flat results table with Project ID / Target Resource Set / Zone / Conflict CIDR, empty state, error display)
- [x] Verify: `npm run build` / typecheck in `frontend`, manual smoke test of both pages

## Verification

- `cd frontend && npm run build` (or `tsc`) passes
- Manual: Projects page header shows the new description
- Manual: provision page → click icon button → enter `10.248.32.0/26` (matches sample data) → conflicts listed with project id, target resource set, zone CIDRs; enter an unused block → empty state; enter garbage → inline error
