// Graveyard Shift — the scan as an actual graveyard shift.
// Wisp patrols a moonlit cemetery with his lantern while the crawler runs. His position is the real crawl
// progress, the lamps along the path light up as pages are checked, and every tombstone that rises is a
// finding the scanner actually reported (the `presence` events), carved with its kind and the URL.
window.Yard = (() => {
  const $ = (id) => document.getElementById(id);
  const yard = $('yard'), ground = $('yardGround'), lampsEl = $('yardLamps'), patrol = $('patrol');
  if (!yard) return null;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('calm');
  // Lamp posts in the painting, as fractions of the image (x, y of the lamp head). Tuned to scan-bg.
  let LAMPS = [[0.151, 0.258], [0.54, 0.337], [0.79, 0.392]];
  // Five rows of graves, smallest at the back, so a big haunting still fits on screen.
  const ROWS = [{ y: 0.7, s: 0.5, z: 1 }, { y: 0.76, s: 0.6, z: 2 }, { y: 0.83, s: 0.74, z: 3 }, { y: 0.91, s: 0.87, z: 5 }, { y: 0.995, s: 1, z: 6 }];
  const MAX_TOMBS = 40;
  const poses = {};
  patrol.querySelectorAll('[data-pose]').forEach((i) => { poses[i.dataset.pose] = i; });
  let pose = 'search', poseTimer = null;
  const setPose = (p, ms) => {
    if (poses[pose]) poses[pose].classList.remove('on');
    pose = p; poses[p].classList.add('on');
    if (!still()) { patrol.classList.remove('pop'); void patrol.offsetWidth; patrol.classList.add('pop'); }
    clearTimeout(poseTimer);
    if (ms) poseTimer = setTimeout(() => setPose('search'), ms);
  };

  // The painting is drawn with object-fit: cover, so map image fractions to screen positions.
  const IMG_W = 1536, IMG_H = 1024;
  const cover = () => {
    const W = yard.clientWidth, H = yard.clientHeight, s = Math.max(W / IMG_W, H / IMG_H);
    const w = IMG_W * s, h = IMG_H * s;
    return { W, H, ox: (W - w) * 0.5, oy: (H - h) * 0.5, w, h };
  };
  const place = (fx, fy) => { const c = cover(); return [c.ox + fx * c.w, c.oy + fy * c.h]; };

  let lamps = [];
  const buildLamps = () => {
    lampsEl.innerHTML = '';
    lamps = LAMPS.map(([fx, fy]) => {
      const el = document.createElement('i'); lampsEl.appendChild(el);
      return { el, fx, fy, lit: false };
    });
    layout();
  };
  const layout = () => {
    for (const l of lamps) { const [x, y] = place(l.fx, l.fy); l.el.style.left = x + 'px'; l.el.style.top = y + 'px'; }
    for (const t of tombs) positionTomb(t);
  };
  addEventListener('resize', layout);

  // ---------- Tombstones ----------
  let tombs = [];
  const VARIANTS = 3;
  const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const positionTomb = (t) => {
    const W = yard.clientWidth, H = yard.clientHeight;
    const row = ROWS[t.row];
    const size = Math.max(96, Math.min(196, W * 0.115)) * row.s;
    t.el.style.width = size + 'px';
    t.el.style.setProperty('--ts', size + 'px');
    t.el.style.left = (t.fx * W - size / 2) + 'px';
    t.el.style.top = (row.y * H - size * 1.05) + 'px';
    t.el.style.zIndex = String(row.z);
  };
  const freeSpot = (near) => {
    // pick the row and x near Wisp that overlaps existing stones least
    let best = null;
    for (let i = 0; i < 40; i++) {
      const fx = 0.06 + Math.random() * 0.88;
      const row = Math.floor(Math.random() * ROWS.length);
      const clash = tombs.filter((t) => t.row === row && Math.abs(t.fx - fx) < 0.11).length * 3 + tombs.filter((t) => Math.abs(t.fx - fx) < 0.06).length + (Math.abs(fx - S.fx) < 0.06 ? 1 : 0);
      if (!best || clash < best.clash) best = { fx, row, clash };
      if (clash === 0) break;
    }
    return best;
  };
  // Short words carved on the small stones, and the plain-language line for the big moment.
  const CARVE = { dead: 'Dead', possessed: 'Taken', 'past-event': 'Over', 'stale-year': 'Stuck', nameless: 'No name', chain: 'Lost', speechless: 'Mute' };
  const SAY = {
    dead: 'A link that leads nowhere',
    possessed: 'A link that lands on someone else\'s site',
    'past-event': 'An event that already happened',
    'stale-year': 'A copyright year stuck in the past',
    nameless: 'A page with no title',
    chain: 'A link that takes the long way round',
    speechless: 'A page with no description',
  };
  const where = (path) => {
    const p = (path || '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!p || p === '/') return 'on your home page';
    if (!p.startsWith('/')) return 'pointing to ' + p.split('/')[0];
    return 'on ' + (p.length > 34 ? p.slice(0, 33) + '…' : p);
  };
  const SAYN = {
    dead: 'links that lead nowhere',
    possessed: "links that land on someone else's site",
    'past-event': 'events that already happened',
    'stale-year': 'copyright years stuck in the past',
    nameless: 'pages with no title',
    chain: 'links that take the long way round',
    speechless: 'pages with no description',
  };
  let overflow = 0, sign = null;
  const found = (kind, path, K) => {
    // Once the yard is full, the rest are counted on a sign instead of piling up unreadably.
    if (tombs.length >= MAX_TOMBS) {
      overflow++;
      if (!sign) { sign = document.createElement('div'); sign.className = 'yard-sign'; ground.appendChild(sign); }
      sign.innerHTML = `<b>+${overflow}</b><span>more graves</span>`;
      queue.push({ kind, path, el: null });
      run();
      return;
    }
    const spot = freeSpot(S.fx);
    const el = document.createElement('div');
    el.className = `tomb k-${kind} waiting`;
    const v = (hash(path + kind) % VARIANTS) + 1;
    const carved = (path || '').replace(/^https?:\/\//, '');
    el.innerHTML = stoneHtml(kind, v) + '<div class="tomb-dirt"></div>';
    el.title = `${K.name}: ${carved}`;
    ground.appendChild(el);
    const t = { el, row: spot.row, fx: spot.fx, kind };
    tombs.push(t);
    positionTomb(t);
    queue.push({ kind, path, el, fx: spot.fx, v, K });
    run();
  };
  const stoneHtml = (kind, v) => `
      <img class="tomb-spirit" src="art/spirit-${kind}.webp" alt="" onerror="this.remove()">
      <div class="tomb-stone">
        <img class="tomb-img" src="art/tomb-${v}.webp" alt="" onerror="this.parentNode.classList.add('no-art')">
        <div class="tomb-carve v${v}"><i>R.I.P.</i><b>${esc(CARVE[kind] || 'Gone')}</b></div>
      </div>`;
  const rise = (item) => { if (item.el) { item.el.classList.remove('waiting'); item.el.classList.add('risen', 'landed'); } };
  const point = (fx) => { S.face = fx >= S.fx ? 1 : -1; setPose('point', 1700); };

  // Every ghost gets its moment in the big tombstone, in order. When they pour in, ghosts of the same kind
  // that are waiting together share one stone ("4 links that lead nowhere"), so the line never backs up.
  const queue = [];
  let running = false, flushing = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const run = async () => {
    if (running) return;
    running = true;
    while (queue.length) {
      const head = queue.shift();
      const group = [head];
      if (queue.length >= 2) for (let i = 0; i < queue.length; i++) if (queue[i].kind === head.kind) { group.push(queue[i]); queue.splice(i, 1); i--; }
      if (flushing || !document.body.classList.contains('on-yard')) { group.forEach(rise); continue; }
      await showBig(group, queue.length);
    }
    running = false;
  };
  const showBig = async (group, behind) => {
    const head = group[0], n = group.length, kind = head.kind;
    const big = document.createElement('div');
    big.className = `tomb-big k-${kind}`;
    const places = group.map((g) => where(g.path));
    const line = n === 1 ? (SAY[kind] || kind) : `${n} ${SAYN[kind] || kind}`;
    const sub = n === 1 ? places[0] : `${places.slice(0, 2).join(', ')}${n > 2 ? ` and ${n - 2} more` : ''}`;
    big.innerHTML = `<div class="tomb tomb-hero risen">${stoneHtml(kind, head.v || 1)}</div>
      <p class="tomb-say"><b>${esc(line)}</b><span>${esc(sub)}</span></p>`;
    document.body.appendChild(big);
    requestAnimationFrame(() => big.classList.add('on'));
    const hold = behind > 4 ? 800 : behind > 1 ? 1100 : 1500;
    await sleep(hold);
    const target = group.find((g) => g.el);
    const hero = big.querySelector('.tomb-hero');
    big.classList.add('landing');
    if (target && !still()) {
      const from = hero.getBoundingClientRect(), to = target.el.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2), sc = to.width / from.width;
      await hero.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy - 60}px) scale(${sc * 1.1})`, offset: 0.75 }, { transform: `translate(${dx}px, ${dy}px) scale(${sc})` }],
        { duration: 600, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished.catch(() => {});
    } else {
      await sleep(350);
    }
    big.remove();
    group.forEach(rise);
    if (target) point(target.fx);
  };
  // The reveal waits for the line to finish; if it's still long, the rest rise at once.
  const drain = async (max = 5000) => {
    const t0 = Date.now();
    while ((queue.length || running) && Date.now() - t0 < max) await sleep(100);
    if (queue.length || running) { flushing = true; queue.splice(0).forEach(rise); document.querySelectorAll('.tomb-big').forEach((b) => b.remove()); tombs.forEach((t) => rise({ el: t.el })); await sleep(300); flushing = false; }
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Patrol ----------
  const S = { fx: 0.14, tfx: 0.14, x: 0, vx: 0, face: 1, running: false };
  const GLOW = { search: [0.16, 0.37], point: [0.19, 0.56], gasp: [0.18, 0.57], happy: [0.37, 0.5] };
  const progress = (f) => {
    S.tfx = 0.14 + Math.max(0, Math.min(1, f)) * 0.72;
    const n = Math.ceil(Math.max(0, Math.min(1, f)) * lamps.length - 0.001);
    lamps.forEach((l, i) => {
      if (i < n && !l.lit) { l.lit = true; l.el.classList.add('lit'); }
    });
    const bar = $('scanBar'); if (bar) bar.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%';
  };
  const start = () => {
    tombs.forEach((t) => t.el.remove()); tombs = [];
    queue.length = 0; overflow = 0; if (sign) { sign.remove(); sign = null; }
    document.querySelectorAll('.tomb-big').forEach((b) => b.remove());
    S.fx = S.tfx = 0.14; S.vx = 0; S.face = 1; S.running = true;
    buildLamps();
    lamps.forEach((l) => l.el.classList.remove('lit'));
    setPose('search');
    yard.classList.remove('done');
  };
  const page = () => {};
  const finish = (n) => {
    yard.classList.add('done');
    setPose(n ? 'gasp' : 'happy');
    S.face = 1;
  };

  let last = performance.now(), lastW = 0, lastH = 0;
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (!document.body.classList.contains('on-yard')) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const W = yard.clientWidth, H = yard.clientHeight;
    if (W !== lastW || H !== lastH) { lastW = W; lastH = H; layout(); }
    const calm = still();
    if (calm) { S.fx = S.tfx; S.vx = 0; }
    else {
      const k = 9, d = 5.5;
      S.vx += ((S.tfx - S.fx) * k - S.vx * d) * dt; S.fx += S.vx * dt;
    }
    const size = Math.max(140, Math.min(290, W * 0.17));
    const t = now / 1000;
    const bob = calm ? 0 : Math.sin(t * 1.7) * 10 + Math.sin(t * 0.6) * 5;
    const x = S.fx * W - size / 2, y = H * 0.72 - size + bob;
    const tilt = calm ? 0 : Math.max(-10, Math.min(10, S.vx * 120)) + Math.sin(t * 0.8) * 2;
    patrol.style.width = patrol.style.height = size + 'px';
    patrol.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
    patrol.querySelector('.patrol-pose').style.transform = `scaleX(${pose === 'point' ? S.face : 1})`;
    const glow = patrol.querySelector('.patrol-glow');
    const gp = GLOW[pose] || GLOW.search; const flip = pose === 'point' && S.face < 0;
    glow.style.left = ((flip ? 1 - gp[0] : gp[0]) * 100) + '%'; glow.style.top = (gp[1] * 100) + '%';
    glow.style.opacity = calm ? 0.9 : (0.85 + Math.sin(t * 11) * 0.06 + Math.random() * 0.06).toFixed(3);
  };
  requestAnimationFrame(tick);
  // ---------- The reveal: "N ghosts found", and every one of them flies at you ----------
  const reveal = ({ count, kinds, verdict, host, skip, plural, sound }) => new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'yard-reveal';
    const badges = kinds.map(([k, n]) => `<li style="--accent:${plural(k).color}"><img src="art/spirit-${k}.webp" alt=""><b>${n}</b><span>${esc(plural(k, n))}</span></li>`).join('');
    box.innerHTML = `<div class="yr-flight"></div>
      <div class="yr-copy">
        <p class="yr-host">${esc(host)}</p>
        <h2 class="yr-title">${count ? `<em>${count}</em> ghost${count === 1 ? '' : 's'} found` : 'Not a single ghost'}</h2>
        <p class="yr-verdict">${count ? esc(verdict) : 'The house is at peace'}</p>
        ${count ? `<ul class="yr-kinds">${badges}</ul>` : '<img class="yr-happy" src="art/ghost-happy.webp" alt="">'}
        <p class="yr-skip">Click anywhere to see the report</p>
      </div>`;
    document.body.appendChild(box);
    const flight = box.querySelector('.yr-flight');
    const pool = kinds.flatMap(([k, n]) => Array(Math.min(n, 6)).fill(k));
    const fly = still() ? [] : pool.slice(0, 16); // Calm mode: no ghosts flying at you
    fly.forEach((k, i) => {
      const img = document.createElement('img');
      img.src = `art/spirit-${k}.webp`; img.alt = '';
      flight.appendChild(img);
      const sx = (Math.random() * 0.8 + 0.1) * innerWidth, sy = innerHeight * (0.72 + Math.random() * 0.2);
      const ang = Math.random() * Math.PI * 2, ex = innerWidth / 2 + Math.cos(ang) * innerWidth * 0.75, ey = innerHeight / 2 + Math.sin(ang) * innerHeight * 0.75;
      img.animate([
        { transform: `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(.35)`, opacity: 0, filter: 'blur(2px)' },
        { opacity: 1, filter: 'blur(0)', offset: 0.25 },
        { transform: `translate(${innerWidth / 2 + (sx - innerWidth / 2) * 0.25}px, ${innerHeight * 0.52}px) translate(-50%, -50%) scale(1.6)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${ex}px, ${ey}px) translate(-50%, -50%) scale(6)`, opacity: 0, filter: 'blur(14px)' },
      ], { duration: 1500 + Math.random() * 500, delay: 250 + i * 140, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'both' });
    });
    requestAnimationFrame(() => box.classList.add('on'));
    if (sound) sound();
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      box.classList.add('leaving');
      setTimeout(() => { box.remove(); resolve(); }, 650);
    };
    const t0 = Date.now();
    const wait = () => { if (skip() || Date.now() - t0 > 5200 + fly.length * 60) finish(); else setTimeout(wait, 120); };
    setTimeout(wait, 900);
    box.addEventListener('click', finish);
  });
  return { start, progress, page, found, finish, reveal, drain, setLamps: (l) => { LAMPS = l; buildLamps(); } };
})();
