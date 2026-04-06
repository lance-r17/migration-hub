# References for Default Template Background Color

## Design System

- **Location:** `frontend/src/index.css`
- **Relevance:** Source of truth for design tokens. `--card: hsl(42.0000 100.0000% 98.0392%)` converts to `#FFFCF5`.

## Type Definitions

- **Location:** `frontend/src/types/email.ts`
- **Relevance:** Contains `DEFAULT_TEMPLATE_STYLE` — the single change target.

## Prior Spec

- **Location:** `agent-os/specs/2026-04-06-1400-email-builder-theme-alignment/`
- **Relevance:** Previous theme alignment work. Body background was set to `#F5F1E6`; card background was intentionally left as `#ffffff`. This spec changes that decision.
