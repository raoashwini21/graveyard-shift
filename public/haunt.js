// Graveyard Shift: haunt events.
// A small scheduler for supernatural moments. Rules: one event at a time, cooldowns between them,
// nothing covers text the user is reading, and everything is off with reduced motion or the plain report.
window.Haunt = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const on = () => !reduce && !document.body.classList.contains('plain');
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let timers = [];
  let busy = false;
  let scene = 'landing';
  let scared = false;
  let lastFelt = 0;
  let sound = () => {};

  // ---------- The figures (shared SVG symbols) ----------
  const defs = document.createElement('div');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defs.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">
    <defs>
      <linearGradient id="gs-shroud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f1eadc" stop-opacity=".9"/><stop offset=".35" stop-color="#ddd3c3" stop-opacity=".55"/>
        <stop offset=".75" stop-color="#cfc4b2" stop-opacity=".18"/><stop offset="1" stop-color="#cfc4b2" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="gs-facegrad" cx="50%" cy="44%" r="58%">
        <stop offset="0" stop-color="#f4eee3" stop-opacity=".95"/><stop offset=".6" stop-color="#d8cebd" stop-opacity=".55"/><stop offset="1" stop-color="#d8cebd" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="gs-hollow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#030202" stop-opacity="1"/><stop offset=".7" stop-color="#050303" stop-opacity=".85"/><stop offset="1" stop-color="#050303" stop-opacity="0"/>
      </radialGradient>
      <filter id="gs-wisp" x="-40%" y="-25%" width="180%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency=".012 .035" numOctaves="2" seed="3" result="n">
          <animate attributeName="baseFrequency" dur="11s" values=".012 .035;.016 .045;.012 .035" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="3.4"/>
      </filter>
      <filter id="gs-wisp-face" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency=".02 .03" numOctaves="2" seed="9" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="1.6"/>
      </filter>
      <linearGradient id="gs-veil-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".9"/><stop offset=".25" stop-color="#000" stop-opacity="0"/>
        <stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".9"/>
      </linearGradient>
      <mask id="gs-fade"><rect width="200" height="400" fill="url(#gs-fade-v)"/></mask>
      <linearGradient id="gs-fade-v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <symbol id="gs-specter" viewBox="0 0 200 400">
        <g filter="url(#gs-wisp)" mask="url(#gs-fade)">
          <path d="M100 26c-14 0-23 13-23 30 0 14 4 24 8 32-16 6-28 16-32 34-6 38-4 98-10 178-4 40-10 70-16 96h146c-6-26-12-56-16-96-6-80-4-140-10-178-4-18-16-28-32-34 4-8 8-18 8-32 0-17-9-30-23-30Z" fill="url(#gs-shroud)"/>
          <path d="M78 56c-2 20 4 30 8 34-10 4-18 10-22 20M122 56c2 20-4 30-8 34 10 4 18 10 22 20" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>
          <ellipse cx="100" cy="60" rx="13" ry="18" fill="url(#gs-hollow)" opacity=".55"/>
        </g>
      </symbol>
      <radialGradient id="gs-face-fade" cx="46%" cy="40%" r="56%">
        <stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <mask id="gs-face-mask"><rect width="300" height="380" fill="url(#gs-face-fade)"/></mask>
      <filter id="gs-face-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency=".015 .028" numOctaves="2" seed="9" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="4.2"/>
      </filter>
      <symbol id="gs-face" viewBox="0 0 300 380">
        <g filter="url(#gs-face-soft)" mask="url(#gs-face-mask)">
          <ellipse cx="146" cy="176" rx="92" ry="134" fill="url(#gs-facegrad)"/>
          <ellipse cx="112" cy="158" rx="21" ry="15" fill="url(#gs-hollow)" opacity=".95"/>
          <ellipse cx="178" cy="160" rx="21" ry="15" fill="url(#gs-hollow)" opacity=".9"/>
          <ellipse cx="146" cy="214" rx="9" ry="18" fill="url(#gs-hollow)" opacity=".28"/>
          <path d="M120 262c16 4 36 4 52-1" stroke="#0a0606" stroke-width="5" stroke-linecap="round" fill="none" opacity=".55"/>
          <ellipse cx="200" cy="190" rx="60" ry="130" fill="#000" opacity=".35"/>
        </g>
      </symbol>
    </defs></svg>`;
  document.body.prepend(defs);

  const figure = (kind, cls) => {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = `<svg viewBox="${kind === 'face' ? '0 0 300 380' : '0 0 200 400'}" aria-hidden="true"><use href="#gs-${kind === 'face' ? 'face' : 'specter'}"/></svg>`;
    return el;
  };

  // ---------- Events ----------
  // A veiled figure drifts slowly behind the interface.
  const drift = async ({ opacity = 0.18, height = rand(42, 58), duration = rand(20000, 28000), y = rand(18, 42) } = {}) => {
    if (!on()) return;
    const layer = $('specters');
    const g = figure('specter', 'specter');
    const ltr = Math.random() > 0.4;
    g.style.height = height + 'vh';
    g.style.top = y + 'vh';
    layer.appendChild(g);
    const from = ltr ? -20 : 110, to = ltr ? 110 : -20;
    const anim = g.animate([
      { transform: `translateX(${from}vw) translateY(0) scaleX(${ltr ? 1 : -1})`, opacity: 0 },
      { transform: `translateX(${from + (to - from) * 0.2}vw) translateY(-1.5vh) scaleX(${ltr ? 1 : -1})`, opacity, offset: 0.2 },
      { transform: `translateX(${from + (to - from) * 0.55}vw) translateY(1vh) scaleX(${ltr ? 1 : -1})`, opacity: opacity * 0.85, offset: 0.55 },
      { transform: `translateX(${from + (to - from) * 0.85}vw) translateY(-1vh) scaleX(${ltr ? 1 : -1})`, opacity, offset: 0.85 },
      { transform: `translateX(${to}vw) translateY(0) scaleX(${ltr ? 1 : -1})`, opacity: 0 },
    ], { duration, easing: 'linear' });
    await anim.finished.catch(() => {});
    g.remove();
  };

  // A shadow passes in front of the light.
  const shade = async () => {
    if (!on()) return;
    const s = $('shade');
    const ltr = Math.random() > 0.5;
    await s.animate([
      { transform: `translateX(${ltr ? -70 : 70}vw)`, opacity: 0 },
      { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 },
      { transform: `translateX(${ltr ? 70 : -70}vw)`, opacity: 0 },
    ], { duration: rand(5000, 7500), easing: 'cubic-bezier(.45,0,.55,1)' }).finished.catch(() => {});
  };

  // The room's light dips, as if a draught passed the candles.
  const gutter = (ms = 700) => {
    if (!on()) return;
    document.body.classList.add('gutter');
    setTimeout(() => document.body.classList.remove('gutter'), ms);
  };

  // Somewhere down the hall, a door creaks open by itself.
  const disturb = () => {
    if (!on()) return;
    if (window.Hall) Hall.creak();
    gutter(500);
  };

  // A lantern beam sweeps across the room once.
  const sweep = () => {
    if (!on()) return;
    const b = $('beam');
    b.classList.remove('once'); void b.offsetWidth; b.classList.add('once');
  };

  // The door opens a crack and something looks out. The portraits look away.
  const reflect = () => {
    if (!on()) return;
    if (window.Door && Door.current && Door.current.el.isConnected) Door.current.peek();
    if (window.Hall) Hall.portraits();
  };

  // A specter flickers behind a point on screen (used when a dead link is found).
  const flash = (rect) => {
    if (!on()) return;
    const g = figure('specter', 'specter flash');
    const h = Math.min(innerHeight * 0.42, 420);
    g.style.height = h + 'px';
    const x = rect ? rect.left + rect.width * rand(0.25, 0.75) - h * 0.28 : innerWidth / 2;
    const y = rect ? rect.top + rect.height * 0.5 - h * 0.45 : innerHeight / 3;
    g.style.left = x + 'px';
    g.style.top = y + 'px';
    $('specters').appendChild(g);
    g.animate([
      { opacity: 0, transform: 'translateY(14px) scale(.96)' },
      { opacity: 0.38, transform: 'translateY(0) scale(1)', offset: 0.22 },
      { opacity: 0.1, offset: 0.4 }, { opacity: 0.3, offset: 0.5 },
      { opacity: 0, transform: 'translateY(-26px) scale(1.04)' },
    ], { duration: 1500, easing: 'ease-out' }).finished.then(() => g.remove(), () => g.remove());
  };

  // The one jumpscare: lights cut, a face in the fog for under half a second. Once per session.
  const scare = async () => {
    if (!on() || scared || busy) return false;
    scared = true;
    busy = true;
    sound('scare');
    document.body.classList.add('blackout');
    await sleep(140);
    const f = figure('face', 'face');
    f.style.left = rand(28, 52) + 'vw';
    f.style.top = rand(10, 22) + 'vh';
    $('apparitions').appendChild(f);
    await f.animate([
      { opacity: 0, transform: 'scale(.94)' }, { opacity: 0.5, transform: 'scale(1)', offset: 0.2 },
      { opacity: 0.06, offset: 0.36 }, { opacity: 0.42, offset: 0.5 }, { opacity: 0, transform: 'scale(1.05)' },
    ], { duration: 460, easing: 'linear' }).finished.catch(() => {});
    f.remove();
    await sleep(120);
    document.body.classList.remove('blackout');
    busy = false;
    return true;
  };

  // A small wisp rises from a banished record.
  const release = (el) => {
    if (!on() || !el) return;
    const r = el.getBoundingClientRect();
    const g = figure('specter', 'specter wisp');
    const h = 120;
    g.style.height = h + 'px';
    g.style.left = r.left + r.width * 0.3 + 'px';
    g.style.top = r.top - 20 + 'px';
    $('apparitions').appendChild(g);
    g.animate([
      { opacity: 0, transform: 'translateY(30px) scale(.7)' },
      { opacity: 0.5, transform: 'translateY(0) scale(.85)', offset: 0.25 },
      { opacity: 0, transform: 'translateY(-160px) scale(1.15)' },
    ], { duration: 1900, easing: 'cubic-bezier(.2,.7,.1,1)' }).finished.then(() => g.remove(), () => g.remove());
  };

  // When a ghost is felt during the scan.
  const felt = (kind, rect, count) => {
    if (!on()) return;
    const now = Date.now();
    if (now - lastFelt < 2200) return;
    lastFelt = now;
    if (kind === 'dead') flash(rect);
    else if (Math.random() < 0.35) reflect();
    if (count >= 4 && !scared) setTimeout(scare, 1200);
  };

  // The reveal: hush, a figure passes through the dark, then the count is lit.
  const reveal = async ({ count, verdict, host, skip }) => {
    const box = $('revealBox');
    $('revealCount').textContent = count ? count.toLocaleString('en-US') : 'None';
    $('revealLine').textContent = count ? `ghost${count === 1 ? '' : 's'} living in ${host}` : `ghosts in ${host}`;
    $('revealVerdict').textContent = verdict;
    const wait = (ms) => (skip() ? Promise.resolve() : sleep(ms));
    if (!on()) return;
    document.body.classList.add('hush');
    sound('hush');
    await wait(1100);
    if (!skip() && !document.body.classList.contains('on-yard')) {
      const g = figure('specter', 'specter through');
      g.style.height = '78vh';
      g.style.top = '8vh';
      $('apparitions').appendChild(g);
      g.animate([
        { transform: 'translateX(-30vw)', opacity: 0 }, { opacity: 0.2, offset: 0.3 }, { opacity: 0.24, offset: 0.6 },
        { transform: 'translateX(105vw)', opacity: 0 },
      ], { duration: 3600, easing: 'cubic-bezier(.4,0,.6,1)' }).finished.then(() => g.remove(), () => g.remove());
    }
    await wait(1500);
    if (window.Ghosts && !document.body.classList.contains('on-yard')) Ghosts.swarm({ x: innerWidth / 2, y: innerHeight / 2 });
    box.classList.add('on');
    sound('lit');
    await wait(2600);
    box.classList.add('leaving');
    await sleep(skip() ? 200 : 900);
    box.classList.remove('on', 'leaving');
    document.body.classList.remove('hush');
    if (window.Ghosts) Ghosts.roam();
  };

  // ---------- Scenes ----------
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const every = (fn, min, max, first) => {
    const loop = (delay) => {
      timers.push(setTimeout(async () => {
        if (!busy && document.visibilityState === 'visible') await fn();
        loop(rand(min, max));
      }, delay));
    };
    loop(first ?? rand(min, max));
  };
  const setScene = (name) => {
    scene = name;
    clear();
    if (!on()) return;
    if (name === 'landing') {
      every(() => window.Ghosts && Ghosts.peek(document.querySelector('.field')), 13000, 21000, 3500);
      every(() => drift({ opacity: 0.2 }), 30000, 50000, 18000);
      every(sweep, 30000, 50000, 14000);
      every(reflect, 18000, 34000, 9000);
      every(disturb, 7000, 14000, 4000);
      every(shade, 40000, 70000, 24000);
    } else if (name === 'scan') {
      every(() => drift({ opacity: 0.11, duration: rand(14000, 18000) }), 16000, 26000, 6000);
      every(disturb, 2500, 5000, 1500);
    } else if (name === 'report') {
      every(() => drift({ opacity: 0.09, height: rand(36, 48) }), 40000, 70000, 12000);
      every(shade, 50000, 80000, 30000);
      every(() => gutter(600), 20000, 40000);
      every(() => window.Hall && Hall.creak(2200), 9000, 18000, 5000);
    }
  };

  return {
    scene: setScene, drift, shade, gutter, disturb, sweep, reflect, flash, scare, release, felt, reveal,
    onSound: (fn) => { sound = fn; },
    get enabled() { return on(); },
    _again: () => { scared = false; busy = false; },
  };
})();
