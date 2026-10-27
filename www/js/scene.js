// Environment renderer for the walkable farm. Static layers (terrain, lot floors, fences) are drawn once
// into cached canvases at the current resolution; animated details are drawn every frame on top.
import * as E from './engine.js';
import { GROUPS, BUILDINGS, MILL } from './data.js';
import { drawAnimal } from './art.js';
import {
  LOT_W, LOT_H, EDGE, MAP_W, MAP_H, HOUSE, PATHS, SCENERY, lotRect, layout, rng, hash, inRect, onPath,
} from './geo.js';

const OUT = '#3a291c';
const DAY_LENGTH = 600;

// ---------- primitives ----------
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); };
const fs = (c, col) => { c.fillStyle = col; c.fill(); c.stroke(); };
const fl = (c, col) => { c.fillStyle = col; c.fill(); };
function vgrad(c, y0, y1, a, b) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function hgrad(c, x0, x1, a, b) { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function softShadow(c, x, y, rx, ry, a = 0.22) {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(40,32,12,${a})`); g.addColorStop(1, 'rgba(40,32,12,0)');
  c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); circ(c, x, y, rx); c.fillStyle = g; c.fill(); c.restore();
}
function label(c, text, x, y, size, col = '#fff', weight = 600) {
  c.font = `${weight} ${size}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = col; c.fillText(text, x, y);
}

// ---------- quality & caches ----------
let quality = 'high';
export function setQuality(q) { quality = q; chunkCache.clear(); lotCache.clear(); }
export const isHigh = () => quality === 'high';
const chunkCache = new Map();
const lotCache = new Map();
const lru = (map, max) => { while (map.size > max) map.delete(map.keys().next().value); };
export function invalidateLots() { lotCache.clear(); }

// ---------- global decoration lists ----------
const DECO = (() => {
  const R = rng(91);
  const patches = [], tufts = [], flowers = [], pebbles = [], stones = [], clover = [];
  for (let i = 0; i < 1100; i++) patches.push({ x: R() * MAP_W, y: R() * MAP_H, rx: 30 + R() * 90, ry: 14 + R() * 36, k: R() < 0.55 ? 0 : 1, a: 0.05 + R() * 0.08 });
  for (let i = 0; i < 3400; i++) { const x = R() * MAP_W, y = R() * MAP_H; if (!onPath(x, y)) tufts.push({ x, y, s: 0.7 + R() * 0.7, k: R() }); }
  for (let i = 0; i < 520; i++) { const x = EDGE - 60 + R() * (MAP_W - EDGE * 2 + 120), y = 60 + R() * (MAP_H - 120); if (!onPath(x, y)) flowers.push({ x, y, k: Math.floor(R() * 6), s: 0.7 + R() * 0.6 }); }
  for (let i = 0; i < 260; i++) { const x = R() * MAP_W, y = R() * MAP_H; if (!onPath(x, y)) clover.push({ x, y, s: 0.8 + R() * 0.5 }); }
  for (let i = 0; i < 2600; i++) { const x = R() * MAP_W, y = R() * MAP_H; if (onPath(x, y)) pebbles.push({ x, y, r: 0.8 + R() * 2.2, k: R() }); }
  for (const p of PATHS) {
    const edges = [[p.x, p.y, p.x + p.w, p.y], [p.x, p.y + p.h, p.x + p.w, p.y + p.h], [p.x, p.y, p.x, p.y + p.h], [p.x + p.w, p.y, p.x + p.w, p.y + p.h]];
    for (const [x1, y1, x2, y2] of edges) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 10; d < len - 10; d += 18 + R() * 16) {
        const x = x1 + (x2 - x1) * d / len + (R() - 0.5) * 4, y = y1 + (y2 - y1) * d / len + (R() - 0.5) * 4;
        if (PATHS.some(q => q !== p && inRect(x, y, q, -2))) continue;
        stones.push({ x, y, r: 3 + R() * 3.5, k: R() });
      }
    }
  }
  return { patches, tufts, flowers, pebbles, stones, clover };
})();

// ---------- terrain ----------
const CH = 384, OV = 2;
function renderChunk(cx, cy, R) {
  const cv = document.createElement('canvas');
  // Each chunk carries a small overlap so neighbouring chunks never show a seam.
  cv.width = Math.ceil((CH + OV * 2) * R); cv.height = Math.ceil((CH + OV * 2) * R);
  const c = cv.getContext('2d');
  c.setTransform(R, 0, 0, R, (OV - cx * CH) * R, (OV - cy * CH) * R);
  const x0 = cx * CH - OV, y0 = cy * CH - OV, x1 = x0 + CH + OV * 2, y1 = y0 + CH + OV * 2;
  const inView = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
  // Base grass with a gentle north to south gradient
  c.fillStyle = vgrad(c, 0, MAP_H, '#86c862', '#6fb653'); c.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const p of DECO.patches) if (inView(p.x, p.y, 130)) { ell(c, p.x, p.y, p.rx, p.ry); c.fillStyle = p.k ? `rgba(255,255,220,${p.a})` : `rgba(30,90,20,${p.a})`; c.fill(); }
  // Forest floor towards the map edge
  c.fillStyle = hgrad(c, 0, EDGE, 'rgba(30,70,20,.5)', 'rgba(30,70,20,0)'); c.fillRect(x0, y0, Math.max(0, Math.min(x1, EDGE) - x0), y1 - y0);
  c.fillStyle = hgrad(c, MAP_W, MAP_W - EDGE, 'rgba(30,70,20,.5)', 'rgba(30,70,20,0)'); if (x1 > MAP_W - EDGE) c.fillRect(Math.max(x0, MAP_W - EDGE), y0, x1 - Math.max(x0, MAP_W - EDGE), y1 - y0);
  c.fillStyle = vgrad(c, MAP_H, MAP_H - 150, 'rgba(30,70,20,.5)', 'rgba(30,70,20,0)'); if (y1 > MAP_H - 150) c.fillRect(x0, Math.max(y0, MAP_H - 150), x1 - x0, y1 - Math.max(y0, MAP_H - 150));
  c.fillStyle = vgrad(c, 0, 90, 'rgba(30,70,20,.45)', 'rgba(30,70,20,0)'); if (y0 < 90) c.fillRect(x0, y0, x1 - x0, 90 - y0);
  // Paths: an outline pass then a fill pass gives one merged shape
  for (const p of PATHS) { rr(c, p.x - 3, p.y - 3, p.w + 6, p.h + 6, 34); fl(c, '#c79f62'); }
  for (const p of PATHS) { rr(c, p.x, p.y, p.w, p.h, 32); fl(c, '#e6c993'); }
  for (const p of PATHS) { rr(c, p.x + 12, p.y + 12, p.w - 24, p.h - 24, 22); fl(c, '#ebd2a2'); }
  for (const p of DECO.pebbles) if (inView(p.x, p.y, 4)) { ell(c, p.x, p.y, p.r, p.r * 0.7); fl(c, p.k < 0.5 ? 'rgba(150,110,60,.35)' : 'rgba(255,250,235,.45)'); }
  for (const s of DECO.stones) if (inView(s.x, s.y, 8)) {
    ell(c, s.x + 1, s.y + 1.5, s.r, s.r * 0.7); fl(c, 'rgba(60,40,10,.25)');
    ell(c, s.x, s.y, s.r, s.r * 0.72); fl(c, s.k < 0.5 ? '#b8ad98' : '#cfc4ad');
    ell(c, s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.4, s.r * 0.25); fl(c, 'rgba(255,255,255,.45)');
  }
  // Grass tufts, clover and flowers
  c.lineCap = 'round';
  for (const t of DECO.tufts) if (inView(t.x, t.y, 8)) {
    c.strokeStyle = t.k < 0.5 ? 'rgba(45,110,30,.55)' : 'rgba(150,210,100,.7)'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.x - 2 * t.s, t.y - 5 * t.s); c.moveTo(t.x + 1, t.y); c.lineTo(t.x + 1.5 * t.s, t.y - 6 * t.s); c.moveTo(t.x + 2, t.y); c.lineTo(t.x + 4 * t.s, t.y - 4 * t.s); c.stroke();
  }
  for (const k of DECO.clover) if (inView(k.x, k.y, 6)) for (let i = 0; i < 3; i++) { circ(c, k.x + Math.cos(i * 2.1) * 2.2 * k.s, k.y + Math.sin(i * 2.1) * 2.2 * k.s, 2 * k.s); fl(c, 'rgba(70,140,50,.6)'); }
  const FC = ['#ffffff', '#ffd23f', '#ff8fb0', '#b98cff', '#ff6b4a', '#7fc8ff'];
  for (const f of DECO.flowers) if (inView(f.x, f.y, 8)) {
    c.strokeStyle = '#3f8a30'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x, f.y - 6 * f.s); c.stroke();
    for (let k = 0; k < 5; k++) { ell(c, f.x + Math.cos(k * 1.26) * 2.3 * f.s, f.y - 7 * f.s + Math.sin(k * 1.26) * 2.3 * f.s, 1.8 * f.s, 1.8 * f.s); fl(c, FC[f.k]); }
    circ(c, f.x, f.y - 7 * f.s, 1.3 * f.s); fl(c, '#f2a922');
  }
  return cv;
}

export function terrain(c, view, R) {
  const cx0 = Math.max(0, Math.floor(view.x / CH)), cy0 = Math.max(0, Math.floor(view.y / CH));
  const cx1 = Math.min(Math.ceil(MAP_W / CH) - 1, Math.floor((view.x + view.w) / CH)), cy1 = Math.min(Math.ceil(MAP_H / CH) - 1, Math.floor((view.y + view.h) / CH));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const key = `${cx},${cy},${R}`;
    let cv = chunkCache.get(key);
    if (!cv) { cv = renderChunk(cx, cy, R); chunkCache.set(key, cv); lru(chunkCache, 28); }
    else { chunkCache.delete(key); chunkCache.set(key, cv); }
    c.drawImage(cv, cx * CH - OV, cy * CH - OV, CH + OV * 2, CH + OV * 2);
  }
}

// ---------- fences ----------
function woodPost(c, x, y, h, col = '#a8703c') {
  rr(c, x - 4.5, y - h, 9, h + 2, 2); c.fillStyle = hgrad(c, x - 4.5, x + 4.5, '#c98d52', col); c.fill(); c.stroke();
  rr(c, x - 5.5, y - h - 3, 11, 5, 2); fs(c, '#d9a066');
}
function woodRails(c, x1, y1, x2, y2, h) {
  for (const off of [h * 0.72, h * 0.32]) {
    c.beginPath(); c.moveTo(x1, y1 - off); c.lineTo(x2, y2 - off);
    c.lineWidth = 7; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4.6; c.strokeStyle = '#b97d44'; c.stroke();
    c.lineWidth = 1.4; c.strokeStyle = 'rgba(255,230,180,.55)'; c.beginPath(); c.moveTo(x1, y1 - off - 1.2); c.lineTo(x2, y2 - off - 1.2); c.stroke();
  }
  c.strokeStyle = OUT; c.lineWidth = 2;
}
function fence(c, x1, y1, x2, y2, style) {
  c.save(); c.strokeStyle = OUT; c.lineWidth = 2; c.lineJoin = 'round';
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (style === 'rocks') {
    const R = rng(hash(`${x1},${y1},${x2}`));
    for (let d = 0; d <= len; d += 14) {
      const x = x1 + dx * d / len, y = y1 + dy * d / len, r = 9 + R() * 6;
      ell(c, x, y - 4, r, r * 0.68); c.fillStyle = vgrad(c, y - 4 - r, y + r, '#c8c2b0', '#948c78'); c.fill(); c.stroke();
      ell(c, x - r * 0.3, y - 4 - r * 0.32, r * 0.35, r * 0.18); fl(c, 'rgba(255,255,255,.4)');
      if (R() < 0.3) { ell(c, x + 3, y - 2 - r * 0.6, 3, 2); fl(c, 'rgba(90,150,60,.7)'); }
    }
    c.restore(); return;
  }
  if (style === 'glass') {
    const h = 44;
    if (dy === 0) {
      rr(c, x1, y1 - 10, dx, 10, 2); fs(c, '#9a6a3a');
      rr(c, x1, y1 - 10 - h, dx, h, 3); c.fillStyle = vgrad(c, y1 - h - 10, y1 - 10, 'rgba(210,240,255,.42)', 'rgba(170,220,250,.22)'); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.5; for (let x = x1 + 18; x < x2 - 20; x += 90) { c.beginPath(); c.moveTo(x, y1 - 16); c.lineTo(x + 16, y1 - h + 2); c.stroke(); }
    } else {
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x2, y2 - h - 10); c.lineTo(x1, y1 - h - 10); c.closePath();
      c.fillStyle = 'rgba(190,230,255,.28)'; c.fill(); c.stroke();
    }
    c.restore(); return;
  }
  if (style === 'mesh') {
    const h = 64;
    if (dy === 0) { c.fillStyle = 'rgba(40,70,50,.13)'; c.fillRect(x1, y1 - h, dx, h); c.strokeStyle = 'rgba(40,60,45,.32)'; c.lineWidth = 1; for (let x = x1; x <= x2; x += 9) { c.beginPath(); c.moveTo(x, y1 - h); c.lineTo(x, y1); c.stroke(); } for (let y = y1 - h; y <= y1; y += 9) { c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke(); } }
    c.strokeStyle = OUT; c.lineWidth = 2;
    const n = Math.max(1, Math.round(len / 76));
    for (let i = 0; i <= n; i++) { const x = x1 + dx * i / n, y = y1 + dy * i / n; rr(c, x - 3.5, y - h, 7, h + 2, 2); c.fillStyle = hgrad(c, x - 3.5, x + 3.5, '#5d7a66', '#3b5244'); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(x1, y1 - h); c.lineTo(x2, y2 - h); c.lineWidth = 5; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#5d7a66'; c.stroke();
    c.restore(); return;
  }
  if (style === 'picket') {
    const h = 30;
    c.beginPath(); c.moveTo(x1, y1 - h * 0.6); c.lineTo(x2, y2 - h * 0.6); c.lineWidth = 5.5; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = '#f3efe6'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1.8;
    const n = Math.max(1, Math.round(len / 13));
    for (let i = 0; i <= n; i++) {
      const x = x1 + dx * i / n, y = y1 + dy * i / n;
      c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 4, y - h); c.lineTo(x, y - h - 6); c.lineTo(x + 4, y - h); c.lineTo(x + 4, y); c.closePath();
      c.fillStyle = hgrad(c, x - 4, x + 4, '#ffffff', '#dcd6ca'); c.fill(); c.stroke();
    }
    c.restore(); return;
  }
  const h = 30;
  woodRails(c, x1, y1, x2, y2, h);
  const n = Math.max(1, Math.round(len / 40));
  for (let i = 0; i <= n; i++) woodPost(c, x1 + dx * i / n, y1 + dy * i / n, h + 4);
  c.restore();
}

const FENCE = { kennel: 'wood', cattery: 'picket', aviary: 'mesh', hutch: 'wood', terrarium: 'glass', pond: 'rocks', paddock: 'wood', sanctuary: 'wood' };

// ---------- lot floors ----------
function floor(c, g, i) {
  const W = LOT_W, H = LOT_H, R = rng(i * 77 + 13);
  c.save();
  rr(c, 0, 44, W, H - 44, 18); c.clip();
  switch (g) {
    case 'kennel':
      c.fillStyle = vgrad(c, 44, H, '#9ccb6c', '#88bd5c'); c.fillRect(0, 0, W, H);
      ell(c, W / 2, H / 2 + 30, W * 0.36, H * 0.26); fl(c, '#d6b77e');
      for (let k = 0; k < 90; k++) { ell(c, W / 2 + (R() - 0.5) * W * 0.6, H / 2 + 30 + (R() - 0.5) * H * 0.4, 2 + R() * 5, 1 + R() * 2, R()); fl(c, 'rgba(140,100,50,.22)'); }
      break;
    case 'cattery': {
      for (let y = 44, k = 0; y < H; y += 18, k++) { c.fillStyle = k % 2 ? '#e3c695' : '#dbbd8a'; c.fillRect(0, y, W, 18); c.fillStyle = 'rgba(120,80,40,.25)'; c.fillRect(0, y + 17, W, 1.5); for (let x = (k * 53) % 120; x < W; x += 120) { c.fillRect(x, y, 1.5, 18); } }
      ell(c, W / 2, H / 2 + 34, 92, 46); c.lineWidth = 2; c.strokeStyle = OUT; fs(c, '#e88aa6'); ell(c, W / 2, H / 2 + 34, 76, 36); c.lineWidth = 3; c.strokeStyle = '#ffd1de'; c.stroke();
      break; }
    case 'aviary':
      c.fillStyle = vgrad(c, 44, H, '#93cf6a', '#7fc05a'); c.fillRect(0, 0, W, H);
      for (let k = 0; k < 40; k++) { ell(c, R() * W, 60 + R() * (H - 70), 10 + R() * 20, 5 + R() * 8); fl(c, R() < 0.5 ? 'rgba(40,100,20,.12)' : 'rgba(255,255,220,.12)'); }
      ell(c, W / 2, H - 40, 70, 22); fl(c, '#d8bf86');
      break;
    case 'hutch':
      c.fillStyle = '#ecd27c'; c.fillRect(0, 0, W, H);
      c.lineCap = 'round'; c.lineWidth = 1.3;
      for (let k = 0; k < 520; k++) { const x = R() * W, y = 44 + R() * (H - 44), a = R() * Math.PI; c.strokeStyle = ['#d8b85a', '#f6e39a', '#c9a446'][k % 3]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 3); c.stroke(); }
      break;
    case 'terrarium':
      c.fillStyle = vgrad(c, 44, H, '#f0dca6', '#e2c88a'); c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(180,140,80,.35)'; c.lineWidth = 1.5;
      for (let y = 70; y < H; y += 22) { c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x * 0.05 + y) * 3); c.stroke(); }
      for (let k = 0; k < 40; k++) { ell(c, R() * W, 60 + R() * (H - 70), 1.5 + R() * 2.5, 1 + R() * 1.5); fl(c, 'rgba(140,110,70,.4)'); }
      break;
    case 'pond':
      c.fillStyle = vgrad(c, 44, H, '#9fd473', '#8cc664'); c.fillRect(0, 0, W, H);
      break;
    case 'paddock':
      for (let x = -40, k = 0; x < W + 40; x += 38, k++) { c.fillStyle = k % 2 ? '#94d06a' : '#86c65e'; c.beginPath(); c.moveTo(x, 44); c.lineTo(x + 38, 44); c.lineTo(x + 58, H); c.lineTo(x + 20, H); c.closePath(); c.fill(); }
      for (let k = 0; k < 30; k++) { circ(c, R() * W, 60 + R() * (H - 70), 1.6); fl(c, ['#fff', '#ffd23f'][k % 2]); }
      break;
    case 'sanctuary':
      c.fillStyle = vgrad(c, 44, H, '#6aa94e', '#5a9a42'); c.fillRect(0, 0, W, H);
      for (let k = 0; k < 120; k++) { ell(c, R() * W, 50 + R() * (H - 55), 2 + R() * 3, 1 + R() * 1.5, R() * 3); fl(c, ['rgba(170,110,40,.5)', 'rgba(220,150,50,.45)', 'rgba(120,80,30,.5)'][k % 3]); }
      break;
  }
  // Ambient occlusion along the walls
  for (let k = 0; k < 4; k++) { rr(c, 2 + k * 3, 46 + k * 3, W - 4 - k * 6, H - 48 - k * 6, 16); c.lineWidth = 3; c.strokeStyle = `rgba(30,25,10,${0.09 - k * 0.02})`; c.stroke(); }
  c.fillStyle = vgrad(c, 44, 80, 'rgba(30,25,10,.18)', 'rgba(30,25,10,0)'); c.fillRect(0, 44, W, 36);
  c.restore();
}

function pondWater(c, L, r) {
  const w = L.water, cx = w.cx - r.x, cy = w.cy - r.y;
  ell(c, cx, cy + 4, w.rx + 18, w.ry + 15); fl(c, '#e5d19c');
  ell(c, cx, cy, w.rx + 6, w.ry + 5); fl(c, '#7cc6a8');
  ell(c, cx, cy, w.rx, w.ry);
  const g = c.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w.rx, w.ry));
  g.addColorStop(0, '#2b84b8'); g.addColorStop(0.7, '#3fa3d6'); g.addColorStop(1, '#7fd0ea');
  c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
}

function mess(c, p, i) {
  const n = Math.floor((100 - p.clean) / 11);
  const R = rng(i * 31 + 5);
  for (let k = 0; k < n; k++) {
    const x = 44 + R() * (LOT_W - 88), y = 96 + R() * (LOT_H - 140);
    if (p.group === 'pond') { ell(c, x, y, 8, 3.5); fl(c, 'rgba(80,120,40,.55)'); continue; }
    ell(c, x + 1, y + 2, 7, 3); fl(c, 'rgba(40,30,10,.25)');
    c.strokeStyle = OUT; c.lineWidth = 1.4;
    ell(c, x, y, 6, 3.5); fs(c, '#7d5431'); ell(c, x + 0.8, y - 3.4, 4.2, 2.8); fs(c, '#8a5e38'); ell(c, x + 1.4, y - 6, 2.4, 1.8); fs(c, '#966843');
  }
}

function renderLotBase(i, p, R) {
  const PAD = 40;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((LOT_W + PAD * 2) * R); cv.height = Math.ceil((LOT_H + PAD * 2) * R);
  const c = cv.getContext('2d');
  c.setTransform(R, 0, 0, R, PAD * R, PAD * R);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 2;
  const S = E.S;
  if (i >= S.plotsOwned) {
    rr(c, 0, 20, LOT_W, LOT_H - 20, 26); fl(c, 'rgba(40,90,30,.35)');
    const Rn = rng(i * 99 + 3);
    for (let k = 0; k < 70; k++) { const x = 10 + Rn() * (LOT_W - 20), y = 30 + Rn() * (LOT_H - 40); c.strokeStyle = 'rgba(40,110,30,.6)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 8); c.moveTo(x + 2, y); c.lineTo(x + 3, y - 9); c.stroke(); }
    return cv;
  }
  if (!p) {
    rr(c, 4, 24, LOT_W - 8, LOT_H - 28, 20); fl(c, 'rgba(255,255,230,.12)');
    c.strokeStyle = '#c9a46a'; c.lineWidth = 2.2; c.setLineDash([10, 8]); rr(c, 10, 30, LOT_W - 20, LOT_H - 40, 16); c.stroke(); c.setLineDash([]);
    c.strokeStyle = OUT; c.lineWidth = 1.6;
    for (const [x, y] of [[10, 30], [LOT_W - 10, 30], [10, LOT_H - 10], [LOT_W - 10, LOT_H - 10]]) { rr(c, x - 3, y - 14, 6, 16, 2); fs(c, '#b07a45'); }
    return cv;
  }
  if (p.kind !== 'habitat') {
    rr(c, 0, 34, LOT_W, LOT_H - 34, 20);
    c.fillStyle = p.type === 'showring' ? vgrad(c, 34, LOT_H, '#e6cf9e', '#d6ba82') : vgrad(c, 34, LOT_H, '#a2d478', '#8cc562'); c.fill();
    for (let k = 0; k < 3; k++) { rr(c, 2 + k * 3, 36 + k * 3, LOT_W - 4 - k * 6, LOT_H - 38 - k * 6, 18); c.lineWidth = 3; c.strokeStyle = `rgba(30,25,10,${0.07 - k * 0.02})`; c.stroke(); }
    return cv;
  }
  const g = p.group;
  softShadow(c, LOT_W / 2, LOT_H + 6, LOT_W * 0.55, 18, 0.18);
  floor(c, g, i);
  if (g === 'pond') pondWater(c, layout(i, g), lotRect(i));
  mess(c, p, i);
  const st = FENCE[g];
  fence(c, 0, 48, LOT_W, 48, st);
  fence(c, 0, 48, 0, LOT_H, st);
  fence(c, LOT_W, 48, LOT_W, LOT_H, st);
  return cv;
}

function renderLotFront(i, p, R, count) {
  const PAD = 40;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((LOT_W + PAD * 2) * R); cv.height = Math.ceil((LOT_H + PAD * 2) * R);
  const c = cv.getContext('2d');
  c.setTransform(R, 0, 0, R, PAD * R, PAD * R);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 2;
  const g = p.group, st = FENCE[g], gx = LOT_W / 2, y = LOT_H;
  fence(c, 0, y, gx - 36, y, st);
  fence(c, gx + 36, y, LOT_W, y, st);
  if (g === 'aviary') {
    // Netting roof and a tall frame give the aviary height
    c.strokeStyle = 'rgba(60,80,65,.22)'; c.lineWidth = 1;
    for (let x = 0; x <= LOT_W; x += 14) { c.beginPath(); c.moveTo(x, -16); c.lineTo(x, y - 64); c.stroke(); }
    for (let yy = -16; yy <= y - 64; yy += 14) { c.beginPath(); c.moveTo(0, yy); c.lineTo(LOT_W, yy); c.stroke(); }
    c.strokeStyle = OUT; c.lineWidth = 2;
    for (const x of [0, LOT_W]) { rr(c, x - 4, -16, 8, y + 16, 2); c.fillStyle = hgrad(c, x - 4, x + 4, '#5d7a66', '#3b5244'); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(0, -16); c.lineTo(LOT_W, -16); c.lineWidth = 6; c.stroke(); c.lineWidth = 3.6; c.strokeStyle = '#5d7a66'; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2;
  }
  // Gate arch with a hanging name board
  const col = GROUPS[g].colour;
  for (const x of [gx - 38, gx + 38]) { rr(c, x - 6, y - 70, 12, 72, 3); c.fillStyle = hgrad(c, x - 6, x + 6, '#c98d52', '#8a5a2e'); c.fill(); c.stroke(); rr(c, x - 8, y - 76, 16, 8, 3); fs(c, '#d9a066'); }
  c.beginPath(); c.moveTo(gx - 44, y - 70); c.quadraticCurveTo(gx, y - 92, gx + 44, y - 70); c.lineWidth = 8; c.stroke(); c.lineWidth = 5.4; c.strokeStyle = '#b97d44'; c.stroke();
  c.strokeStyle = OUT; c.lineWidth = 2;
  // Lanterns
  for (const x of [gx - 38, gx + 38]) { rr(c, x - 5, y - 64, 10, 12, 3); fs(c, '#ffe39a'); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x - 3, y - 62, 2, 7); }
  // Sign
  c.font = '600 15px Fredoka, sans-serif';
  const name = GROUPS[g].name.toUpperCase();
  const w = Math.max(96, c.measureText(name).width + 30);
  c.beginPath(); c.moveTo(gx - 18, y - 84); c.lineTo(gx - 22, y - 70); c.moveTo(gx + 18, y - 84); c.lineTo(gx + 22, y - 70); c.lineWidth = 1.4; c.stroke(); c.lineWidth = 2;
  rr(c, gx - w / 2 + 2, y - 70 + 3, w, 34, 9); fl(c, 'rgba(30,20,5,.25)');
  rr(c, gx - w / 2, y - 70, w, 34, 9); c.fillStyle = vgrad(c, y - 70, y - 36, col, shadeHex(col, -0.12)); c.fill(); c.stroke();
  rr(c, gx - w / 2 + 3, y - 67, w - 6, 6, 4); fl(c, 'rgba(255,255,255,.22)');
  label(c, name, gx, y - 58, 14);
  for (let k = 0; k < 5; k++) { circ(c, gx - 20 + k * 10, y - 44, 3); c.lineWidth = 1.2; fs(c, k < p.lvl ? '#ffd23f' : 'rgba(255,255,255,.35)'); }
  c.lineWidth = 2;
  // Capacity badge
  const cap = E.habitatCap(p);
  const txt = `${count}/${cap}`;
  c.font = '700 11px Nunito, sans-serif';
  const bw = c.measureText(txt).width + 14;
  rr(c, gx + w / 2 - bw + 6, y - 82, bw, 17, 8); fs(c, count >= cap ? '#ffd23f' : '#fffdf8');
  c.fillStyle = OUT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, gx + w / 2 - bw / 2 + 6, y - 73.5);
  if (g === 'terrarium') { rr(c, 0, y - 54, LOT_W, 44, 3); c.fillStyle = 'rgba(200,235,255,.18)'; c.fill(); }
  return cv;
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
}

export function lotBase(c, i, p, R) {
  const r = lotRect(i);
  const key = `b${i}|${i < E.S.plotsOwned ? 'o' : 'l'}|${p ? (p.kind === 'habitat' ? p.group + p.lvl + Math.floor((100 - p.clean) / 11) : p.type) : '-'}|${p && p.building ? 'c' : ''}|${R}`;
  let cv = lotCache.get(key);
  if (!cv) { cv = renderLotBase(i, p && !p.building ? p : (p && p.building ? null : p), R); lotCache.set(key, cv); lru(lotCache, 60); }
  c.drawImage(cv, r.x - 40, r.y - 40, LOT_W + 80, LOT_H + 80);
}
export function lotFront(c, i, p, R) {
  const r = lotRect(i), count = E.animalsIn(i).length;
  const key = `f${i}|${p.group}|${p.lvl}|${count}|${R}`;
  let cv = lotCache.get(key);
  if (!cv) { cv = renderLotFront(i, p, R, count); lotCache.set(key, cv); lru(lotCache, 60); }
  c.drawImage(cv, r.x - 40, r.y - 40, LOT_W + 80, LOT_H + 80);
}

// Animated parts of a habitat drawn under the animals.
export function lotLive(c, i, p, t) {
  const r = lotRect(i), L = layout(i, p.group);
  c.save(); c.strokeStyle = OUT; c.lineWidth = 2; c.lineJoin = 'round';
  if (p.group === 'pond') {
    const w = L.water;
    c.save(); ell(c, w.cx, w.cy, w.rx - 2, w.ry - 2); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.38)'; c.lineWidth = 1.6;
    for (let k = 0; k < 9; k++) { const ph = (t * 0.25 + k / 9) % 1; const x = w.cx - w.rx + ((k * 83) % (w.rx * 2)), y = w.cy - w.ry + 18 + ((k * 37) % (w.ry * 2 - 30)); c.globalAlpha = Math.sin(ph * Math.PI); c.beginPath(); c.ellipse(x, y, 8 + ph * 16, 3 + ph * 6, 0, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
    for (let k = 0; k < 14; k++) { const x = w.cx + Math.sin(k * 7.1 + t * 0.6) * w.rx * 0.8, y = w.cy + Math.cos(k * 3.3 + t * 0.4) * w.ry * 0.7; c.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(t * 3 + k)})`; c.fillRect(x, y, 3, 1.4); }
    c.restore();
  } else {
    const list = E.animalsIn(i);
    const avg = list.length ? list.reduce((s, a) => s + a.hunger, 0) / list.length : 100;
    softShadow(c, L.bowl.x + 2, L.bowl.y + 4, 20, 6, 0.25);
    ell(c, L.bowl.x, L.bowl.y, 16, 7.5); c.fillStyle = vgrad(c, L.bowl.y - 8, L.bowl.y + 8, '#ef6b62', '#c2443c'); c.fill(); c.stroke();
    ell(c, L.bowl.x, L.bowl.y - 2.5, 12, 4.5); fl(c, '#5a2a20');
    if (avg > 40) for (let k = 0; k < 9; k++) { ell(c, L.bowl.x - 8 + (k % 5) * 4, L.bowl.y - 4 - Math.floor(k / 5) * 1.5, 2.2, 1.6); fl(c, k % 2 ? '#c88a4a' : '#a8693a'); }
    softShadow(c, L.water.x + 2, L.water.y + 4, 18, 5, 0.22);
    ell(c, L.water.x, L.water.y, 14, 6.5); c.fillStyle = vgrad(c, L.water.y - 7, L.water.y + 7, '#5d9ae0', '#3a6fb8'); c.fill(); c.stroke();
    ell(c, L.water.x, L.water.y - 2, 10, 3.6); fl(c, '#a6e0ff');
    ell(c, L.water.x - 3, L.water.y - 3, 3, 1); fl(c, `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 2)})`);
  }
  c.restore();
}

// ---------- props ----------
export function prop(c, o, t) {
  c.save(); c.translate(o.x, o.y); c.strokeStyle = OUT; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round';
  const s = o.s || 1; c.scale(s, s);
  switch (o.type) {
    case 'doghouse':
      softShadow(c, 4, 2, 46, 10);
      rr(c, -32, -46, 64, 48, 4); c.fillStyle = hgrad(c, -32, 32, '#e2b26a', '#c4914a'); c.fill(); c.stroke();
      c.fillStyle = 'rgba(120,70,30,.22)'; for (let y = -38; y < 0; y += 8) c.fillRect(-31, y, 62, 1.5);
      c.beginPath(); c.moveTo(-42, -40); c.lineTo(0, -76); c.lineTo(42, -40); c.closePath(); c.fillStyle = vgrad(c, -76, -40, o.colour || '#d65a48', shadeHex(o.colour || '#d65a48', -0.15)); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-14, 2); c.lineTo(-14, -20); c.arc(0, -20, 14, Math.PI, 0); c.lineTo(14, 2); c.closePath(); fs(c, '#3a2412');
      rr(c, -10, -64, 20, 10, 3); fs(c, '#fff3d6');
      break;
    case 'ball': softShadow(c, 1, 6, 9, 3); circ(c, 0, 0, 7); c.fillStyle = vgrad(c, -7, 7, '#ff7a7f', '#d9444a'); c.fill(); c.stroke(); c.beginPath(); c.arc(0, 0, 7, -0.6, 0.6); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); break;
    case 'bone': softShadow(c, 0, 4, 14, 3); rr(c, -9, -3, 18, 6, 3); fs(c, '#fffaf0'); for (const [x, y] of [[-9, -3], [-9, 3], [9, -3], [9, 3]]) { circ(c, x, y, 3.6); fs(c, '#fffaf0'); } break;
    case 'tyre': softShadow(c, 0, 4, 24, 6); ell(c, 0, -4, 19, 11); fs(c, '#3a3a3a'); ell(c, 0, -5, 10, 5); fs(c, '#9ccb6c'); c.strokeStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.ellipse(0, -4, 15, 8, 0, 3.6, 5.6); c.stroke(); break;
    case 'cattree':
      softShadow(c, 2, 2, 28, 7);
      rr(c, -6, -78, 12, 78, 4); c.fillStyle = hgrad(c, -6, 6, '#ecdcb6', '#c9b48c'); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(120,90,50,.4)'; c.lineWidth = 1; for (let y = -74; y < 0; y += 5) { c.beginPath(); c.moveTo(-6, y); c.lineTo(6, y + 2); c.stroke(); } c.strokeStyle = OUT; c.lineWidth = 2;
      for (const [x, y, w] of [[-26, -26, 52], [-22, -54, 44], [-18, -82, 36]]) { rr(c, x, y, w, 10, 5); c.fillStyle = vgrad(c, y, y + 10, '#c497ea', '#9a6cc8'); c.fill(); c.stroke(); }
      ell(c, 0, -1, 24, 7); fs(c, '#a87bd6');
      break;
    case 'cushion': softShadow(c, 0, 2, 30, 7); ell(c, 0, -4, 27, 12); c.fillStyle = vgrad(c, -16, 8, '#ffb0c6', '#ef7e9e'); c.fill(); c.stroke(); ell(c, 0, -6, 18, 6); fl(c, 'rgba(255,230,238,.7)'); break;
    case 'yarn': softShadow(c, 0, 2, 10, 3); circ(c, 0, -7, 8); c.fillStyle = vgrad(c, -15, 1, '#7fe3d6', '#2fa89a'); c.fill(); c.stroke(); c.beginPath(); c.arc(0, -7, 5, 0.3, 2.6); c.moveTo(-4, -11); c.quadraticCurveTo(2, -6, 4, -2); c.lineWidth = 1.2; c.stroke(); c.beginPath(); c.moveTo(7, -3); c.quadraticCurveTo(16, 2, 24, -1); c.strokeStyle = '#2fa89a'; c.lineWidth = 2; c.stroke(); break;
    case 'box': softShadow(c, 0, 2, 26, 6); c.beginPath(); c.moveTo(-20, 0); c.lineTo(-20, -24); c.lineTo(20, -24); c.lineTo(20, 0); c.closePath(); c.fillStyle = hgrad(c, -20, 20, '#d9ab6a', '#bd8f52'); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-20, -24); c.lineTo(-28, -36); c.lineTo(12, -36); c.lineTo(20, -24); c.closePath(); fs(c, '#e8bd7c'); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-2, -22, 4, 20); break;
    case 'hutchbox':
      softShadow(c, 4, 2, 40, 9);
      rr(c, -32, -42, 64, 44, 4); c.fillStyle = hgrad(c, -32, 32, '#c48a52', '#9e6a38'); c.fill(); c.stroke();
      rr(c, -25, -35, 21, 27, 3); fs(c, '#3a2412');
      rr(c, 2, -35, 23, 27, 3); fl(c, 'rgba(200,230,240,.35)'); c.stroke(); c.lineWidth = 1; for (let x = 6; x < 25; x += 4) { c.beginPath(); c.moveTo(x, -35); c.lineTo(x, -8); c.stroke(); } c.lineWidth = 2;
      c.beginPath(); c.moveTo(-38, -38); c.lineTo(0, -60); c.lineTo(38, -38); c.closePath(); c.fillStyle = vgrad(c, -60, -38, '#8a5a2e', '#6b4320'); c.fill(); c.stroke();
      break;
    case 'tunnel': softShadow(c, 0, 4, 40, 8); ell(c, 0, -11, 38, 14); c.fillStyle = vgrad(c, -25, 3, '#6fc0ea', '#3a8cc0'); c.fill(); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; for (let x = -28; x < 30; x += 9) { c.beginPath(); c.ellipse(x, -11, 3, 13, 0, -1.4, 1.4); c.stroke(); } c.strokeStyle = OUT; c.lineWidth = 2; ell(c, 36, -11, 6.5, 12); fs(c, '#2a1a10'); break;
    case 'hay': softShadow(c, 0, 2, 26, 6); for (const [x, y] of [[-12, -6], [10, -8], [0, -16]]) { ell(c, x, y, 16, 9); c.fillStyle = vgrad(c, y - 9, y + 9, '#f6dc7a', '#d8b54a'); c.fill(); c.stroke(); } c.strokeStyle = '#c9a446'; c.lineWidth = 1; for (let k = 0; k < 10; k++) { c.beginPath(); c.moveTo(-18 + k * 4, -8); c.lineTo(-15 + k * 4, -14); c.stroke(); } break;
    case 'carrots': for (let k = 0; k < 3; k++) { c.save(); c.translate(k * 9 - 9, -2); c.rotate(-0.4 + k * 0.3); c.beginPath(); c.moveTo(-3.5, 0); c.lineTo(0, -19); c.lineTo(3.5, 0); c.closePath(); c.fillStyle = hgrad(c, -3.5, 3.5, '#ff9a3a', '#e06a1a'); c.fill(); c.stroke(); c.fillStyle = '#4a9a3e'; c.beginPath(); c.moveTo(-1, -19); c.lineTo(-4, -27); c.lineTo(0, -22); c.lineTo(3, -27); c.lineTo(1, -19); c.fill(); c.restore(); } break;
    case 'rock': softShadow(c, 4, 0, 30, 7); ell(c, 0, -9, 25, 15); c.fillStyle = vgrad(c, -24, 6, '#c2b9a4', '#8e8572'); c.fill(); c.stroke(); ell(c, -7, -16, 10, 4.5); fl(c, 'rgba(255,255,255,.3)'); ell(c, 9, -4, 4, 2); fl(c, 'rgba(90,150,60,.6)'); break;
    case 'log': softShadow(c, 0, 2, 40, 7); rr(c, -34, -17, 68, 17, 8); c.fillStyle = vgrad(c, -17, 0, '#9a6a3a', '#6e4520'); c.fill(); c.stroke(); c.strokeStyle = 'rgba(40,20,5,.35)'; c.lineWidth = 1; for (let x = -26; x < 28; x += 9) { c.beginPath(); c.moveTo(x, -14); c.lineTo(x + 6, -14); c.stroke(); } c.strokeStyle = OUT; c.lineWidth = 2; ell(c, 34, -8.5, 6, 8.5); fs(c, '#e2be8a'); ell(c, 34, -8.5, 3, 4.5); c.lineWidth = 1; c.stroke(); break;
    case 'cactus': softShadow(c, 2, 2, 18, 5); for (const [x, y, w, h] of [[-7, -44, 14, 44], [-19, -32, 10, 18], [9, -38, 10, 20]]) { rr(c, x, y, w, h, 5); c.fillStyle = hgrad(c, x, x + w, '#6cc05a', '#3f8a35'); c.fill(); c.stroke(); } c.fillStyle = '#ff7fb0'; circ(c, 0, -46, 3.5); c.fill(); c.stroke(); break;
    case 'heatlamp': {
      c.fillStyle = '#555'; c.fillRect(-2, -96, 4, 96);
      rr(c, -16, -108, 32, 15, 6); fs(c, '#4a4a4a');
      const g = c.createRadialGradient(0, -60, 4, 0, -20, 110); g.addColorStop(0, `rgba(255,170,60,${0.35 + 0.05 * Math.sin(t * 3)})`); g.addColorStop(1, 'rgba(255,170,60,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-14, -94); c.lineTo(-80, 50); c.lineTo(80, 50); c.lineTo(14, -94); c.fill();
      ell(c, 0, -93, 12, 3); fl(c, '#ffd27a');
      break; }
    case 'dish': softShadow(c, 0, 3, 20, 5); ell(c, 0, -2, 17, 7.5); c.fillStyle = vgrad(c, -9, 6, '#a8a8a8', '#7a7a7a'); c.fill(); c.stroke(); ell(c, 0, -3, 12.5, 4.5); fl(c, '#8fd8ff'); break;
    case 'lily': c.translate(Math.sin(t * 0.7 + o.x) * 1.5, 0); ell(c, 0, 0, 17, 7.5); c.fillStyle = vgrad(c, -7, 7, '#6cc05a', '#3f8a35'); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, 0); c.lineTo(16, -3); c.lineTo(16, 3); c.closePath(); fl(c, '#3fa3d6'); for (let k = 0; k < 5; k++) { ell(c, -3 + Math.cos(k * 1.26) * 3, -4 + Math.sin(k * 1.26) * 2, 3, 2, k * 1.26); fs(c, k % 2 ? '#ffb6d0' : '#ffd6e4'); } circ(c, -3, -4, 1.6); fl(c, '#ffd23f'); break;
    case 'reeds': for (let k = -2; k <= 2; k++) { const sw = Math.sin(t * 1.4 + k + o.x) * 2.5; c.beginPath(); c.moveTo(k * 4, 0); c.quadraticCurveTo(k * 6, -22, k * 5 + sw, -44); c.lineWidth = 3.4; c.strokeStyle = '#3f7a2a'; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#6cae46'; c.stroke(); rr(c, k * 5 - 2.5 + sw, -48, 5, 13, 2.5); c.strokeStyle = OUT; c.lineWidth = 1.2; fs(c, '#7a4b24'); } break;
    case 'barn':
      softShadow(c, 6, 2, 64, 12);
      rr(c, -46, -58, 92, 60, 3); c.fillStyle = hgrad(c, -46, 46, '#e0574a', '#b23a30'); c.fill(); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.12)'; for (let x = -40; x < 46; x += 10) c.fillRect(x, -56, 1.5, 56);
      c.beginPath(); c.moveTo(-54, -54); c.lineTo(0, -88); c.lineTo(54, -54); c.closePath(); c.fillStyle = vgrad(c, -88, -54, '#8a3228', '#6a2218'); c.fill(); c.stroke();
      rr(c, -19, -38, 38, 40, 2); fs(c, '#fbfbf5'); c.beginPath(); c.moveTo(-19, -38); c.lineTo(19, 2); c.moveTo(19, -38); c.lineTo(-19, 2); c.stroke();
      circ(c, 0, -66, 7); fs(c, '#fbfbf5');
      break;
    case 'haybale': softShadow(c, 2, 2, 24, 5); rr(c, -20, -25, 40, 25, 6); c.fillStyle = vgrad(c, -25, 0, '#f6dc7a', '#d2ac40'); c.fill(); c.stroke(); c.strokeStyle = '#a8812a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-8, -25); c.lineTo(-8, 0); c.moveTo(8, -25); c.lineTo(8, 0); c.stroke(); break;
    case 'trough': softShadow(c, 0, 3, 46, 7); rr(c, -40, -19, 80, 19, 4); c.fillStyle = vgrad(c, -19, 0, '#a8723e', '#7a4e26'); c.fill(); c.stroke(); rr(c, -35, -17, 70, 6, 3); fl(c, '#8fd8ff'); c.fillStyle = `rgba(255,255,255,${0.4 + 0.3 * Math.sin(t * 2)})`; c.fillRect(-20, -16, 10, 1.5); break;
    case 'gumtree': {
      softShadow(c, 10, 2, 46, 10);
      c.beginPath(); c.moveTo(-8, 2); c.quadraticCurveTo(-4, -40, -9, -72); c.lineTo(7, -72); c.quadraticCurveTo(3, -40, 9, 2); c.closePath(); c.fillStyle = hgrad(c, -9, 9, '#f6f0e6', '#cfc6b4'); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(0, -46); c.lineTo(28, -54); c.lineWidth = 6; c.stroke(); c.lineWidth = 3.6; c.strokeStyle = '#e6dccb'; c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2;
      canopy(c, [[-22, -86, 24], [14, -96, 26], [-2, -112, 22], [30, -72, 16]], '#4f8d50', '#6aa864', '#8cc47e', t, 0.4);
      break; }
    case 'pool': softShadow(c, 0, 2, 38, 8); ell(c, 0, -4, 35, 14); c.fillStyle = vgrad(c, -18, 10, '#5fbde6', '#2e8cc0'); c.fill(); c.stroke(); ell(c, -9, -8, 13, 3.5); fl(c, 'rgba(255,255,255,.4)'); break;
    case 'fern': for (let k = -3; k <= 3; k++) { c.save(); c.rotate(k * 0.32 + Math.sin(t + o.x) * 0.03); ell(c, 0, -16, 4.5, 16); c.fillStyle = vgrad(c, -32, 0, '#6cb85a', '#3f8a35'); c.fill(); c.lineWidth = 1.2; c.stroke(); c.restore(); } break;
    case 'birdbath': softShadow(c, 0, 2, 22, 5); rr(c, -5, -26, 10, 26, 2); fs(c, '#d6cfc0'); ell(c, 0, -28, 21, 7.5); c.fillStyle = vgrad(c, -35, -20, '#e6e0d2', '#b9b1a0'); c.fill(); c.stroke(); ell(c, 0, -29, 16, 4.8); fl(c, '#8fd8ff'); break;
    case 'perch':
      softShadow(c, 0, 2, 16, 4);
      rr(c, -3.5, -o.z, 7, o.z + 1, 3); c.fillStyle = hgrad(c, -3.5, 3.5, '#b07a45', '#7a4e26'); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-28, -o.z); c.quadraticCurveTo(0, -o.z - 4, 28, -o.z); c.lineWidth = 7; c.stroke(); c.lineWidth = 4.4; c.strokeStyle = '#b07a45'; c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2;
      for (const [x, y] of [[-26, -o.z - 5], [24, -o.z - 4]]) { ell(c, x, y, 7, 4.5, 0.3); fs(c, '#6cb85a'); }
      break;
  }
  c.restore();
}

function canopy(c, blobs, dark, mid, light, t, seed) {
  const sway = Math.sin(t * 1.2 + seed * 20) * 1.6;
  c.save(); c.translate(sway, 0);
  for (const [x, y, r] of blobs) { ell(c, x, y, r, r * 0.86); c.stroke(); }
  for (const [x, y, r] of blobs) { ell(c, x, y, r, r * 0.86); fl(c, dark); }
  for (const [x, y, r] of blobs) { ell(c, x - r * 0.16, y - r * 0.2, r * 0.74, r * 0.6); fl(c, mid); }
  for (const [x, y, r] of blobs) { ell(c, x - r * 0.34, y - r * 0.38, r * 0.32, r * 0.24); fl(c, light); }
  c.restore();
}

// ---------- scenery ----------
export function scenery(c, o, t, night) {
  const s = o.s || 1;
  c.save(); c.translate(o.x, o.y); c.scale(s, s); c.strokeStyle = OUT; c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round';
  switch (o.type) {
    case 'oak':
      softShadow(c, 14, 2, 42, 11);
      c.beginPath(); c.moveTo(-8, 2); c.quadraticCurveTo(-5, -20, -7, -40); c.lineTo(7, -40); c.quadraticCurveTo(5, -20, 9, 2); c.closePath(); c.fillStyle = hgrad(c, -8, 9, '#a4703e', '#6e4520'); c.fill(); c.stroke();
      canopy(c, [[0, -70, 32], [-24, -52, 22], [24, -52, 22], [-12, -88, 20], [14, -86, 18]], '#3d8a3a', '#55a64a', '#86cc6a', t, o.seed || 0);
      break;
    case 'gum':
      softShadow(c, 14, 2, 36, 10);
      c.beginPath(); c.moveTo(-6, 2); c.quadraticCurveTo(-3, -32, -8, -64); c.lineTo(5, -64); c.quadraticCurveTo(2, -32, 7, 2); c.closePath(); c.fillStyle = hgrad(c, -6, 7, '#f6f0e6', '#c9bfac'); c.fill(); c.stroke();
      c.fillStyle = 'rgba(150,130,100,.35)'; c.fillRect(-3, -44, 4, 9); c.fillRect(0, -22, 3, 7);
      canopy(c, [[-18, -68, 20], [12, -76, 22], [-4, -94, 20], [20, -58, 15], [-26, -54, 14]], '#5a9256', '#72ac6a', '#9ccc8a', t, o.seed || 0);
      break;
    case 'pine':
      softShadow(c, 12, 2, 30, 9);
      rr(c, -5, -18, 10, 20, 2); fs(c, '#7a4e26');
      for (const [y, w] of [[-18, 30], [-40, 25], [-60, 19], [-78, 13]]) { c.beginPath(); c.moveTo(-w, y); c.lineTo(0, y - 34); c.lineTo(w, y); c.closePath(); c.fillStyle = hgrad(c, -w, w, '#3f9a5a', '#25683c'); c.fill(); c.stroke(); }
      break;
    case 'bush':
      softShadow(c, 6, 2, 24, 6);
      canopy(c, [[-10, -10, 12], [8, -12, 13], [0, -21, 12]], '#3f8a3a', '#58a84a', '#8acc6a', t, o.seed || 0);
      for (const [x, y] of [[-6, -16], [7, -21], [11, -8], [-12, -6]]) { circ(c, x, y, 2.2); fl(c, (o.seed || 0) < 0.5 ? '#ff6b8a' : '#ffffff'); }
      break;
    case 'lamp':
      softShadow(c, 3, 2, 12, 4);
      rr(c, -2.5, -60, 5, 62, 2); fs(c, '#3d3d40');
      rr(c, -9, -76, 18, 18, 4); fs(c, night > 0.15 ? '#ffe39a' : '#fff7dc');
      c.beginPath(); c.moveTo(-11, -76); c.lineTo(0, -84); c.lineTo(11, -76); c.closePath(); fs(c, '#3d3d40');
      break;
    case 'mailbox': softShadow(c, 2, 2, 12, 4); rr(c, -2.5, -28, 5, 30, 2); fs(c, '#6b4a2e'); rr(c, -11, -42, 22, 16, 7); c.fillStyle = vgrad(c, -42, -26, '#e8655a', '#bb3d33'); c.fill(); c.stroke(); c.fillStyle = '#ffd23f'; c.fillRect(9, -46, 2.5, 10); break;
    case 'cart':
      softShadow(c, 0, 4, 42, 8);
      rr(c, -36, -34, 72, 22, 4); c.fillStyle = hgrad(c, -36, 36, '#c48a52', '#8a5a2e'); c.fill(); c.stroke();
      for (const [x, y] of [[-26, -46], [-8, -48], [10, -47], [26, -44]]) { ell(c, x, y, 13, 9); c.fillStyle = vgrad(c, y - 9, y + 9, '#f6dc7a', '#d2ac40'); c.fill(); c.stroke(); }
      for (const x of [-22, 22]) { circ(c, x, -8, 11); fs(c, '#6b4320'); circ(c, x, -8, 3); fs(c, '#b8b0a0'); }
      break;
    case 'barrel': softShadow(c, 2, 2, 16, 4); rr(c, -13, -32, 26, 33, 8); c.fillStyle = hgrad(c, -13, 13, '#b07a45', '#7a4e26'); c.fill(); c.stroke(); for (const y of [-26, -8]) { c.beginPath(); c.moveTo(-13, y); c.lineTo(13, y); c.lineWidth = 3; c.strokeStyle = '#5a5a5a'; c.stroke(); } break;
    case 'flowerbed':
      rr(c, -40, -12, 80, 14, 4); c.fillStyle = hgrad(c, -40, 40, '#b07a45', '#7a4e26'); c.fill(); c.stroke();
      for (let k = 0; k < 9; k++) { const x = -34 + k * 8.5, y = -16 - (k % 2) * 4; circ(c, x, y, 5); fl(c, '#4a9a3e'); circ(c, x, y - 3, 3.4); fl(c, ['#ff6b8a', '#ffd23f', '#ffffff', '#b98cff'][k % 4]); }
      break;
  }
  c.restore();
}

// ---------- farmhouse ----------
export function house(c, t, night) {
  const h = HOUSE, x = h.x, y = h.y, w = h.w, cx = x + w / 2, base = y + h.h;
  c.save(); c.strokeStyle = OUT; c.lineWidth = 2.4; c.lineJoin = 'round';
  softShadow(c, cx + 20, base + 4, w * 0.62, 26, 0.25);
  // Walls
  rr(c, x + 24, y + 78, w - 48, h.h - 78, 6); c.fillStyle = vgrad(c, y + 78, base, '#fbf1da', '#ead9b4'); c.fill(); c.stroke();
  c.fillStyle = 'rgba(160,110,60,.18)'; for (let yy = y + 92; yy < base - 2; yy += 13) c.fillRect(x + 26, yy, w - 52, 2);
  // Roof
  c.beginPath(); c.moveTo(x - 6, y + 92); c.lineTo(cx, y - 4); c.lineTo(x + w + 6, y + 92); c.closePath();
  c.fillStyle = vgrad(c, y, y + 92, '#e0604c', '#b03c2e'); c.fill(); c.stroke();
  c.save(); c.clip(); c.strokeStyle = 'rgba(80,20,10,.25)'; c.lineWidth = 1.5; for (let k = 0; k < 9; k++) { const yy = y + 10 + k * 10; c.beginPath(); c.moveTo(x - 10, yy); c.lineTo(x + w + 10, yy); c.stroke(); } c.restore();
  c.beginPath(); c.moveTo(x - 6, y + 92); c.lineTo(x + w + 6, y + 92); c.lineWidth = 6; c.stroke(); c.lineWidth = 3.6; c.strokeStyle = '#8a2e22'; c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2.4;
  // Chimney and smoke
  rr(c, x + w - 96, y + 6, 28, 50, 3); c.fillStyle = hgrad(c, x + w - 96, x + w - 68, '#b55a48', '#8a3a2e'); c.fill(); c.stroke();
  rr(c, x + w - 100, y + 2, 36, 9, 3); fs(c, '#9a4a3a');
  for (let k = 0; k < 4; k++) { const p = (t * 0.18 + k / 4) % 1; c.globalAlpha = (1 - p) * 0.5; circ(c, x + w - 82 + Math.sin(p * 5 + k) * 8 + p * 20, y - p * 70, 7 + p * 14); fl(c, '#f4f4f4'); }
  c.globalAlpha = 1;
  // Attic window
  circ(c, cx, y + 48, 16); fs(c, night > 0.15 ? '#ffe28a' : '#bfe6ff'); c.beginPath(); c.moveTo(cx - 16, y + 48); c.lineTo(cx + 16, y + 48); c.moveTo(cx, y + 32); c.lineTo(cx, y + 64); c.lineWidth = 2; c.stroke();
  // Porch
  rr(c, cx - 96, base - 16, 192, 16, 3); c.fillStyle = vgrad(c, base - 16, base, '#c9965a', '#9a6a3a'); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(cx - 108, base - 74); c.lineTo(cx + 108, base - 74); c.lineTo(cx + 96, base - 92); c.lineTo(cx - 96, base - 92); c.closePath(); c.fillStyle = vgrad(c, base - 92, base - 74, '#7fae5a', '#5a8a3a'); c.fill(); c.stroke();
  for (const px of [cx - 92, cx + 92]) { rr(c, px - 4, base - 74, 8, 60, 2); fs(c, '#fbfbf5'); }
  // Door
  rr(c, cx - 22, base - 66, 44, 50, 4); c.fillStyle = vgrad(c, base - 66, base - 16, '#8a5a2e', '#5e3a1a'); c.fill(); c.stroke();
  rr(c, cx - 15, base - 58, 30, 14, 3); fl(c, night > 0.15 ? 'rgba(255,220,130,.9)' : 'rgba(190,230,255,.8)');
  circ(c, cx + 13, base - 38, 2.6); fl(c, '#ffd23f');
  // Windows with shutters and flower boxes
  for (const wx of [x + 58, x + w - 128]) {
    rr(c, wx - 12, y + 112, 12, 46, 2); fs(c, '#4a86cf'); rr(c, wx + 70, y + 112, 12, 46, 2); fs(c, '#4a86cf');
    rr(c, wx, y + 112, 70, 46, 4); fs(c, night > 0.15 ? '#ffe28a' : '#cdeeff');
    if (night <= 0.15) { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.moveTo(wx + 6, y + 152); c.lineTo(wx + 24, y + 116); c.lineTo(wx + 34, y + 116); c.lineTo(wx + 16, y + 152); c.fill(); }
    c.beginPath(); c.moveTo(wx + 35, y + 112); c.lineTo(wx + 35, y + 158); c.moveTo(wx, y + 135); c.lineTo(wx + 70, y + 135); c.lineWidth = 2; c.stroke();
    rr(c, wx - 4, y + 160, 78, 12, 3); fs(c, '#a86f3d');
    for (let k = 0; k < 7; k++) { circ(c, wx + 4 + k * 11, y + 158, 4.5); fl(c, '#4a9a3e'); circ(c, wx + 4 + k * 11, y + 155, 3); fl(c, ['#ff6b8a', '#ffd23f', '#ffffff'][k % 3]); }
  }
  // Sign
  rr(c, cx - 92, y + 84, 184, 26, 7); c.fillStyle = vgrad(c, y + 84, y + 110, '#b98048', '#8a5a2e'); c.fill(); c.lineWidth = 2; c.stroke();
  label(c, 'NUGGS FARM', cx, y + 98, 17, '#fff3d6');
  if (E.eventActive('festival')) { const cols = ['#ff5f6d', '#ffd23f', '#4fd1c5', '#b98cff']; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 20, base + 2); c.quadraticCurveTo(cx, base + 26, x + w + 20, base + 2); c.stroke(); for (let k = 0; k < 16; k++) { const tt = k / 15, bx = x - 20 + (w + 40) * tt, by = base + 2 + Math.sin(tt * Math.PI) * 12; c.beginPath(); c.moveTo(bx - 8, by); c.lineTo(bx, by + 14); c.lineTo(bx + 8, by); c.closePath(); fs(c, cols[k % 4]); } }
  c.restore();
}

// ---------- buildings on lots ----------
export function building(c, i, p, t, night) {
  const r = lotRect(i), cx = r.x + r.w / 2, by = r.y + r.h - 46;
  c.save(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.lineJoin = 'round'; c.lineCap = 'round';
  softShadow(c, cx + 14, by + 6, 150, 22, 0.22);
  const lit = night > 0.15 ? '#ffe28a' : '#cdeeff';
  switch (p.type) {
    case 'feedmill': {
      rr(c, cx - 96, by - 124, 192, 126, 4); c.fillStyle = hgrad(c, cx - 96, cx + 96, '#e8b86e', '#c4914a'); c.fill(); c.stroke();
      c.fillStyle = 'rgba(120,70,30,.18)'; for (let x = cx - 88; x < cx + 96; x += 12) c.fillRect(x, by - 122, 1.5, 122);
      c.beginPath(); c.moveTo(cx - 108, by - 118); c.lineTo(cx, by - 178); c.lineTo(cx + 108, by - 118); c.closePath(); c.fillStyle = vgrad(c, by - 178, by - 118, '#9a6a3a', '#6e4520'); c.fill(); c.stroke();
      rr(c, cx - 28, by - 64, 56, 66, 3); fs(c, '#6b4320'); c.beginPath(); c.moveTo(cx - 28, by - 64); c.lineTo(cx + 28, by + 2); c.moveTo(cx + 28, by - 64); c.lineTo(cx - 28, by + 2); c.stroke();
      rr(c, cx - 70, by - 104, 28, 24, 3); fs(c, lit);
      c.save(); c.translate(cx + 62, by - 152); c.rotate(t * (1 + p.lvl * 0.4));
      for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); rr(c, -7, 6, 14, 70, 3); c.fillStyle = hgrad(c, -7, 7, '#ffffff', '#ddd6c8'); c.fill(); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1; for (let yy = 18; yy < 74; yy += 10) { c.beginPath(); c.moveTo(-6, yy); c.lineTo(6, yy); c.stroke(); } c.strokeStyle = OUT; c.lineWidth = 2.2; }
      c.restore(); circ(c, cx + 62, by - 152, 7); fs(c, '#555');
      for (const [dx, dy] of [[-74, 0], [-52, 0], [-63, -20]]) { rr(c, cx + dx - 12, by + dy - 22, 24, 23, 7); c.fillStyle = vgrad(c, by + dy - 22, by + dy, '#f2e2bc', '#d4bf90'); c.fill(); c.stroke(); }
      const stock = Math.floor(p.stock), cap = MILL.cap * p.lvl;
      if (stock >= 1) {
        const bob = Math.sin(t * 4) * 3, bx = cx, bY = r.y + 26 + bob;
        rr(c, bx - 52, bY, 104, 36, 18); c.fillStyle = stock >= cap ? '#ffd23f' : '#fffdf8'; c.fill(); c.stroke();
        c.beginPath(); c.moveTo(bx - 7, bY + 36); c.lineTo(bx, bY + 46); c.lineTo(bx + 7, bY + 36); c.fill(); c.stroke();
        rr(c, bx - 6, bY + 32, 12, 6, 0); c.fillStyle = stock >= cap ? '#ffd23f' : '#fffdf8'; c.fill();
        label(c, `${stock} feed`, bx, bY + 18, 16, OUT, 700);
      }
      break; }
    case 'vet':
      rr(c, cx - 104, by - 112, 208, 114, 6); c.fillStyle = vgrad(c, by - 112, by, '#ffffff', '#e6e2da'); c.fill(); c.stroke();
      rr(c, cx - 116, by - 130, 232, 24, 6); c.fillStyle = vgrad(c, by - 130, by - 106, '#5fb4e6', '#3a8cc0'); c.fill(); c.stroke();
      rr(c, cx - 24, by - 104, 48, 48, 8); c.fillStyle = vgrad(c, by - 104, by - 56, '#f0665c', '#c8443a'); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(cx - 6, by - 96, 12, 32); c.fillRect(cx - 16, by - 86, 32, 12);
      rr(c, cx - 22, by - 48, 44, 50, 3); fs(c, lit);
      for (const wx of [cx - 86, cx + 46]) { rr(c, wx, by - 84, 40, 30, 4); fs(c, lit); }
      break;
    case 'showring': {
      ell(c, cx, by - 62, 156, 74); c.fillStyle = vgrad(c, by - 136, by + 12, '#f2e2bc', '#d6ba82'); c.fill(); c.stroke();
      ell(c, cx, by - 62, 124, 54); c.fillStyle = vgrad(c, by - 116, by - 8, '#e3c890', '#c9a96a'); c.fill(); c.stroke();
      ell(c, cx, by - 62, 124, 54); c.setLineDash([6, 6]); c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke(); c.setLineDash([]); c.strokeStyle = OUT;
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + k / 6 * Math.PI, x = cx + Math.cos(a) * 146, y = by - 62 + Math.sin(a) * 68;
        rr(c, x - 1.5, y - 54, 3, 54, 1); fl(c, '#555');
        c.beginPath(); c.moveTo(x, y - 54); c.lineTo(x + 24 + Math.sin(t * 5 + k) * 4, y - 47 + Math.cos(t * 5 + k) * 2); c.lineTo(x, y - 40); c.closePath(); fs(c, ['#ff5f6d', '#ffd23f', '#4a7ee0'][k % 3]);
      }
      c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - 146, by - 116); c.quadraticCurveTo(cx, by - 150, cx + 146, by - 116); c.stroke();
      for (let k = 0; k < 13; k++) { const tt = k / 12, x = cx - 146 + 292 * tt, y = by - 116 - Math.sin(tt * Math.PI) * 17; c.beginPath(); c.moveTo(x - 7, y); c.lineTo(x, y + 12); c.lineTo(x + 7, y); c.closePath(); fs(c, ['#ff5f6d', '#ffd23f', '#4fd1c5', '#b98cff'][k % 4]); }
      c.lineWidth = 2.2;
      const sh = E.S.show;
      if (sh) {
        rr(c, cx - 86, by - 40, 172, 26, 13); fs(c, '#fffdf8');
        label(c, `${GROUPS[sh.group].plural} show · ${E.dur((sh.ends - Date.now()) / 1000)}`, cx, by - 27, 13, OUT, 700);
        const entry = sh.entry && E.S.animals[sh.entry];
        if (entry) { c.save(); c.translate(cx, by - 50); drawAnimal(c, entry.species, { pose: 'idle', t, mut: entry.mut, scale: 1.25 }); c.restore(); }
      }
      break; }
    case 'fountain': {
      ell(c, cx, by - 30, 94, 36); c.fillStyle = vgrad(c, by - 66, by + 6, '#e6e0d2', '#b4ac9a'); c.fill(); c.stroke();
      ell(c, cx, by - 34, 80, 27); c.fillStyle = vgrad(c, by - 60, by - 8, '#7fd0f0', '#3a9ad0'); c.fill(); c.stroke();
      rr(c, cx - 11, by - 104, 22, 70, 5); c.fillStyle = hgrad(c, cx - 11, cx + 11, '#e6e0d2', '#b4ac9a'); c.fill(); c.stroke();
      ell(c, cx, by - 104, 32, 11); fs(c, '#d6cfc0');
      c.strokeStyle = 'rgba(220,245,255,.9)'; c.lineWidth = 2.6;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx, by - 112); c.quadraticCurveTo(cx + Math.cos(a) * 34, by - 146, cx + Math.cos(a) * 62, by - 38 + Math.sin(a) * 12); c.stroke(); }
      for (let k = 0; k < 12; k++) { const ph = (t * 1.3 + k / 12) % 1, a = k / 12 * Math.PI * 2; circ(c, cx + Math.cos(a) * 62 * ph, by - 112 + ph * ph * 76 - ph * 34, 2.2); fl(c, 'rgba(230,248,255,.95)'); }
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; c.globalAlpha = 1 - ph; c.beginPath(); c.ellipse(cx, by - 34, 20 + ph * 50, 7 + ph * 17, 0, 0, Math.PI * 2); c.stroke(); } c.globalAlpha = 1;
      break; }
    case 'gazebo':
      ell(c, cx, by - 10, 116, 32); c.fillStyle = vgrad(c, by - 42, by + 22, '#f2e2bc', '#d4bf90'); c.fill(); c.stroke();
      for (const dx of [-84, -42, 42, 84]) { rr(c, cx + dx - 5, by - 126, 10, 118, 3); c.fillStyle = hgrad(c, cx + dx - 5, cx + dx + 5, '#ffffff', '#ddd6ca'); c.fill(); c.stroke(); }
      c.beginPath(); c.moveTo(cx - 118, by - 120); c.lineTo(cx, by - 190); c.lineTo(cx + 118, by - 120); c.closePath(); c.fillStyle = vgrad(c, by - 190, by - 120, '#c497ea', '#8a5cc0'); c.fill(); c.stroke();
      for (let k = 0; k < 10; k++) { circ(c, cx - 108 + k * 24, by - 121, 6); fs(c, ['#ff8fb0', '#ffd23f', '#ffffff'][k % 3]); }
      rr(c, cx - 40, by - 44, 80, 12, 4); fs(c, '#b07a45');
      break;
    case 'lab':
      rr(c, cx - 104, by - 104, 208, 106, 6); c.fillStyle = vgrad(c, by - 104, by, '#f2f4f8', '#d6dae2'); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(cx, by - 104, 74, 50, 0, Math.PI, 0); c.closePath(); c.fillStyle = vgrad(c, by - 154, by - 104, '#bfe6ff', '#7fc0ea'); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, by - 104, 58, 38, 0, 1.15 * Math.PI, 1.45 * Math.PI); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 2.2;
      for (const wx of [cx - 76, cx + 34]) { rr(c, wx, by - 74, 42, 42, 4); fs(c, night > 0.15 ? '#d6b4ff' : '#cdeeff'); }
      rr(c, cx - 20, by - 46, 40, 48, 3); fs(c, '#7c4dcc');
      for (let k = 0; k < 4; k++) { const ph = (t * 0.7 + k / 4) % 1; c.globalAlpha = 1 - ph; circ(c, cx + 60 + Math.sin(ph * 6) * 5, by - 160 - ph * 46, 4 + ph * 6); fl(c, '#c49bf2'); } c.globalAlpha = 1;
      label(c, 'GENETICS', cx, by - 86, 12, '#7c4dcc', 700);
      break;
  }
  c.restore();
}

export function construction(c, i, p, t) {
  const r = lotRect(i);
  c.save(); c.strokeStyle = OUT; c.lineWidth = 2; c.lineJoin = 'round';
  rr(c, r.x + 12, r.y + 40, r.w - 24, r.h - 52, 14); c.fillStyle = vgrad(c, r.y + 40, r.y + r.h, '#d9bf92', '#c4a674'); c.fill();
  for (let k = 0; k < 3; k++) {
    const x = r.x + 84 + k * 106;
    for (const dy of [-10, -42, -74]) { rr(c, x - 42, r.y + 232 + dy, 84, 9, 2); c.fillStyle = vgrad(c, r.y + 232 + dy, r.y + 241 + dy, '#e2b26a', '#b8864a'); c.fill(); c.stroke(); }
    for (const dx of [-42, 36]) { rr(c, x + dx, r.y + 150, 6, 92, 2); fs(c, '#8a5a2e'); }
  }
  for (const [x, y] of [[r.x + 44, r.y + 250], [r.x + 86, r.y + 262]]) { rr(c, x, y, 40, 30, 3); c.fillStyle = hgrad(c, x, x + 40, '#d9ab6a', '#b8864a'); c.fill(); c.stroke(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40, y + 30); c.moveTo(x + 40, y); c.lineTo(x, y + 30); c.lineWidth = 1.2; c.stroke(); c.lineWidth = 2; }
  for (const x of [r.x + r.w - 60, r.x + r.w - 36]) { c.beginPath(); c.moveTo(x - 9, r.y + 280); c.lineTo(x, r.y + 252); c.lineTo(x + 9, r.y + 280); c.closePath(); fs(c, '#ff8a2a'); c.fillStyle = '#fff'; c.fillRect(x - 5, r.y + 266, 10, 3); }
  const total = (p.kind === 'habitat' ? GROUPS[p.group].build : BUILDINGS[p.type].build) * 1000;
  const pr = Math.max(0, Math.min(1, 1 - (p.building - Date.now()) / total));
  rr(c, r.x + 56, r.y + 62, r.w - 112, 54, 14); fs(c, '#fffdf8');
  label(c, `Building ${p.kind === 'habitat' ? GROUPS[p.group].name : BUILDINGS[p.type].name}`, r.x + r.w / 2, r.y + 78, 15, OUT, 600);
  rr(c, r.x + 72, r.y + 92, r.w - 144, 12, 6); fl(c, '#eee2c8');
  rr(c, r.x + 72, r.y + 92, (r.w - 144) * pr, 12, 6); fl(c, '#f4b63f');
  label(c, E.dur((p.building - Date.now()) / 1000), r.x + r.w / 2, r.y + 130, 13, OUT, 700);
  c.save(); c.translate(r.x + r.w / 2 + 30, r.y + 186); c.rotate(-0.4 + Math.abs(Math.sin(t * 6)) * 0.9);
  rr(c, -2.5, 0, 5, 28, 2); fs(c, '#8a5a2e'); rr(c, -10, -7, 20, 9, 2); fs(c, '#9aa5b1'); c.restore();
  if (Math.sin(t * 6) > 0.95) { c.globalAlpha = 0.6; circ(c, r.x + r.w / 2 + 18, r.y + 214, 8); fl(c, '#fff'); c.globalAlpha = 1; }
  c.restore();
}

export function signpost(c, i, kind, text, sub, t) {
  const r = lotRect(i), x = r.x + r.w / 2, y = r.y + r.h - 20;
  c.save(); c.strokeStyle = OUT; c.lineWidth = 2;
  softShadow(c, x + 3, y + 2, 16, 4);
  rr(c, x - 3, y - 46, 6, 48, 2); fs(c, '#8a5a2e');
  c.font = '600 14px Fredoka, sans-serif';
  const w = Math.max(c.measureText(text).width, sub ? c.measureText(sub).width : 0) + 30;
  const bob = Math.sin(t * 2) * 1.5;
  const col = kind === 'sale' ? '#e2574c' : '#3d9a4b';
  rr(c, x - w / 2 + 2, y - 86 + bob + 3, w, sub ? 42 : 28, 9); fl(c, 'rgba(30,20,5,.22)');
  rr(c, x - w / 2, y - 86 + bob, w, sub ? 42 : 28, 9); c.fillStyle = vgrad(c, y - 86, y - 44, col, shadeHex(col, -0.12)); c.fill(); c.stroke();
  label(c, text, x, y - 72 + bob, 14);
  if (sub) label(c, sub, x, y - 55 + bob, 11, 'rgba(255,255,255,.9)', 500);
  c.restore();
}

// ---------- day and night ----------
export function dayInfo() {
  // 0 is midnight and 0.5 is noon. NF_TIME_OF_DAY lets testers preview a time of day from the console.
  const d = typeof globalThis.NF_TIME_OF_DAY === 'number' ? globalThis.NF_TIME_OF_DAY : ((Date.now() / 1000) % DAY_LENGTH) / DAY_LENGTH;
  const sun = Math.sin((d - 0.25) * Math.PI * 2);
  const daylight = Math.max(0, Math.min(1, (sun + 0.2) / 0.4));
  const warm = Math.exp(-Math.pow((sun - 0.02) / 0.2, 2));
  return { d, sun, daylight, warm, night: 1 - daylight };
}

// Darkness with holes punched out for lights, then a warm glow on top.
let lightCanvas = null;
export function lighting(c, W, H, dpr, toScreen, z, lights, info, t) {
  const dark = info.night;
  if (info.warm > 0.05) { c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = `rgba(255,140,60,${info.warm * 0.5})`; c.fillRect(0, 0, W, H); c.restore(); }
  if (dark < 0.02) return;
  if (!isHigh()) { c.fillStyle = `rgba(16,22,60,${dark * 0.5})`; c.fillRect(0, 0, W, H); return; }
  if (!lightCanvas) lightCanvas = document.createElement('canvas');
  const lc = lightCanvas;
  if (lc.width !== Math.ceil(W / 2) || lc.height !== Math.ceil(H / 2)) { lc.width = Math.ceil(W / 2); lc.height = Math.ceil(H / 2); }
  const l = lc.getContext('2d');
  l.setTransform(0.5, 0, 0, 0.5, 0, 0);
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, W, H);
  l.fillStyle = `rgba(14,20,58,${dark * 0.62})`; l.fillRect(0, 0, W, H);
  l.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const p = toScreen(L.x, L.y), r = L.r * z * (1 + 0.04 * Math.sin(t * 3 + L.x));
    if (p.x < -r || p.y < -r || p.x > W + r || p.y > H + r) continue;
    const g = l.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(0.5, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.beginPath(); l.arc(p.x, p.y, r, 0, Math.PI * 2); l.fill();
  }
  c.drawImage(lc, 0, 0, W, H);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    const p = toScreen(L.x, L.y), r = L.r * z * 0.6;
    if (p.x < -r || p.y < -r || p.x > W + r || p.y > H + r) continue;
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(${L.col},${0.28 * dark})`); g.addColorStop(1, `rgba(${L.col},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

export function vignette(c, W, H) {
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.78);
  g.addColorStop(0, 'rgba(20,30,10,0)'); g.addColorStop(1, 'rgba(20,30,10,.22)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

// ---------- clouds and critters ----------
const clouds = Array.from({ length: 6 }, (_, k) => ({ x: (k * 719) % MAP_W, y: (k * 1301) % MAP_H, s: 0.8 + (k % 3) * 0.35 }));
export function cloudShadows(c, view, t) {
  if (!isHigh()) return;
  for (const cl of clouds) {
    const x = ((cl.x + t * 9) % (MAP_W + 800)) - 400, y = cl.y;
    if (x < view.x - 400 || x > view.x + view.w + 400 || y < view.y - 300 || y > view.y + view.h + 300) continue;
    for (const [dx, dy, r] of [[0, 0, 160], [120, 30, 120], [-110, 40, 110], [40, -50, 100]]) {
      const g = c.createRadialGradient(x + dx * cl.s, y + dy * cl.s, 0, x + dx * cl.s, y + dy * cl.s, r * cl.s);
      g.addColorStop(0, 'rgba(20,40,60,.07)'); g.addColorStop(1, 'rgba(20,40,60,0)');
      c.fillStyle = g; c.fillRect(x + dx * cl.s - r * cl.s, y + dy * cl.s - r * cl.s, r * 2 * cl.s, r * 2 * cl.s);
    }
  }
}

const critters = [];
export function ambient(c, view, t, dt, info) {
  if (!isHigh()) return;
  const want = info.daylight > 0.4 ? 10 : 26;
  const kind = info.daylight > 0.4 ? 'butterfly' : 'firefly';
  for (let k = critters.length - 1; k >= 0; k--) { const b = critters[k]; if (b.kind !== kind || b.x < view.x - 200 || b.x > view.x + view.w + 200 || b.y < view.y - 200 || b.y > view.y + view.h + 200) critters.splice(k, 1); }
  while (critters.length < want) critters.push({ kind, x: view.x + Math.random() * view.w, y: view.y + Math.random() * view.h, a: Math.random() * 6, v: 18 + Math.random() * 20, ph: Math.random() * 6, col: ['#ffd23f', '#ff8fb0', '#8fd6ff', '#ffffff', '#ff9a3a'][Math.floor(Math.random() * 5)] });
  for (const b of critters) {
    b.a += (Math.sin(t * 0.7 + b.ph) * 1.6) * dt; b.x += Math.cos(b.a) * b.v * dt; b.y += Math.sin(b.a) * b.v * dt * 0.7;
    if (b.kind === 'butterfly') {
      const f = Math.abs(Math.sin(t * 14 + b.ph));
      c.save(); c.translate(b.x, b.y - 18 - Math.sin(t * 2 + b.ph) * 4); c.strokeStyle = OUT; c.lineWidth = 0.8;
      for (const sd of [-1, 1]) { ell(c, sd * 3.6 * f, -1, 3.6 * f + 0.6, 3); fs(c, b.col); ell(c, sd * 2.6 * f, 2.6, 2.4 * f + 0.4, 2); fs(c, b.col); }
      c.fillStyle = OUT; c.fillRect(-0.6, -3, 1.2, 6); c.restore();
    } else {
      const glow = 0.5 + 0.5 * Math.sin(t * 4 + b.ph * 3);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(b.x, b.y - 14, 0, b.x, b.y - 14, 9);
      g.addColorStop(0, `rgba(230,255,140,${0.9 * glow})`); g.addColorStop(1, 'rgba(230,255,140,0)');
      c.fillStyle = g; c.fillRect(b.x - 9, b.y - 23, 18, 18); c.restore();
    }
  }
}

export const LAMPS = SCENERY.filter(o => o.type === 'lamp').map(o => ({ x: o.x, y: o.y - 68, r: 150, col: '255,210,120' }));
export const HOUSE_LIGHTS = [
  { x: HOUSE.x + 93, y: HOUSE.y + 135, r: 140, col: '255,210,120' }, { x: HOUSE.x + HOUSE.w - 93, y: HOUSE.y + 135, r: 140, col: '255,210,120' },
  { x: HOUSE.x + HOUSE.w / 2, y: HOUSE.y + HOUSE.h - 40, r: 160, col: '255,200,110' },
];
