/* ============================================================
   iPhone 11 Pro — Scroll-scrub hero with lens vignette reveal
   ============================================================ */
(function iPhoneScroll() {

  // ── Elements ─────────────────────────────────────────────
  const video         = document.getElementById('heroVideo');
  const lensMask      = document.getElementById('lensMask');
  const scrollHint    = document.getElementById('scrollHint');
  const phoneImg      = document.getElementById('phoneImg');
  const phoneHeadline = document.querySelector('.phone-headline');

  if (!video || !lensMask) return;

  // ── Tweak panel defaults ──────────────────────────────────
  let tweakScale = 72;   // phone width relative to video-native reference
  let tweakYRef  = 791;  // y-offset from viewport center (scaled by S)
  let tweakXOff  = 2;    // horizontal offset in px from viewport center

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
      tweakScale = 72; tweakYRef = 791; tweakXOff = 2;
      scaleInput.value = tweakScale;
      yRefInput.value  = tweakYRef;
      xOffInput.value  = tweakXOff;
      syncLabels(); onScroll();
    });

    document.getElementById('tweakCopy')?.addEventListener('click', () => {
      const txt = `scale: ${(+tweakScale).toFixed(1)}vw  yRef: ${Math.round(tweakYRef)}px  xOff: ${Math.round(tweakXOff)}px`;
      navigator.clipboard?.writeText(txt);
      const btn = document.getElementById('tweakCopy');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy values'; }, 1500);
    });

    // Mouse wheel left/right (or up/down) on any slider nudges it by one step
    [scaleInput, yRefInput, xOffInput].forEach(input => {
      input.addEventListener('wheel', e => {
        e.preventDefault();
        const dir  = ((e.deltaX || e.deltaY) > 0) ? 1 : -1;
        const step = parseFloat(input.step) || 1;
        input.value = Math.min(
          parseFloat(input.max),
          Math.max(parseFloat(input.min), parseFloat(input.value) + step * dir)
        );
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
  const PH1 = () => window.innerHeight * 3;
  const PH2 = () => window.innerHeight * 3;

  video.addEventListener('loadedmetadata', () => {
    video.currentTime = 0;
  }, { once: true });

  function ease(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ── Phone sizing + placement (pixel-exact) ────────────────
  // S = object-fit:cover scale for the 1894×1440 native video.
  // tweakScale=95 → phone width matches the video frame at all viewports.
  // tweakYRef=789 → phone center tracks cy_native=1509 in the 1894×1440 frame.
  function placePhone(slideFraction) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const S = Math.max(W / 1894, H / 1440);

    const phoneW = 1035 * S * (tweakScale / 72);
    const phoneH = phoneW * (2029 / 1035);

    // Slide: phone travels 110% of its own height upward
    const tyPx = -phoneH * 1.1 * ease(slideFraction);

    // Phone center in viewport: (W/2 + xOff, H/2 + yRef*S + slide)
    const cx = W / 2 + tweakXOff;
    const cy = H / 2 + tweakYRef * S + tyPx;

    // Translate from top:0 left:0 corner to that center position
    const tx = cx - phoneW / 2;
    const ty = cy - phoneH / 2;

    if (tweakInfo) {
      tweakInfo.textContent =
        `S:${S.toFixed(3)}  phone:${Math.round(phoneW)}×${Math.round(phoneH)}  cy:${Math.round(cy)}px`;
    }

    return { tx, ty, phoneW };
  }

  let raf = false;
  function onScroll() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      const y      = window.scrollY;
      const ph1End = PH1();

      // ── Phase 1: video scrub ──────────────────────────────
      const p1 = Math.min(Math.max(y / ph1End, 0), 1);

      if (video.readyState >= 2 && video.duration) {
        video.currentTime = p1 * video.duration;
      }

      if (scrollHint) scrollHint.style.opacity = Math.max(0, 1 - p1 / 0.2);

      // Vignette: bell curve 20%–80% of Phase 1
      const lensStart = 0.2, lensEnd = 0.8;
      const lensRaw   = (p1 - lensStart) / (lensEnd - lensStart);
      const lensT     = ease(Math.min(Math.max(lensRaw, 0), 1));
      const vigOpacity  = lensT <= 0 || lensT >= 1 ? 0 : Math.sin(lensT * Math.PI);
      const centerStop  = lensT < 0.5 ? 30 - lensT * 2 * 25 : 5 + (lensT - 0.5) * 2 * 55;
      const featherStop = centerStop + 35;
      lensMask.style.opacity    = vigOpacity;
      lensMask.style.background = `radial-gradient(ellipse at center,
        transparent 0%,
        transparent ${centerStop}%,
        rgba(0,0,0,0.7) ${featherStop}%,
        rgba(0,0,0,0.97) 100%
      )`;

      // ── Phase 2: phone crossfade + garage-door scroll-up ──
      if (phoneImg) {
        const p2 = Math.min(Math.max((y - ph1End) / PH2(), 0), 1);

        // Phone fades in fast (0→8%), video holds then fades out (4→15%)
        // Overlap means static is opaque before video disappears — no dark blip.
        phoneImg.style.opacity = Math.min(p2 / 0.08, 1);
        video.style.opacity    = 1 - Math.min(Math.max((p2 - 0.04) / 0.11, 0), 1);

        // Garage door slide begins after crossfade
        const slideFraction = Math.max((p2 - 0.15) / 0.85, 0);
        const { tx, ty, phoneW } = placePhone(slideFraction);

        phoneImg.style.width     = `${phoneW}px`;
        phoneImg.style.transform = `translate(${tx}px, ${ty}px)`;

        // Headline fades in as phone bottom clears the content area
        if (phoneHeadline) {
          phoneHeadline.style.opacity = Math.min(Math.max((p2 - 0.72) / 0.25, 0), 1);
        }
      }

      raf = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { raf = false; onScroll(); });
  onScroll();
}());
