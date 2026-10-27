// The walkable farm: a canvas world with enclosures, wandering animals and a farmer you control.
import * as E from './engine.js';
import { GROUPS, SPECIES, BUILDINGS, LAND, MILL } from './data.js';
import { drawAnimal, ART, artBounds, shade } from './art.js';

const OUT = '#2a1c10';
export const LOT_W = 380, LOT_H = 300, PATH = 120, EDGE = 170, TOP = 440, COLS = LAND.perRow;
const ROWS = Math.ceil(LAND.maxPlots / COLS);
export const MAP_W = EDGE * 2 + PATH + COLS * (LOT_W + PATH) - PATH;
export const MAP_H = TOP + ROWS * (LOT_H + PATH) + EDGE - 40;
const HOUSE = { x: MAP_W / 2 - 170, y: 110, w: 340, h: 210 };
const DAY_LENGTH = 480; // seconds for a full day and night cycle

export function lotRect(i) {
  const c = i % COLS, r = Math.floor(i / COLS);
  return { x: EDGE + PATH / 2 + c * (LOT_W + PATH), y: TOP + r * (LOT_H + PATH), w: LOT_W, h: LOT_H };
}
const gateSpot = i => { const r = lotRect(i); return { x: r.x + r.w / 2, y: r.y + r.h + 34 }; };

// ---------- helpers ----------
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const hash = str => { let h = 9; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return h || 1; };
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function fs(c, col) { c.fillStyle = col; c.fill(); c.stroke(); }
const inRect = (x, y, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- static scenery ----------
const scenery = [];
const flowers = [];
(function buildScenery() {
  const R = rng(4242);
  // Forest border
  for (let x = 20; x < MAP_W; x += 70 + R() * 40) { scenery.push({ type: R() < 0.5 ? 'gum' : 'tree', x, y: 40 + R() * 40, s: 0.9 + R() * 0.5 }); scenery.push({ type: R() < 0.5 ? 'gum' : 'tree', x: x + 20, y: MAP_H - 30 - R() * 70, s: 0.9 + R() * 0.5 }); }
  for (let y = 120; y < MAP_H - 80; y += 70 + R() * 40) {
    scenery.push({ type: R() < 0.5 ? 'gum' : 'tree', x: 30 + R() * (EDGE - 80), y, s: 0.9 + R() * 0.5 });
    scenery.push({ type: R() < 0.5 ? 'gum' : 'tree', x: MAP_W - 30 - R() * (EDGE - 80), y: y + 30, s: 0.9 + R() * 0.5 });
    if (R() < 0.5) scenery.push({ type: 'bush', x: EDGE - 20 + R() * 20, y: y + 40, s: 0.8 + R() * 0.4 });
    if (R() < 0.5) scenery.push({ type: 'bush', x: MAP_W - EDGE + R() * 20, y: y + 10, s: 0.8 + R() * 0.4 });
  }
  // Lamps at path crossings
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) {
    const x = EDGE + PATH / 2 + c * (LOT_W + PATH) - PATH / 2, y = TOP + r * (LOT_H + PATH) - PATH / 2;
    if ((r + c) % 2 === 0) scenery.push({ type: 'lamp', x: x + 40, y: y - 30 });
  }
  scenery.push({ type: 'mailbox', x: HOUSE.x - 40, y: HOUSE.y + HOUSE.h + 20 });
  scenery.push({ type: 'tree', x: HOUSE.x - 110, y: HOUSE.y + 150, s: 1.3 });
  scenery.push({ type: 'gum', x: HOUSE.x + HOUSE.w + 110, y: HOUSE.y + 140, s: 1.4 });
  for (let i = 0; i < 260; i++) {
    const x = EDGE + R() * (MAP_W - EDGE * 2), y = 60 + R() * (MAP_H - 120);
    flowers.push({ x, y, k: Math.floor(R() * 5), s: 0.7 + R() * 0.6 });
  }
})();

// Grass texture tile
let grassPattern = null;
function grass(c) {
  if (grassPattern) return grassPattern;
  const cv = document.createElement('canvas'); cv.width = cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#6bb552'; g.fillRect(0, 0, 192, 192);
  const R = rng(77);
  for (let i = 0; i < 260; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(20,60,10,.08)'; ell(g, R() * 192, R() * 192, 2 + R() * 7, 1 + R() * 3); g.fill(); }
  g.strokeStyle = 'rgba(40,90,20,.35)'; g.lineWidth = 1.2;
  for (let i = 0; i < 90; i++) { const x = R() * 192, y = R() * 192; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1.5, y - 4); g.moveTo(x + 2, y); g.lineTo(x + 3, y - 5); g.stroke(); }
  grassPattern = c.createPattern(cv, 'repeat');
  return grassPattern;
}

// ---------- pathfinding grid ----------
const CELL = 30;
const GW = Math.ceil(MAP_W / CELL), GH = Math.ceil(MAP_H / CELL);
const walk = (x, y) => {
  if (x < EDGE - 30 || x > MAP_W - EDGE + 30 || y < 70 || y > MAP_H - 90) return false;
  if (inRect(x, y, HOUSE, 6)) return false;
  for (let i = 0; i < LAND.maxPlots; i++) if (inRect(x, y, lotRect(i), 8)) return false;
  return true;
};
const grid = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) grid[gy * GW + gx] = walk(gx * CELL + CELL / 2, gy * CELL + CELL / 2) ? 1 : 0;

function findPath(sx, sy, tx, ty) {
  const s = [Math.floor(sx / CELL), Math.floor(sy / CELL)], t = [Math.floor(tx / CELL), Math.floor(ty / CELL)];
  const idx = (x, y) => y * GW + x;
  const ok = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && grid[idx(x, y)];
  if (!ok(...t)) return null;
  const open = [[s[0], s[1], 0, 0]], came = new Map(), g = new Map([[idx(...s), 0]]);
  const hf = (x, y) => Math.abs(x - t[0]) + Math.abs(y - t[1]);
  let guard = 0;
  while (open.length && guard++ < 6000) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][3] < open[bi][3]) bi = i;
    const [x, y] = open.splice(bi, 1)[0];
    if (x === t[0] && y === t[1]) {
      const pts = []; let k = idx(x, y);
      while (came.has(k)) { pts.push([(k % GW) * CELL + CELL / 2, Math.floor(k / GW) * CELL + CELL / 2]); k = came.get(k); }
      pts.reverse(); pts.push([tx, ty]);
      return smooth([[sx, sy], ...pts]).slice(1);
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!ok(nx, ny) || (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy)))) continue;
      const ng = g.get(idx(x, y)) + (dx && dy ? 1.414 : 1);
      if (ng < (g.get(idx(nx, ny)) ?? Infinity)) { g.set(idx(nx, ny), ng); came.set(idx(nx, ny), idx(x, y)); open.push([nx, ny, ng, ng + hf(nx, ny)]); }
    }
  }
  return null;
}
function clearLine(a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 12);
  for (let i = 1; i < n; i++) if (!walk(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n))) return false;
  return true;
}
function smooth(pts) {
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clearLine(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
  return out;
}

// ---------- enclosure layouts ----------
function layout(i, group) {
  const r = lotRect(i);
  const inner = { x: r.x + 34, y: r.y + 78, w: r.w - 68, h: r.h - 112 };
  const L = { inner, bowl: { x: r.x + r.w - 78, y: r.y + r.h - 44 }, water: { x: r.x + r.w - 122, y: r.y + r.h - 40 }, perches: [], props: [] };
  const P = (type, x, y, extra = {}) => L.props.push({ type, x: r.x + x, y: r.y + y, ...extra });
  switch (group) {
    case 'kennel': P('doghouse', 70, 112); P('doghouse', 310, 112, { colour: '#3f7fd0' }); P('ball', 200, 190); P('bone', 120, 240); P('tyre', 285, 230); break;
    case 'cattery': P('cattree', 80, 140); P('cattree', 316, 132); P('cushion', 200, 120); P('yarn', 150, 235); P('box', 280, 235); break;
    case 'aviary':
      L.perches = [[90, 170, 70], [190, 135, 92], [290, 175, 66], [130, 250, 42], [255, 250, 46], [200, 220, 120]].map(([x, y, z]) => ({ x: r.x + x, y: r.y + y, z }));
      P('birdbath', 200, 268); break;
    case 'hutch': P('hutchbox', 78, 120); P('hutchbox', 310, 122); P('tunnel', 200, 205); P('hay', 115, 245); P('carrots', 290, 242); break;
    case 'terrarium': P('rock', 90, 140, { s: 1.3 }); P('log', 270, 150); P('cactus', 330, 230); P('lamp', 200, 104); P('rock', 150, 240); P('dish', 250, 244); break;
    case 'pond': P('lily', 140, 150); P('lily', 260, 210); P('lily', 230, 135); P('reeds', 60, 230); P('reeds', 330, 120); P('rock', 300, 250, { s: 0.9 }); break;
    case 'paddock': P('barn', 300, 112); P('haybale', 90, 128); P('haybale', 130, 140); P('trough', 200, 250); break;
    case 'sanctuary':
      L.perches = [[80, 160, 46], [310, 150, 52]].map(([x, y, z]) => ({ x: r.x + x, y: r.y + y, z }));
      P('gumtree', 80, 160); P('gumtree', 310, 150); P('log', 200, 230); P('rock', 140, 120); P('pool', 260, 250); break;
  }
  if (group === 'pond') L.water = { cx: r.x + r.w / 2, cy: r.y + r.h / 2 + 18, rx: r.w / 2 - 40, ry: r.h / 2 - 58 };
  return L;
}

// ---------- the world ----------
export function createWorld(canvas, hooks) {
  const c = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, running = false, last = 0, time = 0;
  let zoomMul = 1;
  const cam = { x: MAP_W / 2, y: HOUSE.y + HOUSE.h + 140 };
  const player = { x: MAP_W / 2, y: HOUSE.y + HOUSE.h + 70, facing: 1, moving: false, path: [], pending: null, phase: 0 };
  const agents = new Map();
  const keys = new Set();
  const particles = [];
  let joy = null, pinch = null, prompt = null, foxAgent = null;
  const layouts = new Map();
  const getLayout = (i, g) => { const k = i + g; if (!layouts.has(k)) layouts.set(k, layout(i, g)); return layouts.get(k); };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  const zoom = () => Math.max(0.3, Math.min(2.2, Math.min(W / 640, H / 720) * zoomMul));
  const toWorld = (sx, sy) => { const z = zoom(); return { x: (sx - W / 2) / z + cam.x, y: (sy - H / 2) / z + cam.y }; };

  // ----- agents -----
  function planOf(a) { return ART[a.species]?.plan; }
  function agentFor(a) {
    let g = agents.get(a.id);
    const home = a.home;
    if (!g || g.home !== home) {
      const p = S().plots[home];
      if (!p || p.kind !== 'habitat') { agents.delete(a.id); return null; }
      const L = getLayout(home, p.group);
      const pt = randomPoint(L, a);
      g = { id: a.id, home, x: pt.x, y: pt.y, z: 0, tx: pt.x, ty: pt.y, tz: 0, mode: 'idle', until: 0, facing: Math.random() < 0.5 ? 1 : -1, t0: Math.random() * 10, perch: null };
      agents.set(a.id, g);
    }
    return g;
  }
  function randomPoint(L, a) {
    if (L.water && ['fish', 'axolotl'].includes(planOf(a)) || (L.water && a.species === 'seaturtle')) {
      const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * 0.85;
      return { x: L.water.cx + Math.cos(ang) * L.water.rx * rad, y: L.water.cy + Math.sin(ang) * L.water.ry * rad };
    }
    const r = L.inner;
    return { x: r.x + Math.random() * r.w, y: r.y + Math.random() * r.h };
  }
  const S = () => E.S;

  function speedOf(a, mode) {
    const A = ART[a.species];
    const base = { quad: 34 + (A.leg || 8) * 1.2, turtle: 9, lizard: 22, snake: 13, blob: 24, fish: 26, axolotl: 16, biped: 46, sitter: 10, bird: 18 }[A.plan] || 25;
    if (mode === 'fly') return 90;
    if (mode === 'play') return base * 1.5;
    return base * (E.isAdult(a) ? 1 : 0.8);
  }

  function decide(a, g, L, night) {
    const now = Date.now();
    const plan = planOf(a);
    const swimmer = L.water && (plan === 'fish' || plan === 'axolotl' || a.species === 'seaturtle');
    const flyer = plan === 'bird' && a.species !== 'peacock' && L.perches.length && SPECIES[a.species].group === 'aviary';
    const set = (mode, secs, target) => { g.mode = mode; g.until = time + secs; if (target) { g.tx = target.x; g.ty = target.y; g.tz = target.z || 0; } };
    g.perch = null;
    if (swimmer) return set('swim', 2 + Math.random() * 4, randomPoint(L, a));
    if (a.sick) return set('sick', 6);
    if (a.breeding) {
      const p = E.S.animals[a.breeding.partner], pg = p && agents.get(p.id);
      if (pg) return set('love', 3, { x: pg.x + (a.breeding.mate ? -22 : 22), y: pg.y + 2, z: 0 });
      return set('love', 3);
    }
    const mum = !E.isAdult(a) && Object.values(E.S.animals).find(m => m.home === a.home && m.sex === 'f' && m.species === a.species && E.isAdult(m));
    if (a.hunger < 30 && Math.random() < 0.7) return set('eat', 4 + Math.random() * 3, { x: L.bowl.x - 14 + Math.random() * 28, y: L.bowl.y - 14 });
    const sleepy = night ? 0.5 : (a.restUntil > now ? 0.4 : 0.1) + (a.happy < 35 ? 0.15 : 0);
    const roll = Math.random();
    if (roll < sleepy) return set('sleep', 6 + Math.random() * 10);
    if (flyer) {
      const r2 = Math.random();
      if (r2 < 0.45) { const p = L.perches[Math.floor(Math.random() * L.perches.length)]; g.perchTarget = p; return set('fly', 8, { x: p.x + (Math.random() - 0.5) * 30, y: p.y, z: p.z }); }
      if (r2 < 0.6) return set('fly', 6, { x: L.inner.x + Math.random() * L.inner.w, y: L.inner.y + Math.random() * L.inner.h, z: 50 + Math.random() * 70 });
      if (r2 < 0.8) return set('walk', 5, { ...randomPoint(L, a), z: 0 });
      return set(a.happy > 60 ? 'play' : 'idle', 3 + Math.random() * 2);
    }
    if (mum) { const mg = agents.get(mum.id); if (mg && Math.random() < 0.6) return set('walk', 3, { x: mg.x - 18 * mg.facing + (Math.random() - 0.5) * 14, y: mg.y + 6 }); }
    if (roll < sleepy + (a.happy > 65 ? 0.22 : 0.08)) return set('play', 2 + Math.random() * 2.5, Math.random() < 0.5 ? randomPoint(L, a) : null);
    if (roll < 0.65) return set('walk', 4 + Math.random() * 4, randomPoint(L, a));
    if (L.perches.length && plan === 'sitter' && Math.random() < 0.5) { const p = L.perches[Math.floor(Math.random() * L.perches.length)]; return set('climb', 10, { x: p.x, y: p.y + 2, z: p.z }); }
    return set('idle', 2 + Math.random() * 3);
  }

  function updateAgents(dt, night) {
    const alive = new Set();
    for (const a of Object.values(S().animals)) {
      if (a.home < 0) continue;
      const g = agentFor(a);
      if (!g) continue;
      alive.add(a.id);
      const p = S().plots[a.home];
      const L = getLayout(a.home, p.group);
      if (time > g.until) decide(a, g, L, night);
      const moving = ['walk', 'play', 'eat', 'love', 'fly', 'swim', 'climb'].includes(g.mode);
      if (moving) {
        const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy);
        const sp = speedOf(a, g.mode) * dt;
        if (d > 2) {
          g.x += (dx / d) * Math.min(sp, d); g.y += (dy / d) * Math.min(sp, d);
          if (Math.abs(dx) > 1) g.facing = dx > 0 ? 1 : -1;
          g.arrived = false;
        } else g.arrived = true;
        if (g.mode === 'fly' || g.mode === 'climb') g.z = lerp(g.z, g.arrived ? g.tz : Math.max(g.tz, g.mode === 'fly' ? 60 : g.tz), Math.min(1, dt * 3));
        if (g.mode === 'fly' && g.arrived && g.perchTarget) { g.mode = 'perch'; g.until = time + 4 + Math.random() * 8; g.perchTarget = null; }
      } else if (g.mode !== 'perch' && g.mode !== 'climbed') g.z = Math.max(0, g.z - dt * 120);
      if (g.mode === 'climb' && g.arrived) { g.mode = 'climbed'; g.until = time + 6 + Math.random() * 10; }
      // keep inside the enclosure
      const r = L.inner;
      if (!L.water || !(planOf(a) === 'fish' || planOf(a) === 'axolotl' || a.species === 'seaturtle')) { g.x = Math.max(r.x, Math.min(r.x + r.w, g.x)); g.y = Math.max(r.y, Math.min(r.y + r.h, g.y)); }
    }
    for (const id of agents.keys()) if (!alive.has(id)) agents.delete(id);
  }

  function poseOf(a, g) {
    switch (g.mode) {
      case 'walk': case 'love': return g.arrived ? 'idle' : 'walk';
      case 'play': return 'play';
      case 'eat': return g.arrived ? 'eat' : 'walk';
      case 'sleep': case 'sick': return 'sleep';
      case 'fly': return g.z > 6 && !g.arrived ? 'fly' : 'idle';
      case 'swim': return 'walk';
      case 'climb': return g.arrived ? 'idle' : 'walk';
      default: return 'idle';
    }
  }

  // ----- player -----
  function walkTo(x, y, pending) {
    const path = findPath(player.x, player.y, x, y);
    if (!path) {
      // Try the nearest walkable point around the target
      for (let rad = 20; rad < 160; rad += 20) for (let k = 0; k < 8; k++) {
        const nx = x + Math.cos(k / 8 * Math.PI * 2) * rad, ny = y + Math.sin(k / 8 * Math.PI * 2) * rad;
        if (walk(nx, ny)) { const p2 = findPath(player.x, player.y, nx, ny); if (p2) { player.path = p2; player.pending = pending; return; } }
      }
      return;
    }
    player.path = path; player.pending = pending;
    addParticle('target', x, y);
  }

  function updatePlayer(dt) {
    let vx = 0, vy = 0;
    if (keys.has('arrowleft') || keys.has('a')) vx -= 1;
    if (keys.has('arrowright') || keys.has('d')) vx += 1;
    if (keys.has('arrowup') || keys.has('w')) vy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) vy += 1;
    if (joy && joy.active) { vx = joy.dx; vy = joy.dy; }
    const speed = 240;
    if (vx || vy) {
      player.path = []; player.pending = null;
      const m = Math.hypot(vx, vy); vx /= Math.max(1, m); vy /= Math.max(1, m);
      const nx = player.x + vx * speed * dt, ny = player.y + vy * speed * dt;
      if (walk(nx, player.y)) player.x = nx;
      if (walk(player.x, ny)) player.y = ny;
      if (Math.abs(vx) > 0.1) player.facing = vx > 0 ? 1 : -1;
      player.moving = true;
    } else if (player.path.length) {
      const [tx, ty] = player.path[0];
      const dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy);
      if (d < 6) { player.path.shift(); if (!player.path.length && player.pending) { const fn = player.pending; player.pending = null; fn(); } }
      else { const st = Math.min(d, speed * dt); player.x += dx / d * st; player.y += dy / d * st; if (Math.abs(dx) > 1) player.facing = dx > 0 ? 1 : -1; }
      player.moving = true;
    } else player.moving = false;
    if (player.moving) player.phase += dt * 11;
    // camera follow
    const z = zoom();
    const hw = W / 2 / z, hh = H / 2 / z;
    const tx = Math.max(hw, Math.min(MAP_W - hw, player.x)), ty = Math.max(hh, Math.min(MAP_H - hh, player.y - 30));
    cam.x = lerp(cam.x, MAP_W < hw * 2 ? MAP_W / 2 : tx, Math.min(1, dt * 6));
    cam.y = lerp(cam.y, MAP_H < hh * 2 ? MAP_H / 2 : ty, Math.min(1, dt * 6));
    updatePrompt();
  }

  function interactables() {
    const list = [];
    for (let i = 0; i < LAND.maxPlots; i++) {
      const p = S().plots[i], spot = gateSpot(i);
      let label, act;
      if (i >= S().plotsOwned) {
        if (i < S().plotsOwned + COLS && E.landCost() != null) { label = `Buy land (${E.fmt(E.landCost())} coins)`; act = () => hooks.buyLand(); }
        else continue;
      } else if (!p) { label = 'Build here'; act = () => hooks.build(i); }
      else if (p.building) { label = 'Under construction'; act = () => hooks.rushBuild(i); }
      else if (p.kind === 'habitat') { label = `Open ${GROUPS[p.group].name}`; act = () => hooks.habitat(i); }
      else { label = p.type === 'feedmill' && p.stock >= 1 ? `Collect ${Math.floor(p.stock)} feed` : `Open ${BUILDINGS[p.type].name}`; act = () => (p.type === 'feedmill' && p.stock >= 1 ? hooks.collect(i) : hooks.building(i)); }
      list.push({ x: spot.x, y: spot.y, label, act, i });
    }
    list.push({ x: HOUSE.x + HOUSE.w / 2, y: HOUSE.y + HOUSE.h + 30, label: 'Farm office', act: () => hooks.house() });
    return list;
  }
  function updatePrompt() {
    let best = null, bd = 90;
    for (const it of interactables()) { const d = Math.hypot(it.x - player.x, it.y - player.y); if (d < bd) { bd = d; best = it; } }
    if ((best && best.label) !== (prompt && prompt.label)) hooks.prompt(best ? best.label : null);
    prompt = best;
  }
  const interact = () => { if (prompt) prompt.act(); };

  // ----- input -----
  function onTap(sx, sy) {
    const w = toWorld(sx, sy);
    // The fox during a fox event
    if (foxAgent && Math.hypot(w.x - foxAgent.x, w.y - 12 - foxAgent.y) < 40) { E.eventAction(); addParticle('poof', foxAgent.x, foxAgent.y - 10); return; }
    // Animals (topmost first)
    let hit = null;
    for (const a of Object.values(S().animals)) {
      const g = agents.get(a.id); if (!g) continue;
      const b = artBounds(a.species), sc = E.isAdult(a) ? 1 : 0.6;
      const hw = Math.max(22, b.w * sc * 0.5), hh = Math.max(26, b.h * sc);
      if (Math.abs(w.x - g.x) < hw && w.y < g.y - g.z + 6 && w.y > g.y - g.z - hh) if (!hit || g.y > hit.g.y) hit = { a, g };
    }
    if (hit) { hooks.animal(hit.a.id); return; }
    // Mill bubble
    for (let i = 0; i < S().plotsOwned; i++) {
      const p = S().plots[i]; if (!p || p.kind !== 'building' || p.type !== 'feedmill' || p.building || p.stock < 1) continue;
      const r = lotRect(i); if (Math.hypot(w.x - (r.x + r.w / 2), w.y - (r.y + 40)) < 40) { hooks.collect(i); addParticle('poof', r.x + r.w / 2, r.y + 40); return; }
    }
    // Lots and the house
    for (const it of interactables()) {
      const inLot = it.i != null ? inRect(w.x, w.y, lotRect(it.i), 10) : inRect(w.x, w.y, HOUSE, 10);
      if (inLot || Math.hypot(w.x - it.x, w.y - it.y) < 40) {
        if (Math.hypot(player.x - it.x, player.y - it.y) < 60) it.act();
        else walkTo(it.x, it.y, it.act);
        return;
      }
    }
    walkTo(w.x, w.y, null);
  }

  const pointers = new Map();
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, t: performance.now() });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoomMul }; joy = null; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    p.x = e.offsetX; p.y = e.offsetY;
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; zoomMul = Math.max(0.45, Math.min(2, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); return; }
    const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy);
    if (d > 14 || (joy && joy.active)) { const m = Math.min(1, d / 60); joy = { active: true, ox: p.sx, oy: p.sy, dx: d ? dx / d * m : 0, dy: d ? dy / d * m : 0 }; }
  });
  const end = e => {
    const p = pointers.get(e.pointerId); pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (p && !(joy && joy.active) && performance.now() - p.t < 600) onTap(p.x, p.y);
    joy = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); joy = null; pinch = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomMul = Math.max(0.45, Math.min(2, zoomMul * (e.deltaY > 0 ? 0.9 : 1.1))); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (!running || (e.target && e.target.matches && e.target.matches('input, textarea')) || hooks.modalOpen()) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); e.preventDefault(); }
    if (k === 'e' || k === ' ' || k === 'enter') { interact(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // ----- particles -----
  function addParticle(type, x, y) {
    if (type === 'target') particles.push({ type, x, y, t: 0, life: 0.6 });
    if (type === 'poof') for (let i = 0; i < 10; i++) particles.push({ type: 'dust', x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 90, t: 0, life: 0.7 });
    if (type === 'heart') particles.push({ type, x, y, t: 0, life: 1.6, vx: (Math.random() - 0.5) * 10 });
    if (type === 'note') particles.push({ type, x, y, t: 0, life: 1.4, vx: (Math.random() - 0.5) * 10 });
  }

  // ---------- drawing ----------
  function drawGround(view) {
    c.fillStyle = grass(c); c.fillRect(view.x, view.y, view.w, view.h);
    // forest floor at edges
    c.fillStyle = 'rgba(40,80,25,.35)';
    c.fillRect(0, 0, EDGE - 40, MAP_H); c.fillRect(MAP_W - EDGE + 40, 0, EDGE, MAP_H); c.fillRect(0, MAP_H - 100, MAP_W, 100);
    // dirt paths
    c.fillStyle = '#d8b878';
    const band = 74;
    for (let r = 0; r <= ROWS; r++) { const y = TOP + r * (LOT_H + PATH) - PATH / 2; rr(c, EDGE - 10, y - band / 2, MAP_W - EDGE * 2 + 20, band, 30); c.fill(); }
    for (let col = 0; col <= COLS; col++) { const x = EDGE + PATH / 2 + col * (LOT_W + PATH) - PATH / 2; rr(c, x - band / 2, TOP - PATH / 2 - 30, band, ROWS * (LOT_H + PATH) + 30, 30); c.fill(); }
    rr(c, MAP_W / 2 - 120, HOUSE.y + HOUSE.h - 10, 240, TOP - HOUSE.y - HOUSE.h - 10, 40); c.fill();
    c.fillStyle = 'rgba(150,110,50,.25)';
    const R = rng(11);
    for (let i = 0; i < 400; i++) { const x = EDGE + R() * (MAP_W - EDGE * 2), y = TOP - 100 + R() * (MAP_H - TOP); if (x > view.x - 10 && x < view.x + view.w + 10 && y > view.y - 10 && y < view.y + view.h + 10) { ell(c, x, y, 2 + R() * 3, 1.2 + R() * 1.5); c.fill(); } }
    // flowers
    for (const f of flowers) {
      if (f.x < view.x - 10 || f.x > view.x + view.w + 10 || f.y < view.y - 10 || f.y > view.y + view.h + 10) continue;
      let onLot = false; for (let i = 0; i < LAND.maxPlots; i++) if (inRect(f.x, f.y, lotRect(i), 4)) { onLot = true; break; }
      if (onLot || inRect(f.x, f.y, HOUSE, 10)) continue;
      const col = ['#ffffff', '#ffd23f', '#ff8fb0', '#b98cff', '#ff6b4a'][f.k];
      c.fillStyle = '#4a8f36'; c.fillRect(f.x - 0.6, f.y - 5 * f.s, 1.2, 5 * f.s);
      for (let k = 0; k < 5; k++) { ell(c, f.x + Math.cos(k * 1.26) * 2.2 * f.s, f.y - 6 * f.s + Math.sin(k * 1.26) * 2.2 * f.s, 1.6 * f.s, 1.6 * f.s); c.fillStyle = col; c.fill(); }
      ell(c, f.x, f.y - 6 * f.s, 1.2 * f.s, 1.2 * f.s); c.fillStyle = '#f2a922'; c.fill();
    }
  }

  function drawTree(o) {
    const s = o.s || 1;
    c.save(); c.translate(o.x, o.y); c.scale(s, s);
    ell(c, 0, 0, 26, 7); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2;
    if (o.type === 'gum') {
      c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(-3, -30, -8, -60); c.lineTo(4, -60); c.quadraticCurveTo(2, -30, 6, 0); c.closePath(); fs(c, '#e8e0d0');
      c.fillStyle = 'rgba(140,120,90,.4)'; c.fillRect(-3, -40, 4, 8); c.fillRect(0, -20, 3, 6);
      [[-18, -64, 20], [10, -72, 22], [-4, -88, 20], [18, -56, 15], [-24, -50, 14]].forEach(([x, y, r]) => { ell(c, x, y, r, r * 0.75); fs(c, '#5f9a5a'); });
      [[-10, -76, 12], [8, -84, 10]].forEach(([x, y, r]) => { ell(c, x, y, r, r * 0.6); c.fillStyle = '#7cb874'; c.fill(); });
    } else if (o.type === 'tree') {
      rr(c, -6, -34, 12, 34, 4); fs(c, '#8a5a2e');
      [[0, -62, 30], [-20, -46, 20], [20, -46, 20]].forEach(([x, y, r]) => { ell(c, x, y, r, r * 0.9); fs(c, '#3f8f3a'); });
      [[-8, -70, 12], [10, -56, 9]].forEach(([x, y, r]) => { ell(c, x, y, r, r * 0.8); c.fillStyle = '#5fb04f'; c.fill(); });
    } else if (o.type === 'bush') {
      [[-10, -10, 12], [8, -12, 13], [0, -20, 12]].forEach(([x, y, r]) => { ell(c, x, y, r, r * 0.85); fs(c, '#4a9a3e'); });
      c.fillStyle = '#ff6b8a'; [[-6, -16], [6, -20], [10, -8]].forEach(([x, y]) => { ell(c, x, y, 2, 2); c.fill(); });
    } else if (o.type === 'lamp') {
      c.fillStyle = '#3a3a3a'; c.fillRect(-2, -54, 4, 54); rr(c, -7, -66, 14, 14, 3); fs(c, night > 0.3 ? '#ffe9a0' : '#f6f0d8');
    } else if (o.type === 'mailbox') {
      c.fillStyle = '#6b4a2e'; c.fillRect(-2, -26, 4, 26); rr(c, -10, -38, 20, 14, 6); fs(c, '#d9534f');
    }
    c.restore();
  }

  function drawHouse() {
    const h = HOUSE;
    c.save(); c.strokeStyle = OUT; c.lineWidth = 2.5;
    ell(c, h.x + h.w / 2, h.y + h.h, h.w * 0.55, 18); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
    rr(c, h.x + 20, h.y + 70, h.w - 40, h.h - 70, 6); fs(c, '#f4e6c8');
    c.fillStyle = 'rgba(160,110,60,.25)'; for (let y = h.y + 84; y < h.y + h.h; y += 14) c.fillRect(h.x + 22, y, h.w - 44, 2);
    c.beginPath(); c.moveTo(h.x, h.y + 82); c.lineTo(h.x + h.w / 2, h.y); c.lineTo(h.x + h.w, h.y + 82); c.closePath(); fs(c, '#c8483a');
    c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(h.x + i * h.w / 12, h.y + 82 - i * 82 / 6); c.lineTo(h.x + h.w - i * h.w / 12, h.y + 82 - i * 82 / 6); c.lineTo(h.x + h.w - i * h.w / 12, h.y + 84 - i * 82 / 6); c.lineTo(h.x + i * h.w / 12, h.y + 84 - i * 82 / 6); c.fill(); }
    rr(c, h.x + h.w - 90, h.y + 10, 26, 46, 3); fs(c, '#9a4a3a');
    rr(c, h.x + h.w / 2 - 24, h.y + h.h - 70, 48, 70, 4); fs(c, '#8a5a2e');
    ell(c, h.x + h.w / 2 + 14, h.y + h.h - 36, 3, 3); c.fillStyle = '#ffd23f'; c.fill();
    const lit = night > 0.3 ? '#ffe28a' : '#bfe6ff';
    [[h.x + 60, h.y + 110], [h.x + h.w - 120, h.y + 110]].forEach(([x, y]) => { rr(c, x, y, 60, 46, 4); fs(c, lit); c.beginPath(); c.moveTo(x + 30, y); c.lineTo(x + 30, y + 46); c.moveTo(x, y + 23); c.lineTo(x + 60, y + 23); c.stroke(); });
    rr(c, h.x + h.w / 2 - 80, h.y + 40, 160, 30, 8); fs(c, '#a86f3d');
    c.fillStyle = '#fff6dc'; c.font = '600 20px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText('NUGGS FARM', h.x + h.w / 2, h.y + 62);
    if (E.eventActive('festival')) { const cols = ['#ff5f6d', '#ffd23f', '#4fd1c5', '#b98cff']; for (let i = 0; i < 14; i++) { c.beginPath(); const x = h.x - 30 + i * 30; c.moveTo(x, h.y + h.h + 4); c.lineTo(x + 15, h.y + h.h + 24); c.lineTo(x + 30, h.y + h.h + 4); c.fillStyle = cols[i % 4]; c.fill(); } }
    c.restore();
  }

  function fence(x1, y1, x2, y2, style) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), n = Math.max(1, Math.round(len / 34));
    c.save(); c.strokeStyle = OUT; c.lineWidth = 2;
    if (style === 'glass') {
      c.fillStyle = 'rgba(190,230,255,.35)';
      if (dy === 0) { rr(c, x1, y1 - 34, dx, 34, 3); c.fill(); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.moveTo(x1 + 10, y1 - 28); c.lineTo(x1 + 40, y1 - 28); c.stroke(); }
      else { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x2, y2 - 34); c.lineTo(x1, y1 - 34); c.closePath(); c.fill(); c.stroke(); }
      c.restore(); return;
    }
    if (style === 'rocks') {
      const R = rng(hash(x1 + ',' + y1));
      for (let i = 0; i <= n * 2; i++) { const t = i / (n * 2); ell(c, x1 + dx * t, y1 + dy * t - 5, 10 + R() * 6, 7 + R() * 3); fs(c, R() < 0.5 ? '#9a9a8a' : '#b0ac98'); }
      c.restore(); return;
    }
    const rail = style === 'picket' ? '#fbfbf5' : style === 'mesh' ? '#6a6a6a' : '#b07a45';
    const post = style === 'picket' ? '#ffffff' : style === 'mesh' ? '#555' : '#8a5a2e';
    const hgt = style === 'mesh' ? 34 : 26;
    for (const off of [-hgt * 0.75, -hgt * 0.3]) { c.beginPath(); c.moveTo(x1, y1 + off); c.lineTo(x2, y2 + off); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 3.5; c.strokeStyle = rail; c.stroke(); }
    c.lineWidth = 2; c.strokeStyle = OUT;
    for (let i = 0; i <= n; i++) {
      const x = x1 + dx * i / n, y = y1 + dy * i / n;
      if (style === 'picket') { c.beginPath(); c.moveTo(x - 3.5, y); c.lineTo(x - 3.5, y - hgt); c.lineTo(x, y - hgt - 5); c.lineTo(x + 3.5, y - hgt); c.lineTo(x + 3.5, y); c.closePath(); fs(c, post); }
      else { rr(c, x - 3.5, y - hgt - 4, 7, hgt + 4, 2); fs(c, post); }
    }
    c.restore();
  }

  const FLOOR = { kennel: '#c8b07c', cattery: '#e9d3ad', aviary: '#86c46a', hutch: '#e8cf7a', terrarium: '#e8d49a', pond: '#9ccf70', paddock: '#8fcf6a', sanctuary: '#62a64a' };
  const FENCE = { kennel: 'wood', cattery: 'picket', aviary: 'mesh', hutch: 'wood', terrarium: 'glass', pond: 'rocks', paddock: 'wood', sanctuary: 'wood' };

  function drawLotBack(i, p) {
    const r = lotRect(i);
    c.save(); c.strokeStyle = OUT; c.lineWidth = 2;
    if (i >= S().plotsOwned) {
      rr(c, r.x, r.y, r.w, r.h, 20); c.fillStyle = '#4f8f3a'; c.fill();
      const R = rng(i * 99 + 3);
      for (let k = 0; k < 16; k++) drawTree({ type: k % 3 ? 'bush' : 'tree', x: r.x + 30 + R() * (r.w - 60), y: r.y + 60 + R() * (r.h - 70), s: 0.6 + R() * 0.5 });
      c.restore(); return;
    }
    if (!p) {
      rr(c, r.x + 6, r.y + 6, r.w - 12, r.h - 12, 18); c.setLineDash([12, 10]); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fill();
      c.restore(); return;
    }
    if (p.kind === 'habitat') {
      const g = p.group;
      rr(c, r.x, r.y + 40, r.w, r.h - 40, 14); c.fillStyle = FLOOR[g]; c.fill();
      const R = rng(i + 7);
      if (g === 'cattery') { c.fillStyle = 'rgba(140,90,40,.18)'; for (let y = r.y + 54; y < r.y + r.h; y += 18) c.fillRect(r.x + 4, y, r.w - 8, 2); }
      if (g === 'hutch' || g === 'kennel' || g === 'terrarium') { c.fillStyle = g === 'hutch' ? 'rgba(190,150,50,.4)' : 'rgba(120,90,50,.18)'; for (let k = 0; k < 70; k++) { ell(c, r.x + 10 + R() * (r.w - 20), r.y + 50 + R() * (r.h - 60), 3 + R() * 6, 1 + R() * 1.6, R()); c.fill(); } }
      if (g === 'pond') {
        const L = getLayout(i, g);
        ell(c, L.water.cx, L.water.cy, L.water.rx + 14, L.water.ry + 12); c.fillStyle = '#e3cf98'; c.fill();
        ell(c, L.water.cx, L.water.cy, L.water.rx, L.water.ry); c.fillStyle = '#3fa8d6'; c.fill(); c.stroke();
        c.save(); ell(c, L.water.cx, L.water.cy, L.water.rx, L.water.ry); c.clip();
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2;
        for (let k = 0; k < 7; k++) { const wx = L.water.cx - L.water.rx + ((k * 61 + time * 14) % (L.water.rx * 2)), wy = L.water.cy - L.water.ry + 20 + k * 22; c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 10, wy - 4, wx + 20, wy); c.stroke(); }
        c.restore();
      }
      if (g === 'sanctuary' || g === 'paddock' || g === 'aviary') { c.fillStyle = 'rgba(30,80,20,.25)'; for (let k = 0; k < 40; k++) { const x = r.x + 10 + R() * (r.w - 20), y = r.y + 50 + R() * (r.h - 60); c.fillRect(x, y - 4, 1.5, 4); c.fillRect(x + 3, y - 5, 1.5, 5); } }
      // mess builds up as cleanliness drops
      const mess = Math.floor((100 - p.clean) / 11);
      const M = rng(i * 31 + 5);
      for (let k = 0; k < mess; k++) {
        const x = r.x + 40 + M() * (r.w - 80), y = r.y + 80 + M() * (r.h - 110);
        if (g === 'pond') { ell(c, x, y, 7, 3); c.fillStyle = 'rgba(80,120,40,.55)'; c.fill(); continue; }
        c.fillStyle = '#7a5230'; ell(c, x, y, 6, 3.5); c.fill(); c.stroke(); ell(c, x + 1, y - 3.5, 4, 2.8); c.fill(); c.stroke();
        if (p.clean < 30) { c.strokeStyle = 'rgba(80,120,40,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 2, y - 9); c.quadraticCurveTo(x, y - 14 - Math.sin(time * 3 + k) * 2, x + 2, y - 18); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2; }
      }
      // back and side fences
      const st = FENCE[g];
      fence(r.x, r.y + 46, r.x + r.w, r.y + 46, st);
      fence(r.x, r.y + 46, r.x, r.y + r.h, st);
      fence(r.x + r.w, r.y + 46, r.x + r.w, r.y + r.h, st);
      // bowls
      const L = getLayout(i, g);
      if (g !== 'pond') {
        const list = E.animalsIn(i);
        const avg = list.length ? list.reduce((t, a) => t + a.hunger, 0) / list.length : 100;
        ell(c, L.bowl.x, L.bowl.y, 15, 7); fs(c, '#d9534f'); ell(c, L.bowl.x, L.bowl.y - 2, 11, 4.5); c.fillStyle = avg > 40 ? '#a8693a' : '#5a2a20'; c.fill();
        if (avg > 40) { c.fillStyle = '#c88a4a'; for (let k = 0; k < 5; k++) { ell(c, L.bowl.x - 6 + k * 3, L.bowl.y - 4, 2, 1.5); c.fill(); } }
        ell(c, L.water.x, L.water.y, 13, 6); fs(c, '#3f7fd0'); ell(c, L.water.x, L.water.y - 2, 9, 3.5); c.fillStyle = '#9fdcff'; c.fill();
      }
    } else {
      rr(c, r.x, r.y + 30, r.w, r.h - 30, 16); c.fillStyle = p.type === 'showring' ? '#d6b98a' : '#8fc76a'; c.fill();
    }
    c.restore();
  }

  function drawProp(o, i) {
    c.save(); c.translate(o.x, o.y); c.strokeStyle = OUT; c.lineWidth = 2;
    const s = o.s || 1; c.scale(s, s);
    switch (o.type) {
      case 'doghouse': ell(c, 0, 2, 38, 8); c.fillStyle = 'rgba(0,0,0,.15)'; c.fill(); rr(c, -32, -46, 64, 46, 3); fs(c, '#d4a35a'); c.beginPath(); c.moveTo(-40, -42); c.lineTo(0, -74); c.lineTo(40, -42); c.closePath(); fs(c, o.colour || '#c8483a'); c.beginPath(); c.moveTo(-14, 0); c.lineTo(-14, -20); c.arc(0, -20, 14, Math.PI, 0); c.lineTo(14, 0); c.closePath(); fs(c, '#3a2412'); break;
      case 'ball': ell(c, 0, 0, 7, 7); fs(c, '#ff5a5f'); c.beginPath(); c.arc(0, 0, 7, -0.6, 0.6); c.strokeStyle = '#fff'; c.stroke(); break;
      case 'bone': c.fillStyle = '#fffaf0'; rr(c, -9, -3, 18, 6, 3); fs(c, '#fffaf0'); [[-9, -3], [-9, 3], [9, -3], [9, 3]].forEach(([x, y]) => { ell(c, x, y, 3.5, 3.5); fs(c, '#fffaf0'); }); break;
      case 'tyre': ell(c, 0, -4, 18, 10); fs(c, '#333'); ell(c, 0, -5, 9, 4.5); c.fillStyle = FLOOR.kennel; c.fill(); c.stroke(); break;
      case 'cattree': rr(c, -5, -70, 10, 70, 3); fs(c, '#d8c39a'); [[-24, -24, 48], [-20, -52, 40], [-16, -78, 32]].forEach(([x, y, w]) => { rr(c, x, y, w, 9, 4); fs(c, '#a87bd6'); }); ell(c, 0, -2, 22, 6); fs(c, '#a87bd6'); break;
      case 'cushion': ell(c, 0, -4, 26, 11); fs(c, '#ff8fb0'); ell(c, 0, -6, 18, 6); c.fillStyle = '#ffc0d4'; c.fill(); break;
      case 'yarn': ell(c, 0, -6, 8, 8); fs(c, '#4fd1c5'); c.beginPath(); c.arc(0, -6, 5, 0, 3); c.stroke(); c.beginPath(); c.moveTo(6, -2); c.quadraticCurveTo(16, 2, 22, -1); c.strokeStyle = '#4fd1c5'; c.stroke(); break;
      case 'box': c.beginPath(); c.moveTo(-18, 0); c.lineTo(-18, -22); c.lineTo(18, -22); c.lineTo(18, 0); c.closePath(); fs(c, '#c89a5a'); c.beginPath(); c.moveTo(-18, -22); c.lineTo(-26, -32); c.lineTo(10, -32); c.lineTo(18, -22); fs(c, '#d8aa6a'); break;
      case 'hutchbox': ell(c, 0, 2, 34, 7); c.fillStyle = 'rgba(0,0,0,.15)'; c.fill(); rr(c, -30, -40, 60, 40, 4); fs(c, '#b07a45'); rr(c, -24, -34, 20, 26, 2); fs(c, '#3a2412'); c.save(); rr(c, 2, -34, 22, 26, 2); c.fillStyle = 'rgba(200,220,230,.4)'; c.fill(); c.stroke(); c.beginPath(); for (let x = 6; x < 24; x += 5) { c.moveTo(x, -34); c.lineTo(x, -8); } c.lineWidth = 1; c.stroke(); c.restore(); c.beginPath(); c.moveTo(-36, -38); c.lineTo(0, -58); c.lineTo(36, -38); c.closePath(); fs(c, '#7a4b24'); break;
      case 'tunnel': ell(c, 0, -10, 36, 13); fs(c, '#4fa8d6'); ell(c, 34, -10, 6, 11); fs(c, '#2a1a10'); break;
      case 'hay': [[-12, -6], [10, -8], [0, -16]].forEach(([x, y]) => { ell(c, x, y, 16, 9); fs(c, '#e8c85a'); }); break;
      case 'carrots': for (let k = 0; k < 3; k++) { c.save(); c.translate(k * 9 - 9, -2); c.rotate(-0.4 + k * 0.3); c.beginPath(); c.moveTo(-3, 0); c.lineTo(0, -18); c.lineTo(3, 0); c.closePath(); fs(c, '#f2842a'); c.fillStyle = '#4a9a3e'; c.fillRect(-3, -24, 2, 6); c.fillRect(1, -24, 2, 6); c.restore(); } break;
      case 'rock': ell(c, 0, -8, 24, 14); fs(c, '#a8a090'); ell(c, -6, -14, 10, 5); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill(); break;
      case 'log': rr(c, -34, -16, 68, 16, 8); fs(c, '#8a5a2e'); ell(c, 34, -8, 6, 8); fs(c, '#d8b080'); break;
      case 'cactus': rr(c, -6, -40, 12, 40, 6); fs(c, '#4a9a3e'); rr(c, -18, -30, 9, 16, 4); fs(c, '#4a9a3e'); rr(c, 9, -36, 9, 18, 4); fs(c, '#4a9a3e'); break;
      case 'lamp': { c.fillStyle = '#555'; c.fillRect(-2, -80, 4, 80); rr(c, -14, -92, 28, 14, 5); fs(c, '#444'); const g = c.createRadialGradient(0, -60, 4, 0, -30, 90); g.addColorStop(0, 'rgba(255,180,60,.4)'); g.addColorStop(1, 'rgba(255,180,60,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(-12, -80); c.lineTo(-70, 40); c.lineTo(70, 40); c.lineTo(12, -80); c.fill(); break; }
      case 'dish': ell(c, 0, -2, 16, 7); fs(c, '#8a8a8a'); ell(c, 0, -3, 12, 4.5); c.fillStyle = '#7fd0ff'; c.fill(); break;
      case 'lily': ell(c, 0, 0, 16, 7); fs(c, '#4a9a3e'); c.beginPath(); c.moveTo(0, 0); c.lineTo(14, -3); c.lineTo(14, 3); c.closePath(); c.fillStyle = '#3fa8d6'; c.fill(); ell(c, -3, -3, 4, 3); c.fillStyle = '#ff9ac0'; c.fill(); break;
      case 'reeds': for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 4, 0); c.quadraticCurveTo(k * 6, -20, k * 5 + Math.sin(time + k) * 2, -40); c.lineWidth = 3; c.strokeStyle = '#4a8a2e'; c.stroke(); rr(c, k * 5 - 2 + Math.sin(time + k) * 2, -44, 4, 12, 2); c.fillStyle = '#7a4b24'; c.fill(); } break;
      case 'barn': ell(c, 0, 2, 50, 10); c.fillStyle = 'rgba(0,0,0,.15)'; c.fill(); rr(c, -44, -56, 88, 56, 3); fs(c, '#c8483a'); c.beginPath(); c.moveTo(-50, -52); c.lineTo(0, -84); c.lineTo(50, -52); c.closePath(); fs(c, '#8a2e24'); rr(c, -18, -36, 36, 36, 2); fs(c, '#fbfbf5'); c.beginPath(); c.moveTo(-18, -36); c.lineTo(18, 0); c.moveTo(18, -36); c.lineTo(-18, 0); c.stroke(); break;
      case 'haybale': rr(c, -20, -24, 40, 24, 6); fs(c, '#e8c85a'); c.strokeStyle = 'rgba(150,110,30,.6)'; c.beginPath(); c.moveTo(-8, -24); c.lineTo(-8, 0); c.moveTo(8, -24); c.lineTo(8, 0); c.stroke(); break;
      case 'trough': rr(c, -40, -18, 80, 18, 4); fs(c, '#8a5a2e'); rr(c, -36, -16, 72, 6, 3); c.fillStyle = '#7fd0ff'; c.fill(); break;
      case 'gumtree': c.beginPath(); c.moveTo(-7, 0); c.quadraticCurveTo(-4, -40, -9, -70); c.lineTo(6, -70); c.quadraticCurveTo(3, -40, 8, 0); c.closePath(); fs(c, '#ece4d4'); c.beginPath(); c.moveTo(0, -46); c.lineTo(26, -52); c.lineWidth = 5; c.stroke(); c.lineWidth = 2; [[-20, -84, 24], [14, -94, 26], [-2, -110, 22], [28, -70, 16]].forEach(([x, y, r]) => { ell(c, x, y, r, r * 0.7); fs(c, '#5f9a5a'); }); break;
      case 'pool': ell(c, 0, -4, 34, 13); fs(c, '#3fa8d6'); ell(c, -8, -7, 12, 3); c.fillStyle = 'rgba(255,255,255,.4)'; c.fill(); break;
      case 'birdbath': rr(c, -4, -24, 8, 24, 2); fs(c, '#c8c0b0'); ell(c, 0, -26, 20, 7); fs(c, '#c8c0b0'); ell(c, 0, -27, 15, 4.5); c.fillStyle = '#7fd0ff'; c.fill(); break;
      case 'perch': c.fillStyle = '#8a5a2e'; rr(c, -3, -o.z, 6, o.z, 2); fs(c, '#8a5a2e'); c.beginPath(); c.moveTo(-26, -o.z); c.lineTo(26, -o.z); c.lineWidth = 6; c.stroke(); c.lineWidth = 3.6; c.strokeStyle = '#a86f3d'; c.stroke(); c.fillStyle = '#5fae4a'; ell(c, -24, -o.z - 4, 6, 4); c.fill(); ell(c, 24, -o.z - 3, 6, 4); c.fill(); break;
    }
    c.restore();
    void i;
  }

  function drawFrontFence(i, p) {
    const r = lotRect(i);
    if (p.kind !== 'habitat') return;
    const st = FENCE[p.group];
    const gx = r.x + r.w / 2;
    fence(r.x, r.y + r.h, gx - 30, r.y + r.h, st);
    fence(gx + 30, r.y + r.h, r.x + r.w, r.y + r.h, st);
    // gate
    c.save(); c.strokeStyle = OUT; c.lineWidth = 2;
    if (st !== 'rocks' && st !== 'glass') { rr(c, gx - 34, r.y + r.h - 44, 8, 44, 2); fs(c, '#8a5a2e'); rr(c, gx + 26, r.y + r.h - 44, 8, 44, 2); fs(c, '#8a5a2e'); c.beginPath(); c.moveTo(gx - 30, r.y + r.h - 44); c.quadraticCurveTo(gx, r.y + r.h - 60, gx + 30, r.y + r.h - 44); c.lineWidth = 5; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#b07a45'; c.stroke(); }
    c.restore();
    // aviary mesh roof overlay
    if (p.group === 'aviary') {
      c.save(); c.strokeStyle = 'rgba(60,60,60,.35)'; c.lineWidth = 1;
      for (let x = r.x; x <= r.x + r.w; x += 16) { c.beginPath(); c.moveTo(x, r.y + 12); c.lineTo(x, r.y + r.h); c.stroke(); }
      for (let y = r.y + 12; y <= r.y + r.h; y += 16) { c.beginPath(); c.moveTo(r.x, y); c.lineTo(r.x + r.w, y); c.stroke(); }
      c.strokeStyle = OUT; c.lineWidth = 3; c.strokeRect(r.x, r.y + 12, r.w, r.h - 12);
      c.restore();
    }
  }

  function drawSign(i, p) {
    const r = lotRect(i), x = r.x + r.w / 2 + 70, y = r.y + r.h + 26;
    let title, sub, col = '#a86f3d';
    if (i >= S().plotsOwned) { if (i >= S().plotsOwned + COLS) return; title = 'FOR SALE'; sub = E.landCost() != null ? E.fmt(E.landCost()) + ' coins' : ''; col = '#c8483a'; }
    else if (!p) { title = 'BUILD HERE'; sub = 'Tap to build'; col = '#3f8f3a'; }
    else if (p.kind === 'habitat') { title = GROUPS[p.group].name.toUpperCase(); sub = `Lv ${p.lvl} · ${E.animalsIn(i).length}/${E.habitatCap(p)}`; col = GROUPS[p.group].colour; }
    else { title = BUILDINGS[p.type].name.toUpperCase(); sub = p.type === 'feedmill' ? `Lv ${p.lvl}` : ''; col = '#8d6e4f'; }
    c.save(); c.strokeStyle = OUT; c.lineWidth = 2;
    c.fillStyle = '#6b4320'; c.fillRect(x - 2, y - 30, 4, 30);
    c.font = '600 13px Fredoka, sans-serif';
    const w = Math.max(c.measureText(title).width, sub ? c.measureText(sub).width : 0) + 18;
    rr(c, x - w / 2, y - 62, w, sub ? 38 : 24, 6); fs(c, col);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(title, x, y - 45);
    if (sub) { c.font = '500 11px Nunito, sans-serif'; c.fillText(sub, x, y - 31); }
    c.restore();
  }

  function drawConstruction(i, p) {
    const r = lotRect(i);
    c.save(); c.strokeStyle = OUT; c.lineWidth = 2;
    rr(c, r.x + 10, r.y + 40, r.w - 20, r.h - 50, 12); c.fillStyle = '#cdb38a'; c.fill();
    for (let k = 0; k < 3; k++) { const x = r.x + 80 + k * 110; c.fillStyle = '#b07a45'; [[0, -10], [0, -40], [0, -70]].forEach(([, dy]) => { rr(c, x - 40, r.y + 220 + dy, 80, 8, 2); fs(c, '#d4a35a'); }); rr(c, x - 40, r.y + 150, 6, 80, 2); fs(c, '#8a5a2e'); rr(c, x + 34, r.y + 150, 6, 80, 2); fs(c, '#8a5a2e'); }
    rr(c, r.x + 40, r.y + 240, 50, 34, 3); fs(c, '#c89a5a');
    const total = (p.kind === 'habitat' ? GROUPS[p.group].build : BUILDINGS[p.type].build) * 1000;
    const pr = Math.max(0, Math.min(1, 1 - (p.building - Date.now()) / total));
    rr(c, r.x + 60, r.y + 70, r.w - 120, 16, 8); fs(c, '#fff');
    rr(c, r.x + 62, r.y + 72, (r.w - 124) * pr, 12, 6); c.fillStyle = '#ffc83d'; c.fill();
    c.fillStyle = '#2a1c10'; c.font = '600 16px Fredoka, sans-serif'; c.textAlign = 'center';
    c.fillText(`Building ${p.kind === 'habitat' ? GROUPS[p.group].name : BUILDINGS[p.type].name}  ${E.dur((p.building - Date.now()) / 1000)}`, r.x + r.w / 2, r.y + 60);
    // hammer
    c.save(); c.translate(r.x + r.w / 2 + 40, r.y + 160); c.rotate(Math.sin(time * 10) * 0.5);
    rr(c, -2, 0, 4, 26, 2); fs(c, '#8a5a2e'); rr(c, -9, -6, 18, 8, 2); fs(c, '#8d99a6'); c.restore();
    c.restore();
  }

  function drawBuilding(i, p) {
    const r = lotRect(i), cx = r.x + r.w / 2, by = r.y + r.h - 40;
    c.save(); c.strokeStyle = OUT; c.lineWidth = 2.2;
    ell(c, cx, by + 6, 130, 18); c.fillStyle = 'rgba(0,0,0,.15)'; c.fill();
    switch (p.type) {
      case 'feedmill': {
        rr(c, cx - 90, by - 120, 180, 120, 4); fs(c, '#d4a35a');
        c.beginPath(); c.moveTo(cx - 100, by - 116); c.lineTo(cx, by - 170); c.lineTo(cx + 100, by - 116); c.closePath(); fs(c, '#8a5a2e');
        rr(c, cx - 26, by - 60, 52, 60, 3); fs(c, '#6b4320');
        c.save(); c.translate(cx + 60, by - 150); c.rotate(time * (1.2 + p.lvl * 0.4)); for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); rr(c, -6, 0, 12, 70, 3); fs(c, '#fbfbf5'); } c.restore();
        ell(c, cx + 60, by - 150, 7, 7); fs(c, '#555');
        [[-70, 0], [-48, 0], [-59, -18]].forEach(([dx, dy]) => { rr(c, cx + dx - 12, by + dy - 22, 24, 22, 6); fs(c, '#e8d6b0'); });
        const stock = Math.floor(p.stock), cap = MILL.cap * p.lvl;
        if (stock >= 1) {
          const bob = Math.sin(time * 4) * 3;
          rr(c, cx - 48, r.y + 22 + bob, 96, 34, 17); fs(c, stock >= cap ? '#ffd23f' : '#ffffff');
          c.fillStyle = OUT; c.font = '700 16px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText(`${stock} feed`, cx, r.y + 45 + bob);
        }
        break; }
      case 'vet':
        rr(c, cx - 100, by - 110, 200, 110, 6); fs(c, '#fbfbf5');
        rr(c, cx - 110, by - 126, 220, 22, 6); fs(c, '#4fa8d6');
        rr(c, cx - 22, by - 100, 44, 44, 6); fs(c, '#e2574c'); c.fillStyle = '#fff'; c.fillRect(cx - 5, by - 92, 10, 28); c.fillRect(cx - 14, by - 83, 28, 10);
        rr(c, cx - 20, by - 46, 40, 46, 3); fs(c, '#bfe6ff');
        break;
      case 'showring': {
        ell(c, cx, by - 60, 150, 70); fs(c, '#e8d6a8'); ell(c, cx, by - 60, 120, 52); fs(c, '#d6b98a');
        for (let k = 0; k < 6; k++) { const a = Math.PI + k / 5 * Math.PI, x = cx + Math.cos(a) * 140, y = by - 60 + Math.sin(a) * 64; c.fillStyle = '#555'; c.fillRect(x - 1, y - 50, 2, 50); c.beginPath(); c.moveTo(x, y - 50); c.lineTo(x + 22 + Math.sin(time * 5 + k) * 4, y - 44); c.lineTo(x, y - 38); c.closePath(); fs(c, ['#ff5f6d', '#ffd23f', '#4a7ee0'][k % 3]); }
        if (S().show) { c.fillStyle = OUT; c.font = '700 15px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText(`${GROUPS[S().show.group].plural} show · ${E.dur((S().show.ends - Date.now()) / 1000)}`, cx, by - 56); }
        const entry = S().show && S().show.entry && S().animals[S().show.entry];
        if (entry) { c.save(); c.translate(cx, by - 30); drawAnimal(c, entry.species, { pose: 'idle', t: time, mut: entry.mut, scale: 1.2 }); c.restore(); }
        break; }
      case 'fountain': {
        ell(c, cx, by - 30, 90, 34); fs(c, '#c8c0b0'); ell(c, cx, by - 34, 76, 26); c.fillStyle = '#5fbde6'; c.fill();
        rr(c, cx - 10, by - 100, 20, 66, 4); fs(c, '#c8c0b0'); ell(c, cx, by - 100, 30, 10); fs(c, '#c8c0b0');
        c.strokeStyle = 'rgba(200,240,255,.9)'; c.lineWidth = 3;
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const ph = (time * 1.5 + k / 6) % 1; c.beginPath(); c.moveTo(cx, by - 108); c.quadraticCurveTo(cx + Math.cos(a) * 30, by - 140, cx + Math.cos(a) * 60, by - 40 + Math.sin(a) * 10); c.stroke(); circle(cx + Math.cos(a) * 60 * ph, by - 108 + (ph * ph * 70) - ph * 30, 2.5); }
        break; }
      case 'gazebo':
        ell(c, cx, by - 10, 110, 30); fs(c, '#e8d6b0');
        [[-80, 0], [80, 0], [-40, -14], [40, -14]].forEach(([dx]) => { rr(c, cx + dx - 5, by - 120, 10, 112, 3); fs(c, '#fbfbf5'); });
        c.beginPath(); c.moveTo(cx - 110, by - 116); c.lineTo(cx, by - 180); c.lineTo(cx + 110, by - 116); c.closePath(); fs(c, '#b07bd6');
        c.fillStyle = '#ff8fb0'; for (let k = 0; k < 9; k++) { ell(c, cx - 100 + k * 25, by - 118, 6, 6); c.fill(); }
        break;
      case 'lab':
        rr(c, cx - 100, by - 100, 200, 100, 6); fs(c, '#e6e8ee');
        ell(c, cx, by - 100, 70, 46); fs(c, '#bfe6ff');
        c.save(); c.beginPath(); c.ellipse(cx, by - 100, 70, 46, 0, Math.PI, 0); c.fillStyle = '#9fd0ef'; c.fill(); c.stroke(); c.restore();
        rr(c, cx - 70, by - 70, 40, 40, 4); fs(c, '#7fd0ff'); rr(c, cx + 30, by - 70, 40, 40, 4); fs(c, '#7fd0ff');
        for (let k = 0; k < 3; k++) { const ph = (time * 0.8 + k / 3) % 1; c.globalAlpha = 1 - ph; circle(cx + 60, by - 150 - ph * 40, 4 + ph * 6, '#c49bf2'); c.globalAlpha = 1; }
        c.fillStyle = '#9b5de5'; c.font = '700 14px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText('DNA', cx, by - 20);
        break;
    }
    c.restore();
  }
  function circle(x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (col) { c.fillStyle = col; c.fill(); } else { c.fillStyle = 'rgba(200,240,255,.9)'; c.fill(); } }

  function drawPlayer() {
    const x = player.x, y = player.y, f = player.facing, ph = player.phase;
    const sw = player.moving ? Math.sin(ph) * 0.6 : 0, bob = player.moving ? Math.abs(Math.sin(ph)) * 2 : 0;
    c.save(); c.translate(x, y);
    ell(c, 0, 0, 16, 5); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill();
    c.scale(f, 1); c.strokeStyle = OUT; c.lineWidth = 2; c.lineJoin = 'round';
    // legs
    [[-4, sw], [4, -sw]].forEach(([dx, a]) => { c.save(); c.translate(dx, -20 - bob); c.rotate(a); rr(c, -3.5, 0, 7, 20, 3); fs(c, '#3f6fc0'); rr(c, -4, 16, 10, 5, 2); fs(c, '#5a3a1e'); c.restore(); });
    // body
    rr(c, -10, -46 - bob, 20, 28, 6); fs(c, '#d9534f');
    c.save(); rr(c, -10, -46 - bob, 20, 28, 6); c.clip(); c.fillStyle = 'rgba(255,255,255,.25)'; for (let k = -10; k < 12; k += 6) c.fillRect(k, -46 - bob, 2, 30); for (let k = -46; k < -16; k += 6) c.fillRect(-10, k - bob, 20, 2); c.restore();
    rr(c, -9, -36 - bob, 18, 18, 3); fs(c, '#3f6fc0');
    c.fillStyle = '#3f6fc0'; c.fillRect(-7, -46 - bob, 3, 10); c.fillRect(4, -46 - bob, 3, 10);
    // arm
    c.save(); c.translate(2, -42 - bob); c.rotate(-sw * 0.8); rr(c, -3, 0, 6, 16, 3); fs(c, '#d9534f'); ell(c, 0, 17, 3.5, 3.5); fs(c, '#f2c29a'); c.restore();
    // head
    ell(c, 2, -56 - bob, 10, 10); fs(c, '#f2c29a');
    ell(c, 7, -57 - bob, 1.6, 2); c.fillStyle = OUT; c.fill();
    c.beginPath(); c.arc(6, -52 - bob, 3, 0.2, 2.6); c.stroke();
    // hat
    ell(c, 1, -63 - bob, 17, 4.5); fs(c, '#e8c85a');
    rr(c, -8, -76 - bob, 18, 14, 6); fs(c, '#e8c85a');
    c.fillStyle = '#c8483a'; c.fillRect(-8, -66 - bob, 18, 3);
    c.restore();
  }

  function drawIcons(a, g, x, y) {
    const t = time;
    if (a.breeding && !a.breeding.mate) {
      if (Math.random() < 0.03) addParticle('heart', x, y - 30);
      // progress ring
      const pr = Math.max(0, Math.min(1, (Date.now() - a.breeding.starts) / (a.breeding.ends - a.breeding.starts)));
      c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x, y - 52, 8, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#ec5a8a'; c.beginPath(); c.arc(x, y - 52, 8, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); c.stroke(); c.restore();
    }
    let bubble = null;
    if (a.sick) bubble = 'sick'; else if (a.hunger < 25) bubble = 'hungry'; else if (a.happy < 25) bubble = 'sad';
    if (bubble) {
      const by = y - 48 + Math.sin(t * 3) * 2;
      c.save(); c.strokeStyle = OUT; c.lineWidth = 1.8;
      rr(c, x - 11, by - 11, 22, 20, 8); fs(c, '#fff');
      c.beginPath(); c.moveTo(x - 3, by + 9); c.lineTo(x, by + 14); c.lineTo(x + 3, by + 9); c.fillStyle = '#fff'; c.fill();
      if (bubble === 'sick') { c.fillStyle = '#4b9a2a'; c.fillRect(x - 2, by - 7, 4, 12); c.fillRect(x - 6, by - 3, 12, 4); }
      if (bubble === 'hungry') { ell(c, x, by + 2, 7, 3.5); fs(c, '#d9534f'); ell(c, x, by, 5, 2); c.fillStyle = '#5a2a20'; c.fill(); }
      if (bubble === 'sad') { c.beginPath(); c.arc(x, by + 4, 4, 1.1 * Math.PI, 1.9 * Math.PI); c.stroke(); ell(c, x - 3, by - 3, 1, 1.4); c.fillStyle = OUT; c.fill(); ell(c, x + 3, by - 3, 1, 1.4); c.fill(); }
      c.restore();
    }
    if (g.mode === 'play' && Math.random() < 0.02) addParticle('note', x, y - 30);
  }

  let night = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; time += dt;
    const day = ((Date.now() / 1000) % DAY_LENGTH) / DAY_LENGTH;
    night = Math.max(0, Math.min(1, (Math.abs(day - 0.5) * 2 - 0.62) / 0.25)); // 0 by day, 1 at midnight
    updatePlayer(dt);
    updateAgents(dt, night > 0.5);
    const z = zoom();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#3d7a30'; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-cam.x, -cam.y);
    const view = { x: cam.x - W / 2 / z, y: cam.y - H / 2 / z, w: W / z, h: H / z };
    const vis = r => r.x + r.w > view.x - 60 && r.x < view.x + view.w + 60 && r.y + r.h > view.y - 140 && r.y < view.y + view.h + 140;
    drawGround(view);
    // collect sortable drawables
    const items = [];
    for (let i = 0; i < LAND.maxPlots; i++) {
      const r = lotRect(i); if (!vis(r)) continue;
      const p = i < S().plotsOwned ? S().plots[i] : null;
      drawLotBack(i, p);
      if (p && p.building) { items.push({ y: r.y + r.h - 1, fn: () => drawConstruction(i, p) }); }
      else if (p && p.kind === 'building') items.push({ y: r.y + r.h - 30, fn: () => drawBuilding(i, p) });
      else if (p && p.kind === 'habitat') {
        const L = getLayout(i, p.group);
        for (const o of L.props) items.push({ y: o.y, fn: () => drawProp(o, i) });
        for (const pc of L.perches) items.push({ y: pc.y - 1, fn: () => drawProp({ type: p.group === 'sanctuary' ? 'none' : 'perch', x: pc.x, y: pc.y, z: pc.z }, i) });
        items.push({ y: r.y + r.h + 1, fn: () => drawFrontFence(i, p) });
      }
      if (i < S().plotsOwned + COLS) items.push({ y: r.y + r.h + 27, fn: () => drawSign(i, p) });
    }
    for (const a of Object.values(S().animals)) {
      const g = agents.get(a.id); if (!g) continue;
      const r = lotRect(a.home); if (!vis(r)) continue;
      const p = S().plots[a.home];
      const swimmer = p.group === 'pond' && (ART[a.species].plan === 'fish' || ART[a.species].plan === 'axolotl' || a.species === 'seaturtle');
      const perchY = g.mode === 'perch' || g.mode === 'climbed' || g.z > 2;
      items.push({ y: perchY ? g.y + 0.5 : g.y, fn: () => {
        c.save(); c.translate(g.x, g.y - g.z);
        if (swimmer) { c.globalAlpha = 0.9; c.translate(0, 10); }
        if (g.z > 4) { c.save(); c.translate(0, g.z); ell(c, 0, 0, 10, 3); c.fillStyle = 'rgba(0,0,0,.15)'; c.fill(); c.restore(); }
        const sc = (E.isAdult(a) ? 1 : 0.6) * 1.05;
        drawAnimal(c, a.species, { pose: poseOf(a, g), t: time + g.t0, facing: g.facing, mut: a.mut, scale: sc, seed: hash(a.id), shadow: g.z < 4 && !swimmer });
        if (swimmer) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -4, 18 * sc, 4, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
        drawIcons(a, g, g.x, g.y - g.z - (artBounds(a.species).h * sc) + 26);
      } });
    }
    for (const o of scenery) if (o.x > view.x - 80 && o.x < view.x + view.w + 80 && o.y > view.y - 20 && o.y < view.y + view.h + 140) items.push({ y: o.y, fn: () => drawTree(o) });
    if (vis(HOUSE)) items.push({ y: HOUSE.y + HOUSE.h, fn: drawHouse });
    items.push({ y: player.y, fn: drawPlayer });
    // fox event
    foxAgent = null;
    if (E.eventActive('fox')) {
      const target = S().plots.findIndex(p => p && p.kind === 'habitat' && (p.group === 'aviary' || p.group === 'hutch'));
      if (target >= 0) {
        const r = lotRect(target), k = time * 0.6;
        foxAgent = { x: r.x + r.w / 2 + Math.cos(k) * (r.w / 2 + 30), y: r.y + r.h + 50 + Math.sin(k * 2) * 20, f: -Math.sin(k) >= 0 ? 1 : -1 };
        const fa = foxAgent;
        items.push({ y: fa.y, fn: () => { c.save(); c.translate(fa.x, fa.y); drawAnimal(c, 'wildfox', { pose: 'walk', t: time, facing: fa.f, scale: 1.2 }); c.restore();
          c.save(); c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 3; c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center'; c.strokeText('Tap to shoo!', fa.x, fa.y - 50); c.fillText('Tap to shoo!', fa.x, fa.y - 50); c.restore(); } });
      }
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.fn();
    // particles
    for (let k = particles.length - 1; k >= 0; k--) {
      const p = particles[k]; p.t += dt;
      if (p.t > p.life) { particles.splice(k, 1); continue; }
      const q = p.t / p.life;
      c.save(); c.globalAlpha = 1 - q;
      if (p.type === 'target') { c.strokeStyle = '#fff'; c.lineWidth = 3; ell(c, p.x, p.y, 10 + q * 14, (10 + q * 14) * 0.45); c.stroke(); }
      if (p.type === 'dust') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; ell(c, p.x, p.y, 5, 5); c.fillStyle = '#fff'; c.fill(); }
      if (p.type === 'heart' || p.type === 'note') {
        const x = p.x + Math.sin(p.t * 5) * 5 + p.vx * p.t, y = p.y - p.t * 30;
        c.fillStyle = p.type === 'heart' ? '#ff5a8a' : '#4a7ee0'; c.strokeStyle = OUT; c.lineWidth = 1.2;
        if (p.type === 'heart') { c.beginPath(); c.moveTo(x, y + 4); c.bezierCurveTo(x - 7, y - 2, x - 3, y - 7, x, y - 3); c.bezierCurveTo(x + 3, y - 7, x + 7, y - 2, x, y + 4); c.fill(); c.stroke(); }
        else { ell(c, x, y, 3, 2.4, -0.4); c.fill(); c.fillRect(x + 2, y - 10, 1.4, 10); }
      }
      c.restore();
    }
    // weather
    if (E.eventActive('storm')) {
      c.strokeStyle = 'rgba(200,220,255,.6)'; c.lineWidth = 1.5;
      for (let k = 0; k < 160; k++) { const x = view.x + ((k * 97 + time * 60) % view.w), y = view.y + ((k * 53 + time * 700) % view.h); c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 14); c.stroke(); }
    }
    if (E.eventActive('bumper') && Math.random() < 0.08) addParticle('heart', view.x + Math.random() * view.w, view.y + view.h * (0.3 + Math.random() * 0.6));
    c.restore();
    // screen tints
    if (E.eventActive('storm')) { c.fillStyle = 'rgba(40,60,90,.25)'; c.fillRect(0, 0, W, H); }
    if (E.eventActive('heatwave')) { c.fillStyle = 'rgba(255,140,40,.12)'; c.fillRect(0, 0, W, H); }
    if (night > 0) { c.fillStyle = `rgba(20,25,70,${night * 0.42})`; c.fillRect(0, 0, W, H); }
    // joystick
    if (joy && joy.active) {
      c.save(); c.globalAlpha = 0.5; c.fillStyle = '#fff';
      c.beginPath(); c.arc(joy.ox, joy.oy, 46, 0, Math.PI * 2); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke();
      c.beginPath(); c.arc(joy.ox + joy.dx * 46, joy.oy + joy.dy * 46, 20, 0, Math.PI * 2); c.fill(); c.restore();
    }
    requestAnimationFrame(frame);
  }

  return {
    show() { if (running) return; running = true; resize(); last = performance.now(); requestAnimationFrame(frame); },
    hide() { running = false; keys.clear(); hooks.prompt(null); prompt = null; },
    resize,
    interact,
    zoomBy(f) { zoomMul = Math.max(0.45, Math.min(2, zoomMul * f)); },
    overview() { zoomMul = zoomMul > 0.6 ? 0.45 : 1; },
    goHome() { walkTo(MAP_W / 2, HOUSE.y + HOUSE.h + 70, null); },
    focusLot(i) { const s = gateSpot(i); walkTo(s.x, s.y, null); },
    get isRunning() { return running; },
  };
}
