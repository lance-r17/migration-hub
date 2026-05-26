# Engagements

Engagements are migration interview records tied 1:1 to a project. A Platform Migration Lead uses engagements to schedule interviews with project teams, capture rich-text interview notes, and export those notes to Confluence.

---

## End-to-end workflow

```
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │  Schedule   │────►│  Interview  │────►│ Write Notes │────►│   Publish   │
  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
        │                   │                   │                    │
  Open calendar        Mark the           Edit in rich-text    Export notes
  Set date & time      confirmed slot     editor (auto-saved)  to Confluence
  Add participants                        Apply template
  Assign manager                          Save as template      Set status →
  Book Zoom (opt.)                                              completed

  ─────────────────────────────────────────────────────────────────────────────
  Status:  pending ──────► scheduled ───────────────────────────► completed
```

---

## Pages

### `EngagementCalendarPage` — `/engagements`

- Month-grid calendar showing all engagements as status-coloured pills
- Month navigation (prev / next)
- Status filter chips
- Click empty day → create new engagement (opens drawer)
- Click existing pill → edit engagement (opens drawer)

### `EngagementNotesPage` — `/engagements/:projectId`

- Read-only rich-text view of `engagement.notes`
- Interview subject displayed as the page title
- Confluence page URL shown as an external link if `confluencePageUrl` is set
- **Edit Notes** button → navigates to edit page
- **Export to Confluence** button → opens `ConfluenceExportDialog`

### `EngagementNotesEditPage` — `/engagements/:projectId/edit`

- Full-height Notion block editor bound to `engagement.notes`
- Auto-save debounced at 1500 ms
- Toolbar actions: Apply Template, Save as Template, Export to Confluence
- Breadcrumb: Home → Project → Engagement Notes → Edit

---

## Components

| Component | Location | Purpose |
|---|---|---|
| `EngagementDrawer` | `src/components/engagement/EngagementDrawer.tsx` | Right-side sheet for all engagement metadata |
| `MonthCalendar` | `src/components/engagement/MonthCalendar.tsx` | Month-grid rendering with pill overlays |
| `ConfluenceExportDialog` | `src/components/engagement/ConfluenceExportDialog.tsx` | Blocks-to-Confluence export dialog |

---

## Data model

```ts
type EngagementStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no_show'

interface EngagementSlot {
  id: string
  start: string   // ISO datetime
  end: string     // ISO datetime
  isActual?: boolean
}

interface Engagement {
  status: EngagementStatus
  interviewSubject?: string
  plannedSlots: EngagementSlot[]
  participantIds: string[]
  engagementManagerId?: string
  notes?: unknown[]            // Notion Block[] stored as JSONB
  confluencePageId?: string
  confluencePageUrl?: string
  zoomMeetingUrl?: string
  zoomMeetingId?: string
}
```

`Engagement` is embedded in the `Project` object returned by `GET /api/v1/projects/:id`. It is stored in the `engagements` table with a unique FK to `projects`.

---

## API

Engagements are updated through the standard section-update route:

```
PATCH /api/v1/projects/:id/sections/engagement
Body: { "value": <Engagement> }
```

See [API Reference](../backend/api.md) → `PATCH /api/v1/projects/:id/sections/:key` for the full route contract.

---

## Zoom integration

If `ZOOM_*` environment variables are configured on the backend, `EngagementDrawer` shows a **Schedule Zoom Meeting** button. Clicking it calls the Zoom API, creates a meeting, and writes `zoomMeetingUrl` and `zoomMeetingId` back to the engagement. The join URL is displayed as a clickable link in the drawer.

---

## Confluence integration

Confluence export requires `CONFLUENCE_*` environment variables. The Confluence service:

1. Converts each Notion block to Confluence XHTML storage format (headings, paragraphs, bullet/numbered lists, code blocks, dividers, etc.)
2. Creates or updates the Confluence page via the Confluence REST API
3. Organises pages under the configured parent page — the page title is the engagement's `interviewSubject`

See [Confluence environment variables](../getting-started.md) for the required `CONFLUENCE_BASE_URL`, `CONFLUENCE_TOKEN`, and `CONFLUENCE_SPACE_KEY` values.
