# Kore Starter Template — v2 (Full Stack)

> Full-stack starter: static frontend + serverless backend with newsletter/lead capture, CMS content, media uploads, admin auth, and optional SES notifications.

A production-ready starter kit for building static-first websites with an optional serverless backend. Clone it, run one script, and you have a live site backed by AWS.

**Stack:** Vanilla HTML/CSS/JS (GitHub Pages) · Python 3.13 Lambda · API Gateway HTTP API · DynamoDB · S3 · SES (optional)

---

## Quick Start

### Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| AWS CLI | 2.x | [docs.aws.amazon.com/cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| AWS SAM CLI | 1.x | [docs.aws.amazon.com/sam](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) |
| Python | 3.13+ | [python.org](https://www.python.org/downloads/) |
| Docker | 20+ | [docker.com](https://www.docker.com/get-started/) |

You also need an **AWS account** with an [IAM profile configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

### First-Time Setup (Clone → Deployed)

```bash
git clone <this-repo-url> my-project
cd my-project
./scripts/init.sh --client my-client --stage dev
```

The init script will:
1. Verify prerequisites are installed
2. Write `kore.config.json` with your settings
3. Generate a secure admin token and store it in AWS SSM
4. Build and deploy the SAM stack
5. Patch `frontend/assets/js/config.js` with the live API URL
6. Seed the content table with sample data
7. Print a deployment summary with test commands

> **Interactive mode:** Omit the flags and the script will prompt for each value with sensible defaults.

---

## Project Structure

```
├── frontend/                  Static site (deploy to GitHub Pages)
│   ├── index.html
│   ├── 404.html
│   └── assets/
│       ├── css/               base.css · layout.css · components.css
│       ├── js/                config.js · api.js · main.js
│       └── images/icons/
│
├── backend/                   Serverless API (AWS SAM)
│   ├── template.yaml          CloudFormation / SAM template
│   ├── requirements.txt
│   ├── src/app.py             Lambda handler (multi-route)
│   ├── tests/                 pytest suite (80%+ coverage)
│   └── local/                 DynamoDB Local + SAM Local
│
├── scripts/
│   ├── init.sh                First-time project setup
│   ├── deploy.sh              Config-driven deploy
│   └── teardown.sh            Stack deletion
│
├── docs/                      Standards & runbooks
├── kore.config.example.json   Example config (committed)
├── AI_INSTRUCTIONS.md         Guidance for AI coding assistants
├── LICENSE                    MIT
└── .gitignore
```

---

## Local Development

### 1. Start DynamoDB Local

```bash
cd backend/local
./up.sh                        # Starts Docker container
./create_tables_and_seed.sh    # Creates tables + inserts seed data
```

### 2. Start the API

```bash
./run-api.sh                   # SAM Local on http://127.0.0.1:3000
```

### 3. Serve the Frontend

In a separate terminal:

```bash
cd frontend
python3 -m http.server 8080    # http://localhost:8080
```

### 4. Test

```bash
# Fetch content
curl http://127.0.0.1:3000/content/home

# Submit a lead
curl -X POST http://127.0.0.1:3000/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane","email":"jane@example.com","message":"Hello"}'
```

### 5. Stop

```bash
cd backend/local && ./down.sh
```

---

## Deploying

### Subsequent Deploys

After the initial `init.sh` setup, use the deploy script:

```bash
./scripts/deploy.sh dev          # Deploy dev stage
./scripts/deploy.sh prod         # Deploy prod stage
./scripts/deploy.sh dev --skip-tests
```

The deploy script reads `kore.config.json` for all environment settings (profile, region, origin, feature flags).

### Teardown

```bash
./scripts/teardown.sh dev        # Interactive confirmation
./scripts/teardown.sh dev --force
```

Deletes the CloudFormation stack and the SSM admin-token parameter.

---

## Configuration

All per-environment settings live in `kore.config.json` (git-ignored). See `kore.config.example.json` for the schema:

```jsonc
{
  "client": "acme",
  "defaultStage": "dev",
  "environments": {
    "dev": {
      "profile": "default",
      "region": "us-east-1",
      "allowedOrigin": "*",
      "features": {
        "ses": false,
        "senderEmail": "",
        "deletionProtection": false,
        "pitr": false,
        "logRetentionDays": 7,
        "arm64": true
      }
    }
  }
}
```

### Feature Flags

| Flag | Default (dev) | Default (prod) | Description |
|------|--------------|----------------|-------------|
| `ses` | `false` | `true` | Enable SES lead notification emails |
| `senderEmail` | `""` | `hello@…` | Verified SES sender address |
| `deletionProtection` | `false` | `true` | DynamoDB deletion protection |
| `pitr` | `false` | `true` | DynamoDB point-in-time recovery |
| `logRetentionDays` | `7` | `30` | CloudWatch log retention |
| `arm64` | `true` | `true` | Lambda architecture (arm64 vs x86_64) |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/leads` | Public | Submit a contact/lead form |
| `GET` | `/content/{page}` | Public | Fetch CMS-lite content by page slug |
| `POST` | `/media/presign` | Admin | Generate S3 presigned upload URL |

Admin endpoints require an `x-admin-token` header. The token is stored in SSM at:

```
/{client}/{stage}/admin-token
```

---

## Testing

```bash
pip install -r backend/requirements-test.txt   # pytest + pytest-cov
python3 -m pytest backend/tests/ -v --cov=backend.src --cov-report=term-missing
```

Target: **80% coverage minimum**. All AWS calls are mocked — no credentials or network needed.

---

## Documentation

Full standards and runbooks live in `docs/`:

- [What We're Building](docs/kore-what-we-are-building.md) — vision & architecture
- [Folder Structure](docs/kore-architecture-folder-structure.md) — file placement rules
- [Naming Conventions](docs/kore-standards-naming.md) — identifiers, files, resources
- [Backend Standards](docs/kore-standards-backend.md) — Python, SAM, API patterns
- [Frontend Standards](docs/kore-standards-frontend.md) — HTML, CSS, JS, accessibility
- [Security Tier 1](docs/kore-standards-security-tier1.md) — auth, validation, CORS
- [Local Dev Runbook](docs/kore-runbook-local-dev.md) — setup & troubleshooting
- [Deploy Runbook](docs/kore-runbook-deploy.md) — deployment workflow

For AI coding assistants, see [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md).

---

## License

[MIT](LICENSE)
