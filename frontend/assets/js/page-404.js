// page-404.js — Minimal 404 page initialization
const y = document.getElementById("year");
if (y) y.textContent = String(new Date().getFullYear());

const backToTop = document.querySelector(".js-back-to-top");
if (backToTop) {
  backToTop.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
