# Plan: Add Global "Engagement Reviewer" Role and Per-Engagement Reviewer Assignment

## Context
We need a new global role `engagement_reviewer` that behaves like the existing `bgi_cloud_lead` role:
- Admins can assign it to new or existing users through a dedicated admin page.
- It must survive the custom OAuth/SSO role-merge (i.e., be preserved when SSO refreshes the user's roles).
- In engagement management, each engagement should support multiple assigned reviewers.

The existing pattern for `bgi_cloud_lead` gives us a clear model: role stored as a comma-separated token in `users.role`, a dedicated `/admin/bgi-cloud-leads` page, and an SSO merge that protects locally-assigned roles.

## Decisions (provided by user)
1. Reviewers have **view access to all engagements** and can open them, but are **read-only**.
2. **Platform Migration Leads** assign reviewers; the reviewer list is shown as an additional group under **Participants** in `EngagementDrawer`.
3. `engagement_reviewer` is **preserved during SSO role merge** like `bgi_cloud_lead`; it is **not auto-assigned** via `OAUTH_ROLE_MAPPINGS`.
4. Deleting an entry on `/admin/engagement-reviewers` **removes only the role**, not the user.

## Approach
1. **Role plumbing**: Add `engagement_reviewer` auth helpers and update the SSO merge to preserve both `bgi_cloud_lead` and `engagement_reviewer`.
2. **Admin management**: Add backend endpoints under `/admin/engagement-reviewers` and a frontend page `/admin/engagement-reviewers` mirroring the BGI Cloud Leads page (no BGI-specific fields, delete removes role only).
3. **Engagement data model**: No schema change is needed — reviewers are assigned by selecting them as **Participants** in the engagement drawer.
4. **Engagement UI**: Show **Engagement Reviewers** as a new checkbox group under Participants in `EngagementDrawer`, populated from users with the `engagement_reviewer` role.
5. **Navigation / view scope**: Show the **Engagements** sidebar item to users with the `engagement_reviewer` role; load all projects on the Engagement Calendar for reviewers while keeping the Dashboard scoped to assigned projects.
6. **Backend enforcement**: Restrict `engagement` section updates to Platform Migration Leads or admins so reviewers cannot edit via the API.

## Files to Modify
- `backend/app/auth.py`
- `backend/app/routers/oauth.py`
- `backend/app/routers/admin.py`
- `backend/app/schemas/user.py`
- `backend/app/models/engagement.py`
- `backend/app/services/project_service.py`
- `frontend/src/App.tsx`
- `frontend/src/pages/AdminHome.tsx`
- `frontend/src/pages/EngagementReviewersPage.tsx` (new)
- `frontend/src/services/adminUsers.ts`
- `frontend/src/types/index.ts`
- `frontend/src/services/projects.ts`
- `frontend/src/components/engagement/EngagementDrawer.tsx`
- `frontend/src/hooks/use-projects.ts` (if filtering by reviewer)

## Reuse
- `_user_has_bgi_cloud_lead_role` pattern in `backend/app/auth.py`.
- BGI Cloud Leads CRUD endpoints in `backend/app/routers/admin.py`.
- `BgiCloudLeadsPage.tsx` as the UI template for the new admin page.
- Engagement serialization/update flow in `backend/app/services/project_service.py`.
- Existing participant checkbox group in `frontend/src/components/engagement/EngagementDrawer.tsx`.
- `useProjects` hook in `frontend/src/hooks/use-projects.ts`.

## Steps
- [x] Add `_user_has_engagement_reviewer_role` helper and `require_engagement_reviewer` dependency in `backend/app/auth.py`.
- [x] Update `backend/app/routers/oauth.py` to preserve `engagement_reviewer` during role merge.
- [x] Add `/admin/engagement-reviewers` endpoints in `backend/app/routers/admin.py` (list, create/reuse, update, delete-removes-role) and add `EngagementReviewerCreate` schema in `backend/app/schemas/user.py`.
- [x] Update `backend/app/services/project_service.py` `_replace_engagement` and enforce that only Platform Migration Leads/admins can modify the engagement section.
- [x] (No engagement schema type changes required; reviewers are stored as participant IDs.)
- [x] Add admin page route in `frontend/src/App.tsx` and card in `frontend/src/pages/AdminHome.tsx`.
- [x] Create `frontend/src/pages/EngagementReviewersPage.tsx` (based on `BgiCloudLeadsPage.tsx`, no BGI tree, delete removes role).
- [x] Add service functions in `frontend/src/services/adminUsers.ts` for the new endpoints.
- [x] Update `frontend/src/components/engagement/EngagementDrawer.tsx` to show a new "Engagement Reviewers" participant group populated from users with the `engagement_reviewer` role.
- [x] Update `frontend/src/components/layout/AppSidebar.tsx` to show **Engagements** for users with `engagement_reviewer`.
- [x] Update `frontend/src/hooks/use-projects.ts` to accept an optional `forceAll` flag; use it in `EngagementCalendarPage` so reviewers load all projects for the calendar while the Dashboard stays scoped.
- [x] Run backend syntax checks and tests; verify frontend TypeScript compilation.

## Completion Notes
All implementation steps are complete. Verification performed:
- Backend Python files compile cleanly.
- Frontend TypeScript compiles without new errors related to this change.
- Backend test suite passes all non-pre-existing tests (22 passed, 1 skipped; 6 errors are a pre-existing missing fixture in `test_category_milestones.py`).

Runtime end-to-end verification (admin assignment, SSO login, engagement edit/reviewer view) should be performed in a running environment before release.

## Verification
- Admin can create a new user and assign `engagement_reviewer`.
- Admin can assign the role to an existing user.
- Deleting from `/admin/engagement-reviewers` removes the role but keeps the user.
- After SSO login, a user manually assigned `engagement_reviewer` keeps the role.
- A Platform Migration Lead can open an engagement, see the Engagement Reviewers group under Participants, select multiple reviewers, and save.
- Saved reviewer IDs persist and reload correctly.
- An `engagement_reviewer` user sees the Engagements menu, can open engagements/notes, and cannot edit them (drawer/notes are read-only).
- Backend rejects engagement section PATCH requests from non-lead/non-admin users.
