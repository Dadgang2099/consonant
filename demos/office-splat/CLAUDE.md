# office-splat — agent notes

Read `README.md` first — it has the full pipeline, rendering-stack rationale,
and monitor-calibration workflow. Quick facts for working in here:

- Vanilla ES modules, **no build step**. Libraries are vendored in `vendor/`
  (three 0.185 minified build + `three.core.min.js`, Spark 2.1.0). Bare
  imports resolve via the import map in `index.html`. Spark also needs
  `vendor/three/addons/postprocessing/Pass.js` — don't prune it.
- Dev server: `npm run demo:office` (port 3838). Regenerate the placeholder
  scene + monitor config: `npm run demo:office:placeholder` (writes
  `config/monitors.placeholder.json`; `config/monitors.json` is the live copy).
- Coordinate/corner conventions: corners are `{tl,tr,br,bl}` facing the
  screen; plane normal = `right × up` (toward viewer). Keep `monitors.js
  cornersToFrame()` and `calibrate.js frameOf()` in agreement.
- `window.__officeSplat` exposes `{THREE, scene, camera, renderer, controls,
  splat, monitorLayer}` for console debugging.
- Headless testing: SwiftShader cannot rasterize Spark splats (blank scene —
  known limitation, not a bug). Use `?debug=points` to verify scene/camera/
  monitor alignment in headless Chromium; monitor overlays and calibration
  UI do render normally there.
- When the real scan lands: update `config/scene.json` `splatUrl` (+
  `rotateXDeg: 180` if Y-down), recalibrate corners (press C), replace
  `config/monitors.json`, delete `assets/placeholder-office.ply` and the
  generator script reference in README if removed.
