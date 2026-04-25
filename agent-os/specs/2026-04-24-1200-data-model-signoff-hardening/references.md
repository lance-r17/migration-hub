# References for Data Model & Sign-off Hardening

## Similar Implementations

### `_replace_risks()` / `_replace_resources()` pattern

- **Location:** `backend/app/services/project_service.py:259-256`
- **Relevance:** Same delete-and-re-insert pattern used for `_replace_approvals()`. The validation additions follow the same structure.
- **Key patterns:** Delete existing rows, flush, re-insert from payload; audit log entry appended after.

### `selectinload` eager-load chain

- **Location:** `backend/app/services/project_service.py:100-106` (`_project_options()`)
- **Relevance:** Pattern for adding nested eager loads (project_users → user).
- **Key patterns:** `selectinload(Project.project_users).selectinload(ProjectUser.user)`

### `require_admin` dependency

- **Location:** `backend/app/auth.py`
- **Relevance:** Existing role-check pattern. We use the same `users.role` check for PML auth in `_check_approval_authority()`.

### `ContactsOwnershipDrawer` role filter rules

- **Location:** `frontend/src/components/drawers/ContactsOwnershipDrawer.tsx:54-80`
- **Relevance:** UI-layer validation we're complementing with backend enforcement. The same role semantics (TL/BO/DBA from applicationOverview, PML from users.role) are mirrored in backend auth.

### `SECTION_COLUMN_MAP`

- **Location:** `backend/app/services/project_service.py:17-33`
- **Relevance:** The `"team"` entry is removed. The `"applicationOverview"` entry triggers the new `_sync_project_user_roles()` call.
