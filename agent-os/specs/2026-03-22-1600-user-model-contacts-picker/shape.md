# User Model & Contacts Picker — Shaping Notes

## Scope

Introduce a global `User` model and directory (`mockUsers`). Refactor `ApplicationOverview` to store contacts as user ID references instead of embedded `ContactPerson` objects. Update the Contacts & Ownership edit drawer to use Select pickers backed by the user directory.

## Decisions

- `ApplicationOverview` contact fields renamed to `businessOwnerId`, `technicalLeadId`, `dbaDataOwnerId` (explicit ID semantics)
- `ContactPerson` interface removed — no longer needed
- `mockUsers` is single source of truth; display resolves full profile at render time
- No manual override fields in drawer — contacts must come from the directory
- `User` type is exported from `@/types` for future reuse

## Context

- **Visuals:** None
- **References:** `RiskEditDrawer` (Select pattern), existing `ContactsOwnershipDrawer`
- **Product alignment:** Cleaner data model; prevents contact info drift

## Standards Applied

None defined at time of writing.
