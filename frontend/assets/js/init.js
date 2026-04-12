// init.js — classic (non-module) script loaded in <head>
// Adds .js class to <html> so CSS can gate animations on JS availability.
// Fallback: if ES module fails (e.g. file:// protocol), remove .js after 200ms
// so content stays visible without animations.
document.documentElement.classList.add("js");
window.__jsModuleTimeout = setTimeout(function () {
  document.documentElement.classList.remove("js");
}, 200);

// Early detection — prevents flash of wrong theme/scheme/font on return visits
(function () {
  var root = document.documentElement;

  // Mode (regular / arcade)
  var savedMode = localStorage.getItem("gcoat-mode");
  if (savedMode) {
    root.setAttribute("data-mode", savedMode);
  }

  // Theme (dark / light)
  var savedTheme = localStorage.getItem("gcoat-theme");
  if (savedTheme) {
    root.setAttribute("data-theme", savedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    root.setAttribute("data-theme", "light");
  }

  // Color scheme preset (monochrome is default — no data-scheme needed for it)
  var savedScheme = localStorage.getItem("gcoat-scheme");
  if (savedScheme && savedScheme !== "monochrome") {
    root.setAttribute("data-scheme", savedScheme);
  }

  // Custom HSL overrides from OKLCH sliders
  var customColors = localStorage.getItem("gcoat-custom-colors");
  if (customColors) {
    try {
      var colors = JSON.parse(customColors);
      if (colors.huePrimary) root.style.setProperty("--hue-primary", colors.huePrimary);
      if (colors.satPrimary) root.style.setProperty("--sat-primary", colors.satPrimary);
      if (colors.lightPrimary) root.style.setProperty("--light-primary", colors.lightPrimary);
      if (colors.hueSecondary) root.style.setProperty("--hue-secondary", colors.hueSecondary);
      if (colors.satSecondary) root.style.setProperty("--sat-secondary", colors.satSecondary);
      if (colors.lightSecondary) root.style.setProperty("--light-secondary", colors.lightSecondary);
    } catch (e) { /* invalid JSON — ignore */ }
  }

  // Font pairing (default / tech / classic / geometric / mono / system)
  var savedFont = localStorage.getItem("gcoat-font");
  if (savedFont && savedFont !== "custom" && savedFont !== "default") {
    root.setAttribute("data-font", savedFont);
  }

  // Custom font overrides (typed in manually)
  var customFonts = localStorage.getItem("gcoat-custom-fonts");
  if (customFonts) {
    try {
      var fonts = JSON.parse(customFonts);
      if (fonts.heading) root.style.setProperty("--font-heading", '"' + fonts.heading + '", system-ui, sans-serif');
      if (fonts.body) root.style.setProperty("--font-body", '"' + fonts.body + '", system-ui, sans-serif');
    } catch (e) { /* invalid JSON — ignore */ }
  }
})();
