# Burn the Ships — Zero-Context Agent Manual

**Mission:** A scroll-scrubbed video ends. At that exact frame, a static image asset crossfades in and must appear pixel-identical to the video. The asset then scrolls upward (garage door) revealing content underneath. This must hold at every viewport size without re-calibration.

This document contains everything required to build this on the first try. There is no assumed knowledge.

---

## What you are building — mental model first

```
PHASE 1 (scroll distance = 3× viewport height)
  └─ video.currentTime scrubs from 0 → duration
     scroll 0%   = first frame
     scroll 100% = last frame (FROZEN HERE)

PHASE 2 (scroll distance = 3× viewport height, starts where Phase 1 ends)
  ├─ 0%–8%:   static asset fades IN (0→1 opacity)
  ├─ 4%–15%:  video fades OUT (1→0 opacity)  ← overlap prevents dark blip
  ├─ 15%–100%: static asset slides UPWARD (garage door)
  └─ 72%–97%: reveal content fades in underneath
```

The only hard problem is the crossfade: the static asset must look identical to the video's last frame. Everything else is arithmetic.

---

## Prerequisites — do these before opening a code editor

### 1. Get video native dimensions
```bash
mdls -name kMDItemPixelWidth -name kMDItemPixelHeight path/to/hero.mp4
# Example output:
# kMDItemPixelWidth  = 1894
# kMDItemPixelHeight = 1440
```
Write these down. You will use them in the S formula. Using wrong dimensions (e.g. guessing 1920×1080) breaks alignment at every non-reference viewport.

### 2. Get static asset dimensions
```bash
mdls -name kMDItemPixelWidth -name kMDItemPixelHeight path/to/endframe.jpg
# Example:
# kMDItemPixelWidth  = 1035
# kMDItemPixelHeight = 2029
```

### 3. Source mask and shadow from the reference CSS (if recreating a real site)
Do this BEFORE writing any CSS. Do not guess.
```bash
curl -s "https://web.archive.org/web/[timestamp]/[site]/[compiled.css]" \
  | grep -A 10 "mask-image\|drop-shadow\|your-component-class"
```
Extract exact values: SVG mask path URL, drop-shadow px values, z-index stack.

---

## File structure

```
your-demo/
  index.html
  main.js
  styles.css
  assets/
    hero.mp4          ← scroll-scrubbed video
    endframe.jpg      ← static asset (the last frame equivalent)
    endframe_mask.svg ← shape cutout mask (if needed)
```

---

## HTML — exact structure, exact order

Element order inside `.stage` determines z-index stacking. Video must be first (bottom). Static asset above it. Reveal content below both (z-index:1, covered by asset until it slides up).

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Title</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>

<div class="scroll-driver">
  <div class="stage">

    <!-- Layer 1 (bottom): scroll-scrubbed video -->
    <video class="stage__video" id="heroVideo"
      src="assets/hero.mp4"
      muted playsinline preload="auto"
      aria-hidden="true"></video>

    <!-- Layer 2: static asset (JS sets width + transform) -->
    <img class="static-asset" id="staticAsset"
      src="assets/endframe.jpg"
      alt="Description">

    <!-- Layer 3 (revealed underneath as asset scrolls up): -->
    <div class="reveal-content" id="revealContent">
      <h2 class="reveal-content__headline">Headline here.</h2>
      <p class="reveal-content__body">Body copy here.</p>
      <div class="reveal-content__ctas">
        <a class="reveal-cta" href="#">Primary</a>
        <a class="reveal-cta" href="#">Secondary</a>
      </div>
    </div>

    <!-- Layer 4 (top): scroll hint, fades out early in Phase 1 -->
    <div class="scroll-hint" id="scrollHint">
      <span>Scroll</span>
      <div class="scroll-hint__line"></div>
    </div>

    <!-- Debug panel — remove for production -->
    <div class="tweak-panel" id="tweakPanel">
      <div class="tweak-panel__header">
        <span>Asset Alignment</span>
        <button class="tweak-panel__close" id="tweakToggle">−</button>
      </div>
      <div class="tweak-panel__body" id="tweakBody">
        <label class="tweak-row">
          <span class="tweak-label">Scale <b id="scaleVal">72</b></span>
          <input type="range" id="scaleInput" min="20" max="200" step="0.1" value="72">
        </label>
        <label class="tweak-row">
          <span class="tweak-label">Y ref <b id="yRefVal">0</b>px</span>
          <input type="range" id="yRefInput" min="-1000" max="2000" step="1" value="0">
        </label>
        <label class="tweak-row">
          <span class="tweak-label">X off <b id="xOffVal">0</b>px</span>
          <input type="range" id="xOffInput" min="-600" max="600" step="1" value="0">
        </label>
        <div class="tweak-info" id="tweakInfo">S: —</div>
        <div class="tweak-actions">
          <button id="tweakReset">Reset</button>
          <button id="tweakCopy">Copy values</button>
        </div>
      </div>
    </div>

  </div><!-- /stage -->
</div><!-- /scroll-driver -->

<script src="main.js"></script>
</body>
</html>
```

---

## CSS — every property that matters and why

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: auto; } /* never smooth — breaks scroll scrubbing */

body {
  background: #000;
  color: #fff;
  font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
}

/*
  scroll-driver height = (PH1_MULTIPLIER + PH2_MULTIPLIER + 1) × 100vh
  The +1 is the stage height itself. With PH1=3, PH2=3: (3+3+1) = 700vh.
  Change this number if you change PH1_MULTIPLIER or PH2_MULTIPLIER in JS.
*/
.scroll-driver {
  height: 700vh;
  position: relative;
}

/*
  sticky + top:0 + height:100vh = the stage pins to the viewport
  while the scroll-driver scrolls behind it. overflow:hidden clips
  the static asset when it slides above the viewport top edge.
*/
.stage {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: #000;
}

/*
  object-fit:cover + object-position:center center is what the S formula mirrors.
  NEVER change object-position without updating the S formula and cx/cy math.
  inset:0 + width/height 100% makes it fill the stage exactly.
*/
.stage__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
}

/*
  CRITICAL: left:0; top:0 — not centered, not auto.
  JS computes the exact translate(tx, ty) to position the center of this
  element at the correct viewport coordinate. Using any other CSS positioning
  creates a double-offset and breaks the math.
  width is set by JS. height:auto preserves aspect ratio from that width.
  opacity:0 — JS drives this during the crossfade.
  will-change hints to the browser to composite this layer.
*/
.static-asset {
  position: absolute;
  left: 0;
  top: 0;
  height: auto;
  opacity: 0;
  will-change: transform, opacity;

  /* If your asset needs a shape cutout (e.g. phone silhouette):
     Source the exact SVG path from the reference site's compiled CSS.
     mask-size: 100% 100% stretches the mask to match the img element exactly.
  */
  /* -webkit-mask-image: url('assets/endframe_mask.svg');
          mask-image: url('assets/endframe_mask.svg');
  -webkit-mask-size: 100% 100%;
          mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat; */

  /* If your asset needs a drop shadow that follows the mask shape (not the bounding box):
     drop-shadow() is applied AFTER masking, so it traces the cutout edge.
     box-shadow does NOT work here — it traces the rectangle, not the cutout.
  */
  /* filter: drop-shadow(0 40px 100px rgba(0,0,0,0.55)); */
}

/*
  top:38% positions the headline ~38% from the viewport top.
  This means when the asset has slid up far enough (exposing the upper 38%+),
  the headline is visible. Adjust this percentage to change where content sits.
  z-index:1 keeps it below the static asset (z-index:2 implied by stacking order)
  until the asset slides above it.
*/
.reveal-content {
  position: absolute;
  top: 38%;
  left: 0;
  right: 0;
  padding: 0 60px;
  text-align: left;
  z-index: 1;
  opacity: 0; /* JS drives this */
}

.reveal-content__headline {
  font-size: clamp(48px, 6.5vw, 96px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-bottom: 24px;
  max-width: 820px;
}

.reveal-content__body {
  font-size: clamp(17px, 1.4vw, 21px);
  font-weight: 400;
  line-height: 1.6;
  color: rgba(255,255,255,.65);
  max-width: 540px;
  margin-bottom: 32px;
}

.reveal-content__ctas {
  display: flex;
  gap: 28px;
  align-items: center;
}

/* Apple-style text link with circular arrow icon via ::after pseudo-element */
.reveal-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 400;
  letter-spacing: -0.022em;
  color: #fff;
  text-decoration: none;
  transition: opacity 0.2s ease;
}
.reveal-cta:hover { opacity: 0.72; }
.reveal-cta::after {
  content: '';
  display: block;
  flex-shrink: 0;
  width: 21px;
  height: 21px;
  border: 1.5px solid rgba(255,255,255,0.7);
  border-radius: 50%;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpolyline points='3.5,2 7,5 3.5,8' fill='none' stroke='white' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 10px no-repeat;
}

/* Scroll hint */
.scroll-hint {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 4;
  transition: opacity 0.4s ease;
}
.scroll-hint span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,.5);
}
.scroll-hint__line {
  width: 1px;
  height: 40px;
  background: linear-gradient(to bottom, rgba(255,255,255,.4), transparent);
  animation: scrollPulse 2s ease infinite;
}
@keyframes scrollPulse {
  0%   { transform: scaleY(0); transform-origin: top; opacity: 1; }
  50%  { transform: scaleY(1); transform-origin: top; opacity: 1; }
  100% { transform: scaleY(1); transform-origin: top; opacity: 0; }
}

/* Tweak panel chrome */
.tweak-panel {
  position: fixed; top: 20px; right: 20px; z-index: 9999;
  width: 280px;
  background: rgba(20,20,20,0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  font-family: -apple-system, 'SF Mono', 'Menlo', monospace;
  font-size: 12px; color: #fff;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.tweak-panel__header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: rgba(255,255,255,0.5);
}
.tweak-panel__close {
  background: none; border: none; color: rgba(255,255,255,0.4);
  font-size: 16px; cursor: pointer; line-height: 1; padding: 0 2px;
}
.tweak-panel__close:hover { color: #fff; }
.tweak-panel__body {
  padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
}
.tweak-panel__body.hidden { display: none; }
.tweak-row { display: flex; flex-direction: column; gap: 4px; }
.tweak-label { display: flex; justify-content: space-between; color: rgba(255,255,255,0.55); }
.tweak-label b { color: #fff; font-weight: 500; }
.tweak-row input[type=range] { width: 100%; accent-color: #2997ff; cursor: pointer; }
.tweak-info {
  font-size: 10px; color: rgba(255,255,255,0.35);
  letter-spacing: 0.03em; padding-top: 4px;
  border-top: 1px solid rgba(255,255,255,0.07);
}
.tweak-actions { display: flex; gap: 8px; }
.tweak-actions button {
  flex: 1; padding: 6px 10px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px; color: #fff; font-size: 11px; cursor: pointer;
}
.tweak-actions button:hover { background: rgba(255,255,255,0.15); }
```

---

## JavaScript — fully annotated

```js
(function scrollToStatic() {

  // ── CONFIGURE THESE FOUR VALUES FIRST ────────────────────
  // Run: mdls -name kMDItemPixelWidth -name kMDItemPixelHeight your-video.mp4
  const VIDEO_W        = 1894;  // native video width in px
  const VIDEO_H        = 1440;  // native video height in px
  // Run: mdls -name kMDItemPixelWidth -name kMDItemPixelHeight your-endframe.jpg
  const ASSET_NATIVE_W = 1035;  // endframe image width in px
  const ASSET_NATIVE_H = 2029;  // endframe image height in px

  // Scroll distance for each phase, as a multiple of viewport height.
  // PH1=3 means Phase 1 takes 3× the viewport height of scroll distance.
  // Increase for a slower scrub (more scroll = more control per frame).
  // scroll-driver height in CSS must equal (PH1 + PH2 + 1) × 100vh.
  const PH1_MULTIPLIER = 3;
  const PH2_MULTIPLIER = 3;

  // ── CALIBRATED DEFAULTS ───────────────────────────────────
  // These start at neutral. After visual calibration, replace with
  // the values from the Copy Values button.
  // Scale=72 is the reference. At S=1.0, assetW = ASSET_NATIVE_W × (72/72) = ASSET_NATIVE_W.
  // Increase scale → asset appears larger. Decrease → smaller.
  let tweakScale = 72;

  // yRef: offset in px from viewport center to asset center, at S=1.
  // The formula multiplies it by S so it scales with the video at all viewports.
  // Positive yRef → asset center moves DOWN from viewport center.
  // Start at 0. If the video subject appears above where the asset subject is,
  // increase yRef. If below, decrease it.
  let tweakYRef  = 0;

  // xOff: horizontal offset in px from viewport center. Usually 0.
  // Use only if the video subject is not horizontally centered.
  let tweakXOff  = 0;

  // ── ELEMENTS ──────────────────────────────────────────────
  const video         = document.getElementById('heroVideo');
  const staticAsset   = document.getElementById('staticAsset');
  const revealContent = document.getElementById('revealContent');
  const scrollHint    = document.getElementById('scrollHint');

  if (!video) return;

  // ── TWEAK PANEL ───────────────────────────────────────────
  const scaleInput = document.getElementById('scaleInput');
  const yRefInput  = document.getElementById('yRefInput');
  const xOffInput  = document.getElementById('xOffInput');
  const tweakInfo  = document.getElementById('tweakInfo');

  function syncLabels() {
    const sv = document.getElementById('scaleVal');
    const yv = document.getElementById('yRefVal');
    const xv = document.getElementById('xOffVal');
    if (sv) sv.textContent = (+tweakScale).toFixed(1);
    if (yv) yv.textContent = Math.round(tweakYRef);
    if (xv) xv.textContent = Math.round(tweakXOff);
  }

  if (scaleInput) {
    scaleInput.addEventListener('input', () => { tweakScale = +scaleInput.value; syncLabels(); onScroll(); });
    yRefInput.addEventListener('input',  () => { tweakYRef  = +yRefInput.value;  syncLabels(); onScroll(); });
    xOffInput.addEventListener('input',  () => { tweakXOff  = +xOffInput.value;  syncLabels(); onScroll(); });

    document.getElementById('tweakReset')?.addEventListener('click', () => {
      tweakScale = 72; tweakYRef = 0; tweakXOff = 0;
      scaleInput.value = tweakScale;
      yRefInput.value  = tweakYRef;
      xOffInput.value  = tweakXOff;
      syncLabels(); onScroll();
    });

    document.getElementById('tweakCopy')?.addEventListener('click', () => {
      const txt = `tweakScale=${(+tweakScale).toFixed(1)}, tweakYRef=${Math.round(tweakYRef)}, tweakXOff=${Math.round(tweakXOff)}`;
      navigator.clipboard?.writeText(txt);
      const btn = document.getElementById('tweakCopy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy values'; }, 1500);
    });

    // Mouse-wheel on a slider nudges it by one step (works left/right or up/down)
    [scaleInput, yRefInput, xOffInput].forEach(input => {
      input.addEventListener('wheel', e => {
        e.preventDefault();
        const dir  = ((e.deltaX || e.deltaY) > 0) ? 1 : -1;
        const step = parseFloat(input.step) || 1;
        input.value = Math.min(parseFloat(input.max),
          Math.max(parseFloat(input.min), parseFloat(input.value) + step * dir));
        input.dispatchEvent(new Event('input'));
      }, { passive: false });
    });

    document.getElementById('tweakToggle')?.addEventListener('click', () => {
      const body   = document.getElementById('tweakBody');
      const toggle = document.getElementById('tweakToggle');
      body.classList.toggle('hidden');
      toggle.textContent = body.classList.contains('hidden') ? '+' : '−';
    });
  }

  // ── PHASE LENGTHS ─────────────────────────────────────────
  // These are functions, not constants, because window.innerHeight
  // can change on resize. Always call them fresh, never cache.
  const PH1 = () => window.innerHeight * PH1_MULTIPLIER;
  const PH2 = () => window.innerHeight * PH2_MULTIPLIER;

  // Scrub to frame 0 immediately on load (avoids flash of wrong frame)
  video.addEventListener('loadedmetadata', () => { video.currentTime = 0; }, { once: true });

  // Cubic ease-in-out. Applied to the garage-door slide so it
  // accelerates in and decelerates out rather than moving at constant speed.
  function ease(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  }

  // ── ASSET PLACEMENT ───────────────────────────────────────
  //
  // THE S FORMULA — this is the entire alignment system.
  //
  // The browser renders the video with object-fit:cover by computing:
  //   scaleX = viewportW / videoNativeW
  //   scaleY = viewportH / videoNativeH
  //   S = max(scaleX, scaleY)   ← whichever is larger fills the container
  //
  // Every pixel in the video native frame appears in the viewport at:
  //   viewportX = (nativeX * S) + (viewportW - videoNativeW * S) / 2
  //   viewportY = (nativeY * S) + (viewportH - videoNativeH * S) / 2
  //
  // The static asset uses the same S so it grows and shrinks
  // exactly as the video does. This is why using wrong VIDEO_W/VIDEO_H
  // (e.g. 1440/900 for a 1894/1440 video) breaks alignment at every
  // non-reference viewport — S is wrong, so asset scale diverges from video.
  //
  // CENTER POSITIONING — why left:0/top:0 + translate instead of CSS centering:
  //
  // The asset's subject must align with the video's subject at all viewports.
  // The video's subject center is at (viewportW/2 + xSubjectOffset*S, viewportH/2 + ySubjectOffset*S).
  // We match that exactly with:
  //   cx = W/2 + tweakXOff                ← horizontal center of asset
  //   cy = H/2 + tweakYRef * S            ← vertical center of asset
  //                        └── *S means this offset scales with the video
  // Then we translate the top-left corner to that center:
  //   tx = cx - assetW/2
  //   ty = cy - assetH/2
  //
  // If you used CSS transform:translate(-50%,-50%) with top/left percentages,
  // the offset would not scale with S and alignment would drift on resize.

  function placeAsset(slideFraction) {
    const W = window.innerWidth;
    const H = window.innerHeight;

    // S mirrors object-fit:cover for the actual video dimensions.
    const S = Math.max(W / VIDEO_W, H / VIDEO_H);

    // Asset displayed width = native width × S × scale adjustment.
    // tweakScale/72 means: at tweakScale=72, assetW = ASSET_NATIVE_W * S exactly.
    // The 72 denominator is arbitrary — it just means tweakScale=72 is "1×".
    const assetW = ASSET_NATIVE_W * S * (tweakScale / 72);
    const assetH = assetW * (ASSET_NATIVE_H / ASSET_NATIVE_W);

    // Garage door: asset travels 110% of its own height upward.
    // 110% ensures it fully exits the top of the viewport before slideFraction=1.
    // ease() makes it accelerate in and decelerate out.
    const tySlide = -assetH * 1.1 * ease(slideFraction);

    const cx = W/2 + tweakXOff;
    const cy = H/2 + tweakYRef * S + tySlide;
    const tx = cx - assetW/2;
    const ty = cy - assetH/2;

    // Debug readout — shows live values for calibration
    if (tweakInfo) {
      tweakInfo.textContent =
        `S:${S.toFixed(3)}  asset:${Math.round(assetW)}×${Math.round(assetH)}  cy:${Math.round(cy)}px`;
    }

    return { tx, ty, assetW };
  }

  // ── SCROLL HANDLER ────────────────────────────────────────
  // RAF guard: only one animation frame queued at a time.
  // On resize, raf=false forces a fresh frame computation.
  let raf = false;

  function onScroll() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {

      const y      = window.scrollY;
      const ph1End = PH1();

      // ── Phase 1: video scrub ──────────────────────────────
      // p1 goes 0→1 as user scrolls through Phase 1.
      // Clamped so it never goes below 0 or above 1.
      const p1 = Math.min(Math.max(y / ph1End, 0), 1);

      // Set video time. readyState >= 2 means video has data for current position.
      if (video.readyState >= 2 && video.duration) {
        video.currentTime = p1 * video.duration;
      }

      // Scroll hint fades out during the first 20% of Phase 1
      if (scrollHint) scrollHint.style.opacity = Math.max(0, 1 - p1 / 0.2);

      // ── Phase 2: crossfade + garage door ──────────────────
      if (staticAsset) {
        // p2 goes 0→1 starting from where Phase 1 ended.
        const p2 = Math.min(Math.max((y - ph1End) / PH2(), 0), 1);

        // CROSSFADE TIMING (staggered to prevent dark blip):
        //
        // staticAsset fades IN:  p2 0.00 → 0.08  (opacity 0→1)
        // video fades OUT:       p2 0.04 → 0.15  (opacity 1→0)
        //
        // Overlap window p2=0.04→0.08:
        //   Both visible simultaneously (sum > 1 = bright, never dark)
        //   This is intentional — overlap prevents the midpoint darkness
        //   that occurs when two 50%-opacity layers show a mismatch.
        //
        // At p2=0.15: video is fully gone, static is fully opaque.
        // This is the first moment you can assess alignment cleanly.

        staticAsset.style.opacity = Math.min(p2 / 0.08, 1);
        video.style.opacity       = 1 - Math.min(Math.max((p2 - 0.04) / 0.11, 0), 1);

        // Garage door slide starts AFTER crossfade (p2 > 0.15).
        // slideFraction goes 0→1 over the remaining 85% of Phase 2.
        const slideFraction = Math.max((p2 - 0.15) / 0.85, 0);
        const { tx, ty, assetW } = placeAsset(slideFraction);

        staticAsset.style.width     = `${assetW}px`;
        staticAsset.style.transform = `translate(${tx}px, ${ty}px)`;

        // Reveal content fades in during the last 25% of Phase 2.
        // At p2=0.72: opacity=0. At p2=0.97: opacity=1.
        // Adjust 0.72 earlier/later to control when headline appears.
        if (revealContent) {
          revealContent.style.opacity = Math.min(Math.max((p2 - 0.72) / 0.25, 0), 1);
        }
      }

      raf = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // raf=false on resize forces fresh computation (clears any in-flight RAF)
  window.addEventListener('resize', () => { raf = false; onScroll(); });
  onScroll(); // run once on load to set initial state

}());
```

---

## Calibration — the exact visual process

Calibration cannot be derived mathematically from the video without extracting and measuring the last frame pixel-by-pixel. Instead, you find the values by visual comparison, then the S formula locks them at all viewports. This takes 3–5 minutes.

### Setup
1. Open the page in a desktop browser (not mobile — calibrate at the target viewport)
2. Open the tweak panel (top-right corner)
3. Note the debug readout: `S:X.XXX  asset:WxH  cy:Ypx` — this confirms the formula is live

### Step 1 — Identify your visual anchor
Pick the most geometrically distinctive feature that appears in BOTH the video's last frame AND the static asset. Examples:
- Camera module: the lens circles have precise edges
- Logo mark: hard corners
- Product edge or corner

This feature is your anchor. You will align it between video and static.

### Step 2 — Memorize anchor position in video's last frame
Scroll slowly through Phase 1 until the video stops advancing (you're at the last frame). Do not scroll further. Note where your anchor feature sits in the viewport — estimate its Y position as a percentage from the top: "the camera module top edge is about 30% from the top of the viewport."

### Step 3 — Enter Phase 2 to assess the static asset
Scroll ~50px further to enter Phase 2. By p2=0.15 (roughly a few more inches of scroll), the video is gone and the static asset is the only thing visible.

At p2=0.15, the static asset is at its REST position (no garage door motion yet — that starts at p2=0.15 and slideFraction=0). This is the alignment moment.

Compare your anchor's Y position now vs. what you noted in Step 2.

### Step 4 — Adjust using the tweak panel

**If anchor appears HIGHER in static than in video:**
- Y ref is too LOW — increase it (moves asset center DOWN, which moves the anchor down too)
- Mouse-wheel on the Y ref slider for fine control

**If anchor appears LOWER in static than in video:**
- Y ref is too HIGH — decrease it

**If anchor appears LARGER in static than in video:**
- Scale is too HIGH — decrease it

**If anchor appears SMALLER in static than in video:**
- Scale is too LOW — increase it

**If anchor is shifted LEFT/RIGHT:**
- Adjust X off (positive = shift asset right, negative = left)

### Step 5 — Verify with the overlap window
Scroll back into the crossfade overlap zone (p2 = 0.04 → 0.15). At p2 ≈ 0.10, the static asset is fully opaque and the video is at ~50% opacity. If they're aligned, the video ghost underneath will be invisible. If misaligned, you'll see a double image or shimmer.

Iterate until scrolling through the crossfade zone shows no visual jump or ghost.

### Step 6 — Copy and bake values
1. Click **Copy Values** in the tweak panel
2. In `main.js`, update the DEFAULTS block:
   ```js
   let tweakScale = [your value];
   let tweakYRef  = [your value];
   let tweakXOff  = [your value];
   ```
3. In `index.html`, update slider `value=""` attributes AND the `<b>` display values to match
4. Reload with no slider interaction and confirm alignment still holds

### Step 7 — Verify at other viewport sizes
Resize the browser to a different aspect ratio (e.g. portrait tablet, wide monitor). The anchor should stay aligned without re-calibration. If it drifts, the S formula is wrong — verify VIDEO_W and VIDEO_H match the actual video.

---

## What the debug readout tells you

`S:0.912  asset:944×1851  cy:1219px`

- **S:0.912** — the object-fit:cover scale factor at the current viewport. If this doesn't match `max(viewportW/VIDEO_W, viewportH/VIDEO_H)`, VIDEO_W/H are wrong.
- **asset:944×1851** — the asset's displayed pixel dimensions. 944 = 1035 × 0.912 × (72/72). Confirm this looks proportionally right vs. the video subject.
- **cy:1219px** — the asset center's Y coordinate in the viewport in CSS pixels. At 994px viewport height, cy=1219 means the asset center is 225px below the viewport bottom. The top portion of the asset (with your subject) is what's visible. This is expected for tall portrait assets (phone, bottle, person) — most of the asset is below the fold.

---

## iPhone 11 Pro demo — known-good reference values

For the specific demo built with:
- `hero.mp4` — 1894×1440 native (Apple "Through the Lens" video)
- `phone_endframe.jpg` — 1035×2029 (Apple product shot from Wayback Machine)
- `phone_endframe_mask.svg` — 1035×2029 SVG cutout (Apple, from Wayback Machine)
- `filter: drop-shadow(0 40px 100px rgba(0,0,0,0.55))`

Calibrated at user viewport ≈ W:1728 H:994 CSS px (5K iMac, DPR:2):
```
S reported: 0.912
scale: 72.0  →  assetW: 944px
yRef:  791   →  cy: 1219px
xOff:  2     →  cx: W/2 + 2
```

The formula verifies at all viewports:
- 1440×900: S=0.760, assetW=787px, cy=1050px
- 1920×1080: S=1.014, assetW=1049px, cy=1341px
- 2560×1440: S=1.351, assetW=1398px, cy=1786px

---

## Common failure modes — exact diagnosis

| Symptom | Root cause | Exact fix |
|---|---|---|
| Asset way too big after code change | tweakScale was set to 95 thinking it matched video native width — it doesn't. Video shows a close-up, not full subject width. | Reset tweakScale to 72 and calibrate visually. Never derive scale from "subject fills X% of video frame" math alone. |
| Asset correct size at one viewport, drifts at others | VIDEO_W or VIDEO_H is wrong (e.g. using 1440/900 for a 1894/1440 video) | Run `mdls` on the actual file. Set VIDEO_W/VIDEO_H to match exactly. |
| Dark blip mid-crossfade | Video and static are fading simultaneously at 50/50 — slight mismatch creates a dark composite | Use staggered timing: static fades in first (0→8%), video starts fading at 4%, finishes at 15% |
| Ghost phone / double image | Video is not fading out at all | Confirm `video.style.opacity = 1 - Math.min(...)` is inside the Phase 2 block |
| Asset drifts on window resize | Resize handler has `if (!raf)` guard that prevents firing when scroll RAF is in-flight | Use `window.addEventListener('resize', () => { raf = false; onScroll(); })` — force-clear raf first |
| Asset flat/no shadow | drop-shadow not applied, or box-shadow used (traces rectangle not mask) | Use `filter: drop-shadow(...)` not `box-shadow`. Applied after mask. |
| Asset has no cutout shape (shows bounding box) | mask-image not set | Source the SVG from reference CSS. Apply with `mask-size: 100% 100%` |
| Headline appears too early | p2 threshold for revealContent is too low | Increase 0.72 in `(p2 - 0.72) / 0.25` |
| Scroll scrub feels jerky | Video not preloaded | Confirm `preload="auto"` on video element |
| Asset jumps on first render | JS runs before video sets currentTime=0 | Confirm `loadedmetadata` listener sets `video.currentTime = 0` |

---

## Variations (each is a confirmed buildable extension)

| Name | What changes from the base template |
|---|---|
| **Parallax depth** | Two videos at different z positions, each with a separate static asset. PH3 added for second crossfade. Second S formula uses second video's dimensions. |
| **Color variant** | Phase 2 crossfade replaces black background with a color wash. CSS custom property `--bg` animated via JS in sync with p2. Static asset is the product in the final color. |
| **Exploded assembly** | Static asset replaced by 4–6 independent `<img>` elements (components). Each gets its own placeAsset() with a different tweakYRef/tweakXOff. Phase 2 p2 drives them outward with `translate(dx * p2, dy * p2)`. |
| **Infinite zoom** | Video zooms into a surface. Static asset is an ultra-high-res crop of that surface. tweakScale is large (200+) so asset fills viewport. Garage door replaced by a zoom-out: `scale(3 - p2 * 2)` on the asset. |
| **Unbox** | Video shows packaging opening. Phase 2 static is the product. Phase 3 (add PH3) scrolls product upward AND fades in a three-column spec grid below. |
