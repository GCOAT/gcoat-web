/**
 * Automated tests for cookie-consent.js + analytics.js
 * Run with: node frontend/tests/test-cookie-consent.js
 *
 * Simulates a minimal DOM + localStorage to exercise every code path
 * without needing a real browser or external dependencies.
 *
 * Strategy: read each ES module's source, strip the `export ` /
 * `import ` keywords with a small regex transform, then eval the
 * source inside a sandbox built from the mock DOM. Keeps the existing
 * test ergonomics (no test framework, no transpiler) while letting the
 * production code ship as a real ES module.
 */

var fs = require("fs");
var path = require("path");

var passed = 0;
var failed = 0;
var tests = [];

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || "") + " — expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}

/* ── Minimal DOM simulation ── */
function createMockDOM() {
  var storage = {};
  var elements = {};
  var docListeners = {};
  var headAppended = [];
  var focusedElement = null;

  function makeElement(id, classes) {
    var cls = (classes || "").split(" ");
    var elListeners = {};
    var attrs = {};
    if (id) attrs.id = id;
    var el = {
      id: id || "",
      classList: {
        add: function (c) { cls.push(c); },
        remove: function (c) { cls = cls.filter(function (x) { return x !== c; }); },
        contains: function (c) { return cls.indexOf(c) !== -1; }
      },
      _classes: cls,
      setAttribute: function (k, v) { attrs[k] = v; },
      getAttribute: function (k) { return attrs[k] || null; },
      removeAttribute: function (k) { delete attrs[k]; },
      hasAttribute: function (k) { return k in attrs; },
      addEventListener: function (evt, fn, opts) {
        if (!elListeners[evt]) elListeners[evt] = [];
        elListeners[evt].push({ fn: fn, once: opts && opts.once });
      },
      dispatchEvent: function (evt) {
        var handlers = elListeners[evt] || [];
        var remaining = [];
        var fakeEvent = { preventDefault: function () {} };
        handlers.forEach(function (h) {
          h.fn(fakeEvent);
          if (!h.once) remaining.push(h);
        });
        elListeners[evt] = remaining;
      },
      focus: function () { focusedElement = el; },
      _attrs: attrs,
      _elListeners: elListeners
    };
    return el;
  }

  var banner = makeElement("cookie-banner", "cookie-banner");
  banner.setAttribute("hidden", "");
  var acceptBtn = makeElement(null, "cookie-banner__accept js-cookie-accept");
  acceptBtn.tagName = "BUTTON";
  var declineBtn = makeElement(null, "cookie-banner__decline js-cookie-decline");
  declineBtn.tagName = "BUTTON";
  var manageBtn = makeElement(null, "footer__cookie-manage js-cookie-manage");

  elements["js-cookie-accept"] = acceptBtn;
  elements["js-cookie-decline"] = declineBtn;
  elements["js-cookie-manage"] = manageBtn;
  elements["cookie-banner"] = banner;

  banner.querySelector = function (sel) {
    var key = sel.replace(".", "");
    if (key === "js-cookie-accept") return acceptBtn;
    if (key === "js-cookie-decline") return declineBtn;
    if (key === "button") return acceptBtn;
    return null;
  };

  var mockDoc = {
    readyState: "complete",
    getElementById: function (id) {
      if (id === "cookie-banner") return banner;
      return null;
    },
    querySelector: function (sel) {
      var key = sel.replace(".", "");
      return elements[key] || null;
    },
    querySelectorAll: function (sel) {
      var key = sel.replace(".", "");
      var results = [];
      Object.keys(elements).forEach(function (k) {
        if (k === key || k.indexOf(key) !== -1) results.push(elements[k]);
      });
      // Crude: js-cookie-manage matches just the manage button
      if (key === "js-cookie-manage") return [manageBtn];
      return results;
    },
    addEventListener: function (evt, fn) {
      if (!docListeners[evt]) docListeners[evt] = [];
      docListeners[evt].push(fn);
    },
    createElement: function (tag) {
      return makeElement(null, "");
    },
    cookie: ""
  };

  var mockHead = {
    appendChild: function (el) { headAppended.push(el); }
  };

  return {
    document: mockDoc,
    docListeners: docListeners,
    banner: banner,
    acceptBtn: acceptBtn,
    declineBtn: declineBtn,
    manageBtn: manageBtn,
    headAppended: headAppended,
    storage: storage,
    getFocused: function () { return focusedElement; },
    resetFocus: function () { focusedElement = null; },
    head: mockHead
  };
}

function loadModules(mock, options) {
  options = options || {};
  var consentSrc = fs.readFileSync(
    path.join(__dirname, "..", "assets", "js", "cookie-consent.js"),
    "utf8"
  );
  var analyticsSrc = fs.readFileSync(
    path.join(__dirname, "..", "assets", "js", "analytics.js"),
    "utf8"
  );

  // Strip ESM keywords so the source can be eval'd in a function scope.
  // The transformations are intentionally narrow (cover the exact syntax
  // used in our two modules) so they cannot leak surprises.
  function transform(src) {
    return src
      .replace(/^export\s+const\s+/gm, "const ")
      .replace(/^export\s+function\s+/gm, "function ")
      .replace(/^import\s+\*\s+as\s+\w+\s+from\s+["'][^"']+["'];?\s*$/gm, "")
      .replace(/^import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?\s*$/gm, "");
  }

  // Build APP_CONFIG. Defaults match production gcoat config; options can
  // override individual fields (or omit GA4/FEATURES.ANALYTICS_GA4 entirely
  // to exercise the missing-id / feature-flag-off branches in analytics.js).
  var appConfig;
  if (options.appConfig === null) {
    appConfig = null;
  } else if (options.appConfig) {
    appConfig = options.appConfig;
  } else {
    appConfig = {
      FEATURES: { ANALYTICS_GA4: true },
      GA4: { measurementId: "G-QX6KHWBC4N" }
    };
  }

  var sandbox = {
    document: mock.document,
    window: {
      dataLayer: [],
      matchMedia: function () { return { matches: false }; },
      doNotTrack: options.dnt ? "1" : undefined,
      gtag: undefined,
      APP_CONFIG: appConfig
    },
    navigator: { doNotTrack: options.dnt ? "1" : undefined },
    location: { hostname: "localhost" },
    localStorage: options.brokenStorage
      ? {
          getItem: function () { throw new Error("SecurityError"); },
          setItem: function () { throw new Error("SecurityError"); },
          removeItem: function () { throw new Error("SecurityError"); }
        }
      : {
          _store: mock.storage,
          getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; },
          setItem: function (k, v) { this._store[k] = String(v); },
          removeItem: function (k) { delete this._store[k]; }
        },
    requestAnimationFrame: function (fn) { fn(); },
    console: console
  };
  sandbox.document.head = mock.head;

  // Wrap consent module — return its exports object so analytics module can
  // reference them via the closure variable `consent`.
  var consentWrapped =
    "(function(" + Object.keys(sandbox).join(",") + ") {\n" +
    transform(consentSrc) +
    "\nreturn { CATEGORIES: CATEGORIES, hasDecided: hasDecided, hasConsent: hasConsent, getAll: getAll, grant: grant, revoke: revoke, acceptAll: acceptAll, rejectAll: rejectAll, on: on, init: init, __resetForTest: __resetForTest };\n})";
  var consentFn = eval(consentWrapped);
  var consent = consentFn.apply(null, Object.keys(sandbox).map(function (k) { return sandbox[k]; }));

  // Wrap analytics module — its `import * as consent` was stripped, so
  // inject the live `consent` object into its sandbox.
  var analyticsKeys = Object.keys(sandbox).concat(["consent"]);
  var analyticsVals = Object.keys(sandbox).map(function (k) { return sandbox[k]; }).concat([consent]);
  var analyticsWrapped =
    "(function(" + analyticsKeys.join(",") + ") {\n" +
    transform(analyticsSrc) +
    "\nreturn { setupAnalytics: setupAnalytics, __resetForTest: __resetForTest };\n})";
  var analyticsFn = eval(analyticsWrapped);
  var analytics = analyticsFn.apply(null, analyticsVals);

  return { consent: consent, analytics: analytics, sandbox: sandbox };
}

function bootstrap(mock, options) {
  // Mirror consent-bootstrap.js: setupAnalytics() then consent.init({ storageKey })
  options = options || {};
  var modules = loadModules(mock, options);
  modules.analytics.setupAnalytics();
  modules.consent.init({ storageKey: "gcoat-cookie-consent" });
  return modules;
}

function readStored(mock) {
  var raw = mock.storage["gcoat-cookie-consent"];
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return raw; }
}

/* ════════════════════════════════════════════════════════════════
   TESTS — module behavior (1:1 coverage of the legacy suite)
   ════════════════════════════════════════════════════════════════ */

test("First visit: banner shown when no consent stored", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  assert(!mock.banner.hasAttribute("hidden"), "Banner should not have hidden attribute");
  assert(mock.banner.classList.contains("is-visible"), "Banner should have is-visible class");
});

test("First visit: Accept stores multi-cat decision and injects GA4", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  mock.acceptBtn.dispatchEvent("click");
  var decision = readStored(mock);
  assert(decision && decision.version === 1, "Should be schema version 1");
  assertEqual(decision.decisions.analytics, true, "Analytics should be granted");
  assert(mock.headAppended.length > 0, "GA4 script should be injected into head");
});

test("First visit: Decline stores rejected decision and does NOT inject GA4", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  mock.declineBtn.dispatchEvent("click");
  var decision = readStored(mock);
  assertEqual(decision.decisions.analytics, false, "Analytics should be rejected");
  assertEqual(mock.headAppended.length, 0, "No GA4 script should be injected");
});

test("Return visit (accepted): GA4 loads immediately, no banner", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = JSON.stringify({
    version: 1,
    decisions: { analytics: true, marketing: false, functional: true },
    decidedAt: "2026-04-25T00:00:00.000Z"
  });
  bootstrap(mock);
  assert(mock.headAppended.length > 0, "GA4 should load on init");
  assert(mock.banner.hasAttribute("hidden"), "Banner should remain hidden");
});

test("Return visit (declined): no GA4, no banner", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = JSON.stringify({
    version: 1,
    decisions: { analytics: false, marketing: false, functional: true },
    decidedAt: "2026-04-25T00:00:00.000Z"
  });
  bootstrap(mock);
  assertEqual(mock.headAppended.length, 0, "GA4 should NOT load");
  assert(mock.banner.hasAttribute("hidden"), "Banner should remain hidden");
});

test("Manage Cookies re-opens banner after prior consent", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = JSON.stringify({
    version: 1,
    decisions: { analytics: true, marketing: false, functional: true },
    decidedAt: "2026-04-25T00:00:00.000Z"
  });
  bootstrap(mock);
  assert(mock.banner.hasAttribute("hidden"), "Banner should be hidden initially");
  mock.manageBtn.dispatchEvent("click");
  assert(!mock.banner.hasAttribute("hidden"), "Banner should be visible after Manage click");
});

test("Accept then Manage then Decline: GA4 disabled (kill switch + cookies)", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  mock.acceptBtn.dispatchEvent("click");
  assertEqual(readStored(mock).decisions.analytics, true);
  mock.manageBtn.dispatchEvent("click");
  mock.declineBtn.dispatchEvent("click");
  assertEqual(readStored(mock).decisions.analytics, false, "Should flip to declined");
});

test("Buttons work after Manage Cookies re-open (legacy bug-fix verification)", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = JSON.stringify({
    version: 1,
    decisions: { analytics: false, marketing: false, functional: true },
    decidedAt: "2026-04-25T00:00:00.000Z"
  });
  bootstrap(mock);
  mock.manageBtn.dispatchEvent("click");
  assert(!mock.banner.hasAttribute("hidden"), "Banner should be visible");
  mock.acceptBtn.dispatchEvent("click");
  assertEqual(readStored(mock).decisions.analytics, true, "Accept should work after re-open");
  assert(mock.headAppended.length > 0, "GA4 should load after re-open accept");
});

test("DNT=1: GA4 never loads even if accepted", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = JSON.stringify({
    version: 1,
    decisions: { analytics: true, marketing: false, functional: true },
    decidedAt: "2026-04-25T00:00:00.000Z"
  });
  bootstrap(mock, { dnt: true });
  assertEqual(mock.headAppended.length, 0, "GA4 should NOT load when DNT=1");
});

test("Escape key dismisses visible banner", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  assert(!mock.banner.hasAttribute("hidden"), "Banner should be visible on first visit");
  var keydownHandlers = mock.docListeners["keydown"] || [];
  assert(keydownHandlers.length > 0, "Should have a keydown listener");
  keydownHandlers[0]({ key: "Escape" });
  mock.banner.dispatchEvent("transitionend");
  assert(mock.banner.hasAttribute("hidden"), "Banner should be hidden after Escape");
});

test("Focus moves to Accept button when banner opens", function () {
  var mock = createMockDOM();
  mock.resetFocus();
  bootstrap(mock);
  assertEqual(mock.getFocused(), mock.acceptBtn, "Focus should be on Accept button");
});

test("localStorage error does not crash (Safari private mode)", function () {
  var mock = createMockDOM();
  bootstrap(mock, { brokenStorage: true });
  assert(!mock.banner.hasAttribute("hidden"), "Banner should show even with broken localStorage");
  mock.acceptBtn.dispatchEvent("click");
  assert(true, "No crash on accept with broken localStorage");
});

test("GA4 loaded only once (idempotent across re-grants)", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  mock.acceptBtn.dispatchEvent("click");
  var count1 = mock.headAppended.length;
  // Toggle decline → accept again; GA4 should NOT inject a second <script>
  mock.manageBtn.dispatchEvent("click");
  mock.declineBtn.dispatchEvent("click");
  mock.manageBtn.dispatchEvent("click");
  mock.acceptBtn.dispatchEvent("click");
  assertEqual(mock.headAppended.length, count1, "GA4 should not be injected twice");
});

/* ── New tests for the multi-category schema + legacy migration ── */

test("Legacy migration: 'accepted' string upgrades to multi-cat preserving GA4", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = "accepted";
  bootstrap(mock);
  var decision = readStored(mock);
  assert(decision && decision.version === 1, "Should be upgraded to schema version 1");
  assertEqual(decision.decisions.analytics, true, "Analytics decision should be preserved as granted");
  assertEqual(decision.decisions.functional, true, "Functional should default to true");
  assert(mock.headAppended.length > 0, "GA4 should load (preserved consent)");
  assert(mock.banner.hasAttribute("hidden"), "Banner should remain hidden (decision preserved)");
});

test("Legacy migration: 'declined' string upgrades to multi-cat preserving rejection", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = "declined";
  bootstrap(mock);
  var decision = readStored(mock);
  assert(decision && decision.version === 1, "Should be upgraded to schema version 1");
  assertEqual(decision.decisions.analytics, false, "Analytics decision should stay rejected");
  assertEqual(mock.headAppended.length, 0, "GA4 should NOT load");
  assert(mock.banner.hasAttribute("hidden"), "Banner should remain hidden (decision preserved)");
});

test("Storage key override: writes to gcoat-cookie-consent (not Kore default)", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  mock.acceptBtn.dispatchEvent("click");
  assert(mock.storage["gcoat-cookie-consent"], "Should write to gcoat-cookie-consent");
  assert(!mock.storage["kore-cookie-consent"], "Should NOT write to kore-cookie-consent");
});

/* ── Tests for APP_CONFIG.GA4.measurementId (sync checkpoint item 2) ── */

test("GA4 ID read from APP_CONFIG.GA4.measurementId (default config)", function () {
  var mock = createMockDOM();
  bootstrap(mock);
  mock.acceptBtn.dispatchEvent("click");
  assert(mock.headAppended.length > 0, "GA4 script should be injected");
  var script = mock.headAppended[0];
  assert(
    script.src && script.src.indexOf("id=G-QX6KHWBC4N") !== -1,
    "Script src should include the configured GA4 id (got: " + JSON.stringify(script.src) + ")"
  );
});

test("GA4 ID custom override via APP_CONFIG", function () {
  var mock = createMockDOM();
  bootstrap(mock, {
    appConfig: {
      FEATURES: { ANALYTICS_GA4: true },
      GA4: { measurementId: "G-TESTOVERRIDE" }
    }
  });
  mock.acceptBtn.dispatchEvent("click");
  assert(mock.headAppended.length > 0, "GA4 script should be injected");
  var src = mock.headAppended[0].src;
  assert(
    src && src.indexOf("id=G-TESTOVERRIDE") !== -1,
    "Script src should reflect the overridden measurementId (got: " + JSON.stringify(src) + ")"
  );
});

test("GA4 missing measurementId: consent grants but no script injected", function () {
  var mock = createMockDOM();
  bootstrap(mock, {
    appConfig: { FEATURES: { ANALYTICS_GA4: true } } // no GA4.measurementId
  });
  mock.acceptBtn.dispatchEvent("click");
  var decision = readStored(mock);
  assertEqual(decision.decisions.analytics, true, "Decision should record granted");
  assertEqual(mock.headAppended.length, 0, "GA4 script must NOT be injected without an id");
});

test("FEATURES.ANALYTICS_GA4 = false: GA4 not loaded even if consent accepted", function () {
  var mock = createMockDOM();
  bootstrap(mock, {
    appConfig: {
      FEATURES: { ANALYTICS_GA4: false },
      GA4: { measurementId: "G-QX6KHWBC4N" }
    }
  });
  mock.acceptBtn.dispatchEvent("click");
  assertEqual(mock.headAppended.length, 0, "GA4 must NOT load when feature flag is off");
});

/* ── Run all tests ── */
console.log("\n  Cookie Consent — Automated Tests\n  " + "═".repeat(40) + "\n");
tests.forEach(function (t) {
  try {
    t.fn();
    passed++;
    console.log("  ✓ " + t.name);
  } catch (e) {
    failed++;
    console.log("  ✗ " + t.name);
    console.log("    " + e.message);
  }
});

console.log("\n  " + "─".repeat(40));
console.log("  " + passed + " passed, " + failed + " failed\n");

/* ════════════════════════════════════════════════════════════════
   HTML STRUCTURAL VALIDATION — parses real HTML files
   ════════════════════════════════════════════════════════════════ */

var frontendDir = path.join(__dirname, "..");
var htmlTests = [];
var htmlPassed = 0;
var htmlFailed = 0;

function htmlTest(name, fn) { htmlTests.push({ name: name, fn: fn }); }

var PAGES_WITH_BANNER = [
  "index.html", "blog.html", "post.html", "start.html",
  "terms.html", "privacy.html", "404.html"
];

var PAGES_WITHOUT_BANNER = ["admin.html", "font-preview.html"];

PAGES_WITH_BANNER.forEach(function (page) {
  var html = fs.readFileSync(path.join(frontendDir, page), "utf8");

  htmlTest(page + ": has cookie-banner element", function () {
    assert(html.indexOf('id="cookie-banner"') !== -1, "Missing cookie-banner element");
  });

  htmlTest(page + ": has Accept button", function () {
    assert(html.indexOf("js-cookie-accept") !== -1, "Missing Accept button");
  });

  htmlTest(page + ": has Decline button", function () {
    assert(html.indexOf("js-cookie-decline") !== -1, "Missing Decline button");
  });

  htmlTest(page + ": has Manage Cookies in footer", function () {
    assert(html.indexOf("js-cookie-manage") !== -1, "Missing Manage Cookies button");
  });

  htmlTest(page + ": loads consent-bootstrap.js as ES module", function () {
    assert(
      html.indexOf('type="module" src="assets/js/consent-bootstrap.js"') !== -1,
      "Missing <script type=\"module\" src=\"...consent-bootstrap.js\">"
    );
  });

  htmlTest(page + ": no legacy classic cookie-consent.js script tag", function () {
    assert(
      html.indexOf('src="assets/js/cookie-consent.js"></script>') === -1 ||
      html.indexOf('type="module" src="assets/js/cookie-consent.js"') !== -1,
      "Found legacy classic <script src=\"...cookie-consent.js\"> — should be replaced by consent-bootstrap.js"
    );
  });

  htmlTest(page + ": NO hardcoded GA4 in <head>", function () {
    var headEnd = html.indexOf("</head>");
    var headSection = html.substring(0, headEnd);
    assert(headSection.indexOf("googletagmanager.com/gtag/js") === -1,
      "GA4 script found in <head> — should be loaded by analytics.js only");
  });

  htmlTest(page + ": CSP allows googletagmanager.com", function () {
    if (html.indexOf("Content-Security-Policy") !== -1) {
      assert(html.indexOf("https://www.googletagmanager.com") !== -1,
        "CSP does not allow googletagmanager.com — GA4 injection will be blocked");
    }
  });

  htmlTest(page + ": banner has role=dialog", function () {
    assert(html.indexOf('role="dialog"') !== -1, "Banner missing role=dialog");
  });

  htmlTest(page + ": banner has hidden attribute", function () {
    var bannerIdx = html.indexOf('id="cookie-banner"');
    var bannerLine = html.substring(bannerIdx - 100, bannerIdx + 200);
    assert(bannerLine.indexOf("hidden") !== -1, "Banner should have hidden attribute by default");
  });
});

PAGES_WITHOUT_BANNER.forEach(function (page) {
  var filePath = path.join(frontendDir, page);
  if (!fs.existsSync(filePath)) return;
  var html = fs.readFileSync(filePath, "utf8");

  htmlTest(page + ": no cookie banner (non-public page)", function () {
    assert(html.indexOf('id="cookie-banner"') === -1,
      "Non-public page should not have cookie banner");
  });
});

htmlTest("privacy.html: documents consent-gated behavior", function () {
  var html = fs.readFileSync(path.join(frontendDir, "privacy.html"), "utf8");
  assert(html.indexOf("only loaded after you explicitly accept") !== -1,
    "Privacy policy should document that cookies are consent-gated");
});

htmlTest("privacy.html: documents Manage Cookies option", function () {
  var html = fs.readFileSync(path.join(frontendDir, "privacy.html"), "utf8");
  assert(html.indexOf("Manage Cookies") !== -1,
    "Privacy policy should mention the Manage Cookies option");
});

htmlTest("privacy.html: documents Do Not Track", function () {
  var html = fs.readFileSync(path.join(frontendDir, "privacy.html"), "utf8");
  assert(html.indexOf("Do Not Track") !== -1,
    "Privacy policy should document DNT support");
});

console.log("\n  HTML Structural Validation\n  " + "═".repeat(40) + "\n");
htmlTests.forEach(function (t) {
  try {
    t.fn();
    htmlPassed++;
    console.log("  ✓ " + t.name);
  } catch (e) {
    htmlFailed++;
    console.log("  ✗ " + t.name);
    console.log("    " + e.message);
  }
});

console.log("\n  " + "─".repeat(40));
console.log("  " + htmlPassed + " passed, " + htmlFailed + " failed\n");

var totalFailed = failed + htmlFailed;
if (totalFailed > 0) process.exit(1);
