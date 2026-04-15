# GCOAT Website — 30-Day Launch & Evolution Plan

> **This is the single source of truth for the GCOAT website.**
> Weeks 1-2: Build, polish, launch. Weeks 3-4: Evolve into a self-running business.
> Launch date: **Monday, April 20, 2026**
> See also: `LAUNCH_PLAN.md` for the full 6-day launch sprint plan.
> Last updated: 2026-04-14

---

## The Vision

GCOAT should feel **alive and human**. Not a static brochure — an experience. Visitors talk to it, it understands them, and behind the scenes it starts building their website before you even open your laptop.

**Week 1-2 (Launch):** Beautiful, polished agency site with conversational intake, blog, arcade, full SEO. Live and taking clients.

**Week 3-4 (Evolve):** Owner dashboard, AI-powered intake that auto-generates Kore projects, automated email sequences, client value tracking. The business starts running itself.

---

## Decisions

- **Intake form:** Scripted conversational chat on `/start.html` (Week 1-2). Upgrade to Claude AI chatbot (Week 3-4).
- **Dashboard:** Owner-only `/dashboard.html` — view leads, intake submissions, pipeline status, client value metrics (Week 3-4)
- **Auto-build pipeline:** Intake submission → `kore generate --from-intake` → rough draft project auto-created (Week 3-4)
- **Arcade/games:** Separate `/arcade.html`; "coming soon" placeholder
- **Blog:** 3 posts, client-side markdown via `marked.js`
- **SEO:** GA4, Organization JSON-LD, OG image, Search Console
- **Audit fixes:** Port security hardening from Kore v2 before launch
- **Value measurement:** GA4 conversion tracking per client site + lead metrics in dashboard

---

## Time Budget

| Week | Focus | Hours | Priority |
|------|-------|-------|----------|
| **Week 1** (Days 1-7) | Audit fixes, design polish, intake form, arcade | ~15-20 hrs | P0: Launch prep |
| **Week 2** (Days 8-14) | Blog, SEO, mobile testing, domain, deploy | ~15-20 hrs | P0: Launch |
| **Week 3** (Days 15-21) | AI chatbot upgrade, owner dashboard, auto-build pipeline | ~10-15 hrs | P1: Automation |
| **Week 4** (Days 22-30) | Email sequences, value tracking, polish, content updates | ~10-15 hrs | P1: Self-running |
| **Total** | | **~50-70 hrs** | |

---

# WEEK 1-2: BUILD & LAUNCH

---

## Pre-Phase: Review Required Docs (Before Every Phase)

Before starting any phase, **always review `AI_INSTRUCTIONS.md`** and the relevant Kore docs for that phase:

| Phase Type | Review Before Starting |
|-----------|----------------------|
| Any backend work | `docs/kore-standards-backend.md`, `docs/kore-standards-security-tier1.md` |
| Any frontend work | `docs/kore-standards-frontend.md` |
| Creating or moving files | `docs/kore-architecture-folder-structure.md` |
| Naming anything | `docs/kore-standards-naming.md` |
| Deploying | `docs/kore-runbook-deploy.md` |
| Local dev / testing | `docs/kore-runbook-local-dev.md` |

---

## Phase 0: Port Audit Fixes from Kore v2 (~1-2 hrs, Day 1)

**⚠️ gcoat-web `app.py` has custom extensions (extended lead fields, source validation, unknown field rejection). Do NOT overwrite. Merge surgically.**

```bash
# Always diff before editing
diff ../kore/kore-starter-template-v2/backend/src/app.py backend/src/app.py
```

**In `backend/src/app.py`:**
- [x] **0.1** Add `import html` to imports
- [x] **0.2** Replace `EMAIL_RE` with hybrid multi-step validator (`_EMAIL_STRUCT_RE`, `_CONSECUTIVE_DOTS_RE`, `_DOT_AT_LOCAL_BOUNDARY_RE`, `MAX_LOCAL_PART_LEN`)
- [x] **0.3** Update email validation in `handle_post_leads()` to use multi-step checks
- [x] **0.4** Add `_sanitize_for_email()` function — strips `\r\n` from fields
- [x] **0.5** Update `_send_lead_notification()` — sanitize all user fields
- [x] **0.6** Update `_send_lead_confirmation()` — `html.escape()` on `site_name` and `display_name`, `_sanitize_for_email()` on `lead_name`
- [x] **0.7** Fix `_body_json()` — add 50KB pre-decode guard, move 10KB check AFTER base64 decode
- [x] **0.8** Fix `_get_admin_token()` — add `logger.exception()` on SSM failure

**In `backend/template.yaml`:**
- [x] **0.9** SES `Resource: "*"` → `!Sub "arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/${SenderEmail}"`
- [x] **0.10** Lambda `Timeout: 10` → `15`

**In `backend/tests/`:**
- [x] **0.11** Add base64 body tests to `test_leads.py`
- [x] **0.12** Add email edge case tests (match gcoat-web's validation rules, not Kore's — source is required here)
- [x] **0.13** Create `test_email_validation.py` (adapt from Kore v2 — fix imports to `from src.app import ...`)
- [x] **0.14** Run full test suite — 117 tests all pass

**In `frontend/404.html`:**
- [x] **0.15** Replace inline year script with external module (`page-404.js`)

---

## Phase 1: Section Design Upgrades (Collaborative, Days 1-4)

> **Approach:** Walk through each section one-by-one together. For each section,
> discuss goals → agree on direction → implement → review. Focus: visual appeal,
> user experience, making the site look and feel cooler and more attractive.

- [x] **1.0 Preloader** — Deal-in arc animation (replaces CodePen card-fall loop), shimmer sweep on top card, ambient glow behind stack, progress line, fan+fly exit choreography, landing shadow splat, returning visitor compressed timing (0.55× speed), light theme polish
- [x] **1.1 About section** — Layout, visual hierarchy, 4-pillars, SVG illustration
- [x] **1.2 Services section** — Card design, hover effects, icons, spacing
- [x] **1.3 Portfolio section** — Polish 3 placeholders (gradient images, tags, hover states)
- [x] **1.4 Process section** — Space theme: starfield canvas, planet waypoints, nebula, glass cards, orbital timeline
- [x] **1.5 Testimonials section** — Aurora theme: CSS aurora bands (4 gradient blobs, slow drift), enhanced glass cards, star shimmer on reveal, quote mark hue-rotate, aurora-tinted hover borders, light theme + reduced motion
- [x] **1.6 CTA band** — Aurora continuation theme: 3 aurora bands extending testimonials visual, glass morphism inner container, dual CTAs (start.html + #contact), scroll-triggered fade-in, light theme + reduced motion + responsive
- [x] **1.7 Contact section** — Aurora wind-down theme: 2 subtle aurora bands (fading visual journey), glass card wrappers for form + info panel, SVG social icons (GitHub/LinkedIn/Instagram/Fiverr/Upwork) with hover glow, mail + clock icons on info rows, submit button CTA glow animation, section IntersectionObserver, light theme + reduced motion + responsive
- [x] **1.8 Footer** — Aurora wind-down polish: 1 faint aurora band (final visual journey fade), contact email in brand column, nav link hover shift, newsletter input focus glow, smooth JS back-to-top, SVG icon sync on start.html, light theme + reduced motion
- [x] **1.9 Marquee** — Edge fade mask (mask-image gradient), hover glow (text-shadow + scale), reverse second marquee direction, separator pulse animation, speed tuning (18s/28s)

**Extract reusable patterns to `kore-recipes/` after launch.**

---

## Phase 2: Conversational Intake Page (~4-6 hrs, Days 4-6)

Scripted chat flow on `/start.html`. Architected so Claude API replaces the scripted logic in Week 3.

- [x] **2.1** Create `frontend/start.html` with shared header/footer (static intake form — chat upgrade is Phase 9)
- [x] **2.2** Chat bubble UI — questions appear one at a time, animated transitions
- [x] **2.3** Chat flow (10 steps):
  1. "Hey! What's your name?" → Name
  2. "Nice to meet you, {name}! Best email to reach you?" → Email
  3. "Phone number? (optional)" → Phone
  4. "What's your business called?" → Company
  5. "What type of project?" → [Landing Page / Business Site / E-Commerce / Custom / Not Sure]
  6. "Budget range?" → [$500-1K / $1K-2K / $2K-3.5K / $3.5K+ / Not sure]
  7. "Timeline?" → [ASAP / 2 weeks / 1 month / Flexible]
  8. "Tell me about what you need — pages, features, anything!" → Free text
  9. Summary card → "Here's what I've got: [summary]. Ready to send?"
  10. Submit → Success animation
- [x] **2.4** Progress indicator (step counter or progress bar)
- [x] **2.5** Animations — slide/fade between questions, typing indicator, bubble entrances
- [x] **2.6** Submit → POST `/leads` with `source: "intake"` via `submitLead()` from `api.js`
- [x] **2.7** Success/error states with animations
- [x] **2.8** Update all "Start Your Project" CTAs on `index.html` → `/start.html`
- [x] **2.9** Remove `#intake` section from `index.html` (keep `#contact`)
- [x] **2.10** Accessibility — keyboard nav, ARIA live regions, focus management, reduced motion
- [x] **2.11** AI-ready architecture in `intake-chat.js`:
  ```
  getNextQuestion(step, answers)  → returns question text + input type
  processAnswer(step, answer)     → validates + stores
  generateSummary(answers)        → builds summary card
  ```
  Week 3: `getNextQuestion` becomes a Claude API call.

---

## Phase 3: Blog Section (~4-6 hrs, Days 7-9)

- [x] **3.1** ~~Add `marked.js` via CDN~~ — N/A: blog uses backend API + DynamoDB instead of client-side markdown
- [x] **3.2** Create `frontend/blog.html` — post listing (title, date, excerpt, tags, featured post hero)
- [x] **3.3** Create `frontend/post.html` — loads posts via fetch from backend API
- [x] **3.4** Write 3 posts (seeded via `backend/local/seed_blog_post{1,2,3}.json`):
  - "Why Every Small Business in St. Croix Needs a Website in 2026"
  - "What Makes a Great Landing Page (And Why Most Miss the Mark)"
  - "How Much Should a Small Business Website Cost in 2026?"
- [x] **3.5** Blog styling — article typography, reading time, responsive, dark/light theme
- [x] **3.6** Blog SEO — dynamic `<title>`, description, `og:type=article`, `BlogPosting` JSON-LD
- [x] **3.7** Add "Blog" to nav on all pages (index, blog, post, start, 404)
- [x] **3.8** ~~Add `marked.js` to deps-registry~~ — N/A: not using marked.js

---

## Phase 4: SEO & Analytics (~2-3 hrs, Days 9-10)

- [x] **4.1** Organization JSON-LD on `index.html` — upgraded to dual-type `["Organization", "ProfessionalService"]` with full address (Christiansted, VI 00820), 5 social profiles, service catalog (6 services), 3 testimonial reviews, expanded knowsAbout, USVI + Worldwide areaServed
- [x] **4.2** Twitter Card tags on all pages — present and synced with updated meta descriptions
- [x] **4.3** OG image — 1200×630px GCOAT branded image (generated via Pillow, dark theme + gradient orbs)
- [x] **4.4** No `example.com` in SEO tags (only in form placeholders, correct UX). Domain URL swap deferred to Phase 6
- [x] **4.5** Unique `<title>` + `meta description` per page — keyword-optimized with USVI + global terms, all within Kore length guidelines
- [x] **4.6** Generate sitemap — `./scripts/seo.sh generate https://gcoat.github.io/gcoat-web` (4 pages, 2026-04-09)
- [x] **4.7** `robots.txt` already correct (allows all, blocks admin.html, sitemap declared)
- [x] **4.8** Verify all images have `alt` text — fixed dynamic blog card images (blog.js, post.js), added `aria-hidden` to 3 decorative SVGs
- [x] **4.9** `./scripts/seo.sh validate` → 0 errors (2 acceptable warnings on post.html: dynamic JSON-LD + mutually exclusive H1s)
- [x] **4.10** Create GA4 property (G-QX6KHWBC4N) + gtag.js on all 4 public pages via external `gtag.js`
- [x] **4.11** Configure GA4 conversion events — `form_submission` (contact, intake, intake_chat) + `newsletter_signup` (signup, newsletter_inline, blog_subscribe, post_subscribe)
- [x] **4.12** Update CSP for GA4 domains — `script-src` + `connect-src` + `img-src` updated on all 4 pages
- [x] **4.13** Google Search Console — verification meta tag added to index.html, submit sitemap after deploy
- [ ] **4.14** Google Business Profile — GCOAT as Web Design service in St. Croix *(deferred to post-launch)*
- [x] **4.15** *(added)* Geo meta tags on all 4 public pages — `geo.region: US-VI`, `geo.placename: St. Croix, US Virgin Islands`, coordinates
- [x] **4.16** *(added)* Blog H1 updated: "Blog" → "Deh GCOAT Blog"
- [x] **4.17** *(added)* JSON-LD on blog.html enhanced: `inLanguage`, logo in publisher
- [x] **4.18** *(added)* JSON-LD on start.html enhanced: `inLanguage`, keyword-rich description, logo in publisher
- [x] **4.19** *(added)* OG/Twitter tags synced with updated titles and descriptions on all pages

---

## Phase 5: Mobile & Cross-Browser (~3-4 hrs, Days 10-11)

- [x] **5.1** Responsive audit — all pages at 320px, 375px, 480px, 768px, 1024px, 1280px, 1440px — added `@media (max-width: 359px)` rules in layout.css + components.css for hero glass, buttons, stats, service cards, testimonials, CTA band, newsletter, chat intake
- [x] **5.2** Chat intake mobile verification — 480px rules already solid, added 320px rules for bubbles/choices/input
- [x] **5.3** Blog pages mobile — readable at all sizes; fixed `read-more` visibility on touch devices via `@media (pointer: coarse)`
- [x] **5.4** Arcade page mobile — tiles stack via flex-wrap, clamp-based title, reduced-motion covered
- [x] **5.5** WebGL fallback confirmed — `hasWebGL()`, reduced-motion check, hardware concurrency guard, mobile skip, CSS `.hero__bg-fallback` gradient
- [x] **5.6** `backdrop-filter` fallback — all ~25 instances have `-webkit-` prefix AND rgba/hsl background fallback
- [x] **5.7** Touch interactions — hover effects degrade on touch via `(pointer: coarse)` checks in all JS files; blog card read-more now visible on touch
- [x] **5.8** Safari fixes — `overflow-x: hidden` fallback before `clip`, dvh with vh fallback, `-webkit-backdrop-filter` everywhere, `env(safe-area-inset-bottom)` on sticky-bar + design-panel-trigger, `-webkit-mask-image` on blog tags
- [x] **5.9** Firefox audit — 4 `@property` instances for gradient rotation; Firefox <128 shows static gradient (acceptable degradation, no layout break)
- [x] **5.10** `prefers-reduced-motion` respected — global wildcard in base.css catches all 144+ keyframes; 14 component-level blocks for element hiding; all JS files check `prefers-reduced-motion`
- [x] **5.11** Print styles — expanded from 8 rules to comprehensive coverage: hides loader/splash/canvas/aurora/orbs/firefly/cursor-blob/scroll-progress/fab/sticky-bar/design-panel/marquee/portfolio-decorations; resets gradient-text, reveals JS-hidden content, proper page-break rules

---

## Phase 6: Custom Domain (~1-2 hrs, Day 12)

- [x] **6.1** Confirm domain on Hostinger
- [x] **6.2** DNS: CNAME `www` → `<username>.github.io`, A records for apex
- [x] **6.3** GitHub Pages → Settings → Custom domain
- [x] **6.4** Enforce HTTPS
- [x] **6.5** Apex redirect
- [x] **6.6** Update CORS, CSP, canonical/OG URLs
- [x] **6.7** Backend redeploy with correct `AllowedOrigin`
- [x] **6.8** Verify everything works

---

## Phase 7: Production Readiness & Launch (~2-3 hrs, Days 13-14)

- [x] **7.1** All backend tests pass — 259/259 passed in 1.28s
- [x] **7.2** Content review — all pages scanned: no lorem ipsum, no placeholder text, no suspicious example.com (only in form placeholders — correct UX), "Coming Soon" badges intentional
- [x] **7.3** Link audit — all anchor IDs (#about, #services, #portfolio, #process, #testimonials, #contact) verified in index.html, cross-page anchors correct, external social links valid
- [x] **7.4** Form smoke test — all 3 endpoints (contact, intake, signup) return 200 with correct CORS header `Access-Control-Allow-Origin: https://gcoat.io`
- [x] **7.5** Performance — zero console.log/warn/error across all 16 JS files, CSP per-page tailored (intentional differences), init.js/config.js blocking justified (FOUC prevention), all modules async
- [x] **7.6** `./scripts/seo.sh validate` → 0 errors, 2 acceptable warnings on post.html (dynamic JSON-LD + mutually exclusive H1s)
- [x] **7.7** Security — CSP verified per page (index/admin allow CDN, 404 minimal, others self-only), honeypot complete: 4 hidden fields across all forms, client-side isHoneypotFilled() guard + server-side silent accept in app.py
- [x] **7.8** 404 page updated — added "Start a Project" CTA to header nav, full footer with nav links (8 links), social icons (5 SVGs), email, back-to-top link, page-404.js back-to-top handler
- [ ] **7.9** Favicon + OG image verified across platforms
- [ ] **7.10** GA4 Real-Time showing visits + events
- [x] **7.11** Deploy → GitHub Pages + backend — site live at https://gcoat.io
- [ ] **7.12** Post-deploy smoke test on phone + desktop

### Deferred from Phase 4 (SEO items requiring live domain or manual setup)
- [x] **7.13** Create OG image — 1200×630px branded image with dark theme, gradient orbs, tagline, services, gcoat.io URL
- [x] **7.14** Create GA4 property (G-QX6KHWBC4N) + `gtag.js` on index, blog, post, start pages
- [x] **7.15** Configure GA4 conversion events — `form_submission` + `newsletter_signup` events on all 7 form handlers (main.js, intake-chat.js, blog.js, post.js)
- [x] **7.16** Update CSP on all 4 pages — added `googletagmanager.com`, `google-analytics.com`, `region1.google-analytics.com`
- [x] **7.17** Google Search Console — verification meta tag added to index.html, sitemap at https://gcoat.io/sitemap.xml
- [x] **7.18** Replace all `gcoat.github.io/gcoat-web` URLs with custom domain — all URLs now point to `https://gcoat.io`

### Pre-Launch: Brand & Business Setup
- [x] **7.19** Create GCOAT logo — chrome G logo mark (`frontend/assets/images/logos/gcoat-logo.png`), "COAT" text with Aldrich font, silver gradient, deployed across all 7 pages
- [x] **7.20** Generate favicon set from logo — `favicon.ico` (32×32) + `apple-touch-icon.png` (180×180) via Pillow, deployed to all pages
- [ ] **7.21** Set up gcoat.io email addresses (e.g. hello@gcoat.io, support@gcoat.io) — configure on Hostinger or Google Workspace
- [ ] **7.22** Verify gcoat.io sender identity in AWS SES — update `SenderEmail` parameter in template.yaml deploy
- [ ] **7.23** Create social media pages:
  - [ ] Instagram — @gcoatvi or @gcoat.io
  - [ ] LinkedIn — GCOAT company page
  - [ ] Fiverr — GCOAT freelancer profile
  - [ ] Upwork — GCOAT freelancer profile
  - [ ] GitHub org — already exists, add bio/avatar/links
- [ ] **7.24** Upload logo + avatar across all social profiles for consistent branding
- [ ] **7.25** Update site social links (footer, contact section) with final profile URLs
- [ ] **7.26** Create OG image using final logo (1200×630px) — replaces placeholder from 7.13
- [ ] **7.27** Update OG image with hero section screenshot (1200×630px, professional state without liquid effect) — final version right before launch

### Final Pre-Launch Push (Apr 14–20)

**Brand Identity — DONE**
- [x] Chrome G logo created + deployed across all 7 pages
- [x] Favicon set generated (favicon.ico 32×32, apple-touch-icon 180×180)
- [x] "More" dropdown with glassmorphism animation
- [x] Theme toggle hidden

**Day 1–2 (Apr 14–15): AWS Security + Copy Review**
- [ ] Add security response headers to `_json()` in app.py (X-Content-Type-Options, X-Frame-Options, HSTS)
- [ ] Increase Lambda memory 256→512 in template.yaml
- [ ] Lock down dev CORS in kore.config.json (`"*"` → `"http://localhost:8080"`)
- [ ] Redeploy backend + run full test suite
- [ ] Full copy review across all pages — tighten, add Technical Consulting service card

**Day 2–3 (Apr 15–16): Legal Pages**
- [ ] Create `frontend/terms.html` — Terms of Service
- [ ] Create `frontend/privacy.html` — Privacy Policy
- [ ] Cookie consent banner (vanilla JS + CSS, localStorage)
- [ ] Add Terms + Privacy links to footer on all pages
- [ ] Regenerate sitemap

**Day 1 (Apr 14): Email + SES**
- [x] Set up akrigger@gcoat.io on Hostinger (Starter Business Email — $0.39/mo)
- [x] Verify akrigger@gcoat.io in AWS SES
- [ ] Re-apply for SES production access (stronger use case description)
- [ ] Create info@gcoat.io alias in Hostinger → forwards to akrigger@gcoat.io
- [ ] Verify info@gcoat.io sender identity in AWS SES (needed so form emails come from info@)
- [ ] Redeploy backend with `SenderEmail: info@gcoat.io`
- [ ] Test: submit a form → confirm email arrives at akrigger@gcoat.io from info@gcoat.io

**Day 4 (Apr 17): Social Profiles (you)**
- [ ] Instagram — create @gcoatvi or @gcoat.io, add logo + bio + link
- [ ] LinkedIn — create GCOAT company page
- [ ] Fiverr — create GCOAT freelancer profile
- [ ] Upwork — create GCOAT freelancer profile
- [ ] GitHub org — update bio/avatar/links on existing org

**Day 4 (Apr 17): Social Profiles**
- [ ] Instagram — create @gcoatvi, add chrome G logo, write bio, link to gcoat.io
- [ ] LinkedIn — GCOAT, LLC company page, add logo, description, link
- [ ] Update social link URLs on site (footer + contact) with real profile URLs

**Day 5–6 (Apr 18–19): Final Code + Smoke Test**
- [x] Update site email from gcoatllc@gmail.com → akrigger@gcoat.io (all pages + kore.config.json)
- [ ] Swap site-facing email to info@gcoat.io once alias is live
- [ ] Update footer + contact social links with final profile URLs (7.25)
- [ ] Final `seo.sh validate` → 0 errors
- [ ] Final content review — no stale placeholders
- [ ] Push + deploy
- [ ] Visit gcoat.io on phone + desktop — full smoke test (7.12)
- [ ] Verify GA4 Realtime showing visits + events (7.10)
- [ ] Submit a test form → confirm DynamoDB + email flow
- [ ] Check OG preview: paste gcoat.io into Twitter/LinkedIn/iMessage
- [ ] Google Search Console — confirm sitemap is processing

### Launch Day Actions
- [x] Submit sitemap to Google Search Console
- [ ] Update Google Business Profile (7.14 — deferred to post-launch)
- [ ] Share launch on social media (all profiles)
- [ ] Set 30-day check-in reminder

---

# WEEK 3-4: EVOLVE INTO A SELF-RUNNING BUSINESS

---

## Phase 8: Claude AI Chatbot Upgrade (~6-8 hrs, Days 15-18)

Replace the scripted intake flow with a real Claude-powered conversation. The website comes alive.

- [ ] **8.1** Backend: `POST /chat` route — proxies to Claude API
  - System prompt: GCOAT intake agent personality (warm, knowledgeable, efficient)
  - Conversation history maintained per session (DynamoDB or in-memory)
  - Claude extracts structured data as conversation progresses
  - Returns: `{ message, extracted_data }`
- [ ] **8.2** Store Claude API key in SSM Parameter Store (same pattern as admin token)
- [ ] **8.3** Update `intake-chat.js` — swap `getNextQuestion()` from switch statement to `POST /chat` call
- [ ] **8.4** Natural conversation flow — no rigid steps, bot asks follow-ups based on answers
- [ ] **8.5** Summary card still appears at end — client confirms before submitting
- [ ] **8.6** Rate limiting — prevent API cost runaway (max 15 exchanges per session)
- [ ] **8.7** Fallback — if API fails, gracefully fall back to scripted flow
- [ ] **8.8** Test: have 5 real conversations, verify natural flow + correct data extraction
- [ ] **8.9** Update CSP for Claude API endpoint

**Claude system prompt:**
```
You are the GCOAT assistant. You help business owners figure out what they 
need for their website through friendly conversation. Warm, knowledgeable, 
efficient. Ask 1-2 things at a time. After 5-8 exchanges, summarize.
Never make up pricing. Never pressure. Just help them clarify what they need.
```

---

## Phase 9: Owner Dashboard (~6-8 hrs, Days 18-22)

A private page where you see everything at a glance. Protected by admin token.

- [ ] **9.1** Create `frontend/dashboard.html` — admin-only page (admin token in URL or localStorage)
- [ ] **9.2** Leads panel — table of all leads/intakes sorted by date
  - Name, email, source (contact/intake/signup), date, status
  - Click to expand → see full intake details (budget, timeline, project type, conversation transcript)
- [ ] **9.3** Pipeline view — leads categorized: New → Contacted → Proposal Sent → Closed → Delivered
  - Drag-and-drop or dropdown to update status
  - Status stored in DynamoDB (new field on lead item)
- [ ] **9.4** Quick stats bar:
  - Leads this week / this month / all time
  - Leads by source (contact vs intake vs signup)
  - Conversion rate (leads → proposals → closed)
- [ ] **9.5** Backend routes (admin-protected):
  - `GET /leads` — list all leads (paginated, sortable)
  - `PUT /leads/{id}` — update lead status
  - `GET /leads/stats` — aggregated metrics
- [ ] **9.6** Auto-build button — "Generate Project" next to intake leads
  - Calls `POST /generate` → runs intake-to-kore mapping → returns project status
  - For now: marks the lead as "project generated" and shows the mapped kore params
  - Full auto-build (actually running `kore generate`) is a future CLI integration
- [ ] **9.7** Email notification preferences — toggle which notifications you receive
- [ ] **9.8** Mobile responsive — check dashboard on phone

**Backend additions for dashboard:**
- [ ] **9.9** Add `status` field to lead items (default: "new")
- [ ] **9.10** Add `GET /leads` route (admin, paginated, filterable by source/status)
- [ ] **9.11** Add `PUT /leads/{id}` route (admin, update status)
- [ ] **9.12** Add `GET /leads/stats` route (admin, aggregated counts)
- [ ] **9.13** Tests for all new routes

---

## Phase 10: Auto-Build Pipeline (~4-6 hrs, Days 22-25)

Intake data → Kore project auto-generated. You refine, not build from scratch.

- [ ] **10.1** Intake-to-Kore mapping config (`intake-mapping.json`):
  ```json
  {
    "projectType": {
      "Landing Page": { "preset": "landing-page", "mood": "clean-minimal" },
      "Business Site": { "preset": "business-site", "mood": "clean-saas" },
      "E-Commerce": { "preset": "ecommerce", "mood": "clean-saas" },
      "Custom": { "preset": "custom", "mood": "neutral" }
    },
    "industry_hints": {
      "restaurant": { "mood": "warm-cultural", "schema": "Restaurant" },
      "charter": { "mood": "clean-minimal", "schema": "TouristAttraction" },
      "contractor": { "mood": "bold-vibrant", "schema": "HomeAndConstructionBusiness" }
    }
  }
  ```
- [ ] **10.2** `scripts/kore-generate-from-intake.py`:
  - Read intake record from DynamoDB by ID
  - Map fields to `kore new` parameters
  - Auto-detect industry from business description (keyword matching)
  - Generate `project-spec.md` with client's actual business info pre-filled
  - Run `kore new` (or output the command for manual execution)
- [ ] **10.3** Claude-enhanced spec generation:
  - Feed intake data + conversation transcript to Claude
  - Claude writes suggested page sections, headlines, CTA text
  - Output as pre-filled `project-spec.md`
- [ ] **10.4** Test: submit fake intake → run generate → verify assembled project makes sense
- [ ] **10.5** Dashboard integration: "Generate Project" button on intake leads triggers this pipeline

---

## Phase 11: Arcade Page (~2-3 hrs)

- [ ] **11.1** Create `frontend/arcade.html` with cyberpunk theme
- [ ] **11.2** Arcade hero + game tile grid
- [ ] **11.3** 3-5 placeholder game cards with "Coming Soon" badges
- [ ] **11.4** CRT scanlines, orbs, glitch text (reuse existing CSS)
- [ ] **11.5** Link from `index.html` arcade mode → `/arcade.html`
- [ ] **11.6** Back-to-main CTA

---

## Phase 12: Automated Email Sequences (~3-4 hrs, Days 25-27)

Leads get follow-up without you lifting a finger.

- [ ] **12.1** Immediate confirmation (already exists via SES) — enhance with personalized content based on project type
- [ ] **12.2** 24-hour follow-up email — "Hi {name}, thanks for reaching out! Here's what to expect next..."
  - Triggered by: DynamoDB Streams on new lead → SQS → Lambda
  - Or simpler: CloudWatch Events scheduled rule that checks for leads created 24h ago
- [ ] **12.3** Email templates for each stage:
  - New lead → "Thanks! Here's what happens next"
  - Proposal sent → "We sent you a proposal — here's what's in it"
  - Project started → "We've started building! Here's your timeline"
- [ ] **12.4** Unsubscribe handling — respect opt-outs
- [ ] **12.5** Track email opens/clicks (SES + SNS event notifications)

> **Note:** Full email automation (DynamoDB Streams → SQS → Lambda) adds infrastructure complexity. Start with the enhanced confirmation email (12.1) and manual follow-ups. Automate in Month 2 if needed.

---

## Phase 13: Client Value Measurement (~2-3 hrs, Days 27-30)

How do you KNOW the websites you build actually work? Quantify it.

### For GCOAT Itself
- [ ] **13.1** Dashboard metrics panel:
  - Total leads this month (from DynamoDB)
  - Lead source breakdown (intake vs contact vs signup)
  - Conversion funnel: lead → proposal → closed → delivered
  - Revenue tracking (manual entry for now — log project value when closing)
- [ ] **13.2** GA4 goals:
  - Intake form completion rate (started vs submitted)
  - Contact form submission rate
  - Blog → intake conversion (someone reads blog, then starts intake)

### For Client Sites (template/process for every site you build)
- [ ] **13.3** Create client value tracking template (`docs/client-value-template.md`):
  ```
  Client: [name]
  Site launched: [date]
  Monthly cost: [retainer amount]
  
  METRICS (update monthly from GA4)
  Month 1: [visitors] visitors, [leads] form submissions, [conversion]% rate
  Month 2: ...
  Month 3: ...
  
  CLIENT FEEDBACK
  - "I got X customers from the website" — [date]
  - [testimonial quote] — [date]
  
  ROI CALCULATION
  Site cost: $[amount]
  Revenue attributed to website: $[amount] (client-reported)
  ROI: [X]%
  ```
- [ ] **13.4** 30/60/90 day check-in process:
  - Day 30: Pull GA4 data, share with client, ask "Have you gotten any inquiries from the website?"
  - Day 60: Same + ask for testimonial if they've had positive results
  - Day 90: ROI conversation — "Your site has generated X leads. At your close rate, that's roughly $Y in revenue."
- [ ] **13.5** Dashboard: add client sites section (later — when you have clients)
  - List of delivered client sites
  - Link to their GA4 property
  - Last check-in date
  - Reported leads/revenue

### Value Proof for Sales
- [ ] **13.6** Build a "Results" section on GCOAT website (after first client success):
  - "Our clients see X form submissions in their first month"
  - "Average page load time: under 1 second"
  - "SEO optimized: structured data, sitemap, mobile-first"
  - Real numbers from GA4 once you have them

---

## 30-Day Checkpoint

- [ ] **Website live** on custom domain with all pages
- [ ] **AI chatbot** active — real conversations, not scripted
- [ ] **Dashboard** — see all leads, pipeline status, metrics
- [ ] **Auto-build** — intake → Kore project in one click
- [ ] **SEO** — indexed on Google, Search Console active, GA4 tracking
- [ ] **Blog** — 3 posts live, driving organic traffic
- [ ] **Email** — at minimum enhanced confirmations, ideally 24h follow-up
- [ ] **Value tracking** — template ready for client check-ins
- [ ] **Marketing** — Instagram active, Google Business Profile live
- [ ] **First client** — from prospecting or intake form

---

# EXECUTION ORDER

| Phase | Days | Focus |
|-------|------|-------|
| **WEEK 1** | | |
| 0. Audit fixes | Day 1 | Security before anything |
| 1. Section design | Days 1-4 | Make it beautiful |
| 2. Intake form (scripted) | Days 4-6 | Start taking clients |
| **WEEK 2** | | |
| 3. Blog | Days 7-9 | Content + SEO |
| 4. SEO & Analytics | Days 9-10 | Be findable |
| 5. Mobile testing | Days 10-11 | Works everywhere |
| 6. Custom domain | Day 12 | Professional URL |
| 7. Launch | Days 13-14 | **GO LIVE** |
| **WEEK 3** | | |
| 8. AI chatbot | Days 15-18 | Website comes alive |
| 9. Dashboard | Days 18-22 | See everything |
| **WEEK 4** | | |
| 10. Auto-build pipeline | Days 22-25 | Business runs itself |
| 11. Email sequences | Days 25-27 | Automated follow-up |
| 12. Value measurement | Days 27-30 | Prove it works |
| 13. Arcade page | When ready | Fun differentiator |

---

# KORE SYNC STATUS (as of 2026-04-04)

### ✅ Already Synced (new files, no conflicts)

| File | Notes |
|------|-------|
| `scripts/seo.sh` | Sitemap generation + SEO validation |
| `frontend/robots.txt` | Update domain before launch |
| `frontend/sitemap.xml` | Regenerate with `./scripts/seo.sh generate` |

### ⚠️ Needs Merge (Phase 0 — gcoat-web has custom code)

| File | What to Merge | Why Can't Copy |
|------|--------------|----------------|
| `backend/src/app.py` | Email regex, sanitization, html.escape, base64 fix, SSM logging | Custom lead fields, source validation, unknown field rejection |
| `backend/template.yaml` | Timeout 10→15, SES ARN | 2 lines — safe to edit directly |
| `backend/tests/test_leads.py` | Base64 + email edge case tests | Custom test expectations (source required) |

### 🆕 Needs Creating

| File | Notes |
|------|-------|
| `backend/tests/test_email_validation.py` | Adapt from Kore v2 (fix imports: `from src.app import ...`). Create AFTER email regex merged. |

### 📋 Frontend SEO (Phase 5 — manual, not synced)

Twitter cards, JSON-LD, OG image, unique titles — done during Phase 5 since gcoat-web HTML is custom.

### 🔮 Future Kore Sync

| Kore Change | When | GCOAT Impact |
|------------|------|-------------|
| AI chatbot module | Month 2 | **HIGH** — Phase 9 of this plan |
| Database adapter (`db.py`) | Month 1 | Optional refactor |
| Blog backend routes | Month 1 | N/A — gcoat-web uses client-side blog |
| CMS dashboard | Month 2 | Phase 10 is GCOAT-specific dashboard |
| Composable module system | Month 3 | N/A — gcoat-web is standalone |

**Key rule:** gcoat-web is a deployed project, not a template. Sync security fixes and features that benefit GCOAT directly. Don't restructure to match Kore's template evolution.

---

# RELEVANT FILES

| File | Action | Phase |
|------|--------|-------|
| `backend/src/app.py` | Merge audit fixes + add dashboard routes | 0, 10 |
| `backend/template.yaml` | Fix timeout + SES ARN | 0 |
| `backend/tests/` | Add email + base64 tests, create validation tests, dashboard tests | 0, 10 |
| `frontend/index.html` | Section upgrades, remove intake, update CTAs/nav, SEO | 1, 5 |
| `frontend/start.html` | **Create** — conversational intake | 2 |
| `frontend/arcade.html` | **Create** — games page | 3 |
| `frontend/blog/` | **Create** — index, post template, 3 md files | 4 |
| `frontend/dashboard.html` | **Create** — owner dashboard | 10 |
| `frontend/assets/js/intake-chat.js` | **Create** — chat logic (scripted → AI) | 2, 9 |
| `frontend/assets/js/dashboard.js` | **Create** — dashboard UI + API calls | 10 |
| `frontend/assets/css/components.css` | Chat bubbles, blog styles, dashboard styles | 2, 4, 10 |
| `frontend/assets/js/config.js` | GA4 ID, Claude API endpoint | 5, 9 |
| `scripts/seo.sh` | Already synced | — |
| `scripts/kore-generate-from-intake.py` | **Create** — intake → project assembler | 11 |
