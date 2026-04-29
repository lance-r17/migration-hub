# Migration Activity Bar Chart — Plan

## Context

Enhance the **Overall Migration Progress** card on the home page by adding a vertically-oriented bar chart that shows migration activities (number of projects) by month, spanning **January 2026 through December 2027** (24 months). The chart must be horizontally scrollable within the card.

## Current State

- `OverallProgressCard` is at `frontend/src/components/home/OverallProgressCard.tsx`
- It receives `OverallStats` and shows progress %, total assets, and target cloud
- No charting library is installed; the existing `PieChart` is a custom SVG component (`frontend/src/components/shared/PieChart.tsx`)
- Backend `OverallStatsOut` does not include monthly migration activity data
- Projects have `waveId` linking to `Wave` objects with `startDate` / `cutoverDate`
- Mock data has 4 projects across 3 waves with date ranges

## Decisions

- **Data source:** Derive monthly project counts client-side from existing `projects` + `waves`. A project counts toward a month if its assigned wave's date range overlaps that month.
- **Visual design:** Align with current design system — use `--primary` for bars, `--muted-foreground` for axis labels, `--foreground` for value labels. Custom SVG component (no new dependencies).

## Approach

1. **Build a reusable `BarChart` component** — Custom SVG vertical bar chart following the same patterns as `PieChart`. Accepts `{ label: string; value: number }[]`, bar color, and dimensions. Renders bars with value labels on top and category labels below.
2. **Derive migration activity data in `OverallProgressCard`** — Accept `projects` and `waves` as new props. For each month in Jan 2026–Dec 2027, count projects whose wave overlaps that month. A wave overlaps a month when `wave.startDate ≤ month_end` AND `wave.cutoverDate ≥ month_start`.
3. **Update `HomePage`** — Import `useWaves`, pass `projects` and `waves` into `OverallProgressCard`.
4. **Style the scroll container** — Wrap the chart in a `overflow-x-auto` container so it scrolls horizontally within the card while respecting the existing scrollbar design system (`::-webkit-scrollbar` styles already defined in `index.css`).

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/shared/BarChart.tsx` | **New** — Reusable SVG vertical bar chart |
| `frontend/src/components/home/OverallProgressCard.tsx` | Add bar chart section; accept `projects` and `waves` props; compute monthly counts |
| `frontend/src/pages/HomePage.tsx` | Import `useWaves`; pass `projects` and `waves` to `OverallProgressCard` |
| `frontend/e2e/tests/home.spec.ts` | Add assertion that migration activity chart labels/scroll area are visible |

## Reuse

- **`PieChart` pattern** (`frontend/src/components/shared/PieChart.tsx`) — Reference for custom SVG component structure, styling, and Tailwind class usage.
- **`useWaves` hook** (`frontend/src/hooks/use-waves.ts`) — Already fetches waves; reuse in `HomePage`.
- **Scrollbar design system** (`frontend/src/index.css` `@layer base`) — Horizontal scroll will automatically inherit themed scrollbar styles.
- **`--chart-*` / `--primary` tokens** (`frontend/src/index.css`) — For bar and label colors.

## Steps

- [ ] **Step 1:** Create `frontend/src/components/shared/BarChart.tsx`
  - SVG-based vertical bar chart
  - Props: `data: { label: string; value: number }[]`, `barColor?: string`, `maxValue?: number`, `barWidth?: number`, `height?: number`, `gap?: number`
  - Render bars with rounded tops (if easy via SVG), value labels above bars, x-axis labels below
  - Handle empty state gracefully
- [ ] **Step 2:** Update `OverallProgressCard` props and logic
  - Extend interface to accept `projects: Project[]` and `waves: Wave[]`
  - Build helper `getMonthlyMigrationActivity(projects, waves)` that returns 24 data points (Jan 2026 – Dec 2027)
  - Insert chart below existing stats row inside `CardContent`
  - Wrap chart in `overflow-x-auto` container with `pb-2` to show scrollbar inside card
- [ ] **Step 3:** Update `HomePage.tsx`
  - Add `import { useWaves } from '@/hooks/use-waves'`
  - Call `useWaves()` alongside existing hooks
  - Pass `projects` and `waves` to `OverallProgressCard`
  - Handle loading state for waves (existing `loading` boolean can include `wavesLoading`)
- [ ] **Step 4:** E2E test update
  - Add assertion in `home.spec.ts` that a chart label or scroll area related to migration activity is visible
- [ ] **Step 5:** Manual verification
  - Run dev server, verify 24 months render and horizontal scroll works
  - Verify bar heights correspond to project counts derived from wave dates
  - Confirm dark mode compatibility

## Verification

- `npm run dev` (or equivalent) — visually inspect the Overall Migration Progress card
- Confirm 24 bars (Jan 2026 – Dec 2027) render inside a horizontally scrolling area
- Confirm existing home page E2E tests pass: `npx playwright test frontend/e2e/tests/home.spec.ts`
- Confirm no new runtime dependencies are added
