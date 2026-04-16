# Sync Waves Seed Data — Shaping Notes

## Scope

Extract current wave records from the live PostgreSQL database and update seed data files so that `seed.py --force` restores an environment matching what was actually built.

## Decisions

- Preserve the existing `created_at` values for the 3 original seeded waves (wave-1, wave-2, wave-3) — the DB timestamps reflect the last seed run, not meaningful ordering; the JSON values are intentional.
- Add the new wave (Wave 5 - Q1 2027, UUID id) with its actual DB `created_at`.
- Update `PRJ-2024-ALPHA` in `projects.json` — it was reassigned from wave-1 to the new wave in the DB.

## DB State Discovered

| id | name | status |
|----|------|--------|
| wave-1 | Wave 3 – Q2 2026 | planned |
| wave-2 | Wave 4 – Q3 2026 | planned |
| wave-3 | Wave 1 – Q4 2025 | completed |
| 104929ce-c0f8-41be-937d-6b5afc67458a | Wave 5 - Q1 2027 | planned |

Project `PRJ-2024-ALPHA` has `wave_id = 104929ce-c0f8-41be-937d-6b5afc67458a` in DB but `wave-1` in seed.

## Context

- **Visuals:** None
- **References:** `backend/scripts/seed_data/waves.json`, `backend/scripts/seed_data/projects.json`
- **Product alignment:** N/A
