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
initStatCounters();
initIntakeForm();
initContactForm();
initSignupForm();

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
    const eased = 1 - Math.pow(1 - progress, 3);
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
  if (data.features) data.features = data.features.join(", ");
  return data;
}

function isHoneypotFilled(form) {
  const hp = form.querySelector('.hp input');
  return hp && hp.value.length > 0;
}

// ── Intake Form Handler ──
function initIntakeForm() {
  const form = document.getElementById("intake-form");
  if (!form) return;

  const statusEl = document.getElementById("intake-status");
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
      data.source = "intake";
      await submitLead(data);
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
