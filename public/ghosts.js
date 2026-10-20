// Graveyard Shift — the ghosts themselves.
// Every ghost the scan finds becomes a spirit in the room: translucent, glowing, with a rippling hem,
// blinking eyes that follow your cursor, and a character for each kind. They roam behind the content,
// shy away from the pointer, swarm the count at the reveal, and leave when you banish them.
window.Ghosts = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('ghosts');
  const ctx = cv.getContext('2d');
  const tip = document.getElementById('ghostTip');
  const on = () => !reduce && !document.body.classList.contains('plain');
  let W = 0, H = 0, dpr = 1;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);

  const rand = (a, b) => a + Math.random() * (b - a);
  const TINT = {
    dead: { body: [244, 238, 228], glow: 'rgba(235,227,211,.55)' },
    possessed: { body: [190, 236, 218], glow: 'rgba(159,217,196,.65)' },
    'past-event': { body: [246, 230, 205], glow: 'rgba(224,163,90,.55)' },
    'stale-year': { body: [236, 230, 220], glow: 'rgba(191,154,95,.5)' },
    nameless: { body: [226, 228, 232], glow: 'rgba(210,214,222,.45)' },
    chain: { body: [240, 232, 218], glow: 'rgba(224,163,90,.5)' },
    speechless: { body: [232, 226, 236], glow: 'rgba(200,190,215,.5)' },
    idle: { body: [242, 238, 230], glow: 'rgba(235,227,211,.5)' },
  };

  let ghosts = [];
  let wisps = [];
  let pointer = { x: -999, y: -999, t: 0 };
  let mode = 'roam';
  let swarmAt = null;
  let hovered = null;
  let onPick = null;
  let peekEl = null;
  let last = performance.now();
  let avoidSel = '';
  let avoidRects = [];
  let dim = 1;
  setInterval(() => {
    avoidRects = avoidSel ? [...document.querySelectorAll(avoidSel)].map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.bottom > 0 && r.top < H).map((r) => ({ l: r.left - 26, r: r.right + 26, t: r.top - 40, b: r.bottom + 30 })) : [];
  }, 300);

  addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
  addEventListener('pointerleave', () => { pointer.x = -999; });

  const make = (o = {}) => ({
    id: o.id || null, type: o.type || 'idle', info: o.info || null,
    x: o.x ?? rand(0.1, 0.9) * W, y: o.y ?? rand(0.2, 0.85) * H,
    vx: o.vx ?? rand(-0.4, 0.4), vy: o.vy ?? rand(-0.3, 0.3),
    s: o.s ?? rand(0.8, 1.15), born: performance.now(), grow: o.grow ?? 1,
    phase: Math.random() * 100, wander: Math.random() * 6.28,
    blinkAt: performance.now() + rand(1500, 5000), blink: 0,
    alpha: 0, target: 1, state: 'live', fright: 0, spin: 0, peek: o.peek || null,
    orbit: Math.random() * 6.28,
  });

  // ---------- Drawing ----------
  const drawGhost = (g, t) => {
    const T = TINT[g.type] || TINT.idle;
    const [r, gg, b] = T.body;
    const w = 26 * g.s * g.grow;
    const h = 64 * g.s * g.grow;
    const bob = Math.sin(t / 700 + g.phase) * 4;
    const tilt = Math.max(-0.35, Math.min(0.35, g.vx * 0.12)) + Math.sin(t / 1300 + g.phase) * 0.05 + g.spin;
    const squash = 1 + Math.sin(t / 520 + g.phase) * 0.03;
    ctx.save();
    ctx.translate(g.x, g.y + bob);
    ctx.rotate(tilt);
    ctx.scale(1 / squash, squash);
    ctx.globalAlpha = g.alpha;

    // body silhouette with a rippling hem
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-w, 2);
      ctx.bezierCurveTo(-w, -w * 1.45, w, -w * 1.45, w, 2);
      ctx.bezierCurveTo(w * 1.02, h * 0.45, w * 1.18, h * 0.7, w * 1.1, h);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x0 = w * 1.1 - ((i + 1) * (w * 2.2)) / n;
        const xm = x0 + (w * 2.2) / n / 2;
        const lift = 10 + Math.sin(t / 260 + g.phase + i * 1.7) * 6;
        const drop = Math.sin(t / 300 + g.phase + i) * 5;
        ctx.quadraticCurveTo(xm, h - lift + drop, x0, h + Math.sin(t / 340 + i * 2 + g.phase) * 6);
      }
      ctx.bezierCurveTo(-w * 1.18, h * 0.7, -w * 1.02, h * 0.45, -w, 2);
      ctx.closePath();
    };

    // outer glow
    ctx.shadowColor = T.glow;
    ctx.shadowBlur = 34 * g.s;
    const fill = ctx.createLinearGradient(0, -w * 1.2, 0, h + 8);
    fill.addColorStop(0, `rgba(${r},${gg},${b},.92)`);
    fill.addColorStop(0.45, `rgba(${r},${gg},${b},.7)`);
    fill.addColorStop(0.85, `rgba(${r},${gg},${b},.18)`);
    fill.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    path();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;

    // inner volume: soft highlight and a cool shadow side, so it reads as a form, not a sticker
    const hi = ctx.createRadialGradient(-w * 0.35, -w * 0.55, 2, -w * 0.2, -w * 0.2, w * 1.6);
    hi.addColorStop(0, 'rgba(255,255,255,.55)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    path(); ctx.fillStyle = hi; ctx.fill();
    const side = ctx.createLinearGradient(-w, 0, w * 1.2, 0);
    side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(0.7, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(40,30,40,.28)');
    path(); ctx.fillStyle = side; ctx.fill();

    // eyes that blink and look toward the cursor
    if (g.type !== 'nameless') {
      const dx = pointer.x - g.x, dy = pointer.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      const lx = (dx / d) * w * 0.07, ly = (dy / d) * w * 0.06;
      const open = 1 - g.blink;
      const ey = -w * 0.18;
      const eyeR = w * (g.fright > 0.4 ? 0.2 : 0.16);
      const possessed = g.type === 'possessed';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * w * 0.36 + lx, ey + ly, eyeR, Math.max(0.8, eyeR * 1.35 * open), 0, 0, Math.PI * 2);
        ctx.fillStyle = possessed ? 'rgba(120,20,16,.95)' : 'rgba(22,14,12,.88)';
        ctx.fill();
        if (possessed) { ctx.shadowColor = 'rgba(230,80,50,.9)'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; }
        if (open > 0.5 && !possessed) {
          ctx.beginPath();
          ctx.arc(sx * w * 0.36 + lx * 1.6 - eyeR * 0.3, ey + ly * 1.6 - eyeR * 0.45, eyeR * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.fill();
        }
      }
      // mouth: a small 'o' when startled, a stitched line for the silent ones
      if (g.type === 'speechless') {
        ctx.strokeStyle = 'rgba(40,28,30,.7)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-w * 0.22, w * 0.28); ctx.lineTo(w * 0.22, w * 0.28); ctx.stroke();
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.12, w * 0.2); ctx.lineTo(i * w * 0.12, w * 0.36); ctx.stroke(); }
      } else if (g.fright > 0.25) {
        ctx.beginPath(); ctx.ellipse(lx * 0.6, w * 0.3, w * 0.09 * g.fright + 1, w * 0.14 * g.fright + 1.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(22,14,12,.8)'; ctx.fill();
      }
    }

    // character details
    if (g.type === 'past-event') { // a party hat, slightly askew
      ctx.save(); ctx.translate(w * 0.25, -w * 1.02); ctx.rotate(0.35);
      ctx.beginPath(); ctx.moveTo(-w * 0.32, 0); ctx.lineTo(0, -w * 0.9); ctx.lineTo(w * 0.32, 0); ctx.closePath();
      const hat = ctx.createLinearGradient(-w * 0.3, 0, w * 0.3, -w * 0.9);
      hat.addColorStop(0, 'rgba(160,58,58,.85)'); hat.addColorStop(1, 'rgba(224,163,90,.9)');
      ctx.fillStyle = hat; ctx.fill();
      ctx.beginPath(); ctx.arc(0, -w * 0.92, w * 0.09, 0, Math.PI * 2); ctx.fillStyle = 'rgba(245,230,200,.95)'; ctx.fill();
      ctx.restore();
    }
    if (g.type === 'stale-year') { // spectacles and a pocket watch on a chain
      ctx.strokeStyle = 'rgba(191,154,95,.9)'; ctx.lineWidth = 1.2;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * w * 0.36, -w * 0.18, w * 0.25, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-w * 0.11, -w * 0.2); ctx.lineTo(w * 0.11, -w * 0.2); ctx.stroke();
      const sw = Math.sin(t / 600 + g.phase) * 0.4;
      ctx.beginPath(); ctx.moveTo(w * 0.5, w * 0.5); ctx.quadraticCurveTo(w * 0.9, w * 1.1, w * 0.95 + sw * 6, w * 1.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(w * 0.95 + sw * 6, w * 1.55, w * 0.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(191,154,95,.85)'; ctx.fill();
    }
    if (g.type === 'chain') { // carries a lantern
      const sw = Math.sin(t / 500 + g.phase) * 0.25;
      ctx.save(); ctx.translate(-w * 1.2, w * 0.7); ctx.rotate(sw);
      ctx.strokeStyle = 'rgba(191,154,95,.85)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -w * 0.4); ctx.lineTo(0, 0); ctx.stroke();
      const lg = ctx.createRadialGradient(0, w * 0.25, 1, 0, w * 0.25, w * 1.3);
      lg.addColorStop(0, 'rgba(255,214,140,.65)'); lg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, w * 0.25, w * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,224,160,.95)'; ctx.fillRect(-w * 0.14, 0, w * 0.28, w * 0.42);
      ctx.strokeRect(-w * 0.17, -w * 0.02, w * 0.34, w * 0.46);
      ctx.restore();
    }
    if (g.type === 'possessed') { // something else is in there
      ctx.globalAlpha = g.alpha * (0.35 + 0.25 * Math.sin(t / 220 + g.phase));
      ctx.strokeStyle = 'rgba(160,230,200,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, w * 0.4, w * 0.55, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  };

  const drawWisp = (p) => {
    ctx.globalAlpha = p.a;
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    gr.addColorStop(0, p.c); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  };

  // ---------- Behaviour ----------
  const step = (g, dt, t) => {
    // fade in and out
    g.alpha += ((g.state === 'leaving' ? 0 : g.target * (mode === 'swarm' ? 1 : dim)) - g.alpha) * Math.min(1, dt / 400);
    if (g.grow < 1) g.grow = Math.min(1, g.grow + dt / 600);
    // blink
    if (t > g.blinkAt) { g.blink = 1; g.blinkAt = t + rand(2500, 6500); }
    g.blink = Math.max(0, g.blink - dt / 140);

    if (g.state === 'leaving') {
      g.spin += dt / 260;
      g.vy -= dt * 0.004;
      g.s *= 1 - dt / 1600;
      g.x += g.vx; g.y += g.vy;
      return;
    }
    // shy of the pointer
    const dx = g.x - pointer.x, dy = g.y - pointer.y;
    const d = Math.hypot(dx, dy);
    const near = performance.now() - pointer.t < 4000 && d < 150;
    g.fright += ((near ? 1 : 0) - g.fright) * Math.min(1, dt / 300);
    if (near) { g.vx += (dx / d) * 0.09; g.vy += (dy / d) * 0.09; }

    if (g.peek) {
      // rise from behind an element, look around, sink back
      const r = g.peek.el.getBoundingClientRect();
      const k = (t - g.peek.start) / g.peek.dur;
      const rise = k < 0.3 ? k / 0.3 : k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      g.x = r.left + r.width * g.peek.fx;
      g.y = r.top + 30 - rise * 46;
      g.vx = Math.sin(t / 400) * 0.6;
      g.target = 0.95;
      if (k >= 1) { g.peek = null; g.state = 'leaving'; g.alpha = 0; }
      return;
    }

    if (mode === 'swarm' && swarmAt) {
      g.orbit += dt / 1400;
      const R = Math.min(W, H) * 0.3 + Math.sin(g.phase) * 40;
      const tx = swarmAt.x + Math.cos(g.orbit) * R * 1.25;
      const ty = swarmAt.y + Math.sin(g.orbit) * R * 0.7;
      g.vx += (tx - g.x) * 0.0016 * dt / 16; g.vy += (ty - g.y) * 0.0016 * dt / 16;
      g.vx *= 0.94; g.vy *= 0.94;
    } else {
      // keep clear of text the reader needs
      let inside = false;
      for (const R of avoidRects) {
        if (g.x > R.l && g.x < R.r && g.y > R.t && g.y < R.b) {
          inside = true;
          const dl = g.x - R.l, dr = R.r - g.x, dt2 = g.y - R.t, db = R.b - g.y;
          const m = Math.min(dl, dr, dt2, db);
          const f = 0.4;
          if (m === dl) g.vx -= f; else if (m === dr) g.vx += f; else if (m === dt2) g.vy -= f; else g.vy += f;
        }
      }
      g.wander += rand(-0.08, 0.08);
      g.vx += Math.cos(g.wander) * 0.012; g.vy += Math.sin(g.wander) * 0.01;
      // stay in the room
      const m = 70;
      if (g.x < m) g.vx += 0.05; if (g.x > W - m) g.vx -= 0.05;
      if (g.y < m + 40) g.vy += 0.05; if (g.y > H - m) g.vy -= 0.05;
      const sp = Math.hypot(g.vx, g.vy), max = near ? 4 : inside ? 2.6 : 0.9;
      if (sp > max) { g.vx *= max / sp; g.vy *= max / sp; }
      g.vx *= 0.995; g.vy *= 0.995;
    }
    g.x += g.vx * dt / 16; g.y += g.vy * dt / 16;

    // trailing wisps
    if (Math.random() < dt / 90) {
      const T = TINT[g.type] || TINT.idle;
      wisps.push({ x: g.x + rand(-14, 14) * g.s, y: g.y + 58 * g.s, vx: -g.vx * 0.3 + rand(-0.2, 0.2), vy: rand(0.05, 0.3), r: rand(8, 16) * g.s, a: 0.18 * g.alpha, c: `rgba(${T.body.join(',')},.6)` });
    }
  };

  const frame = (t) => {
    const dt = Math.min(64, t - last);
    last = t;
    ctx.clearRect(0, 0, W, H);
    if (on()) {
      ctx.globalCompositeOperation = 'lighter';
      for (const p of wisps) { p.x += p.vx; p.y += p.vy; p.r *= 1.01; p.a *= 0.965; drawWisp(p); }
      wisps = wisps.filter((p) => p.a > 0.01).slice(-160);
      ctx.globalCompositeOperation = 'source-over';
      for (const g of ghosts) { step(g, dt, t); drawGhost(g, t); }
      ghosts = ghosts.filter((g) => !(g.state === 'leaving' && (g.alpha < 0.02 || g.s < 0.15)));
      ctx.globalAlpha = 1;
      hoverCheck();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ---------- Click a ghost to find its record ----------
  const interactive = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest('a, button, input, select, label, .casefile, .field, details, .toc, .reading-now, .counters');
  };
  const hoverCheck = () => {
    if (!onPick || pointer.x < 0) { tip.hidden = true; hovered = null; return; }
    let best = null, bd = 60;
    for (const g of ghosts) {
      if (!g.info || g.state !== 'live') continue;
      const d = Math.hypot(g.x - pointer.x, g.y + 18 * g.s - pointer.y);
      if (d < bd) { bd = d; best = g; }
    }
    if (best && !interactive(pointer.x, pointer.y)) {
      hovered = best;
      tip.hidden = false;
      tip.textContent = best.info;
      tip.style.transform = `translate(${Math.min(W - 280, pointer.x + 16)}px, ${pointer.y + 18}px)`;
      document.body.style.cursor = 'pointer';
    } else {
      hovered = null;
      tip.hidden = true;
      document.body.style.cursor = '';
    }
  };
  addEventListener('click', (e) => {
    if (hovered && onPick && !interactive(e.clientX, e.clientY)) { onPick(hovered.id); }
  });

  // ---------- API ----------
  const clear = () => { ghosts.forEach((g) => { g.state = 'leaving'; g.vx = rand(-1, 1); g.vy = rand(-1, 0); }); };
  let cap = 18;
  return {
    get count() { return ghosts.filter((g) => g.state === 'live').length; },
    clear,
    // a few idle spirits for the landing page
    idle(n = 3) {
      if (!on()) return;
      for (let i = 0; i < n; i++) ghosts.push(make({ type: 'idle', s: rand(0.7, 1), x: rand(0.06, 0.94) * W, y: rand(0.3, 0.8) * H }));
      ghosts.forEach((g) => { g.target = 0.75; });
    },
    // a spirit rises from behind an element (the URL field, a heading), looks around and sinks back
    peek(el, type = 'idle') {
      if (!on() || !el) return;
      const g = make({ type, s: 0.9 });
      g.peek = { el, start: performance.now(), dur: 3600, fx: rand(0.15, 0.85) };
      g.alpha = 0;
      ghosts.push(g);
    },
    // a ghost found during the scan bursts out of the dial
    spawn(type, from, info, id) {
      if (!on()) return;
      cap = 18;
      const live = ghosts.filter((g) => g.state === 'live');
      if (live.length >= cap) { const old = live.find((g) => !g.peek); if (old) old.state = 'leaving'; }
      const a = Math.random() * Math.PI * 2;
      const c = from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : { x: W / 2, y: H / 2 };
      ghosts.push(make({ type, id, info, x: c.x, y: c.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 4 - 1, grow: 0.1, s: rand(0.8, 1.1) }));
    },
    // populate the room with the reading's ghosts
    populate(list, max = 12) {
      if (!on()) return;
      cap = max;
      const have = new Set(ghosts.filter((g) => g.state === 'live' && g.id).map((g) => g.id));
      for (const g of ghosts) if (g.state === 'live' && (!g.id || !list.some((x) => x.id === g.id))) g.state = 'leaving';
      list.slice(0, cap).forEach((x, i) => {
        if (have.has(x.id)) return;
        const side = i % 2 ? rand(0.82, 0.96) : rand(0.04, 0.18);
        ghosts.push(make({ ...x, s: rand(0.62, 0.86), x: side * W, y: rand(0.25, 0.9) * H, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3) }));
      });
    },
    swarm(point) { mode = 'swarm'; swarmAt = point; },
    roam() { mode = 'roam'; swarmAt = null; ghosts.forEach((g) => { g.vx = rand(-2, 2); g.vy = rand(-2, 2); }); },
    // banished: the ghost spins up and away
    release(id, type) {
      const g = ghosts.find((x) => x.id === id && x.state === 'live') || ghosts.find((x) => x.type === type && x.state === 'live');
      if (!g) return;
      g.state = 'leaving'; g.vy = -2; g.vx = rand(-1, 1);
      for (let i = 0; i < 18; i++) wisps.push({ x: g.x, y: g.y, vx: rand(-2, 2), vy: rand(-2.5, 0.5), r: rand(6, 14), a: 0.35, c: 'rgba(235,227,211,.7)' });
    },
    // restored: it comes back out of the record
    restore(x, rect) {
      if (!on()) return;
      const c = rect ? { x: rect.left + rect.width * 0.3, y: rect.top } : { x: W / 2, y: H / 2 };
      ghosts.push(make({ ...x, x: c.x, y: c.y, vx: rand(-2, 2), vy: -3, grow: 0.1 }));
    },
    pickable(fn) { onPick = fn; if (!fn) tip.hidden = true; },
    // per screen: which text to keep clear, and how present the ghosts are
    setting({ avoid = '', presence = 1 } = {}) { avoidSel = avoid; dim = presence; },
  };
})();
