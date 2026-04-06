# Table Data Source Editing — Plan

## Summary

Replace the free-text `{{variable}}` data source input in the email builder's table configuration with a structured, registry-driven UI that allows users to select a known array data source and configure per-column field mapping (including link-type columns with URL patterns). Add a 3-column resource table to the "Jira Stories Created" predefined template.

## Tasks

### Task 1: Extend types (`frontend/src/types/email.ts`)
- Add `TableDataSourceField`, `TableDataSourceDef`, `TableColumnConfig` interfaces
- Add `columnConfigs?: TableColumnConfig[]` to `TableConfig`
- Add `TABLE_DATA_SOURCES` constant (Cloud Resources source with name/product/resourceId/jiraSubtaskKey/syncStatus fields)
- Add `jiraBaseUrl` to `TEMPLATE_VARIABLES`

### Task 2: Add table row to Jira template (`frontend/src/data/emailTemplates.ts`)
- Add `tableRow()` helper function
- Insert 3-column table (Resource Name, Product, Jira Ticket as link) into `tpl-jira-created`

### Task 3: Rebuild ContentTab table UI (`frontend/src/components/email-builder/builder/right-panel/ContentTab.tsx`)
- Replace free-text data source input with `<Select>` from `TABLE_DATA_SOURCES`
- Add per-column config cards: field selector, type toggle, conditional linkPattern input
- Remove `VariablePicker` from table branch

### Task 4: Add stub rows to canvas (`frontend/src/components/email-builder/builder/canvas/CanvasRow.tsx`)
- Show up to 3 stub preview rows using registry example values
- Link-type columns shown in blue underline

### Task 5: Update TemplateRenderer (`frontend/src/components/email-builder/preview/TemplateRenderer.tsx`)
- Accept `RenderData = Record<string, string | Record<string, unknown>[]>`
- Add `escapeHtml` and `resolveItemLinkPattern` helpers
- Resolve `dataSource` array, render rows with link support, fall back to registry stubs

### Task 6: Update preview sample data (`frontend/src/pages/EmailPreviewPage.tsx`)
- Add `jiraBaseUrl` and `project.currentInfrastructure.resources` arrays to all 3 sample data sets
- Update `SendTestEmailPayload.sampleData` type in `emailService.ts`

## Status: Implemented (2026-04-06)
