# Migration Effort Estimation Table — Shaping Notes

## Scope

Enhance the existing "Migration Effort Estimation" section with an inline-editable task breakdown table:
- 8 pre-defined tasks per table
- Columns: Task, Effort (mandays), Rates (%), Third party? (yes/no), Remarks
- Single or multiple tables per project
- BA ID per table (default = project.applicationOverview.baId)
- Auto-calculated total effort stored in `effortEstimate`
- Survey builder and survey modal support

## Decisions

- **Keep existing fields + add table** — `effortEstimate`, `notes`, `attachmentIds` remain. The new `tables` and `tableMode` fields are added alongside.
- **Auto-calculate effortEstimate** — Total mandays from all tables replaces manual entry. Display changes from "K CNY" to "days".
- **Manual single/multiple toggle** — User explicitly chooses. No automatic detection of multiple BAs (future enhancement).
- **Survey: single combined question** — Full table on one slide, similar to `dependency_list` pattern.
- **Rate warning non-blocking** — Show yellow warning if rates ≠ 100%, but allow save.
- **No DB migration** — Reuses existing JSONB column.

## Context

- **Visuals:** ASCII diagrams in visuals/
- **References:**
  - `MigrationEffortEstimationSection.tsx` — existing section component
  - `SurveyModal.tsx` — effort estimate combined slide logic
  - `DependencyListEditor` — pattern for complex inline-editable lists in survey
  - `backend/app/data/survey_field_defs.py` — backend field defs
- **Product alignment:** N/A

## Standards Applied

- N/A — No formal standards defined in `agent-os/standards/` for this project.
