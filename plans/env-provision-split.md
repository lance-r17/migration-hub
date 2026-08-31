# Environment Provision Split (DEV/PROD) + Zone CIDRs + CIDR Admin Page

## Context

`EnvironmentProvisionPage` stores a single provision date + `environments: ('dev'|'prod')[]` + one `completedAt` per project (`frontend/src/types/index.ts` `EnvironmentProvision`; backend `projects.environment_provision` JSONB — opaque, role-checked in `routers/projects.py:902`). The Gantt renders one auto-derived "Environment Provision" milestone (`buildEnvironmentProvisionMilestone`, `WaveGanttChart.tsx`).

Requested: (1) per-environment provision dates, settable only when the env is checked; (2) optional per-zone CIDR blocks per env, validated against configurable parent blocks; (3) per-env mark-completed under each env section; (4) split Gantt env-provision milestone into DEV/PROD; (5) new admin/settings page to override the parent CIDR blocks.

## Decisions (confirmed with user)

- Legacy `{date, environments, completedAt}` blobs **normalized on read** in the frontend; legacy `completedAt` applies to both checked envs. Next save writes the new shape. No data migration.
- CIDR inputs: inline error, Save blocked until valid or cleared. Validation also **cross-checks range overlap against CIDRs already allocated to other projects** (conflict → inline error naming the conflicting project). Unchecking an env **discards** its date/CIDRs/completion on save.
- Table: "DEV Date" + "PROD Date" columns, status pill per env; filters match if ANY checked env matches.
- Gantt: "Environment Provision (Dev)" / "(Prod)", ids `env-provision-date-<pid>-dev` / `-prd`, immutable, shown only when env checked AND has a date.
- Parent CIDR blocks are **configurable** via migration settings (new field). Read side stays public: `GET /api/v1/settings/migration` is already unauthenticated-role-wise, and `ProvisionSheet` reads it via `useMigrationSettings`. Edit side is a new **admin page `/admin/provision-cidrs`** (gated by the existing `AdminPage` admin-role wrapper), with a nav card in `AdminHome`.

## Parent CIDR defaults (latest allocation from user)

| Zone | DEV | PROD |
|---|---|---|
| A | 10.248.32.0/20, 10.248.48.0/20, 10.248.64.0/20 | 10.248.80.0/20, 10.248.96.0/20, 10.248.112.0/20 |
| B | 10.248.160.0/20, 10.248.176.0/20, 10.248.192.0/20 | 10.248.208.0/20, 10.248.224.0/20, 10.248.240.0/20 |
| C | 10.249.32.0/20, 10.249.48.0/20, 10.249.64.0/20 | 10.249.80.0/20, 10.249.96.0/20, 10.249.112.0/20 |

## Data structures

```ts
// types/index.ts
export type ProvisionZone = 'zoneA' | 'zoneB' | 'zoneC'
export interface EnvironmentProvisionEntry {
  date?: string
  cidrs?: Partial<Record<ProvisionZone, string>>
  completedAt?: string | null
}
export interface EnvironmentProvision {
  dev?: EnvironmentProvisionEntry   // key present = env checked
  prod?: EnvironmentProvisionEntry
}

// types/settings.ts
export interface ProvisionCidrParents {
  dev: Record<ProvisionZone, string[]>   // api: dev/prod × zone_a/zone_b/zone_c
  prod: Record<ProvisionZone, string[]>
}
// MigrationSettings gains: provisionCidrParents: ProvisionCidrParents
```

Backend: `ProvisionCidrParents` pydantic model in `schemas/migration_settings.py`; `provision_cidr_parents` added to `MigrationSettingsOut/Update`, `_DEFAULT`, and the patch handler in `services/migration_settings_service.py` (config_store key `migration_settings`, endpoints `GET/PUT /api/v1/settings/migration` in `routers/billing.py`).

## New util: `frontend/src/lib/provision-cidr.ts`

- `DEFAULT_PROVISION_CIDR_PARENTS` (table above) — used by mock store seed + as fallback while settings load
- `parseCidr(cidr): { base: number; prefix: number } | null` — IPv4 → uint32 (`>>> 0`)
- `isValidProvisionCidr(cidr, parents: string[])`: format check, prefix ∈ {26, 27}, network-aligned (`(base & mask) === base`), contained in ≥1 parent range
- `cidrRangesOverlap(a, b): boolean` — for cross-project allocation conflict detection
- `isValidParentCidr(cidr)`: any valid CIDR (for the admin page)

## Files to modify

**Frontend**
- `frontend/src/types/index.ts` — new `EnvironmentProvision` shape; per-env status helper `getProvisionEntryStatus(entry)`; remove `getEnvironmentProvisionStatus`/`formatProvisionEnvironments` (orphaned by this change / dead)
- `frontend/src/types/settings.ts` — `ProvisionCidrParents`, `MigrationSettings.provisionCidrParents`
- `frontend/src/lib/provision-cidr.ts` (new) — defaults + validators
- `frontend/src/services/migrationSettings.ts` — map `provision_cidr_parents` snake↔camel
- `frontend/src/services/projects.ts` — normalize legacy `environment_provision` in `fromApi`
- `frontend/src/data/mock.ts` — 2 `environmentProvision` seeds → new shape; `store.ts` `_migrationSettings` seed gains cidr parents
- `frontend/src/pages/EnvironmentProvisionPage.tsx` — sheet redesign: per-env section (checkbox → Calendar date + 3 CIDR inputs w/ inline errors + Mark Completed/Reopen button + confirm dialog); CIDR validation = parent-containment + overlap check against other projects' allocations (page computes `Map<normalizedCidr, projectName>` from `liveProjects`, excluding the project being edited, and passes it to the sheet); table DEV/PROD date columns + per-env status pills; filters any-match; sort by earliest env date
- `frontend/src/pages/AdminProvisionCidrsPage.tsx` (new) — 6 env×zone CIDR-list editors (add/remove/validate as parent CIDRs), save via `useMigrationSettings().save`
- `frontend/src/App.tsx` — route `/admin/provision-cidrs` under `AdminPage`; `frontend/src/pages/AdminHome.tsx` — nav card
- `frontend/src/components/waves/WaveGanttChart.tsx` — `buildEnvironmentProvisionMilestones()` returning dev/prod milestones; ordering in `getMilestonesForProject`; `deriveProjectDates` union; **fix adjacent pre-existing bug**: `onRowMilestonePointerUp` `fixedCount` ignores env rows (reorder offset wrong whenever env milestone exists) — count all fixed rows

**Backend**
- `backend/app/schemas/migration_settings.py`, `backend/app/services/migration_settings_service.py` — `provision_cidr_parents` field

## Reuse

- `updateEnvironmentProvision` service (PATCH section) — unchanged
- `useMigrationSettings` hook / `saveMigrationSettings` — powers both ProvisionSheet validation and the new settings page
- Existing `Calendar`, `Checkbox`, `Sheet`, `Dialog` patterns in EnvironmentProvisionPage; settings-page layout from `MigrationSettingsPage`
- `MILESTONE_TYPE_META['env-provision']` styling reused for both split milestones

## Steps

- [ ] 1. Types (provision + settings) + `lib/provision-cidr.ts` util + backend schema/service field
- [ ] 2. `migrationSettings.ts` mapping + mock store seed + `fromApi` legacy normalization + mock seeds
- [ ] 3. ProvisionSheet redesign (per-env date/CIDR/complete, discard-on-uncheck, inline CIDR errors block Save)
- [ ] 4. Provision page table columns, per-env status pills, filters, sort
- [ ] 5. New `AdminProvisionCidrsPage` + `/admin/provision-cidrs` route + AdminHome card
- [ ] 6. Gantt split milestones + ordering + deriveProjectDates + fixedCount fix
- [ ] 7. Docs: update `docs/frontend/wave-gantt-milestones.md` (env milestone split) and `docs/shared/data-model.md` if it documents environment_provision

## Verification

- `npm run build` error diff vs baseline unchanged; eslint on touched files; `cd backend && pytest` (settings service)
- Mock mode manual:
  - Check DEV only → only DEV date pickable; PROD section disabled; unchecking DEV discards its data after save
  - CIDR: `10.248.32.0/26` ok (dev/A); `10.248.32.4/26` rejected (misaligned); `10.248.80.0/26` rejected for dev/A (prod parent); `/25` rejected; error blocks Save
  - Mark Completed per env; status pills per env; table columns + filters
  - Admin page: override dev/A parents → new parent accepted in sheet validation; invalid parent rejected; non-admin blocked by AdminPage gate; platform lead (non-admin) can still read config in the provision sheet
  - Conflict detection: allocating `10.248.32.0/26` on project A, then entering `10.248.32.0/27` (overlap) on project B → inline error naming A; `10.248.32.64/26` on B → accepted
  - Gantt: two env milestones with own dates/status; project bar union; milestone row reorder offset correct with env rows present
  - Legacy-shape project still renders (normalization)
