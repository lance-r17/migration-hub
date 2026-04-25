# References for Role snake_case Conversion

## Role checking — backend

- **Location:** `backend/app/auth.py:234–252`
- **Relevance:** `_ADMIN_ROLES` set and `_user_has_admin_role()` — only place that defines which roles grant admin access
- **Key patterns:** Set membership check; handles comma-separated role string

## Role checking — frontend

- **Location:** `frontend/src/components/drawers/ContactsOwnershipDrawer.tsx:35–36`
- **Relevance:** `isPlatformLead()` helper — canonical pattern for role check on User object
- **Key patterns:** `user.role.includes('...')` on the `string[]` array

## Service layer role parsing

- **Location:** `frontend/src/services/users.ts:11–17` (`userFromApi`)
- **Relevance:** Converts comma-separated backend string → `string[]` on frontend; no change required

## Alembic migration pattern

- **Location:** `backend/alembic/versions/0005_add_planning_jsonb_and_wave_color.py`
- **Relevance:** Example of `op.execute()` with raw SQL in a data migration

## SignOffModal role config

- **Location:** `frontend/src/components/modals/SignOffModal.tsx:19–23, 73–74`
- **Relevance:** `roles` array with `id`/`label`/`icon`; matching against `currentUserRole`
