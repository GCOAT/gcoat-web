// interactions.js — UI interaction handlers (Phase E + F)
// Nav auto-hide, active section indicator, mouse glare, marquee,
// typewriter reveal, cursor-follow blob

export function initInteractions() {
  initHideyNav();
  initActiveSection();
  initMouseGlare();
  initMarquee();
  initTypewriterReveal();
  initCursorBlob();
}

// ── Auto-Hide Navigation ──
// Hides header on scroll-down, reappears on scroll-up.
// Progressive enhancement: header stays visible if JS fails.
function initHideyNav() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const THRESHOLD = 5;
  let lastScrollY = window.scrollY;
  let ticking = false;

  function onScroll() {
    const currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;

    if (Math.abs(delta) < THRESHOLD) {
      ticking = false;
      return;
    }

    if (delta > 0 && currentScrollY > header.offsetHeight) {
      header.classList.add("is-hidden");
    } else if (delta < 0) {
      header.classList.remove("is-hidden");
    }

    lastScrollY = currentScrollY;
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
}

// ── Active Section Indicator ──
// Highlights the current nav link based on which section is in view.
function initActiveSection() {
  const navLinks = document.querySelectorAll(".nav__link[href^='#']");
  if (!navLinks.length) return;

  const sections = [];
  navLinks.forEach((link) => {
    const id = link.getAttribute("href").slice(1);
    const section = document.getElementById(id);
    if (section) sections.push({ el: section, link });
  });

  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const match = sections.find((s) => s.el === entry.target);
        if (!match) return;

        if (entry.isIntersecting) {
          navLinks.forEach((l) => l.classList.remove("is-active"));
          match.link.classList.add("is-active");
        }
      });
    },
    { threshold: 0.3, rootMargin: "-64px 0px -40% 0px" }
  );

  sections.forEach((s) => observer.observe(s.el));
}

// ── Mouse Glare Effect ──
// Radial light gradient follows pointer on .js-glare elements.
function initMouseGlare() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const cards = document.querySelectorAll(".js-glare");
  if (!cards.length) return;

  cards.forEach((card) => {
    let rafId = null;

    card.addEventListener("pointermove", (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--glare-x", (e.clientX - rect.left) + "px");
        card.style.setProperty("--glare-y", (e.clientY - rect.top) + "px");
        rafId = null;
      });
    });

    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") card.classList.add("is-touched");
    });

    card.addEventListener("pointerup", () => card.classList.remove("is-touched"));
    card.addEventListener("pointerleave", () => card.classList.remove("is-touched"));
  });
}

// ── Infinite Marquee ──
// Duplicates marquee content for seamless loop. Pure CSS animation.
function initMarquee() {
  const tracks = document.querySelectorAll("[data-marquee]");
  if (!tracks.length) return;

  const sep = '<span class="marquee__sep" aria-hidden="true">✦</span>';

  tracks.forEach((track) => {
    const custom = track.dataset.items;
    if (!custom) return;

    const items = JSON.parse(custom);
    const html = items
      .map((item) => `<span class="marquee__item">${item}</span>${sep}`)
      .join("");

    // Duplicate for seamless loop
    track.innerHTML = html + html;
  });
}

// ── Typewriter Reveal ──
// Activates .typewriter-reveal elements when they scroll into view.
function initTypewriterReveal() {
  const els = document.querySelectorAll(".typewriter-reveal");
  if (!els.length) return;

  // Set custom properties from data attributes (CSP-safe, no inline styles)
  els.forEach((el) => {
    if (el.dataset.twN) el.style.setProperty("--n", el.dataset.twN);
    if (el.dataset.twDuration) el.style.setProperty("--typewriter-duration", el.dataset.twDuration);
  });

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    els.forEach((el) => el.classList.add("typewriter-reveal--active"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("typewriter-reveal--active");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  els.forEach((el) => observer.observe(el));
}

// ── Cursor-Follow Blob ──
// Smooth lerp-based cursor blob that follows pointer across the page.
// Desktop only — hidden on touch devices by CSS.
function initCursorBlob() {
  const blob = document.getElementById("cursor-blob");
  if (!blob) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  // Hide on touch-primary devices
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const LERP = 0.12;
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  function loop() {
    currentX += (targetX - currentX) * LERP;
    currentY += (targetY - currentY) * LERP;
    blob.style.transform = `translate(${currentX}px, ${currentY}px)`;
    requestAnimationFrame(loop);
  }

  document.addEventListener("pointermove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  }, { passive: true });

  // Grow blob on interactive elements
  const interactiveSelector = "a, button, .js-glare, input, textarea, select";
  document.addEventListener("pointerover", (e) => {
    if (e.target.closest(interactiveSelector)) {
      blob.classList.add("cursor-blob--active");
    }
  }, { passive: true });

  document.addEventListener("pointerout", (e) => {
    if (e.target.closest(interactiveSelector)) {
      blob.classList.remove("cursor-blob--active");
    }
  }, { passive: true });

  blob.classList.add("cursor-blob--visible");
  requestAnimationFrame(loop);
}
