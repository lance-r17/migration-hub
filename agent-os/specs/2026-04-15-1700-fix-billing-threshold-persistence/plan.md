# Fix: Billing Threshold Config Resets on Browser Refresh

## Context

`PUT /api/v1/settings/billing-thresholds` returns 200 OK but saved values are lost on browser refresh. Root cause: `billing_service.py:update_threshold_config()` mutates the `ConfigStore.value` JSONB field but SQLAlchemy doesn't detect the change — same bug previously fixed in `survey_service.py`.

## Change Made

**`backend/app/services/billing_service.py`**

Added `from sqlalchemy.orm.attributes import flag_modified` import and `flag_modified(row, 'value')` call after `row.value = current` in `update_threshold_config()`.

## Verification

1. Open `/settings/billing` with backend running
2. Change a threshold and save (watch for 200 OK in logs)
3. Refresh — values persist
