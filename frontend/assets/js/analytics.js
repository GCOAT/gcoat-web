// analytics.js — ES module
//
// GA4 loader gated by cookie-consent. The GA4 <script> is NEVER injected
// before consent is granted (reject = zero bytes from googletagmanager.com).
// Listens to consent.on("granted"|"revoked", "analytics", ...) so a user
// flipping their decision via the Manage Cookies banner enables/disables
// GA4 in real time without a page reload.
//
// Usage from consent-bootstrap.js:
//   import * as consent from "./cookie-consent.js";
//   import { setupAnalytics } from "./analytics.js";
//   setupAnalytics();
//   consent.init({ storageKey: "gcoat-cookie-consent" });
//
// Storage migration / DNT / on() ordering details live in cookie-consent.js;
// this module is purely a GA4 sink.

import * as consent from "./cookie-consent.js";

function isGa4FeatureOn() {
  const cfg = (typeof window !== "undefined" && window.APP_CONFIG) || null;
  if (!cfg) return true; // permissive default — older configs predate the flag
  return !cfg.FEATURES || cfg.FEATURES.ANALYTICS_GA4 !== false;
}

function getGa4Id() {
  // Read from APP_CONFIG.GA4.measurementId so deploy.sh / runtime detection
  // can override the property per environment without editing this file.
  // window.APP_CONFIG is set by config.js (classic script, runs before any
  // module). Returns null if missing.
  const cfg = (typeof window !== "undefined" && window.APP_CONFIG) || null;
  if (!cfg) return null;
  return (cfg.GA4 && cfg.GA4.measurementId) || null;
}

let ga4Loaded = false;

function loadGA4() {
  if (ga4Loaded) return;
  if (!isGa4FeatureOn()) return; // operator opted out — silent, expected
  const ga4Id = getGa4Id();
  if (!ga4Id) {
    console.warn("analytics.js: GA4 enabled by consent but no APP_CONFIG.GA4.measurementId — skipping load");
    return;
  }
  ga4Loaded = true;

  // Clear the kill switch in case disableGA4() ran earlier this session
  window["ga-disable-" + ga4Id] = false;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + ga4Id;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", ga4Id);
  window.gtag = gtag;
}

function disableGA4() {
  if (isGa4FeatureOn()) {
    const ga4Id = getGa4Id();
    if (ga4Id) {
      // GA4's built-in kill switch — prevents further data collection this session
      window["ga-disable-" + ga4Id] = true;
    }
  }

  // Delete GA cookies so no identifiers persist (cookies are property-agnostic)
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const name = cookie.split("=")[0].trim();
    if (name === "_ga" || name.indexOf("_ga_") === 0) {
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.hostname;
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  }
}

export function setupAnalytics() {
  consent.on("granted", "analytics", loadGA4);
  consent.on("revoked", "analytics", disableGA4);
}

// Test-only hook: resets module state for clean test runs
export function __resetForTest() {
  ga4Loaded = false;
}
