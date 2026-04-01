#!/usr/bin/env bash
set -euo pipefail
#
# up.sh — Start DynamoDB Local, wait for it to be healthy, create tables, and seed data.
#
# Usage:
#   ./up.sh
#
# Runs docker compose, waits for the DynamoDB Local health check, then
# calls create_tables_and_seed.sh. Idempotent — safe to run multiple times.
#

cd "$(dirname "$0")"

echo "Starting DynamoDB Local…"
docker compose up -d

# Health check: poll DynamoDB Local until it responds (max 30 seconds)
echo "Waiting for DynamoDB Local to be ready…"
SECONDS_WAITED=0
MAX_WAIT=30
until aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-1 --no-cli-pager >/dev/null 2>&1; do
  if [[ $SECONDS_WAITED -ge $MAX_WAIT ]]; then
    echo "✖  DynamoDB Local did not become healthy within ${MAX_WAIT}s." >&2
    exit 1
  fi
  sleep 2
  SECONDS_WAITED=$((SECONDS_WAITED + 2))
  echo "  …waited ${SECONDS_WAITED}s"
done
echo "DynamoDB Local is ready on http://localhost:8000"

# Create tables and seed data
echo "Creating tables and seeding data…"
./create_tables_and_seed.sh

echo ""
echo "============================================="
echo "  Local environment is up!"
echo "============================================="
echo ""
echo "Next steps:"
echo "  1. cd $(dirname "$0") && ./run-api.sh   — start the API on http://localhost:3000"
echo "  2. Open http://localhost:8080 for the frontend (if serving locally)"
echo ""
