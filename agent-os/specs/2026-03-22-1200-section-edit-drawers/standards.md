# Standards for Section Edit Drawers

No `agent-os/standards/` folder was found in this project. No formal standards apply to this feature.

## Informal Conventions Observed

- **Component co-location**: UI components live in `frontend/src/components/`. New drawer components go in a `drawers/` subfolder.
- **shadcn/ui primitives**: Use existing `Button`, `Input`, `Label`, `Checkbox`, `Select` from `components/ui/` — do not introduce new UI libraries.
- **Lucide React icons**: All icons come from `lucide-react`. Use `Pencil` for the edit trigger.
- **Tailwind CSS**: All styling via Tailwind classes + the `cn()` utility from `@/lib/utils`.
- **TypeScript strict**: All props and state must be properly typed using interfaces from `types/index.ts`.
