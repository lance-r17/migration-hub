# Frontend Docker Build & Push

## Quick reference

| Step | Command |
|---|---|
| Build image locally | `docker build -t migration-hub-frontend:latest .` |
| Build with custom base images | `docker build --build-arg BUILD_IMAGE=node:20-slim --build-arg RUNTIME_IMAGE=gcr.io/distroless/base --build-arg GO_BUILD_IMAGE=golang:1.22-bookworm -t migration-hub-frontend:latest .` |
| Build & push to Nexus | `./build-push-nexus.sh` |
| Build & push with custom tag | `./build-push-nexus.sh -t v1.2.3` |
| Build only (skip push) | `./build-push-nexus.sh --build-only` |
| Pass build args from env vars | `./build-push-nexus.sh --build-arg BUILD_IMAGE="$BUILD_IMAGE" --build-arg RUNTIME_IMAGE="$RUNTIME_IMAGE" --build-arg GO_BUILD_IMAGE="$GO_BUILD_IMAGE"` |

## Dockerfile

The frontend `Dockerfile` uses a **multi-stage build** with configurable base images:

```dockerfile
# syntax=docker/dockerfile:1

ARG BUILD_IMAGE=node:20-slim
ARG RUNTIME_IMAGE=gcr.io/distroless/base
ARG GO_BUILD_IMAGE=golang:1.22-bookworm

FROM ${BUILD_IMAGE} AS frontend-builder
WORKDIR /app
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx && \
    rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM ${GO_BUILD_IMAGE} AS go-builder
WORKDIR /build
COPY cmd/init/go.mod cmd/init/main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /entrypoint .

FROM ${RUNTIME_IMAGE}
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY --from=go-builder /entrypoint /entrypoint
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
ENTRYPOINT ["/entrypoint"]
CMD ["/usr/sbin/nginx", "-g", "daemon off;"]
```

Key points:
- **Multi-stage**: the `builder` stage installs nginx, compiles the Vite bundle, and assembles a complete rootfs with nginx + all shared libraries. The runtime stage receives only the rootfs and static files — no Node.js, no package manager, no shell.
- **Configurable base images**: `BUILD_IMAGE`, `RUNTIME_IMAGE`, and `GO_BUILD_IMAGE` are set via `ARG` and can be overridden at build time.
- **Builder installs nginx**: nginx is installed in the builder (the only stage with a package manager) and copied — binary, config, mime.types, and every shared library — into the runtime. This lets you use a distroless or hardened runtime image that has no package manager.
- **Go builder**: a separate stage compiles the `entrypoint` Go binary. The Go builder image is independent of the frontend builder and runtime, so you can use an internal Go mirror (e.g. `your-registry/golang:1.22-alpine`) without affecting nginx compatibility.
- `package*.json` is copied and installed **before** the rest of the source so Docker layer caching works for dependency-only changes.
- `.dockerignore` excludes `node_modules`, `dist`, `.env`, test files, and editor configs from the build context.

### Choosing base images

**Critical compatibility rule:** `BUILD_IMAGE` and `RUNTIME_IMAGE` must use the **same C library** (libc). The nginx binary and shared libraries copied from the builder won't work in a runtime with a different libc. `GO_BUILD_IMAGE` is **independent** — any Go image works because the binary is statically linked (`CGO_ENABLED=0`).

| C library | Builder | Runtime |
|---|---|---|
| musl (Alpine) | `node:20-alpine` | `nginx:alpine`, `cgr.dev/chainguard/nginx`, or your Alpine-based `distroless-base` |
| glibc (Debian) | `node:20-slim` | `gcr.io/distroless/cc`, or your Debian-based `distroless-base` |

The default is glibc (Debian) for distroless compatibility:

| Build image | Runtime image | Go build image |
|---|---|---|
| `node:20-slim` | `gcr.io/distroless/base` | `golang:1.22-bookworm` |
| `node:20-slim` | `gcr.io/distroless/cc` | `golang:1.22-alpine` |

If you prefer Alpine (musl):

| Build image | Runtime image | Go build image |
|---|---|---|
| `node:20-alpine` | `nginx:alpine` | `golang:1.22-alpine` |
| `node:20-alpine` | `cgr.dev/chainguard/nginx:latest` | `golang:1.22-bookworm` |

If your `distroless-base` is **glibc-based** (Debian), switch the builder to `node:20-slim` and install nginx via `apt-get` instead of `apk` (see Dockerfile comments).

## Runtime configuration (recommended)

The frontend supports **runtime configuration** via a synchronous `window.__ENV__` object injected into `index.html` at container startup. Instead of baking `VITE_*` variables into the bundle at build time, the app reads the injected object directly. This allows a **single Docker image** to be deployed to any environment without rebuilding.

### How it works

1. A small **Go init binary** (`/entrypoint`) runs when the container starts. It reads environment variables, serializes them to JSON, and injects a `<script>window.__ENV__={...}</script>` block into `/usr/share/nginx/html/index.html`.
2. The frontend reads `window.__ENV__` synchronously — no async fetch, no race conditions, no loading state needed.
3. The Go binary then `exec`s nginx, replacing itself so nginx becomes PID 1. This works in **distroless images that have no shell**.

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

### Why Go instead of a shell script?

`gcr.io/distroless/base` has no `/bin/sh`, so a traditional `entrypoint.sh` cannot run. A statically-linked Go binary needs no shell, no libc, and no package manager — it is the standard pattern for init containers in distroless runtimes.

## Manual build

From the `frontend/` directory:

```bash
# Default base images
docker build -t migration-hub-frontend:latest .

# Custom base images via --build-arg
docker build \
  --build-arg BUILD_IMAGE=node:20-slim \
  --build-arg RUNTIME_IMAGE=cgr.dev/chainguard/nginx:latest \
  -t migration-hub-frontend:latest .
```

To verify the image:

```bash
docker images migration-hub-frontend:latest
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
| `BUILD_IMAGE` | No | `node:20-slim` | Build-stage base image |
| `RUNTIME_IMAGE` | No | `gcr.io/distroless/base` | Runtime base image |
| `NEXUS_HOST` | **Yes** | — | Nexus hostname |
| `NEXUS_REPO` | **Yes** | — | Docker repository name in Nexus |
| `NEXUS_NAMESPACE` | No | _(empty)_ | Optional namespace/path |
| `IMAGE_NAME` | No | `frontend` | Image name component |
| `IMAGE_TAG` | No | `latest` / git short SHA | Image tag |
| `NEXUS_USERNAME` | No | _(empty)_ | Username for `docker login` |
| `NEXUS_PASSWORD` | No | _(empty)_ | Password for `docker login` |

Example `.env.nexus`:

```bash
BUILD_IMAGE=node:20-slim
RUNTIME_IMAGE=gcr.io/distroless/base

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

# Pass build arguments from environment variables
export BUILD_IMAGE=node:22-alpine
export RUNTIME_IMAGE=cgr.dev/chainguard/nginx:latest
./build-push-nexus.sh --build-arg BUILD_IMAGE="$BUILD_IMAGE" --build-arg RUNTIME_IMAGE="$RUNTIME_IMAGE"
```

### What the script does

1. Loads configuration from the env file (`BUILD_IMAGE`, `RUNTIME_IMAGE`, `NEXUS_HOST`, etc.).
2. Falls back to the git short SHA for the tag if `IMAGE_TAG` is not set.
3. Logs in to the Nexus Docker registry if credentials are provided (skipped in `--build-only` mode).
4. Builds the image with `--build-arg` for base images.
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
export BUILD_IMAGE=node:20-slim
export RUNTIME_IMAGE=gcr.io/distroless/base
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
