// Farm map geometry shared by the scene renderer and the world simulation.
import { LAND } from './data.js';

export const LOT_W = 380, LOT_H = 300, PATH = 120, EDGE = 170, TOP = 460, COLS = LAND.perRow;
export const ROWS = Math.ceil(LAND.maxPlots / COLS);
export const MAP_W = EDGE * 2 + PATH + COLS * (LOT_W + PATH) - PATH;
export const MAP_H = TOP + ROWS * (LOT_H + PATH) + EDGE - 40;
export const HOUSE = { x: MAP_W / 2 - 180, y: 110, w: 360, h: 230 };

export function lotRect(i) {
  const c = i % COLS, r = Math.floor(i / COLS);
  return { x: EDGE + PATH / 2 + c * (LOT_W + PATH), y: TOP + r * (LOT_H + PATH), w: LOT_W, h: LOT_H };
}
export const gateSpot = i => { const r = lotRect(i); return { x: r.x + r.w / 2, y: r.y + r.h + 36 }; };

export function rng(seed) { let s = seed % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
export const hash = str => { let h = 9; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return h || 1; };
export const inRect = (x, y, r, pad = 0) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;

// Path network as rounded rectangles: one band between every row and column of lots, plus the yard.
export const PATH_BAND = 78;
export const PATHS = (() => {
  const list = [];
  for (let r = 0; r <= ROWS; r++) {
    const y = TOP + r * (LOT_H + PATH) - PATH / 2;
    list.push({ x: EDGE - 16, y: y - PATH_BAND / 2, w: MAP_W - EDGE * 2 + 32, h: PATH_BAND });
  }
  for (let c = 0; c <= COLS; c++) {
    const x = EDGE + PATH / 2 + c * (LOT_W + PATH) - PATH / 2;
    list.push({ x: x - PATH_BAND / 2, y: TOP - PATH / 2 - PATH_BAND / 2, w: PATH_BAND, h: ROWS * (LOT_H + PATH) + PATH_BAND / 2 });
  }
  list.push({ x: MAP_W / 2 - 130, y: HOUSE.y + HOUSE.h - 16, w: 260, h: TOP - HOUSE.y - HOUSE.h - 10 });
  return list;
})();
export const onPath = (x, y) => PATHS.some(p => inRect(x, y, p, -4));

// Static scenery: forest border, lamps and yard decorations.
export const SCENERY = (() => {
  const R = rng(4242), list = [];
  const tree = () => (R() < 0.45 ? 'gum' : R() < 0.75 ? 'oak' : 'pine');
  for (let x = 30; x < MAP_W; x += 64 + R() * 40) {
    list.push({ type: tree(), x, y: 46 + R() * 40, s: 0.95 + R() * 0.5, seed: R() });
    list.push({ type: tree(), x: x + 20, y: MAP_H - 20 - R() * 60, s: 0.95 + R() * 0.5, seed: R() });
  }
  for (let y = 120; y < MAP_H - 70; y += 62 + R() * 36) {
    list.push({ type: tree(), x: 26 + R() * (EDGE - 90), y, s: 0.9 + R() * 0.5, seed: R() });
    list.push({ type: tree(), x: MAP_W - 26 - R() * (EDGE - 90), y: y + 30, s: 0.9 + R() * 0.5, seed: R() });
    if (R() < 0.6) list.push({ type: 'bush', x: EDGE - 34 + R() * 18, y: y + 40, s: 0.8 + R() * 0.4, seed: R() });
    if (R() < 0.6) list.push({ type: 'bush', x: MAP_W - EDGE + 16 + R() * 18, y: y + 10, s: 0.8 + R() * 0.4, seed: R() });
  }
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) {
    if ((r + c) % 2) continue;
    const x = EDGE + PATH / 2 + c * (LOT_W + PATH) - PATH / 2, y = TOP + r * (LOT_H + PATH) - PATH / 2;
    list.push({ type: 'lamp', x: x + 46, y: y - 34 });
  }
  list.push({ type: 'mailbox', x: HOUSE.x - 34, y: HOUSE.y + HOUSE.h + 26 });
  list.push({ type: 'oak', x: HOUSE.x - 120, y: HOUSE.y + 160, s: 1.35, seed: 0.3 });
  list.push({ type: 'gum', x: HOUSE.x + HOUSE.w + 120, y: HOUSE.y + 150, s: 1.45, seed: 0.7 });
  list.push({ type: 'cart', x: HOUSE.x + HOUSE.w + 34, y: HOUSE.y + HOUSE.h + 40 });
  list.push({ type: 'barrel', x: HOUSE.x - 70, y: HOUSE.y + HOUSE.h + 34 });
  list.push({ type: 'flowerbed', x: HOUSE.x + 60, y: HOUSE.y + HOUSE.h + 8 });
  list.push({ type: 'flowerbed', x: HOUSE.x + HOUSE.w - 60, y: HOUSE.y + HOUSE.h + 8 });
  return list;
})();

// Lot interiors: where animals roam, where bowls sit, perches and props.
export function layout(i, group) {
  const r = lotRect(i);
  const L = {
    inner: { x: r.x + 36, y: r.y + 86, w: r.w - 72, h: r.h - 128 },
    bowl: { x: r.x + r.w - 92, y: r.y + r.h - 46 }, water: { x: r.x + r.w - 136, y: r.y + r.h - 42 },
    perches: [], props: [], lights: [],
  };
  const P = (type, x, y, extra = {}) => L.props.push({ type, x: r.x + x, y: r.y + y, ...extra });
  switch (group) {
    case 'kennel': P('doghouse', 74, 124); P('doghouse', 306, 124, { colour: '#4a86cf' }); P('ball', 200, 196); P('bone', 128, 246); P('tyre', 282, 236); break;
    case 'cattery': P('cattree', 80, 150); P('cattree', 312, 142); P('cushion', 196, 128); P('yarn', 150, 238); P('box', 276, 238); break;
    case 'aviary':
      L.perches = [[90, 176, 70], [196, 140, 94], [292, 180, 66], [128, 254, 42], [262, 254, 46], [200, 226, 122]].map(([x, y, z]) => ({ x: r.x + x, y: r.y + y, z }));
      P('birdbath', 200, 272); break;
    case 'hutch': P('hutchbox', 80, 128); P('hutchbox', 304, 130); P('tunnel', 196, 208); P('hay', 118, 248); P('carrots', 286, 246); break;
    case 'terrarium': P('rock', 92, 146, { s: 1.3 }); P('log', 268, 156); P('cactus', 326, 236); P('heatlamp', 196, 110); P('rock', 150, 244); P('dish', 250, 248); L.lights.push({ x: r.x + 196, y: r.y + 150, r: 120, col: '255,170,70' }); break;
    case 'pond': P('lily', 140, 158); P('lily', 262, 214); P('lily', 228, 142); P('reeds', 62, 236); P('reeds', 328, 126); P('rock', 300, 258, { s: 0.9 }); break;
    case 'paddock': P('barn', 300, 122); P('haybale', 88, 134); P('haybale', 130, 146); P('trough', 196, 256); break;
    case 'sanctuary':
      L.perches = [[82, 168, 46], [306, 158, 52]].map(([x, y, z]) => ({ x: r.x + x, y: r.y + y, z }));
      P('gumtree', 82, 168); P('gumtree', 306, 158); P('log', 196, 236); P('rock', 140, 126); P('pool', 256, 256); P('fern', 54, 250); P('fern', 340, 248); break;
  }
  if (group === 'pond') L.water = { cx: r.x + r.w / 2, cy: r.y + r.h / 2 + 22, rx: r.w / 2 - 44, ry: r.h / 2 - 64 };
  L.lights.push({ x: r.x + r.w / 2 - 34, y: r.y + r.h - 64, r: 70, col: '255,200,110' }, { x: r.x + r.w / 2 + 34, y: r.y + r.h - 64, r: 70, col: '255,200,110' });
  return L;
}

// Coarse walkability grid for pathfinding.
export const CELL = 30;
export const GW = Math.ceil(MAP_W / CELL), GH = Math.ceil(MAP_H / CELL);
export function walkable(x, y) {
  if (x < EDGE - 30 || x > MAP_W - EDGE + 30 || y < 70 || y > MAP_H - 90) return false;
  if (inRect(x, y, HOUSE, 6)) return false;
  for (let i = 0; i < LAND.maxPlots; i++) if (inRect(x, y, lotRect(i), 8)) return false;
  return true;
}
