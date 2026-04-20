# Plan: Gantt Project Row Whole-Cell Click

## Task 1: Save spec documentation ✅

## Task 2: Make project row left panel cell fully clickable ✅

**File:** `frontend/src/components/waves/WaveGanttChart.tsx`

- Added `onClick={() => scrollToBar(p.id)}` to the project left panel grid wrapper div
- Changed collapse icon span to `onClick={e => { e.stopPropagation(); toggleProject(p.id) }}`
