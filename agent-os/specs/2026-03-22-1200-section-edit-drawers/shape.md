# Section Edit Drawers — Shaping Notes

## Scope

Add a pencil (edit) icon button to the right side of each SectionCard header on the ProjectDetailsPage, **except** the "Compute & Resources" card. Clicking the button opens a right-side Sheet drawer with a fully editable form for that section's data. Saving updates React in-memory state immediately.

## Decisions

- **Sheet over Vaul drawer**: The existing `sheet.tsx` (Radix UI) is better suited than `drawer.tsx` (Vaul) — it supports right-side slide-in natively and has richer header/footer slots.
- **One drawer per section group**: Each section's data is a single cohesive TypeScript interface. One drawer per section avoids partial-update merging complexity.
- **Custom forms per section**: Tailored field layouts per section rather than a generic key-value editor — confirmed by user.
- **State update strategy**: Update in-memory React state on save — confirmed by user. Each section component holds `drawerOpen` state; `ProjectDetailsPage` lifts project data to `useState` and provides `onSave` callbacks.
- **`onEdit` prop on SectionCard**: Added as a new prop (not via `headerRight`) to keep pencil button position consistent across all cards.
- **Risks are per-card**: Unlike other sections where all cards in a section share one drawer, each individual Risk card has its own edit button. The "Add Risk" placeholder also opens the drawer in create mode.
- **No Textarea UI component exists**: Use raw `<textarea>` with Input-style Tailwind classes.

## Context

- **Visuals**: None provided. Implementation will follow existing design system conventions.
- **References**: Existing `sheet.tsx`, `SectionCard.tsx`, section components in `components/project/`
- **Product alignment**: N/A (no agent-os/product/ folder found)

## Standards Applied

None found in `agent-os/standards/`. No standards applied.
