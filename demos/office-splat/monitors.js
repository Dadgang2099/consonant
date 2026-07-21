/**
 * MonitorLayer — replaces baked-in monitor pixels in the splat with live
 * content, aligned to world-space screen corners from config/monitors.json.
 *
 * Per-monitor `mode`:
 *  - "canvas": animated CanvasTexture (built-in demo screens; variant picked
 *    per monitor via `variant` or id). Always works offline.
 *  - "video":  looping muted <video> as a texture (`src` = mp4/webm). Falls
 *    back to canvas mode if the file can't load.
 *  - "iframe": a real live web page. The WebGL quad is a "hole punch"
 *    (NoBlending, alpha 0) so a CSS3D-transformed <iframe> *behind* the
 *    canvas shows through, occluded correctly by depth-tested splats.
 *    Press I to forward pointer input to iframes.
 *
 * Corners are {tl,tr,br,bl} in world space, as seen facing the screen.
 * Content planes are pushed `zOffset` metres along the screen normal so they
 * sit just proud of the splat surface (no z-fighting with baked pixels).
 */

import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

const IFRAME_PX_PER_METER = 1600; // 0.6 m wide screen → 960 px iframe

export class MonitorLayer {
  constructor({ scene, cssLayerEl, sectionEl, monitors }) {
    this.scene = scene;
    this.sectionEl = sectionEl;
    this.entries = [];
    this.canvasScreens = [];
    this.cssRenderer = null;
    this.cssScene = null;
    this.cssLayerEl = cssLayerEl;
    this._time = 0;
    for (const cfg of monitors) this.addMonitor(cfg);
  }

  /** Build (or rebuild) one monitor from its config entry. */
  addMonitor(cfg) {
    const frame = cornersToFrame(cfg.corners);
    if (!frame) {
      console.warn(`[monitors] ${cfg.id}: degenerate corners, skipped`, cfg.corners);
      return null;
    }
    const zOffset = cfg.zOffset ?? 0.006;
    const entry = { cfg, frame, group: new THREE.Group() };
    this.scene.add(entry.group);

    // Opaque backing plane: hides the baked splat screen even while content
    // is still loading, and writes depth so splats behind are occluded.
    const backing = quadMesh(frame, zOffset * 0.5, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    entry.group.add(backing);

    const mode = cfg.mode ?? 'canvas';
    if (mode === 'iframe' && cfg.src) this.#buildIframe(entry, zOffset);
    else if (mode === 'video' && cfg.src) this.#buildVideo(entry, zOffset);
    else this.#buildCanvas(entry, zOffset);

    this.entries.push(entry);
    return entry;
  }

  removeMonitor(entry) {
    this.scene.remove(entry.group);
    if (entry.cssObject) this.cssScene.remove(entry.cssObject);
    entry.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    this.entries = this.entries.filter((e) => e !== entry);
    this.canvasScreens = this.canvasScreens.filter((s) => s.entry !== entry);
  }

  #buildCanvas(entry, zOffset) {
    const { cfg, frame } = entry;
    const aspect = frame.width / frame.height;
    const el = document.createElement('canvas');
    el.width = 768;
    el.height = Math.round(768 / aspect);
    const texture = new THREE.CanvasTexture(el);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const mesh = quadMesh(frame, zOffset, new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    entry.group.add(mesh);
    this.canvasScreens.push({
      entry,
      el,
      ctx: el.getContext('2d'),
      texture,
      draw: SCREEN_PROGRAMS[cfg.variant ?? hashPick(cfg.id, Object.keys(SCREEN_PROGRAMS))],
      nextFrameAt: 0,
    });
  }

  #buildVideo(entry, zOffset) {
    const { cfg, frame } = entry;
    const video = document.createElement('video');
    Object.assign(video, {
      src: cfg.src, muted: true, loop: true, autoplay: true,
      playsInline: true, crossOrigin: 'anonymous', preload: 'auto',
    });
    video.addEventListener('error', () => {
      console.warn(`[monitors] ${cfg.id}: video "${cfg.src}" failed, falling back to canvas`);
      entry.group.children.filter((c) => c.userData.isContent).forEach((c) => entry.group.remove(c));
      this.#buildCanvas(entry, zOffset);
    });
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = quadMesh(frame, zOffset, new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    mesh.userData.isContent = true;
    entry.group.add(mesh);
    // Autoplay policies may want a user gesture first
    const kick = () => { video.play().catch(() => {}); removeEventListener('pointerdown', kick); };
    video.play().catch(() => addEventListener('pointerdown', kick));
  }

  #buildIframe(entry, zOffset) {
    const { cfg, frame } = entry;
    this.#ensureCSS3D();

    // Hole punch: draws nothing but depth + alpha 0, so the transparent
    // canvas reveals the iframe positioned behind it.
    const punch = quadMesh(frame, zOffset, new THREE.MeshBasicMaterial({
      color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide,
    }));
    entry.group.add(punch);

    const widthPx = Math.round(frame.width * IFRAME_PX_PER_METER);
    const heightPx = Math.round(frame.height * IFRAME_PX_PER_METER);
    const iframe = document.createElement('iframe');
    iframe.src = cfg.src;
    iframe.width = widthPx;
    iframe.height = heightPx;
    iframe.style.width = `${widthPx}px`;
    iframe.style.height = `${heightPx}px`;
    iframe.style.background = '#000';
    iframe.loading = 'lazy';

    const obj = new CSS3DObject(iframe);
    obj.position.copy(frame.center.clone().addScaledVector(frame.normal, zOffset));
    obj.setRotationFromMatrix(frame.rotation);
    obj.scale.setScalar(frame.width / widthPx);
    entry.cssObject = obj;
    this.cssScene.add(obj);
  }

  #ensureCSS3D() {
    if (this.cssRenderer) return;
    this.cssRenderer = new CSS3DRenderer();
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.inset = '0';
    this.cssLayerEl.appendChild(this.cssRenderer.domElement);
    this.cssScene = new THREE.Scene();
    this.cssRenderer.setSize(this.sectionEl.clientWidth, this.sectionEl.clientHeight);
  }

  setSize(w, h) {
    this.cssRenderer?.setSize(w, h);
  }

  update(camera, dt) {
    this._time += dt;
    for (const s of this.canvasScreens) {
      if (this._time < s.nextFrameAt) continue;
      s.nextFrameAt = this._time + 1 / 15; // 15 fps is plenty for screen UI
      s.draw(s.ctx, s.el.width, s.el.height, this._time);
      s.texture.needsUpdate = true;
    }
    this.cssRenderer?.render(this.cssScene, camera);
  }
}

/* ── geometry helpers ────────────────────────────────────────────────── */

/** Orthonormal frame + dimensions from 4 world-space corners (tl,tr,br,bl). */
function cornersToFrame(corners) {
  const tl = v3(corners.tl), tr = v3(corners.tr), br = v3(corners.br), bl = v3(corners.bl);
  const right = tr.clone().sub(tl);
  const down = bl.clone().sub(tl);
  const width = right.length();
  const height = down.length();
  if (width < 1e-4 || height < 1e-4) return null;
  const normal = right.clone().cross(down).normalize().negate(); // faces the viewer
  const rotation = new THREE.Matrix4().makeBasis(
    right.clone().normalize(),
    down.clone().normalize().negate(), // up
    normal,
  );
  const center = tl.clone().add(tr).add(br).add(bl).multiplyScalar(0.25);
  return { tl, tr, br, bl, right, down, width, height, normal, rotation, center };
}

/** Quad mesh spanning the 4 (possibly non-perfectly-planar) corners. */
function quadMesh(frame, offset, material) {
  const g = new THREE.BufferGeometry();
  const o = frame.normal.clone().multiplyScalar(offset);
  const p = [frame.tl, frame.tr, frame.br, frame.bl].map((c) => c.clone().add(o));
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    p.flatMap((c) => [c.x, c.y, c.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  material.side ??= THREE.DoubleSide;
  return new THREE.Mesh(g, material);
}

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function hashPick(str, options) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return options[h % options.length];
}

/* ── built-in "live" canvas screens ──────────────────────────────────── */

const SCREEN_PROGRAMS = {
  terminal(ctx, w, h, t) {
    ctx.fillStyle = '#0c1014';
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${Math.round(h * 0.052)}px ui-monospace, Menlo, monospace`;
    const lines = [
      ['$ nx run-many --target=build', '#8b949e'],
      ['✓ tokens        built in 1.2s', '#3fb950'],
      ['✓ components    built in 3.8s', '#3fb950'],
      ['✓ grid          built in 0.9s', '#3fb950'],
      ['$ npm run demo:office', '#8b949e'],
      ['serving on http://localhost:3838', '#58a6ff'],
      ['splats: 74,670   fps: 60', '#d2a8ff'],
    ];
    const visible = Math.min(lines.length, 1 + Math.floor((t % 14) / 1.6));
    lines.slice(0, visible).forEach(([text, color], i) => {
      ctx.fillStyle = color;
      ctx.fillText(text, w * 0.05, h * (0.12 + i * 0.115));
    });
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = '#e6edf3';
      ctx.fillRect(w * 0.05, h * (0.14 + visible * 0.115), w * 0.018, h * 0.06);
    }
  },

  dashboard(ctx, w, h, t) {
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e6edf3';
    ctx.font = `600 ${Math.round(h * 0.07)}px system-ui, sans-serif`;
    const clock = new Date();
    ctx.fillText(clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), w * 0.05, h * 0.15);
    ctx.fillStyle = '#8b949e';
    ctx.font = `${Math.round(h * 0.042)}px system-ui, sans-serif`;
    ctx.fillText('live metrics', w * 0.05, h * 0.23);
    // scrolling line graph
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = Math.max(2, h * 0.008);
    ctx.beginPath();
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const x = w * (0.05 + 0.9 * (i / n));
      const ph = t * 1.1 + i * 0.35;
      const y = h * (0.55 - 0.16 * Math.sin(ph) - 0.06 * Math.sin(ph * 2.7));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    // bars
    for (let i = 0; i < 12; i++) {
      const v = 0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7);
      ctx.fillStyle = i % 3 ? '#2ea043' : '#d29922';
      const bh = h * 0.18 * v;
      ctx.fillRect(w * (0.05 + i * 0.078), h * 0.92 - bh, w * 0.05, bh);
    }
  },

  slideshow(ctx, w, h, t) {
    const hue = (t * 12) % 360;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `hsl(${hue} 60% 18%)`);
    grad.addColorStop(1, `hsl(${(hue + 80) % 360} 55% 32%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `700 ${Math.round(h * 0.12)}px system-ui, sans-serif`;
    ctx.fillText('portfolio.live', w * 0.07, h * 0.32);
    ctx.font = `${Math.round(h * 0.055)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('this screen is rendered in real time', w * 0.07, h * 0.46);
    const dot = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255, 80, 80, ${0.4 + 0.6 * dot})`;
    ctx.beginPath();
    ctx.arc(w * 0.09, h * 0.62, h * 0.025, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `600 ${Math.round(h * 0.045)}px system-ui, sans-serif`;
    ctx.fillText('LIVE', w * 0.12, h * 0.635);
  },
};
