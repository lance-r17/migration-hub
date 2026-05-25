import asyncio
import logging
import sys
from contextlib import asynccontextmanager

# Attach a StreamHandler directly to the "app" logger so INFO messages reach
# stdout.  Simply calling setLevel() is not enough: uvicorn only installs
# handlers on its own "uvicorn.*" loggers (with propagate=False), leaving the
# root logger with no handler — Python's last-resort fallback silently drops
# anything below WARNING.  We own this handler, so double-emission is prevented
# by setting propagate=False on the "app" logger.
_app_logger = logging.getLogger("app")
_app_logger.setLevel(logging.INFO)
if not _app_logger.handlers:
    _h = logging.StreamHandler(sys.stdout)
    _h.setFormatter(logging.Formatter("%(levelname)-8s %(name)s: %(message)s"))
    _app_logger.addHandler(_h)
_app_logger.propagate = False

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.database import AsyncSessionLocal
    from app.services import jira_service

    monitor_task: asyncio.Task | None = None
    cleanup_task: asyncio.Task | None = None
    email_job_task: asyncio.Task | None = None
    cutover_task: asyncio.Task | None = None

    if settings.disable_background_tasks:
        logger.info("lifespan startup: DISABLE_BACKGROUND_TASKS=true — skipping background monitors")
    else:
        # Reset stale 'processing' jobs (resume those with progress, fail the rest)
        logger.info("lifespan startup: resetting stale jobs")
        async with AsyncSessionLocal() as session:
            job_ids_to_resume = await jira_service.reset_stale_jobs(session)
            await session.commit()
        logger.info("lifespan startup: %d stale job(s) queued for resume", len(job_ids_to_resume))
        for job_id in job_ids_to_resume:
            asyncio.create_task(jira_service.process_job(job_id))

        # Sweep any 'pending' jobs that survived a crash before dispatch
        logger.info("lifespan startup: sweeping pending jobs")
        async with AsyncSessionLocal() as session:
            dispatched = await jira_service.dispatch_pending_jobs(session)
            await session.commit()
        logger.info("lifespan startup: startup sweep dispatched %d job(s)", len(dispatched))

        # Start the periodic monitor (sleeps first, so the startup sweep above runs immediately)
        logger.info("lifespan startup: starting background job monitor (interval=30s)")
        monitor_task = asyncio.create_task(jira_service.start_pending_job_monitor())

        # Start the attachment cleanup monitor (interval=1h)
        logger.info("lifespan startup: starting attachment cleanup monitor (interval=1h)")
        from app.services import attachment_service
        cleanup_task = asyncio.create_task(attachment_service.start_cleanup_monitor())

        # Start email job monitor (interval=30s)
        logger.info("lifespan startup: starting email job monitor (interval=30s)")
        from app.services import email_service
        email_job_task = asyncio.create_task(email_service.start_email_job_monitor())

        # Start cutover reminder monitor (interval=5m)
        logger.info("lifespan startup: starting cutover reminder monitor (interval=5m)")
        from app.services import cutover_reminder_service
        cutover_task = asyncio.create_task(cutover_reminder_service.start_cutover_reminder_monitor())

    yield

    # Shutdown: cancel monitors gracefully (only if they were started)
    if monitor_task is not None:
        logger.info("lifespan shutdown: cancelling background job monitor")
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            logger.info("lifespan shutdown: monitor stopped")

    if cleanup_task is not None:
        logger.info("lifespan shutdown: cancelling attachment cleanup monitor")
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            logger.info("lifespan shutdown: attachment cleanup monitor stopped")

    if email_job_task is not None:
        logger.info("lifespan shutdown: cancelling email job monitor")
        email_job_task.cancel()
        try:
            await email_job_task
        except asyncio.CancelledError:
            logger.info("lifespan shutdown: email job monitor stopped")

    if cutover_task is not None:
        logger.info("lifespan shutdown: cancelling cutover reminder monitor")
        cutover_task.cancel()
        try:
            await cutover_task
        except asyncio.CancelledError:
            logger.info("lifespan shutdown: cutover reminder monitor stopped")


_OPENAPI_TAGS = [
    {"name": "projects",   "description": "Project lifecycle management"},
    {"name": "audit",      "description": "Project-scoped audit log"},
    {"name": "waves",      "description": "Migration wave management"},
    {"name": "users",      "description": "User directory and current session"},
    {"name": "auth",       "description": "OAuth / OIDC login"},
    {"name": "admin",      "description": "Service account management (admin only)"},
    {"name": "survey",     "description": "Survey field configuration"},
    {"name": "billing",    "description": "Billing records and thresholds"},
    {"name": "jira",       "description": "Jira integration jobs"},
    {"name": "embargos",   "description": "Change freeze embargo windows"},
    {"name": "dashboard",  "description": "Summary statistics"},
    {"name": "zoom",       "description": "Zoom meeting scheduling (optional)"},
    {"name": "confluence", "description": "Confluence page export and parent page management"},
    {"name": "admin-email", "description": "Email event config and job log (admin only)"},
    {"name": "note-templates", "description": "Reusable note block templates"},
]


def create_app() -> FastAPI:
    _is_prod = settings.environment == "production"
    app = FastAPI(
        title="Migration Engine API",
        version="0.1.0",
        description="Backend API for the Migration Engine cloud migration tracking platform",
        lifespan=lifespan,
        openapi_tags=_OPENAPI_TAGS,
        docs_url=None if _is_prod else "/docs",
        redoc_url=None if _is_prod else "/redoc",
        openapi_url=None if _is_prod else "/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.routers import (
        admin,
        admin_email,
        audit,
        billing,
        confluence,
        dashboard,
        email_templates,
        embargos,
        jira,
        note_templates,
        oauth,
        product_categories,
        projects,
        survey,
        users,
        waves,
        zoom,
    )

    prefix = "/api/v1"
    app.include_router(projects.router, prefix=prefix)
    app.include_router(waves.router, prefix=prefix)
    app.include_router(users.router, prefix=prefix)
    app.include_router(users.auth_router, prefix=prefix)
    app.include_router(oauth.router, prefix=prefix)
    app.include_router(dashboard.router, prefix=prefix)
    app.include_router(audit.router, prefix=prefix)
    app.include_router(survey.router, prefix=prefix)
    app.include_router(embargos.router, prefix=prefix)
    app.include_router(billing.router, prefix=prefix)
    app.include_router(billing.settings_router, prefix=prefix)
    app.include_router(jira.router, prefix=prefix)
    app.include_router(jira.admin_router, prefix=prefix)
    app.include_router(product_categories.router, prefix=prefix)
    app.include_router(email_templates.router, prefix=prefix)
    app.include_router(note_templates.router, prefix=prefix)
    app.include_router(zoom.router, prefix=prefix)
    app.include_router(confluence.router, prefix=prefix)
    app.include_router(admin.router, prefix=prefix)
    app.include_router(admin_email.router, prefix=prefix)

    # MCP SSE endpoint — mounted outside /api/v1 so the SSE path is /mcp/sse
    from app.mcp import sse_router as mcp_sse_router

    app.include_router(mcp_sse_router.router, prefix="/mcp")

    @app.get("/health")
    async def health():
        # Readiness probe: verify DB connectivity before declaring healthy
        try:
            from app.database import engine
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as exc:
            logger.warning("health check failed: %s", exc)
            raise HTTPException(status_code=503, detail="database unavailable")
        return {"status": "ok"}

    return app


app = create_app()
