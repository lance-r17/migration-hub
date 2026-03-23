# References for MotionCard

## Similar Implementations

### Feature Card (source pattern)

- **Location:** `shadcn/src/app/features/page.tsx`
- **Relevance:** The exact card pattern being extracted — motion wrapper, hover animation, card styling
- **Key patterns:** `motion.div` with `variants` + `whileHover`, `group` class for child hover transitions

### SectionCard

- **Location:** `frontend/src/components/shared/SectionCard.tsx`
- **Relevance:** Closest existing shared component — wraps shadcn `Card` with a typed props interface
- **Key patterns:** Named export, TypeScript interface, `cn()` for className merging, uses `Card`/`CardHeader`/`CardContent` from `@/components/ui/card`
