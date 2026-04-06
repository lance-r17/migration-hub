# Default Template Background Color — Shaping Notes

## Scope

Single value change: `DEFAULT_TEMPLATE_STYLE.backgroundColor` from `#ffffff` to `#FFFCF5`.

## Decisions

- **Warm near-white over pure white:** `#FFFCF5` is the hex equivalent of the project's `--card` CSS variable (`hsl(42, 100%, 98.04%)`). It's indistinguishable from white in most email clients but eliminates the cold contrast against the `#F5F1E6` body wrapper.
- **No changes to TemplateRenderer.tsx:** Body background already uses `#F5F1E6` from the prior 1400 spec. No further changes needed there.
- **No changes to emailTemplates.ts:** Predefined templates do not override `templateStyle.backgroundColor`, so they inherit the updated default automatically.

## Context

- **Visuals:** None
- **References:** `frontend/src/index.css` (CSS custom properties), `frontend/src/types/email.ts`
- **Prior work:** `agent-os/specs/2026-04-06-1400-email-builder-theme-alignment` — intentionally kept `#ffffff` as "standard email convention"; this spec revisits that decision per user feedback.

## Color Derivation

`--card: hsl(42.0000 100.0000% 98.0392%)` → `#FFFCF5`
- C = (1 - |2×0.980392 - 1|) × 1 = 0.039216
- R = 255, G = 252, B = 245
