# Project Details Report — Available Columns for Review

## Context
We want a new **Project Details Report** export (one row per project) that includes **all project information except**:
- Estimated Effort (`migrationEffortEstimation`)
- Resources (`currentInfrastructure` / `cloud_resources`)
- Dependencies (`dependencies`)
- Sign-off (`approvals`)

## Available Columns (Categorized)

Below are all fields that can be flattened into a one-row-per-project Excel sheet. **Array fields** (e.g., risks, team, database types) need a decision on how to represent them.

### 1. Basic / Header
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 1 | Project ID | `project.id` | |
| 2 | Project Name | `project.name` | |
| 3 | Status | `project.status` | e.g. planning, in-progress, completed |
| 4 | Blocked Reason | `project.blockedReason` | Empty if not blocked |
| 5 | Progress (%) | `project.progress` | Overall weighted progress |
| 6 | Setup Progress (%) | `project.stageProgress.setup` | |
| 7 | Survey Progress (%) | `project.stageProgress.survey` | |
| 8 | Sign-off Progress (%) | `project.stageProgress.signoff` | |
| 9 | Migration Progress (%) | `project.stageProgress.migration` | |
| 10 | Description | `project.description` | |
| 11 | Migration Wave | `project.migrationWave` | Legacy string |
| 12 | Wave ID | `project.waveId` | UUID reference |
| 13 | Jira Story Key | `project.jiraStoryKey` | |
| 14 | Jira Job Status | `project.jiraJobStatus` | pending / processing / completed / failed |
| 15 | Updated At | `project.updatedAt` | |
| 16 | Survey Submitted At | `project.surveySubmittedAt` | |

### 2. Application Overview
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 17 | Application Name | `applicationOverview.applicationName` | |
| 18 | Short Name | `applicationOverview.shortName` | |
| 19 | Business Function | `applicationOverview.businessFunction` | |
| 20 | User Base Type | `applicationOverview.userBase.type` | Internal / External / Both |
| 21 | User Base Count | `applicationOverview.userBase.count` | |
| 22 | Application Tier | `applicationOverview.applicationTier` | T0 / T1 / T2 / T3 |
| 23 | BA ID | `applicationOverview.baId` | |
| 24 | System Importance (IBS) | `applicationOverview.systemImportanceClassification` | Yes/No |
| 25 | System Importance (BPS) | `applicationOverview.systemImportanceClassification` | Yes/No |
| 26 | IITA Applicability | `applicationOverview.iitaApplicability` | Yes/No |
| 27 | Software Origin | `applicationOverview.softwareOrigin` | in-house / 3rd party |
| 28 | Migration Strategy | `applicationOverview.migrationStrategy` | Lift & Shift / Refactor / Deboard |
| 29 | Service Line | `applicationOverview.serviceLine` | |

### 3. Governance Roles
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 30 | Technical Lead Name | `governanceRoles.technicalLead.name` | |
| 31 | Technical Lead Email | `governanceRoles.technicalLead.email` | |
| 32 | Business Owner Name | `governanceRoles.businessOwner.name` | |
| 33 | Business Owner Email | `governanceRoles.businessOwner.email` | |
| 34 | DBA Data Owner Name | `governanceRoles.dbaDataOwner.name` | |
| 35 | DBA Data Owner Email | `governanceRoles.dbaDataOwner.email` | |

### 4. Availability & Resilience
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 36 | RTO | `availability.rto` | |
| 37 | RPO | `availability.rpo` | |
| 38 | 3-AZ Readiness | `availability.azReadiness3Az` | |
| 39 | Health Check Endpoints | `availability.healthCheckEndpoints` | Array → comma-separated or count |

### 5. Data & Persistence
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 40 | Database Types | `dataPersistence.databaseTypes` | Array → comma-separated |
| 41 | Total Data Volume | `dataPersistence.totalDataVolume` | |
| 42 | Data Growth Rate | `dataPersistence.dataGrowthRate` | |
| 43 | Backup Required During Migration | `dataPersistence.backupRequiredDuringMigration` | Yes/No |
| 44 | Last Restore Test | `dataPersistence.lastRestoreTest` | URL or date |
| 45 | Data Residency | `dataPersistence.dataResidency` | |
| 46 | Encryption At Rest | `dataPersistence.encryptionAtRest` | |
| 47 | Stateful Components | `dataPersistence.statefulComponents` | Array → comma-separated |

### 6. Non-Functional Requirements
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 48 | Peak Load | `nfrs.peakLoad` | |
| 49 | Autoscaling | `nfrs.autoscaling` | |
| 50 | Licensing | `nfrs.licensing` | |

### 7. Migration Constraints
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 51 | Regular Migration Window | `migrationConstraints.regularMigrationWindow` | |
| 52 | Preferred Migration Window | `migrationConstraints.preferredMigrationWindow` | Array → comma-separated |
| 53 | Earliest Start Date | `migrationConstraints.earliestStartDate` | |
| 54 | Latest End Date | `migrationConstraints.latestEndDate` | |
| 55 | CR Duration (hours) | `migrationConstraints.crDurationHours` | |
| 56 | SNOW CI Groups | `migrationConstraints.snowCiGroups` | Array → comma-separated |
| 57 | Change Freeze Periods | `migrationConstraints.changeFreezePeriods` | Array of date ranges → JSON or comma-separated names |

### 8. Target Architecture
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 58 | Re-Architecture Needed | `targetArchitecture.reArchitectureNeeded` | Yes/No |
| 59 | 3-AZ Topology | `targetArchitecture.topology3Az` | |
| 60 | DNS / IP Changes | `targetArchitecture.dnsIpChanges` | |
| 61 | New Services Required | `targetArchitecture.newServicesRequired` | Array → comma-separated |
| 62 | Architecture Diagram | `targetArchitecture.architectureDiagram` | URL or attachment ID |

### 9. Planning (Wave / Gantt)
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 63 | Start Date | `planning.startDate` | |
| 64 | End Date | `planning.endDate` | |
| 65 | Plan Start Date | `planning.planStartDate` | |
| 66 | Plan End Date | `planning.planEndDate` | |
| 67 | Estimated Start Date | `planning.estimatedStartDate` | |
| 68 | Estimated End Date | `planning.estimatedEndDate` | |
| 69 | Milestone Count | `planning.milestones` | Count of milestones |

### 10. Risks & Blockers
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 70 | Total Risk Count | `risks` | Count of risks |
| 71 | Critical Risk Count | `risks` | Count where severity = critical |
| 72 | Medium Risk Count | `risks` | Count where severity = medium |
| 73 | Low Risk Count | `risks` | Count where severity = low |
| 74 | Risk Titles | `risks` | All risk titles comma-separated |

### 11. Team
| # | Column | Source | Notes |
|---|--------|--------|-------|
| 75 | ITSO | `project.itso` | |
| 76 | ITSO Delegate | `project.itsoDelegate` | |
| 77 | Team Members | `project.team` | Names comma-separated |

---

## Backend Gap
Most of the columns above (Availability, Data Persistence, NFRs, Target Architecture, Governance Roles, Risks) are **only available in the full project detail endpoint** (`GET /api/v1/projects/{id}`), not in the list endpoint (`GET /api/v1/projects`). To fetch them for a report, we have two options:

**Option A — Expand the list endpoint** (recommended)
Add the missing JSON columns to `ProjectListItem` and `_project_list_item`. Since these are just JSON blobs on the `projects` table, there is no extra DB query cost — the data is already loaded.

**Option B — Dedicated backend export endpoint**
Add a new route like `GET /api/v1/projects/export/details` that returns pre-flattened rows. More backend code but keeps the list endpoint lean.

## Questions for You
1. **Columns** — Are all 77 columns above what you want, or should any be removed / added?
2. **Array fields** — How should arrays be represented?
   - **Comma-separated string** (e.g., "DB1, DB2, DB3") — easy to read
   - **Count only** (e.g., "3") — compact
   - **JSON string** — preserves full structure but hard to read
3. **Change Freeze Periods** — This is an array of objects `{ name, from, to }`. Should we flatten to `Change Freeze 1 Name`, `Change Freeze 1 From`, etc., or just a JSON string?
4. **Milestones** — Similarly, should we include a count only, or flatten milestone names/dates into columns?
5. **Backend approach** — Option A (expand list endpoint) or Option B (dedicated export endpoint)?
