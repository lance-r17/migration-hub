# Gantt Wave Color Dot — Shaping Notes

## Scope

Add a small colored circle (`w-2 h-2 rounded-full`) to the project row's index cell (`# col`) in the Gantt left panel, using the wave's color to visually associate each project with its wave.

## Decisions

- Circle placed left of the index number within the same 40px cell
- `gap-[5px]` between dot and number; `fontFamily` moved from div to number span
- Unassigned projects use `DEFAULT_WAVE_COLOR` (`#6366F1`) fallback — consistent indicator
- `waveColor` was already computed in the project row block: `wave?.color ?? DEFAULT_WAVE_COLOR`

## Context

- **Visuals:** None
- **References:** `waveColor` usage in wave row and task row; wave color dot in WavesPage board
- **Product alignment:** N/A
