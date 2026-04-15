# References for Fix Billing Threshold Persistence

## Similar Implementations

### survey_service.py — prior flag_modified fix

- **Location:** `backend/app/services/survey_service.py:3, 56, 81`
- **Relevance:** Identical bug fixed earlier in the same session — `flag_modified(row, 'value')` after JSONB in-place mutation
- **Key pattern:** Import `from sqlalchemy.orm.attributes import flag_modified`; call immediately after assigning to the JSONB attribute, before `flush()`

### ConfigStore model

- **Location:** `backend/app/models/config_store.py`
- **Relevance:** Confirms `value: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)` — no `MutableDict`, so mutations are invisible to SQLAlchemy without `flag_modified`
