// services-fire.js — Canvas ember/fireplace particle system for #services

const EMBER_COLORS = [
  { h: 15, s: 90, l: 55 },   // red-orange
  { h: 25, s: 95, l: 55 },   // orange
  { h: 35, s: 95, l: 58 },   // amber
  { h: 45, s: 92, l: 60 },   // gold
  { h: 8,  s: 85, l: 48 },   // deep red
];

const CONFIG = {
  maxParticles: 55,
  spawnRate: 0.35,
  minSize: 1.5,
  maxSize: 4,
  minLife: 80,
  maxLife: 200,
  riseSpeedMin: 0.3,
  riseSpeedMax: 0.9,
  driftX: 0.4,
  flickerSpeed: 0.06,
  glowRadius: 6,
  ambientGlowOpacity: 0.06,
  mobileMaxParticles: 30,
  mobileBreakpoint: 768,
};

class Ember {
  constructor(canvasW, canvasH) {
    this.reset(canvasW, canvasH);
  }

  reset(canvasW, canvasH) {
    const color = EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)];
    this.h = color.h;
    this.s = color.s;
    this.l = color.l;
    this.x = Math.random() * canvasW;
    this.y = canvasH + Math.random() * 20;
    this.size = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
    this.life = CONFIG.minLife + Math.random() * (CONFIG.maxLife - CONFIG.minLife);
    this.maxLife = this.life;
    this.vy = -(CONFIG.riseSpeedMin + Math.random() * (CONFIG.riseSpeedMax - CONFIG.riseSpeedMin));
    this.vx = (Math.random() - 0.5) * CONFIG.driftX;
    this.flickerOffset = Math.random() * Math.PI * 2;
    this.wobbleAmp = 0.2 + Math.random() * 0.5;
    this.wobbleFreq = 0.02 + Math.random() * 0.03;
    this.age = 0;
  }

  update() {
    this.age++;
    this.x += this.vx + Math.sin(this.age * this.wobbleFreq) * this.wobbleAmp;
    this.y += this.vy;
    // slow down rise as ember ages
    this.vy *= 0.999;
    this.life--;
    return this.life > 0;
  }

  draw(ctx) {
    const progress = 1 - this.life / this.maxLife;
    // fade in quickly, then fade out
    let alpha;
    if (progress < 0.1) {
      alpha = progress / 0.1;
    } else {
      alpha = 1 - ((progress - 0.1) / 0.9);
    }
    // flicker
    const flicker = 0.6 + 0.4 * Math.sin(this.age * CONFIG.flickerSpeed + this.flickerOffset);
    alpha *= flicker;
    alpha = Math.max(0, Math.min(1, alpha));

    // shrink as it dies
    const size = this.size * (1 - progress * 0.6);

    // outer glow
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, size * CONFIG.glowRadius);
    gradient.addColorStop(0, `hsla(${this.h}, ${this.s}%, ${this.l}%, ${alpha * 0.8})`);
    gradient.addColorStop(0.3, `hsla(${this.h}, ${this.s}%, ${this.l}%, ${alpha * 0.3})`);
    gradient.addColorStop(1, `hsla(${this.h}, ${this.s}%, ${this.l}%, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size * CONFIG.glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // bright core
    ctx.fillStyle = `hsla(${this.h}, ${this.s}%, ${Math.min(this.l + 20, 90)}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function initServicesFire() {
  const section = document.getElementById("services");
  if (!section) return;

  // Respect reduced motion — show only static ambient glow
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "services__fire-canvas";
  canvas.setAttribute("role", "presentation");
  canvas.setAttribute("aria-hidden", "true");
  section.insertBefore(canvas, section.firstChild);

  const ctx = canvas.getContext("2d");
  let embers = [];
  let animId = null;
  let isVisible = false;

  function resize() {
    const rect = section.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getMaxParticles() {
    if (window.innerWidth < CONFIG.mobileBreakpoint) return CONFIG.mobileMaxParticles;
    return CONFIG.maxParticles;
  }

  function drawAmbientGlow(w, h) {
    // warm glow from bottom center
    const grd = ctx.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, h * 0.7);
    grd.addColorStop(0, `hsla(25, 90%, 50%, ${CONFIG.ambientGlowOpacity})`);
    grd.addColorStop(0.5, `hsla(15, 85%, 40%, ${CONFIG.ambientGlowOpacity * 0.5})`);
    grd.addColorStop(1, "hsla(15, 85%, 40%, 0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  function animate() {
    if (!isVisible) return;
    const rect = section.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);
    drawAmbientGlow(w, h);

    if (!reducedMotion) {
      // spawn new embers
      const max = getMaxParticles();
      if (embers.length < max && Math.random() < CONFIG.spawnRate) {
        embers.push(new Ember(w, h));
      }

      // update and draw
      embers = embers.filter((ember) => {
        const alive = ember.update();
        if (alive) ember.draw(ctx);
        return alive;
      });
    }

    animId = requestAnimationFrame(animate);
  }

  function start() {
    if (isVisible) return;
    isVisible = true;
    resize();
    animate();
  }

  function stop() {
    isVisible = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  // Observe section visibility
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          start();
        } else {
          stop();
        }
      });
    },
    { threshold: 0.05 }
  );
  observer.observe(section);

  // Handle resize
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isVisible) resize();
    }, 200);
  }, { passive: true });
}
