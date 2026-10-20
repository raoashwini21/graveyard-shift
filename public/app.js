// Graveyard Shift: a séance for your website. Plain browser JavaScript, no build step.
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

  // ---------- The arcana: one tarot card per kind of ghost ----------
  const B = '#d9a441', E = '#9fe8c6', D = '#14060d';
  const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" fill="none" stroke="${B}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ghostShape = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" stroke="${E}"><path d="M0 0 c-9 0-13 8-13 17 v15 l4.3-4 4.3 4 4.4-4 4.3 4 4.4-4 4.3 4 v-15 c0-9-4-17-13-17z" fill="${E}" fill-opacity=".12"/><circle cx="-4.5" cy="14" r="1.6" fill="${E}"/><circle cx="4.5" cy="14" r="1.6" fill="${E}"/></g>`;
  const ARCANA = {
    dead: {
      numeral: 'XIII', name: 'The Departed', plural: ['dead link', 'dead links'],
      meaning: 'Links to pages that no longer exist. Anyone who clicks them hits a dead end.',
      art: svg(`<rect x="10" y="66" width="38" height="20" rx="10" transform="rotate(-35 29 76)"/><rect x="52" y="82" width="38" height="20" rx="10" transform="rotate(-35 71 92)"/><path d="M44 80 l5-6 2 7 5-6" stroke="${E}"/>${ghostShape(50, 14, 1)}`),
    },
    possessed: {
      numeral: 'XV', name: 'The Possessed', plural: ['possessed link', 'possessed links'],
      meaning: 'Links to one company that now land on another. The tool you wrote about was bought, renamed or taken over.',
      art: svg(`<path d="M28 106 V54 a22 22 0 0 1 44 0 V106 Z"/><path d="M36 28 l-8-14 M64 28 l8-14"/><ellipse cx="42" cy="64" rx="4" ry="6.5" fill="${E}" stroke="${E}"/><ellipse cx="58" cy="64" rx="4" ry="6.5" fill="${E}" stroke="${E}"/><path d="M40 84 q10 8 20 0" stroke="${E}"/><path d="M18 106 h64"/>`),
    },
    chain: {
      numeral: 'IX', name: 'The Wanderer', plural: ['redirect chain', 'redirect chains'],
      meaning: 'Links that bounce through several redirects before they arrive. Slower for readers, and search engines trust them less.',
      art: svg(`<path d="M50 110 c-34 0-40-32-12-36 c24-3 28 20 7 22 c-13 1-13-12-2-13" stroke-dasharray="3 6"/><path d="M50 10 v8"/><path d="M42 18 h16 l4 6 v24 l-4 6 h-16 l-4-6 v-24 z"/><circle cx="50" cy="36" r="6" fill="${E}" stroke="${E}" fill-opacity=".8"/><path d="M38 24 h24 M38 48 h24" opacity=".6"/>`),
    },
    nameless: {
      numeral: '0', name: 'The Nameless', plural: ['nameless page', 'nameless pages'],
      meaning: 'Pages with no title. Search results and browser tabs have nothing to call them.',
      art: svg(`<path d="M50 12 c-22 0-32 24-30 50 l-10 48 h80 l-10-48 c2-26-8-50-30-50z" fill="${B}" fill-opacity=".08"/><ellipse cx="50" cy="52" rx="13" ry="18" fill="${D}" stroke-dasharray="4 4"/><path d="M30 80 q20 10 40 0" opacity=".5"/>`),
    },
    speechless: {
      numeral: 'II', name: 'The Silent', plural: ['silent page', 'silent pages'],
      meaning: 'Pages with no meta description. Search engines will invent one for you.',
      art: svg(`<path d="M16 62 c10-16 22-16 34-8 c12-8 24-8 34 8 c-12 18-56 18-68 0z" fill="${B}" fill-opacity=".08"/><path d="M16 62 h68"/><path d="M28 54 v16 M39 52 v20 M50 53 v18 M61 52 v20 M72 54 v16" stroke="${E}"/>${ghostShape(50, 14, .55)}`),
    },
    'stale-year': {
      numeral: 'X', name: 'The Stopped Clock', plural: ['stale year', 'stale years'],
      meaning: 'Copyright lines still stuck in an old year. Visitors notice, and it makes the whole site look abandoned.',
      art: svg(`<circle cx="50" cy="60" r="32"/><circle cx="50" cy="60" r="26" opacity=".4"/><path d="M50 60 V40 M50 60 l14 9"/><circle cx="50" cy="60" r="2.5" fill="${B}"/><path d="M50 32 v4 M78 60 h-4 M50 88 v-4 M22 60 h4"/><path d="M70 36 l-8 10 7 5 -6 10" stroke="${E}"/><path d="M42 18 h16 M50 18 v10"/>`),
    },
    'past-event': {
      numeral: 'VI', name: 'The Forgotten Feast', plural: ['past event', 'past events'],
      meaning: 'Invitations to events whose date has already passed. The party ended, but the invite is still up.',
      art: svg(`<rect x="22" y="70" width="56" height="32" rx="3"/><path d="M22 80 c8 6 12-4 19 2 s11-4 18 2 s11-6 19 0"/><path d="M50 70 V50"/><path d="M50 46 c-5-7 5-9 0-17 c-4-6 3-8 1-14" stroke="${E}" opacity=".85"/><path d="M8 8 l22 22 M8 8 l28 6 M8 8 l6 28 M14 20 q6 0 8-6 M12 30 q12-2 16-14" opacity=".7"/>`),
    },
    locked: {
      numeral: 'XX', name: 'The Locked Door', plural: ['locked door', 'locked doors'],
      meaning: "Links on sites that block bots, so the spirits couldn't get in. Open the ones that matter yourself.",
      art: svg(`<path d="M26 108 V48 a24 24 0 0 1 48 0 V108 Z" fill="${B}" fill-opacity=".06"/><path d="M42 30 V108 M58 30 V108" opacity=".45"/><circle cx="64" cy="76" r="4.5" fill="${E}" stroke="${E}"/><path d="M64 80 l-3 11 h6 z" fill="${E}" stroke="${E}"/><path d="M16 108 h68"/>`),
    },
  };
  const ORDER = ['dead', 'possessed', 'past-event', 'stale-year', 'nameless', 'chain', 'speechless', 'locked'];
  const WEIGHT = { dead: 10, possessed: 6, chain: 4, nameless: 6, speechless: 3, 'stale-year': 5, 'past-event': 7, locked: 0 };
  const ghostScore = (g) => Math.round((WEIGHT[g.type] || 0) * Math.min(1 + (g.foundOn.length - 1) * 0.25, 3));
  const rankOf = (s) => (s === 0 ? 'At peace' : s <= 20 ? 'Restless' : s <= 50 ? 'Haunted' : s <= 100 ? 'Infested' : 'Cursed');
  const kinds = (n, t) => `${n} ${ARCANA[t].plural[n === 1 ? 0 : 1]}`;

  // ---------- Sound (off by default; made in the browser) ----------
  let audio = null;
  let soundOn = store.get('gs:sound', false);
  const tone = (freq, dur, type = 'sine', gain = 0.12, slideTo = null) => {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(); const g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audio.currentTime + dur);
      g.gain.setValueAtTime(gain, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + dur);
    } catch {}
  };
  const sounds = {
    tick: () => tone(180 + Math.random() * 40, 0.08, 'triangle', 0.05),
    answer: () => { tone(60, 1.6, 'sine', 0.3, 38); tone(240, 1.2, 'sine', 0.04, 120); },
    flip: () => tone(660, 0.25, 'sine', 0.05, 990),
    banish: () => { tone(520, 0.5, 'sine', 0.07, 1040); setTimeout(() => tone(780, 0.6, 'sine', 0.04, 1560), 90); },
    goodbye: () => [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 1.6, 'sine', 0.05), i * 220)),
  };
  const soundBtn = $('sound');
  const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off'; };
  soundBtn.onclick = () => { soundOn = !soundOn; store.set('gs:sound', soundOn); paintSound(); sounds.tick(); };
  paintSound();

  // ---------- Boring mode ----------
  const boringBtn = $('boring');
  const isBoring = () => document.body.classList.contains('boring');
  const setBoring = (on) => { document.body.classList.toggle('boring', on); boringBtn.setAttribute('aria-pressed', String(on)); store.set('gs:boring', on); };
  boringBtn.onclick = () => setBoring(!isBoring());
  setBoring(store.get('gs:boring', false));

  // ---------- The board ----------
  const POS = {};
  const arc = (chars, cx, cy, rx, ry, a0, a1) => chars.split('').forEach((c, i) => {
    const deg = a0 + ((a1 - a0) * i) / (chars.length - 1);
    const a = (deg * Math.PI) / 180;
    POS[c] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), r: deg + 90 };
  });
  arc('ABCDEFGHIJKLM', 50, 79, 41, 47, 200, 340);
  arc('NOPQRSTUVWXYZ', 50, 87, 33, 36, 206, 334);
  '1234567890'.split('').forEach((c, i) => { POS[c] = { x: 30 + i * 4.4, y: 73, r: 0 }; });
  POS.YES = { x: 13, y: 12, r: 0 };
  POS.NO = { x: 87, y: 12, r: 0 };
  POS.GOODBYE = { x: 50, y: 82, r: 0 };
  const REST = { x: 50, y: 58 };

  const letters = $('letters');
  const spans = {};
  for (const [k, p] of Object.entries(POS)) {
    const s = document.createElement('span');
    s.textContent = k === 'GOODBYE' ? 'Good Bye' : k === 'YES' ? 'Yes' : k === 'NO' ? 'No' : k;
    s.className = /\d/.test(k) ? 'num' : k.length > 1 ? 'word' : '';
    s.style.left = p.x + '%';
    s.style.top = p.y + '%';
    s.style.setProperty('--r', p.r + 'deg');
    letters.appendChild(s);
    spans[k] = s;
  }
  [['☼', 5, 22], ['☾', 95, 22]].forEach(([g, x, y]) => {
    const s = document.createElement('span');
    s.textContent = g; s.className = g === '☼' ? 'sun' : 'moon';
    s.style.left = x + '%'; s.style.top = y + '%';
    letters.appendChild(s);
  });

  const planchette = $('planchette');
  let lit = null;
  const moveTo = (key) => {
    const p = key && POS[key] ? POS[key] : REST;
    planchette.style.left = p.x + '%';
    planchette.style.top = p.y + '%';
    planchette.style.setProperty('--tilt', (key ? (Math.random() * 14 - 7) : 0) + 'deg');
    if (lit) lit.classList.remove('lit');
    lit = key ? spans[key] : null;
    if (lit) lit.classList.add('lit');
    if (key) sounds.tick();
  };
  moveTo(null);

  // Typing guides the planchette
  $('url').addEventListener('input', (e) => {
    const ch = (e.target.value.slice(-1) || '').toUpperCase();
    if (POS[ch]) moveTo(ch);
    else if (!e.target.value) moveTo(null);
  });

  // ---------- The séance (scan) ----------
  let source = null;
  let spellQueue = [];
  let spellTimer = null;
  let latestWord = '';
  let lastSpelled = '';
  const wordFrom = (url, own) => {
    try {
      const u = new URL(url);
      if (!own) return u.hostname.replace(/^www\./, '').split('.')[0];
      const seg = u.pathname.split('/').filter(Boolean).pop();
      return seg ? seg.split(/[-_.]/).find((w) => /[a-z]{3,}/i.test(w)) || seg : u.hostname.replace(/^www\./, '').split('.')[0];
    } catch { return ''; }
  };
  const startSpelling = () => {
    const step = () => {
      if (!spellQueue.length && latestWord && latestWord !== lastSpelled) {
        lastSpelled = latestWord;
        spellQueue = latestWord.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9).split('');
      }
      if (spellQueue.length) moveTo(spellQueue.shift());
      spellTimer = setTimeout(step, reduceMotion ? 900 : 430);
    };
    step();
  };
  const stopSpelling = () => { clearTimeout(spellTimer); spellTimer = null; spellQueue = []; latestWord = ''; lastSpelled = ''; };

  const endSeance = () => {
    if (source) source.close();
    source = null;
    stopSpelling();
    document.body.classList.remove('scanning', 'darkroom', 'spirits');
  };
  $('cancel').onclick = () => { endSeance(); moveTo(null); $('url').focus(); };

  let state = { result: null, banished: new Set(), chosen: null, initialScore: 0 };
  let scanHost = '';

  $('ask').onsubmit = (e) => {
    e.preventDefault();
    const url = $('url').value.trim();
    if (!url) return;
    $('error').textContent = '';
    try { scanHost = hostOf(/^https?:/i.test(url) ? url : 'https://' + url); } catch { scanHost = url; }
    document.body.classList.remove('read', 'peace');
    $('spoken').classList.remove('on');
    $('spoken').textContent = '';
    document.body.classList.add('scanning', 'spirits');
    $('tranceLine').textContent = 'The spirits are gathering…';
    $('trancePath').textContent = '';
    $('tranceCount').textContent = '';
    latestWord = scanHost.split('.')[0];
    startSpelling();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

    const qs = new URLSearchParams({ url, maxPages: $('maxPages').value, external: $('external').checked ? '1' : '0' });
    source = new EventSource('/api/scan?' + qs);
    source.addEventListener('progress', (m) => {
      const d = JSON.parse(m.data);
      if (d.type === 'phase' && d.phase === 'knocking') $('tranceLine').textContent = 'Knocking on the front door…';
      if (d.type === 'phase' && d.phase === 'reading the map') $('tranceLine').textContent = 'Reading the map of the house…';
      if (d.type === 'page') {
        $('tranceLine').textContent = 'The spirits are walking the halls';
        $('trancePath').textContent = shortUrl(d.url, 'https://' + scanHost);
        $('tranceCount').textContent = `${d.pagesScanned} room${d.pagesScanned === 1 ? '' : 's'} visited`;
        latestWord = wordFrom(d.url, true);
      }
      if (d.type === 'link') {
        $('tranceLine').textContent = 'The spirits are knocking on every door';
        $('trancePath').textContent = d.url;
        $('tranceCount').textContent = `${d.linksChecked} of ${d.linksTotal} doors`;
        if (d.linksChecked % 4 === 0) latestWord = wordFrom(d.url, hostOf(d.url) === scanHost);
      }
    });
    source.addEventListener('done', (m) => { const r = JSON.parse(m.data); endSeance(); answer(r); });
    source.addEventListener('fail', (m) => { endSeance(); moveTo('NO'); $('error').textContent = JSON.parse(m.data).message; });
    source.onerror = () => {
      if (!source) return;
      endSeance(); moveTo('NO');
      $('error').textContent = 'The connection to the spirits was lost. Check the scanner is still running in your terminal, then try again.';
    };
  };

  // ---------- The answer ----------
  const answer = async (result) => {
    state.result = result;
    state.banished = new Set(store.get('gs:banished:' + result.site, []));
    state.chosen = null;
    state.initialScore = result.ghosts.reduce((n, g) => n + ghostScore(g), 0);
    const n = result.ghostCount;
    const spoken = $('spoken');

    if (isBoring() || reduceMotion) { renderReading(); return; }

    document.body.classList.add('darkroom', 'spirits', 'answering');
    spoken.textContent = 'Spirits, how many ghosts walk this house?';
    spoken.classList.add('on');
    moveTo(null);
    await sleep(1400);
    let skip = false;
    const onSkip = () => { skip = true; };
    document.addEventListener('keydown', onSkip, { once: true });
    document.addEventListener('click', onSkip, { once: true });
    const wait = (ms) => (skip ? Promise.resolve() : sleep(ms));
    if (n) {
      for (const d of String(n)) { moveTo(d); await wait(950); }
      moveTo('YES');
      sounds.answer();
      spoken.textContent = `The spirits have spoken. ${n} ghost${n === 1 ? ' walks' : 's walk'} ${hostOf(result.site)}.`;
    } else {
      moveTo('NO');
      sounds.answer();
      spoken.textContent = `The spirits have spoken. No ghosts walk ${hostOf(result.site)}.`;
    }
    await wait(2200);
    document.removeEventListener('keydown', onSkip);
    document.removeEventListener('click', onSkip);
    document.body.classList.remove('darkroom', 'answering');
    renderReading();
  };

  // ---------- The reading ----------
  const shortUrl = (u, site = state.result?.site) => {
    if (!u) return '';
    if (u === 'sitemap.xml') return 'your sitemap';
    try {
      const x = new URL(u);
      if (site && hostOf(u) !== hostOf(site)) return u;
      return x.pathname === '/' && !x.search ? 'home page' : x.pathname + x.search;
    } catch { return u; }
  };
  const alive = (type) => state.result.ghosts.filter((g) => g.type === type && !state.banished.has(g.id));
  const visible = () => state.result.ghosts.filter((g) => g.type !== 'locked' && !state.banished.has(g.id));
  const currentScore = () => visible().reduce((n, g) => n + ghostScore(g), 0);
  const typesPresent = () => ORDER.filter((t) => state.result.ghosts.some((g) => g.type === t));

  const paintHead = () => {
    const r = state.result;
    const left = visible().length;
    $('readingTitle').textContent = `A reading for ${hostOf(r.site)}`;
    const score = currentScore();
    $('verdict').textContent = left
      ? `${rankOf(score)}. ${left} ghost${left === 1 ? '' : 's'} walk the ${r.pagesScanned} rooms we visited${state.banished.size ? `, and you've banished ${state.banished.size}` : ''}.`
      : `At peace. We visited ${r.pagesScanned} rooms and checked ${r.linksChecked.toLocaleString()} doors.`;
    const pct = state.initialScore ? score / state.initialScore : 0;
    $('wax').style.height = (score ? Math.max(8, pct * 100) : 4) + '%';
    $('tallCandle').classList.toggle('out', score === 0);
    $('unrestCap').textContent = score ? `Unrest ${score}` : 'The candle is out';
  };

  const cardHtml = (t) => {
    const a = ARCANA[t];
    const n = t === 'locked' ? state.result.ghosts.filter((g) => g.type === t).length : alive(t).length;
    return `<button class="tarot" type="button" data-t="${t}" aria-label="${esc(a.name)}: ${n}">
      <span class="face back"></span>
      <span class="face front"><span class="numeral">${a.numeral}</span><span class="art">${a.art}</span><span class="name">${esc(a.name)}</span></span>
      <span class="count">${n}</span>
    </button>`;
  };

  const paintSpread = () => {
    const spread = $('spread');
    spread.innerHTML = typesPresent().map(cardHtml).join('');
    spread.style.setProperty('--n', String(Math.max(typesPresent().length, 3)));
    [...spread.children].forEach((el, i) => {
      el.style.animationDelay = (reduceMotion ? 0 : i * 140) + 'ms';
      const t = el.dataset.t;
      if (t === state.chosen) el.classList.add('up', 'chosen');
      if (t !== 'locked' && !alive(t).length) el.classList.add('up', 'rested');
      el.onclick = () => chooseCard(t);
    });
    $('hint').textContent = typesPresent().length ? 'Turn a card to see what it holds.' : '';
  };

  const chooseCard = (t) => {
    state.chosen = t;
    $('spread').querySelectorAll('.tarot').forEach((el) => {
      const me = el.dataset.t === t;
      if (me) { if (!el.classList.contains('up')) sounds.flip(); el.classList.add('up'); }
      el.classList.toggle('chosen', me);
    });
    paintCardReading();
    if (!reduceMotion) setTimeout(() => $('cardReading').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 450);
  };

  const omenHtml = (g) => {
    const subject = g.quote
      ? `<div class="what quote">“${esc(g.quote)}”</div>`
      : `<div class="what">${esc(shortUrl(g.url))}</div>`;
    const where = g.foundOn.length === 1
      ? `<div class="where">Found on ${esc(shortUrl(g.foundOn[0]))}</div>`
      : `<details class="where"><summary>Found on ${g.foundOn.length} pages</summary><ul>${g.foundOn.map((p) => `<li>${esc(shortUrl(p))}</li>`).join('')}</ul></details>`;
    const open = g.url && /^https?:/.test(g.url) && !['stale-year', 'past-event', 'nameless', 'speechless'].includes(g.type) ? g.url : g.foundOn.find((p) => /^https?:/.test(p));
    const banish = g.type === 'locked' ? '' : `<button class="banish" data-banish="${esc(g.id)}" type="button">Banish</button>`;
    return `<li class="omen" data-id="${esc(g.id)}">
      <div>${subject}${where}</div>
      <div class="btns">${banish}${open ? `<a href="${esc(open)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}</div>
      ${g.type === 'locked' ? '' : `<p class="fix"><b>Fix:</b> ${esc(g.fix)}</p>`}
    </li>`;
  };

  const paintCardReading = () => {
    const box = $('cardReading');
    const t = state.chosen;
    if (!t) { box.innerHTML = ''; return; }
    const a = ARCANA[t];
    const list = t === 'locked' ? state.result.ghosts.filter((g) => g.type === t) : alive(t);
    const intro = list.length && t !== 'locked' ? `<p class="meaning">${esc(list[0].label)}</p>` : '';
    box.innerHTML = `<h2>${esc(a.name)}</h2><p class="meaning">${esc(a.meaning)}</p>
      ${list.length ? `${t === 'locked' ? '' : intro}<ul class="omens">${list.map(omenHtml).join('')}</ul>` : '<p class="meaning">Laid to rest. Every ghost of this kind has been banished.</p>'}`;
    box.querySelectorAll('[data-banish]').forEach((b) => { b.onclick = () => banish(b.dataset.banish, b.closest('.omen')); });
  };

  const paintPlain = () => {
    const rows = visible().map((g) => `<tr><td>${esc(g.name)}${g.confidence === 'maybe' ? ' (maybe)' : ''}</td>
      <td>${esc(g.quote ? '“' + g.quote + '”' : shortUrl(g.url))}</td>
      <td>${esc(shortUrl(g.foundOn[0]))}${g.foundOn.length > 1 ? ` and ${g.foundOn.length - 1} more` : ''}</td>
      <td>${esc(g.fix)}</td></tr>`).join('');
    const locked = state.result.lockedCount;
    $('plain').innerHTML = (rows
      ? `<table><thead><tr><th>Problem</th><th>Link or text</th><th>Found on</th><th>Fix</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p>No problems found.</p>') + (locked ? `<p>${locked} link${locked === 1 ? '' : 's'} could not be checked because those sites block bots.</p>` : '');
  };

  const paintLimits = () => {
    const l = state.result.limits || {};
    const notes = [];
    if (l.pagesCapped) notes.push(`We stopped after ${l.maxPages} rooms. Your house has more; the terminal version can walk them all with --max-pages.`);
    if (l.linksCapped) notes.push(`We knocked on ${state.result.linksChecked.toLocaleString()} of ${l.linksTotal.toLocaleString()} doors, your own first.`);
    if (l.robotsSkipped) notes.push(`We stayed out of ${l.robotsSkipped} room${l.robotsSkipped === 1 ? '' : 's'} your robots.txt keeps private.`);
    $('limits').innerHTML = notes.map((n) => `<p>${esc(n)}</p>`).join('');
  };

  const renderReading = () => {
    document.body.classList.add('read');
    document.body.classList.remove('scanning');
    paintHead(); paintSpread(); paintCardReading(); paintPlain(); paintLimits();
    if (!visible().length) atPeace(false);
    else {
      $('spoken').classList.remove('on');
      setTimeout(() => $('reading').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }), 200);
    }
  };

  const banish = (id, el) => {
    state.banished.add(id);
    store.set('gs:banished:' + state.result.site, [...state.banished]);
    sounds.banish();
    const after = () => {
      paintHead(); paintPlain();
      const t = state.chosen;
      const card = $('spread').querySelector(`[data-t="${t}"]`);
      if (card) {
        const n = alive(t).length;
        card.querySelector('.count').textContent = n;
        card.classList.toggle('rested', n === 0);
      }
      paintCardReading();
      if (!visible().length) atPeace(true);
    };
    if (el && !reduceMotion) { el.classList.add('gone'); setTimeout(after, 600); } else after();
  };

  const atPeace = async (earned) => {
    document.body.classList.add('peace');
    document.body.classList.remove('spirits');
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    await sleep(reduceMotion ? 0 : 700);
    moveTo('GOODBYE');
    sounds.goodbye();
    const spoken = $('spoken');
    spoken.textContent = earned
      ? `Goodbye. The spirits rest at ${hostOf(state.result.site)}.`
      : `No ghosts walk ${hostOf(state.result.site)}. Come back in a few weeks; links rot quietly.`;
    spoken.classList.add('on');
  };

  $('again').onclick = () => {
    document.body.classList.remove('read', 'peace', 'spirits');
    $('spoken').classList.remove('on');
    moveTo(null);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    $('url').select(); $('url').focus();
  };

  // ---------- Exports ----------
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

  // ---------- Share card: your site's tarot spread ----------
  const loadSvg = (s) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  });
  const roundRect = (x, px, py, w, h, r) => {
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  };
  $('share').onclick = async () => {
    const r = state.result;
    try { await Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('700 40px "Cinzel Decorative"'), document.fonts.load('24px "Atkinson Hyperlegible"')]); } catch {}
    const W = 1200, H = 630;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2b0d1a'); bg.addColorStop(1, '#14060d');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(820, 300, 40, 820, 300, 520);
    glow.addColorStop(0, 'rgba(217,164,65,.28)'); glow.addColorStop(1, 'rgba(217,164,65,0)');
    x.fillStyle = glow; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(217,164,65,.5)'; x.lineWidth = 2; roundRect(x, 24, 24, W - 48, H - 48, 18); x.stroke();

    // words
    const host = hostOf(r.site);
    const left = visible().length;
    x.fillStyle = '#c9b498'; x.font = '500 30px Cinzel, Georgia, serif'; x.textAlign = 'left';
    x.fillText('A reading for', 72, 140);
    x.fillStyle = '#f1e6d2';
    let size = 64; x.font = `700 ${size}px Cinzel, Georgia, serif`;
    while (x.measureText(host).width > 470 && size > 30) { size -= 2; x.font = `700 ${size}px Cinzel, Georgia, serif`; }
    x.fillText(host, 72, 214);
    x.fillStyle = '#9fe8c6'; x.font = '700 40px Cinzel, Georgia, serif';
    x.fillText(left ? `${left} ghost${left === 1 ? '' : 's'} found` : 'At peace', 72, 300);
    x.fillStyle = '#d9a441'; x.font = '500 30px Cinzel, Georgia, serif';
    x.fillText(left ? `The verdict: ${rankOf(currentScore())}` : 'The spirits rest', 72, 348);
    x.fillStyle = '#c9b498'; x.font = '22px "Atkinson Hyperlegible", system-ui, sans-serif';
    const top = ORDER.filter((t) => t !== 'locked' && alive(t).length).sort((a, b) => alive(b).length - alive(a).length).slice(0, 3);
    top.forEach((t, i) => x.fillText(kinds(alive(t).length, t), 72, 410 + i * 34));
    x.fillStyle = 'rgba(241,230,210,.7)'; x.font = '20px "Atkinson Hyperlegible", system-ui, sans-serif';
    x.fillText('Hold your own séance: github.com/raoashwini21/graveyard-shift', 72, 560);

    // cards
    const cards = (top.length ? top : ['locked']).slice(0, 3);
    const arts = await Promise.all(cards.map((t) => loadSvg(ARCANA[t].art)));
    const cw = 190, ch = 326;
    const centers = cards.length === 1 ? [835] : cards.length === 2 ? [735, 935] : [645, 835, 1025];
    const angles = cards.length === 1 ? [0] : cards.length === 2 ? [-6, 6] : [-9, 0, 9];
    cards.forEach((t, i) => {
      x.save();
      x.translate(centers[i], 320);
      x.rotate((angles[i] * Math.PI) / 180);
      x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 30; x.shadowOffsetY = 16;
      const cg = x.createLinearGradient(0, -ch / 2, 0, ch / 2); cg.addColorStop(0, '#2a0f1c'); cg.addColorStop(1, '#160610');
      x.fillStyle = cg; roundRect(x, -cw / 2, -ch / 2, cw, ch, 12); x.fill();
      x.shadowColor = 'transparent';
      x.strokeStyle = '#d9a441'; x.lineWidth = 3; roundRect(x, -cw / 2, -ch / 2, cw, ch, 12); x.stroke();
      x.strokeStyle = 'rgba(217,164,65,.4)'; x.lineWidth = 1; roundRect(x, -cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16, 8); x.stroke();
      x.fillStyle = '#d9a441'; x.textAlign = 'center'; x.font = '500 20px Cinzel, Georgia, serif';
      x.fillText(ARCANA[t].numeral, 0, -ch / 2 + 36);
      if (arts[i]) x.drawImage(arts[i], -66, -112, 132, 158);
      x.fillStyle = '#f1e6d2';
      let fs = 19; x.font = `700 ${fs}px Cinzel, Georgia, serif`;
      while (x.measureText(ARCANA[t].name).width > cw - 30 && fs > 12) { fs--; x.font = `700 ${fs}px Cinzel, Georgia, serif`; }
      x.fillText(ARCANA[t].name, 0, ch / 2 - 30);
      const n = t === 'locked' ? r.lockedCount : alive(t).length;
      x.fillStyle = '#9fe8c6'; x.beginPath(); x.arc(cw / 2 - 6, -ch / 2 + 6, 24, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#0d2a20'; x.font = '700 22px "Atkinson Hyperlegible", system-ui, sans-serif';
      x.fillText(String(n), cw / 2 - 6, -ch / 2 + 14);
      x.restore();
    });
    c.toBlob((b) => b && download(b, `seance-${host}.png`), 'image/png');
  };
})();
