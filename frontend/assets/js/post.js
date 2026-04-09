// post.js — ES module for post.html single post view
// Phase 3: Progress bar, TOC, hero image, typography enhancements, related posts

import { getBlogPost, getBlogPosts, submitLead } from "./api.js";

// ── DOM References ──
const article = document.getElementById("post-article");
const loadingEl = document.getElementById("post-loading");
const errorEl = document.getElementById("post-error");

// Hero elements (with featured image)
const heroSection = document.getElementById("post-hero");
const heroImg = document.getElementById("post-featured-img");
const titleEl = document.getElementById("post-title");
const dateEl = document.getElementById("post-date");
const readingTimeEl = document.getElementById("post-reading-time");
const authorEl = document.getElementById("post-author");
const tagsEl = document.getElementById("post-tags");

// Fallback header (no featured image)
const headerFallback = document.getElementById("post-header-fallback");
const titleFallbackEl = document.getElementById("post-title-fallback");
const dateFallbackEl = document.getElementById("post-date-fallback");
const readingTimeFallbackEl = document.getElementById("post-reading-time-fallback");
const authorFallbackEl = document.getElementById("post-author-fallback");
const tagsFallbackEl = document.getElementById("post-tags-fallback");

const bodyEl = document.getElementById("post-body");

// Progress bar
const progressEl = document.getElementById("post-progress");
const progressBar = progressEl?.querySelector(".post__progress-bar");

// TOC
const tocEl = document.getElementById("post-toc");
const tocNav = document.getElementById("post-toc-nav");
const tocToggle = document.getElementById("post-toc-toggle");

// Author bio
const authorBioName = document.getElementById("post-author-name");
const authorBioText = document.getElementById("post-author-text");
const authorBioAvatar = document.getElementById("post-author-avatar");

// Navigation
const postNav = document.getElementById("post-nav");
const navPrev = document.getElementById("post-nav-prev");
const navPrevTitle = document.getElementById("post-nav-prev-title");
const navNext = document.getElementById("post-nav-next");
const navNextTitle = document.getElementById("post-nav-next-title");

// Related
const relatedSection = document.getElementById("post-related");
const relatedGrid = document.getElementById("post-related-grid");

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// ── Get slug from URL ──
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

if (!slug) {
  showError();
} else {
  loadPost(slug);
}

async function loadPost(slug) {
  loadingEl.hidden = false;

  try {
    const result = await getBlogPost(slug);

    if (result.data?.redirect) {
      window.location.replace(`post.html?slug=${encodeURIComponent(result.data.slug)}`);
      return;
    }

    const post = result.data;
    if (!post) {
      showError();
      return;
    }

    renderPost(post);
    initProgressBar();
    initParallax();
    initShareButtons(post);
    loadPrevNext(post);
    loadRelatedPosts(post);
  } catch (err) {
    showError();
  } finally {
    loadingEl.hidden = true;
  }
}

function renderPost(post) {
  const isoDate = post.publishedAt || post.createdAt;
  const dateFormatted = formatDate(isoDate);

  // Reading time
  const wordCount = (post.content || "").replace(/<[^>]*>/g, "").split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  const readingText = `${minutes} min read`;

  // Tags HTML
  const tagsHtml = (post.tags || [])
    .map((t) => `<a href="blog.html?tag=${encodeURIComponent(t)}" class="tag">${escapeHtml(t)}</a>`)
    .join("");

  // Determine layout: hero vs. fallback
  if (post.featuredImage) {
    // Show hero layout
    heroImg.src = post.featuredImage;
    heroImg.alt = post.title;
    titleEl.textContent = post.title;
    dateEl.textContent = dateFormatted;
    if (isoDate) dateEl.setAttribute("datetime", isoDate);
    readingTimeEl.textContent = readingText;
    authorEl.textContent = post.author ? `by ${post.author}` : "";
    tagsEl.innerHTML = tagsHtml;
    heroSection.hidden = false;
    headerFallback.hidden = true;
  } else {
    // Show fallback header
    titleFallbackEl.textContent = post.title;
    dateFallbackEl.textContent = dateFormatted;
    if (isoDate) dateFallbackEl.setAttribute("datetime", isoDate);
    readingTimeFallbackEl.textContent = readingText;
    authorFallbackEl.textContent = post.author ? `by ${post.author}` : "";
    tagsFallbackEl.innerHTML = tagsHtml;
    heroSection.hidden = true;
    headerFallback.hidden = false;
  }

  // Body content
  bodyEl.innerHTML = post.content || "";

  // Enhance content: heading anchors, code copy buttons
  enhanceContent();

  // Build TOC
  buildTOC();

  // Author bio
  if (post.author) {
    authorBioName.textContent = post.author;
    authorBioText.textContent = "Contributing writer.";
    const initials = post.author.split(" ").map((w) => w[0]).join("").slice(0, 2);
    authorBioAvatar.textContent = initials;
  }

  // Update page meta
  document.title = `${post.title} — GCOAT`;
  setMeta("description", post.excerpt || post.title);
  setMeta("og:title", post.title);
  setMeta("og:description", post.excerpt || post.title);
  setMeta("og:url", window.location.href);
  setMeta("twitter:title", post.title);
  setMeta("twitter:description", post.excerpt || post.title);
  if (post.featuredImage) {
    setMeta("og:image", post.featuredImage);
    setMeta("twitter:image", post.featuredImage);
  }

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt || post.title,
    "url": window.location.href,
    "datePublished": post.publishedAt || post.createdAt,
    "author": { "@type": "Person", "name": post.author || "GCOAT" },
    "publisher": {
      "@type": "Organization",
      "name": "GCOAT",
      "url": "https://gcoat.github.io/gcoat-web/"
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": window.location.href }
  };
  if (post.updatedAt) jsonLd.dateModified = post.updatedAt;
  if (post.featuredImage) jsonLd.image = post.featuredImage;
  if (post.tags?.length) jsonLd.keywords = post.tags.join(", ");
  const ldScript = document.createElement("script");
  ldScript.type = "application/ld+json";
  ldScript.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(ldScript);

  article.hidden = false;
}

// ── Content Enhancements ──
function enhanceContent() {
  // Heading anchors
  const headings = bodyEl.querySelectorAll("h2, h3");
  headings.forEach((h) => {
    if (!h.id) {
      h.id = h.textContent.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    const anchor = document.createElement("a");
    anchor.className = "post__heading-anchor";
    anchor.href = `#${h.id}`;
    anchor.setAttribute("aria-label", `Link to section: ${h.textContent}`);
    anchor.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    h.classList.add("post__heading--linked");
    h.appendChild(anchor);
  });

  // Code block copy buttons
  const codeBlocks = bodyEl.querySelectorAll("pre");
  codeBlocks.forEach((pre) => {
    pre.classList.add("post__code-block");
    const btn = document.createElement("button");
    btn.className = "post__code-copy";
    btn.type = "button";
    btn.setAttribute("aria-label", "Copy code");
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    btn.addEventListener("click", () => {
      const code = pre.querySelector("code")?.textContent || pre.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        }, 2000);
      });
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
}

// ── Table of Contents ──
function buildTOC() {
  const headings = bodyEl.querySelectorAll("h2, h3");
  if (headings.length < 3) return; // Not enough headings to justify a TOC

  let html = '<ul class="post__toc-list">';
  headings.forEach((h) => {
    const level = h.tagName === "H3" ? "post__toc-item--sub" : "";
    html += `<li class="post__toc-item ${level}">
      <a class="post__toc-link" href="#${h.id}" data-target="${h.id}">${escapeHtml(h.textContent.trim())}</a>
    </li>`;
  });
  html += "</ul>";
  tocNav.innerHTML = html;
  tocEl.hidden = false;

  // Smooth scroll
  tocNav.addEventListener("click", (e) => {
    const link = e.target.closest(".post__toc-link");
    if (!link) return;
    e.preventDefault();
    const target = document.getElementById(link.dataset.target);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${link.dataset.target}`);
    }
  });

  // Active section highlighting
  const tocLinks = tocNav.querySelectorAll(".post__toc-link");
  const headingObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tocLinks.forEach((l) => l.classList.remove("is-active"));
          const active = tocNav.querySelector(`[data-target="${entry.target.id}"]`);
          if (active) active.classList.add("is-active");
        }
      });
    },
    { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
  );
  headings.forEach((h) => headingObserver.observe(h));

  // Mobile toggle
  if (tocToggle) {
    tocToggle.addEventListener("click", () => {
      const expanded = tocToggle.getAttribute("aria-expanded") === "true";
      tocToggle.setAttribute("aria-expanded", String(!expanded));
      tocNav.hidden = expanded;
    });
    // Start collapsed on mobile
    if (window.innerWidth < 1024) {
      tocNav.hidden = true;
    } else {
      tocToggle.setAttribute("aria-expanded", "true");
    }
  }
}

// ── Parallax Hero ──
function initParallax() {
  if (!heroSection || heroSection.hidden) return;
  const img = document.getElementById("post-featured-img");
  if (!img) return;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (prefersReduced || isTouch) return;

  let ticking = false;
  function updateParallax() {
    const rect = heroSection.getBoundingClientRect();
    const viewH = window.innerHeight;
    if (rect.bottom < 0 || rect.top > viewH) { ticking = false; return; }
    const progress = (viewH - rect.top) / (viewH + rect.height);
    const pxShift = (progress - 0.5) * 60;
    img.style.transform = `translateY(${pxShift.toFixed(1)}px)`;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(updateParallax); ticking = true; }
  }, { passive: true });
  updateParallax();
}

// ── Reading Progress Bar ──
function initProgressBar() {
  if (!progressEl || !bodyEl) return;
  progressEl.hidden = false;

  let ticking = false;
  function updateProgress() {
    const bodyRect = bodyEl.getBoundingClientRect();
    const bodyTop = bodyRect.top + window.scrollY;
    const bodyHeight = bodyRect.height;
    const scrolled = window.scrollY - bodyTop;
    const progress = Math.min(1, Math.max(0, scrolled / (bodyHeight - window.innerHeight)));
    const pct = Math.round(progress * 100);
    progressBar.style.setProperty("--progress", progress);
    progressEl.setAttribute("aria-valuenow", String(pct));
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(updateProgress);
      ticking = true;
    }
  }, { passive: true });

  updateProgress();
}

// ── Prev / Next Navigation ──
async function loadPrevNext(currentPost) {
  try {
    const result = await getBlogPosts({ limit: 50 });
    const posts = result.data?.posts || [];
    if (posts.length < 2) return;

    const idx = posts.findIndex((p) => p.slug === currentPost.slug);
    if (idx === -1) return;

    if (idx > 0) {
      const prev = posts[idx - 1];
      navPrev.href = `post.html?slug=${encodeURIComponent(prev.slug)}`;
      navPrevTitle.textContent = prev.title;
      navPrev.hidden = false;
    }
    if (idx < posts.length - 1) {
      const next = posts[idx + 1];
      navNext.href = `post.html?slug=${encodeURIComponent(next.slug)}`;
      navNextTitle.textContent = next.title;
      navNext.hidden = false;
    }

    postNav.hidden = false;
  } catch {
    // Non-critical
  }
}

// ── Related Posts ──
async function loadRelatedPosts(currentPost) {
  if (!relatedSection || !relatedGrid) return;

  try {
    const result = await getBlogPosts({ limit: 20 });
    const posts = (result.data?.posts || []).filter((p) => p.slug !== currentPost.slug);
    if (posts.length === 0) return;

    // Prefer same-tag posts, then fill with others
    const currentTags = new Set(currentPost.tags || []);
    const scored = posts.map((p) => {
      const overlap = (p.tags || []).filter((t) => currentTags.has(t)).length;
      return { post: p, score: overlap };
    });
    scored.sort((a, b) => b.score - a.score);

    const related = scored.slice(0, 3);
    if (related.length === 0) return;

    related.forEach(({ post }) => {
      const card = createRelatedCard(post);
      relatedGrid.appendChild(card);
    });

    // Carousel nav buttons
    const nav = document.createElement("div");
    nav.className = "post__related-nav";
    nav.innerHTML = `
      <button class="post__related-btn" aria-label="Previous" data-dir="-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <button class="post__related-btn" aria-label="Next" data-dir="1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;
    relatedSection.appendChild(nav);

    nav.addEventListener("click", (e) => {
      const btn = e.target.closest(".post__related-btn");
      if (!btn) return;
      const dir = Number(btn.dataset.dir);
      const card = relatedGrid.querySelector(".blog-card");
      if (card) {
        relatedGrid.scrollBy({ left: dir * (card.offsetWidth + 24), behavior: "smooth" });
      }
    });

    relatedSection.hidden = false;
  } catch {
    // Non-critical
  }
}

function createRelatedCard(post) {
  const card = document.createElement("a");
  card.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  card.className = "blog-card card";

  const isoDate = post.publishedAt || post.GSI1SK || post.createdAt || "";
  const dateFormatted = formatDate(isoDate);
  const excerpt = post.excerpt || "";
  const tags = (post.tags || [])
    .slice(0, 2)
    .map((t) => `<span class="tag tag--sm">${escapeHtml(t)}</span>`)
    .join("");

  const img = post.featuredImage
    ? `<div class="blog-card__img-wrap">
        <img class="blog-card__img" src="${escapeHtml(post.featuredImage)}" alt="" width="640" height="360" loading="lazy">
      </div>`
    : "";

  card.innerHTML = `
    ${img}
    <div class="blog-card__body">
      <div class="blog-card__meta">
        <time class="blog-card__date">${dateFormatted}</time>
      </div>
      <h3 class="blog-card__title">${escapeHtml(post.title)}</h3>
      <p class="blog-card__excerpt">${escapeHtml(excerpt)}</p>
      ${tags ? `<div class="blog-card__tags">${tags}</div>` : ""}
      <span class="blog-card__read-more">Read more <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></span>
    </div>
  `;
  return card;
}

// ── Social Share Buttons ──
function initShareButtons(post) {
  const shareEl = document.getElementById("post-share");
  if (!shareEl) return;

  const pageUrl = window.location.href;
  const pageTitle = post.title || "";

  document.getElementById("share-twitter")?.addEventListener("click", () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(pageTitle)}&url=${encodeURIComponent(pageUrl)}`,
      "_blank", "noopener,width=550,height=420"
    );
  });

  document.getElementById("share-linkedin")?.addEventListener("click", () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
      "_blank", "noopener,width=550,height=420"
    );
  });

  const copyBtn = document.getElementById("share-copy");
  copyBtn?.addEventListener("click", () => {
    navigator.clipboard.writeText(pageUrl).then(() => {
      copyBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
      }, 2000);
    });
  });

  shareEl.hidden = false;
}

// ── Subscribe Form ──
const subscribeForm = document.getElementById("subscribe-form");
const subscribeStatus = document.getElementById("subscribe-status");
if (subscribeForm) {
  subscribeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("subscribe-email")?.value?.trim();
    if (!email) return;

    subscribeStatus.hidden = true;
    subscribeStatus.className = "blog-subscribe__status";

    try {
      await submitLead({ email, source: "blog-subscribe" });
      subscribeStatus.textContent = "You're subscribed! Thanks for signing up.";
      subscribeStatus.classList.add("blog-subscribe__status--success");
      subscribeForm.reset();
    } catch {
      subscribeStatus.textContent = "Something went wrong. Please try again.";
      subscribeStatus.classList.add("blog-subscribe__status--error");
    }
    subscribeStatus.hidden = false;
  });
}

// ── RSS Link Setup ──
const rssLink = document.getElementById("rss-link");
if (rssLink && window.APP_CONFIG?.API_BASE_URL) {
  rssLink.href = `${window.APP_CONFIG.API_BASE_URL}/blog/feed`;
}

function showError() {
  loadingEl.hidden = true;
  errorEl.hidden = false;
}

// ── Helpers ──
function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return iso.split("T")[0];
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function setMeta(name, content) {
  const isOg = name.startsWith("og:") || name.startsWith("twitter:");
  const attr = isOg ? "property" : "name";
  const el = document.querySelector(`meta[${attr}="${name}"]`);
  if (el) el.setAttribute("content", content);
}
