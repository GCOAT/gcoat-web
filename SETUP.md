# GCOAT Website — Setup & Deployment Guide

> Run these steps after the codebase is ready. The implementing agent handles code —
> these are the manual infrastructure steps that require your AWS credentials and GitHub account.

---

## Prerequisites

- AWS CLI configured with `gcoat-admin` profile
- SAM CLI installed
- Docker installed and running
- Python 3.13
- Git configured with SSH key for GitHub

Verify everything:
```bash
cd /Users/amalikrigger/Developer/WebstormProjects/gcoat-web
./scripts/check-prereqs.sh
```

---

## Step 1: Deploy Backend (One-Click)

This single command creates the entire AWS stack: API Gateway, Lambda, DynamoDB tables,
S3 bucket, admin token in SSM, and updates `frontend/assets/js/config.js` with the live API URL.

```bash
./scripts/init.sh --client gcoat --stage dev --profile gcoat-admin --region us-east-1 --origin "*"
```

Save the API URL and admin token from the output.

---

## Step 2: Create GitHub Repository

```bash
# Create 'gcoat-web' repo on GitHub (public, for GitHub Pages)
# Then:
git remote add origin git@github.com:amalikrigger/gcoat-web.git
git push -u origin main
```

---

## Step 3: Enable GitHub Pages

1. Go to https://github.com/amalikrigger/gcoat-web/settings/pages
2. Source: **GitHub Actions**
3. The `.github/workflows/deploy-pages.yml` workflow will auto-deploy on push to `main`

---

## Step 4: Verify Site

Visit: https://amalikrigger.github.io/gcoat-web/

Test:
- [ ] Mode splash appears on first visit
- [ ] Regular mode shows all sections
- [ ] Arcade mode shows placeholder
- [ ] Mode toggle in header works
- [ ] Contact form submits successfully
- [ ] Intake form submits successfully
- [ ] Signup form submits successfully
- [ ] Mobile responsive (test on phone)

---

## Step 5: Production Deployment (When Ready)

### 5a. Update prod origin in kore.config.json
Set `environments.prod.allowedOrigin` to your actual GitHub Pages URL.

### 5b. Verify SES sender email
1. Go to AWS SES Console (us-east-1, gcoat-admin profile)
2. Verify `gcoatllc@gmail.com` as sender identity
3. Check email and click verification link
4. Request production access (to send to non-verified addresses)

### 5c. Deploy prod stack
```bash
./scripts/deploy.sh prod
```

---

## Useful Commands

```bash
# Run backend tests
cd /Users/amalikrigger/Developer/WebstormProjects/gcoat-web
python3 -m pytest backend/tests/ -v --cov=src --cov-report=term-missing

# Local frontend server
./scripts/serve.sh

# Local backend (requires Docker running)
cd backend/local && ./up.sh        # Start DynamoDB Local
./create_tables_and_seed.sh         # Create tables + seed data
./run-api.sh                        # Start SAM Local API on port 3000

# Redeploy backend after changes
./scripts/deploy.sh dev

# Sync frontend only (if using CloudFront)
./scripts/deploy.sh dev --sync-frontend-only

# Teardown entire stack
./scripts/teardown.sh dev
```
