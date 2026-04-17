/* ============================================================
   ACROBAT PDP — main.js
   ============================================================ */

// ── Lenis smooth scroll — adobe.com: lerp 0.08 ────────────
(function initLenis() {
  if (typeof window.Lenis === 'undefined') return;
  const lenis = new window.Lenis({ autoRaf: true, lerp: 0.08 });
  window._lenis = lenis;
}());


// ── Hero scroll-scrub video + card parallax ────────────────
(function heroScrollScrub() {
  const video = document.getElementById('heroVideo');
  const card  = document.getElementById('heroCard');
  if (!video || !card) return;

  const vh = window.innerHeight;

  // Pre-load first frame once metadata is ready
  video.addEventListener('loadedmetadata', () => {
    video.currentTime = 0;
  }, { once: true });

  let raf = false;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y > vh * 1.5) { raf = false; return; }

      const root  = document.documentElement;
      const cardS = parseFloat(getComputedStyle(root).getPropertyValue('--cp-hero-card-speed')) || 0.12;
      const scale = getComputedStyle(root).getPropertyValue('--cp-hero-card-scale').trim()      || '1';

      // Scrub video: map scrollY (0 → vh) → currentTime (0 → duration)
      const progress = Math.min(Math.max(y / vh, 0), 1);
      if (video.readyState >= 2 && video.duration) {
        video.currentTime = progress * video.duration;
      }

      // Card floats up opposite to scroll for depth
      card.style.transform = `translateX(-15%) translateY(${y * -cardS}px) scale(${scale})`;
      raf = false;
    });
  }, { passive: true });
}());


// ── Section background parallax ────────────────────────────
(function sectionParallax() {
  const items = [
    { section: document.querySelector('.spaces'),   rate: 0.12 },
    { section: document.querySelector('.carousel'), rate: 0.10 },
    { section: document.querySelector('.footer'),   rate: 0.08 },
  ].filter(d => d.section);

  let raf = false;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      items.forEach(({ section, rate }) => {
        const rect = section.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        const offset = rect.top * rate;
        section.style.backgroundPositionY = `calc(50% + ${-offset}px)`;
        // Also shift inner content wrapper slightly for depth
        const inner = section.querySelector('.spaces__wrap, .carousel__track, .footer__agentic-inner');
        if (inner) inner.style.transform = `translateY(${offset * 0.5}px)`;
      });
      raf = false;
    });
  }, { passive: true });
}());


// ── PDF Spaces tab nav ─────────────────────────────────────
(function spacesTabs() {
  document.querySelectorAll('.spaces__tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.spaces__tab').forEach(b => b.classList.remove('spaces__tab--active'));
      btn.classList.add('spaces__tab--active');
    });
  });
}());


// ── Social Proof carousel ──────────────────────────────────
(function carousel() {
  const slides = document.querySelectorAll('.carousel__slide');
  const dots   = document.querySelectorAll('.carousel__dot');
  const next   = document.getElementById('carouselNext');
  if (!slides.length || !next) return;

  let cur = 0;
  const n = slides.length;
  let timer;

  function go(i) {
    slides[cur].classList.remove('carousel__slide--on');
    if (dots[cur]) dots[cur].classList.remove('carousel__dot--on');
    cur = ((i % n) + n) % n;
    slides[cur].classList.add('carousel__slide--on');
    if (dots[cur]) dots[cur].classList.add('carousel__dot--on');
  }

  function startTimer() {
    clearInterval(timer);
    const ms = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cp-carousel-interval')) || 6000;
    timer = setInterval(() => go(cur + 1), ms);
  }

  next.addEventListener('click', () => { go(cur + 1); startTimer(); });
  dots.forEach(d => d.addEventListener('click', () => { go(+d.dataset.dot); startTimer(); }));
  startTimer();
}());


// ── Pricing tab toggle ─────────────────────────────────────
(function pricingTabs() {
  document.querySelectorAll('.ptab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(b => b.classList.remove('ptab--on'));
      document.querySelectorAll('.pricing__panel').forEach(p => p.classList.remove('pricing__panel--on'));
      btn.classList.add('ptab--on');
      const panel = document.querySelector(`.pricing__panel[data-pp="${btn.dataset.pt}"]`);
      if (panel) panel.classList.add('pricing__panel--on');
    });
  });
}());


// ── FAQ accordion ─────────────────────────────────────────
(function faqAccordion() {
  document.querySelectorAll('.faq__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq__item');
      const isOpen = item.classList.contains('faq__item--open');
      document.querySelectorAll('.faq__item').forEach(i => i.classList.remove('faq__item--open'));
      if (!isOpen) item.classList.add('faq__item--open');
    });
  });
}());


// ── Nav shadow on scroll ───────────────────────────────────
(function navShadow() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 8 ? '0 2px 24px rgba(0,0,0,.1)' : 'none';
  }, { passive: true });
}());


// ── Scroll reveal ──────────────────────────────────────────
(function scrollReveal() {
  const targets = [
    ...document.querySelectorAll('.bento-cell'),
    ...document.querySelectorAll('.plan'),
    ...document.querySelectorAll('.faq__item'),
    document.querySelector('.bento__hdr'),
    document.querySelector('.pricing__h2'),
    document.querySelector('.faq__h2'),
    document.querySelector('.spaces__h2'),
  ].filter(Boolean);

  targets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 4) * 0.07}s`;
  });

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('reveal--visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });

  targets.forEach(el => obs.observe(el));
}());
