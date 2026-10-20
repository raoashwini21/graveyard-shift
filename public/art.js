// Drawings for Graveyard Shift: the spirit board, planchette, candles and the tarot deck.
// Everything is hand-built SVG so it stays crisp at any size and needs no image files.
window.GSArt = (() => {
  const INK = '#2a1a10';
  const PAPER = '#efe3c6';
  const BRASS = '#c9973f';
  const ECTO = '#a6ecd0';

  // ---------- The board ----------
  const BW = 1000, BH = 700;
  const POS = {};
  // Letters are spaced by how wide they are, like type set by hand. Q's long tail gets extra room.
  const WIDTH = { I: .55, J: .75, M: 1.25, W: 1.35, Q: 2.1, N: 1.1, O: 1.05, G: 1.05, D: 1.05, U: 1.05, V: 1.05, X: 1.05 };
  const arc = (chars, cx, cy, rx, ry, a0, a1) => {
    const list = chars.split('');
    const w = list.map((c) => WIDTH[c] || 1);
    const total = w.reduce((a, b) => a + b, 0) - (w[0] + w[w.length - 1]) / 2;
    let acc = 0;
    list.forEach((c, i) => {
      if (i > 0) acc += (w[i - 1] + w[i]) / 2;
      const deg = a0 + ((a1 - a0) * acc) / total;
      const a = (deg * Math.PI) / 180;
      POS[c] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), r: deg + 90 };
    });
  };
  arc('ABCDEFGHIJKLM', 500, 590, 405, 335, 197, 343);
  arc('NOPQRSTUVWXYZ', 500, 606, 345, 252, 199, 341);
  '1234567890'.split('').forEach((c, i) => { POS[c] = { x: 293 + i * 46, y: 556, r: 0 }; });
  POS.YES = { x: 262, y: 130, r: 0 };
  POS.NO = { x: 738, y: 130, r: 0 };
  POS.GOODBYE = { x: 500, y: 612, r: 0 };
  const REST = { x: 500, y: 430 };

  const corner = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})" stroke="${INK}" fill="none" stroke-width="1.6">
    <path d="M0 0 c26 2 40 12 46 30 M0 0 c2 26 12 40 30 46"/><path d="M8 8 c14 2 22 8 26 18 M8 8 c2 14 8 22 18 26" stroke-width="1"/>
    <circle cx="10" cy="10" r="3.5" fill="${INK}"/><path d="M46 30 c3 4 3 8 0 11 M30 46 c4 3 8 3 11 0"/></g>`;

  const sun = (x, y) => {
    let rays = '';
    for (let i = 0; i < 24; i++) {
      const a = (i * 15 * Math.PI) / 180;
      const r1 = 30, r2 = i % 2 ? 42 : 54;
      const w = i % 2 ? 2 : 4;
      const px = Math.cos(a + Math.PI / 2) * w, py = Math.sin(a + Math.PI / 2) * w;
      const bx = x + Math.cos(a) * r1, by = y + Math.sin(a) * r1;
      rays += `<path d="M${bx + px} ${by + py} L${x + Math.cos(a) * r2} ${y + Math.sin(a) * r2} L${bx - px} ${by - py}Z" fill="${INK}"/>`;
    }
    return `<g>${rays}<circle cx="${x}" cy="${y}" r="26" fill="url(#bhatch)" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="19" fill="${PAPER}" fill-opacity=".85" stroke="${INK}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="6" fill="${INK}"/></g>`;
  };
  const star = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -8 L2 -2 8 0 2 2 0 8 -2 2 -8 0 -2 -2Z" fill="${INK}"/>`;
  const moon = (x, y) => `<g><path d="M${x + 6} ${y - 34} a34 34 0 1 0 22 60 a28 28 0 1 1 -22 -60z" fill="url(#bhatch)" stroke="${INK}" stroke-width="2"/>${star(x + 34, y - 26, 1)}${star(x + 46, y + 4, .7)}${star(x + 30, y + 28, .9)}</g>`;

  const planchette = () => `<g class="plan" id="planchette"><g transform="scale(.86)" filter="url(#pshadow)">
    <path d="M0 -64 C36 -64 82 -8 78 46 C74 94 42 114 0 106 C-42 114 -74 94 -78 46 C-82 -8 -36 -64 0 -64Z" fill="url(#plankWood)" stroke="#1f0f06" stroke-width="2.5"/>
    <path d="M0 -52 C30 -52 68 -4 65 44 C62 84 36 100 0 93 C-36 100 -62 84 -65 44 C-68 -4 -30 -52 0 -52Z" fill="none" stroke="${BRASS}" stroke-width="1.4" opacity=".75"/>
    <g stroke="#2a1407" stroke-width="1" opacity=".35" fill="none"><path d="M-46 30 q16 26 4 60"/><path d="M-30 40 q12 22 2 52"/><path d="M40 28 q-14 30 -2 62"/><path d="M26 44 q-8 24 0 48"/></g>
    <circle cx="0" cy="0" r="27" fill="#1a0e06" stroke="${BRASS}" stroke-width="5"/>
    <circle cx="0" cy="0" r="23" fill="url(#lens)"/>
    <path d="M-14 -11 a18 18 0 0 1 16 -8" stroke="#fffaf0" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/>
    <circle cx="0" cy="56" r="4" fill="${BRASS}"/><path d="M-22 74 h44" stroke="${BRASS}" stroke-width="2" opacity=".6"/>
  </g></g>`;

  const board = () => {
    const glyphs = Object.entries(POS).map(([k, p]) => {
      const label = k === 'GOODBYE' ? 'Good Bye' : k === 'YES' ? 'Yes' : k === 'NO' ? 'No' : k;
      const size = /\d/.test(k) ? 46 : k.length > 1 ? 50 : 'NOPQRSTUVWXYZ'.includes(k) ? 56 : 66;
      return `<text class="glyph" data-k="${k}" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-size="${size}" text-anchor="middle" dominant-baseline="central" transform="rotate(${p.r.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})">${label}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${BW} ${BH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b3519"/><stop offset="1" stop-color="#2c170a"/></linearGradient>
        <filter id="woodTex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".003 .22" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .05  0 0 0 0 .02  0 0 0 .75 0"/></filter>
        <radialGradient id="paperGrad" cx="50%" cy="44%" r="72%"><stop offset="0" stop-color="#f5ebd2"/><stop offset=".6" stop-color="#e7d6ae"/><stop offset="1" stop-color="#c3a571"/></radialGradient>
        <filter id="paperTex" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" seed="2"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .5 -.08"/></filter>
        <radialGradient id="stain" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8a5a24" stop-opacity=".22"/><stop offset=".7" stop-color="#8a5a24" stop-opacity=".08"/><stop offset="1" stop-color="#8a5a24" stop-opacity="0"/></radialGradient>
        <pattern id="bhatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 V5" stroke="${INK}" stroke-width="1.2"/></pattern>
        <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${ECTO}" stop-opacity=".32"/><stop offset="1" stop-color="${ECTO}" stop-opacity="0"/></radialGradient>
        <linearGradient id="plankWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5530"/><stop offset=".55" stop-color="#5a3219"/><stop offset="1" stop-color="#2f170a"/></linearGradient>
        <radialGradient id="lens" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff4da" stop-opacity=".55"/><stop offset=".6" stop-color="#d9c79f" stop-opacity=".18"/><stop offset="1" stop-color="#3a2410" stop-opacity=".3"/></radialGradient>
        <clipPath id="woodClip"><rect width="${BW}" height="${BH}" rx="42"/></clipPath>
        <clipPath id="paperClip"><rect x="20" y="20" width="${BW - 40}" height="${BH - 40}" rx="24"/></clipPath>
        <filter id="pshadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="16" stdDeviation="9" flood-color="#2a1203" flood-opacity=".55"/></filter>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/><feFlood flood-color="${ECTO}"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="${BW}" height="${BH}" rx="42" fill="url(#woodGrad)"/>
      <g clip-path="url(#woodClip)"><rect width="${BW}" height="${BH}" filter="url(#woodTex)"/></g>
      <rect x="4" y="4" width="${BW - 8}" height="${BH - 8}" rx="38" fill="none" stroke="#7a4a24" stroke-width="2" opacity=".6"/>
      <rect x="20" y="20" width="${BW - 40}" height="${BH - 40}" rx="24" fill="url(#paperGrad)"/>
      <g clip-path="url(#paperClip)"><rect x="20" y="20" width="${BW - 40}" height="${BH - 40}" filter="url(#paperTex)" style="mix-blend-mode:multiply" opacity=".9"/></g>
      <ellipse cx="170" cy="560" rx="160" ry="110" fill="url(#stain)"/>
      <ellipse cx="860" cy="180" rx="130" ry="90" fill="url(#stain)"/>
      <ellipse cx="700" cy="640" rx="120" ry="40" fill="url(#stain)"/>
      <ellipse class="halo" cx="500" cy="420" rx="440" ry="250" fill="url(#haloGrad)"/>
      <rect x="44" y="44" width="${BW - 88}" height="${BH - 88}" rx="14" fill="none" stroke="${INK}" stroke-width="2.6"/>
      <rect x="54" y="54" width="${BW - 108}" height="${BH - 108}" rx="10" fill="none" stroke="${INK}" stroke-width="1"/>
      <rect x="62" y="62" width="${BW - 124}" height="${BH - 124}" rx="8" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray=".5 7" stroke-linecap="round"/>
      ${corner(70, 70, 0)}${corner(BW - 70, 70, 90)}${corner(BW - 70, BH - 70, 180)}${corner(70, BH - 70, 270)}
      ${sun(150, 132)}${moon(842, 132)}
      <text x="500" y="120" text-anchor="middle" font-family="Fell, Georgia, serif" font-style="italic" font-size="38" fill="${INK}">Graveyard Shift</text>
      <path d="M410 142 h68 M522 142 h68" stroke="${INK}" stroke-width="1.2"/><path d="M500 134 l8 8 -8 8 -8 -8z" fill="${INK}"/>
      <path d="M352 612 c18 -10 40 -10 58 0 M648 612 c-18 -10 -40 -10 -58 0" stroke="${INK}" stroke-width="1.4" fill="none"/>
      ${glyphs}
      ${planchette()}
    </svg>`;
  };

  // ---------- Candles ----------
  const candle = (h) => `<svg viewBox="0 0 50 ${h + 70}" style="height:${h + 70}px">
    <defs><linearGradient id="wax${h}" x1="0" x2="1"><stop offset="0" stop-color="#cdbb94"/><stop offset=".35" stop-color="#f4ead2"/><stop offset="1" stop-color="#a99670"/></linearGradient>
    <radialGradient id="fl${h}" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#fffbe8"/><stop offset=".35" stop-color="#ffd27a"/><stop offset=".75" stop-color="#ff8a2a" stop-opacity=".7"/><stop offset="1" stop-color="#ff6a00" stop-opacity="0"/></radialGradient>
    <radialGradient id="gl${h}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffc66b" stop-opacity=".45"/><stop offset="1" stop-color="#ffc66b" stop-opacity="0"/></radialGradient></defs>
    <circle cx="25" cy="40" r="60" fill="url(#gl${h})" class="flame"/>
    <rect x="8" y="66" width="34" height="${h}" rx="3" fill="url(#wax${h})"/>
    <ellipse cx="25" cy="66" rx="17" ry="4" fill="#f7efdc"/>
    <path d="M12 66 q-1 12 1 18 q2 3 3 -2 q0 -8 1 -14z M33 66 q1 22 -1 30 q-2 4 -3 -2 q0 -14 1 -26z" fill="#efe3c6"/>
    <path d="M25 66 v-9" stroke="#2a1a10" stroke-width="1.6"/>
    <path class="flame" d="M25 22 C 32 36, 34 48, 25 58 C 16 48, 18 36, 25 22Z" fill="url(#fl${h})"/>
  </svg>`;

  const meter = () => `<svg viewBox="0 0 60 200">
    <defs><linearGradient id="redwax" x1="0" x2="1"><stop offset="0" stop-color="#5e1416"/><stop offset=".4" stop-color="#a42a2c"/><stop offset="1" stop-color="#4a0f11"/></linearGradient>
    <radialGradient id="mfl" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#fffbe8"/><stop offset=".35" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff6a00" stop-opacity="0"/></radialGradient></defs>
    <g class="top" style="transition: transform 1.1s cubic-bezier(.2,.8,.2,1)">
      <circle class="flame" cx="30" cy="4" r="30" fill="#ffc66b" fill-opacity=".18"/>
      <path class="flame" d="M30 -18 C 37 -4, 39 8, 30 18 C 21 8, 23 -4, 30 -18Z" fill="url(#mfl)"/>
      <path d="M30 18 v8" stroke="#2a1a10" stroke-width="1.6"/>
    </g>
    <rect class="body" x="12" y="26" width="36" height="170" rx="3" fill="url(#redwax)" style="transition: y 1.1s cubic-bezier(.2,.8,.2,1), height 1.1s cubic-bezier(.2,.8,.2,1)"/>
    <path d="M10 196 h40" stroke="#c9973f" stroke-width="3"/>
  </svg>`;

  // ---------- The tarot deck ----------
  const hatch = (id, angle = 45, gap = 3.4, w = .7) => `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><path d="M0 0 V${gap}" stroke="${INK}" stroke-width="${w}"/></pattern>`;
  const ground = (h) => `<path d="M0 104 h100"/><rect x="0" y="105" width="100" height="15" fill="url(#${h})" stroke="none"/>`;
  const tinyStar = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -4 L1 -1 4 0 1 1 0 4 -1 1 -4 0 -1 -1Z" fill="${INK}" stroke="none"/>`;
  const web = (x, y, flip = 1) => `<g transform="translate(${x} ${y}) scale(${flip} 1)" stroke-width=".6"><path d="M0 0 l18 18 M0 0 l24 6 M0 0 l6 24"/><path d="M6 2 q3 4 0 4 q2 0 -2 0 M12 4 q1 7 -8 8 M18 6 q0 10 -12 12"/></g>`;

  // Each drawing is 100 x 120, ink on paper, one touch of spirit green.
  const ART = {
    dead: (u) => `${ground(`h2${u}`)}
      <path d="M78 12 a11 11 0 1 0 9 17 a9 9 0 1 1 -9 -17z" fill="url(#h${u})"/>${tinyStar(18, 14)}${tinyStar(30, 26, .7)}
      <path d="M50 0 v8"/><rect x="44" y="8" width="12" height="20" rx="6" stroke-width="2"/><rect x="47.5" y="24" width="5" height="18" rx="2.5" stroke-width="2"/><rect x="44" y="38" width="12" height="20" rx="6" stroke-width="2"/>
      <path d="M45 62 a6 6 0 0 1 10 -2" stroke-width="2"/><path d="M54 66 l4 3 M46 66 l-3 4 M50 67 v5" stroke-width=".8"/>
      <rect x="58" y="94" width="18" height="9" rx="4.5" transform="rotate(-14 67 98)" stroke-width="2"/>
      <path d="M22 98 c-9-6-8-30 8-35 c13-3 20 9 17 21 c-1 7 -1 11 3 15 c-6 1 -9 -1 -11 -4 c-2 4 -6 5 -9 2 c-3 3 -6 3 -8 1z" fill="${ECTO}" fill-opacity=".35"/>
      <ellipse cx="29" cy="76" rx="1.6" ry="2.4" fill="${INK}"/><ellipse cx="37" cy="76" rx="1.6" ry="2.4" fill="${INK}"/>`,
    possessed: (u) => `${ground(`h2${u}`)}
      <path d="M20 104 V46 a30 30 0 0 1 60 0 V104" stroke-width="2"/>
      <path d="M20 60 h6 M20 74 h6 M20 88 h6 M74 60 h6 M74 74 h6 M74 88 h6 M28 30 l5 4 M72 30 l-5 4 M50 16 v6 M38 20 l2 6 M62 20 l-2 6"/>
      <path d="M28 104 V48 a22 22 0 0 1 44 0 V104z" fill="url(#hd${u})"/>
      <path d="M50 54 c-7 0-10 6-10 12 c-7 3-10 14-11 38 h42 c-1-24-4-35-11-38 c0-6-3-12-10-12z" fill="${INK}"/>
      <ellipse cx="46" cy="65" rx="1.7" ry="2.6" fill="${ECTO}" stroke="none"/><ellipse cx="54" cy="65" rx="1.7" ry="2.6" fill="${ECTO}" stroke="none"/>
      <path d="M41 50 l-5 -10 M59 50 l5 -10" stroke-width="1.6"/>`,
    chain: (u) => `<path d="M0 78 q24 -12 50 -3 t50 -5" stroke-width=".8"/>
      <path d="M4 120 C 40 104, 76 110, 64 96 C 56 86, 26 88, 36 78 C 42 72, 58 74, 54 68" stroke-dasharray="2.5 3"/>
      ${tinyStar(14, 16)}${tinyStar(40, 10, .6)}${tinyStar(86, 22, .8)}<path d="M70 14 a8 8 0 1 0 6 12 a6 6 0 1 1 -6 -12z" fill="url(#h${u})"/>
      <path d="M68 104 h-16 c2-15 4-28 9-36 c-3-2-4-9 0-12 c5-3 10 0 10 6 c0 3-1 5-3 6 c5 9 7 22 0 36z" fill="url(#h${u})" stroke-width="1.4"/>
      <path d="M80 56 L73 104" stroke-width="1.8"/><path d="M80 56 l5 3"/>
      <circle cx="88" cy="66" r="9" fill="${ECTO}" fill-opacity=".25" stroke="none"/>
      <path d="M84 60 h8 l1 3 v8 l-1 3 h-8 l-1 -3 v-8z" stroke-width="1.4"/><circle cx="88" cy="67" r="2.4" fill="${ECTO}" stroke="${INK}" stroke-width=".6"/>`,
    nameless: (u) => `${ground(`h2${u}`)}${tinyStar(16, 20)}${tinyStar(84, 16, .8)}${tinyStar(78, 40, .6)}${tinyStar(22, 44, .6)}
      <path d="M50 12 c-19 0-29 19-29 40 c0 11 -6 30 -12 52 h82 c-6-22-12-41-12-52 c0-21-10-40-29-40z" fill="url(#h${u})" stroke-width="1.6"/>
      <path d="M50 22 c-12 0-18 12-18 26 c0 10 8 18 18 18 c10 0 18-8 18-18 c0-14-6-26-18-26z" fill="#160d07"/>
      <path d="M36 74 c4 12 6 22 4 30 M64 74 c-4 12 -6 22 -4 30" stroke-width=".9"/>`,
    speechless: (u) => `<ellipse cx="50" cy="56" rx="35" ry="44" stroke-width="2"/><ellipse cx="50" cy="56" rx="30" ry="39" stroke-width=".8"/>
      <path d="M30 60 c6-9 13-9 20-4 c7-5 14-5 20 4 c-6 11-34 11-40 0z" fill="url(#h${u})" stroke-width="1.6"/><path d="M30 60 h40" stroke-width="1.4"/>
      <path d="M35 55 l4 9 M39 55 l-4 9 M45 54 l4 10 M49 54 l-4 10 M55 54 l4 10 M59 54 l-4 10 M63 55 l4 9 M67 55 l-4 9" stroke="${INK}" stroke-width="1.1"/>
      <path d="M22 96 q-6 -8 -4 -18 M78 96 q6 -8 4 -18" stroke-width="1"/><path d="M20 84 l-5 -3 M19 90 l-6 -1 M80 84 l5 -3 M81 90 l6 -1" stroke-width="1"/>
      <path d="M50 2 c-4 4 -4 8 0 10 c4 -2 4 -6 0 -10z" fill="${ECTO}" fill-opacity=".5"/>`,
    'stale-year': (u) => `${web(4, 4)}${web(96, 4, -1)}
      <circle cx="50" cy="54" r="34" stroke-width="2"/><circle cx="50" cy="54" r="29" stroke-width=".8"/>
      ${Array.from({ length: 12 }, (_, i) => { const a = (i * 30 * Math.PI) / 180; return `<path d="M${50 + Math.cos(a) * 25} ${54 + Math.sin(a) * 25} L${50 + Math.cos(a) * (i % 3 ? 22 : 19)} ${54 + Math.sin(a) * (i % 3 ? 22 : 19)}" stroke-width="${i % 3 ? 1 : 2}"/>`; }).join('')}
      <path d="M50 54 L50 34" stroke-width="2.2"/><path d="M50 54 L63 61" stroke-width="2.2"/><circle cx="50" cy="54" r="2.4" fill="${INK}"/>
      <path d="M66 30 l-6 9 7 4 -5 8 4 6" stroke="${ECTO}" stroke-width="1.4"/>
      <path d="M50 88 v14" stroke-width="1.4"/><circle cx="50" cy="108" r="6" fill="url(#h${u})" stroke-width="1.4"/>`,
    'past-event': (u) => `${web(4, 4)}${web(96, 4, -1)}
      <path d="M6 84 h88" stroke-width="2"/><path d="M6 84 q7 9 14.7 0 q7 9 14.7 0 q7 9 14.7 0 q7 9 14.7 0 q7 9 14.7 0 q7 9 14.7 0" stroke-width="1"/><path d="M14 92 v24 M86 92 v24" stroke-width="2"/>
      <rect x="30" y="64" width="40" height="20" fill="url(#h${u})" stroke-width="1.6"/><rect x="38" y="50" width="24" height="14" stroke-width="1.6"/>
      <path d="M38 54 q3 4 6 0 q3 4 6 0 q3 4 6 0 q3 4 6 0" stroke-width="1"/>
      <path d="M44 50 v-9 M50 50 v-11 M56 50 v-9" stroke-width="1.8"/>
      <path d="M50 36 c-4-5 4-8 0-14 c-3-5 3-7 1-12" stroke="${ECTO}" stroke-width="1.4"/><path d="M44 38 c-3-4 2-6 0-10" stroke="${ECTO}" stroke-width="1" opacity=".7"/>`,
    locked: (u) => `${ground(`h2${u}`)}
      <path d="M24 104 V46 a26 26 0 0 1 52 0 V104z" fill="url(#h${u})" stroke-width="2"/>
      <path d="M37 24 V104 M50 20 V104 M63 24 V104" stroke-width=".9"/>
      <path d="M24 56 h22 M24 92 h22" stroke-width="4"/>
      <path d="M16 70 q34 16 68 0" stroke-width="3" stroke-dasharray="4 2.5"/>
      <rect x="43" y="76" width="14" height="12" rx="1.5" fill="${INK}"/><path d="M45.5 76 v-4 a4.5 4.5 0 0 1 9 0 v4" stroke-width="2"/>
      <circle cx="50" cy="81" r="1.6" fill="${ECTO}" stroke="none"/>`,
  };

  const NUMERAL = { dead: 'XIII', possessed: 'XV', chain: 'IX', nameless: '0', speechless: 'II', 'stale-year': 'X', 'past-event': 'VI', locked: 'XX' };

  // A card front. withText=false leaves the words off so the share card can draw them with the page's fonts.
  const cardFront = (type, name, withText = true) => {
    const u = type.replace(/[^a-z]/g, '') + Math.random().toString(36).slice(2, 6);
    const nameSize = name.length > 16 ? 11.5 : name.length > 12 ? 13 : 14.5;
    return `<svg viewBox="0 0 140 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cp${u}" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#f6ecd4"/><stop offset=".7" stop-color="#e8d8b2"/><stop offset="1" stop-color="#c9ad7a"/></radialGradient>
        <filter id="ct${u}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .2  0 0 0 0 .1  0 0 0 .45 -.05"/></filter>
        <clipPath id="cc${u}"><rect width="140" height="240" rx="8"/></clipPath>
        ${hatch(`h${u}`)}${hatch(`h2${u}`, 0, 3, .6)}${hatch(`hd${u}`, 45, 2.2, .9)}
      </defs>
      <rect width="140" height="240" rx="8" fill="url(#cp${u})"/>
      <g clip-path="url(#cc${u})"><rect width="140" height="240" filter="url(#ct${u})" style="mix-blend-mode:multiply"/></g>
      <rect x="7" y="7" width="126" height="226" rx="4" fill="none" stroke="${INK}" stroke-width="2"/>
      <rect x="12" y="12" width="116" height="216" rx="2" fill="none" stroke="${INK}" stroke-width=".8"/>
      <path d="M50 14 h40 a10 10 0 0 1 0 20 h-40 a10 10 0 0 1 0 -20z" fill="#efe3c6" stroke="${INK}" stroke-width="1.2"/>
      ${withText ? `<text x="70" y="28.5" text-anchor="middle" font-family="Fell SC, Fell, Georgia, serif" font-size="14" fill="${INK}">${NUMERAL[type]}</text>` : ''}
      <g transform="translate(20 46)" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${ART[type](u)}</g>
      <path d="M14 200 h112 l-7 11 7 11 h-112 l7 -11z" fill="#e3d0a6" stroke="${INK}" stroke-width="1.2"/>
      ${withText ? `<text x="70" y="215" text-anchor="middle" font-family="Fell SC, Fell, Georgia, serif" font-size="${nameSize}" fill="${INK}">${name}</text>` : ''}
    </svg>`;
  };

  const cardBack = () => {
    const B = BRASS;
    const phases = Array.from({ length: 8 }, (_, i) => {
      const a = (i * 45 - 90) * Math.PI / 180;
      const x = 70 + Math.cos(a) * 50, y = 120 + Math.sin(a) * 50;
      const k = i / 8;
      return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${B}" stroke-width=".8"/><circle cx="${x + (k - .5) * 8}" cy="${y}" r="4.2" fill="#1a110b"/>`;
    }).join('');
    const rays = Array.from({ length: 16 }, (_, i) => {
      const a = (i * 22.5) * Math.PI / 180;
      return `<path d="M${70 + Math.cos(a) * 26} ${120 + Math.sin(a) * 26} L${70 + Math.cos(a) * (i % 2 ? 34 : 40)} ${120 + Math.sin(a) * (i % 2 ? 34 : 40)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 140 240" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24170f"/><stop offset="1" stop-color="#110a06"/></linearGradient></defs>
      <rect width="140" height="240" rx="8" fill="url(#cb)"/>
      <g fill="none" stroke="${B}" stroke-width="1">
        <rect x="7" y="7" width="126" height="226" rx="4" stroke-width="1.6"/><rect x="12" y="12" width="116" height="216" rx="2" stroke-width=".6"/>
        <circle cx="70" cy="120" r="58" stroke-width=".7"/><circle cx="70" cy="120" r="42"/><circle cx="70" cy="120" r="26" stroke-width=".7"/>
        ${rays}
        <path d="M52 120 q18 -14 36 0 q-18 14 -36 0z" stroke-width="1.2"/><circle cx="70" cy="120" r="5.5" fill="${B}"/><circle cx="70" cy="120" r="2" fill="#110a06" stroke="none"/>
        <path d="M70 30 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z M70 188 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="${B}" fill-opacity=".6"/>
        <path d="M24 24 l8 8 M116 24 l-8 8 M24 216 l8 -8 M116 216 l-8 -8" stroke-width=".8"/>
      </g>
      ${phases}
    </svg>`;
  };

  return { POS, REST, board, candle, meter, cardFront, cardBack, NUMERAL };
})();
