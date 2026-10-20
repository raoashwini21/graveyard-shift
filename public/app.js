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
    dead: { n: 'XIII', name: 'The Departed', one: 'dead link', many: 'dead links', color: '#c2474a', stamp: 'Deceased',
      epitaph: 'Here lies a link. It led nowhere.',
      meaning: 'Links to pages that no longer exist. Every click is a reader walking into a wall.' },
    possessed: { n: 'XV', name: 'The Possessed', one: 'hijacked link', many: 'hijacked links', color: '#d0703f', stamp: 'Possessed',
      epitaph: 'You linked to a friend. Something else answers now.',
      meaning: 'Links to one company that now land on another. The tool you recommended was bought, renamed or shut down, and your readers end up on a stranger\'s site.' },
    'past-event': { n: 'VI', name: 'The Forgotten Feast', one: 'expired invitation', many: 'expired invitations', color: '#e0a35a', stamp: 'Expired',
      epitaph: 'The party ended. The invitation is still on the door.',
      meaning: 'Events whose date has passed, still inviting people in. Nothing says nobody lives here like last year\'s webinar.' },
    'stale-year': { n: 'X', name: 'The Stopped Clock', one: 'frozen year', many: 'frozen years', color: '#c9a060', stamp: 'Stopped',
      epitaph: 'Every clock in this room stopped the same year.',
      meaning: 'Copyright lines stuck in an old year. Tiny, but it makes the whole house look abandoned.' },
    nameless: { n: '0', name: 'The Nameless', one: 'page without a title', many: 'pages without a title', color: '#a493b5', stamp: 'Nameless',
      epitaph: 'Buried without a name. Google can\'t call it anything either.',
      meaning: 'Pages with no title. Search results and browser tabs have nothing to call them.' },
    chain: { n: 'IX', name: 'The Wanderer', one: 'redirect chain', many: 'redirect chains', color: '#8fa7b8', stamp: 'Lost',
      epitaph: 'Took the long way round. Then took it again.',
      meaning: 'Links that bounce through several redirects before arriving. Slower for readers, weaker for search.' },
    speechless: { n: 'II', name: 'The Silent', one: 'page without a description', many: 'pages without a description', color: '#8d8597', stamp: 'Mute',
      epitaph: 'Says nothing to strangers. Google fills the silence, badly.',
      meaning: 'Pages with no meta description. Search engines will write one for you, and you won\'t like it.' },
    locked: { n: 'XX', name: 'The Locked Door', one: 'unverified link', many: 'unverified links', color: 'transparent', stamp: 'Locked',
      epitaph: 'Something is behind this door. It won\'t let bots in.',
      meaning: 'Links on sites that turn bots away, so they could not be checked. Open the ones that matter yourself.' },
  };
  const ORDER = ['dead', 'possessed', 'past-event', 'stale-year', 'nameless', 'chain', 'speechless', 'locked'];
  const WEIGHT = { dead: 10, possessed: 6, chain: 4, nameless: 6, speechless: 3, 'stale-year': 5, 'past-event': 7, locked: 0 };
  const ghostScore = (g) => Math.round((WEIGHT[g.type] || 0) * Math.min(1 + (g.foundOn.length - 1) * 0.25, 3));
  const rankOf = (s) => (s === 0 ? 'At peace' : s <= 20 ? 'Restless' : s <= 50 ? 'Haunted' : s <= 100 ? 'Infested' : 'Cursed');
  const count = (n, t) => `${fmt(n)} ${n === 1 ? KINDS[t].one : KINDS[t].many}`;
  const WHISPERS = {
    dead: (u) => `Something died at ${u}.`,
    possessed: (u) => `${u} answers in a stranger's voice.`,
    'past-event': () => 'The party ended. The invitation is still up.',
    'stale-year': () => 'A clock in this house stopped years ago.',
    nameless: (u) => `A room with no name: ${u}.`,
    chain: (u) => `Footsteps wander off from ${u}.`,
    speechless: (u) => `${u} won't say a word.`,
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
    knock: () => { tone(120, 0.12, 0.12, 70, 'triangle'); setTimeout(() => tone(110, 0.12, 0.1, 65, 'triangle'), 170); },
    creak: () => { tone(180 + Math.random() * 60, 0.7, 0.012, 260 + Math.random() * 80, 'sawtooth'); },
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

  // ---------- Dust in the candlelight ----------
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

  // ---------- The door ----------
  const door = Door.create(document.createElement('div'));
  const doorEl = door.el;
  const setProgress = (f) => door.progress(f);

  // ---------- Views ----------
  let current = 'landing';
  const show = (name) => {
    current = name;
    for (const v of ['landing', 'scan', 'report']) $(v).classList.toggle('on', v === name);
    document.body.classList.toggle('on-landing', name === 'landing');
    if (name === 'landing') { door.shut(); door.label('Knock'); door.progress(0); }
    if (name === 'scan') { $('scanSlot').appendChild(doorEl); door.shut(); door.progress(0); }
    window.scrollTo({ top: 0, behavior: 'auto' });
    Haunt.scene(name === 'landing' ? 'quiet' : name);
    if (name === 'landing') { Ghosts.pickable(null); Ghosts.clear(); Ghosts.setting({ avoid: '.ritual h1, .lede, .field, .opts, .door, .index-section h2', presence: 0.9 }); }
    if (name === 'scan') { Ghosts.pickable(null); Ghosts.clear(); Ghosts.setting({ avoid: '.scan-copy > *, .evidence > *, .door', presence: 0.95 }); }
    if (name === 'report') Ghosts.setting({ avoid: '.report-head > *, .verdict-main > *, .gauge, .casefile, .toc, .limits', presence: 0.55 });
    if (name === 'landing') { idleSpoken = 0; lastTyped = Date.now(); }
  };

  let lastTyped = 0;
  let idleTimer = null;
  let idleSpoken = 0;
  // Left alone, the house starts doing things by itself.
  const MESSAGES = [
    { after: 9000, run: () => { door.label('Someone\'s home'); door.peek(3200); Haunt.gutter(500); } },
    { after: 24000, run: () => { door.knock(); sfx.knock(); door.label('Let me out'); } },
    { after: 45000, run: () => { door.label('Behind you'); Haunt.drift({ opacity: 0.22, height: 64, duration: 9000, y: 14 }); } },
  ];
  const idle = () => {
    clearTimeout(idleTimer);
    if (reduceMotion) return;
    idleTimer = setTimeout(() => {
      const quiet = Date.now() - lastTyped;
      if (current === 'landing' && !isPlain() && !$('url').value) {
        const next = MESSAGES[idleSpoken];
        if (next && quiet > next.after && document.activeElement !== $('url')) { idleSpoken++; next.run(); setTimeout(() => !$('url').value && door.label('Knock'), 4000); }
      }
      idle();
    }, 3000);
  };
  let knockAt = 0;
  $('url').addEventListener('input', (e) => {
    lastTyped = Date.now();
    const v = e.target.value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    door.label(v || 'Knock');
    if (Date.now() - knockAt > 900 && v) { knockAt = Date.now(); door.knock(); sfx.tick(); }
  });

  $('reveals').innerHTML = ORDER.filter((t) => t !== 'locked').map((t) => `<li>
    <span class="top-row"><span class="icon">${ICONS[t]}</span><span class="stamp" style="--ink:${KINDS[t].color}">${KINDS[t].stamp}</span></span>
    <span class="name">${KINDS[t].name}</span><span class="kind">${cap(KINDS[t].many)}</span><span class="desc">${KINDS[t].meaning}</span><span class="epitaph">${KINDS[t].epitaph}</span></li>`).join('');
  show('landing');

  // ---------- The séance (scan) ----------
  let source = null;
  let scanHost = '';
  let maxPages = 100;
  let presences = 0;
  let whisperTimer = null;
  let lastWhisper = 0;

  const stopScan = () => {
    if (source) source.close();
    source = null;
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
  let lastFlash = 0;
  const reading = (label, url) => {
    $('rnLabel').textContent = label;
    const el = $('rnUrl');
    el.textContent = url;
    if (Date.now() - lastFlash > 700) { lastFlash = Date.now(); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  };
  const felt = (e) => {
    presences++;
    const mouth = door.mouth();
    Haunt.felt(e.kind, mouth, presences);
    if (KINDS[e.kind]) Ghosts.spawn(e.kind, mouth, `${KINDS[e.kind].name} · ${e.url ? shortPath(e.url) : ''}`);
    const dd = $('cGhosts');
    dd.textContent = fmt(presences);
    dd.classList.remove('pulse'); void dd.offsetWidth; dd.classList.add('pulse');
    const now = Date.now();
    if (now - lastWhisper > 2200) {
      lastWhisper = now;
      document.body.classList.add('felt');
      setTimeout(() => document.body.classList.remove('felt'), 900);
      door.burst();
      door.label(KINDS[e.kind] ? KINDS[e.kind].stamp : 'Something');
      sfx.felt();
      const w = $('whisper');
      w.textContent = (WHISPERS[e.kind] || (() => 'Something moved.'))(e.url ? shortPath(e.url) : 'this house');
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
    if (!raw) { $('error').textContent = 'Which house? Type an address first, like yoursite.com.'; $('url').focus(); door.knock(); return; }
    $('error').textContent = '';
    scanHost = hostOf(/^http:/i.test(raw) ? raw : 'https://' + raw);
    maxPages = Number($('maxPages').value);

    // The door swings open and you step through.
    sfx.invoke();
    door.wide();
    document.body.classList.add('invoking');
    await sleep(reduceMotion || isPlain() ? 0 : 850);
    $('scanHost').textContent = scanHost;
    phaseText = ''; $('scanPhase').textContent = 'Picking the lock.';
    $('cPages').textContent = '0'; $('cLinks').textContent = '0'; $('cGhosts').textContent = '0';
    presences = 0;
    $('log').innerHTML = '';
    $('whisper').classList.remove('on');
    reading('Opening', 'the front door');
    setProgress(0);
    show('scan');
    document.body.classList.add('scanning');
    document.body.classList.remove('invoking');
    door.label(scanHost);

    const qs = new URLSearchParams({ url: raw, maxPages: String(maxPages), external: $('external').checked ? '1' : '0' });
    source = new EventSource('/api/scan?' + qs);
    source.addEventListener('progress', (m) => {
      const d = JSON.parse(m.data);
      if (d.type === 'phase' && d.phase === 'knocking') setPhase('Picking the lock.');
      if (d.type === 'phase' && d.phase === 'reading the map') setPhase('Reading the floor plan.');
      if (d.type === 'phase' && d.phase === 'knocking on every door') { setPhase('Rattling every door handle.'); door.label('Every door'); }
      if (d.type === 'page') {
        setPhase('Searching every room.');
        $('cPages').textContent = fmt(d.pagesScanned);
        setProgress(0.4 * (d.pagesScanned / maxPages));
        reading('Opening', shortPath(d.url));
        log('room', shortPath(d.url));
        if (door.enter(shortPath(d.url), 700)) sfx.creak();
        if (d.pagesScanned % 3 === 0) Hall.creak(1200);
      }
      if (d.type === 'link') {
        $('cLinks').textContent = fmt(d.linksChecked);
        setProgress(0.4 + 0.6 * (d.linksChecked / Math.max(1, d.linksTotal)));
        if (d.linksChecked % 2 === 0 || (typeof d.status === 'number' && d.status >= 400)) {
          reading('Rattling', shortPath(d.url));
          if (d.linksChecked % 6 === 0) door.knock();
          log(d.status, d.status === 'broken' ? d.url : shortPath(d.url));
        }
      }
      if (d.type === 'presence') felt(d);
    });
    source.addEventListener('done', (m) => { const r = JSON.parse(m.data); stopScan(); setProgress(1); answer(r); });
    source.addEventListener('fail', (m) => { stopScan(); show('landing'); $('error').textContent = JSON.parse(m.data).message; });
    source.onerror = () => {
      if (!source) return;
      stopScan(); show('landing');
      $('error').textContent = 'The lights went out: lost the connection to the scanner. Check it is still running in your terminal, then try again.';
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
    setPhase('Every room searched. Opening the last door.');
    reading('Last door', hostOf(result.site));
    door.label('The truth');
    let skip = false;
    const onSkip = () => { skip = true; };
    document.addEventListener('click', onSkip, { once: true });
    document.addEventListener('keydown', onSkip, { once: true });
    const wait = (ms) => (skip ? Promise.resolve() : sleep(ms));
    await wait(700);
    door.knock(); sfx.knock(); await wait(650);
    door.knock(); sfx.knock(); await wait(900);
    door.ajar(); sfx.creak(); await wait(900);
    door.wide(); sfx.answer();
    if (n) { const m = door.mouth(); Ghosts.swarm({ x: m.left + m.width / 2, y: m.top + m.height / 2 }); }
    setPhase(n ? `${fmt(n)} ghost${n === 1 ? ' was' : 's were'} hiding in here.` : 'Empty. Not a single ghost.');
    await wait(1500);
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

  const stampText = (g) => {
    const tag = statusTag(g);
    const k = KINDS[g.type].stamp;
    if (g.type === 'dead' && /^\d+$/.test(tag)) return `${k} · ${tag}`;
    if (g.type === 'dead' && tag === 'domain gone') return `${k} · no domain`;
    if (g.type === 'chain' && tag) return `${k} · ${tag}`;
    if (g.confidence === 'maybe') return `${k} · likely`;
    return k;
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
      <span class="rec-stamp" aria-hidden="true">${rested ? 'Laid to rest' : esc(stampText(g))}</span>
      <div class="rec-body">
        ${target}<span class="rest-note">Laid to rest</span>
        <p class="sub">${where}${tag ? ` <span class="tag">· ${esc(tag)}</span>` : ''}${g.confidence === 'maybe' ? ' <span class="tag">· likely</span>' : ''}</p>
        ${g.type === 'locked' ? '' : `<p class="fix"><b>The cure</b>${esc(g.fix)}</p>`}
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
        <span class="room-door" aria-hidden="true"><i class="rd-light"></i><i class="rd-eyes"><b></b><b></b></i><i class="rd-leaf"></i></span>
        <div>
          <div class="case-title"><span class="n">Room ${k.n}</span><h2>${k.name}</h2></div>
          <p class="case-epitaph">${k.epitaph}</p>
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
      ? `${fmt(left)} ghost${left === 1 ? ' is' : 's are'} living in these pages, and your visitors are walking right into them. ${top.length ? 'Start with the ' + top.map((t) => count(alive(t).length, t)).join(', then the ') + '.' : ''}${state.banished.size ? ` ${fmt(state.banished.size)} banished so far.` : ''}`
      : r.ghostCount ? 'Every ghost banished. Publish your fixes, then search the house again to make sure they stay gone.' : 'Not a single ghost on the pages we searched. Links rot quietly, so come back in a few weeks, or hire the night watchman.';
    $('omens').innerHTML = `
      <div class="bad"><dt>Ghosts found</dt><dd>${fmt(left)}</dd></div>
      <div class="bad"><dt>Dead links</dt><dd>${fmt(alive('dead').length)}</dd></div>
      <div><dt>Rooms searched</dt><dd>${fmt(r.pagesScanned)}</dd></div>
      <div><dt>Doors tried</dt><dd>${fmt(r.linksChecked)}</dd></div>`;
    const frac = Math.min(1, s / 200);
    requestAnimationFrame(() => {
      $('gFill').style.strokeDashoffset = String(315 * (1 - frac));
      $('gNeedle').style.transform = `rotate(${-90 + 180 * frac}deg)`;
    });
    countTo($('vScore'), s);
    $('gaugeCap').textContent = `Haunt level · ${rankOf(s).toLowerCase()}`;
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
      $('g-' + t)?.style.setProperty('--n', String(Math.min(n, 9)));
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

  const ghostInfo = (g) => `${KINDS[g.type].name}: ${g.quote ? '“' + g.quote.slice(0, 60) + (g.quote.length > 60 ? '…' : '') + '”' : shortUrl(g.url)}. Click to find where it lives.`;
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
    $('rMeta').textContent = `Searched on ${date} · ${fmt(r.pagesScanned)} rooms · ${fmt(r.linksChecked)} doors`;
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
    $('findings').innerHTML = `<div class="peace" id="peaceBlock" hidden><h2>The house is at peace.</h2><p>Nothing left to banish on the pages we searched.</p></div>`
      + present().map(caseHtml).join('');
    const l = r.limits || {};
    const notes = [];
    if (l.pagesCapped) notes.push(`We stopped after ${fmt(l.maxPages)} rooms. The terminal version can search the whole house with --max-pages.`);
    if (l.linksCapped) notes.push(`${fmt(r.linksChecked)} of ${fmt(l.linksTotal)} doors were tried, your own first.`);
    if (l.robotsSkipped) notes.push(`${fmt(l.robotsSkipped)} room${l.robotsSkipped === 1 ? ' was' : 's were'} left sealed because your robots.txt asks bots to stay out.`);
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

  $('again').onclick = () => { show('landing'); $('url').select(); $('url').focus(); };

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
    try { await Promise.all(['400 72px "Pirata One"', '400 20px "Special Elite"', '500 20px Inter', '400 18px Inter'].map((f) => document.fonts.load(f))); } catch {}
    const W = 1200, H = 630, S = 2;
    const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    const x = c.getContext('2d'); x.scale(S, S);
    x.fillStyle = '#2b2531'; x.fillRect(0, 0, W, H);
    // the hallway, shifted so its far door sits behind the count
    const hallSvg = $('hall').innerHTML.replace('<svg ', '<svg width="1600" height="1000" ');
    const hall = await loadImg(hallSvg);
    if (hall) x.drawImage(hall, 925 - 800 * 0.9, 330 - 470 * 0.9, 1600 * 0.9, 1000 * 0.9);
    const shade = x.createLinearGradient(0, 0, W, 0);
    shade.addColorStop(0, 'rgba(20,16,22,.94)'); shade.addColorStop(.48, 'rgba(20,16,22,.78)'); shade.addColorStop(.68, 'rgba(20,16,22,.15)'); shade.addColorStop(1, 'rgba(20,16,22,.25)');
    x.fillStyle = shade; x.fillRect(0, 0, W, H);
    const vig = x.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 820);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = vig; x.fillRect(0, 0, W, H);
    const grain = await loadImg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
    if (grain) { x.globalAlpha = .06; x.drawImage(grain, 0, 0, W, H); x.globalAlpha = 1; }
    // a figure standing in the hallway
    const defsMk = document.getElementById('gs-specter')?.closest('defs')?.outerHTML;
    if (defsMk) {
      const fig = await loadImg(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" viewBox="0 0 200 400">${defsMk}<use href="#gs-specter" width="200" height="400"/></svg>`);
      if (fig) { x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = .34; x.drawImage(fig, 1040, 150, 150, 300); x.restore(); }
    }

    const host = hostOf(r.site);
    const left = aliveAll().length;
    const s = scoreNow();
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = '#d9b77a'; x.font = '400 19px "Special Elite", monospace';
    x.fillText('HAUNTED HOUSE INSPECTION', 80, 108);
    x.fillStyle = '#f1e8d6';
    let fs = 84; x.font = `400 ${fs}px "Pirata One", Georgia, serif`;
    while (x.measureText(host).width > 560 && fs > 40) { fs -= 2; x.font = `400 ${fs}px "Pirata One", Georgia, serif`; }
    x.fillText(host, 78, 190);
    // the verdict, rubber-stamped
    const verdict = (left ? rankOf(s) : 'At peace').toUpperCase();
    x.save(); x.translate(84, 214); x.rotate(-0.045);
    x.font = '400 30px "Special Elite", monospace';
    const vw = x.measureText(verdict).width + 34;
    x.strokeStyle = left ? '#d9504f' : '#9cc7a9'; x.lineWidth = 3; x.strokeRect(0, 0, vw, 50);
    x.lineWidth = 1; x.strokeRect(5, 5, vw - 10, 40);
    x.fillStyle = left ? '#e2615e' : '#a6d1b3'; x.fillText(verdict, 17, 36); x.restore();
    x.fillStyle = '#cfc4b4'; x.font = '400 18px Inter, sans-serif';
    x.fillText(left ? `${fmt(left)} ghost${left === 1 ? '' : 's'} found in ${fmt(r.pagesScanned)} rooms` : `${fmt(r.pagesScanned)} rooms searched. Not one ghost.`, 80, 310);

    const kinds = ORDER.filter((t) => t !== 'locked' && alive(t).length).sort((a, b) => alive(b).length - alive(a).length).slice(0, 4);
    const maxN = Math.max(1, ...kinds.map((t) => alive(t).length));
    kinds.forEach((t, i) => {
      const y = 368 + i * 44;
      x.fillStyle = '#f1e8d6'; x.font = '500 16px Inter, sans-serif'; x.textAlign = 'left';
      x.fillText(cap(KINDS[t].many), 80, y);
      x.textAlign = 'right'; x.fillStyle = '#d9b77a'; x.font = '400 18px "Special Elite", monospace';
      x.fillText(fmt(alive(t).length), 540, y);
      x.fillStyle = 'rgba(241,232,214,.14)'; x.fillRect(80, y + 12, 460, 1);
      x.fillStyle = KINDS[t].color; x.fillRect(80, y + 11, 460 * (alive(t).length / maxN), 3);
    });

    // the count, glowing in the far doorway
    const cx = 925, cy = 300;
    const glow = x.createRadialGradient(cx, cy, 10, cx, cy, 230);
    glow.addColorStop(0, 'rgba(255,214,150,.42)'); glow.addColorStop(1, 'rgba(255,214,150,0)');
    x.fillStyle = glow; x.fillRect(cx - 240, cy - 240, 480, 480);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 24;
    x.fillStyle = '#fff4dc'; x.font = '400 170px "Pirata One", Georgia, serif';
    x.fillText(fmt(left), cx, cy - 6);
    x.font = '400 26px "Special Elite", monospace'; x.fillStyle = '#f1e8d6';
    x.fillText(left === 1 ? 'GHOST INSIDE' : 'GHOSTS INSIDE', cx, cy + 96);
    x.shadowBlur = 0; x.shadowColor = 'transparent';

    // brass corners and the seal line
    x.strokeStyle = 'rgba(217,183,122,.6)'; x.lineWidth = 1.2;
    [[28, 28, 1, 1], [W - 28, 28, -1, 1], [28, H - 28, 1, -1], [W - 28, H - 28, -1, -1]].forEach(([px, py, sx, sy]) => {
      x.beginPath(); x.moveTo(px, py + 44 * sy); x.lineTo(px, py); x.lineTo(px + 44 * sx, py); x.stroke();
      x.beginPath(); x.moveTo(px + 6 * sx, py + 22 * sy); x.lineTo(px + 6 * sx, py + 6 * sy); x.lineTo(px + 22 * sx, py + 6 * sy); x.stroke();
    });
    x.textBaseline = 'alphabetic';
    x.textAlign = 'right'; x.fillStyle = 'rgba(217,183,122,.85)'; x.font = '400 14px "Special Elite", monospace';
    x.fillText(`SEALED ${new Date(r.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`, W - 80, 64);
    x.fillStyle = 'rgba(241,232,214,.14)'; x.fillRect(80, 548, W - 160, 1);
    x.textAlign = 'left'; x.fillStyle = '#f1e8d6'; x.font = '400 30px "Pirata One", Georgia, serif';
    x.fillText('Graveyard Shift', 80, 588);
    x.textAlign = 'right'; x.fillStyle = '#a99d8d'; x.font = '400 15px Inter, sans-serif';
    x.fillText('github.com/raoashwini21/graveyard-shift', W - 80, 586);
  c.toBlob((b) => b && download(b, `graveyard-shift-${host}.png`), 'image/png');
  };
})();
