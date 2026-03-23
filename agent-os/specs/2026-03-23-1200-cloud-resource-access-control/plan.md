# Cloud Resource Access Control — Plan

## Context

`CloudResourceEditDrawer` previously allowed any viewer to save changes or mark sync completed. The "Mark Sync Completed" button appeared for any `in-progress`/`migrating` project regardless of the current user's membership. This spec adds two access control layers.

## Rules

| Scenario | Save Changes | Mark Sync Completed | Checkbox |
|---|---|---|---|
| Non-member (any status) | hidden | hidden | disabled |
| Member, pre sign-off | shown | hidden | enabled |
| Member, post sign-off | hidden | shown (if not synced) | disabled |

Post sign-off = `signed-off` or `completed`.

## Changes

### `CloudResourceEditDrawer.tsx`
- Added `isProjectMember: boolean` prop
- Replaced `isMigrationPhase` with `isSignedOff` (`signed-off` | `completed`)
- Derived `canSave = isProjectMember && !isSignedOff(projectStatus)`
- Derived `canMarkSynced = isProjectMember && isSignedOff(projectStatus) && syncStatus !== 'synced'`
- Checkbox `disabled={!canSave}`
- "Save Changes" button only rendered when `canSave`

### `CloudResourcesSection.tsx`
- Added `isProjectMember?: boolean` to `CurrentInfrastructureSectionProps`
- Passed through to `<CloudResourceEditDrawer>`

### `ProjectDetailsPage.tsx`
- Added `const isProjectMember = project.team.some(m => m.id === user?.id)`
- Passed `isProjectMember` to `<CurrentInfrastructureSection>`
