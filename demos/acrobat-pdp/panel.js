/* ============================================================
   GLASS CONTROL PANEL — panel.js
   ============================================================ */
(function ControlPanel() {
  const root  = document.documentElement;
  const panel = document.getElementById('ctrlPanel');
  const body  = document.getElementById('ctrlBody');
  const pill  = document.getElementById('ctrlSectionName');
  const toggle = document.getElementById('ctrlToggle');

  // ── CSS var helper ──────────────────────────────────────
  function get(v)    { return getComputedStyle(root).getPropertyValue(v).trim(); }
  function set(v, x) { root.style.setProperty(v, x); }

  // ── Section map: which controls appear per section ─────
  const SECTIONS = {
    Hero: [
      { group: 'Parallax',
        controls: [
          { label: 'BG speed',   var: '--cp-hero-bg-speed',   type: 'range', min: 0, max: 0.6, step: 0.01, fmt: x => x.toFixed(2) },
          { label: 'Card speed', var: '--cp-hero-card-speed',  type: 'range', min: 0, max: 0.4, step: 0.01, fmt: x => x.toFixed(2) },
        ]
      },
      { group: 'Typography',
        controls: [
          { label: 'Headline px', var: '--cp-hero-headline-size', type: 'range', min: 28, max: 64, step: 1, unit: 'px', fmt: x => Math.round(x) + 'px' },
        ]
      },
      { group: 'Card',
        controls: [
          { label: 'Scale',  var: '--cp-hero-card-scale', type: 'range', min: 0.6, max: 1.4, step: 0.02, fmt: x => x.toFixed(2) },
          { label: 'Offset X', var: '--cp-hero-card-x',  type: 'range', min: -200, max: 200, step: 4, unit: 'px', fmt: x => Math.round(x) + 'px' },
          { label: 'Offset Y', var: '--cp-hero-card-y',  type: 'range', min: -200, max: 200, step: 4, unit: 'px', fmt: x => Math.round(x) + 'px' },
        ]
      },
    ],

    Bento: [
      { group: 'Cards',
        controls: [
          { label: 'Hover lift',   var: '--cp-bento-hover-lift',  type: 'range', min: 0, max: 24, step: 1, unit: 'px', fmt: x => Math.round(x) + 'px' },
          { label: 'Corner r',    var: '--cp-bento-radius',      type: 'range', min: 0, max: 40, step: 2, unit: 'px', fmt: x => Math.round(x) + 'px' },
          { label: 'Gap',         var: '--cp-bento-gap',          type: 'range', min: 4, max: 40, step: 2, unit: 'px', fmt: x => Math.round(x) + 'px' },
        ]
      },
      { group: 'Animation',
        controls: [
          { label: 'Duration',    var: '--cp-bento-duration',    type: 'range', min: 100, max: 800, step: 50, unit: 'ms', fmt: x => Math.round(x) + 'ms' },
          { label: 'AI lift',     var: '--cp-bento-ai-lift',      type: 'range', min: 0, max: 30, step: 1, unit: 'px', fmt: x => Math.round(x) + 'px' },
        ]
      },
    ],

    'PDF Spaces': [
      { group: 'Layout', controls: [] },
    ],

    'Social Proof': [
      { group: 'Carousel',
        controls: [
          { label: 'Transition', var: '--cp-carousel-duration', type: 'range', min: 100, max: 1000, step: 50, unit: 'ms', fmt: x => Math.round(x) + 'ms' },
        ]
      },
    ],

    Pricing: [
      { group: 'Cards', controls: [] },
    ],

    FAQ: [
      { group: 'Accordion',
        controls: [
          { label: 'Duration', var: '--cp-faq-duration', type: 'range', min: 150, max: 800, step: 50, unit: 'ms', fmt: x => Math.round(x) + 'ms' },
        ]
      },
    ],

    Footer: [
      { group: 'Agentic Search',
        controls: [
          { label: 'Lift px',   var: '--cp-footer-agentic-lift',       type: 'range', min: 0, max: 40, step: 1, unit: 'px', fmt: x => Math.round(x) + 'px' },
        ]
      },
      { group: 'Adobe Logo',
        controls: [
          { label: 'Opacity',   var: '--cp-footer-logo-opacity',       type: 'range', min: 0.02, max: 0.5, step: 0.01, fmt: x => x.toFixed(2) },
          { label: 'Hover op.', var: '--cp-footer-logo-hover-opacity', type: 'range', min: 0.05, max: 0.8, step: 0.01, fmt: x => x.toFixed(2) },
          { label: 'Lift px',   var: '--cp-footer-logo-lift',          type: 'range', min: 0, max: 120, step: 4, unit: 'px', fmt: x => Math.round(x) + 'px' },
        ]
      },
    ],
  };

  // ── Read initial defaults ───────────────────────────────
  const DEFAULTS = {};
  Object.values(SECTIONS).forEach(groups => {
    groups.forEach(g => {
      (g.controls || []).forEach(c => {
        DEFAULTS[c.var] = get(c.var) || '0';
      });
    });
  });

  // ── Build slider row ────────────────────────────────────
  function buildSlider(ctrl) {
    const raw    = parseFloat(get(ctrl.var)) || 0;
    const pct    = ((raw - ctrl.min) / (ctrl.max - ctrl.min)) * 100;
    const valStr = ctrl.fmt ? ctrl.fmt(raw) : raw;

    const row = document.createElement('div');
    row.className = 'ctrl-row';

    const label = document.createElement('span');
    label.className = 'ctrl-label';
    label.textContent = ctrl.label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'ctrl-slider';
    slider.min = ctrl.min;
    slider.max = ctrl.max;
    slider.step = ctrl.step;
    slider.value = raw;
    slider.style.setProperty('--pct', pct + '%');

    const valEl = document.createElement('span');
    valEl.className = 'ctrl-value';
    valEl.textContent = valStr;

    slider.addEventListener('input', () => {
      const v   = parseFloat(slider.value);
      const pct = ((v - ctrl.min) / (ctrl.max - ctrl.min)) * 100;
      slider.style.setProperty('--pct', pct + '%');
      valEl.textContent = ctrl.fmt ? ctrl.fmt(v) : v;
      const val = ctrl.unit ? v + ctrl.unit : String(v);
      set(ctrl.var, val);
      // Special re-trigger for card scale
      if (ctrl.var === '--cp-hero-card-scale') window.dispatchEvent(new Event('scroll'));
    });

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(valEl);
    return row;
  }

  // ── Render controls for a section ─────────────────────
  function render(sectionName) {
    body.innerHTML = '';
    const groups = SECTIONS[sectionName] || [];

    groups.forEach(g => {
      if (!g.controls || g.controls.length === 0) return;
      const grp = document.createElement('div');
      grp.className = 'ctrl-group';

      const lbl = document.createElement('div');
      lbl.className = 'ctrl-group__label';
      lbl.textContent = g.group;
      grp.appendChild(lbl);

      g.controls.forEach(c => {
        if (c.type === 'range') grp.appendChild(buildSlider(c));
      });

      body.appendChild(grp);
    });

    // Global toggles always shown
    const global = document.createElement('div');
    global.className = 'ctrl-group';

    const gLbl = document.createElement('div');
    gLbl.className = 'ctrl-group__label';
    gLbl.textContent = 'Global';
    global.appendChild(gLbl);

    const revealRow = document.createElement('div');
    revealRow.className = 'ctrl-toggle-wrap';
    revealRow.innerHTML = `
      <span class="ctrl-toggle-label">Scroll reveal</span>
      <label class="ctrl-switch">
        <input type="checkbox" id="cpReveal" checked>
        <span class="ctrl-switch__track"></span>
      </label>
    `;
    global.appendChild(revealRow);
    body.appendChild(global);

    document.getElementById('cpReveal')?.addEventListener('change', e => {
      document.querySelectorAll('.reveal').forEach(el => {
        el.style.opacity = e.target.checked ? '' : '1';
        el.style.transform = e.target.checked ? '' : 'none';
      });
    });

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'ctrl-reset-btn';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.addEventListener('click', () => {
      Object.entries(DEFAULTS).forEach(([v, val]) => root.style.setProperty(v, val));
      render(sectionName);
    });
    body.appendChild(resetBtn);
  }

  // ── Section detection via IntersectionObserver ─────────
  let currentSection = 'Hero';

  const sectionEls = document.querySelectorAll('[data-section]');
  const sectionObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const s = e.target.dataset.section;
        if (s && s !== 'nav' && s !== currentSection) {
          currentSection = s;
          pill.textContent = s;
          pill.dataset.s = s;
          render(s);
        }
      }
    });
  }, { threshold: 0.15, rootMargin: '-80px 0px 0px 0px' });

  sectionEls.forEach(el => sectionObs.observe(el));

  // Init
  pill.textContent = 'Hero';
  pill.dataset.s   = 'Hero';
  render('Hero');

  // ── Collapse toggle ─────────────────────────────────────
  let collapsed = false;
  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    panel.classList.toggle('ctrl-panel--collapsed', collapsed);
    toggle.textContent = collapsed ? '+' : '−';
  });

  // ── Drag to reposition ──────────────────────────────────
  let dragging = false, startY = 0, panelTop = 0;

  const header = panel.querySelector('.ctrl-panel__header');
  header.addEventListener('mousedown', e => {
    dragging = true;
    startY   = e.clientY;
    panelTop = panel.getBoundingClientRect().top;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dy      = e.clientY - startY;
    const newTop  = Math.max(10, Math.min(window.innerHeight - 80, panelTop + dy));
    panel.style.top       = newTop + 'px';
    panel.style.transform = 'none';
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    document.body.style.userSelect = '';
  });

}());
