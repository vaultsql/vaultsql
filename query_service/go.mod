module gitlab.com/vaultsql/query_service

go 1.24.0

toolchain go1.24.11

require github.com/joho/godotenv v1.5.1

require (
	github.com/getsentry/sentry-go v0.40.0
	github.com/go-chi/chi/v5 v5.2.3
	github.com/lib/pq v1.10.9
	github.com/samber/slog-betterstack v1.4.2
	golang.org/x/crypto v0.46.0
)

require (
	github.com/go-sql-driver/mysql v1.7.1 // indirect
	github.com/samber/lo v1.47.0 // indirect
	github.com/samber/slog-common v0.18.1 // indirect
	golang.org/x/sys v0.39.0 // indirect
	golang.org/x/text v0.32.0 // indirect
)
