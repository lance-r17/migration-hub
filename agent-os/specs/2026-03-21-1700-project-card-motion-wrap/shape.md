# ProjectCard MotionCard Wrap — Shaping Notes

## Scope

Refactor `ProjectCard` to use `MotionCard` as its card shell, gaining the shared hover lift animation.

## Decisions

- `MotionCard` extended with optional `onClick` on `motion.div` to support navigable cards
- Padding (`p-6`) and conditional border hover colors passed via `className` to `MotionCard`
- Inner content structure unchanged — no `CardHeader`/`CardContent` restructuring needed

## Context

- **Visuals:** None
- **References:** `ProjectCard.tsx`, `MotionCard.tsx`
- **Product alignment:** N/A
