# Project Specification — GCOAT Consulting Website

> **Client:** GCOAT, LLC (Greatest Coders of All Time)
> **Owner:** Amali Krigger
> **Tier:** Kore v2 (full-stack)
> **Contact:** gcoatllc@gmail.com

---

## Project Overview

GCOAT (Greatest Coders of All Time) is a software development consultancy founded by Amali Krigger. The company operates across four pillars: (1) client software development, (2) proprietary technology products, (3) training/workforce development, and (4) online courses and media.

This website is GCOAT's primary consulting landing page — designed to attract freelance clients, showcase capabilities, and convert visitors into leads. The site markets web development services that Kore currently excels at: landing pages, small business websites, portfolios, web applications, and MVPs.

**Primary CTA:** Get clients to fill out the intake form or contact GCOAT to build software.

**Unique feature:** The site has two visual modes — **Regular** (professional) and **Arcade** (creative/experimental placeholder) — selectable on first visit via a splash screen, with a persistent toggle in the header.

---

## Pages

### Single-Page Landing (index.html)

The site is a single-page layout with the following sections, in order:

#### 1. Mode Splash (overlay, first visit only)
- Full-screen overlay presented before the site content
- Two large clickable cards: "Professional Mode" and "Arcade Mode"
- Brief tagline per mode:
  - Professional: "Clean. Bold. Business-ready."
  - Arcade: "Creative. Experimental. Coming soon."
- Animated entrance (fade-in, subtle scale)
- Selection saves to `localStorage` key `gcoat-mode`
- On return visits, splash is skipped — last chosen mode loads immediately
- If choosing Arcade: shows arcade placeholder. If choosing Regular: shows full site.

#### 2. Header / Navigation
- Sticky header with glassmorphism (backdrop-filter blur)
- "GCOAT" text brand (gradient-styled, no logo image yet — placeholder for later)
- Nav links: About, Services, Portfolio, Process, Contact
- Mode toggle button (icon: switches between regular/arcade)
- Mobile: hamburger menu (44px touch target)
- Adds `is-scrolled` class when scrollY > 10 (border + shadow transition)

#### 3. Hero Section (inspired by alpha-futures.com)
- Large bold headline: "We Build Software That Ships"
- Subheadline: "From landing pages to full-stack apps — GCOAT delivers production-ready code, fast."
- Animated stat counters in a horizontal row with dividers (inspired by alpha-futures):
  - "50+ Projects Built" (placeholder number)
  - "100% Client Satisfaction" (placeholder)
  - "< 30 Day Avg Delivery" (placeholder)
- Dual CTA buttons:
  - "Start Your Project" → scrolls to intake form section
  - "Get in Touch" → scrolls to contact section
- Background: Animated gradient with floating CSS orbs/particles (vanilla CSS, no external deps)

#### 4. About Section
- Headline: "About GCOAT"
- Company story — who Amali is, why he started GCOAT, the mission
- The four pillars summarized:
  1. **Client Software** — Web apps, websites, and digital products for businesses worldwide
  2. **Proprietary Tech** — Building our own products (Lentil, Booked, Lokality)
  3. **Training** — Weekly coding sessions, workforce development, mentorship
  4. **Education** — Online courses, tutorials, YouTube, blog (coming soon)
- Two-column layout: text left, abstract code-themed SVG/illustration placeholder right
- Scroll reveal animation

#### 5. Services Section
- Headline: "What We Build"
- Card grid (or rotating feature cards, inspired by alpha-futures "Why Us" section):
  - **Landing Pages** — "High-converting landing pages that capture leads and drive action."
  - **Small Business Websites** — "Professional websites for local businesses — fast, mobile-first, SEO-ready."
  - **Portfolio Sites** — "Showcase your work with a stunning, custom-built portfolio."
  - **Web Applications** — "CRUD tools, dashboards, and internal apps built on serverless architecture."
  - **MVP Development** — "Validate your idea fast with a working prototype. Ship in weeks, not months."
  - **E-Commerce** (badge: "Coming Soon") — "Online stores and product catalogs. In development."
- Each card: SVG icon, title, 1-2 sentence description, "Get Started" CTA → intake form
- Scroll reveal with stagger

#### 6. Portfolio Section
- Headline: "Our Work"
- Subheadline: "Selected projects and case studies"
- 3–6 placeholder project cards:
  - Placeholder gradient image
  - Project name (e.g., "Lokality", "Project Alpha", "Starter Dashboard")
  - Brief description
  - Tech tags (e.g., "Landing Page", "Full-Stack", "Mobile App")
- Cards link to `#` for now (project detail pages are future work)
- Grid layout, responsive (1 col mobile, 2 col tablet, 3 col desktop)

#### 7. Process Section
- Headline: "How We Work"
- 5-step visual timeline or connected step cards:
  1. **Discovery** — "Tell us about your project, goals, and timeline."
  2. **Design** — "We create the look, feel, and user experience."
  3. **Build** — "Development with modern standards — fast, accessible, production-ready."
  4. **Launch** — "Deploy to production. Your site goes live."
  5. **Support** — "Ongoing maintenance, updates, and optimization."
- Numbered steps with connecting lines or arrows
- Scroll reveal

#### 8. Testimonials Section
- Headline: "What Clients Say"
- 2-3 placeholder testimonial cards:
  - Quote text
  - Name, role, company
  - Star rating (visual, 5 stars)
- Card layout (horizontal scroll on mobile, grid on desktop)

#### 9. CTA Band
- Full-width accent band between testimonials and intake form
- Text: "Ready to Build Something Great?"
- Subtext: "Let's turn your idea into a production-ready product."
- Large CTA button: "Start Your Project" → intake form

#### 10. Intake Form Section (primary conversion)
- Headline: "Start Your Project"
- Subheadline: "Tell us about what you need. We'll get back to you within 24 hours."
- Fields:
  - Full Name* (text input)
  - Email* (email input)
  - Phone (tel input, optional)
  - Company / Project Name (text input, optional)
  - Project Type* (select dropdown: Landing Page, Business Website, Portfolio, Web App, MVP, E-Commerce, Other)
  - Budget Range (select dropdown: Under $1,000 | $1,000–$5,000 | $5,000–$15,000 | $15,000+ | Not Sure)
  - Timeline (select dropdown: ASAP | 1–3 Months | 3–6 Months | Flexible)
  - Project Description* (textarea, max 2000 chars)
  - Preferred Features (checkboxes: Contact Form, Email Notifications, CMS/Content Management, User Authentication, Payment Processing, Media Upload, Analytics, Other)
- Honeypot field (hidden `.hp.website` input)
- Submit button: "Submit Project Brief"
- Submits via `POST /leads` with `source: "intake"`
- Inline success/error messages
- ARIA live region for screen reader announcements

#### 11. Contact Section
- Headline: "Get in Touch"
- Subheadline: "Have a question? Drop us a message."
- Fields:
  - Name* (text input)
  - Email* (email input)
  - Message* (textarea)
- Honeypot field
- Submit button: "Send Message"
- Submits via `POST /leads` with `source: "contact"`
- Also display: gcoatllc@gmail.com as direct email link, social media links

#### 12. Footer
- GCOAT text brand
- Tagline: "Building the future, one project at a time."
- Newsletter signup form (inline):
  - Email* (email input)
  - Name (text input, optional)
  - Submit: "Subscribe"
  - Submits via `POST /leads` with `source: "signup"`
- Quick links: About, Services, Portfolio, Process, Contact
- Social links: GitHub, LinkedIn, Instagram, Fiverr, Upwork
- Contact email: gcoatllc@gmail.com
- Copyright: "© 2026 GCOAT, LLC. All rights reserved." (auto-updated year via JS)
- Back-to-top button

#### 13. Arcade Mode (placeholder)
- Full-viewport section shown ONLY when `data-mode="arcade"` is set
- All regular sections (2–12) hidden via CSS when arcade mode is active
- Dark cyberpunk background with animated CSS orbs and subtle glowing particles
- Large glitch-effect headline: "ARCADE MODE"
- Subtitle: "Under Construction — Something Epic Is Coming"
- Animated gradient border card with teaser text
- CTAs: "Switch to Regular Mode" (triggers mode switch) + "Contact Us" (mailto link)
- Optional visual effects: CRT scanline overlay, floating code particles (CSS-only)
- Must respect `prefers-reduced-motion`

---

## Design Direction

**Primary mood:** `bold-vibrant` — Saturated colors, large typography, gradient accents, energetic motion, strong CTAs

**Secondary mood:** `modern-premium` — Dark backgrounds, glass effects, subtle animations, generous whitespace

### Regular Mode Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#676E7E` | Buttons, links, accents, header gradient |
| Secondary | `#3265CC` | CTA highlights, hover states, accent borders |
| Background | `#0b1220` | Page background (dark) |
| Surface | `#111b2e` | Card backgrounds, elevated surfaces |
| Text Primary | `#eaf0ff` | Main body text |
| Text Secondary | `#a9b6d3` | Muted/supporting text |
| Border | `rgba(255, 255, 255, 0.12)` | Subtle borders |
| Success | `#22c55e` | Form success messages |
| Error | `#ef4444` | Form errors, required asterisks |

### Arcade Mode Color Palette

```css
--color-bg-primary: #080810;
--color-bg-secondary: #0d0d18;
--color-bg-tertiary: #121220;
--color-bg-elevated: rgba(255, 255, 255, 0.03);
--color-bg-hover: rgba(255, 255, 255, 0.06);

--color-text-primary: #ffffff;
--color-text-secondary: rgba(255, 255, 255, 0.7);
--color-text-tertiary: rgba(255, 255, 255, 0.5);
--color-text-muted: rgba(255, 255, 255, 0.4);

--color-accent-1: #6366f1;
--color-accent-2: #8b5cf6;
--color-accent-3: #a855f7;
--color-accent-4: #22d3ee;
--color-accent-5: #10b981;

--color-border: rgba(255, 255, 255, 0.08);
--color-border-hover: rgba(255, 255, 255, 0.15);

--gradient-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
--gradient-glow: linear-gradient(135deg, #22d3ee 0%, #6366f1 100%);
--gradient-card: linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
```

### Typography
- Headings: system-ui stack (no web fonts for now — logo font added later)
- Body: system-ui stack
- Monospace: SFMono, Consolas, monospace (for code-themed elements)

### Design Inspiration
- **alpha-futures.com**: Hero stat bar layout, dark theme visual rhythm, alternating content sections, bold CTA patterns
- See `design-refs/alpha-futures-notes.md` for extracted patterns

---

## Features

- **Kore tier:** v2 (full-stack)
- **Backend endpoints used:**
  - `POST /leads` — All three forms (intake, contact, signup) differentiated by `source` field
  - `GET /content/{page}` — Available but not used for MVP (static content)
  - `POST /media/presign` — Available but not used for MVP
- **SES email** (production only):
  - Owner notification on new lead (to gcoatllc@gmail.com)
  - User confirmation email (to the email they submitted)
- **Extended lead fields:** phone, projectType, budgetRange, timeline, companyName, features (list)
- **Mode system:** Two visual modes via `data-mode` attribute, splash chooser, localStorage persistence

---

## Constraints

- **Vanilla stack**: No frameworks, no build tools, no external dependencies. HTML5, CSS3 (custom properties), ES6+ modules only.
- **WCAG 2.1 AA**: Skip link, keyboard navigation, focus-visible, ARIA labels, alt text, 44px touch targets, 4.5:1 contrast ratio (both modes)
- **Mobile-first**: All styles start mobile, expand via breakpoints (480px, 768px, 1024px, 1280px)
- **No logo yet**: Text-based "GCOAT" brand with CSS gradient. Logo image slot ready for later.
- **No custom domain yet**: Deploy to GitHub Pages initially (https://amalikrigger.github.io/gcoat-web/)
- **Browser support**: Last 2 versions of Chrome, Firefox, Safari, Edge
- **Performance**: No console.log in production, CSP meta tag, no render-blocking scripts
- **Backend**: Python 3.13, boto3 only. No additional pip packages.
- **AWS profile**: gcoat-admin (GCOAT LLC account)
- **SES**: Off in dev, on in prod. Sender: gcoatllc@gmail.com
