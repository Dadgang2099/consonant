/**
 * Calibrator — in-viewer tool for measuring monitor screen corners against
 * the real splat, so nobody has to fish coordinates out of SuperSplat.
 *
 * Press C to toggle. While active:
 *   click        set the active corner to the clicked point ON the splat
 *                (raycast against the gaussians), then advance to next corner
 *   1/2/3/4      select corner (TL / TR / BR / BL)
 *   Tab          cycle monitors        N  add monitor (seeded ahead of camera)
 *   X            delete monitor        arrows  nudge corner 5 mm (Shift: 1 mm)
 *   -/=          push/pull corner along the screen normal
 *   P            make plane perfect (re-fit corners to best rectangle)
 *   Enter        export monitors.json → clipboard + download
 *
 * Work-in-progress state persists to localStorage.
 */

import * as THREE from 'three';

const CORNER_KEYS = ['tl', 'tr', 'br', 'bl'];
const CORNER_COLORS = { tl: 0xff5555, tr: 0x55ff77, br: 0x5588ff, bl: 0xffdd44 };
const LS_KEY = 'office-splat.calibration.v1';

export class Calibrator {
  constructor({ scene, camera, canvas, controls, pick, monitorLayer, hintEl, sectionEl }) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.controls = controls;
    this.pick = pick;
    this.layer = monitorLayer;
    this.hintEl = hintEl;
    this.sectionEl = sectionEl;

    this.active = false;
    this.monIndex = 0;
    this.cornerIndex = 0;

    const saved = localStorage.getItem(LS_KEY);
    this.monitors = saved
      ? JSON.parse(saved)
      : structuredClone(this.layer.entries.map((e) => e.cfg));

    this.gizmos = new THREE.Group();
    this.gizmos.visible = false;
    scene.add(this.gizmos);

    this.onKey = this.onKey.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  toggle() {
    this.active = !this.active;
    this.gizmos.visible = this.active;
    this.hintEl.hidden = !this.active;
    if (this.active) {
      this.sectionEl.classList.add('is-active');
      addEventListener('keydown', this.onKey);
      this.canvas.addEventListener('pointerdown', this.onClick);
      this.rebuildGizmos();
      this.updateHint();
    } else {
      removeEventListener('keydown', this.onKey);
      this.canvas.removeEventListener('pointerdown', this.onClick);
    }
  }

  get mon() { return this.monitors[this.monIndex]; }

  onClick(ev) {
    if (ev.button !== 0 || !this.mon) return;
    // ignore drags (orbit) — only treat quick clicks as picks
    const start = [ev.clientX, ev.clientY, performance.now()];
    const up = (e2) => {
      this.canvas.removeEventListener('pointerup', up);
      if (Math.hypot(e2.clientX - start[0], e2.clientY - start[1]) > 4) return;
      if (performance.now() - start[2] > 400) return;
      const hit = this.pick(e2);
      if (!hit) return;
      this.mon.corners[CORNER_KEYS[this.cornerIndex]] =
        [hit.point.x, hit.point.y, hit.point.z].map((v) => +v.toFixed(4));
      this.cornerIndex = (this.cornerIndex + 1) % 4;
      this.commit();
    };
    this.canvas.addEventListener('pointerup', up);
  }

  onKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (idx >= 0) { this.cornerIndex = idx; this.updateHint(); return; }
    switch (e.code) {
      case 'Tab': {
        e.preventDefault();
        if (this.monitors.length) {
          this.monIndex = (this.monIndex + 1) % this.monitors.length;
          this.cornerIndex = 0;
          this.rebuildGizmos(); this.updateHint();
        }
        return;
      }
      case 'KeyN': {
        const fwd = new THREE.Vector3();
        this.camera.getWorldDirection(fwd);
        const c = this.camera.position.clone().addScaledVector(fwd, 1.0);
        const right = fwd.clone().cross(this.camera.up).normalize().multiplyScalar(0.25);
        const up = new THREE.Vector3(0, 0.15, 0);
        const p = (s, t) => c.clone().addScaledVector(right, s).addScaledVector(up, t).toArray().map((v) => +v.toFixed(4));
        this.monitors.push({
          id: `monitor-${this.monitors.length + 1}`,
          label: 'new monitor', mode: 'canvas', src: null,
          corners: { tl: p(-1, 1), tr: p(1, 1), br: p(1, -1), bl: p(-1, -1) },
        });
        this.monIndex = this.monitors.length - 1;
        this.cornerIndex = 0;
        this.commit();
        return;
      }
      case 'KeyX': {
        if (!this.mon) return;
        this.monitors.splice(this.monIndex, 1);
        this.monIndex = Math.max(0, this.monIndex - 1);
        this.commit();
        return;
      }
      case 'KeyP': this.squareUp(); return;
      case 'Enter': this.export(); return;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
      case 'Minus': case 'Equal': {
        if (!this.mon) return;
        e.preventDefault();
        const step = e.shiftKey ? 0.001 : 0.005;
        const f = frameOf(this.mon.corners);
        const delta = {
          ArrowLeft: f.right.clone().multiplyScalar(-step),
          ArrowRight: f.right.clone().multiplyScalar(step),
          ArrowUp: f.up.clone().multiplyScalar(step),
          ArrowDown: f.up.clone().multiplyScalar(-step),
          Minus: f.normal.clone().multiplyScalar(-step),
          Equal: f.normal.clone().multiplyScalar(step),
        }[e.code];
        const key = CORNER_KEYS[this.cornerIndex];
        this.mon.corners[key] = v3(this.mon.corners[key]).add(delta).toArray().map((v) => +v.toFixed(4));
        this.commit();
      }
    }
  }

  /** Re-fit the 4 corners to a perfect planar rectangle (least surprise). */
  squareUp() {
    if (!this.mon) return;
    const f = frameOf(this.mon.corners);
    const hw = (v3(this.mon.corners.tr).distanceTo(v3(this.mon.corners.tl)) +
                v3(this.mon.corners.br).distanceTo(v3(this.mon.corners.bl))) / 4;
    const hh = (v3(this.mon.corners.bl).distanceTo(v3(this.mon.corners.tl)) +
                v3(this.mon.corners.br).distanceTo(v3(this.mon.corners.tr))) / 4;
    const c = f.center;
    const mk = (sx, sy) => c.clone()
      .addScaledVector(f.right, sx * hw)
      .addScaledVector(f.up, sy * hh)
      .toArray().map((v) => +v.toFixed(4));
    this.mon.corners = { tl: mk(-1, 1), tr: mk(1, 1), br: mk(1, -1), bl: mk(-1, -1) };
    this.commit();
  }

  commit() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.monitors));
    // rebuild live monitor content to match new corners
    [...this.layer.entries].forEach((e) => this.layer.removeMonitor(e));
    this.monitors.forEach((cfg) => this.layer.addMonitor(cfg));
    this.rebuildGizmos();
    this.updateHint();
  }

  rebuildGizmos() {
    this.gizmos.clear();
    this.monitors.forEach((mon, mi) => {
      const pts = CORNER_KEYS.map((k) => v3(mon.corners[k]));
      const isActive = mi === this.monIndex;
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: isActive ? 0xffffff : 0x667788, depthTest: false }),
      );
      line.renderOrder = 999;
      this.gizmos.add(line);
      if (!isActive) return;
      CORNER_KEYS.forEach((k, ci) => {
        const s = new THREE.Mesh(
          new THREE.SphereGeometry(ci === this.cornerIndex ? 0.014 : 0.008, 12, 8),
          new THREE.MeshBasicMaterial({ color: CORNER_COLORS[k], depthTest: false }),
        );
        s.renderOrder = 1000;
        s.position.copy(v3(mon.corners[k]));
        this.gizmos.add(s);
      });
    });
  }

  updateHint() {
    const mon = this.mon;
    this.hintEl.textContent =
      `CALIBRATE — ${mon ? `${mon.id} · corner ${CORNER_KEYS[this.cornerIndex].toUpperCase()}` : 'no monitors (N to add)'}
click: set corner on splat · 1-4: pick corner · Tab: next monitor
N: new · X: delete · arrows: nudge 5mm (Shift 1mm) · -/=: along normal
P: square up plane · Enter: export JSON · C: exit`;
  }

  export() {
    const json = JSON.stringify({ monitors: this.monitors }, null, 2) + '\n';
    navigator.clipboard?.writeText(json).catch(() => {});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'monitors.json';
    a.click();
    URL.revokeObjectURL(a.href);
    console.log('[calibrate] monitors.json ↓\n' + json);
  }

  update() {
    // gizmo spheres keep constant-ish screen size
    if (!this.active) return;
    for (const obj of this.gizmos.children) {
      if (obj.isMesh) {
        const d = obj.position.distanceTo(this.camera.position);
        obj.scale.setScalar(THREE.MathUtils.clamp(d, 0.4, 4));
      }
    }
  }
}

/* helpers */
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function frameOf(corners) {
  const tl = v3(corners.tl), tr = v3(corners.tr), br = v3(corners.br), bl = v3(corners.bl);
  const right = tr.clone().sub(tl).normalize();
  const up = tl.clone().sub(bl).normalize();
  const normal = right.clone().cross(up).normalize(); // faces the viewer
  const center = tl.clone().add(tr).add(br).add(bl).multiplyScalar(0.25);
  return { right, up, normal, center };
}
