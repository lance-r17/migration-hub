# Fix Billing Threshold Persistence — Shaping Notes

## Scope

Bug fix: billing threshold config saved successfully (200 OK) but resets to defaults on browser refresh.

## Root Cause

`ConfigStore.value` is plain `JSONB` (no `MutableDict` extension). When `update_threshold_config()` does `row.value = current` and calls `flush()`, SQLAlchemy's ORM change tracker doesn't mark the column dirty → no `UPDATE` is sent to the DB.

## Decision

Add `flag_modified(row, 'value')` immediately after `row.value = current` — same pattern already in `survey_service.py:56,81`.

## Context

- **Visuals:** None
- **References:** `backend/app/services/survey_service.py` (prior fix), `backend/app/models/config_store.py`
- **Product alignment:** N/A — pure bug fix
