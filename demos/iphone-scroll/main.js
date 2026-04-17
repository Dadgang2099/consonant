/* ============================================================
   iPhone 11 Pro — Scroll-scrub hero with lens reveal
   ============================================================ */
(function iPhoneScroll() {
  const video      = document.getElementById('heroVideo');
  const lensCircle = document.getElementById('lensCircle');
  const lockup     = document.getElementById('lockup');
  const scrollHint = document.getElementById('scrollHint');

  if (!video || !lensCircle) return;

  // Total scroll travel = 3 × vh (driver is 4vh tall, stage is 1vh sticky)
  const SCROLL_TOTAL = () => window.innerHeight * 3;

  // Phase breakpoints (0–1 normalised against SCROLL_TOTAL)
  // 0.00–0.25  : video scrubs, lockup fades out, lens stays closed
  // 0.25–0.75  : lens circle expands from 0 → 72vmin radius
  // 0.75–1.00  : lens fully open, video still scrubbing

  video.addEventListener('loadedmetadata', () => {
    video.currentTime = 0;
  }, { once: true });

  // Max circle radius in SVG viewBox units (0–100)
  // We want the circle to cover the entire viewport when full-open.
  // Diagonal of 100×100 viewBox ≈ 141.4 → half = 70.7; use 75 for safety.
  const MAX_RADIUS = 75;

  function ease(t) {
    // cubic-bezier(0.23, 1, 0.32, 1) approximation via smooth step
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  let raf = false;
  function onScroll() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      const y       = window.scrollY;
      const total   = SCROLL_TOTAL();
      const progress = Math.min(Math.max(y / total, 0), 1); // 0 → 1

      // ── Video scrub ─────────────────────────────────────
      if (video.readyState >= 2 && video.duration) {
        video.currentTime = progress * video.duration;
      }

      // ── Lockup fade (0 → 0.2 scroll) ────────────────────
      const lockupFade = Math.max(0, 1 - progress / 0.2);
      lockup.style.opacity = lockupFade;
      scrollHint.style.opacity = lockupFade;

      // ── Lens mask (0.2 → 0.8 scroll) ────────────────────
      const lensStart = 0.2, lensEnd = 0.8;
      const lensRaw   = (progress - lensStart) / (lensEnd - lensStart);
      const lensT     = ease(Math.min(Math.max(lensRaw, 0), 1));
      const radius    = lensT * MAX_RADIUS;

      lensCircle.setAttribute('r', radius);

      // Hide mask entirely once fully open (avoid covering content)
      const maskEl = lensCircle.closest('svg')?.parentElement;
      if (maskEl) maskEl.style.opacity = lensT >= 1 ? '0' : '1';

      raf = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // init
}());
