from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: reset any stale Jira jobs left in 'processing' state
    from app.database import AsyncSessionLocal
    from app.services.jira_service import reset_stale_jobs

    async with AsyncSessionLocal() as session:
        await reset_stale_jobs(session)
        await session.commit()

    yield
    # Shutdown: nothing needed


def create_app() -> FastAPI:
    app = FastAPI(
        title="Migration Hub API",
        version="0.1.0",
        description="Backend API for the Migration Hub cloud migration tracking platform",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.routers import (
        audit,
        billing,
        dashboard,
        email_templates,
        embargos,
        jira,
        product_categories,
        projects,
        survey,
        users,
        waves,
    )

    prefix = "/api/v1"
    app.include_router(projects.router, prefix=prefix)
    app.include_router(waves.router, prefix=prefix)
    app.include_router(users.router, prefix=prefix)
    app.include_router(users.auth_router, prefix=prefix)
    app.include_router(dashboard.router, prefix=prefix)
    app.include_router(audit.router, prefix=prefix)
    app.include_router(survey.router, prefix=prefix)
    app.include_router(embargos.router, prefix=prefix)
    app.include_router(billing.router, prefix=prefix)
    app.include_router(billing.settings_router, prefix=prefix)
    app.include_router(jira.router, prefix=prefix)
    app.include_router(product_categories.router, prefix=prefix)
    app.include_router(email_templates.router, prefix=prefix)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
