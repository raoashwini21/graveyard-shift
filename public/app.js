// Graveyard Shift — interface. Plain browser JavaScript, no build step.
(() => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const fmt = (n) => Number(n).toLocaleString('en-US');

  // ---------- The kinds of ghost ----------
  const KINDS = {
    dead: { n: 'XIII', name: 'The Departed', one: 'dead link', many: 'dead links', color: '#8a2a2e',
      meaning: 'Links to pages that no longer exist. Every reader who clicks one hits a dead end.' },
    possessed: { n: 'XV', name: 'The Possessed', one: 'link taken over', many: 'links taken over', color: '#a0553e',
      meaning: 'Links to one company that now land on another. The product you wrote about was bought, renamed or shut down.' },
    'past-event': { n: 'VI', name: 'The Forgotten Feast', one: 'expired invitation', many: 'expired invitations', color: '#b8925a',
      meaning: 'Invitations to events whose date has passed. The party ended; the invitation is still on the door.' },
    'stale-year': { n: 'X', name: 'The Stopped Clock', one: 'stale year', many: 'stale years', color: '#8c6d43',
      meaning: 'Copyright lines stuck in an old year. Small, but it makes the whole house look abandoned.' },
    nameless: { n: '0', name: 'The Nameless', one: 'page without a title', many: 'pages without a title', color: '#7c7469',
      meaning: 'Pages with no title. Search results and browser tabs have nothing to call them.' },
    chain: { n: 'IX', name: 'The Wanderer', one: 'redirect chain', many: 'redirect chains', color: '#655a50',
      meaning: 'Links that pass through several redirects before arriving. Slower for readers, weaker for search.' },
    speechless: { n: 'II', name: 'The Silent', one: 'page without a description', many: 'pages without a description', color: '#4f4741',
      meaning: 'Pages with no meta description. Search engines will write one for you, usually badly.' },
    locked: { n: 'XX', name: 'The Locked Door', one: 'unverified link', many: 'unverified links', color: 'transparent',
      meaning: 'Links on sites that turn bots away, so they could not be checked. Open the ones that matter yourself.' },
  };
  const ORDER = ['dead', 'possessed', 'past-event', 'stale-year', 'nameless', 'chain', 'speechless', 'locked'];
  const WEIGHT = { dead: 10, possessed: 6, chain: 4, nameless: 6, speechless: 3, 'stale-year': 5, 'past-event': 7, locked: 0 };
  const ghostScore = (g) => Math.round((WEIGHT[g.type] || 0) * Math.min(1 + (g.foundOn.length - 1) * 0.25, 3));
  const rankOf = (s) => (s === 0 ? 'At peace' : s <= 20 ? 'Restless' : s <= 50 ? 'Haunted' : s <= 100 ? 'Infested' : 'Cursed');
  const count = (n, t) => `${fmt(n)} ${n === 1 ? KINDS[t].one : KINDS[t].many}`;

  // ---------- Sound (off by default, synthesised, quiet) ----------
  let audio = null;
  let soundOn = store.get('gs:sound', false);
  const tone = (f, dur, gain = 0.05, slide = null, type = 'sine') => {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(); const g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(f, audio.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, audio.currentTime + dur);
      g.gain.setValueAtTime(gain, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch {}
  };
  const sfx = {
    tick: () => tone(1400 + Math.random() * 200, 0.04, 0.012, null, 'triangle'),
    answer: () => { tone(55, 2.2, 0.22, 40); tone(110, 1.6, 0.04, 82); },
    banish: () => tone(660, 0.7, 0.035, 990),
    restore: () => tone(500, 0.3, 0.025, 380),
  };
  const soundBtn = $('soundBtn');
  const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off'; };
  soundBtn.onclick = () => { soundOn = !soundOn; store.set('gs:sound', soundOn); paintSound(); sfx.tick(); };
  paintSound();

  // ---------- Plain report ----------
  const plainBtn = $('plainBtn');
  const isPlain = () => document.body.classList.contains('plain');
  const setPlain = (on) => { document.body.classList.toggle('plain', on); plainBtn.setAttribute('aria-pressed', String(on)); store.set('gs:plain', on); };
  plainBtn.onclick = () => setPlain(!isPlain());
  setPlain(store.get('gs:plain', false));

  // ---------- The spirit dial ----------
  const C = 260;
  const POS = {};
  const dial = (() => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const parts = [];
    parts.push(`<circle class="ring" cx="${C}" cy="${C}" r="252"/><circle class="ring fine" cx="${C}" cy="${C}" r="242"/>`);
    parts.push(`<circle class="ring fine" cx="${C}" cy="${C}" r="186"/><circle class="ring" cx="${C}" cy="${C}" r="132"/>`);
    letters.forEach((ch, i) => {
      const deg = -90 + (i * 360) / letters.length;
      const a = (deg * Math.PI) / 180;
      const x = C + Math.cos(a) * 214, y = C + Math.sin(a) * 214;
      POS[ch] = { x, y };
      parts.push(`<text class="ch" data-k="${ch}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="27" text-anchor="middle" dominant-baseline="central" transform="rotate(${(deg + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${ch}</text>`);
      const ta = ((deg + 180 / letters.length) * Math.PI) / 180;
      parts.push(`<line class="tick" x1="${C + Math.cos(ta) * 236}" y1="${C + Math.sin(ta) * 236}" x2="${C + Math.cos(ta) * 230}" y2="${C + Math.sin(ta) * 230}"/>`);
    });
    '1234567890'.split('').forEach((ch, i) => {
      const deg = -90 + (i * 360) / 10 + 18;
      const a = (deg * Math.PI) / 180;
      const x = C + Math.cos(a) * 158, y = C + Math.sin(a) * 158;
      POS[ch] = { x, y };
      parts.push(`<text class="ch" data-k="${ch}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="21" text-anchor="middle" dominant-baseline="central">${ch}</text>`);
    });
    const words = { YES: ['Yes', C - 62, C - 18], NO: ['No', C + 62, C - 18], GOODBYE: ['Goodbye', C, C + 62] };
    for (const [k, [label, x, y]] of Object.entries(words)) {
      POS[k] = { x, y };
      parts.push(`<text class="ch word" data-k="${k}" x="${x}" y="${y}" font-size="23" text-anchor="middle" dominant-baseline="central">${label}</text>`);
    }
    parts.push(`<path class="center-mark" d="M${C} ${C - 10} L${C + 10} ${C} L${C} ${C + 10} L${C - 10} ${C}Z"/>`);
    parts.push(`<g class="lens" id="lens"><circle class="glass" r="27"/><circle class="rim" r="27"/><circle class="rim" r="31" stroke-opacity=".35"/>
      <line x1="0" y1="-40" x2="0" y2="-33"/><line x1="0" y1="33" x2="0" y2="40"/><line x1="-40" y1="0" x2="-33" y2="0"/><line x1="33" y1="0" x2="40" y2="0"/></g>`);
    const el = document.createElement('div');
    el.className = 'oracle';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<svg viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
    return el;
  })();
  const lens = dial.querySelector('#lens');
  const chars = {};
  dial.querySelectorAll('.ch').forEach((t) => { chars[t.dataset.k] = t; });
  let litEl = null;
  const point = (key, quiet = false) => {
    const p = key && POS[key] ? POS[key] : { x: C, y: C };
    lens.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (litEl) litEl.classList.remove('lit');
    litEl = key ? chars[key] : null;
    if (litEl) litEl.classList.add('lit');
    if (key && !quiet) sfx.tick();
  };
  point(null, true);

  // ---------- Views ----------
  let current = 'landing';
  const show = (name) => {
    current = name;
    for (const v of ['landing', 'scan', 'report']) $(v).classList.toggle('on', v === name);
    if (name === 'landing') $('heroSlot').appendChild(dial);
    if (name === 'scan') $('scanSlot').appendChild(dial);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Idle: the lens wanders slowly on the landing page, and follows typing.
  let lastTyped = 0;
  let idleTimer = null;
  const idle = () => {
    clearTimeout(idleTimer);
    if (reduceMotion) return;
    idleTimer = setTimeout(() => {
      if (current === 'landing' && Date.now() - lastTyped > 4000) {
        const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        point(keys[Math.floor(Math.random() * keys.length)], true);
      }
      idle();
    }, 2600);
  };
  $('url').addEventListener('input', (e) => {
    lastTyped = Date.now();
    const ch = (e.target.value.slice(-1) || '').toUpperCase();
    if (POS[ch]) point(ch); else if (!e.target.value) point(null, true);
  });

  $('reveals').innerHTML = ORDER.filter((t) => t !== 'locked').map((t) => `<li>
    <span class="num">${KINDS[t].n}</span><span class="name">${KINDS[t].name}</span>
    <span class="kind">${KINDS[t].many[0].toUpperCase() + KINDS[t].many.slice(1)}</span><span class="desc">${KINDS[t].meaning}</span></li>`).join('');
  show('landing');
  idle();

  // ---------- The séance (scan) ----------
  let source = null;
  let spellQ = [];
  let spellTimer = null;
  let word = '';
  let spelled = '';
  let scanHost = '';
  let maxPages = 100;

  const wordFrom = (url, own) => {
    try {
      const u = new URL(url);
      if (!own) return u.hostname.replace(/^www\./, '').split('.')[0];
      const seg = u.pathname.split('/').filter(Boolean).pop();
      return seg ? (seg.split(/[-_.]/).find((w) => /[a-z]{3,}/i.test(w)) || seg) : u.hostname.replace(/^www\./, '').split('.')[0];
    } catch { return ''; }
  };
  const startSpelling = () => {
    const step = () => {
      if (!spellQ.length && word && word !== spelled) {
        spelled = word;
        spellQ = word.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9).split('');
      }
      if (spellQ.length) point(spellQ.shift());
      spellTimer = setTimeout(step, reduceMotion ? 1000 : 460);
    };
    step();
  };
  const stopScan = () => {
    if (source) source.close();
    source = null;
    clearTimeout(spellTimer);
    spellQ = []; word = ''; spelled = '';
    document.body.classList.remove('speaking');
  };
  $('home').onclick = (e) => { e.preventDefault(); stopScan(); show('landing'); };

  const shortPath = (u) => {
    try { const x = new URL(u); return hostOf(u) === scanHost ? (x.pathname === '/' ? '/' : x.pathname) : x.hostname + x.pathname; } catch { return u; }
  };
  const log = (text) => {
    const li = document.createElement('li');
    li.textContent = text;
    const list = $('log');
    list.prepend(li);
    while (list.children.length > 6) list.lastChild.remove();
  };
  const setBar = (f) => { $('bar').style.width = Math.max(2, Math.min(100, f * 100)) + '%'; };

  $('cancel').onclick = () => { stopScan(); show('landing'); $('url').focus(); };

  $('ask').onsubmit = (e) => {
    e.preventDefault();
    const typed = $('url').value.trim();
    const raw = /^http:\/\//i.test(typed) ? typed : typed.replace(/^https:\/\//i, '');
    if (!raw) { $('error').textContent = 'Enter a website address to begin.'; $('url').focus(); return; }
    $('error').textContent = '';
    scanHost = hostOf(/^http:/i.test(raw) ? raw : 'https://' + raw);
    maxPages = Number($('maxPages').value);
    $('scanHost').textContent = scanHost;
    $('scanPhase').textContent = 'The spirits are gathering.';
    $('cPages').textContent = '0';
    $('cLinks').textContent = '0';
    $('log').innerHTML = '';
    setBar(0);
    show('scan');
    word = scanHost.split('.')[0];
    startSpelling();

    const qs = new URLSearchParams({ url: raw, maxPages: String(maxPages), external: $('external').checked ? '1' : '0' });
    source = new EventSource('/api/scan?' + qs);
    source.addEventListener('progress', (m) => {
      const d = JSON.parse(m.data);
      if (d.type === 'phase' && d.phase === 'knocking') $('scanPhase').textContent = 'Knocking on the front door.';
      if (d.type === 'phase' && d.phase === 'reading the map') $('scanPhase').textContent = 'Reading the map of the house.';
      if (d.type === 'page') {
        $('scanPhase').textContent = 'Walking every room.';
        $('cPages').textContent = fmt(d.pagesScanned);
        setBar(0.4 * (d.pagesScanned / maxPages));
        log(shortPath(d.url));
        word = wordFrom(d.url, true);
      }
      if (d.type === 'link') {
        $('scanPhase').textContent = 'Knocking on every door.';
        $('cLinks').textContent = fmt(d.linksChecked);
        setBar(0.4 + 0.6 * (d.linksChecked / Math.max(1, d.linksTotal)));
        if (d.linksChecked % 3 === 0) log(shortPath(d.url));
        if (d.linksChecked % 5 === 0) word = wordFrom(d.url, hostOf(d.url) === scanHost);
      }
    });
    source.addEventListener('done', (m) => { const r = JSON.parse(m.data); stopScan(); setBar(1); answer(r); });
    source.addEventListener('fail', (m) => { stopScan(); show('landing'); $('error').textContent = JSON.parse(m.data).message; });
    source.onerror = () => {
      if (!source) return;
      stopScan(); show('landing');
      $('error').textContent = 'Lost the connection to the scanner. Check it is still running in your terminal, then try again.';
    };
  };

  // ---------- The answer ----------
  let state = { result: null, banished: new Set(), initialScore: 0 };
  const answer = async (result) => {
    state.result = result;
    state.banished = new Set(store.get('gs:banished:' + result.site, []));
    state.initialScore = result.ghosts.reduce((n, g) => n + ghostScore(g), 0);
    const n = result.ghostCount;
    if (isPlain() || reduceMotion) { renderReport(); return; }

    document.body.classList.add('speaking');
    $('scanPhase').textContent = 'Spirits, how many ghosts walk this house?';
    point(null, true);
    let skip = false;
    const onSkip = () => { skip = true; };
    document.addEventListener('click', onSkip, { once: true });
    document.addEventListener('keydown', onSkip, { once: true });
    const wait = (ms) => (skip ? Promise.resolve() : sleep(ms));
    await wait(1100);
    if (n) { for (const d of String(n)) { point(d); await wait(820); } }
    point(n ? 'YES' : 'NO');
    sfx.answer();
    $('scanPhase').textContent = n ? `The spirits have spoken: ${fmt(n)} ghost${n === 1 ? '' : 's'}.` : 'The spirits have spoken: the house is at peace.';
    await wait(1700);
    document.removeEventListener('click', onSkip);
    document.removeEventListener('keydown', onSkip);
    document.body.classList.remove('speaking');
    renderReport();
  };

  // ---------- The report ----------
  const own = (u) => hostOf(u) === hostOf(state.result.site);
  const shortUrl = (u) => {
    if (!u) return '';
    if (u === 'sitemap.xml') return 'your sitemap';
    try { const x = new URL(u); if (!own(u)) return u.replace(/^https?:\/\//, '').replace(/\/$/, ''); return x.pathname === '/' && !x.search ? 'home page' : x.pathname + x.search; } catch { return u; }
  };
  const all = (t) => state.result.ghosts.filter((g) => g.type === t);
  const alive = (t) => all(t).filter((g) => !state.banished.has(g.id));
  const aliveAll = () => state.result.ghosts.filter((g) => g.type !== 'locked' && !state.banished.has(g.id));
  const scoreNow = () => aliveAll().reduce((n, g) => n + ghostScore(g), 0);
  const present = () => ORDER.filter((t) => all(t).length);

  const statusTag = (g) => {
    const d = g.detail || {};
    if (g.type === 'dead') {
      if (d.error === 'malformed') return 'broken address';
      if (d.error === 'ENOTFOUND') return 'domain gone';
      if (d.status) return String(d.status);
    }
    if (g.type === 'chain') return /loop/i.test(g.label) ? 'redirect loop' : `${d.hops ? d.hops.length : 0} hops`;
    if (g.type === 'possessed' && d.finalUrl) return `now lands on ${hostOf(d.finalUrl)}`;
    if (g.type === 'locked') return d.reason || (d.status ? `status ${d.status}` : 'no answer');
    return '';
  };

  const rowHtml = (g) => {
    const subjectUrl = ['stale-year', 'past-event'].includes(g.type) ? null : g.url;
    const linkable = subjectUrl && /^https?:/.test(subjectUrl) && !/^https?:\/\/[^./]+\/?$/.test(subjectUrl);
    const target = g.quote
      ? `<p class="target quote">“${esc(g.quote)}”</p>`
      : linkable
        ? `<a class="target" href="${esc(subjectUrl)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(subjectUrl))}</a>`
        : `<p class="target">${esc(g.detail && g.detail.error === 'malformed' ? g.url : shortUrl(g.url))}</p>`;
    const where = g.foundOn.length === 1
      ? `Found on ${esc(shortUrl(g.foundOn[0]))}`
      : `<details><summary>Found on ${g.foundOn.length} pages</summary><ul>${g.foundOn.map((p) => `<li>${esc(shortUrl(p))}</li>`).join('')}</ul></details>`;
    const tag = statusTag(g);
    const page = g.foundOn.find((p) => /^https?:/.test(p));
    const rested = state.banished.has(g.id);
    const conf = g.confidence === 'maybe' ? 'Likely, worth a look' : g.confidence === 'unverified' ? 'Could not be checked' : 'Confirmed';
    return `<li class="row${rested ? ' rested' : ''}" data-id="${esc(g.id)}" data-conf="${esc(g.confidence)}">
      <span class="sev" title="${conf}"></span>
      <div class="main">
        ${target}
        <p class="sub">${where}${tag ? ` <span class="tag">· ${esc(tag)}</span>` : ''}${g.confidence === 'maybe' ? ' <span class="tag">· likely</span>' : ''}</p>
        ${g.type === 'locked' ? '' : `<p class="fix"><b>Fix</b>${esc(g.fix)}</p>`}
      </div>
      <div class="acts">
        ${page ? `<a class="btn ghost small" href="${esc(page)}" target="_blank" rel="noopener noreferrer">Open page</a>` : ''}
        ${g.type === 'locked' ? '' : `<button class="btn ghost small" data-toggle="${esc(g.id)}" type="button">${rested ? 'Restore' : 'Banish'}</button>`}
      </div>
    </li>`;
  };

  const groupHtml = (t) => {
    const k = KINDS[t];
    return `<section class="group${t === 'locked' ? ' locked' : ''}" id="g-${t}">
      <header class="group-head">
        <span class="n">${k.n}</span><h2>${k.name}</h2><span class="count" data-count="${t}"></span>
        <p class="meaning">${k.meaning}</p>
      </header>
      <ol class="rows">${all(t).map(rowHtml).join('')}</ol>
    </section>`;
  };

  let countAnim = null;
  const countTo = (el, to) => {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    cancelAnimationFrame(countAnim);
    if (reduceMotion || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) countAnim = requestAnimationFrame(step);
    };
    countAnim = requestAnimationFrame(step);
  };

  const paintPlain = () => {
    const rows = aliveAll().map((g) => `<tr><td>${esc(g.name)}${g.confidence === 'maybe' ? ' (likely)' : ''}</td>
      <td>${esc(g.quote ? '“' + g.quote + '”' : shortUrl(g.url))}</td>
      <td>${esc(shortUrl(g.foundOn[0]))}${g.foundOn.length > 1 ? ` and ${g.foundOn.length - 1} more` : ''}</td>
      <td>${esc(g.fix)}</td></tr>`).join('');
    const locked = state.result.lockedCount;
    $('plainTable').innerHTML = (rows
      ? `<table><thead><tr><th>Problem</th><th>Link or text</th><th>Found on</th><th>Fix</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p>No problems found.</p>') + (locked ? `<p>${fmt(locked)} link${locked === 1 ? '' : 's'} could not be checked because those sites block bots.</p>` : '');
  };

  const paintSummary = () => {
    const r = state.result;
    const s = scoreNow();
    const left = aliveAll().length;
    $('vWord').textContent = left ? `${rankOf(s)}.` : 'At peace.';
    const top = ORDER.filter((t) => t !== 'locked' && alive(t).length).slice(0, 2);
    $('vLine').textContent = left
      ? `${fmt(left)} ghost${left === 1 ? '' : 's'} walk these pages. ${top.length ? 'Start with the ' + top.map((t) => count(alive(t).length, t)).join(', then the ') + '.' : ''}${state.banished.size ? ` You have banished ${fmt(state.banished.size)}.` : ''}`
      : r.ghostCount ? 'Every ghost has been banished. Run the séance again after you publish your fixes to confirm they stay gone.' : 'Nothing has died on the pages we walked. Links rot quietly, so come back in a few weeks.';
    countTo($('vScore'), s);
    $('spectrum').innerHTML = ORDER.filter((t) => t !== 'locked').map((t) => {
      const w = alive(t).reduce((n, g) => n + ghostScore(g), 0);
      return w ? `<span style="flex-grow:${w};background:${KINDS[t].color}" title="${esc(KINDS[t].name)}"></span>` : '';
    }).join('') || '<span style="flex-grow:1;background:var(--sage);opacity:.5"></span>';
    $('toc').innerHTML = present().map((t) => {
      const n = t === 'locked' ? all(t).length : alive(t).length;
      return `<a href="#g-${t}" class="${n || t === 'locked' ? '' : 'clear'}"><span class="n">${KINDS[t].n}</span><span>${KINDS[t].name}</span><span class="c">${n || t === 'locked' ? fmt(n) : 'Clear'}</span></a>`;
    }).join('');
    document.querySelectorAll('[data-count]').forEach((el) => {
      const t = el.dataset.count;
      const n = t === 'locked' ? all(t).length : alive(t).length;
      el.textContent = n || t === 'locked' ? count(n, t) : 'All laid to rest';
    });
    const peace = $('peaceBlock');
    if (peace) peace.hidden = left > 0;
    paintPlain();
  };

  const renderReport = () => {
    const r = state.result;
    $('rHost').textContent = hostOf(r.site);
    const date = new Date(r.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    $('rMeta').textContent = `${fmt(r.pagesScanned)} pages walked, ${fmt(r.linksChecked)} links checked, ${date}`;
    $('vScore').dataset.v = 0;
    $('findings').innerHTML = `<div class="peace" id="peaceBlock" hidden><h2>The house is at peace.</h2><p>Nothing left to banish on the pages we walked.</p></div>`
      + present().map(groupHtml).join('');
    const l = r.limits || {};
    const notes = [];
    if (l.pagesCapped) notes.push(`The séance stopped after ${fmt(l.maxPages)} pages. The terminal version can walk the whole site with --max-pages.`);
    if (l.linksCapped) notes.push(`${fmt(r.linksChecked)} of ${fmt(l.linksTotal)} links were checked, your own first.`);
    if (l.robotsSkipped) notes.push(`${fmt(l.robotsSkipped)} page${l.robotsSkipped === 1 ? ' was' : 's were'} skipped because your robots.txt asks bots to stay out.`);
    $('limits').innerHTML = notes.map((t) => `<p>${esc(t)}</p>`).join('');
    $('limits').hidden = !notes.length;
    show('report');
    paintSummary();
  };

  $('findings').addEventListener('click', (e) => {
    const b = e.target.closest('[data-toggle]');
    if (!b) return;
    const id = b.dataset.toggle;
    const row = b.closest('.row');
    if (state.banished.has(id)) { state.banished.delete(id); sfx.restore(); } else { state.banished.add(id); sfx.banish(); }
    store.set('gs:banished:' + state.result.site, [...state.banished]);
    const rested = state.banished.has(id);
    row.classList.toggle('rested', rested);
    b.textContent = rested ? 'Restore' : 'Banish';
    paintSummary();
  });

  $('again').onclick = () => { show('landing'); point(null, true); $('url').select(); $('url').focus(); };

  // ---------- Downloads ----------
  const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const exportAs = async (format) => {
    const res = await fetch('/api/export?format=' + format, { method: 'POST', body: JSON.stringify(state.result) });
    if (res.ok) download(await res.blob(), `ghosts-${hostOf(state.result.site)}.${format === 'csv' ? 'csv' : 'md'}`);
  };
  $('exportMd').onclick = () => exportAs('md');
  $('exportCsv').onclick = () => exportAs('csv');

  // ---------- Share card ----------
  const loadImg = (svg) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
  $('share').onclick = async () => {
    const r = state.result;
    try { await Promise.all(['500 72px "Cormorant Garamond"', 'italic 500 64px "Cormorant Garamond"', '500 20px Inter', '400 18px Inter', '200 96px Inter'].map((f) => document.fonts.load(f))); } catch {}
    const W = 1200, H = 630, S = 2;
    const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    const x = c.getContext('2d'); x.scale(S, S);
    x.fillStyle = '#0c0b0b'; x.fillRect(0, 0, W, H);
    const warm = x.createRadialGradient(920, 300, 20, 920, 300, 520);
    warm.addColorStop(0, 'rgba(138,42,46,.20)'); warm.addColorStop(1, 'rgba(138,42,46,0)');
    x.fillStyle = warm; x.fillRect(0, 0, W, H);
    const grain = await loadImg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
    if (grain) { x.globalAlpha = .05; x.drawImage(grain, 0, 0, W, H); x.globalAlpha = 1; }

    const host = hostOf(r.site);
    const left = aliveAll().length;
    const s = scoreNow();
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = '#b8925a'; x.font = '500 18px Inter, sans-serif';
    x.fillText('A reading for', 80, 112);
    x.fillStyle = '#e8e0d0';
    let fs = 76; x.font = `500 ${fs}px "Cormorant Garamond", Georgia, serif`;
    while (x.measureText(host).width > 600 && fs > 36) { fs -= 2; x.font = `500 ${fs}px "Cormorant Garamond", Georgia, serif`; }
    x.fillText(host, 78, 182);
    x.font = 'italic 500 60px "Cormorant Garamond", Georgia, serif';
    x.fillText(left ? `${rankOf(s)}.` : 'At peace.', 78, 268);
    x.fillStyle = '#b8ae9e'; x.font = '400 18px Inter, sans-serif';
    x.fillText(left ? `${fmt(left)} ghost${left === 1 ? '' : 's'} across ${fmt(r.pagesScanned)} pages walked` : `${fmt(r.pagesScanned)} pages walked, nothing dead`, 80, 306);

    const kinds = ORDER.filter((t) => t !== 'locked' && alive(t).length).sort((a, b) => alive(b).length - alive(a).length).slice(0, 4);
    const maxN = Math.max(1, ...kinds.map((t) => alive(t).length));
    kinds.forEach((t, i) => {
      const y = 366 + i * 46;
      x.fillStyle = '#e8e0d0'; x.font = '500 16px Inter, sans-serif'; x.textAlign = 'left';
      x.fillText(KINDS[t].many[0].toUpperCase() + KINDS[t].many.slice(1), 80, y);
      x.textAlign = 'right'; x.fillStyle = '#b8925a'; x.font = '500 18px Inter, sans-serif';
      x.fillText(fmt(alive(t).length), 560, y);
      x.fillStyle = 'rgba(232,224,208,.12)'; x.fillRect(80, y + 12, 480, 1);
      x.fillStyle = KINDS[t].color === '#4f4741' ? '#7c7469' : KINDS[t].color;
      x.fillRect(80, y + 11, 480 * (alive(t).length / maxN), 3);
    });

    const cx = 925, cy = 315;
    x.strokeStyle = 'rgba(232,224,208,.16)'; x.lineWidth = 1;
    [212, 204, 150, 112].forEach((rad, i) => { x.globalAlpha = i % 2 ? .6 : 1; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.stroke(); });
    x.globalAlpha = 1;
    x.font = '500 22px "Cormorant Garamond", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const litLetter = (host.match(/[a-z]/i) || ['A'])[0].toUpperCase();
    let lensAt = null;
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 26;
      const px = cx + Math.cos(a) * 180, py = cy + Math.sin(a) * 180;
      x.save(); x.translate(px, py); x.rotate(a + Math.PI / 2);
      x.fillStyle = ch === litLetter ? '#e8e0d0' : 'rgba(232,224,208,.3)';
      x.fillText(ch, 0, 0); x.restore();
      if (ch === litLetter) lensAt = [px, py];
    });
    if (lensAt) {
      x.strokeStyle = '#b8925a'; x.lineWidth = 1.4; x.beginPath(); x.arc(lensAt[0], lensAt[1], 22, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = .4; x.beginPath(); x.arc(lensAt[0], lensAt[1], 26, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
    }
    x.fillStyle = '#e8e0d0'; x.font = '200 96px Inter, sans-serif';
    x.fillText(fmt(left), cx, cy - 10);
    x.fillStyle = '#b8ae9e'; x.font = 'italic 500 26px "Cormorant Garamond", Georgia, serif';
    x.fillText(left === 1 ? 'ghost' : 'ghosts', cx, cy + 52);

    x.textBaseline = 'alphabetic';
    x.fillStyle = 'rgba(232,224,208,.12)'; x.fillRect(80, 548, W - 160, 1);
    x.textAlign = 'left'; x.fillStyle = '#e8e0d0'; x.font = 'italic 500 24px "Cormorant Garamond", Georgia, serif';
    x.fillText('Graveyard Shift', 80, 584);
    x.textAlign = 'right'; x.fillStyle = '#7c7469'; x.font = '400 15px Inter, sans-serif';
    x.fillText('github.com/raoashwini21/graveyard-shift', W - 80, 584);
    c.toBlob((b) => b && download(b, `graveyard-shift-${host}.png`), 'image/png');
  };
})();
