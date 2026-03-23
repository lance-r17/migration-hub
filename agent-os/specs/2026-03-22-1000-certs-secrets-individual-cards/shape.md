# Certificates & Secrets Individual Cards — Shaping Notes

## Scope

Refactor the `certificatesSecrets` block in `DependenciesSection` from a single card with stacked text entries into individual `SectionCard` components displayed in a responsive 3-column grid. Add an "Add" placeholder card at the end of the grid.

## Decisions

- Each `CertificatesSecrets` field (`tlsCertificates`, `secretsManagement`, `apiKeys`) becomes its own card
- Cards only render when the field value is defined (already optional in the type)
- Grid layout: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — matches `RisksBlockersSection`
- Placeholder card is identical in style to the one in `RisksBlockersSection`
- No type changes needed — `CertificatesSecrets` fields are already `string | undefined`

## Context

- **Visuals:** None provided
- **References:** `RisksBlockersSection.tsx` — placeholder card pattern and grid layout
- **Product alignment:** Phase 1 MVP — 10-section project details page
