// api.js — ES module, imported by main.js

const API_BASE = window.APP_CONFIG?.API_BASE_URL || "";

/**
 * Make a JSON API request with standard error handling.
 * @param {string} endpoint - Relative path (e.g., "/leads")
 * @param {object} options  - Fetch options (method, body, headers)
 * @returns {Promise<object>} Parsed JSON response
 * @throws {Error} On network failure or non-ok response
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  };

  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new Error("Network error: Unable to reach the server.");
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

export async function submitLead(data) {
  return apiRequest("/leads", { method: "POST", body: data });
}

/**
 * Fetch CMS content for a page slug.
 * Available for dynamic content loading — not used by the default static template.
 * @param {string} slug - Page identifier (e.g., "home")
 * @returns {Promise<object>} Content data
 */
export async function fetchContent(slug) {
  return apiRequest(`/content/${encodeURIComponent(slug)}`);
}

/**
 * Fetch published blog posts (paginated, optionally filtered by tag).
 * @param {object} params - Query params: { tag?, limit?, nextKey? }
 * @returns {Promise<object>} { ok, data: { posts, nextKey } }
 */
export async function getBlogPosts(params = {}) {
  const query = new URLSearchParams();
  if (params.tag) query.set("tag", params.tag);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return apiRequest(`/blog/posts${qs ? `?${qs}` : ""}`);
}

/**
 * Fetch a single blog post by slug.
 * @param {string} slug - Post URL slug
 * @returns {Promise<object>} { ok, data: { title, content, ... } }
 */
export async function getBlogPost(slug) {
  return apiRequest(`/blog/posts/${encodeURIComponent(slug)}`);
}
