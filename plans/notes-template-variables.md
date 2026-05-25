# Notes Template Variables Enhancement Plan

## Context
Templates currently save raw block structures. Users want placeholders like `{{interviewSubject}}` so that when a template is applied to a different engagement, dynamic values (e.g. the engagement's interview subject) are injected automatically.

## Approach

### 1. Variable Syntax
- `{{variableName}}` — double-curly braces, replaced on template application.

### 2. Supported Variables (Engagement Context)
| Variable | Source |
|----------|--------|
| `{{interviewSubject}}` | `engagement.interviewSubject` |
| `{{projectName}}` | `project.name` |
| `{{projectId}}` | `project.id` |
| `{{baId}}` | `project.applicationOverview.baId` |
| `{{applicationName}}` | `project.applicationOverview.applicationName` |
| `{{migrationWave}}` | `project.migrationWave` or `project.waveId` |
| `{{itso}}` | `project.itso` |
| `{{technicalLead}}` | `project.governanceRoles.technicalLead.name` |
| `{{businessOwner}}` | `project.governanceRoles.businessOwner.name` |
| `{{date}}` | `new Date().toISOString().split('T')[0]` |
| `{{userName}}` | `currentUser.name` |

### 3. UI / UX Design

#### 3a. Engagement Notes Edit Page — Toolbar & Empty State
```
+-----------------------------------------------------------+
|  Home > Engagements > Alpha Finance > Notes               |
|                                            [Apply Tpl] [Save Tpl]   |
+-----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Start from a template to speed up your notes.      |  |
|  |                              [Pick a Template]      |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  # Alpha Finance Migration Interview                      |
|                                                           |
|  Type something…                                          |
|                                                           |
+-----------------------------------------------------------+
```
- **Apply Template** button opens the Template Picker dialog.
- **Save as Template** button opens the Save Template dialog.
- When notes are empty/default, a dashed banner prompts the user to pick a template.

#### 3b. Template Picker Dialog
```
+------------------------------------------+
|  Apply Template                    [X]   |
+------------------------------------------+
|  Choose a template to populate notes.    |
|  ┌────────────────────────────────────┐  |
|  │  Search _________________________  │  |
|  │                                    │  |
|  │  ┌─ Engagement Interview Def ─┐   │  |
|  │  │ global  engagement         │   │  |
|  │  │ Standard interview notes   │   │  |
|  │  └───────────────────────────┘   │  |
|  │  ┌─ Architecture Review ─────┐   │  |
|  │  │ global  architecture      │   │  |
|  │  └───────────────────────────┘   │  |
|  └────────────────────────────────────┘  |
|  Apply mode: [Replace] [Append]          |
|                                [Cancel] [Apply] |
+------------------------------------------+
```
- Template cards show name, scope badge, label chips, and description.
- Search filters by name or label.
- Toggle group selects **Replace** (overwrites existing notes) or **Append** (adds blocks at end).
- On apply, all `{{variableName}}` placeholders are silently resolved before blocks hit the editor.

#### 3c. Save Template Dialog — Full-Screen Editor + Side Panel
```
+---------------------------------------------------------------+
|  ✕  Save as Template                                    [Save]|
+---------------------------------------------------------------+
|                                                               |
|  +------------------------------------+  +-----------------+  |
|  |                                    |  | Template Info   |  |
|  |  # {{interviewSubject}}            |  |                 |  |
|  |                                    |  | Name            |  |
|  |  Attendees                         |  | [______________]|  |
|  |  • _____________________________   |  |                 |  |
|  |                                    |  | Description     |  |
|  |  Key Discussion Points             |  | [______________]|  |
|  |  • _____________________________   |  |                 |  |
|  |                                    |  | Labels          |  |
|  |  Action Items                      |  | [engagement +Add]|  |
|  |  ☐ _____________________________   |  |                 |  |
|  |                                    |  | Scope           |  |
|  |                                    |  | [Private ○]     |  |
|  |  (NotionEditor, editable)          |  | [Global  ○]     |  |
|  |                                    |  |                 |  |
|  +------------------------------------+  +-----------------+  |
|                                                               |
+---------------------------------------------------------------+
```
- **Center pane** — a full-width NotionEditor loaded with a deep-cloned copy of the current blocks. The user can edit text inline, type `{{interviewSubject}}` directly, or use the `/` slash menu to add blocks.
- **Right panel** — metadata form (name, description, labels, scope toggle) plus a **Smart Replacements** section.
- **Smart Replacements** (in right panel) scans the editor blocks for exact matches against context values and offers checkboxes to auto-replace them with variables before saving. Because the editor is live, replacements are previewed immediately in the center pane.
- If no matches are found, the panel shows a simple **Available Variables** reference list with copy buttons.
- **Global template** switch is only shown to `platform_migration_lead`.

#### 3d. Variable Resolution Flow (Invisible to User)
```
Template blocks from DB
        │
        ▼
┌───────────────────────┐
│ resolveTemplateVariables(blocks, context) │
│  • {{interviewSubject}} → "Beta Migration"  │
│  • {{projectName}}      → "Beta"            │
│  • {{date}}             → "2026-05-24"      │
└───────────────────────┘
        │
        ▼
Resolved blocks → setBlocks(resolved)
```

### 4. Frontend Changes

#### `frontend/src/lib/noteTemplateUtils.ts`
- Add `resolveTemplateVariables(blocks, context)` that deep-clones blocks and replaces `{{key}}` in:
  - `content`, `caption`, `title`, `desc`, `url`
  - Nested `tabs.title` and `table.rows` cells
  - Recursively into `columns` and `tabs` children
- Export `TEMPLATE_VARIABLES` constant with metadata (key, label, example) for UI reference.

#### `frontend/src/pages/EngagementNotesEditPage.tsx`
- Import `resolveTemplateVariables` + `useCurrentUser`.
- In `handleApplyTemplate`, build a context object from current project/engagement/user data, then resolve variables before calling `setBlocks`.

#### `frontend/src/components/note-template/SaveTemplateDialog.tsx`
- Render a full-screen dialog with a two-pane layout.
- **Center**: `NotionEditor` loaded with a deep-cloned copy of the current blocks (`useState` local copy so edits don't affect the parent editor).
- **Right panel**:
  - Metadata form: name, description, labels, scope toggle.
  - **Smart Replacements**: build a `context` object, scan editor blocks for exact matches, show checkboxes. When toggled, apply replacement to the center editor blocks immediately so the user sees the preview.
  - Fallback **Available Variables** reference with copy buttons.
- On save: call `sanitizeBlocksForTemplate` on the edited center blocks, then POST to API.

#### `frontend/src/data/noteTemplates.ts`
- Update the mock `tpl-engagement-default` template to use `{{interviewSubject}}` in the H1 block as a working example.

### 5. Files to Modify
| Path | Action |
|------|--------|
| `frontend/src/lib/noteTemplateUtils.ts` | Add `resolveTemplateVariables` + `TEMPLATE_VARIABLES` |
| `frontend/src/pages/EngagementNotesEditPage.tsx` | Resolve variables on template apply |
| `frontend/src/components/note-template/SaveTemplateDialog.tsx` | Add variable reference + copy buttons |
| `frontend/src/data/noteTemplates.ts` | Update mock template with `{{interviewSubject}}` |

## Verification
1. Open engagement notes edit page.
2. Save current notes as a template that includes `{{interviewSubject}}` in a heading.
3. Open a *different* engagement with a different interview subject.
4. Apply the template → verify the heading shows the new interview subject, not the old one.
5. Verify `{{date}}` resolves to today's date, `{{projectName}}` to the project name, etc.
