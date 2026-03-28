# Query Service

Go microservice for query execution.

## VaultSQL Development

**The query service runs in Docker. Do NOT run it directly on the host.**

```bash
# Start all dev services including query service
task dev:up:d

# View query service logs
docker compose -f docker-compose.dev.yml logs -f query

# The service runs on port 9005 inside Docker
# Access via Caddy at http://localhost:8400/query/
```

## Configuration

Environment variables (set in `env.txt` at repo root):
- `QUERY_PORT` - Port to run the service on (default: 9005 in VaultSQL)
- `QUERY_SERVICE_SECRET` - Shared secret for authenticating with Django API (required)
- `APP_INTERNAL_API` or `VAULTSQL_API` - Internal API URL (default: `http://localhost:8000/`)
- `QUERY_DEBUG` - Optional flag for local development; logs stay on stdout in either case
- `QUERY_SENTRY_DSN` - Sentry DSN for query service errors/traces (optional)
- `QUERY_SENTRY_TRACES_SAMPLE_RATE` - Sentry traces sample rate (default: `1.0`)
- `QUERY_BETTERSTACK_TOKEN` - Better Stack source token for supplemental log shipping (optional)
- `QUERY_BETTERSTACK_ENDPOINT` - Better Stack ingest endpoint (default: `https://in.logs.betterstack.com`)

## Running Tests (Host)

```bash
go test ./...
```

## Standalone Development (Not Recommended)

If you need to run the service outside Docker for debugging:

1. Create a `.env` file:
   ```bash
   PORT=9005
   VAULTSQL_API=http://localhost:8400/api/
   QUERY_SERVICE_SECRET=test-secret
   DEBUG=true
   ```

2. Run:
   ```bash
   go run main.go
   ```

## Endpoints

- `GET /health` - Health check endpoint, returns `{"status":"ok"}`
- `POST /execute` - Execute SQL query (authenticated via shared secret)
- `POST /stream` - Stream query results (authenticated via shared secret)

## Logging & Monitoring

- Query service logs always emit to stdout in JSON format so `docker logs` remains authoritative
- When `QUERY_BETTERSTACK_TOKEN` is set, the same logs are also shipped to Better Stack
- `QUERY_DEBUG` only changes the startup message and local-development intent; it does not disable stdout logging
- Sentry is enabled only when `QUERY_SENTRY_DSN` is configured
