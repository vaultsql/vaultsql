# VaultSQL API

Django backend for VaultSQL SQL client.

## VaultSQL Development

**The API runs in Docker. Do NOT run it directly on the host.**

```bash
# Start all dev services including API
task dev:up:d

# View API logs
docker compose -f docker-compose.dev.yml logs -f api

# Run migrations
task migrate

# Generate migrations
task makemigrations

# Access Django shell
docker compose -f docker-compose.dev.yml exec api uv run python manage.py shell

# Run tests
task test:pytest

# The API runs on port 8000 inside Docker
# Access via Caddy at http://localhost:8400/api/
```

## Environment Variables

All environment variables are set in `env.txt` at the repo root. This file is mounted into containers as `/app/.env`.

Key variables:
- `API_SECRET_KEY` - Django secret key
- `API_DEBUG` - Set to `true` for development
- `API_ENCRYPTION_KEY` - Encryption key for credential storage
- `QUERY_SERVICE_SECRET` - Shared secret for query service authentication
- `API_DB_*` - PostgreSQL connection settings (points to `app_db` container in dev)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth configuration

See `env.txt` for the complete list of variables.

## Django Apps

- **accounts**: User authentication, identity, workspace, and group management
- **connection**: Server, profile, credential, and SSH key management
- **workbench**: Worksheet management
- **workspace**: Audit logs and workspace settings
- **notifications**: Email notifications and dispatch

## Key API Endpoints

- `/api/auth/*` - Authentication (login, logout, OAuth)
- `/api/user/me` - Current user info
- `/api/server/` - Database server management
- `/api/profile/` - Connection profile management
- `/api/key/` - User vault key management
- `/api/worksheet/` - Worksheet CRUD
- `/api/openapi.json` - OpenAPI schema for type generation

Query execution is handled by the Go query service at `/query/*` (proxied via Caddy).
