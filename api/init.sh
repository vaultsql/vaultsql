#!/bin/bash
set -e

echo "========================================="
echo "VaultSQL API Initialization"
echo "========================================="

# Run database migrations
echo "Running database migrations..."
uv run python manage.py migrate --noinput

# Future: Add cache invalidation, warmup tasks, etc.
# echo "Invalidating caches..."
# uv run python manage.py invalidate_cache

echo "========================================="
echo "Initialization complete!"
echo "========================================="
