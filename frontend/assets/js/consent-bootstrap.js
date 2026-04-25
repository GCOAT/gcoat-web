// consent-bootstrap.js — wires cookie-consent + analytics on every public page.
//
// Loaded as <script type="module" src="assets/js/consent-bootstrap.js"> from
// each public HTML page. Kept as a tiny dedicated entry point so main.js
// (the core page-interaction module) stays unchanged and the consent flow
// keeps a clear, isolated lifecycle.
//
// Storage key stays "gcoat-cookie-consent" (Kore default is "kore-cookie-consent")
// so existing visitors do NOT lose their stored decision and are not re-prompted
// after the multi-category schema rollout. cookie-consent.js auto-migrates legacy
// "accepted" / "declined" string values to the multi-category shape on first read.

import * as consent from "./cookie-consent.js";
import { setupAnalytics } from "./analytics.js";

setupAnalytics();
consent.init({ storageKey: "gcoat-cookie-consent" });
