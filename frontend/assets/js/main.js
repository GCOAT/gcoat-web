// main.js — ES module

// Module loaded successfully — cancel the fallback timeout from init.js
clearTimeout(window.__jsModuleTimeout);

import { submitLead } from "./api.js";

// ── DOM References ──
const yearEl = document.getElementById("year");
const form = document.querySelector("#contact-form");
const submitBtn = form?.querySelector("button[type='submit']");
const statusEl = document.querySelector("#form-status");
const announcer = document.querySelector("#status-announcer");
const navToggle = document.querySelector(".js-nav-toggle");
const navMenu = document.querySelector("#nav-menu");
const header = document.querySelector(".site-header");

// ── Init ──
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

// ── Event Listeners ──
form?.addEventListener("submit", handleFormSubmit);
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

async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  // Honeypot check — silently discard
  if (data.website) {
    showStatus("success", "Thank you! Your message has been sent.");
    e.target.reset();
    return;
  }
  delete data.website;

  // Client-side validation
  if (!data.email || !data.email.includes("@")) {
    showStatus("error", "Please enter a valid email address.");
    return;
  }

  // Add source
  data.source = "kore-starter";

  setFormLoading(true);

  try {
    await submitLead(data);
    showStatus("success", "Sent! We\u2019ll get back to you soon.");
    e.target.reset();
  } catch (error) {
    showStatus("error", error.message || "Something went wrong. Please try again.");
  } finally {
    setFormLoading(false);
  }
}

// ── UI Helpers ──
function setFormLoading(isLoading) {
  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitBtn.textContent = isLoading ? "Sending\u2026" : "Send Message";
  }
}

function showStatus(type, message) {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `form-status form-status--${type}`;
    statusEl.hidden = false;
  }
  // Announce to screen readers
  if (announcer) {
    announcer.textContent = message;
  }
}
