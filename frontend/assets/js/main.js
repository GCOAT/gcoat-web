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

  // Show persistent CTA when about section enters viewport
  const trigger = document.getElementById("about") || heroSection || document.querySelector(".hero");
  if (!trigger) return;

  const obs = new IntersectionObserver(([entry]) => {
    const show = entry.isIntersecting || entry.boundingClientRect.top < 0;
    if (fabCta) fabCta.classList.toggle("is-visible", show);
    if (stickyBar) stickyBar.classList.toggle("is-visible", show);
  }, { threshold: 0 });

  obs.observe(trigger);
}

// ── Scroll Progress Bar ──
function initScrollProgress() {
  const bar = document.getElementById("scroll-progress");
  if (!bar) return;
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = pct + "%";
      ticking = false;
    });
  }, { passive: true });
}

// ── Init ──
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

initSplash();
initHero(); // async — returns immediately, shader loads in background
initHeroManualToggle();
initPersistentCTAs();
initScrollProgress();
initInteractions();
initServicesFire();
initProcessSpace();
updateModeToggleLabel();
updateThemeToggleLabel();

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

  // Cursor bubble trail — spawn tiny bubbles on mouse move
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
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
    const size = 4 + Math.random() * 6; // 4–10px

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
    const size = 1 + Math.random() * 3; // 1–4px

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

  // Lightning strike — one-shot flash when section enters viewport
  if (!prefersReducedMotion) {
    const aboutSection = document.getElementById("about");
    if (aboutSection) {
      let lightningTimers = [];
      const clearTimers = () => { lightningTimers.forEach(clearTimeout); lightningTimers = []; };

      const lightningObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              lightningObs.unobserve(aboutSection);

              // Wait for all pillar reveals + SVG animations to finish before striking.
              // Scroll-reveal (0.15 threshold) fires before us (0.45):
              //   max stagger delay 240ms + 600ms transition = 840ms
              //   SVG code lines: up to 800ms delay + 600ms = 1400ms
              // 1500ms guarantees everything has resolved.
              lightningTimers.push(setTimeout(() => {
                // Verify section is still in DOM (SPA safety)
                if (!document.body.contains(aboutSection)) { clearTimers(); return; }

                aboutSection.classList.add("is-lightning");

                // t+150ms — bolt has drawn, start pillar energy cascade
                lightningTimers.push(setTimeout(() => {
                  aboutSection.classList.add("is-cascade");

                  // t+1100ms — all pillar anims done (4th: 360ms delay + 500ms = 860ms)
                  lightningTimers.push(setTimeout(() => {
                    aboutSection.classList.remove("is-cascade");
                  }, 950));
                }, 150));

                // t+1200ms — bolt fades out, hand off to lingering glow
                lightningTimers.push(setTimeout(() => {
                  aboutSection.classList.remove("is-lightning");
                  aboutSection.classList.add("is-glow-linger");

                  // t+4200ms — glow fade animation (3s) done
                  lightningTimers.push(setTimeout(() => {
                    aboutSection.classList.remove("is-glow-linger");
                    lightningTimers = []; // sequence complete
                  }, 3000));
                }, 1200));
              }, 1500));
            }
          });
        },
        { threshold: 0.45 }
      );
      lightningObs.observe(aboutSection);
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
        const size = 2 + Math.random() * 3; // 2–5px

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
    const size = 3 + Math.random() * 4; // 3–7px

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

initScrollReveal();
initPortfolioSection();
initProcessSection();
initTestimonialsSection();
initCtaBandSection();
initContactSection();
initFooterSection();
initAboutVisual();
initServicesCursorTrail();
initStatCounters();
initIntakeToggle();
initContactForm();
initSignupForm();
initNewsletterInlineForm();

// ── Handlers ──
function handleNavToggle() {
  const isOpen = navMenu?.classList.toggle("is-open");
  navToggle?.setAttribute("aria-expanded", String(isOpen));
}

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
