# Repository Guidelines

Quick reference for developers. Deep dives live in `spec/`.

## Project Structure

| Directory        | Purpose                                              |
|------------------|------------------------------------------------------|
| `api/`           | Django backend (accounts, connection, vaultsql apps) |
| `frontend/`      | Vite + React client                                  |
| `query_service/` | Go microservice for query execution                  |

## Finding Commands

Run `task --list` to see all available commands. Key namespaces:
- `dev:*` - Development environment
- `prod:*` - Self-hosted EC2 deployment (no Doppler)
- `cloud:*` - Doppler-backed cloud deployment
- `frontend:*` - Frontend operations
- `test:*` - Testing shortcuts

## Quick Start

```bash
# Start all services
task dev:up:d

# Setup (first time: init dbs + migrate + seed)
task dev:setup

# Frontend dev server (runs on host)
task frontend:dev
```

**Access points**
- Frontend: http://localhost:8400
- Backend API: http://localhost:8400/api/
- Dev Login: http://localhost:8400/auth/devlogin (when `API_DEBUG=true`)
- Test PostgreSQL: localhost:5433 (user: `demo_admin` / `demo_admin_pass`)
- Test MySQL: localhost:3307 (user: `demo_admin` / `demo_admin_pass`)

## Common Commands

```bash
# Backend (dev)
task dev:migrate              # Run migrations
task dev:makemigrations       # Generate migrations
task dev:seed                 # Seed dev account
task dev:shell                # Django shell
task dev:reset                # Reset environment

# Frontend
task frontend:dev             # Dev server
task frontend:test            # Unit tests
task frontend:lint            # Lint

# Testing
task test:pytest              # Backend tests
task test:e2e                 # E2E tests
task test:all                 # All tests

# Self-hosted deployment (prod:*)
task prod:setup               # First-time setup: build + start
task prod:deploy              # Redeploy: rebuild frontend + containers
task prod:migrate             # Run migrations
task prod:shell               # Django shell
task prod:logs                # Follow logs

# Cloud deployment (cloud:*, Doppler-backed)
task cloud:env                # Pull secrets from Doppler
task cloud:deploy             # Full cloud deploy (env + build + restart)
task cloud:migrate            # Run migrations
task cloud:shell              # Django shell
```

## Docker Architecture

All services run in Docker Compose (see `docker-compose.dev.yml`). Frontend Vite dev server runs on host for hot-reload.

**Local Dev Databases**
- PostgreSQL (port 5433): `kitchen_sink`, `test`
- MySQL (port 3307): `kitchen_sink`, `test`

**Neon (prod demos)**: `restaurant`, `laundromat` - load via `task utils:neon`

## Coding Style

- Python: PEP 8, snake_case, type hints, use `str, Enum` not Django TextChoices
- TypeScript: 2-space indent, PascalCase components, Tailwind for styles

## Documentation

See `spec/architecture/` and `spec/development/` for detailed docs on patterns, architecture, and testing.

## Deployment Modes

| Mode | Commands | Secrets |
|------|----------|---------|
| **Local dev** | `task dev:*` | `env.txt` (manual) |
| **Self-hosted EC2** | `task prod:*` | `env.txt` (manual, from `env.example`) |
| **Cloud service** | `task cloud:*` | Doppler → `env.txt` |

See `docs/self-hosting.md` for EC2 setup, `env.example` for all available variables.

**Feature flags** — 3rd-party integrations (Sentry, Google OAuth, PostHog, etc.) are all opt-in via `ENABLE_*` / `VITE_ENABLE_*` flags. VaultSQL runs without any of them.

## Important Notes

- **Backend/Query Service**: Run in Docker. Use `task` commands, NOT `uv run` or `go run` directly.
- **Frontend**: Runs on host for hot-reload. Tests run on host.
- **Environment**: `env.txt` is mounted as `/app/.env` in containers. Don't use `doppler run`.
