// The walkable farm: animal behaviour, the farmer, input, camera and the frame loop.
// Environment drawing lives in scene.js and map geometry in geo.js.
import * as E from './engine.js';
import { GROUPS, SPECIES, BUILDINGS, LAND } from './data.js';
import { drawAnimal, ART, artBounds, setShading } from './art.js';
import {
  MAP_W, MAP_H, HOUSE, COLS, SCENERY, CELL, GW, GH, lotRect, gateSpot, layout, rng, hash, inRect, walkable,
} from './geo.js';
import * as Scene from './scene.js';

const OUT = '#3a291c';
const lerp = (a, b, t) => a + (b - a) * t;
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function fs(c, col) { c.fillStyle = col; c.fill(); c.stroke(); }

// ---------- pathfinding ----------
const grid = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) grid[gy * GW + gx] = walkable(gx * CELL + CELL / 2, gy * CELL + CELL / 2) ? 1 : 0;
function findPath(sx, sy, tx, ty) {
  const s = [Math.floor(sx / CELL), Math.floor(sy / CELL)], t = [Math.floor(tx / CELL), Math.floor(ty / CELL)];
  const idx = (x, y) => y * GW + x;
  const ok = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && grid[idx(x, y)];
  if (!ok(...t)) return null;
  const open = [[s[0], s[1], 0, 0]], came = new Map(), g = new Map([[idx(...s), 0]]);
  const hf = (x, y) => Math.abs(x - t[0]) + Math.abs(y - t[1]);
  let guard = 0;
  while (open.length && guard++ < 8000) {
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
  for (let i = 1; i < n; i++) if (!walkable(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n))) return false;
  return true;
}
function smooth(pts) {
  const out = [pts[0]]; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clearLine(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
  return out;
}

// Overgrowth on land that has not been bought yet.
const WILD = new Map();
function wildFor(i) {
  if (!WILD.has(i)) {
    const r = lotRect(i), R = rng(i * 99 + 3), list = [];
    for (let k = 0; k < 14; k++) list.push({ type: k % 4 === 0 ? 'oak' : k % 4 === 1 ? 'pine' : 'bush', x: r.x + 30 + R() * (r.w - 60), y: r.y + 70 + R() * (r.h - 90), s: 0.55 + R() * 0.45, seed: R() });
    WILD.set(i, list);
  }
  return WILD.get(i);
}

// ---------- the world ----------
export function createWorld(canvas, hooks) {
  const c = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, running = false, last = 0, time = 0, zoomMul = 1, foxAgent = null, prompt = null, joy = null, pinch = null;
  const cam = { x: MAP_W / 2, y: HOUSE.y + HOUSE.h + 140 };
  const player = { x: MAP_W / 2, y: HOUSE.y + HOUSE.h + 76, facing: 1, moving: false, path: [], pending: null, phase: 0, dust: 0 };
  const agents = new Map();
  const keys = new Set();
  const particles = [];
  const layouts = new Map();
  const getLayout = (i, g) => { const k = i + g; if (!layouts.has(k)) layouts.set(k, layout(i, g)); return layouts.get(k); };
  const S = () => E.S;
  const high = () => (S().settings.quality || 'high') === 'high';

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, high() ? 2 : 1.25);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  const zoom = () => Math.max(0.3, Math.min(2.2, Math.min(W / 640, H / 760) * zoomMul));
  const toWorld = (sx, sy) => { const z = zoom(); return { x: (sx - W / 2) / z + cam.x, y: (sy - H / 2) / z + cam.y }; };
  const toScreen = (wx, wy) => { const z = zoom(); return { x: (wx - cam.x) * z + W / 2, y: (wy - cam.y) * z + H / 2 }; };
  // Cached layers render at a resolution bucket that tracks zoom, so they stay crisp without wasting memory.
  const resBucket = () => { const v = zoom() * dpr; return v < 0.7 ? 0.6 : v < 1.1 ? 1 : v < 1.6 ? 1.5 : 2; };

  // ----- animal behaviour -----
  const planOf = a => ART[a.species]?.plan;
  const swims = (a, L) => L.water && (planOf(a) === 'fish' || planOf(a) === 'axolotl' || a.species === 'seaturtle');
  function randomPoint(L, a) {
    if (swims(a, L)) { const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * 0.82; return { x: L.water.cx + Math.cos(ang) * L.water.rx * rad, y: L.water.cy + Math.sin(ang) * L.water.ry * rad }; }
    const r = L.inner; return { x: r.x + Math.random() * r.w, y: r.y + Math.random() * r.h };
  }
  function agentFor(a) {
    let g = agents.get(a.id);
    if (!g || g.home !== a.home) {
      const p = S().plots[a.home];
      if (!p || p.kind !== 'habitat') { agents.delete(a.id); return null; }
      const pt = randomPoint(getLayout(a.home, p.group), a);
      g = { id: a.id, home: a.home, x: pt.x, y: pt.y, z: 0, tx: pt.x, ty: pt.y, tz: 0, mode: 'idle', until: 0, facing: Math.random() < 0.5 ? 1 : -1, t0: Math.random() * 10 };
      agents.set(a.id, g);
    }
    return g;
  }
  function speedOf(a, mode) {
    const A = ART[a.species];
    const base = { quad: 34 + (A.leg || 8) * 1.2, turtle: 9, lizard: 22, snake: 13, blob: 24, fish: 26, axolotl: 16, biped: 46, sitter: 10, bird: 18 }[A.plan] || 25;
    if (mode === 'fly') return 90;
    if (mode === 'play') return base * 1.5;
    return base * (E.isAdult(a) ? 1 : 0.8);
  }
  function decide(a, g, L, night) {
    const now = Date.now(), plan = planOf(a);
    const flyer = plan === 'bird' && a.species !== 'peacock' && L.perches.length && SPECIES[a.species].group === 'aviary';
    const set = (mode, secs, target) => { g.mode = mode; g.until = time + secs; if (target) { g.tx = target.x; g.ty = target.y; g.tz = target.z || 0; } };
    if (swims(a, L)) return set('swim', 2 + Math.random() * 4, randomPoint(L, a));
    if (a.sick) return set('sick', 6);
    if (a.breeding) {
      const pg = agents.get(a.breeding.partner);
      return pg ? set('love', 3, { x: pg.x + (a.breeding.mate ? -22 : 22), y: pg.y + 2 }) : set('love', 3);
    }
    if (a.hunger < 30 && Math.random() < 0.7) return set('eat', 4 + Math.random() * 3, { x: L.bowl.x - 14 + Math.random() * 28, y: L.bowl.y - 14 });
    const sleepy = night ? 0.5 : (a.restUntil > now ? 0.4 : 0.1) + (a.happy < 35 ? 0.15 : 0);
    const roll = Math.random();
    if (roll < sleepy) return set('sleep', 6 + Math.random() * 10);
    if (flyer) {
      const r2 = Math.random();
      if (r2 < 0.45) { const p = L.perches[Math.floor(Math.random() * L.perches.length)]; g.perchTarget = p; return set('fly', 8, { x: p.x + (Math.random() - 0.5) * 30, y: p.y, z: p.z }); }
      if (r2 < 0.6) return set('fly', 6, { x: L.inner.x + Math.random() * L.inner.w, y: L.inner.y + Math.random() * L.inner.h, z: 50 + Math.random() * 60 });
      if (r2 < 0.8) return set('walk', 5, { ...randomPoint(L, a), z: 0 });
      return set(a.happy > 60 ? 'play' : 'idle', 3 + Math.random() * 2);
    }
    if (!E.isAdult(a)) {
      const mum = Object.values(S().animals).find(m => m.home === a.home && m.sex === 'f' && m.species === a.species && E.isAdult(m));
      const mg = mum && agents.get(mum.id);
      if (mg && Math.random() < 0.6) return set('walk', 3, { x: mg.x - 18 * mg.facing + (Math.random() - 0.5) * 14, y: mg.y + 6 });
    }
    if (roll < sleepy + (a.happy > 65 ? 0.22 : 0.08)) return set('play', 2 + Math.random() * 2.5, Math.random() < 0.5 ? randomPoint(L, a) : null);
    if (roll < 0.65) return set('walk', 4 + Math.random() * 4, randomPoint(L, a));
    if (L.perches.length && plan === 'sitter' && Math.random() < 0.5) { const p = L.perches[Math.floor(Math.random() * L.perches.length)]; return set('climb', 10, { x: p.x, y: p.y + 2, z: p.z }); }
    return set('idle', 2 + Math.random() * 3);
  }
  function updateAgents(dt, night) {
    const alive = new Set();
    for (const a of Object.values(S().animals)) {
      if (a.home < 0) continue;
      const g = agentFor(a); if (!g) continue;
      alive.add(a.id);
      const L = getLayout(a.home, S().plots[a.home].group);
      if (time > g.until) decide(a, g, L, night);
      if (['walk', 'play', 'eat', 'love', 'fly', 'swim', 'climb'].includes(g.mode)) {
        const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy), sp = speedOf(a, g.mode) * dt;
        if (d > 2) { g.x += (dx / d) * Math.min(sp, d); g.y += (dy / d) * Math.min(sp, d); if (Math.abs(dx) > 1) g.facing = dx > 0 ? 1 : -1; g.arrived = false; } else g.arrived = true;
        if (g.mode === 'fly' || g.mode === 'climb') g.z = lerp(g.z, g.arrived ? g.tz : Math.max(g.tz, g.mode === 'fly' ? 56 : g.tz), Math.min(1, dt * 3));
        if (g.mode === 'fly' && g.arrived && g.perchTarget) { g.mode = 'perch'; g.until = time + 4 + Math.random() * 8; g.perchTarget = null; }
      } else if (g.mode !== 'perch' && g.mode !== 'climbed') g.z = Math.max(0, g.z - dt * 120);
      if (g.mode === 'climb' && g.arrived) { g.mode = 'climbed'; g.until = time + 6 + Math.random() * 10; }
      if (!swims(a, L)) { const r = L.inner; g.x = Math.max(r.x, Math.min(r.x + r.w, g.x)); g.y = Math.max(r.y, Math.min(r.y + r.h, g.y)); }
    }
    for (const id of agents.keys()) if (!alive.has(id)) agents.delete(id);
  }
  function poseOf(g) {
    switch (g.mode) {
      case 'walk': case 'love': case 'climb': return g.arrived ? 'idle' : 'walk';
      case 'play': return 'play';
      case 'eat': return g.arrived ? 'eat' : 'walk';
      case 'sleep': case 'sick': return 'sleep';
      case 'fly': return g.z > 6 && !g.arrived ? 'fly' : 'idle';
      case 'swim': return 'walk';
      default: return 'idle';
    }
  }

  // ----- the farmer -----
  function walkTo(x, y, pending) {
    let path = findPath(player.x, player.y, x, y);
    if (!path) {
      outer: for (let rad = 20; rad < 160; rad += 20) for (let k = 0; k < 8; k++) {
        const nx = x + Math.cos(k / 8 * Math.PI * 2) * rad, ny = y + Math.sin(k / 8 * Math.PI * 2) * rad;
        if (walkable(nx, ny)) { path = findPath(player.x, player.y, nx, ny); if (path) break outer; }
      }
    }
    if (!path) return;
    player.path = path; player.pending = pending;
    particles.push({ type: 'target', x, y, t: 0, life: 0.7 });
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
      if (walkable(nx, player.y)) player.x = nx;
      if (walkable(player.x, ny)) player.y = ny;
      if (Math.abs(vx) > 0.1) player.facing = vx > 0 ? 1 : -1;
      player.moving = true;
    } else if (player.path.length) {
      const [tx, ty] = player.path[0];
      const dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy);
      if (d < 6) { player.path.shift(); if (!player.path.length && player.pending) { const fn = player.pending; player.pending = null; fn(); } }
      else { const st = Math.min(d, speed * dt); player.x += dx / d * st; player.y += dy / d * st; if (Math.abs(dx) > 1) player.facing = dx > 0 ? 1 : -1; }
      player.moving = true;
    } else player.moving = false;
    if (player.moving) {
      player.phase += dt * 11; player.dust -= dt;
      if (player.dust <= 0 && high()) { player.dust = 0.18; particles.push({ type: 'dust', x: player.x - player.facing * 6, y: player.y, vx: -player.facing * 12, vy: -12, t: 0, life: 0.6, r: 3 }); }
    }
    const z = zoom(), hw = W / 2 / z, hh = H / 2 / z;
    const tx = MAP_W < hw * 2 ? MAP_W / 2 : Math.max(hw, Math.min(MAP_W - hw, player.x));
    const ty = MAP_H < hh * 2 ? MAP_H / 2 : Math.max(hh, Math.min(MAP_H - hh, player.y - 30));
    cam.x = lerp(cam.x, tx, Math.min(1, dt * 6)); cam.y = lerp(cam.y, ty, Math.min(1, dt * 6));
    updatePrompt();
  }
  function interactables() {
    const list = [];
    for (let i = 0; i < LAND.maxPlots; i++) {
      const p = S().plots[i], spot = gateSpot(i);
      let label, act;
      if (i >= S().plotsOwned) {
        if (i < S().plotsOwned + COLS && E.landCost() != null) { label = `Buy land for ${E.fmt(E.landCost())} coins`; act = () => hooks.buyLand(); } else continue;
      } else if (!p) { label = 'Build here'; act = () => hooks.build(i); }
      else if (p.building) { label = 'Under construction'; act = () => hooks.rushBuild(i); }
      else if (p.kind === 'habitat') { label = `Open ${GROUPS[p.group].name}`; act = () => hooks.habitat(i); }
      else { label = p.type === 'feedmill' && p.stock >= 1 ? `Collect ${Math.floor(p.stock)} feed` : `Open ${BUILDINGS[p.type].name}`; act = () => (p.type === 'feedmill' && p.stock >= 1 ? hooks.collect(i) : hooks.building(i)); }
      list.push({ x: spot.x, y: spot.y, label, act, i });
    }
    list.push({ x: HOUSE.x + HOUSE.w / 2, y: HOUSE.y + HOUSE.h + 34, label: 'Farm office', act: () => hooks.house() });
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
    if (foxAgent && Math.hypot(w.x - foxAgent.x, w.y - 12 - foxAgent.y) < 44) { E.eventAction(); burst(foxAgent.x, foxAgent.y - 10, '#ffffff'); return; }
    let hit = null;
    for (const a of Object.values(S().animals)) {
      const g = agents.get(a.id); if (!g) continue;
      const b = artBounds(a.species), sc = E.isAdult(a) ? 1 : 0.6;
      const hw = Math.max(22, b.w * sc * 0.5), hh = Math.max(26, b.h * sc);
      if (Math.abs(w.x - g.x) < hw && w.y < g.y - g.z + 8 && w.y > g.y - g.z - hh) if (!hit || g.y > hit.g.y) hit = { a, g };
    }
    if (hit) { hooks.animal(hit.a.id); return; }
    for (let i = 0; i < S().plotsOwned; i++) {
      const p = S().plots[i]; if (!p || p.kind !== 'building' || p.type !== 'feedmill' || p.building || p.stock < 1) continue;
      const r = lotRect(i); if (Math.abs(w.x - (r.x + r.w / 2)) < 56 && Math.abs(w.y - (r.y + 44)) < 24) { hooks.collect(i); burst(r.x + r.w / 2, r.y + 44, '#ffd23f'); return; }
    }
    for (const it of interactables()) {
      const inside = it.i != null ? inRect(w.x, w.y, lotRect(it.i), 10) : inRect(w.x, w.y, HOUSE, 10);
      if (inside || Math.hypot(w.x - it.x, w.y - it.y) < 40) {
        if (Math.hypot(player.x - it.x, player.y - it.y) < 60) it.act(); else walkTo(it.x, it.y, it.act);
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
  function burst(x, y, col) { for (let i = 0; i < 14; i++) particles.push({ type: 'spark', x, y, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 110, t: 0, life: 0.8, col }); }
  function drawParticles(dt) {
    for (let k = particles.length - 1; k >= 0; k--) {
      const p = particles[k]; p.t += dt;
      if (p.t > p.life) { particles.splice(k, 1); continue; }
      const q = p.t / p.life;
      c.save(); c.globalAlpha = 1 - q;
      if (p.type === 'target') { c.strokeStyle = '#fff'; c.lineWidth = 3; ell(c, p.x, p.y, 10 + q * 16, (10 + q * 16) * 0.45); c.stroke(); }
      if (p.type === 'dust') { p.x += p.vx * dt; p.y += p.vy * dt; ell(c, p.x, p.y, p.r + q * 5, (p.r + q * 5) * 0.7); c.fillStyle = 'rgba(240,225,190,.8)'; c.fill(); }
      if (p.type === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; ell(c, p.x, p.y, 3, 3); c.fillStyle = p.col; c.fill(); }
      if (p.type === 'heart' || p.type === 'note') {
        const x = p.x + Math.sin(p.t * 5) * 5 + p.vx * p.t, y = p.y - p.t * 30;
        c.fillStyle = p.type === 'heart' ? '#ff5a8a' : '#4a7ee0'; c.strokeStyle = OUT; c.lineWidth = 1.2;
        if (p.type === 'heart') { c.beginPath(); c.moveTo(x, y + 4); c.bezierCurveTo(x - 7, y - 2, x - 3, y - 7, x, y - 3); c.bezierCurveTo(x + 3, y - 7, x + 7, y - 2, x, y + 4); c.fill(); c.stroke(); }
        else { ell(c, x, y, 3, 2.4, -0.4); c.fill(); c.fillRect(x + 2, y - 10, 1.4, 10); }
      }
      c.restore();
    }
  }

  // ----- drawing -----
  function drawPlayer() {
    const x = player.x, y = player.y, f = player.facing, ph = player.phase;
    const sw = player.moving ? Math.sin(ph) * 0.6 : 0, bob = player.moving ? Math.abs(Math.sin(ph)) * 2 : Math.sin(time * 2) * 0.4;
    c.save(); c.translate(x, y);
    const sg = c.createRadialGradient(0, 0, 0, 0, 0, 18); sg.addColorStop(0, 'rgba(40,30,10,.35)'); sg.addColorStop(1, 'rgba(40,30,10,0)');
    c.save(); c.scale(1, 0.32); c.beginPath(); c.arc(0, 0, 18, 0, Math.PI * 2); c.fillStyle = sg; c.fill(); c.restore();
    c.scale(f, 1); c.strokeStyle = OUT; c.lineWidth = 1.8; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [dx, a, col] of [[-4, sw, '#2f5ea8'], [4, -sw, '#3a6fc0']]) { c.save(); c.translate(dx, -21 - bob); c.rotate(a); rr(c, -3.6, 0, 7.2, 20, 3); fs(c, col); rr(c, -4.5, 16, 11, 5.5, 2.5); fs(c, '#5a3a1e'); c.restore(); }
    c.save(); c.translate(-2, -42 - bob); c.rotate(sw * 0.8); rr(c, -3, 0, 6, 16, 3); fs(c, '#c8463e'); ell(c, 0, 17, 3.4, 3.4); fs(c, '#f2c29a'); c.restore();
    rr(c, -10, -47 - bob, 20, 28, 7);
    const shirt = c.createLinearGradient(-10, 0, 10, 0); shirt.addColorStop(0, '#e8665c'); shirt.addColorStop(1, '#c8463e'); c.fillStyle = shirt; c.fill(); c.stroke();
    c.save(); rr(c, -10, -47 - bob, 20, 28, 7); c.clip(); c.fillStyle = 'rgba(255,255,255,.22)'; for (let k = -10; k < 12; k += 6) c.fillRect(k, -47 - bob, 2, 30); for (let k = -47; k < -17; k += 6) c.fillRect(-10, k - bob, 20, 2); c.restore();
    rr(c, -9, -37 - bob, 18, 18, 4); fs(c, '#3a6fc0');
    c.fillStyle = '#3a6fc0'; c.fillRect(-7, -47 - bob, 3, 10); c.fillRect(4, -47 - bob, 3, 10);
    c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-5.5, -38 - bob, 1.4, 0, 7); c.arc(5.5, -38 - bob, 1.4, 0, 7); c.fill();
    c.save(); c.translate(3, -43 - bob); c.rotate(-sw * 0.8); rr(c, -3, 0, 6, 16, 3); fs(c, '#e8665c'); ell(c, 0, 17, 3.4, 3.4); fs(c, '#f2c29a'); c.restore();
    ell(c, 2, -57 - bob, 10, 10); const skin = c.createRadialGradient(-1, -61 - bob, 1, 2, -57 - bob, 11); skin.addColorStop(0, '#ffd8b4'); skin.addColorStop(1, '#e8b48a'); c.fillStyle = skin; c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,120,120,.35)'; ell(c, 6, -53 - bob, 2.6, 1.6); c.fill();
    ell(c, 7, -58 - bob, 1.6, 2.1); c.fillStyle = OUT; c.fill();
    c.beginPath(); c.arc(6.5, -53.5 - bob, 2.6, 0.3, 2.4); c.lineWidth = 1.4; c.stroke(); c.lineWidth = 1.8;
    c.fillStyle = '#7a4a24'; c.beginPath(); c.moveTo(-8, -60 - bob); c.quadraticCurveTo(-9, -52 - bob, -5, -50 - bob); c.lineTo(-4, -60 - bob); c.fill();
    ell(c, 1, -64 - bob, 18, 4.8); c.fillStyle = '#f0d070'; c.fill(); c.stroke();
    rr(c, -8, -78 - bob, 18, 15, 7); const hat = c.createLinearGradient(0, -78 - bob, 0, -63 - bob); hat.addColorStop(0, '#f6dc86'); hat.addColorStop(1, '#d8b64a'); c.fillStyle = hat; c.fill(); c.stroke();
    c.fillStyle = '#c8463e'; c.fillRect(-8, -67 - bob, 18, 3.2);
    c.restore();
  }

  function drawIcons(a, g, x, y) {
    if (a.breeding && !a.breeding.mate) {
      if (Math.random() < 0.03) particles.push({ type: 'heart', x, y: y - 30, t: 0, life: 1.6, vx: (Math.random() - 0.5) * 10 });
      const pr = Math.max(0, Math.min(1, (Date.now() - a.breeding.starts) / (a.breeding.ends - a.breeding.starts)));
      c.save(); c.lineCap = 'round';
      c.beginPath(); c.arc(x, y - 52, 9, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
      c.lineWidth = 3.4; c.strokeStyle = '#ec5f8d'; c.beginPath(); c.arc(x, y - 52, 6, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); c.stroke();
      c.restore();
    }
    let bubble = null;
    if (a.sick) bubble = 'sick'; else if (a.hunger < 25) bubble = 'hungry'; else if (a.happy < 25) bubble = 'sad';
    if (bubble) {
      const by = y - 50 + Math.sin(time * 3) * 2;
      c.save(); c.strokeStyle = OUT; c.lineWidth = 1.6;
      rr(c, x - 12, by - 12, 24, 21, 9); fs(c, '#fff');
      c.beginPath(); c.moveTo(x - 4, by + 8.5); c.lineTo(x, by + 14); c.lineTo(x + 4, by + 8.5); c.fillStyle = '#fff'; c.fill();
      c.beginPath(); c.moveTo(x - 4, by + 9); c.lineTo(x, by + 14); c.lineTo(x + 4, by + 9); c.stroke();
      if (bubble === 'sick') { c.fillStyle = '#3d9a4b'; c.fillRect(x - 2, by - 7.5, 4, 12); c.fillRect(x - 6, by - 3.5, 12, 4); }
      if (bubble === 'hungry') { ell(c, x, by + 2, 7.5, 3.6); fs(c, '#ef6b62'); ell(c, x, by, 5, 2); c.fillStyle = '#5a2a20'; c.fill(); }
      if (bubble === 'sad') { c.beginPath(); c.arc(x, by + 4.5, 4, 1.1 * Math.PI, 1.9 * Math.PI); c.stroke(); ell(c, x - 3, by - 3, 1.1, 1.5); c.fillStyle = OUT; c.fill(); ell(c, x + 3, by - 3, 1.1, 1.5); c.fill(); ell(c, x + 5, by + 1, 1, 1.6); c.fillStyle = '#5fb4e6'; c.fill(); }
      c.restore();
    }
    if (g.mode === 'play' && Math.random() < 0.02) particles.push({ type: 'note', x, y: y - 30, t: 0, life: 1.4, vx: (Math.random() - 0.5) * 10 });
  }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; time += dt;
    const info = Scene.dayInfo();
    updatePlayer(dt);
    updateAgents(dt, info.night > 0.6);
    const z = zoom(), R = resBucket();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#4c8a3a'; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-cam.x, -cam.y);
    const view = { x: cam.x - W / 2 / z, y: cam.y - H / 2 / z, w: W / z, h: H / z };
    const vis = r => r.x + r.w > view.x - 80 && r.x < view.x + view.w + 80 && r.y + r.h > view.y - 160 && r.y < view.y + view.h + 160;
    Scene.terrain(c, view, Math.min(R, 2));
    const items = [];
    const lights = [...Scene.LAMPS, ...Scene.HOUSE_LIGHTS];
    for (let i = 0; i < LAND.maxPlots; i++) {
      const r = lotRect(i); if (!vis(r)) continue;
      const owned = i < S().plotsOwned, p = owned ? S().plots[i] : null;
      Scene.lotBase(c, i, p, R);
      if (!owned) {
        for (const o of wildFor(i)) items.push({ y: o.y, fn: () => Scene.scenery(c, o, time, info.night) });
        if (i < S().plotsOwned + COLS && E.landCost() != null) items.push({ y: r.y + r.h, fn: () => Scene.signpost(c, i, 'sale', 'LAND FOR SALE', `${E.fmt(E.landCost())} coins`, time) });
        continue;
      }
      if (!p) { items.push({ y: r.y + r.h, fn: () => Scene.signpost(c, i, 'build', 'BUILD HERE', 'Tap to choose', time) }); continue; }
      if (p.building) { items.push({ y: r.y + r.h - 1, fn: () => Scene.construction(c, i, p, time) }); continue; }
      if (p.kind === 'building') {
        items.push({ y: r.y + r.h - 30, fn: () => Scene.building(c, i, p, time, info.night) });
        if (['vet', 'lab', 'feedmill'].includes(p.type)) lights.push({ x: r.x + r.w / 2, y: r.y + r.h - 90, r: 170, col: p.type === 'lab' ? '200,160,255' : '255,210,120' });
        continue;
      }
      const L = getLayout(i, p.group);
      Scene.lotLive(c, i, p, time);
      for (const o of L.props) items.push({ y: o.y, fn: () => Scene.prop(c, o, time) });
      if (p.group === 'aviary') for (const pc of L.perches) items.push({ y: pc.y - 1, fn: () => Scene.prop(c, { type: 'perch', x: pc.x, y: pc.y, z: pc.z }, time) });
      items.push({ y: r.y + r.h + 1, fn: () => Scene.lotFront(c, i, p, R) });
      lights.push(...L.lights);
    }
    for (const a of Object.values(S().animals)) {
      const g = agents.get(a.id); if (!g) continue;
      if (!vis(lotRect(a.home))) continue;
      const L = getLayout(a.home, S().plots[a.home].group);
      const swimmer = swims(a, L);
      const raised = g.mode === 'perch' || g.mode === 'climbed' || g.z > 2;
      items.push({ y: raised ? g.y + 0.5 : g.y, fn: () => {
        const sc = (E.isAdult(a) ? 1 : 0.6) * 1.05;
        c.save(); c.translate(g.x, g.y - g.z);
        if (swimmer) { c.globalAlpha = 0.92; c.translate(0, 10); }
        if (g.z > 4) { c.save(); c.translate(0, g.z); ell(c, 0, 0, 10, 3); c.fillStyle = 'rgba(0,0,0,.14)'; c.fill(); c.restore(); }
        if (a.sick) c.filter = 'saturate(.55)';
        drawAnimal(c, a.species, { pose: poseOf(g), t: time + g.t0, facing: g.facing, mut: a.mut, scale: sc, seed: hash(a.id), shadow: g.z < 4 && !swimmer });
        c.filter = 'none';
        if (swimmer) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -4, 18 * sc, 4, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
        drawIcons(a, g, g.x, g.y - g.z - (artBounds(a.species).h * sc) + 26);
      } });
    }
    for (const o of SCENERY) if (o.x > view.x - 90 && o.x < view.x + view.w + 90 && o.y > view.y - 20 && o.y < view.y + view.h + 160) items.push({ y: o.y, fn: () => Scene.scenery(c, o, time, info.night) });
    if (vis(HOUSE)) items.push({ y: HOUSE.y + HOUSE.h, fn: () => Scene.house(c, time, info.night) });
    items.push({ y: player.y, fn: drawPlayer });
    foxAgent = null;
    if (E.eventActive('fox')) {
      const target = S().plots.findIndex(p => p && p.kind === 'habitat' && (p.group === 'aviary' || p.group === 'hutch'));
      if (target >= 0) {
        const r = lotRect(target), k = time * 0.6;
        const fa = foxAgent = { x: r.x + r.w / 2 + Math.cos(k) * (r.w / 2 + 30), y: r.y + r.h + 56 + Math.sin(k * 2) * 18, f: -Math.sin(k) >= 0 ? 1 : -1 };
        items.push({ y: fa.y, fn: () => {
          c.save(); c.translate(fa.x, fa.y); drawAnimal(c, 'wildfox', { pose: 'walk', t: time, facing: fa.f, scale: 1.25 }); c.restore();
          c.save(); c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = OUT; c.fillStyle = '#fff'; c.strokeText('Tap to shoo!', fa.x, fa.y - 52); c.fillText('Tap to shoo!', fa.x, fa.y - 52); c.restore();
        } });
      }
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.fn();
    drawParticles(dt);
    Scene.cloudShadows(c, view, time);
    if (E.eventActive('storm')) { c.strokeStyle = 'rgba(210,228,255,.55)'; c.lineWidth = 1.5; for (let k = 0; k < 170; k++) { const x = view.x + ((k * 97 + time * 60) % view.w), y = view.y + ((k * 53 + time * 700) % view.h); c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 14); c.stroke(); } }
    if (E.eventActive('bumper') && Math.random() < 0.08) particles.push({ type: 'heart', x: view.x + Math.random() * view.w, y: view.y + view.h * (0.3 + Math.random() * 0.6), t: 0, life: 1.6, vx: 0 });
    Scene.ambient(c, view, time, dt, info);
    c.restore();
    if (E.eventActive('storm')) { c.fillStyle = 'rgba(40,60,90,.22)'; c.fillRect(0, 0, W, H); }
    if (E.eventActive('heatwave')) { c.fillStyle = 'rgba(255,150,50,.1)'; c.fillRect(0, 0, W, H); }
    Scene.lighting(c, W, H, dpr, toScreen, z, lights, info, time);
    if (high()) Scene.vignette(c, W, H);
    if (joy && joy.active) {
      c.save(); c.globalAlpha = 0.55; c.lineWidth = 4; c.strokeStyle = '#fff';
      c.beginPath(); c.arc(joy.ox, joy.oy, 46, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(joy.ox + joy.dx * 46, joy.oy + joy.dy * 46, 20, 0, Math.PI * 2); c.fill(); c.restore();
    }
    requestAnimationFrame(frame);
  }

  return {
    show() { if (running) return; running = true; resize(); last = performance.now(); requestAnimationFrame(frame); },
    hide() { running = false; keys.clear(); hooks.prompt(null); prompt = null; },
    resize,
    interact,
    setQuality(q) { setShading(q === 'high'); Scene.setQuality(q); resize(); },
    zoomBy(f) { zoomMul = Math.max(0.45, Math.min(2, zoomMul * f)); },
    overview() { zoomMul = zoomMul > 0.6 ? 0.45 : 1; },
    goHome() { walkTo(MAP_W / 2, HOUSE.y + HOUSE.h + 76, null); },
    focusLot(i) { const s = gateSpot(i); walkTo(s.x, s.y, null); },
    get isRunning() { return running; },
  };
}
