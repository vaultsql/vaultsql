# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# Install git and build dependencies needed for uv sync
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies (production)
# Cache mount preserves uv cache between builds for faster rebuilds
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Copy application code
COPY . .

# Make init script executable
RUN chmod +x init.sh

# Collect static files (if needed)

# Expose port
EXPOSE 8000

# Run with gunicorn
CMD ["uv", "run", "gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "--capture-output", "vaultsql.wsgi:application"]
