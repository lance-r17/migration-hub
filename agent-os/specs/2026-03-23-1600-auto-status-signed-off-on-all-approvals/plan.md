# Auto Status → 'signed-off' When All Approvals Complete

## Context

When all 3 approval roles approved a project, the status was not automatically updating to 'signed-off'. Added logic to `handleConfirm` in `ProjectDetailsPage.tsx` to detect when all approvals are complete and trigger a `saveSection('status', 'signed-off')` call. The existing audit intercept in `use-projects.ts` handles `status_changed` audit entries automatically.

## Change

`frontend/src/pages/ProjectDetailsPage.tsx` — `handleConfirm` function updated to extract `updatedApprovals`, then check `allApproved` after saving and auto-update status if true.
