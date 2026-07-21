# office-splat — interactive Gaussian splat office for the portfolio

An embeddable web section where a visitor flies/orbits around a photoreal
Gaussian-splat scan of the office — with the physical monitors in the scan
replaced by **live web content** (real HTML pages, video, or animated canvas)
aligned to their world-space screen planes.

```
npm run demo:office        # → http://localhost:3838
```

A placeholder office (generated splat, ~5 MB) ships in the repo so everything
runs before the real scan is wired in. Drag to orbit, scroll to zoom, WASD to
move, double-click to re-target. Press **C** for the monitor-corner
calibration tool, **I** to interact with iframe monitors.

---

## Rendering stack: Spark (three.js) — and why

[Spark](https://sparkjs.dev) (`@sparkjsdev/spark`, vendored in `vendor/`) over
PlayCanvas, for three reasons:

1. **The monitor feature decides it.** Live HTML on the screens is done with
   three.js's `CSS3DRenderer`: a real `<iframe>` is CSS-3D-transformed to the
   screen plane behind a transparent-holed WebGL canvas, while depth-tested
   splats still occlude it correctly. PlayCanvas has no CSS3D equivalent —
   you'd be limited to video/canvas textures baked into WebGL.
2. **Format fit.** Spark natively loads `.ply` (3DGS + SuperSplat-compressed),
   `.spz`, `.splat`, `.ksplat`, and SOGS — whatever LCC Studio / SuperSplat
   ends up exporting, it loads without a conversion step.
3. **Stack fit.** The portfolio demos are vanilla ES-module pages with no
   build step. Spark + three.js drop in via an import map; PlayCanvas pulls in
   an engine/editor ecosystem this repo doesn't otherwise use.

Trade-off noted: SuperSplat's SOGS compression pairs beautifully with the
PlayCanvas engine, but Spark reads SOGS too, so we lose nothing.

## Asset pipeline (LCC → web)

**Yes — please re-export a single consolidated file from LCC Studio.** The
multi-`.spz` chunk/LOD package the Lixel produces targets XGRIDS' own SDK;
a single file keeps the web pipeline simple. (If the scan turns out too heavy
for one file, XGRIDS ships a three.js LCC SDK with streaming LOD we can switch
to — but a single office room shouldn't need it.)

1. **LCC Studio** → export **`.ply` (3D Gaussian Splatting, highest quality)**.
   This is the master; keep it.
2. **SuperSplat** → import, crop floaters, delete outside-the-room splats,
   center the scene at the origin with Y up, then export
   **compressed `.ply`** (or `.spz`). Target ≲ 30–50 MB for desktop,
   ideally ≲ 15 MB if mobile matters.
3. Drop the file in `assets/`, point `config/scene.json` → `splatUrl` at it.
   If the scene comes in Y-down (most 3DGS exports), set `rotateXDeg: 180`.
4. Keep the environment/lighting map from the LCC export if convenient —
   splats carry their own baked lighting, so it's optional garnish (could be
   used for a skybox outside windows later).

## Monitor screen corners — how to capture them

Preferred: **don't measure anything in SuperSplat — use the built-in
calibration tool against the real splat.**

1. Load the real scan in the viewer, press **C**.
2. Click the four corners of a screen *on the splat itself* (raycast against
   the gaussians): TL → TR → BR → BL, in that order, as you face the screen.
3. Press **P** to square the four points into a perfect planar rectangle,
   nudge with arrows (5 mm; Shift = 1 mm), **-/=** moves along the normal.
4. **Tab**/**N**/**X** to switch/add/delete monitors, **Enter** exports
   `monitors.json` (clipboard + download). Replace `config/monitors.json`.

Corner format, per monitor — world-space metres, same coordinate frame as the
*final exported* asset (i.e. after any SuperSplat transforms):

```json
{
  "id": "center",
  "mode": "iframe | video | canvas",
  "src": "screens/demo-site.html",
  "corners": {
    "tl": [x, y, z], "tr": [x, y, z], "br": [x, y, z], "bl": [x, y, z]
  }
}
```

If you'd rather mark corners in SuperSplat anyway: isolate/select the few
splats at each physical screen corner, read the selection centroid from the
transform panel, and send the 12 numbers per monitor in the JSON shape above —
both routes end in the same file.

## Monitor content modes

| mode     | what it does                                                              |
|----------|---------------------------------------------------------------------------|
| `iframe` | Real live page (any URL/local file) via CSS3D punch-through. Press **I** to let the pointer reach it. |
| `video`  | Looping muted `<video>` texture (`src`: mp4/webm). Falls back to canvas on error. |
| `canvas` | Built-in animated screens (`variant`: `terminal`, `dashboard`, `slideshow`) — always works offline. |

Every monitor also gets an opaque black backing quad slightly proud of the
splat surface, so baked screen pixels never bleed through and splats behind
are occluded via the depth buffer.

## Files

```
index.html            embeddable section (import map + HUD)
main.js               viewer: Spark splat, orbit/WASD controls, bounds, DPR caps
monitors.js           MonitorLayer — corner-aligned live screens (3 modes)
calibrate.js          in-viewer corner calibration tool (press C)
config/scene.json     asset URL, camera start/bounds, renderer caps
config/monitors.json  per-monitor mode/src/corners (world space)
screens/              local pages for iframe monitors
scripts/make-placeholder-splat.mjs   regenerates the placeholder office
assets/placeholder-office.ply        generated stand-in scan (delete when real asset lands)
vendor/               three.js 0.185 + Spark 2.1.0 (self-contained, no CDN)
```

## Embedding in the portfolio

The section is self-contained: either `<iframe src=".../office-splat/">` it,
or copy the `.splat-section` markup, the import map, and `main.js` into the
host page. It never captures scroll/pointer until the visitor clicks
"Look around". Rendering pauses when the section leaves the viewport.

## Performance notes

- Pixel ratio is capped (2.0 desktop / 1.25 mobile) in `config/scene.json`.
- Canvas screens redraw at 15 fps; splat sorting runs in Spark's worker.
- `?debug=points` renders the asset as a raw point cloud (no Spark raster
  path) — useful for CI/software-GL environments and alignment checks.
- Headless/software-GL note: SwiftShader can't run Spark's splat
  rasterization (verified in CI container); real GPUs are fine.
