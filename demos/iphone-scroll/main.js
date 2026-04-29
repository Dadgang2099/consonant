/* ============================================================
   iPhone 11 Pro — Scroll-scrub hero with lens vignette reveal
   ============================================================ */

window._scrollCfg = { ph1Mult: 3, lensIn: 0.20, lensOut: 0.80, lensPeak: 0.97 };

(function iPhoneScroll() {

  // ── Elements ─────────────────────────────────────────────
  const video         = document.getElementById('heroVideo');
  const lensMask      = document.getElementById('lensMask');
  const scrollHint    = document.getElementById('scrollHint');
  const phoneImg      = document.getElementById('phoneImg');
  const phoneHeadline = document.querySelector('.phone-headline');

  if (!video || !lensMask) return;

  // ── Tweak panel defaults ──────────────────────────────────
  let tweakScale = 71.9;
  let tweakYRef  = 789;
  let tweakXOff  = 2;

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
    // Sync slider elements to loaded values (may differ from HTML defaults)
    scaleInput.value = tweakScale;
    yRefInput.value  = tweakYRef;
    xOffInput.value  = tweakXOff;
    syncLabels();

    scaleInput.addEventListener('input', () => { tweakScale = +scaleInput.value; syncLabels(); onScroll(); });
    yRefInput.addEventListener('input',  () => { tweakYRef  = +yRefInput.value;  syncLabels(); onScroll(); });
    xOffInput.addEventListener('input',  () => { tweakXOff  = +xOffInput.value;  syncLabels(); onScroll(); });

    document.getElementById('tweakReset')?.addEventListener('click', () => {
      tweakScale = 71.9; tweakYRef = 789; tweakXOff = 2;
      scaleInput.value = tweakScale;
      yRefInput.value  = tweakYRef;
      xOffInput.value  = tweakXOff;
      syncLabels(); onScroll();
    });

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
  }

  // ── Scroll phases ─────────────────────────────────────────
  const PH1 = () => window.innerHeight * (window._scrollCfg.ph1Mult || 3);
  const PH2 = () => window.innerHeight * 3;

  video.addEventListener('loadedmetadata', () => {
    video.currentTime = 0;
  }, { once: true });

  function ease(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function placePhone(slideFraction) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const S = Math.max(W / 1894, H / 1440);

    const phoneW = 1035 * S * (tweakScale / 72);
    const phoneH = phoneW * (2029 / 1035);

    // Slide phone completely off the top of the viewport.
    // slideMax = distance from rest cy to cy where phone bottom clears top edge.
    const cy0      = H / 2 + tweakYRef * S;
    const slideMax = cy0 + phoneH / 2 + 60;   // 60px above viewport top as buffer
    const tyPx     = -slideMax * ease(slideFraction);

    const cx = W / 2 + tweakXOff;
    const cy = cy0 + tyPx;

    const tx = cx - phoneW / 2;
    const ty = cy - phoneH / 2;

    if (tweakInfo) {
      tweakInfo.textContent =
        `S:${S.toFixed(3)}  phone:${Math.round(phoneW)}×${Math.round(phoneH)}  cy:${Math.round(cy)}px`;
    }

    return { tx, ty, phoneW };
  }

  const lpBelow = document.querySelector('.lp-below');

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

      // Vignette: bell curve driven by _scrollCfg
      const lensStart  = window._scrollCfg.lensIn;
      const lensEnd    = window._scrollCfg.lensOut;
      const lensRaw    = (p1 - lensStart) / (lensEnd - lensStart);
      const lensT      = ease(Math.min(Math.max(lensRaw, 0), 1));
      const vigOpacity = lensT <= 0 || lensT >= 1 ? 0 : Math.sin(lensT * Math.PI) * window._scrollCfg.lensPeak;
      const centerStop  = lensT < 0.5 ? 30 - lensT * 2 * 25 : 5 + (lensT - 0.5) * 2 * 55;
      const featherStop = centerStop + 35;
      lensMask.style.opacity    = vigOpacity;
      lensMask.style.background = `radial-gradient(ellipse at center,
        transparent 0%,
        transparent ${centerStop}%,
        rgba(0,0,0,0.7) ${featherStop}%,
        rgba(0,0,0,0.97) 100%
      )`;

      // Update sequence panel debug readout
      const seqInfoEl = document.getElementById('seqInfo');
      if (seqInfoEl) {
        const dur = video.duration ? (p1 * video.duration).toFixed(2) + 's' : '—';
        seqInfoEl.textContent = `p1: ${p1.toFixed(3)}  ${dur}`;
      }

      // ── Phase 2: phone crossfade + slide-off ─────────────
      let p2 = 0, slideFraction = 0;
      if (phoneImg) {
        p2 = Math.min(Math.max((y - ph1End) / PH2(), 0), 1);

        phoneImg.style.opacity = Math.min(p2 / 0.08, 1);
        video.style.opacity    = 1 - Math.min(Math.max((p2 - 0.04) / 0.11, 0), 1);

        slideFraction = Math.max((p2 - 0.15) / 0.85, 0);
        const { tx, ty, phoneW } = placePhone(slideFraction);

        phoneImg.style.width     = `${phoneW}px`;
        phoneImg.style.transform = `translate(${tx}px, ${ty}px)`;

        if (phoneHeadline) {
          phoneHeadline.style.opacity = Math.min(Math.max((p2 - 0.12) / 0.28, 0), 1);
        }
      }

      // lp-below enters naturally via 700vh driver — no JS transform needed

      raf = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { raf = false; onScroll(); });
  onScroll();
}());

/* ============================================================
   Panel System — glass WebGL + content editor + panel switch
   ============================================================ */
(function PanelSystem() {

  // ── WebGL chromatic glass renderer ──────────────────────
  function initGl(canvas) {
    if (!canvas) return null;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return null;

    const vs = `attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}`;
    const fs = `
      precision mediump float;
      uniform float u_t;
      uniform vec2  u_res;

      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x),
                   mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);
      }

      void main(){
        vec2 uv=gl_FragCoord.xy/u_res;
        float t=u_t*0.10;

        float d=n(uv*3.0+t)*0.5+n(uv*7.0-t*1.3)*0.25+n(uv*14.0+t*0.7)*0.12;
        vec2 flow=vec2(sin(uv.y*9.0+t+d*4.0),cos(uv.x*7.0+t*1.1+d*3.0))*0.007;

        float ca=0.009;
        float rN=n((uv+flow+vec2(ca,0))*5.0+vec2(t*0.9,0));
        float gN=n((uv+flow)*5.5+vec2(0,t*0.7));
        float bN=n((uv+flow-vec2(ca,0))*4.5+vec2(t*0.6,t*0.5));

        vec3 base=vec3(0.028,0.030,0.048);
        vec3 col=base+vec3(rN*0.06,gN*0.042,bN*0.07);

        float spec=smoothstep(0.55,1.0,uv.y)*smoothstep(0.1,0.6,uv.x);
        col+=vec3(0.020,0.024,0.050)*spec;

        float eL=smoothstep(0.18,0.0,uv.x);
        col+=vec3(0.008,0.004,0.045)*eL;
        float eR=smoothstep(0.82,1.0,uv.x);
        col+=vec3(0.040,0.008,0.004)*eR;

        float glow=exp(-pow(distance(uv,vec2(0.5,1.15))*2.8,2.0));
        col+=vec3(0.016,0.020,0.048)*glow;

        gl_FragColor=vec4(col,0.95);
      }
    `;

    function makeShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s); return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uT   = gl.getUniformLocation(prog, 'u_t');
    const uRes = gl.getUniformLocation(prog, 'u_res');

    return { gl, uT, uRes };
  }

  function resizeGl(ctx, canvas) {
    const { gl } = ctx;
    const w = canvas.offsetWidth * devicePixelRatio;
    const h = canvas.offsetHeight * devicePixelRatio;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  const glContexts = [];
  ['tweakGl','ctrlGl','scopeGl','seqGl','shadowGl'].forEach(id => {
    const canvas = document.getElementById(id);
    const ctx    = initGl(canvas);
    if (ctx) glContexts.push({ ctx, canvas });
  });

  let glT = 0;
  function renderGl(ts) {
    glT = ts * 0.001;
    glContexts.forEach(({ ctx, canvas }) => {
      resizeGl(ctx, canvas);
      const { gl, uT, uRes } = ctx;
      gl.uniform1f(uT, glT);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    requestAnimationFrame(renderGl);
  }
  requestAnimationFrame(renderGl);

  // ── Slider fill track ────────────────────────────────────
  function updateTrack(input) {
    const panel = input.closest('.pw-panel');
    const dark  = !panel?.classList.contains('pw-panel--newb');
    const fill  = dark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.42)';
    const fill0 = dark ? 'rgba(255,255,255,0)'    : 'rgba(0,0,0,0)';
    const min = +input.min, max = +input.max, val = +input.value;
    const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));

    // True thumb-center in element-% space (WebKit insets thumb by half its
    // width from each track edge, so raw ratio ≠ visual center position).
    const w   = input.offsetWidth || 200;
    const tW  = 20;       // must match CSS thumb width
    const capR = tW / 2;  // 10 px
    const cx  = capR + (w - tW) * ratio;
    const tp  = (cx / w * 100).toFixed(3);

    // Cap dome: round right end of the fill bar.
    const cap = `radial-gradient(circle ${capR}px at ${tp}% 50%, ${fill} 80%, ${fill0} 100%)`;
    // Bar: solid fill that softly fades over the full thumb diameter so there
    // is never a hard edge visible at any thumb opacity during hover/rolloff.
    const bar = `linear-gradient(to right, ${fill} calc(${tp}% - ${capR}px), ${fill0} calc(${tp}% + ${capR}px))`;

    input.style.backgroundImage    = `${cap}, ${bar}`;
    input.style.backgroundSize     = '';
    input.style.backgroundPosition = '';
    input.style.backgroundRepeat   = '';
  }
  document.querySelectorAll('.pw-range').forEach(r => {
    updateTrack(r);
    r.addEventListener('input', () => updateTrack(r));
    r.addEventListener('wheel', e => {
      e.preventDefault();
      const dir  = ((e.deltaX || e.deltaY) > 0) ? 1 : -1;
      const step = parseFloat(r.step) || 1;
      r.value = Math.min(+r.max, Math.max(+r.min, +r.value + step * dir));
      r.dispatchEvent(new Event('input'));
    }, { passive: false });
  });

  // ── Copy buttons ─────────────────────────────────────────
  function flashCopied(btn) {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1200);
  }
  document.querySelectorAll('.pw-cp').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const el = document.getElementById(targetId);
      if (!el) return;
      const val = el.type === 'range' || el.type === 'number'
        ? el.value
        : el.value || el.textContent;
      navigator.clipboard?.writeText(val).then(() => flashCopied(btn));
    });
  });

  // ── Panel toggle (minimize) ──────────────────────────────
  function bindToggle(toggleId, bodyId) {
    const btn  = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);
    if (!btn || !body) return;
    btn.addEventListener('click', () => {
      const hidden = body.classList.toggle('hidden');
      btn.textContent = hidden ? '+' : '−';
    });
  }
  bindToggle('tweakToggle',   'tweakBody');
  bindToggle('ctrlToggle',    'ctrlBody');
  bindToggle('seqToggle',     'seqBody');
  bindToggle('shadowToggle',  'shadowBody');

  // ── Panel switch + shadow opacity ────────────────────────
  const seqPanel     = document.getElementById('seqPanel');
  const shadowPanel  = document.getElementById('shadowPanel');
  const tweakPanel   = document.getElementById('tweakPanel');
  const contentPanel = document.getElementById('contentPanel');

  // All right-side panels start hidden via inline style
  [seqPanel, tweakPanel, contentPanel].forEach(p => {
    if (!p) return;
    p.style.opacity       = '0';
    p.style.pointerEvents = 'none';
  });
  if (shadowPanel) { shadowPanel.style.opacity = '0'; shadowPanel.style.pointerEvents = 'none'; }

  // Shared position for right-side panels — next panel inherits last dragged position
  let sharedPanelPos = null;

  // ── Scroll-driven 3D helpers ─────────────────────────────
  const c01   = v => Math.min(1, Math.max(0, v));
  const sStep = t => t * t * (3 - 2 * t);  // smoothstep

  function setPanel3D(el, opa, yOff, tz, sc, blur) {
    if (!el) return;
    // Snap non-dragged panels to shared position when first becoming visible
    if (opa > 0 && !el.dataset.draggable && el !== shadowPanel && sharedPanelPos) {
      el.style.left   = sharedPanelPos.left + 'px';
      el.style.top    = sharedPanelPos.top  + 'px';
      el.style.right  = 'auto';
      el.dataset.draggable = '1';
    }
    el.style.opacity       = c01(opa);
    el.style.pointerEvents = opa < 0.04 ? 'none' : 'auto';
    el.style.transform     = `perspective(1100px) translateY(${yOff.toFixed(1)}px) translateZ(${tz.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    el.style.filter        = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : '';
  }

  let panelsVisible = false;

  function updatePanelVisibility() {
    if (!panelsVisible) return;
    const ph1End = window.innerHeight * (window._scrollCfg?.ph1Mult || 3);
    const ph2    = window.innerHeight * 3;
    const y      = window.scrollY;
    const p2     = Math.min(Math.max((y - ph1End) / ph2, 0), 1);

    // t1: seq ↔ tweak — 220px window centered just past ph1End
    const t1 = sStep(c01((y - (ph1End - 50)) / 220));
    // t2: tweak ↔ content — p2 0.82→0.92
    const t2 = sStep(c01((p2 - 0.82) / 0.10));

    // ── seq: exits backward in Z as t1 → 1 ───────────────
    setPanel3D(seqPanel,
      1 - t1,          // opacity out
      0,               // no Y shift on exit
      -t1 * 55,        // push back in Z
      1 - t1 * 0.06,   // shrink slightly
      t1 * 12          // blur out
    );

    // ── tweak: rises in on t1→1, retreats on t2→1 ────────
    setPanel3D(tweakPanel,
      t1 * (1 - t2),                       // crossfade both transitions
      (1 - t1) * 24,                        // rise up from below on entry
      -t2 * 55,                             // push back on exit
      (0.94 + t1 * 0.06) * (1 - t2 * 0.06),
      (1 - t1) * 12 + t2 * 12              // blur: sharpens in, blurs out
    );

    // ── content: rises in as t2 → 1 ──────────────────────
    setPanel3D(contentPanel,
      t2,                    // opacity in
      (1 - t2) * 24,         // rise up from below
      0,                     // no Z retreat on entry
      0.94 + t2 * 0.06,      // grow in
      (1 - t2) * 12          // sharpen in
    );

    // ── shadow panel: left side, opacity + slide ──────────
    if (shadowPanel) {
      let opa = 0;
      if (y >= ph1End) {
        if (p2 < 0.10) opa = p2 / 0.10;
        else            opa = Math.max(0, 1 - t2);
        opa = Math.max(0, Math.min(1, opa));
      }
      shadowPanel.style.opacity       = opa;
      shadowPanel.style.pointerEvents = opa < 0.08 ? 'none' : 'auto';
      if (!shadowPanel.dataset.userPositioned) {
        const slideX = p2 < 0.10 ? (1 - Math.min(p2 / 0.10, 1)) * -24 : 0;
        shadowPanel.style.transform = `translateY(-50%) translateX(${slideX}px)`;
      }
    }
  }
  window.addEventListener('scroll', updatePanelVisibility, { passive: true });
  updatePanelVisibility();

  // ── Panel drag ───────────────────────────────────────────
  function makeDraggable(panel) {
    const header = panel.querySelector('.pw-panel__hdr');
    if (!header) return;
    let dragging = false, ox = 0, oy = 0, pl = 0, pt = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.pw-icon-btn')) return;
      e.preventDefault();

      if (!panel.dataset.draggable) {
        const r = panel.getBoundingClientRect();
        panel.style.left   = r.left + 'px';
        panel.style.top    = r.top  + 'px';
        panel.style.right  = 'auto';
        panel.style.bottom = 'auto';
        if (panel === shadowPanel) {
          panel.style.transform        = 'none';
          panel.dataset.userPositioned = '1';
        }
        panel.dataset.draggable = '1';
      }

      dragging = true;
      ox = e.clientX;
      oy = e.clientY;
      pl = parseFloat(panel.style.left) || 0;
      pt = parseFloat(panel.style.top)  || 0;
      header.style.cursor = 'grabbing';

      function onMove(e) {
        if (!dragging) return;
        const newL = Math.max(0, Math.min(window.innerWidth  - 60, pl + e.clientX - ox));
        const newT = Math.max(0, Math.min(window.innerHeight - 40, pt + e.clientY - oy));
        panel.style.left = newL + 'px';
        panel.style.top  = newT + 'px';
        // Propagate position to subsequent panels (not shadow panel)
        if (panel !== shadowPanel) sharedPanelPos = { left: newL, top: newT };
      }
      function onUp() {
        dragging = false;
        header.style.cursor = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  [seqPanel, shadowPanel, tweakPanel, contentPanel].forEach(p => {
    if (!p) return;
    makeDraggable(p);
  });

  // ── Mouse glow on AI callouts — paints through letter masks ─
  // Uniform icy-white across all panels
  const ICY = 'rgba(218,243,255,0.88)';
  const calloutBaseColors = {
    shadowPanel:  ICY,
    seqPanel:     ICY,
    tweakPanel:   ICY,
    contentPanel: ICY,
  };
  const calloutGlowHues = {
    shadowPanel:  [196, 208],
    seqPanel:     [196, 208],
    tweakPanel:   [196, 208],
    contentPanel: [196, 208],
  };
  document.querySelectorAll('.pw-panel').forEach(panel => {
    const callouts = panel.querySelectorAll('.pw-ai-callout');
    if (!callouts.length) return;
    const base      = calloutBaseColors[panel.id] ?? 'rgba(148,163,184,0.88)';
    const [h0, h1]  = calloutGlowHues[panel.id]   ?? [185, 220];
    panel.addEventListener('mousemove', e => {
      callouts.forEach(el => {
        const r    = el.getBoundingClientRect();
        const gxPct = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
        const gyPct = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
        const t     = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        const hue   = Math.round(h0 + t * (h1 - h0));
        const textEl = el.querySelector('.pw-ai-callout__text');
        if (textEl) {
          // Hot spot gradient clips to letter shapes only — no background tint
          textEl.style.backgroundImage =
            `radial-gradient(circle 72px at ${gxPct}% ${gyPct}%, hsla(${hue},100%,97%,0.95) 0%, ${base} 52%, ${base} 100%)`;
        }
      });
    });
    panel.addEventListener('mouseleave', () => {
      callouts.forEach(el => {
        const textEl = el.querySelector('.pw-ai-callout__text');
        if (textEl) textEl.style.backgroundImage = '';
      });
    });
  });

  // ── Alignment panel copy-all ─────────────────────────────
  document.getElementById('tweakCopy')?.addEventListener('click', () => {
    const scaleEl = document.getElementById('scaleInput');
    const yEl     = document.getElementById('yRefInput');
    const xEl     = document.getElementById('xOffInput');
    const txt = `scale:${(+scaleEl?.value).toFixed(1)}  yRef:${yEl?.value}px  xOff:${xEl?.value}px`;
    navigator.clipboard?.writeText(txt);
    const btn = document.getElementById('tweakCopy');
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = old; }, 1400);
  });

  // ── Section accordion ────────────────────────────────────
  document.querySelectorAll('.pw-sec__hdr').forEach(hdr => {
    const sec  = document.getElementById(hdr.dataset.sec);
    const body = sec?.querySelector('.pw-sec__body');
    const tog  = hdr.querySelector('.pw-sec__tog');
    if (!body || !tog) return;
    body.style.maxHeight = body.scrollHeight + 'px';
    hdr.addEventListener('click', () => {
      const isCollapsed = sec.classList.toggle('pw-sec--collapsed');
      tog.textContent   = isCollapsed ? '+' : '−';
      body.style.maxHeight = isCollapsed ? '0px' : body.scrollHeight + 'px';
    });
  });

  // Collapse all content sections except the first on initial load
  document.querySelectorAll('#ctrlBody .pw-sec').forEach((sec, i) => {
    if (i === 0) return;
    const body = sec.querySelector('.pw-sec__body');
    const tog  = sec.querySelector('.pw-sec__tog');
    sec.classList.add('pw-sec--collapsed');
    if (tog)  tog.textContent        = '+';
    if (body) body.style.maxHeight   = '0px';
  });

  // ── Sequence panel bindings ──────────────────────────────
  function applySeqConfig() {
    const mult = +(document.getElementById('seqSpeed')?.value || 3);
    window._scrollCfg.ph1Mult  = mult;
    window._scrollCfg.lensIn   = +(document.getElementById('seqLensIn')?.value  || 0.2);
    window._scrollCfg.lensOut  = +(document.getElementById('seqLensOut')?.value || 0.8);
    window._scrollCfg.lensPeak = +(document.getElementById('seqLensPeak')?.value || 0.97);
    const driver = document.querySelector('.scroll-driver');
    if (driver) driver.style.height = (mult + 5) * 100 + 'vh';
    window.dispatchEvent(new Event('scroll'));
  }

  function bindSeqSlider(id, numId, fmt) {
    const input = document.getElementById(id);
    const num   = document.getElementById(numId);
    if (!input || !num) return;
    input.addEventListener('input', () => {
      num.textContent = fmt(+input.value);
      applySeqConfig();
    });
  }

  bindSeqSlider('seqSpeed',    'seqSpeedNum',    v => v.toFixed(1));
  bindSeqSlider('seqLensIn',   'seqLensInNum',   v => Math.round(v * 100));
  bindSeqSlider('seqLensOut',  'seqLensOutNum',  v => Math.round(v * 100));
  bindSeqSlider('seqLensPeak', 'seqLensPeakNum', v => v.toFixed(2));

  // ── Shadow panel bindings ───────────────────────────────
  const phoneImgEl = document.getElementById('phoneImg');

  // ── Shadow color state (HSV) ─────────────────────────────
  let shadowH = 0, shadowS = 0, shadowV = 0; // default: black

  function hsvToRgb(h, s, v) {
    s /= 100; v /= 100;
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const m = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i];
    return m.map(x => Math.round(x * 255));
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function hexToHsv(hex) {
    const r = parseInt(hex.slice(0,2),16)/255;
    const g = parseInt(hex.slice(2,4),16)/255;
    const b = parseInt(hex.slice(4,6),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    let h = 0;
    if (d > 0) {
      if (max===r)      h = ((g-b)/d+6)%6*60;
      else if (max===g) h = ((b-r)/d+2)*60;
      else              h = ((r-g)/d+4)*60;
    }
    return [Math.round(h), max>0 ? Math.round(d/max*100) : 0, Math.round(max*100)];
  }

  function applyShadow() {
    const x    = +(document.getElementById('shadowX')?.value    || 0);
    const y    = +(document.getElementById('shadowY')?.value    || 48);
    const blur = +(document.getElementById('shadowBlur')?.value || 96);
    const opac = +(document.getElementById('shadowOpacity')?.value || 0.60);
    const [r, g, b] = hsvToRgb(shadowH, shadowS, shadowV);
    if (phoneImgEl) {
      phoneImgEl.style.filter = `drop-shadow(${x}px ${y}px ${blur}px rgba(${r},${g},${b},${opac}))`;
    }
  }

  function bindShadowSlider(id, numId, fmt) {
    const input = document.getElementById(id);
    const num   = document.getElementById(numId);
    if (!input || !num) return;
    input.addEventListener('input', () => { num.textContent = fmt(+input.value); applyShadow(); });
  }

  bindShadowSlider('shadowBlur',    'shadowBlurNum',    v => Math.round(v));
  bindShadowSlider('shadowOpacity', 'shadowOpacityNum', v => v.toFixed(2));
  bindShadowSlider('shadowY',       'shadowYNum',       v => Math.round(v));
  bindShadowSlider('shadowX',       'shadowXNum',       v => Math.round(v));

  // ── Color picker ─────────────────────────────────────────
  (function initColorPicker() {
    const chip      = document.getElementById('shadowColorChip');
    const chipHex   = document.getElementById('shadowColorHex');
    const picker    = document.getElementById('shadowCPicker');
    const svCanvas  = document.getElementById('shadowCPickerSV');
    const svCursor  = document.getElementById('shadowCPickerCursor');
    const hueTrack  = document.getElementById('shadowCPickerHue');
    const hueThumb  = document.getElementById('shadowCPickerHueThumb');
    const preview   = document.getElementById('shadowCPickerPreview');
    const hexInput  = document.getElementById('shadowCPickerHex');
    if (!chip || !picker || !svCanvas) return;

    let pickerOpen = false;

    function renderSV() {
      const ctx = svCanvas.getContext('2d');
      const W = svCanvas.width, H = svCanvas.height;
      const [r,g,b] = hsvToRgb(shadowH, 100, 100);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, 0, W, H);
      const wGrad = ctx.createLinearGradient(0,0,W,0);
      wGrad.addColorStop(0, 'rgba(255,255,255,1)');
      wGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = wGrad;
      ctx.fillRect(0, 0, W, H);
      const bGrad = ctx.createLinearGradient(0,0,0,H);
      bGrad.addColorStop(0, 'rgba(0,0,0,0)');
      bGrad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = bGrad;
      ctx.fillRect(0, 0, W, H);
    }

    function updateUI() {
      const [r,g,b] = hsvToRgb(shadowH, shadowS, shadowV);
      const hex = rgbToHex(r, g, b);
      chip.style.background      = hex;
      if (chipHex)  chipHex.textContent  = hex;
      if (preview)  preview.style.background = hex;
      if (hexInput) hexInput.value = hex.slice(1).toUpperCase();
      // SV cursor
      const svW = svCanvas.offsetWidth || svCanvas.width;
      const svH = svCanvas.offsetHeight || svCanvas.height;
      svCursor.style.left = `${(shadowS / 100) * svW}px`;
      svCursor.style.top  = `${(1 - shadowV / 100) * svH}px`;
      // Hue thumb
      const hW = hueTrack.offsetWidth || 220;
      hueThumb.style.left = `${(shadowH / 360) * hW}px`;
      const [rh,gh,bh] = hsvToRgb(shadowH, 100, 100);
      hueThumb.style.background = `rgb(${rh},${gh},${bh})`;
    }

    function onColorChange() {
      renderSV();
      updateUI();
      applyShadow();
    }

    // ── Open/close ──────────────────────────────────────────
    function openPicker() {
      pickerOpen = true;
      picker.hidden = false;
      // Position to the right of the shadow panel
      const chipRect = chip.getBoundingClientRect();
      const panelRight = 20 + 260 + 10; // left + width + gap
      picker.style.left = `${panelRight}px`;
      picker.style.top  = `${Math.max(10, chipRect.top - 10)}px`;
      renderSV();
      updateUI();
    }

    function closePicker() {
      pickerOpen = false;
      picker.hidden = true;
    }

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerOpen ? closePicker() : openPicker();
    });

    document.addEventListener('click', (e) => {
      if (pickerOpen && !picker.contains(e.target) && e.target !== chip) closePicker();
    });

    // ── SV canvas drag ──────────────────────────────────────
    function handleSV(e) {
      const rect = svCanvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      shadowS = Math.round(Math.max(0, Math.min(1, (cx - rect.left) / rect.width))  * 100);
      shadowV = Math.round(Math.max(0, Math.min(1, 1 - (cy - rect.top)  / rect.height)) * 100);
      onColorChange();
    }

    let svDragging = false;
    svCanvas.addEventListener('mousedown',  (e) => { svDragging = true; handleSV(e); });
    svCanvas.addEventListener('touchstart', (e) => { svDragging = true; handleSV(e); e.preventDefault(); }, { passive: false });
    document.addEventListener('mousemove',  (e) => { if (svDragging) handleSV(e); });
    document.addEventListener('touchmove',  (e) => { if (svDragging) handleSV(e); }, { passive: false });
    document.addEventListener('mouseup',    ()  => { svDragging = false; });
    document.addEventListener('touchend',   ()  => { svDragging = false; });

    // ── Hue drag ────────────────────────────────────────────
    function handleHue(e) {
      const rect = hueTrack.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      shadowH = Math.round(Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * 360);
      onColorChange();
    }

    let hueDragging = false;
    hueTrack.addEventListener('mousedown',  (e) => { hueDragging = true; handleHue(e); });
    hueTrack.addEventListener('touchstart', (e) => { hueDragging = true; handleHue(e); e.preventDefault(); }, { passive: false });
    document.addEventListener('mousemove',  (e) => { if (hueDragging) handleHue(e); });
    document.addEventListener('touchmove',  (e) => { if (hueDragging) handleHue(e); }, { passive: false });
    document.addEventListener('mouseup',    ()  => { hueDragging = false; });
    document.addEventListener('touchend',   ()  => { hueDragging = false; });

    // ── Hex input ───────────────────────────────────────────
    hexInput?.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
      e.target.value = val;
      if (val.length === 6) {
        [shadowH, shadowS, shadowV] = hexToHsv(val);
        onColorChange();
      }
    });

    hexInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') closePicker();
    });

    // init chip color
    chip.style.background = '#000000';
  }());

  // ── Pro / Newb toggle ────────────────────────────────────
  const modeToggle = document.getElementById('modeToggle');

  function setMode(mode) {
    const isPro = mode === 'pro';
    modeToggle?.classList.toggle('mode-toggle--newb', !isPro);
    document.querySelectorAll('.mode-toggle__opt').forEach(btn => {
      btn.classList.toggle('mode-toggle__opt--on', btn.dataset.mode === mode);
    });
    [seqPanel, shadowPanel, tweakPanel, contentPanel].forEach(p => {
      p?.classList.toggle('pw-panel--newb', !isPro);
    });
    document.querySelectorAll('.pw-panel .pw-range').forEach(r => updateTrack(r));
  }

  document.querySelectorAll('.mode-toggle__opt').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // ── Content panel — live bindings ────────────────────────
  const hlEl      = document.getElementById('hlText');
  const bdEl      = document.getElementById('bdText');
  const cta1El    = document.getElementById('cta1El');
  const cta2El    = document.getElementById('cta2El');
  const ctasRow   = document.getElementById('ctasRow');
  const headline  = document.getElementById('phoneHeadline');

  if (!hlEl) return;

  const defaults = {
    hlSize: 80, hlLineH: 1.05, hlTracking: -0.03, hlWeight: '700',
    bdSize: 17, bdLineH: 1.6,  bdTracking: -0.022, bdWeight: '400',
    cta1: 'Watch the keynote', cta2: 'Watch the film',
    ctaGap: 28, ctaAlign: 'center',
    lockupTop: 38, lockupMaxW: 820, lockupPad: 60, lockupGap: 24, lockupScale: 100,
  };

  function applyAll() {
    hlEl.style.fontSize      = document.getElementById('hlSize').value + 'px';
    hlEl.style.lineHeight    = document.getElementById('hlLineH').value;
    hlEl.style.letterSpacing = document.getElementById('hlTracking').value + 'em';
    hlEl.style.fontWeight    = document.getElementById('hlWeight').value;
    bdEl.style.fontSize      = document.getElementById('bdSize').value + 'px';
    bdEl.style.lineHeight    = document.getElementById('bdLineH').value;
    bdEl.style.letterSpacing = document.getElementById('bdTracking').value + 'em';
    bdEl.style.fontWeight    = document.getElementById('bdWeight').value;
    if (cta1El) cta1El.textContent = document.getElementById('cta1Text').value;
    if (cta2El) cta2El.textContent = document.getElementById('cta2Text').value;
    if (ctasRow) {
      ctasRow.style.gap            = document.getElementById('ctaGap').value + 'px';
      ctasRow.style.justifyContent = document.querySelector('.pw-seg__btn--on')?.dataset.val || 'center';
    }
    if (headline) {
      headline.style.top       = document.getElementById('lockupTop').value + '%';
      headline.style.padding   = '0 ' + document.getElementById('lockupPad').value + 'px';
      const sc = document.getElementById('lockupScale');
      headline.style.transform = sc ? `scale(${sc.value / 100})` : '';
      headline.style.transformOrigin = 'top center';
    }
    hlEl.style.maxWidth     = document.getElementById('lockupMaxW').value + 'px';
    bdEl.style.maxWidth     = document.getElementById('lockupMaxW').value + 'px';
    bdEl.style.marginBottom = document.getElementById('lockupGap').value + 'px';
    hlEl.style.marginBottom = document.getElementById('lockupGap').value + 'px';
  }

  function bindSlider(id, numId, fmt, applyFn) {
    const input = document.getElementById(id);
    const num   = document.getElementById(numId);
    if (!input || !num) return;
    input.addEventListener('input', () => {
      num.textContent = fmt(+input.value);
      applyFn();
    });
  }

  const fmtPx  = v => Math.round(v);
  const fmtF2  = v => v < 0 ? `−${Math.abs(v).toFixed(3)}` : v.toFixed(2);
  const fmtF3  = v => v < 0 ? `−${Math.abs(v).toFixed(3)}` : v.toFixed(3);
  const fmtPct = v => (+v).toFixed(1);

  bindSlider('hlSize',     'hlSizeNum',     fmtPx,  applyAll);
  bindSlider('hlLineH',    'hlLineHNum',    fmtF2,  applyAll);
  bindSlider('hlTracking', 'hlTrackingNum', fmtF3,  applyAll);
  bindSlider('bdSize',     'bdSizeNum',     fmtPx,  applyAll);
  bindSlider('bdLineH',    'bdLineHNum',    fmtF2,  applyAll);
  bindSlider('bdTracking', 'bdTrackingNum', fmtF3,  applyAll);
  bindSlider('ctaGap',     'ctaGapNum',     fmtPx,  applyAll);
  bindSlider('lockupTop',   'lockupTopNum',   fmtPct, applyAll);
  bindSlider('lockupMaxW',  'lockupMaxWNum',  fmtPx,  applyAll);
  bindSlider('lockupPad',   'lockupPadNum',   fmtPx,  applyAll);
  bindSlider('lockupGap',   'lockupGapNum',   fmtPx,  applyAll);
  bindSlider('lockupScale', 'lockupScaleNum', fmtPct, applyAll);

  document.getElementById('hlWeight')?.addEventListener('change', applyAll);
  document.getElementById('bdWeight')?.addEventListener('change', applyAll);
  document.getElementById('cta1Text')?.addEventListener('input', applyAll);
  document.getElementById('cta2Text')?.addEventListener('input', applyAll);

  document.getElementById('ctaAlignSeg')?.addEventListener('click', e => {
    const btn = e.target.closest('.pw-seg__btn');
    if (!btn) return;
    document.querySelectorAll('#ctaAlignSeg .pw-seg__btn').forEach(b => b.classList.remove('pw-seg__btn--on'));
    btn.classList.add('pw-seg__btn--on');
    applyAll();
  });

  // ── Double-click to edit text ────────────────────────────
  function bindEditable(previewId, liveEl) {
    const preview = document.getElementById(previewId);
    if (!preview || !liveEl) return;

    preview.addEventListener('dblclick', () => {
      preview.contentEditable = 'true';
      preview.focus();
      const range = document.createRange();
      range.selectNodeContents(preview);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    function commit() {
      preview.contentEditable = 'false';
      liveEl.innerHTML = preview.innerHTML
        .replace(/<div>/g, '\n').replace(/<\/div>/g, '')
        .replace(/<br\s*\/?>/g, '\n').trim()
        .split('\n').join('<br>');
    }

    preview.addEventListener('blur', commit);
    preview.addEventListener('keydown', e => {
      if (e.key === 'Escape') { preview.contentEditable = 'false'; }
    });
  }

  bindEditable('ctrlHlPreview', hlEl);
  bindEditable('ctrlBdPreview', bdEl);

  // ── Reset all ────────────────────────────────────────────
  document.getElementById('ctrlResetAll')?.addEventListener('click', () => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; updateTrack(el); }};
    set('hlSize',     defaults.hlSize);     set('hlLineH',    defaults.hlLineH);
    set('hlTracking', defaults.hlTracking); set('hlWeight',   defaults.hlWeight);
    set('bdSize',     defaults.bdSize);     set('bdLineH',    defaults.bdLineH);
    set('bdTracking', defaults.bdTracking); set('bdWeight',   defaults.bdWeight);
    set('ctaGap',     defaults.ctaGap);
    set('lockupTop',   defaults.lockupTop);
    set('lockupMaxW',  defaults.lockupMaxW);
    set('lockupPad',   defaults.lockupPad);
    set('lockupGap',   defaults.lockupGap);
    set('lockupScale', defaults.lockupScale);
    document.getElementById('cta1Text').value = defaults.cta1;
    document.getElementById('cta2Text').value = defaults.cta2;
    document.querySelectorAll('#ctaAlignSeg .pw-seg__btn').forEach(b => {
      b.classList.toggle('pw-seg__btn--on', b.dataset.val === defaults.ctaAlign);
    });
    ['hlSize','hlLineH','hlTracking','bdSize','bdLineH','bdTracking',
     'ctaGap','lockupTop','lockupMaxW','lockupPad','lockupGap','lockupScale'].forEach(id => {
      document.getElementById(id)?.dispatchEvent(new Event('input'));
    });
    applyAll();
  });

  // ── Copy all values ──────────────────────────────────────
  document.getElementById('ctrlCopyAll')?.addEventListener('click', () => {
    const vals = [
      'hlSize','hlLineH','hlTracking','hlWeight',
      'bdSize','bdLineH','bdTracking','bdWeight',
      'ctaGap','lockupTop','lockupMaxW','lockupPad','lockupGap'
    ].map(id => {
      const el = document.getElementById(id);
      return `${id}: ${el?.value}`;
    }).join('\n');
    navigator.clipboard?.writeText(vals);
    const btn = document.getElementById('ctrlCopyAll');
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = old; }, 1500);
  });

  // ── Copy deck — file upload & parsing ───────────────────
  let parsedExtracted = '';

  const dropZone  = document.getElementById('ctrlDropZone');
  const fileInput = document.getElementById('ctrlFile');
  const progress  = document.getElementById('ctrlProgress');
  const bar       = document.getElementById('ctrlBar');
  const status    = document.getElementById('ctrlStatus');
  const parsed    = document.getElementById('ctrlParsed');
  const parsedTA  = document.getElementById('ctrlParsedText');

  document.getElementById('ctrlBrowse')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => handleFile(e.target.files[0]));

  dropZone?.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  function showProgress(pct, msg) {
    if (dropZone) dropZone.hidden = true;
    if (progress) progress.hidden = false;
    if (bar)    bar.style.width = pct + '%';
    if (status) status.textContent = msg;
  }

  function showParsed(text) {
    parsedExtracted = text.trim();
    if (parsedTA)   parsedTA.value = parsedExtracted;
    if (progress)   progress.hidden = true;
    if (parsed)     parsed.hidden   = false;
    const modal = document.getElementById('scopeModal');
    if (modal) modal.hidden = false;
  }

  function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    showProgress(10, 'Reading file…');

    if (name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = e => {
        showProgress(100, 'Done');
        showParsed(e.target.result);
      };
      reader.readAsText(file);

    } else if (name.endsWith('.pdf')) {
      if (typeof pdfjsLib === 'undefined') {
        showProgress(0, 'PDF.js not loaded — use TXT');
        return;
      }
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          showProgress(30, 'Parsing PDF…');
          const pdf  = await pdfjsLib.getDocument({ data: e.target.result }).promise;
          let   text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            showProgress(30 + (i / pdf.numPages) * 60, `Page ${i}/${pdf.numPages}`);
            const page = await pdf.getPage(i);
            const cont = await page.getTextContent();
            text += cont.items.map(s => s.str).join(' ') + '\n';
          }
          showProgress(100, 'Done');
          showParsed(text);
        } catch (err) {
          showProgress(0, 'Parse error — try TXT');
        }
      };
      reader.readAsArrayBuffer(file);

    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      if (typeof mammoth === 'undefined') {
        showProgress(0, 'mammoth.js not loaded — try TXT');
        return;
      }
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          showProgress(40, 'Parsing DOCX…');
          const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          showProgress(100, 'Done');
          showParsed(result.value);
        } catch (err) {
          showProgress(0, 'Parse error — try TXT');
        }
      };
      reader.readAsArrayBuffer(file);

    } else {
      showProgress(0, 'Unsupported — try PDF, DOCX, or TXT');
    }
  }

  // ── Scope modal ──────────────────────────────────────────
  function ingestCopy(text, scope) {
    const blocks = text.split(/\n{2,}/).map(b => b.replace(/\n/g, ' ').trim()).filter(Boolean);
    let headline = '', body = '';

    const short = blocks.filter(b => b.length <= 80).sort((a,b) => a.length - b.length);
    const long  = blocks.filter(b => b.length  > 80).sort((a,b) => b.length - a.length);
    headline = short[0] || blocks[0] || '';
    body     = long[0]  || blocks[1] || '';

    if (scope === 'section' || scope === 'global') {
      if (headline) {
        const hlInput = document.getElementById('hlText');
        if (hlInput) hlInput.textContent = headline;
        const preview = document.getElementById('ctrlHlPreview');
        if (preview) preview.textContent = headline;
      }
      if (body) {
        const bdInput = document.getElementById('bdText');
        if (bdInput) bdInput.textContent = body;
        const preview = document.getElementById('ctrlBdPreview');
        if (preview) preview.textContent = body;
      }
    }

    const modal = document.getElementById('scopeModal');
    if (modal) modal.hidden = true;
  }

  document.getElementById('scopeSection')?.addEventListener('click', () => {
    ingestCopy(parsedExtracted, 'section');
  });
  document.getElementById('scopeGlobal')?.addEventListener('click', () => {
    ingestCopy(parsedExtracted, 'global');
  });
  document.getElementById('scopeCancel')?.addEventListener('click', () => {
    const modal = document.getElementById('scopeModal');
    if (modal) modal.hidden = true;
  });

  document.getElementById('ctrlApplyHl')?.addEventListener('click', () => {
    const text = parsedTA?.value.trim();
    if (!text) return;
    const hlEl = document.getElementById('hlText');
    if (hlEl) hlEl.textContent = text;
    const pr = document.getElementById('ctrlHlPreview');
    if (pr) pr.textContent = text;
  });
  document.getElementById('ctrlApplyBd')?.addEventListener('click', () => {
    const text = parsedTA?.value.trim();
    if (!text) return;
    const bdEl = document.getElementById('bdText');
    if (bdEl) bdEl.textContent = text;
    const pr = document.getElementById('ctrlBdPreview');
    if (pr) pr.textContent = text;
  });

  applyAll();

  // ── Comp double-click → section focus ───────────────────
  function openSec(sec) {
    if (!sec || !sec.classList.contains('pw-sec--collapsed')) return;
    const body = sec.querySelector('.pw-sec__body');
    const tog  = sec.querySelector('.pw-sec__tog');
    sec.classList.remove('pw-sec--collapsed');
    if (tog)  tog.textContent      = '−';
    if (body) body.style.maxHeight = body.scrollHeight + 'px';
  }

  function flashSec(secId) {
    const sec = document.getElementById(secId);
    if (!sec) return;
    openSec(sec);
    sec.classList.remove('pw-sec--focused');
    // Force reflow so animation restarts if same section is clicked twice
    void sec.offsetWidth;
    sec.classList.add('pw-sec--focused');
    setTimeout(() => sec.classList.remove('pw-sec--focused'), 1400);
    // Scroll panel body to section
    const ctrlBody = document.getElementById('ctrlBody');
    if (ctrlBody) {
      const top = sec.offsetTop - ctrlBody.offsetTop - 12;
      ctrlBody.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  const compLinks = [
    { el: document.getElementById('hlText'),  secId: 'secHeadline', focusId: 'ctrlHlPreview' },
    { el: document.getElementById('bdText'),  secId: 'secBody',     focusId: 'ctrlBdPreview' },
    { el: document.getElementById('cta1El'), secId: 'secButtons',  focusId: 'cta1Text' },
    { el: document.getElementById('cta2El'), secId: 'secButtons',  focusId: 'cta2Text' },
  ];

  compLinks.forEach(({ el, secId, focusId }) => {
    if (!el) return;
    el.addEventListener('dblclick', e => {
      e.preventDefault();
      e.stopPropagation();
      compLinks.forEach(({ el: x }) => x?.classList.remove('comp-selected'));
      el.classList.add('comp-selected');
      flashSec(secId);

      // Make the element directly editable on the phone overlay
      el.contentEditable = 'true';
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);

      function commitInline() {
        el.contentEditable = 'false';
        const text = el.textContent.trim();
        // Sync back to panel input
        const panelEl = document.getElementById(focusId);
        if (panelEl) {
          if (panelEl.tagName === 'INPUT') panelEl.value = text;
          else panelEl.textContent = text;
        }
        // Sync preview if it's a headline/body
        const previewMap = { hlText: 'ctrlHlPreview', bdText: 'ctrlBdPreview' };
        if (previewMap[el.id]) {
          const pr = document.getElementById(previewMap[el.id]);
          if (pr) pr.textContent = text;
        }
      }

      el.addEventListener('blur', commitInline, { once: true });
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { el.contentEditable = 'false'; ev.preventDefault(); }
        if (ev.key === 'Enter' && (el.tagName === 'A' || !ev.shiftKey)) {
          el.blur(); ev.preventDefault();
        }
      }, { once: true });
    });
  });

  // Click anywhere else clears selection
  document.addEventListener('click', e => {
    if (!compLinks.some(({ el }) => el?.contains(e.target))) {
      compLinks.forEach(({ el }) => el?.classList.remove('comp-selected'));
    }
  });

  // ── Balaclava panel toggle ───────────────────────────────
  const panelTogBtn = document.getElementById('panelTog');
  const CLOSE_EASE  = 'cubic-bezier(0.4,0,1,1)';
  const OPEN_EASE   = 'cubic-bezier(0.16,1,0.3,1)';

  const chromeEls = () => [
    document.getElementById('backBtn'),
    document.getElementById('undoBtn'),
    document.getElementById('aiBar'),
    document.getElementById('fxKnob'),
    document.getElementById('pubCluster'),
    document.getElementById('modeToggle'),
    document.querySelector('.drv-overlay'),
  ].filter(Boolean);

  function hidePanels() {
    if (!panelsVisible) return;
    panelsVisible = false;
    panelTogBtn?.classList.add('panel-tog--panels-hidden');

    // Fade all chrome (including the KF/drv overlay)
    const allChrome = chromeEls();
    allChrome.forEach((el, i) => {
      setTimeout(() => {
        el.style.transition    = `opacity 0.26s ${CLOSE_EASE}`;
        el.style.opacity       = '0';
        el.style.pointerEvents = 'none';
      }, i * 30);
    });

    // Slide panels off their respective edges
    const pairs = [
      [shadowPanel,  -300],
      [seqPanel,      300],
      [tweakPanel,    300],
      [contentPanel,  300],
    ];
    pairs.forEach(([el, txPx], i) => {
      if (!el || parseFloat(el.style.opacity || '0') < 0.02) return;
      setTimeout(() => {
        el.style.transition    = `translate 0.36s ${CLOSE_EASE}, opacity 0.30s ${CLOSE_EASE}`;
        el.style.translate     = `${txPx}px 0`;
        el.style.opacity       = '0';
        el.style.pointerEvents = 'none';
      }, i * 52);
    });

    const maxDelay = Math.max(3 * 30, 3 * 52) + 400;
    setTimeout(() => {
      pairs.forEach(([el]) => { if (el) el.style.transition = ''; });
      chromeEls().forEach(el => { el.style.transition = ''; });
    }, maxDelay);
  }

  function showPanels() {
    if (panelsVisible) return;
    panelTogBtn?.classList.remove('panel-tog--panels-hidden');

    // Restore chrome (including the KF/drv overlay)
    const allChrome = chromeEls();
    allChrome.forEach((el, i) => {
      setTimeout(() => {
        el.style.transition    = `opacity 0.38s ${OPEN_EASE}`;
        el.style.opacity       = '';
        el.style.pointerEvents = '';
      }, i * 40);
    });

    // Slide panels back in
    const allPanels = [shadowPanel, seqPanel, tweakPanel, contentPanel].filter(Boolean);
    allPanels.forEach((el, i) => {
      setTimeout(() => {
        el.style.transition = `translate 0.54s ${OPEN_EASE}, opacity 0.48s ${OPEN_EASE}`;
        el.style.translate  = '0 0';
      }, i * 65);
    });

    panelsVisible = true;
    updatePanelVisibility();

    const maxDelay = Math.max(3 * 40, 3 * 65) + 570;
    setTimeout(() => {
      allPanels.forEach(el => { el.style.transition = ''; });
      chromeEls().forEach(el => { el.style.transition = ''; });
    }, maxDelay);
  }

  if (panelTogBtn) {
    panelTogBtn.addEventListener('click', () => {
      panelsVisible ? hidePanels() : showPanels();
    });
  }

  // Hide everything immediately on load — panelAnimSystem will hide its own overlay after building it
  initHidePanels();

  // Start with all panels hidden — only the eye button is visible
  function initHidePanels() {
    panelTogBtn?.classList.add('panel-tog--panels-hidden');
    chromeEls().forEach(el => {
      el.style.opacity       = '0';
      el.style.pointerEvents = 'none';
    });
    [seqPanel, shadowPanel, tweakPanel, contentPanel].forEach(p => {
      if (p) { p.style.opacity = '0'; p.style.pointerEvents = 'none'; }
    });
  }

  // ── Publish button ────────────────────────────────────────
  const publishBtn = document.getElementById('publishBtn');
  const publishLbl = publishBtn?.querySelector('.publish-btn__label');

  function buildPayload() {
    const cfg = window._scrollCfg || {};
    return {
      scroll:     { ph1Mult: cfg.ph1Mult??3, lensIn: cfg.lensIn??0.20, lensOut: cfg.lensOut??0.80, lensPeak: cfg.lensPeak??0.97 },
      shadow:     { x: document.getElementById('shadowX')?.value, y: document.getElementById('shadowY')?.value, blur: document.getElementById('shadowBlur')?.value, opacity: document.getElementById('shadowOpacity')?.value },
      copy:       { headline: document.getElementById('hlText')?.textContent.trim(), body: document.getElementById('bdText')?.textContent.trim(), cta1: document.getElementById('cta1El')?.textContent.trim(), cta2: document.getElementById('cta2El')?.textContent.trim() },
      typography: { hlSize: document.getElementById('hlSize')?.value, hlLineH: document.getElementById('hlLineH')?.value, hlTracking: document.getElementById('hlTracking')?.value, hlWeight: document.getElementById('hlWeight')?.value, bdSize: document.getElementById('bdSize')?.value, bdLineH: document.getElementById('bdLineH')?.value, bdTracking: document.getElementById('bdTracking')?.value, bdWeight: document.getElementById('bdWeight')?.value },
      layout:     { lockupTop: document.getElementById('lockupTop')?.value, lockupMaxW: document.getElementById('lockupMaxW')?.value, lockupPad: document.getElementById('lockupPad')?.value, lockupGap: document.getElementById('lockupGap')?.value, lockupScale: document.getElementById('lockupScale')?.value, ctaGap: document.getElementById('ctaGap')?.value, scale: document.getElementById('scaleInput')?.value, yRef: document.getElementById('yRefInput')?.value, xOff: document.getElementById('xOffInput')?.value },
      kfs:        window.__getKFs ? window.__getKFs() : null,
    };
  }
  window.__buildPayload = buildPayload;

  let pubFlashing = false;
  publishBtn?.addEventListener('click', () => {
    if (pubFlashing) return;
    pubFlashing = true;
    const payload = buildPayload();
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    // Save to version history only — does NOT overwrite live state
    window.dispatchEvent(new CustomEvent('pw:publish', { detail: payload }));
    // Brief confirmation flash, always returns to PUBLISH
    if (publishBtn && publishLbl) {
      publishBtn.classList.add('publish-btn--live');
      publishLbl.textContent = 'SAVED ✓';
      setTimeout(() => {
        publishBtn.classList.remove('publish-btn--live');
        publishLbl.textContent = 'PUBLISH';
        pubFlashing = false;
      }, 1800);
    } else {
      pubFlashing = false;
    }
  });

  // ── Push Live button ──────────────────────────────────────
  // POSTs the current payload to the local dev server, which writes
  // live.json to disk. Any browser that fetches live.json on load
  // (including after a hard refresh) will pick up the new settings.
  const pushLiveBtn = document.getElementById('pushLiveBtn');
  const pushLiveLbl = pushLiveBtn?.querySelector('.pushlive-btn__label');
  const pushLiveDot = pushLiveBtn?.querySelector('.pushlive-btn__dot');
  let   plFlashing  = false;

  function flashPushLive(cls, label, dur) {
    if (!pushLiveBtn || !pushLiveLbl) return;
    pushLiveBtn.classList.add(cls);
    pushLiveLbl.textContent = label;
    setTimeout(() => {
      pushLiveBtn.classList.remove(cls);
      pushLiveLbl.textContent = 'PUSH LIVE';
      plFlashing = false;
    }, dur);
  }

  pushLiveBtn?.addEventListener('click', () => {
    if (plFlashing) return;
    plFlashing = true;
    const payload = buildPayload();
    fetch('/push-live', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          // Draft is now committed — clear it so refresh shows the live state cleanly
          try { sessionStorage.removeItem('pw_kf_draft'); } catch(_) {}
          document.getElementById('kfDraftBanner')?.remove();
          flashPushLive('pushlive-btn--live', 'LIVE ✓', 2200);
        } else {
          flashPushLive('pushlive-btn--error', 'ERROR', 2000);
        }
      })
      .catch(() => {
        flashPushLive('pushlive-btn--error', 'NO SERVER', 2000);
      });
  });
}());

/* ─────────────────────────────────────────────────────────
   TIME MACHINE — version history, Apple-style z-depth card stack
   ───────────────────────────────────────────────────────── */
(function TimeMachine() {
  const STORAGE_KEY  = 'pw_versions_v1';
  const MAX_VERSIONS = 50;

  // ── Storage ──────────────────────────────────────────────
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }
  function save(vs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(vs)); } catch(e) { console.warn('TM save:', e); }
  }

  // ── Diff label ───────────────────────────────────────────
  function diffLabel(prevPayload, nextPayload) {
    if (!prevPayload) return 'Initial publish';
    const changes = [];
    const pc = prevPayload.copy || {}, nc = nextPayload.copy || {};
    const pt = prevPayload.typography || {}, nt = nextPayload.typography || {};
    const ps = prevPayload.scroll || {}, ns = nextPayload.scroll || {};
    if (pc.headline !== nc.headline) changes.push('headline');
    if (pc.body !== nc.body)         changes.push('body');
    if (pc.cta1 !== nc.cta1 || pc.cta2 !== nc.cta2) changes.push('CTAs');
    if (pt.hlSize !== nt.hlSize)     changes.push('headline size');
    if (pt.hlWeight !== nt.hlWeight) changes.push('weight');
    if (ps.ph1Mult !== ns.ph1Mult)   changes.push('scroll speed');
    if (!changes.length) return 'Minor tweaks';
    return changes.slice(0, 3).join(', ');
  }

  // ── Thumbnail capture — canvas composite of video + phone ──
  function captureThumb() {
    return new Promise(resolve => {
      try {
        const cvs = document.createElement('canvas');
        const TW = 340, TH = 200;
        cvs.width = TW; cvs.height = TH;
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, TW, TH);
        const vid = document.getElementById('heroVideo');
        if (vid && vid.readyState >= 2) {
          try { ctx.drawImage(vid, 0, 0, TW, TH); } catch(_) {}
        }
        const phoneEl = document.getElementById('phoneImg');
        if (phoneEl && phoneEl.complete && phoneEl.style.width) {
          const m  = phoneEl.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
          const pw = parseFloat(phoneEl.style.width) || 0;
          if (m && pw > 0) {
            const sx = TW / window.innerWidth, sy = TH / window.innerHeight;
            const px = parseFloat(m[1]) * sx, py = parseFloat(m[2]) * sy;
            const ph = pw * (phoneEl.naturalHeight / phoneEl.naturalWidth);
            try { ctx.drawImage(phoneEl, px, py, pw * sx, ph * sy); } catch(_) {}
          }
        }
        resolve(cvs.toDataURL('image/jpeg', 0.40));
      } catch(_) { resolve(null); }
    });
  }

  // ── Save on publish ───────────────────────────────────────
  window.addEventListener('pw:publish', async (e) => {
    const vs      = load();
    const prev    = vs[vs.length - 1]?.payload || null;
    const payload = e.detail;
    const screenshot = await captureThumb();
    const entry   = {
      v:       vs.length + 1,
      ts:      new Date().toISOString(),
      label:   diffLabel(prev, payload),
      payload,
      screenshot,
    };
    vs.push(entry);
    if (vs.length > MAX_VERSIONS) vs.splice(0, vs.length - MAX_VERSIONS);
    save(vs);
    updateCount();
  });

  // ── DOM ──────────────────────────────────────────────────
  const overlay     = document.getElementById('tmOverlay');
  const stage       = document.getElementById('tmStage');
  const stack       = document.getElementById('tmStack');
  const subEl       = document.getElementById('tmSub');
  const confirmEl   = document.getElementById('tmConfirm');
  const confirmMsg  = document.getElementById('tmConfirmMsg');
  const confirmOk   = document.getElementById('tmConfirmOk');
  const confirmCancel = document.getElementById('tmConfirmCancel');
  if (!overlay || !stage || !stack) return;

  let cards = [], versions = [], pendingIdx = null;
  let frontIdx = 0; // index into cards[] that is currently at front (0 = newest)
  let animRaf  = null;
  let curDepth = 0, targetDepth = 0; // fractional card index (animated)

  // ── Smooth animation loop ─────────────────────────────────
  function animTick() {
    curDepth += (targetDepth - curDepth) * 0.14;
    if (Math.abs(targetDepth - curDepth) < 0.004) { curDepth = targetDepth; animRaf = null; }
    else animRaf = requestAnimationFrame(animTick);
    applyTransforms(curDepth);
  }
  function startAnim() {
    if (!animRaf) animRaf = requestAnimationFrame(animTick);
  }

  // ── Navigate by n cards (positive = go back in time) ──────
  function navigate(delta) {
    const max = Math.max(0, cards.length - 1);
    targetDepth = Math.max(0, Math.min(max, targetDepth + delta));
    startAnim();
  }

  // ── Discrete wheel: one scroll gesture = one card ─────────
  let wheelAccum = 0, wheelCooldown = false;
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (wheelCooldown) return;
    wheelAccum += e.deltaY;
    if (Math.abs(wheelAccum) >= 30) {
      navigate(wheelAccum > 0 ? 1 : -1);
      wheelAccum = 0;
      wheelCooldown = true;
      setTimeout(() => { wheelCooldown = false; }, 380);
    }
  }, { passive: false, capture: true });

  // ── Touch swipe ───────────────────────────────────────────
  let touchStartY = 0;
  overlay.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  overlay.addEventListener('touchend',   (e) => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 30) navigate(dy > 0 ? 1 : -1);
  }, { passive: true });

  // ── Keyboard navigation ───────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft')  navigate(1);
    if (e.key === 'ArrowUp'   || e.key === 'ArrowRight') navigate(-1);
  });

  // ── Count badge ───────────────────────────────────────────
  function updateCount() {
    const n = load().length;
    if (subEl) subEl.textContent = `${n} version${n !== 1 ? 's' : ''} saved`;
  }
  updateCount();

  // ── Open / close ─────────────────────────────────────────
  function openOverlay() {
    versions = load();
    updateCount();
    curDepth = 0; targetDepth = 0;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('tm-overlay--open'));
    buildStack();
  }

  function closeOverlay() {
    overlay.classList.remove('tm-overlay--open');
    setTimeout(() => { if (!overlay.classList.contains('tm-overlay--open')) overlay.hidden = true; }, 320);
  }

  document.getElementById('historyBtn')?.addEventListener('click', openOverlay);
  document.getElementById('tmClose')?.addEventListener('click', closeOverlay);
  document.getElementById('tmPrev')?.addEventListener('click', () => navigate(-1));
  document.getElementById('tmNext')?.addEventListener('click', () => navigate(1));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) closeOverlay(); });

  // ── Build card stack ─────────────────────────────────────
  const ACCENTS = ['#5b8fff','#ff6b6b','#4ade80','#f59e0b','#c084fc','#38bdf8','#fb923c','#a3e635'];

  function buildStack() {
    stack.innerHTML = '';
    cards = [];

    const rev = [...versions].reverse(); // newest first

    if (!rev.length) {
      // No versions yet — show empty state
      const msg = document.createElement('div');
      msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.25);font:700 11px/1 -apple-system,sans-serif;letter-spacing:.2em;text-transform:uppercase;text-align:center';
      msg.innerHTML = 'NO VERSIONS YET<br><span style="font-weight:400;font-size:9px;letter-spacing:.08em;margin-top:8px;display:block">Press PUBLISH to save your first version</span>';
      stack.appendChild(msg);
      applyTransforms(0);
      return;
    }

    rev.forEach((ver, i) => {
      const card   = document.createElement('div');
      card.className = 'tm-card';

      const accent = ACCENTS[(ver.v - 1) % ACCENTS.length];

      const p      = ver.payload || {};
      const hl     = (p.copy?.headline || '').replace(/<[^>]+>/g,'') || '—';
      const scale  = p.layout?.scale  ?? '—';
      const speed  = p.scroll?.ph1Mult ?? '—';
      const hlSz   = p.typography?.hlSize ?? '—';
      const ts     = new Date(ver.ts);
      const tsStr  = ts.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' · ' +
                     ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      const hasThumb = !!ver.screenshot;

      card.innerHTML = `
        <div class="tm-card__face">
          ${hasThumb ? `<img class="tm-card__thumb" src="${ver.screenshot}" alt="">` : ''}
          <div class="tm-card__accent" style="background:${accent}"></div>
          <div class="tm-card__body${hasThumb ? ' tm-card__body--over' : ''}">
            <div class="tm-card__hl">${hl}</div>
            <div class="tm-card__pills">
              <span class="tm-card__pill">Scale ${scale}</span>
              <span class="tm-card__pill">Speed ${speed}×</span>
              <span class="tm-card__pill">HL ${hlSz}px</span>
            </div>
          </div>
          <div class="tm-card__foot${hasThumb ? ' tm-card__foot--over' : ''}">
            <span class="tm-card__ts">${tsStr}</span>
            <span class="tm-card__diff">${ver.label || 'Minor tweaks'}</span>
          </div>
          <div class="tm-card__ver" style="color:${accent}">v${ver.v}</div>
        </div>`;

      // Click any back card to bring it forward; click front card's restore btn to restore
      card.addEventListener('click', (e) => {
        if (e.target.closest('.tm-card__restore')) return; // handled separately
        const delta = i - Math.round(curDepth);
        if (delta !== 0) navigate(delta);
      });
      card.addEventListener('mouseenter', () => card.classList.add('tm-card--hovered'));
      card.addEventListener('mouseleave', () => card.classList.remove('tm-card--hovered'));

      if (i > 0) {
        const btn = document.createElement('button');
        btn.className = 'tm-card__restore';
        btn.textContent = 'RESTORE THIS VERSION';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          pendingIdx = rev.length - 1 - i; // index in original versions[]
          if (confirmMsg) confirmMsg.textContent = `Restore v${ver.v}?`;
          if (confirmEl)  confirmEl.hidden = false;
        });
        card.appendChild(btn);
      }

      stack.appendChild(card);
      cards.push(card);
    });

    applyTransforms(0);
  }

  // ── 3D transforms — Apple Time Machine z-depth stack ────
  function applyTransforms(depth) {
    const W = stage.offsetWidth  || window.innerWidth;
    const H = stage.offsetHeight || window.innerHeight - 80;
    const cardW = Math.min(680, W * 0.78);
    const cardH = cardW / 1.6;

    cards.forEach((card, i) => {
      const d      = Math.max(0, i - depth);   // how far back this card sits
      const isFront = d < 0.5;
      const scale  = Math.max(0.45, 1 - d * 0.13);
      const opac   = Math.max(0.25, 1 - d * 0.12);
      const blur   = Math.min(6,    d * 1.4);
      const tz     = -d * 180;
      const yOff   = -d * 38;   // back cards peek above front card
      const rx     = Math.min(d * 5, 22);      // lean back as card recedes
      const tx     = -cardW / 2;
      const ty     = -cardH / 2 - 28 + yOff;

      card.style.width     = `${cardW}px`;
      card.style.transform = `perspective(2000px) translate(${tx}px, ${ty}px) rotateX(${rx.toFixed(1)}deg) translateZ(${tz}px) scale(${scale})`;
      card.style.opacity   = opac;
      card.style.filter    = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : '';
      card.style.zIndex    = cards.length - i;
      card.classList.toggle('tm-card--front', isFront);
      card.classList.toggle('tm-card--near',  d > 0 && d < 2);
    });
  }

  // ── Restore ───────────────────────────────────────────────
  confirmCancel?.addEventListener('click', () => {
    if (confirmEl) confirmEl.hidden = true;
    pendingIdx = null;
  });

  confirmOk?.addEventListener('click', () => {
    if (pendingIdx === null) return;
    const vs  = load();
    const ver = vs[pendingIdx];
    if (!ver) return;
    // Save current as draft before restoring
    vs.push({
      v: vs.length + 1,
      ts: new Date().toISOString(),
      label: `Draft before restore to v${ver.v}`,
      payload: buildCurrentPayload(),
      screenshot: null,
    });
    save(vs);
    applyPayload(ver.payload);
    if (confirmEl) confirmEl.hidden = true;
    closeOverlay();
  });

  function buildCurrentPayload() {
    const cfg = window._scrollCfg || {};
    const g   = id => document.getElementById(id)?.value;
    return {
      scroll:     { ph1Mult: cfg.ph1Mult, lensIn: cfg.lensIn, lensOut: cfg.lensOut, lensPeak: cfg.lensPeak },
      shadow:     { x: g('shadowX'), y: g('shadowY'), blur: g('shadowBlur'), opacity: g('shadowOpacity') },
      copy:       { headline: document.getElementById('hlText')?.textContent.trim(), body: document.getElementById('bdText')?.textContent.trim(), cta1: document.getElementById('cta1El')?.textContent.trim(), cta2: document.getElementById('cta2El')?.textContent.trim() },
      typography: { hlSize: g('hlSize'), hlLineH: g('hlLineH'), hlTracking: g('hlTracking'), hlWeight: g('hlWeight'), bdSize: g('bdSize'), bdLineH: g('bdLineH'), bdTracking: g('bdTracking'), bdWeight: g('bdWeight') },
      layout:     { lockupTop: g('lockupTop'), lockupMaxW: g('lockupMaxW'), lockupPad: g('lockupPad'), lockupGap: g('lockupGap'), lockupScale: g('lockupScale'), ctaGap: g('ctaGap'), scale: g('scaleInput'), yRef: g('yRefInput'), xOff: g('xOffInput') },
    };
  }

  function applyPayload(p) {
    if (!p) return;
    window.__liveApplying = true;
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    if (p.typography) { ['hlSize','hlLineH','hlTracking','bdSize','bdLineH','bdTracking'].forEach(k => set(k, p.typography[k])); }
    if (p.layout)     { ['lockupTop','lockupMaxW','lockupPad','lockupGap','lockupScale','ctaGap'].forEach(k => set(k, p.layout[k])); }
    if (p.layout?.scale != null) { set('scaleInput', p.layout.scale); set('yRefInput', p.layout.yRef); set('xOffInput', p.layout.xOff); }
    if (p.shadow)     { ['shadowBlur','shadowOpacity'].forEach(k => set(k, p.shadow[k])); set('shadowX', p.shadow.x); set('shadowY', p.shadow.y); }
    if (p.copy) {
      const hl=document.getElementById('hlText'), bd=document.getElementById('bdText');
      const p1=document.getElementById('ctrlHlPreview'), p2=document.getElementById('ctrlBdPreview');
      if (hl&&p.copy.headline){hl.textContent=p.copy.headline; if(p1)p1.textContent=p.copy.headline;}
      if (bd&&p.copy.body){bd.textContent=p.copy.body; if(p2)p2.textContent=p.copy.body;}
      const c1=document.getElementById('cta1El'); if(c1&&p.copy.cta1)c1.textContent=p.copy.cta1;
      const c2=document.getElementById('cta2El'); if(c2&&p.copy.cta2)c2.textContent=p.copy.cta2;
    }
    if (p.scroll && window._scrollCfg) { Object.assign(window._scrollCfg, p.scroll); window.dispatchEvent(new Event('scroll')); }
    window.__liveApplying = false;
    if (p.kfs && window.__applyKFs) window.__applyKFs(p.kfs);
  }

  window.addEventListener('pw:publish', updateCount);

  // ── Undo stack (20 steps, session-only) ──────────────────
  const undoStack = [];
  const UNDO_MAX  = 20;
  let   _preSnap  = null;
  const undoBtn   = document.getElementById('undoBtn');

  function setUndoBtn() {
    if (!undoBtn) return;
    undoBtn.disabled = undoStack.length === 0;
  }

  function pushUndo(snap) {
    undoStack.push(snap);
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    setUndoBtn();
  }

  function doUndo() {
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    applyPayload(snap);
    if (snap.kfs && window.__applyKFs) window.__applyKFs(snap.kfs);
    setUndoBtn();
  }

  // Snapshot before any panel interaction begins
  document.addEventListener('mousedown', e => {
    if (e.target.closest('.pw-panel') && window.__buildPayload) {
      _preSnap = window.__buildPayload();
    }
  }, true);

  // Commit snapshot after a value actually changes
  document.addEventListener('change', e => {
    if (e.target.closest('.pw-panel') && _preSnap) {
      pushUndo(_preSnap);
      _preSnap = null;
    }
  }, true);

  // Segment controls fire click not change
  document.addEventListener('click', e => {
    if (e.target.closest('.pw-seg__btn') && e.target.closest('.pw-panel') && _preSnap) {
      pushUndo(_preSnap);
      _preSnap = null;
    }
  }, true);

  undoBtn?.addEventListener('click', doUndo);

  document.getElementById('backBtn')?.addEventListener('click', () => {
    if (window.history.length > 1) history.back();
    else window.close();
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      doUndo();
    }
  });

  // Clear any stale pw_live localStorage from old sessions
  try { localStorage.removeItem('pw_live'); } catch(_) {}

  // ── KF Draft banner ──────────────────────────────────────
  // Shows after page load when sessionStorage has unsaved KF work.
  // Refresh reverts to live.json; this banner lets the user decide
  // whether to restore their draft or discard it.
  function showKFDraftBanner() {
    if (document.getElementById('kfDraftBanner')) return;
    let draft;
    try { draft = JSON.parse(sessionStorage.getItem('pw_kf_draft') || 'null'); } catch(_) {}
    if (!draft || !Object.keys(draft).length) return;

    const banner = document.createElement('div');
    banner.id = 'kfDraftBanner';
    banner.className = 'kf-draft-banner';
    banner.innerHTML =
      '<span class="kf-draft-banner__label">◆ KF DRAFT</span>'
      + '<button class="kf-draft-banner__load" id="kfDraftLoad">Load</button>'
      + '<button class="kf-draft-banner__discard" id="kfDraftDiscard">✕</button>';
    document.body.appendChild(banner);

    document.getElementById('kfDraftLoad')?.addEventListener('click', () => {
      if (window.__restoreKFDraft) window.__restoreKFDraft();
      banner.remove();
    });
    document.getElementById('kfDraftDiscard')?.addEventListener('click', () => {
      if (window.__clearKFDraft) window.__clearKFDraft();
      banner.remove();
    });
  }

  // Apply live state on page load — only from server live.json, never localStorage
  fetch('/live.json')
    .then(r => r.ok ? r.json() : null)
    .then(live => {
      if (live) applyPayload(live);
      setTimeout(showKFDraftBanner, 0);  // after all IIFEs have run
    })
    .catch(() => {
      setTimeout(showKFDraftBanner, 0);
    });
}());

/* ─────────────────────────────────────────────────────────
   AI PROMPT BAR — talks directly to Claude to edit panels
   ───────────────────────────────────────────────────────── */
(function AIBar() {
  const KEY_STORE = 'pw_anthropic_key';

  const bar    = document.getElementById('aiBar');
  const glass  = bar ? bar.querySelector('.ai-bar__glass') : null;
  const input  = document.getElementById('aiInput');
  const send   = document.getElementById('aiSend');
  const barCvs = document.getElementById('aiCanvas');
  const gCvs   = document.getElementById('globalCanvas');
  const prog   = document.getElementById('aiProgress');
  if (!bar || !input || !send || !glass) return;

  // ── Open/close state ──────────────────────────────────
  let barOpen    = false;
  let prevGlassW = 56;

  // SVG path coord endpoints (all M x1 y1 L x2 y2)
  const PLUS_L  = [2,   7.5, 7.5, 7.5];  // left arm of +
  const PLUS_R  = [7.5, 7.5, 13,  7.5];  // right arm of +
  const ARROW_L = [2.5, 6.5, 7.5, 2  ];  // left arm of ↑
  const ARROW_R = [7.5, 2,   12.5,6.5];  // right arm of ↑

  const miLeft  = glass.querySelector('.ai-bar__mi-left');
  const miRight = glass.querySelector('.ai-bar__mi-right');
  const miStem  = glass.querySelector('.ai-bar__mi-stem');

  // Time-based icon morph — easeOutExpo, no bounce
  let morphTarget   = 0;   // 0 = plus, 1 = arrow
  let morphCurVal   = 0;
  let morphStartVal = 0;
  let morphStartTs  = 0;
  const MORPH_DUR   = 360; // ms

  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function tickMorph(ts) {
    const elapsed = ts - morphStartTs;
    const raw = elapsed >= MORPH_DUR ? 1 : elapsed / MORPH_DUR;
    morphCurVal = morphStartVal + (morphTarget - morphStartVal) * easeOutExpo(raw);
    const mt = morphCurVal;

    if (miLeft) {
      miLeft.setAttribute('d', `M ${lerp(PLUS_L[0],ARROW_L[0],mt).toFixed(2)} ${lerp(PLUS_L[1],ARROW_L[1],mt).toFixed(2)} L ${lerp(PLUS_L[2],ARROW_L[2],mt).toFixed(2)} ${lerp(PLUS_L[3],ARROW_L[3],mt).toFixed(2)}`);
    }
    if (miRight) {
      miRight.setAttribute('d', `M ${lerp(PLUS_R[0],ARROW_R[0],mt).toFixed(2)} ${lerp(PLUS_R[1],ARROW_R[1],mt).toFixed(2)} L ${lerp(PLUS_R[2],ARROW_R[2],mt).toFixed(2)} ${lerp(PLUS_R[3],ARROW_R[3],mt).toFixed(2)}`);
    }
    if (miStem) miStem.setAttribute('d', 'M 7.5 13 L 7.5 2');
  }

  // Burst from the final pill endpoints immediately on click —
  // the glass spring catches up to meet the particles
  function emitExplosion() {
    const cvR    = barCvs.getBoundingClientRect();
    const barR   = bar.getBoundingClientRect();  // wrapper = final pill width
    const leftX  = barR.left  - cvR.left;        // = BLEED
    const rightX = barR.right - cvR.left;        // = BLEED + full width
    const midY   = barR.top + barR.height * 0.5 - cvR.top;

    function burstEdge(fromX, dirSign, n) {
      for (let i = 0; i < n; i++) {
        const ang = (Math.random() - 0.5) * Math.PI * 0.80;  // ±72° cone
        const spd = 5.5 + Math.random() * 10;
        const p   = mkDust(1.4, 0.9);
        p.x  = fromX + dirSign * (Math.random() * 4);
        p.y  = midY  + (Math.random() - 0.5) * 20;
        p.vx = dirSign * Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd - 2.2;   // bias upward
        p.r  = 0.9 + Math.random() * 3.0;
        p.ta = 0.62 + Math.random() * 0.34;
        pool.push(p);
      }
    }

    burstEdge(leftX,  -1, 38);
    burstEdge(rightX,  1, 38);
    emitRing(20, 1.3, 1.0);
  }

  function openBar() {
    if (barOpen) return;
    barOpen = true;
    morphStartVal = morphCurVal;
    morphStartTs  = performance.now();
    morphTarget   = 1;
    bar.classList.remove('ai-bar--collapsed');
    bar.classList.add('ai-bar--expanded', 'ai-bar--hovered');
    hoverEnergy = 1.0;
    nextBeat    = 0;
    emitExplosion();
    setTimeout(() => input.focus(), 360);
  }

  function closeBar() {
    if (!barOpen) return;
    barOpen = false;
    morphStartVal = morphCurVal;
    morphStartTs  = performance.now();
    morphTarget   = 0;
    bar.classList.remove('ai-bar--expanded', 'ai-bar--hovered');
    bar.classList.add('ai-bar--collapsed');
    input.blur();
    emitRing(16, 0.7, 0.75);
  }

  // Scroll collapses the bar back to circle
  window.addEventListener('scroll', () => {
    if (barOpen) closeBar();
  }, { passive: true });

  glass.addEventListener('click', (e) => {
    if (!barOpen) { openBar(); e.stopPropagation(); }
  });

  // ═══════════════════════════════════════════════════════
  //  SHARED MOUSE STATE
  // ═══════════════════════════════════════════════════════
  let mRawX = window.innerWidth / 2,  mRawY = window.innerHeight / 2;
  let mLerpX = mRawX, mLerpY = mRawY;   // smoothed for glow
  let mPrevX = mRawX, mPrevY = mRawY;   // prev frame for velocity
  let mVX = 0, mVY = 0;                 // cursor velocity
  document.addEventListener('mousemove', e => {
    mRawX = e.clientX; mRawY = e.clientY;
    // AI bar rim hot-spot
    const gr = glass.getBoundingClientRect();
    glass.style.setProperty('--rim-x', ((e.clientX - gr.left) / gr.width  * 100).toFixed(1) + '%');
    glass.style.setProperty('--rim-y', ((e.clientY - gr.top)  / gr.height * 100).toFixed(1) + '%');
    // Panel rim hot-spots
    document.querySelectorAll('.pw-panel').forEach(panel => {
      const pr = panel.getBoundingClientRect();
      panel.style.setProperty('--rim-x', ((e.clientX - pr.left) / pr.width  * 100).toFixed(1) + '%');
      panel.style.setProperty('--rim-y', ((e.clientY - pr.top)  / pr.height * 100).toFixed(1) + '%');
    });
  });

  // Panel hover rim — add/remove class to reveal ::after glow
  document.querySelectorAll('.pw-panel').forEach(panel => {
    panel.addEventListener('mouseenter', () => panel.classList.add('pw-panel--hovered'));
    panel.addEventListener('mouseleave', () => panel.classList.remove('pw-panel--hovered'));
  });

  // ── Panel resize — drag lower-right or lower-left corner ──
  document.querySelectorAll('.pw-panel').forEach(panel => {
    const scrollBody = panel.querySelector('.pw-panel__body--scroll');

    ['right','left'].forEach(side => {
      const handle = document.createElement('div');
      handle.className = `pw-panel__resize pw-panel__resize--${side}`;
      handle.title = 'Drag to resize';
      panel.appendChild(handle);

      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        const startX   = e.clientX;
        const startY   = e.clientY;
        const startW   = panel.offsetWidth;
        const startH   = panel.offsetHeight;
        const hdrH     = panel.querySelector('.pw-panel__hdr')?.offsetHeight ?? 46;

        // Measure the panel's natural content height with all clamps lifted,
        // then restore. This becomes the upper bound during drag so the user
        // can't grow the panel past what its content actually needs.
        const prevPanelH  = panel.style.height;
        const prevBodyMax = scrollBody ? scrollBody.style.maxHeight : null;
        panel.style.height = 'auto';
        if (scrollBody) scrollBody.style.maxHeight = 'none';
        const naturalH = panel.offsetHeight;
        panel.style.height = prevPanelH;
        if (scrollBody) scrollBody.style.maxHeight = prevBodyMax;

        function onMove(ev) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          const newW = Math.max(220, Math.min(600, side === 'left' ? startW - dx : startW + dx));
          const maxH = Math.min(window.innerHeight - 80, naturalH);
          const newH = Math.max(120, Math.min(maxH, startH + dy));
          panel.style.width  = `${newW}px`;
          panel.style.height = `${newH}px`;
          if (scrollBody) scrollBody.style.maxHeight = `${Math.max(60, newH - hdrH - 8)}px`;
        }

        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  //  FX KNOB — blue dot on outer ring + piano cascade lines
  // ═══════════════════════════════════════════════════════
  let effectIntensity = 0.5;
  let knobScrollCascade = 0; // 0-1, updated by scroll

  const knobEl  = document.getElementById('fxKnob');
  const knobCvs = document.getElementById('fxKnobCanvas');

  if (knobEl && knobCvs) {
    const kCtx = knobCvs.getContext('2d');
    const DPR  = Math.min(window.devicePixelRatio || 1, 2);

    // Canvas is larger than the 56px button so cascade lines can extend outward
    const SZ   = 120;
    const BTN  = 56;  // actual button diameter
    knobCvs.width  = SZ * DPR;
    knobCvs.height = SZ * DPR;
    kCtx.scale(DPR, DPR);

    const KCX = SZ / 2, KCY = SZ / 2;  // canvas center = button center

    // Dot orbits at button rim (button radius = 28px)
    const DOT_R    = 26;   // outermost ring — right at the button edge
    const TICKS    = 12;
    const START_DEG  = 120;
    const RANGE_DEG  = 300;
    const TRAIL_LIFE = 1400;

    // Cascade lines — radial spokes extending beyond button edge
    const CASCADE_N     = 24;
    const CASCADE_R_IN  = 32;   // starts just outside the button rim
    const CASCADE_R_OUT = 50;   // maximum extension length
    const CASCADE_STAGGER = 36; // ms between each line in hover burst

    const trail = [];
    // Per-line cascade animation state: t (0-1 normalized progress), active
    const cascLines = Array.from({ length: CASCADE_N }, () => ({ t: -1, baseOpacity: 0 }));
    let cascHovering = false;

    // Trigger sequential outward burst on hover
    function fireCascade() {
      cascLines.forEach((c, i) => {
        setTimeout(() => { c.t = 0; }, i * CASCADE_STAGGER);
      });
    }

    knobEl.addEventListener('mouseenter', () => {
      cascHovering = true;
      fireCascade();
    });
    knobEl.addEventListener('mouseleave', () => {
      cascHovering = false;
      cascLines.forEach(c => { c.t = -1; });
    });

    let kDragging = false, kCenterX = 0, kCenterY = 0;
    let kStartAngle = 0, kStartIntensity = 0;

    function iToRad(v) {
      return ((START_DEG + v * RANGE_DEG) * Math.PI) / 180;
    }

    function kDraw(now) {
      kCtx.clearRect(0, 0, SZ, SZ);

      const curRad = iToRad(effectIntensity);
      const scrollVis = knobScrollCascade; // 0-1 from scroll

      // ── Piano cascade lines ───────────────────────────────
      for (let i = 0; i < CASCADE_N; i++) {
        const c     = cascLines[i];
        const angle = (i / CASCADE_N) * Math.PI * 2 - Math.PI / 2;

        // Advance animation
        if (c.t >= 0 && c.t < 1) {
          c.t = Math.min(c.t + 0.028, 1);
        }

        // Animated burst: extend outward then fade
        let burstLen   = 0;
        let burstAlpha = 0;
        if (c.t >= 0) {
          burstLen   = Math.sin(c.t * Math.PI);          // 0→1→0
          burstAlpha = (1 - c.t) * 0.92;
        }

        // Normalize both angles to [0, 2π] before computing angular distance
        const TAU     = Math.PI * 2;
        const normCur = ((curRad % TAU) + TAU) % TAU;
        const normAng = ((angle  % TAU) + TAU) % TAU;
        const rawDiff = Math.abs(normAng - normCur);
        const angDist = Math.min(rawDiff, TAU - rawDiff); // 0 → π

        // Sustained hover glow: proximity to dot, no extension
        let hoverAlpha = 0;
        if (cascHovering && c.t >= 1) {
          const ARC  = Math.PI * 0.55;
          hoverAlpha = Math.max(0, 0.42 * Math.pow(1 - Math.min(1, angDist / ARC), 2));
        }

        // Drag extension: lines near the dot extend outward, fading with angular distance
        let dragLen = 0, dragAlpha = 0;
        if (kDragging) {
          const ARC  = Math.PI * 0.45;              // ±81° arc around dot
          const prox = Math.max(0, 1 - Math.pow(Math.min(1, angDist / ARC), 1.8));
          dragLen    = prox;
          dragAlpha  = 0.70 * prox;
        }

        const totalAlpha = Math.max(burstAlpha, hoverAlpha, dragAlpha);
        if (totalAlpha < 0.01) continue;

        const rIn  = CASCADE_R_IN;
        const rOut = CASCADE_R_IN + (CASCADE_R_OUT - CASCADE_R_IN) * Math.max(burstLen, dragLen);

        const x1 = KCX + Math.cos(angle) * rIn;
        const y1 = KCY + Math.sin(angle) * rIn;
        const x2 = KCX + Math.cos(angle) * rOut;
        const y2 = KCY + Math.sin(angle) * rOut;

        kCtx.beginPath();
        kCtx.moveTo(x1, y1);
        kCtx.lineTo(x2, y2);
        kCtx.strokeStyle = `rgba(120,185,210,${totalAlpha})`;
        kCtx.lineWidth   = 0.7;
        kCtx.lineCap     = 'round';
        kCtx.stroke();
      }

      // ── Trail dots on outer ring ─────────────────────────
      const cutoff = now - TRAIL_LIFE;
      for (let i = trail.length - 1; i >= 0; i--) {
        const dot = trail[i];
        if (dot.born < cutoff) { trail.splice(i, 1); continue; }
        const t  = 1 - (now - dot.born) / TRAIL_LIFE;
        const dx = KCX + Math.cos(dot.angle) * DOT_R;
        const dy = KCY + Math.sin(dot.angle) * DOT_R;
        kCtx.beginPath();
        kCtx.arc(dx, dy, 1.4, 0, Math.PI * 2);
        kCtx.fillStyle = `rgba(120,185,210,${t * 0.55})`;
        kCtx.fill();
      }

      // ── Position dot on outermost ring ───────────────────
      const dotX = KCX + Math.cos(curRad) * DOT_R;
      const dotY = KCY + Math.sin(curRad) * DOT_R;
      // Glow halo
      kCtx.beginPath();
      kCtx.arc(dotX, dotY, 4.5, 0, Math.PI * 2);
      kCtx.fillStyle = 'rgba(120,185,210,0.18)';
      kCtx.fill();
      // Core dot
      kCtx.beginPath();
      kCtx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      kCtx.fillStyle = 'rgba(140,195,218,0.92)';
      kCtx.fill();

      requestAnimationFrame(ts => kDraw(ts));
    }

    function checkTrail(prev, next, now) {
      const step = 1 / TICKS;
      const lo = Math.min(prev, next), hi = Math.max(prev, next);
      for (let i = 0; i <= TICKS; i++) {
        const b = i * step;
        if (b > lo && b <= hi) trail.push({ angle: iToRad(b), born: now });
      }
    }

    // Update scroll-driven cascade visibility
    window.addEventListener('scroll', () => {
      knobScrollCascade = Math.min(1, Math.max(0, (window.scrollY - 400) / 1800));
    }, { passive: true });

    knobEl.addEventListener('mousedown', e => {
      const rect  = knobEl.getBoundingClientRect();
      kCenterX    = rect.left + rect.width  / 2;
      kCenterY    = rect.top  + rect.height / 2;
      kStartAngle = Math.atan2(e.clientY - kCenterY, e.clientX - kCenterX);
      kStartIntensity = effectIntensity;
      kDragging   = true;
      knobEl.classList.add('fx-knob--dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!kDragging) return;
      const prev = effectIntensity;
      let delta  = Math.atan2(e.clientY - kCenterY, e.clientX - kCenterX) - kStartAngle;
      if (delta >  Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      effectIntensity = Math.max(0, Math.min(1, kStartIntensity + delta / (RANGE_DEG * Math.PI / 180)));
      checkTrail(prev, effectIntensity, performance.now());
    });

    document.addEventListener('mouseup', () => {
      if (!kDragging) return;
      kDragging = false;
      knobEl.classList.remove('fx-knob--dragging');
    });

    requestAnimationFrame(ts => kDraw(ts));
  }

  // ═══════════════════════════════════════════════════════
  //  GLOBAL MOUSE GLOW CANVAS
  // ═══════════════════════════════════════════════════════
  const gc = gCvs ? gCvs.getContext('2d') : null;
  function resizeGlobal() {
    if (!gCvs) return;
    gCvs.width  = window.innerWidth;
    gCvs.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeGlobal);
  resizeGlobal();

  function tickGlobal() {
    if (!gc || !gCvs.width) return;
    // Lerp cursor
    mLerpX += (mRawX - mLerpX) * 0.055;
    mLerpY += (mRawY - mLerpY) * 0.055;
    mVX = mRawX - mPrevX; mVY = mRawY - mPrevY;
    mPrevX = mRawX; mPrevY = mRawY;
    const spd = Math.hypot(mVX, mVY);

    gc.clearRect(0, 0, gCvs.width, gCvs.height);

    // Primary glow at cursor — brightens with movement
    const fxM = effectIntensity * 2; // 0=off, 1.0=default (at slider mid), 2.0=max
    const intensity = (0.015 + Math.min(spd * 0.0007, 0.013)) * fxM;
    const g1 = gc.createRadialGradient(mLerpX, mLerpY, 0, mLerpX, mLerpY, 420);
    g1.addColorStop(0,   `rgba(50,210,255,${intensity})`);
    g1.addColorStop(0.4, `rgba(110,60,220,${Math.min(intensity * 0.55, 1)})`);
    g1.addColorStop(1,   'rgba(0,0,0,0)');
    gc.fillStyle = g1;
    gc.fillRect(0, 0, gCvs.width, gCvs.height);

    // Secondary ambient aurora — shifts laterally with mouse X
    const ax = gCvs.width * (0.5 + (mLerpX / gCvs.width - 0.5) * 0.38);
    const g2 = gc.createRadialGradient(ax, gCvs.height * 0.88, 0, gCvs.width * 0.5, gCvs.height, Math.max(gCvs.width, gCvs.height) * 0.72);
    g2.addColorStop(0,   `rgba(36,190,255,${(0.010 * fxM).toFixed(4)})`);
    g2.addColorStop(0.5, `rgba(130,50,220,${(0.007 * fxM).toFixed(4)})`);
    g2.addColorStop(1,   'rgba(0,0,0,0)');
    gc.fillStyle = g2;
    gc.fillRect(0, 0, gCvs.width, gCvs.height);
  }

  // ═══════════════════════════════════════════════════════
  //  MICRO-DUST PARTICLE SYSTEM
  // ═══════════════════════════════════════════════════════
  const bc   = barCvs ? barCvs.getContext('2d') : null;
  const pool = [];
  const BLEED = 80;  // canvas extends 80px beyond bar edges
  const DHUES = [185, 198, 215, 248, 268, 286, 172, 55];

  let nextBeat = 0, echoAt = 0, isLoading = false;
  let hoverEnergy = 0; // 0 → 1 lerp, decays after mouseenter burst

  // ── Perimeter comet — always-on rim stroke ────────────────
  // Head and tail track independently; tail is ~2× slower so the
  // gap between them grows naturally until it hits the max cap.
  // lineDashOffset formula: segLen - cometHead places the
  // END (head) of the dash at cometHead along the perimeter.
  let cometHead = 0;   // px along perimeter
  let cometTail = 0;   // px — always behind head

  function drawPerimComet(dt) {
    if (!bc || !barCvs.width) return;

    const cvR = barCvs.getBoundingClientRect();
    const glR = glass.getBoundingClientRect();
    const bx  = glR.left - cvR.left;
    const by  = glR.top  - cvR.top;
    const bw  = glR.width, bh = glR.height;
    if (bw < 10 || bh < 10) return;
    const cr = Math.min(28, Math.floor(bh / 2));

    const perim = 2 * (bw - 2*cr) + 2 * (bh - 2*cr) + 2 * Math.PI * cr;

    // Head: ~1 rev per 4.5 s.  Tail: ~1 rev per 9 s — gap grows naturally.
    cometHead = (cometHead + (perim / 4500) * dt) % perim;
    cometTail = (cometTail + (perim / 9000) * dt) % perim;

    // Cap the gap at 72 % of perimeter so tail never falls a full loop behind
    const gap = ((cometHead - cometTail) + perim) % perim;
    if (gap > perim * 0.72) cometTail = (cometHead - perim * 0.72 + perim) % perim;

    const fxM = effectIntensity * 2;
    // Loading: full 1.0 (comet IS the loading indicator)
    // Hovered: reactive to hoverEnergy (1.0 fresh, decays to 0)
    // Idle: near-zero
    const stateBoost = isLoading ? 1.0 : Math.max(0.04, hoverEnergy);
    const baseA = stateBoost * fxM;
    if (baseA < 0.01) return;

    function rrPath() {
      bc.beginPath();
      bc.moveTo(bx + cr, by);
      bc.arcTo(bx + bw, by,      bx + bw, by + bh, cr);
      bc.arcTo(bx + bw, by + bh, bx,      by + bh, cr);
      bc.arcTo(bx,      by + bh, bx,      by,      cr);
      bc.arcTo(bx,      by,      bx + bw, by,      cr);
      bc.closePath();
    }

    bc.save();

    // Pass 0 — faint always-visible track on entire pill border
    rrPath();
    bc.setLineDash([]);
    bc.strokeStyle = `rgba(40,180,240,${Math.min(0.045 * baseA, 1)})`;
    bc.lineWidth   = 1.0;
    bc.shadowBlur  = 0;
    bc.stroke();

    // Gradient passes: short segments, each stacking from tail → head.
    // [gapFraction, alphaMultiplier, lineWidth, shadowBlur, rgb]
    const passes = [
      [0.92, 0.08, 1.2,  0,  [28,  155, 225]],  // ghostly long tail
      [0.62, 0.17, 1.6,  0,  [35,  178, 240]],  // dim body
      [0.36, 0.36, 2.0,  6,  [42,  200, 255]],  // mid — first visible glow
      [0.15, 0.65, 2.5, 14,  [70,  225, 255]],  // inner — getting bright
      [0.06, 0.90, 2.2, 22,  [160, 245, 255]],  // near-head flash
      [0.02, 1.00, 1.8, 32,  [220, 255, 255]],  // tip — near-white hot
    ];

    for (const [frac, am, lw, blur, [r, g, b]] of passes) {
      const segLen = gap * frac;
      if (segLen < 1) continue;

      rrPath();
      bc.strokeStyle    = `rgba(${r},${g},${b},${Math.min(am * baseA, 1)})`;
      bc.lineWidth      = lw;
      bc.shadowBlur     = blur;
      bc.shadowColor    = `rgba(${r},${g},${b},${Math.min(am * baseA * 0.7, 1)})`;
      bc.setLineDash([segLen, perim - segLen]);
      bc.lineDashOffset = segLen - cometHead;
      bc.stroke();
      bc.shadowBlur     = 0;
    }

    bc.setLineDash([]);
    bc.restore();
  }

  // ── Sample a point on the rounded-rect perimeter ──────
  function perimPt(bx, by, bw, bh, br) {
    const tLen = bw - 2*br, rLen = bh - 2*br;
    const cLen = Math.PI * 0.5 * br;
    const total = 2*(tLen + rLen) + 4*cLen;
    let d = Math.random() * total;

    if (d < tLen)  return { x: bx + br + d,       y: by,       nx:  0, ny: -1 }; d -= tLen;
    if (d < cLen)  { const a = -Math.PI/2 + d/br;  return { x: bx+bw-br+Math.cos(a)*br, y: by+br+Math.sin(a)*br, nx: Math.cos(a), ny: Math.sin(a) }; } d -= cLen;
    if (d < rLen)  return { x: bx + bw,            y: by+br+d,  nx:  1, ny:  0 }; d -= rLen;
    if (d < cLen)  { const a = d/br;               return { x: bx+bw-br+Math.cos(a)*br, y: by+bh-br+Math.sin(a)*br, nx: Math.cos(a), ny: Math.sin(a) }; } d -= cLen;
    if (d < tLen)  return { x: bx+bw-br-d,         y: by+bh,    nx:  0, ny:  1 }; d -= tLen;
    if (d < cLen)  { const a = Math.PI/2 + d/br;   return { x: bx+br+Math.cos(a)*br, y: by+bh-br+Math.sin(a)*br, nx: Math.cos(a), ny: Math.sin(a) }; } d -= cLen;
    if (d < rLen)  return { x: bx,                 y: by+bh-br-d, nx: -1, ny:  0 }; d -= rLen;
    const a = Math.PI + d/br;
    return { x: bx+br+Math.cos(a)*br, y: by+br+Math.sin(a)*br, nx: Math.cos(a), ny: Math.sin(a) };
  }

  function mkDust(sM, lM) {
    const cvR = barCvs.getBoundingClientRect();
    const glR = glass.getBoundingClientRect();
    const gx  = glR.left - cvR.left;
    const gy  = glR.top  - cvR.top;
    const cr  = Math.min(28, Math.round(glR.height / 2));
    const pt  = perimPt(gx, gy, glR.width, glR.height, cr);
    const out = (0.18 + Math.random() * 0.72) * sM;
    const tan = (Math.random() - 0.5) * 0.22;
    return {
      x:  pt.x + (Math.random() - 0.5) * 2,
      y:  pt.y + (Math.random() - 0.5) * 2,
      vx: pt.nx * out + (-pt.ny) * tan,
      vy: pt.ny * out + pt.nx  * tan,
      r:  0.28 + Math.random() * 1.32,      // micro: max ~1.6px
      a:  0,
      ta: 0.22 + Math.random() * 0.55,
      h:  DHUES[Math.floor(Math.random() * DHUES.length)],
      s:  28 + Math.random() * 52,
      l:  68 + Math.random() * 28,
      z:  0.28 + Math.random() * 0.72,
      vz: (Math.random() - 0.5) * 0.009,
      drag: 0.991 + Math.random() * 0.006,
      life: 0,
      maxLife: (110 + Math.random() * 190) * lM,
      po: Math.random() * Math.PI * 2,
      pf: 0.014 + Math.random() * 0.026,
      mode: 'emit',
      dead: false,
    };
  }

  function emitRing(n, sM, lM) {
    for (let i = 0; i < n; i++) pool.push(mkDust(sM, lM));
    // Dust fill — 3× count, tiny, wider scatter, shorter-lived
    const nd = Math.ceil(n * 3);
    for (let i = 0; i < nd; i++) {
      const p  = mkDust(sM * 0.55, lM * 0.50);
      p.r      = 0.10 + Math.random() * 0.36;   // micro: 0.10–0.46px
      p.z      = 0.80 + Math.random() * 0.20;   // high z keeps them visible
      p.ta     = 0.12 + Math.random() * 0.32;   // dimmer peak
      p.drag   = 0.984 + Math.random() * 0.010;
      // Wider tangential spread so they fill gaps between primaries
      const tan = (Math.random() - 0.5) * 0.60;
      const nx  = p.vx / (Math.hypot(p.vx, p.vy) || 1);
      const ny  = p.vy / (Math.hypot(p.vx, p.vy) || 1);
      const spd = Math.hypot(p.vx, p.vy);
      p.vx = nx * spd + (-ny) * tan;
      p.vy = ny * spd +   nx  * tan;
      pool.push(p);
    }
  }

  // Heartbeat: lub at ts, dub 220ms later, repeats
  function checkHeartbeat(ts) {
    const fxN = Math.ceil(effectIntensity * 2); // 0→0 particles at off, 1→mid count, 2→double
    if (ts >= nextBeat) {
      if (fxN > 0) emitRing(Math.ceil(42 * effectIntensity * 2), 1.0, 1.0); // lub
      echoAt   = ts + 220;
      nextBeat = ts + 1500;
    }
    if (echoAt > 0 && ts >= echoAt) {
      if (fxN > 0) emitRing(Math.ceil(28 * effectIntensity * 2), 0.62, 0.80); // dub
      echoAt = 0;
    }
  }

  function getSendOrigin() {
    const sr = send.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    return { x: sr.left + sr.width*0.5 - br.left + BLEED, y: sr.top + sr.height*0.5 - br.top + BLEED };
  }

  function absorbAll() {
    pool.forEach(p => { if (p.mode === 'emit') p.mode = 'absorb'; });
  }

  function emitBurst() {
    const so = getSendOrigin();
    for (let i = 0; i < 55; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.8 + Math.random() * 5.2;
      const p   = mkDust(1, 0.5);
      p.x = so.x + (Math.random() - 0.5) * 8;
      p.y = so.y + (Math.random() - 0.5) * 8;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 0.5;
      p.r  = 0.5 + Math.random() * 1.8;
      p.ta = 0.55 + Math.random() * 0.40;
      pool.push(p);
    }
  }

  function resizeBar() {
    if (!barCvs) return;
    const r = bar.getBoundingClientRect();
    barCvs.width  = r.width  + BLEED * 2;
    barCvs.height = r.height + BLEED * 2;
  }
  new ResizeObserver(resizeBar).observe(bar);
  resizeBar();

  function tickBar(ts, dt) {
    if (!bc || !barCvs.width) return;
    bc.clearRect(0, 0, barCvs.width, barCvs.height);

    // Decay hover energy (~2s half-life)
    hoverEnergy = Math.max(0, hoverEnergy - 0.008);

    // Glass-expansion edge push: expanding edges push nearby particles outward
    const cvR    = barCvs.getBoundingClientRect();
    const glR    = glass.getBoundingClientRect();
    const curGlW = glR.width;
    const glVel  = curGlW - prevGlassW;   // px/frame — positive = expanding
    prevGlassW   = curGlW;
    if (Math.abs(glVel) > 0.25) {
      const leftX  = glR.left  - cvR.left;
      const rightX = glR.right - cvR.left;
      const pushR  = 88;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (p.mode !== 'emit' || p.dead) continue;
        const drR = Math.abs(p.x - rightX);
        const drL = Math.abs(p.x - leftX);
        if (drR < pushR) p.vx += glVel * 0.42 * (1 - drR / pushR);
        if (drL < pushR) p.vx -= glVel * 0.42 * (1 - drL / pushR);
      }
    }

    // Mouse in bar canvas coords
    const canvRect = barCvs.getBoundingClientRect();
    const cmx = mRawX - canvRect.left;
    const cmy = mRawY - canvRect.top;

    const so = getSendOrigin();

    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      if (p.dead) { pool.splice(i, 1); continue; }

      p.life++;
      p.po += p.pf;

      if (p.mode === 'emit') {
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy -= 0.005;  // gentle float upward

        // Mouse disturbance — repel + transfer velocity; hoverEnergy boosts radius + force
        const dmx = p.x - cmx, dmy = p.y - cmy;
        const dm  = Math.hypot(dmx, dmy);
        const distR = 140 + hoverEnergy * 90;
        const distF = 0.048 + hoverEnergy * 0.038;
        if (dm < distR && dm > 1) {
          const f = ((distR - dm) / distR) * distF;
          p.vx += (dmx / dm) * f + mVX * (0.028 + hoverEnergy * 0.022);
          p.vy += (dmy / dm) * f + mVY * (0.028 + hoverEnergy * 0.022);
        }

        p.x += p.vx; p.y += p.vy;
        p.z  = Math.max(0.15, Math.min(1, p.z + p.vz));

        const t = p.life / p.maxLife;
        if (t < 0.11)      p.a = Math.min(p.ta, p.a + 0.052);
        else if (t > 0.60) p.a = Math.max(0, p.a - p.ta / (p.maxLife * 0.40));
        if (p.life >= p.maxLife) p.dead = true;

      } else {
        const dx = so.x - p.x, dy = so.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const f = 0.10 + (p.life / p.maxLife) * 0.16;
        p.vx = p.vx * 0.86 + (dx / dist) * f * Math.min(dist / 52, 2.4);
        p.vy = p.vy * 0.86 + (dy / dist) * f * Math.min(dist / 52, 2.4);
        p.x += p.vx; p.y += p.vy;
        p.r  = Math.max(0.18, p.r * 0.972);
        p.a  = Math.max(0, p.a - 0.015);
        if (dist < 7 || p.a <= 0) p.dead = true;
      }

      const pr = p.r * (1 + Math.sin(p.po) * 0.20) * p.z;
      const fxMult = effectIntensity * 2; // 0=off, 1.0=default, 2.0=max
      const pa = Math.min(1, p.a * (0.35 + p.z * 0.65) * (1 + hoverEnergy * 0.55) * fxMult);
      if (pa < 0.014 || pr < 0.08) continue;

      const glow = `hsl(${p.h},88%,86%)`;
      const col  = `hsl(${p.h},${p.s}%,${p.l}%)`;

      // Soft halo — makes each speck glow like a hot ember
      bc.save();
      bc.globalAlpha = pa * (0.48 + hoverEnergy * 0.22);
      bc.shadowBlur  = pr * (8 + hoverEnergy * 6);
      bc.shadowColor = glow;
      bc.fillStyle   = glow;
      bc.beginPath();
      bc.arc(p.x, p.y, pr * 0.65, 0, Math.PI * 2);
      bc.fill();
      bc.restore();

      // Crisp micro-dot
      bc.save();
      bc.globalAlpha = pa;
      bc.fillStyle   = col;
      bc.beginPath();
      bc.arc(p.x, p.y, pr, 0, Math.PI * 2);
      bc.fill();
      bc.restore();
    }

    // Heartbeat runs always; non-hover is slower + lower intensity
    checkHeartbeat(ts);
    if (pool.length > 600) pool.splice(0, pool.length - 600);

    drawPerimComet(dt);
  }

  // ── Main loop ─────────────────────────────────────────
  let lastTs = 0;
  function tick(ts) {
    const dt = lastTs ? Math.min(ts - lastTs, 50) : 16; // cap at 50ms on tab resume
    lastTs = ts;
    requestAnimationFrame(tick);
    tickGlobal();
    tickMorph(ts);  // icon morph — CSS handles glass width, no spring
    tickBar(ts, dt);
  }
  requestAnimationFrame(tick);

  // Hover: energize particles + beat — collapsed state is softer
  bar.addEventListener('mouseenter', () => {
    bar.classList.add('ai-bar--hovered');
    const collapsed = bar.classList.contains('ai-bar--collapsed');
    if (collapsed) {
      hoverEnergy = 0.28;
      const n = Math.ceil(6 * effectIntensity * 2);
      if (n > 0) emitRing(n, 0.7, 0.85);
    } else {
      nextBeat = 0;
      hoverEnergy = 1.0;
      const n = Math.ceil(22 * effectIntensity * 2);
      if (n > 0) emitRing(n, 1.6, 1.1);
      setTimeout(() => { const n2 = Math.ceil(14 * effectIntensity * 2); if (n2 > 0) emitRing(n2, 1.1, 0.9); }, 160);
    }
  });
  bar.addEventListener('mouseleave', () => {
    bar.classList.remove('ai-bar--hovered');
    nextBeat = performance.now() + 2500; // slow down between visits
  });

  // ═══════════════════════════════════════════════════════
  //  PROGRESS BAR
  // ═══════════════════════════════════════════════════════
  let progVal = 0, progRaf = null;
  function animProg(target, ms) {
    if (progRaf) cancelAnimationFrame(progRaf);
    const from = progVal, t0 = performance.now();
    (function step(t) {
      const f = Math.min((t - t0) / ms, 1);
      const e = f < 0.5 ? 2*f*f : -1+(4-2*f)*f;
      progVal = from + (target - from) * e;
      if (prog) prog.style.width = progVal + '%';
      if (f < 1) progRaf = requestAnimationFrame(step);
    }(performance.now()));
  }

  // ═══════════════════════════════════════════════════════
  //  API
  // ═══════════════════════════════════════════════════════
  function getKey() { return localStorage.getItem(KEY_STORE) || ''; }
  function setKey(k) { localStorage.setItem(KEY_STORE, k.trim()); }

  function currentState() {
    const g = id => document.getElementById(id)?.value ?? '';
    return {
      scaleInput: g('scaleInput'), yRefInput: g('yRefInput'), xOffInput: g('xOffInput'),
      shadowBlur: g('shadowBlur'), shadowOpacity: g('shadowOpacity'),
      shadowX: g('shadowX'), shadowY: g('shadowY'), seqSpeed: g('seqSpeed'),
      hlSize: g('hlSize'), hlWeight: g('hlWeight'), hlTracking: g('hlTracking'), hlLineH: g('hlLineH'),
      bdSize: g('bdSize'), bdWeight: g('bdWeight'), bdTracking: g('bdTracking'), bdLineH: g('bdLineH'),
      lockupTop: g('lockupTop'), lockupMaxW: g('lockupMaxW'), lockupPad: g('lockupPad'), lockupGap: g('lockupGap'), lockupScale: g('lockupScale'),
      ctaGap: g('ctaGap'),
      headline: document.getElementById('hlText')?.textContent.trim() || '',
      body:     document.getElementById('bdText')?.textContent.trim() || '',
      cta1: g('cta1Text'), cta2: g('cta2Text'),
    };
  }

  function applyChanges(changes) {
    const textKeys = new Set(['headline', 'body', 'cta1', 'cta2']);
    Object.entries(changes).forEach(([id, val]) => {
      if (textKeys.has(id)) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (changes.headline != null) {
      const a = document.getElementById('hlText'), b = document.getElementById('ctrlHlPreview');
      if (a) a.textContent = changes.headline; if (b) b.textContent = changes.headline;
    }
    if (changes.body != null) {
      const a = document.getElementById('bdText'), b = document.getElementById('ctrlBdPreview');
      if (a) a.textContent = changes.body; if (b) b.textContent = changes.body;
    }
    ['cta1','cta2'].forEach(k => {
      if (changes[k] == null) return;
      const live = document.getElementById(k+'El'), inp = document.getElementById(k+'Text');
      if (live) live.textContent = changes[k];
      if (inp)  { inp.value = changes[k]; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }

  async function askClaude(instruction) {
    const key = getKey();
    if (!key) throw new Error('NO_KEY');
    const state = currentState();
    const system = `You control design panels for an iPhone scroll-hero demo. Return ONLY a raw JSON object mapping control IDs to new values. Only include keys that change.

Current: ${JSON.stringify(state)}

Controls: scaleInput(20-160) yRefInput(-500–2000) xOffInput(-600–600) shadowBlur(0-200) shadowOpacity(0-1) shadowX(-80–80) shadowY(0-180) seqSpeed(1-6) hlSize(24-160) hlWeight(300|400|500|600|700|800) hlTracking(-0.08–0.12) hlLineH(0.8-2.2) bdSize(12-32) bdWeight(300|400|500|600) bdTracking(-0.04–0.1) bdLineH(1-2.5) lockupTop(10-80) lockupMaxW(320-1400) lockupPad(0-160) lockupGap(0-80) lockupScale(50-150) ctaGap(0-80) headline(string) body(string) cta1(string) cta2(string)`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: instruction }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('No JSON');
    return JSON.parse(match[0]);
  }

  async function handleSend() {
    const txt = input.value.trim();
    if (!txt || bar.classList.contains('ai-bar--loading')) return;

    bar.classList.remove('ai-bar--success', 'ai-bar--error');
    isLoading = true;
    cometHead = 0; cometTail = 0; // start comet fresh for clean loading anim
    bar.classList.add('ai-bar--loading');
    send.disabled = true; input.disabled = true;

    absorbAll();
    progVal = 0;
    if (prog) { prog.style.width = '0%'; prog.parentElement.style.opacity = '1'; }
    animProg(82, 2600);
    const absorbDone = new Promise(r => setTimeout(r, 680));

    try {
      const key = getKey();
      const apiCall = key ? askClaude(txt) : new Promise(r => setTimeout(r, 1800, {}));
      const [changes] = await Promise.all([apiCall, absorbDone]);
      if (key && changes) applyChanges(changes);
      animProg(100, 200);
      await new Promise(r => setTimeout(r, 240));
      input.value = ''; input.style.height = '';
      bar.classList.add('ai-bar--success');
      emitBurst();
      setTimeout(() => bar.classList.remove('ai-bar--success'), 1500);
    } catch (err) {
      console.error('[AI bar]', err);
      bar.classList.add('ai-bar--error');
      setTimeout(() => bar.classList.remove('ai-bar--error'), 2200);
    } finally {
      isLoading = false;
      bar.classList.remove('ai-bar--loading');
      send.disabled = false; input.disabled = false; input.focus();
    }
  }

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  send.addEventListener('click', handleSend);
}());

// ═══════════════════════════════════════════════════════
//  ANIMATE SYSTEM — global record mode
//  One "◆ ANIMATE" button at bottom-left.
//  Any slider touch in REC mode → auto-captures KF.
//  Scroll → interpolate + apply all KFs.
//  ◆ N badge on each panel header shows KF count.
// ═══════════════════════════════════════════════════════
(function panelAnimSystem() {
  'use strict';

  const PANEL_COLORS = {
    shadowPanel:  '#38d2ff',
    seqPanel:     '#ff9f40',
    tweakPanel:   '#c4ff60',
    contentPanel: '#ff5eb0',
  };

  let kfStore    = {};   // { inputId: [{id, scrollY, val}] }
  let animMode   = false;
  let playback   = false; // true during scroll-apply, suppresses auto-capture
  let applying   = false; // re-entry guard — prevents seqSpeed dispatch loop
  let kfEnabled  = true;  // global KF playback toggle — false = bypass all KFs

  const KF_BLOCKLIST = new Set(['scaleInput', 'yRefInput', 'xOffInput']);
  let overlayEl  = null;
  let animBtn    = null;

  // ── Sparkle particle system ───────────────────────────
  let sparkCanvas = null;
  let sparkCtx    = null;
  let sparkParts  = [];    // {x,y,vx,vy,life,maxLife,r,color,startY,midY}
  let sparkRaf    = null;
  let sparkSrc    = null;  // {x,y,midY,color} while dragging; null = inactive
  let dragState   = null;  // {selSnap, scrollMax, deltaSY} — drives canvas line during drag

  function sizeSparkCanvas() {
    if (!sparkCanvas || !overlayEl) return;
    const dpr = window.devicePixelRatio || 1;
    const cw  = Math.round(overlayEl.offsetWidth  * dpr);
    const ch  = Math.round(overlayEl.offsetHeight * dpr);
    if (sparkCanvas.width !== cw || sparkCanvas.height !== ch) {
      sparkCanvas.width  = cw;
      sparkCanvas.height = ch;
    }
  }

  function tickSpark() {
    if (!sparkCanvas || !sparkCtx) { sparkRaf = null; return; }
    sizeSparkCanvas();
    const dpr = window.devicePixelRatio || 1;
    const W   = sparkCanvas.width  / dpr;
    const H   = sparkCanvas.height / dpr;
    sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sparkCtx.clearRect(0, 0, W, H);

    // ── Canvas connecting-line during drag (replaces the div line) ──────────
    if (dragState) {
      const { selSnap: sel, scrollMax: sm, deltaSY: dSY } = dragState;
      const panelKeys = Object.keys(PANEL_COLORS);
      new Set(sel.map(s => s.panelId)).forEach(pid => {
        const allDots = [...overlayEl.querySelectorAll(`[data-kf-pan="${pid}"]`)];
        if (allDots.length < 2) return;
        const pidIdx = panelKeys.indexOf(pid);
        const colX   = Math.round((pidIdx + 0.5) * (48 / panelKeys.length));
        const color  = PANEL_COLORS[pid] || '#ffffff';
        const dotYs  = allDots.map(d => {
          const dSY_val = parseInt(d.dataset.kfSy, 10);
          const isSel   = sel.some(s => s.panelId === pid && Math.abs(s.sy - dSY_val) <= KF_SNAP_RADIUS);
          const finalSY = Math.max(0, Math.min(sm, isSel ? dSY_val + dSY : dSY_val));
          return finalSY / sm * H;
        }).sort((a, b) => a - b);
        sparkCtx.save();
        sparkCtx.globalAlpha = 0.85;
        sparkCtx.strokeStyle = color;
        sparkCtx.lineWidth   = 2;
        sparkCtx.lineCap     = 'round';
        sparkCtx.beginPath();
        sparkCtx.moveTo(colX, dotYs[0]);
        for (let i = 1; i < dotYs.length; i++) sparkCtx.lineTo(colX, dotYs[i]);
        sparkCtx.stroke();
        sparkCtx.restore();
      });
    }

    if (sparkSrc) {
      for (let i = 0; i < 4; i++) {
        sparkParts.push({
          x:       sparkSrc.x + (Math.random() - 0.5) * 3,
          y:       sparkSrc.y - Math.random() * 2,
          vx:      (Math.random() - 0.5) * 0.9,
          vy:      -(2.0 + Math.random() * 1.8),
          life:    0,
          maxLife: 22 + Math.random() * 22,
          r:       1.5 + Math.random() * 1.5,
          color:   sparkSrc.color,
          startY:  sparkSrc.y,
          midY:    sparkSrc.midY,
        });
      }
    }

    sparkParts = sparkParts.filter(p => {
      p.x    += p.vx;
      p.y    += p.vy;
      p.life += 1;
      const lifeFade = 1 - p.life / p.maxLife;
      // particles rise upward; midY is ABOVE startY — fade to 0 as they reach midY
      const range    = Math.max(1, p.startY - p.midY);
      const distFade = 1 - Math.min(1, Math.max(0, (p.startY - p.y) / range));
      const a = lifeFade * distFade * 0.90;
      if (a < 0.01 || p.life >= p.maxLife) return false;
      sparkCtx.globalAlpha = a;
      sparkCtx.fillStyle   = p.color;
      sparkCtx.beginPath();
      sparkCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      sparkCtx.fill();
      return true;
    });

    sparkCtx.globalAlpha = 1;

    if (sparkSrc || sparkParts.length > 0 || dragState) {
      sparkRaf = requestAnimationFrame(tickSpark);
    } else {
      sparkRaf = null;
      sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sparkCtx.clearRect(0, 0, W, H);
    }
  }

  const lerp   = (a, b, t) => a + (b - a) * t;
  const easeIO = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2;

  // ── Color interpolation helpers ───────────────────────
  const isHex6  = v => typeof v === 'string' && /^[0-9a-f]{6}$/i.test(v.trim());
  function hexToRgb(h) {
    const v = h.replace('#','');
    return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
  }
  function rgbToHex(r,g,b) {
    return [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
  }
  function lerpHex(a, b, t) {
    const [ar,ag,ab] = hexToRgb(a), [br,bg,bb] = hexToRgb(b);
    return rgbToHex(ar+(br-ar)*t, ag+(bg-ag)*t, ab+(bb-ab)*t);
  }

  // ── Persistence — KF draft in sessionStorage ─────────
  // KFs auto-save to sessionStorage as a draft.
  // Refresh loads live.json only (reverts to last Push Live state).
  // The draft banner lets the user explicitly restore their work.
  function load() { kfStore = {}; }
  function save() {
    try {
      if (Object.keys(kfStore).length > 0) {
        sessionStorage.setItem('pw_kf_draft', JSON.stringify(kfStore));
      } else {
        sessionStorage.removeItem('pw_kf_draft');
      }
    } catch(_) {}
  }

  let _lastCapturedSY = -1; // track most recent capture scroll for dot pulse

  // ── Capture one input's value as a KF at scrollY ──────
  function captureInputKF(inputId, sy, val) {
    if (!kfStore[inputId]) kfStore[inputId] = [];
    kfStore[inputId] = kfStore[inputId].filter(k => Math.abs(k.scrollY - sy) > 30);
    kfStore[inputId].push({ id: Date.now(), scrollY: sy, val });
    kfStore[inputId].sort((a, b) => a.scrollY - b.scrollY);
    _lastCapturedSY = sy;
    save();
    updateBadges();
    refreshSnapButtons();
    buildOverlayLines();
    applyAllKFs(window.scrollY);
  }

  // ── Helper: color for an input based on its panel ─────
  function inputColor(inputId) {
    for (const [panelId, color] of Object.entries(PANEL_COLORS)) {
      const panel = document.getElementById(panelId);
      if (panel && panel.querySelector(`#${inputId}`)) return color;
    }
    return 'rgba(255,255,255,0.45)';
  }

  // ── Apply all stored KFs at current scrollY ───────────
  function applyAllKFs(sy) {
    if (!kfEnabled) { updateKFSidebar(sy); return; }
    if (applying) return;   // guard against reentrant scroll from seqSpeed
    applying = true;
    playback = true;
    for (const [inputId, kfs] of Object.entries(kfStore)) {
      if (KF_BLOCKLIST.has(inputId)) continue;  // never animate position calibration
      // seqSpeed changes the scroll-driver height → clamps window.scrollY mid-drag
      if (dragState && inputId === 'seqSpeed') continue;
      if (kfs.length < 2) continue;  // need ≥2 KFs to interpolate
      const sorted = kfs.slice().sort((a, b) => a.scrollY - b.scrollY);
      // Only active between first and last keyframe
      if (sy < sorted[0].scrollY || sy > sorted[sorted.length - 1].scrollY) continue;
      let val;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sy >= sorted[i].scrollY && sy <= sorted[i + 1].scrollY) {
          const t  = easeIO((sy - sorted[i].scrollY) / (sorted[i + 1].scrollY - sorted[i].scrollY));
          const av = sorted[i].val, bv = sorted[i + 1].val;
          if (isHex6(av) && isHex6(bv)) {
            val = lerpHex(av, bv, t);
          } else if (typeof av === 'number' && typeof bv === 'number') {
            val = lerp(av, bv, t);
          } else {
            val = t < 0.5 ? av : bv; // snap for text / select
          }
          break;
        }
      }
      if (val !== undefined) {
        const inp = document.getElementById(inputId);
        if (!inp) continue;
        if (inp.classList.contains('pw-seg')) {
          const btn = inp.querySelector(`.pw-seg__btn[data-val="${String(val)}"]`);
          if (btn && !btn.classList.contains('pw-seg__btn--on')) btn.click();
        } else {
          inp.value = val;
          inp.dispatchEvent(new Event('input',  { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    playback = false;
    applying = false;
    updateKFSidebar(sy);
  }

  // ── KF sidebar — modern right-edge track ─────────────
  function buildOverlay() {
    if (overlayEl) overlayEl.remove();
    sparkCanvas = null; sparkCtx = null; sparkParts = [];
    if (sparkRaf) { cancelAnimationFrame(sparkRaf); sparkRaf = null; }
    sparkSrc = null;

    overlayEl = document.createElement('div');
    overlayEl.className = 'drv-overlay';
    document.body.appendChild(overlayEl);

    sparkCanvas = document.createElement('canvas');
    sparkCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;';
    overlayEl.appendChild(sparkCanvas);
    sparkCtx = sparkCanvas.getContext('2d');
  }

  function buildOverlayLines() {
    if (!overlayEl) return;
    // Remove all children except the sparkle canvas
    [...overlayEl.children].forEach(c => { if (c !== sparkCanvas) c.remove(); });

    const totalKFs = Object.values(kfStore).reduce((n, kfs) => n + kfs.length, 0);
    overlayEl.classList.toggle('drv-overlay--has-kfs', totalKFs > 0);

    const scrollMax = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const OVERLAY_W  = 48;
    const panelIds   = Object.keys(PANEL_COLORS);

    // Scrubber hairline — always visible
    const hair = document.createElement('div');
    hair.className = 'drv-overlay__hair';
    hair.id = 'kwHair';
    overlayEl.appendChild(hair);

    if (totalKFs > 0) {
      // KF bypass toggle
      const bypassBtn = document.createElement('button');
      bypassBtn.className = 'drv-overlay__bypass';
      bypassBtn.id = 'kfBypassBtn';
      bypassBtn.title = 'Toggle KF playback (K)';
      bypassBtn.textContent = kfEnabled ? 'KF' : 'OFF';
      bypassBtn.classList.toggle('drv-overlay__bypass--off', !kfEnabled);
      bypassBtn.addEventListener('click', toggleKFEnabled);
      overlayEl.appendChild(bypassBtn);

      // Clear-all button
      const clearBtn = document.createElement('button');
      clearBtn.className = 'drv-overlay__bypass drv-overlay__bypass--clear';
      clearBtn.title = 'Delete all keyframes';
      clearBtn.textContent = '✕ KFs';
      clearBtn.addEventListener('click', () => {
        kfStore = {};
        save();
        buildOverlayLines();
        updateBadges();
        refreshSnapButtons();
      });
      overlayEl.appendChild(clearBtn);
    }

    // ── Per-panel colored track columns ──────────────────
    panelIds.forEach((panelId, idx) => {
      const color   = PANEL_COLORS[panelId];
      const panelEl = document.getElementById(panelId);
      if (!panelEl) return;

      // Collect all KF scrollY values for this panel's inputs
      const positions = [];
      Object.entries(kfStore).forEach(([inputId, kfs]) => {
        if (KF_BLOCKLIST.has(inputId)) return;
        if (!panelEl.querySelector(`#${inputId}`)) return;
        kfs.forEach(kf => positions.push(kf.scrollY));
      });
      if (!positions.length) return;

      const sorted = [...new Set(positions)].sort((a, b) => a - b);

      const col = document.createElement('div');
      col.className = 'drv-overlay__col';
      col.style.setProperty('--track-color', color);
      const colCenter = Math.round((idx + 0.5) * (OVERLAY_W / panelIds.length));
      col.style.left = `${colCenter - 1}px`;
      overlayEl.appendChild(col);

      // Dim full-height track — always visible when panel has any KFs
      const track = document.createElement('div');
      track.className = 'drv-overlay__track';
      col.appendChild(track);

      // Segment lines between every consecutive pair of KFs
      for (let i = 0; i < sorted.length - 1; i++) {
        const line = document.createElement('div');
        line.className = 'drv-overlay__line';
        const topPct = (sorted[i]     / scrollMax) * 100;
        const botPct = (sorted[i + 1] / scrollMax) * 100;
        line.style.top    = `${topPct}%`;
        line.style.height = `${Math.max(0.5, botPct - topPct)}%`;
        line.dataset.kfLinePan = panelId;
        col.appendChild(line);
      }

      // Dot at each KF scroll position — click to scroll/delete, shift-click to multi-select, drag to move
      sorted.forEach(sy => {
        const key = `${panelId}:${sy}`;
        const isNew = Math.abs(sy - _lastCapturedSY) <= KF_SNAP_RADIUS;
        const isSel = kfSel.has(key);
        const dot = document.createElement('div');
        dot.className = 'drv-overlay__dot'
          + (isNew ? ' drv-overlay__dot--new' : '')
          + (isSel ? ' drv-overlay__dot--selected' : '');
        dot.style.top = `${(sy / scrollMax) * 100}%`;
        dot.title = `KF @ ${Math.round(sy)}px — drag to move, shift-click to multi-select`;
        dot.style.pointerEvents = 'auto';
        dot.dataset.kfPan = panelId;
        dot.dataset.kfSy  = String(sy);
        dot.dataset.kfColX = String(colCenter);

        let didDrag = false;

        dot.addEventListener('mousedown', e => {
          e.preventDefault();
          e.stopPropagation();

          if (e.shiftKey) {
            if (kfSel.has(key)) kfSel.delete(key);
            else kfSel.add(key);
            dot.classList.toggle('drv-overlay__dot--selected', kfSel.has(key));
            return;
          }

          // Clear selection if clicking an unselected dot
          if (!kfSel.has(key)) kfSel.clear();
          kfSel.add(key);

          didDrag = false;
          const oldSY        = sy;
          const startMouseY  = e.clientY;
          window.scrollTo(0, oldSY);
          const startScrollY = oldSY;

          // Snapshot all currently selected {panelId, sy} for delta-move
          const selSnap = [...kfSel].map(k => {
            const colonIdx = k.lastIndexOf(':');
            return { key: k, panelId: k.slice(0, colonIdx), sy: parseInt(k.slice(colonIdx + 1)) };
          });

          dot.classList.add('drv-overlay__dot--dragging');
          overlayEl.classList.add('drv-overlay--dragging');
          dragState = { selSnap, scrollMax, deltaSY: 0 };
          if (!sparkRaf) sparkRaf = requestAnimationFrame(tickSpark);
          // Seed the rAF scroll loop at the snap position, then start the loop
          kfDragTargetSY = oldSY;
          requestAnimationFrame(kfDragScrollLoop);

          // currentSY passed directly — no dependency on window.scrollY settling
          function updateKFVisuals(currentSY) {
            const deltaSY = Math.round(currentSY - startScrollY);
            selSnap.forEach(({ panelId: pid, sy: sSY }) => {
              const el = overlayEl.querySelector(`[data-kf-pan="${pid}"][data-kf-sy="${sSY}"]`);
              if (el) el.style.top = `${Math.max(0, Math.min(100, ((sSY + deltaSY) / scrollMax) * 100))}%`;
            });
            if (dragState) dragState.deltaSY = deltaSY;

            // Sparkles
            if (selSnap.length > 0) {
              const primary  = selSnap[0];
              const colX     = parseInt(dot.dataset.kfColX || '24');
              const overlayH = overlayEl.offsetHeight || window.innerHeight;
              const dotY     = Math.max(0, Math.min(100, (primary.sy + deltaSY) / scrollMax * 100)) / 100 * overlayH;
              let midY = dotY - 70;
              const panelDots = [...overlayEl.querySelectorAll(`[data-kf-pan="${primary.panelId}"]`)];
              const otherYs = panelDots.map(d => {
                const dSY_val = parseInt(d.dataset.kfSy, 10);
                const isSel   = selSnap.some(s => s.panelId === primary.panelId && Math.abs(s.sy - dSY_val) <= KF_SNAP_RADIUS);
                const fSY     = Math.max(0, Math.min(scrollMax, isSel ? dSY_val + deltaSY : dSY_val));
                return fSY / scrollMax * overlayH;
              }).filter(y => Math.abs(y - dotY) > 5);
              if (otherYs.length > 0) {
                const topY = Math.min(...otherYs);
                midY = dotY > topY ? dotY - Math.max(40, (dotY - topY) * 0.5) : dotY - 70;
              }
              const sparkColor = PANEL_COLORS[primary.panelId] || '#ffffff';
              if (!sparkSrc) {
                sparkSrc = { x: colX, y: dotY, midY, color: sparkColor };
                if (!sparkRaf) sparkRaf = requestAnimationFrame(tickSpark);
              } else {
                sparkSrc.x = colX; sparkSrc.y = dotY; sparkSrc.midY = midY;
              }
            }
          }

          function onMove(e2) {
            if (!didDrag && Math.abs(e2.clientY - startMouseY) > 3) didDrag = true;
            if (!didDrag) return;

            const rect  = overlayEl.getBoundingClientRect();
            const relY  = Math.max(0, Math.min(rect.height, e2.clientY - rect.top));
            const newSY = Math.round((relY / rect.height) * scrollMax);

            updateKFVisuals(newSY);
            window.scrollTo(0, newSY);  // immediate; 2-arg form works in every browser
            kfDragTargetSY = newSY;     // rAF loop holds the position each frame
          }

          function onUp(e2) {
            if (edgeRaf) { cancelAnimationFrame(edgeRaf); edgeRaf = null; }
            sparkSrc  = null; // stop emitting; existing particles fade out naturally
            const finalDeltaSY = dragState ? dragState.deltaSY : Math.round(window.scrollY - startScrollY);
            dragState = null; // stop canvas line; div line takes back over after rebuild
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
            dot.classList.remove('drv-overlay__dot--dragging');
            overlayEl.classList.remove('drv-overlay--dragging');

            if (!didDrag) {
              kfSel.clear();
              if (Math.abs(window.scrollY - oldSY) <= KF_SNAP_RADIUS) {
                deleteKFsAtScroll(panelId, oldSY);
              } else {
                window.scrollTo({ top: oldSY, behavior: 'smooth' });
              }
              return;
            }

            const deltaSY = finalDeltaSY;
            selSnap.forEach(({ panelId: pid, sy: sSY }) => {
              const targetSY = Math.max(0, sSY + deltaSY);
              for (const [inputId, kfs] of Object.entries(kfStore)) {
                const pe = document.getElementById(pid);
                if (!pe?.querySelector(`#${inputId}`)) continue;
                kfs.forEach(kf => {
                  if (Math.abs(kf.scrollY - sSY) <= KF_SNAP_RADIUS) kf.scrollY = targetSY;
                });
                kfs.sort((a, b) => a.scrollY - b.scrollY);
              }
            });

            // Update selection keys to reflect new positions
            kfSel.clear();
            selSnap.forEach(({ panelId: pid, sy: sSY }) => {
              kfSel.add(`${pid}:${Math.max(0, sSY + deltaSY)}`);
            });

            save(); updateBadges(); refreshSnapButtons(); buildOverlayLines();
            // dragState is already null — sync visuals to final resting scroll position
            applyAllKFs(window.scrollY);
          }

          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup',   onUp);
        });

        col.appendChild(dot);
      });
    });

    updateKFSidebar(window.scrollY);
  }

  // Delete all KFs at a scroll position for a panel; clean up orphaned single KFs
  function deleteKFsAtScroll(panelId, sy) {
    const panelEl = document.getElementById(panelId);
    for (const [inputId, kfs] of Object.entries(kfStore)) {
      if (!panelEl?.querySelector(`#${inputId}`)) continue;
      const before = kfs.length;
      kfStore[inputId] = kfs.filter(k => Math.abs(k.scrollY - sy) > KF_SNAP_RADIUS);
      if (!kfStore[inputId].length) {
        delete kfStore[inputId];
      } else if (kfStore[inputId].length === 1 && before > 1) {
        // Removing this position left exactly 1 KF — clean it up (can't interpolate)
        delete kfStore[inputId];
      }
    }
    save(); updateBadges(); refreshSnapButtons(); buildOverlayLines();
  }

  function updateKFSidebar(sy) {
    const hair = document.getElementById('kwHair');
    if (!hair) return;
    const scrollMax = Math.max(1, document.body.scrollHeight - window.innerHeight);
    hair.style.top = `${(sy / scrollMax) * 100}%`;
  }

  function toggleKFEnabled() {
    kfEnabled = !kfEnabled;
    const btn = document.getElementById('kfBypassBtn');
    if (btn) {
      btn.textContent = kfEnabled ? 'KF' : 'OFF';
      btn.classList.toggle('drv-overlay__bypass--off', !kfEnabled);
    }
    overlayEl?.classList.toggle('drv-overlay--bypassed', !kfEnabled);
    // Sync all panel header badges to reflect master state
    document.querySelectorAll('.pw-anim-badge').forEach(b => {
      b.classList.toggle('pw-anim-badge--bypassed', !kfEnabled);
      b.title = kfEnabled ? 'Master KF toggle — enable / disable all keyframes' : 'KFs bypassed — click to re-enable';
    });
  }

  // K key toggles KF playback
  document.addEventListener('keydown', e => {
    if (e.key === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA') {
      toggleKFEnabled();
    }
  });

  // ── Panel KF count badges ─────────────────────────────
  function updateBadges() {
    for (const panelId of Object.keys(PANEL_COLORS)) {
      const badge = document.getElementById(`kwBadge_${panelId}`);
      if (!badge) continue;
      const panel  = document.getElementById(panelId);
      const panelEl = panel || null;
      const positions = new Set();
      if (panelEl) {
        Object.entries(kfStore).forEach(([inputId, kfs]) => {
          if (KF_BLOCKLIST.has(inputId)) return;
          if (panelEl.querySelector(`#${inputId}`)) kfs.forEach(kf => positions.add(kf.scrollY));
        });
      }
      const count = positions.size;
      badge.textContent = count > 0 ? `◆ ${count}` : '◆';
      badge.classList.toggle('pw-anim-badge--active', count > 0);
    }
  }

  function captureAllPanelKFs(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const sy = Math.round(window.scrollY);
    panel.querySelectorAll('input[type=range], input[type=text], select').forEach(inp => {
      if (!inp.id || KF_BLOCKLIST.has(inp.id)) return;
      const val = inp.type === 'range' ? parseFloat(inp.value) : inp.value;
      captureInputKF(inp.id, sy, val);
    });
    panel.querySelectorAll('.pw-seg[id]').forEach(seg => {
      const active = seg.querySelector('.pw-seg__btn--on');
      if (active) captureInputKF(seg.id, sy, active.dataset.val || '');
    });
    panel.querySelectorAll('.pw-cpicker__hex[id]').forEach(inp => {
      captureInputKF(inp.id, sy, inp.value.replace('#','').toLowerCase());
    });
    buildOverlayLines();
  }

  function addBadges() {
    for (const [panelId, color] of Object.entries(PANEL_COLORS)) {
      const hdr = document.querySelector(`#${panelId} .pw-panel__hdr`);
      if (!hdr) continue;
      const badge = document.createElement('span');
      badge.className = 'pw-anim-badge';
      badge.id  = `kwBadge_${panelId}`;
      badge.style.setProperty('--badge-color', color);
      badge.title = 'Master keyframe — capture all metrics at current scroll';
      badge.textContent = '◆';
      badge.addEventListener('click', e => {
        e.stopPropagation();
        captureAllPanelKFs(panelId);
      });
      const hdrRight = hdr.querySelector('.pw-panel__hdr-right');
      const closeBtn = hdrRight ? hdrRight.querySelector('.pw-icon-btn') : hdr.querySelector('.pw-icon-btn');
      const target   = hdrRight || hdr;
      if (closeBtn) target.insertBefore(badge, closeBtn);
      else target.appendChild(badge);
    }
    updateBadges();
  }

  const REC_ICON = `<svg class="pw-rec-dot" width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><circle class="pw-rec-dot__fill" cx="5" cy="5" r="2.2" fill="currentColor"/></svg>`;

  // ── Record button injected into each panel header ─────
  // One shared toggle — clicking any panel's RECORD button toggles global animMode.
  function buildAnimateButton() {
    for (const panelId of Object.keys(PANEL_COLORS)) {
      const hdr = document.querySelector(`#${panelId} .pw-panel__hdr`);
      if (!hdr) continue;
      const pill = document.createElement('button');
      pill.className = 'pw-panel-anim-btn';
      pill.dataset.panel = panelId;
      pill.innerHTML = REC_ICON;
      pill.addEventListener('click', e => { e.stopPropagation(); toggleAnimate(); });
      const hdrRight2 = hdr.querySelector('.pw-panel__hdr-right');
      const closeBtn2 = hdrRight2 ? hdrRight2.querySelector('.pw-icon-btn') : hdr.querySelector('.pw-icon-btn');
      const target2   = hdrRight2 || hdr;
      if (closeBtn2) target2.insertBefore(pill, closeBtn2);
      else target2.appendChild(pill);
    }
  }

  function toggleAnimate() {
    animMode = !animMode;
    document.querySelectorAll('.pw-panel-anim-btn').forEach(btn => {
      btn.classList.toggle('pw-panel-anim-btn--on', animMode);
      btn.innerHTML = REC_ICON;
    });
    buildOverlayLines();
  }

  // Diamond SVG matching stroke weight of eye + plus icons
  const KF_ICON = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M5 1L9 5L5 9L1 5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;
  const DEL_ICON = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
    <path d="M1.5 1.5L7.5 7.5M7.5 1.5L1.5 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

  const kfSel = new Set(); // Set of `${panelId}:${sy}` — multi-select for sidebar drag

  // ── ◆ Snap-KF button on every row type ───────────────
  function addKFSnapButtons() {
    for (const panelId of Object.keys(PANEL_COLORS)) {
      const panel = document.getElementById(panelId);
      if (!panel) continue;

      // Range sliders
      panel.querySelectorAll('input[type=range]').forEach(inp => {
        if (!inp.id || KF_BLOCKLIST.has(inp.id)) return;
        const row = inp.closest('.pw-row');
        if (!row) return;
        attachKFBtn(row, inp.id, () => parseFloat(inp.value));
      });

      // Select dropdowns
      panel.querySelectorAll('select[id]').forEach(inp => {
        const row = inp.closest('.pw-row');
        if (!row) return;
        attachKFBtn(row, inp.id, () => inp.value);
      });

      // Text inputs
      panel.querySelectorAll('input[type=text][id]').forEach(inp => {
        const row = inp.closest('.pw-row');
        if (!row) return;
        attachKFBtn(row, inp.id, () => inp.value);
      });

      // Segment controls
      panel.querySelectorAll('.pw-seg[id]').forEach(seg => {
        const row = seg.closest('.pw-row');
        if (!row) return;
        attachKFBtn(row, seg.id, () => seg.querySelector('.pw-seg__btn--on')?.dataset.val || '');
      });

      // Color rows
      panel.querySelectorAll('.pw-row--color').forEach(row => {
        const chip = row.querySelector('.pw-color-chip');
        if (!chip?.id) return;
        const hexInputId = chip.id.replace('ColorChip', 'CPickerHex');
        const hexInput   = document.getElementById(hexInputId);
        if (!hexInput) return;
        attachKFBtn(row, hexInputId, () => hexInput.value.replace('#','').toLowerCase());
      });
    }
  }

  const KF_SNAP_RADIUS = 30; // px — within this distance counts as "on" a KF

  function kfAtScroll(inputId, sy) {
    return (kfStore[inputId] || []).find(k => Math.abs(k.scrollY - sy) <= KF_SNAP_RADIUS);
  }

  function attachKFBtn(row, inputId, getVal) {
    if (row.querySelector(`.pw-kf-snap[data-input="${inputId}"]`)) return; // dedup

    // ✕ Delete button — visible only when a KF exists at current scroll
    const delBtn = document.createElement('button');
    delBtn.className = 'pw-kf-del';
    delBtn.dataset.input = inputId;
    delBtn.innerHTML = DEL_ICON;
    delBtn.title = 'Delete keyframe';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      const kfId = delBtn.dataset.kfId;
      if (kfId) {
        kfStore[inputId] = (kfStore[inputId] || []).filter(k => String(k.id) !== kfId);
      } else {
        const existing = kfAtScroll(inputId, Math.round(window.scrollY));
        if (!existing) return;
        kfStore[inputId] = (kfStore[inputId] || []).filter(k => k.id !== existing.id);
      }
      if (!(kfStore[inputId] || []).length) delete kfStore[inputId];
      save(); updateBadges(); refreshSnapButtons(); buildOverlayLines();
    });

    // ◆ Diamond button — always adds/updates KF at current scroll
    const btn = document.createElement('button');
    btn.className = 'pw-kf-snap';
    btn.dataset.input = inputId;
    btn.innerHTML = KF_ICON;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const sy = Math.round(window.scrollY);
      captureInputKF(inputId, sy, getVal());
      btn.classList.add('pw-kf-snap--flash');
      setTimeout(() => btn.classList.remove('pw-kf-snap--flash'), 500);
    });

    row.appendChild(delBtn);
    row.appendChild(btn);
  }

  // Update snap + delete buttons: --has = has any KF, --here = sitting on a KF at current scroll
  function refreshSnapButtons() {
    const sy = Math.round(window.scrollY);
    document.querySelectorAll('.pw-kf-snap').forEach(btn => {
      const id   = btn.dataset.input;
      const has  = !!(kfStore[id] && kfStore[id].length);
      const here = !!kfAtScroll(id, sy);
      btn.classList.toggle('pw-kf-snap--has',  has);
      btn.classList.toggle('pw-kf-snap--here', here);
      btn.title = 'Set keyframe';
    });
    document.querySelectorAll('.pw-kf-del').forEach(del => {
      const id   = del.dataset.input;
      const here = kfAtScroll(id, sy);
      del.classList.toggle('pw-kf-del--visible', !!here);
      if (here) del.dataset.kfId = String(here.id);
      else delete del.dataset.kfId;
    });
  }

  // ── Auto-capture on value change ─────────────────────────
  // REC mode: capture entire panel. Otherwise: if this input already has ≥1 KF,
  // auto-set a KF at the current scroll when its value changes.
  function bindAutoCapture() {
    function capture(e) {
      if (playback || window.__liveApplying) return;
      const inp = e.target;
      if (!inp.id) return;
      if (KF_BLOCKLIST.has(inp.id)) return;

      const panelId = Object.keys(PANEL_COLORS).find(id => {
        const p = document.getElementById(id);
        return p && p.contains(inp);
      });
      if (!panelId) return;

      if (animMode) {
        captureAllPanelKFs(panelId);
      } else if (kfStore[inp.id] && kfStore[inp.id].length >= 1) {
        // Auto-KF: input already has keyframes — capture this one input
        const val = inp.type === 'range' ? parseFloat(inp.value) : inp.value;
        captureInputKF(inp.id, Math.round(window.scrollY), val);
      }
    }

    document.addEventListener('input',  capture, true);
    document.addEventListener('change', capture, true);
  }

  // ── Scroll ────────────────────────────────────────────
  let kfDragTargetSY = 0; // updated by onMove; consumed by kfDragScrollLoop

  // Runs every rAF frame while a KF dot is being dragged.
  // Continuously writing scrollTop overrides any browser clamping
  // that would otherwise reset the position we just set.
  function kfDragScrollLoop() {
    if (!dragState) return; // drag ended — stop naturally
    window.scrollTo(0, kfDragTargetSY);
    requestAnimationFrame(kfDragScrollLoop);
  }

  function onScroll() {
    const sy = window.scrollY;
    applyAllKFs(sy);  // updateKFSidebar called inside applyAllKFs
    refreshSnapButtons();
  }

  function buildCornerHatches() {
    // Single hatch in each lower corner (no top hatches, no doubling).
    for (const panelId of Object.keys(PANEL_COLORS)) {
      const panel = document.getElementById(panelId);
      if (!panel) continue;
      // Strip any stale top corners from prior sessions
      panel.querySelectorAll('.pw-corner--tl, .pw-corner--tr').forEach(el => el.remove());
      ['bl','br'].forEach(pos => {
        if (panel.querySelector(`.pw-corner--${pos}`)) return;
        const c = document.createElement('span');
        c.className = `pw-corner pw-corner--${pos}`;
        c.setAttribute('aria-hidden', 'true');
        panel.appendChild(c);
      });
    }
  }

  // ── Globals for cross-IIFE KF persistence ────────────
  window.__getKFs   = () => JSON.parse(JSON.stringify(kfStore));
  window.__applyKFs = kfs => {
    if (!kfs || typeof kfs !== 'object') return;
    kfStore = kfs;
    // Strip position-calibration inputs that must never animate
    KF_BLOCKLIST.forEach(id => delete kfStore[id]);
    buildOverlayLines();
    updateBadges();
    refreshSnapButtons();
  };
  window.__clearKFDraft   = () => { try { sessionStorage.removeItem('pw_kf_draft'); } catch(_) {} };
  window.__restoreKFDraft = () => {
    try {
      const raw = sessionStorage.getItem('pw_kf_draft');
      if (raw && window.__applyKFs) window.__applyKFs(JSON.parse(raw));
    } catch(_) {}
  };

  // ── Init ─────────────────────────────────────────────
  function init() {
    load(); // kfStore = {} — always starts empty; Push Live restores via applyPayload
    buildAnimateButton();
    buildCornerHatches();
    buildOverlay();
    // Mirror the PanelSystem's initial hidden state onto the freshly-built overlay
    if (document.getElementById('panelTog')?.classList.contains('panel-tog--panels-hidden')) {
      overlayEl.style.opacity       = '0';
      overlayEl.style.pointerEvents = 'none';
    }
    buildOverlayLines();   // render any persisted KF tracks immediately
    addBadges();
    addKFSnapButtons();
    refreshSnapButtons();
    bindAutoCapture();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Scroll Ruler ───────────────────────────────────────────
  (function initRuler() {
    const cvs = document.createElement('canvas');
    cvs.id = 'pw-ruler-cvs';
    Object.assign(cvs.style, {
      position: 'fixed', left: '0', top: '0',
      width: '100vw', height: '100vh',
      pointerEvents: 'none', zIndex: '9000',
    });
    document.body.appendChild(cvs);

    const ball = document.createElement('div');
    ball.id = 'pw-ruler-ball';
    Object.assign(ball.style, {
      position: 'fixed', top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '9px', height: '9px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.90)',
      boxShadow: '0 0 8px rgba(255,255,255,0.45), 0 0 3px rgba(255,255,255,0.70)',
      pointerEvents: 'auto', cursor: 'ew-resize',
      zIndex: '9001', opacity: '0',
      transition: 'opacity 0.18s ease',
    });
    document.body.appendChild(ball);

    const MIN_W    = 5;
    const INIT_W   = 22;  // visible at rest; user can drag to collapse
    const maxW     = () => window.innerWidth;
    let   targetW  = INIT_W;
    let   currentW = INIT_W;

    // Cascade bands — each band lerps at its own rate (center leads, edges lag)
    const N_BANDS    = 60;
    const bandW      = new Float32Array(N_BANDS).fill(INIT_W);
    const CTR_IDX    = (N_BANDS - 1) / 2;

    function tickBands() {
      for (let i = 0; i < N_BANDS; i++) {
        const dist = Math.abs(i - CTR_IDX) / CTR_IDX; // 0..1
        const rate = 0.20 * (1 - dist * 0.72);
        bandW[i] += (targetW - bandW[i]) * rate;
      }
    }

    function getBandW(screenY, h) {
      const idx = Math.max(0, Math.min(N_BANDS - 1, Math.floor((screenY / h) * N_BANDS)));
      return bandW[idx];
    }

    function resizeCvs() {
      cvs.width  = window.innerWidth;
      cvs.height = window.innerHeight;
    }
    resizeCvs();
    window.addEventListener('resize', resizeCvs);

    // Show ball when mouse is near the right tip of the center line
    let ballVis  = false;
    let dragging = false;
    let dragStartX, dragStartW;

    document.addEventListener('mousemove', ev => {
      if (dragging) return;
      const cy      = window.innerHeight / 2;
      const nearCtr = Math.abs(ev.clientY - cy) < 12;
      const nearTip = Math.abs(ev.clientX - currentW) < 18 && ev.clientX > 0;
      const show    = nearCtr && nearTip;
      if (show !== ballVis) {
        ballVis = show;
        ball.style.opacity = show ? '1' : '0';
      }
    });

    ball.addEventListener('mousedown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      dragging   = true;
      dragStartX = ev.clientX;
      dragStartW = currentW;
      ball.style.opacity = '1';

      function onMove(e2) {
        targetW = Math.max(MIN_W, Math.min(maxW(), dragStartW + (e2.clientX - dragStartX)));
      }
      function onUp() {
        dragging = false;
        ball.style.opacity = ballVis ? '1' : '0';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    const TICK_STEP = 40;
    let   lastRafT  = null;

    function drawRuler(ts) {
      requestAnimationFrame(drawRuler);

      const dt = lastRafT ? Math.min(ts - lastRafT, 64) : 16;
      lastRafT = ts;
      void dt; // dt reserved for future rate-adjust; bands tick per-frame

      // Lerp main width (drives ball position)
      currentW += (targetW - currentW) * 0.15;
      if (Math.abs(currentW - targetW) < 0.2) currentW = targetW;

      // Cascade: center-out bands
      tickBands();

      ball.style.left = `${Math.round(currentW)}px`;

      const ctx     = cvs.getContext('2d');
      const W       = cvs.width;
      const H       = cvs.height;
      const scrollY = window.scrollY;
      const centerY = H / 2;

      ctx.clearRect(0, 0, W, H);

      // Scrolling tick marks
      const first = Math.floor((scrollY - H) / TICK_STEP) - 1;
      const last  = Math.ceil((scrollY + H) / TICK_STEP) + 1;

      for (let i = first; i <= last; i++) {
        const tickSY  = i * TICK_STEP;
        const screenY = centerY + (tickSY - scrollY);

        if (screenY < -2 || screenY > H + 2) continue;
        if (Math.abs(screenY - centerY) < 0.8) continue; // center line drawn separately

        const isMajor  = i % 10 === 0;
        const isMedium = i % 5  === 0;
        const alpha    = isMajor ? 0.20 : isMedium ? 0.13 : 0.07;
        const frac     = isMajor ? 0.58 : isMedium ? 0.36 : 0.22;
        const bW       = getBandW(screenY, H);
        const lineLen  = Math.max(0, bW * frac);
        if (lineLen < 0.5) continue;

        ctx.beginPath();
        ctx.moveTo(0, Math.round(screenY) + 0.5);
        ctx.lineTo(lineLen, Math.round(screenY) + 0.5);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Fixed center line — full currentW, brightest
      ctx.beginPath();
      ctx.moveTo(0, centerY + 0.5);
      ctx.lineTo(currentW, centerY + 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.50)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    requestAnimationFrame(drawRuler);
  })();

}());
