// hero-shader.js — Three.js liquid fluid background for hero section
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170/build/three.module.min.js";

const CONFIG = {
  speed: 0.15,
  noiseScale: 1.8,
  mouseRadius: 0.35,
  mouseStrength: 0.4,
  mouseDamp: 0.03,
};

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r, g, b];
}

function getSchemeColors() {
  const style = getComputedStyle(document.documentElement);
  const v = (prop) => parseFloat(style.getPropertyValue(prop)) || 0;

  const huePri = v("--hue-primary");
  const satPri = v("--sat-primary");
  const lightPri = v("--light-primary");
  const hueSec = v("--hue-secondary");
  const satSec = v("--sat-secondary");
  const lightSec = v("--light-secondary");

  return {
    c0: hslToRgb(huePri, satPri, lightPri),
    c1: hslToRgb(hueSec, satSec, lightSec),
    c2: hslToRgb(huePri, satPri, Math.min(lightPri + 15, 90)),
    c3: hslToRgb(huePri, satPri, Math.max(lightPri - 15, 10)),
    c4: hslToRgb(hueSec, satSec, Math.min(lightSec + 15, 90)),
  };
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec2  uMouse;
  uniform vec3  uColor0, uColor1, uColor2, uColor3, uColor4;
  uniform float uNoiseScale, uMouseRadius, uMouseStrength;
  uniform float uDissolve;
  varying vec2 vUv;

  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float val = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 4; i++) {
      val += amp * snoise(p * freq);
      freq *= 2.0; amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 mouseP = (uMouse - 0.5) * vec2(aspect, 1.0);
    float mouseDist = length(p - mouseP);
    float mouseInfluence = smoothstep(uMouseRadius, 0.0, mouseDist);
    vec2 warp = normalize(p - mouseP + 0.001) * mouseInfluence * uMouseStrength;
    p += warp;

    float t = uTime;
    float n1 = fbm(vec3(p * uNoiseScale, t * 0.4));
    float n2 = fbm(vec3(p * uNoiseScale * 0.7 + 3.3, t * 0.3 + 10.0));
    float n3 = snoise(vec3(p * uNoiseScale * 1.5 + n1 * 0.5, t * 0.25));
    float warped = fbm(vec3(p * uNoiseScale + vec2(n1, n2) * 0.8, t * 0.2));

    float colorIndex = clamp(warped * 0.5 + 0.5, 0.0, 0.999);
    vec3 color;
    float segment = colorIndex * 4.0;
    int idx = int(floor(segment));
    float f = fract(segment);
    float s = f * f * (3.0 - 2.0 * f);
    if (idx == 0)      color = mix(uColor0, uColor1, s);
    else if (idx == 1)  color = mix(uColor1, uColor2, s);
    else if (idx == 2)  color = mix(uColor2, uColor3, s);
    else                color = mix(uColor3, uColor4, s);

    color *= 0.85 + 0.15 * n3;
    float vig = 1.0 - smoothstep(0.4, 1.4, length((uv - 0.5) * 1.8));
    color *= vig;

    /* ── Dissolve ── */
    float dissolveNoise = snoise(vec3(uv * 4.0, t * 0.1 + 50.0)) * 0.5 + 0.5;
    dissolveNoise += (1.0 - uv.y) * 0.3;
    dissolveNoise = clamp(dissolveNoise, 0.0, 1.0);
    float edge = 0.06;
    float dissolveAlpha = smoothstep(uDissolve - edge, uDissolve + edge, dissolveNoise);
    /* edge glow */
    float glowBand = smoothstep(uDissolve - edge * 3.0, uDissolve, dissolveNoise)
                   - smoothstep(uDissolve, uDissolve + edge * 0.5, dissolveNoise);
    color += glowBand * mix(uColor0, uColor1, 0.5) * 2.5;

    /* Alpha-based dissolve — canvas becomes transparent, fallback bg shows through */
    gl_FragColor = vec4(color, dissolveAlpha);
  }
`;

let renderer, scene, camera, uniforms, animId;
let mouseTarget, mouseCurrent;
let isRunning = false;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export function initHeroShader(canvasEl) {
  if (!canvasEl) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!hasWebGL()) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;

  const colors = getSchemeColors();
  const pixelRatio = Math.min(devicePixelRatio, 1.5);

  // Use parent dimensions — canvas clientWidth can be 0 before CSS layout on hard reload
  const parent = canvasEl.parentElement || canvasEl;
  const initW = parent.clientWidth || window.innerWidth;
  const initH = parent.clientHeight || window.innerHeight;

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(pixelRatio);

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  uniforms = {
    uTime:          { value: 0 },
    uResolution:    { value: new THREE.Vector2(initW, initH) },
    uMouse:         { value: new THREE.Vector2(0.5, 0.5) },
    uColor0:        { value: new THREE.Vector3(...colors.c0) },
    uColor1:        { value: new THREE.Vector3(...colors.c1) },
    uColor2:        { value: new THREE.Vector3(...colors.c2) },
    uColor3:        { value: new THREE.Vector3(...colors.c3) },
    uColor4:        { value: new THREE.Vector3(...colors.c4) },
    uNoiseScale:    { value: CONFIG.noiseScale },
    uMouseRadius:   { value: CONFIG.mouseRadius },
    uMouseStrength: { value: CONFIG.mouseStrength },
    uDissolve:      { value: 0.0 },
  };

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true }),
  );
  scene.add(plane);

  mouseTarget = new THREE.Vector2(0.5, 0.5);
  mouseCurrent = new THREE.Vector2(0.5, 0.5);

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("resize", onResize);

  // Force a resize after layout settles (fixes hard-reload sizing)
  requestAnimationFrame(() => onResize());

  isRunning = true;
  tick();
  return true;
}

function onPointerMove(e) {
  mouseTarget.x = e.clientX / innerWidth;
  mouseTarget.y = 1.0 - e.clientY / innerHeight;
}

function onResize() {
  if (!renderer) return;
  const canvas = renderer.domElement;
  const parent = canvas.parentElement || canvas;
  const w = parent.clientWidth || window.innerWidth;
  const h = parent.clientHeight || window.innerHeight;
  renderer.setSize(w, h);
  uniforms.uResolution.value.set(w, h);
}

const clock = { start: 0 };

function tick() {
  if (!isRunning) return;
  if (!clock.start) clock.start = performance.now();
  uniforms.uTime.value = ((performance.now() - clock.start) / 1000) * CONFIG.speed;

  mouseCurrent.x += (mouseTarget.x - mouseCurrent.x) * CONFIG.mouseDamp;
  mouseCurrent.y += (mouseTarget.y - mouseCurrent.y) * CONFIG.mouseDamp;
  uniforms.uMouse.value.copy(mouseCurrent);

  renderer.render(scene, camera);
  animId = requestAnimationFrame(tick);
}

export function pauseHeroShader() {
  isRunning = false;
  if (animId) cancelAnimationFrame(animId);
}

export function resumeHeroShader() {
  if (isRunning || !renderer) return;
  isRunning = true;
  tick();
}

export function updateShaderColors() {
  if (!uniforms) return;
  const colors = getSchemeColors();
  uniforms.uColor0.value.set(...colors.c0);
  uniforms.uColor1.value.set(...colors.c1);
  uniforms.uColor2.value.set(...colors.c2);
  uniforms.uColor3.value.set(...colors.c3);
  uniforms.uColor4.value.set(...colors.c4);
}

/** Animate uDissolve from current → 1.0 (evaporate). Returns a Promise. */
export function dissolveShader(duration = 1500) {
  return animateDissolve(1.0, duration);
}

/** Animate uDissolve from current → 0.0 (materialize). Returns a Promise. */
export function materializeShader(duration = 1500) {
  return animateDissolve(0.0, duration);
}

function animateDissolve(target, duration) {
  return new Promise((resolve) => {
    if (!uniforms) { resolve(); return; }
    const start = uniforms.uDissolve.value;
    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1.0);
      const eased = t * t * (3 - 2 * t);          // smoothstep
      uniforms.uDissolve.value = start + (target - start) * eased;
      if (t < 1.0) {
        requestAnimationFrame(step);
      } else {
        uniforms.uDissolve.value = target;
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}
