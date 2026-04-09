// blog-ambient.js — Ink/typewriter particle canvas background for blog pages
// Lightweight Canvas2D effect — no dependencies

const canvas = document.getElementById("blog-bg-canvas");
if (canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  initBlogAmbient(canvas);
}

function initBlogAmbient(canvas) {
  const ctx = canvas.getContext("2d");
  let w, h;
  let particles = [];
  let animId = null;
  let lastTime = 0;
  const FPS_INTERVAL = 1000 / 30; // Throttle to 30fps

  // Characters used for the "typewriter" particles
  const CHARS = "abcdefghijklmnopqrstuvwxyz{}[]()<>/;:\"'0123456789&@#".split("");
  const MAX_PARTICLES = 60;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticle() {
    const isChar = Math.random() > 0.35;
    return {
      x: Math.random() * w,
      y: -20 - Math.random() * 80,
      vy: 0.15 + Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.2,
      size: isChar ? 10 + Math.random() * 8 : 2 + Math.random() * 4,
      opacity: 0.04 + Math.random() * 0.1,
      char: isChar ? CHARS[Math.floor(Math.random() * CHARS.length)] : null,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.005,
      fadeIn: 0,
    };
  }

  function init() {
    resize();
    particles = [];
    // Seed some initial particles across the viewport
    for (let i = 0; i < MAX_PARTICLES * 0.6; i++) {
      const p = createParticle();
      p.y = Math.random() * h;
      p.fadeIn = 1;
      particles.push(p);
    }
  }

  function update() {
    // Spawn new particles if below max
    if (particles.length < MAX_PARTICLES && Math.random() > 0.85) {
      particles.push(createParticle());
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.y += p.vy;
      p.x += p.vx;
      p.rotation += p.rotationSpeed;

      // Fade in
      if (p.fadeIn < 1) p.fadeIn = Math.min(1, p.fadeIn + 0.02);

      // Remove off-screen
      if (p.y > h + 30) {
        particles.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Read computed CSS custom properties for theming
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue("--color-muted").trim() || "#a9b6d3";

    for (const p of particles) {
      const alpha = p.opacity * p.fadeIn;

      if (p.char) {
        // Typewriter character
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${p.size}px 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`;
        ctx.fillStyle = textColor;
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      } else {
        // Ink droplet
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = textColor;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  function loop(timestamp) {
    animId = requestAnimationFrame(loop);

    const elapsed = timestamp - lastTime;
    if (elapsed < FPS_INTERVAL) return;
    lastTime = timestamp - (elapsed % FPS_INTERVAL);

    update();
    draw();
  }

  // Pause when tab is hidden
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(animId);
      animId = null;
    } else if (!animId) {
      lastTime = performance.now();
      animId = requestAnimationFrame(loop);
    }
  }

  // Pause when not in viewport (IntersectionObserver)
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !document.hidden) {
      if (!animId) {
        lastTime = performance.now();
        animId = requestAnimationFrame(loop);
      }
    } else {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    }
  }, { threshold: 0 });

  // Init
  init();
  observer.observe(canvas);
  document.addEventListener("visibilitychange", onVisibility);

  // Debounced resize
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  }, { passive: true });
}
