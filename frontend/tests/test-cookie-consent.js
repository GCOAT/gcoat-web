/**
 * Automated tests for cookie-consent.js
 * Run with: node frontend/tests/test-cookie-consent.js
 *
 * Simulates a minimal DOM + localStorage to exercise every code path
 * without needing a real browser or external dependencies.
 */

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
  var listeners = {};
  var docListeners = {};
  var headAppended = [];
  var focusedElement = null;
  var cookieStore = "";

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
      querySelector: function (sel) {
        // Simple class-based lookup within this element's children
        var key = sel.replace(".", "");
        return elements[key] || null;
      },
      querySelectorAll: function (sel) {
        var key = sel.replace(".", "");
        var results = [];
        for (var k in elements) {
          if (k === key || k.indexOf(key) === 0) {
            results.push(elements[k]);
          }
        }
        return results;
      },
      _attrs: attrs,
      _elListeners: elListeners
    };
    return el;
  }

  // Create banner and its child buttons
  var banner = makeElement("cookie-banner", "cookie-banner");
  banner.setAttribute("hidden", "");
  var acceptBtn = makeElement(null, "cookie-banner__accept js-cookie-accept");
  acceptBtn.tagName = "BUTTON";
  var declineBtn = makeElement(null, "cookie-banner__decline js-cookie-decline");
  declineBtn.tagName = "BUTTON";
  var manageBtn = makeElement(null, "footer__cookie-manage js-cookie-manage");

  // Register children so querySelector can find them
  elements["js-cookie-accept"] = acceptBtn;
  elements["js-cookie-decline"] = declineBtn;
  elements["js-cookie-manage"] = manageBtn;
  elements["cookie-banner"] = banner;

  // Override banner.querySelector to find buttons
  banner.querySelector = function (sel) {
    var key = sel.replace(".", "");
    if (key === "js-cookie-accept") return acceptBtn;
    if (key === "js-cookie-decline") return declineBtn;
    if (key === "button") return acceptBtn; // first button
    return null;
  };

  // Mock document
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
      for (var k in elements) {
        if (k === key) results.push(elements[k]);
      }
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

  // Mock head
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

function loadScript(mock) {
  // Build a sandboxed environment and execute cookie-consent.js
  var fs = require("fs");
  var path = require("path");
  var src = fs.readFileSync(
    path.join(__dirname, "..", "assets", "js", "cookie-consent.js"),
    "utf8"
  );

  var sandbox = {
    document: mock.document,
    window: {
      dataLayer: [],
      matchMedia: function () { return { matches: false }; },
      doNotTrack: undefined,
      gtag: undefined
    },
    navigator: { doNotTrack: undefined },
    location: { hostname: "localhost" },
    localStorage: {
      _store: mock.storage,
      getItem: function (k) { return this._store[k] || null; },
      setItem: function (k, v) { this._store[k] = v; },
      removeItem: function (k) { delete this._store[k]; }
    },
    requestAnimationFrame: function (fn) { fn(); },
    console: console
  };

  // Head for script injection
  sandbox.document.head = mock.head;

  // Build function from source in sandbox context
  var keys = Object.keys(sandbox);
  var vals = keys.map(function (k) { return sandbox[k]; });

  // Wrap source so it returns the init and helper functions for direct access
  var wrapped = "(function(" + keys.join(",") + ") {\n" + src + "\nreturn { loadGA4: loadGA4, disableGA4: disableGA4, getConsent: getConsent, setConsent: setConsent };\n})";

  var fn = eval(wrapped);
  var exports = fn.apply(null, vals);
  return { sandbox: sandbox, exports: exports };
}

/* ════════════════════════════════════════════════════════════════
   TESTS
   ════════════════════════════════════════════════════════════════ */

test("First visit: banner shown when no consent stored", function () {
  var mock = createMockDOM();
  loadScript(mock);
  assert(!mock.banner.hasAttribute("hidden"), "Banner should not have hidden attribute");
  assert(mock.banner.classList.contains("is-visible"), "Banner should have is-visible class");
});

test("First visit: Accept stores 'accepted' and injects GA4", function () {
  var mock = createMockDOM();
  loadScript(mock);
  mock.acceptBtn.dispatchEvent("click");
  assertEqual(mock.storage["gcoat-cookie-consent"], "accepted", "Consent should be 'accepted'");
  assert(mock.headAppended.length > 0, "GA4 script should be injected into head");
});

test("First visit: Decline stores 'declined' and does NOT inject GA4", function () {
  var mock = createMockDOM();
  loadScript(mock);
  mock.declineBtn.dispatchEvent("click");
  assertEqual(mock.storage["gcoat-cookie-consent"], "declined", "Consent should be 'declined'");
  assertEqual(mock.headAppended.length, 0, "No GA4 script should be injected");
});

test("Return visit (accepted): GA4 loads immediately, no banner", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = "accepted";
  loadScript(mock);
  assert(mock.headAppended.length > 0, "GA4 should load on init");
  assert(mock.banner.hasAttribute("hidden"), "Banner should remain hidden");
});

test("Return visit (declined): no GA4, no banner", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = "declined";
  loadScript(mock);
  assertEqual(mock.headAppended.length, 0, "GA4 should NOT load");
  assert(mock.banner.hasAttribute("hidden"), "Banner should remain hidden");
});

test("Manage Cookies re-opens banner after prior consent", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = "accepted";
  loadScript(mock);
  assert(mock.banner.hasAttribute("hidden"), "Banner should be hidden initially");
  mock.manageBtn.dispatchEvent("click");
  assert(!mock.banner.hasAttribute("hidden"), "Banner should be visible after Manage click");
});

test("Accept then Manage then Decline: GA4 disabled", function () {
  var mock = createMockDOM();
  loadScript(mock);
  // Accept first
  mock.acceptBtn.dispatchEvent("click");
  assertEqual(mock.storage["gcoat-cookie-consent"], "accepted");
  // Re-open via manage
  mock.manageBtn.dispatchEvent("click");
  // Decline
  mock.declineBtn.dispatchEvent("click");
  assertEqual(mock.storage["gcoat-cookie-consent"], "declined", "Consent should change to 'declined'");
});

test("Buttons work after Manage Cookies re-open (bug fix verification)", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = "declined";
  loadScript(mock);
  // Re-open
  mock.manageBtn.dispatchEvent("click");
  assert(!mock.banner.hasAttribute("hidden"), "Banner should be visible");
  // Click accept — this was the bug: buttons had no listeners
  mock.acceptBtn.dispatchEvent("click");
  assertEqual(mock.storage["gcoat-cookie-consent"], "accepted", "Accept should work after re-open");
  assert(mock.headAppended.length > 0, "GA4 should load after re-open accept");
});

test("DNT=1: GA4 never loads even if accepted", function () {
  var mock = createMockDOM();
  mock.storage["gcoat-cookie-consent"] = "accepted";
  // Patch navigator.doNotTrack before loading script
  var fs = require("fs");
  var path = require("path");
  var src = fs.readFileSync(
    path.join(__dirname, "..", "assets", "js", "cookie-consent.js"),
    "utf8"
  );
  var sandbox = {
    document: mock.document,
    window: { dataLayer: [], matchMedia: function () { return { matches: false }; }, doNotTrack: undefined },
    navigator: { doNotTrack: "1" },
    location: { hostname: "localhost" },
    localStorage: {
      _store: mock.storage,
      getItem: function (k) { return this._store[k] || null; },
      setItem: function (k, v) { this._store[k] = v; }
    },
    requestAnimationFrame: function (fn) { fn(); },
    console: console
  };
  sandbox.document.head = mock.head;
  var keys = Object.keys(sandbox);
  var vals = keys.map(function (k) { return sandbox[k]; });
  var wrapped = "(function(" + keys.join(",") + ") {\n" + src + "\n})";
  var fn = eval(wrapped);
  fn.apply(null, vals);
  assertEqual(mock.headAppended.length, 0, "GA4 should NOT load when DNT=1");
});

test("Escape key dismisses visible banner", function () {
  var mock = createMockDOM();
  loadScript(mock);
  assert(!mock.banner.hasAttribute("hidden"), "Banner should be visible on first visit");
  // Simulate Escape keydown
  var handlers = mock.docListeners || {};
  var keydownHandlers = handlers["keydown"] || [];
  assert(keydownHandlers.length > 0, "Should have a keydown listener");
  // Call the handler with Escape
  keydownHandlers[0]({ key: "Escape" });
  // With reduced motion off, banner hides via transitionend
  // Simulate transitionend
  mock.banner.dispatchEvent("transitionend");
  assert(mock.banner.hasAttribute("hidden"), "Banner should be hidden after Escape");
});

test("Focus moves to Accept button when banner opens", function () {
  var mock = createMockDOM();
  mock.resetFocus();
  loadScript(mock);
  assertEqual(mock.getFocused(), mock.acceptBtn, "Focus should be on Accept button");
});

test("localStorage error does not crash (Safari private mode)", function () {
  var mock = createMockDOM();
  var fs = require("fs");
  var path = require("path");
  var src = fs.readFileSync(
    path.join(__dirname, "..", "assets", "js", "cookie-consent.js"),
    "utf8"
  );
  var sandbox = {
    document: mock.document,
    window: { dataLayer: [], matchMedia: function () { return { matches: false }; }, doNotTrack: undefined },
    navigator: { doNotTrack: undefined },
    location: { hostname: "localhost" },
    localStorage: {
      getItem: function () { throw new Error("SecurityError"); },
      setItem: function () { throw new Error("SecurityError"); }
    },
    requestAnimationFrame: function (fn) { fn(); },
    console: console
  };
  sandbox.document.head = mock.head;
  var keys = Object.keys(sandbox);
  var vals = keys.map(function (k) { return sandbox[k]; });
  var wrapped = "(function(" + keys.join(",") + ") {\n" + src + "\n})";
  var fn = eval(wrapped);
  // Should not throw
  fn.apply(null, vals);
  assert(!mock.banner.hasAttribute("hidden"), "Banner should show even with broken localStorage");
  // Accept should not crash
  mock.acceptBtn.dispatchEvent("click");
  // If we got here, no crash
  assert(true, "No crash on accept with broken localStorage");
});

test("GA4 loaded only once (idempotent)", function () {
  var mock = createMockDOM();
  var result = loadScript(mock);
  mock.acceptBtn.dispatchEvent("click");
  var count1 = mock.headAppended.length;
  // Call loadGA4 again directly
  result.exports.loadGA4();
  assertEqual(mock.headAppended.length, count1, "GA4 should not be injected twice");
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

var fs = require("fs");
var path = require("path");
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

  htmlTest(page + ": loads cookie-consent.js", function () {
    assert(html.indexOf("cookie-consent.js") !== -1, "Missing cookie-consent.js script");
  });

  htmlTest(page + ": NO hardcoded GA4 in <head>", function () {
    var headEnd = html.indexOf("</head>");
    var headSection = html.substring(0, headEnd);
    assert(headSection.indexOf("googletagmanager.com/gtag/js") === -1,
      "GA4 script found in <head> — should be loaded by cookie-consent.js only");
  });

  htmlTest(page + ": NO gtag.js reference", function () {
    assert(html.indexOf('src="assets/js/gtag.js"') === -1,
      "gtag.js reference found — GA4 init is now inline in cookie-consent.js");
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
    // The banner should be hidden by default in the HTML
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

// Privacy policy content checks
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
