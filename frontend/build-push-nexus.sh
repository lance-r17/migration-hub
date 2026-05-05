#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------------------
# Build and push frontend Docker image to a Nexus Docker registry.
# Configuration is read from an environment file (default: .env.nexus).
# ------------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.nexus}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Build the frontend Docker image and push it to a Nexus Docker registry.

Options:
  -e, --env-file FILE      Path to environment file (default: .env.nexus)
  -t, --tag TAG            Override the image tag
  --build-arg KEY=VALUE    Pass a build argument to docker build (can be used multiple times)
  --build-only             Build the image only; do not push
  -h, --help               Show this help message

Environment file variables (build-time / image config):
  BUILD_IMAGE           Build-stage base image (default: node:20-slim)
  RUNTIME_IMAGE         Runtime base image (default: gcr.io/distroless/base)
  GO_BUILD_IMAGE        Go build-stage image (default: golang:1.22-bookworm)
  NEXUS_HOST            Nexus server hostname (required)
  NEXUS_REPO            Nexus Docker repository name (required)
  NEXUS_NAMESPACE       Optional namespace/path within the repository
  IMAGE_NAME            Image name component (default: frontend)
  IMAGE_TAG             Image tag (default: latest or git short sha)
  NEXUS_USERNAME        Optional: for docker login
  NEXUS_PASSWORD        Optional: for docker login

Runtime config (no rebuild needed):
  Set API_BASE_URL, OAUTH_SERVICE_URL, etc. on `docker run`.
  The Go entrypoint binary injects them into index.html as window.__ENV__
  before starting nginx. Works in distroless images with no shell.
EOF
}

# Parse CLI args
CLI_BUILD_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -e|--env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        -t|--tag)
            CLI_TAG="$2"
            shift 2
            ;;
        --build-arg)
            CLI_BUILD_ARGS+=("--build-arg" "$2")
            shift 2
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

# Load environment file if it exists
if [[ -f "$ENV_FILE" ]]; then
    echo "Loading configuration from: $ENV_FILE"
    set -a
    # shellcheck source=/dev/null
    source "$ENV_FILE"
    set +a
else
    echo "Warning: Environment file not found: $ENV_FILE" >&2
fi

# ------------------------------------------------------------------------------
# Resolve configuration
# ------------------------------------------------------------------------------

BUILD_ONLY="${BUILD_ONLY:-false}"
BUILD_IMAGE="${BUILD_IMAGE:-}"
RUNTIME_IMAGE="${RUNTIME_IMAGE:-}"
GO_BUILD_IMAGE="${GO_BUILD_IMAGE:-}"
NEXUS_HOST="${NEXUS_HOST:-}"
NEXUS_REPO="${NEXUS_REPO:-}"
NEXUS_NAMESPACE="${NEXUS_NAMESPACE:-}"
IMAGE_NAME="${IMAGE_NAME:-frontend}"
IMAGE_TAG="${CLI_TAG:-${IMAGE_TAG:-}}"
NEXUS_USERNAME="${NEXUS_USERNAME:-}"
NEXUS_PASSWORD="${NEXUS_PASSWORD:-}"

# Validate required config
if [[ -z "$NEXUS_HOST" ]]; then
    echo "Error: NEXUS_HOST is not set. Provide it in the env file or set it as an environment variable." >&2
    exit 1
fi

if [[ -z "$NEXUS_REPO" ]]; then
    echo "Error: NEXUS_REPO is not set. Provide it in the env file or set it as an environment variable." >&2
    exit 1
fi

# Auto-detect tag from git short sha if available and not set
if [[ -z "$IMAGE_TAG" ]]; then
    if command -v git &>/dev/null && git rev-parse --short HEAD &>/dev/null; then
        IMAGE_TAG="$(git rev-parse --short HEAD)"
        echo "Auto-detected image tag from git: $IMAGE_TAG"
    else
        IMAGE_TAG="latest"
        echo "Defaulting image tag to: $IMAGE_TAG"
    fi
fi

# Build the full image reference
if [[ -n "$NEXUS_NAMESPACE" ]]; then
    FULL_IMAGE_NAME="${NEXUS_HOST}/${NEXUS_REPO}/${NEXUS_NAMESPACE}/${IMAGE_NAME}"
else
    FULL_IMAGE_NAME="${NEXUS_HOST}/${NEXUS_REPO}/${IMAGE_NAME}"
fi

FULL_IMAGE_REF="${FULL_IMAGE_NAME}:${IMAGE_TAG}"

echo ""
echo "========================================"
echo "Docker Build & Push Configuration"
echo "========================================"
echo "  Build context:   ${SCRIPT_DIR}"
[[ -n "$BUILD_IMAGE" ]]     && echo "  Build image:     ${BUILD_IMAGE}"
[[ -n "$RUNTIME_IMAGE" ]]   && echo "  Runtime image:   ${RUNTIME_IMAGE}"
[[ -n "$GO_BUILD_IMAGE" ]]  && echo "  Go build image:  ${GO_BUILD_IMAGE}"
echo "  Nexus host:      ${NEXUS_HOST}"
echo "  Nexus repo:      ${NEXUS_REPO}"
echo "  Image name:      ${FULL_IMAGE_NAME}"
echo "  Image tag:       ${IMAGE_TAG}"
echo "  Full reference:  ${FULL_IMAGE_REF}"
[[ "$BUILD_ONLY" == true ]] && echo "  Mode:            build-only (push skipped)"
echo "========================================"
echo ""

# ------------------------------------------------------------------------------
# Docker login (optional)
# ------------------------------------------------------------------------------

if [[ "$BUILD_ONLY" != true ]]; then
    if [[ -n "$NEXUS_USERNAME" && -n "$NEXUS_PASSWORD" ]]; then
        echo "Logging in to Nexus Docker registry: ${NEXUS_HOST} ..."
        echo "$NEXUS_PASSWORD" | docker login "$NEXUS_HOST" -u "$NEXUS_USERNAME" --password-stdin
    else
        echo "Skipping docker login (no credentials provided). Ensure you are already authenticated."
    fi
fi

# ------------------------------------------------------------------------------
# Build image
# ------------------------------------------------------------------------------

# Assemble optional --build-arg flags
BUILD_ARGS=()
[[ -n "$BUILD_IMAGE" ]]           && BUILD_ARGS+=("--build-arg" "BUILD_IMAGE=${BUILD_IMAGE}")
[[ -n "$RUNTIME_IMAGE" ]]         && BUILD_ARGS+=("--build-arg" "RUNTIME_IMAGE=${RUNTIME_IMAGE}")
[[ -n "$GO_BUILD_IMAGE" ]]        && BUILD_ARGS+=("--build-arg" "GO_BUILD_IMAGE=${GO_BUILD_IMAGE}")
# Append CLI build args so they override env file values (last one wins in docker build)
BUILD_ARGS+=("${CLI_BUILD_ARGS[@]}")

echo ""
echo "Building Docker image: ${FULL_IMAGE_REF} ..."
docker build "${BUILD_ARGS[@]}" -t "$FULL_IMAGE_REF" "$SCRIPT_DIR"

# Also tag as latest if the tag is not already latest
if [[ "$IMAGE_TAG" != "latest" ]]; then
    LATEST_REF="${FULL_IMAGE_NAME}:latest"
    echo "Tagging as latest: ${LATEST_REF} ..."
    docker tag "$FULL_IMAGE_REF" "$LATEST_REF"
fi

# ------------------------------------------------------------------------------
# Push image
# ------------------------------------------------------------------------------

if [[ "$BUILD_ONLY" == true ]]; then
    echo ""
    echo "========================================"
    echo "Build completed successfully (push skipped)."
    echo "  Image: ${FULL_IMAGE_REF}"
    if [[ "$IMAGE_TAG" != "latest" ]]; then
        echo "  Image: ${LATEST_REF}"
    fi
    echo "========================================"
    exit 0
fi

echo ""
echo "Pushing Docker image: ${FULL_IMAGE_REF} ..."
docker push "$FULL_IMAGE_REF"

if [[ "$IMAGE_TAG" != "latest" ]]; then
    echo "Pushing Docker image: ${LATEST_REF} ..."
    docker push "$LATEST_REF"
fi

echo ""
echo "========================================"
echo "Build and push completed successfully!"
echo "  Pushed: ${FULL_IMAGE_REF}"
if [[ "$IMAGE_TAG" != "latest" ]]; then
    echo "  Pushed: ${LATEST_REF}"
fi
echo "========================================"
