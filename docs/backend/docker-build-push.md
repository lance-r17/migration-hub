# Backend Docker Build & Push

## Quick reference

| Step | Command |
|---|---|
| Build image locally | `docker build -t migration-hub-backend:latest .` |
| Build with custom base images | `docker build --build-arg BUILD_IMAGE=python:3.12-slim --build-arg RUNTIME_IMAGE=python:3.12-slim -t migration-hub-backend:latest .` |
| Build & push to Nexus | `./build-push-nexus.sh` |
| Build & push with custom tag | `./build-push-nexus.sh -t v1.2.3` |
| Build only (skip push) | `./build-push-nexus.sh --build-only` |
| Pass build args from env vars | `./build-push-nexus.sh --build-arg BUILD_IMAGE="$BUILD_IMAGE" --build-arg RUNTIME_IMAGE="$RUNTIME_IMAGE"` |

## Dockerfile

The backend `Dockerfile` uses a **multi-stage build** with configurable base images:

```dockerfile
# syntax=docker/dockerfile:1

ARG BUILD_IMAGE=python:3.12-slim
ARG RUNTIME_IMAGE=python:3.12-slim

FROM ${BUILD_IMAGE} AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]" \
    && pip install --no-cache-dir psycopg2-binary

FROM ${RUNTIME_IMAGE}
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Key points:
- **Multi-stage**: the `builder` stage compiles dependencies with `gcc`/`libpq-dev`; the runtime stage receives only the virtual environment and application code — no build tools.
- **Configurable base images**: both `BUILD_IMAGE` and `RUNTIME_IMAGE` are set via `ARG` and can be overridden at build time.
- `pyproject.toml` is copied and installed **before** the rest of the source so Docker layer caching works for dependency-only changes.
- `psycopg2-binary` is installed explicitly for the synchronous `scripts/seed.py` seeder.
- `.dockerignore` excludes `__pycache__`, `.git`, `.venv`, `uploads/`, etc. from the build context.

### Choosing base images

Both images are configured via the `.env.nexus` file (see below) or `--build-arg` flags.

| Stage | Purpose | Requirements |
|---|---|---|
| `BUILD_IMAGE` | Compile Python dependencies | Python 3.12+, package manager (apt), `gcc`, `libpq-dev` |
| `RUNTIME_IMAGE` | Run the application | Python 3.12+, compatible installation path with `BUILD_IMAGE` |

**Important**: `BUILD_IMAGE` and `RUNTIME_IMAGE` must use the **same Python version** and have Python installed at a **compatible path** (the virtual environment's `pyvenv.cfg` references the build-time Python location). The safest choice is to use the same image family for both stages, or a matched pair such as:

| Build image | Runtime image |
|---|---|
| `python:3.12-slim` | `python:3.12-slim` |
| `cgr.dev/chainguard/python:latest-dev` | `cgr.dev/chainguard/python:latest` |

For a true **distroless** runtime, set `RUNTIME_IMAGE` to your enterprise distroless Python image (e.g. `gcr.io/distroless/python3-debian12`, `cgr.dev/chainguard/python:latest`, or an internal hardened image). Ensure it matches the Python version and installation path of `BUILD_IMAGE`.

## Environment files

The backend uses multiple `.env` files for different contexts. All are gitignored to prevent secrets from leaking into the repo.

| File | Context | Hostnames |
|---|---|---|
| `.env` | Local development (`uvicorn`, `alembic`, `seed.py` on host) | `localhost` |
| `.env.docker` | Docker container runtime | Docker service names (`db`, `mock-oauth`) |
| `.env.nexus` | Build/push script configuration | — |

Only the `.env.*.example` files are committed as templates.

### `.env.docker` — Container runtime configuration

When running the pre-built Docker image, **always use `.env.docker`** (not `.env`). Inside a container, `localhost` means the container itself, not your host machine. The `.env.docker` file replaces `localhost` with Docker Compose service names.

**Hostnames that differ inside a container:**

| Service | In `.env` (local dev) | In `.env.docker` (container) |
|---|---|---|
| PostgreSQL | `localhost:5432` | `db:5432` |
| Mock OAuth | `localhost:5557` | `mock-oauth:5557` |
| Dex (OIDC) | `localhost:5556` | `dex:5556` |

Example `.env.docker`:

```bash
# PostgreSQL — use the Compose service name, not localhost
DATABASE_URL=postgresql+asyncpg://hub:hub_dev_secret@db:5432/migration_hub

CORS_ORIGINS=http://localhost:5173
CURRENT_USER_ID=u-current
ENVIRONMENT=development

# OAuth — use the Compose service name
OAUTH_SERVICE_URL=http://mock-oauth:5557
OAUTH_CLIENT_ID=migration-hub
OAUTH_CLIENT_SECRET=mock-secret-do-not-use-in-production
SESSION_SECRET_KEY=change-me-in-production
```

### Required variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |

### Conditionally required

| Variable | Required when |
|---|---|
| `OAUTH_CLIENT_SECRET` | `OAUTH_SERVICE_URL` is set |
| `SESSION_SECRET_KEY` | `OAUTH_SERVICE_URL` is set |

### Optional variables

See `backend/.env.example` for the full list (CORS origins, Jira credentials, OIDC settings, AD group mappings, etc.).

### Running the container locally

Put the backend on the same Docker network as your PostgreSQL container so the service name `db` resolves correctly:

```bash
# 1. Find your Docker Compose network name
docker network ls | grep backend
# → backend_default

# 2. Run the backend container on that network
docker run -d \
  --name backend-runtime \
  --network backend_default \
  --env-file .env.docker \
  -p 8000:8000 \
  migration-hub-backend:latest
```

**Why `--network backend_default` is required:** Docker's internal DNS resolves service names (like `db`) only within the same network. If the backend container is not on the `backend_default` network, `db` won't resolve and you'll get `ConnectionRefusedError`.

### Injection methods (all platforms)

**1. `docker run --env-file`**

```bash
docker run -d \
  --network backend_default \
  --env-file .env.docker \
  -p 8000:8000 \
  migration-hub-backend:latest
```

**2. `docker run -e` (individual vars)**

```bash
docker run -d \
  --network backend_default \
  -e DATABASE_URL="postgresql+asyncpg://hub:pass@db:5432/migration_hub" \
  -e CORS_ORIGINS="http://localhost:5173" \
  -p 8000:8000 \
  migration-hub-backend:latest
```

**3. Docker Compose `env_file`**

```yaml
services:
  backend:
    image: nexus.company.com/docker-hosted/migration-hub/backend:latest
    env_file: .env.docker
    networks:
      - backend_default
    ports:
      - "8000:8000"
```

**4. Kubernetes / OpenShift**

```yaml
envFrom:
  - secretRef:
      name: backend-secrets
  - configMapRef:
      name: backend-config
```

**5. Cloud secret managers** (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, HashiCorp Vault)

Mount secrets as environment variables via your platform's integration (e.g. Kubernetes external-secrets, ECS secrets, etc.).

## Manual build

From the `backend/` directory:

```bash
# Default base images
docker build -t migration-hub-backend:latest .

# Custom base images via --build-arg
docker build \
  --build-arg BUILD_IMAGE=python:3.12-slim \
  --build-arg RUNTIME_IMAGE=cgr.dev/chainguard/python:latest \
  -t migration-hub-backend:latest .
```

To verify the image:

```bash
docker images migration-hub-backend:latest
```

## Build & push script (`build-push-nexus.sh`)

A helper script automates building the image and pushing it to an enterprise Nexus Docker registry. Configuration is loaded from an environment file so credentials, registry paths, and base images are not hard-coded.

### Configuration file (`.env.nexus`)

Copy the example and edit it for your environment:

```bash
cp .env.nexus.example .env.nexus
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `BUILD_IMAGE` | No | `python:3.12-slim` | Build-stage base image (needs Python 3.12 + build tools) |
| `RUNTIME_IMAGE` | No | `python:3.12-slim` | Runtime base image (distroless or minimal) |
| `NEXUS_HOST` | **Yes** | — | Nexus hostname (e.g. `nexus.company.com` or `nexus.company.com:8443`) |
| `NEXUS_REPO` | **Yes** | — | Docker repository name in Nexus (e.g. `docker-hosted`) |
| `NEXUS_NAMESPACE` | No | _(empty)_ | Optional namespace/path within the repo (e.g. `migration-hub`) |
| `IMAGE_NAME` | No | `backend` | Image name component |
| `IMAGE_TAG` | No | `latest` / git short SHA | Image tag |
| `NEXUS_USERNAME` | No | _(empty)_ | Username for `docker login` |
| `NEXUS_PASSWORD` | No | _(empty)_ | Password for `docker login` |

Example `.env.nexus`:

```bash
BUILD_IMAGE=python:3.12-slim
RUNTIME_IMAGE=cgr.dev/chainguard/python:latest

NEXUS_HOST=nexus.company.com
NEXUS_REPO=docker-hosted
NEXUS_NAMESPACE=migration-hub
IMAGE_NAME=backend
IMAGE_TAG=latest
```

### Running the script

```bash
# Use the default .env.nexus
./build-push-nexus.sh

# Override the tag
./build-push-nexus.sh -t v1.2.3

# Build only — skip push (useful for CI validation or local testing)
./build-push-nexus.sh --build-only

# Use a different env file
./build-push-nexus.sh -e /path/to/prod.env

# Pass build arguments from environment variables
export BUILD_IMAGE=python:3.13-slim
export RUNTIME_IMAGE=cgr.dev/chainguard/python:latest
./build-push-nexus.sh --build-arg BUILD_IMAGE="$BUILD_IMAGE" --build-arg RUNTIME_IMAGE="$RUNTIME_IMAGE"
```

### What the script does

1. Loads configuration from the env file (`BUILD_IMAGE`, `RUNTIME_IMAGE`, `NEXUS_HOST`, `NEXUS_REPO`, etc.).
2. Falls back to the git short SHA for the tag if `IMAGE_TAG` is not set.
3. Logs in to the Nexus Docker registry if `NEXUS_USERNAME` and `NEXUS_PASSWORD` are provided (skipped in `--build-only` mode).
4. Builds the image with `--build-arg` for `BUILD_IMAGE` and `RUNTIME_IMAGE` (when set).
5. Tags the image as `latest` (in addition to the requested tag, when the tag is not already `latest`).
6. Pushes both tags to Nexus (skipped in `--build-only` mode).

### Resulting image reference

With the example config above, the image is pushed to:

```
nexus.company.com/docker-hosted/migration-hub/backend:latest
nexus.company.com/docker-hosted/migration-hub/backend:<TAG>
```

### Notes

- If credentials are omitted, the script skips `docker login` and assumes you are already authenticated (e.g. via `docker login` run previously or via a CI secret).
- The script is `set -euo pipefail` safe and exits on any error.
- For CI/CD pipelines, export the env vars directly instead of using an env file:

```bash
export NEXUS_HOST=nexus.company.com
export NEXUS_REPO=docker-hosted
export BUILD_IMAGE=python:3.12-slim
export RUNTIME_IMAGE=cgr.dev/chainguard/python:latest
export NEXUS_USERNAME="$NEXUS_USER"
export NEXUS_PASSWORD="$NEXUS_PASS"
./build-push-nexus.sh -t "$CI_COMMIT_SHORT_SHA"
```
