# Plan: Blog Feature Enhancements — Kore-First Strategy

## TL;DR

Add 8 new blog features (share, RSS, syntax highlighting, subscribe, search, scheduled publishing, series, view count) across both Kore v2 (baseline template) and GCOAT (project). Kore gets updated first as the canonical source, then GCOAT inherits + customizes. Additionally, back-port GCOAT's generic blog enhancements (TOC, progress bar, code copy, heading anchors, related posts, JSON-LD, skeletons, featured hero) to Kore baseline. GCOAT-specific design effects (3D tilt, ambient canvas, parallax) become Kore recipes.

---

## Key Findings from Audit

### Divergence: Kore v2 ↔ GCOAT

| Feature | Kore v2 (baseline) | GCOAT (iterated) |
|---|---|---|
| post.js | Basic: slug load, redirect, date, reading time, author initials, prev/next, meta tags | Enhanced: TOC, progress bar, parallax hero, code copy, heading anchors, related posts carousel, JSON-LD BlogPosting |
| blog.js | Basic: load posts, cards, tag filter, pagination | Enhanced: featured hero, 3D tilt/glare, skeleton loaders, scroll reveal stagger |
| blog-ambient.js | Does not exist | Ink-particle canvas background |
| homepage-blog.js | Does not exist | 3 featured posts on homepage |
| blog.html | Basic: tag bar, grid, load more, empty state | Enhanced: featured hero section, skeleton markup, ambient canvas |
| post.html | Basic: header, body, footer, author bio, prev/next | Enhanced: progress bar, TOC sidebar, related posts section, hero with overlay |
| components.css | ~300 lines blog CSS | ~540 lines blog CSS (cards, hero, skeletons, TOC, progress bar) |
| Backend (app.py) | Identical blog handlers | Same (ported via A.3 sync) |
| Tests | Same structure | Same (ported via A.5 sync) |
| deps-registry.json | Prism.js NOT registered | Prism.js registered but NOT used |

### What Back-Ports to Kore (generic blog features)

- TOC generation (h2/h3 scan, active highlighting, mobile toggle)
- Reading progress bar (scroll-driven)
- Code copy buttons on `<pre>` blocks
- Heading anchor links (auto-generated IDs)
- Related posts (tag-overlap scoring, carousel)
- JSON-LD BlogPosting schema
- Skeleton loaders (shimmer animation)
- Featured hero on listing page (first post)
- Homepage blog section (featured posts)
- Enhanced post.html structure (hero + fallback header, TOC sidebar)
- Enhanced blog.html structure (hero section, skeleton markup)

### What Becomes Kore Recipes (design-specific)

- 3D tilt/glare on blog cards (from blog.js `initCardGlare()`)
- Ambient ink-particle canvas (from blog-ambient.js)
- Blog parallax hero (from post.js `initParallax()`)

### What Stays GCOAT-Only

- Scroll reveal stagger timing (GCOAT-specific animation tuning)
- GCOAT branding, nav links, footer, color scheme integration

---

## Phases

### Phase 0: Audit & Prep (Kore workspace)

*Workspace: kore/v2*

**Step 0.1**: Diff Kore v2 and GCOAT blog backend code
- Compare `app.py` blog handlers line-by-line
- Identify any GCOAT bug fixes not yet in Kore
- Check: base64 body handling guards, email validation, CORS origins
- Log findings in KORE_FIXES.md if needed

**Step 0.2**: Diff Kore v2 and GCOAT blog frontend code
- Compare post.js, blog.js, blog.html, post.html, api.js, components.css
- Catalog all GCOAT additions that should be baseline vs project-specific

**Step 0.3**: Diff docs
- Compare all 8 docs files between repos
- Identify any GCOAT-specific doc changes that should propagate to Kore

**Verification**: Document of exact deltas, classified as: back-port / recipe / GCOAT-only

---

### Phase 1: Back-Port GCOAT Blog Enhancements to Kore (Kore workspace)

*Workspace: kore/v2*
*Depends on: Phase 0*

**Step 1.1**: Update Kore `post.html` structure
- Add reading progress bar markup (`post__progress`)
- Add TOC sidebar markup (`post__toc` with toggle button + nav)
- Add featured image hero layout (`post__hero` with overlay + fallback header)
- Add related posts section (`post__related`)
- Add author bio section (`post__author-bio`)
- Keep markup generic (no GCOAT branding)

**Step 1.2**: Update Kore `post.js`
- Add `buildTOC()` — scan h2/h3, create nav, IntersectionObserver active highlighting, mobile toggle
- Add `initProgressBar()` — scroll-driven progress bar via rAF
- Add `enhanceContent()` — heading ID generation, anchor links, code copy buttons
- Add `loadRelatedPosts()` — tag-overlap scoring, render up to 3 related cards
- Add JSON-LD `BlogPosting` schema injection
- Keep `loadPrevNext()`, `renderPost()` (already in Kore, may need updating)
- Note: Do NOT add parallax (that becomes a recipe)

**Step 1.3**: Update Kore `blog.html` structure
- Add featured hero section (`blog-hero` with img, title, excerpt, date, tags, CTA)
- Add skeleton loader markup (3 shimmer cards)
- Keep tag filter bar + grid + pagination (already exist)

**Step 1.4**: Update Kore `blog.js`
- Add `renderHero()` — populate featured hero from first post
- Add skeleton loader show/hide logic
- Add scroll reveal via IntersectionObserver (generic, no GCOAT stagger timing)
- Note: Do NOT add 3D tilt/glare (that becomes a recipe)

**Step 1.5**: Create Kore `homepage-blog.js`
- Load 3 featured posts on homepage
- Card rendering (reuse blog.js card template or shared function)
- Graceful fallback if API unreachable

**Step 1.6**: Update Kore `index.html`
- Add blog section (if not present) with 3-card grid for latest posts
- Add Blog link to nav
- Include `homepage-blog.js` as module
- Feature-flagged: commented out by default with instructions

**Step 1.7**: Update Kore `components.css`
- Add blog card styles (img-wrap, body, meta, tags, read-more, date badge)
- Add skeleton loader styles + shimmer keyframe
- Add post detail styles (progress bar, hero, fallback header, TOC, body, code blocks, heading anchors, author bio, prev/next, related posts)
- Add featured hero styles (blog listing page)
- Keep generic (design tokens, not GCOAT-specific colors)

**Step 1.8**: Update Kore `api.js`
- Verify `getBlogPosts()` and `getBlogPost()` match GCOAT's version
- Add redirect handling in `getBlogPost()` if missing

**Verification**:
- Kore v2 blog listing shows featured hero + skeleton loaders + cards + tag filter + pagination
- Kore v2 single post shows progress bar + TOC + code copy + heading anchors + related posts + prev/next + JSON-LD
- Kore v2 homepage shows 3 latest posts
- All existing tests still pass

---

### Phase 2: Add New Features to Kore Baseline — Priority (Kore workspace)

*Workspace: kore/v2*
*Depends on: Phase 1*

**Step 2.1**: Social Share Buttons
- **post.html**: Add `<div class="post__share">` between hero/header and `post__layout`. 3 buttons: Twitter/X, LinkedIn, Copy URL
- **post.js**: Add `initShareButtons()`. Twitter uses `https://twitter.com/intent/tweet?text=...&url=...`. LinkedIn uses `https://www.linkedin.com/sharing/share-offsite/?url=...`. Copy uses `navigator.clipboard.writeText()` with checkmark feedback (same pattern as code copy)
- **components.css**: Style `.post__share` — sticky bottom bar on mobile, inline row on desktop. Icon buttons with hover/focus states

**Step 2.2**: RSS Feed Endpoint
- **app.py**: New `handle_get_blog_feed(event)`. Query GSI1 for 20 published posts (newest first). Build RSS 2.0 XML string. Return with `Content-Type: application/rss+xml`, `Cache-Control: public, max-age=300`
- **app.py router**: Add `GET /blog/feed` route. MUST match *before* `GET /blog/posts/{slug}` to avoid slug collision
- **template.yaml**: Add `GetBlogFeed` event under Lambda Events section (path: /blog/feed, method: GET)
- **blog.html + post.html**: Add `<link rel="alternate" type="application/rss+xml" title="Blog" href="{API_BASE}/blog/feed">`
- **test_blog.py**: New `TestBlogFeed` class — test XML structure, content type, published posts only, caching headers, empty feed

**Step 2.3**: Code Syntax Highlighting (Prism.js)
- **deps-registry.json**: Add Prism.js entry (core + language grammars: js, python, html, css, bash, json). Include SRI hashes, CSP rules
- **APPROVED_DEPS.md**: Add Prism.js to approved list with rationale (blog code blocks)
- **Install**: Run `./scripts/deps.sh add prism` (or manual if registry entry is new) — downloads to `frontend/assets/js/vendor/` or uses CDN (Level 1)
- **post.html**: Add Prism CSS (theme-aware: dark/light) + Prism JS script tags (defer)
- **post.js `enhanceContent()`**: After heading/code-copy setup, call `Prism.highlightAllUnder(postBody)`. Add `class="language-X"` detection — Quill may not set language classes, default to `language-plaintext`
- **components.css**: Override Prism defaults for design tokens (border-radius, padding, font). Theme-aware via `[data-theme]`
- Note: Dependency proposal workflow — Prism.js needs owner approval per AI_INSTRUCTIONS.md rules

**Step 2.4**: Newsletter / Blog Subscribe
- **blog.html**: Add `<section class="blog-subscribe">` after grid/pagination. Email input + submit button + success/error message. Label: "Get new articles in your inbox"
- **post.html**: Add same subscribe section after `post__related`, before footer
- **Frontend JS**: On submit, call `POST /leads` with `{ email, source: "blog-subscribe" }`. Use existing `submitLead()` from api.js
- **app.py `handle_post_leads()`**: Verify `source` field is stored in DynamoDB lead item. If not, add it to the put_item call. Add "blog-subscribe" to ALLOWED_SOURCES
- **components.css**: Style `.blog-subscribe` — centered card with email input + button

**Verification (Phase 2)**:
- Share buttons: Click Twitter → opens tweet intent. Copy → clipboard. LinkedIn → opens share page
- RSS: `curl /blog/feed` → valid RSS XML. `<link rel="alternate">` in page source
- Prism: Post with code block → colored tokens. Theme toggle → colors adapt. Copy still works
- Subscribe: Enter email → success. Leads table has `source: "blog-subscribe"`

---

### Phase 3: Add New Features to Kore Baseline — Deferred (Kore workspace)

*Workspace: kore/v2*
*Depends on: Phase 2. Can be done later, after GCOAT ships*

**Step 3.1**: Client-Side Blog Search
- **blog.html**: `<input type="search" class="blog-search__input">` above tag bar
- **blog.js**: Debounced 300ms filter on loaded cards by title/excerpt text. "No results" state
- No backend changes for v1

**Step 3.2**: Scheduled Publishing
- **app.py**: Accept `scheduledAt` (ISO 8601 future datetime) in POST/PUT blog post validation
- **template.yaml**: New `BlogPublisherFunction` Lambda triggered by EventBridge (every 5 min). Scans drafts where `scheduledAt <= now`, flips to published, calls `_write_tag_items()`
- **admin.html/admin.js**: Datetime-local input + "Scheduled" badge
- **test_blog.py**: Tests for scheduledAt validation + publisher logic

**Step 3.3**: Post Series / Multi-Part Linking
- **app.py `_validate_blog_post()`**: Optional `series` (string, max 120) + `seriesPart` (int, 1-99)
- **post.js**: If `series` exists, fetch all posts in series, render "Part N of M" banner
- **app.py `handle_get_blog_posts()`**: Add `?series=X` filter param

**Step 3.4**: View Count
- **app.py `handle_get_blog_post()`**: Atomic ADD on `viewCount` attribute (`SET viewCount = if_not_exists(viewCount, :zero) + :one`)
- **post.js**: Display view count in meta
- **blog.js `createCard()`**: Display count on cards if present

---

### Phase 4: Update Kore Docs (Kore workspace)

*Workspace: kore/v2*
*Depends on: Phase 2 (update docs for features that exist)*

**Step 4.1**: `kore-what-we-are-building.md`
- Add blog feature scope: TOC, progress bar, code copy, heading anchors, related posts, JSON-LD, skeleton loaders, featured hero, homepage preview
- Add new features: social sharing, RSS feed, syntax highlighting, newsletter subscribe
- Mention deferred features: search, scheduled publishing, series, view count

**Step 4.2**: `kore-backend-coverage-checklist.md`
- Add RSS feed route (`GET /blog/feed`) to checklist
- Add `blog-subscribe` source to leads route
- Add deferred: scheduledAt validation, series fields, viewCount increment

**Step 4.3**: `kore-frontend-coverage-checklist.md`
- Add: share buttons, RSS link tag, Prism.js integration, subscribe form
- Add: TOC, progress bar, code copy, heading anchors, skeleton loaders, featured hero, homepage blog
- Add deferred: search input, scheduled badge, series banner, view count display

**Step 4.4**: `kore-standards-backend.md`
- Add RSS XML response pattern (Content-Type, cache headers, XML escaping)
- Add atomic counter pattern (view count)
- Add ALLOWED_SOURCES update pattern

**Step 4.5**: `kore-standards-frontend.md`
- Add approved dependency: Prism.js (Level 1, CDN or local)
- Add share button pattern (intent URLs, no SDKs)
- Add subscribe form reusing leads API pattern

**Step 4.6**: `kore-architecture-folder-structure.md`
- Add `homepage-blog.js` to frontend JS listing
- Add `blog-ambient.js` mention (project-specific, not baseline)
- Add vendor JS path if Prism is local

**Step 4.7**: `AI_INSTRUCTIONS.md`
- Update "Common Tasks" with: how to add blog features, how to manage blog subscribers
- Ensure Prism.js is mentioned in dependency section if registered

**Step 4.8**: `deps-registry.json` + `APPROVED_DEPS.md`
- Add Prism.js to registry with CDN URLs, SRI hashes, CSP rules
- Update APPROVED_DEPS.md with Prism.js entry

**Verification**: Docs accurately describe all blog features, new patterns, and file locations

---

### Phase 5: Kore Recipes for Design Effects (Kore workspace)

*Workspace: kore/v2*
*Parallel with Phase 4*

**Step 5.1**: Create recipe `kore-recipes/effects/blog-card-3d-tilt.html`
- Extract `initCardGlare()` logic from GCOAT's blog.js
- CSS variables: `--glare-x`, `--glare-y`, `--tilt-x`, `--tilt-y`
- Respects `prefers-reduced-motion` and touch-primary devices
- Tag in catalog: `blog`, `cards`, `3d`, `interactive`, mood: `modern-premium`

**Step 5.2**: Create recipe `kore-recipes/backgrounds/blog-ambient-canvas.html`
- Extract ink-particle canvas from GCOAT's blog-ambient.js
- Standalone demo with token integration
- Tag in catalog: `blog`, `background`, `canvas`, `ambient`, mood: `modern-premium`

**Step 5.3**: Update `kore-recipes/catalog.json` + `catalog.md`
- Add both new recipes with metadata

**Step 5.4**: Copy new recipes to GCOAT's `kore-recipes/`

---

### Phase 6: Sync to GCOAT + Implement (GCOAT workspace)

*Workspace: gcoat-web*
*Depends on: Phases 2, 4, 5*

**Step 6.1**: Sync docs from Kore to GCOAT
- Copy all 8 updated doc files from Kore v2 to GCOAT
- Verify no GCOAT-specific doc customizations were overwritten (diff first)
- If GCOAT has project-specific doc additions, merge rather than replace

**Step 6.2**: Sync deps-registry.json
- Copy Prism.js entry from Kore to GCOAT (GCOAT already has it registered, verify alignment)

**Step 6.3**: Implement new features in GCOAT
- Adapt Kore's new code (share buttons, RSS, Prism, subscribe) to GCOAT's theme
- GCOAT-specific tweaks: colors, font, branding in share bar, subscribe form
- CSP updates: add Prism CDN if using Level 1 (or no change if local)
- Config: Add `FEATURES.RSS`, `FEATURES.SUBSCRIBE` flags if feature-gating

**Step 6.4**: GCOAT-specific customizations
- Share buttons styled with GCOAT's color scheme + glassmorphism
- Subscribe form styled to match GCOAT's CTA band aesthetic
- Prism theme colors derived from GCOAT's HSL design tokens

**Step 6.5**: Update backend
- Sync RSS feed handler from Kore (app.py additions)
- Add "blog-subscribe" to ALLOWED_SOURCES in GCOAT's app.py
- Sync test_blog.py (new TestBlogFeed tests)

**Step 6.6**: Log any Kore fixes found
- If issues surface during GCOAT implementation, log them in KORE_FIXES.md

**Verification**:
- All Phase 2 verification items pass in GCOAT
- GCOAT design-specific effects (3D tilt, ambient canvas, parallax) still work
- 253+ backend tests pass
- Docs match between repos (except project-specific additions)

---

## Relevant Files — Both Repos

### Kore v2

| File | Changes |
|---|---|
| `frontend/post.html` | Progress bar, TOC, hero, related, share buttons, subscribe, Prism |
| `frontend/blog.html` | Featured hero, skeletons, subscribe, RSS link |
| `frontend/index.html` | Homepage blog section, nav link, homepage-blog.js |
| `frontend/assets/js/post.js` | TOC, progress bar, enhanceContent, related posts, share, JSON-LD |
| `frontend/assets/js/blog.js` | renderHero, skeletons, scroll reveal |
| `frontend/assets/js/homepage-blog.js` | New file — 3 featured homepage posts |
| `frontend/assets/js/api.js` | Verify/update getBlogPosts, getBlogPost |
| `frontend/assets/css/components.css` | ~240 lines new blog CSS |
| `backend/src/app.py` | RSS handler, ALLOWED_SOURCES update |
| `backend/template.yaml` | RSS route event |
| `backend/tests/test_blog.py` | RSS tests |
| `scripts/deps-registry.json` | Prism.js entry |
| `kore-recipes/APPROVED_DEPS.md` | Prism.js approved |
| `docs/*` | All 8 doc files + AI_INSTRUCTIONS.md |
| `kore-recipes/effects/blog-card-3d-tilt.html` | New recipe |
| `kore-recipes/backgrounds/blog-ambient-canvas.html` | New recipe |
| `kore-recipes/catalog.json` + `catalog.md` | New recipe entries |

### GCOAT

| File | Changes |
|---|---|
| `frontend/post.html` | Share buttons, subscribe, Prism, RSS link |
| `frontend/blog.html` | Subscribe, RSS link |
| `frontend/assets/js/post.js` | Share buttons init, Prism integration |
| `frontend/assets/js/blog.js` | Subscribe form handler |
| `frontend/assets/js/api.js` | Verify alignment with Kore |
| `frontend/assets/css/components.css` | Share, subscribe, Prism overrides (GCOAT-themed) |
| `backend/src/app.py` | RSS handler, ALLOWED_SOURCES |
| `backend/tests/test_blog.py` | RSS tests |
| `docs/*` | Synced from Kore (merged) |
| `scripts/deps-registry.json` | Prism.js aligned with Kore |
| `kore-recipes/` | New recipes synced from Kore |
| `KORE_FIXES.md` | Created if issues found |

---

## Verification Summary

1. **Phase 1**: Kore blog listing has hero + skeletons + cards. Single post has progress bar + TOC + code copy + anchors + related posts + JSON-LD. Homepage has 3 posts. All tests pass
2. **Phase 2**: Share buttons work (Twitter, LinkedIn, Copy). RSS returns valid XML. Code blocks have syntax coloring. Subscribe form stores lead with source
3. **Phase 4**: All docs accurately describe features and patterns
4. **Phase 5**: Recipes render correctly in browser, catalog updated
5. **Phase 6**: GCOAT inherits all features with GCOAT-specific design. 253+ tests pass. Docs match

---

## Decisions

- **Kore updated FIRST** as canonical source; GCOAT inherits
- Generic blog features (TOC, progress bar, etc.) become Kore baseline
- Design effects (3D tilt, ambient canvas, parallax) become Kore recipes, not baseline
- Prism.js requires dependency approval per AI_INSTRUCTIONS.md rules (Level 1 CDN or local download — recommend local)
- RSS is a backend endpoint (not static file) — always reflects current published posts
- Subscribe reuses existing LeadsTable — no new infrastructure
- No social sharing SDKs — plain intent URLs (no cookies/tracking)
- Docs sync direction: Kore → GCOAT (Kore is source of truth for shared docs)
- GCOAT-specific doc additions preserved during sync (merge, not replace)
- KORE_FIXES.md created during implementation if issues found
- Phase 3 (deferred features) can be done after GCOAT ships
- Homepage blog section in Kore: feature-flagged, commented out by default with instructions

---

## Further Considerations

1. **Prism.js delivery**: Level 1 CDN or local download to `assets/js/vendor/`? CDN is simpler but adds external dependency. Local is more aligned with Kore's vanilla philosophy. **Recommend: local download.**
2. **Homepage blog section in Kore**: Kore's `index.html` is a generic template. Adding a blog section changes the default page structure. Should be opt-in (commented out, with `FEATURES.BLOG` flag).
