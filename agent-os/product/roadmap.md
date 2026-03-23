# Product Roadmap

## Phase 1: MVP

- **Project card listing** — Home page displaying one card per project with overall migration status; platform team sees all projects, project members see only their own
- **Role-based access control** — Enforce visibility and edit permissions based on team membership (platform team vs. project team)
- **Project details page** — Per-project page with 10 structured sections:
  1. Application Overview
  2. Cloud Resources (organized by category: network, VM, database, buckets)
  3. Availability and Resilience
  4. Data and Resilience
  5. Dependencies
  6. Non-Functional Requirements
  7. Migration Constraints
  8. Target Architecture Notes
  9. Risks and Blockers
  10. Sign-Off
- **Jira integration + sign-off workflow** — When a project is signed off, trigger a background job to create Jira issues linked to the project representing concrete migration action items

## Phase 2: Post-Launch

- **Resource scanning background job** — Periodically scan resources in the new cloud environment and display a comparison against the existing cloud environment in the Cloud Resources section of each project
- **Migration progress dashboard** — Aggregated view for the platform team showing overall migration progress across all projects
- **Notifications and alerts** — Notify relevant team members of sign-off events, resource changes detected by the scanner, or Jira issue updates
