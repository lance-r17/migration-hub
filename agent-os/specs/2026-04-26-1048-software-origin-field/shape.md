# Software Origin Field — Shaping Notes

## Scope

Add a "Software origin" dropdown to the Application Overview → Application Profile card with two options: `in-house` and `3rd party`. Propagate this field through:
- Survey definitions (frontend + backend)
- Email template variables
- Jira story description generation
- Effort estimation breakdown table defaults

## Decisions

- **Placement:** The field sits between "IBS In Scope" and "Migration Strategy" in the Application Profile card, as requested.
- **Default behavior for effort table:** When `softwareOrigin` is `"3rd party"`, new empty effort tables default all task `thirdParty` values to `true`. Otherwise they default to `false`.
- **Existing data preservation:** Pre-existing tables with explicit `thirdParty` values are not overwritten when `softwareOrigin` changes. Only *new* empty tables receive the default.
- **Type:** `'in-house' | '3rd party' | undefined` — stored inside the `applicationOverview` JSONB blob.

## Context

- **Visuals:** None provided
- **References:**
  - `ApplicationOverviewSection.tsx` — existing display pattern for boolean/select badges
  - `ApplicationProfileDrawer.tsx` — existing edit pattern for select fields
  - `EffortTableEditor.tsx` — where `createEmptyTable()` lives and where the default logic is injected
  - `surveyFields.ts` / `survey_field_defs.py` — existing survey field definition patterns
- **Product alignment:** N/A

## Standards Applied

- N/A — no `agent-os/standards/` directory exists in this project.
