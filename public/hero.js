// Graveyard Shift: the landing hero and Wisp, the night-watch ghost.
// Wisp is four painted poses (idle, peek, gasp, happy) moved by a spring, so every move has weight:
// he leans into his motion, overshoots a little, settles, and bobs while he waits.
// He reacts only to what you actually do: focus the address box and he peeks over it, type and he
// follows your text with his eyes, aim at the button and he gasps, submit and he cheers.
(() => {
  const $ = (id) => document.getElementById(id);
  const hero = $('hero'), wisp = $('wisp'), field = $('field'), input = $('url'), cta = $('cta'), measure = $('measure');
  if (!hero || !wisp) return;
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  // ---------- Calm mode: no motion surprises anywhere ----------
  const calmBtn = $('calmBtn');
  const setCalm = (on) => { document.body.classList.toggle('calm', on); calmBtn.setAttribute('aria-pressed', String(on)); calmBtn.textContent = on ? '🕯️ Calm mode on' : '👻 Calm mode off'; store.set('gs:calm', on); };
  calmBtn.onclick = () => setCalm(!document.body.classList.contains('calm'));
  setCalm(store.get('gs:calm', false));
  const still = () => mq.matches || document.body.classList.contains('calm');

  // ---------- Poses ----------
  const imgs = {};
  wisp.querySelectorAll('[data-pose]').forEach((i) => { imgs[i.dataset.pose] = i; });
  // where the lantern sits in each painting (fraction of the square), for the light it casts
  const LANTERN = { idle: [0.2, 0.56], gasp: [0.18, 0.57], happy: [0.37, 0.5], peek: null };
  let pose = 'idle';
  const setPose = (p) => {
    if (p === pose) return;
    imgs[pose].classList.remove('on'); imgs[p].classList.add('on');
    pose = p;
    wisp.dataset.pose = p;
    if (!still()) { wisp.classList.remove('pop'); void wisp.offsetWidth; wisp.classList.add('pop'); }
  };

  // ---------- Spring ----------
  const S = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, size: 340, tsize: 340, tilt: 0, look: 0, tlook: 0 };
  let mode = 'home';
  let nudge = 0;
  const heroRect = () => hero.getBoundingClientRect();
  const rel = (r) => { const h = heroRect(); return { left: r.left - h.left, top: r.top - h.top, right: r.right - h.left, bottom: r.bottom - h.top, width: r.width, height: r.height }; };
  const mobile = () => innerWidth < 760;

  const target = () => {
    const h = heroRect(), f = rel(field.getBoundingClientRect()), c = rel(cta.getBoundingClientRect());
    if (mode === 'home') {
      if (mobile()) { S.tsize = Math.min(210, innerWidth * 0.52); S.tx = h.width / 2 - S.tsize * 0.42; S.ty = 58; }
      else { S.tsize = Math.min(380, h.width * 0.27); S.tx = Math.min(f.right + 30, h.width - S.tsize - 30); S.ty = Math.max(70, f.top - S.tsize * 0.86); }
    } else if (mode === 'peek') {
      // perched on the top edge of the address box, sliding along to follow the text
      S.tsize = mobile() ? 150 : 200;
      const text = Math.min(measure.offsetWidth, f.width - 260);
      const prefix = field.querySelector('.prefix').offsetWidth + 24;
      const along = mobile() ? f.width * 0.5 : Math.max(prefix + 20, prefix + text - S.tsize * 0.3);
      S.tx = f.left + Math.min(along, f.width - S.tsize * 0.95) - S.tsize * 0.05;
      if (!mobile()) { // stay clear of the paragraph above: perch between its end and the button
        const lede = rel(document.querySelector('.hero-lede').getBoundingClientRect());
        S.tx = Math.min(Math.max(S.tx, lede.right - S.tsize * 0.12), f.right - S.tsize * 0.92);
      }
      S.ty = f.top - S.tsize * 0.835 + 6;
    } else if (mode === 'gasp') {
      S.tsize = mobile() ? 170 : 240;
      S.tx = c.left + c.width / 2 - S.tsize * (mobile() ? 0.5 : 0.3);
      S.ty = f.top - S.tsize * 0.98;
    } else if (mode === 'happy') {
      S.tsize = mobile() ? 190 : 280;
      S.tx = c.left + c.width / 2 - S.tsize * 0.55;
      S.ty = f.top - S.tsize * 1.25;
    }
  };

  // ---------- Fireflies around the lantern ----------
  const flies = $('fireflies');
  for (let i = 0; i < 14; i++) {
    const f = document.createElement('i');
    f.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
    f.style.setProperty('--y', (40 + Math.random() * 55).toFixed(1) + '%');
    f.style.setProperty('--d', (6 + Math.random() * 8).toFixed(1) + 's');
    f.style.setProperty('--delay', (-Math.random() * 12).toFixed(1) + 's');
    f.style.setProperty('--s', (2 + Math.random() * 3).toFixed(1) + 'px');
    flies.appendChild(f);
  }

  // ---------- Behaviour ----------
  let focused = false, overCta = false, cheering = false, typedAt = 0;
  const decide = () => {
    if (cheering) return;
    const m = overCta ? 'gasp' : focused ? 'peek' : 'home';
    mode = m;
    setPose(m === 'home' ? 'idle' : m);
  };
  const syncMeasure = () => { measure.textContent = input.value || ''; };
  input.addEventListener('focus', () => { focused = true; decide(); });
  input.addEventListener('blur', () => { setTimeout(() => { focused = document.activeElement === input; decide(); }, 60); });
  input.addEventListener('input', () => { syncMeasure(); typedAt = performance.now(); S.tlook = 1; });
  cta.addEventListener('pointerenter', () => { overCta = true; decide(); });
  cta.addEventListener('pointerleave', () => { overCta = false; decide(); });
  cta.addEventListener('focus', () => { overCta = true; decide(); });
  cta.addEventListener('blur', () => { overCta = false; decide(); });
  // Submit: a real address gets a cheer, an empty one gets a worried little shake.
  $('ask').addEventListener('submit', () => {
    if (!input.value.trim()) { nudge = 1; mode = 'peek'; setPose('peek'); input.focus(); return; }
    cheering = true; mode = 'happy'; setPose('happy');
    setTimeout(() => { cheering = false; decide(); }, 1600);
  });
  // He turns toward the pointer a little.
  let px = 0;
  addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; }, { passive: true });

  // ---------- Loop ----------
  const glow = wisp.querySelector('.wisp-glow');
  const light = field.querySelector('.field-light');
  let last = performance.now(), first = true;
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (!document.body.classList.contains('on-landing') || document.body.classList.contains('plain')) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    target();
    if (first || still()) { S.x = S.tx; S.y = S.ty; S.size = S.tsize; S.vx = S.vy = 0; first = false; }
    else {
      const k = 70, d = 13; // spring stiffness and damping
      S.vx += ((S.tx - S.x) * k - S.vx * d) * dt; S.vy += ((S.ty - S.y) * k - S.vy * d) * dt;
      S.x += S.vx * dt; S.y += S.vy * dt;
      S.size += (S.tsize - S.size) * (1 - Math.pow(0.002, dt));
    }
    const t = now / 1000;
    const calm = still();
    const bob = calm || mode === 'peek' ? 0 : Math.sin(t * 1.6) * 9 + Math.sin(t * 0.7) * 4;
    S.tilt += ((calm ? 0 : S.vx * 0.012 + px * 3 + (mode === 'home' ? Math.sin(t * 0.9) * 2 : 0)) - S.tilt) * 0.12;
    nudge = Math.max(0, nudge - dt * 1.6);
    const shake = calm ? 0 : Math.sin(nudge * 30) * nudge * 10;
    const squash = calm ? 1 : 1 + Math.max(-0.06, Math.min(0.06, -S.vy * 0.00012));
    wisp.style.width = wisp.style.height = S.size.toFixed(1) + 'px';
    wisp.style.transform = `translate3d(${(S.x + shake).toFixed(1)}px, ${(S.y + bob).toFixed(1)}px, 0) rotate(${(S.tilt + shake * 0.4).toFixed(2)}deg)`;
    wisp.querySelector('.wisp-pose').style.transform = `scale(${(2 - squash).toFixed(3)}, ${squash.toFixed(3)})`;
    // the lantern's light, on him and on the address box
    const L = LANTERN[pose];
    const flick = calm ? 1 : 0.88 + Math.sin(t * 11) * 0.05 + Math.sin(t * 23.7) * 0.04 + Math.random() * 0.03;
    if (L) {
      glow.style.opacity = flick.toFixed(3);
      glow.style.left = (L[0] * 100) + '%'; glow.style.top = (L[1] * 100) + '%';
      const h = heroRect(), f = field.getBoundingClientRect();
      const lx = h.left + S.x + S.size * L[0], ly = h.top + S.y + bob + S.size * L[1];
      const dist = Math.hypot(lx - Math.max(f.left, Math.min(lx, f.right)), ly - Math.max(f.top, Math.min(ly, f.bottom)));
      field.style.setProperty('--lx', ((lx - f.left) / f.width * 100).toFixed(1) + '%');
      field.style.setProperty('--ly', ((ly - f.top) / f.height * 100).toFixed(1) + '%');
      light.style.opacity = (Math.max(0, 1 - dist / 420) * flick).toFixed(3);
    } else {
      glow.style.opacity = '0';
      // peeking: the lantern is set down, so his glow follows the text instead
      const f = field.getBoundingClientRect(), w = wisp.getBoundingClientRect();
      field.style.setProperty('--lx', ((w.left + w.width * 0.45 - f.left) / f.width * 100).toFixed(1) + '%');
      field.style.setProperty('--ly', '0%');
      light.style.opacity = (0.75 * flick).toFixed(3);
    }
    S.tlook = Math.max(0, S.tlook - dt * 0.8);
  };
  requestAnimationFrame(tick);

  // Copy the workflow file for the night watchman
  const copy = $('copyYaml');
  if (copy) copy.onclick = async () => {
    const text = copy.parentNode.querySelector('code').innerText;
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove();
    }
    copy.textContent = 'Copied'; copy.classList.add('done');
    setTimeout(() => { copy.textContent = 'Copy'; copy.classList.remove('done'); }, 1800);
  };
})();
