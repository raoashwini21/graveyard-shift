// Graveyard Shift — the hallway, rendered for real.
// A WebGL corridor in an old mansion: oak floorboards, damask wallpaper, panelled wainscot, candle sconces
// whose flames flicker the light, moonlight falling through a window, drifting fog, dust, bloom and film grain.
// The door at the end of the hall is the door the app talks to: it lines itself up with the invisible
// .door placeholder in the page, so ghosts released from the DOM door come out of the 3D one.
// If WebGL is missing, this file does nothing and the drawn hallway in hall.js stays.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const host = document.getElementById('hall');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch { renderer = null; }

if (renderer && host) start();

function start() {
  const W = 3.4, HT = 3.6, L = 30; // corridor width, height, length (metres)
  const DOOR_W = 1.05, DOOR_H = 2.3;
  const rand = (a, b) => a + Math.random() * (b - a);
  const loader = new THREE.TextureLoader();

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.innerHTML = '';
  host.appendChild(renderer.domElement);
  document.body.classList.add('three');

  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#514659');
  scene.background = FOG;
  scene.fog = new THREE.FogExp2(FOG, 0.034);
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 80);
  camera.position.set(0, 1.62, 4);

  // ---------- Canvas textures ----------
  const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const tex = (c, { repeat = [1, 1], color = true } = {}) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const speckle = (g, w, h, n, alpha, light = false) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = light ? `rgba(255,245,230,${Math.random() * alpha})` : `rgba(20,10,10,${Math.random() * alpha})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  };
  const stains = (g, w, h, n, rgb, a) => {
    for (let i = 0; i < n; i++) {
      const x0 = Math.random() * w, y0 = Math.random() * h, r = rand(20, 160), al = a * Math.random();
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { // drawn wrapped so the tile repeats without seams
        const x = x0 + ox, y = y0 + oy;
        if (x + r < 0 || x - r > w || y + r < 0 || y - r > h) continue;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${rgb},${al})`); gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  };
  // Damask: one motif drawn in a 256x320 cell, mirrored.
  const damask = (g, x, y, s, fill) => {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = fill;
    const half = () => {
      g.beginPath();
      g.moveTo(0, -120); g.bezierCurveTo(30, -95, 46, -70, 22, -40); g.bezierCurveTo(60, -50, 78, -10, 50, 10);
      g.bezierCurveTo(90, 20, 84, 70, 44, 72); g.bezierCurveTo(60, 100, 30, 125, 0, 135);
      g.lineTo(0, 100); g.bezierCurveTo(18, 88, 22, 66, 8, 54); g.bezierCurveTo(40, 50, 46, 22, 22, 18);
      g.bezierCurveTo(36, -4, 20, -26, 0, -24); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(64, -70, 9, 18, -0.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(70, 104, 7, 14, 0.5, 0, Math.PI * 2); g.fill();
    };
    half(); g.scale(-1, 1); half();
    g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  const paper = (bump) => canvas(512, 640, (g, w, h) => {
    g.fillStyle = bump ? '#808080' : '#5c5160'; g.fillRect(0, 0, w, h);
    if (!bump) { stains(g, w, h, 18, '40,24,36', 0.35); stains(g, w, h, 10, '150,130,150', 0.12); }
    const ink = bump ? '#a8a8a8' : 'rgba(128,112,128,.42)';
    for (const [x, y] of [[128, 160], [384, 480], [384, -160], [-128, 480], [640, 480], [128, 800]]) damask(g, x, y, 0.95, ink);
    for (const [x, y] of [[384, 160], [128, 480], [-128, 160], [640, 160]]) { g.fillStyle = ink; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
    if (!bump) {
      speckle(g, w, h, 5000, 0.18); speckle(g, w, h, 1500, 0.06, true);
      g.fillStyle = 'rgba(25,14,22,.35)'; g.fillRect(w - 2, 0, 2, h); // seam

    }
  });
  const wallMap = tex(paper(false));
  const wallBump = tex(paper(true), { color: false });
  const plaster = tex(canvas(512, 512, (g, w, h) => { g.fillStyle = '#4a4148'; g.fillRect(0, 0, w, h); stains(g, w, h, 30, '20,14,18', 0.4); stains(g, w, h, 12, '120,110,115', 0.15); speckle(g, w, h, 6000, 0.2); }));
  const rugMap = tex(canvas(256, 1024, (g, w, h) => {
    g.fillStyle = '#5e1a1e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a07a3c'; g.lineWidth = 6; g.strokeRect(14, -10, w - 28, h + 20);
    g.lineWidth = 2; g.strokeRect(26, -10, w - 52, h + 20);
    g.fillStyle = '#3c0f13'; g.fillRect(34, 0, w - 68, h);
    g.strokeStyle = 'rgba(176,132,70,.55)'; g.lineWidth = 3;
    for (let y = 64; y < h; y += 128) { g.beginPath(); g.moveTo(w / 2, y - 44); g.lineTo(w / 2 + 50, y); g.lineTo(w / 2, y + 44); g.lineTo(w / 2 - 50, y); g.closePath(); g.stroke(); g.beginPath(); g.arc(w / 2, y, 10, 0, 7); g.stroke(); }
    stains(g, w, h, 40, '20,6,8', 0.5); stains(g, w, h, 20, '140,90,80', 0.15); speckle(g, w, h, 8000, 0.25); speckle(g, w, h, 2500, 0.08, true);
  }), { repeat: [1, 4] });
  const glowTex = tex(canvas(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,220,160,.55)'); gr.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }));
  const flameTex = tex(canvas(64, 128, (g) => {
    const gr = g.createRadialGradient(32, 92, 2, 32, 80, 52); gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.3, '#ffd27a'); gr.addColorStop(0.7, 'rgba(255,120,30,.5)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(52, 50, 54, 86, 32, 112); g.bezierCurveTo(10, 86, 12, 50, 32, 6); g.fill();
  }));
  const wood = (color, rep, rot = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62 });
    const set = (t, isColor) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.rotation = rot; t.center.set(0.5, 0.5); if (isColor) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    loader.load('tex/hardwood2_diffuse.jpg', (t) => { m.map = set(t, true); m.needsUpdate = true; });
    loader.load('tex/hardwood2_roughness.jpg', (t) => { m.roughnessMap = set(t); m.needsUpdate = true; });
    loader.load('tex/hardwood2_bump.jpg', (t) => { m.bumpMap = set(t); m.bumpScale = 1.2; m.needsUpdate = true; });
    return m;
  };

  // ---------- Materials ----------
  const M = {
    floor: wood('#6b4630', [3, L / 4], Math.PI / 2),
    wall: new THREE.MeshStandardMaterial({ map: wallMap, bumpMap: wallBump, bumpScale: 1.5, roughness: 0.92, side: THREE.DoubleSide }),
    ceiling: new THREE.MeshStandardMaterial({ map: plaster, roughness: 1 }),
    trim: wood('#3a2216', [0.4, 0.4]),
    panel: wood('#4a2c1d', [0.6, 1], Math.PI / 2),
    door: wood('#5a331f', [0.7, 1.3], Math.PI / 2),
    rug: new THREE.MeshStandardMaterial({ map: rugMap, roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c99a4e', metalness: 1, roughness: 0.32 }),
    wax: new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.6, emissive: '#ffcf8a', emissiveIntensity: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: '#120c0e', roughness: 1 }),
    gilt: new THREE.MeshStandardMaterial({ color: '#a7803f', metalness: 0.85, roughness: 0.45 }),
  };
  plaster.repeat.set(2, L / 3);
  wallMap.repeat.set(1, 1); wallBump.repeat.set(1, 1);

  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  // ---------- Layout ----------
  const LEFT = [['door', 4], ['sconce', 6.5], ['door', 9], ['sconce', 11.5], ['door', 14], ['sconce', 16.5], ['portrait', 19], ['sconce', 21.5], ['window', 24.2], ['door', 27.4]];
  const RIGHT = [['sconce', 4], ['door', 6.5], ['sconce', 9], ['door', 11.5], ['portrait', 14], ['door', 16.5], ['sconce', 19], ['door', 21.5], ['sconce', 24.2], ['door', 26.8]];
  const WIN = { w: 1.5, y0: 0.95, y1: 3.0 };

  // floor, rug, ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L + 8), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -L / 2 + 4); floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.45, L + 6), M.rug);
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -L / 2 + 3); rug.receiveShadow = true; scene.add(rug);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L + 8), M.ceiling);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HT, -L / 2 + 4); scene.add(ceil);
  for (let s = -3; s < L; s += 3.2) box(W, 0.22, 0.28, M.trim, 0, HT - 0.11, -s); // ceiling beams

  // walls with openings (doors and the window), built from a shape with holes
  const wall = (side, items) => {
    const sh = new THREE.Shape();
    const sgn = side < 0 ? 1 : -1; // shape x = sgn * s
    const s0 = -4, s1 = L;
    sh.moveTo(sgn * s0, 0); sh.lineTo(sgn * s1, 0); sh.lineTo(sgn * s1, HT); sh.lineTo(sgn * s0, HT); sh.closePath();
    for (const [kind, s] of items) {
      if (kind !== 'door' && kind !== 'window') continue;
      const half = (kind === 'door' ? DOOR_W : WIN.w) / 2;
      const y0 = kind === 'door' ? 0.001 : WIN.y0, y1 = kind === 'door' ? DOOR_H : WIN.y1;
      const hole = new THREE.Path();
      hole.moveTo(sgn * (s - half), y0); hole.lineTo(sgn * (s + half), y0); hole.lineTo(sgn * (s + half), y1); hole.lineTo(sgn * (s - half), y1); hole.closePath();
      sh.holes.push(hole);
    }
    const geo = new THREE.ShapeGeometry(sh);
    // UVs in metres: one wallpaper tile is 0.9m wide, 1.12m tall
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.5, uv.getY(i) / 0.625);
    const m = new THREE.Mesh(geo, M.wall);
    m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    m.position.x = side * W / 2; m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    // wainscot, chair rail, skirting and crown, broken around openings
    const gaps = items.filter(([k]) => k === 'door' || k === 'window').map(([k, s]) => [s - (k === 'door' ? DOOR_W : WIN.w) / 2 - 0.12, s + (k === 'door' ? DOOR_W : WIN.w) / 2 + 0.12, k]);
    const x = side * (W / 2 - 0.02);
    let a = s0;
    const runs = [];
    for (const [g0, g1, k] of [...gaps, [s1, s1, 'end']]) { if (g0 > a) runs.push([a, g0]); if (k === 'door') a = g1; else if (k === 'window') { runs.push([g0, g1, 'under']); a = g1; } else a = g1; }
    for (const [r0, r1, under] of runs) {
      const len = r1 - r0, mid = -(r0 + r1) / 2;
      const top = under ? WIN.y0 - 0.12 : 1.0;
      box(0.04, top, len, M.panel, x, top / 2, mid);
      if (!under) {
        box(0.07, 0.07, len, M.trim, side * (W / 2 - 0.04), 1.02, mid);   // chair rail
        box(0.05, 0.16, len, M.trim, side * (W / 2 - 0.03), 0.08, mid);   // skirting
        for (let p = r0 + 0.35; p < r1 - 0.3; p += 0.9) box(0.02, 0.62, 0.62, M.trim, side * (W / 2 - 0.04), 0.52, -p - 0.1).scale.set(1, 1, 0.98); // panel mouldings
      }
    }
    box(0.12, 0.14, L + 4, M.trim, side * (W / 2 - 0.06), HT - 0.07, -L / 2 + 2); // crown
  };
  wall(-1, LEFT); wall(1, RIGHT);

  // end wall with the door
  {
    const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, HT); sh.lineTo(-W / 2, HT); sh.closePath();
    const hole = new THREE.Path(); hole.moveTo(-DOOR_W / 2, 0.001); hole.lineTo(DOOR_W / 2, 0.001); hole.lineTo(DOOR_W / 2, DOOR_H); hole.lineTo(-DOOR_W / 2, DOOR_H); hole.closePath(); sh.holes.push(hole);
    const geo = new THREE.ShapeGeometry(sh); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.5, uv.getY(i) / 0.625);
    const m = new THREE.Mesh(geo, M.wall); m.position.z = -L; m.receiveShadow = true; m.castShadow = true; scene.add(m);
    box(W / 2 - DOOR_W / 2 - 0.12, 1.0, 0.04, M.panel, -(W / 2 + DOOR_W / 2 + 0.12) / 2, 0.5, -L + 0.02);
    box(W / 2 - DOOR_W / 2 - 0.12, 1.0, 0.04, M.panel, (W / 2 + DOOR_W / 2 + 0.12) / 2, 0.5, -L + 0.02);
  }

  // ---------- Doors ----------
  const makeDoor = (w, h, warm = '#ffb766') => {
    const g = new THREE.Group();
    // the room behind: a dark box with a warm glow at the back
    const room = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, h + 0.4, 1.8), new THREE.MeshStandardMaterial({ color: '#2a1d1c', roughness: 1, side: THREE.BackSide }));
    room.position.set(0, (h + 0.4) / 2, -0.95); room.receiveShadow = true; g.add(room);
    const backMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(warm).multiplyScalar(0), toneMapped: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, h + 0.3), backMat); back.position.set(0, h / 2 + 0.1, -1.82); g.add(back);
    // frame and architrave
    box(0.12, h + 0.12, 0.26, M.trim, -w / 2 - 0.06, (h + 0.12) / 2, 0, g);
    box(0.12, h + 0.12, 0.26, M.trim, w / 2 + 0.06, (h + 0.12) / 2, 0, g);
    box(w + 0.44, 0.18, 0.3, M.trim, 0, h + 0.12, 0.01, g);
    box(w + 0.6, 0.06, 0.34, M.trim, 0, h + 0.24, 0.02, g);
    // the leaf, hinged on the left
    const pivot = new THREE.Group(); pivot.position.set(-w / 2, 0, -0.04); g.add(pivot);
    const leaf = new THREE.Group(); pivot.add(leaf);
    box(w - 0.01, h - 0.01, 0.055, M.door, w / 2, h / 2, 0, leaf);
    for (const [px, py, ph] of [[0.27, 0.73, 0.3], [0.73, 0.73, 0.3], [0.27, 0.3, 0.42], [0.73, 0.3, 0.42]]) {
      for (const z of [0.032, -0.032]) {
        box(w * 0.36, h * ph, 0.012, M.door, w * px, h * py, z, leaf);
        box(w * 0.39, 0.02, 0.016, M.trim, w * px, h * (py + ph / 2) + 0.005, z, leaf);
        box(w * 0.39, 0.02, 0.016, M.trim, w * px, h * (py - ph / 2) - 0.005, z, leaf);
      }
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.036, 24, 16), M.brass); knob.position.set(w - 0.1, h * 0.46, 0.07); knob.castShadow = true; leaf.add(knob);
    const plate = box(0.05, 0.16, 0.008, M.brass, w - 0.1, h * 0.43, 0.035, leaf);
    plate.castShadow = false;
    // eyes in the dark room
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffe9b0', toneMapped: false, transparent: true, opacity: 0 });
    const eyes = new THREE.Group();
    for (const ex of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeMat); e.scale.set(1.4, 0.7, 1); e.position.x = ex; eyes.add(e); }
    eyes.position.set(w * 0.18, 1.55, -0.5); g.add(eyes);
    // light under the door
    const sill = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, 0.03), new THREE.MeshBasicMaterial({ color: warm, toneMapped: false, transparent: true, opacity: 0.0 }));
    sill.position.set(0, 0.012, 0.05); sill.rotation.x = -Math.PI / 2.5; g.add(sill);
    return { g, pivot, leaf, backMat, warm: new THREE.Color(warm), eyeMat, sill, open: 0, target: 0, glow: 0, glowTarget: 0, knock: 0, w, h };
  };

  const sideDoors = [];
  const roaming = [new THREE.PointLight('#ffb05c', 0, 7, 2), new THREE.PointLight('#ffb05c', 0, 7, 2)];
  roaming.forEach((l) => scene.add(l));
  const place = (side, s, obj) => { obj.position.set(side * W / 2, 0, -s); obj.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(obj); };

  const sconces = [];
  const sconce = (side, s) => {
    const g = new THREE.Group();
    box(0.1, 0.18, 0.02, M.brass, 0, 1.92, 0.01, g);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), M.brass); arm.rotation.x = Math.PI / 2; arm.position.set(0, 1.9, 0.11); g.add(arm);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.04, 16), M.brass); cup.position.set(0, 1.94, 0.22); g.add(cup);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.2, 16), M.wax); candle.position.set(0, 2.06, 0.22); g.add(candle);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    flame.scale.set(0.05, 0.1, 1); flame.position.set(0, 2.2, 0.22); g.add(flame);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb35c', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    halo.scale.set(0.9, 0.9, 1); halo.position.copy(flame.position); g.add(halo);
    const light = new THREE.PointLight('#ffae55', 5, 9, 2); light.position.set(0, 2.22, 0.34); g.add(light);
    place(side, s, g);
    sconces.push({ flame, halo, light, base: 5, seed: Math.random() * 100 });
  };

  const portraits = [];
  const painting = () => tex(canvas(256, 340, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h * 0.35, 10, w / 2, h * 0.45, h * 0.7); bg.addColorStop(0, '#4b3a2c'); bg.addColorStop(1, '#120c09');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a120e'; g.beginPath(); g.moveTo(20, h); g.bezierCurveTo(30, h * 0.66, 80, h * 0.6, w / 2, h * 0.6); g.bezierCurveTo(w - 80, h * 0.6, w - 30, h * 0.66, w - 20, h); g.fill();
    const face = g.createRadialGradient(w / 2 - 10, h * 0.36, 4, w / 2, h * 0.4, 70); face.addColorStop(0, '#b9a088'); face.addColorStop(0.7, '#6b5546'); face.addColorStop(1, 'rgba(40,28,20,0)');
    g.fillStyle = face; g.beginPath(); g.ellipse(w / 2, h * 0.4, 48, 64, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(15,8,6,.85)'; g.beginPath(); g.ellipse(w / 2 - 19, h * 0.37, 12, 8, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(w / 2 + 19, h * 0.37, 12, 8, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(60,30,24,.7)'; g.fillRect(w / 2 - 14, h * 0.5, 28, 3);
    g.fillStyle = '#1a120e'; g.beginPath(); g.ellipse(w / 2, h * 0.26, 54, 34, 0, Math.PI, 0); g.fill();
    stains(g, w, h, 20, '10,6,4', 0.5); speckle(g, w, h, 4000, 0.25);
    g.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 60; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + rand(-14, 14), y + rand(-14, 14)); g.stroke(); }
  }));
  const portrait = (side, s) => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 12, 48), M.gilt); frame.scale.set(1, 1.3, 0.6); frame.position.set(0, 1.85, 0.05); frame.castShadow = true; g.add(frame);
    const canvasM = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshStandardMaterial({ map: painting(), roughness: 0.55 }));
    canvasM.scale.set(1, 1.3, 1); canvasM.position.set(0, 1.85, 0.03); g.add(canvasM);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffdd99', toneMapped: false, transparent: true, opacity: 0.85 });
    const eyes = new THREE.Group();
    for (const ex of [-0.062, 0.062]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), eyeMat); e.position.x = ex; eyes.add(e); }
    eyes.position.set(0, 1.85 + 0.42 * 1.3 * 0.18, 0.04); g.add(eyes);
    place(side, s, g);
    portraits.push({ eyes, eyeMat });
  };

  let moon = null;
  const windowAt = (side, s) => {
    const g = new THREE.Group();
    const w = WIN.w, h = WIN.y1 - WIN.y0;
    // night outside
    const sky = tex(canvas(256, 384, (c, cw, ch) => {
      const gr = c.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, '#22304f'); gr.addColorStop(0.7, '#506887'); gr.addColorStop(1, '#6d7f96'); c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
      const mg = c.createRadialGradient(170, 90, 0, 170, 90, 90); mg.addColorStop(0, 'rgba(240,244,255,1)'); mg.addColorStop(0.16, 'rgba(230,236,255,1)'); mg.addColorStop(0.2, 'rgba(200,215,255,.45)'); mg.addColorStop(1, 'rgba(160,180,230,0)');
      c.fillStyle = mg; c.fillRect(0, 0, cw, ch);
      c.strokeStyle = '#0d1018'; c.lineCap = 'round';
      const branch = (x, y, a, len, wd) => { if (wd < 0.6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); branch(x2, y2, a + rand(-0.6, -0.1), len * 0.72, wd * 0.68); branch(x2, y2, a + rand(0.1, 0.6), len * 0.7, wd * 0.66); };
      branch(30, ch, -1.4, 110, 16); branch(230, ch, -1.9, 90, 12);
    }));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, color: '#c9d6ff' }));
    glass.position.set(0, WIN.y0 + h / 2, -0.5); g.add(glass);
    // reveal, sill and mullions
    box(0.08, h, 0.5, M.trim, -w / 2 - 0.04, WIN.y0 + h / 2, -0.25, g); box(0.08, h, 0.5, M.trim, w / 2 + 0.04, WIN.y0 + h / 2, -0.25, g);
    box(w + 0.16, 0.08, 0.5, M.trim, 0, WIN.y1 + 0.04, -0.25, g); box(w + 0.3, 0.06, 0.62, M.trim, 0, WIN.y0 - 0.03, -0.2, g);
    box(0.05, h, 0.06, M.trim, 0, WIN.y0 + h / 2, -0.45, g);
    for (const f of [0.33, 0.66]) box(w, 0.04, 0.06, M.trim, 0, WIN.y0 + h * f, -0.45, g);
    // curtains
    const cm = new THREE.MeshStandardMaterial({ color: '#2e1418', roughness: 1, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.5, h + 0.5, 12, 1); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 28) * 0.03);
      geo.computeVertexNormals();
      const cur = new THREE.Mesh(geo, cm); cur.position.set(sx * (w / 2 + 0.12), WIN.y0 + h / 2 + 0.1, 0.06); cur.castShadow = true; g.add(cur);
    }
    place(side, s, g);
    // the moonlight
    moon = new THREE.SpotLight('#a9bcff', 90, 16, 0.42, 0.55, 1.6);
    moon.position.set(side * (W / 2 + 4.2), 5.0, -s + 1.2);
    moon.target.position.set(-side * 0.6, 0, -s - 0.6);
    moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.bias = -0.0006; moon.shadow.radius = 4;
    scene.add(moon, moon.target);
    // a soft shaft of light through the dust
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.4), new THREE.MeshBasicMaterial({ map: glowTex, color: '#6f86c9', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    shaft.position.set(side * 0.5, 1.6, -s - 0.4); shaft.rotation.set(0, side * 0.35, side * 0.75); scene.add(shaft);
  };

  for (const [side, items] of [[-1, LEFT], [1, RIGHT]]) {
    for (const [kind, s] of items) {
      if (kind === 'door') { const d = makeDoor(DOOR_W, DOOR_H); place(side, s, d.g); sideDoors.push(d); }
      if (kind === 'sconce') sconce(side, s);
      if (kind === 'portrait') portrait(side, s);
      if (kind === 'window') windowAt(side, s);
    }
  }

  // ---------- The door at the end of the hall ----------
  const END = makeDoor(DOOR_W, DOOR_H, '#ffc277');
  END.g.position.set(0, 0, -L); scene.add(END.g);
  const endLight = new THREE.SpotLight('#ffbf70', 0, 22, 0.9, 0.6, 1.4);
  endLight.position.set(0, 1.4, -L - 1.5); endLight.target.position.set(0, 0, -L + 6);
  endLight.castShadow = true; endLight.shadow.mapSize.set(1024, 1024); endLight.shadow.bias = -0.0008; endLight.shadow.radius = 5;
  scene.add(endLight, endLight.target);
  const endFill = new THREE.PointLight('#ffb466', 0, 9, 2); endFill.position.set(0, 1.4, -L + 0.6); scene.add(endFill);
  // brass plaque with live text
  const plaqueCanvas = document.createElement('canvas'); plaqueCanvas.width = 1024; plaqueCanvas.height = 160;
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas); plaqueTex.colorSpace = THREE.SRGBColorSpace; plaqueTex.anisotropy = 8;
  let plaqueText = 'Knock';
  const drawPlaque = () => {
    const g = plaqueCanvas.getContext('2d'), w = 1024, h = 160;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f0d498'); gr.addColorStop(0.45, '#c79a52'); gr.addColorStop(1, '#8a6330');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2500, 0.18); stains(g, w, h, 12, '70,40,10', 0.35);
    g.strokeStyle = 'rgba(70,44,14,.8)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#5a3b16'; for (const x of [40, w - 40]) { g.beginPath(); g.arc(x, h / 2, 9, 0, 7); g.fill(); }
    let size = 84; g.font = `${size}px "Special Elite", "Courier New", monospace`;
    while (g.measureText(plaqueText).width > w - 140 && size > 30) { size -= 4; g.font = `${size}px "Special Elite", "Courier New", monospace`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,240,200,.5)'; g.fillText(plaqueText, w / 2 + 1, h / 2 + 4);
    g.fillStyle = '#2b1a08'; g.fillText(plaqueText, w / 2, h / 2 + 2);
    plaqueTex.needsUpdate = true;
  };
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 0.02), [M.brass, M.brass, M.brass, M.brass, new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.6, roughness: 0.38 }), M.brass]);
  plaque.position.set(0, DOOR_H + 0.48, -L + 0.06); scene.add(plaque);
  drawPlaque();
  document.fonts && document.fonts.load('40px "Special Elite"').then(drawPlaque, () => {});
  const plaqueLight = new THREE.PointLight('#ffcf8a', 0.9, 2.2, 2); plaqueLight.position.set(0, DOOR_H + 0.9, -L + 0.6); scene.add(plaqueLight);

  // ---------- Air: hemisphere fill, fog banks, dust ----------
  scene.add(new THREE.HemisphereLight('#a79fbd', '#4a382c', 1.5));
  const ambientWarm = new THREE.PointLight('#e0a878', 3.2, 11, 1.6); scene.add(ambientWarm); // the lantern you carry
  const fogBanks = [];
  loader.load('tex/smoke1.png', (smoke) => {
    smoke.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), new THREE.MeshLambertMaterial({ map: smoke, color: '#b9b0c8', transparent: true, opacity: rand(0.12, 0.22), depthWrite: false }));
      m.position.set(rand(-1.4, 1.4), rand(0.15, 0.5), -rand(-2, L - 1)); m.rotation.z = rand(0, 6.28);
      scene.add(m); fogBanks.push({ m, v: rand(0.02, 0.06) * (Math.random() < 0.5 ? -1 : 1), r: rand(-0.04, 0.04) });
    }
  });
  const dustN = 600, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = rand(-W / 2, W / 2); dustPos[i * 3 + 1] = rand(0, HT); dustPos[i * 3 + 2] = -rand(-3, L); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.018, color: '#ffe1b8', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // ---------- Post: bloom, then grain, vignette and a touch of lens fringing ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.7, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, dim: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float dim; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - .5; float r = dot(c,c);
        vec3 col; col.r = texture2D(tDiffuse, vUv + c * r * .012).r; col.g = texture2D(tDiffuse, vUv).g; col.b = texture2D(tDiffuse, vUv - c * r * .012).b;
        col *= 1. - smoothstep(.18, .75, r) * .55;
        col += (h(vUv * 900. + time) - .5) * .06;
        col *= 1. - dim;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  composer.addPass(film);

  // ---------- Camera that lines the end door up with the page's placeholder ----------
  const view = { z: 4, sx: 0, sy: 0, tz: 4, tsx: 0, tsy: 0.1, mx: 0, my: 0, tmx: 0, tmy: 0, shake: 0 };
  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const anchorRect = () => {
    const el = document.querySelector('.view.on .door .doorway');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.height < 30 || r.bottom < -r.height || r.top > innerHeight + r.height) return null;
    return r;
  };
  const fit = () => {
    const r = anchorRect();
    if (!r) { view.tz = -L + 15; view.tsx = 0; view.tsy = 0.18; return; }
    const H = innerHeight;
    const d = THREE.MathUtils.clamp((DOOR_H * H) / (2 * tanHalf() * r.height), 2.2, L + 3.5);
    view.tz = -L + d;
    const desiredX = ((r.left + r.width / 2) / innerWidth) * 2 - 1;
    const desiredY = 1 - ((r.top + r.height / 2) / H) * 2;
    const naturalY = (DOOR_H / 2 - camera.position.y) / (d * tanHalf());
    view.tsx = desiredX; view.tsy = desiredY - naturalY;
  };
  addEventListener('pointermove', (e) => { view.tmx = (e.clientX / innerWidth - 0.5); view.tmy = (e.clientY / innerHeight - 0.5); }, { passive: true });
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
  let snapped = false;

  // ---------- Behaviour exposed to the rest of the app ----------
  const ANG = { shut: 0, ajar: 0.42, open: 1.0, wide: 1.65 };
  const end = {
    state: 'shut', eyes: 0, flood: 0, progress: 0,
    set(state) { this.state = state; END.target = ANG[state]; },
  };
  const api = {
    label(t) { if (t !== plaqueText) { plaqueText = String(t).slice(0, 48); drawPlaque(); } },
    shut() { end.set('shut'); end.flood = 0; },
    ajar() { end.set('ajar'); },
    open() { end.set('open'); },
    wide() { end.set('wide'); },
    enter() { end.set('open'); clearTimeout(api._t); api._t = setTimeout(() => end.state === 'open' && end.set('shut'), 650); },
    knock() { END.knock = 1; },
    progress(f) { end.progress = f; },
    peek(ms = 2600) { if (end.state !== 'shut') return; end.set('ajar'); end.eyes = 1; setTimeout(() => { end.eyes = 0; }, ms - 500); setTimeout(() => end.state === 'ajar' && end.set('shut'), ms); },
    burst() {
      end.set('wide'); end.flood = 1; view.shake = 0.6;
      clearTimeout(api._b);
      api._b = setTimeout(() => { end.set('shut'); END.slam = true; end.flood = 0; }, 900);
    },
  };
  // Mirror every call the app makes on the DOM door onto the real one.
  const hook = () => {
    const d = window.Door && window.Door.current;
    if (!d || d._three) return;
    d._three = true;
    for (const k of ['label', 'ajar', 'shut', 'wide', 'knock', 'progress', 'peek', 'burst']) {
      const orig = d[k].bind(d);
      d[k] = (...a) => { const r = orig(...a); api[k](...a); return r; };
    }
    const origEnter = d.enter.bind(d);
    d.enter = (t, hold) => { const r = origEnter(t, hold); api.label(t); if (r) api.enter(); return r; };
    const el = d.el.querySelector('.plaque-text'); if (el) api.label(el.textContent);
  };
  hook();
  // Doors down the hall open on their own; portraits look away.
  const roam = [];
  window.Hall = {
    creak(hold = 1400) {
      const free = sideDoors.filter((x) => x.target === 0);
      if (!free.length || roam.length >= 2) return;
      const d = free[Math.floor(Math.random() * free.length)];
      const light = roaming[roam.length % 2];
      roam.push(d); d.target = rand(0.55, 1.15); d.glowTarget = 1;
      d.g.updateMatrixWorld(); light.position.copy(new THREE.Vector3(0, 1.4, -0.5).applyMatrix4(d.g.matrixWorld)); d.light = light;
      setTimeout(() => { d.target = 0; d.glowTarget = 0; setTimeout(() => { roam.splice(roam.indexOf(d), 1); d.light = null; light.intensity = 0; }, 1200); }, hold + Math.random() * 1200);
    },
    portraits() { portraits.forEach((p) => { p.eyeMat.opacity = 0; setTimeout(() => { p.eyeMat.opacity = 0.85; }, rand(280, 700)); }); },
  };

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  const v3 = new THREE.Vector3();
  let slow = 0, frames = 0, lowered = false;
  const frame = () => {
    requestAnimationFrame(frame);
    if (document.hidden || document.body.classList.contains('plain')) return;
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05), t = clock.elapsedTime;
    // If this machine struggles, render fewer pixels and drop the bloom rather than stutter.
    if (!lowered && ++frames > 30) { slow = slow * 0.95 + (raw > 0.045 ? 1 : 0) * 0.05; if (frames > 120 && slow > 0.5) { lowered = true; renderer.setPixelRatio(0.75); composer.setPixelRatio(0.75); bloom.enabled = false; } }
    hook();
    fit();
    const k = 1 - Math.pow(0.0015, dt);
    if (!snapped && anchorRect()) { view.z = view.tz; view.sx = view.tsx; view.sy = view.tsy; snapped = true; }
    view.z += (view.tz - view.z) * k; view.sx += (view.tsx - view.sx) * k; view.sy += (view.tsy - view.sy) * k;
    view.mx += (view.tmx - view.mx) * k * 0.6; view.my += (view.tmy - view.my) * k * 0.6;
    view.shake *= Math.pow(0.02, dt);
    const sway = reduce ? 0 : Math.sin(t * 0.35) * 0.012;
    camera.position.set(view.mx * 0.12 + (Math.random() - 0.5) * view.shake * 0.04, 1.62 + sway + (Math.random() - 0.5) * view.shake * 0.03, view.z);
    camera.lookAt(view.mx * 0.12, 1.62 + sway, view.z - 10);
    camera.rotation.y += -view.mx * 0.015; camera.rotation.x += -view.my * 0.01;
    camera.updateProjectionMatrix();
    ambientWarm.position.set(camera.position.x + 0.3, 2.4, camera.position.z - 1.2);
    camera.projectionMatrix.elements[8] = -view.sx; camera.projectionMatrix.elements[9] = -view.sy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    // candles
    for (const s of sconces) {
      const n = Math.sin(t * 9 + s.seed) * 0.5 + Math.sin(t * 23 + s.seed * 2) * 0.3 + Math.sin(t * 3.1 + s.seed) * 0.2;
      const gust = document.body.classList.contains('gutter') || document.body.classList.contains('blackout') ? 0.25 : 1;
      s.light.intensity = s.base * gust * (0.86 + n * 0.12);
      s.flame.scale.set(0.05 * (1 + n * 0.08), 0.1 * (1 + n * 0.12) * gust, 1);
      s.halo.material.opacity = 0.42 * gust + n * 0.05;
    }
    // side doors
    for (const d of sideDoors) {
      d.open += (d.target - d.open) * (1 - Math.pow(0.02, dt));
      d.pivot.rotation.y = d.open;
      d.glow += (d.glowTarget - d.glow) * (1 - Math.pow(0.05, dt));
      d.backMat.color.copy(d.warm).multiplyScalar(d.glow * (1.4 + Math.sin(t * 7) * 0.1));
      if (d.light) d.light.intensity = d.glow * 5;
    }
    // the end door
    const spring = END.slam ? 0.0000001 : end.state === 'wide' ? 0.004 : 0.03;
    END.open += (END.target - END.open) * (1 - Math.pow(spring, dt));
    if (END.slam && Math.abs(END.open) < 0.02) { END.slam = false; view.shake = 1; }
    END.knock = Math.max(0, END.knock - dt * 2.4);
    END.leaf.position.z = -Math.sin(END.knock * 22) * END.knock * 0.012;
    END.pivot.rotation.y = END.open;
    const speaking = document.body.classList.contains('speaking');
    const openness = THREE.MathUtils.clamp(END.open / 1.2, 0, 1);
    const glow = Math.max(0.12, openness) * (end.flood ? 2.6 : 1) * (speaking ? 1.4 : 1);
    END.backMat.color.copy(end.flood ? new THREE.Color('#ffe2b0') : END.warm).multiplyScalar(glow * 1.6);
    endLight.intensity = openness * (end.flood ? 260 : 120) * (speaking ? 1.5 : 1);
    endFill.intensity = openness * (end.flood ? 10 : 4);
    END.sill.material.opacity = 0.25 + Math.min(1, end.progress) * 0.75;
    END.sill.scale.x = 0.15 + Math.min(1, end.progress) * 0.85;
    END.eyeMat.opacity += ((end.eyes ? 1 : 0) - END.eyeMat.opacity) * (1 - Math.pow(0.01, dt));
    // portraits follow you
    for (const p of portraits) { p.eyes.position.x = view.mx * 0.018; }
    // fog and dust drift
    for (const f of fogBanks) { f.m.position.x += f.v * dt; f.m.rotation.z += f.r * dt; if (Math.abs(f.m.position.x) > 1.8) f.v *= -1; f.m.lookAt(camera.position.x, f.m.position.y, camera.position.z); }
    if (!reduce) { const p = dustGeo.attributes.position; for (let i = 0; i < dustN; i++) { p.array[i * 3 + 1] += Math.sin(t * 0.3 + i) * 0.0006; p.array[i * 3] += Math.cos(t * 0.2 + i * 1.3) * 0.0004; } p.needsUpdate = true; }
    // the room reacts to haunt events
    const cls = document.body.classList;
    const dimTarget = cls.contains('blackout') ? 0.75 : cls.contains('hush') ? 0.6 : cls.contains('felt') ? 0.18 : 0;
    film.uniforms.dim.value += (dimTarget - film.uniforms.dim.value) * (1 - Math.pow(cls.contains('blackout') ? 0.0001 : 0.05, dt));
    film.uniforms.time.value = t % 100;
    if (moon) moon.intensity = 90 * (cls.contains('blackout') ? 0.2 : 1);
    composer.render(dt);
  };
  frame();
  window.Hall3D = { api, scene, camera, v3 };
}
