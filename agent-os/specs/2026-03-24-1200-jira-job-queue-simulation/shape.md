# Jira Job Queue Simulation — Shaping Notes

## Scope

Simulate async event-driven Jira story + sub-task creation after PML sign-off. Surface the job progress in the Compute & Resources section card.

## Decisions

- 5s → processing, 30s → completed (mimics real queue consumer latency)
- Per-row spinner column in resource table during processing
- Success banner replaces pending banner; shows N sub-tasks linked
- `subtaskKeys` keyed by resourceId (resource-level/custom) or category name (category-level)
- Category-level: all resources in same category share one sub-task key
- Frontend polls every 5s via setInterval while status is pending/processing

## Context

- **Visuals:** None
- **References:** `store.ts`, `use-projects.ts`, `CloudResourcesSection.tsx`, `ProjectDetailsPage.tsx`
- **Product alignment:** Supports full Jira traceability — Epic=Wave → Story=Project → Sub-tasks=CloudResources
