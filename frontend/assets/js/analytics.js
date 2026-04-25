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

// gcoat's GA4 measurement ID. Sync Checkpoint 2 will move this to
// APP_CONFIG.GA4.measurementId so deploy.sh can override per environment.
const GA4_ID = "G-QX6KHWBC4N";

let ga4Loaded = false;

function loadGA4() {
  if (ga4Loaded) return;
  ga4Loaded = true;

  // Clear the kill switch in case disableGA4() ran earlier this session
  window["ga-disable-" + GA4_ID] = false;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", GA4_ID);
  window.gtag = gtag;
}

function disableGA4() {
  // GA4's built-in kill switch — prevents further data collection this session
  window["ga-disable-" + GA4_ID] = true;

  // Delete GA cookies so no identifiers persist
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
