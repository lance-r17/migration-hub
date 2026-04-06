# Pre-defined Template Style Alignment — Shaping Notes

## Scope

Apply the updated DEFAULT_TEMPLATE_STYLE (Montserrat, #4A3F35 text, #A67C52 accent) uniformly to all 8 pre-defined email templates. This includes templateStyle objects and all inline HTML hardcoded colors.

## Decisions

- **Uniform accent over semantic colors:** User chose to apply #A67C52 to all templates rather than keep per-template semantic colors (green for success, red for alerts, etc.). Brand consistency takes priority.
- **Update inline HTML too:** Heading text colors, CTA backgrounds, and hero image placeholder URLs all updated to #A67C52.
- **Keep gray/neutral colors unchanged:** Divider (#e5e7eb), footer text (#6b7280), and metadata labels (#6b7280) remain as standard email muted colors.
- **ctaComponent helper default updated:** The shared helper's default `bg` changed so future usages without explicit colors automatically use the project accent.

## Context

- **Visuals:** None
- **References:** `frontend/src/data/emailTemplates.ts`, `frontend/src/types/email.ts`
- **Product alignment:** Consistency with the platform's warm earthy brand identity
