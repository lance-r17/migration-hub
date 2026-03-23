# MotionCard — Shaping Notes

## Scope

Create a shared `MotionCard` component in the Migration Hub frontend that provides a reusable animated card shell. The component wraps `motion.div` (hover lift) + shadcn `Card`, with `children` for fully composable content via `CardHeader` / `CardContent`.

## Decisions

- Children-based API (not prop slots) — consumers use `CardHeader`/`CardContent` directly
- No icon, title, or Pro badge baked in — those belong to consumers
- `variants` prop is optional passthrough for stagger animations from a parent motion container
- Uses shadcn `Card` as the inner element (not a raw `div`) to align with the design system
- No barrel `index.ts` — imported directly per existing convention

## Context

- **Visuals:** None provided — derived from features/page.tsx source
- **References:** `shadcn/src/app/features/page.tsx` (source pattern), `frontend/src/components/shared/SectionCard.tsx` (code style reference)
- **Product alignment:** N/A — internal UI infrastructure
