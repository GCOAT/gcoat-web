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
  initMagneticButtons();
}

// ── Smart Navigation ──
// Always visible. Transparent at top, compact glassmorphism on scroll.
// Progressive enhancement: header stays visible if JS fails.
function initHideyNav() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const hero = document.getElementById("hero");
  let heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 300;
  let ticking = false;

  // Recalc on resize
  window.addEventListener("resize", () => {
    heroBottom = hero ? hero.offsetTop + hero.offsetHeight : 300;
  }, { passive: true });

  function onScroll() {
    const y = window.scrollY;

    // Compact mode once scrolled past hero
    header.classList.toggle("is-compact", y > heroBottom * 0.6);

    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  // Run once on load
  onScroll();
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
    { threshold: 0.2, rootMargin: "-64px 0px -30% 0px" }
  );

  sections.forEach((s) => observer.observe(s.el));
}

// ── Mouse Glare Effect ──
// Radial light gradient follows pointer on .js-glare elements.
// Also applies subtle 3D tilt on .js-tilt elements (opt-in).
function initMouseGlare() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const cards = document.querySelectorAll(".js-glare");
  if (!cards.length) return;

  const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
  const MAX_TILT = 6; // degrees — perceptible on casual hover without feeling gimmicky

  cards.forEach((card) => {
    let rafId = null;
    const hasTilt = !isTouchPrimary && card.classList.contains("js-tilt");

    card.addEventListener("pointermove", (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty("--glare-x", x + "px");
        card.style.setProperty("--glare-y", y + "px");

        if (hasTilt) {
          // Normalize to -1..1 from center
          const nx = (x / rect.width - 0.5) * 2;
          const ny = (y / rect.height - 0.5) * 2;
          // rotateY follows horizontal, rotateX inverts vertical
          card.style.setProperty("--tilt-x", (-ny * MAX_TILT).toFixed(2) + "deg");
          card.style.setProperty("--tilt-y", (nx * MAX_TILT).toFixed(2) + "deg");
        }

        rafId = null;
      });
    });

    if (hasTilt) {
      card.addEventListener("pointerenter", () => {
        card.style.willChange = "transform";
      });

      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
        // Remove will-change after transition completes
        setTimeout(() => { card.style.willChange = ""; }, 350);
      });
    }

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

    // Reverse direction if data attribute set
    if (track.dataset.direction === "reverse") {
      track.classList.add("marquee__track--reverse");
    }
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

// ── Magnetic Buttons ──
// Targets explicit [data-magnetic] elements plus all primary buttons
// (.btn--primary, .nav__cta) automatically. Translates toward the pointer
// when it enters the attraction radius; springs back on leave.
// Skip if a target opts out with [data-magnetic="off"].
// Disabled on touch and under prefers-reduced-motion.
function initMagneticButtons() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const selector = [
    "[data-magnetic]:not([data-magnetic='off'])",
    ".btn--primary:not([data-magnetic='off'])",
    ".nav__cta:not([data-magnetic='off'])",
  ].join(", ");
  const targets = document.querySelectorAll(selector);
  if (!targets.length) return;

  const RADIUS = 120;
  const MAX_OFFSET = 10;
  const LERP = 0.22;

  const items = Array.from(targets).map((el) => ({
    el, cx: 0, cy: 0, tx: 0, ty: 0, active: false,
  }));
  let pointerX = -9999;
  let pointerY = -9999;
  let raf = 0;
  let lastUpdate = 0;

  function step() {
    let stillAnimating = false;
    for (const item of items) {
      if (item.active || Math.abs(item.cx - item.tx) > 0.08 || Math.abs(item.cy - item.ty) > 0.08) {
        item.cx += (item.tx - item.cx) * LERP;
        item.cy += (item.ty - item.cy) * LERP;
        item.el.style.transform = `translate(${item.cx.toFixed(2)}px, ${item.cy.toFixed(2)}px)`;
        stillAnimating = true;
      } else if (!item.active && item.el.style.transform) {
        item.el.style.transform = "";
      }
    }
    raf = stillAnimating ? requestAnimationFrame(step) : 0;
  }

  function recompute() {
    let anyActive = false;
    for (const item of items) {
      const rect = item.el.getBoundingClientRect();
      // Skip off-screen elements
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) {
        item.tx = 0; item.ty = 0; item.active = false;
        continue;
      }
      const mx = rect.left + rect.width / 2;
      const my = rect.top + rect.height / 2;
      const dx = pointerX - mx;
      const dy = pointerY - my;
      const dist = Math.hypot(dx, dy);
      if (dist < RADIUS) {
        const strength = 1 - dist / RADIUS;
        item.tx = (dx / RADIUS) * MAX_OFFSET * strength * 2;
        item.ty = (dy / RADIUS) * MAX_OFFSET * strength * 2;
        item.active = true;
        anyActive = true;
      } else {
        item.tx = 0; item.ty = 0; item.active = false;
      }
    }
    if ((anyActive || raf) && !raf) raf = requestAnimationFrame(step);
  }

  function onPointerMove(e) {
    pointerX = e.clientX;
    pointerY = e.clientY;
    const now = performance.now();
    if (now - lastUpdate < 16) return;
    lastUpdate = now;
    recompute();
  }

  function onLeave() {
    pointerX = -9999;
    pointerY = -9999;
    for (const item of items) { item.tx = 0; item.ty = 0; item.active = false; }
    if (!raf) raf = requestAnimationFrame(step);
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);
  window.addEventListener("scroll", () => { if (pointerX >= 0) recompute(); }, { passive: true });
}
