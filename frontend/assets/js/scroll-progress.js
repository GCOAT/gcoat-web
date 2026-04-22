// scroll-progress.js — classic script, loaded on every user-facing page.
// Self-mounts a fixed-top progress bar (3px, brand gradient) that fills
// as the user scrolls. Pure progressive enhancement: no HTML markup
// required. CSS lives in components.css (.scroll-progress);
// prefers-reduced-motion hides the bar via base.css.
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

  var ticking = false;

  function update() {
    var scrollTop = window.scrollY || window.pageYOffset || 0;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (pct < 0) pct = 0;
    else if (pct > 100) pct = 100;
    bar.style.width = pct + "%";
    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    ticking = false;
  }

  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function mount() {
    if (!document.body) return;
    document.body.appendChild(bar);
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
})();
