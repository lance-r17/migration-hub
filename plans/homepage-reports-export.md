# Plan: Add Project Resources & Dependencies Export to HomePage

## Context
The HomePage already has an "Export Report" dropdown (visible to `platform_migration_lead` users) that currently exports an **Estimated Effort Report**. We need to add two more reports:
1. **Project Resources Report** — exports all cloud resources across all projects
2. **Project Dependencies Report** — exports all upstream/downstream dependencies across all projects

## Current State
- Export logic lives in `frontend/src/lib/export-report.ts`
- UI dropdown lives in `frontend/src/pages/HomePage.tsx`
- `getProjects(['basic', 'resources'])` already returns `cloud_resources` in list items
- `dependencies` is **only** available in the full project detail (`ProjectDetail` / `getProject(id)`), not in list items

## Approach
**Option A** (add `dependencies` to the backend list endpoint) is the most efficient path. `dependencies` is a JSON column already queried by SQLAlchemy; we only need to include it in the Pydantic schema and serializer. This lets us fetch all projects + dependencies in a single `getProjects(['basic', 'dependencies'])` call.

### Resources Report Columns
| Column | Source |
|--------|--------|
| Project ID | `project.id` |
| Project Name | `project.name` |
| Resource ID | `resource.resourceId` |
| Resource Name | `resource.name` |
| Product | `resource.product` |
| Product Category | looked up via `fetchProductCategoryMap()` |
| Resource Set | `resource.resourceSet` |
| Sub Application | `resource.subApplication` |
| Target Resource ID | `resource.targetResourceId` |
| Sync Status | `resource.syncStatus` |
| Need Migration | `resource.needMigration` |
| Migration Completed | `resource.migrationCompleted` |
| Jira Subtask Key | `resource.jiraSubtaskKey` |
| *Dynamic spec columns* | Each unique key found in `resource.specs` across all resources becomes its own column |

### Dependencies Report Columns
| Column | Source |
|--------|--------|
| Project ID | `project.id` |
| Project Name | `project.name` |
| Dependency Type | `Upstream` or `Downstream` |
| Dependency ID | `entry.id` |
| Dependency Name | `entry.name` |
| BA ID | `entry.baId` |
| Contact Email | `entry.contactEmail` |
| Hosting | `entry.hosting` |
| Notes | `entry.notes` |

### Scope
Both reports will cover **all projects** (following the existing `exportEstimatedEffortReport` pattern) and will be available only to `platform_migration_lead` users. 

## Proposed Approach
1. **Backend** — Add `dependencies` to `ProjectListItem` schema and `_project_list_item` serializer
2. **Frontend types** — Add `dependencies` to `ProjectListItemApi` and `fromApiListItem` mapper
3. **Frontend exports** — Add `exportProjectResourcesReport()` and `exportProjectDependenciesReport()` to `export-report.ts`
4. **Frontend UI** — Add two `DropdownMenuItem`s in `HomePage.tsx`

## Files to Modify
| File | Change |
|------|--------|
| `backend/app/schemas/project.py` | Add `dependencies` to `ProjectListItem` |
| `backend/app/routers/projects.py` | Add `dependencies` handling in `_project_list_item` |
| `frontend/src/services/projects.ts` | Add `dependencies` to `ProjectListItemApi` and `fromApiListItem` |
| `frontend/src/lib/export-report.ts` | Add two new export functions |
| `frontend/src/pages/HomePage.tsx` | Add dropdown items for the two new reports |

## Reuse
- `getProjects(fields)` service call pattern
- `XLSX` export patterns (autofilter, column widths, freeze panes, named ranges) from existing `exportEstimatedEffortReport`
- Existing `DropdownMenu` in `HomePage.tsx`
- `toast` loading/success/error patterns
