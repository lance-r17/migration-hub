# Role Assignment Validation — Plan

## Violations Fixed

| Project | Before | After |
|---|---|---|
| M-11029 | Frank Miller (u7) = TL + DBA | DBA → Grace Lee (u8) |
| M-77122 | Henry Wilson (u9) = BO (same person as PML) | BO → Karen Lee (u12) |

## Validation Added

ContactsOwnershipDrawer:
- BO dropdown excludes users already selected as TL or DBA, and users with PML role
- TL dropdown excludes users already selected as BO or DBA, and users with PML role
- DBA dropdown excludes users already selected as BO or TL
- Save is disabled + error shown if a violation is detected (defensive guard)

SectionEditDrawer: added `saveDisabled?: boolean` prop.
