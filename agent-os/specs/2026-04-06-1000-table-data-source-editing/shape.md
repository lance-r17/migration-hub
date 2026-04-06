# Table Data Source Editing — Shaping Notes

## Scope

Enhance the email builder's table layout data source configuration to be structured and user-friendly, replacing a free-text `{{variable}}` input with a registry-driven picker and per-column field mapping. Add a resource table to the predefined "Jira Stories Created" template.

## Decisions

- Use a `TABLE_DATA_SOURCES` registry (constant in `types/email.ts`) to enumerate known array data sources and their available fields, rather than free-text input
- Per-column config stored as `columnConfigs?: TableColumnConfig[]` on `TableConfig`
- Link URL construction uses a two-phase `linkPattern`: `{{topLevelVar}}` resolved first, then `{itemField}` tokens from the data item
- Canvas preview shows up to 3 stub rows using the registry's `example` field values
- `VariablePicker` removed from the table branch of ContentTab; kept only for text/CTA components
- Added `jiraBaseUrl` as a template variable so link patterns can reference it

## Context

- **Visuals:** None provided
- **References:** `CanvasRow.tsx`, `ContentTab.tsx`, `TemplateRenderer.tsx`, `EmailPreviewPage.tsx`
- **Product alignment:** Directly supports the Jira Stories Created notification flow — stakeholders can see which resources have subtasks created

## Standards Applied

- N/A (frontend-only feature, no API changes)
