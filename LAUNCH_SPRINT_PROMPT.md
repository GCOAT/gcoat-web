# GCOAT Launch Sprint — Start Here

You are picking up the GCOAT website project for a 6-day launch sprint targeting **Monday, April 20, 2026**.

## Required Reading (do this first)
1. `AI_INSTRUCTIONS.md` — all coding rules and conventions
2. `LAUNCH_PLAN.md` — the full launch plan with checkboxes (this is your task list)
3. `FINISH_PLAN.md` — project history and what's already done (Phases 0–7 are ~95% complete)
4. `project-spec.md` — project specification (colors, forms, sections, constraints)
5. `docs/kore-standards-frontend.md` — before any frontend work
6. `docs/kore-standards-backend.md` — before any backend work
7. `docs/kore-standards-naming.md` — before naming anything
8. `docs/kore-architecture-folder-structure.md` — before creating files

## What's Already Done
- Static HTML site live at **gcoat.io** (GitHub Pages, auto-deploys on push to main)
- AWS backend deployed: Lambda (python3.13, arm64, 256MB), API Gateway HTTP API, DynamoDB, S3, SES (sandbox only — production access rejected once)
- 7 HTML pages: index.html, blog.html, post.html, start.html, admin.html, 404.html, font-preview.html
- Chrome G logo deployed across all pages with "COAT" text (Aldrich font, silver gradient)
- Favicon (32×32) + apple-touch-icon (180×180) deployed
- GA4 (G-QX6KHWBC4N) on all public pages, conversion events configured
- CSP: `script-src 'self'` — no inline scripts allowed. All JS must be external modules.
- Email: akrigger@gcoat.io verified in SES. Site currently shows akrigger@gcoat.io.
- "More" dropdown in nav with glassmorphism animation
- Backend API: `https://oz8sqtiive.execute-api.us-east-1.amazonaws.com/prod`
- Backend deploy command: `./scripts/deploy.sh prod`
- AWS profile: `gcoat-admin` (us-east-1)

## Key Technical Details
- **No inline scripts** — CSP blocks them. All JS goes in `frontend/assets/js/` as modules.
- **No external CSS/JS libraries** unless in `scripts/deps-registry.json` and approved in `kore-recipes/APPROVED_DEPS.md`.
- Cookie consent banner must use vanilla JS + CSS only.
- Security headers go in `backend/src/app.py` in the `_json()` helper function — that's where response headers are set.
- The `kore.config.json` has dev/prod environment configs including CORS `allowedOrigin`.
- All forms use `submitLead()` from `frontend/assets/js/api.js` which POSTs to `/leads`.
- Theme system exists (dark/light) but theme toggle is hidden. Default is dark.
- Reduced motion must be respected on all animations (`prefers-reduced-motion`).

## Today's Priority (start with M3 from LAUNCH_PLAN.md)

### Task 1: AWS Security Hardening (M3)
1. Read `backend/src/app.py` — find the `_json()` function and add these headers:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Strict-Transport-Security: max-age=31536000` (only in prod — check `os.environ.get("STAGE")`)
2. Read `backend/template.yaml` — change `MemorySize: 256` → `MemorySize: 512`
3. Read `kore.config.json` — change the dev environment's `allowedOrigin` from `"*"` to `"http://localhost:8080"`
4. Run tests: `cd backend && python3 -m pytest tests/ -v`
5. Deploy: `./scripts/deploy.sh prod` (ask me before deploying)

### Task 2: Terms of Service (M5)
Create `frontend/terms.html` — use the same header/footer structure as the other pages (look at `index.html` or `blog.html` for the pattern). Content:
- GCOAT, LLC — Software Development & Digital Consulting
- U.S. Virgin Islands jurisdiction
- Scope of services, payment terms (50% deposit / 50% on delivery), IP ownership (transfers on final payment), 2 revision rounds, limitation of liability, acceptable use, termination with 30 days notice, dispute resolution

### Task 3: Privacy Policy (M6)
Create `frontend/privacy.html` — same header/footer pattern. Content:
- Data collected: name, email, phone, company, project details (via contact + intake forms)
- Analytics: Google Analytics 4 cookies (`_ga`, `_ga_*`)
- Storage: AWS DynamoDB (encrypted at rest, us-east-1)
- Retention: 1 year TTL on leads
- No data sold to third parties
- User rights: request deletion via email (info@gcoat.io or akrigger@gcoat.io)
- Last updated date at top

### Task 4: Cookie Consent Banner (M7)
- Simple bottom banner on all public pages (index, blog, post, start)
- Text: "We use cookies to improve your experience and analyze site traffic."
- Two buttons: "Accept" + "Learn More" (links to /privacy.html)
- Store consent in localStorage key `gcoat-cookie-consent`
- Don't show banner if already accepted
- Vanilla JS in `frontend/assets/js/cookie-consent.js`, CSS in `frontend/assets/css/components.css`
- Respect `prefers-reduced-motion` — no slide animation if reduced motion
- Dark theme by default, light theme support via `.light-theme` class

### Task 5: Footer Links + Sitemap (M8)
- Add "Terms" and "Privacy" links to the footer on all 7 HTML pages
- Run `./scripts/seo.sh generate https://gcoat.io` to regenerate sitemap

## Rules
- Follow `AI_INSTRUCTIONS.md` and the Kore docs strictly
- Check off items in `LAUNCH_PLAN.md` as you complete them
- Do NOT add features beyond what's listed
- Do NOT add docstrings or comments to code you didn't write
- Ask before deploying or pushing
- Log any Kore template bugs found in `KORE_FIXES.md`

After completing Tasks 1–5, move on to M4 (Full Copy Review) from the launch plan. Work through the LAUNCH_PLAN.md items in order.
