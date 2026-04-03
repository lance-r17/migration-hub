# Multi-Section Field Enhancements — Shaping Notes

## Scope

Changes to the Compute & Resources table and the Sign-off Jira sub-task configuration modal.

## Decisions

- Specs column removed from table; shown as tooltip triggered by an Info icon next to the resource name. Icon hidden when no specs.
- Quantity, Availability Zones, and Existing Status fields removed from both the table and the edit drawer.
- Target field semantics changed: `targetStatus: string` (a status label) → `targetResourceId?: string` (a resource ID in the target environment), displayed in monospace like Resource ID.
- Category is no longer stored on each CloudResource. Instead, a `ProductCategoryEntry[]` mapping table is fetched from the backend API (mocked via store). Components call `useProductCategoryMap()` hook to derive category from product at render time.
- "Per Product" added as a 4th grouping mode in the Jira sub-task configurator (Step 2 of the Platform Migration Lead sign-off flow). Groups in-scope resources by product, one sub-task per unique product.

## Context

- **Visuals:** None
- **References:** `CloudResourcesSection.tsx`, `CloudResourceEditDrawer.tsx`, `SignOffModal.tsx`, `jiraJobs.ts`
- **Product alignment:** N/A

## Standards Applied

- N/A (frontend-only change, no new API contracts)
