# Install pgweb — Shaping Notes

## Scope

Add pgweb (web-based PostgreSQL browser) to the local development environment so the team can inspect the `migration_hub` database via a browser UI.

## Decisions

- **Integration method**: Docker Compose service (not devcontainer binary install) — starts automatically with `docker compose up`, no manual steps needed
- **Port**: 8081 — unused by existing services (8000=backend, 5432=db, 5556=dex)
- **Connection**: Internal Docker DNS (`db`) with `sslmode=disable` for local dev
- **Image**: `sosedoff/pgweb` (official image)

## Context

- **Visuals**: None
- **References**: `backend/docker-compose.yml` — existing service patterns
- **Product alignment**: N/A — dev tooling only
