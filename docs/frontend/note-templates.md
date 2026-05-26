# Note Templates

Note templates are reusable Notion-style block collections with `{{variable}}` placeholder support. Any Platform Migration Lead can author templates and share them globally or with specific roles. Templates are primarily used from the engagement notes editor but are designed to be reusable across any future note context.

---

## Concepts

### Scope

Every template has a `scope` that controls who can see and use it:

| Scope | Who can view | Who can create |
|---|---|---|
| `private` | Creator only | Any authenticated user |
| `function` | Users whose role matches at least one of the template's `sharedRoles` | Platform Migration Lead or Admin |
| `global` | Everyone | Platform Migration Lead or Admin |

### Edit and delete authorization

| Template scope | Who can edit / delete |
|---|---|
| `private` | Creator |
| `function` | Creator, or any Platform Migration Lead / Admin |
| `global` | Creator, or any Platform Migration Lead / Admin |

Changing scope from `private` to `function` or `global` requires Platform Migration Lead or Admin role.

### Variable placeholders

Templates support `{{variableName}}` placeholders in any text field. When a template is applied to an engagement, the placeholder resolver (`resolveTemplateVariables`) substitutes each placeholder with the matching value from the current project context:

| Variable | Source |
|---|---|
| `{{interviewSubject}}` | `engagement.interviewSubject` |
| `{{projectName}}` | `project.name` |
| `{{projectId}}` | `project.id` |
| `{{baId}}` | `project.applicationOverview.baId` |
| `{{applicationName}}` | `project.applicationOverview.applicationName` |
| `{{migrationWave}}` | `project.migrationWave` or `project.waveId` |
| `{{itso}}` | `project.itso` |
| `{{technicalLead}}` | `project.governanceRoles.technicalLead.name` |
| `{{businessOwner}}` | `project.governanceRoles.businessOwner.name` |
| `{{date}}` | Current date (`YYYY-MM-DD`) |
| `{{userName}}` | Name of the currently logged-in user |

Placeholders that do not resolve (unknown key or empty value) are left unchanged in the output.

### Version history

Every `PUT` call to update a template automatically snapshots the previous state as a `NoteTemplateVersion` before applying the new changes. Versions are numbered sequentially per template. Restoring a version also snapshots the current state first — no history is ever discarded.

---

## End-to-end workflow

### Creating and publishing a template

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │    Create    │────►│  Set Scope   │────►│   Library    │────►│    Apply     │
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
        │                    │                    │                     │
  Write blocks          private              Browse & search       Replace notes
  from scratch          function             Edit · Delete         Append to notes
  ── or ──              global               Version history       Variables resolved
  Save from             + shared roles       Restore version       from project context
  engagement notes
  (smart replace)
```

### Version control

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  Edit saved  │────►│ Auto-snapshot│────►│   Restore    │
  └──────────────┘     └──────────────┘     └──────────────┘
        │                    │                    │
  Update blocks         Current state        Pick any prior
  name · scope          preserved as         version to view
  labels · roles        version N            or restore
```

---

## Pages

### `NoteTemplatesPage` — `/templates`

- Card grid of all templates visible to the current user
- **Create Template** card shortcut (top-left)
- Filter / search by label or name
- Per-card actions: Preview, Edit, Delete, Version History

### `TemplatePreviewPage` — `/templates/:id`

- Left: Notion block editor (read-only by default; editable in edit mode)
- Right: tabbed panel — Details, History, Compare
- `?mode=edit` query param auto-opens edit mode
- Save button calls `PUT /api/v1/note-templates/:id`

---

## Components

| Component | Location | Purpose |
|---|---|---|
| `TemplatePicker` | `src/components/note-template/TemplatePicker.tsx` | Searchable dialog for selecting and applying a template |
| `SaveTemplateDialog` | `src/components/note-template/SaveTemplateDialog.tsx` | Dialog for saving engagement notes as a template with smart replacements |
| `TemplateMetaPanel` | `src/components/note-template/TemplateMetaPanel.tsx` | Reusable form for name, description, labels, scope, and shared roles |

---

## Service

`src/services/noteTemplates.ts` exposes:

```ts
getNoteTemplates(label?: string): Promise<NoteTemplate[]>
getNoteTemplate(id: string): Promise<NoteTemplate>
createNoteTemplate(body: Partial<NoteTemplate>): Promise<NoteTemplate>
updateNoteTemplate(id: string, body: Partial<NoteTemplate>): Promise<NoteTemplate>
deleteNoteTemplate(id: string): Promise<void>
getTemplateVersions(templateId: string): Promise<NoteTemplateVersion[]>
restoreTemplateVersion(templateId: string, versionId: string): Promise<NoteTemplate>
```

---

## Utility library

`src/lib/noteTemplateUtils.ts` provides all block manipulation functions:

| Function | Purpose |
|---|---|
| `sanitizeBlocksForTemplate(blocks)` | Deep-clone and strip image/bookmark URLs before saving |
| `buildTemplateContext(project, userName)` | Map project data to a `Record<string, string>` context |
| `resolveTemplateVariables(blocks, context)` | Replace `{{key}}` with resolved values across all text fields |
| `findVariableMatches(blocks, context)` | Scan block text for literal context values; returns matches sorted longest-first |
| `applyVariableReplacement(blocks, key, value)` | Replace exact value with `{{key}}` (used during Save as Template) |
| `revertVariableReplacement(blocks, key, value)` | Revert `{{key}}` back to literal value (used to undo a replacement) |

---

## Data model

```ts
interface NoteTemplate {
  id: string
  name: string
  description?: string
  labels: string[]
  blocks: unknown[]                          // Notion Block[]
  scope: 'global' | 'private' | 'function'
  sharedRoles?: string[]
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

interface NoteTemplateVersion {
  id: string
  templateId: string
  versionNumber: number
  name: string
  description?: string
  labels: string[]
  blocks: unknown[]
  scope: 'global' | 'private' | 'function'
  sharedRoles?: string[]
  createdBy?: string
  createdAt?: string
}
```

---

## API

See [API Reference](../backend/api.md) → **Note Templates** for full request/response details.

### Quick reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/note-templates` | List visible templates (`?label=` filter) |
| `GET` | `/api/v1/note-templates/:id` | Get a single template |
| `POST` | `/api/v1/note-templates` | Create a template |
| `PUT` | `/api/v1/note-templates/:id` | Update a template (auto-snapshots prior state) |
| `DELETE` | `/api/v1/note-templates/:id` | Delete a template |
| `GET` | `/api/v1/note-templates/:id/versions` | List version history |
| `POST` | `/api/v1/note-templates/:id/versions/:versionId/restore` | Restore a version |
