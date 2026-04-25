# Fix Contacts Empty Users — Shaping Notes

## Scope

Bug fix: pre-existing typo in `users.ts` — `fromApi` called instead of `userFromApi` in the non-mock paths of `getUsers()` and `getProjectUsers()`.

## Decisions

- Single replace_all edit — no other changes needed
- Not related to snake_case role conversion done in the same session
- Mock mode unaffected (mock paths bypass the broken lines entirely)

## Context

- **Visuals:** None
- **References:** `users.ts:11` — `userFromApi` definition
- **Product alignment:** N/A
