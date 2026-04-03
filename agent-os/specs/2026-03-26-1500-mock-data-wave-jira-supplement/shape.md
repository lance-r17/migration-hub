# Mock Data Wave & Jira Supplement — Shaping Notes

## Scope

Backfill `jiraBaseUrl` on all 4 mock projects and assign valid `waveId` values to projects that have a `migrationWave` text but no `waveId` reference.

## Decisions

- **jiraBaseUrl value:** Consistent placeholder `https://your-org.atlassian.net` across all projects — reflects a single Jira instance per org.
- **M-77122 waveId:** "Wave 2" text had no matching wave; user chose `wave-1` (Wave 3 – Q2 2026).
- **M-88271 waveId:** Left unassigned per user — project is in early planning with no wave commitment.
- **M-11029 waveId:** `wave-3` (Wave 1 – Q4 2025) — name matches exactly.

## Context

- **Visuals:** None
- **References:** `frontend/src/data/mock.ts` — existing wave/jiraBaseUrl patterns on PRJ-2024-ALPHA and M-11029
- **Product alignment:** N/A
