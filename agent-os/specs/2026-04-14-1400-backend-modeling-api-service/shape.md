# Backend Modeling & API Service — Shaping Notes

## Scope

Full-stack backend for Migration Hub: Python SQLAlchemy models, Pydantic v2 schemas, Alembic migrations, FastAPI routers, service layer, seed data script, and Docker Compose. Covers all domains: Projects, Cloud Resources, Waves, Users, Audit Log, Survey, Embargos, Billing, Jira Jobs, Dashboard.

## Decisions

- **Python + FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL** — follows tech-stack.md exactly
- **TEXT PKs for Project** — preserves frontend IDs (`PRJ-2024-ALPHA`, `M-11029`) without transformation
- **UUID PKs** for all other entities
- **JSONB for complex nested section fields** on Project (applicationOverview, availability, dataPersistence, dependencies, nfrs, migrationConstraints, targetArchitecture) — patched as atomic sections; no cross-section server-side querying
- **Normalized tables** for CloudResource, Risk, Approval, AuditLogEntry — these need individual row operations
- **config_store table** (key TEXT PK, value JSONB) — single table for three singleton configs: survey_config, resource_survey_config, billing_threshold_config
- **VARCHAR enums** instead of PostgreSQL ENUM types — avoids Alembic migration pain when adding values
- **BackgroundTasks for Jira jobs** — same-process async; startup hook resets stale `processing` → `failed`; Celery/ARQ is documented upgrade path
- **No authentication** — `GET /users/me` returns `CURRENT_USER_ID` env var; service layer accepts `actor_user_id` param for future JWT wiring
- **BillingRecord upsert** — delete-then-insert for (month, env) batch, wrapped in transaction
- **Static survey field-defs** — Python constant list, not DB-backed

## Context

- **Visuals:** None
- **References:** `frontend/src/services/*.ts` (authoritative API contract), `frontend/src/types/index.ts` (schema shapes), `frontend/src/data/mock.ts` (seed data source), `frontend/src/data/store.ts` (service layer logic reference)
- **Product alignment:** Implements Phase 1 backend; enables frontend USE_MOCK=false mode with no frontend code changes

## Standards Applied

- No agent-os/standards directory exists yet — followed FastAPI, SQLAlchemy 2.0, Pydantic v2 idiomatic patterns
