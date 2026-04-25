// cookie-consent.js — ES module
//
// Multi-category consent gate. Categories: "analytics", "marketing",
// "functional". Functional is granted by default and cannot be revoked
// (mirrors GDPR "strictly necessary" — no opt-out for cookies a site
// genuinely needs to function). Analytics and marketing default to
// FALSE — no data collection until the user explicitly accepts.
//
// Storage (localStorage[storageKey], default "kore-cookie-consent"):
//   { version: 1, decisions: { analytics, marketing, functional }, decidedAt }
// Missing key = no decision yet → banner shows on first init().
//
// Legacy migration: a raw value of "accepted" or "declined" (the
// pre-multi-category schema gcoat shipped through 2026-04-25) is
// upgraded in place to the multi-category shape, preserving the user's
// analytics decision so returning visitors are not re-prompted.
//
// DNT honored: when navigator.doNotTrack === "1", hasConsent("analytics")
// and hasConsent("marketing") return false regardless of the stored
// decision. This gives analytics.js a single source-of-truth gate so
// it doesn't need to re-check DNT itself.
//
// Listener API:
//   on("granted" | "revoked", category, callback) → unsubscribe fn
// "granted" callbacks fire immediately at registration if the category
// is currently granted, so the order of on() vs init() doesn't matter
// for callers. Both fire on transitions thereafter.

export const CATEGORIES = Object.freeze(["analytics", "marketing", "functional"]);
const STORAGE_KEY_DEFAULT = "kore-cookie-consent";
const SCHEMA_VERSION = 1;

let storageKey = STORAGE_KEY_DEFAULT;
let decisions = { analytics: false, marketing: false, functional: true };
let decidedAt = null;
let initialized = false;
const listeners = { granted: new Map(), revoked: new Map() };

let banner = null;
let bannerTrigger = null;

function isDnt() {
  if (typeof navigator === "undefined") return false;
  return navigator.doNotTrack === "1" || window.doNotTrack === "1";
}

function migrateLegacy(raw) {
  // Pre-multi-category schema: a literal "accepted" or "declined" string.
  // Upgrade to the multi-category shape, preserving the analytics decision
  // so returning visitors keep their choice.
  if (raw !== "accepted" && raw !== "declined") return null;
  const analyticsGranted = raw === "accepted";
  return {
    version: SCHEMA_VERSION,
    decisions: {
      analytics: analyticsGranted,
      marketing: false,
      functional: true
    },
    decidedAt: new Date().toISOString()
  };
}

function readStorage() {
  let raw;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === SCHEMA_VERSION) return parsed;
    return null;
  } catch {
    const upgraded = migrateLegacy(raw);
    if (upgraded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(upgraded));
      } catch {
        /* Safari private mode etc. — keep in-memory decisions */
      }
      return upgraded;
    }
    return null;
  }
}

function writeStorage() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: SCHEMA_VERSION,
        decisions: { ...decisions },
        decidedAt
      })
    );
  } catch {
    /* Safari private mode etc. — stay in-memory; banner re-shows next visit */
  }
}

function ensureCategory(category) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`Unknown consent category: ${category}`);
  }
}

function emit(event, category) {
  const set = listeners[event].get(category);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(category);
    } catch (err) {
      console.error("cookie-consent listener error", err);
    }
  }
}

export function hasDecided() {
  return decidedAt !== null;
}

export function hasConsent(category) {
  ensureCategory(category);
  if ((category === "analytics" || category === "marketing") && isDnt()) {
    return false;
  }
  return Boolean(decisions[category]);
}

export function getAll() {
  return { ...decisions };
}

function markDecided() {
  decidedAt = new Date().toISOString();
  writeStorage();
}

function setCategory(category, value) {
  ensureCategory(category);
  if (category === "functional") return;
  if (decisions[category] === value) return;
  decisions[category] = value;
  markDecided();
  emit(value ? "granted" : "revoked", category);
}

export function grant(category) {
  setCategory(category, true);
}

export function revoke(category) {
  setCategory(category, false);
}

export function acceptAll() {
  for (const c of CATEGORIES) {
    if (c !== "functional") setCategory(c, true);
  }
  if (!hasDecided()) markDecided();
}

export function rejectAll() {
  for (const c of CATEGORIES) {
    if (c !== "functional") setCategory(c, false);
  }
  if (!hasDecided()) markDecided();
}

export function on(event, category, callback) {
  if (event !== "granted" && event !== "revoked") {
    throw new Error(`Unknown consent event: ${event}`);
  }
  ensureCategory(category);
  const map = listeners[event];
  if (!map.has(category)) map.set(category, new Set());
  map.get(category).add(callback);

  if (event === "granted" && hasConsent(category)) {
    try {
      callback(category);
    } catch (err) {
      console.error("cookie-consent listener error", err);
    }
  }

  return () => map.get(category)?.delete(callback);
}

function showBanner(trigger) {
  if (!banner) return;
  bannerTrigger = trigger || null;
  requestAnimationFrame(() => {
    banner.removeAttribute("hidden");
    requestAnimationFrame(() => {
      banner.classList.add("is-visible");
      const firstBtn = banner.querySelector("button");
      if (firstBtn) firstBtn.focus();
    });
  });
}

function hideBanner() {
  if (!banner) return;
  banner.classList.remove("is-visible");
  const restore = () => {
    banner.setAttribute("hidden", "");
    if (bannerTrigger && typeof bannerTrigger.focus === "function") {
      bannerTrigger.focus();
      bannerTrigger = null;
    }
  };
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    restore();
  } else {
    banner.addEventListener("transitionend", restore, { once: true });
  }
}

function wireBanner() {
  banner = document.getElementById("cookie-banner");
  if (!banner) return;

  const acceptBtn = banner.querySelector(".js-cookie-accept");
  const declineBtn = banner.querySelector(".js-cookie-decline");

  if (acceptBtn) {
    acceptBtn.addEventListener("click", () => {
      acceptAll();
      hideBanner();
    });
  }
  if (declineBtn) {
    declineBtn.addEventListener("click", () => {
      rejectAll();
      hideBanner();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !banner.hasAttribute("hidden")) {
      hideBanner();
    }
  });

  const manageLinks = document.querySelectorAll(".js-cookie-manage");
  manageLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      showBanner(link);
    });
  });
}

export function init(options = {}) {
  if (initialized) return;
  initialized = true;

  if (options.storageKey) storageKey = options.storageKey;

  const stored = readStorage();
  if (stored && stored.decisions) {
    for (const c of CATEGORIES) {
      if (typeof stored.decisions[c] === "boolean") {
        decisions[c] = stored.decisions[c];
      }
    }
    decidedAt = stored.decidedAt || null;
  }

  wireBanner();

  if (banner && !hasDecided() && options.autoShow !== false) {
    showBanner();
  }

  for (const c of CATEGORIES) {
    if (decisions[c] && (c === "functional" || hasConsent(c))) {
      emit("granted", c);
    }
  }
}

// Test-only hook: resets module state so each test starts clean.
// Not part of the public API; do not call from production code.
export function __resetForTest() {
  storageKey = STORAGE_KEY_DEFAULT;
  decisions = { analytics: false, marketing: false, functional: true };
  decidedAt = null;
  initialized = false;
  listeners.granted.clear();
  listeners.revoked.clear();
  banner = null;
  bannerTrigger = null;
}
