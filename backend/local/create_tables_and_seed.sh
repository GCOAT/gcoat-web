#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

ENDPOINT="http://localhost:8000"
LEADS="kore-local-leads"
CONTENT="kore-local-content"
BLOG="kore-local-blog"

aws dynamodb create-table --table-name "$LEADS"   --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S   --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE   --billing-mode PAY_PER_REQUEST   --endpoint-url "$ENDPOINT" >/dev/null 2>&1 || true

aws dynamodb create-table --table-name "$CONTENT"   --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S   --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE   --billing-mode PAY_PER_REQUEST   --endpoint-url "$ENDPOINT" >/dev/null 2>&1 || true

aws dynamodb create-table --table-name "$BLOG"   --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S AttributeName=GSI1PK,AttributeType=S AttributeName=GSI1SK,AttributeType=S AttributeName=GSI2PK,AttributeType=S AttributeName=GSI2SK,AttributeType=S   --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE   --global-secondary-indexes '[{"IndexName":"GSI1","KeySchema":[{"AttributeName":"GSI1PK","KeyType":"HASH"},{"AttributeName":"GSI1SK","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"GSI2","KeySchema":[{"AttributeName":"GSI2PK","KeyType":"HASH"},{"AttributeName":"GSI2SK","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'   --billing-mode PAY_PER_REQUEST   --endpoint-url "$ENDPOINT" >/dev/null 2>&1 || true

aws dynamodb put-item --table-name "$CONTENT" --item file://seed_content_item.json --endpoint-url "$ENDPOINT" >/dev/null

# Seed blog posts
aws dynamodb put-item --table-name "$BLOG" --item file://seed_blog_post1.json --endpoint-url "$ENDPOINT" >/dev/null
aws dynamodb put-item --table-name "$BLOG" --item file://seed_blog_post2.json --endpoint-url "$ENDPOINT" >/dev/null
aws dynamodb put-item --table-name "$BLOG" --item file://seed_blog_post3.json --endpoint-url "$ENDPOINT" >/dev/null

# Seed blog tag items — must match _write_tag_items() structure in app.py:
#   pk=TAG#<tag>  sk=<publishedAt>#<postId>  slug, title, excerpt, tags, publishedAt, postId
put() {
  aws dynamodb put-item --table-name "$BLOG" --item "$1" --endpoint-url "$ENDPOINT" >/dev/null
}

# Post 1: why-every-small-business-in-st-croix-needs-a-website-in-2026
P1='"slug":{"S":"why-every-small-business-in-st-croix-needs-a-website-in-2026"},"title":{"S":"Why Every Small Business in St. Croix Needs a Website in 2026"},"excerpt":{"S":"In 2026, a website is not optional."},"publishedAt":{"S":"2026-01-15T10:00:00Z"},"postId":{"S":"post_001"}'
for tag in "small-business" "web-design" "st-croix" "featured"; do
  put "{\"pk\":{\"S\":\"TAG#${tag}\"},\"sk\":{\"S\":\"2026-01-15T10:00:00Z#post_001\"},\"tags\":{\"L\":[{\"S\":\"small-business\"},{\"S\":\"web-design\"},{\"S\":\"st-croix\"},{\"S\":\"featured\"}]},${P1}}"
done

# Post 2: what-makes-a-great-landing-page
P2='"slug":{"S":"what-makes-a-great-landing-page"},"title":{"S":"What Makes a Great Landing Page (And Why Most Miss the Mark)"},"excerpt":{"S":"A landing page has one job: convert visitors into customers."},"publishedAt":{"S":"2026-01-22T10:00:00Z"},"postId":{"S":"post_002"}'
for tag in "web-design" "landing-pages" "tips" "featured"; do
  put "{\"pk\":{\"S\":\"TAG#${tag}\"},\"sk\":{\"S\":\"2026-01-22T10:00:00Z#post_002\"},\"tags\":{\"L\":[{\"S\":\"web-design\"},{\"S\":\"landing-pages\"},{\"S\":\"tips\"},{\"S\":\"featured\"}]},${P2}}"
done

# Post 3: how-much-should-a-small-business-website-cost
P3='"slug":{"S":"how-much-should-a-small-business-website-cost"},"title":{"S":"How Much Should a Small Business Website Cost in 2026?"},"excerpt":{"S":"Website pricing is confusing."},"publishedAt":{"S":"2026-02-01T10:00:00Z"},"postId":{"S":"post_003"}'
for tag in "small-business" "pricing" "tips" "featured"; do
  put "{\"pk\":{\"S\":\"TAG#${tag}\"},\"sk\":{\"S\":\"2026-02-01T10:00:00Z#post_003\"},\"tags\":{\"L\":[{\"S\":\"small-business\"},{\"S\":\"pricing\"},{\"S\":\"tips\"},{\"S\":\"featured\"}]},${P3}}"
done

echo "Tables ready and content seeded."
