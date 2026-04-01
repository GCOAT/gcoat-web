#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

ENDPOINT="http://localhost:8000"
LEADS="kore-local-leads"
CONTENT="kore-local-content"

aws dynamodb create-table --table-name "$LEADS"   --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S   --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE   --billing-mode PAY_PER_REQUEST   --endpoint-url "$ENDPOINT" >/dev/null 2>&1 || true

aws dynamodb create-table --table-name "$CONTENT"   --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S   --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE   --billing-mode PAY_PER_REQUEST   --endpoint-url "$ENDPOINT" >/dev/null 2>&1 || true

aws dynamodb put-item --table-name "$CONTENT" --item file://seed_content_item.json --endpoint-url "$ENDPOINT" >/dev/null
echo "Tables ready and content seeded."
