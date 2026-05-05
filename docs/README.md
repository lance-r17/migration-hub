# Documentation Index

| Document | Description |
|---|---|
| [../README.md](../README.md) | Project introduction, quick-start, route map |
| [architecture.md](architecture.md) | Full system architecture — layers, data flow, key decisions |
| [getting-started.md](getting-started.md) | Prerequisites, install, run, environment setup |
| **frontend/** | |
| [frontend/overview.md](frontend/overview.md) | Structure, routing, auth, mock vs real API |
| [frontend/hooks.md](frontend/hooks.md) | Custom React hooks — signatures and usage |
| [frontend/services.md](frontend/services.md) | Service layer — all API functions and endpoints |
| [frontend/components.md](frontend/components.md) | Component inventory with props and usage guidance |
| [frontend/best-practices.md](frontend/best-practices.md) | Patterns: section saves, drawers, audit logging, RBAC |
| [frontend/testing.md](frontend/testing.md) | Playwright E2E test suite — structure, auth fixture, running tests, CI |
| **backend/** | |
| [backend/overview.md](backend/overview.md) | Backend structure and design principles (Python/FastAPI) |
| [backend/api.md](backend/api.md) | REST API endpoint reference derived from frontend services |
| [backend/database.md](backend/database.md) | Database schema, indexes, and Alembic migrations |
| [backend/docker-build-push.md](backend/docker-build-push.md) | Docker image build, multi-stage Dockerfile, Nexus registry push, and container runtime configuration |
| **shared/** | |
| [shared/data-model.md](shared/data-model.md) | Core domain types shared between frontend and backend |
| [shared/jira-integration.md](shared/jira-integration.md) | Jira integration — epic/story/subtask flow, job queue |
| [shared/sso-configuration.md](shared/sso-configuration.md) | Authentication configuration — custom enterprise OAuth, OIDC (legacy), mock auth, env vars, user provisioning |
