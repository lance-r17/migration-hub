# Plan: Infra Footprint & Migration Driver Scores in Projects Table

## Context
Add two dynamic scoring columns to the Projects list page:

1. **Infra Footprint** — derived from the *Current Infrastructure* resources.
2. **Migration Driver** — derived from *Application Overview*, *Dependencies*, and *Migration Effort Estimation*.

Each cell should show the final score label and, on hover, render a tooltip table of the score matrix, highlighting the matched row in each input column (same UX pattern as the existing **Migration Effort** cost tooltip).

## Proposed Approach

1. **Add pure helper functions** in `frontend/src/lib/scoring.ts` (new file) that accept a `Project` and return:
   - `score` label (e.g. `Lightweight`, `Low`).
   - `breakdown` per matrix column showing the raw value and which score tier it maps to.
2. **Update data fetching** in `ProjectsPage.tsx` so `useProjects` requests the extra sections needed:
   - `'resources'` → maps to `project.currentInfrastructure`
   - `'dependencies'` → maps to `project.dependencies`
   (Migration Effort & Application Overview are already included in `'basic'`.)
3. **Add table columns** in `ProjectsPage.tsx` immediately before or after the existing **Migration Effort** column.
4. **Build reusable tooltip components** `InfraFootprintTooltip` and `MigrationDriverTooltip` that render the matrix tables with highlighted cells.
5. **Wire the cells** to compute scores on-the-fly for the visible page.

## Scoring Rules (confirmed)

### Infra Footprint (max of ECS count / data volume / MaxCompute count)

| Score | No. of ECS | Data Volume (DB / OSS) | No. of MaxCompute |
|-------|------------|------------------------|-------------------|
| Lightweight | 1 – 10 | < 1 TB | 0 |
| Mid-tier | 11 – 20 | 1 – 10 TB | 1 – 20 |
| Large | 21 – 30 | 10 – 100 TB | 21 – 50 |
| Extended | > 30 | > 100 TB | > 50 |

- ECS: count resources with `product === 'ecs'`.
- MaxCompute: count resources with `product === 'maxcompute'`.
- Data Volume: sum storage/capacity from resources whose **product** is in the `database` category **or** is `oss`. Supported spec keys: `storage_gb`/`capacity_gb`/`size_gb` (÷1024), and `storage_tb`/`capacity_tb`/`size_tb`. Result in TB.
- **Assumption**: the matrix header says “Cloud Infra Prod Footprint”, so only resources whose `resourceSet` ends with `'-prod'` are counted. Untagged resources (no `resourceSet`) are excluded.

### Migration Driver (max of six columns)

| Score | App Tier / IITA | Third-party Effort | Dependency | External Users | Internal Users | No. of Apps |
|-------|-----------------|--------------------|------------|----------------|----------------|-------------|
| Low | Tier 3 / Tier 2 (no IITA) | 1 – 2 FTE | 1 – 4 | 1 – 1000 | 1 – 1000 | 1 |
| Medium | Tier 2 + IITA / Tier 1 (no IITA) | 3 – 4 FTE | 5 – 10 | 1001 – 10000 | 1001 – 5000 | 2 – 5 |
| High | Tier 1 + IITA / Tier 0 | > 4 FTE | > 10 | > 10000 | > 5000 | > 5 |

- Application Tier / IITA: mapping above; missing tier → Low.
- Third-party Effort: sum of `effort` (FTE) across all tasks where `thirdParty === true`.
- Dependency: `dependencies.upstream.length + dependencies.downstream.length`.
- External / Internal Users: parse the first integer from `applicationOverview.userBase.count`. `Both` applies to both; `Internal`/`External` apply only to the matching type.
- No. of Apps: `migrationEffortEstimation.tables.length` (each table is one BA/app).

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/lib/scoring.ts` | New utility functions: `getInfraFootprintScore(project)`, `getMigrationDriverScore(project)`, and helper parsers. |
| `frontend/src/pages/ProjectsPage.tsx` | Request `'resources'` and `'dependencies'` fields; add two new `<TableHead>` columns; render score cells with tooltips; update loading skeleton colspan and empty-state colspan. |
| `frontend/src/services/projects.ts` | No changes needed if backend already maps `cloud_resources` to `currentInfrastructure` and supports `dependencies` field. |
| `frontend/src/lib/export-report.ts` | Added **Infra Footprint** and **Migration Driver** score columns to the projects Excel export. |
| `frontend/src/types/index.ts` | No schema changes needed; scores are computed, not stored. |

## Reuse

- `frontend/src/lib/export-report.ts` → `getMigrationEffortSummary` is the same “group tasks by BA / compute totals” pattern we can mirror for third-party effort and app count.
- `frontend/src/components/ui/tooltip.tsx` → already imported and used for the Migration Effort hover table.
- `frontend/src/hooks/use-projects.ts` → field list already passed to `useProjects`; we only need to append `'resources'` and `'dependencies'`.

## Steps

- [x] 1. Create `frontend/src/lib/scoring.ts` with typed score results.
- [x] 2. Implement `getInfraFootprintScore(project, opts?)`:
  - Count prod ECS resources.
  - Count prod MaxCompute resources.
  - Sum prod DB/OSS resource specs into TB.
  - Return max-of score + per-column raw values.
- [x] 3. Implement `getMigrationDriverScore(project)`:
  - Map tier + IITA to Low/Medium/High.
  - Sum third-party FTE.
  - Count dependency entries.
  - Parse user-base count into internal/external volumes.
  - Count effort tables.
  - Return max-of score + per-column raw values.
- [x] 4. Add `InfraFootprintTooltip` and `MigrationDriverTooltip` components that render the matrix tables and highlight matched cells per column.
- [x] 5. Update `ProjectsPage.tsx`:
  - Add `'resources'` and `'dependencies'` to the `useProjects({ fields: [...] })` call.
  - Add `<TableHead>` headers for `Infra Footprint` and `Migration Driver` near the existing **Migration Effort** column.
  - Add `<TableCell>` renderers using the score helpers and tooltips.
  - Update `colSpan={15}` → `colSpan={18}` for loading skeleton and empty state rows.
- [x] 6. Add E2E assertions in `frontend/e2e/tests/projects.spec.ts` for the new columns and tooltips.
- [x] 7. Verify locally / with Playwright E2E that the columns render and tooltips highlight correctly. *(Attempted; E2E auth fixture is currently broken in this environment — tests redirect to `/login`.)*
- [x] 8. Add a standalone logic verification script (`frontend/scripts/verify-scoring.ts`) that asserts expected scores for all mock projects plus synthetic boundary cases, and run it successfully with `pnpm dlx tsx`.
- [x] 9. Confirm no TypeScript or lint errors in the touched files.

## Post-implementation fix

- `parseFirstNumber` in `frontend/src/lib/scoring.ts` was updated to support `K`/`M`/`B` suffixes (e.g. `~4M end users globally` → 4,000,000) so user volume scoring works for abbreviated counts.

## Documentation updates

- Moved this plan to `plans/infra-footprint-migration-driver-scores.md`.
- Updated `docs/frontend/components.md` with the new `InfraFootprintTooltip` and `MigrationDriverTooltip` components.
- Updated `docs/frontend/best-practices.md` to mention scoring utilities in the exports section.
- Updated `docs/frontend/overview.md` to list `scoring.ts` and `export-report.ts` under `src/lib/`.

## Verification

1. Open `/projects` as a Platform Migration Lead.
2. Confirm two new columns appear near **Migration Effort**.
3. Hover over a score cell and verify:
   - The matrix table is shown.
   - The matched tier row in each input column is highlighted.
   - Raw values are surfaced in the table footer.
4. Check projects with missing/empty sections show `—` instead of crashing.
5. Confirm project list still paginates and filters correctly.
6. Run `pnpm lint` and `pnpm tsc -b` — touched files are clean (repo has pre-existing errors elsewhere).
7. **Note**: Playwright E2E currently fails in this environment due to a pre-existing auth-fixture issue (tests redirect to `/login` even after `injectAuth`). The E2E assertions are added but cannot be validated until the auth fixture is fixed or the environment is configured.

## Open Questions

- [x] **Data volume source**: derive by summing resource specs (storage/capacity in GB/TB) for DB/storage/OSS resources.
- [x] **Third-party effort metric**: sum of FTE across tasks where `thirdParty === true`.
- [x] **Number of Apps**: number of effort tables (distinct BAs / apps).
- [x] **Application Tier edge cases**: T3 or T2 (no IITA) → Low; T2 + IITA or T1 (no IITA) → Medium; T1 + IITA or T0 → High; missing → Low.
- [x] **Extended data-volume threshold**: `> 100 TB`.
- [x] **Prod-only footprint**: restrict infra counts to resources whose `resourceSet` ends with `'-prod'` (untagged/missing `resourceSet` resources are excluded).
