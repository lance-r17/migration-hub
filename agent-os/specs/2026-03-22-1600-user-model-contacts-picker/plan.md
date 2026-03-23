# User Model + User-ID Links in ApplicationOverview

See full plan at `/home/node/.claude/plans/quizzical-noodling-book.md`.

## Summary

- Added `User` interface to `types/index.ts`
- Replaced `ContactPerson` embedded objects in `ApplicationOverview` with `businessOwnerId`, `technicalLeadId`, `dbaDataOwnerId` (User ID references)
- Added `mockUsers: User[]` (15 users) to `mock.ts`
- `ApplicationOverviewSection` resolves users from `mockUsers` by ID at render time
- `ContactsOwnershipDrawer` simplified to 3 Select pickers — no more free-text sub-fields
