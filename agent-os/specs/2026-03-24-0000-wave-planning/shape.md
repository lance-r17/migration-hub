# Wave Planning — Shaping Notes

## Scope

Promote migration waves from a plain string field to a first-class entity with full lifecycle management and Jira integration. Each wave maps to a Jira epic. Projects are assigned to waves. When a Platform Migration Lead signs off a project, the system creates a Jira story (for the project) with sub-tasks (for cloud resources) linked to the wave's epic.

**Jira hierarchy:**
1. Epic = Wave
2. Story = Project (created at sign-off)
3. Sub-tasks = Cloud resources (granularity chosen at sign-off)

## Decisions

- **Wave fields:** name, start date, cutover date, description, Jira project key, Jira epic key (generated or provided)
- **Wave creation:** two paths — create new (triggers mock Jira epic creation) or import by providing an existing Jira epic key
- **Wave assignment:** Platform Migration Lead only; via "Assign Wave" / "Change Wave" button in ProjectDetailsPage metadata strip, opens a drawer with dropdown
- **Sub-task granularity:** configured during sign-off (step 2 of the sign-off modal for Platform Migration Lead); three modes: per-resource, per-category, custom selection
- **Jira integration:** fully mocked with simulated delays and generated ticket IDs
- **Wave Management page access:** Platform Migration Lead only; others see "Access Restricted"
- **Backward compat:** keep `migrationWave?: string` on Project; `waveId` lookup takes precedence for display

## Context

- **Visuals:** Dropdown in metadata strip (edit drawer/modal variant selected)
- **References:** Existing ProjectDetailsPage metadata strip, SectionEditDrawer pattern, SignOffModal structure
- **Product alignment:** Supports the migration coordination mission; enables end-to-end Jira traceability from wave → project → resource
