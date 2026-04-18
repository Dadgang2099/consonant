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
  let tweakScale = 72;
  let tweakYRef  = 791;
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

    const tyPx = -phoneH * 1.1 * ease(slideFraction);

    const cx = W / 2 + tweakXOff;
    const cy = H / 2 + tweakYRef * S + tyPx;

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

      // ── Phase 2: phone crossfade + garage-door scroll-up ──
      if (phoneImg) {
        const p2 = Math.min(Math.max((y - ph1End) / PH2(), 0), 1);

        phoneImg.style.opacity = Math.min(p2 / 0.08, 1);
        video.style.opacity    = 1 - Math.min(Math.max((p2 - 0.04) / 0.11, 0), 1);

        const slideFraction = Math.max((p2 - 0.15) / 0.85, 0);
        const { tx, ty, phoneW } = placePhone(slideFraction);

        phoneImg.style.width     = `${phoneW}px`;
        phoneImg.style.transform = `translate(${tx}px, ${ty}px)`;

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
    const fill  = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.42)';
    const track = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    const min = +input.min, max = +input.max, val = +input.value;
    const pct = ((val - min) / (max - min) * 100).toFixed(1);
    input.style.backgroundImage =
      `linear-gradient(to right, ${fill} ${pct}%, ${track} ${pct}%)`;
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

  // Right-side panels use --hidden class
  [seqPanel, tweakPanel, contentPanel].forEach(p => p?.classList.add('pw-panel--hidden'));
  // Shadow panel: opacity-only control (no --hidden, avoids transform conflict)
  if (shadowPanel) { shadowPanel.style.opacity = '0'; shadowPanel.style.pointerEvents = 'none'; }

  let lastPhase = null;
  function updatePanelVisibility() {
    const ph1End = window.innerHeight * (window._scrollCfg?.ph1Mult || 3);
    const ph2    = window.innerHeight * 3;
    const y      = window.scrollY;
    const p2     = Math.min(Math.max((y - ph1End) / ph2, 0), 1);

    // ── Right-side panel (seq → [gap] → content) ──────────
    const target = y < ph1End ? 'seq' : p2 >= 0.82 ? 'content' : 'none';
    if (target !== lastPhase) {
      lastPhase = target;
      seqPanel?.classList.toggle('pw-panel--hidden',     target !== 'seq');
      tweakPanel?.classList.add('pw-panel--hidden');
      contentPanel?.classList.toggle('pw-panel--hidden', target !== 'content');
    }

    // ── Shadow panel: left side, opacity-driven ────────────
    if (shadowPanel) {
      let opa = 0;
      if (y >= ph1End && p2 < 0.68) {
        if      (p2 < 0.10) opa = p2 / 0.10;              // fade in with phone
        else if (p2 < 0.38) opa = 1;                        // fully visible
        else                 opa = 1 - (p2 - 0.38) / 0.30; // fade as phone lifts
        opa = Math.max(0, Math.min(1, opa));
      }
      // Slide in from left on entry
      const slideX = p2 < 0.10 ? (1 - Math.min(p2 / 0.10, 1)) * -24 : 0;
      shadowPanel.style.opacity        = opa;
      shadowPanel.style.transform      = `translateY(-50%) translateX(${slideX}px)`;
      shadowPanel.style.pointerEvents  = opa < 0.08 ? 'none' : 'auto';
    }
  }
  window.addEventListener('scroll', updatePanelVisibility, { passive: true });
  updatePanelVisibility();

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

  // ── Sequence panel bindings ──────────────────────────────
  function applySeqConfig() {
    const mult = +(document.getElementById('seqSpeed')?.value || 3);
    window._scrollCfg.ph1Mult  = mult;
    window._scrollCfg.lensIn   = +(document.getElementById('seqLensIn')?.value  || 0.2);
    window._scrollCfg.lensOut  = +(document.getElementById('seqLensOut')?.value || 0.8);
    window._scrollCfg.lensPeak = +(document.getElementById('seqLensPeak')?.value || 0.97);
    const driver = document.querySelector('.scroll-driver');
    if (driver) driver.style.height = (mult + 4) * 100 + 'vh';
    lastPhase = null; // force panel re-evaluation after ph1Mult change
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

  function applyShadow() {
    const x    = +(document.getElementById('shadowX')?.value    || 0);
    const y    = +(document.getElementById('shadowY')?.value    || 48);
    const blur = +(document.getElementById('shadowBlur')?.value || 96);
    const opac = +(document.getElementById('shadowOpacity')?.value || 0.60);
    if (phoneImgEl) {
      phoneImgEl.style.filter = `drop-shadow(${x}px ${y}px ${blur}px rgba(0,0,0,${opac}))`;
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

  // ── Pro / Newb toggle ────────────────────────────────────
  const modeToggle = document.getElementById('modeToggle');

  function setMode(mode) {
    const isPro = mode === 'pro';
    modeToggle?.classList.toggle('mode-toggle--newb', !isPro);
    document.querySelectorAll('.mode-toggle__opt').forEach(btn => {
      btn.classList.toggle('mode-toggle__opt--on', btn.dataset.mode === mode);
    });
    contentPanel?.classList.toggle('pw-panel--newb', !isPro);
    document.querySelectorAll('#contentPanel .pw-range').forEach(r => updateTrack(r));
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
    hlSize: 48, hlLineH: 1.05, hlTracking: -0.03, hlWeight: '700',
    bdSize: 17, bdLineH: 1.6,  bdTracking: -0.022, bdWeight: '400',
    cta1: 'Watch the keynote', cta2: 'Watch the film',
    ctaGap: 28, ctaAlign: 'center',
    lockupTop: 38, lockupMaxW: 820, lockupPad: 60, lockupGap: 24,
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
      headline.style.top     = document.getElementById('lockupTop').value + '%';
      headline.style.padding = '0 ' + document.getElementById('lockupPad').value + 'px';
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
  bindSlider('lockupTop',  'lockupTopNum',  fmtPct, applyAll);
  bindSlider('lockupMaxW', 'lockupMaxWNum', fmtPx,  applyAll);
  bindSlider('lockupPad',  'lockupPadNum',  fmtPx,  applyAll);
  bindSlider('lockupGap',  'lockupGapNum',  fmtPx,  applyAll);

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
    set('lockupTop',  defaults.lockupTop);
    set('lockupMaxW', defaults.lockupMaxW);
    set('lockupPad',  defaults.lockupPad);
    set('lockupGap',  defaults.lockupGap);
    document.getElementById('cta1Text').value = defaults.cta1;
    document.getElementById('cta2Text').value = defaults.cta2;
    document.querySelectorAll('#ctaAlignSeg .pw-seg__btn').forEach(b => {
      b.classList.toggle('pw-seg__btn--on', b.dataset.val === defaults.ctaAlign);
    });
    ['hlSize','hlLineH','hlTracking','bdSize','bdLineH','bdTracking',
     'ctaGap','lockupTop','lockupMaxW','lockupPad','lockupGap'].forEach(id => {
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
}());
