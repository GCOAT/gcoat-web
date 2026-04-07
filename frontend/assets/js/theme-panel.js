// theme-panel.js — Design panel: color scheme presets, HSL sliders, font changer

const FONT_URLS = {
  tech: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
  classic: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap",
  geometric: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap",
  mono: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  system: "",
};

const SCHEME_DEFAULTS = {
  monochrome:  { huePrimary: "220", satPrimary: "10%", lightPrimary: "45%", hueSecondary: "220", satSecondary: "60%", lightSecondary: "50%" },
  electric:    { huePrimary: "250", satPrimary: "90%", lightPrimary: "44%", hueSecondary: "60",  satSecondary: "90%", lightSecondary: "44%" },
  midnight:    { huePrimary: "270", satPrimary: "80%", lightPrimary: "50%", hueSecondary: "185", satSecondary: "85%", lightSecondary: "50%" },
  ember:       { huePrimary: "350", satPrimary: "85%", lightPrimary: "48%", hueSecondary: "40",  satSecondary: "90%", lightSecondary: "50%" },
  forest:      { huePrimary: "155", satPrimary: "75%", lightPrimary: "38%", hueSecondary: "80",  satSecondary: "80%", lightSecondary: "48%" },
};

// ── DOM References ──
const panel = document.getElementById("design-panel");
const trigger = document.querySelector(".js-design-panel-trigger");
const closeBtn = document.querySelector(".js-design-panel-close");
const backdrop = document.querySelector(".js-design-panel-backdrop");
const tabs = panel?.querySelectorAll("[role='tab']");
const tabPanels = panel?.querySelectorAll("[role='tabpanel']");
const swatches = panel?.querySelectorAll(".design-panel__swatch");
const sliders = panel?.querySelectorAll(".design-panel__slider");
const numberInputs = panel?.querySelectorAll(".design-panel__number-input");
const hexInputs = panel?.querySelectorAll(".design-panel__hex-input[data-target]");
const colorPickers = panel?.querySelectorAll(".design-panel__color-picker");
const customFontInputs = panel?.querySelectorAll(".design-panel__hex-input[data-role]");
const applyFontBtns = panel?.querySelectorAll(".design-panel__apply-font");
const resetBtn = panel?.querySelector(".design-panel__reset");
const fontOptions = panel?.querySelectorAll(".design-panel__font-option");
const fontLink = document.getElementById("google-fonts-link");
const announcer = document.getElementById("status-announcer");

// ── State ──
let currentScheme = localStorage.getItem("gcoat-scheme") || "monochrome";
let currentFont = localStorage.getItem("gcoat-font") || "tech";

// ── Panel Open/Close ──
function openPanel() {
  if (!panel || !trigger) return;
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  trigger.setAttribute("aria-expanded", "true");
  backdrop?.classList.add("is-visible");
  closeBtn?.focus();
}

function closePanel() {
  if (!panel || !trigger) return;
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  trigger.setAttribute("aria-expanded", "false");
  backdrop?.classList.remove("is-visible");
  trigger.focus();
}

trigger?.addEventListener("click", () => {
  const isOpen = panel?.classList.contains("is-open");
  if (isOpen) closePanel(); else openPanel();
});

closeBtn?.addEventListener("click", closePanel);
backdrop?.addEventListener("click", closePanel);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && panel?.classList.contains("is-open")) {
    closePanel();
  }
});

// ── Tabs ──
tabs?.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");

    const targetId = tab.getAttribute("aria-controls");
    tabPanels?.forEach((p) => {
      p.hidden = p.id !== targetId;
    });
  });
});

// ── Color Scheme Presets ──
function applyScheme(schemeName) {
  const root = document.documentElement;

  // Remove custom inline overrides so the preset CSS attr takes effect
  root.style.removeProperty("--hue-primary");
  root.style.removeProperty("--sat-primary");
  root.style.removeProperty("--light-primary");
  root.style.removeProperty("--hue-secondary");
  root.style.removeProperty("--sat-secondary");
  root.style.removeProperty("--light-secondary");

  // Set data-scheme attr (CSS selectors handle the rest)
  if (schemeName === "monochrome") {
    root.removeAttribute("data-scheme");
  } else {
    root.setAttribute("data-scheme", schemeName);
  }

  currentScheme = schemeName;
  localStorage.setItem("gcoat-scheme", schemeName);
  localStorage.removeItem("gcoat-custom-colors");

  // Update swatch active state
  swatches?.forEach((s) => {
    s.classList.toggle("is-active", s.dataset.scheme === schemeName);
  });

  // Sync sliders to new preset values
  syncSlidersToPreset(schemeName);

  announce(`Color scheme changed to ${schemeName}`);

  // Notify shader to update colors
  window.dispatchEvent(new CustomEvent("gcoat-scheme-change"));
}

function syncSlidersToPreset(schemeName) {
  const defaults = SCHEME_DEFAULTS[schemeName];
  if (!defaults) return;

  sliders?.forEach((slider) => {
    const prop = slider.dataset.prop;
    if (prop === "--hue-primary") slider.value = defaults.huePrimary;
    if (prop === "--sat-primary") slider.value = parseInt(defaults.satPrimary);
    if (prop === "--hue-secondary") slider.value = defaults.hueSecondary;
    if (prop === "--sat-secondary") slider.value = parseInt(defaults.satSecondary);
  });

  // Also sync number inputs
  syncNumbersToSliders();
  // Also sync hex inputs
  syncHexFromSliders();
}

swatches?.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    applyScheme(swatch.dataset.scheme);
  });
});

// Initialize active swatch
swatches?.forEach((s) => {
  s.classList.toggle("is-active", s.dataset.scheme === currentScheme);
});

// ── HSL Sliders (Advanced) ──
sliders?.forEach((slider) => {
  slider.addEventListener("input", () => {
    const prop = slider.dataset.prop;
    const suffix = slider.dataset.suffix || "";
    const value = slider.value + suffix;

    document.documentElement.style.setProperty(prop, value);
    slider.setAttribute("aria-valuenow", slider.value);

    // Sync the paired number input
    const numId = slider.dataset.number;
    if (numId) {
      const numInput = document.getElementById(numId);
      if (numInput) numInput.value = slider.value;
    }

    // Mark all swatches as inactive (custom mode)
    swatches?.forEach((s) => s.classList.remove("is-active"));

    // Sync hex inputs from current slider values
    syncHexFromSliders();

    // Save custom colors to localStorage
    saveCustomColors();

    // Notify shader to update colors
    window.dispatchEvent(new CustomEvent("gcoat-scheme-change"));
  });
});

// ── Number Inputs (paired with sliders) ──
numberInputs?.forEach((numInput) => {
  numInput.addEventListener("input", () => {
    const sliderId = numInput.dataset.slider;
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    const val = Math.max(Number(slider.min), Math.min(Number(slider.max), Number(numInput.value) || 0));
    slider.value = val;
    const suffix = slider.dataset.suffix || "";
    document.documentElement.style.setProperty(slider.dataset.prop, val + suffix);
    slider.setAttribute("aria-valuenow", val);

    swatches?.forEach((s) => s.classList.remove("is-active"));
    syncHexFromSliders();
    saveCustomColors();
    window.dispatchEvent(new CustomEvent("gcoat-scheme-change"));
  });
});

// ── Hex → HSL Conversion Helpers ──
function hexToHsl(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length !== 6) return null;
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function getSliderVal(id) {
  const el = document.getElementById(id);
  return el ? Number(el.value) : 0;
}

function syncHexFromSliders() {
  const hPri = getSliderVal("slider-hue-primary");
  const sPri = getSliderVal("slider-sat-primary");
  const hexPri = hslToHex(hPri, sPri, 44);
  const hexPriEl = document.getElementById("hex-primary");
  const cpPriEl = document.getElementById("color-picker-primary");
  if (hexPriEl) hexPriEl.value = hexPri;
  if (cpPriEl) cpPriEl.value = hexPri;

  const hSec = getSliderVal("slider-hue-secondary");
  const sSec = getSliderVal("slider-sat-secondary");
  const hexSec = hslToHex(hSec, sSec, 44);
  const hexSecEl = document.getElementById("hex-secondary");
  const cpSecEl = document.getElementById("color-picker-secondary");
  if (hexSecEl) hexSecEl.value = hexSec;
  if (cpSecEl) cpSecEl.value = hexSec;
}

function syncNumbersToSliders() {
  sliders?.forEach((slider) => {
    const numId = slider.dataset.number;
    if (numId) {
      const numInput = document.getElementById(numId);
      if (numInput) numInput.value = slider.value;
    }
  });
}

// ── Hex Text Input → Sliders ──
function applyHexColor(hex, target) {
  const hsl = hexToHsl(hex);
  if (!hsl) return;

  const hueSlider = document.getElementById(`slider-hue-${target}`);
  const satSlider = document.getElementById(`slider-sat-${target}`);
  if (hueSlider) {
    hueSlider.value = hsl.h;
    document.documentElement.style.setProperty(`--hue-${target}`, String(hsl.h));
  }
  if (satSlider) {
    satSlider.value = hsl.s;
    document.documentElement.style.setProperty(`--sat-${target}`, hsl.s + "%");
  }

  // Sync number inputs
  const hueNum = document.getElementById(`num-hue-${target}`);
  const satNum = document.getElementById(`num-sat-${target}`);
  if (hueNum) hueNum.value = hsl.h;
  if (satNum) satNum.value = hsl.s;

  // Sync the color picker
  const cp = document.getElementById(`color-picker-${target}`);
  if (cp) cp.value = hex.length === 7 ? hex : `#${hex}`;

  swatches?.forEach((s) => s.classList.remove("is-active"));
  saveCustomColors();
  window.dispatchEvent(new CustomEvent("gcoat-scheme-change"));
}

hexInputs?.forEach((input) => {
  input.addEventListener("change", () => {
    let val = input.value.trim();
    if (!val.startsWith("#")) val = "#" + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      input.value = val.toUpperCase();
      applyHexColor(val, input.dataset.target);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.dispatchEvent(new Event("change"));
    }
  });
});

// ── Color Picker → Sliders ──
colorPickers?.forEach((picker) => {
  picker.addEventListener("input", () => {
    const hex = picker.value;
    const target = picker.dataset.target;
    const hexInput = document.getElementById(`hex-${target}`);
    if (hexInput) hexInput.value = hex.toUpperCase();
    applyHexColor(hex, target);
  });
});

// ── Custom Font Input ──
function applyCustomFont(role, fontName) {
  if (!fontName.trim()) return;
  const sanitized = fontName.replace(/[<>"'`;]/g, "").trim();
  if (!sanitized) return;

  // Load from Google Fonts
  const encoded = encodeURIComponent(sanitized);
  const url = `https://fonts.googleapis.com/css2?family=${encoded.replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;

  // Create or reuse a dynamic link element
  let linkEl = document.getElementById(`custom-font-link-${role}`);
  if (!linkEl) {
    linkEl = document.createElement("link");
    linkEl.id = `custom-font-link-${role}`;
    linkEl.rel = "stylesheet";
    document.head.appendChild(linkEl);
  }
  linkEl.href = url;

  // Apply to the correct CSS var
  if (role === "heading") {
    document.documentElement.style.setProperty("--font-heading", `"${sanitized}", system-ui, sans-serif`);
  } else {
    document.documentElement.style.setProperty("--font-body", `"${sanitized}", system-ui, sans-serif`);
  }

  // Deselect font presets
  fontOptions?.forEach((opt) => {
    opt.classList.remove("is-active");
    opt.setAttribute("aria-checked", "false");
  });

  // Persist
  const customFonts = JSON.parse(localStorage.getItem("gcoat-custom-fonts") || "{}");
  customFonts[role] = sanitized;
  localStorage.setItem("gcoat-custom-fonts", JSON.stringify(customFonts));
  localStorage.setItem("gcoat-font", "custom");

  announce(`Custom ${role} font set to ${sanitized}`);
}

applyFontBtns?.forEach((btn) => {
  btn.addEventListener("click", () => {
    const role = btn.dataset.role;
    const input = panel?.querySelector(`.design-panel__hex-input[data-role="${role}"]`);
    if (input) applyCustomFont(role, input.value);
  });
});

customFontInputs?.forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCustomFont(input.dataset.role, input.value);
    }
  });
});

// Init: sync number inputs and hex displays
syncNumbersToSliders();
syncHexFromSliders();

// Init: restore custom fonts from localStorage
(function restoreCustomFonts() {
  const customFonts = JSON.parse(localStorage.getItem("gcoat-custom-fonts") || "{}");
  if (customFonts.heading) {
    const input = document.getElementById("custom-font-heading");
    if (input) input.value = customFonts.heading;
    applyCustomFont("heading", customFonts.heading);
  }
  if (customFonts.body) {
    const input = document.getElementById("custom-font-body");
    if (input) input.value = customFonts.body;
    applyCustomFont("body", customFonts.body);
  }
})();

function saveCustomColors() {
  const root = document.documentElement;
  const colors = {};
  sliders?.forEach((slider) => {
    const prop = slider.dataset.prop;
    const suffix = slider.dataset.suffix || "";
    const key = prop.replace("--", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    colors[key] = slider.value + suffix;
  });
  localStorage.setItem("gcoat-custom-colors", JSON.stringify(colors));
  localStorage.setItem("gcoat-scheme", "custom");
}

resetBtn?.addEventListener("click", () => {
  applyScheme(currentScheme === "custom" ? "electric" : currentScheme);
});

// Sync sliders to current preset on init
syncSlidersToPreset(currentScheme);

// ── Font Changer ──
function applyFont(fontName) {
  const root = document.documentElement;

  // Clear custom font overrides
  root.style.removeProperty("--font-heading");
  root.style.removeProperty("--font-body");
  localStorage.removeItem("gcoat-custom-fonts");

  // Remove dynamic custom font <link> elements
  document.getElementById("custom-font-link-heading")?.remove();
  document.getElementById("custom-font-link-body")?.remove();

  // Clear custom font text inputs
  const headingInput = document.getElementById("custom-font-heading");
  const bodyInput = document.getElementById("custom-font-body");
  if (headingInput) headingInput.value = "";
  if (bodyInput) bodyInput.value = "";

  if (fontName !== "tech") {
    root.setAttribute("data-font", fontName);
  } else {
    root.removeAttribute("data-font");
  }

  // Load the font stylesheet
  if (fontLink && FONT_URLS[fontName]) {
    fontLink.href = FONT_URLS[fontName];
  }

  currentFont = fontName;
  localStorage.setItem("gcoat-font", fontName);

  // Update active state
  fontOptions?.forEach((opt) => {
    const isActive = opt.dataset.font === fontName;
    opt.classList.toggle("is-active", isActive);
    opt.setAttribute("aria-checked", String(isActive));
  });

  announce(`Font changed to ${fontName}`);
}

fontOptions?.forEach((opt) => {
  opt.addEventListener("click", () => {
    applyFont(opt.dataset.font);
  });
});

// Initialize font active state
fontOptions?.forEach((opt) => {
  const isActive = opt.dataset.font === currentFont;
  opt.classList.toggle("is-active", isActive);
  opt.setAttribute("aria-checked", String(isActive));
});

// Load saved font stylesheet on init
if (fontLink && currentFont !== "tech" && FONT_URLS[currentFont]) {
  fontLink.href = FONT_URLS[currentFont];
}

// ── Accessibility ──
function announce(message) {
  if (announcer) announcer.textContent = message;
}
