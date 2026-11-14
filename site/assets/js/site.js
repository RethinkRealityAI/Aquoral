/* Aquoral Canada: shared page behaviour (menu, reveals, orbit panel, order flow). No dependencies. */
(() => {
  if (new URLSearchParams(location.search).has('review')) document.documentElement.classList.add('review');
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* Mobile menu */
  const menu = $('#mobile-menu'), openBtn = $('.menu-btn');
  const setMenu = open => { menu?.classList.toggle('open', open); openBtn?.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : ''; if (open) $('a', menu)?.focus(); else openBtn?.focus(); };
  openBtn?.addEventListener('click', () => setMenu(true));
  $('.menu-close')?.addEventListener('click', () => setMenu(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu?.classList.contains('open')) setMenu(false); });

  /* Header glass follows the section under it. The whole site follows the theme (Dapo 2026-11-11: a true swap), except the
     inverted panels ([data-island] and inner-page heroes), which are white in the dark theme and navy in the light theme. */
  const header = $('.site-header');
  const inverted = $$('[data-island], .page-hero');
  const onScroll = () => {
    if (!header) return;
    const y = 40, t = document.documentElement.dataset.theme;
    const themeDark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    let inv = false;
    for (const s of inverted) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) { inv = true; break; } }
    const dark = themeDark !== inv;
    header.classList.toggle('on-dark', dark);
    header.classList.toggle('on-light', !dark);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Light / dark theme. No stored choice = follow the device. The <head> script applies a stored choice before
     first paint; this wires the header switch, the menu's Auto / Light / Dark control, and other open tabs. */
  const root = document.documentElement, KEY = 'aq-theme', sysDark = matchMedia('(prefers-color-scheme: dark)');
  const store = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };
  const choice = () => root.dataset.theme || 'system';
  const darkFor = c => c === 'dark' || (c === 'system' && sysDark.matches);
  const syncTheme = () => {
    const c = choice(), d = darkFor(c);
    $$('[data-theme-toggle]').forEach(b => { b.setAttribute('aria-checked', String(d)); b.title = d ? 'Switch to light mode' : 'Switch to dark mode'; });
    $$('[data-theme-set]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeSet === c)));
    $$('.tc-seg').forEach(s => s.style.setProperty('--i', ['system', 'light', 'dark'].indexOf(c)));
    onScroll();
    document.dispatchEvent(new CustomEvent('aq:theme'));
  };
  const setTheme = (v, from) => {
    const apply = () => { if (v === 'system') delete root.dataset.theme; else root.dataset.theme = v; store(v === 'system' ? null : v); syncTheme(); };
    if (!document.startViewTransition || darkFor(choice()) === darkFor(v)) return apply();
    // Liquid reveal: the new theme spreads out from the control like a drop; a soft cross-fade under reduced motion
    const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.add(quiet ? 'theme-fade' : 'theme-wipe');
    const vt = document.startViewTransition(apply);
    if (!quiet) vt.ready.then(() => {
      const r = from && from.offsetParent ? from.getBoundingClientRect() : null;
      const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : 0;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 720, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove('theme-wipe', 'theme-fade'));
  };
  $$('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => setTheme(darkFor(choice()) ? 'light' : 'dark', b)));
  $$('[data-theme-set]').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeSet, b)));
  $$('.tc-seg').forEach(seg => seg.addEventListener('keydown', e => {   // radio group: arrow keys move the choice
    const opts = $$('[data-theme-set]', seg), i = opts.indexOf(document.activeElement), k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (i < 0 || !k) return; e.preventDefault(); const n = opts[(i + k + opts.length) % opts.length]; n.focus(); n.click();
  }));
  sysDark.addEventListener('change', syncTheme);
  addEventListener('storage', e => { if (e.key !== KEY) return; if (e.newValue === 'light' || e.newValue === 'dark') root.dataset.theme = e.newValue; else delete root.dataset.theme; syncTheme(); });
  syncTheme();

  /* Reveal on scroll */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* Hero copy waits for the 3D intro; never longer than 4 s */
  if (!document.querySelector('#stage')) document.documentElement.classList.add('intro-revealed', 'intro-done');
  setTimeout(() => document.documentElement.classList.add('intro-revealed'), 4000);

  /* Anatomy progress bars */
  const anat = $('[data-anatomy]');
  if (anat) {
    const bars = $$('.anatomy-progress i', anat);
    anat.addEventListener('aq:beat', e => bars.forEach((b, i) => b.style.setProperty('--on', i <= e.detail ? 1 : 0)));
  }

  /* Orbit hotspots open a panel */
  const panel = $('.orbit-panel');
  $$('[data-orbit]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.orbit;
    $$('[data-orbit]').forEach(b => b.setAttribute('aria-expanded', String(b === btn)));
    $$('[data-panel]', panel).forEach(p => p.classList.toggle('on', p.dataset.panel === id));
    document.dispatchEvent(new CustomEvent('aq:orbit-open', { detail: true }));
    clearTimeout(btn._t); btn._t = setTimeout(() => document.dispatchEvent(new CustomEvent('aq:orbit-open', { detail: false })), 9000);
    if (matchMedia('(max-width: 1080px)').matches) panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));

  /* Article filters */
  $$('[data-filter]').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $$('[data-cat]').forEach(c => c.hidden = f !== 'all' && !c.dataset.cat.split(' ').includes(f));
  }));

  /* Order flow (placeholder checkout) */
  const order = $('[data-order]');
  if (order) {
    const fmt = n => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
    const qtyOut = $('output[name=qty]', order);
    let qty = 1;
    const update = () => {
      const opt = $('input[name=plan]:checked', order);
      const unit = parseFloat(opt.dataset.price), save = parseFloat(opt.dataset.save || 0);
      const sub = unit * qty, disc = sub * save;
      qtyOut.value = qty;
      $('[data-sum=sub]', order).textContent = fmt(sub);
      $('[data-sum=disc]', order).textContent = disc ? '−' + fmt(disc) : fmt(0);
      $('[data-sum=ship]', order).textContent = sub - disc >= 75 ? 'Free' : 'Calculated at checkout';
      $('[data-sum=total]', order).textContent = fmt(sub - disc);
      $('[data-sum=label]', order).textContent = `${qty} × ${opt.dataset.label}`;
    };
    $$('input[name=plan]', order).forEach(i => i.addEventListener('change', update));
    $('[data-qty=minus]', order).addEventListener('click', () => { qty = Math.max(1, qty - 1); update(); });
    $('[data-qty=plus]', order).addEventListener('click', () => { qty = Math.min(12, qty + 1); update(); });
    const steps = $$('[data-step]', order), stepper = $$('.stepper li', order);
    const go = (n, scroll = true) => { steps.forEach((s, i) => s.hidden = i !== n); stepper.forEach((s, i) => { s.classList.toggle('on', i === n); s.classList.toggle('done', i < n); });
      if (scroll) steps[n].querySelector('h2')?.focus?.({ preventScroll: true }); if (scroll) order.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $$('[data-next]', order).forEach(b => b.addEventListener('click', e => {
      const cur = steps.findIndex(s => !s.hidden), form = steps[cur].querySelector('form') || steps[cur];
      const invalid = $$('input[required], select[required]', form).find(i => !i.checkValidity());
      if (invalid) { invalid.reportValidity(); return; }
      go(cur + 1);
    }));
    $$('[data-back]', order).forEach(b => b.addEventListener('click', () => go(Math.max(0, steps.findIndex(s => !s.hidden) - 1))));
    update(); go(0, false);
  }
})();

// How-it-works clips: poster first, load + play only while on screen.
// Reduced motion: no autoplay; the still frame shows with a play button so the visitor chooses. If the browser
// refuses autoplay (iOS Low Power Mode, data saver) the clip starts on the first tap, or via its play button.
// Tapping a playing clip pauses it (WCAG 2.2.2).
(() => {
  const vids = [...document.querySelectorAll('.viz-vid')]; if (!vids.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onScreen = new Set(), refused = new Set();
  // Blob URL: iOS Safari refuses mp4 from hosts that don't answer byte-range requests; direct src is the fallback
  const load = v => v._src || (v._src = fetch(v.dataset.src).then(r => { if (!r.ok) throw 0; return r.blob(); })
    .then(b => URL.createObjectURL(b.type ? b : new Blob([b], { type: 'video/mp4' }))).catch(() => v.dataset.src)
    .then(u => { v.src = u; v.load(); }));
  const start = v => load(v).then(() => play(v));
  // Autoplay refused (Low Power Mode, data saver) or the video can't decode: swap in the animated WebP, which
  // plays as an image everywhere. Only when motion is welcome; reduced motion keeps the poster + play button.
  const animFallback = v => {
    if (v._anim || !v.dataset.anim) { v.parentElement.classList.add('needs-tap'); return; }
    const img = new Image(); img.className = 'viz-anim'; img.alt = ''; img.decoding = 'async';
    img.onload = () => { v._anim = img; v.parentElement.classList.remove('needs-tap'); v.parentElement.classList.add('is-anim'); };
    img.onerror = () => v.parentElement.classList.add('needs-tap');
    img.src = v.dataset.anim; v.after(img);
  };
  const play = v => {
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    const p = v.play(); if (p && p.then) p.then(() => { refused.delete(v); v.parentElement.classList.remove('needs-tap'); })
      .catch(() => { refused.add(v); if (!reduce && !v._user) animFallback(v); else v.parentElement.classList.add('needs-tap'); });
  };
  for (const v of vids) {
    const img = new Image(); img.onload = () => v.classList.add('is-ready'); img.src = v.poster;
    v.addEventListener('playing', () => v.classList.add('is-ready'));
    v.addEventListener('error', () => { if (!reduce) animFallback(v); });
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'viz-play'; btn.setAttribute('aria-label', 'Play animation');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
    btn.addEventListener('click', e => { e.stopPropagation(); v._user = true; start(v); }); v.parentElement.append(btn);
    v.parentElement.addEventListener('click', () => { if (v.paused) { v._user = true; start(v); } else { v._user = false; v._held = true; v.pause(); v.parentElement.classList.add('needs-tap'); } });

  }
  // Reduced motion: each clip plays through once when it first comes on screen (under 5 s of motion, WCAG 2.2.2),
  // then rests on its last frame with a play button. Everyone else gets the continuous loop.
  const auto = v => !v._held && (!reduce || v._user || !v._once);
  if (reduce) for (const v of vids) { v.loop = false; v.addEventListener('ended', () => { v._once = true; v.parentElement.classList.add('needs-tap'); }); }
  const retry = () => { if (reduce) return; for (const v of refused) if (onScreen.has(v) && auto(v)) start(v); };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, retry, { passive: true });
  if (!('IntersectionObserver' in window)) { if (!reduce) vids.forEach(start); return; }
  const io = new IntersectionObserver(es => { for (const e of es) { const v = e.target;
    if (e.isIntersecting) { onScreen.add(v); if (auto(v)) start(v); } else { onScreen.delete(v); v.pause(); } } }, { rootMargin: '120px 0px', threshold: .15 });
  vids.forEach(v => io.observe(v));
})();

// How-it-works pop-out layer: card 1's mist drifts out past the card edge; card 3's protective film continues
// beyond the card with droplets bouncing under it (never crossing it: moisture held in). Canvas overlays only,
// running while the card is on screen; off under reduced motion.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cards = [...document.querySelectorAll('.mech-card[data-fx]')]; if (!cards.length) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const PAD = { mist: [110, 140, 20, 24], dome: [56, 60, 4, 60] };   // top, right, bottom, left (px beyond the media)
  for (const card of cards) {
    const media = card.querySelector('.viz-media'); if (!media) continue;
    const kind = card.dataset.fx, [pt, pr, pb, pl] = PAD[kind];
    const cv = document.createElement('canvas'); cv.className = 'viz-fx'; cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { top: -pt + 'px', right: -pr + 'px', bottom: -pb + 'px', left: -pl + 'px' });
    media.parentElement.insertBefore(cv, media.nextSibling); media.parentElement.classList.add('has-fx');
    cv.style.top = (media.offsetTop - pt) + 'px'; cv.style.left = (media.offsetLeft - pl) + 'px';
    const ctx = cv.getContext('2d'); let W = 0, H = 0, mw = 0, mh = 0, run = false, raf = 0, last = 0, t = 0;
    const size = () => { mw = media.offsetWidth; mh = media.offsetHeight; W = mw + pl + pr; H = mh + pt + pb;
      cv.style.top = (media.offsetTop - pt) + 'px'; cv.style.left = (media.offsetLeft - pl) + 'px';
      cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr; };
    new ResizeObserver(size).observe(media); size();
    const P = [], sky = '111,194,236';
    const spawnMist = () => { const u = .62 + Math.random() * .38, x = pl + u * mw, y = pt + (.46 - (u - .235) * .5) * mh + (Math.random() - .5) * mh * .16 * u;
      P.push({ x, y, vx: 14 + Math.random() * 30, vy: -6 - Math.random() * 14, r: .6 + Math.random() * 1.9, a: 0, life: 0, max: 2.6 + Math.random() * 2.4, ph: Math.random() * 6 }); };
    const filmY = (x, tt) => { const u = (x - pl) / mw; // film line in canvas px, matching the clip (~60% centre, ~68% edges) with a slow breath
      return pt + mh * (.62 + .07 * Math.pow(Math.abs(u - .5) * 2, 1.6) - .035 * Math.sin(tt * 1.0) * Math.exp(-Math.pow((u - .5) * 2.2, 2))); };
    const spawnDrop = () => { const side = Math.random() < .5 ? -1 : 1, x = side < 0 ? pl * (.15 + Math.random() * .75) : pl + mw + pr * (.1 + Math.random() * .75);
      P.push({ x, y: pt + mh * (.92 + Math.random() * .08), vx: 0, vy: -(18 + Math.random() * 26), r: 1.6 + Math.random() * 2.6, a: 0, life: 0, max: 5 + Math.random() * 3, ph: Math.random() * 6 }); };
    function draw(dt) {
      t += dt; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      if (kind === 'mist') {
        while (P.length < 90) spawnMist();
        for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life += dt;
          p.vx *= Math.pow(.6, dt); p.vy = p.vy * Math.pow(.6, dt) - 3 * dt; p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * 4) * dt; p.y += (p.vy + Math.cos(t * 1.1 + p.ph) * 3) * dt;
          const k = p.life / p.max; if (k >= 1) { P.splice(i, 1); continue; }
          const out = p.x > pl + mw - 10 || p.y < pt + 10 ? 1 : .35;   // brighter once it has left the card
          ctx.fillStyle = `rgba(${sky},${(Math.sin(Math.PI * k) * .75 * out).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
      } else {
        // the film, continued past both card edges, tapering out
        for (const [x0, x1, dir] of [[0, pl + 6, -1], [pl + mw - 6, W, 1]]) {
          const g = ctx.createLinearGradient(x0, 0, x1, 0);
          const edge = dir < 0 ? [0, 1] : [1, 0];
          g.addColorStop(edge[0], 'rgba(163,218,244,0)'); g.addColorStop(edge[1], 'rgba(120,180,240,.85)');
          ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath();
          for (let x = x0; x <= x1; x += 3) { const y = filmY(x, t) + Math.sin(x * .05 + t * 2) * 1.5; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.4; ctx.stroke();
        }
        if (P.length < 10 && Math.random() < dt * 3) spawnDrop();
        for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life += dt; p.vy += 22 * dt; p.y += p.vy * dt; p.x += Math.sin(t + p.ph) * 4 * dt;
          const fy = filmY(p.x, t) + p.r + 5; if (p.y < fy) { p.y = fy; p.vy = Math.abs(p.vy) * .55; }   // bounce off the film, never through it
          if (p.vy > 0 && p.y > pt + mh) p.vy = -(16 + Math.random() * 22);
          const k = p.life / p.max; if (k >= 1) { P.splice(i, 1); continue; }
          const a = Math.sin(Math.PI * k) * .9;
          const g = ctx.createRadialGradient(p.x - p.r * .35, p.y - p.r * .35, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.5, `rgba(${sky},${a * .7})`); g.addColorStop(1, `rgba(37,76,158,${a * .5})`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
      }
    }
    const loop = now => { raf = requestAnimationFrame(loop); const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; draw(dt); };
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !run) { run = true; last = 0; raf = requestAnimationFrame(loop); } else if (!e.isIntersecting && run) { run = false; cancelAnimationFrame(raf); } }).observe(card);
  }
})();

/* Exclusive technology orb: play only while on screen (autoplays under reduced motion too, per Dapo) */
(() => {
  const v = document.querySelector('.tech-vid'); if (!v) return;
  v.muted = true;
  /* 1.2 MB clip far below the fold: fetch it about a screen before it scrolls in, not with the first page load */
  const load = () => { if (v.dataset.src && !v.getAttribute('src')) { v.src = v.dataset.src; v.load(); } };
  if (!('IntersectionObserver' in window)) { load(); v.play().catch(() => {}); return; }
  const near = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { load(); near.disconnect(); } }, { rootMargin: '120% 0px' });
  near.observe(v);
  new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { load(); v.play().catch(() => {}); } else v.pause(); }), { rootMargin: '10% 0px' }).observe(v);
})();

/* The why (video): big play button over the poster; hands over to native controls once playing */
(() => {
  const v = document.querySelector('.film-vid'), b = document.querySelector('.film-play'); if (!v || !b) return;
  const fig = v.closest('.film');
  v.controls = false; // native controls only once playing, so they don't clutter the poster (kept in HTML as a no-JS fallback)
  b.addEventListener('click', () => { v.muted = false; v.play().catch(() => {}); });
  v.addEventListener('play', () => { fig.classList.add('is-playing'); v.controls = true; });
  v.addEventListener('ended', () => { fig.classList.remove('is-playing'); v.controls = false; v.load(); });
  // pause when scrolled well out of view so sound never plays off-screen
  new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting && !v.paused) v.pause(); }), { threshold: 0.15 }).observe(v);
})();
