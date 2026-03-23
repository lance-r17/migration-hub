# Product Mission

## Problem

Organizations migrating cloud resources between availability zones (within the same cloud provider) lack a centralized tool to coordinate across multiple project teams. Teams need a structured way to document, track, and sign off on migration readiness — and platform teams need full visibility into progress across all projects.

## Target Users

**Internal teams only:**
- **Cloud Platform Team**: Responsible for overseeing all migrations; needs visibility into every project's status and overall migration progress.
- **Project Teams**: Each team is responsible for migrating their own application and resources; members can only view and edit their own project's data.

## Solution

Migration Hub is a role-based single-page web application that centralizes cloud migration planning and coordination. It provides:

- A structured project card system with role-based visibility (platform team sees all projects; project members see only theirs)
- Detailed per-project documentation across 10 key sections (application overview, cloud resources by category, availability & resilience, data & resilience, dependencies, non-functional requirements, migration constraints, target architecture notes, risks & blockers, sign-off)
- A sign-off workflow that automatically triggers Jira issue creation for concrete migration action items
- Background resource scanning to compare existing vs. new cloud environment resources side-by-side
