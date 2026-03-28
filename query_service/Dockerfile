# syntax=docker/dockerfile:1
FROM golang:1.25.5-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
# Cache mount preserves Go modules between builds
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source code
COPY . .

# Build binary
# Cache mounts for Go modules and build cache
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /app/query-service ./main.go

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates wget

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/query-service /app/query-service

# Expose port (default 9005 in VaultSQL, can be overridden via PORT env var)
EXPOSE 9005

# Run binary
CMD ["/app/query-service"]
