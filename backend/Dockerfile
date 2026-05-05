# syntax=docker/dockerfile:1

# Configurable base images — override at build time via --build-arg
# or set BUILD_IMAGE / RUNTIME_IMAGE in your environment file.
ARG BUILD_IMAGE=python:3.12-slim
ARG RUNTIME_IMAGE=python:3.12-slim

# -------------------------
# Stage 1: Build dependencies
# -------------------------
FROM ${BUILD_IMAGE} AS builder

WORKDIR /app

# Install build dependencies for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies (editable so the source layer can be cached separately)
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]" \
    && pip install --no-cache-dir psycopg2-binary

# -------------------------
# Stage 2: Runtime
# -------------------------
FROM ${RUNTIME_IMAGE}

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

# Copy application code
# NOTE: .env files are excluded by .dockerignore. Environment variables must be
# injected at runtime (docker run --env-file, -e, or orchestrator secrets).
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
