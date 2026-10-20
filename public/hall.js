// Graveyard Shift: the haunted hallway backdrop and the door.
// The hallway is one illustrated SVG in one-point perspective: wallpapered walls lined with doors,
// a runner down the floorboards, candle sconces, two portraits whose eyes follow you, and a far door
// leaking light. Doors creak open on their own during the scan.
window.Hall = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 1600, H = 1000, VX = 800, VY = 470;
  const FAR = { l: 610, r: 990, t: 318, b: 622 };
  const lerp = (a, b, t) => a + (b - a) * t;
  // left wall edges: near (x=0, y 0..1000) to far (x=610, y 318..622)
  const wallPt = (side, u, v) => { // u: 0 near .. 1 far, v: 0 floor .. 1 ceiling
    const x = side < 0 ? lerp(0, FAR.l, u) : lerp(W, FAR.r, u);
    const top = lerp(0, FAR.t, u), bot = lerp(H, FAR.b, u);
    return [x, lerp(bot, top, v)];
  };
  const quad = (side, u1, u2, v1, v2) => [wallPt(side, u1, v1), wallPt(side, u2, v1), wallPt(side, u2, v2), wallPt(side, u1, v2)];
  const pts = (q) => q.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');

  const doors = [];
  const build = () => {
    const P = [];
    P.push(`<defs>
      <linearGradient id="h-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1922"/><stop offset="1" stop-color="#3c3442"/></linearGradient>
      <linearGradient id="h-wallL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2430"/><stop offset=".7" stop-color="#4d4354"/><stop offset="1" stop-color="#5d5263"/></linearGradient>
      <linearGradient id="h-wallR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#2a2430"/><stop offset=".7" stop-color="#4d4354"/><stop offset="1" stop-color="#5d5263"/></linearGradient>
      <linearGradient id="h-floor" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2b201b"/><stop offset="1" stop-color="#5a4535"/></linearGradient>
      <linearGradient id="h-rug" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3d1418"/><stop offset="1" stop-color="#6b2a2c"/></linearGradient>
      <radialGradient id="h-far" cx="50%" cy="60%" r="70%"><stop offset="0" stop-color="#f6d79a"/><stop offset=".5" stop-color="#c58a4a" stop-opacity=".7"/><stop offset="1" stop-color="#5a3a26" stop-opacity="0"/></radialGradient>
      <radialGradient id="h-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd38a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
      <linearGradient id="h-doorlight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a8"/><stop offset="1" stop-color="#c47a3c"/></linearGradient>
      <pattern id="h-damask" width="46" height="60" patternUnits="userSpaceOnUse">
        <path d="M23 6c6 6 6 14 0 20-6-6-6-14 0-20zM23 30c9 4 12 12 8 22-4-6-8-8-8-8s-4 2-8 8c-4-10-1-18 8-22z" fill="#fff" opacity=".05"/>
        <circle cx="0" cy="30" r="2" fill="#fff" opacity=".05"/><circle cx="46" cy="30" r="2" fill="#fff" opacity=".05"/>
      </pattern>
      <radialGradient id="h-portrait" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#4a3b35"/><stop offset="1" stop-color="#140f0d"/></radialGradient>
    </defs>`);
    // ceiling, walls, floor
    P.push(`<polygon points="0,0 ${W},0 ${FAR.r},${FAR.t} ${FAR.l},${FAR.t}" fill="url(#h-ceil)"/>`);
    P.push(`<polygon points="0,0 ${FAR.l},${FAR.t} ${FAR.l},${FAR.b} 0,${H}" fill="url(#h-wallL)"/>`);
    P.push(`<polygon points="0,0 ${FAR.l},${FAR.t} ${FAR.l},${FAR.b} 0,${H}" fill="url(#h-damask)"/>`);
    P.push(`<polygon points="${W},0 ${FAR.r},${FAR.t} ${FAR.r},${FAR.b} ${W},${H}" fill="url(#h-wallR)"/>`);
    P.push(`<polygon points="${W},0 ${FAR.r},${FAR.t} ${FAR.r},${FAR.b} ${W},${H}" fill="url(#h-damask)"/>`);
    P.push(`<rect x="${FAR.l}" y="${FAR.t}" width="${FAR.r - FAR.l}" height="${FAR.b - FAR.t}" fill="#4b4150"/>`);
    P.push(`<rect x="${FAR.l}" y="${FAR.t}" width="${FAR.r - FAR.l}" height="${FAR.b - FAR.t}" fill="url(#h-damask)"/>`);
    P.push(`<polygon points="0,${H} ${FAR.l},${FAR.b} ${FAR.r},${FAR.b} ${W},${H}" fill="url(#h-floor)"/>`);
    for (let i = -9; i <= 9; i++) {
      const xn = VX + i * 180, xf = lerp(FAR.l, FAR.r, (i + 9) / 18);
      P.push(`<line x1="${xn}" y1="${H}" x2="${xf}" y2="${FAR.b}" stroke="#1d1410" stroke-width="${1.6 - Math.abs(i) * 0.05}" opacity=".55"/>`);
    }
    // runner rug with a border
    P.push(`<polygon points="500,${H} ${VX - 70},${FAR.b} ${VX + 70},${FAR.b} 1100,${H}" fill="url(#h-rug)"/>`);
    P.push(`<polygon points="540,${H} ${VX - 60},${FAR.b} ${VX + 60},${FAR.b} 1060,${H}" fill="none" stroke="#b8925a" stroke-width="2" opacity=".35"/>`);
    // chair rails along the walls
    for (const side of [-1, 1]) {
      const a = wallPt(side, 0, 0.36), b = wallPt(side, 1, 0.36);
      P.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#211b25" stroke-width="5" opacity=".7"/>`);
      const c = wallPt(side, 0, 0.92), d = wallPt(side, 1, 0.92);
      P.push(`<line x1="${c[0]}" y1="${c[1]}" x2="${d[0]}" y2="${d[1]}" stroke="#211b25" stroke-width="7" opacity=".7"/>`);
    }
    // the far door, leaking light
    P.push(`<rect x="${VX - 44}" y="${FAR.b - 168}" width="88" height="168" fill="#1a120e"/>`);
    P.push(`<rect class="h-farlight" x="${VX - 40}" y="${FAR.b - 164}" width="80" height="164" fill="url(#h-far)"/>`);
    P.push(`<rect x="${VX - 40}" y="${FAR.b - 164}" width="58" height="164" fill="#2a1c14"/>`);
    P.push(`<ellipse class="h-farlight" cx="${VX}" cy="${FAR.b}" rx="140" ry="18" fill="url(#h-glow)"/>`);
    // doors along both walls
    const spots = [[0.1, 0.24], [0.42, 0.52], [0.66, 0.72], [0.82, 0.86]];
    let n = 0;
    for (const side of [-1, 1]) {
      spots.forEach(([u1, u2], i) => {
        const frame = quad(side, u1 - 0.012, u2 + 0.012, 0, 0.7);
        const hole = quad(side, u1, u2, 0, 0.67);
        const hinge = side < 0 ? hole[0][0] : hole[0][0];
        const id = `hd${n++}`;
        P.push(`<g class="h-door" id="${id}">
          <polygon points="${pts(frame)}" fill="#1a1215"/>
          <polygon class="h-door-light" points="${pts(hole)}" fill="url(#h-doorlight)" opacity="0"/>
          <polygon class="h-door-leaf" style="transform-origin:${hinge.toFixed(1)}px 0" points="${pts(hole)}" fill="${i % 2 ? '#3b2620' : '#33211c'}" stroke="#20140f" stroke-width="2"/>
          <circle cx="${lerp(hole[1][0], hole[0][0], 0.15)}" cy="${lerp(hole[0][1], hole[3][1], 0.45)}" r="${(1 - u1) * 5 + 1.5}" fill="#c9a060" opacity=".85"/>
        </g>`);
        doors.push(id);
        // a sconce between doors
        if (i < spots.length - 1) {
          const u = (u2 + spots[i + 1][0]) / 2;
          const [sx, sy] = wallPt(side, u, 0.72);
          const s = (1 - u) * 1.4 + 0.4;
          P.push(`<g class="h-sconce" transform="translate(${sx} ${sy}) scale(${s})">
            <circle class="h-flame-glow" r="60" fill="url(#h-glow)"/>
            <path d="M-6 18h12l-3 10h-6z M0 18v-8" stroke="#a8844c" stroke-width="2" fill="#7a5a30"/>
            <rect x="-3" y="-2" width="6" height="14" fill="#efe3c6"/>
            <path class="h-flame" d="M0 -16c4 6 5 10 0 14-5-4-4-8 0-14z" fill="#ffd27a"/>
          </g>`);
        }
      });
    }
    // two portraits whose eyes follow you
    for (const [side, u] of [[-1, 0.585], [1, 0.585]]) {
      const [cx, cy] = wallPt(side, u, 0.52);
      const s = (1 - u) * 1.6 + 0.5;
      P.push(`<g class="h-portrait" transform="translate(${cx} ${cy}) scale(${s})">
        <ellipse rx="26" ry="34" fill="#6b5030" stroke="#b8925a" stroke-width="3"/>
        <ellipse rx="21" ry="29" fill="url(#h-portrait)"/>
        <ellipse cy="-4" rx="10" ry="13" fill="#3a2c26" opacity=".9"/>
        <path d="M-14 22c4-8 24-8 28 0" fill="#2a1f1a"/>
        <g class="h-eyes"><circle cx="-4" cy="-6" r="1.4" fill="#f4dca0"/><circle cx="4" cy="-6" r="1.4" fill="#f4dca0"/></g>
      </g>`);
    }
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${P.join('')}</svg>`;
  };

  const el = document.getElementById('hall');
  el.innerHTML = build();
  const eyes = [...el.querySelectorAll('.h-eyes')];

  if (!reduce) {
    addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      el.style.setProperty('--hx', (nx * -14).toFixed(1) + 'px');
      el.style.setProperty('--hy', (ny * -8).toFixed(1) + 'px');
      eyes.forEach((g) => g.setAttribute('transform', `translate(${(nx * 4).toFixed(2)} ${(ny * 3).toFixed(2)})`));
    }, { passive: true });
  }

  // A door along the hall creaks open, holds, and closes.
  let busy = 0;
  const creak = (hold = 1400) => {
    if (reduce || busy > 2) return;
    const id = doors[Math.floor(Math.random() * doors.length)];
    const g = document.getElementById(id);
    if (g.classList.contains('open')) return;
    busy++;
    g.classList.add('open');
    setTimeout(() => { g.classList.remove('open'); busy--; }, hold + Math.random() * 1200);
  };
  // Portraits blink... or their eyes go dark.
  const portraits = () => {
    if (reduce) return;
    eyes.forEach((g) => { g.style.opacity = '0'; setTimeout(() => { g.style.opacity = ''; }, 280 + Math.random() * 400); });
  };
  return { creak, portraits };
})();

// The door you knock on.
window.Door = (() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const leaf = `<svg viewBox="0 0 200 380" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="d-wood" x1="0" x2="1"><stop offset="0" stop-color="#4a2c20"/><stop offset=".5" stop-color="#5e3a29"/><stop offset="1" stop-color="#3e241a"/></linearGradient>
      <filter id="d-grain"><feTurbulence type="fractalNoise" baseFrequency=".008 .35" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .05  0 0 0 0 .02  0 0 0 .5 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <radialGradient id="d-brass" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f3d38d"/><stop offset="1" stop-color="#8a6230"/></radialGradient>
    </defs>
    <rect width="200" height="380" fill="url(#d-wood)"/>
    <rect width="200" height="380" fill="#000" filter="url(#d-grain)"/>
    <g fill="none" stroke="#2a170f" stroke-width="3" opacity=".9">
      <rect x="22" y="22" width="68" height="120" rx="3"/><rect x="110" y="22" width="68" height="120" rx="3"/>
      <rect x="22" y="162" width="68" height="196" rx="3"/><rect x="110" y="162" width="68" height="196" rx="3"/>
    </g>
    <g fill="none" stroke="#7a4a32" stroke-width="1" opacity=".5">
      <rect x="27" y="27" width="58" height="110" rx="2"/><rect x="115" y="27" width="58" height="110" rx="2"/>
      <rect x="27" y="167" width="58" height="186" rx="2"/><rect x="115" y="167" width="58" height="186" rx="2"/>
    </g>
    <circle cx="100" cy="92" r="16" fill="none" stroke="url(#d-brass)" stroke-width="5"/>
    <circle cx="100" cy="76" r="5" fill="url(#d-brass)"/>
    <circle cx="176" cy="206" r="8" fill="url(#d-brass)"/>
    <rect x="171" y="222" width="10" height="16" rx="2" fill="#2a170f"/>
  </svg>`;
  const create = (slot) => {
    const el = document.createElement('div');
    el.className = 'door';
    el.innerHTML = `
      <div class="plaque"><span class="plaque-text">Knock</span></div>
      <div class="doorway">
        <div class="beyond"><i class="beyond-light"></i><i class="beyond-fog"></i><i class="beyond-eyes"><b></b><b></b></i></div>
        <div class="leaf"><div class="leaf-front">${leaf}</div><div class="leaf-back"></div></div>
      </div>
      <div class="threshold"><span class="threshold-fill"></span></div>`;
    slot.appendChild(el);
    const text = el.querySelector('.plaque-text');
    let closeTimer = null;
    let lastOpen = 0;
    const api = {
      el,
      label(t) { text.textContent = t; },
      ajar() { el.classList.remove('open', 'wide'); el.classList.add('ajar'); },
      shut() { el.classList.remove('open', 'wide', 'ajar'); },
      // swing open on a room, then close behind it
      enter(t, hold = 800) {
        const now = Date.now();
        api.label(t);
        if (now - lastOpen < 1100) return false;
        lastOpen = now;
        el.classList.add('open');
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => el.classList.remove('open'), hold);
        return true;
      },
      wide() { clearTimeout(closeTimer); el.classList.add('open', 'wide'); },
      knock() {
        if (reduce) return;
        el.classList.remove('knocked'); void el.offsetWidth; el.classList.add('knocked');
      },
      progress(f) { el.querySelector('.threshold-fill').style.width = Math.max(0, Math.min(100, f * 100)) + '%'; },
      mouth() { return el.querySelector('.doorway').getBoundingClientRect(); },
      // something looks out through the gap, then pulls the door shut
      peek(ms = 2600) {
        if (reduce || el.classList.contains('open')) return;
        el.classList.add('ajar', 'eyes');
        setTimeout(() => el.classList.remove('eyes'), ms - 500);
        setTimeout(() => { if (!el.classList.contains('open')) el.classList.remove('ajar'); }, ms);
      },
      // burst: flung open, light floods out, then it slams
      burst() {
        if (reduce) return;
        clearTimeout(closeTimer);
        el.classList.add('open', 'wide', 'flood');
        closeTimer = setTimeout(() => { el.classList.remove('wide', 'flood', 'open'); el.classList.add('slam'); setTimeout(() => el.classList.remove('slam'), 500); }, 900);
      },
    };
    Door.current = api;
    return api;
  };
  const Door = { create, current: null };
  return Door;
})();
