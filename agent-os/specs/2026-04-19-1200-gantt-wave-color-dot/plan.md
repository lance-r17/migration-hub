# Plan: Wave Color Dot in Gantt Index Cell

## Task 1: Save spec documentation ✅

## Task 2: Add color dot to project row index cell ✅

Replaced the `# col` div in the project row with a flex container holding:
- `<span className="w-2 h-2 rounded-full shrink-0" style={{ background: waveColor }} />`
- `<span style={{ fontFamily: ... }}>{row.projectIndex}</span>`
