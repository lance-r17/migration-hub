# Standards for Fix: Approval Authority Sync

## api/error-handling

A 400 Bad Request should only be returned when the client sends an invalid request. Returning 400 due to a backend sync failure (governance role not persisted) is incorrect — the client sent a valid approval for a role they legitimately hold. The fix ensures the server state is consistent with the authoritative source of truth (application_overview) before the request is processed.

## Database integrity

When inserting a new ProjectUser, verify the referenced User exists first (via `session.get(User, uid)`) to avoid foreign key constraint errors in cases where the governance-role ID references a user not yet in the local database.
