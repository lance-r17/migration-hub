# Migration Effort Estimation — Shaping Notes

## Scope

Add a new **"Migration Effort Estimation"** section to project details with two fields:
1. **Migration estimate (Effort Cost)** — numeric value in thousands (K), currency aligned with billing setup
2. **Notes (breakdown & rationale)** — free text with server-side file upload for attachments

Reflect this across:
- Project details page (view/edit)
- Survey builder and survey modal
- Wave plan gantt chart left panel

## Decisions

- **JSONB section pattern** — Store as `migration_effort_estimation` JSONB column on `projects`, consistent with existing sections like `targetArchitecture`, `applicationOverview`, etc.
- **Server file upload** — User explicitly chose server-side file storage over URL references. New `project_attachments` table + local filesystem storage in `uploads/projects/{project_id}/`.
- **Currency from billing config** — Read `BillingThresholdConfig.currency` (default CNY) rather than storing currency per-project. Frontend fetches config and displays symbol.
- **Survey integration** — Add two field definitions (`effort__estimate`, `effort__notes`) to both frontend and backend survey field defs, mapping to `migrationEffortEstimation` section.
- **Gantt-only cross-feature reflection** — User explicitly chose not to add email template merge fields. Effort estimate appears as a new column in the wave gantt chart left panel.
- **Gantt left panel width increase** — `LEFT_PANEL_W` grows from 600px to 680px to accommodate an 80px "Effort" column without squeezing existing content.

## Context

- **Visuals:** None provided
- **References:**
  - `backend/app/services/project_service.py` — `SECTION_COLUMN_MAP`, `update_section`
  - `frontend/src/components/project/TargetArchitectureSection.tsx` — section UI pattern
  - `frontend/src/components/waves/WaveGanttChart.tsx` — gantt left panel rendering
  - `backend/app/routers/billing.py` — file upload endpoint pattern
- **Product alignment:** N/A (no product docs directly referenced)

## Standards Applied

- N/A — No formal standards defined in `agent-os/standards/` for this project.
