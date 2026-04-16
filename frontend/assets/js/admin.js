// admin.js — ES module for sidebar-navigated CMS dashboard (GCOAT)

const API_BASE = window.APP_CONFIG?.API_BASE_URL || "";
const FEATURES = window.APP_CONFIG?.FEATURES || {};

// ── DOM refs (auth) ──
const gate = document.getElementById("admin-gate");
const wrapper = document.getElementById("dashboard-wrapper");
const tokenInput = document.getElementById("admin-token");
const loginBtn = document.getElementById("admin-login-btn");

// ── DOM refs (sidebar + topbar) ──
const sidebar = document.getElementById("dashboard-sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const topbarTitle = document.getElementById("topbar-title");
const announceRegion = document.getElementById("dashboard-announce");

// ── DOM refs (overview) ──
const overviewStats = document.getElementById("overview-stats");
const activityList = document.getElementById("activity-list");

// ── DOM refs (leads) ──
const leadsTbody = document.getElementById("leads-tbody");
const leadsSearch = document.getElementById("leads-search");
const leadsSourceFilter = document.getElementById("leads-source-filter");
const leadsCountBadge = document.getElementById("leads-count-badge");
const leadModal = document.getElementById("lead-modal");
const leadModalTitle = document.getElementById("lead-modal-title");
const leadModalBody = document.getElementById("lead-modal-body");

// ── DOM refs (blog) ──
const blogTbody = document.getElementById("blog-posts-tbody");
const blogCountBadge = document.getElementById("blog-count-badge");
const listView = document.getElementById("blog-list-view");
const editorView = document.getElementById("blog-editor-view");
const editorHeading = document.getElementById("editor-heading");
const postForm = document.getElementById("post-form");
const btnNewPost = document.getElementById("btn-new-post");
const btnBackToList = document.getElementById("btn-back-to-list");
const btnSaveDraft = document.getElementById("btn-save-draft");
const btnPublish = document.getElementById("btn-publish");
const btnDelete = document.getElementById("btn-delete-post");
const fTitle = document.getElementById("post-title");
const fSlug = document.getElementById("post-slug");
const fExcerpt = document.getElementById("post-excerpt");
const fFeaturedImage = document.getElementById("post-featured-image");
const slugPreview = document.getElementById("slug-preview");
const imagePreview = document.getElementById("featured-image-preview");
const editorDirty = document.getElementById("editor-dirty");
const tagsContainer = document.getElementById("tags-container");
const tagsInput = document.getElementById("post-tags-input");

// ── DOM refs (media) ──
const mediaGrid = document.getElementById("media-grid");
const mediaFileInput = document.getElementById("media-file-input");
const mediaDropzone = document.getElementById("media-dropzone");
const uploadQueue = document.getElementById("upload-queue");
const mediaCountBadge = document.getElementById("media-count-badge");
const mediaTypeFilter = document.getElementById("media-type-filter");
const mediaSortSelect = document.getElementById("media-sort");

// ── State ──
let adminToken = sessionStorage.getItem("adminToken") || "";
let activeView = null;
let editingSlug = null;
let quill = null;
let allLeads = [];
let allPosts = [];
let allMedia = [];
let currentTags = [];
let leadsSortField = "date";
let leadsSortDir = "desc";
let leadsDateRange = "all";
let blogStatusFilter = "all";
let chartLeadsSource = null;
let chartLeadsTime = null;
let lastSavedState = null;
let modalTrigger = null;
let cachedDataReady = false;

// ── View Definitions ──
const VIEW_TITLES = {
  overview: "Overview",
  leads: "Leads",
  blog: "Blog",
  media: "Media",
};

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

if (adminToken) {
  showPanel();
} else {
  gate.hidden = false;
  wrapper.hidden = true;
}

const loginForm = document.getElementById("admin-auth");
const gateError = document.getElementById("admin-gate-error");
const gateCard = document.querySelector(".admin-gate__card");
const btnText = document.querySelector(".admin-gate__btn-text");
const btnSpinner = document.querySelector(".admin-gate__btn-spinner");

loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  handleLogin();
});

// Sidebar mobile toggle
sidebarToggle?.addEventListener("click", toggleSidebar);
sidebarBackdrop?.addEventListener("click", closeSidebar);

// Sidebar nav clicks
document.querySelectorAll(".js-nav-link").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// Hash-based navigation
window.addEventListener("hashchange", () => {
  const hash = location.hash.replace("#", "");
  if (hash && VIEW_TITLES[hash]) switchView(hash);
});

// Leads event listeners
leadsSearch?.addEventListener("input", filterLeads);
leadsSourceFilter?.addEventListener("change", filterLeads);
document.getElementById("btn-export-leads")?.addEventListener("click", exportLeadsCSV);

// Leads date range pills
document.querySelectorAll("#leads-date-filters .dashboard-pill-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#leads-date-filters .dashboard-pill-filter").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    leadsDateRange = btn.dataset.range;
    filterLeads();
  });
});

// Leads table sort
document.querySelectorAll("#leads-table th.is-sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const field = th.dataset.sort;
    if (leadsSortField === field) {
      leadsSortDir = leadsSortDir === "asc" ? "desc" : "asc";
    } else {
      leadsSortField = field;
      leadsSortDir = field === "date" ? "desc" : "asc";
    }
    // Update visual state
    document.querySelectorAll("#leads-table th.is-sortable").forEach((h) => {
      h.classList.remove("is-sorted-asc", "is-sorted-desc");
    });
    th.classList.add(leadsSortDir === "asc" ? "is-sorted-asc" : "is-sorted-desc");
    filterLeads();
  });
});

// Lead modal close
leadModal?.querySelectorAll("[data-close-modal]").forEach((el) => {
  el.addEventListener("click", closeLeadModal);
});
document.getElementById("modal-delete-lead")?.addEventListener("click", () => {
  const lead = leadModal._currentLead;
  if (lead) deleteLead(lead);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !leadModal.hidden) closeLeadModal();
  if (e.key === "Escape" && sidebar.classList.contains("is-open")) closeSidebar();
});

// Blog event listeners
btnNewPost?.addEventListener("click", showEditor);
btnBackToList?.addEventListener("click", showList);
btnSaveDraft?.addEventListener("click", (e) => {
  e.preventDefault();
  savePost("draft");
});
btnPublish?.addEventListener("click", () => savePost("published"));
btnDelete?.addEventListener("click", handleDelete);
fTitle?.addEventListener("input", () => {
  if (!editingSlug) {
    fSlug.value = autoSlug(fTitle.value);
  }
  updateSlugPreview();
  markDirty();
});
fSlug?.addEventListener("input", () => {
  updateSlugPreview();
  markDirty();
});
fExcerpt?.addEventListener("input", markDirty);
fFeaturedImage?.addEventListener("input", () => {
  updateImagePreview();
  markDirty();
});

// Blog status filter pills
document.querySelectorAll("#blog-status-filters .dashboard-pill-filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#blog-status-filters .dashboard-pill-filter").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    blogStatusFilter = btn.dataset.status;
    renderBlogPosts();
  });
});

// Tags input
tagsInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const tag = tagsInput.value.trim().toLowerCase().replace(/,/g, "");
    if (tag && !currentTags.includes(tag)) {
      currentTags.push(tag);
      renderTags();
      markDirty();
    }
    tagsInput.value = "";
  } else if (e.key === "Backspace" && !tagsInput.value && currentTags.length) {
    currentTags.pop();
    renderTags();
    markDirty();
  }
});
tagsContainer?.addEventListener("click", () => tagsInput?.focus());

// Media event listeners
mediaFileInput?.addEventListener("change", handleMediaUpload);
mediaDropzone?.addEventListener("click", () => mediaFileInput?.click());
mediaDropzone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  mediaDropzone.classList.add("is-dragover");
});
mediaDropzone?.addEventListener("dragleave", () => {
  mediaDropzone.classList.remove("is-dragover");
});
mediaDropzone?.addEventListener("drop", (e) => {
  e.preventDefault();
  mediaDropzone.classList.remove("is-dragover");
  if (e.dataTransfer.files.length) {
    mediaFileInput.files = e.dataTransfer.files;
    handleMediaUpload();
  }
});
mediaTypeFilter?.addEventListener("change", renderMedia);
mediaSortSelect?.addEventListener("change", renderMedia);

// Quick actions
document.getElementById("qa-new-post")?.addEventListener("click", () => {
  switchView("blog");
  setTimeout(showEditor, 100);
});
document.getElementById("qa-export-leads")?.addEventListener("click", () => {
  if (allLeads.length) exportLeadsCSV();
  else showToast("No leads data to export", "info");
});
document.getElementById("qa-upload-media")?.addEventListener("click", () => {
  switchView("media");
  setTimeout(() => mediaFileInput?.click(), 100);
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════

function handleLogin() {
  const token = tokenInput?.value?.trim();
  if (!token) {
    showGateError("Please enter your admin token");
    return;
  }
  // Show loading state
  loginBtn.disabled = true;
  if (btnText) btnText.textContent = "Signing in…";
  if (btnSpinner) btnSpinner.hidden = false;
  clearGateError();

  // Validate token by making a lightweight API call
  const url = `${API_BASE}/leads`;
  fetch(url, { headers: { "Content-Type": "application/json", "x-admin-token": token } })
    .then((resp) => {
      if (!resp.ok) throw new Error(resp.status);
      adminToken = token;
      sessionStorage.setItem("adminToken", token);
      showPanel();
    })
    .catch((err) => {
      const status = parseInt(err.message, 10);
      if (status === 401 || status === 403) {
        showGateError("Invalid token — please check and try again");
      } else if (!navigator.onLine || isNaN(status)) {
        showGateError("Can't reach the server — check your connection");
      } else {
        showGateError("Something went wrong — please try again");
      }
      loginBtn.disabled = false;
      if (btnText) btnText.textContent = "Sign In";
      if (btnSpinner) btnSpinner.hidden = true;
      // Shake card
      gateCard?.classList.remove("is-shake");
      void gateCard?.offsetWidth; // force reflow
      gateCard?.classList.add("is-shake");
      tokenInput?.focus();
    });
}

function showGateError(msg) {
  if (!gateError) return;
  gateError.textContent = msg;
  gateError.hidden = false;
  tokenInput?.classList.add("is-error");
}

function clearGateError() {
  if (gateError) gateError.hidden = true;
  tokenInput?.classList.remove("is-error");
}

function showPanel() {
  gate.hidden = true;
  wrapper.hidden = false;
  tokenInput.value = "";
  // Read hash or default to overview
  const hash = location.hash.replace("#", "");
  switchView(VIEW_TITLES[hash] ? hash : "overview");
  // Load all data
  if (!cachedDataReady) loadAllData();
}

document.getElementById("admin-logout")?.addEventListener("click", () => {
  sessionStorage.removeItem("adminToken");
  window.location.reload();
});

// ═══════════════════════════════════════════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════════════════════════════════════════

async function switchView(viewName) {
  if (activeView === viewName) return;

  // Guard against navigating away from unsaved editor
  if (activeView === "blog" && hasUnsavedChanges()) {
    const ok = await showConfirmModal({
      title: "Discard unsaved changes?",
      message: "You have unsaved changes in the editor. Leaving will discard them.",
      confirmText: "Discard",
      variant: "warning",
    });
    if (!ok) return;
    clearDirty();
  }

  activeView = viewName;

  // Update sidebar active state
  document.querySelectorAll(".js-nav-link").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === viewName);
  });

  // Fade transition between views
  const allViews = document.querySelectorAll(".dashboard-view");
  allViews.forEach((section) => {
    if (section.dataset.view === viewName) {
      section.classList.add("is-active");
      section.style.animation = "dashFadeSlideIn 0.25s ease-out both";
    } else {
      section.classList.remove("is-active");
      section.style.animation = "";
    }
  });

  // Update topbar title
  topbarTitle.textContent = VIEW_TITLES[viewName] || viewName;
  // Update hash
  history.replaceState(null, "", `#${viewName}`);
  // Announce for screen readers
  announce(`${VIEW_TITLES[viewName]} view`);
  // Close mobile sidebar
  closeSidebar();

  // Trigger view-specific actions
  if (viewName === "overview") renderOverview();
  if (viewName === "leads" && allLeads.length) filterLeads();
  if (viewName === "blog") onBlogActivate();
  if (viewName === "media" && allMedia.length) renderMedia();
}

function toggleSidebar() {
  sidebar.classList.toggle("is-open");
  sidebarBackdrop.classList.toggle("is-visible");
}

function getFriendlyError(err) {
  if (!navigator.onLine) return "You appear to be offline — check your connection and try again";
  const msg = err?.message || "";
  const status = parseInt(msg, 10);
  if (status === 401 || status === 403) return "Your session has expired — please sign in again";
  if (status >= 500) return "The server encountered an error — please try again shortly";
  if (status === 404) return "The requested resource was not found";
  if (status === 429) return "Too many requests — please wait a moment and retry";
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Can't reach the server — check your connection";
  return "Something went wrong — please try again";
}

function closeSidebar() {
  sidebar.classList.remove("is-open");
  sidebarBackdrop.classList.remove("is-visible");
}

function updateSidebarBadges() {
  const badges = {
    leads: { el: document.getElementById("nav-badge-leads"), count: allLeads.length },
    blog: { el: document.getElementById("nav-badge-blog"), count: allPosts.length },
    media: { el: document.getElementById("nav-badge-media"), count: allMedia.length },
  };
  Object.values(badges).forEach(({ el, count }) => {
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 99 ? "99+" : count;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  });
}

function announce(text) {
  if (announceRegion) announceRegion.textContent = text;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadAllData() {
  // Show skeleton states for all views
  renderStatSkeletons();
  renderTableSkeleton(leadsTbody, 6);
  renderTableSkeleton(blogTbody, 5);
  renderChartSkeletons();
  renderActivitySkeleton();
  renderMediaSkeleton();

  try {
    const [leadsResult, pubResult, draftsResult, mediaResult] = await Promise.all([
      FEATURES.CONTACT_FORM ? apiFetch("/leads") : Promise.resolve({ data: { leads: [] } }),
      FEATURES.BLOG ? apiFetch("/blog/posts?status=published&limit=50") : Promise.resolve({ data: { posts: [] } }),
      FEATURES.BLOG ? apiFetch("/blog/posts?status=draft&limit=50") : Promise.resolve({ data: { posts: [] } }),
      FEATURES.MEDIA ? apiFetch("/media/list") : Promise.resolve({ data: { files: [] } }),
    ]);

    allLeads = leadsResult.data?.leads || [];
    allLeads.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    allPosts = [...(pubResult.data?.posts || []), ...(draftsResult.data?.posts || [])];
    allPosts.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    allMedia = mediaResult.data?.files || [];

    cachedDataReady = true;

    // Populate source filter dropdown
    const sources = [...new Set(allLeads.map((l) => l.source).filter(Boolean))];
    if (leadsSourceFilter) {
      leadsSourceFilter.innerHTML = '<option value="">All sources</option>';
      sources.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        leadsSourceFilter.appendChild(opt);
      });
    }

    // Render current view
    renderOverview();
    updateSidebarBadges();
    if (activeView === "leads") filterLeads();
    if (activeView === "blog") renderBlogPosts();
    if (activeView === "media") renderMedia();
  } catch (err) {
    const friendlyMsg = getFriendlyError(err);
    showToast(friendlyMsg, "error");
    // Show inline error states in tables
    renderErrorState(leadsTbody, {
      icon: "error", title: "Couldn't load leads", message: friendlyMsg,
      btnText: "Retry", btnAction: loadAllData, isTableCell: true, colSpan: 6,
    });
    renderErrorState(blogTbody, {
      icon: "error", title: "Couldn't load posts", message: friendlyMsg,
      btnText: "Retry", btnAction: loadAllData, isTableCell: true, colSpan: 5,
    });
  }
}

// ── API helpers ──
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const { headers: optHeaders, ...rest } = options;
  const config = {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
      ...optHeaders,
    },
  };
  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }
  const resp = await fetch(url, config);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.message || `Request failed (${resp.status})`);
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW VIEW
// ═══════════════════════════════════════════════════════════════════════════

function renderStatSkeletons() {
  if (!overviewStats) return;
  overviewStats.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const div = document.createElement("div");
    div.className = "dashboard-skeleton dashboard-skeleton--stat";
    overviewStats.appendChild(div);
  }
}

function renderTableSkeleton(tbody, cols, rows = 5) {
  if (!tbody) return;
  tbody.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c++) {
      const td = document.createElement("td");
      const bar = document.createElement("div");
      bar.className = "dashboard-skeleton dashboard-skeleton--text";
      bar.style.width = `${50 + Math.random() * 40}%`;
      td.appendChild(bar);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

function renderChartSkeletons() {
  const charts = document.getElementById("overview-charts");
  if (!charts) return;
  charts.querySelectorAll(".dashboard-chart-card").forEach((card) => {
    const canvas = card.querySelector("canvas");
    if (canvas) canvas.style.display = "none";
    const existing = card.querySelector(".dashboard-skeleton");
    if (!existing) {
      const skel = document.createElement("div");
      skel.className = "dashboard-skeleton dashboard-skeleton--chart";
      card.appendChild(skel);
    }
  });
}

function removeChartSkeletons() {
  const charts = document.getElementById("overview-charts");
  if (!charts) return;
  charts.querySelectorAll(".dashboard-skeleton--chart").forEach((s) => s.remove());
  charts.querySelectorAll("canvas").forEach((c) => { c.style.display = ""; });
}

function renderActivitySkeleton() {
  if (!activityList) return;
  activityList.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const li = document.createElement("li");
    li.className = "dashboard-activity__item";
    li.innerHTML = `
      <span class="dashboard-skeleton dashboard-skeleton--circle"></span>
      <span class="dashboard-skeleton dashboard-skeleton--text" style="flex:1"></span>
      <span class="dashboard-skeleton dashboard-skeleton--text" style="width:48px"></span>
    `;
    activityList.appendChild(li);
  }
}

function renderMediaSkeleton() {
  if (!mediaGrid) return;
  mediaGrid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const div = document.createElement("div");
    div.className = "dashboard-skeleton dashboard-skeleton--media";
    mediaGrid.appendChild(div);
  }
}

function setButtonLoading(btn, loading, originalText) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="dashboard-btn__spinner"></span>' + (originalText || "");
    btn.classList.add("is-loading");
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || originalText || btn.textContent;
    btn.classList.remove("is-loading");
  }
}

function renderOverview() {
  renderGreeting();
  renderStatCards();
  renderCharts();
  renderActivityFeed();
}

function renderGreeting() {
  const greetingText = document.getElementById("greeting-text");
  const greetingDate = document.getElementById("greeting-date");
  if (!greetingText) return;
  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";
  greetingText.textContent = `${greeting} — here's your site at a glance`;
  if (greetingDate) {
    greetingDate.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }
}

function renderStatCards() {
  if (!overviewStats) return;
  const publishedCount = allPosts.filter((p) => (p.status || p.GSI1PK) === "published").length;
  const draftCount = allPosts.length - publishedCount;

  // Count leads this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const leadsThisMonth = allLeads.filter((l) => (l.createdAt || "") >= monthStart).length;

  const stats = [
    { label: "Total Leads", sub: leadsThisMonth ? `${leadsThisMonth} this month` : "all time", value: allLeads.length, icon: "leads", view: "leads" },
    { label: "Blog Posts", sub: draftCount ? `${draftCount} draft${draftCount !== 1 ? "s" : ""}` : "all published", value: allPosts.length, icon: "posts", view: "blog" },
    { label: "Published", sub: "live on site", value: publishedCount, icon: "published", view: "blog" },
    { label: "Media Files", sub: "uploaded", value: allMedia.length, icon: "media", view: "media" },
  ];

  overviewStats.innerHTML = "";
  stats.forEach((stat, index) => {
    const card = document.createElement("div");
    card.className = "dashboard-stat-card";
    card.style.setProperty("--stagger", index);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("click", () => switchView(stat.view));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        switchView(stat.view);
      }
    });

    const iconSvgs = {
      leads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      posts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      published: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    };

    const iconWrap = document.createElement("div");
    iconWrap.className = `dashboard-stat-card__icon dashboard-stat-card__icon--${stat.icon}`;
    iconWrap.innerHTML = iconSvgs[stat.icon];

    const info = document.createElement("div");
    info.className = "dashboard-stat-card__info";
    const valEl = document.createElement("span");
    valEl.className = "dashboard-stat-card__value";
    valEl.textContent = "0";
    animateCountUp(valEl, stat.value);
    const labelEl = document.createElement("span");
    labelEl.className = "dashboard-stat-card__label";
    labelEl.textContent = stat.label;
    const subEl = document.createElement("span");
    subEl.className = "dashboard-stat-card__sub";
    subEl.textContent = stat.sub;
    info.appendChild(valEl);
    info.appendChild(labelEl);
    info.appendChild(subEl);

    card.appendChild(iconWrap);
    card.appendChild(info);
    overviewStats.appendChild(card);
  });
}

function animateCountUp(el, target) {
  if (!el || target === 0) { el.textContent = "0"; return; }
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) { el.textContent = target.toLocaleString(); return; }
  const duration = 600;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderCharts() {
  removeChartSkeletons();
  if (typeof Chart === "undefined") return;

  // Leads by Source — Doughnut
  const sourceCanvas = document.getElementById("chart-leads-source");
  if (sourceCanvas && !allLeads.length) {
    const card = sourceCanvas.closest(".dashboard-chart-card");
    if (card) {
      sourceCanvas.style.display = "none";
      if (!card.querySelector(".dashboard-chart-nodata")) {
        const nd = document.createElement("div");
        nd.className = "dashboard-chart-nodata";
        nd.innerHTML = `<div class="dashboard-empty-state__icon">${EMPTY_ICONS.chart}</div><p>Not enough data to display</p>`;
        card.appendChild(nd);
      }
    }
  }
  const timeCanvas = document.getElementById("chart-leads-time");
  if (timeCanvas && !allLeads.length) {
    const card = timeCanvas.closest(".dashboard-chart-card");
    if (card) {
      timeCanvas.style.display = "none";
      if (!card.querySelector(".dashboard-chart-nodata")) {
        const nd = document.createElement("div");
        nd.className = "dashboard-chart-nodata";
        nd.innerHTML = `<div class="dashboard-empty-state__icon">${EMPTY_ICONS.chart}</div><p>Not enough data to display</p>`;
        card.appendChild(nd);
      }
    }
  }

  if (sourceCanvas && allLeads.length) {
    // Remove any no-data placeholder
    sourceCanvas.closest(".dashboard-chart-card")?.querySelector(".dashboard-chart-nodata")?.remove();
    sourceCanvas.style.display = "";
    const sourceCounts = {};
    allLeads.forEach((l) => {
      const src = l.source || "other";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    const sourceLabels = Object.keys(sourceCounts);
    const sourceData = Object.values(sourceCounts);
    const sourceColors = sourceLabels.map((s) => {
      const map = { intake: "#3b82f6", contact: "#22c55e", signup: "#f59e0b", "blog-subscribe": "#8b5cf6" };
      return map[s] || "#94a3b8";
    });

    if (chartLeadsSource) chartLeadsSource.destroy();
    chartLeadsSource = new Chart(sourceCanvas, {
      type: "doughnut",
      data: {
        labels: sourceLabels,
        datasets: [{
          data: sourceData,
          backgroundColor: sourceColors,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { padding: 16, usePointStyle: true } },
        },
      },
    });
  }

  // Leads over Time — Bar
  if (timeCanvas && allLeads.length) {
    timeCanvas.closest(".dashboard-chart-card")?.querySelector(".dashboard-chart-nodata")?.remove();
    timeCanvas.style.display = "";
    const monthCounts = {};
    allLeads.forEach((l) => {
      const month = (l.createdAt || "").slice(0, 7); // YYYY-MM
      if (month) monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

    const sortedMonths = Object.keys(monthCounts).sort();
    const last6 = sortedMonths.slice(-6);

    if (chartLeadsTime) chartLeadsTime.destroy();
    chartLeadsTime = new Chart(timeCanvas, {
      type: "bar",
      data: {
        labels: last6.map((m) => {
          const [y, mo] = m.split("-");
          return new Date(y, mo - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        }),
        datasets: [{
          label: "Leads",
          data: last6.map((m) => monthCounts[m]),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { grid: { display: false } },
        },
      },
    });
  }
}

function renderActivityFeed() {
  if (!activityList) return;
  activityList.innerHTML = "";

  const items = [];

  allLeads.slice(0, 5).forEach((lead) => {
    items.push({
      type: "lead",
      text: `${lead.name || lead.email} submitted via ${lead.source || "unknown"}`,
      date: lead.createdAt || "",
      data: lead,
    });
  });

  allPosts.slice(0, 5).forEach((post) => {
    items.push({
      type: "post",
      text: `${post.title} — ${post.status || "draft"}`,
      date: post.updatedAt || post.createdAt || "",
      data: post,
    });
  });

  items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const recent = items.slice(0, 8);

  if (recent.length === 0) {
    renderEmptyState(activityList, {
      icon: "activity", title: "All quiet for now",
      message: "Recent leads and posts will show here as they come in.",
    });
    return;
  }

  recent.forEach((item) => {
    const li = document.createElement("li");
    li.className = "dashboard-activity__item";

    const iconEl = document.createElement("span");
    iconEl.className = `dashboard-activity__icon dashboard-activity__icon--${item.type}`;
    iconEl.innerHTML = item.type === "lead"
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

    const textEl = document.createElement("span");
    textEl.className = "dashboard-activity__text";
    textEl.textContent = item.text;

    const timeEl = document.createElement("span");
    timeEl.className = "dashboard-activity__time";
    timeEl.textContent = relativeTime(item.date);

    li.appendChild(iconEl);
    li.appendChild(textEl);
    li.appendChild(timeEl);

    li.addEventListener("click", () => {
      if (item.type === "lead") {
        switchView("leads");
        setTimeout(() => showLeadDetail(item.data), 150);
      } else {
        switchView("blog");
        setTimeout(() => editPost(item.data.slug), 150);
      }
    });

    activityList.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADS VIEW
// ═══════════════════════════════════════════════════════════════════════════

async function loadLeadsList() {
  try {
    const result = await apiFetch("/leads");
    allLeads = result.data?.leads || [];
    allLeads.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    const sources = [...new Set(allLeads.map((l) => l.source).filter(Boolean))];
    if (leadsSourceFilter) {
      leadsSourceFilter.innerHTML = '<option value="">All sources</option>';
      sources.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        leadsSourceFilter.appendChild(opt);
      });
    }
    filterLeads();
  } catch (err) {
    renderErrorState(leadsTbody, {
      icon: "error", title: "Couldn't load leads", message: getFriendlyError(err),
      btnText: "Retry", btnAction: loadLeadsList, isTableCell: true, colSpan: 6,
    });
  }
}

function filterLeads() {
  const query = (leadsSearch?.value || "").toLowerCase();
  const source = leadsSourceFilter?.value || "";
  const now = Date.now();

  let filtered = allLeads.filter((lead) => {
    if (source && lead.source !== source) return false;
    if (query) {
      const haystack = `${lead.name || ""} ${lead.email || ""} ${lead.message || ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (leadsDateRange !== "all") {
      const days = parseInt(leadsDateRange, 10);
      const leadDate = new Date(lead.createdAt || 0).getTime();
      if (now - leadDate > days * 86400000) return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let va, vb;
    if (leadsSortField === "name") {
      va = (a.name || "").toLowerCase();
      vb = (b.name || "").toLowerCase();
    } else if (leadsSortField === "source") {
      va = (a.source || "").toLowerCase();
      vb = (b.source || "").toLowerCase();
    } else {
      va = a.createdAt || "";
      vb = b.createdAt || "";
    }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return leadsSortDir === "asc" ? cmp : -cmp;
  });

  if (leadsCountBadge) {
    leadsCountBadge.textContent = `Showing ${filtered.length} of ${allLeads.length}`;
  }

  renderLeads(filtered);
}

function renderLeads(leads) {
  if (leads.length === 0) {
    const query = (leadsSearch?.value || "").trim();
    if (query || leadsSourceFilter?.value || leadsDateRange !== "all") {
      renderEmptyState(leadsTbody, {
        icon: "search", title: "No results found",
        message: query ? `No leads matching "${query}"` : "No leads match the current filters",
        btnText: "Clear Filters", btnAction: () => { if (leadsSearch) leadsSearch.value = ""; if (leadsSourceFilter) leadsSourceFilter.value = ""; leadsDateRange = "all"; document.querySelectorAll("#leads-date-filters .dashboard-pill-filter").forEach((b,i) => b.classList.toggle("is-active", i === 0)); filterLeads(); },
        isTableCell: true, colSpan: 6,
      });
    } else {
      renderEmptyState(leadsTbody, {
        icon: "leads", title: "No leads yet",
        message: "When visitors fill out your intake form, their info will appear here.",
        btnText: "View Your Site", btnAction: () => window.open("./index.html", "_blank"),
        isTableCell: true, colSpan: 6,
      });
    }
    return;
  }

  leadsTbody.innerHTML = "";
  leads.forEach((lead) => {
    const tr = document.createElement("tr");
    tr.className = "dashboard-table__row--clickable";

    const tdName = document.createElement("td");
    tdName.textContent = lead.name || "—";

    const tdEmail = document.createElement("td");
    tdEmail.textContent = lead.email;

    const tdSource = document.createElement("td");
    const badge = document.createElement("span");
    const src = lead.source || "—";
    const srcClass = { intake: "intake", contact: "contact", signup: "signup" }[src] || "source";
    badge.className = `dashboard-badge dashboard-badge--${srcClass}`;
    badge.textContent = src;
    tdSource.appendChild(badge);

    const tdDate = document.createElement("td");
    tdDate.textContent = formatDate(lead.createdAt);
    tdDate.title = lead.createdAt || "";

    const tdMsg = document.createElement("td");
    tdMsg.className = "dashboard-table__msg-cell";
    const msgText = lead.message || "—";
    tdMsg.textContent = msgText.length > 60 ? msgText.slice(0, 60) + "…" : msgText;
    tdMsg.title = msgText;

    const tdActions = document.createElement("td");
    const viewBtn = document.createElement("button");
    viewBtn.className = "dashboard-btn dashboard-btn--sm";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showLeadDetail(lead, viewBtn);
    });
    const delBtn = document.createElement("button");
    delBtn.className = "dashboard-btn dashboard-btn--sm dashboard-btn--danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteLead(lead);
    });
    tdActions.appendChild(viewBtn);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdEmail);
    tr.appendChild(tdSource);
    tr.appendChild(tdDate);
    tr.appendChild(tdMsg);
    tr.appendChild(tdActions);

    tr.addEventListener("click", () => showLeadDetail(lead, tr));
    leadsTbody.appendChild(tr);
  });
}

function showLeadDetail(lead, triggerEl) {
  modalTrigger = triggerEl || null;
  leadModal._currentLead = lead;
  leadModalTitle.textContent = lead.name || lead.email;

  const sections = [
    {
      title: "Contact",
      fields: [
        ["Name", lead.name],
        ["Email", lead.email],
        ["Phone", lead.phone],
        ["Company", lead.companyName],
      ],
    },
    {
      title: "Project",
      fields: [
        ["Project Type", lead.projectType],
        ["Budget", lead.budgetRange],
        ["Timeline", lead.timeline],
        ["Source", lead.source],
        ["Date", lead.createdAt],
      ],
    },
    {
      title: "Additional",
      fields: [
        ["Features", lead.features],
        ["Existing Website", lead.existingWebsite],
        ["Inspiration", lead.inspirationLinks],
        ["Branding", lead.brandingStatus],
        ["Message", lead.message],
      ],
    },
  ];

  leadModalBody.innerHTML = "";
  sections.forEach((section) => {
    const filtered = section.fields.filter(([, v]) => v);
    if (filtered.length === 0) return;

    const heading = document.createElement("h4");
    heading.className = "dashboard-modal__section-title";
    heading.textContent = section.title;
    leadModalBody.appendChild(heading);

    const dl = document.createElement("dl");
    filtered.forEach(([label, val]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = Array.isArray(val) ? val.join(", ") : val;
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    leadModalBody.appendChild(dl);
  });

  leadModal.hidden = false;
  // Trap focus
  leadModal.querySelector(".dashboard-modal__close")?.focus();
}

function closeLeadModal() {
  leadModal.hidden = true;
  if (modalTrigger) {
    modalTrigger.focus();
    modalTrigger = null;
  }
}

async function deleteLead(lead) {
  const confirmed = await showConfirmModal({
    title: "Delete this lead?",
    message: `"${lead.name || lead.email}" will be permanently removed. This action cannot be undone.`,
    confirmText: "Delete Lead",
  });
  if (!confirmed) return;
  try {
    await apiFetch(`/leads/${encodeURIComponent(lead.sk)}`, { method: "DELETE" });
    allLeads = allLeads.filter((l) => l.sk !== lead.sk);
    filterLeads();
    closeLeadModal();
    renderOverview();
    updateSidebarBadges();
    showToast("Lead removed successfully", "success");
  } catch (err) {
    showToast(getFriendlyError(err), "error");
  }
}

function exportLeadsCSV() {
  const source = leadsSourceFilter?.value || "";
  const query = (leadsSearch?.value || "").toLowerCase();
  const filtered = allLeads.filter((lead) => {
    if (source && lead.source !== source) return false;
    if (query) {
      const haystack = `${lead.name || ""} ${lead.email || ""} ${lead.message || ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const headers = ["Name", "Email", "Source", "Date", "Message", "Phone", "Company"];
  const rows = filtered.map((l) => [
    l.name || "", l.email || "", l.source || "",
    (l.createdAt || "").split("T")[0], l.message || "",
    l.phone || "", l.companyName || "",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Leads exported to CSV", "success");
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOG VIEW
// ═══════════════════════════════════════════════════════════════════════════

function onBlogActivate() {
  initQuill();
  if (allPosts.length || cachedDataReady) {
    renderBlogPosts();
  } else {
    loadPostsList();
  }
}

function initQuill() {
  if (quill) return;
  quill = new Quill("#quill-editor", {
    theme: "snow",
    placeholder: "Write your post content here...",
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        ["blockquote", "code-block"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
    },
  });
  quill.on("text-change", markDirty);
}

async function loadPostsList() {
  try {
    const [pub, drafts] = await Promise.all([
      apiFetch("/blog/posts?status=published&limit=50"),
      apiFetch("/blog/posts?status=draft&limit=50"),
    ]);
    allPosts = [...(pub.data?.posts || []), ...(drafts.data?.posts || [])];
    allPosts.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    renderBlogPosts();
  } catch (err) {
    renderErrorState(blogTbody, {
      icon: "error", title: "Couldn't load posts", message: getFriendlyError(err),
      btnText: "Retry", btnAction: loadPostsList, isTableCell: true, colSpan: 5,
    });
  }
}

function renderBlogPosts() {
  let posts = allPosts;
  if (blogStatusFilter !== "all") {
    posts = allPosts.filter((p) => (p.status || p.GSI1PK || "draft") === blogStatusFilter);
  }

  if (blogCountBadge) {
    blogCountBadge.textContent = `${posts.length} post${posts.length !== 1 ? "s" : ""}`;
  }

  if (posts.length === 0) {
    if (blogStatusFilter !== "all") {
      renderEmptyState(blogTbody, {
        icon: "search", title: `No ${blogStatusFilter} posts`,
        message: `You don't have any ${blogStatusFilter} posts yet.`,
        isTableCell: true, colSpan: 5,
      });
    } else {
      renderEmptyState(blogTbody, {
        icon: "blog", title: "No posts yet",
        message: "Share your expertise — create your first blog post.",
        btnText: "Create Post", btnAction: showEditor,
        isTableCell: true, colSpan: 5,
      });
    }
    return;
  }

  blogTbody.innerHTML = "";
  posts.forEach((post) => {
    const tr = document.createElement("tr");
    const status = post.status || post.GSI1PK || "draft";
    const date = formatDate(post.updatedAt || post.createdAt);

    const tdTitle = document.createElement("td");
    tdTitle.textContent = post.title;

    const tdSlug = document.createElement("td");
    const code = document.createElement("code");
    code.textContent = post.slug;
    tdSlug.appendChild(code);

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `dashboard-badge dashboard-badge--${status}`;
    badge.textContent = status;
    tdStatus.appendChild(badge);

    const tdDate = document.createElement("td");
    tdDate.textContent = date;

    const tdActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "dashboard-btn dashboard-btn--sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editPost(post.slug));

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "dashboard-btn dashboard-btn--sm";
    toggleBtn.textContent = status === "published" ? "Unpublish" : "Publish";
    toggleBtn.addEventListener("click", () => quickToggleStatus(post));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(toggleBtn);

    tr.appendChild(tdTitle);
    tr.appendChild(tdSlug);
    tr.appendChild(tdStatus);
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);
    blogTbody.appendChild(tr);
  });
}

async function quickToggleStatus(post) {
  const newStatus = (post.status || post.GSI1PK) === "published" ? "draft" : "published";
  try {
    await apiFetch(`/blog/posts/${encodeURIComponent(post.slug)}`, {
      method: "PUT",
      body: { title: post.title, content: post.content || "", status: newStatus },
    });
    post.status = newStatus;
    renderBlogPosts();
    renderOverview();
    updateSidebarBadges();
    showToast(newStatus === "published" ? "Post published successfully" : "Post moved to drafts", "success");
  } catch (err) {
    showToast(getFriendlyError(err), "error");
  }
}

function showEditor() {
  editingSlug = null;
  editorHeading.textContent = "New Post";
  postForm.reset();
  quill.root.innerHTML = "";
  btnDelete.hidden = true;
  listView.hidden = true;
  editorView.hidden = false;
  currentTags = [];
  renderTags();
  updateSlugPreview();
  updateImagePreview();
  clearDirty();
  lastSavedState = getFormState();
}

async function showList() {
  if (hasUnsavedChanges()) {
    const ok = await showConfirmModal({
      title: "Discard unsaved changes?",
      message: "You have unsaved changes in the editor. Going back will discard them.",
      confirmText: "Discard",
      variant: "warning",
    });
    if (!ok) return;
  }
  clearDirty();
  editorView.hidden = true;
  listView.hidden = false;
  loadPostsList();
}

async function editPost(slug) {
  try {
    const result = await apiFetch(`/blog/posts/${encodeURIComponent(slug)}`);
    const post = result.data;

    editingSlug = slug;
    editorHeading.textContent = "Edit Post";
    fTitle.value = post.title || "";
    fSlug.value = post.slug || "";
    fExcerpt.value = post.excerpt || "";
    currentTags = (post.tags || []).slice();
    renderTags();
    fFeaturedImage.value = post.featuredImage || "";
    updateImagePreview();
    quill.root.innerHTML = post.content || "";
    btnDelete.hidden = false;

    btnPublish.textContent = post.status === "published" ? "Update & Publish" : "Publish";
    btnSaveDraft.textContent = post.status === "published" ? "Unpublish (Draft)" : "Save as Draft";

    listView.hidden = true;
    editorView.hidden = false;
    updateSlugPreview();
    lastSavedState = getFormState();
    clearDirty();
  } catch (err) {
    showToast("Couldn't load post — please try again", "error");
  }
}

async function savePost(status) {
  const title = fTitle.value.trim();
  const content = quill.root.innerHTML.trim();

  if (!title) {
    showToast("Please add a title before saving", "error");
    return;
  }
  if (!content || content === "<p><br></p>") {
    showToast("Please add some content before saving", "error");
    return;
  }

  const payload = {
    title,
    content,
    status,
    slug: fSlug.value.trim() || undefined,
    excerpt: fExcerpt.value.trim() || undefined,
    tags: currentTags.length ? currentTags : undefined,
    featuredImage: fFeaturedImage.value.trim() || undefined,
  };

  const actionBtn = status === "published" ? btnPublish : btnSaveDraft;
  setButtonLoading(actionBtn, true, status === "published" ? "Publishing…" : "Saving…");

  try {
    if (editingSlug) {
      await apiFetch(`/blog/posts/${encodeURIComponent(editingSlug)}`, {
        method: "PUT", body: payload,
      });
      if (payload.slug && payload.slug !== editingSlug) {
        editingSlug = payload.slug;
      }
    } else {
      const result = await apiFetch("/blog/posts", {
        method: "POST", body: payload,
      });
      editingSlug = result.data?.slug || payload.slug;
      editorHeading.textContent = `Editing: ${title}`;
      btnDelete.hidden = false;
    }
    lastSavedState = getFormState();
    showSavedIndicator();
    showToast(status === "published" ? "Post published successfully" : "Draft saved", "success");
    loadPostsList();
    renderOverview();
  } catch (err) {
    showToast(getFriendlyError(err), "error");
  } finally {
    setButtonLoading(actionBtn, false);
  }
}

async function handleDelete() {
  if (!editingSlug) return;
  const confirmed = await showConfirmModal({
    title: "Delete this post?",
    message: `"${fTitle.value}" will be permanently deleted. This action cannot be undone.`,
    confirmText: "Delete Post",
  });
  if (!confirmed) return;

  try {
    await apiFetch(`/blog/posts/${encodeURIComponent(editingSlug)}`, {
      method: "DELETE",
    });
    showToast("Post deleted successfully", "success");
    showList();
    renderOverview();
    updateSidebarBadges();
  } catch (err) {
    showToast(getFriendlyError(err), "error");
  }
}

// ── Tags ──
function renderTags() {
  // Remove existing tag elements
  tagsContainer?.querySelectorAll(".dashboard-tag").forEach((el) => el.remove());
  currentTags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "dashboard-tag";
    span.textContent = tag;
    const removeBtn = document.createElement("button");
    removeBtn.className = "dashboard-tag__remove";
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${tag}`);
    removeBtn.addEventListener("click", () => {
      currentTags = currentTags.filter((t) => t !== tag);
      renderTags();
      markDirty();
    });
    span.appendChild(removeBtn);
    tagsContainer?.insertBefore(span, tagsInput);
  });
}

// ── Slug preview ──
function updateSlugPreview() {
  if (!slugPreview) return;
  const slug = fSlug.value.trim() || autoSlug(fTitle?.value || "");
  slugPreview.textContent = slug ? `https://gcoat.io/post.html?slug=${slug}` : "";
}

// ── Image preview ──
function updateImagePreview() {
  if (!imagePreview) return;
  const url = fFeaturedImage?.value?.trim();
  if (url) {
    imagePreview.src = url;
    imagePreview.style.display = "block";
    imagePreview.onerror = () => { imagePreview.style.display = "none"; };
  } else {
    imagePreview.style.display = "none";
  }
}

// ── Dirty state tracking ──
function getFormState() {
  return JSON.stringify({
    title: fTitle?.value || "",
    slug: fSlug?.value || "",
    excerpt: fExcerpt?.value || "",
    tags: currentTags.slice(),
    image: fFeaturedImage?.value || "",
    content: quill?.root?.innerHTML || "",
  });
}

function markDirty() {
  if (!editorDirty || !lastSavedState) return;
  if (getFormState() !== lastSavedState) {
    editorDirty.textContent = "Unsaved changes";
    editorDirty.className = "dashboard-form__dirty-indicator dashboard-form__dirty-indicator--unsaved";
    editorDirty.hidden = false;
  } else {
    clearDirty();
  }
}

function showSavedIndicator() {
  if (!editorDirty) return;
  editorDirty.textContent = "Saved";
  editorDirty.className = "dashboard-form__dirty-indicator dashboard-form__dirty-indicator--saved";
  editorDirty.hidden = false;
  setTimeout(() => { editorDirty.hidden = true; }, 3000);
}

function clearDirty() {
  if (editorDirty) editorDirty.hidden = true;
}

function hasUnsavedChanges() {
  if (!lastSavedState || editorView?.hidden) return false;
  return getFormState() !== lastSavedState;
}

// Warn before leaving page with unsaved editor content
window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA VIEW
// ═══════════════════════════════════════════════════════════════════════════

async function loadMediaList() {
  try {
    const result = await apiFetch("/media/list");
    allMedia = result.data?.files || [];
    renderMedia();
  } catch (err) {
    renderErrorState(mediaGrid, {
      icon: "error", title: "Couldn't load media", message: getFriendlyError(err),
      btnText: "Retry", btnAction: loadMediaList,
    });
  }
}

function renderMedia() {
  let files = allMedia.slice();

  // Type filter
  const typeFilter = mediaTypeFilter?.value || "";
  if (typeFilter === "image") {
    files = files.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f.key));
  } else if (typeFilter === "audio") {
    files = files.filter((f) => /\.(mp3|wav|ogg|m4a)$/i.test(f.key));
  }

  // Sort
  const sortVal = mediaSortSelect?.value || "newest";
  if (sortVal === "oldest") {
    files.reverse();
  }

  if (mediaCountBadge) {
    mediaCountBadge.textContent = `${files.length} file${files.length !== 1 ? "s" : ""}`;
  }

  if (files.length === 0) {
    const typeFilter = mediaTypeFilter?.value || "";
    if (typeFilter) {
      renderEmptyState(mediaGrid, {
        icon: "search", title: `No ${typeFilter} files`,
        message: `No ${typeFilter} files match the current filter.`,
        btnText: "Show All", btnAction: () => { if (mediaTypeFilter) mediaTypeFilter.value = ""; renderMedia(); },
      });
    } else {
      renderEmptyState(mediaGrid, {
        icon: "media", title: "Your media library is empty",
        message: "Upload images and files to use in your blog posts and pages.",
        btnText: "Upload Files", btnAction: () => mediaFileInput?.click(),
      });
    }
    return;
  }

  mediaGrid.innerHTML = "";
  files.forEach((file) => {
    const card = document.createElement("div");
    card.className = "dashboard-media-card";

    const isImage = /\.(png|jpe?g|webp|gif)$/i.test(file.key);
    const ext = (file.key.split(".").pop() || "").toUpperCase();
    const publicUrl = file.url || "";

    // Type badge
    const typeBadge = document.createElement("span");
    typeBadge.className = "dashboard-media-card__type-badge";
    typeBadge.textContent = ext;
    card.appendChild(typeBadge);

    if (isImage) {
      const img = document.createElement("img");
      img.className = "dashboard-media-card__img";
      img.src = publicUrl;
      img.alt = file.key;
      img.loading = "lazy";
      card.appendChild(img);
    } else {
      const fileEl = document.createElement("div");
      fileEl.className = "dashboard-media-card__file";
      fileEl.textContent = file.key.split("/").pop();
      card.appendChild(fileEl);
    }

    const actions = document.createElement("div");
    actions.className = "dashboard-media-card__actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "dashboard-btn dashboard-btn--sm";
    copyBtn.textContent = "Copy URL";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(publicUrl).then(() => {
        showToast("URL copied to clipboard", "success");
      });
    });

    const delBtn = document.createElement("button");
    delBtn.className = "dashboard-btn dashboard-btn--sm dashboard-btn--danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteMedia(file.key));

    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);

    mediaGrid.appendChild(card);
  });
}

async function handleMediaUpload() {
  const files = mediaFileInput.files;
  if (!files || files.length === 0) return;

  uploadQueue.hidden = false;
  uploadQueue.innerHTML = "";

  const fileArr = Array.from(files);
  fileArr.forEach((file) => {
    const item = document.createElement("div");
    item.className = "dashboard-upload-item";
    item.id = `upload-${file.name.replace(/[^a-z0-9]/gi, "-")}`;

    const name = document.createElement("span");
    name.className = "dashboard-upload-item__name";
    name.textContent = file.name;

    const status = document.createElement("span");
    status.className = "dashboard-upload-item__status dashboard-upload-item__status--pending";
    status.textContent = "Pending";

    item.appendChild(name);
    item.appendChild(status);
    uploadQueue.appendChild(item);
  });

  for (const file of fileArr) {
    const itemId = `upload-${file.name.replace(/[^a-z0-9]/gi, "-")}`;
    const statusEl = document.getElementById(itemId)?.querySelector(".dashboard-upload-item__status");

    try {
      if (statusEl) {
        statusEl.textContent = "Uploading…";
        statusEl.className = "dashboard-upload-item__status dashboard-upload-item__status--pending";
      }

      const presignResult = await apiFetch("/media/presign", {
        method: "POST",
        body: { filename: file.name, contentType: file.type },
      });

      const { uploadUrl } = presignResult.data;
      const uploadResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResp.ok) throw new Error(`Upload failed (${uploadResp.status})`);

      if (statusEl) {
        statusEl.textContent = "✓ Done";
        statusEl.className = "dashboard-upload-item__status dashboard-upload-item__status--done";
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `✗ ${err.message}`;
        statusEl.className = "dashboard-upload-item__status dashboard-upload-item__status--fail";
      }
      showToast(`Upload failed for ${file.name}`, "error");
    }
  }

  showToast("Files uploaded successfully", "success");
  mediaFileInput.value = "";
  setTimeout(() => { uploadQueue.hidden = true; }, 3000);
  loadMediaList();
  renderOverview();
  updateSidebarBadges();
}

async function deleteMedia(key) {
  const fileName = key.split("/").pop();
  const confirmed = await showConfirmModal({
    title: "Delete this file?",
    message: `"${fileName}" will be permanently removed from your media library.`,
    confirmText: "Delete File",
  });
  if (!confirmed) return;
  try {
    await apiFetch(`/media/delete?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    allMedia = allMedia.filter((f) => f.key !== key);
    renderMedia();
    renderOverview();
    updateSidebarBadges();
    showToast("File removed from library", "success");
  } catch (err) {
    showToast(getFriendlyError(err), "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY STATES
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_ICONS = {
  leads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  blog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

function renderEmptyState(container, { icon, title, message, btnText, btnAction, isTableCell, colSpan }) {
  if (!container) return;
  if (isTableCell) {
    container.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colSpan || 6;
    td.innerHTML = `
      <div class="dashboard-empty-state">
        <div class="dashboard-empty-state__icon">${EMPTY_ICONS[icon] || EMPTY_ICONS.search}</div>
        <p class="dashboard-empty-state__title">${esc(title)}</p>
        <p class="dashboard-empty-state__message">${esc(message)}</p>
        ${btnText ? `<button class="dashboard-btn dashboard-btn--primary dashboard-btn--sm js-empty-cta" type="button">${esc(btnText)}</button>` : ""}
      </div>
    `;
    tr.appendChild(td);
    container.appendChild(tr);
    if (btnAction) td.querySelector(".js-empty-cta")?.addEventListener("click", btnAction);
    return;
  }
  container.innerHTML = `
    <div class="dashboard-empty-state">
      <div class="dashboard-empty-state__icon">${EMPTY_ICONS[icon] || EMPTY_ICONS.search}</div>
      <p class="dashboard-empty-state__title">${esc(title)}</p>
      <p class="dashboard-empty-state__message">${esc(message)}</p>
      ${btnText ? `<button class="dashboard-btn dashboard-btn--primary dashboard-btn--sm js-empty-cta" type="button">${esc(btnText)}</button>` : ""}
    </div>
  `;
  if (btnAction) container.querySelector(".js-empty-cta")?.addEventListener("click", btnAction);
}

function renderErrorState(container, { message, retryFn, isTableCell, colSpan }) {
  const title = "Something went wrong";
  if (!container) return;
  if (isTableCell) {
    container.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colSpan || 6;
    td.innerHTML = `
      <div class="dashboard-error-state">
        <div class="dashboard-error-state__icon">${EMPTY_ICONS.error}</div>
        <p class="dashboard-error-state__title">${esc(title)}</p>
        <p class="dashboard-error-state__message">${esc(message)}</p>
        ${retryFn ? '<button class="dashboard-btn dashboard-btn--sm js-retry-cta" type="button">Try Again</button>' : ""}
      </div>
    `;
    tr.appendChild(td);
    container.appendChild(tr);
    if (retryFn) td.querySelector(".js-retry-cta")?.addEventListener("click", retryFn);
    return;
  }
  container.innerHTML = `
    <div class="dashboard-error-state">
      <div class="dashboard-error-state__icon">${EMPTY_ICONS.error}</div>
      <p class="dashboard-error-state__title">${esc(title)}</p>
      <p class="dashboard-error-state__message">${esc(message)}</p>
      ${retryFn ? '<button class="dashboard-btn dashboard-btn--sm js-retry-cta" type="button">Try Again</button>' : ""}
    </div>
  `;
  if (retryFn) container.querySelector(".js-retry-cta")?.addEventListener("click", retryFn);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════════

const confirmModal = document.getElementById("confirm-modal");
const confirmIcon = document.getElementById("confirm-modal-icon");
const confirmTitle = document.getElementById("confirm-modal-title");
const confirmMsg = document.getElementById("confirm-modal-msg");
const confirmOk = document.getElementById("confirm-modal-ok");
const confirmCancel = document.getElementById("confirm-modal-cancel");

function showConfirmModal({ title, message, confirmText = "Delete", variant = "danger" }) {
  return new Promise((resolve) => {
    if (!confirmModal) { resolve(false); return; }
    const dangerSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    const warningSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    confirmIcon.innerHTML = variant === "danger" ? dangerSvg : warningSvg;
    confirmIcon.className = `dashboard-confirm-modal__icon dashboard-confirm-modal__icon--${variant}`;
    confirmTitle.textContent = title;
    confirmMsg.textContent = message;
    confirmOk.textContent = confirmText;
    confirmOk.className = variant === "danger" ? "dashboard-btn dashboard-btn--danger" : "dashboard-btn dashboard-btn--primary";
    confirmModal.hidden = false;
    confirmOk.focus();

    function cleanup(result) {
      confirmModal.hidden = true;
      confirmOk.removeEventListener("click", onOk);
      confirmCancel.removeEventListener("click", onCancel);
      confirmModal.querySelector(".dashboard-modal__backdrop")?.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onKey(e) { if (e.key === "Escape") onCancel(); }

    confirmOk.addEventListener("click", onOk);
    confirmCancel.addEventListener("click", onCancel);
    confirmModal.querySelector(".dashboard-modal__backdrop")?.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `dashboard-toast dashboard-toast--${type}`;

  const icons = { success: "✓", error: "✗", info: "ℹ" };
  const iconEl = document.createElement("span");
  iconEl.className = "dashboard-toast__icon";
  iconEl.textContent = icons[type] || "ℹ";

  const msgEl = document.createElement("span");
  msgEl.className = "dashboard-toast__message";
  msgEl.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "dashboard-toast__close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.addEventListener("click", () => dismissToast(toast));

  toast.appendChild(iconEl);
  toast.appendChild(msgEl);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  // Auto dismiss (success/info after 4s, errors stick)
  if (type !== "error") {
    setTimeout(() => dismissToast(toast), 4000);
  }
}

function dismissToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add("is-exiting");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    toast.remove();
  } else {
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function autoSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return dateStr.split("T")[0]; }
}

