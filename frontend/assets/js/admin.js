// admin.js — ES module for multi-tab CMS dashboard (GCOAT)

const API_BASE = window.APP_CONFIG?.API_BASE_URL || "";
const FEATURES = window.APP_CONFIG?.FEATURES || {};

// ── DOM refs (auth) ──
const authSection = document.getElementById("admin-auth");
const gate = document.getElementById("admin-gate");
const panel = document.getElementById("admin-panel");
const tokenInput = document.getElementById("admin-token");
const loginBtn = document.getElementById("admin-login-btn");
const tablist = document.getElementById("admin-tablist");

// ── DOM refs (blog) ──
const tbody = document.getElementById("blog-posts-tbody");
const listView = document.getElementById("blog-list-view");
const editorView = document.getElementById("blog-editor-view");
const editorHeading = document.getElementById("editor-heading");
const postForm = document.getElementById("post-form");
const btnNewPost = document.getElementById("btn-new-post");
const btnBackToList = document.getElementById("btn-back-to-list");
const btnSaveDraft = document.getElementById("btn-save-draft");
const btnPublish = document.getElementById("btn-publish");
const btnDelete = document.getElementById("btn-delete-post");
const editorStatus = document.getElementById("editor-status");
const fTitle = document.getElementById("post-title");
const fSlug = document.getElementById("post-slug");
const fExcerpt = document.getElementById("post-excerpt");
const fTags = document.getElementById("post-tags");
const fFeaturedImage = document.getElementById("post-featured-image");

// ── DOM refs (leads) ──
const leadsTbody = document.getElementById("leads-tbody");
const leadsSearch = document.getElementById("leads-search");
const leadsSourceFilter = document.getElementById("leads-source-filter");
const btnExportLeads = document.getElementById("btn-export-leads");
const leadDetail = document.getElementById("lead-detail");
const leadDetailTitle = document.getElementById("lead-detail-title");
const leadDetailBody = document.getElementById("lead-detail-body");

// ── DOM refs (media) ──
const mediaGrid = document.getElementById("media-grid");
const mediaFileInput = document.getElementById("media-file-input");
const mediaUploadStatus = document.getElementById("media-upload-status");

let adminToken = sessionStorage.getItem("adminToken") || "";
let editingSlug = null;
let quill = null;
let allLeads = [];
let activeTab = null;

// ── Tab System ──
const TAB_DEFS = [
  { id: "leads", label: "Leads", feature: "CONTACT_FORM", onActivate: loadLeadsList },
  { id: "blog", label: "Blog", feature: "BLOG", onActivate: onBlogActivate },
  { id: "media", label: "Media", feature: "MEDIA", onActivate: loadMediaList },
];

function buildTabs() {
  const enabledTabs = TAB_DEFS.filter(t => FEATURES[t.feature]);
  tablist.innerHTML = "";
  enabledTabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.className = "admin-tab";
    btn.role = "tab";
    btn.id = `tab-${tab.id}`;
    btn.setAttribute("aria-controls", `panel-${tab.id}`);
    btn.setAttribute("aria-selected", "false");
    btn.textContent = tab.label;
    btn.addEventListener("click", () => switchTab(tab.id));
    tablist.appendChild(btn);
  });
  // Hide panels for disabled features
  TAB_DEFS.forEach(t => {
    const section = document.getElementById(`panel-${t.id}`);
    if (section && !FEATURES[t.feature]) {
      section.remove();
    }
  });
  if (enabledTabs.length > 0) {
    switchTab(enabledTabs[0].id);
  }
}

function switchTab(tabId) {
  if (activeTab === tabId) return;
  activeTab = tabId;

  tablist.querySelectorAll(".admin-tab").forEach(btn => {
    const isActive = btn.id === `tab-${tabId}`;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll(".admin-panel-section").forEach(section => {
    section.hidden = section.id !== `panel-${tabId}`;
  });

  const def = TAB_DEFS.find(t => t.id === tabId);
  if (def?.onActivate) def.onActivate();
}

// ── Init ──
if (adminToken) {
  showPanel();
}

loginBtn?.addEventListener("click", handleLogin);
tokenInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
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
});

// Leads event listeners
leadsSearch?.addEventListener("input", filterLeads);
leadsSourceFilter?.addEventListener("change", filterLeads);
btnExportLeads?.addEventListener("click", exportLeadsCSV);
document.getElementById("btn-close-lead-detail")?.addEventListener("click", () => {
  leadDetail.hidden = true;
});

// Media event listeners
mediaFileInput?.addEventListener("change", handleMediaUpload);

// ── Auth ──
function handleLogin() {
  const token = tokenInput?.value?.trim();
  if (!token) return;
  adminToken = token;
  sessionStorage.setItem("adminToken", token);
  showPanel();
}

function showPanel() {
  gate.hidden = true;
  panel.hidden = false;
  tokenInput.value = "";
  authSection.innerHTML = `<button class="btn" id="admin-logout">Logout</button>`;
  document.getElementById("admin-logout")?.addEventListener("click", () => {
    sessionStorage.removeItem("adminToken");
    window.location.reload();
  });
  buildTabs();
}

// ── API helpers ──
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
      ...options.headers,
    },
    ...options,
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
// LEADS TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadLeadsList() {
  leadsTbody.innerHTML = `<tr><td colspan="6" class="admin-table__empty">Loading&hellip;</td></tr>`;

  try {
    const result = await apiFetch("/leads");
    allLeads = result.data?.leads || [];
    allLeads.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    // Populate source filter dropdown
    const sources = [...new Set(allLeads.map(l => l.source).filter(Boolean))];
    leadsSourceFilter.innerHTML = `<option value="">All sources</option>`;
    sources.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      leadsSourceFilter.appendChild(opt);
    });

    renderLeads(allLeads);
  } catch (err) {
    leadsTbody.innerHTML = `<tr><td colspan="6" class="admin-table__empty">Failed to load: ${esc(err.message)}</td></tr>`;
  }
}

function filterLeads() {
  const query = (leadsSearch?.value || "").toLowerCase();
  const source = leadsSourceFilter?.value || "";
  const filtered = allLeads.filter(lead => {
    if (source && lead.source !== source) return false;
    if (query) {
      const haystack = `${lead.name || ""} ${lead.email || ""} ${lead.message || ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  renderLeads(filtered);
}

function renderLeads(leads) {
  if (leads.length === 0) {
    leadsTbody.innerHTML = `<tr><td colspan="6" class="admin-table__empty">No leads found.</td></tr>`;
    return;
  }

  leadsTbody.innerHTML = "";
  leads.forEach(lead => {
    const tr = document.createElement("tr");
    tr.className = "admin-table__row--clickable";
    const date = (lead.createdAt || "").split("T")[0];
    const msgPreview = (lead.message || "").slice(0, 60) + ((lead.message || "").length > 60 ? "…" : "");
    tr.innerHTML = `
      <td>${esc(lead.name || "—")}</td>
      <td>${esc(lead.email)}</td>
      <td><span class="admin-badge admin-badge--source">${esc(lead.source || "—")}</span></td>
      <td>${date}</td>
      <td>${esc(msgPreview || "—")}</td>
      <td>
        <button class="btn btn--sm" data-action="view">View</button>
        <button class="btn btn--sm" data-action="delete" style="color:var(--color-error)">Del</button>
      </td>
    `;
    tr.querySelector("[data-action='view']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      showLeadDetail(lead);
    });
    tr.querySelector("[data-action='delete']")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteLead(lead);
    });
    tr.addEventListener("click", () => showLeadDetail(lead));
    leadsTbody.appendChild(tr);
  });
}

function showLeadDetail(lead) {
  leadDetailTitle.textContent = lead.name || lead.email;
  const fields = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Source", lead.source],
    ["Date", lead.createdAt],
    ["Phone", lead.phone],
    ["Company", lead.companyName],
    ["Project Type", lead.projectType],
    ["Budget", lead.budgetRange],
    ["Timeline", lead.timeline],
    ["Existing Website", lead.existingWebsite],
    ["Inspiration", lead.inspirationLinks],
    ["Branding", lead.brandingStatus],
    ["Message", lead.message],
  ].filter(([, v]) => v);

  leadDetailBody.innerHTML = fields.map(([label, val]) =>
    `<div class="admin-detail__row">
      <span class="admin-detail__label">${esc(label)}</span>
      <span class="admin-detail__value">${esc(val)}</span>
    </div>`
  ).join("");
  leadDetail.hidden = false;
}

async function deleteLead(lead) {
  if (!confirm(`Delete lead "${lead.name || lead.email}"?`)) return;
  try {
    await apiFetch(`/leads/${encodeURIComponent(lead.sk)}`, { method: "DELETE" });
    allLeads = allLeads.filter(l => l.sk !== lead.sk);
    filterLeads();
    leadDetail.hidden = true;
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

function exportLeadsCSV() {
  const source = leadsSourceFilter?.value || "";
  const query = (leadsSearch?.value || "").toLowerCase();
  const filtered = allLeads.filter(lead => {
    if (source && lead.source !== source) return false;
    if (query) {
      const haystack = `${lead.name || ""} ${lead.email || ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const headers = ["Name", "Email", "Source", "Date", "Message", "Phone", "Company"];
  const rows = filtered.map(l => [
    l.name || "", l.email || "", l.source || "",
    (l.createdAt || "").split("T")[0], l.message || "",
    l.phone || "", l.companyName || "",
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOG TAB
// ═══════════════════════════════════════════════════════════════════════════

function onBlogActivate() {
  initQuill();
  loadPostsList();
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
}

async function loadPostsList() {
  tbody.innerHTML = `<tr><td colspan="5" class="admin-table__empty">Loading&hellip;</td></tr>`;

  try {
    const [pub, drafts] = await Promise.all([
      apiFetch("/blog/posts?status=published&limit=50"),
      apiFetch("/blog/posts?status=draft&limit=50"),
    ]);
    const posts = [...(pub.data?.posts || []), ...(drafts.data?.posts || [])];
    posts.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

    if (posts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-table__empty">No posts yet. Create your first post!</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    posts.forEach((post) => {
      const tr = document.createElement("tr");
      const status = post.status || post.GSI1PK || "unknown";
      const date = (post.updatedAt || post.createdAt || "").split("T")[0];
      tr.innerHTML = `
        <td>${esc(post.title)}</td>
        <td><code>${esc(post.slug)}</code></td>
        <td><span class="admin-badge admin-badge--${status}">${status}</span></td>
        <td>${date}</td>
        <td>
          <button class="btn btn--sm" data-action="edit" data-slug="${esc(post.slug)}">Edit</button>
        </td>
      `;
      tr.querySelector("[data-action='edit']")?.addEventListener("click", () => {
        editPost(post.slug);
      });
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-table__empty">Failed to load: ${esc(err.message)}</td></tr>`;
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
  editorStatus.hidden = true;
}

function showList() {
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
    fTags.value = (post.tags || []).join(", ");
    fFeaturedImage.value = post.featuredImage || "";
    quill.root.innerHTML = post.content || "";
    btnDelete.hidden = false;

    btnPublish.textContent = post.status === "published" ? "Update & Publish" : "Publish";
    btnSaveDraft.textContent = post.status === "published" ? "Unpublish (Draft)" : "Save as Draft";

    listView.hidden = true;
    editorView.hidden = false;
    editorStatus.hidden = true;
  } catch (err) {
    showStatusMsg(editorStatus, "error", `Failed to load post: ${err.message}`);
  }
}

async function savePost(status) {
  const title = fTitle.value.trim();
  const content = quill.root.innerHTML.trim();

  if (!title) {
    showStatusMsg(editorStatus, "error", "Title is required.");
    return;
  }
  if (!content || content === "<p><br></p>") {
    showStatusMsg(editorStatus, "error", "Content is required.");
    return;
  }

  const payload = {
    title,
    content,
    status,
    slug: fSlug.value.trim() || undefined,
    excerpt: fExcerpt.value.trim() || undefined,
    tags: fTags.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) || undefined,
    featuredImage: fFeaturedImage.value.trim() || undefined,
  };

  try {
    if (editingSlug) {
      await apiFetch(`/blog/posts/${encodeURIComponent(editingSlug)}`, {
        method: "PUT", body: payload,
      });
      showStatusMsg(editorStatus, "success", `Post ${status === "published" ? "published" : "saved as draft"}.`);
      if (payload.slug && payload.slug !== editingSlug) {
        editingSlug = payload.slug;
      }
    } else {
      const result = await apiFetch("/blog/posts", {
        method: "POST", body: payload,
      });
      editingSlug = result.data?.slug || payload.slug;
      editorHeading.textContent = "Edit Post";
      btnDelete.hidden = false;
      showStatusMsg(editorStatus, "success", `Post created as ${status}.`);
    }
  } catch (err) {
    showStatusMsg(editorStatus, "error", err.message);
  }
}

async function handleDelete() {
  if (!editingSlug) return;
  if (!confirm(`Delete "${fTitle.value}"? This cannot be undone.`)) return;

  try {
    await apiFetch(`/blog/posts/${encodeURIComponent(editingSlug)}`, {
      method: "DELETE",
    });
    showList();
  } catch (err) {
    showStatusMsg(editorStatus, "error", `Delete failed: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA TAB
// ═══════════════════════════════════════════════════════════════════════════

async function loadMediaList() {
  mediaGrid.innerHTML = `<p class="admin-table__empty">Loading&hellip;</p>`;

  try {
    const result = await apiFetch("/media/list");
    const files = result.data?.files || [];

    if (files.length === 0) {
      mediaGrid.innerHTML = `<p class="admin-table__empty">No media uploaded yet.</p>`;
      return;
    }

    mediaGrid.innerHTML = "";
    files.forEach(file => {
      const card = document.createElement("div");
      card.className = "admin-media-card";

      const isImage = /\.(png|jpe?g|webp|gif)$/i.test(file.key);
      const publicUrl = file.url || "";

      card.innerHTML = `
        ${isImage
          ? `<img class="admin-media-card__img" src="${esc(publicUrl)}" alt="${esc(file.key)}" loading="lazy">`
          : `<div class="admin-media-card__file">${esc(file.key.split("/").pop())}</div>`
        }
        <div class="admin-media-card__actions">
          <button class="btn btn--sm" data-action="copy" title="Copy URL">Copy URL</button>
          <button class="btn btn--sm" data-action="delete" title="Delete" style="color:var(--color-error)">Del</button>
        </div>
      `;

      card.querySelector("[data-action='copy']")?.addEventListener("click", () => {
        navigator.clipboard.writeText(publicUrl).then(() => {
          showStatusMsg(mediaUploadStatus, "success", "URL copied!");
          setTimeout(() => { mediaUploadStatus.hidden = true; }, 2000);
        });
      });

      card.querySelector("[data-action='delete']")?.addEventListener("click", () => {
        deleteMedia(file.key);
      });

      mediaGrid.appendChild(card);
    });
  } catch (err) {
    mediaGrid.innerHTML = `<p class="admin-table__empty">Failed to load: ${esc(err.message)}</p>`;
  }
}

async function handleMediaUpload() {
  const files = mediaFileInput.files;
  if (!files || files.length === 0) return;

  showStatusMsg(mediaUploadStatus, "success", `Uploading ${files.length} file(s)…`);

  for (const file of files) {
    try {
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
    } catch (err) {
      showStatusMsg(mediaUploadStatus, "error", `Failed to upload ${file.name}: ${err.message}`);
      return;
    }
  }

  showStatusMsg(mediaUploadStatus, "success", "Upload complete!");
  mediaFileInput.value = "";
  setTimeout(() => { mediaUploadStatus.hidden = true; }, 2000);
  loadMediaList();
}

async function deleteMedia(key) {
  if (!confirm(`Delete "${key.split("/").pop()}"?`)) return;
  try {
    await apiFetch("/media/delete", {
      method: "DELETE",
      body: { key },
    });
    loadMediaList();
  } catch (err) {
    showStatusMsg(mediaUploadStatus, "error", `Delete failed: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function showStatusMsg(el, type, message) {
  if (!el) return;
  el.textContent = message;
  el.className = `form-status form-status--${type}`;
  el.hidden = false;
}

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
