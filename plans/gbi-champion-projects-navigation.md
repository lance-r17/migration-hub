# GBI Champion / Delegate access to the Projects page

## Context

The app already has GBI Champion and GBI Champion Delegate as **project-level governance roles** (stored in `project_users.role` as `gbi_champion` / `gbi_champion_delegate`).

The request is to let users who hold either of those roles on at least one project:
1. See the **Projects** link in the navigation bar.
2. Open the **Projects page** (`frontend/src/pages/ProjectsPage.tsx`).
3. See only the projects assigned to them.
4. If they also hold a wider-scoped role (e.g. Platform Migration Lead, BGI Cloud Lead), the wider scope should win and they should see the larger project list.

## Current behaviour

- `AppSidebar` shows **Projects** only when `user.role` contains `platform_migration_lead`.
- BGI Cloud Leads are hard-coded to see Dashboard, Projects, Wave Gantt, and Data Migration.
- `ProjectsPage` blocks access unless the user is a Platform Migration Lead or BGI Cloud Lead.
- `useProjects` fetches all projects for leads and `getProjectsForUser(user.id)` for everyone else.
- `getProjectsForUser` already returns every project where the user has a `project_users` row, so it naturally covers GBI Champion/Delegate assignments.
- The frontend `User` object does **not** know which project-level roles the current user holds, so the nav cannot conditionally show the Projects link for GBI champions yet.

## Open questions (resolved)

1. **Scope of “assigned to him”**: Any project where the user has a `project_users` row (not only GBI Champion/Delegate projects).
2. **Admin + GBI Champion**: Yes, the wider admin scope applies (all projects).
3. **Project details page**: Clicking a project row from the list also opens the project details page.

## Examples / role matrix

| User roles | Nav shows Projects? | Projects page data scope | Notes |
| --- | --- | --- | --- |
| Only `gbi_champion` on project A | Yes | Only project A | GBI champion triggers the feature. |
| Only `gbi_champion_delegate` on project B | Yes | Only project B | GBI champion delegate also triggers the feature. |
| `gbi_champion` on A + `technical_lead` on B | Yes | A and B | Any `project_users` row counts. |
| `gbi_champion` + `platform_migration_lead` | Yes | All projects | Wider platform-lead scope wins. |
| `gbi_champion` + `bgi_cloud_lead` (with BGI nodes) | Yes | All projects under the user’s BGI nodes | Wider BGI-lead scope wins. |
| `gbi_champion` + `admin` | Yes | All projects | Wider admin scope wins. |
| Only `admin` (no GBI champion/delegate) | Yes | All projects | Admin is treated as a wide-scope role for the Projects page. |
| No lead/admin/GBI project roles | No | N/A | Existing access-restricted screen. |

## Proposed approach

1. **Backend**: expose the current user’s project-level roles on `/api/v1/users/me` so the frontend can decide whether the user is a GBI Champion/Delegate.
2. **Frontend**: use the new field to show the Projects nav item and to allow the Projects page to render for GBI Champion/Delegate holders, admins, platform leads, and BGI cloud leads.
3. **Frontend**: treat `admin`, `platform_migration_lead`, and `bgi_cloud_lead` as wide-scope roles in `useProjects` (all projects); otherwise fetch user-scoped projects.

## Files to modify

- `backend/app/schemas/user.py` – add `project_roles` to `UserOut`.
- `backend/app/services/user_service.py` – add `get_project_roles()` helper.
- `backend/app/routers/users.py` – populate `project_roles` in `GET /users/me`.
- `frontend/src/types/index.ts` – add `projectRoles?: string[]` to `User`.
- `frontend/src/services/users.ts` – map `project_roles` from the API into `User.projectRoles`.
- `frontend/src/components/layout/AppSidebar.tsx` – show **Projects** for wide-scope roles and for GBI Champion/Delegate holders.
- `frontend/src/pages/ProjectsPage.tsx` – allow access for GBI Champion/Delegate holders and admins.
- `frontend/src/data/mock.ts` (optional) – add `projectRoles` to `mockCurrentUser` so the new nav path can be exercised locally.

## Reuse

- `user_service.get_projects_for_user` / `project_service.get_all` already join `project_users` and accept `user_id`, so the “assigned projects” fetch can be reused.
- `AppSidebar` already has a role-based `visibleItems` filter; we can extend the Projects item logic.
- `useProjects` already distinguishes leads from non-leads; no new hook is needed.

## Steps

- [ ] 1. Backend: add `project_roles: list[str] = []` to `UserOut` and compute it from `project_users.role`.
- [ ] 2. Backend: update `GET /api/v1/users/me` to return the current user with `project_roles` populated.
- [ ] 3. Frontend: add `projectRoles` to the `User` type and `userFromApi` mapper.
- [ ] 4. Frontend: in `AppSidebar`, show the Projects nav item for wide-scope roles (`admin`, `platform_migration_lead`, `bgi_cloud_lead`) and when the user is a GBI Champion/Delegate (`projectRoles` includes `gbi_champion` or `gbi_champion_delegate`).
- [ ] 5. Frontend: in `ProjectsPage`, allow rendering for GBI Champion/Delegate holders **and admins**, updating the access-restricted message accordingly.
- [ ] 6. Frontend: treat `admin`, `platform_migration_lead`, and `bgi_cloud_lead` as wide-scope roles in `useProjects` (all projects); otherwise fetch user-scoped projects.
- [ ] 7. Verification: unit / manual checks for nav visibility, page access, and project list scope for a user with only GBI Champion, with GBI Champion + Platform Lead, with GBI Champion + BGI Cloud Lead, and with GBI Champion + Admin.

## Verification

1. Log in as a user who only has `gbi_champion` on one project → Projects link appears, page loads, and only that project is listed.
2. Log in as a user with both `gbi_champion` and `platform_migration_lead` → Projects link appears and the full project list is shown (wider scope wins).
3. Log in as a user with both `gbi_champion` and `bgi_cloud_lead` → Projects link appears and the BGI-scoped project list is shown.
4. Log in as a user with both `gbi_champion` and `admin` → Projects link appears and the full project list is shown (admin scope wins).
