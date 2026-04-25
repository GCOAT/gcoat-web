// main.js — ES module

// Module loaded successfully — cancel the fallback timeout from init.js
clearTimeout(window.__jsModuleTimeout);

import { submitLead } from "./api.js";
import { initInteractions } from "./interactions.js";
import { initServicesFire } from "./services-fire.js";
import { initProcessSpace } from "./process-space.js";
import { initIntakeChat } from "./intake-chat.js";

// ── Mobile Detection ──
const isMobile = window.matchMedia("(max-width: 768px)").matches;

// ── Lazy-load hero shader (desktop only — saves ~150KB + GPU on mobile) ──
let heroShaderModule = null;
async function loadHeroShader() {
  if (!heroShaderModule) {
    heroShaderModule = await import("./hero-shader.js");
  }
  return heroShaderModule;
}

// ── Trail intensity reader — shared across all section cursor trails.
//    Reads the --trail-intensity CSS custom property set by theme-panel.js
//    via the data-trail-intensity attribute on <html>. Defaults to 1.2. ──
function getTrailIntensity() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--trail-intensity")
    .trim();
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.2;
}

// ── DOM References ──
const yearEl = document.getElementById("year");
const navToggle = document.querySelector(".js-nav-toggle");
const navMenu = document.querySelector("#nav-menu");
const header = document.querySelector(".site-header");
const splash = document.getElementById("mode-splash");
const loader = document.getElementById("loading-screen");
const modeToggle = document.querySelector(".js-mode-toggle");
const themeToggle = document.querySelector(".js-theme-toggle");
const arcadeSwitch = document.querySelector(".js-arcade-switch");
const announcer = document.querySelector("#status-announcer");

// ── Mode System ──
function getMode() {
  return localStorage.getItem("gcoat-mode");
}

function setMode(mode) {
  document.documentElement.setAttribute("data-mode", mode);
  localStorage.setItem("gcoat-mode", mode);
  updateModeToggleLabel();
}

function updateModeToggleLabel() {
  if (!modeToggle) return;
  const current = document.documentElement.getAttribute("data-mode");
  if (current === "arcade") {
    modeToggle.setAttribute("aria-label", "Switch to Regular mode");
  } else {
    modeToggle.setAttribute("aria-label", "Switch to Arcade mode");
  }
}

// ── Theme System (Dark/Light) ──
function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

function setTheme(theme) {
  document.body.classList.add("theme-transitioning");
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("gcoat-theme", theme);
  updateThemeToggleLabel();
  if (announcer) announcer.textContent = `Switched to ${theme} mode`;
  // Remove transition class after animation
  setTimeout(() => document.body.classList.remove("theme-transitioning"), 350);
}

function updateThemeToggleLabel() {
  if (!themeToggle) return;
  const current = getTheme();
  themeToggle.setAttribute("aria-label", current === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

// ── Splash Interaction ──
function initSplash() {
  if (getMode()) {
    splash?.remove();
    return;
  }
  if (!splash) return;

  const cards = splash.querySelectorAll(".js-mode-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const mode = card.getAttribute("data-mode-value");
      setMode(mode);
      splash.classList.add("splash--exit");
      splash.addEventListener("animationend", () => {
        splash.remove();
        startLoadingSequence();
      }, { once: true });
    });
  });
}

// ── Loading Screen ──
const LOADER_MIN_MS = isMobile ? 1000 : 2500;
const LOADER_RETURNING_MS = isMobile ? 600 : 1200;

function startLoadingSequence() {
  if (!loader) {
    revealHero();
    return;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    loader.remove();
    revealHero();
    return;
  }

  const isReturning = localStorage.getItem("gcoat-visited");
  const minDuration = isReturning ? LOADER_RETURNING_MS : LOADER_MIN_MS;

  // Set speed for returning visitors (compressed animations)
  if (isReturning) {
    loader.style.setProperty("--loader-speed", "0.55");
  }

  // Set progress bar duration
  const progressEl = loader.querySelector(".loader__progress");
  if (progressEl) {
    progressEl.style.setProperty("--loader-duration", `${minDuration}ms`);
  }

  loader.classList.add("is-active");

  const startTime = performance.now();

  // Mark as visited for next time
  localStorage.setItem("gcoat-visited", "1");

  // Add is-dealt class after deal-in settles (slightly after last card lands)
  const dealDuration = isReturning ? 700 : 1300;
  setTimeout(() => {
    const cardLoader = loader.querySelector(".card-loader");
    if (cardLoader) cardLoader.classList.add("is-dealt");
  }, dealDuration);

  // Wait for minimum duration, then exit
  function checkReady() {
    const elapsed = performance.now() - startTime;
    if (elapsed >= minDuration) {
      exitLoader();
    } else {
      setTimeout(checkReady, minDuration - elapsed);
    }
  }

  checkReady();
}

function exitLoader() {
  if (!loader) return;
  loader.classList.add("loader--exit");
  revealHero();
  // Remove after CSS transition completes (0.6s)
  setTimeout(() => loader.remove(), 650);
}

// ── Hero Shader + GSAP Reveal ──
const heroCanvas = document.getElementById("hero-canvas");
const heroSection = document.getElementById("hero");
const heroGlass = document.querySelector(".hero__glass");
const heroScroll = document.querySelector(".hero__scroll");
let shaderActive = false;

// ── Hero typewriter reveal ──
// One-shot word-stagger entrance on the hero headline, first visit only.
// localStorage-gated so return visits get the title instantly (no wait
// to read the same copy). Respects prefers-reduced-motion.
// The animation waits for .hero__glass.is-loaded before starting, so
// it plays in sync with the hero's opacity reveal instead of running
// invisibly while the shader is still loading.
function initHeroTypewriter() {
  const heroGlassEl = document.querySelector(".hero__glass");
  const title = document.querySelector(".hero__title");
  if (!title || !heroGlassEl) return;

  const STORAGE_KEY = "gcoat.hero.typed";
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let alreadyTyped = false;
  try {
    alreadyTyped = localStorage.getItem(STORAGE_KEY) === "1";
  } catch (_) {
    // private mode or storage disabled — treat as already typed
    alreadyTyped = true;
  }
  if (prefersReduced || alreadyTyped) return;

  const text = title.textContent.trim();
  if (!text) return;
  const words = text.split(/\s+/);
  const WORD_MS = 90;
  const START_MS = 220;

  // Prep the DOM immediately — replace title content with hidden spans
  // so no flash of plain text is possible once the hero reveals.
  title.innerHTML = words
    .map((word, i) => {
      const delay = START_MS + i * WORD_MS;
      return `<span class="hero__title-word" style="transition-delay: ${delay}ms">${word}</span>`;
    })
    .join(" ");

  let started = false;
  function startAnimation() {
    if (started) return;
    started = true;
    title.classList.add("is-typing");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        title.classList.add("is-typed");
      });
    });
    const totalMs = START_MS + words.length * WORD_MS + 400;
    setTimeout(() => {
      title.classList.remove("is-typing");
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch (_) { /* ignore */ }
    }, totalMs);
  }

  // The animation must wait for BOTH:
  //   1. document.readyState === "complete" (page load event fired)
  //   2. .hero__glass.is-loaded (the hero's own reveal has triggered)
  // Shader-loading times are unpredictable, so polling both conditions
  // is more reliable than observing one and guessing the other.
  let polls = 0;
  const startPoll = setInterval(() => {
    polls++;
    const loadReady = document.readyState === "complete";
    const heroReady = heroGlassEl.classList.contains("is-loaded");
    if (loadReady && heroReady) {
      clearInterval(startPoll);
      // Small pad so the title's own opacity fade (500ms) has started
      // visibly before the first word transitions in.
      setTimeout(startAnimation, 180);
    } else if (polls > 80) {
      // 8-second hard cap — if the hero reveal never triggered (shader
      // failure without fallback wiring), fire anyway so the title
      // isn't left invisible forever.
      clearInterval(startPoll);
      startAnimation();
    }
  }, 100);
}

async function initHero() {
  if (!heroCanvas) return;
  // Skip Three.js shader entirely on mobile — use CSS gradient orbs fallback
  if (!isMobile) {
    try {
      const { initHeroShader } = await loadHeroShader();
      shaderActive = initHeroShader(heroCanvas);
    } catch { /* WebGL unavailable or module load failure */ }
  }

  if (shaderActive && heroCanvas) {
    heroCanvas.classList.add("is-active");
  }

  // Pause/resume shader when hero leaves viewport
  if (heroSection && shaderActive) {
    const { pauseHeroShader, resumeHeroShader } = await loadHeroShader();
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) resumeHeroShader();
        else pauseHeroShader();
      },
      { threshold: 0.05 }
    );
    obs.observe(heroSection);
  }

  // Update shader colors when scheme changes
  if (shaderActive) {
    window.addEventListener("gcoat-scheme-change", () => {
      requestAnimationFrame(() => {
        loadHeroShader().then(({ updateShaderColors }) => updateShaderColors());
      });
    });
  }

  // Scroll indicator — fade on scroll
  if (heroScroll) {
    window.addEventListener("scroll", () => {
      heroScroll.classList.toggle("is-hidden", window.scrollY > 80);
    }, { passive: true });
  }

  // Entrance stagger — reveal glass children once on load
  if (heroGlass) {
    requestAnimationFrame(() => {
      heroGlass.classList.add("is-loaded");
    });
  }

  // Mouse glare — pointer-following radial highlight on glass panel
  if (heroGlass && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let glareRaf = false;
    heroGlass.addEventListener("mousemove", (e) => {
      if (glareRaf) return;
      glareRaf = true;
      requestAnimationFrame(() => {
        const rect = heroGlass.getBoundingClientRect();
        heroGlass.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width * 100) + "%");
        heroGlass.style.setProperty("--my", ((e.clientY - rect.top) / rect.height * 100) + "%");
        glareRaf = false;
      });
    }, { passive: true });
  }
}

function revealHero() {
  if (shaderActive) {
    // Shader active: start the hero cycle (shader State A first, then content)
    initHeroCycle();
  } else {
    // No shader: show content immediately in State B look
    heroSection?.classList.add("is-content-mode");
  }
}

// ── Hero Cycle Orchestrator ──
const HERO_DISPLAY_MS = 5000;
const HERO_TRANSITION_MS = 1500;
const HERO_MAX_LOOPS = 3; // 2.5 loops = 3 shader appearances, ends on State B
let heroCycleRunning = false;
let heroCycleTimer = null;
let heroCycleCount = 0;
let heroInStateA = true; // tracks current visual state for manual toggle
let heroManualOverride = false; // set true when user clicks canvas

function heroWait(ms) {
  return new Promise((resolve) => {
    heroCycleTimer = setTimeout(resolve, ms);
  });
}

async function initHeroCycle() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || isMobile) {
    // No animation: show content in State B permanently
    heroSection?.classList.add("is-content-mode");
    heroInStateA = false;
    return;
  }

  heroCycleRunning = true;
  heroCycleCount = 0;

  while (heroCycleRunning && heroCycleCount < HERO_MAX_LOOPS) {
    // ── State A: Shader + Glass + Content ──
    heroInStateA = true;
    await heroWait(HERO_DISPLAY_MS);
    if (!heroCycleRunning) break;

    // ── Transition A → B ──
    const { dissolveShader } = await loadHeroShader();
    await dissolveShader(HERO_TRANSITION_MS);
    heroSection.classList.add("is-content-mode");
    heroInStateA = false;
    heroCycleCount++;

    // On last loop, stay in State B permanently
    if (heroCycleCount >= HERO_MAX_LOOPS) break;

    // ── State B: Dark bg + Clean Content ──
    await heroWait(HERO_DISPLAY_MS);
    if (!heroCycleRunning) break;

    // ── Transition B → A ──
    heroSection.classList.remove("is-content-mode");
    await heroWait(50);
    const { materializeShader } = await loadHeroShader();
    await materializeShader(HERO_TRANSITION_MS);
  }

  heroCycleRunning = false;
}

// ── Manual Hero Toggle (click/tap canvas) ──
function initHeroManualToggle() {
  if (!heroSection || isMobile) return;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  heroSection.style.cursor = "pointer";
  heroSection.addEventListener("click", async (e) => {
    // Don't toggle if user clicked a button or link inside the hero
    if (e.target.closest("a, button")) return;
    if (!shaderActive) return;

    // Stop auto-cycle on first manual interaction
    if (heroCycleRunning) {
      heroCycleRunning = false;
      clearTimeout(heroCycleTimer);
    }
    heroManualOverride = true;

    if (heroInStateA) {
      // Dissolve to content (State B)
      const { dissolveShader } = await loadHeroShader();
      await dissolveShader(HERO_TRANSITION_MS);
      heroSection.classList.add("is-content-mode");
      heroInStateA = false;
    } else {
      // Materialize shader (State A)
      heroSection.classList.remove("is-content-mode");
      await heroWait(50);
      const { materializeShader } = await loadHeroShader();
      await materializeShader(HERO_TRANSITION_MS);
      heroInStateA = true;
    }
  });
}

// ── FAB + Sticky Bar (persistent CTAs) ──
function initPersistentCTAs() {
  const fabCta = document.getElementById("fab-cta");
  const stickyBar = document.getElementById("sticky-bar");
  const target = fabCta || stickyBar;
  if (!target) return;

  // Show persistent CTA when about section enters viewport AND
  // hide it when the footer enters view (so the footer's bottom bar
  // isn't covered by the sticky CTA at page-end).
  const trigger = document.getElementById("about") || heroSection || document.querySelector(".hero");
  if (!trigger) return;

  const footer = document.querySelector(".site-footer");
  let pastTrigger = false;
  let inFooter = false;

  function sync() {
    const show = pastTrigger && !inFooter;
    if (fabCta) fabCta.classList.toggle("is-visible", show);
    if (stickyBar) stickyBar.classList.toggle("is-visible", show);
  }

  const triggerObs = new IntersectionObserver(([entry]) => {
    pastTrigger = entry.isIntersecting || entry.boundingClientRect.top < 0;
    sync();
  }, { threshold: 0 });
  triggerObs.observe(trigger);

  if (footer) {
    const footerObs = new IntersectionObserver(([entry]) => {
      inFooter = entry.isIntersecting;
      sync();
    }, { threshold: 0 });
    footerObs.observe(footer);
  }
}

// ── Init ──
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

initSplash();
initHero(); // async — returns immediately, shader loads in background
initHeroTypewriter();
initHeroManualToggle();
initPersistentCTAs();
initInteractions();
initServicesFire();
initProcessSpace();
initTouchRipple();
updateModeToggleLabel();
updateThemeToggleLabel();

// ── Touch-ripple ──
// Cursor trails are disabled on touch (no hover, no continuous pointer
// position). To preserve the "scene reacts to your presence" feel on
// phones, we emit a small particle burst at every tap, tinted with
// the current section's signature color. Mobile-only, reduced-motion
// safe, doesn't interfere with click handlers (pointer-events: none on
// the container).
function initTouchRipple() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SECTION_RIPPLE = {
    hero:        { core: "210 100% 95%", halo: "210 90% 70%" },
    about:       { core: "50 100% 95%",  halo: "40 90% 65%"  },
    services:    { core: "20 100% 90%",  halo: "15 95% 60%"  },
    portfolio:   { core: "210 100% 92%", halo: "200 80% 65%" },
    process:     { core: "270 80% 88%",  halo: "260 80% 65%" },
  };
  const DEFAULT_RIPPLE = { core: "0 0% 95%", halo: "210 80% 70%" };

  const container = document.createElement("div");
  container.className = "touch-ripple-container";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);

  function getColorAt(x, y) {
    const sections = document.querySelectorAll("section[id]");
    for (const section of sections) {
      const r = section.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) {
        return SECTION_RIPPLE[section.id] || DEFAULT_RIPPLE;
      }
    }
    return DEFAULT_RIPPLE;
  }

  function spawn(x, y) {
    const color = getColorAt(x, y);
    const PARTICLE_COUNT = 6;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = document.createElement("span");
      particle.className = "touch-ripple-particle";
      particle.style.left = x + "px";
      particle.style.top = y + "px";
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      const distance = 16 + Math.random() * 14;
      particle.style.setProperty("--rx", Math.cos(angle) * distance + "px");
      particle.style.setProperty("--ry", Math.sin(angle) * distance + "px");
      particle.style.setProperty("--rcore", color.core);
      particle.style.setProperty("--rhalo", color.halo);
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 540);
    }
  }

  let lastSpawnAt = 0;
  document.addEventListener(
    "touchstart",
    (e) => {
      // Skip when typing — don't ripple on every keystroke
      if (e.target.closest("input, textarea, [contenteditable]")) return;
      // Throttle to one ripple per 80ms (multi-touch / accidental retap)
      const now = performance.now();
      if (now - lastSpawnAt < 80) return;
      lastSpawnAt = now;
      const t = e.touches[0];
      if (t) spawn(t.clientX, t.clientY);
    },
    { passive: true }
  );
}

// If mode is already chosen (returning visitor), splash was removed → start loader directly
if (getMode()) {
  startLoadingSequence();
}

// ── Event Listeners ──
modeToggle?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-mode");
  setMode(current === "arcade" ? "regular" : "arcade");
  // Micro-interaction: flip animation
  modeToggle.classList.add("is-transitioning");
  setTimeout(() => modeToggle.classList.remove("is-transitioning"), 450);
});

arcadeSwitch?.addEventListener("click", () => {
  setMode("regular");
});

themeToggle?.addEventListener("click", () => {
  setTheme(getTheme() === "dark" ? "light" : "dark");
  // Micro-interaction: spin + bounce animation
  themeToggle.classList.add("is-transitioning");
  setTimeout(() => themeToggle.classList.remove("is-transitioning"), 550);
});

navToggle?.addEventListener("click", handleNavToggle);

// Close mobile nav when clicking a link
navMenu?.querySelectorAll(".nav__link").forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

// ── Nav Dropdown ──
document.querySelectorAll(".nav__dropdown-toggle").forEach((toggle) => {
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = toggle.closest(".nav__dropdown");
    const isOpen = dropdown.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
});

document.addEventListener("click", () => {
  document.querySelectorAll(".nav__dropdown.is-open").forEach((d) => {
    d.classList.remove("is-open");
    d.querySelector(".nav__dropdown-toggle")?.setAttribute("aria-expanded", "false");
  });
});

// ── Header Scroll State ──
function updateHeaderScroll() {
  if (header) {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  }
}

window.addEventListener("scroll", updateHeaderScroll, { passive: true });
updateHeaderScroll();

// ── Scroll Reveal (Intersection Observer) ──
function initScrollReveal() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const revealElements = document.querySelectorAll(".reveal, .reveal--left, .reveal--right, .reveal--scale");
  if (!revealElements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  revealElements.forEach((el) => observer.observe(el));
}

// ── Portfolio Section In-View ──
function initPortfolioSection() {
  const section = document.getElementById("portfolio");
  if (!section) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add("is-in-view");
        observer.disconnect();
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(section);

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // ── Depth parallax ──
  // Translate each scene layer at a different rate as the section passes
  // through the viewport. Distant layers (depth fog) move slowest, close
  // layers (bubbles) move fastest — creating the illusion of looking into
  // water from the surface. Uses --parallax-y CSS vars on each layer so
  // existing animations don't fight with our transforms.
  if (!prefersReducedMotion) {
    const layers = [
      { el: section.querySelector(".portfolio__depth"),     factor: 0.02 },
      { el: section.querySelector(".portfolio__rays"),      factor: 0.08 },
      { el: section.querySelector(".portfolio__caustics"),  factor: 0.14 },
      { el: section.querySelector(".portfolio__particles"), factor: 0.22 },
      { el: section.querySelector(".portfolio__bubbles"),   factor: 0.34 },
    ].filter((l) => l.el);

    let ticking = false;
    let parallaxActive = false;

    function updateParallax() {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Progress through viewport: 0 when section top hits viewport bottom,
      // 1 when section bottom hits viewport top. Center = 0.5.
      const progress = (vh - rect.top) / (vh + rect.height);
      const centered = progress - 0.5;
      const range = rect.height * 0.6; // max parallax distance
      for (const { el, factor } of layers) {
        el.style.setProperty("--parallax-y", (centered * range * factor).toFixed(1) + "px");
      }
      ticking = false;
    }

    function onScroll() {
      if (!parallaxActive || ticking) return;
      ticking = true;
      requestAnimationFrame(updateParallax);
    }

    const parallaxObs = new IntersectionObserver(
      ([entry]) => {
        parallaxActive = entry.isIntersecting;
        if (parallaxActive) updateParallax();
      },
      { threshold: 0 }
    );
    parallaxObs.observe(section);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateParallax();
  }

  if (prefersReducedMotion) return;

  const trail = section.querySelector(".portfolio__cursor-trail");
  if (!trail) return;

  let lastSpawn = 0;
  const THROTTLE = 80; // ms between spawns
  const MAX_BUBBLES = 12;

  section.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastSpawn < THROTTLE) return;
    lastSpawn = now;

    // Cap active bubbles
    if (trail.children.length >= MAX_BUBBLES) return;

    const rect = section.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const intensity = getTrailIntensity();
    const size = (4 + Math.random() * 6) * intensity; // 4–10px × intensity

    const bubble = document.createElement("span");
    bubble.className = "trail-bubble";
    bubble.style.left = x + "px";
    bubble.style.top = y + "px";
    bubble.style.width = size + "px";
    bubble.style.height = size + "px";
    trail.appendChild(bubble);

    // Remove after animation ends
    bubble.addEventListener("animationend", () => bubble.remove(), {
      once: true,
    });
  });
}

// ── Testimonials Section In-View ──
function initTestimonialsSection() {
  const section = document.getElementById("testimonials");
  if (!section) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add("is-in-view");
        observer.disconnect();
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(section);
}

// ── CTA Band In-View (Aurora Fade) ──
function initCtaBandSection() {
  const section = document.querySelector(".cta-band");
  if (!section) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add("is-in-view");
        observer.disconnect();
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(section);
}

// ── Contact Section In-View (Aurora Fade) ──
function initContactSection() {
  const section = document.getElementById("contact");
  if (!section) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add("is-in-view");
        observer.disconnect();
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(section);
}

// ── Contact Network Canvas ──
// Drifting node network behind the contact form. Ported from the
// think_in_bits project hero and themed to the brand's secondary hue.
// Pauses when the section leaves the viewport and on reduced-motion.
function initContactNetwork() {
  const canvas = document.getElementById("contact-network-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Lower node density on phones — same visual character, much lighter
  // to animate alongside the contact-section content on mobile.
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const NODE_COUNT = isMobile ? 18 : 40;
  const CONNECT_DIST = isMobile ? 110 : 140;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // Brand hue/sat are re-read on theme changes so the network tracks the
  // active color scheme. Primary is the dominant brand hue (matches headings).
  let strokeBase = "";
  let fillBase = "";

  function readThemeColors() {
    const rootStyle = getComputedStyle(document.documentElement);
    const hue = rootStyle.getPropertyValue("--hue-primary").trim() || "265";
    const sat = rootStyle.getPropertyValue("--sat-primary").trim() || "80%";
    strokeBase = `hsla(${hue}, ${sat}, 65%, `;
    fillBase = `hsla(${hue}, ${sat}, 72%, `;
  }
  readThemeColors();

  let nodes = [];
  let animId = 0;
  let running = false;

  function resize() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function initNodes() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 1.8 + 1.2,
      });
    }
  }

  function draw() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * 0.28;
          ctx.beginPath();
          ctx.strokeStyle = strokeBase + alpha + ")";
          ctx.lineWidth = 1;
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = fillBase + "0.7)";
      ctx.fill();
    }
  }

  function update() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
  }

  function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  function start() {
    if (running || prefersReduced) return;
    running = true;
    animId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    animId = 0;
  }

  resize();
  initNodes();
  draw();

  // Only run the animation while the contact section is actually visible.
  const viewObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    },
    { threshold: 0.05 }
  );
  viewObserver.observe(canvas);

  window.addEventListener(
    "resize",
    () => {
      stop();
      resize();
      initNodes();
      draw();
      if (!prefersReduced) start();
    },
    { passive: true }
  );

  // Follow live theme changes so the network recolors without reload.
  window.addEventListener("gcoat-scheme-change", () => {
    readThemeColors();
    if (!running) draw();
  });
}

// ── Footer In-View (Aurora Fade) + Back to Top ──
function initFooterSection() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        footer.classList.add("is-in-view");
        observer.disconnect();
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(footer);

  const backToTop = footer.querySelector(".js-back-to-top");
  if (backToTop) {
    backToTop.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

// ── Process Section In-View + Stardust Cursor Trail ──
function initProcessSection() {
  const section = document.getElementById("process");
  if (!section) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add("is-in-view");
        observer.disconnect();
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(section);

  // Stardust cursor trail
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const trail = section.querySelector(".process__cursor-trail");
  if (!trail) return;

  let lastSpawn = 0;
  const THROTTLE = 90;
  const MAX_STARS = 12;

  section.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastSpawn < THROTTLE) return;
    lastSpawn = now;

    if (trail.children.length >= MAX_STARS) return;

    const rect = section.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const intensity = getTrailIntensity();
    const size = (1 + Math.random() * 3) * intensity; // 1–4px × intensity

    const star = document.createElement("span");
    star.className = "trail-star";
    star.style.left = x + "px";
    star.style.top = y + "px";
    star.style.width = size + "px";
    star.style.height = size + "px";
    star.style.setProperty("--star-dx", (Math.random() * 50 - 25) + "px");
    star.style.setProperty("--star-dy", (Math.random() * 50 - 25) + "px");
    trail.appendChild(star);

    star.addEventListener("animationend", () => star.remove(), { once: true });
  });
}

// ── About SVG Animation + Parallax ──
function initAboutVisual() {
  const visual = document.querySelector(".about__visual");
  if (!visual) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Lightning strike — fires the first time #about enters view, then
  // restrikes on every subsequent re-entry (cooldown enforced). Each
  // strike picks a random bolt variant so it doesn't look identical.
  if (!prefersReducedMotion) {
    const aboutSection = document.getElementById("about");
    const flashEl = document.getElementById("lightning-flash");
    const boltEl = aboutSection ? aboutSection.querySelector(".about__bolt") : null;

    if (aboutSection && boltEl) {
      let lightningTimers = [];
      let lastStrikeAt = 0;
      let isStriking = false;
      const STRIKE_COOLDOWN_MS = 6000;
      const INITIAL_DELAY_MS = 1500; // waits for reveal animations

      // Three hand-drawn bolt shapes — main path + 3 branches each.
      // Every strike picks one, so the lightning never looks identical
      // twice in a row but always stays anchored to the left edge.
      const BOLT_VARIANTS = [
        {
          main: "M10 0 L55 95 L80 88 L45 195 L75 188 L30 310 L60 300 L15 420 L50 410 L5 540 L40 530 L-5 700",
          b1: "M55 95 L110 140 L130 132 L155 185",
          b2: "M75 188 L125 230 L140 225 L170 270 L185 265 L200 310",
          b3: "M30 310 L-10 355 L-25 350 L-45 400",
        },
        {
          main: "M8 0 L62 82 L35 160 L78 232 L40 308 L72 382 L25 452 L62 528 L12 598 L52 660 L-2 700",
          b1: "M62 82 L118 118 L134 112 L162 162",
          b2: "M72 382 L128 420 L146 414 L178 460 L195 455",
          b3: "M40 308 L-8 348 L-24 342 L-42 385",
        },
        {
          main: "M12 0 L48 85 L82 78 L38 170 L72 240 L28 328 L64 404 L20 488 L58 572 L14 652 L0 700",
          b1: "M48 85 L100 125 L118 120 L148 172",
          b2: "M72 240 L122 278 L140 272 L175 318 L192 314 L215 354",
          b3: "M28 328 L-12 372 L-28 368 L-48 412",
        },
      ];

      const mainPaths = boltEl.querySelectorAll(
        ".about__bolt-ambient, .about__bolt-ambient-primary, .about__bolt-glow, .about__bolt-path, .about__bolt-core"
      );
      const b1Paths = boltEl.querySelectorAll(".about__bolt-branch--1");
      const b2Paths = boltEl.querySelectorAll(".about__bolt-branch--2");
      const b3Paths = boltEl.querySelectorAll(".about__bolt-branch--3");
      let lastVariantIdx = -1;

      const clearTimers = () => { lightningTimers.forEach(clearTimeout); lightningTimers = []; };
      const pushTimer = (fn, ms) => { lightningTimers.push(setTimeout(fn, ms)); };

      function pickVariantIdx() {
        let idx = lastVariantIdx;
        while (idx === lastVariantIdx) {
          idx = Math.floor(Math.random() * BOLT_VARIANTS.length);
        }
        lastVariantIdx = idx;
        return idx;
      }

      function applyVariant(idx) {
        const v = BOLT_VARIANTS[idx];
        mainPaths.forEach((el) => el.setAttribute("d", v.main));
        b1Paths.forEach((el) => el.setAttribute("d", v.b1));
        b2Paths.forEach((el) => el.setAttribute("d", v.b2));
        b3Paths.forEach((el) => el.setAttribute("d", v.b3));
      }

      // Seed initial variant so the SVG matches one of our hand-drawn
      // shapes from first paint.
      applyVariant(pickVariantIdx());

      function strike() {
        if (isStriking) return;
        if (!document.body.contains(aboutSection)) { clearTimers(); return; }
        isStriking = true;
        lastStrikeAt = Date.now();

        // Reset any residual state from a previous strike
        aboutSection.classList.remove("is-lightning", "is-cascade", "is-glow-linger");
        if (flashEl) flashEl.classList.remove("is-flashing");
        // Force a reflow so restart of animations is reliable
        // eslint-disable-next-line no-unused-expressions
        boltEl.offsetWidth;

        // Swap in a different hand-drawn bolt path for this strike
        applyVariant(pickVariantIdx());

        // Pre-strike charge (1200ms build-up)
        aboutSection.classList.add("is-charging");

        pushTimer(() => {
          if (!document.body.contains(aboutSection)) return;
          aboutSection.classList.remove("is-charging");
          aboutSection.classList.add("is-lightning");

          // Fire the viewport flash a beat after the bolt starts drawing
          pushTimer(() => {
            if (flashEl) {
              flashEl.classList.remove("is-flashing");
              // eslint-disable-next-line no-unused-expressions
              flashEl.offsetWidth;
              flashEl.classList.add("is-flashing");
              pushTimer(() => flashEl.classList.remove("is-flashing"), 280);
            }
          }, 60);

          // Pillar energy cascade
          pushTimer(() => {
            aboutSection.classList.add("is-cascade");
            pushTimer(() => aboutSection.classList.remove("is-cascade"), 950);
          }, 150);

          // Bolt fades, hand off to glow aftertrace
          pushTimer(() => {
            aboutSection.classList.remove("is-lightning");
            aboutSection.classList.add("is-glow-linger");
            pushTimer(() => {
              aboutSection.classList.remove("is-glow-linger");
              isStriking = false;
            }, 3000);
          }, 1200);
        }, 1200);
      }

      const lightningObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const since = Date.now() - lastStrikeAt;
            if (since < STRIKE_COOLDOWN_MS && lastStrikeAt !== 0) return;
            // First strike waits for reveals; subsequent strikes fire sooner.
            const delay = lastStrikeAt === 0 ? INITIAL_DELAY_MS : 400;
            pushTimer(strike, delay);
          });
        },
        { threshold: 0.45 }
      );
      lightningObs.observe(aboutSection);

      // Ambient electrical sparks — realistic static / arc / corona
      // effects that flicker at random positions while the section is
      // in view. Pauses when section leaves viewport.
      const sparksContainer = aboutSection.querySelector(".about__sparks");
      if (sparksContainer) {
        const SVG_NS = "http://www.w3.org/2000/svg";
        let sparksTimer = null;
        let sparksVisible = false;

        // Pick a random spawn position. Biased toward the left half of
        // the section where the bolt lives, since that area would hold
        // residual charge in a real discharge scenario.
        function pickPosition() {
          const xBias = Math.random();
          let x;
          if (xBias < 0.65) x = 3 + Math.random() * 42;       // 3–45% left region
          else if (xBias < 0.88) x = 45 + Math.random() * 35; // 45–80% middle
          else x = 80 + Math.random() * 17;                   // 80–97% right edge
          const y = 8 + Math.random() * 80;
          return { x, y };
        }

        // Type 1: Static discharge with radiating filaments.
        // Bright core + 5–7 short streaks at random angles.
        function buildCharge() {
          const wrap = document.createElement("span");
          wrap.className = "about__spark about__spark--charge";
          const core = document.createElement("span");
          core.className = "about__spark-core";
          wrap.appendChild(core);
          const count = 5 + Math.floor(Math.random() * 3);
          const jitter = (Math.random() - 0.5) * 30;
          for (let i = 0; i < count; i++) {
            const fil = document.createElement("span");
            fil.className = "about__spark-filament";
            const angle = (360 / count) * i + jitter + (Math.random() - 0.5) * 18;
            const len = 10 + Math.random() * 16;
            fil.style.setProperty("--fil-rot", angle.toFixed(1) + "deg");
            fil.style.setProperty("--fil-len", len.toFixed(0) + "px");
            fil.style.animationDelay = (Math.random() * 40).toFixed(0) + "ms";
            wrap.appendChild(fil);
          }
          return { el: wrap, ttl: 280 };
        }

        // Type 2: Procedurally-generated jagged mini-bolt.
        // Random direction + segment count + perpendicular noise.
        function buildBolt() {
          const svg = document.createElementNS(SVG_NS, "svg");
          svg.setAttribute("class", "about__spark about__spark--bolt");
          svg.setAttribute("viewBox", "-40 -40 80 80");
          const length = 22 + Math.random() * 28;
          const angle = Math.random() * Math.PI * 2;
          const segCount = 3 + Math.floor(Math.random() * 3);
          const pts = [[0, 0]];
          for (let i = 1; i <= segCount; i++) {
            const t = i / segCount;
            const r = t * length;
            const perp = (Math.random() - 0.5) * 10;
            const px = Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * perp;
            const py = Math.sin(angle) * r + Math.sin(angle + Math.PI / 2) * perp;
            pts.push([px.toFixed(1), py.toFixed(1)]);
          }
          const d = "M" + pts.map((p) => p.join(",")).join(" L");
          // Chance of a small branch off a middle vertex
          let branchD = null;
          if (pts.length >= 4 && Math.random() < 0.5) {
            const origin = pts[1 + Math.floor(Math.random() * (pts.length - 2))];
            const bAngle = angle + (Math.random() - 0.5) * Math.PI * 0.6;
            const bLen = 8 + Math.random() * 12;
            const bSeg = 2;
            const bpts = [[Number(origin[0]), Number(origin[1])]];
            for (let i = 1; i <= bSeg; i++) {
              const t = i / bSeg;
              const r = t * bLen;
              const perp = (Math.random() - 0.5) * 6;
              const bx = Number(origin[0]) + Math.cos(bAngle) * r + Math.cos(bAngle + Math.PI / 2) * perp;
              const by = Number(origin[1]) + Math.sin(bAngle) * r + Math.sin(bAngle + Math.PI / 2) * perp;
              bpts.push([bx.toFixed(1), by.toFixed(1)]);
            }
            branchD = "M" + bpts.map((p) => p.join(",")).join(" L");
          }

          const glow = document.createElementNS(SVG_NS, "path");
          glow.setAttribute("d", d);
          glow.setAttribute("class", "about__spark-bolt-glow");
          const core = document.createElementNS(SVG_NS, "path");
          core.setAttribute("d", d);
          core.setAttribute("class", "about__spark-bolt-core");
          svg.appendChild(glow);
          svg.appendChild(core);

          if (branchD) {
            const bGlow = document.createElementNS(SVG_NS, "path");
            bGlow.setAttribute("d", branchD);
            bGlow.setAttribute("class", "about__spark-bolt-glow");
            bGlow.setAttribute("opacity", "0.4");
            const bCore = document.createElementNS(SVG_NS, "path");
            bCore.setAttribute("d", branchD);
            bCore.setAttribute("class", "about__spark-bolt-core");
            bCore.setAttribute("opacity", "0.8");
            bCore.setAttribute("stroke-width", "0.9");
            svg.appendChild(bGlow);
            svg.appendChild(bCore);
          }
          return { el: svg, ttl: 340 };
        }

        // Type 3: Expanding corona ring (ionization discharge).
        function buildCorona() {
          const el = document.createElement("span");
          el.className = "about__spark about__spark--corona";
          return { el, ttl: 440 };
        }

        function spawnSpark() {
          if (!sparksVisible || !document.body.contains(aboutSection)) return;
          const roll = Math.random();
          let spark;
          if (roll < 0.45) spark = buildCharge();
          else if (roll < 0.8) spark = buildBolt();
          else spark = buildCorona();

          const pos = pickPosition();
          spark.el.style.left = pos.x.toFixed(1) + "%";
          spark.el.style.top = pos.y.toFixed(1) + "%";
          sparksContainer.appendChild(spark.el);
          setTimeout(() => spark.el.remove(), spark.ttl + 60);
        }

        function scheduleSpark() {
          const delay = 500 + Math.random() * 2200; // 0.5–2.7s
          sparksTimer = setTimeout(() => {
            spawnSpark();
            // Burst cluster — 55% chance of a chain follow-up
            if (Math.random() < 0.55) {
              setTimeout(spawnSpark, 60 + Math.random() * 140);
              if (Math.random() < 0.6) {
                setTimeout(spawnSpark, 160 + Math.random() * 220);
                if (Math.random() < 0.35) {
                  setTimeout(spawnSpark, 300 + Math.random() * 260);
                }
              }
            }
            scheduleSpark();
          }, delay);
        }

        const sparksObs = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                if (!sparksVisible) {
                  sparksVisible = true;
                  // First spark fires quickly so the effect registers
                  setTimeout(spawnSpark, 400 + Math.random() * 600);
                  scheduleSpark();
                }
              } else {
                sparksVisible = false;
                if (sparksTimer) clearTimeout(sparksTimer);
                sparksTimer = null;
              }
            });
          },
          { threshold: 0.15 }
        );
        sparksObs.observe(aboutSection);
      }
    }
  }

  // Trigger SVG animations when section scrolls into view
  if (!prefersReducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-animated");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(visual);
  }

  // Spark cursor trail — electric sparks follow mouse
  if (!prefersReducedMotion && !window.matchMedia("(pointer: coarse)").matches) {
    const aboutSection = document.getElementById("about");
    const trail = aboutSection && aboutSection.querySelector(".about__cursor-trail");
    if (trail) {
      let lastSpawn = 0;
      const THROTTLE = 60;
      const MAX_SPARKS = 15;

      aboutSection.addEventListener("mousemove", (e) => {
        const now = Date.now();
        if (now - lastSpawn < THROTTLE) return;
        lastSpawn = now;

        if (trail.children.length >= MAX_SPARKS) return;

        const rect = aboutSection.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const intensity = getTrailIntensity();
        const size = (2 + Math.random() * 3) * intensity; // 2–5px × intensity

        const spark = document.createElement("span");
        spark.className = "trail-spark";
        spark.style.left = x + "px";
        spark.style.top = y + "px";
        spark.style.width = size + "px";
        spark.style.height = size + "px";
        spark.style.setProperty("--spark-dx", (Math.random() * 60 - 30) + "px");
        spark.style.setProperty("--spark-dy", (Math.random() * 60 - 30) + "px");
        trail.appendChild(spark);

        spark.addEventListener("animationend", () => spark.remove(), { once: true });
      });
    }
  }

  // Subtle parallax on floating SVG elements (desktop only, GSAP)
  if (prefersReducedMotion || !window.gsap) return;
  const floats = visual.querySelectorAll(".about__svg-float");
  if (!floats.length) return;

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const rect = visual.getBoundingClientRect();
      const viewH = window.innerHeight;
      // progress 0→1 as section scrolls through viewport
      const progress = 1 - (rect.top + rect.height) / (viewH + rect.height);
      const clamped = Math.max(0, Math.min(1, progress));
      const offset = (clamped - 0.5) * 20; // ±10px range
      floats.forEach((el, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        gsap.set(el, { y: offset * dir });
      });
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
}

// ── Services Cursor Ember Trail ──
function initServicesCursorTrail() {
  const section = document.getElementById("services");
  if (!section) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const trail = section.querySelector(".services__cursor-trail");
  if (!trail) return;

  let lastSpawn = 0;
  const THROTTLE = 70;
  const MAX_EMBERS = 10;

  section.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastSpawn < THROTTLE) return;
    lastSpawn = now;

    if (trail.children.length >= MAX_EMBERS) return;

    const rect = section.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const intensity = getTrailIntensity();
    const size = (3 + Math.random() * 4) * intensity; // 3–7px × intensity

    const ember = document.createElement("span");
    ember.className = "trail-ember";
    ember.style.left = x + "px";
    ember.style.top = y + "px";
    ember.style.width = size + "px";
    ember.style.height = size + "px";
    ember.style.setProperty("--ember-dx", (Math.random() * 20 - 10) + "px");
    trail.appendChild(ember);

    ember.addEventListener("animationend", () => ember.remove(), { once: true });
  });
}

// ── Hero Cursor Circuit Trail ──
function initHeroCursorTrail() {
  const section = document.getElementById("hero");
  if (!section) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  const trail = section.querySelector(".hero__cursor-trail");
  if (!trail) return;

  let lastSpawn = 0;
  const THROTTLE = 55;
  const MAX_CIRCUITS = 14;

  section.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastSpawn < THROTTLE) return;
    lastSpawn = now;

    if (trail.children.length >= MAX_CIRCUITS) return;

    const rect = section.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const intensity = getTrailIntensity();
    const size = (3 + Math.random() * 4) * intensity; // 3–7px × intensity

    const circuit = document.createElement("span");
    circuit.className = "trail-circuit";
    circuit.style.left = x + "px";
    circuit.style.top = y + "px";
    circuit.style.width = size + "px";
    circuit.style.height = size + "px";
    circuit.style.setProperty("--circuit-dx", (Math.random() * 24 - 12) + "px");
    circuit.style.setProperty("--circuit-dy", (Math.random() * 20 - 16) + "px");
    trail.appendChild(circuit);

    circuit.addEventListener("animationend", () => circuit.remove(), { once: true });
  });
}

initScrollReveal();
initPortfolioSection();
initProcessSection();
initTestimonialsSection();
initCtaBandSection();
initContactSection();
initContactNetwork();
initFooterSection();
initAboutVisual();
initServicesCursorTrail();
initHeroCursorTrail();
initStatCounters();
initIntakeToggle();
initContactForm();
initSignupForm();
initNewsletterInlineForm();

// ── Handlers ──
const navBackdrop = document.querySelector(".js-nav-backdrop");
const navClose = document.querySelector(".js-nav-close");

function setNavOpen(open) {
  if (!navMenu || !navToggle) return;
  navMenu.classList.toggle("is-open", open);
  navBackdrop?.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  // Scroll-lock the body while the drawer is open.
  if (open) {
    document.body.setAttribute("data-nav-open", "true");
    // Reset drawer scroll so second-opens always start at the top
    // instead of wherever the user last left it.
    navMenu.scrollTop = 0;
  } else {
    document.body.removeAttribute("data-nav-open");
    // Clear any in-flight swipe transform + backdrop opacity
    navMenu.style.transform = "";
    navMenu.classList.remove("is-dragging");
    if (navBackdrop) navBackdrop.style.opacity = "";
  }
}

function handleNavToggle() {
  const open = !navMenu?.classList.contains("is-open");
  setNavOpen(open);
}

// Close drawer on backdrop tap or close button.
navBackdrop?.addEventListener("click", () => setNavOpen(false));
navClose?.addEventListener("click", () => setNavOpen(false));

// Close drawer when any in-drawer link is tapped (so users who pick a
// section see the page immediately, not a lingering overlay).
navMenu?.addEventListener("click", (e) => {
  const link = e.target.closest("a.nav__link, a.nav__cta, a.nav__dropdown-item");
  if (link) setNavOpen(false);
});

// Close on Escape.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && navMenu?.classList.contains("is-open")) {
    setNavOpen(false);
    navToggle?.focus();
  }
});

// Auto-close if the viewport resizes past the mobile breakpoint while
// the drawer is open (avoids leaving the body scroll-locked on desktop).
const navBpQuery = window.matchMedia("(min-width: 768px)");
navBpQuery.addEventListener("change", (e) => {
  if (e.matches && navMenu?.classList.contains("is-open")) {
    setNavOpen(false);
  }
});

// ── Active section indicator in the mobile drawer ──
// Highlights the nav link for the section currently most visible in
// the viewport. Uses the same IntersectionObserver pattern the desktop
// active-section indicator uses, but targets the drawer links too.
if (navMenu) {
  const navSectionLinks = navMenu.querySelectorAll('.nav__link[href^="#"]');
  if (navSectionLinks.length) {
    const sectionMap = new Map();
    navSectionLinks.forEach((link) => {
      const id = link.getAttribute("href").slice(1);
      const section = document.getElementById(id);
      if (section) sectionMap.set(section, link);
    });
    const activeObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = sectionMap.get(entry.target);
          if (!link) return;
          if (entry.isIntersecting) {
            navSectionLinks.forEach((l) => l.classList.remove("is-active"));
            link.classList.add("is-active");
          }
        });
      },
      { threshold: 0.25, rootMargin: "-72px 0px -40% 0px" }
    );
    sectionMap.forEach((_, section) => activeObs.observe(section));
  }
}

// ── Swipe-to-close gesture ──
// Drag the drawer rightwards with one finger; release past threshold
// closes it, else snaps back. Edge-case: ignore multi-touch, ignore
// downward swipes (user is trying to scroll inside the drawer).
(function attachSwipeToClose() {
  if (!navMenu) return;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let blocked = false;
  let drawerWidth = 360;

  function onTouchStart(e) {
    if (!navMenu.classList.contains("is-open") || e.touches.length !== 1) return;
    // Only start drag if touch begins on drawer itself (not the backdrop)
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = true;
    blocked = false;
    drawerWidth = navMenu.offsetWidth || 360;
  }

  function onTouchMove(e) {
    if (!dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // If the user's gesture is more vertical than horizontal in the
    // first few pixels, treat it as a scroll and skip drag.
    if (!blocked && Math.abs(dy) > Math.abs(dx) + 4) {
      blocked = true;
      return;
    }
    if (blocked) return;
    if (dx <= 0) {
      // Leftward pull — don't move, could use for a subtle resist effect
      navMenu.style.transform = "translate3d(0, 0, 0)";
      return;
    }
    navMenu.classList.add("is-dragging");
    navMenu.style.transform = `translate3d(${dx}px, 0, 0)`;
    // Dim the backdrop proportionally so it feels connected
    if (navBackdrop) {
      const frac = 1 - Math.min(dx / drawerWidth, 1);
      navBackdrop.style.opacity = String(frac);
    }
  }

  function onTouchEnd(e) {
    if (!dragging) return;
    dragging = false;
    navMenu.classList.remove("is-dragging");
    const endX = (e.changedTouches && e.changedTouches[0]?.clientX) || startX;
    const dx = endX - startX;
    navMenu.style.transform = "";
    if (navBackdrop) navBackdrop.style.opacity = "";
    // Threshold: 30% of drawer width OR >= 90px — close
    if (!blocked && dx > Math.min(drawerWidth * 0.3, 90)) {
      setNavOpen(false);
    }
  }

  navMenu.addEventListener("touchstart", onTouchStart, { passive: true });
  navMenu.addEventListener("touchmove", onTouchMove, { passive: true });
  navMenu.addEventListener("touchend", onTouchEnd, { passive: true });
  navMenu.addEventListener("touchcancel", onTouchEnd, { passive: true });
})();

// ── UI Helpers ──
function showStatus(el, type, message) {
  if (el) {
    el.textContent = message;
    el.className = `form-status form-status--${type}`;
    el.hidden = false;
  }
  if (announcer) {
    announcer.textContent = message;
  }
}

// ── Stat Counter Animation ──
function initStatCounters() {
  const numbers = document.querySelectorAll("[data-count]");
  if (!numbers.length) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    numbers.forEach((el) => { el.textContent = el.getAttribute("data-count"); });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  numbers.forEach((el) => observer.observe(el));
}

function animateCount(el) {
  const target = parseInt(el.getAttribute("data-count"), 10);
  const duration = 1500;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Spring-overshoot easing: ease-out with ~6% overshoot then settle
    const eased = 1 - Math.pow(1 - progress, 3) + 0.06 * Math.sin(progress * Math.PI) * (1 - progress);
    el.textContent = String(Math.round(eased * target));
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ── Form Validation ──
function validateField(input) {
  const errorEl = document.getElementById(input.id + "-error");
  let message = "";

  if (input.validity.valueMissing) {
    message = "This field is required.";
  } else if (input.validity.typeMismatch && input.type === "email") {
    message = "Please enter a valid email address.";
  } else if (input.validity.tooLong) {
    message = `Maximum ${input.maxLength} characters.`;
  }

  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  input.classList.toggle("has-error", !!message);
  return !message;
}

function validateForm(form) {
  const required = form.querySelectorAll("[required]");
  let valid = true;
  required.forEach((input) => {
    if (!validateField(input)) valid = false;
  });
  return valid;
}

function collectFormData(form) {
  const fd = new FormData(form);
  const data = {};
  for (const [key, value] of fd.entries()) {
    if (key === "website") continue;
    if (key === "features") {
      if (!data.features) data.features = [];
      data.features.push(value);
      continue;
    }
    data[key] = value;
  }

  // Branding: if "Other" radio selected (empty value), use the custom text input
  if (data.brandingStatus === "") {
    const otherInput = form.querySelector("#intake-branding-other");
    if (otherInput?.value.trim()) data.brandingStatus = otherInput.value.trim();
    else delete data.brandingStatus;
  }

  return data;
}

function isHoneypotFilled(form) {
  const hp = form.querySelector('.hp input');
  return hp && hp.value.length > 0;
}

// ── Intake Toggle (Chat / Form) ──
function initIntakeToggle() {
  const chatPanel = document.getElementById("intake-chat-panel");
  const formPanel = document.getElementById("intake-form-panel");
  if (!chatPanel && !formPanel) return;

  const tabs = document.querySelectorAll(".intake-toggle__btn");
  let chatInitialized = false;
  let formInitialized = false;

  // Init the default visible panel
  if (chatPanel && !chatPanel.hidden) {
    initIntakeChat();
    chatInitialized = true;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;

      // Update tab states
      tabs.forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");

      // Toggle panels
      if (mode === "chat") {
        if (chatPanel) chatPanel.hidden = false;
        if (formPanel) formPanel.hidden = true;
        if (!chatInitialized) {
          initIntakeChat();
          chatInitialized = true;
        }
      } else {
        if (formPanel) formPanel.hidden = false;
        if (chatPanel) chatPanel.hidden = true;
        if (!formInitialized) {
          initIntakeForm();
          formInitialized = true;
        }
      }
    });
  });

  // Arrow key navigation between tabs
  const tabList = document.querySelector(".intake-toggle");
  if (tabList) {
    tabList.addEventListener("keydown", (e) => {
      const tabArr = [...tabs];
      const idx = tabArr.indexOf(document.activeElement);
      if (idx < 0) return;
      let next = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % tabArr.length;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + tabArr.length) % tabArr.length;
      if (next >= 0) {
        e.preventDefault();
        tabArr[next].focus();
        tabArr[next].click();
      }
    });
  }
}

// ── Intake Form Handler (static form mode) ──
function initIntakeForm() {
  const form = document.getElementById("intake-form");
  if (!form) return;

  const statusEl = document.getElementById("intake-status");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.querySelectorAll("[required]").forEach((input) => {
    input.addEventListener("blur", () => validateField(input));
  });

  // Branding status: show/hide custom input when "Other" is selected
  const brandingRadios = form.querySelectorAll('input[name="brandingStatus"]');
  const brandingOtherInput = form.querySelector("#intake-branding-other");
  if (brandingRadios.length && brandingOtherInput) {
    brandingRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        const isOther = radio.closest(".chip--other-toggle") !== null;
        brandingOtherInput.hidden = !isOther;
        if (isOther) brandingOtherInput.focus();
      });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isHoneypotFilled(form)) return;
    if (!validateForm(form)) return;

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    try {
      const data = collectFormData(form);
      data.source = "intake";
      await submitLead(data);
      window.gtag?.("event", "form_submission", { form_type: "intake" });
      showStatus(statusEl, "success", "Thank you! We'll be in touch within 24 hours.");
      form.reset();
    } catch {
      showStatus(statusEl, "error", "Something went wrong. Please try again.");
    } finally {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }
  });
}

// ── Contact Form Handler ──
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusEl = document.getElementById("contact-status");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.querySelectorAll("[required]").forEach((input) => {
    input.addEventListener("blur", () => validateField(input));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isHoneypotFilled(form)) return;
    if (!validateForm(form)) return;

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    try {
      const data = collectFormData(form);
      data.source = "contact";
      await submitLead(data);
      window.gtag?.("event", "form_submission", { form_type: "contact" });
      showStatus(statusEl, "success", "Message sent! We'll get back to you soon.");
      form.reset();
    } catch {
      showStatus(statusEl, "error", "Something went wrong. Please try again.");
    } finally {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }
  });
}

// ── Signup (Newsletter) Form Handler ──
function initSignupForm() {
  const form = document.getElementById("signup-form");
  if (!form) return;

  const statusEl = document.getElementById("signup-status");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isHoneypotFilled(form)) return;

    const emailInput = form.querySelector('input[name="email"]');
    if (!validateField(emailInput)) return;

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    try {
      const data = { email: emailInput.value.trim(), source: "signup" };
      await submitLead(data);
      window.gtag?.("event", "newsletter_signup", { form_type: "signup" });
      showStatus(statusEl, "success", "You're subscribed!");
      form.reset();
    } catch {
      showStatus(statusEl, "error", "Something went wrong. Please try again.");
    } finally {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }
  });
}

function initNewsletterInlineForm() {
  const form = document.getElementById("newsletter-inline-form");
  if (!form) return;

  const statusEl = document.getElementById("newsletter-status");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isHoneypotFilled(form)) return;

    const emailInput = form.querySelector('input[name="email"]');
    if (!validateField(emailInput)) return;

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    try {
      const data = { email: emailInput.value.trim(), source: "signup" };
      await submitLead(data);
      window.gtag?.("event", "newsletter_signup", { form_type: "newsletter_inline" });
      showStatus(statusEl, "success", "You're subscribed!");
      form.reset();
    } catch {
      showStatus(statusEl, "error", "Something went wrong. Please try again.");
    } finally {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    }
  });
}
