# Apply DEFAULT_TEMPLATE_STYLE to Pre-defined Templates

## Context

After updating `DEFAULT_TEMPLATE_STYLE` to use project design tokens (Montserrat, `#4A3F35` text, `#A67C52` accent), the 8 pre-defined email templates in `emailTemplates.ts` still override `accentColor` with old semantic per-template colors (blue, amber, red, green, purple). Their inline HTML content strings also hardcoded those old colors in heading text, CTA backgrounds, and hero placeholder image URLs. This change applies the new DEFAULT_TEMPLATE_STYLE uniformly across all pre-defined templates.

## Changes ✅

**File: `frontend/src/data/emailTemplates.ts`**

- `ctaComponent` helper default `bg` changed from `'#0053db'` to `'#A67C52'`
- All 8 templates: `templateStyle` spread no longer overrides `accentColor`
- All 8 templates: heading `color:` in inline HTML updated to `#A67C52`
- 5 templates with hero images: placeholder URL hex updated to `A67C52`
- 6 templates with explicit CTA bg colors: explicit arg removed (uses default)
- Risk alert severity color updated from `#9f403d` to `#A67C52`

## Not changed

- Divider color `#e5e7eb` — standard gray divider
- Footer text `color:#6b7280` — standard muted gray for email footers
- Label/metadata text `color:#6b7280` in risk alert two-col
