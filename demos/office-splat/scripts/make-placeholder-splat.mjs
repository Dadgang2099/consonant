#!/usr/bin/env node
/**
 * Generates a stylized "office" placeholder Gaussian splat in standard 3DGS
 * binary PLY format (the same layout INRIA/SuperSplat/Spark all read), plus a
 * matching config/monitors.placeholder.json with the exact screen-corner
 * coordinates of the three fake monitors it builds.
 *
 * The placeholder exists so the viewer, controls, and monitor-overlay system
 * are fully exercisable before the real XGRIDS/LCC capture is exported.
 * Swap config/scene.json's `splatUrl` to the real asset and delete this.
 *
 * Coordinate frame: Y-up, meters, origin at room-center floor level.
 * (Real 3DGS exports are usually Y-down; scene.json has `rotateX` for that.)
 *
 * Usage: node demos/office-splat/scripts/make-placeholder-splat.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PLY = path.join(__dirname, '..', 'assets', 'placeholder-office.ply');
const OUT_MON = path.join(__dirname, '..', 'config', 'monitors.placeholder.json');

const SH_C0 = 0.28209479177387814;
const logit = (p) => Math.log(p / (1 - p));

/** @type {Array<{x:number,y:number,z:number,r:number,g:number,b:number,a:number,s0:number,s1:number,s2:number,q:[number,number,number,number]}>} */
const splats = [];

let seed = 1234567;
function rand() {
  // xorshift32 — deterministic so the asset is reproducible
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return ((seed >>> 0) / 4294967296);
}
const jitter = (v, amt) => v + (rand() - 0.5) * amt;

function quatFromYaw(yaw) {
  return [Math.cos(yaw / 2), 0, Math.sin(yaw / 2), 0]; // (w,x,y,z)
}

/**
 * Scatter n gaussians over a rectangle lying in a plane.
 * origin = corner, u/v = edge vectors. thickness = sigma along the normal.
 */
function patch(n, origin, u, v, color, { thickness = 0.004, spread = 0.02, alpha = 0.95, colorJitter = 0.05, q = [1, 0, 0, 0] } = {}) {
  const ulen = Math.hypot(...u), vlen = Math.hypot(...v);
  for (let i = 0; i < n; i++) {
    const a = rand(), b = rand();
    const x = origin[0] + u[0] * a + v[0] * b;
    const y = origin[1] + u[1] * a + v[1] * b;
    const z = origin[2] + u[2] * a + v[2] * b;
    const cj = (rand() - 0.5) * colorJitter * 2;
    // in-plane sigmas scale with point density so coverage stays continuous
    const s = Math.max(0.006, Math.sqrt((ulen * vlen) / n) * (0.6 + rand() * 0.5)) * (1 + spread);
    splats.push({
      x: jitter(x, 0.004), y: jitter(y, 0.004), z: jitter(z, 0.004),
      r: color[0] + cj, g: color[1] + cj, b: color[2] + cj,
      a: alpha, s0: s, s1: s, s2: thickness, q,
    });
  }
}

/** Axis-aligned-ish box shell made of six patches. c = center, d = half-extents. */
function box(nPerFace, c, d, color, opts = {}) {
  const [cx, cy, cz] = c, [dx, dy, dz] = d;
  patch(nPerFace, [cx - dx, cy + dy, cz - dz], [2 * dx, 0, 0], [0, 0, 2 * dz], color, opts); // top
  patch(nPerFace, [cx - dx, cy - dy, cz + dz], [2 * dx, 0, 0], [0, 2 * dy, 0], color, opts); // front
  patch(nPerFace, [cx - dx, cy - dy, cz - dz], [2 * dx, 0, 0], [0, 2 * dy, 0], color, opts); // back
  patch(Math.floor(nPerFace / 2), [cx - dx, cy - dy, cz - dz], [0, 0, 2 * dz], [0, 2 * dy, 0], color, opts); // left
  patch(Math.floor(nPerFace / 2), [cx + dx, cy - dy, cz - dz], [0, 0, 2 * dz], [0, 2 * dy, 0], color, opts); // right
}

function blob(n, c, radius, color, { alpha = 0.9, colorJitter = 0.06 } = {}) {
  for (let i = 0; i < n; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1), rr = radius * Math.cbrt(rand());
    const cj = (rand() - 0.5) * colorJitter * 2;
    const s = radius * (0.10 + rand() * 0.12);
    splats.push({
      x: c[0] + rr * Math.sin(ph) * Math.cos(th),
      y: c[1] + rr * Math.cos(ph),
      z: c[2] + rr * Math.sin(ph) * Math.sin(th),
      r: color[0] + cj, g: color[1] + cj, b: color[2] + cj,
      a: alpha, s0: s, s1: s, s2: s, q: [1, 0, 0, 0],
    });
  }
}

// ── Room shell (4m wide × 3m deep × 2.6m tall, open front/right for the camera)
const FLOOR = [0.42, 0.36, 0.30];   // warm wood
const WALL  = [0.82, 0.80, 0.76];   // off-white
patch(16000, [-2.0, 0, -1.5], [4.0, 0, 0], [0, 0, 3.0], FLOOR, { alpha: 0.98, colorJitter: 0.04 });
patch(11000, [-2.0, 0, -1.5], [4.0, 0, 0], [0, 2.6, 0], WALL, { alpha: 0.98, colorJitter: 0.03 }); // back wall
patch(9000,  [-2.0, 0, 1.5],  [0, 0, -3.0], [0, 2.6, 0], WALL, { alpha: 0.98, colorJitter: 0.03 }); // left wall
patch(3500,  [-1.6, 0.02, 0.15], [2.0, 0, 0], [0, 0, 1.1], [0.35, 0.38, 0.44], { alpha: 0.9 });      // rug

// ── Desk against the back wall
box(2400, [0, 0.71, -1.10], [0.90, 0.015, 0.35], [0.55, 0.42, 0.30], { alpha: 0.97 });
box(300, [-0.82, 0.35, -1.10], [0.03, 0.35, 0.30], [0.20, 0.20, 0.22]); // legs
box(300, [0.82, 0.35, -1.10], [0.03, 0.35, 0.30], [0.20, 0.20, 0.22]);

// ── Monitors. Screens face +z (toward the room). Corner order: TL,TR,BR,BL
//    as seen by a viewer looking AT the screen.
const monitors = [];
function monitor(id, center, w, h, yawDeg) {
  const yaw = (yawDeg * Math.PI) / 180;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw); // screen "right" in world XZ
  const [cx, cy, cz] = center;
  const hw = w / 2, hh = h / 2;
  const q = quatFromYaw(yaw);
  const corner = (sx, sy) => [
    +(cx + rx * sx * hw).toFixed(4),
    +(cy + sy * hh).toFixed(4),
    +(cz + rz * sx * hw).toFixed(4),
  ];
  // bezel slab (slightly larger, behind the screen plane)
  const nx = -rz, nz = rx; // screen normal (facing +z at yaw 0)
  patch(1400,
    [cx - rx * (hw + 0.012) - nx * 0.012, cy - hh - 0.012, cz - rz * (hw + 0.012) - nz * 0.012],
    [rx * (w + 0.024), 0, rz * (w + 0.024)], [0, h + 0.024, 0],
    [0.07, 0.07, 0.08], { alpha: 0.98, q });
  // dark "off" screen — this is what the live overlay replaces
  patch(900, [cx - rx * hw, cy - hh, cz - rz * hw], [rx * w, 0, rz * w], [0, h, 0],
    [0.04, 0.05, 0.07], { alpha: 0.98, colorJitter: 0.015, q });
  // stand
  patch(250, [cx - 0.02, cy - hh - 0.16, cz - 0.02], [0.04, 0, 0], [0, 0.16, 0], [0.10, 0.10, 0.11], { q });
  monitors.push({
    id,
    label: `${id} (placeholder)`,
    mode: id === 'center' ? 'iframe' : 'canvas',
    src: id === 'center' ? 'screens/demo-site.html' : null,
    variant: id === 'left' ? 'terminal' : id === 'right' ? 'dashboard' : undefined,
    corners: { tl: corner(-1, 1), tr: corner(1, 1), br: corner(1, -1), bl: corner(-1, -1) },
  });
}
monitor('center', [0, 1.06, -1.38], 0.60, 0.34, 0);
monitor('left',  [-0.62, 1.02, -1.30], 0.53, 0.30, -24);
monitor('right', [0.62, 1.02, -1.30], 0.53, 0.30, 24);

// ── Clutter
blob(3000, [-1.45, 0.55, -1.05], 0.28, [0.24, 0.42, 0.28]);              // plant
box(200, [-1.45, 0.14, -1.05], [0.10, 0.14, 0.10], [0.60, 0.40, 0.30]);  // pot
blob(4200, [0, 0.55, -0.25], 0.33, [0.16, 0.17, 0.20]);                  // chair seat/back
box(150, [0, 0.18, -0.25], [0.05, 0.18, 0.05], [0.25, 0.25, 0.27]);      // chair post
box(400, [0.62, 0.76, -1.05], [0.16, 0.03, 0.11], [0.75, 0.72, 0.68]);   // keyboard
box(700, [-1.99, 1.55, -0.4], [0.012, 0.35, 0.5], [0.48, 0.34, 0.26]);   // shelf on left wall
for (let i = 0; i < 7; i++) {
  box(90, [-1.94, 1.99 + 0.0, -0.75 + i * 0.11], [0.05, 0.11, 0.02],
    [[0.55, 0.25, 0.22], [0.24, 0.35, 0.55], [0.72, 0.62, 0.30], [0.30, 0.50, 0.38]][i % 4]); // books
}

// ── Write binary 3DGS PLY ──────────────────────────────────────────────────
const N = splats.length;
const props = ['x', 'y', 'z', 'nx', 'ny', 'nz', 'f_dc_0', 'f_dc_1', 'f_dc_2',
  'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
const header =
  `ply\nformat binary_little_endian 1.0\nelement vertex ${N}\n` +
  props.map((p) => `property float ${p}`).join('\n') + '\nend_header\n';

const buf = Buffer.alloc(Buffer.byteLength(header) + N * props.length * 4);
let off = buf.write(header, 0, 'ascii');
const clamp01 = (v) => Math.min(0.999, Math.max(0.001, v));
for (const s of splats) {
  buf.writeFloatLE(s.x, off); off += 4;
  buf.writeFloatLE(s.y, off); off += 4;
  buf.writeFloatLE(s.z, off); off += 4;
  off += 12; // nx,ny,nz = 0
  buf.writeFloatLE((clamp01(s.r) - 0.5) / SH_C0, off); off += 4;
  buf.writeFloatLE((clamp01(s.g) - 0.5) / SH_C0, off); off += 4;
  buf.writeFloatLE((clamp01(s.b) - 0.5) / SH_C0, off); off += 4;
  buf.writeFloatLE(logit(clamp01(s.a)), off); off += 4;
  buf.writeFloatLE(Math.log(Math.max(1e-4, s.s0)), off); off += 4;
  buf.writeFloatLE(Math.log(Math.max(1e-4, s.s1)), off); off += 4;
  buf.writeFloatLE(Math.log(Math.max(1e-4, s.s2)), off); off += 4;
  buf.writeFloatLE(s.q[0], off); off += 4;
  buf.writeFloatLE(s.q[1], off); off += 4;
  buf.writeFloatLE(s.q[2], off); off += 4;
  buf.writeFloatLE(s.q[3], off); off += 4;
}
fs.mkdirSync(path.dirname(OUT_PLY), { recursive: true });
fs.writeFileSync(OUT_PLY, buf);
fs.writeFileSync(OUT_MON, JSON.stringify({ monitors }, null, 2) + '\n');
console.log(`wrote ${OUT_PLY} (${N} splats, ${(buf.length / 1e6).toFixed(1)} MB)`);
console.log(`wrote ${OUT_MON}`);
