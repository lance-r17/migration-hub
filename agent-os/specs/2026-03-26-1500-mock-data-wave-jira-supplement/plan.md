# Plan: Supplement jiraBaseUrl + Fix waveId Assignments in Mock Data

## Context

Two gaps existed in the mock project data:
1. `jiraBaseUrl` was only on PRJ-2024-ALPHA and M-11029 — M-88271 and M-77122 were missing it.
2. Three of four projects lacked a `waveId` field despite having `migrationWave` text labels.

## Changes Made

### jiraBaseUrl additions
- `M-88271` — added `jiraBaseUrl: 'https://your-org.atlassian.net'`
- `M-77122` — added `jiraBaseUrl: 'https://your-org.atlassian.net'`

### waveId assignments
| Project | migrationWave | waveId assigned |
|---|---|---|
| M-11029 | "Wave 1" | `wave-3` (Wave 1 – Q4 2025) |
| M-77122 | "Wave 2" | `wave-1` (Wave 3 – Q2 2026) |
| M-88271 | (none) | left unassigned |
| PRJ-2024-ALPHA | "Wave 3" | `wave-1` (already set) |

**File modified:** `frontend/src/data/mock.ts`
