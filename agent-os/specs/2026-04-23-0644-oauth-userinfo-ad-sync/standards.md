# Standards for OAuth Userinfo AD Sync

No formal standards exist in `agent-os/standards/` for this codebase.

The implementation follows these de-facto patterns from the existing backend:

- **Async SQLAlchemy 2.0** — `AsyncSession`, `select()`, mapped columns with type hints.
- **FastAPI router organization** — Business logic lives in `app/services/`, routers delegate to services.
- **Pydantic Settings** — Configuration via `BaseSettings` with `.env` file support.
- **Consistent logging** — `logger.info()` for successful operations, `logger.warning()` for validation issues and skips.
