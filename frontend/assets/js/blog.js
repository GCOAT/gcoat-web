// blog.js — ES module for blog.html listing page
// Phase 1–2: Featured hero, scroll reveal, 3D tilt/glare, skeleton loaders

import { getBlogPosts, submitLead } from "./api.js";

const grid = document.getElementById("blog-grid");
const loading = document.getElementById("blog-loading");
const skeleton = document.getElementById("blog-skeleton");
const empty = document.getElementById("blog-empty");
const pagination = document.getElementById("blog-pagination");
const loadMoreBtn = document.getElementById("blog-load-more");
const tagsBar = document.getElementById("blog-tags");
const yearEl = document.getElementById("year");

// Hero elements
const heroSection = document.getElementById("blog-hero");
const heroLink = document.getElementById("blog-hero-link");
const heroImg = document.getElementById("blog-hero-img");
const heroTitle = document.getElementById("blog-hero-title");
const heroExcerpt = document.getElementById("blog-hero-excerpt");
const heroDate = document.getElementById("blog-hero-date");
const heroAuthor = document.getElementById("blog-hero-author");
const heroTags = document.getElementById("blog-hero-tags");

let currentTag = "";
let nextKey = null;
const seenTags = new Set();
let isFirstLoad = true;

if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// ── Scroll Reveal Observer ──
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let revealObserver = null;
if (!prefersReducedMotion) {
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
  );
}

// ── 3D Tilt + Glare (lightweight version for dynamic cards) ──
function initCardGlare(card) {
  if (prefersReducedMotion) return;
  const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
  if (isTouchPrimary) return;

  const MAX_TILT = 4;
  let rafId = null;

  card.addEventListener("pointermove", (e) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--glare-x", x + "px");
      card.style.setProperty("--glare-y", y + "px");
      const nx = (x / rect.width - 0.5) * 2;
      const ny = (y / rect.height - 0.5) * 2;
      card.style.setProperty("--tilt-x", (-ny * MAX_TILT).toFixed(2) + "deg");
      card.style.setProperty("--tilt-y", (nx * MAX_TILT).toFixed(2) + "deg");
      rafId = null;
    });
  });

  card.addEventListener("pointerenter", () => {
    card.style.willChange = "transform";
  });

  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
    setTimeout(() => { card.style.willChange = ""; }, 350);
  });
}

// ── Init ──
loadPosts();

loadMoreBtn?.addEventListener("click", () => loadPosts(true));

const allBtn = tagsBar?.querySelector('[data-tag=""]');
allBtn?.addEventListener("click", () => filterByTag(""));

// ── Load Posts ──
async function loadPosts(append = false) {
  if (!append) {
    grid.innerHTML = "";
    nextKey = null;
    if (isFirstLoad && skeleton) skeleton.hidden = false;
  }

  if (!isFirstLoad) loading.hidden = false;
  empty.hidden = true;
  pagination.hidden = true;

  try {
    const params = { limit: 10 }; // +1 for hero
    if (currentTag) params.tag = currentTag;
    const result = await getBlogPosts(params);
    const posts = result.data?.posts || [];
    nextKey = result.data?.nextKey || null;

    // Hide skeleton
    if (skeleton) skeleton.hidden = true;

    if (!append && posts.length === 0) {
      empty.hidden = false;
      loading.hidden = true;
      heroSection.hidden = true;
      return;
    }

    let gridPosts = posts;

    // Render featured hero from first post (only on initial, unfiltered load)
    if (!append && !currentTag && posts.length > 0) {
      renderHero(posts[0]);
      gridPosts = posts.slice(1);
    } else if (!append) {
      heroSection.hidden = true;
    }

    const startIndex = append ? grid.children.length : 0;

    gridPosts.forEach((post, i) => {
      const card = createCard(post);
      // Scroll reveal with stagger
      if (revealObserver) {
        card.classList.add("reveal");
        card.style.transitionDelay = `${(startIndex + i) % 9 * 80}ms`;
        revealObserver.observe(card);
      }
      // 3D tilt + glare
      initCardGlare(card);
      grid.appendChild(card);
      (post.tags || []).forEach((t) => seenTags.add(t));
    });

    renderTags();
    pagination.hidden = !nextKey;
    isFirstLoad = false;
  } catch (err) {
    if (skeleton) skeleton.hidden = true;
    grid.innerHTML = `<p class="blog-error-msg">Failed to load posts. Please try again later.</p>`;
  } finally {
    loading.hidden = true;
  }
}

// ── Hero ──
function renderHero(post) {
  if (!heroSection) return;

  const isoDate = post.publishedAt || post.GSI1SK || post.createdAt || "";

  heroLink.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  heroTitle.textContent = post.title;
  heroExcerpt.textContent = post.excerpt || "";
  heroDate.textContent = formatDate(isoDate);
  if (isoDate) heroDate.setAttribute("datetime", isoDate);
  heroAuthor.textContent = post.author ? `by ${post.author}` : "";

  if (post.featuredImage) {
    heroImg.src = post.featuredImage;
    heroImg.alt = post.title;
  } else {
    heroImg.src = "";
    heroImg.alt = "";
  }

  // Tags
  heroTags.innerHTML = (post.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  heroSection.hidden = false;
}

// ── Card ──
function createCard(post) {
  const card = document.createElement("a");
  card.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  card.className = "blog-card card";

  const isoDate = post.publishedAt || post.GSI1SK || post.createdAt || "";
  const dateObj = isoDate ? new Date(isoDate) : null;
  const dateFormatted = formatDate(isoDate);
  const excerpt = post.excerpt || "";
  const tags = (post.tags || [])
    .map((t) => `<span class="tag tag--sm">${escapeHtml(t)}</span>`)
    .join("");

  const img = post.featuredImage
    ? `<div class="blog-card__img-wrap">
        <img class="blog-card__img" src="${escapeHtml(post.featuredImage)}" alt="${escapeHtml(post.title)}" width="640" height="360" loading="lazy">
        ${dateObj ? `<span class="blog-card__date-badge" aria-hidden="true">
          <span class="blog-card__date-badge-day">${dateObj.getDate()}</span>
          <span class="blog-card__date-badge-month">${dateObj.toLocaleString("en-US", { month: "short" })}</span>
        </span>` : ""}
      </div>`
    : "";

  card.innerHTML = `
    ${img}
    <div class="blog-card__body">
      <div class="blog-card__meta">
        <time class="blog-card__date">${dateFormatted}</time>
        ${post.author ? `<span class="blog-card__author">${escapeHtml(post.author)}</span>` : ""}
      </div>
      <h2 class="blog-card__title">${escapeHtml(post.title)}</h2>
      <p class="blog-card__excerpt">${escapeHtml(excerpt)}</p>
      ${tags ? `<div class="blog-card__tags">${tags}</div>` : ""}
      <span class="blog-card__read-more">Read more <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></span>
    </div>
  `;
  return card;
}

// ── Tag Filter ──
function renderTags() {
  if (seenTags.size === 0) return;
  tagsBar.hidden = false;

  const existing = new Set(
    [...tagsBar.querySelectorAll("[data-tag]")].map((b) => b.dataset.tag)
  );

  seenTags.forEach((tag) => {
    if (existing.has(tag)) return;
    const btn = document.createElement("button");
    btn.className = "tag";
    btn.dataset.tag = tag;
    btn.textContent = tag;
    btn.addEventListener("click", () => filterByTag(tag));
    tagsBar.appendChild(btn);
  });
}

function filterByTag(tag) {
  currentTag = tag;
  tagsBar.querySelectorAll(".tag").forEach((btn) => {
    btn.classList.toggle("tag--active", btn.dataset.tag === tag);
  });

  // Fade out existing cards before reload
  const cards = grid.querySelectorAll(".blog-card");
  if (cards.length > 0) {
    cards.forEach((c) => c.classList.add("blog-card--hiding"));
    setTimeout(() => loadPosts(), 280);
  } else {
    loadPosts();
  }
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
      window.gtag?.("event", "newsletter_signup", { form_type: "blog_subscribe" });
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
