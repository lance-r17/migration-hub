# Multi-Role Support — Shaping Notes

## Scope

The backend already stores multiple roles as a comma-separated string in `users.role` and `auth.py._user_has_admin_role()` already handles multi-role checks by splitting on commas. The OAuth flow already joins matched AD group roles with commas. The only gap was the frontend, where `User.role` was typed as an optional string and every check used strict string equality. A user holding two roles would never match any guard.

This change converts `User.role` to `string[]` on the frontend via a `fromApi` mapper and updates every role-check site.

## Decisions

- `role` is non-optional (`string[]`, defaults to `[]`) — avoids optional chaining noise at every check site
- Parsing happens in `services/users.ts` `fromApi()` — consistent with the existing fromApi/toApi mapper pattern used elsewhere in the service layer
- Mock data updated to arrays in-place; no separate conversion needed since mock paths bypass `fromApi`
- No admin UI for manual role editing — roles are assigned purely via OAuth/AD group regex mappings at login
- No backend changes needed — storage, auth guards, and OAuth role-assignment are already multi-role capable

## Context

- **Visuals:** None
- **References:** Existing fromApi/toApi mapper pattern in projects, billing, embargos service files
- **Product alignment:** N/A — no product folder constraints apply

## Standards Applied

No standards index exists in this repo.
