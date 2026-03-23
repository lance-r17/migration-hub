# Section Headings & Full-Row Layout — Shaping Notes

## Scope

Refactor all 9 section components in `src/components/project/` to:
1. Add a numbered `<h2>` heading above each section (matching migration register doc)
2. Make every section occupy a full row (remove bento grid column spans)
3. Split complex sections into multiple `SectionCard` components with appropriate layouts

## Decisions

- h2 pattern exactly as specified: `className="mt-8 mb-4 text-2xl font-bold"`
- Section numbers match the migration register: "1. Application Overview" through "9. Risks & Blockers"
- Split strategy by content complexity:
  - Simple list → 1 card (Risks & Blockers)
  - Two logical groups → 2 cards side-by-side (most sections)
  - Three distinct tables → 2+1 layout (Dependencies)
  - Stacked full-width → for tables that need full width (Current Infrastructure)
- `CloudResourcesSection` migrated to use `SectionCard` instead of custom markup
- Bento grid in `ProjectDetailsPage` replaced with flat `<div>` — sections handle own spacing

## Context

- **Visuals:** None
- **References:** Existing section component patterns in `src/components/project/`
- **Product alignment:** Document-style navigation matches migration register structure
