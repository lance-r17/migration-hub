# Cloud Resource Access Control — Shaping Notes

## Scope

Add two layers of access control to `CloudResourceEditDrawer`:
1. **Membership gate** — Only project members (`project.team`) can take any action (save or mark sync completed). Non-members see the drawer as read-only.
2. **Phase gate** — Before sign-off: only "Save Changes" is available. Post sign-off (`signed-off` / `completed`): only "Mark Sync Completed" is available.

## Decisions

- "Project users" is defined as `project.team: TeamMember[]` — membership is checked by matching `TeamMember.id` against `user.id` from `useCurrentUser()`.
- `completed` status is treated the same as `signed-off` (post sign-off behavior).
- Non-members see the drawer in read-only mode (no action buttons, just Cancel), not blocked from opening it.
- `isProjectMember` is computed in `ProjectDetailsPage` and threaded down — avoids adding a data-fetch concern to the drawer.

## Context

- **Visuals:** None
- **References:** `ContactsOwnershipDrawer` uses `useProjectUsers(projectId)` for a similar member-check pattern; `ProjectDetailsPage` uses `project.approvals` + `user.id` for sign-off permissions.
- **Product alignment:** N/A
