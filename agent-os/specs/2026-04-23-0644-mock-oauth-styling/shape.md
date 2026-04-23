# Mock OAuth Page Styling — Shaping Notes

## Scope

Rewrite the mock-oauth HTML login page (`mock-oauth/main.py::LOGIN_HTML`) to visually match the Migration Hub frontend web app's design system.

## Decisions

- **Approach:** Single-file inline enhancement — keep `main.py` self-contained with no build step.
- **Logo:** Copy `frontend/src/assets/logo.svg` to `mock-oauth/logo.svg` and serve via a dedicated `/logo.svg` endpoint rather than inlining 3KB of path data in the Python file.
- **Font:** Load Montserrat from Google Fonts CDN instead of serving local font files.
- **Dark mode:** Respect `localStorage.theme` (same key as frontend) with fallback to `prefers-color-scheme`. Add a fixed-position toggle button.
- **Component fidelity:** Replicate card, button, select, label, and field-group patterns using plain CSS with CSS custom properties.
- **Layout:** Match `LoginPage.tsx` — centered brand header + centered card on full-viewport beige/dark background.

## Context

- **Visuals:** None provided
- **References:**
  - `frontend/src/index.css` — CSS custom properties
  - `frontend/src/pages/LoginPage.tsx` — layout pattern
  - `frontend/src/components/ui/card.tsx`, `button.tsx`, `input.tsx`, `select.tsx`, `label.tsx`, `field.tsx` — component styling
  - `frontend/src/components/shared/Logo.tsx` — logo asset
- **Product alignment:** N/A — dev tooling improvement

## Standards Applied

- None found in `agent-os/standards/`
