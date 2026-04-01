// init.js — classic (non-module) script loaded in <head>
// Adds .js class to <html> so CSS can gate animations on JS availability.
// Fallback: if ES module fails (e.g. file:// protocol), remove .js after 200ms
// so content stays visible without animations.
document.documentElement.classList.add("js");
window.__jsModuleTimeout = setTimeout(function () {
  document.documentElement.classList.remove("js");
}, 200);

// Early mode detection — prevents flash of wrong theme on return visits
(function () {
  var savedMode = localStorage.getItem("gcoat-mode");
  if (savedMode) {
    document.documentElement.setAttribute("data-mode", savedMode);
  }
})();
