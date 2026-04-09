// admin.js — ES module for admin.html blog management

const API_BASE = window.APP_CONFIG?.API_BASE_URL || "";

// ── DOM refs ──
const authSection = document.getElementById("admin-auth");
const gate = document.getElementById("admin-gate");
const panel = document.getElementById("admin-panel");
const tokenInput = document.getElementById("admin-token");
const loginBtn = document.getElementById("admin-login-btn");
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

// Form fields
const fTitle = document.getElementById("post-title");
const fSlug = document.getElementById("post-slug");
const fExcerpt = document.getElementById("post-excerpt");
const fTags = document.getElementById("post-tags");
const fFeaturedImage = document.getElementById("post-featured-image");

let adminToken = sessionStorage.getItem("adminToken") || "";
let editingSlug = null; // null = new post, string = editing existing
let quill = null;

// ── Init ──
if (adminToken) {
  showPanel();
}

loginBtn?.addEventListener("click", handleLogin);
tokenInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});
btnNewPost?.addEventListener("click", showEditor);
btnBackToList?.addEventListener("click", showList);
btnSaveDraft?.addEventListener("click", (e) => {
  e.preventDefault();
  savePost("draft");
});
btnPublish?.addEventListener("click", () => savePost("published"));
btnDelete?.addEventListener("click", handleDelete);

// Auto-slug from title
fTitle?.addEventListener("input", () => {
  if (!editingSlug) {
    fSlug.value = autoSlug(fTitle.value);
  }
});

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
  initQuill();
  loadPostsList();
}

// ── Quill editor ──
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

// ── List View ──
async function loadPostsList() {
  tbody.innerHTML = `<tr><td colspan="5" class="admin-table__empty">Loading&hellip;</td></tr>`;

  try {
    // Load published + drafts
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

// ── Editor ──
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

    // Set publish button text based on current status
    btnPublish.textContent = post.status === "published" ? "Update & Publish" : "Publish";
    btnSaveDraft.textContent = post.status === "published" ? "Unpublish (Draft)" : "Save as Draft";

    listView.hidden = true;
    editorView.hidden = false;
    editorStatus.hidden = true;
  } catch (err) {
    showStatusMsg("error", `Failed to load post: ${err.message}`);
  }
}

async function savePost(status) {
  const title = fTitle.value.trim();
  const content = quill.root.innerHTML.trim();

  if (!title) {
    showStatusMsg("error", "Title is required.");
    return;
  }
  if (!content || content === "<p><br></p>") {
    showStatusMsg("error", "Content is required.");
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
      showStatusMsg("success", `Post ${status === "published" ? "published" : "saved as draft"}.`);
      // Update editingSlug if slug changed
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
      showStatusMsg("success", `Post created as ${status}.`);
    }
  } catch (err) {
    showStatusMsg("error", err.message);
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
    showStatusMsg("error", `Delete failed: ${err.message}`);
  }
}

// ── Helpers ──
function showStatusMsg(type, message) {
  editorStatus.textContent = message;
  editorStatus.className = `form-status form-status--${type}`;
  editorStatus.hidden = false;
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
