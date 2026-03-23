# Frontend SPA — Shaping Notes

## Scope

Convert three HTML/Tailwind prototypes into a Vite + React + TypeScript SPA scaffolded in `frontend/`. All layout, navigation, modals, and section cards are extracted as individual reusable React components.

## Decisions

- **Project location:** `frontend/` subdirectory (separates frontend from future Python/FastAPI backend)
- **Icons:** Lucide icons (replacing Material Symbols from prototypes) — consistent with defined tech stack
- **Routing:** react-router-dom v6 with BrowserRouter (`/` = Home, `/projects/:id` = Project Details)
- **Data:** Mock data in `src/data/mock.ts` — no API integration in this task
- **UI Library:** shadcn/ui components for Dialog, Checkbox, Textarea, Button
- **Design system:** Full "Architectural Ledger" color palette reproduced in tailwind.config.ts

## Context

- **Visuals:** Three prototype screens in `prototypes/screens/`
- **References:** `prototypes/DESIGN.md` — full design system documentation
- **Product alignment:** MVP phase — home dashboard + project details + sign-off workflow

## Standards Applied

- No standards files exist yet in agent-os/standards/
