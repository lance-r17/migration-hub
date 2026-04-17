# Plan: Enrich Jira Issue Descriptions with Migration Context

## Context

Migration leads currently must switch between Jira and the Migration Hub project detail page to understand scheduling constraints, resource scope, and risk status. Jira stories and subtasks were created with only a summary line — no description at all. This plan populates rich ADF (Atlassian Document Format) descriptions on all three issue types so that the full picture is visible in Jira.

**Scope:** Migration Stories, Resource Subtasks (all 4 modes), and CR/Operation Subtasks.

---

## Changes

### `backend/app/services/jira_client.py`

- `create_story`: changed `description: str | None` → `description: dict | None`; caller now passes full ADF dict directly
- `create_subtask`: added `description: dict | None = None` param

### `backend/app/services/jira_service.py`

- Added imports: `Risk`, `Wave`
- Added ADF helper functions: `_adf_text`, `_adf_paragraph`, `_adf_heading`, `_adf_rule`, `_adf_bullet_list`, `_adf_kv_table`, `_adf_resource_table`
- Added description builders: `_build_story_description`, `_build_subtask_description`, `_build_cr_description`
- Modified `_complete_job`: loads wave + risks before any commits; builds `bucket_resources` alongside `buckets`; passes descriptions to `create_story` and `create_subtask`
- Modified `_complete_operation_job`: loads wave + linked resources; passes description to `create_subtask`

### Story Description Sections
1. Migration Overview (kv table): wave, dates, strategy, tier, EIM, IBS, owner, status
2. Migration Constraints (kv table): window, preferred, dates, CR duration, SNOW groups
3. Availability (kv table): RTO, RPO
4. Resources In Scope (bullet): count by product + total
5. Open Risks (bullet, if any): severity + title
6. Team (paragraph, if any)
7. Dependencies (bullet, if any): upstream/downstream names

### Resource Subtask Description Sections
1. Resource Details: kv table (single resource) or Name/Product/Source/Target table (multiple)
2. Specs (if present, single resource only)
3. Migration Context (kv table): wave, cutover, CR duration, SNOW groups, window

### CR Subtask Description Sections
1. Change Request Context (kv table): wave, cutover, CR duration, SNOW groups, window, preferred
2. Affected Resources table (Name/Product/Source ID/Subtask Key)
3. Change Freeze Periods (if present)

---

## Verification

1. `python -c "import ast; ast.parse(open('backend/app/services/jira_service.py').read())"` — syntax OK
2. Mock mode: trigger a migration job with no Jira configured — builders run, no exceptions
3. Live Jira: trigger sign-off on a project with wave + constraints + risks → open Story in Jira, verify sections
4. Live Jira operation job: open CR subtask, verify Affected Resources table
5. Edge cases: no wave, no risks, no team, no deps → sections omitted gracefully
