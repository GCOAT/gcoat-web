// homepage-blog.js — loads featured blog posts on the homepage
// Synced with blog.js card structure (Phase 4)

import { getBlogPosts } from "./api.js";

const grid = document.getElementById("home-blog-grid");
const empty = document.getElementById("home-blog-empty");

if (grid) loadFeaturedPosts();

async function loadFeaturedPosts() {
  try {
    const result = await getBlogPosts({ tag: "featured", limit: 3 });
    const posts = result.data?.posts || [];

    if (posts.length === 0) {
      empty.hidden = false;
      return;
    }

    posts.forEach((post) => {
      const card = createCard(post);
      initCardGlare(card);
      grid.appendChild(card);
    });
  } catch {
    // Silently degrade — homepage still works without blog posts
  }
}

// Lightweight 3D tilt + glare for dynamically appended cards
function initCardGlare(card) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

function createCard(post) {
  const card = document.createElement("a");
  card.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  card.className = "blog-card card";

  const isoDate = post.publishedAt || post.GSI1SK || post.createdAt || "";
  const dateObj = isoDate ? new Date(isoDate) : null;
  const dateFormatted = formatDate(isoDate);
  const excerpt = post.excerpt || "";
  const tags = (post.tags || [])
    .slice(0, 2)
    .map((t) => `<span class="tag tag--sm">${esc(t)}</span>`)
    .join("");

  const img = post.featuredImage
    ? `<div class="blog-card__img-wrap">
        <img class="blog-card__img" src="${esc(post.featuredImage)}" alt="" width="640" height="360" loading="lazy">
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
        ${post.author ? `<span class="blog-card__author">${esc(post.author)}</span>` : ""}
      </div>
      <h3 class="blog-card__title">${esc(post.title)}</h3>
      <p class="blog-card__excerpt">${esc(excerpt)}</p>
      ${tags ? `<div class="blog-card__tags">${tags}</div>` : ""}
      <span class="blog-card__read-more">Read more <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></span>
    </div>
  `;
  return card;
}

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

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}
