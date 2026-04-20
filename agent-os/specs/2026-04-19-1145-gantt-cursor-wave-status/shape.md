# Gantt Cursor + Wave Status — Shaping Notes

## Scope

Two polish changes to `WaveGanttChart.tsx`:
1. Project row left panel wrapper gets `cursor-pointer` so the whole clickable cell shows a pointer cursor
2. Wave row status column renders a status pill (`planned` / `active` / `completed`)

## Decisions

- `cursor-pointer` on the outer project left-panel grid div (not individual cells) — covers all sub-columns uniformly
- `WAVE_STATUS_META` constant mirrors `PROJECT_STATUS_META` pattern; uses matching okclh colors
- Unassigned header row keeps its empty status column (no status concept applies there)
- Pill style identical to project row pill: `rounded-full text-[11px]` with inline bg/color

## Context

- **Visuals:** None
- **References:** `PROJECT_STATUS_META` + project row status pill in WaveGanttChart.tsx
- **Product alignment:** N/A
