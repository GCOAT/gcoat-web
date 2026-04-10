/* ==========================================================================
   gtag.js — Google Analytics 4 initialization
   ========================================================================== */

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-QX6KHWBC4N');

/* Expose gtag globally so other modules can fire custom events */
window.gtag = gtag;
