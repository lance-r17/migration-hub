# Plan: Wrap ProjectCard with MotionCard

## Context

`ProjectCard.tsx` used a plain `div` shell. Wrapped it with `MotionCard` to add consistent `whileHover` lift animation.

## Changes Made

### `MotionCard.tsx`
- Added optional `onClick?: () => void` prop forwarded to `motion.div`

### `ProjectCard.tsx`
- Replaced outer `div` with `MotionCard`
- `onClick` navigates to project detail
- `className` passes `cursor-pointer p-6` + conditional border hover colors
