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

  // ---------- The arcana: one tarot card per kind of ghost (drawings live in art.js) ----------
  const ARCANA = {
    dead: { name: 'The Departed', plural: ['dead link', 'dead links'],
      meaning: 'Links to pages that no longer exist. Anyone who clicks them hits a dead end.' },
    possessed: { name: 'The Possessed', plural: ['possessed link', 'possessed links'],
      meaning: 'Links to one company that now land on another. The tool you wrote about was bought, renamed or taken over.' },
    chain: { name: 'The Wanderer', plural: ['redirect chain', 'redirect chains'],
      meaning: 'Links that wander through several redirects before they arrive. Slower for readers, and search engines trust them less.' },
    nameless: { name: 'The Nameless', plural: ['nameless page', 'nameless pages'],
      meaning: 'Pages with no title. Search results and browser tabs have nothing to call them.' },
    speechless: { name: 'The Silent', plural: ['silent page', 'silent pages'],
      meaning: 'Pages with no meta description. Search engines will invent one for you.' },
    'stale-year': { name: 'The Stopped Clock', plural: ['stale year', 'stale years'],
      meaning: 'Copyright lines stuck in an old year. Visitors notice, and it makes the whole house look abandoned.' },
    'past-event': { name: 'The Forgotten Feast', plural: ['past event', 'past events'],
      meaning: 'Invitations to events whose date has passed. The party ended, but the invitation is still on the door.' },
    locked: { name: 'The Locked Door', plural: ['locked door', 'locked doors'],
      meaning: "Links on sites that block bots, so the spirits couldn't get in. Open the ones that matter yourself." },
  };
  const ART = window.GSArt;
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
  const POS = ART.POS;
  $('board').innerHTML = ART.board();
  document.querySelectorAll('.candle').forEach((c) => { c.innerHTML = ART.candle(c.classList.contains('tall') ? 160 : 128); });
  const planchette = $('planchette');
  const glyph = {};
  document.querySelectorAll('#board .glyph').forEach((g) => { glyph[g.dataset.k] = g; });
  let lit = null;
  const moveTo = (key) => {
    const p = key && POS[key] ? POS[key] : ART.REST;
    const tilt = key ? Math.random() * 14 - 7 : 0;
    planchette.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${tilt}deg)`;
    if (lit) lit.classList.remove('lit');
    lit = key ? glyph[key] : null;
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
    const h = score ? Math.max(14, pct * 170) : 8;
    const m = $('meter');
    if (!m.firstChild) m.innerHTML = ART.meter();
    const body = m.querySelector('.body');
    body.style.y = (196 - h) + 'px';
    body.style.height = h + 'px';
    m.querySelector('.top').style.transform = `translateY(${170 - h}px)`;
    m.classList.toggle('out', score === 0);
    $('unrestCap').textContent = score ? `Unrest ${score}` : 'The candle is out';
  };

  const cardBackSvg = ART.cardBack();
  const cardHtml = (t) => {
    const a = ARCANA[t];
    const n = t === 'locked' ? state.result.ghosts.filter((g) => g.type === t).length : alive(t).length;
    return `<button class="tarot" type="button" data-t="${t}" aria-label="${esc(a.name)}, ${n}">
      <span class="face back">${cardBackSvg}</span>
      <span class="face front">${ART.cardFront(t, a.name)}</span>
      <span class="coin">${n}</span>
    </button>`;
  };

  const paintSpread = () => {
    const spread = $('spread');
    spread.innerHTML = typesPresent().map(cardHtml).join('');
    spread.style.setProperty('--n', String(Math.max(typesPresent().length, 4)));
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
        card.querySelector('.coin').textContent = n;
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
    try { await Promise.all(['56px "Fell SC"', '56px Fell', 'italic 500 30px Cormorant', '22px Atkinson'].map((f) => document.fonts.load(f))); } catch {}
    const W = 1200, H = 630;
    const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
    const x = c.getContext('2d'); x.scale(2, 2);

    // The room
    const bg = x.createRadialGradient(780, 300, 40, 700, 320, 760);
    bg.addColorStop(0, '#3a2414'); bg.addColorStop(.55, '#1c120c'); bg.addColorStop(1, '#0b0705');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const grainImg = await loadSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity=".5"/></svg>`);
    if (grainImg) { x.globalAlpha = .06; x.drawImage(grainImg, 0, 0, W, H); x.globalAlpha = 1; }
    x.strokeStyle = 'rgba(201,151,63,.45)'; x.lineWidth = 1.5; roundRect(x, 26, 26, W - 52, H - 52, 6); x.stroke();
    x.strokeStyle = 'rgba(201,151,63,.2)'; roundRect(x, 34, 34, W - 68, H - 68, 4); x.stroke();

    // The words
    const host = hostOf(r.site);
    const left = visible().length;
    x.textAlign = 'left';
    x.fillStyle = '#cdb994'; x.font = 'italic 500 34px Cormorant, Georgia, serif';
    x.fillText('A reading for', 80, 150);
    x.fillStyle = '#ece0c8';
    let size = 70; x.font = `${size}px Fell, Georgia, serif`;
    while (x.measureText(host).width > 480 && size > 30) { size -= 2; x.font = `${size}px Fell, Georgia, serif`; }
    x.fillText(host, 80, 224);
    x.fillStyle = '#c9973f'; x.fillRect(80, 252, 64, 1.5);
    x.fillStyle = '#a6ecd0'; x.font = '46px "Fell SC", Fell, Georgia, serif';
    x.fillText(left ? `${left} ghost${left === 1 ? '' : 's'} found` : 'At peace', 80, 316);
    x.fillStyle = '#cdb994'; x.font = 'italic 500 30px Cormorant, Georgia, serif';
    x.fillText(left ? `The verdict: ${rankOf(currentScore()).toLowerCase()}.` : 'The spirits rest.', 80, 360);
    const top = ORDER.filter((t) => t !== 'locked' && alive(t).length).sort((a, b) => alive(b).length - alive(a).length).slice(0, 3);
    x.fillStyle = '#a8977b'; x.font = '21px Atkinson, system-ui, sans-serif';
    top.forEach((t, i) => x.fillText(kinds(alive(t).length, t), 80, 418 + i * 32));
    x.fillStyle = 'rgba(236,224,200,.6)'; x.font = '19px Atkinson, system-ui, sans-serif';
    x.fillText('Hold your own séance: github.com/raoashwini21/graveyard-shift', 80, 566);

    // The spread
    const cards = (top.length ? top : ['locked']).slice(0, 3);
    const imgs = await Promise.all(cards.map((t) => loadSvg(ART.cardFront(t, ARCANA[t].name, false))));
    const cw = 176, ch = 302;
    const centers = cards.length === 1 ? [875] : cards.length === 2 ? [780, 980] : [688, 874, 1060];
    const ys = cards.length === 3 ? [326, 302, 326] : [314, 314];
    const angles = cards.length === 1 ? [0] : cards.length === 2 ? [-5, 5] : [-8, 0, 8];
    cards.forEach((t, i) => {
      x.save();
      x.translate(centers[i], ys[i]);
      x.rotate((angles[i] * Math.PI) / 180);
      x.shadowColor = 'rgba(0,0,0,.65)'; x.shadowBlur = 36; x.shadowOffsetY = 18;
      x.fillStyle = '#e8d8b2'; roundRect(x, -cw / 2, -ch / 2, cw, ch, 10); x.fill();
      x.shadowColor = 'transparent';
      if (imgs[i]) x.drawImage(imgs[i], -cw / 2, -ch / 2, cw, ch);
      x.fillStyle = '#2a1a10'; x.textAlign = 'center';
      x.font = '19px "Fell SC", Fell, Georgia, serif';
      x.fillText(ART.NUMERAL[t], 0, -ch / 2 + 36);
      let fs = 20; x.font = `${fs}px "Fell SC", Fell, Georgia, serif`;
      while (x.measureText(ARCANA[t].name).width > cw - 54 && fs > 12) { fs--; x.font = `${fs}px "Fell SC", Fell, Georgia, serif`; }
      x.fillText(ARCANA[t].name, 0, ch / 2 - 27);
      const n = t === 'locked' ? r.lockedCount : alive(t).length;
      const coin = x.createRadialGradient(cw / 2 - 12, -ch / 2 + 2, 2, cw / 2 - 8, -ch / 2 + 8, 26);
      coin.addColorStop(0, '#f0cf86'); coin.addColorStop(1, '#a8761f');
      x.fillStyle = coin; x.beginPath(); x.arc(cw / 2 - 8, -ch / 2 + 8, 25, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2a1a10'; x.font = '23px "Fell SC", Fell, Georgia, serif';
      x.fillText(String(n), cw / 2 - 8, -ch / 2 + 16);
      x.restore();
    });
    c.toBlob((b) => b && download(b, `seance-${host}.png`), 'image/png');
  };
})();
