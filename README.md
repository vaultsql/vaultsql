# VaultSQL

Secure SQL client with end-to-end encryption for database credentials.

## Quick Start

**Prerequisites**
- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Go 1.21+ (optional, for query service development)

**Start Development Environment**

```bash
# Start all backend services (API, Query Service, Redis, Databases)
task dev:up:d

# In a separate terminal, start the frontend
cd frontend
npm install
npm run dev

# Access the app at http://localhost:5173
# Dev login: http://localhost:8400/auth/devlogin (auto-login as the configured dev user)
```

## Architecture

VaultSQL is a full-stack application with:

- **Frontend**: React + TypeScript + Vite
- **API**: Django + Django Ninja REST API
- **Query Service**: Go microservice for SQL execution
- **Databases**: PostgreSQL (app data) + Redis (sessions/cache)
- **Reverse Proxy**: Caddy (single-domain routing)

All services run in Docker Compose. Only the frontend Vite dev server runs on the host for hot-reload.

## Project Structure

```
├── api/                 # Django backend
│   ├── accounts/        # Authentication, users, workspaces
│   ├── connection/      # Servers, profiles, credentials
│   ├── workbench/       # Worksheets
│   └── workspace/       # Audit logs, settings
├── frontend/            # React frontend
│   ├── src/webapp/      # Web application
│   └── src/workbench/   # SQL workbench
├── query_service/       # Go query execution service
├── spec/                # Architecture and development docs
└── testing/             # Docker test databases
```

## Common Tasks

```bash
# Development
task dev:up:d           # Start all services
task dev:down           # Stop all services
task dev:logs           # View logs

# Database
task migrate            # Run Django migrations
task makemigrations     # Generate migrations
task seed:demo          # Seed demo data
task seed:dev           # Seed dev account

# Testing
task test:pytest        # Run backend tests
task test:e2e           # Run integration tests
task test:workbench     # Run frontend DB adapter tests
task ci                 # Run full CI pipeline

# Build
task build:webapp       # Build frontend for production
task deploy             # Deploy to production
```

## Documentation

- **[AGENTS.md](./AGENTS.md)** - Quick reference for developers
- **[spec/architecture/](./spec/architecture/)** - Architecture docs
- **[spec/development/](./spec/development/)** - Development patterns
- **[api/README.md](./api/README.md)** - Backend API docs
- **[frontend/README.md](./frontend/README.md)** - Frontend docs
- **[query_service/README.md](./query_service/README.md)** - Query service docs

## Key Features

- **Vault Mode**: End-to-end encrypted credentials with user-controlled passphrase
- **Managed Mode**: Team-shared credentials (admin-managed)
- **SQL Workbench**: Query editor, schema browser, results viewer
- **SSH Tunneling**: Connect to databases behind firewalls
- **Multi-Database**: PostgreSQL, MySQL, SQL Server support

## Environment Setup

All services read from `env.txt` at the repo root. This file is mounted into containers as `/app/.env`.

**Do NOT use `doppler run`** - it's obsolete. Update `env.txt` manually or use `task env` (requires Doppler setup).

## Development Notes

- **All backend services run in Docker** - Do not run `uv run python manage.py` or `go run main.go` directly
- **Frontend runs on host** - Use `npm run dev` for hot-reload
- **Access via Caddy** - http://localhost:8400 (proxies to Docker services)
- **Dev login** - http://localhost:8400/auth/devlogin (when API_DEBUG=true)

## License

MIT
