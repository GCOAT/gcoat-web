// main.js — ES module

// Module loaded successfully — cancel the fallback timeout from init.js
clearTimeout(window.__jsModuleTimeout);

import { submitLead } from "./api.js";

// ── DOM References ──
const yearEl = document.getElementById("year");
const navToggle = document.querySelector(".js-nav-toggle");
const navMenu = document.querySelector("#nav-menu");
const header = document.querySelector(".site-header");
const splash = document.getElementById("mode-splash");
const modeToggle = document.querySelector(".js-mode-toggle");
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
      splash.addEventListener("animationend", () => splash.remove(), { once: true });
    });
  });
}

// ── Init ──
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

initSplash();
updateModeToggleLabel();

// ── Event Listeners ──
modeToggle?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-mode");
  setMode(current === "arcade" ? "regular" : "arcade");
});

arcadeSwitch?.addEventListener("click", () => {
  setMode("regular");
});

navToggle?.addEventListener("click", handleNavToggle);

// Close mobile nav when clicking a link
navMenu?.querySelectorAll(".nav__link").forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
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

initScrollReveal();

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
