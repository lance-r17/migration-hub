# Project Field Updates — Shaping Notes

## Scope

Three targeted field changes across project details, survey, and all related functionality:

1. **Label rename:** "Data Residency" → "Data Residency Requirements" (key `dataResidency` unchanged)
2. **Field rename:** `eimId` / "EIM ID" → `baId` / "BA ID" everywhere (ApplicationOverview + DependencyEntry)
3. **Field removal:** `replicationChanges` removed from Target Architecture section entirely

## Decisions

- `dataResidency` key is unchanged — only the display label updates, no API or type changes needed
- `baId` rename is applied to both `ApplicationOverview.baId` and `DependencyEntry.baId` (feeds upstream + downstream lists)
- No Alembic migration required — all three fields live in JSONB columns; existing `eimId` data will silently not appear until a SQL data migration is run
- `replicationChanges` is deleted from types, survey config, display, drawer, backend defs, mock, and seed data

## Context

- **Visuals:** None
- **References:** Existing field patterns in surveyFields.ts, survey_field_defs.py, use-projects.ts
- **Product alignment:** N/A

## Standards Applied

- No external standards files applied — changes follow existing project conventions
