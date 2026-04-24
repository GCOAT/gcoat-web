// process-space.js — Canvas starfield + shooting stars for #process

const CONFIG = {
  maxStars: 160,
  mobileMaxStars: 60,
  mobileBreakpoint: 768,
  twinkleSpeedMin: 0.006,
  twinkleSpeedMax: 0.05,
  minSize: 0.3,
  maxSize: 3.0,
  minOpacity: 0.1,
  maxOpacity: 0.9,
  glowThreshold: 1.6,
  glowRadius: 5,
  // Diffraction spikes for large stars (cross/star shape)
  spikeThreshold: 2.2,
  spikeLength: 14,
  // Shooting star timing — active meteor shower cadence
  quietMinMs: 4000,
  quietMaxMs: 10000,
  burstMinMs: 600,
  burstMaxMs: 1800,
  burstChance: 0.35,
  burstMaxCount: 4,
};

// Star color palette — subtle temperature variety
const STAR_COLORS = [
  { r: 220, g: 225, b: 255, weight: 0.40 }, // blue-white (class A)
  { r: 255, g: 245, b: 230, weight: 0.25 }, // warm white (class F)
  { r: 200, g: 210, b: 255, weight: 0.15 }, // cool blue (class B)
  { r: 255, g: 225, b: 200, weight: 0.10 }, // pale gold (class G)
  { r: 180, g: 200, b: 255, weight: 0.07 }, // icy blue (class O)
  { r: 255, g: 210, b: 180, weight: 0.03 }, // warm amber (class K)
];

function pickStarColor() {
  const r = Math.random();
  let cum = 0;
  for (const c of STAR_COLORS) {
    cum += c.weight;
    if (r <= cum) return c;
  }
  return STAR_COLORS[0];
}

// Radiant point — all meteors originate from roughly the same direction
const RADIANT = {
  angleDeg: -32,
  spread: 18,
};

// Magnitude distribution — most meteors are dim, few are bright
const MAGNITUDES = [
  [0.35, { speed: [5, 8],   trailLen: [40, 70],   headSize: 1.0, lineWidth: 0.8,  life: [30, 50],  brightness: 0.45 }], // dim
  [0.25, { speed: [7, 12],  trailLen: [60, 120],  headSize: 1.4, lineWidth: 1.2,  life: [40, 65],  brightness: 0.7  }], // medium
  [0.18, { speed: [10, 16], trailLen: [100, 180], headSize: 2.0, lineWidth: 1.8,  life: [50, 80],  brightness: 0.9  }], // bright
  [0.12, { speed: [14, 22], trailLen: [160, 280], headSize: 2.8, lineWidth: 2.4,  life: [60, 95],  brightness: 1.0  }], // fireball
  [0.10, { speed: [18, 28], trailLen: [250, 420], headSize: 2.2, lineWidth: 1.6,  life: [70, 120], brightness: 0.85 }], // long streak
];

function pickMagnitude() {
  const r = Math.random();
  let cumulative = 0;
  for (const [weight, mag] of MAGNITUDES) {
    cumulative += weight;
    if (r <= cumulative) return mag;
  }
  return MAGNITUDES[0][1];
}

function randRange(arr) {
  return arr[0] + Math.random() * (arr[1] - arr[0]);
}

class Star {
  constructor(canvasW, canvasH) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.size = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
    this.baseOpacity = CONFIG.minOpacity + Math.random() * (CONFIG.maxOpacity - CONFIG.minOpacity);
    this.twinkleSpeed = CONFIG.twinkleSpeedMin + Math.random() * (CONFIG.twinkleSpeedMax - CONFIG.twinkleSpeedMin);
    this.twinkleOffset = Math.random() * Math.PI * 2;
    this.color = pickStarColor();
    // Parallax depth — bigger stars are "closer" and shift more
    this.depth = 0.3 + (this.size / CONFIG.maxSize) * 0.7; // 0.3 (far) → 1.0 (near)
    // Satellite glint state
    this.glintAlpha = 0;
    this.glinting = false;
    this.glintPhase = 0;
    this.age = 0;
  }

  update() {
    this.age++;
    // Glint animation
    if (this.glinting) {
      this.glintPhase += 0.08;
      this.glintAlpha = Math.sin(this.glintPhase * Math.PI);
      if (this.glintPhase >= 1) {
        this.glinting = false;
        this.glintAlpha = 0;
        this.glintPhase = 0;
      }
    }
  }

  triggerGlint() {
    if (!this.glinting) {
      this.glinting = true;
      this.glintPhase = 0;
    }
  }

  draw(ctx, offsetX, offsetY) {
    const twinkle = 0.5 + 0.5 * Math.sin(this.age * this.twinkleSpeed + this.twinkleOffset);
    const alpha = this.baseOpacity * (0.35 + 0.65 * twinkle);
    const { r, g, b } = this.color;

    // Apply parallax offset based on depth
    const px = this.x + offsetX * this.depth;
    const py = this.y + offsetY * this.depth;

    // Soft glow halo for larger stars
    if (this.size >= CONFIG.glowThreshold) {
      const gr = this.size * CONFIG.glowRadius;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, gr);
      grd.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.35})`);
      grd.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${alpha * 0.1})`);
      grd.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, gr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Diffraction spikes (cross shape) for the brightest stars
    if (this.size >= CONFIG.spikeThreshold) {
      const spikeAlpha = alpha * 0.3 * ((this.size - CONFIG.spikeThreshold) / (CONFIG.maxSize - CONFIG.spikeThreshold));
      const len = CONFIG.spikeLength * (this.size / CONFIG.maxSize);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${spikeAlpha})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px - len, py);
      ctx.lineTo(px + len, py);
      ctx.moveTo(px, py - len);
      ctx.lineTo(px, py + len);
      ctx.stroke();
    }

    // Core dot
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Hot white center for medium+ stars
    if (this.size > 1.2) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(px, py, this.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Satellite glint — brief intense flash
    if (this.glintAlpha > 0.01) {
      const ga = this.glintAlpha;
      const flareR = this.size * 8 + 6;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, flareR);
      grd.addColorStop(0, `rgba(255, 255, 255, ${ga * 0.9})`);
      grd.addColorStop(0.15, `rgba(220, 230, 255, ${ga * 0.5})`);
      grd.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${ga * 0.15})`);
      grd.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, flareR, 0, Math.PI * 2);
      ctx.fill();

      // Cross flare spikes during glint
      const slen = flareR * 1.5;
      ctx.strokeStyle = `rgba(255, 255, 255, ${ga * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px - slen, py);
      ctx.lineTo(px + slen, py);
      ctx.moveTo(px, py - slen);
      ctx.lineTo(px, py + slen);
      ctx.stroke();
    }
  }
}

class ShootingStar {
  constructor(canvasW, canvasH) {
    const mag = pickMagnitude();
    this.brightness = mag.brightness;
    this.headSize = mag.headSize;
    this.lineWidth = mag.lineWidth;

    // Direction from radiant with spread
    const angleDeg = RADIANT.angleDeg + (Math.random() - 0.5) * 2 * RADIANT.spread;
    this.angle = (angleDeg * Math.PI) / 180;

    // Spawn from upper portion — start off-screen or just inside the top/right edge
    const edge = Math.random();
    if (edge < 0.6) {
      // Enter from top
      this.x = canvasW * 0.15 + Math.random() * canvasW * 0.7;
      this.y = -10 - Math.random() * 30;
    } else {
      // Enter from right side
      this.x = canvasW + 10 + Math.random() * 20;
      this.y = Math.random() * canvasH * 0.5;
    }

    this.speed = randRange(mag.speed);
    this.trailLen = randRange(mag.trailLen);
    this.life = Math.round(randRange(mag.life));
    this.maxLife = this.life;

    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = -Math.sin(this.angle) * this.speed;

    // Slight gravity — pulls trail downward subtly over time
    // Long/fast streaks get less gravity so they stay straighter
    const gravityScale = this.speed > 16 ? 0.5 : 1;
    this.gravity = (0.012 + Math.random() * 0.015) * gravityScale;

    // Color temperature — dim meteors are warm-white, bright ones are blue-white
    this.warmth = 1 - this.brightness * 0.6; // 1=warm, 0.4=cool
    this.r = Math.round(230 + 25 * this.warmth);
    this.g = Math.round(220 + 20 * this.warmth);
    this.b = Math.round(255 - 30 * this.warmth);

    // Trail history — stores past positions for a persistent, fading wake
    this.trail = [];
    this.maxTrailPoints = Math.round(this.trailLen / this.speed * 1.5);

    // Fragmentation — fireballs have a chance to shed sparks
    this.sparks = [];
    this.canFragment = this.brightness >= 0.9;
    this.fragmented = false;
  }

  update() {
    // Store position in trail history
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailPoints) {
      this.trail.shift();
    }

    // Apply velocity + gravity
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;

    // Decelerate slightly (atmospheric drag feel)
    this.speed *= 0.997;
    this.vx *= 0.997;
    this.vy *= 0.997;

    this.life--;

    // Fragment near end of life for fireballs
    if (this.canFragment && !this.fragmented && this.life < this.maxLife * 0.25) {
      this.fragmented = true;
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this.sparks.push({
          x: this.x,
          y: this.y,
          vx: this.vx * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 3,
          vy: this.vy * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 3,
          life: 8 + Math.floor(Math.random() * 12),
          maxLife: 0,
          size: 0.5 + Math.random() * 1.2,
        });
        this.sparks[this.sparks.length - 1].maxLife = this.sparks[this.sparks.length - 1].life;
      }
    }

    // Update sparks
    this.sparks = this.sparks.filter((s) => {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.06;
      s.vx *= 0.96;
      s.vy *= 0.96;
      s.life--;
      return s.life > 0;
    });

    return this.life > 0 || this.sparks.length > 0;
  }

  draw(ctx) {
    const progress = 1 - Math.max(0, this.life) / this.maxLife;

    // Overall alpha envelope — quick fade-in, long sustain, fade-out at end
    let envelope;
    if (progress < 0.08) {
      envelope = progress / 0.08;
    } else if (progress < 0.7) {
      envelope = 1;
    } else {
      envelope = 1 - (progress - 0.7) / 0.3;
    }
    envelope = Math.max(0, Math.min(1, envelope)) * this.brightness;

    // Draw persistent trail from history
    if (this.trail.length > 1 && this.life > 0) {
      const len = this.trail.length;
      for (let i = 1; i < len; i++) {
        const t = i / len; // 0 = oldest, 1 = newest
        const seg = this.trail[i];
        const prev = this.trail[i - 1];

        // Trail fades from nothing at tail to full at head
        const trailAlpha = envelope * t * t; // quadratic falloff for natural look
        if (trailAlpha < 0.01) continue;

        // Trail gets thinner toward the tail
        const width = this.lineWidth * (0.2 + 0.8 * t);

        ctx.strokeStyle = `rgba(${this.r}, ${this.g}, ${this.b}, ${trailAlpha * 0.7})`;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(seg.x, seg.y);
        ctx.stroke();
      }

      // Wider diffuse glow trail (only for brighter meteors)
      if (this.brightness >= 0.7 && len > 2) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const glowSteps = Math.min(len, 8);
        for (let i = len - glowSteps; i < len; i++) {
          if (i < 1) continue;
          const t = (i - (len - glowSteps)) / glowSteps;
          const pt = this.trail[i];
          const ga = envelope * t * 0.15 * this.brightness;
          if (ga < 0.005) continue;

          const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, this.lineWidth * 4);
          grd.addColorStop(0, `rgba(${this.r}, ${this.g}, ${this.b}, ${ga})`);
          grd.addColorStop(1, `rgba(${this.r}, ${this.g}, ${this.b}, 0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, this.lineWidth * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Head flare
    if (this.life > 0 && envelope > 0.05) {
      // Outer glow
      const glowR = this.headSize * 5;
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowR);
      grd.addColorStop(0, `rgba(255, 255, 255, ${envelope * 0.5})`);
      grd.addColorStop(0.2, `rgba(${this.r}, ${this.g}, ${this.b}, ${envelope * 0.25})`);
      grd.addColorStop(1, `rgba(${this.r}, ${this.g}, ${this.b}, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `rgba(255, 255, 255, ${envelope * 0.95})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.headSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw sparks (fragmentation)
    for (const s of this.sparks) {
      const sa = (s.life / s.maxLife) * 0.8;
      ctx.fillStyle = `rgba(255, ${200 + Math.random() * 55}, ${150 + Math.random() * 80}, ${sa})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (s.life / s.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Comet — rare, slow-moving, wide diffuse tail ──
class Comet {
  constructor(canvasW, canvasH) {
    // Enter from the left or right edge, upper third of the sky.
    this.goingRight = Math.random() < 0.5;
    this.x = this.goingRight ? -60 : canvasW + 60;
    this.y = canvasH * (0.12 + Math.random() * 0.35);
    // Slower drift so the comet lingers long enough to admire.
    this.vx = (this.goingRight ? 1 : -1) * (0.25 + Math.random() * 0.18);
    this.vy = -0.05 + Math.random() * 0.1;
    // Bigger core + longer tail for a more commanding presence.
    this.coreSize = 4 + Math.random() * 2;
    this.tailLength = 180 + Math.random() * 120;
    this.life = Math.round(canvasW / Math.abs(this.vx) * 1.35);
    this.maxLife = this.life;
    this.trail = [];
    this.maxTrail = 90;
    // Sparkle particles emitted from the head
    this.sparkles = [];
    this.sparkleTimer = 0;
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.shift();
    this.x += this.vx;
    this.y += this.vy;
    this.life--;

    // Emit a sparkle every few frames near the head — glints against the
    // dust tail. Each sparkle has a short life and gentle drift.
    this.sparkleTimer++;
    if (this.sparkleTimer >= 4) {
      this.sparkleTimer = 0;
      this.sparkles.push({
        x: this.x + (Math.random() - 0.5) * this.coreSize * 2,
        y: this.y + (Math.random() - 0.5) * this.coreSize * 2,
        vx: this.vx * -0.3 + (Math.random() - 0.5) * 0.4,
        vy: this.vy * -0.3 + (Math.random() - 0.5) * 0.4,
        life: 18 + Math.floor(Math.random() * 14),
        maxLife: 0,
        size: 0.5 + Math.random() * 0.9,
      });
      const last = this.sparkles[this.sparkles.length - 1];
      last.maxLife = last.life;
    }
    this.sparkles = this.sparkles.filter((s) => {
      s.x += s.vx;
      s.y += s.vy;
      s.vx *= 0.97;
      s.vy *= 0.97;
      s.life--;
      return s.life > 0;
    });

    return this.life > 0;
  }

  draw(ctx) {
    const progress = 1 - this.life / this.maxLife;
    let envelope;
    if (progress < 0.1) envelope = progress / 0.1;
    else if (progress < 0.8) envelope = 1;
    else envelope = 1 - (progress - 0.8) / 0.2;
    envelope = Math.max(0, Math.min(1, envelope));

    // Diffuse coma (wide glow around the head) — brighter and more
    // saturated than before so the comet reads clearly against stars.
    const comaR = this.coreSize * 14;
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, comaR);
    grd.addColorStop(0, `rgba(190, 220, 255, ${envelope * 0.28})`);
    grd.addColorStop(0.25, `rgba(140, 190, 255, ${envelope * 0.12})`);
    grd.addColorStop(1, "rgba(140, 190, 255, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.x, this.y, comaR, 0, Math.PI * 2);
    ctx.fill();

    // Dust tail — faint, wide, curves away from head
    if (this.trail.length > 2) {
      const len = this.trail.length;
      for (let i = 1; i < len; i++) {
        const t = i / len;
        const pt = this.trail[i];
        const ta = envelope * (1 - t) * 0.08;
        if (ta < 0.003) continue;
        const tr = this.coreSize * (3 + (1 - t) * 6);
        const tgrd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, tr);
        tgrd.addColorStop(0, `rgba(180, 200, 240, ${ta})`);
        tgrd.addColorStop(1, "rgba(180, 200, 240, 0)");
        ctx.fillStyle = tgrd;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, tr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Ion tail — narrow, brighter, straight behind
    if (this.trail.length > 4) {
      const len = this.trail.length;
      const tailDir = this.goingRight ? -1 : 1;
      for (let i = len - 1; i >= Math.max(0, len - 30); i--) {
        const t = (len - 1 - i) / 30;
        const pt = this.trail[i];
        const ia = envelope * (1 - t) * 0.25;
        if (ia < 0.005) continue;
        const ix = pt.x + tailDir * t * this.tailLength * 0.3;
        const iy = pt.y + t * 3;
        ctx.strokeStyle = `rgba(140, 180, 255, ${ia})`;
        ctx.lineWidth = this.coreSize * (1 - t * 0.7);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(ix, iy);
        ctx.stroke();
      }
    }

    // Bright core
    ctx.fillStyle = `rgba(255, 255, 255, ${envelope * 0.8})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.coreSize, 0, Math.PI * 2);
    ctx.fill();

    // Inner glow
    const igrd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.coreSize * 5);
    igrd.addColorStop(0, `rgba(220, 235, 255, ${envelope * 0.55})`);
    igrd.addColorStop(1, "rgba(220, 235, 255, 0)");
    ctx.fillStyle = igrd;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.coreSize * 5, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle glints trailing the head — tiny bright points that fade.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of this.sparkles) {
      const sa = (s.life / s.maxLife) * envelope * 0.9;
      if (sa < 0.05) continue;
      ctx.fillStyle = `rgba(255, 245, 220, ${sa})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── Orion Constellation ──
// Real star positions for the 7 major Orion stars, laid out as they
// appear in the northern sky. Drawn in the upper-right of the canvas
// as a recognizable signature behind the process content. Parallaxes
// with the same depth as the background starfield.
class Orion {
  constructor(canvasW, canvasH) {
    // Anchor from the right edge so the constellation always sits in
    // the right margin — never competes with the journey cards on the
    // left. Scale is capped so it doesn't get absurdly large on wide
    // monitors but stays legible on narrow phones.
    const scale = Math.min(canvasW * 0.4, canvasH * 0.42, 220);
    const rightMargin = Math.max(24, canvasW * 0.04);
    const anchorX = canvasW - scale - rightMargin;
    const anchorY = canvasH * 0.14;

    // Normalized positions (0–1) within the constellation's bounding box.
    // Colors reflect rough stellar classifications (Betelgeuse red,
    // Rigel/Bellatrix blue-white).
    this.stars = [
      { nx: 0.18, ny: 0.14, size: 2.6, rgb: [255, 170, 120] }, // Betelgeuse (red giant, top-left shoulder)
      { nx: 0.72, ny: 0.22, size: 2.0, rgb: [200, 215, 255] }, // Bellatrix (top-right shoulder)
      { nx: 0.42, ny: 0.48, size: 1.7, rgb: [210, 225, 255] }, // Mintaka (belt-left)
      { nx: 0.50, ny: 0.52, size: 1.9, rgb: [210, 225, 255] }, // Alnilam (belt-center)
      { nx: 0.58, ny: 0.56, size: 1.7, rgb: [210, 225, 255] }, // Alnitak (belt-right)
      { nx: 0.22, ny: 0.90, size: 2.8, rgb: [200, 220, 255] }, // Rigel (blue giant, brightest — bottom-left)
      { nx: 0.78, ny: 0.86, size: 2.0, rgb: [200, 215, 255] }, // Saiph (bottom-right)
    ];

    this.stars.forEach((s) => {
      s.x = anchorX + s.nx * scale;
      s.y = anchorY + s.ny * scale;
      s.phase = Math.random() * Math.PI * 2;
    });

    // Index pairs that define the constellation's connection lines.
    this.lines = [
      [0, 1], // shoulders
      [0, 2], // left shoulder → belt-left
      [1, 4], // right shoulder → belt-right
      [2, 3], [3, 4], // belt
      [2, 5], // belt-left → Rigel
      [4, 6], // belt-right → Saiph
    ];

    // Parallax depth (matches smaller background stars for visual unity)
    this.depth = 0.35;
    this.time = 0;
  }

  update() {
    this.time += 0.018;
  }

  draw(ctx, parallaxX, parallaxY, globalAlpha) {
    const px = parallaxX * this.depth;
    const py = parallaxY * this.depth;
    const a = globalAlpha * 0.85;

    // Connection lines first (underneath stars) — slightly more present
    // than the procedural constellation so Orion reads as a chart shape.
    ctx.save();
    ctx.strokeStyle = `rgba(180, 205, 245, ${a * 0.32})`;
    ctx.lineWidth = 0.7;
    ctx.setLineDash([3, 5]);
    for (const [i, j] of this.lines) {
      const s1 = this.stars[i];
      const s2 = this.stars[j];
      ctx.beginPath();
      ctx.moveTo(s1.x + px, s1.y + py);
      ctx.lineTo(s2.x + px, s2.y + py);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // Stars — halo + tinted disk + hot white heart + diffraction spikes
    // on the two brightest stars (Betelgeuse + Rigel) for extra polish.
    const brightIdx = new Set([0, 5]); // Betelgeuse, Rigel
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const twinkle = 0.72 + 0.28 * Math.sin(this.time * 2.4 + s.phase);
      const alpha = a * twinkle;
      const [r, g, b] = s.rgb;
      const cx = s.x + px;
      const cy = s.y + py;

      // Halo
      const glowR = s.size * 5.5;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`);
      grd.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Diffraction cross on the two brightest stars
      if (brightIdx.has(i)) {
        const spikeLen = s.size * 4.5;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`;
        ctx.lineWidth = 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - spikeLen, cy);
        ctx.lineTo(cx + spikeLen, cy);
        ctx.moveTo(cx, cy - spikeLen);
        ctx.lineTo(cx, cy + spikeLen);
        ctx.stroke();
        ctx.restore();
      }

      // Tinted disk
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, s.size, 0, Math.PI * 2);
      ctx.fill();

      // Hot white heart (keeps the stars crisp, not blurry)
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(cx, cy, s.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Constellation helpers ──
function buildConstellations(stars, maxDist) {
  const lines = [];
  const used = new Set();
  // Simple proximity-based: connect nearby stars, max 2 connections per star
  const connCount = new Map();

  for (let i = 0; i < stars.length; i++) {
    if (stars[i].size < 1.0) continue; // skip tiny stars
    const a = stars[i];
    const neighbors = [];

    for (let j = i + 1; j < stars.length; j++) {
      if (stars[j].size < 1.0) continue;
      const b = stars[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist && dist > 30) {
        neighbors.push({ j, dist });
      }
    }

    // Sort by distance, take up to 2 closest
    neighbors.sort((n1, n2) => n1.dist - n2.dist);
    for (const n of neighbors) {
      const countA = connCount.get(i) || 0;
      const countB = connCount.get(n.j) || 0;
      if (countA >= 2 || countB >= 2) continue;
      const key = `${i}-${n.j}`;
      if (used.has(key)) continue;
      used.add(key);
      connCount.set(i, countA + 1);
      connCount.set(n.j, countB + 1);
      lines.push([i, n.j]);
    }
  }
  return lines;
}

function drawConstellations(ctx, stars, lines, offsetX, offsetY, globalAlpha) {
  if (lines.length === 0) return;
  ctx.save();
  ctx.globalAlpha = globalAlpha;
  ctx.strokeStyle = "rgba(180, 200, 240, 0.08)";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 8]);
  for (const [i, j] of lines) {
    const a = stars[i];
    const b = stars[j];
    const ax = a.x + offsetX * a.depth;
    const ay = a.y + offsetY * a.depth;
    const bx = b.x + offsetX * b.depth;
    const by = b.y + offsetY * b.depth;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

export function initProcessSpace() {
  const section = document.getElementById("process");
  if (!section) return;

  const canvas = section.querySelector(".process__stars");
  if (!canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ctx = canvas.getContext("2d");
  let stars = [];
  let shootingStars = [];
  let comet = null;
  let orion = null;
  let constellationLines = [];
  let animId = null;
  let isVisible = false;
  let nextShootingStarTime = 0;
  let burstRemaining = 0;
  let nextGlintTime = 0;
  let cometSpawned = false;

  // Mouse parallax state
  let mouseX = 0.5; // normalized 0–1
  let mouseY = 0.5;
  let smoothMouseX = 0.5;
  let smoothMouseY = 0.5;
  const PARALLAX_STRENGTH = 15; // max px offset
  const PARALLAX_SMOOTH = 0.05; // lerp factor

  function getMaxStars() {
    return window.innerWidth < CONFIG.mobileBreakpoint ? CONFIG.mobileMaxStars : CONFIG.maxStars;
  }

  function createStars() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = getMaxStars();
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push(new Star(w, h));
    }
    // Build constellation lines after stars are placed
    const maxDist = Math.min(w, h) * 0.12;
    constellationLines = buildConstellations(stars, maxDist);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    createStars();
    // Rebuild Orion to match the new canvas dimensions.
    orion = new Orion(w, h);
  }

  function scheduleNext() {
    let delay;
    if (burstRemaining > 0) {
      burstRemaining--;
      delay = CONFIG.burstMinMs + Math.random() * (CONFIG.burstMaxMs - CONFIG.burstMinMs);
    } else {
      delay = CONFIG.quietMinMs + Math.random() * (CONFIG.quietMaxMs - CONFIG.quietMinMs);
    }
    nextShootingStarTime = Date.now() + delay;
  }

  function scheduleGlint() {
    nextGlintTime = Date.now() + 10000 + Math.random() * 15000; // 10–25s
  }

  // Mouse tracking
  function onMouseMove(e) {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
  }

  function animate() {
    if (!isVisible) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Smooth parallax interpolation
    smoothMouseX += (mouseX - smoothMouseX) * PARALLAX_SMOOTH;
    smoothMouseY += (mouseY - smoothMouseY) * PARALLAX_SMOOTH;
    const offsetX = (smoothMouseX - 0.5) * PARALLAX_STRENGTH;
    const offsetY = (smoothMouseY - 0.5) * PARALLAX_STRENGTH;

    ctx.clearRect(0, 0, w, h);

    // Deep-space background gradient
    const bgGrd = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    bgGrd.addColorStop(0, "rgba(15, 20, 50, 0.12)");
    bgGrd.addColorStop(0.5, "rgba(8, 10, 30, 0.06)");
    bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, w, h);

    // Draw constellation lines (behind stars)
    drawConstellations(ctx, stars, constellationLines, offsetX, offsetY, 1);

    // Draw and update stars
    for (const star of stars) {
      if (!reducedMotion) star.update();
      star.draw(ctx, reducedMotion ? 0 : offsetX, reducedMotion ? 0 : offsetY);
    }

    // Orion constellation — drawn above background stars so its own
    // stars sit clearly, but below shooting stars and the comet.
    if (orion) {
      if (!reducedMotion) orion.update();
      orion.draw(ctx, reducedMotion ? 0 : offsetX, reducedMotion ? 0 : offsetY, 1);
    }

    if (!reducedMotion) {
      // Satellite glints
      if (Date.now() >= nextGlintTime && stars.length > 0) {
        const idx = Math.floor(Math.random() * stars.length);
        stars[idx].triggerGlint();
        scheduleGlint();
      }

      // Shooting stars
      if (Date.now() >= nextShootingStarTime) {
        shootingStars.push(new ShootingStar(w, h));
        if (burstRemaining === 0 && Math.random() < CONFIG.burstChance) {
          burstRemaining = 1 + Math.floor(Math.random() * CONFIG.burstMaxCount);
        }
        scheduleNext();
      }

      shootingStars = shootingStars.filter((ss) => {
        const alive = ss.update();
        if (alive) ss.draw(ctx);
        return alive;
      });

      // Comet — once per visit, after 15s of viewing
      if (!cometSpawned && Date.now() - visitStartTime > 15000) {
        comet = new Comet(w, h);
        cometSpawned = true;
      }

      if (comet) {
        const alive = comet.update();
        if (alive) {
          comet.draw(ctx);
        } else {
          comet = null;
        }
      }
    }

    animId = requestAnimationFrame(animate);
  }

  let visitStartTime = 0;

  function start() {
    if (isVisible) return;
    isVisible = true;
    if (!visitStartTime) visitStartTime = Date.now();
    resize();
    if (!reducedMotion) {
      scheduleNext();
      scheduleGlint();
    }
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

  // Mouse parallax listener
  if (!reducedMotion) {
    window.addEventListener("mousemove", onMouseMove, { passive: true });
  }

  // Handle resize
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isVisible) resize();
    }, 200);
  });
}
