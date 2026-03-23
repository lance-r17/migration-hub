# Plan: MotionCard Shared Component

## Context

Extract the animated feature card pattern from `shadcn/src/app/features/page.tsx` into a reusable `MotionCard` shell component in the Migration Hub frontend at `frontend/src/components/shared/MotionCard.tsx`.

## Component Design

`MotionCard` is a generic animated card shell — it owns the `motion.div` wrapper and the shadcn `Card` container. Consumers compose content using `CardHeader`, `CardContent`, or any children.

### Props
```ts
interface MotionCardProps {
  children: ReactNode    // CardHeader, CardContent, or any content
  className?: string     // merged onto the Card element
  variants?: Variants    // motion/react — enables parent stagger animations
}
```

### Behaviour
- `motion.div` root with `whileHover={{ y: -5, transition: { duration: 0.2 } }}`
- Optional `variants` passthrough for stagger containers
- Inner `Card` with: `group h-full rounded-2xl border-border/40 bg-card/50 transition-all hover:bg-card hover:shadow-lg`

## File Created
- `frontend/src/components/shared/MotionCard.tsx`
