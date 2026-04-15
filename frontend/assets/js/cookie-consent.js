/**
 * Cookie Consent Banner
 *
 * - GA4 scripts are NOT in the HTML — they are injected here only after consent.
 * - Stores preference in localStorage: "accepted" | "declined".
 * - If no preference is stored, the banner is shown on first visit.
 * - "Manage Cookies" footer link re-opens the banner so users can change their mind.
 * - Respects Do Not Track: if enabled, GA4 is never loaded (treated as declined).
 * - On revocation (accepted → declined): disables GA4 property, clears GA cookies.
 */

var STORAGE_KEY = "gcoat-cookie-consent";
var GA4_ID = "G-QX6KHWBC4N";

/* ── Safe localStorage wrapper (Safari private mode throws) ── */
function getConsent() {
  try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
}
function setConsent(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* silent */ }
}

/* ── GA4 loader ── */
var ga4Loaded = false;

function loadGA4() {
  if (ga4Loaded) return;
  ga4Loaded = true;

  // Remove the disable flag if it was previously set
  window["ga-disable-" + GA4_ID] = false;

  var script = document.createElement("script");
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
  var cookies = document.cookie.split(";");
  for (var i = 0; i < cookies.length; i++) {
    var name = cookies[i].split("=")[0].trim();
    if (name === "_ga" || name.indexOf("_ga_") === 0) {
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + location.hostname;
      document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  }
}

/* ── Banner show / hide ── */
var focusTrigger = null;

function showBanner(banner, trigger) {
  focusTrigger = trigger || null;
  requestAnimationFrame(function () {
    banner.removeAttribute("hidden");
    requestAnimationFrame(function () {
      banner.classList.add("is-visible");
      // Move focus into the banner for accessibility
      var firstBtn = banner.querySelector("button");
      if (firstBtn) firstBtn.focus();
    });
  });
}

function hideBanner(banner) {
  banner.classList.remove("is-visible");
  banner.addEventListener("transitionend", function () {
    banner.setAttribute("hidden", "");
    // Return focus to the element that opened the banner
    if (focusTrigger && typeof focusTrigger.focus === "function") {
      focusTrigger.focus();
      focusTrigger = null;
    }
  }, { once: true });

  // If reduced motion is on, transitionend won't fire reliably
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    banner.setAttribute("hidden", "");
    if (focusTrigger && typeof focusTrigger.focus === "function") {
      focusTrigger.focus();
      focusTrigger = null;
    }
  }
}

/* ── Init ── */
function init() {
  var consent = getConsent();
  var dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1";

  // If previously accepted and DNT is not set, load GA4 immediately
  if (consent === "accepted" && !dnt) {
    loadGA4();
  }

  var banner = document.getElementById("cookie-banner");
  if (!banner) return;

  // Always wire up Accept / Decline (needed for "Manage Cookies" re-open flow)
  var acceptBtn = banner.querySelector(".js-cookie-accept");
  var declineBtn = banner.querySelector(".js-cookie-decline");

  if (acceptBtn) {
    acceptBtn.addEventListener("click", function () {
      setConsent("accepted");
      hideBanner(banner);
      if (!dnt) loadGA4();
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener("click", function () {
      setConsent("declined");
      hideBanner(banner);
      disableGA4();
    });
  }

  // Escape key dismisses the banner (standard dialog UX)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !banner.hasAttribute("hidden")) {
      hideBanner(banner);
    }
  });

  // Wire up all "Manage Cookies" footer links (re-opens banner)
  var manageLinks = document.querySelectorAll(".js-cookie-manage");
  for (var i = 0; i < manageLinks.length; i++) {
    (function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        showBanner(banner, link);
      });
    })(manageLinks[i]);
  }

  // First visit — no consent recorded, show banner automatically
  if (!consent) {
    showBanner(banner);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
