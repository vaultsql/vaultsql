#!/bin/bash
# ============================================================================
# DEPRECATED: This script is deprecated in favor of Docker Compose
# ============================================================================
#
# Please use Docker Compose instead:
#   docker compose up -d
#   cd ../../..
#   doppler run -- uv run python manage.py seed_dev --reset
#
# See /docs/DOCKER_SETUP.md for details
# ============================================================================

# Complete demo setup for Los Pollos Hermanos
# This script initializes the database and seeds the application

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🎬 Complete Demo Setup"
echo "======================"
echo ""

# Step 1: Initialize databases
echo "Step 1: Initializing demo databases..."
echo ""
"${SCRIPT_DIR}/init_demo_db.sh"
echo ""
"${SCRIPT_DIR}/init_laundromat_db.sh"

# Step 2: Seed application
echo ""
echo "Step 2: Seeding VaultSQL application..."
cd "${SCRIPT_DIR}/../.."
doppler run -- uv run python manage.py seed_dev --reset

echo ""
echo "🎉 Demo setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start the Django backend:"
echo "     cd api && doppler run -- uv run python manage.py runserver"
echo ""
echo "  2. Start the frontend:"
echo "     cd frontend && doppler run -- npm run dev"
echo ""
echo "  3. Login with:"
echo "     Email: gus@lospollos.example"
echo "     Password: Insecure42"
echo "     Vault Passphrase: crystal blue"
echo ""
