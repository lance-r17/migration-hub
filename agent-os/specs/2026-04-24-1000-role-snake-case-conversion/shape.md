# Role snake_case Conversion — Shaping Notes

## Scope

Convert all stored/compared role string values to snake_case. Preserve human-readable display labels via inline label maps in the 4 UI components that render role text. No changes to role logic, access rules, or auth flow.

## Decisions

- `"admin"` and `"member"` are unchanged — already snake_case
- `Approval.role` is also converted (same 3 values, stored in DB per-project)
- Email template `RecipientConfig.role` is also converted
- `ConfigTab` RECIPIENT_ROLES array becomes `{ value, label }` objects to separate stored value from display
- SignOffModal `roles` array ids change from kebab-case to snake_case; matching logic flips from `label` to `id`
- No shared role constants module — inline label maps (3–4 lines) in each display component
- DB migration uses `op.execute()` SQL with `REPLACE()` for users.role (handles comma-separated); `CASE` for approvals.role (single value)
- Alembic migration includes downgrade path

## Context

- **Visuals:** None
- **References:** existing migrations 0001–0007; `_user_has_admin_role()` in auth.py; `userFromApi()` in users.ts
- **Product alignment:** N/A — internal identifier hygiene
