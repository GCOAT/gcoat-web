# GCOAT Launch Plan — Monday April 20, 2026

> **GCOAT, LLC — Software Development & Digital Consulting**
> 6-day sprint (Apr 14–20) from "95% built" to "live, branded, legal, and taking clients."
> Launch date: **Monday, April 20, 2026**

---

## Priority Key

- 🔴 **MUST** — Blocks launch. Cannot go live without this.
- 🟡 **SHOULD** — Launch is better with it. Do if time allows before Monday.
- 🟢 **POST-LAUNCH** — Do after April 20. Don't let these delay launch.

---

# 🔴 MUST DO BEFORE LAUNCH (Apr 14–19)

---

## M1. SES Production Access (Mon Apr 14)
- [ ] Re-apply for AWS SES production access (AWS Console → SES → Account Dashboard → Request Production Access)
- [ ] Use case: "Transactional lead notification + confirmation emails for gcoat.io, a web development consultancy. Low volume (<100 emails/month). Unsubscribe mechanism planned. We do not send bulk or marketing email."
- [ ] If still rejected by Friday: launch without email — leads save to DynamoDB, add email later

## M2. Email Alias (Mon Apr 14)
- [ ] Create `info@gcoat.io` alias in Hostinger → forwards to `akrigger@gcoat.io`
- [ ] Verify `info@gcoat.io` sender identity in AWS SES (sandbox verification is instant)

## M3. AWS Security Hardening (Mon–Tue Apr 14–15)
- [x] **Add security response headers** in `backend/src/app.py` `_json()` function:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000` (prod only)
- [x] **Increase Lambda memory** from 256MB → 512MB in `backend/template.yaml`
- [x] **Lock down dev CORS** in `kore.config.json` — change `allowedOrigin: "*"` → `"http://localhost:8080"`
- [ ] **Redeploy backend** with security fixes: `./scripts/deploy.sh prod`
- [x] Run full test suite: `cd backend && python3 -m pytest tests/ -v`

## M4. Full Copy Review (Tue Apr 15)
- [ ] Walk through every section — tighten wording, fix inconsistencies:
  - [ ] Hero headline + subtitle
  - [ ] About section (company story, pillar descriptions)
  - [ ] Services section — add "Technical Consulting" as a service card
  - [ ] Portfolio descriptions + tags
  - [ ] Process step descriptions
  - [ ] Testimonials — decide on attribution style
  - [ ] CTA band text
  - [ ] Contact section text + response time
  - [ ] Footer tagline
- [ ] Ensure "Software Development & Digital Consulting" positioning is consistent throughout
- [ ] Update JSON-LD structured data if services change

## M5. Terms of Service Page (Tue–Wed Apr 15–16)
- [x] Create `frontend/terms.html` with shared header/footer
- [x] Content: scope of services, payment terms, IP ownership, limitation of liability, revision policy, dispute resolution (VI jurisdiction), acceptable use, termination
- [x] Style: clean readable layout, consistent with site design

## M6. Privacy Policy Page (Tue–Wed Apr 15–16)
- [x] Create `frontend/privacy.html` with shared header/footer
- [x] Content: what data is collected (name, email, phone, company, project details via forms), GA4 cookies (`_ga`, `_ga_*`), how data is stored (AWS DynamoDB, encrypted at rest), data retention (1 year TTL on leads), no data sold to third parties, user rights (request deletion via email), contact for data requests (`info@gcoat.io` or `akrigger@gcoat.io`)
- [x] Last updated date at top

## M7. Cookie Consent Banner (Wed Apr 16)
- [x] Simple bottom banner: "We use cookies to improve your experience and analyze site traffic."
- [x] Two buttons: "Accept" + "Learn More" (links to `/privacy.html`)
- [x] Stores consent in localStorage (`gcoat-cookie-consent`)
- [x] Vanilla JS + CSS — no external library
- [x] Banner doesn't re-appear after "Accept"
- [x] Reduced motion: no slide animation, instant show

## M8. Footer Links + Sitemap (Wed Apr 16)
- [x] Add "Terms" and "Privacy" links to footer on all pages (index, blog, post, start, 404, admin, font-preview)
- [x] Regenerate sitemap: `./scripts/seo.sh generate https://gcoat.io` (adds terms.html + privacy.html)

## M9. Social Profiles — Minimum 2 (Thu Apr 17)
- [ ] **Instagram** — create @gcoatvi (or available handle), add chrome G logo, write bio, link to gcoat.io
- [ ] **LinkedIn** — create GCOAT, LLC company page, add logo, description, link
- [ ] Update social link URLs on site (footer + contact section) across all pages — replace placeholder URLs with real ones, then commit + push

## M10. Final Deploy + Smoke Test (Fri–Sat Apr 18–19)
- [ ] Swap site-facing email to `info@gcoat.io` (if alias is live) across all HTML + config
- [ ] If SES approved: set `EnableSES=true`, `SenderEmail=info@gcoat.io`, redeploy backend
- [ ] Final `./scripts/seo.sh validate` → 0 errors
- [ ] Final content review — all pages, no stale placeholders
- [ ] `git add . && git commit && git push origin main`
- [ ] **Smoke test on phone** — all pages load, forms submit, cookie banner works
- [ ] **Smoke test on desktop** — Chrome + Safari, all pages, all forms
- [ ] Test cookie banner — shows first visit, gone after accept
- [ ] Test Terms + Privacy pages — render, links work
- [ ] Verify GA4 Realtime — pageviews + events
- [ ] Check OG preview — paste gcoat.io into iMessage or LinkedIn

---

# 🟡 SHOULD DO BEFORE LAUNCH (if time allows)

---

## S1. OG Image Refresh
- [ ] Regenerate `frontend/assets/images/og-image.jpg` with real chrome G logo (1200×630px)
- [ ] Push + deploy

## S2. Blog Posts (Claude Drafts, You Personalize)
- [ ] Claude drafts 3 real blog posts (topics TBD — launch announcement, educational, local)
- [ ] You review + personalize each post
- [ ] Seed into DynamoDB
- [ ] Create featured images in Canva Pro (1200×630px)

## S3. PayPal Business Account
- [ ] Convert personal PayPal to Business, or create new Business account with `akrigger@gcoat.io`
- [ ] Set up PayPal.me/gcoat (or similar) for payment links

## S4. Cal.com Booking Link
- [ ] Create Cal.com account
- [ ] Set up "Free Discovery Call" event (15–30 min)
- [ ] Add booking link to contact section on site
- [ ] Add to email signature

## S5. Portfolio Screenshots
- [ ] Take screenshots of shipped projects (Blue Water Charters, Salt & Lime, etc.)
- [ ] Replace gradient placeholder images in portfolio section
- [ ] Update descriptions and tags

## S6. Additional Social Profiles
- [ ] Facebook — GCOAT business page
- [ ] X / Twitter — @gcoatvi
- [ ] Google Business Profile — "Web Development" + "Software Company", Christiansted VI (takes 1–2 weeks to verify — start early)

## S7. Buffer Setup
- [ ] Create Buffer account (free tier — 3 channels)
- [ ] Connect Instagram + LinkedIn (+ Facebook if created)
- [ ] Schedule launch posts for Monday morning

## S8. Launch Announcements — Draft Content
- [ ] Instagram carousel (5 slides: what GCOAT does, the website, services, your story, CTA)
- [ ] LinkedIn professional announcement post
- [ ] Facebook business launch post (if created)
- [ ] X/Twitter launch thread (if created)

## S9. Email Signature
- [ ] Design email signature: GCOAT logo, "Amali Krigger — Founder & Lead Developer", phone, gcoat.io, social links, Cal.com booking link (if set up)

---

# 🟢 POST-LAUNCH (Week 1–4 after Apr 20)

---

## Week 1 (Apr 21–27): Stabilize & Complete Setup

### Business Accounts & Payments
- [ ] **Open Wells Fargo Business Checking** — visit branch with LLC docs (Articles of Organization + EIN). Separates business from personal finances. Protects LLC liability shield
- [ ] Link PayPal Business to WF business account
- [ ] Update Zelle to business account

### Business Documents (Claude drafts content → you design in Canva Pro)
- [ ] **Review existing docs** — provide current contracts/proposals from `contracts/` and `~/Documents/GCOAT/Contracts/`
- [ ] **Client Service Agreement** — scope, deliverables, timeline, payment (50% deposit / 50% on delivery), 2 revision rounds, IP transfer on final payment, retainer terms, cancellation, VI jurisdiction
- [ ] **Proposal template** — project overview, scope, timeline, pricing, what's included vs add-ons, next steps, signature line
- [ ] **NDA template** — mutual confidentiality, updated for web dev context
- [ ] **Invoice template** — verify existing, update with GCOAT LLC branding + payment methods (PayPal + Zelle)
- [ ] **Project brief/scope template** — filled after discovery call: business info, pages, features, content status, brand assets, timeline, milestones

### Client Onboarding Document
- [ ] Welcome message
- [ ] What happens after contract is signed
- [ ] What GCOAT needs from you (logo, brand colors, copy, photos, domain access)
- [ ] Timeline expectations by project type
- [ ] Communication channels (email + scheduled check-ins)
- [ ] Review/feedback process (2 rounds, 48hr turnaround)
- [ ] Launch day checklist
- [ ] Post-launch support (retainer options)

### Business Workflow Documentation
- [ ] Lead → response within 24hrs (canned email template)
- [ ] Discovery call (15–30 min via Cal.com)
- [ ] Proposal sent within 48hrs (from template)
- [ ] Contract + NDA signed (PandaDoc)
- [ ] 50% deposit collected (PayPal / Zelle)
- [ ] Onboarding doc sent to client
- [ ] Build → 2 review cycles → final delivery
- [ ] 50% balance collected
- [ ] Retainer setup (if applicable)
- [ ] 30-day check-in

### Tool Setup
- [ ] **PandaDoc** (free tier) — contract e-signatures
- [ ] **Notion** — GCOAT workspace: client CRM, project tracker, content calendar, meeting notes
- [ ] **Remaining social profiles** (Fiverr, Upwork, Facebook, X) — if not done pre-launch

### Canned Email Templates
- [ ] "Thanks for reaching out — here's what happens next"
- [ ] "Here's your proposal" (attach PDF)
- [ ] "Let's schedule a call" (include Cal.com link)
- [ ] "Welcome aboard" (attach onboarding doc + contract link)
- [ ] "Your site is live!" (delivery + retainer pitch)
- [ ] "30-day check-in — how's the website working?"

### Fiverr + Upwork Gig Descriptions
- [ ] **Fiverr Gig 1:** "I will build a professional landing page for your business" — Basic ($500) / Standard ($1,500) / Premium ($2,500+)
- [ ] **Fiverr Gig 2:** "I will create a custom business website with SEO" — tiered packages
- [ ] **Fiverr Gig 3:** "I will provide technical consulting for your web project" — hourly packages
- [ ] **Upwork profile:** Professional overview matching GCOAT brand voice, specialized profiles for Web Development + Technical Consulting, portfolio items

---

## Week 2 (Apr 28–May 4): Content & Marketing

### Blog
- [ ] Finalize + publish 3 new blog posts (if not done pre-launch)
- [ ] Create blog featured images in Canva Pro

### Social Media Cadence
- [ ] Post 2–3x/week on Instagram + LinkedIn (use Buffer)
- [ ] Share blog posts across platforms
- [ ] Behind-the-scenes content (building process, tools, workspace)

### Lead Magnet (Month 2)
- [ ] Create "Website Launch Checklist for Small Businesses" PDF
- [ ] Claude drafts content, you design in Canva Pro
- [ ] Embed behind newsletter signup: "Get the free checklist" instead of "Stay in the loop"
- [ ] Set up ConvertKit — welcome email sequence when someone downloads

### Email Sequences (ConvertKit)
- [ ] Welcome email (immediate after signup)
- [ ] Value email Day 3 — tip or insight
- [ ] Soft CTA email Day 7 — "Need a website? Let's talk"

---

## Month 2 (May): Payments & Scaling

### Delaware LLC + Stripe Pipeline
- [ ] **Research LLC filing service** — Doola ($297/yr, handles everything) vs Firstbase ($399 one-time) vs LegalZoom
- [ ] **File Delaware LLC** (GCOAT Inc or GCOAT Holdings LLC) — takes 1–2 weeks
- [ ] **Apply for EIN** — instant online if you have SSN, or 4 weeks by mail
- [ ] **Open Mercury bank account** — requires LLC docs + EIN
- [ ] **Set up Stripe** under Delaware entity — connect to Mercury
- [ ] **Test Stripe** with your own products first
- [ ] **Add Stripe payment links** to invoices + website

### Payment Infrastructure Consulting (New Service)
- [ ] Package the service: "Payment Infrastructure Setup for Caribbean Businesses"
- [ ] Pricing: $1,500–$3,000 for full setup (LLC guidance + banking + Stripe + integration)
- [ ] Monthly retainer: $100–$200/mo for ongoing support
- [ ] Add to GCOAT services page
- [ ] Target: Caribbean founders, USVI businesses, island-based startups
- [ ] Marketing angle: "Access to modern payment infrastructure — we bridge the gap"

---

## Month 3–6: Growth Services

### AI & Workflow Automation Consulting (Month 6+)
- [ ] Help businesses improve workflows using technology and AI
- [ ] Audit existing processes, recommend automations
- [ ] Implement AI-powered tools (chatbots, document processing, scheduling, CRM automation)
- [ ] Package as standalone consulting service
- [ ] Add to GCOAT services page

### Digital Marketing (Month 4–6)
- [ ] After proving own marketing results (IG followers, blog traffic, lead generation)
- [ ] Offer social media management + content creation to clients
- [ ] Package: $500–$1,500/mo depending on scope

### Admin Dashboard Enhancements (Phase 9)
- [ ] Lead count by source (contact vs intake vs newsletter)
- [ ] Lead count by service type requested
- [ ] Leads over time chart
- [ ] Conversion funnel (visitors → intake started → intake completed)
- [ ] Blog post view counts

### AI Chatbot Upgrade (Phase 8)
- [ ] Replace scripted intake with Claude-powered conversation
- [ ] Natural flow, follow-up questions, structured data extraction
- [ ] Rate limiting (15 exchanges max per session)
- [ ] Fallback to scripted flow if API fails

---

# AWS IMPROVEMENTS

## Before Launch (with M3 security hardening)

| Improvement | File | Change | Impact |
|---|---|---|---|
| **Security headers** | `backend/src/app.py` | Add `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` to `_json()` | Prevents clickjacking, MIME sniffing, forces HTTPS |
| **Lambda memory** | `backend/template.yaml` | `MemorySize: 256` → `512` | Faster cold starts (3–4s → ~1.5s), ~$0.50/mo extra |
| **Dev CORS lockdown** | `kore.config.json` | `allowedOrigin: "*"` → `"http://localhost:8080"` | Prevents any origin from hitting dev API |

## Post-Launch (Month 1–2)

| Improvement | Impact | Cost | Priority |
|---|---|---|---|
| **AWS WAF** | IP-based rate limiting, SQL injection protection, bot filtering | ~$5/mo | Medium — do if you get bot traffic |
| **CloudWatch alarms** | Alert on error rate >1%, p99 latency >500ms, admin auth failures | Free (basic) | Medium — set up in Week 2 |
| **CloudFront** | Edge caching for blog/content API, lower latency globally | ~$1–5/mo | Low — not needed until traffic grows |
| **Provisioned concurrency** | Eliminates cold starts entirely (always-warm Lambda) | $15–35/mo | Low — only if cold starts bother clients |
| **KMS encryption** | Customer-managed keys for DynamoDB + S3 (audit trail, key rotation) | ~$1/mo per key | Low — for compliance, not launch |

---

# BUSINESS IDENTITY

## What GCOAT Is

**GCOAT, LLC — Software Development & Digital Consulting**

Founded by Amali Krigger in the U.S. Virgin Islands. We design, build, and ship production-ready websites and web applications for businesses worldwide.

## Service Lines by Phase

| Timeline | Service | Revenue |
|---|---|---|
| **Launch (Apr 20)** | Web Development — landing pages, business sites, portfolios, event pages | $500–$3,500/project |
| **Launch (Apr 20)** | Technical Consulting — architecture reviews, tech stack guidance, digital strategy | $100–$150/hr |
| **Month 2–3** | Payment Infrastructure Setup — LLC + Stripe + integration for Caribbean businesses | $1,500–$3,000 + $100–200/mo |
| **Month 4–6** | Digital Marketing — social media management, content creation (after proving own results) | $500–$1,500/mo |
| **Month 6+** | AI & Workflow Automation — process audits, AI tool implementation, business automation | TBD |
| **Future** | Training & Workforce Development, Online Courses, Proprietary Products | TBD |

## Payments Accepted (at launch)

| Method | Best For | Fees |
|---|---|---|
| **PayPal** (primary) | All clients, payment links on invoices | 2.9% + $0.30 |
| **Zelle** | Local USVI clients, no fees | Free |
| **CashApp** | Quick informal payments | Free |
| **Wire/ACH** | Direct deposit contracts (e.g., RTPark) | Bank-dependent |
| **Stripe** (Month 2+) | After Delaware LLC — subscriptions, retainers, website checkout | 2.9% + $0.30 |

## Banking Roadmap

| Timeline | Action | Why |
|---|---|---|
| **Now** | Use personal Wells Fargo | Works for PayPal + Zelle at launch |
| **Within 30 days** | Open Wells Fargo Business Checking (visit branch with LLC docs: Articles of Organization + EIN) | Separates business/personal, protects LLC veil, professional Zelle name |
| **Month 2** | Open Mercury account (for Delaware LLC) | Required for Stripe. Online bank, pairs with Delaware entity |

---

# TOOLS & AUTOMATION

| Tool | Purpose | Cost | When |
|---|---|---|---|
| **Canva Pro** | Proposals, social graphics, business docs, blog images | Already have | Now |
| **Claude Max** | Draft everything — blog posts, contracts, copy, emails, gig descriptions | Already have | Now |
| **VS Code + GitHub Copilot** | Build everything | Already have | Now |
| **PayPal Business** | Primary payment collection | Free | Pre-launch |
| **Cal.com** | Discovery call booking, embeddable | Free | Pre-launch |
| **Buffer** | Social media scheduling (3 channels free) | Free | Pre-launch |
| **PandaDoc** | Contract e-signatures (unlimited free) | Free | Week 1 |
| **Notion** | CRM, project tracking, content calendar, docs | Free | Week 1 |
| **ConvertKit** | Email sequences, newsletter (up to 10k subs) | Free | Month 2 |
| **Stripe** | Online payments, subscriptions, invoicing | 2.9% + $0.30 | Month 2 (after Delaware LLC) |
| **Mercury** | Business banking for Delaware entity | Free | Month 2 |

---

# LAUNCH DAY CHECKLIST (Monday April 20)

## Morning
- [ ] Verify site is live and looking right (gcoat.io on phone + desktop)
- [ ] Publish launch posts on Instagram + LinkedIn (from Buffer or manually)
- [ ] Post in USVI business groups on Facebook (if account exists)
- [ ] DM 10–20 people who'd benefit or could refer clients

## Midday
- [ ] Monitor GA4 Realtime — watch for traffic
- [ ] Respond to any social engagement within 1 hour
- [ ] Check form submissions in DynamoDB (or admin panel)

## Evening
- [ ] Document launch metrics — Day 1 visitors, form submissions, social engagement
- [ ] Start Google Business Profile verification (if not already started)
- [ ] Thank anyone who shared or commented

## Week 1 Post-Launch
- [ ] Post daily on Instagram (stories + posts)
- [ ] Post 2–3x on LinkedIn
- [ ] Respond to all leads within 24 hours
- [ ] Set up Notion workspace (CRM + project tracking)
- [ ] Set up PandaDoc (contracts)
- [ ] Open WF Business Checking account
- [ ] Start business doc creation (contract, proposal, NDA, onboarding)
- [ ] Create Fiverr + Upwork profiles with optimized gig descriptions
- [ ] Set 30-day check-in reminder

---

# REFERENCE: Current Site Architecture

| Page | Status | Notes |
|---|---|---|
| `index.html` | ✅ Live | Homepage — hero, about, services, portfolio, process, testimonials, CTA, contact, footer |
| `blog.html` | ✅ Live | Blog listing — 3 posts seeded |
| `post.html` | ✅ Live | Individual blog post view |
| `start.html` | ✅ Live | Conversational intake chat |
| `admin.html` | ✅ Live | Admin panel (blog + content management) |
| `404.html` | ✅ Live | Custom 404 page |
| `terms.html` | 🔴 Create | Terms of Service |
| `privacy.html` | 🔴 Create | Privacy Policy |
| `font-preview.html` | ✅ Dev tool | Not linked, noindex |

**Backend API:** `https://oz8sqtiive.execute-api.us-east-1.amazonaws.com/prod`
**Frontend:** GitHub Pages → gcoat.io (auto-deploys on push to main)
**Backend deploy:** `./scripts/deploy.sh prod` (SAM + CloudFormation)
