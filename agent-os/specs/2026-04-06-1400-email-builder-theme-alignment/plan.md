# Email Builder: Theme Alignment & Mobile Preview Fix

## Context

The email builder feature was built with hardcoded default styles (`#0053db` blue accent, `#1a1a1a` text, `Inter` font) that don't match the Migration Hub's warm earthy design system (Montserrat font, warm orange-tan primary, dark warm brown text). Additionally, the preview body background uses a cool gray (`#f3f4f6`) that clashes with the platform's warm beige. Finally, mobile preview mode is broken — the iframe is 390px wide but the email content table is hardcoded at 600px, causing overflow instead of proper reflow.

**Goals:**
1. Default email styles match the project's design tokens (font, text color, accent color)
2. Preview body background matches the platform background color
3. Mobile preview properly stacks multi-column layouts

---

## Task 1: Save Spec Documentation ✅

Created `agent-os/specs/2026-04-06-1400-email-builder-theme-alignment/` with plan.md, shape.md, references.md.

---

## Task 2: Align DEFAULT_TEMPLATE_STYLE with project design tokens ✅

**`frontend/src/types/email.ts`** — Updated defaults:
- `fontFamily`: `'Inter'` → `'Montserrat'`
- `textColor`: `'#1a1a1a'` → `'#4A3F35'` (CSS `--foreground`)
- `accentColor`: `'#0053db'` → `'#A67C52'` (CSS `--primary`)
- `backgroundColor`: unchanged (`'#ffffff'` — standard for email content cards)

**`frontend/src/components/email-builder/builder/right-panel/StyleTab.tsx`** — Added `'Montserrat'` as first item in font dropdown.

---

## Task 3: Fix preview body background color ✅

**`frontend/src/components/email-builder/preview/TemplateRenderer.tsx`** — Changed both occurrences of `#f3f4f6` to `#F5F1E6` (CSS `--background`, warm beige).

---

## Task 4: Fix mobile preview responsiveness ✅

**`frontend/src/components/email-builder/preview/TemplateRenderer.tsx`**:
- Added `class="email-col"` to `<td>` in `renderColumn()`
- Added `class="email-content"` to the content wrapper `<table>` in `generateEmailHtml()`
- Added `@media screen and (max-width: 480px)` block to `<style>` that forces `.email-content` to 100% width and stacks `.email-col` elements vertically
