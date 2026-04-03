# Role Assignment Validation — Shaping Notes

## Scope

Enforce two business rules for project role assignments (Business Owner, Technical Lead, DBA):
1. A user cannot hold more than one of {BO, TL, DBA} on the same project
2. A user with `role === 'Platform Migration Lead'` cannot be BO or TL on any project

Fix existing mock data that violates these rules, then add validation to the ContactsOwnershipDrawer UI.

## Decisions

- **Validation placement**: UI layer (ContactsOwnershipDrawer), not service/store — prevents invalid data from being entered
- **Mechanism**: Filter dropdowns dynamically (users already selected elsewhere are hidden), plus explicit save guard with error message
- **PML exclusion scope**: BO and TL only — DBA is an operational role, not a governance one
- **SectionEditDrawer**: Add `saveDisabled?: boolean` prop to support disabling the Save button
- **Mock fixes**: 2 targeted field changes (no structural changes to projects)

## Context

- **Visuals:** None
- **References:** ContactsOwnershipDrawer.tsx, SectionEditDrawer.tsx, mock.ts

## Standards Applied

- None (UI validation only, no API surface)
