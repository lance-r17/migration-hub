# Rename all GBI → BGI

## Context

The product acronym "GBI" (Global Business Identifier) is being renamed to "BGI" across the entire Migration Hub stack. This requires a global refactor touching backend database columns, API endpoints, roles, frontend routes/components/types, documentation, and file names. Generated/cache directories (`.claude-backup`, `.pnpm-store`, `__pycache__`, `frontend/dist`, `frontend/playwright-report`, `frontend/test-results`) and `pnpm-lock.yaml` must be left untouched.

## Approach

Perform a consistent, case-preserving rename:
- `gbi` → `bgi` in snake_case identifiers, file paths, URLs, DB columns.
- `Gbi` → `Bgi` in PascalCase class/type/component names.
- `GBI` → `BGI` in user-facing labels and docs.
- `gbi_cloud_lead` → `bgi_cloud_lead` for the role string stored in `users.role`.

Add a new Alembic migration to safely rename existing DB columns and role strings for deployed environments. Do **not** modify the contents of old migration files (they are historical), but update the new model definitions to use `bgi_id`/`bgi_ids` so fresh installs and future migrations are consistent.

No backward-compatible aliases for API routes or frontend paths are proposed; this is a clean break.

## Files to modify

### Backend
- `backend/app/models/project.py` — `gbi_id` → `bgi_id`
- `backend/app/models/user.py` — `gbi_ids` → `bgi_ids`
- `backend/app/schemas/gbi.py` → `bgi.py` + rename schemas
- `backend/app/routers/gbi.py` → `bgi.py` + rename endpoints/tags
- `backend/app/services/gbi_service.py` → `bgi_service.py` + rename functions
- `backend/app/schemas/project.py` — DTO field `gbi_id` → `bgi_id`
- `backend/app/schemas/user.py` — fields/roles
- `backend/app/schemas/migration_settings.py` — `gbi_tier_depth` → `bgi_tier_depth`
- `backend/app/routers/admin.py` — GBI cloud lead endpoints/role strings
- `backend/app/routers/projects.py` — `gbi_id` filtering/serialization
- `backend/app/routers/oauth.py` — role references if any
- `backend/app/auth.py` — `_user_has_gbi_cloud_lead_role` → `_user_has_bgi_cloud_lead_role`, error messages
- `backend/app/main.py` — import `gbi` → `bgi`, OpenAPI tag `"gbi"` → `"bgi"`
- `backend/app/services/project_service.py` — `gbi_id`/`gbi_ids` filtering logic
- `backend/app/services/migration_settings_service.py` — `gbi_tier_depth` → `bgi_tier_depth`
- `backend/scripts/seed.py` — role/seed references
- `backend/scripts/seed_data/gbi_hierarchy.json` → `bgi_hierarchy.json`
- `backend/alembic/versions/` — add new migration `0033_rename_gbi_to_bgi.py`

### Frontend
- `frontend/src/types/gbi.ts` → `bgi.ts`
- `frontend/src/types/index.ts` — `gbi_id`/`gbi_ids`
- `frontend/src/types/settings.ts` — `gbiTierDepth`/`gbi_tier_depth`
- `frontend/src/services/gbi.ts` → `bgi.ts` + API path `/gbi` → `/bgi`
- `frontend/src/services/projects.ts` — `gbi_id` field
- `frontend/src/services/migrationSettings.ts` — `gbi_tier_depth`/`gbiTierDepth`
- `frontend/src/services/adminUsers.ts` — `gbi_ids`, endpoint/role strings
- `frontend/src/components/gbi/GbiTree.tsx` → `components/bgi/BgiTree.tsx`
- `frontend/src/lib/gbi-utils.ts` → `bgi-utils.ts`
- `frontend/src/pages/GbiSettingsPage.tsx` → `BgiSettingsPage.tsx`
- `frontend/src/pages/GbiCloudLeadsPage.tsx` → `BgiCloudLeadsPage.tsx`
- `frontend/src/App.tsx` — routes `/settings/gbi` → `/settings/bgi`, `/admin/gbi-cloud-leads` → `/admin/bgi-cloud-leads`
- `frontend/src/pages/HomePage.tsx` — all GBI state/helpers/API calls
- `frontend/src/pages/ProjectsPage.tsx` — GBI filter logic
- `frontend/src/pages/ProjectDetailsPage.tsx` — `gbi_id` display
- `frontend/src/pages/WaveGanttPage.tsx` — GBI scoping
- `frontend/src/pages/EngagementCalendarPage.tsx` — GBI scoping
- `frontend/src/components/layout/AppSidebar.tsx` — role/label references
- `frontend/src/components/project/ApplicationOverviewSection.tsx` — `gbi_id` display
- `frontend/src/components/waves/WaveGanttChart.tsx` — GBI column/filter
- `frontend/src/hooks/use-projects.ts` — query params/filters
- `frontend/src/lib/export-report.ts` — GBI columns
- `frontend/src/data/store.ts` — any GBI references
- `frontend/src/pages/AdminHome.tsx` — card labels/routes
- `frontend/src/pages/SettingsHome.tsx` — card labels/routes

### Documentation
- `plans/gbi-feature.md` → `bgi-feature.md` + update content
- `docs/backend/api.md` — endpoints and labels
- `docs/backend/batch-integration-guide.md` — CSV headers, role names, code snippets
- `docs/shared/data-model.md` — interfaces and field names
- `docs/frontend/components.md` — props and labels
- `docs/frontend/overview.md` — file path reference

## Reuse

- Reuse existing tree/filter utilities in `frontend/src/lib/gbi-utils.ts`; only rename exports/imports.
- Reuse existing project filtering in `backend/app/services/project_service.py`; update column references.
- Reuse existing Alembic environment; generate migration with `alembic revision -m "rename gbi to bgi"`.
- Reuse existing seed loading in `backend/scripts/seed.py`; update filename reference.

## Steps

- [ ] **1. Database migration**
  - Generate `backend/alembic/versions/0033_rename_gbi_to_bgi.py`
  - Rename `projects.gbi_id` → `bgi_id`
  - Rename `users.gbi_ids` → `bgi_ids`
  - Update `users.role` values containing `gbi_cloud_lead` → `bgi_cloud_lead`
- [ ] **2. Backend models**
  - Update `Project.gbi_id` → `bgi_id`
  - Update `User.gbi_ids` → `bgi_ids`
- [ ] **3. Backend schemas**
  - Rename `backend/app/schemas/gbi.py` → `bgi.py`
  - Update `GbiNode` → `BgiNode`, `GbiHierarchy` → `BgiHierarchy`, request schemas
  - Update `project.py` and `user.py` schemas for `bgi_id`/`bgi_ids`
  - Update `migration_settings.py` for `bgi_tier_depth`
- [ ] **4. Backend services**
  - Rename `backend/app/services/gbi_service.py` → `bgi_service.py`
  - Update function names (`assign_projects_to_gbi` → `assign_projects_to_bgi`, etc.)
  - Update `project_service.py` filter helpers
  - Update `migration_settings_service.py` config key
- [ ] **5. Backend routers**
  - Rename `backend/app/routers/gbi.py` → `bgi.py`
  - Update prefix `/gbi` → `/bgi`, tags, schema imports
  - Update `admin.py` GBI cloud lead routes/role strings
  - Update `projects.py` serialization and filters
  - Update `oauth.py` if it references the role
- [ ] **6. Backend auth and wiring**
  - Update `auth.py` helper names and error text
  - Update `main.py` router import, OpenAPI tag, and `include_router`
- [ ] **7. Seed and scripts**
  - Rename `backend/scripts/seed_data/gbi_hierarchy.json` → `bgi_hierarchy.json`
  - Update `backend/scripts/seed.py` references
- [ ] **8. Frontend types and services**
  - Rename files and update exports/imports
  - Update API paths in services
  - Update field names (`gbi_id`, `gbi_ids`, `gbiTierDepth`)
- [ ] **9. Frontend components and pages**
  - Rename files/directories (`components/gbi/`, `Gbi*Page.tsx`, `gbi-utils.ts`)
  - Update all imports and component names
  - Update routes in `App.tsx`
  - Update role checks and labels across pages/components
- [ ] **10. Documentation**
  - Rename `plans/gbi-feature.md` → `bgi-feature.md`
  - Update all docs with new endpoints, field names, and labels
- [ ] **11. Verification**
  - Backend: `python -m compileall backend/app` and `alembic upgrade head`
  - Frontend: `pnpm install && pnpm run typecheck` (or equivalent)
  - Run any existing test suites
  - Grep to confirm no `gbi`/`GBI`/`Gbi` remains in source files (excluding generated/cache files and `pnpm-lock.yaml`)

## Verification

1. Search for remaining `gbi`/`GBI`/`Gbi` in source:
   ```bash
   grep -Ril 'gbi\|GBI\|Gbi' --exclude-dir=.git --exclude-dir=__pycache__ --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.claude-backup --exclude-dir=.pnpm-store --exclude='pnpm-lock.yaml' .
   ```
   Only unrelated matches (e.g., random hashes in lock files, cached artifacts) should remain.
2. Backend import check:
   ```bash
   cd backend
   python -m compileall app
   ```
3. Run migrations:
   ```bash
   cd backend
   alembic upgrade head
   ```
4. Frontend typecheck:
   ```bash
   cd frontend
   pnpm run typecheck
   ```
5. Manual smoke test:
   - Load `/settings/bgi` and import BGI hierarchy JSON.
   - Assign a project to a BGI node; verify `bgi_id` is saved.
   - Create a `bgi_cloud_lead` user; log in and confirm project scoping/filtering works.
