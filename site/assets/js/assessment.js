/* Aquoral Canada: free dry mouth assessment.
   Questions and scoring follow the US assessment (aquoralspray.com/assessment): six Yes/No questions, Yes = 1 point.
   0 = no dry mouth, 1 = mild, 2-3 = moderate, 4-6 = severe.
   Lead capture: set window.AQ_ASSESSMENT_ENDPOINT to a URL that accepts a JSON POST. Until then nothing is sent. */
(() => {
  const form = document.getElementById('qa-form');
  if (!form) return;
  const $ = (s, r = form) => r.querySelector(s), $$ = (s, r = form) => [...r.querySelectorAll(s)];
  const base = document.querySelector('meta[name="aq-base"]')?.content || '';
  const STEPS = ['intro', 'cause', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'details', 'result'];
  const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
  const TOTAL = 8;   // cause + 6 questions + details

  const LEVELS = [
    { name: 'No signs of dry mouth', sum: 'Based on your answers, you may not have dry mouth.',
      symptoms: 'You didn’t report any of the common signs of dry mouth.',
      relief: 'Keep sipping water through the day. If you still think something isn’t right, talk to your pharmacist or dentist.' },
    { name: 'Mild dry mouth', sum: 'Your mouth feels dry now and then, but it isn’t running your day.',
      symptoms: 'Occasional dryness in the mouth, usually without affecting daily activities.',
      relief: 'Symptoms can usually be eased with water or an oral moisturizer like Aquoral when you need it.' },
    { name: 'Moderate dry mouth', sum: 'Dryness is showing up often enough to affect how you eat, talk or sleep.',
      symptoms: 'Frequent dryness that can be uncomfortable and may get in the way of eating or speaking. Over time this can lead to more serious dental issues.',
      relief: 'Regular use of an oral moisturizer or frequent sips of fluid. Some changes to diet or routine may help too.' },
    { name: 'Severe dry mouth', sum: 'Dryness is affecting your daily life. You deserve longer-lasting relief.',
      symptoms: 'Persistent dryness that makes eating, speaking and swallowing uncomfortable. It can make dentures harder to wear and lead to frequent mouth infections.',
      relief: 'Ongoing care, such as a long-lasting protective spray like Aquoral, frequent hydration and regular dental check-ups.' },
  ];
  const ICON = {
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 3 2h3Zm0 0v7"/>',
    speak: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  };
  const TIPS = {
    q3: { ic: 'clock', t: 'Hours, not minutes', d: 'Water helps for a few minutes. Aquoral forms a protective film that keeps moisture in for 4 to 6 hours.', href: 'how-it-works.html', a: 'How it works' },
    q2: { ic: 'moon', t: 'Spray before bed', d: 'One use lasts 4 to 6 hours, so a dose at bedtime can help you sleep more comfortably.', href: 'how-to-use.html', a: 'How to use Aquoral' },
    q4: { ic: 'utensils', t: 'Spray before meals', d: 'Before meals is one of the best moments to use Aquoral, so eating feels more comfortable.', href: 'how-to-use.html', a: 'How to use Aquoral' },
    q5: { ic: 'speak', t: 'Spray before you speak', d: 'Use Aquoral before meetings, calls or long conversations.', href: 'how-to-use.html', a: 'How to use Aquoral' },
  };

  /* Build the Yes/No control into each question step */
  const tpl = document.getElementById('qa-yn');
  $$('[data-question]').forEach(sec => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const h = $('h2', sec);
    node.setAttribute('aria-labelledby', h.id);
    $$('input', node).forEach(i => { i.name = sec.dataset.step; });
    sec.append(node);
  });

  let cur = 'intro', skipped = false;
  const card = form, top = $('.qa-top'), bar = $('.qa-progress'), count = $('.qa-count');

  const answered = q => !!$(`input[name="${q}"]:checked`);
  const firstUnanswered = () => (!$('input[name="cause"]:checked') ? 'cause' : QUESTIONS.find(q => !answered(q)));

  function go(step, { push = true, dir } = {}) {
    if (step === 'result' && firstUnanswered()) step = firstUnanswered();
    const from = STEPS.indexOf(cur), to = STEPS.indexOf(step);
    card.dataset.dir = dir || (to < from ? 'back' : 'fwd');
    $$('.qa-step').forEach(s => s.classList.toggle('is-current', s.dataset.step === step));
    cur = step;
    const n = to;   // cause = 1 ... details = 8
    const showTop = step !== 'intro' && step !== 'result';
    top.hidden = !showTop;
    bar.style.setProperty('--p', Math.max(0, n - 1) / TOTAL + (showTop ? 0.5 / TOTAL : 0));
    bar.setAttribute('aria-valuenow', String(n));
    count.textContent = showTop ? `${n} / ${TOTAL}` : '';
    if (step === 'result') renderResult();
    if (push) history.pushState({ qa: step }, '', '#' + step);
    const h = $(`[data-step="${step}"] [tabindex="-1"]`);
    requestAnimationFrame(() => { h?.focus({ preventScroll: true }); });
    const rect = form.getBoundingClientRect();
    if (rect.top < 0 || rect.top > innerHeight * .4) scrollTo({ top: 0, behavior: 'smooth' });   // the form sits at the top of the page
  }
  const next = () => {
    if (cur === 'cause' && !checkCause()) return;
    go(STEPS[STEPS.indexOf(cur) + 1]);
  };

  /* Tap point for the liquid fill */
  form.addEventListener('pointerdown', e => {
    const el = e.target.closest('.qa-pick, .qa-tile'); if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--x', `${e.clientX - r.left}px`); el.style.setProperty('--y', `${e.clientY - r.top}px`);
  });

  /* Yes / No: auto-advance after a short beat, also when re-tapping an existing answer */
  let advanceT;
  form.addEventListener('click', e => {
    const inp = e.target.closest('.qa-yn input'); if (!inp) return;
    clearTimeout(advanceT);
    advanceT = setTimeout(() => { if (cur === inp.name) next(); }, 420);
  });
  addEventListener('keydown', e => {
    if (!QUESTIONS.includes(cur) || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const v = (k === 'y' || k === '1') ? '1' : (k === 'n' || k === '2') ? '0' : null;
    if (v == null) return;
    const inp = $(`input[name="${cur}"][value="${v}"]`); inp.focus(); inp.click();
  });

  /* Cause: tiles, optional list view (the original dropdown), and "Something else" text */
  const tiles = $('.qa-tiles'), listview = $('.qa-listview'), sel = $('#qa-cause-select'), other = $('.qa-other'), otherIn = $('#qa-cause-other');
  $$('input[name="cause"]').forEach(i => sel.add(new Option(i.closest('label').textContent.trim(), i.value)));
  const syncOther = () => {
    const v = $('input[name="cause"]:checked')?.value;
    other.hidden = v !== 'Other';
    $('#qa-cause-err').hidden = true; tiles.classList.remove('is-error');
    return v;
  };
  form.addEventListener('change', e => {
    if (e.target.name === 'cause') { sel.value = e.target.value; if (syncOther() === 'Other') setTimeout(() => otherIn.focus(), 60); }
  });
  sel.addEventListener('change', () => {
    const i = $$('input[name="cause"]').find(x => x.value === sel.value);
    if (i) i.checked = true; else $$('input[name="cause"]').forEach(x => (x.checked = false));
    if (syncOther() === 'Other') otherIn.focus();
  });
  $('[data-toggle-view]').addEventListener('click', e => {
    const btn = e.currentTarget, list = listview.hidden;
    listview.hidden = !list; tiles.hidden = list;
    btn.setAttribute('aria-pressed', String(list));
    $('span', btn).textContent = list ? 'Show as cards' : 'Show as a list';
  });
  otherIn.addEventListener('input', () => { otherIn.classList.remove('is-invalid'); $('#qa-cause-other-err').hidden = true; });
  function checkCause() {
    const v = $('input[name="cause"]:checked')?.value;
    if (!v) { $('#qa-cause-err').hidden = false; tiles.classList.add('is-error'); return false; }
    if (v === 'Other' && !otherIn.value.trim()) { otherIn.classList.add('is-invalid'); otherIn.setAttribute('aria-describedby', 'qa-cause-other-err'); $('#qa-cause-other-err').hidden = false; otherIn.focus(); return false; }
    return true;
  }

  /* Details validation: errors appear after the first submit, then update as people type */
  const fields = [
    ['#qa-fn', v => v.trim().length > 0],
    ['#qa-ln', v => v.trim().length > 0],
    ['#qa-em', v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())],
    ['#qa-ph', v => !v.trim() || v.replace(/\D/g, '').replace(/^1/, '').length === 10],
  ];
  let tried = false;
  const validate = (focus) => {
    let firstBad = null;
    fields.forEach(([s, ok], idx) => {
      const el = $(s), err = el.parentElement.querySelector('.qa-err'), good = ok(el.value);
      err.id ||= `qa-err-${idx}`;
      el.classList.toggle('is-invalid', !good); el.setAttribute('aria-invalid', String(!good));
      if (!good) el.setAttribute('aria-describedby', err.id); else el.removeAttribute('aria-describedby');
      err.hidden = good; if (!good && !firstBad) firstBad = el;
    });
    if (focus && firstBad) firstBad.focus();
    return !firstBad;
  };
  fields.forEach(([s]) => $(s).addEventListener('input', () => tried && validate(false)));
  $('#qa-ph').addEventListener('blur', e => {   // gentle Canadian format: (416) 555-0123
    const d = e.target.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (d.length === 10) e.target.value = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (cur !== 'details') { if (cur !== 'result' && !QUESTIONS.includes(cur)) next(); return; }
    tried = true;
    if (!validate(true)) return;
    skipped = false; send(); go('result');
  });
  $('[data-skip]').addEventListener('click', () => { skipped = true; go('result'); });

  /* Navigation */
  $$('[data-next]').forEach(b => b.addEventListener('click', next));
  $('[data-back]').addEventListener('click', () => history.back());
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => go(b.dataset.goto)));
  $('[data-restart]').addEventListener('click', () => {
    form.reset(); otherIn.classList.remove('is-invalid'); other.hidden = true; tried = false;
    $$('.qa-err').forEach(x => (x.hidden = true)); $$('.qa-input').forEach(x => x.classList.remove('is-invalid'));
    go('cause');
  });
  addEventListener('popstate', e => {
    const s = e.state?.qa || (STEPS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'intro');
    go(s === 'result' && !answered('q6') ? 'intro' : s, { push: false });
  });
  history.replaceState({ qa: 'intro' }, '', location.pathname + location.search);

  /* Result */
  const score = () => QUESTIONS.reduce((n, q) => n + Number($(`input[name="${q}"]:checked`)?.value || 0), 0);
  const level = s => (s === 0 ? 0 : s === 1 ? 1 : s < 4 ? 2 : 3);
  function renderResult() {
    const s = score(), l = level(s), L = LEVELS[l], res = $('.qa-result');
    res.dataset.level = String(l);
    $('[data-score]', res).textContent = s;
    const fn = $('#qa-fn').value.trim();
    $('.qa-result .qa-kicker').textContent = fn && !skipped ? `Your result, ${fn}` : 'Your result';
    $('[data-level-name]', res).textContent = L.name;
    $('[data-level-sum]', res).textContent = L.sum;
    $('[data-symptoms]', res).textContent = L.symptoms;
    $('[data-relief]', res).textContent = L.relief;
    $$('.qa-scale li', res).forEach(li => li.classList.toggle('is-on', Number(li.dataset.l) === l));
    // Fill the droplet: empty at 0, nearly full at 6
    const lvl = $('.qa-level', res);
    lvl.style.transition = 'none'; lvl.style.transform = 'translateY(150px)';
    requestAnimationFrame(() => requestAnimationFrame(() => { lvl.style.transition = ''; lvl.style.transform = `translateY(${150 - (s === 0 ? 10 : 20 + s * 19)}px)`; }));
    // Personal tips: matching answers first, then the cause page
    const ul = $('[data-tips] ul', res); ul.innerHTML = '';
    const tip = (ic, t, d, href, a) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="qa-res-ic"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICON[ic]}</svg></span><div><b></b><p></p></div>`;
      $('b', li).textContent = t; $('p', li).textContent = d + ' ';
      const link = document.createElement('a'); link.href = base + href; link.textContent = a; $('p', li).append(link);
      ul.append(li);
    };
    ['q3', 'q2', 'q4', 'q5'].filter(q => $(`input[name="${q}"]:checked`)?.value === '1').slice(0, 3).forEach(q => { const t = TIPS[q]; tip(t.ic, t.t, t.d, t.href, t.a + ' →'); });
    const c = $('input[name="cause"]:checked');
    if (c?.dataset.link) tip('book', 'Learn more', `Read our guide to ${c.dataset.topic}.`, c.dataset.link, 'Read the guide →');
    $('[data-tips]', res).hidden = !ul.children.length || l === 0;
    // Discount code only for people who left their email
    $('[data-code]', res).hidden = skipped; $('[data-code-locked]', res).hidden = !skipped;
    $('[data-order-link]', res).href = base + 'order.html' + (skipped ? '' : '?coupon=SURVEY');
    $('[data-proto]', res).hidden = !!window.AQ_ASSESSMENT_ENDPOINT;
  }

  /* Copy code */
  $('[data-copy]').addEventListener('click', async e => {
    const b = e.currentTarget, out = $('[data-copied]', b);
    try { await navigator.clipboard.writeText(b.dataset.copy); out.textContent = 'Copied'; } catch { out.textContent = 'Code: ' + b.dataset.copy; }
    setTimeout(() => (out.textContent = 'Copy'), 2200);
  });

  /* Lead submission (placeholder until a destination is chosen) */
  function send() {
    const url = window.AQ_ASSESSMENT_ENDPOINT; if (!url) return;
    const s = score(), data = {
      firstname: $('#qa-fn').value.trim(), lastname: $('#qa-ln').value.trim(), email: $('#qa-em').value.trim(), phone: $('#qa-ph').value.trim(),
      xerostomia_cause: $('input[name="cause"]:checked')?.value || '', xerostomia_cause_other: otherIn.value.trim(),
      answers: Object.fromEntries(QUESTIONS.map(q => [q, $(`input[name="${q}"]:checked`)?.value === '1' ? 'Yes' : 'No'])),
      score: s, severity: ['none', 'mild', 'moderate', 'severe'][level(s)],
      marketing_opt_in: !!$('input[name="marketing_opt_in"]').checked, page: location.href, submitted_at: new Date().toISOString(),
    };
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true }).catch(() => {});
  }
})();
