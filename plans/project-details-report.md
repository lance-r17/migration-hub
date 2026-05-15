# Plan: Project Details Report Export

## Context
Add a new **Project Details Report** to the HomePage export dropdown. One row per project, containing all information **except** Estimated Effort, Resources, Dependencies, and Sign-off.

## Final Column List

### Basic / Header (10 cols)
1. Project ID
2. Project Name
3. Status
4. Blocked Reason
5. Description
6. Migration Wave
7. Jira Story Key
8. Survey Submitted At
9. ITSO
10. ITSO Email
11. ITSO Delegate
12. ITSO Delegate Email

### Application Overview (13 cols)
13. Application Name
14. Short Name
15. Business Function
16. User Base Type
17. User Base Count
18. Application Tier
19. BA ID
20. IBS
21. BPS
22. IITA Applicability
23. Software Origin
24. Migration Strategy
25. Service Line

### Governance Roles (6 cols)
26. Technical Lead Name
27. Technical Lead Email
28. Business Owner Name
29. Business Owner Email
30. DBA Data Owner Name
31. DBA Data Owner Email

### Availability & Resilience (4 cols)
32. RTO
33. RPO
34. 3-AZ Readiness
35. Health Check Endpoints (comma-separated)

### Data & Persistence (8 cols)
36. Database Types (comma-separated)
37. Total Data Volume
38. Data Growth Rate
39. Backup Required During Migration
40. Last Restore Test
41. Data Residency
42. Encryption At Rest
43. Stateful Components (comma-separated)

### Non-Functional Requirements (3 cols)
44. Peak Load
45. Autoscaling
46. Licensing

### Migration Constraints (6 cols + dynamic)
47. Regular Migration Window
48. Preferred Migration Window (comma-separated)
49. Earliest Start Date
50. Latest End Date
51. CR Duration (hours)
52. SNOW CI Groups (comma-separated)
53+. Change Freeze Period N Name / From / To (dynamically flattened)

### Target Architecture (5 cols)
54. Re-Architecture Needed
55. 3-AZ Topology
56. DNS / IP Changes
57. New Services Required (comma-separated)
58. Architecture Diagram

## Backend Changes
Add missing JSON columns to `ProjectListItem` so they are returned by `GET /api/v1/projects?fields=...`:
- `governance_roles`
- `availability`
- `data_persistence`
- `nfrs`
- `target_architecture`

`migration_constraints` and `application_overview` are already present.

## Files to Modify
| File | Change |
|------|--------|
| `backend/app/schemas/project.py` | Add 5 fields to `ProjectListItem` |
| `backend/app/routers/projects.py` | Add 5 fields to `_project_list_item` serializer |
| `frontend/src/services/projects.ts` | Add 5 fields to `ProjectListItemApi` and `fromApiListItem` |
| `frontend/src/lib/export-report.ts` | Add `exportProjectDetailsReport()` |
| `frontend/src/pages/HomePage.tsx` | Add dropdown item |

## Reuse
- `getProjects(fields)` pattern
- `XLSX` export helpers (autofilter, freeze panes, column widths)
- `formatDate` from existing `export-report.ts`
- Existing `DropdownMenu` in `HomePage.tsx`
