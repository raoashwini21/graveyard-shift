// Graveyard Shift: interface. Plain browser JavaScript, no build step.
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

  // ---------- Sound: recorded effects in sfx/ (rendered by tools/make-sounds.py) ----------
  // Nothing plays until you press a button (browsers require it), and the header toggle mutes everything.
  let audio = null, master = null, ambGain = null, ambSrc = null;
  let soundOn = store.get('gs:sound2', true);
  const buffers = {};
  const ctx = () => {
    if (!audio) {
      try { audio = new (window.AudioContext || window.webkitAudioContext)(); master = audio.createGain(); master.gain.value = soundOn ? 0.9 : 0; master.connect(audio.destination); } catch { audio = null; }
    }
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  };
  const load = (name) => {
    if (!buffers[name]) buffers[name] = fetch('sfx/' + name + '.mp3').then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => audio.decodeAudioData(b, res, rej))).catch(() => null);
    return buffers[name];
  };
  const play = async (name, { gain = 1, rate = 1, delay = 0 } = {}) => {
    if (!soundOn || !ctx()) return;
    const buf = await load(name); if (!buf) return;
    const src = audio.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = audio.createGain(); g.gain.value = gain; src.connect(g).connect(master); src.start(audio.currentTime + delay);
  };
  const ambience = async (on) => {
    if (!ctx()) return;
    if (on) {
      if (ambSrc) return;
      const buf = await load('ambience'); if (!buf || ambSrc) return;
      ambGain = audio.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
      ambSrc = audio.createBufferSource(); ambSrc.buffer = buf; ambSrc.loop = true; ambSrc.connect(ambGain); ambSrc.start();
      ambGain.gain.linearRampToValueAtTime(0.55, audio.currentTime + 3);
    } else if (ambSrc) {
      const s = ambSrc, g = ambGain; ambSrc = null;
      g.gain.cancelScheduledValues(audio.currentTime); g.gain.setValueAtTime(g.gain.value, audio.currentTime); g.gain.linearRampToValueAtTime(0, audio.currentTime + 2.5);
      setTimeout(() => { try { s.stop(); } catch {} }, 2700);
    }
  };
  const warm = () => { if (ctx()) ['creak', 'knock', 'ambience', 'heartbeat', 'reveal', 'banish', 'ghost-dead'].forEach(load); };
  const sfx = {
    tick: () => {},
    felt: (kind) => play('ghost-' + (kind || 'dead'), { gain: 0.8, rate: 0.94 + Math.random() * 0.12 }),
    invoke: () => { play('creak', { gain: 0.9 }); ambience(true); },
    answer: () => {},
    banish: () => play('banish', { gain: 0.8 }),
    restore: () => play('creak', { gain: 0.5, rate: 1.3 }),
    scare: () => play('scare', { gain: 0.9 }),
    hush: () => { ambience(false); play('heartbeat', { gain: 1 }); },
    knock: () => play('knock', { gain: 0.8 }),
    creak: () => play('creak', { gain: 0.45, rate: 0.9 + Math.random() * 0.3 }),
    lit: () => play('reveal', { gain: 1 }),
    stop: () => ambience(false),
  };
  addEventListener('pointerdown', warm, { once: true });
  addEventListener('keydown', warm, { once: true });
  Haunt.onSound((name) => sfx[name] && sfx[name]());
  const soundBtn = $('soundBtn');
  const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.textContent = soundOn ? 'Sound on' : 'Sound off'; };
  soundBtn.onclick = () => {
    soundOn = !soundOn; store.set('gs:sound2', soundOn); paintSound();
    if (ctx() && master) master.gain.setTargetAtTime(soundOn ? 0.9 : 0, audio.currentTime, 0.05);
    if (soundOn) play('knock', { gain: 0.5 });
  };
  paintSound();

  // ---------- Plain report ----------
  // The plain report toggle was removed from the header; make sure nobody stays stuck in it.
  const isPlain = () => false;
  document.body.classList.remove('plain');
  store.set('gs:plain', false);

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
  const setProgress = (f) => { door.progress(f); if (window.Yard) Yard.progress(f); };

  // ---------- Views ----------
  let current = 'landing';
  const show = (name) => {
    current = name;
    for (const v of ['landing', 'scan', 'report']) $(v).classList.toggle('on', v === name);
    document.body.classList.toggle('on-landing', name === 'landing');
    if (name === 'landing') { door.shut(); door.label('Knock'); door.progress(0); }
    document.body.classList.toggle('on-yard', name === 'scan');
    if (name === 'scan') { $('scanSlot').appendChild(doorEl); door.shut(); door.progress(0); }
    window.scrollTo({ top: 0, behavior: 'auto' });
    Haunt.scene('quiet');
    if (name === 'landing') { Ghosts.pickable(null); Ghosts.clear(); Ghosts.setting({ avoid: '.ritual h1, .lede, .field, .opts, .door, .index-section h2', presence: 0.9 }); }
    if (name === 'scan') { Ghosts.pickable(null); Ghosts.clear(); Ghosts.setting({ avoid: '.scan-copy > *, .evidence > *, .door', presence: 0.95 }); }
    document.body.classList.toggle('on-report', name === 'report');
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

  $('reveals').innerHTML = ORDER.filter((t) => t !== 'locked').map((t) => `<li class="kind-card" style="--accent:${KINDS[t].color}">
    <span class="spirit sp-${t}" aria-hidden="true"><img src="art/spirit-${t}.webp" alt="" loading="lazy"></span>
    <span class="kc-label">${cap(KINDS[t].many)}</span>
    <span class="kc-name">${KINDS[t].name}</span>
    <span class="kc-desc">${KINDS[t].meaning}</span></li>`).join('');
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
    sfx.stop();
  };
  $('home').onclick = (e) => { e.preventDefault(); stopScan(); show('landing'); };

  const shortPath = (u) => {
    try { const x = new URL(u); return hostOf(u) === scanHost ? (x.pathname === '/' ? '/' : x.pathname + x.search) : x.hostname + (x.pathname === '/' ? '' : x.pathname); } catch { return u; }
  };
  const statusClass = (s) => (s === 'room' ? 's-room' : typeof s === 'number' ? (s >= 400 ? 's-bad' : s >= 300 ? 's-move' : 's-ok') : s === 'loop' || s === 'broken' ? 's-bad' : 's-move');
  const log = (status, text) => {
    const li = document.createElement('li');
    const label = status === 'room' ? 'room' : status === null || status === undefined ? '·' : String(status).slice(0, 6);
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
    if (window.Yard && KINDS[e.kind]) Yard.found(e.kind, e.url ? shortPath(e.url) : '', KINDS[e.kind]);
    const dd = $('cGhosts');
    dd.textContent = fmt(presences);
    dd.classList.remove('pulse'); void dd.offsetWidth; dd.classList.add('pulse');
    const now = Date.now();
    if (now - lastWhisper > 2200) {
      lastWhisper = now;
      sfx.felt(e.kind);
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
    document.body.classList.add('invoking');
    await sleep(reduceMotion || isPlain() ? 0 : 850);
    $('scanHost').textContent = scanHost;
    phaseText = ''; $('scanPhase').textContent = 'Lighting the lantern.';
    $('cPages').textContent = '0'; $('cLinks').textContent = '0'; $('cGhosts').textContent = '0';
    presences = 0;
    $('log').innerHTML = '';
    $('whisper').classList.remove('on');
    reading('Checking', 'the front gate');
    if (window.Yard) Yard.start();
    setProgress(0);
    show('scan');
    document.body.classList.add('scanning');
    document.body.classList.remove('invoking');
    door.label(scanHost);

    const qs = new URLSearchParams({ url: raw, maxPages: String(maxPages), external: $('external').checked ? '1' : '0' });
    source = new EventSource('/api/scan?' + qs);
    source.addEventListener('progress', (m) => {
      const d = JSON.parse(m.data);
      if (d.type === 'phase' && d.phase === 'knocking') setPhase('Lighting the lantern.');
      if (d.type === 'phase' && d.phase === 'reading the map') setPhase('Reading the map of the grounds.');
      if (d.type === 'phase' && d.phase === 'knocking on every door') setPhase('Testing every link, one grave at a time.');
      if (d.type === 'page') {
        setPhase('Walking every page.');
        if (window.Yard) Yard.page(d.pagesScanned);
        $('cPages').textContent = fmt(d.pagesScanned);
        setProgress(0.4 * (d.pagesScanned / maxPages));
        reading('Checking page', shortPath(d.url));
        log('room', shortPath(d.url));
      }
      if (d.type === 'link') {
        $('cLinks').textContent = fmt(d.linksChecked);
        setProgress(0.4 + 0.6 * (d.linksChecked / Math.max(1, d.linksTotal)));
        if (d.linksChecked % 2 === 0 || (typeof d.status === 'number' && d.status >= 400)) {
          reading('Testing link', shortPath(d.url));
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
  let state = { result: null, banished: new Set(), returned: new Set(), goneForGood: 0, initialScore: 0 };
  const answer = async (result) => {
    state.result = result;
    // Banishing means "I fixed it". A fresh scan is the proof: anything banished that the scanner finds
    // again has come back and counts as a ghost; anything banished that is no longer found is gone for good.
    const before = new Set(store.get('gs:banished:' + result.site, []));
    const ids = new Set(result.ghosts.map((g) => g.id));
    state.returned = new Set([...before].filter((id) => ids.has(id)));
    state.goneForGood = [...before].filter((id) => !ids.has(id)).length;
    state.banished = new Set();
    store.set('gs:banished:' + result.site, []);
    state.initialScore = result.ghosts.reduce((n, g) => n + ghostScore(g), 0);
    const n = result.ghostCount;
    if (isPlain() || reduceMotion) { renderReport(); return; }

    document.body.classList.add('speaking');
    setPhase('Every page walked. Counting the graves.');
    reading('Done', hostOf(result.site));
    if (window.Yard) Yard.finish(n);
    let skip = false;
    const onSkip = () => { skip = true; };
    document.addEventListener('click', onSkip, { once: true });
    document.addEventListener('keydown', onSkip, { once: true });
    const wait = (ms) => (skip ? Promise.resolve() : sleep(ms));
    await wait(700);
    await wait(900);
    sfx.knock(); await wait(1100);
    setPhase(n ? `${fmt(n)} ghost${n === 1 ? '' : 's'} in this graveyard.` : 'Not a single ghost. Wisp is delighted.');
    await wait(1600);
    const s0 = result.ghosts.reduce((acc, g) => acc + (state.banished.has(g.id) ? 0 : ghostScore(g)), 0);
    const leftNow = result.ghosts.filter((g) => g.type !== 'locked' && !state.banished.has(g.id)).length;
    if (window.Yard && document.body.classList.contains('on-yard')) {
      await Yard.drain(skip ? 0 : 6000);
      const byKind = ORDER.filter((t) => t !== 'locked').map((t) => [t, result.ghosts.filter((g) => g.type === t && !state.banished.has(g.id)).length]).filter(([, c]) => c);
      sfx.hush();
      await sleep(skip ? 0 : 700);
      await Yard.reveal({ count: leftNow, kinds: byKind, verdict: leftNow ? rankOf(s0) : 'At peace', host: hostOf(result.site), skip: () => skip,
        plural: (t, c) => (c === undefined ? KINDS[t] : c === 1 ? KINDS[t].one : KINDS[t].many), sound: () => sfx.lit() });
    } else await Haunt.reveal({ count: leftNow, verdict: leftNow ? rankOf(s0) : 'At peace', host: hostOf(result.site), skip: () => skip });
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
    if (g.confidence === 'maybe') return /^\d+$/.test(tag) ? `Needs review · ${tag}` : 'Needs review';
    if (g.type === 'dead' && /^\d+$/.test(tag)) return `${k} · ${tag}`;
    if (g.type === 'dead' && tag === 'domain gone') return `${k} · no domain`;
    if (g.type === 'chain' && tag) return `${k} · ${tag}`;

    return k;
  };
  // Proof from the page itself: the exact link as written, its text, and what the server said.
  // Proof in plain words: the link text you'd look for on the page, plus what the server or the redirect did.
  // The exact address is shown only when the address itself is what's wrong.
  const evidenceHtml = (g) => {
    const d = g.detail || {}, ev = d.evidence, bits = [];
    if (d.error === 'malformed' && ev) bits.push(`written on the page as <code>${esc(ev.href)}</code>${ev.text ? ` (“${esc(ev.text)}”)` : ''}`);
    else if (ev && ev.text) bits.push(`link text “${esc(ev.text)}”`);
    if (g.type === 'possessed' && d.finalUrl) bits.push(`now lands on ${esc(hostOf(d.finalUrl))}`);
    if (g.type === 'dead' && d.status) bits.push(`server said ${esc(d.status)}`);
    if (d.verified) bits.push('double-checked as a browser');
    if (d.note) bits.push(esc(d.note));
    return bits.length ? `<p class="rec-evidence"><b>Evidence</b>${bits.join(' · ')}</p>` : '';
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
    const conf = g.confidence === 'maybe' ? 'Needs review: probably real, worth a look' : g.confidence === 'unverified' ? 'Could not be checked' : 'Confirmed';
    return `<li class="record${rested ? ' rested' : ''}" data-id="${esc(g.id)}" data-conf="${esc(g.confidence)}">
      <span class="rec-no">Nº ${String(i + 1).padStart(2, '0')}</span>
      <span class="sev" title="${conf}"></span>
      <span class="rec-stamp" aria-hidden="true">${rested ? 'Laid to rest' : state.returned.has(g.id) ? 'Came back' : esc(stampText(g))}</span>
      <div class="rec-body">
        ${target}<span class="rest-note">Laid to rest</span>
        <div class="sub">${where}${tag ? ` <span class="tag">· ${esc(tag)}</span>` : ''}${g.confidence === 'maybe' ? ' <span class="tag review">· needs review</span>' : ''}${state.returned.has(g.id) ? ' <span class="tag back">· you marked this fixed, but it\'s still there</span>' : ''}</div>
        ${evidenceHtml(g)}
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
    const fx = `<div class="case-fx fx-${t}" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i style="--i:${i};--r:${(i * 37) % 100}"></i>`).join('')}${t === 'speechless' ? '<em>shh…</em><em>shh…</em>' : ''}</div>`;
    return `<section class="casefile kind-${t}" id="g-${t}" style="--accent:${t === 'locked' ? '#9aa3b5' : k.color}">${fx}
      <header class="case-head">
        <button class="spirit sp-${t}" type="button" data-spirit="${t}" aria-label="${esc(k.name)}: hear it"><img src="art/spirit-${t}.webp" alt="" onerror="this.parentNode.classList.add('no-art');this.style.display='none'"></button>
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
    const rows = aliveAll().map((g) => `<tr><td>${esc(g.name)}${g.confidence === 'maybe' ? ' (needs review)' : ''}</td>
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
    const rank = text.replace(/\.$/, '');
    el.innerHTML = text.split('').map((ch, i) => `<span style="animation-delay:${reduceMotion ? 0 : 120 + i * 70}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')
      + `<i class="verdict-emoji" aria-hidden="true" style="animation-delay:${reduceMotion ? 0 : 200 + text.length * 70}ms">${RANK_EMOJI[rank] || '👻'}</i>`;
    el.dataset.rank = rank;
  };
  const RANK_EMOJI = { 'At peace': '🌙', Restless: '🕯️', Haunted: '👻', Infested: '🕷️', Cursed: '💀' };
  // Claw marks across the verdict, as if something tried to get out.
  const CLAWS = (() => {
    // four tapered, ragged gouges, thick in the middle and sharp at both ends
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const gouge = (x0, y0, x1, y1, w) => {
      const L = [], R = [], n = 22;
      for (let k = 0; k <= n; k++) {
        const t = k / n, bend = Math.sin(t * Math.PI) * 14;
        const x = x0 + (x1 - x0) * t + bend, y = y0 + (y1 - y0) * t;
        const half = Math.pow(Math.sin(t * Math.PI), 0.7) * w * (0.75 + rnd() * 0.5);
        const nx = (y1 - y0), ny = -(x1 - x0), nl = Math.hypot(nx, ny);
        L.push(`${(x + nx / nl * half).toFixed(1)},${(y + ny / nl * half).toFixed(1)}`);
        R.unshift(`${(x - nx / nl * half * 0.6).toFixed(1)},${(y - ny / nl * half * 0.6).toFixed(1)}`);
      }
      return `M${L.join(' L')} L${R.join(' L')} Z`;
    };
    const marks = [0, 1, 2, 3].map((i) => gouge(40 + i * 46, 8 + i * 10, 70 + i * 50, 170 - Math.abs(i - 1.5) * 18, 7 + (i === 1 || i === 2 ? 2 : 0)));
    return `<svg class="claws" viewBox="0 0 300 200" aria-hidden="true">${marks.map((d, i) => `<g style="animation-delay:${700 + i * 80}ms"><path class="claw-deep" d="${d}"/><path class="claw-lit" d="${d}"/></g>`).join('')}</svg>`;
  })();

  const paintSummary = () => {
    const r = state.result;
    const s = scoreNow();
    const left = aliveAll().length;
    verdictWord(left ? `${rankOf(s)}.` : 'At peace.');
    const top = ORDER.filter((t) => t !== 'locked' && alive(t).length).slice(0, 2);
    $('vLine').textContent = left
      ? `${fmt(left)} ghost${left === 1 ? ' is' : 's are'} living in these pages, and your visitors are walking right into them. ${top.length ? 'Start with the ' + top.map((t) => count(alive(t).length, t)).join(', then the ') + '.' : ''}${state.returned.size ? ` ${fmt(state.returned.size)} you marked fixed last time ${state.returned.size === 1 ? 'is' : 'are'} still here.` : ''}${state.goneForGood ? ` ${fmt(state.goneForGood)} you fixed ${state.goneForGood === 1 ? 'is' : 'are'} gone for good.` : ''}${state.banished.size ? ` ${fmt(state.banished.size)} banished so far.` : ''}`
      : r.ghostCount ? 'Every ghost banished. Publish your fixes, then search the house again to make sure they stay gone.' : 'Not a single ghost on the pages we searched. Links rot quietly, so come back in a few weeks, or hire the night watchman.';
    $('omens').innerHTML = `
      <div class="bad"><dt>👻 Ghosts found</dt><dd>${fmt(left)}</dd></div>
      <div class="bad"><dt>🪦 Dead links</dt><dd>${fmt(alive('dead').length)}</dd></div>
      <div><dt>🏚️ Pages checked</dt><dd>${fmt(r.pagesScanned)}</dd></div>
      <div><dt>🔗 Links tested</dt><dd>${fmt(r.linksChecked)}</dd></div>`;
    const frac = Math.min(1, s / 200);
    requestAnimationFrame(() => {
      $('gFill').style.strokeDashoffset = String(315 * (1 - frac));
      $('gNeedle').style.transform = `rotate(${-90 + 180 * frac}deg)`;
    });
    countTo($('vScore'), s);
    $('gaugeCap').textContent = `Haunt level · ${(left ? rankOf(s) : 'at peace').toLowerCase()}`;
    const nowRank = left ? rankOf(s) : 'At peace';
    document.querySelectorAll('#gTicks .g-emoji').forEach((e) => e.classList.toggle('now', e.dataset.rank === nowRank));
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
    $('rMeta').textContent = `Checked on ${date} · ${fmt(r.pagesScanned)} pages · ${fmt(r.linksChecked)} links`;
    if (!document.querySelector('.verdict .claws')) document.querySelector('.verdict-main').insertAdjacentHTML('afterbegin', CLAWS);
    $('vScore').dataset.v = 0;
    $('vWord').dataset.text = '';
    $('gFill').style.strokeDashoffset = '315';
    $('gNeedle').style.transform = 'rotate(-90deg)';
    if (!$('gTicks').childElementCount) {
      // tick marks at the rank boundaries, and each rank's emoji in the middle of its band
      $('gTicks').innerHTML = [0, .1, .25, .5, 1].map((f) => {
        const a = Math.PI * (1 - f);
        return `<line x1="${120 + Math.cos(a) * 86}" y1="${130 - Math.sin(a) * 86}" x2="${120 + Math.cos(a) * 78}" y2="${130 - Math.sin(a) * 78}"/>`;
      }).join('') + [['At peace', 0], ['Restless', .05], ['Haunted', .175], ['Infested', .375], ['Cursed', .75]].map(([k, f]) => {
        const a = Math.PI * (1 - f), rr = 124;
        return `<text class="g-emoji" data-rank="${k}" x="${(120 + Math.cos(a) * rr).toFixed(1)}" y="${(130 - Math.sin(a) * rr).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${RANK_EMOJI[k]}</text>`;
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
    Ghosts.clear();
  };

  // Banish: a little copy of that kind's spirit lifts off the record and dissolves into sparks.
  const releaseSpirit = (rec, type) => {
    if (reduceMotion || document.body.classList.contains('calm')) return;
    const r = rec.getBoundingClientRect();
    const w = document.createElement('div');
    w.className = 'released';
    w.innerHTML = `<img src="art/spirit-${type}.webp" alt="" onerror="this.remove()">` + Array.from({ length: 14 }, (_, i) => `<i style="--a:${(i / 14) * 360}deg;--d:${40 + (i * 23) % 50}px"></i>`).join('');
    w.style.left = (r.left + Math.min(r.width * 0.35, 260)) + 'px'; w.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(w);
    setTimeout(() => w.remove(), 2200);
  };
  $('findings').addEventListener('click', (e) => {
    const sp = e.target.closest('[data-spirit]');
    if (sp) { sfx.felt(sp.dataset.spirit); sp.classList.remove('spooked'); void sp.offsetWidth; sp.classList.add('spooked'); }
  });
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
      rec.replaceWith(el);
      setTimeout(() => el.classList.remove('returning'), 1300);
    } else {
      state.banished.add(id);
      sfx.banish();
      store.set('gs:banished:' + state.result.site, [...state.banished]);
      releaseSpirit(rec, g.type);
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
    const img = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    try { await Promise.all(['620 90px Fraunces', 'italic 560 90px Fraunces', '600 20px "Bricolage Grotesque"', '400 18px "Bricolage Grotesque"'].map((f) => document.fonts.load(f))); } catch {}
    const W = 1200, H = 630, S = 2;
    const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    const x = c.getContext('2d'); x.scale(S, S);
    const host = hostOf(r.site), left = aliveAll().length, s = scoreNow();
    const kinds = ORDER.filter((t) => t !== 'locked' && alive(t).length).sort((a, b) => alive(b).length - alive(a).length).slice(0, 3);
    const [bg, wisp, ...sp] = await Promise.all(['art/bg.webp', left ? 'art/ghost-idle.webp' : 'art/ghost-happy.webp', ...kinds.map((t) => `art/spirit-${t}.webp`)].map(img));
    // the painted night, cropped so the manor and moon sit on the right
    x.fillStyle = '#0b1029'; x.fillRect(0, 0, W, H);
    if (bg) { const sc = Math.max(W / bg.width, H / bg.height) * 1.05; x.drawImage(bg, W - bg.width * sc + 40, (H - bg.height * sc) * 0.4, bg.width * sc, bg.height * sc); }
    const shade = x.createLinearGradient(0, 0, W, 0);
    shade.addColorStop(0, 'rgba(8,12,34,.94)'); shade.addColorStop(.45, 'rgba(8,12,34,.82)'); shade.addColorStop(.72, 'rgba(8,12,34,.2)'); shade.addColorStop(1, 'rgba(8,12,34,.1)');
    x.fillStyle = shade; x.fillRect(0, 0, W, H);
    const fade = x.createLinearGradient(0, H * 0.6, 0, H); fade.addColorStop(0, 'rgba(8,12,34,0)'); fade.addColorStop(1, 'rgba(8,12,34,.85)');
    x.fillStyle = fade; x.fillRect(0, 0, W, H);
    // Wisp and his lantern light
    if (wisp) {
      const gx = 870, gy = 300, g = x.createRadialGradient(gx, gy, 10, gx, gy, 260);
      g.addColorStop(0, 'rgba(255,200,120,.35)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      x.fillStyle = g; x.fillRect(gx - 300, gy - 300, 600, 600);
      x.save(); x.shadowColor = 'rgba(200,215,255,.35)'; x.shadowBlur = 40; x.drawImage(wisp, 760, 120, 400, 400); x.restore();
    }
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = '#ffc46b'; x.font = '600 15px "Bricolage Grotesque", sans-serif';
    x.fillText('GRAVEYARD SHIFT · WEBSITE CHECK', 72, 92);
    x.fillStyle = '#f6efe1'; let fs = 60; x.font = `620 ${fs}px Fraunces, serif`;
    while (x.measureText(host).width > 560 && fs > 32) { fs -= 2; x.font = `620 ${fs}px Fraunces, serif`; }
    x.fillText(host, 70, 158);
    // the headline: N ghosts found
    x.font = 'italic 560 120px Fraunces, serif'; x.fillStyle = '#ffc46b';
    x.shadowColor = 'rgba(255,170,80,.45)'; x.shadowBlur = 40;
    const num = left ? fmt(left) : 'No';
    x.fillText(num, 66, 290); const nw = x.measureText(num).width; x.shadowBlur = 0;
    x.font = '620 64px Fraunces, serif'; x.fillStyle = '#f6efe1';
    x.fillText(left === 1 ? 'ghost found' : 'ghosts found', 66 + nw + 22, 286);
    // verdict pill
    const verdict = (left ? rankOf(s) : 'At peace').toUpperCase();
    x.font = '650 14px "Bricolage Grotesque", sans-serif'; const vw = x.measureText(verdict).width + 36;
    x.fillStyle = left ? 'rgba(255,120,90,.14)' : 'rgba(156,199,169,.16)'; x.strokeStyle = left ? 'rgba(255,140,110,.5)' : 'rgba(156,199,169,.55)'; x.lineWidth = 1.2;
    x.beginPath(); x.roundRect(70, 336, vw, 34, 17); x.fill(); x.stroke();
    x.fillStyle = left ? '#ffb4a0' : '#a6d1b3'; x.fillText(verdict, 88, 358);
    x.fillStyle = 'rgba(246,239,225,.7)'; x.font = '400 17px "Bricolage Grotesque", sans-serif';
    x.fillText(`${fmt(r.pagesScanned)} pages and ${fmt(r.linksChecked)} links checked`, 70 + vw + 18, 359);
    // the ghosts, with their spirits
    kinds.forEach((t, i) => {
      const y = 404 + i * 64;
      x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.roundRect(70, y, 470, 54, 27); x.fill();
      if (sp[i]) x.drawImage(sp[i], 76, y - 6, 62, 62);
      x.fillStyle = '#f6efe1'; x.font = '650 24px Fraunces, serif'; x.fillText(fmt(alive(t).length), 150, y + 36);
      const nwid = x.measureText(fmt(alive(t).length)).width;
      x.fillStyle = 'rgba(246,239,225,.85)'; x.font = '500 17px "Bricolage Grotesque", sans-serif';
      x.fillText(alive(t).length === 1 ? KINDS[t].one : KINDS[t].many, 150 + nwid + 14, y + 34);
    });
    if (!left) { x.fillStyle = 'rgba(246,239,225,.8)'; x.font = 'italic 500 26px Fraunces, serif'; x.fillText('Not a single dead link. Wisp is delighted.', 70, 440); }
    x.fillStyle = 'rgba(246,239,225,.55)'; x.font = '500 15px "Bricolage Grotesque", sans-serif'; x.textAlign = 'right';
    x.fillText(`Checked ${new Date(r.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · github.com/raoashwini21/graveyard-shift`, W - 60, H - 36);
  c.toBlob((b) => b && download(b, `graveyard-shift-${host}.png`), 'image/png');
  };
})();
