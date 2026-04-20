# Plan: Gantt Cursor + Wave Status Pill

## Task 1: Save spec documentation ✅

## Task 2: cursor-pointer on project row ✅

Added `cursor-pointer` to `cn(...)` of the project left-panel grid wrapper div.

## Task 3: Wave status pill ✅

Added `WAVE_STATUS_META` constant above `PROJECT_STATUS_META`.
Replaced empty `<div className={cellClass} />` in the real wave row's status column with a pill span.
Unassigned header row status column left empty.
