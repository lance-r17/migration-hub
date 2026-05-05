# Frontend Docker Build & Push

## Quick reference

| Step | Command |
|---|---|
| Build image locally | `docker build -t migration-hub-frontend:latest .` |
| Build with custom base images | `docker build --build-arg BUILD_IMAGE=node:20-alpine --build-arg RUNTIME_IMAGE=nginx:alpine -t migration-hub-frontend:latest .` |
| Build & push to Nexus | `./build-push-nexus.sh` |
| Build & push with custom tag | `./build-push-nexus.sh -t v1.2.3` |
| Build only (skip push) | `./build-push-nexus.sh --build-only` |

## Dockerfile

The frontend `Dockerfile` uses a **multi-stage build** with configurable base images:

```dockerfile
# syntax=docker/dockerfile:1

ARG BUILD_IMAGE=node:20-alpine
ARG RUNTIME_IMAGE=nginx:alpine

FROM ${BUILD_IMAGE} AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL=
# ... other VITE_* args
RUN npx vite build

FROM ${RUNTIME_IMAGE}
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Key points:
- **Multi-stage**: the `builder` stage installs nginx, compiles the Vite bundle, and assembles a complete rootfs with nginx + all shared libraries. The runtime stage receives only the rootfs and static files — no Node.js, no package manager, no shell.
- **Configurable base images**: both `BUILD_IMAGE` and `RUNTIME_IMAGE` are set via `ARG` and can be overridden at build time.
- **Builder installs nginx**: nginx is installed in the builder (the only stage with a package manager) and copied — binary, config, mime.types, and every shared library — into the runtime. This lets you use a distroless or hardened runtime image that has no package manager.
- `package*.json` is copied and installed **before** the rest of the source so Docker layer caching works for dependency-only changes.
- `VITE_*` environment variables are passed as `ARG` and baked into the bundle at **build time** (Vite replaces `import.meta.env` at compile time).
- `.dockerignore` excludes `node_modules`, `dist`, `.env`, test files, and editor configs from the build context.

### Choosing base images

**Critical compatibility rule:** `BUILD_IMAGE` and `RUNTIME_IMAGE` must use the **same C library** (libc). The nginx binary and shared libraries copied from the builder won't work in a runtime with a different libc.

| C library | Builder | Runtime |
|---|---|---|
| musl (Alpine) | `node:20-alpine` | `nginx:alpine`, `cgr.dev/chainguard/nginx`, or your Alpine-based `distroless-base` |
| glibc (Debian) | `node:20-slim` | `gcr.io/distroless/cc`, or your Debian-based `distroless-base` |

The default is Alpine (musl):

| Build image | Runtime image |
|---|---|
| `node:20-alpine` | `nginx:alpine` |
| `node:20-alpine` | `cgr.dev/chainguard/nginx:latest` |
| `node:20-alpine` | `your-registry/distroless-base:latest` |

If your `distroless-base` is **glibc-based** (Debian), switch the builder to `node:20-slim` and install nginx via `apt-get` instead of `apk` (see Dockerfile comments).

## Runtime configuration (recommended)

The frontend supports **runtime configuration** via `config.json`. Instead of baking `VITE_*` variables into the bundle at build time, the app fetches `/config.json` on startup and uses those values. This allows a **single Docker image** to be deployed to any environment without rebuilding.

### How it works

1. The `entrypoint.sh` script runs when the container starts, reading environment variables and writing them to `/usr/share/nginx/html/config.json`.
2. The frontend fetches `config.json` before rendering and uses the values for all API, OAuth, and OIDC configuration.
3. If `config.json` is missing or a key is absent, the app falls back to build-time `VITE_*` env vars (for backward compatibility during local dev).

### Environment variables (runtime)

| Variable | Description |
|---|---|
| `API_BASE_URL` | Backend API base URL. Leave empty for mock-data mode. |
| `EMAIL_SERVER_URL` | Email server URL (optional) |
| `OAUTH_SERVICE_URL` | Custom OAuth service base URL (optional) |
| `OAUTH_CLIENT_ID` | OAuth client ID |
| `OAUTH_REDIRECT_URI` | Post-login callback URL |
| `OIDC_ISSUER` | OIDC issuer URL (legacy, optional) |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_REDIRECT_URI` | OIDC redirect URI |

### Example: run with runtime config

```bash
docker run -d \
  --name frontend-runtime \
  -e API_BASE_URL=https://api.company.com \
  -e OAUTH_SERVICE_URL=https://auth.company.com \
  -p 8080:8080 \
  migration-hub-frontend:latest
```

### Example: mount config.json directly (distroless runtimes)

For runtime images without a shell, skip `entrypoint.sh` and mount `config.json` directly:

```bash
cat > config.json <<'EOF'
{
  "VITE_API_BASE_URL": "https://api.company.com",
  "VITE_OAUTH_SERVICE_URL": "https://auth.company.com",
  "VITE_OAUTH_CLIENT_ID": "migration-hub",
  "VITE_OAUTH_REDIRECT_URI": "https://app.company.com/callback"
}
EOF

docker run -d \
  -v "$(pwd)/config.json:/usr/share/nginx/html/config.json:ro" \
  -p 8080:8080 \
  migration-hub-frontend:latest
```

## Build-time environment variables (legacy)

If you prefer the traditional approach, `VITE_*` variables can still be baked into the bundle at build time via `--build-arg`. They cannot be changed after the image is built.

```bash
docker build \
  --build-arg VITE_API_BASE_URL=http://localhost:8000 \
  -t migration-hub-frontend:latest .
```

> **Recommendation:** Use runtime configuration (environment variables on `docker run`) for deployments. Use build-time args only for local development or CI pipelines where you want to validate the build with specific values.

## Manual build

From the `frontend/` directory:

```bash
# Default base images
docker build -t migration-hub-frontend:latest .

# Custom base images via --build-arg
docker build \
  --build-arg BUILD_IMAGE=node:20-alpine \
  --build-arg RUNTIME_IMAGE=cgr.dev/chainguard/nginx:latest \
  -t migration-hub-frontend:latest .
```

To verify the image:

```bash
docker images migration-hub-frontend:latest
```

## Build & push script (`build-push-nexus.sh`)

A helper script automates building the image and pushing it to an enterprise Nexus Docker registry. Configuration is loaded from an environment file so credentials, registry paths, base images, and Vite build variables are not hard-coded.

### Configuration file (`.env.nexus`)

Copy the example and edit it for your environment:

```bash
cp .env.nexus.example .env.nexus
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `BUILD_IMAGE` | No | `node:20-alpine` | Build-stage base image |
| `RUNTIME_IMAGE` | No | `nginx:alpine` | Runtime base image |
| `VITE_API_BASE_URL` | No | _(empty)_ | Backend API URL (baked into bundle) |
| `VITE_EMAIL_SERVER_URL` | No | _(empty)_ | Email server URL (baked into bundle) |
| `VITE_OAUTH_SERVICE_URL` | No | _(empty)_ | OAuth service URL (baked into bundle) |
| `VITE_OAUTH_CLIENT_ID` | No | _(empty)_ | OAuth client ID (baked into bundle) |
| `VITE_OAUTH_REDIRECT_URI` | No | _(empty)_ | OAuth redirect URI (baked into bundle) |
| `VITE_OIDC_ISSUER` | No | _(empty)_ | OIDC issuer URL (baked into bundle) |
| `VITE_OIDC_CLIENT_ID` | No | _(empty)_ | OIDC client ID (baked into bundle) |
| `VITE_ALLOWED_HOSTS` | No | _(empty)_ | Allowed hosts (baked into bundle) |
| `NEXUS_HOST` | **Yes** | — | Nexus hostname |
| `NEXUS_REPO` | **Yes** | — | Docker repository name in Nexus |
| `NEXUS_NAMESPACE` | No | _(empty)_ | Optional namespace/path |
| `IMAGE_NAME` | No | `frontend` | Image name component |
| `IMAGE_TAG` | No | `latest` / git short SHA | Image tag |
| `NEXUS_USERNAME` | No | _(empty)_ | Username for `docker login` |
| `NEXUS_PASSWORD` | No | _(empty)_ | Password for `docker login` |

Example `.env.nexus`:

```bash
BUILD_IMAGE=node:20-alpine
RUNTIME_IMAGE=nginx:alpine

VITE_API_BASE_URL=http://localhost:8000
VITE_OAUTH_SERVICE_URL=http://localhost:5557
VITE_OAUTH_CLIENT_ID=migration-hub
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback

NEXUS_HOST=nexus.company.com
NEXUS_REPO=docker-hosted
NEXUS_NAMESPACE=migration-hub
IMAGE_NAME=frontend
IMAGE_TAG=latest
```

### Running the script

```bash
# Use the default .env.nexus
./build-push-nexus.sh

# Override the tag
./build-push-nexus.sh -t v1.2.3

# Build only — skip push
./build-push-nexus.sh --build-only

# Use a different env file
./build-push-nexus.sh -e /path/to/prod.env
```

### What the script does

1. Loads configuration from the env file (`BUILD_IMAGE`, `RUNTIME_IMAGE`, `VITE_*`, `NEXUS_HOST`, etc.).
2. Falls back to the git short SHA for the tag if `IMAGE_TAG` is not set.
3. Logs in to the Nexus Docker registry if credentials are provided (skipped in `--build-only` mode).
4. Builds the image with `--build-arg` for base images and all `VITE_*` variables (when set).
5. Tags the image as `latest` (in addition to the requested tag, when the tag is not already `latest`).
6. Pushes both tags to Nexus (skipped in `--build-only` mode).

### Resulting image reference

With the example config above, the image is pushed to:

```
nexus.company.com/docker-hosted/migration-hub/frontend:latest
nexus.company.com/docker-hosted/migration-hub/frontend:<TAG>
```

### Notes

- If credentials are omitted, the script skips `docker login` and assumes you are already authenticated.
- The script is `set -euo pipefail` safe and exits on any error.
- For CI/CD pipelines, export the env vars directly instead of using an env file:

```bash
export NEXUS_HOST=nexus.company.com
export NEXUS_REPO=docker-hosted
export BUILD_IMAGE=node:20-alpine
export RUNTIME_IMAGE=nginx:alpine
export VITE_API_BASE_URL="https://api.company.com"
export NEXUS_USERNAME="$NEXUS_USER"
export NEXUS_PASSWORD="$NEXUS_PASS"
./build-push-nexus.sh -t "$CI_COMMIT_SHORT_SHA"
```

## Running the container locally

```bash
docker run -d \
  --name frontend-runtime \
  -p 8080:8080 \
  migration-hub-frontend:latest
```

The container serves the SPA on port `8080` (non-privileged, works even when the runtime image runs as non-root). Map it to any host port (e.g. `8080`).

Nginx is configured with:
- **Complete standalone config** (no dependency on stock `nginx.conf` from the runtime image)
- **SPA fallback**: all routes serve `index.html` (required for React Router client-side routing)
- **Gzip compression** for text assets
- **1-year cache headers** for static assets (JS, CSS, fonts, images)
