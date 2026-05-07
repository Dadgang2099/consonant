/* ============================================================
   Burn the Ships — Scroll-to-Static Overlay Template
   ============================================================
   SETUP CHECKLIST:
   1. Get video native dimensions: mdls -name kMDItemPixelWidth -name kMDItemPixelHeight video.mp4
   2. Set VIDEO_W and VIDEO_H below
   3. Set ASSET_NATIVE_W and ASSET_NATIVE_H (your endframe image dimensions)
   4. Set PH1_MULTIPLIER and PH2_MULTIPLIER (scroll distance as multiples of vh)
   5. Open in browser, use tweak panel to calibrate scale/yRef/xOff
   6. Copy values from panel, paste into DEFAULTS below
   ============================================================ */
(function scrollToStatic() {

  // ── Config — EDIT THESE ───────────────────────────────────
  const VIDEO_W          = 1894;   // native video width in px
  const VIDEO_H          = 1440;   // native video height in px
  const ASSET_NATIVE_W   = 1035;   // endframe image width in px
  const ASSET_NATIVE_H   = 2029;   // endframe image height in px
  const PH1_MULTIPLIER   = 3;      // Phase 1 scroll length = PH1 * 100vh
  const PH2_MULTIPLIER   = 3;      // Phase 2 scroll length = PH2 * 100vh

  // ── Defaults — bake in values from the tweak panel ───────
  let tweakScale = 72;   // asset width relative to video-native reference
  let tweakYRef  = 0;    // y-offset from viewport center (scaled by S)
  let tweakXOff  = 0;    // horizontal offset in px from viewport center

  // ── Elements ──────────────────────────────────────────────
  const video         = document.getElementById('heroVideo');
  const staticAsset   = document.getElementById('staticAsset');
  const revealContent = document.getElementById('revealContent');
  const scrollHint    = document.getElementById('scrollHint');

  if (!video) return;

  // ── Tweak panel ───────────────────────────────────────────
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
      const txt = `scale: ${(+tweakScale).toFixed(1)}  yRef: ${Math.round(tweakYRef)}px  xOff: ${Math.round(tweakXOff)}px`;
      navigator.clipboard?.writeText(txt);
      const btn = document.getElementById('tweakCopy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy values'; }, 1500);
    });

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

  // ── Scroll phases ─────────────────────────────────────────
  const PH1 = () => window.innerHeight * PH1_MULTIPLIER;
  const PH2 = () => window.innerHeight * PH2_MULTIPLIER;

  video.addEventListener('loadedmetadata', () => { video.currentTime = 0; }, { once: true });

  function ease(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  }

  // ── Asset placement ───────────────────────────────────────
  // S mirrors object-fit:cover for the actual video dimensions.
  // Asset center is anchored to viewport center + yRef*S — stays locked
  // as the viewport scales because the video also scales by S.
  function placeAsset(slideFraction) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const S = Math.max(W / VIDEO_W, H / VIDEO_H);  // matches video's cover scale

    const assetW = ASSET_NATIVE_W * S * (tweakScale / 72);
    const assetH = assetW * (ASSET_NATIVE_H / ASSET_NATIVE_W);

    // Garage-door: asset travels 110% of its height upward
    const tySlide = -assetH * 1.1 * ease(slideFraction);

    const cx = W/2 + tweakXOff;
    const cy = H/2 + tweakYRef * S + tySlide;
    const tx = cx - assetW/2;
    const ty = cy - assetH/2;

    if (tweakInfo) {
      tweakInfo.textContent = `S:${S.toFixed(3)}  asset:${Math.round(assetW)}×${Math.round(assetH)}  cy:${Math.round(cy)}px`;
    }

    return { tx, ty, assetW };
  }

  // ── Scroll handler ────────────────────────────────────────
  let raf = false;
  function onScroll() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      const y      = window.scrollY;
      const ph1End = PH1();

      // Phase 1: video scrub
      const p1 = Math.min(Math.max(y / ph1End, 0), 1);
      if (video.readyState >= 2 && video.duration) {
        video.currentTime = p1 * video.duration;
      }
      if (scrollHint) scrollHint.style.opacity = Math.max(0, 1 - p1 / 0.2);

      // Phase 2: crossfade + garage-door reveal
      if (staticAsset) {
        const p2 = Math.min(Math.max((y - ph1End) / PH2(), 0), 1);

        // Static asset fades in fast (0→8%), video holds then fades out (4→15%).
        // Overlap prevents dark blip — static is opaque before video disappears.
        staticAsset.style.opacity = Math.min(p2 / 0.08, 1);
        video.style.opacity       = 1 - Math.min(Math.max((p2 - 0.04) / 0.11, 0), 1);

        // Garage door: slide begins after crossfade completes
        const slideFraction = Math.max((p2 - 0.15) / 0.85, 0);
        const { tx, ty, assetW } = placeAsset(slideFraction);
        staticAsset.style.width     = `${assetW}px`;
        staticAsset.style.transform = `translate(${tx}px, ${ty}px)`;

        // Reveal content fades in as asset clears the frame
        if (revealContent) {
          revealContent.style.opacity = Math.min(Math.max((p2 - 0.72) / 0.25, 0), 1);
        }
      }

      raf = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { raf = false; onScroll(); });
  onScroll();
}());
