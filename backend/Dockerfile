FROM python:3.12-slim

WORKDIR /app

# Install build dependencies for psycopg2 (used by seed script)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .

# Install runtime + dev deps (includes psycopg2-binary for seed script)
RUN pip install --no-cache-dir -e ".[dev]" \
    && pip install --no-cache-dir psycopg2-binary

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
