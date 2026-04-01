#!/usr/bin/env bash
set -euo pipefail
#
# run-api.sh — Build and start the SAM local API for development.
#
# Usage:
#   ./run-api.sh
#
# Builds the SAM application, prints smoke-test curl examples, then starts
# sam local start-api on port 3000. The start-api command blocks, so curls
# are printed beforehand.
#

cd "$(dirname "$0")/.."
sam build

echo ""
echo "============================================="
echo "  Smoke-test curls (run in another terminal):"
echo "============================================="
echo ""
echo "  curl -s http://localhost:3000/content/home | jq"
echo ""
echo "  curl -s -X POST http://localhost:3000/leads \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"Test\",\"email\":\"test@example.com\",\"message\":\"Hello\"}' | jq"
echo ""
echo "  curl -s -X POST http://localhost:3000/media/presign \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'x-admin-token: local-dev-token' \\"
echo "    -d '{\"filename\":\"test.jpg\",\"contentType\":\"image/jpeg\"}' | jq"
echo ""
echo "Starting SAM local API on http://localhost:3000…"
echo ""

sam local start-api --port 3000 --env-vars local/env.local.json
