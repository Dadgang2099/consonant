/**
 * office-splat — interactive Gaussian splat office scene.
 *
 * Stack: three.js + Spark (@sparkjsdev/spark) for splat rendering.
 * Monitors get live content via monitors.js (video / canvas / iframe planes
 * aligned to world-space corner coordinates from config/monitors.json).
 * Press C for the corner-calibration tool (calibrate.js, lazy-loaded).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';
import { MonitorLayer } from './monitors.js';

const section = document.getElementById('splat-section');
const canvas = document.getElementById('splat-canvas');
const cssLayer = document.getElementById('css3d-layer');
const loadingEl = document.getElementById('loading');
const loadingBar = document.getElementById('loading-bar');
const loadingLabel = document.getElementById('loading-label');
const introEl = document.getElementById('intro');
const errorEl = document.getElementById('error');

const IS_TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;

function fail(msg) {
  loadingEl.hidden = true;
  errorEl.hidden = false;
  errorEl.textContent = msg;
  throw new Error(msg);
}

// Embed hook: a host page (or single-file bundle) can pre-supply configs and
// splat bytes via window.__officeSplatEmbed = { files: {path: json}, splatSource }.
const EMBED = window.__officeSplatEmbed;

async function loadJSON(url) {
  if (EMBED?.files?.[url]) return structuredClone(EMBED.files[url]);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

// ── Config ───────────────────────────────────────────────────────────────
const sceneCfg = await loadJSON('config/scene.json').catch((e) => fail(`Could not load scene config — ${e.message}`));
const monitorsCfg = await loadJSON('config/monitors.json').catch(() => ({ monitors: [] }));

// ── Renderer / scene / camera ────────────────────────────────────────────
if (!document.createElement('canvas').getContext('webgl2')) {
  fail('This scene needs WebGL2, which your browser doesn’t support.');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // splats self-antialias; MSAA just costs fill rate
  alpha: true,      // needed so iframe monitors can punch through the canvas
  powerPreference: 'high-performance',
});
const maxDpr = IS_TOUCH
  ? sceneCfg.renderer.maxPixelRatioMobile
  : sceneCfg.renderer.maxPixelRatioDesktop;
renderer.setClearColor(new THREE.Color(sceneCfg.renderer.background), 1);
cssLayer.style.background = sceneCfg.renderer.background;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(sceneCfg.camera.fov, 1, 0.02, 100);
camera.position.fromArray(sceneCfg.camera.start.position);

const controls = new OrbitControls(camera, canvas);
controls.target.fromArray(sceneCfg.camera.start.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = sceneCfg.camera.minDistance;
controls.maxDistance = sceneCfg.camera.maxDistance;
controls.maxPolarAngle = THREE.MathUtils.degToRad(sceneCfg.camera.maxPolarAngleDeg);
controls.enablePan = true;
controls.panSpeed = 0.8;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.7;

// Keep both camera and target inside the configured room bounds.
const boundsMin = new THREE.Vector3().fromArray(sceneCfg.camera.bounds.min);
const boundsMax = new THREE.Vector3().fromArray(sceneCfg.camera.bounds.max);
function clampToBounds() {
  controls.target.clamp(boundsMin, boundsMax);
  camera.position.clamp(boundsMin, boundsMax);
}

// ── WASD / arrows fly (desktop nicety) ───────────────────────────────────
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
const flyTmp = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), move: new THREE.Vector3() };
function applyFly(dt) {
  if (!section.classList.contains('is-active')) return;
  const { fwd, right, move } = flyTmp;
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  right.crossVectors(fwd, camera.up).negate(); // left
  move.set(0, 0, 0);
  if (keys.has('KeyW')) move.add(fwd);
  if (keys.has('KeyS')) move.sub(fwd);
  if (keys.has('KeyA')) move.add(right);
  if (keys.has('KeyD')) move.sub(right);
  if (keys.has('KeyQ')) move.y -= 1;
  if (keys.has('KeyE')) move.y += 1;
  if (move.lengthSq() === 0) return;
  move.normalize().multiplyScalar(dt * 1.4);
  camera.position.add(move);
  controls.target.add(move);
}

// ── Splat scene ──────────────────────────────────────────────────────────
const splat = new SplatMesh({
  ...(EMBED?.splatSource ?? { url: sceneCfg.splatUrl }),
  raycastable: true,      // calibration tool click-picks points on the splat
  minRaycastOpacity: 0.4, // ignore wispy floaters when picking
  onProgress: (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      loadingBar.style.width = `${pct}%`;
      loadingLabel.textContent = `Loading scene… ${pct}%`;
    }
  },
});
if (sceneCfg.rotateXDeg) splat.rotation.x = THREE.MathUtils.degToRad(sceneCfg.rotateXDeg);
scene.add(splat);

splat.initialized
  .then(() => {
    loadingEl.hidden = true;
    introEl.hidden = false;
  })
  .catch((e) => fail(`Could not load splat asset — ${e.message ?? e}`));

// Diagnostic: ?debug=points renders the PLY as a raw three.js point cloud,
// bypassing Spark's raster pipeline entirely (useful on software GL / CI).
if (new URLSearchParams(location.search).get('debug') === 'points') {
  splat.visible = false;
  const { PlyReader } = await import('@sparkjsdev/spark');
  const bytes = EMBED?.splatSource?.fileBytes
    ?? new Uint8Array(await (await fetch(sceneCfg.splatUrl)).arrayBuffer());
  const reader = new PlyReader({ fileBytes: bytes });
  await reader.parseHeader();
  const pos = [], col = [];
  await reader.parseSplats((i, x, y, z, sx, sy, sz, qx, qy, qz, qw, opacity, r, g, b) => {
    pos.push(x, y, z);
    col.push(r, g, b);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.012, vertexColors: true }));
  if (sceneCfg.rotateXDeg) points.rotation.x = THREE.MathUtils.degToRad(sceneCfg.rotateXDeg);
  scene.add(points);
}

// ── Monitor overlays ─────────────────────────────────────────────────────
const monitorLayer = new MonitorLayer({
  scene,
  cssLayerEl: cssLayer,
  sectionEl: section,
  monitors: monitorsCfg.monitors ?? [],
});

// ── Activation (never hijack page scroll before opt-in) ──────────────────
document.getElementById('enter-btn').addEventListener('click', () => {
  introEl.hidden = true;
  section.classList.add('is-active');
});
canvas.addEventListener('dblclick', (ev) => {
  // double-click: re-aim the orbit target at whatever splat point was hit
  const hit = pick(ev);
  if (hit) controls.target.copy(hit.point);
});

const raycaster = new THREE.Raycaster();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(
    new THREE.Vector2(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1,
    ),
    camera,
  );
  return raycaster.intersectObject(splat, false)[0] ?? null;
}

// ── Calibration tool (dev-only, lazy) ────────────────────────────────────
let calibration = null;
addEventListener('keydown', async (e) => {
  if (e.code !== 'KeyC' || e.repeat) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (!calibration) {
    const { Calibrator } = await import('./calibrate.js');
    calibration = new Calibrator({
      scene, camera, canvas, controls, pick,
      monitorLayer,
      hintEl: document.getElementById('calibrate-hint'),
      sectionEl: section,
    });
  }
  calibration.toggle();
});
// I = interact with iframe monitors (canvas stops eating the pointer)
addEventListener('keydown', (e) => {
  if (e.code === 'KeyI' && !e.repeat) section.classList.toggle('iframe-input');
});

// ── Sizing / visibility / loop ───────────────────────────────────────────
function resize() {
  const w = section.clientWidth, h = section.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  monitorLayer.setSize(w, h);
}
new ResizeObserver(resize).observe(section);
resize();

let visible = true;
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.01 })
  .observe(section);

// dev console handle (also used by the calibration workflow docs)
window.__officeSplat = { THREE, scene, camera, renderer, controls, splat, monitorLayer };

let lastTime = 0;
renderer.setAnimationLoop((time) => {
  if (!visible) return;
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  applyFly(dt);
  controls.update();
  clampToBounds();
  monitorLayer.update(camera, dt);
  calibration?.update();
  renderer.render(scene, camera);
});
