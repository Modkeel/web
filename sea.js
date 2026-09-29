// The hero scene: a night sea drawn at pixel-art resolution, lit per pixel (moon, lighthouse,
// the boat's lantern) and dithered to a small set of shades. ~15 fps, paused off screen.
(() => {
  const cv = document.getElementById("sea");
  const ctx = cv.getContext("2d", { alpha: false });
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - 0.5);
  const STEP = 9;

  // the boat from the Modkeel icon: hull rows (y, first x, last x), waterline at y 18
  const HULL = [[13, 4, 27], [14, 4, 27], [15, 5, 26], [16, 5, 26], [17, 6, 25], [18, 7, 24],
    [19, 8, 23], [20, 9, 22]];
  const KEEL = [[21, 14, 17], [22, 14, 17], [23, 14, 17], [24, 14, 17], [25, 15, 16], [26, 15, 16]];
  const FLAGS = [[18, 21, 24, 22, 19, 17], [19, 22, 23, 23, 20, 17]];
  const C = {
    outline: [43, 29, 20], plank: [184, 135, 82], dark: [141, 99, 56], light: [208, 160, 104],
    mast: [95, 66, 40], keel: [240, 138, 60], keelL: [255, 184, 110], keelD: [178, 90, 34],
    lamp: [255, 226, 150], foam: [150, 205, 235],
  };

  function sprite(flag) {
    const s = new Map();
    const put = (x, y, c) => s.set(x + "," + y, c);
    for (let y = 3; y < 13; y++) put(16, y, C.mast);
    FLAGS[flag].forEach((b, i) => { for (let x = 17; x <= b; x++) put(x, 3 + i, i < 3 ? C.keel : C.keelD); });
    HULL.forEach(([y, a, b], row) => {
      for (let x = a; x <= b; x++) {
        const joint = (x + Math.floor(row / 3) * 5) % 9 === 0;
        let c = row % 3 === 2 || joint ? C.dark : C.plank;
        if (row % 3 === 0 && !joint) c = C.light;
        put(x, y, c);
      }
      put(a, y, C.outline); put(b, y, C.outline);
    });
    for (let x = 4; x <= 27; x++) put(x, 12, C.outline);
    for (let x = 9; x <= 22; x++) put(x, 21, C.outline);
    KEEL.forEach(([y, a, b]) => {
      for (let x = a; x <= b; x++) put(x, y, x === a ? C.keelL : x === b ? C.keelD : C.keel);
      put(a - 1, y, C.outline); put(b + 1, y, C.outline);
    });
    put(15, 27, C.outline); put(16, 27, C.outline);
    put(26, 11, C.mast); put(26, 10, C.lamp); put(26, 9, C.outline);
    return [...s].map(([k, c]) => { const [x, y] = k.split(",").map(Number); return [x, y, c]; });
  }
  const SPRITES = [sprite(0), sprite(1)];

  let W, H, buf, img, hz, wy, bx, moon, stars, land, lh, star = null;

  function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  const lerp = (a, b, k) => a + (b - a) * k;

  function layout() {
    const r = cv.parentElement.getBoundingClientRect();
    const px = Math.max(3, Math.min(8, Math.round(Math.min(Math.max(r.height, 480), r.width * 1.1) / 105)));
    W = Math.ceil(r.width / px); H = Math.ceil(r.height / px);
    cv.width = W; cv.height = H;
    cv.style.width = W * px + "px"; cv.style.height = H * px + "px";
    img = ctx.createImageData(W, H);
    buf = new Float32Array(W * H * 3);
    const wide = W > 170;
    hz = Math.round(H * (wide ? 0.6 : 0.72));
    wy = hz + Math.max(7, Math.round((H - hz) * 0.4));
    bx = Math.round(W * (wide ? 0.68 : 0.6)) - 16;
    moon = { x: Math.round(W * (wide ? 0.56 : 0.8)), y: Math.round(H * (wide ? 0.2 : 0.1)), r: 5 };

    const rand = rng(7);
    // land: a blocky island on the right carrying a lighthouse, a low one far left
    land = new Int8Array(W);
    const island = (from, to, top) => {
      for (let x = Math.max(0, from); x < Math.min(W, to); x += 3) {
        const u = (x - from) / (to - from);
        const h = Math.max(1, Math.round(top * Math.sin(Math.PI * u) ** 0.7 + (rand() * 2 - 1)));
        for (let k = 0; k < 3 && x + k < W; k++) land[x + k] = h;
      }
    };
    const from = Math.round(W * (wide ? 0.8 : 0.72));
    island(from, Math.round(W * 1.1), Math.min(12, Math.round(H * 0.09)));
    island(-Math.round(W * 0.05), Math.round(W * 0.12), 4);
    let peak = from;
    for (let x = from; x < W; x++) if (land[x] > land[peak]) peak = x;
    lh = { x: peak, top: hz - land[peak] - 9 };

    stars = [];
    for (let i = 0; i < (W * hz) / 70; i++) {
      const x = Math.floor(rand() * W), y = Math.floor(rand() * (hz - 10));
      if (Math.hypot(x - moon.x, y - moon.y) > moon.r * 3) stars.push([x, y, rand() * 6.3, 0.35 + rand() * 0.65]);
    }
  }

  function add(i, r, g, b) { buf[i] += r; buf[i + 1] += g; buf[i + 2] += b; }
  function set(i, [r, g, b]) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; }

  function draw(t) {
    const bob = Math.round(Math.sin(t * 1.1) * 0.9);
    const by = wy - 18 + bob;
    const lamp = { x: bx + 26, y: by + 10 };
    const flick = still ? 1 : 0.88 + 0.12 * Math.sin(t * 13) * Math.sin(t * 7.3);
    const beam = Math.cos(t * 0.7); // the lighthouse lens: +1 facing right, -1 left, 0 at us
    const lx = lh.x, ly = lh.top;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        let r, g, b;
        if (y < hz) {
          const k = (y / hz) ** 2;
          r = lerp(6, 36, k); g = lerp(10, 42, k); b = lerp(20, 64, k);
          const gx = (x - W * 0.9) / (W * 0.3), gy = (hz - y) / (H * 0.16);
          const glow = Math.exp(-gx * gx - gy * gy);
          r += 96 * glow; g += 42 * glow; b += 10 * glow;
          const d = Math.hypot(x - moon.x, y - moon.y);
          const halo = Math.max(0, 1 - d / (moon.r * 7)) ** 2;
          r += 36 * halo; g += 46 * halo; b += 62 * halo;
          if (d <= moon.r + 0.3) {
            const shade = (x - moon.x) - (y - moon.y) < -4 ? 0.82 : 1;
            r = 226 * shade; g = 230 * shade; b = 238 * shade;
          }
        } else {
          const d = (y - hz) / (H - hz);
          r = lerp(24, 7, d); g = lerp(50, 18, d); b = lerp(80, 34, d);
          const f = 1 / (0.3 + d * 1.5);
          const w = Math.sin(x * 0.2 * f + t * 1.3 + y * 1.1) + Math.sin(x * 0.08 * f - t * 0.8 + y * 2.3 + 1.7);
          if (w > 1.5) { r += 22; g += 36; b += 48; } else if (w < -1.55) { r -= 5; g -= 7; b -= 7; }
          const shimmer = Math.sin(y * 1.7 + t * 2.4 + (x >> 1) * 1.3);
          const dm = Math.abs(x - moon.x), mw = 1 + d * 7;
          if (dm < mw && shimmer > 0.1) { const k = (1 - dm / mw) * (1 - d * 0.5); r += 150 * k; g += 158 * k; b += 168 * k; }
          const dg = Math.abs(x - W * 0.9) / (W * 0.18);
          if (dg < 1 && shimmer > 0.5) { const k = (1 - dg) * (1 - d) ** 2; r += 70 * k; g += 30 * k; b += 6 * k; }
          const dl = Math.abs(x - lamp.x), lw = 1 + (y - wy) * 0.35;
          if (y > wy && y < wy + 16 && dl < lw && Math.sin(y * 2.1 - t * 3 + x) > 0) {
            const k = (1 - dl / lw) * (1 - (y - wy) / 16) * flick;
            r += 120 * k; g += 70 * k; b += 20 * k;
          }
          if (y === hz) { r += 10; g += 12; b += 14; }
        }
        buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
      }
    }

    // land silhouettes, rim-lit by the glow behind them
    for (let x = 0; x < W; x++) {
      for (let h = 0; h < land[x]; h++) {
        const y = hz - 1 - h, i = (y * W + x) * 3;
        const rim = h === land[x] - 1;
        set(i, rim ? (x > W / 2 ? [92, 52, 32] : [56, 68, 90]) : [12, 16, 24]);
      }
    }

    // lighthouse: a white tower with a red band and a lamp that turns
    for (let y = ly + 1; y < hz - land[lx] + 1; y++) {
      for (const dx of [0, 1]) {
        const band = (y - ly) % 4 === 1;
        set((y * W + lx + dx) * 3, band ? (dx ? [120, 40, 34] : [170, 58, 46]) : dx ? [140, 144, 150] : [208, 210, 214]);
      }
    }
    set((ly * W + lx) * 3, [255, 236, 170]); set((ly * W + lx + 1) * 3, [255, 236, 170]);
    const face = 1 - Math.abs(beam);
    for (let y = Math.max(0, ly - 12); y < Math.min(hz, ly + 12); y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const dx = x - lx, dy = y - ly;
        const flare = Math.max(0, 1 - Math.hypot(dx, dy) / (3 + face * 7)) ** 2 * (0.3 + face * 0.9);
        let k = flare;
        const along = dx * Math.sign(beam), len = W * 0.55 * Math.abs(beam);
        if (along > 1 && along < len) {
          const perp = Math.abs(dy + along * 0.06), wdt = 0.8 + along * 0.07;
          if (perp < wdt) k += (1 - along / len) * (1 - perp / wdt) * 0.55;
        }
        if (k > 0) add(i, 255 * k, 214 * k, 150 * k);
      }
    }

    for (const [x, y, p, a] of stars) {
      const k = a * (still ? 1 : 0.55 + 0.45 * Math.sin(t * 1.7 + p));
      if (y < hz - land[x]) add((y * W + x) * 3, 120 * k, 130 * k, 150 * k);
    }

    if (!still) {
      if (!star && Math.random() < 0.005) star = { x: W * (0.3 + Math.random() * 0.5), y: 2 + Math.random() * H * 0.2, age: 0 };
      if (star) {
        star.age += 1;
        for (let s = 0; s < 7; s++) {
          const x = Math.round(star.x + (star.age - s) * 2.2), y = Math.round(star.y + (star.age - s) * 0.8);
          if (x >= 0 && x < W && y >= 0 && y < hz && s <= star.age) add((y * W + x) * 3, 200 * (1 - s / 7), 210 * (1 - s / 7), 230 * (1 - s / 7));
        }
        if (star.age > 12) star = null;
      }
    }

    // the boat; below the waterline it shows through the water, keel included
    for (const [sx, sy, c] of SPRITES[still ? 0 : Math.floor(t * 2) % 2]) {
      const x = bx + sx, y = by + sy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = (y * W + x) * 3;
      if (y >= wy) {
        const depth = Math.min(1, (y - wy) / 10);
        const m = 0.45 + depth * 0.25;
        set(i, [lerp(c[0], buf[i], m), lerp(c[1], buf[i + 1], m), lerp(c[2] + 20, buf[i + 2], m)]);
      } else set(i, c);
    }
    const foam = Math.floor(t * 3) % 2;
    for (const x of [bx + 5 - foam, bx + 6, bx + 25, bx + 26 + foam]) if (x >= 0 && x < W) set((wy * W + x) * 3, C.foam);

    // the lantern lights what is near it
    const R = 26;
    for (let y = Math.max(0, lamp.y - R); y < Math.min(H, lamp.y + R); y++) {
      for (let x = Math.max(0, lamp.x - R); x < Math.min(W, lamp.x + R); x++) {
        const d = Math.hypot(x - lamp.x, (y - lamp.y) * 1.2);
        if (d >= R) continue;
        const k = (1 - d / R) ** 2 * flick * (y > wy ? 0.5 : 1);
        const i = (y * W + x) * 3;
        buf[i] = buf[i] * (1 + 1.1 * k) + 70 * k;
        buf[i + 1] = buf[i + 1] * (1 + 0.7 * k) + 34 * k;
        buf[i + 2] = buf[i + 2] * (1 + 0.15 * k) + 6 * k;
      }
    }

    const out = img.data;
    for (let y = 0, i = 0, o = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i += 3, o += 4) {
        const d = BAYER[((y & 3) << 2) | (x & 3)];
        out[o] = Math.round(buf[i] / STEP + d) * STEP;
        out[o + 1] = Math.round(buf[i + 1] / STEP + d) * STEP;
        out[o + 2] = Math.round(buf[i + 2] / STEP + d) * STEP;
        out[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  let visible = true, last = 0;
  const t0 = performance.now();
  function frame(now) {
    if (!visible || document.hidden) return;
    if (now - last >= 66) { last = now; draw(Math.max(0, now - t0) / 1000); }
    requestAnimationFrame(frame);
  }
  function start() { if (!still) requestAnimationFrame(frame); }

  layout();
  draw(0);
  new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) start(); })
    .observe(cv);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) start(); });
  let resize;
  addEventListener("resize", () => {
    clearTimeout(resize);
    resize = setTimeout(() => { layout(); draw((performance.now() - t0) / 1000); }, 150);
  });
  start();
})();
