# Email Builder — Shaping Notes

## Scope

A full email template management system for the Migration Hub platform, consisting of three surfaces:

1. **Email Templates List** (`/email`) — Card grid listing all templates (pre-defined + user-created). A "Create Template" card leads the grid. Restricted to Platform Migration Lead.

2. **Email Builder** (`/email/new`, `/email/:id/edit`) — 3-column drag-and-drop editor:
   - **Left panel** (280px): Layouts tab (draggable row-layout blocks: full, 2-col, 3-col, left-sidebar, table) + Library tab (draggable component types: text, hero-image, image, CTA, divider, spacer)
   - **Canvas** (flex): Droppable email canvas; layout blocks dropped here create rows; components dropped into row columns. Inline editing via Tiptap popover (double-click text/CTA). Component hover toolbar for copy/delete/move.
   - **Right panel** (320px): Style tab (template-level + component-level), Content tab (component content + variable chips for click-to-insert), Config tab (template subject/recipients + component link config)

3. **Email Preview** (`/email/:id/preview`) — Browser-framed preview with desktop (1280px) / mobile (390px) toggle, sample data dropdown (resolves `{{variables}}`), and Send Test Email button (email input → mock send).

## Decisions

- **Access control**: Platform Migration Lead only (consistent with Waves, Finance, Settings)
- **Variable injection UX**: Click-to-insert chips in Content tab — click inserts `{{key}}` at Tiptap cursor
- **No visuals provided** — design follows existing platform design system ("The Architectural Ledger")
- **State management**: Single `template: EmailTemplate` state in `EmailBuilderPage`, prop-drilled to Canvas and RightPanel — no external state library needed
- **Pre-defined templates**: 8 templates based on real platform events (wave assigned, sign-off required, project signed off, critical risk, cutover reminder, approval submitted, Jira stories created, survey submitted)
- **Preview rendering**: `TemplateRenderer` generates inline-styled table-based HTML (email-client safe), displayed in an `<iframe srcDoc>`
- **Drag-and-drop**: dnd-kit (core + sortable + utilities) — not yet in the project
- **Rich text**: Tiptap (react + starter-kit + color + text-style + link) — not yet in the project

## Context

- **Visuals**: None provided — use platform design system
- **References**: Wave planning (`WavesPage`, `CreateWaveDrawer`), Finance page (complex data layout), Survey builder (settings sub-page pattern), shadcn/ui Tabs/Popover/Sheet
- **Product alignment**: Roadmap Phase 2 explicitly lists "Notifications and alerts" — this feature builds the authoring layer for those notifications

## Standards Applied

- shadcn/ui primitives for all UI components (Tabs, Popover, Sheet, Badge, Button, Input, Select, etc.)
- Lucide React icons throughout
- Tailwind CSS utility classes — dark mode with `dark:` prefix
- Mock/real API dual path via `USE_MOCK` toggle in `client.ts`
- TypeScript strict typing — all interfaces in `types/email.ts`
- Role-based access guard via `user?.role === 'Platform Migration Lead'`
- Toast notifications via Sonner for save, delete, send actions
