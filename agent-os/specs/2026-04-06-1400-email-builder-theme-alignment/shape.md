# Email Builder Theme Alignment — Shaping Notes

## Scope

Three targeted fixes to the email builder:
1. Update `DEFAULT_TEMPLATE_STYLE` defaults to match the project's design tokens (font, text color, accent color)
2. Fix preview body background from cool gray (`#f3f4f6`) to project warm beige (`#F5F1E6`)
3. Add responsive CSS to the generated email HTML so mobile preview (390px iframe) properly stacks multi-column layouts

## Decisions

- `backgroundColor` (email card area) stays `#ffffff` — white email cards are standard email convention; only the outer body background changes to match the platform
- Montserrat is placed first in the font dropdown so it's the visible default for new templates
- Responsive fix is CSS-only (media queries in the generated HTML `<style>` block); no changes to `BrowserContainer.tsx`
- `!important` is required in media queries to override inline `style` attributes on `<td>` elements
- Existing saved templates are not affected — only `DEFAULT_TEMPLATE_STYLE` changes, which only applies to new templates

## Context

- **Visuals:** None provided
- **References:** `frontend/src/index.css` (CSS custom properties), `frontend/src/types/email.ts`, `frontend/src/components/email-builder/preview/TemplateRenderer.tsx`, `frontend/src/components/email-builder/preview/BrowserContainer.tsx`
- **Product alignment:** Consistency with the platform's warm earthy brand identity

## Standards Applied

- None applicable (no agent-os/standards directory exists)

## Color Derivation

Project CSS custom properties converted to hex for email use:
- `--foreground`: hsl(28.57, 16.54%, 24.90%) → `#4A3F35` (dark warm brown → text color)
- `--primary`: hsl(30, 33.87%, 48.63%) → `#A67C52` (warm orange-tan → accent color)
- `--background`: hsl(44, 42.86%, 93.14%) → `#F5F1E6` (warm beige → email body background)
