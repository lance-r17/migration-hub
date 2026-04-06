# References for Email Builder Theme Alignment

## Design System

### CSS Custom Properties
- **Location:** `frontend/src/index.css`
- **Relevance:** Source of truth for design tokens (colors, fonts). Colors converted from HSL to hex for use in email defaults and hardcoded HTML strings.
- **Key values used:** `--foreground`, `--primary`, `--background`, `--font-sans`

## Email Builder

### Type Definitions
- **Location:** `frontend/src/types/email.ts`
- **Relevance:** Contains `DEFAULT_TEMPLATE_STYLE` (the defaults for new templates) and `TemplateStyle` interface.

### Template Renderer
- **Location:** `frontend/src/components/email-builder/preview/TemplateRenderer.tsx`
- **Relevance:** Generates the email HTML document. Contains hardcoded body background colors and the table-based layout structure that needed responsive CSS classes.
- **Key patterns:** `renderColumn()` returns `<td>` elements; `generateEmailHtml()` produces the full document with `<style>` block.

### Browser Container
- **Location:** `frontend/src/components/email-builder/preview/BrowserContainer.tsx`
- **Relevance:** Hosts the email preview iframe. Mobile viewport is 390px wide; desktop is 1100px. No changes needed here — responsive fix is in the generated HTML.

### Style Tab
- **Location:** `frontend/src/components/email-builder/builder/right-panel/StyleTab.tsx`
- **Relevance:** Font family dropdown for template styling. Montserrat added as first option.
