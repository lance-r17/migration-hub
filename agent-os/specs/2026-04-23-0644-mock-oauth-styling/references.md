# References for Mock OAuth Page Styling

## Frontend Design System

### Theme Tokens

- **Location:** `frontend/src/index.css`
- **Relevance:** Defines all CSS custom properties (background, foreground, primary, border, shadow, radius) for both light and dark modes.

### Font Faces

- **Location:** `frontend/src/styles/themes.css`
- **Relevance:** Declares Montserrat and Libre Baskerville @font-face rules. We use Montserrat via Google Fonts CDN instead.

### Login Page Layout

- **Location:** `frontend/src/pages/LoginPage.tsx`
- **Relevance:** Two-column grid on large screens (form left, image right). We replicate the left side only — centered brand header + centered form card.

### Component Styling

| Component | Location | Key patterns |
|---|---|---|
| Card | `frontend/src/components/ui/card.tsx` | `rounded-xl bg-card ring-1 ring-foreground/10` |
| Button | `frontend/src/components/ui/button.tsx` | `rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 active:translate-y-px` |
| Input / Select | `frontend/src/components/ui/input.tsx`, `select.tsx` | `rounded-lg border border-input bg-transparent h-8 px-2.5 focus-visible:ring-3 focus-visible:ring-ring/50` |
| Label | `frontend/src/components/ui/label.tsx` | `text-sm font-medium` |
| Field | `frontend/src/components/ui/field.tsx` | `flex flex-col gap-1.5` / `flex flex-col gap-4` |

### Logo

- **Location:** `frontend/src/assets/logo.svg`
- **Relevance:** Copied to `mock-oauth/logo.svg` and served statically.
