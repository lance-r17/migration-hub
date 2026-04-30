# Add ITSO Project User Role to Replace profile_owner

## Context
Currently `profile_owner` is a direct foreign-key column on the `projects` table referencing `users.id`. It is displayed in the project list and project details header, but it is **not** part of the `project_users` governance-role system.

The requirement is to:
1. Replace `profile_owner` with a new `itso` role stored in the `project_users` table.
2. Make `itso` non-editable via any frontend drawer.
3. Allow `itso` assignments to be synchronized by batch jobs via an API endpoint.
4. Ensure `itso` shares the same authorization/storage mechanism as other governance roles like `technical_lead`.

## What I've Found

### Backend
- **`projects.profile_owner`** → `users.id` (direct FK, eager-loaded as `profile_owner_user`).
- **Governance roles** (`technical_lead`, `business_owner`, `dba_data_owner`) live in `project_users` and are synced from `applicationOverview` via `_sync_project_user_roles()` in `project_service.py`.
- **AD/OAuth sync** (`sync_user_projects()` in `user_service.py`) only deletes `role='member'` rows, preserving governance roles.
- **Approval authority** (`_check_approval_authority()`) verifies `ProjectUser.role == role` for non-platform-lead sign-offs.
- **Team display** (`_team_from_project_users()`) includes all `project_users` regardless of role.
- **`users.role`** already stores comma-separated roles (e.g. `platform_migration_lead,admin`), but `project_users.role` currently holds a single value.

### Frontend
- `profileOwner` is rendered in `ProjectsPage.tsx` (table column) and `ProjectDetailsPage.tsx` (metadata strip).
- No drawer currently exists for `profile_owner`; it is read-only.

## Feedback Applied

1. **`itso` is NOT eligible for sign-off approvals.** Users can hold multiple project roles (e.g. `itso,technical_lead`).
2. **No cross-project bulk endpoint needed.** A single-project endpoint that can update multiple users' roles in one call is sufficient.
3. **UI label renamed to "ITSO".**

## Approach

### Core Design Decisions
- **`project_users.role` becomes comma-separated** (same pattern as `users.role`) so a single user-project row can carry multiple roles (`itso,technical_lead`).
- **`profile_owner` column is removed** from `projects`; the ITSO name is derived at API serialization time from `project_users`.
- **`itso` is drawer-immune** — it is never managed by `applicationOverview` or any frontend drawer. It is only managed by the new API endpoint.
- **Governance-role sync preserves non-governance roles** — `_sync_project_user_roles()` must merge `technical_lead`/`business_owner`/`dba_data_owner` with existing roles (like `itso`) instead of overwriting the entire `role` string.
- **AD/OAuth sync preserves non-member roles** — `sync_user_projects()` removes only the `member` token from comma-separated roles and deletes the row only when no roles remain.

### Data Migration
1. Create Alembic migration `0020_migrate_profile_owner_to_itso.py`:
   - For each `projects.profile_owner`, upsert `project_users(project_id, profile_owner, 'itso')`. If the user already has a row, append `itso` to their role string.
   - Drop `projects.profile_owner` column and its FK constraint.

### Backend Changes

#### Models
- **`backend/app/models/project.py`** — remove `profile_owner` column and `profile_owner_user` relationship.

#### Services
- **`backend/app/services/project_service.py`**
  - Remove `profile_owner_user` from all `selectinload` option helpers.
  - Update `_sync_project_user_roles()` to parse existing roles as a set, replace only governance roles, and re-join (preserving `itso` and any future non-governance roles).
  - Update `_check_approval_authority()` to test role containment (`role in pu.role.split(',')`) instead of exact equality.
  - Add `update_project_user_roles(session, project_id, assignments)` helper.
- **`backend/app/services/user_service.py`**
  - Update `sync_user_projects()` deletion logic: query all of the user's `project_users` rows for stale projects, strip the `member` token, update or delete accordingly.
  - Keep the existing insertion logic (only add `member` when no row exists).
- **`backend/app/services/jira_service.py`** — replace `profile_owner_user` access with a lookup through `project_users`.

#### Routers
- **`backend/app/routers/projects.py`**
  - Replace `profile_owner=...` with `itso=...` in `_project_list_item()` and `_project_detail()`. Derive `itso` by scanning `project_users` for the first user whose `role` contains `itso`.
  - Add `PUT /{project_id}/project-user-roles` endpoint:
    - Body: `list[{ user_id: str, roles: list[str] }]`
    - For each item, upsert the `project_users` row with the exact role list. An empty `roles` array deletes the row.
    - Users not in the payload are untouched.
    - Restricted to service accounts (`current_user.is_service_account`).

#### Schemas
- **`backend/app/schemas/project.py`** — replace `profile_owner` field with `itso` in `ProjectListItem`, `ProjectDetail`, and `ProjectPatch`.
- **`backend/app/schemas/project_user.py`** (or extend `user.py`) — add `ProjectUserRoleAssignment` request schema.

### Frontend Changes
- **`frontend/src/types/index.ts`** — replace `profileOwner?: string` with `itso?: string` in `Project`.
- **`frontend/src/services/projects.ts`** — replace `profile_owner` → `itso` in raw API interfaces and mappers.
- **`frontend/src/pages/ProjectsPage.tsx`** — replace "Profile Owner" column header and `project.profileOwner` with `project.itso`.
- **`frontend/src/pages/ProjectDetailsPage.tsx`** — replace "Profile Owner" label and `project.profileOwner` with `project.itso` in the metadata strip.
- **`frontend/src/data/mock.ts`** — replace `profileOwner` with `itso`.

### Seed Data
- **`backend/scripts/seed_data/projects.json`** — remove `profile_owner` field.
- **`backend/scripts/seed.py`** — remove `profile_owner` kwarg. If seed data needs ITSO users, add them via `project_users` inserts after project creation.

### Docs
- **`docs/backend/database.md`** — remove `profile_owner` from `projects` schema table; update `project_users.role` note to mention comma-separated values.
- **`docs/shared/data-model.md`** — replace `profileOwner?: string` with `itso?: string` in the `Project` interface.
- **`docs/shared/sso-configuration.md`** — update the governance-roles protection section to state that `itso` (and any non-member role) is preserved during SSO login; update `sync_user_projects` description to reflect comma-separated role stripping instead of exact `role = 'member'` match.
- **`docs/backend/api.md`** — replace `profile_owner` with `itso` in project schema references; add documentation for `PUT /projects/:id/project-user-roles`; update SSO exchange side effects to mention `itso` preservation.
- **`docs/backend/samples.md`** — add a curl example for `PUT /projects/:id/project-user-roles` showing how a service account syncs ITSO assignments.

## Files to Modify

| File | Change |
|---|---|
| `backend/alembic/versions/0020_migrate_profile_owner_to_itso.py` | New migration |
| `backend/app/models/project.py` | Drop `profile_owner` / `profile_owner_user` |
| `backend/app/schemas/project.py` | `profile_owner` → `itso` |
| `backend/app/schemas/user.py` | Add `ProjectUserRoleAssignment` |
| `backend/app/services/project_service.py` | Multi-role sync, approval auth, new helper |
| `backend/app/services/user_service.py` | Multi-role AD sync cleanup |
| `backend/app/services/jira_service.py` | Remove `profile_owner_user` refs |
| `backend/app/routers/projects.py` | Serialize `itso`, add new endpoint |
| `frontend/src/types/index.ts` | `profileOwner` → `itso` |
| `frontend/src/services/projects.ts` | `profile_owner` → `itso` |
| `frontend/src/pages/ProjectsPage.tsx` | `profileOwner` → `itso` |
| `frontend/src/pages/ProjectDetailsPage.tsx` | `profileOwner` → `itso` |
| `frontend/src/data/mock.ts` | `profileOwner` → `itso` |
| `backend/scripts/seed_data/projects.json` | Remove `profile_owner` |
| `backend/scripts/seed.py` | Remove `profile_owner` |
| `docs/backend/database.md` | Schema docs update |
| `docs/shared/data-model.md` | `profileOwner` → `itso` |
| `docs/shared/sso-configuration.md` | Multi-role sync docs |
| `docs/backend/api.md` | New endpoint + `itso` field |
| `docs/backend/samples.md` | Add ITSO sync sample |

## Steps

- [ ] Create Alembic migration to migrate `profile_owner` → `project_users(role='itso')` and drop column.
- [ ] Update `Project` model: remove `profile_owner` / `profile_owner_user`.
- [ ] Update `project_service._sync_project_user_roles` to merge governance roles with existing non-governance roles.
- [ ] Update `project_service._check_approval_authority` for comma-separated role containment.
- [ ] Add `project_service.update_project_user_roles` helper.
- [ ] Update `user_service.sync_user_projects` to strip `member` token from multi-role strings.
- [ ] Update `jira_service` to derive ITSO from `project_users`.
- [ ] Update `ProjectListItem` / `ProjectDetail` schemas: `profile_owner` → `itso`.
- [ ] Update `projects.py` router: serialize `itso`, add `PUT /{id}/project-user-roles`.
- [ ] Update frontend types, services, pages, and mock data.
- [ ] Update seed scripts and docs (`database.md`, `data-model.md`, `sso-configuration.md`, `api.md`, `samples.md`).

## Verification

1. Run Alembic migration and verify `projects.profile_owner` is gone and `project_users` has new `itso` rows.
2. Start the backend; call `GET /api/v1/projects` and confirm `itso` appears instead of `profile_owner`.
3. Call `PUT /api/v1/projects/{id}/project-user-roles` with a service account API key; verify roles are upserted and unlisted users are untouched.
4. Save `applicationOverview` via `PATCH /api/v1/projects/{id}/sections/applicationOverview` and confirm existing `itso` roles are preserved.
5. Trigger OAuth login for an AD group member and confirm `itso` roles are preserved while stale `member` associations are cleaned.
6. Open frontend project details and confirm "ITSO" label appears and no drawer allows editing it.
