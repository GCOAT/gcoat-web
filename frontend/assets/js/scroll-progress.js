// scroll-progress.js — classic script, loaded on every user-facing page.
// Self-mounts:
//   1) a fixed-top progress bar that fills as the user scrolls;
//   2) an active-section label pill in the top-right that updates as
//      sections enter the viewport. Both are pure progressive enhancement.
// CSS: components.css (.scroll-progress, .scroll-section-label).
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  var bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.id = "scroll-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Page scroll progress");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", "0");

  var label = document.createElement("div");
  label.className = "scroll-section-label";
  label.id = "scroll-section-label";
  label.setAttribute("aria-live", "polite");
  label.innerHTML = '<span class="scroll-section-label__dot" aria-hidden="true"></span><span class="scroll-section-label__text"></span>';
  var labelText = label.querySelector(".scroll-section-label__text");

  var ticking = false;

  function update() {
    var scrollTop = window.scrollY || window.pageYOffset || 0;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (pct < 0) pct = 0;
    else if (pct > 100) pct = 100;
    bar.style.width = pct + "%";
    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    // Hide label when we're at the very top of the page
    if (scrollTop < 120) {
      label.classList.remove("is-visible");
    } else if (labelText.textContent) {
      label.classList.add("is-visible");
    }
    ticking = false;
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  // Map section ids to human-friendly labels (falls back to the
  // aria-label or a title-cased id if unmapped).
  var SECTION_LABELS = {
    hero: "Intro",
    about: "About",
    services: "Services",
    portfolio: "Work",
    process: "Process",
    testimonials: "Voices",
    blog: "Journal",
    contact: "Contact",
    "cta-band": "Start",
  };

  function labelFor(sectionEl) {
    if (!sectionEl) return "";
    var id = sectionEl.id;
    if (id && SECTION_LABELS[id]) return SECTION_LABELS[id];
    var aria = sectionEl.getAttribute("aria-label");
    if (aria) return aria;
    if (id) return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ");
    return "";
  }

  function setupSectionObserver() {
    if (typeof IntersectionObserver === "undefined") return;
    var candidates = document.querySelectorAll("main section[id], main [data-section-label][id]");
    if (!candidates.length) return;

    var visibleRatios = new Map();

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visibleRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      // Pick the section with the highest visible ratio.
      var best = null;
      var bestRatio = 0;
      visibleRatios.forEach(function (ratio, el) {
        if (ratio > bestRatio) {
          best = el;
          bestRatio = ratio;
        }
      });
      if (best) {
        var text = labelFor(best);
        if (text && labelText.textContent !== text) {
          labelText.textContent = text;
        }
      }
    }, {
      threshold: [0, 0.15, 0.35, 0.6, 0.85],
      rootMargin: "-80px 0px -40% 0px",
    });

    candidates.forEach(function (el) { observer.observe(el); });
  }

  function mount() {
    if (!document.body) return;
    document.body.appendChild(bar);
    document.body.appendChild(label);
    update();
    setupSectionObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
})();
