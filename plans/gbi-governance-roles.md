# Add GBI Champion & GBI Champion Delegate Governance Roles

## Context
We need to add two new project-level governance roles, similar to the existing `technical_lead`, that can only be assigned:

- via the **User Accounts** page (`frontend/src/pages/UserAccountsPage.tsx`), or
- via the **Governance Roles API** (`PUT /api/v1/projects/{project_id}/governance-roles`).

Current governance roles: `technical_lead`, `business_owner`, `dba_data_owner`.  
They are stored per-project in `project_users.role` as comma-separated strings and surfaced through `Project.governance_roles`.

## Decisions (confirmed)

- Labels: **GBI Champion** (`gbi_champion`) and **GBI Champion Delegate** (`gbi_champion_delegate`).
- They are **not** part of the approval/sign-off workflow.
- They are **read-only** on the Project Details **Contacts & Ownership** card (display only; never editable through the drawer).
- They are **included** in the Project Details export report.
- They are **exclusive** to each other: a user cannot hold both GBI Champion and GBI Champion Delegate on the same project, and each project can have at most one of each.

## Approach

Extend the existing governance-role plumbing end-to-end without changing the core assignment model (`project_users.role` as a comma-separated string).

1. **Backend serialization**  
   Add `gbi_champion` and `gbi_champion_delegate` to `GovernanceRolesOut` and to `_governance_roles_from_project_users` so API responses include the new role holders.

2. **Backend API contract**  
   Extend `GovernanceRolesPatch` with `gbiChampionId` and `gbiChampionDelegateId`; extend `update_governance_roles` to pass these keys through the `assignments` dict.

3. **Backend service logic**  
   Add `gbi_champion` and `gbi_champion_delegate` to the protected governance-role set in `project_service.update_governance_roles`.  
   Enforce exclusivity: reject a request that assigns both new roles to the same user, or a user already holding one of the new roles when being assigned the other.

4. **Frontend types**  
   Add `gbiChampion` and `gbiChampionDelegate` to `GovernanceRoles` and `GovernanceRolesApi`.

5. **Frontend API mapping**  
   Update `mapGovernanceRoles` and `updateGovernanceRoles` in `services/projects.ts` to read/write the new fields and pass the new payload keys.

6. **User Accounts page**  
   Add the two role entries to `GOVERNANCE_ROLES`, include them in the project-role summary/tooltip, and update the assignment/removal payload builders to set/clear `gbiChampionId` and `gbiChampionDelegateId`. Add a lightweight client-side exclusivity check when assigning, and surface the backend error if it occurs.

7. **Project Details Contacts card**  
   Display the new roles read-only in `ApplicationOverviewSection` (under the existing TL/BO/DBA blocks). Do **not** add them to `ContactsOwnershipDrawer` so they remain assignable only through User Accounts or the API.

8. **Export report**  
   Add GBI Champion and GBI Champion Delegate name/email columns to `exportProjectDetailsReport`.

9. **Verification**  
   Manually test assignment, reassign, and removal via User Accounts; call the API directly; confirm the export includes the new columns; confirm the Contacts card displays them read-only.

## Files to modify

- `backend/app/schemas/project.py`
- `backend/app/routers/projects.py`
- `backend/app/services/project_service.py`
- `frontend/src/types/index.ts`
- `frontend/src/services/projects.ts`
- `frontend/src/pages/UserAccountsPage.tsx`
- `frontend/src/components/project/ApplicationOverviewSection.tsx`
- `frontend/src/lib/export-report.ts`

## Reuse

- Existing governance-role serialization in `routers/projects.py` `_governance_roles_from_project_users`.
- Existing `project_service.update_governance_roles` role-preservation logic (governance roles are stripped from the old holder and added to the new holder while keeping non-governance roles like `member`/`itso`).
- Existing `updateGovernanceRoles` frontend service and `UserAccountsPage` assignment/reassign flow.

## Steps

- [ ] 1. Add `gbi_champion` / `gbi_champion_delegate` to `GovernanceRolesOut` and `GovernanceRolesPatch` in `backend/app/schemas/project.py`.
- [ ] 2. Extend `_governance_roles_from_project_users` and `update_governance_roles` endpoint in `backend/app/routers/projects.py` to include the new roles.
- [ ] 3. Extend `project_service.update_governance_roles` governance set and add exclusivity validation for the two new roles.
- [ ] 4. Add `gbiChampion` / `gbiChampionDelegate` to `GovernanceRoles` in `frontend/src/types/index.ts`.
- [ ] 5. Update `frontend/src/services/projects.ts` interfaces, mapper, and `updateGovernanceRoles` payload.
- [ ] 6. Update `frontend/src/pages/UserAccountsPage.tsx`: add roles to `GOVERNANCE_ROLES`, include in summary/tooltip, and handle assignment/removal payloads.
- [ ] 7. Add read-only display of the new roles in `frontend/src/components/project/ApplicationOverviewSection.tsx`.
- [ ] 8. Add new columns to `exportProjectDetailsReport` in `frontend/src/lib/export-report.ts`.
- [ ] 9. Verify end-to-end: assign/reassign/remove via User Accounts and the API, check Project Details display, and check the export.

## Verification

1. Open **User Accounts** → edit a user → assign/unassign **GBI Champion** and **GBI Champion Delegate** to projects. Reassign a role from one user to another and confirm the previous user loses it.
2. Call `PUT /api/v1/projects/{id}/governance-roles` with `gbiChampionId` and `gbiChampionDelegateId` and confirm the response reflects the assignments.
3. Confirm that `project_users.role` stores the new snake_case tokens and preserves other roles (e.g. `member`, `itso`).
4. On the **Project Details** page, confirm the **Contacts & Ownership** card shows the two new roles read-only (no edit inputs).
5. Generate the **Project Details** export and confirm the new GBI Champion / GBI Champion Delegate columns are populated.
6. Confirm exclusivity: the backend rejects assigning both roles to the same user; the UI prevents accidental double assignment where practical.
