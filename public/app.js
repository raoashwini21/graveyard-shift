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
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  // ---------- Engraved sigils, one per kind (24px, single stroke) ----------
  const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    dead: ico('<path d="M9.5 14.5 8 16a3.2 3.2 0 0 1-4.5-4.5L6 9"/><path d="M14.5 9.5 16 8a3.2 3.2 0 0 1 4.5 4.5L18 15"/><path d="M10 7.5 9 5M14 16.5l1 2.5M7.5 10 5 9M16.5 14l2.5 1"/>'),
    possessed: ico('<path d="M6 21V10a6 6 0 0 1 12 0v11"/><path d="M3.5 21h17"/><circle cx="10" cy="12.5" r=".9" fill="currentColor"/><circle cx="14" cy="12.5" r=".9" fill="currentColor"/><path d="M9 4.6 7.6 2.5M15 4.6l1.4-2.1"/>'),
    'past-event': ico('<path d="M5 20h14M6.5 20v-6h11v6"/><path d="M9 14v-2.5h6V14"/><path d="M12 11.5V8"/><path d="M12 6.5c-1-1 .8-1.6 0-2.8-.6-.9.4-1.3.2-2"/>'),
    'stale-year': ico('<circle cx="12" cy="13" r="7.5"/><path d="M12 13V9M12 13l2.6 1.6"/><path d="M10 2.8h4M12 2.8v2.7"/><path d="m16.8 8.6-1.6 1.7 1.3.9-1.1 1.4"/>'),
    nameless: ico('<path d="M12 3c-4 0-6 3.6-6 8 0 2.6-1.3 6.4-2.5 10h17c-1.2-3.6-2.5-7.4-2.5-10 0-4.4-2-8-6-8Z"/><ellipse cx="12" cy="10.5" rx="2.6" ry="3.4" stroke-dasharray="1.6 1.6"/>'),
    chain: ico('<path d="M4 21c6 0 10-2 9-5-.8-2.4-5-1.4-5.5-4C7 9.5 11 8 13 8"/><path d="M16 3v2.2M14.5 5.2h3l.8 1.3v4.4l-.8 1.3h-3l-.8-1.3V6.5Z"/><circle cx="16" cy="8.7" r=".8" fill="currentColor"/>'),
    speechless: ico('<path d="M4 12c2-3 5-3 8-1 3-2 6-2 8 1-3.5 4.5-12.5 4.5-16 0Z"/><path d="M4 12h16"/><path d="m7.5 10.6 1.4 2.8M8.9 10.6l-1.4 2.8M11.3 10.4l1.4 3.2M12.7 10.4l-1.4 3.2M15.1 10.6l1.4 2.8M16.5 10.6l-1.4 2.8"/>'),
    locked: ico('<path d="M6 21V10a6 6 0 0 1 12 0v11Z"/><path d="M3.5 21h17"/><rect x="10" y="13" width="4" height="3.4" rx=".5"/><path d="M10.8 13v-1.2a1.2 1.2 0 0 1 2.4 0V13"/>'),
  };

  // ---------- The kinds of ghost ----------
  const KINDS = {
    dead: { n: 'XIII', name: 'The Departed', one: 'dead link', many: 'dead links', color: '#a03a3a',
      meaning: 'Links to pages that no longer exist. Every reader who clicks one hits a dead end.' },
    possessed: { n: 'XV', name: 'The Possessed', one: 'link taken over', many: 'links taken over', color: '#b5603f',
      meaning: 'Links to one company that now land on another. The product you wrote about was bought, renamed or shut down.' },
    'past-event': { n: 'VI', name: 'The Forgotten Feast', one: 'expired invitation', many: 'expired invitations', color: '#e0a35a',
      meaning: 'Invitations to events whose date has passed. The party ended; the invitation is still on the door.' },
    'stale-year': { n: 'X', name: 'The Stopped Clock', one: 'stale year', many: 'stale years', color: '#bf9a5f',
      meaning: 'Copyright lines stuck in an old year. Small, but it makes the whole house look abandoned.' },
    nameless: { n: '0', name: 'The Nameless', one: 'page without a title', many: 'pages without a title', color: '#8c7f6c',
      meaning: 'Pages with no title. Search results and browser tabs have nothing to call them.' },
    chain: { n: 'IX', name: 'The Wanderer', one: 'redirect chain', many: 'redirect chains', color: '#6f655a',
      meaning: 'Links that pass through several redirects before arriving. Slower for readers, weaker for search.' },
    speechless: { n: 'II', name: 'The Silent', one: 'page without a description', many: 'pages without a description', color: '#57504a',
      meaning: 'Pages with no meta description. Search engines will write one for you, usually badly.' },
    locked: { n: 'XX', name: 'The Locked Door', one: 'unverified link', many: 'unverified links', color: 'transparent',
      meaning: 'Links on sites that turn bots away, so they could not be checked. Open the ones that matter yourself.' },
  };
  const ORDER = ['dead', 'possessed', 'past-event', 'stale-year', 'nameless', 'chain', 'speechless', 'locked'];
  const WEIGHT = { dead: 10, possessed: 6, chain: 4, nameless: 6, speechless: 3, 'stale-year': 5, 'past-event': 7, locked: 0 };
  const ghostScore = (g) => Math.round((WEIGHT[g.type] || 0) * Math.min(1 + (g.foundOn.length - 1) * 0.25, 3));
  const rankOf = (s) => (s === 0 ? 'At peace' : s <= 20 ? 'Restless' : s <= 50 ? 'Haunted' : s <= 100 ? 'Infested' : 'Cursed');
  const count = (n, t) => `${fmt(n)} ${n === 1 ? KINDS[t].one : KINDS[t].many}`;
  const WHISPERS = {
    dead: (u) => `Something has died at ${u}.`,
    possessed: (u) => `${u} answers in another voice.`,
    'past-event': () => 'An old invitation is still on the door.',
    'stale-year': () => 'A clock in this house stopped years ago.',
    nameless: (u) => `A room with no name: ${u}.`,
    chain: (u) => `Footsteps wander from ${u}.`,
    speechless: (u) => `${u} will not speak.`,
  };

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
    felt: () => { tone(98, 1.4, 0.07, 73); tone(147, 1.1, 0.02, 110); },
    invoke: () => { tone(55, 2.6, 0.16, 49); tone(220, 2, 0.02, 196); },
    answer: () => { tone(55, 2.2, 0.22, 40); tone(110, 1.6, 0.04, 82); },
    banish: () => { tone(660, 0.9, 0.03, 1320); setTimeout(() => tone(990, 0.8, 0.015, 1760), 120); },
    restore: () => tone(330, 0.9, 0.04, 196),
    scare: () => { tone(46, 0.9, 0.3, 30, 'sawtooth'); tone(1900, 0.35, 0.03, 900); },
    hush: () => tone(40, 2.4, 0.12, 32),
    lit: () => { tone(82, 2.4, 0.2, 55); tone(330, 1.8, 0.03, 247); tone(494, 2.2, 0.015, 370); },
  };
  Haunt.onSound((name) => sfx[name] && sfx[name]());
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

  // ---------- The chamber: arcane circle, embers, parallax ----------
  (() => {
    const c = 500;
    const p = [];
    [480, 470, 380, 300, 292, 200, 120].forEach((r, i) => p.push(`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#ebe3d3" stroke-width="${i % 2 ? .6 : 1.2}"/>`));
    for (let i = 0; i < 72; i++) {
      const a = (i * 5 * Math.PI) / 180, r1 = 470, r2 = i % 6 ? 458 : 440;
      p.push(`<line x1="${c + Math.cos(a) * r1}" y1="${c + Math.sin(a) * r1}" x2="${c + Math.cos(a) * r2}" y2="${c + Math.sin(a) * r2}" stroke="#ebe3d3" stroke-width=".8"/>`);
    }
    const star = (n, r) => Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return `${c + Math.cos(a) * r},${c + Math.sin(a) * r}`; });
    const s7 = star(7, 380);
    p.push(`<polygon points="${s7.filter((_, i) => true).map((_, i) => s7[(i * 3) % 7]).join(' ')}" fill="none" stroke="#ebe3d3" stroke-width=".8"/>`);
    p.push(`<polygon points="${star(7, 292).join(' ')}" fill="none" stroke="#ebe3d3" stroke-width=".6"/>`);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
      p.push(`<circle cx="${c + Math.cos(a) * 425}" cy="${c + Math.sin(a) * 425}" r="14" fill="none" stroke="#ebe3d3" stroke-width=".8"/><circle cx="${c + Math.cos(a) * 425 + 5}" cy="${c + Math.sin(a) * 425}" r="11" fill="#0a0909"/>`);
    }
    $('sigil').innerHTML = `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">${p.join('')}</svg>`;
    if (!reduceMotion) {
      window.addEventListener('pointermove', (e) => {
        const x = (e.clientX / innerWidth - .5) * -18, y = (e.clientY / innerHeight - .5) * -14;
        $('sigil').style.setProperty('--px', x + 'px'); $('sigil').style.setProperty('--py', y + 'px');
      }, { passive: true });
    }
  })();
  (() => {
    if (reduceMotion) return;
    const cv = $('embers'); const ctx = cv.getContext('2d');
    let W = 0, H = 0; const dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    const make = (y) => ({ x: Math.random() * W, y: y ?? H + Math.random() * 40, r: .6 + Math.random() * 1.4, vy: .15 + Math.random() * .35, sway: Math.random() * 6.28, life: 0, max: 600 + Math.random() * 900 });
    const motes = Array.from({ length: 34 }, () => make(Math.random() * H));
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      const busy = document.body.classList.contains('scanning');
      for (const m of motes) {
        m.life++; m.y -= m.vy * (busy ? 1.8 : 1); m.sway += .01; m.x += Math.sin(m.sway) * .25;
        const a = Math.max(0, Math.sin((m.life / m.max) * Math.PI)) * .55;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28);
        ctx.fillStyle = `rgba(224,163,90,${a})`; ctx.shadowColor = 'rgba(224,163,90,.8)'; ctx.shadowBlur = 6; ctx.fill();
        if (m.life > m.max || m.y < -10) Object.assign(m, make());
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();

  // ---------- The spirit dial ----------
  const C = 260;
  const POS = {};
  const PROG_R = 247;
  const PROG_LEN = 2 * Math.PI * PROG_R;
  const dial = (() => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const parts = [`<defs><radialGradient id="lensHalo"><stop offset="0" stop-color="#e0a35a" stop-opacity=".35"/><stop offset="1" stop-color="#e0a35a" stop-opacity="0"/></radialGradient></defs>`];
    parts.push(`<circle class="ring" cx="${C}" cy="${C}" r="256"/><circle class="ring fine" cx="${C}" cy="${C}" r="238"/>`);
    parts.push(`<circle class="ring fine" cx="${C}" cy="${C}" r="186"/><circle class="ring" cx="${C}" cy="${C}" r="132"/><circle class="ring fine" cx="${C}" cy="${C}" r="104"/>`);
    let marks = '';
    for (let i = 0; i < 52; i++) {
      const a = (i * 360 / 52) * Math.PI / 180;
      marks += i % 4 === 0
        ? `<circle cx="${C + Math.cos(a) * 247}" cy="${C + Math.sin(a) * 247}" r="1.4" fill="none"/>`
        : `<line x1="${C + Math.cos(a) * 244}" y1="${C + Math.sin(a) * 244}" x2="${C + Math.cos(a) * 250}" y2="${C + Math.sin(a) * 250}" stroke-width=".8"/>`;
    }
    parts.push(`<g class="marks">${marks}</g>`);
    parts.push(`<circle class="prog" id="prog" cx="${C}" cy="${C}" r="${PROG_R}" stroke-dasharray="${PROG_LEN}" stroke-dashoffset="${PROG_LEN}"/>`);
    letters.forEach((ch, i) => {
      const deg = -90 + (i * 360) / letters.length;
      const a = (deg * Math.PI) / 180;
      const x = C + Math.cos(a) * 213, y = C + Math.sin(a) * 213;
      POS[ch] = { x, y };
      parts.push(`<text class="ch" data-k="${ch}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="27" text-anchor="middle" dominant-baseline="central" transform="rotate(${(deg + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${ch}</text>`);
    });
    '1234567890'.split('').forEach((ch, i) => {
      const deg = -90 + (i * 360) / 10 + 18;
      const a = (deg * Math.PI) / 180;
      const x = C + Math.cos(a) * 158, y = C + Math.sin(a) * 158;
      POS[ch] = { x, y };
      parts.push(`<text class="ch" data-k="${ch}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="21" text-anchor="middle" dominant-baseline="central">${ch}</text>`);
    });
    const words = { YES: ['Yes', C - 52, C - 22], NO: ['No', C + 52, C - 22], GOODBYE: ['Goodbye', C, C + 56] };
    for (const [k, [label, x, y]] of Object.entries(words)) {
      POS[k] = { x, y };
      parts.push(`<text class="ch word" data-k="${k}" x="${x}" y="${y}" font-size="22" text-anchor="middle" dominant-baseline="central">${label}</text>`);
    }
    parts.push(`<g class="dial-ghost"><use href="#gs-face" x="200" y="186" width="120" height="152"/></g>`);
    parts.push(`<path class="center-mark" d="M${C} ${C - 9} L${C + 9} ${C} L${C} ${C + 9} L${C - 9} ${C}Z"/>`);
    parts.push(`<g class="lens" id="lens"><circle class="halo" r="54"/><circle class="glass" r="27"/><circle class="rim" r="27"/><circle class="rim" r="31" stroke-opacity=".35"/>
      <line x1="0" y1="-40" x2="0" y2="-33"/><line x1="0" y1="33" x2="0" y2="40"/><line x1="-40" y1="0" x2="-33" y2="0"/><line x1="33" y1="0" x2="40" y2="0"/></g>`);
    const el = document.createElement('div');
    el.className = 'dial';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<svg viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
    return el;
  })();
  const lens = dial.querySelector('#lens');
  const prog = dial.querySelector('#prog');
  const chars = {};
  dial.querySelectorAll('.ch').forEach((t) => { chars[t.dataset.k] = t; });
  let litEl = null;
  let lensAt = { x: C, y: C };
  const point = (key, quiet = false) => {
    const p = key && POS[key] ? POS[key] : { x: C, y: C };
    lensAt = p;
    lens.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (litEl) litEl.classList.remove('lit');
    litEl = key ? chars[key] : null;
    if (litEl) litEl.classList.add('lit');
    if (key && !quiet) sfx.tick();
  };
  const ripple = (felt = false) => {
    if (reduceMotion) return;
    const r = document.createElement('span');
    r.className = 'ripple' + (felt ? ' felt' : '');
    r.style.left = (lensAt.x / 520) * 100 + '%';
    r.style.top = (lensAt.y / 520) * 100 + '%';
    dial.appendChild(r);
    setTimeout(() => r.remove(), 2400);
  };
  const setProgress = (f) => { prog.style.strokeDashoffset = String(PROG_LEN * (1 - Math.max(0, Math.min(1, f)))); };
  point(null, true);

  // ---------- Views ----------
  let current = 'landing';
  const show = (name) => {
    current = name;
    for (const v of ['landing', 'scan', 'report']) $(v).classList.toggle('on', v === name);
    if (name === 'landing') $('heroSlot').appendChild(dial);
    if (name === 'scan') $('scanSlot').appendChild(dial);
    window.scrollTo({ top: 0, behavior: 'auto' });
    Haunt.scene(name);
    if (name === 'landing') { Ghosts.pickable(null); Ghosts.clear(); Ghosts.setting({ avoid: '.ritual h1, .lede, .field, .opts, .index-section h2', presence: 0.9 }); setTimeout(() => current === 'landing' && Ghosts.idle(2), 900); }
    if (name === 'scan') { Ghosts.pickable(null); Ghosts.clear(); Ghosts.setting({ avoid: '.scan-copy > *, .evidence > *', presence: 0.95 }); }
    if (name === 'report') Ghosts.setting({ avoid: '.report-head > *, .verdict-main > *, .gauge, .casefile, .toc, .limits', presence: 0.55 });
    if (name === 'landing') { idleSpoken = 0; lastTyped = Date.now(); }
  };

  let lastTyped = 0;
  let idleTimer = null;
  let idleSpoken = 0;
  let selfSpelling = false;
  // Left alone, the planchette begins to move by itself.
  const MESSAGES = [{ after: 11000, word: 'HELLO' }, { after: 32000, word: 'BEHINDYOU', then: () => Haunt.drift({ opacity: 0.2, height: 64, duration: 9000, y: 14 }) }];
  const spellAlone = async (msg) => {
    selfSpelling = true;
    Haunt.gutter(500);
    for (const ch of msg.word) {
      if (current !== 'landing' || Date.now() - lastTyped < 1000) { selfSpelling = false; return; }
      point(ch, false);
      await sleep(760);
    }
    await sleep(900);
    point(null, true);
    selfSpelling = false;
    if (msg.then) msg.then();
  };
  const idle = () => {
    clearTimeout(idleTimer);
    if (reduceMotion) return;
    idleTimer = setTimeout(() => {
      const quiet = Date.now() - lastTyped;
      if (current === 'landing' && !selfSpelling && !isPlain()) {
        const next = MESSAGES[idleSpoken];
        if (next && quiet > next.after && document.activeElement !== $('url')) { idleSpoken++; spellAlone(next); }
        else if (quiet > 4000) {
          const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          point(keys[Math.floor(Math.random() * keys.length)], true);
        }
      }
      idle();
    }, 3000);
  };
  $('url').addEventListener('input', (e) => {
    lastTyped = Date.now();
    const ch = (e.target.value.slice(-1) || '').toUpperCase();
    if (POS[ch]) point(ch); else if (!e.target.value) point(null, true);
  });

  $('reveals').innerHTML = ORDER.filter((t) => t !== 'locked').map((t) => `<li>
    <span class="top-row"><span class="icon">${ICONS[t]}</span><span class="num">${KINDS[t].n}</span></span>
    <span class="name">${KINDS[t].name}</span><span class="kind">${cap(KINDS[t].many)}</span><span class="desc">${KINDS[t].meaning}</span></li>`).join('');
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
  let presences = 0;
  let whisperTimer = null;
  let lastWhisper = 0;

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
        if (Math.random() < 0.25) Haunt.gutter(350);
      }
      if (spellQ.length) point(spellQ.shift());
      spellTimer = setTimeout(step, reduceMotion ? 1000 : 440);
    };
    step();
  };
  const stopScan = () => {
    if (source) source.close();
    source = null;
    clearTimeout(spellTimer);
    spellQ = []; word = ''; spelled = '';
    document.body.classList.remove('speaking', 'scanning', 'felt', 'invoking');
  };
  $('home').onclick = (e) => { e.preventDefault(); stopScan(); show('landing'); };

  const shortPath = (u) => {
    try { const x = new URL(u); return hostOf(u) === scanHost ? (x.pathname === '/' ? '/' : x.pathname + x.search) : x.hostname + (x.pathname === '/' ? '' : x.pathname); } catch { return u; }
  };
  const statusClass = (s) => (s === 'room' ? 's-room' : typeof s === 'number' ? (s >= 400 ? 's-bad' : s >= 300 ? 's-move' : 's-ok') : s === 'loop' || s === 'broken' ? 's-bad' : 's-move');
  const log = (status, text) => {
    const li = document.createElement('li');
    const label = status === 'room' ? 'room' : status === null || status === undefined ? '—' : String(status).slice(0, 6);
    li.innerHTML = `<span class="${statusClass(status)}">${esc(label)}</span><span>${esc(text)}</span>`;
    const list = $('log');
    list.prepend(li);
    while (list.children.length > 12) list.lastChild.remove();
  };
  let phaseText = '';
  const setPhase = (t) => {
    if (t === phaseText) return;
    phaseText = t;
    const el = $('scanPhase');
    el.classList.add('fade');
    setTimeout(() => { el.textContent = t; el.classList.remove('fade'); }, reduceMotion ? 0 : 300);
  };
  const reading = (label, url) => {
    $('rnLabel').textContent = label;
    const el = $('rnUrl');
    el.textContent = url;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  };
  const felt = (e) => {
    presences++;
    Haunt.felt(e.kind, dial.getBoundingClientRect(), presences);
    if (KINDS[e.kind]) Ghosts.spawn(e.kind, dial.getBoundingClientRect(), `${KINDS[e.kind].name} · ${e.url ? shortPath(e.url) : ''}`);
    const dd = $('cGhosts');
    dd.textContent = fmt(presences);
    dd.classList.remove('pulse'); void dd.offsetWidth; dd.classList.add('pulse');
    const now = Date.now();
    if (now - lastWhisper > 2200) {
      lastWhisper = now;
      document.body.classList.add('felt');
      setTimeout(() => document.body.classList.remove('felt'), 900);
      ripple(true);
      sfx.felt();
      const w = $('whisper');
      w.textContent = (WHISPERS[e.kind] || (() => 'Something stirs.'))(e.url ? shortPath(e.url) : 'this house');
      w.classList.add('on');
      clearTimeout(whisperTimer);
      whisperTimer = setTimeout(() => w.classList.remove('on'), 2600);
    }
  };

  $('cancel').onclick = () => { stopScan(); show('landing'); $('url').focus(); };

  $('ask').onsubmit = async (e) => {
    e.preventDefault();
    const typed = $('url').value.trim();
    const raw = /^http:\/\//i.test(typed) ? typed : typed.replace(/^https:\/\//i, '');
    if (!raw) { $('error').textContent = 'Name a house to visit first, like yoursite.com.'; $('url').focus(); return; }
    $('error').textContent = '';
    scanHost = hostOf(/^http:/i.test(raw) ? raw : 'https://' + raw);
    maxPages = Number($('maxPages').value);

    // The invocation: the room dims, then the séance begins.
    sfx.invoke();
    document.body.classList.add('invoking');
    await sleep(reduceMotion || isPlain() ? 0 : 850);
    $('scanHost').textContent = scanHost;
    phaseText = ''; $('scanPhase').textContent = 'The spirits are gathering.';
    $('cPages').textContent = '0'; $('cLinks').textContent = '0'; $('cGhosts').textContent = '0';
    presences = 0;
    $('log').innerHTML = '';
    $('whisper').classList.remove('on');
    reading('Now entering', 'the front door');
    setProgress(0);
    show('scan');
    document.body.classList.add('scanning');
    document.body.classList.remove('invoking');
    word = scanHost.split('.')[0];
    startSpelling();

    const qs = new URLSearchParams({ url: raw, maxPages: String(maxPages), external: $('external').checked ? '1' : '0' });
    source = new EventSource('/api/scan?' + qs);
    source.addEventListener('progress', (m) => {
      const d = JSON.parse(m.data);
      if (d.type === 'phase' && d.phase === 'knocking') setPhase('Knocking on the front door.');
      if (d.type === 'phase' && d.phase === 'reading the map') setPhase('Reading the map of the house.');
      if (d.type === 'phase' && d.phase === 'knocking on every door') setPhase('Knocking on every door.');
      if (d.type === 'page') {
        setPhase('Walking every room.');
        $('cPages').textContent = fmt(d.pagesScanned);
        setProgress(0.4 * (d.pagesScanned / maxPages));
        reading('Now entering', shortPath(d.url));
        log('room', shortPath(d.url));
        word = wordFrom(d.url, true);
        if (d.pagesScanned % 2 === 0) ripple();
      }
      if (d.type === 'link') {
        $('cLinks').textContent = fmt(d.linksChecked);
        setProgress(0.4 + 0.6 * (d.linksChecked / Math.max(1, d.linksTotal)));
        if (d.linksChecked % 2 === 0 || (typeof d.status === 'number' && d.status >= 400)) {
          reading('Knocking at', shortPath(d.url));
          log(d.status, d.status === 'broken' ? d.url : shortPath(d.url));
        }
        if (d.linksChecked % 5 === 0) word = wordFrom(d.url, hostOf(d.url) === scanHost);
      }
      if (d.type === 'presence') felt(d);
    });
    source.addEventListener('done', (m) => { const r = JSON.parse(m.data); stopScan(); setProgress(1); answer(r); });
    source.addEventListener('fail', (m) => { stopScan(); show('landing'); $('error').textContent = JSON.parse(m.data).message; });
    source.onerror = () => {
      if (!source) return;
      stopScan(); show('landing');
      $('error').textContent = 'The connection to the spirits was lost. Check the scanner is still running in your terminal, then try again.';
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
    setPhase('Spirits, how many ghosts walk this house?');
    reading('The question', `How many ghosts walk ${hostOf(result.site)}?`);
    point(null, true);
    let skip = false;
    const onSkip = () => { skip = true; };
    document.addEventListener('click', onSkip, { once: true });
    document.addEventListener('keydown', onSkip, { once: true });
    const wait = (ms) => (skip ? Promise.resolve() : sleep(ms));
    await wait(1300);
    if (n) { for (const d of String(n)) { point(d); ripple(); await wait(900); } }
    point(n ? 'YES' : 'NO');
    ripple(Boolean(n));
    sfx.answer();
    setPhase(n ? `The spirits have spoken: ${fmt(n)} ghost${n === 1 ? '' : 's'}.` : 'The spirits have spoken: the house is at peace.');
    await wait(1700);
    const s0 = result.ghosts.reduce((acc, g) => acc + (state.banished.has(g.id) ? 0 : ghostScore(g)), 0);
    const leftNow = result.ghosts.filter((g) => g.type !== 'locked' && !state.banished.has(g.id)).length;
    await Haunt.reveal({ count: leftNow, verdict: leftNow ? rankOf(s0) : 'At peace', host: hostOf(result.site), skip: () => skip });
    document.removeEventListener('click', onSkip);
    document.removeEventListener('keydown', onSkip);
    document.body.classList.remove('speaking');
    renderReport();
  };

  // ---------- The reading (report) ----------
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

  const recordHtml = (g, i) => {
    const subjectUrl = ['stale-year', 'past-event'].includes(g.type) ? null : g.url;
    const linkable = subjectUrl && /^https?:/.test(subjectUrl) && !/^https?:\/\/[^./]+\/?$/.test(subjectUrl);
    const shown = g.detail && g.detail.error === 'malformed' ? g.url : shortUrl(g.url);
    const target = g.quote
      ? `<p class="target quote">“${esc(g.quote)}”</p>`
      : linkable
        ? `<a class="target" href="${esc(subjectUrl)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(subjectUrl))}</a>`
        : `<p class="target">${esc(shown)}</p>`;
    const where = g.foundOn.length === 1
      ? `Found on ${esc(shortUrl(g.foundOn[0]))}`
      : `<details><summary>Found on ${g.foundOn.length} pages</summary><ul>${g.foundOn.map((p) => `<li>${esc(shortUrl(p))}</li>`).join('')}</ul></details>`;
    const tag = statusTag(g);
    const page = g.foundOn.find((p) => /^https?:/.test(p));
    const rested = state.banished.has(g.id);
    const conf = g.confidence === 'maybe' ? 'Likely, worth a look' : g.confidence === 'unverified' ? 'Could not be checked' : 'Confirmed';
    return `<li class="record${rested ? ' rested' : ''}" data-id="${esc(g.id)}" data-conf="${esc(g.confidence)}">
      <span class="rec-no">Nº ${String(i + 1).padStart(2, '0')}</span>
      <span class="sev" title="${conf}"></span>
      <div class="rec-body">
        ${target}<span class="rest-note">Laid to rest</span>
        <p class="sub">${where}${tag ? ` <span class="tag">· ${esc(tag)}</span>` : ''}${g.confidence === 'maybe' ? ' <span class="tag">· likely</span>' : ''}</p>
        ${g.type === 'locked' ? '' : `<p class="fix"><b>Fix</b>${esc(g.fix)}</p>`}
      </div>
      <div class="acts">
        ${page && !rested ? `<a class="btn ghost small" href="${esc(page)}" target="_blank" rel="noopener noreferrer">Open page</a>` : ''}
        ${g.type === 'locked' ? '' : `<button class="btn ghost small" data-toggle="${esc(g.id)}" type="button">${rested ? 'Restore' : 'Banish'}</button>`}
      </div>
    </li>`;
  };

  const caseHtml = (t) => {
    const k = KINDS[t];
    return `<section class="casefile" id="g-${t}" style="--accent:${t === 'locked' ? 'var(--bone-3)' : k.color}">
      <header class="case-head">
        <span class="case-icon">${ICONS[t]}</span>
        <div>
          <div class="case-title"><span class="n">${k.n}</span><h2>${k.name}</h2></div>
          <p class="case-meaning">${k.meaning}</p>
        </div>
        <div class="case-count"><b data-num="${t}"></b><span data-label="${t}"></span></div>
      </header>
      <ol class="records">${all(t).map(recordHtml).join('')}</ol>
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
      const k = Math.min(1, (t - t0) / 1500);
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

  const verdictWord = (text) => {
    const el = $('vWord');
    if (el.dataset.text === text) return;
    el.dataset.text = text;
    el.innerHTML = text.split('').map((ch, i) => `<span style="animation-delay:${reduceMotion ? 0 : 120 + i * 70}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  };

  const paintSummary = () => {
    const r = state.result;
    const s = scoreNow();
    const left = aliveAll().length;
    verdictWord(left ? `${rankOf(s)}.` : 'At peace.');
    const top = ORDER.filter((t) => t !== 'locked' && alive(t).length).slice(0, 2);
    $('vLine').textContent = left
      ? `${fmt(left)} ghost${left === 1 ? '' : 's'} walk these pages. ${top.length ? 'Begin with the ' + top.map((t) => count(alive(t).length, t)).join(', then the ') + '.' : ''}${state.banished.size ? ` You have banished ${fmt(state.banished.size)}.` : ''}`
      : r.ghostCount ? 'Every ghost has been banished. Run the séance again after you publish your fixes to confirm they stay gone.' : 'Nothing has died on the pages we walked. Links rot quietly, so return in a few weeks.';
    $('omens').innerHTML = `
      <div class="bad"><dt>Ghosts found</dt><dd>${fmt(left)}</dd></div>
      <div class="bad"><dt>Dead links</dt><dd>${fmt(alive('dead').length)}</dd></div>
      <div><dt>Rooms walked</dt><dd>${fmt(r.pagesScanned)}</dd></div>
      <div><dt>Doors knocked</dt><dd>${fmt(r.linksChecked)}</dd></div>`;
    const frac = Math.min(1, s / 200);
    requestAnimationFrame(() => {
      $('gFill').style.strokeDashoffset = String(315 * (1 - frac));
      $('gNeedle').style.transform = `rotate(${-90 + 180 * frac}deg)`;
    });
    countTo($('vScore'), s);
    $('gaugeCap').textContent = `Unrest · ${rankOf(s).toLowerCase()}`;
    $('spectrum').innerHTML = ORDER.filter((t) => t !== 'locked').map((t) => {
      const w = alive(t).reduce((n, g) => n + ghostScore(g), 0);
      return w ? `<span style="flex-grow:${w};background:${KINDS[t].color};color:${KINDS[t].color}" title="${esc(KINDS[t].name)}"></span>` : '';
    }).join('') || '<span style="flex-grow:1;background:var(--sage);color:var(--sage);opacity:.6"></span>';
    const activeId = document.querySelector('.toc a.active')?.getAttribute('href');
    $('toc').innerHTML = '<p class="toc-title">Case files</p>' + present().map((t) => {
      const n = t === 'locked' ? all(t).length : alive(t).length;
      return `<a href="#g-${t}" class="${n || t === 'locked' ? '' : 'clear'}${activeId === '#g-' + t ? ' active' : ''}"><span class="n">${KINDS[t].n}</span><span>${KINDS[t].name}</span><span class="c">${n || t === 'locked' ? fmt(n) : 'Clear'}</span></a>`;
    }).join('');
    present().forEach((t) => {
      const n = t === 'locked' ? all(t).length : alive(t).length;
      const num = document.querySelector(`[data-num="${t}"]`);
      const lab = document.querySelector(`[data-label="${t}"]`);
      if (num) num.textContent = n || t === 'locked' ? fmt(n) : '0';
      if (lab) lab.textContent = n || t === 'locked' ? (n === 1 ? KINDS[t].one : KINDS[t].many) : 'all laid to rest';
      $('g-' + t)?.classList.toggle('rested-all', !n && t !== 'locked');
    });
    const peace = $('peaceBlock');
    if (peace) peace.hidden = left > 0;
    paintPlain();
  };

  let observer = null;
  const watchCases = () => {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const id = en.target.id;
        document.querySelectorAll('.casefile').forEach((c) => c.classList.toggle('active', c.id === id));
        document.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
      }
    }, { rootMargin: '-35% 0px -55% 0px' });
    document.querySelectorAll('.casefile').forEach((c) => observer.observe(c));
  };

  const ghostInfo = (g) => `${KINDS[g.type].name}: ${g.quote ? '“' + g.quote.slice(0, 60) + (g.quote.length > 60 ? '…' : '') + '”' : shortUrl(g.url)}. Click to open its case file.`;
  const callRecord = (id) => {
    const el = document.querySelector(`.record[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('called'); void el.offsetWidth; el.classList.add('called');
  };
  const renderReport = () => {
    const r = state.result;
    $('rHost').textContent = hostOf(r.site);
    const date = new Date(r.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    $('rMeta').textContent = `Read on ${date}`;
    $('vScore').dataset.v = 0;
    $('vWord').dataset.text = '';
    $('gFill').style.strokeDashoffset = '315';
    $('gNeedle').style.transform = 'rotate(-90deg)';
    if (!$('gTicks').childElementCount) {
      $('gTicks').innerHTML = [0, .1, .25, .5, 1].map((f) => {
        const a = Math.PI * (1 - f);
        return `<line x1="${120 + Math.cos(a) * 86}" y1="${130 - Math.sin(a) * 86}" x2="${120 + Math.cos(a) * 78}" y2="${130 - Math.sin(a) * 78}"/>`;
      }).join('');
    }
    $('findings').innerHTML = `<div class="peace" id="peaceBlock" hidden><h2>The house is at peace.</h2><p>Nothing left to banish on the pages we walked.</p></div>`
      + present().map(caseHtml).join('');
    const l = r.limits || {};
    const notes = [];
    if (l.pagesCapped) notes.push(`The séance stopped after ${fmt(l.maxPages)} rooms. The terminal version can walk the whole house with --max-pages.`);
    if (l.linksCapped) notes.push(`${fmt(r.linksChecked)} of ${fmt(l.linksTotal)} doors were knocked on, your own first.`);
    if (l.robotsSkipped) notes.push(`${fmt(l.robotsSkipped)} room${l.robotsSkipped === 1 ? ' was' : 's were'} left alone because your robots.txt asks bots to stay out.`);
    $('limits').innerHTML = notes.map((t) => `<p>${esc(t)}</p>`).join('');
    $('limits').hidden = !notes.length;
    show('report');
    paintSummary();
    watchCases();
    Ghosts.populate(aliveAll().map((g) => ({ id: g.id, type: g.type, info: ghostInfo(g) })), innerWidth < 900 ? 5 : 9);
    Ghosts.pickable(callRecord);
  };

  $('findings').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-toggle]');
    if (!b || b.disabled) return;
    const id = b.dataset.toggle;
    const rec = b.closest('.record');
    const g = state.result.ghosts.find((x) => x.id === id);
    const idx = [...rec.parentNode.children].indexOf(rec);
    b.disabled = true;
    if (state.banished.has(id)) {
      state.banished.delete(id);
      sfx.restore();
      store.set('gs:banished:' + state.result.site, [...state.banished]);
      const fresh = document.createElement('div');
      fresh.innerHTML = recordHtml(g, idx);
      const el = fresh.firstElementChild;
      el.classList.add('returning');
      Ghosts.restore({ id, type: g.type, info: ghostInfo(g) }, rec.getBoundingClientRect());
      rec.replaceWith(el);
      setTimeout(() => el.classList.remove('returning'), 1300);
    } else {
      state.banished.add(id);
      sfx.banish();
      store.set('gs:banished:' + state.result.site, [...state.banished]);
      Haunt.release(rec);
      Ghosts.release(id, g.type);
      if (!reduceMotion) {
        const smoke = document.createElement('div');
        smoke.className = 'smoke';
        smoke.innerHTML = Array.from({ length: 6 }, (_, i) => `<i style="left:${8 + i * 15}%;animation-delay:${i * 70}ms"></i>`).join('');
        rec.appendChild(smoke);
        rec.classList.add('dissolving');
        await sleep(1000);
      }
      const fresh = document.createElement('div');
      fresh.innerHTML = recordHtml(g, idx);
      rec.replaceWith(fresh.firstElementChild);
    }
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
    x.fillStyle = '#0a0909'; x.fillRect(0, 0, W, H);
    const warm = x.createRadialGradient(925, 315, 20, 925, 315, 540);
    warm.addColorStop(0, 'rgba(138,42,46,.30)'); warm.addColorStop(.5, 'rgba(224,163,90,.05)'); warm.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = warm; x.fillRect(0, 0, W, H);
    const candle = x.createRadialGradient(0, H, 10, 0, H, 520);
    candle.addColorStop(0, 'rgba(224,163,90,.16)'); candle.addColorStop(1, 'rgba(224,163,90,0)');
    x.fillStyle = candle; x.fillRect(0, 0, W, H);
    const vig = x.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 820);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.7)');
    x.fillStyle = vig; x.fillRect(0, 0, W, H);
    const grain = await loadImg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
    if (grain) { x.globalAlpha = .05; x.drawImage(grain, 0, 0, W, H); x.globalAlpha = 1; }
    const sig = await loadImg($('sigil').innerHTML.replace('<svg ', '<svg width="1000" height="1000" '));
    if (sig) { x.globalAlpha = .1; x.drawImage(sig, 925 - 340, 315 - 340, 680, 680); x.globalAlpha = 1; }
    // lantern beam
    if (x.createConicGradient) {
      const beam = x.createConicGradient(-Math.PI / 2 - 0.62, 640, H + 60);
      beam.addColorStop(0, 'rgba(245,205,140,0)'); beam.addColorStop(0.03, 'rgba(245,205,140,.10)'); beam.addColorStop(0.055, 'rgba(245,205,140,.16)');
      beam.addColorStop(0.08, 'rgba(245,205,140,.08)'); beam.addColorStop(0.11, 'rgba(245,205,140,0)'); beam.addColorStop(1, 'rgba(245,205,140,0)');
      x.save(); x.filter = 'blur(14px)'; x.globalCompositeOperation = 'screen'; x.fillStyle = beam; x.fillRect(0, 0, W, H); x.restore();
    }
    // the figure behind the dial
    const defsMk = document.getElementById('gs-specter')?.closest('defs')?.outerHTML;
    if (defsMk) {
      const fig = await loadImg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" viewBox="0 0 200 400">${defsMk}<use href="#gs-specter" width="200" height="400"/></svg>`);
      if (fig) { x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = .26; x.drawImage(fig, 1030, 40, 250, 500); x.restore(); }
    }

    const host = hostOf(r.site);
    const left = aliveAll().length;
    const s = scoreNow();
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = '#bf9a5f'; x.font = '500 18px Inter, sans-serif';
    x.fillText('A reading for', 80, 112);
    x.fillStyle = '#ebe3d3';
    let fs = 76; x.font = `500 ${fs}px "Cormorant Garamond", Georgia, serif`;
    while (x.measureText(host).width > 600 && fs > 36) { fs -= 2; x.font = `500 ${fs}px "Cormorant Garamond", Georgia, serif`; }
    x.fillText(host, 78, 182);
    x.font = 'italic 500 60px "Cormorant Garamond", Georgia, serif';
    x.shadowColor = 'rgba(159,217,196,.35)'; x.shadowBlur = 24;
    x.fillText(left ? `${rankOf(s)}.` : 'At peace.', 78, 268);
    x.shadowBlur = 0; x.shadowColor = 'transparent';
    x.fillStyle = '#bbb1a1'; x.font = '400 18px Inter, sans-serif';
    x.fillText(left ? `${fmt(left)} ghost${left === 1 ? '' : 's'} across ${fmt(r.pagesScanned)} rooms walked` : `${fmt(r.pagesScanned)} rooms walked, nothing dead`, 80, 306);

    const kinds = ORDER.filter((t) => t !== 'locked' && alive(t).length).sort((a, b) => alive(b).length - alive(a).length).slice(0, 4);
    const maxN = Math.max(1, ...kinds.map((t) => alive(t).length));
    kinds.forEach((t, i) => {
      const y = 366 + i * 46;
      x.fillStyle = '#ebe3d3'; x.font = '500 16px Inter, sans-serif'; x.textAlign = 'left';
      x.fillText(cap(KINDS[t].many), 80, y);
      x.textAlign = 'right'; x.fillStyle = '#bf9a5f'; x.font = '500 18px Inter, sans-serif';
      x.fillText(fmt(alive(t).length), 560, y);
      x.fillStyle = 'rgba(235,227,211,.12)'; x.fillRect(80, y + 12, 480, 1);
      x.fillStyle = KINDS[t].color; x.fillRect(80, y + 11, 480 * (alive(t).length / maxN), 3);
    });

    const cx = 925, cy = 315;
    x.strokeStyle = 'rgba(235,227,211,.16)'; x.lineWidth = 1;
    [212, 204, 150, 112].forEach((rad, i) => { x.globalAlpha = i % 2 ? .6 : 1; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.stroke(); });
    x.globalAlpha = 1;
    x.font = '500 22px "Cormorant Garamond", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const litLetter = (host.match(/[a-z]/i) || ['A'])[0].toUpperCase();
    let at = null;
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 26;
      const px = cx + Math.cos(a) * 180, py = cy + Math.sin(a) * 180;
      x.save(); x.translate(px, py); x.rotate(a + Math.PI / 2);
      x.fillStyle = ch === litLetter ? '#ebe3d3' : 'rgba(235,227,211,.3)';
      x.fillText(ch, 0, 0); x.restore();
      if (ch === litLetter) at = [px, py];
    });
    if (at) {
      const halo = x.createRadialGradient(at[0], at[1], 4, at[0], at[1], 46);
      halo.addColorStop(0, 'rgba(224,163,90,.35)'); halo.addColorStop(1, 'rgba(224,163,90,0)');
      x.fillStyle = halo; x.beginPath(); x.arc(at[0], at[1], 46, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#bf9a5f'; x.lineWidth = 1.4; x.beginPath(); x.arc(at[0], at[1], 22, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = .4; x.beginPath(); x.arc(at[0], at[1], 26, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
    }
    x.fillStyle = '#ebe3d3'; x.font = '200 96px Inter, sans-serif';
    x.fillText(fmt(left), cx, cy - 10);
    x.fillStyle = '#bbb1a1'; x.font = 'italic 500 26px "Cormorant Garamond", Georgia, serif';
    x.fillText(left === 1 ? 'ghost' : 'ghosts', cx, cy + 52);

    // brass corners and the seal line
    x.strokeStyle = 'rgba(191,154,95,.55)'; x.lineWidth = 1.2;
    [[28, 28, 1, 1], [W - 28, 28, -1, 1], [28, H - 28, 1, -1], [W - 28, H - 28, -1, -1]].forEach(([px, py, sx, sy]) => {
      x.beginPath(); x.moveTo(px, py + 44 * sy); x.lineTo(px, py); x.lineTo(px + 44 * sx, py); x.stroke();
      x.beginPath(); x.moveTo(px + 6 * sx, py + 22 * sy); x.lineTo(px + 6 * sx, py + 6 * sy); x.lineTo(px + 22 * sx, py + 6 * sy); x.stroke();
    });
    x.textBaseline = 'alphabetic';
    x.textAlign = 'right'; x.fillStyle = 'rgba(191,154,95,.75)'; x.font = '500 13px Inter, sans-serif';
    x.fillText(`Sealed ${new Date(r.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, W - 80, 64);
    x.textAlign = 'left';
    x.fillStyle = 'rgba(235,227,211,.12)'; x.fillRect(80, 548, W - 160, 1);
    x.textAlign = 'left'; x.fillStyle = '#ebe3d3'; x.font = 'italic 500 24px "Cormorant Garamond", Georgia, serif';
    x.fillText('Graveyard Shift', 80, 584);
    x.textAlign = 'right'; x.fillStyle = '#7f776c'; x.font = '400 15px Inter, sans-serif';
    x.fillText('github.com/raoashwini21/graveyard-shift', W - 80, 584);
    c.toBlob((b) => b && download(b, `graveyard-shift-${host}.png`), 'image/png');
  };
})();
