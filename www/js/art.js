// Procedural cartoon animals drawn with Canvas 2D. Every species is described by a body plan
// and a palette; poses are 'idle', 'walk', 'play', 'eat', 'sleep' and (birds) 'fly'.
// Drawings are side-on, facing right, with the feet at (0, 0). One unit is roughly one pixel at scale 1.

const OUT = '#2a1c10';

// ---------- colour helpers ----------
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360},${Math.round(Math.max(0, Math.min(1, s)) * 100)}%,${Math.round(Math.max(0, Math.min(1, l)) * 100)}%)`;
export function shade(c, amt) {
  if (c.startsWith('hsl')) {
    const m = c.match(/[\d.]+/g).map(Number);
    return hsl(m[0], m[1] / 100, m[2] / 100 + amt);
  }
  const [h, s, l] = hexToHsl(c);
  return hsl(h, s, l + amt);
}

const KEEP = new Set(['eye', 'nose', 'beak', 'tongue', 'claw', 'horn', 'pupil']);
// Recolour a palette for a colour mutation.
function mutatePalette(P, mut, t = 0) {
  if (!mut) return P;
  const out = {};
  let i = 0;
  for (const [k, c] of Object.entries(P)) {
    if (typeof c !== 'string' || !c.startsWith('#')) { out[k] = c; continue; }
    if (KEEP.has(k) && !(mut === 'albino' && k === 'eye')) { out[k] = c; continue; }
    const [h, s, l] = hexToHsl(c);
    switch (mut) {
      case 'golden': out[k] = hsl(42 + (l - 0.5) * 20, 0.78, 0.32 + l * 0.55); break;
      case 'albino': out[k] = k === 'eye' ? '#d8345f' : hsl(h, s * 0.08, 0.86 + l * 0.12); break;
      case 'melanistic': out[k] = hsl(h, s * 0.35, 0.08 + l * 0.28); break;
      case 'frost': out[k] = hsl(195 + l * 20, 0.55, 0.55 + l * 0.38); break;
      case 'cosmic': out[k] = hsl(262 + l * 50, 0.72, 0.18 + l * 0.5); break;
      case 'rainbow': out[k] = hsl(t * 90 + i * 70, 0.85, 0.45 + l * 0.25); break;
      default: out[k] = c;
    }
    i++;
  }
  return out;
}

// ---------- species art table ----------
const dog = (o) => ({ plan: 'quad', kind: 'dog', eye: '#3a2412', nose: '#2a1c10', tongue: '#ff7a8a', ...o });
const cat = (o) => ({ plan: 'quad', kind: 'cat', head: 12, snout: 0.25, ears: 'cat', tail: 'long', eye: '#7ac142', nose: '#f29aa6', whiskers: true, ...o });
const bird = (o) => ({ plan: 'bird', eye: '#1d1d1d', beak: '#2a2a2a', ...o });

export const ART = {
  // Dogs
  pug:        dog({ len: 30, ht: 17, leg: 8, head: 12.5, snout: 0.22, ears: 'floppySmall', tail: 'curl', main: '#e6c79d', belly: '#f1dcb9', dark: '#3a2d26', pattern: 'mask', wrinkles: true }),
  dachshund:  dog({ len: 48, ht: 14, leg: 5.5, head: 11, snout: 0.95, ears: 'floppyLong', tail: 'long', main: '#a5532a', belly: '#c47744', dark: '#6b3518' }),
  frenchie:   dog({ len: 30, ht: 18, leg: 9, head: 13.5, snout: 0.2, ears: 'bat', tail: 'stub', main: '#4c4542', belly: '#ece4d8', dark: '#2a2422', pattern: 'chest', wrinkles: true }),
  corgi:      dog({ len: 42, ht: 17, leg: 6, head: 12.5, snout: 0.7, ears: 'pointyBig', tail: 'stub', main: '#dc842b', belly: '#fff6ea', dark: '#b4651c', pattern: 'blaze', smile: true }),
  pomeranian: dog({ len: 24, ht: 18, leg: 6, head: 12, snout: 0.38, ears: 'pointySmall', tail: 'curlFluffy', main: '#f2a43a', belly: '#f8c977', dark: '#c9791c', fluffy: true }),
  bordercollie: dog({ len: 42, ht: 19, leg: 12, head: 12, snout: 0.82, ears: 'semi', tail: 'long', main: '#232120', belly: '#ffffff', dark: '#111', pattern: 'collie', smile: true }),
  kelpie:     dog({ len: 40, ht: 18, leg: 13, head: 12, snout: 0.85, ears: 'pointyBig', tail: 'long', main: '#7b3b1e', belly: '#a65d34', dark: '#5a2a14' }),
  shiba:      dog({ len: 36, ht: 18, leg: 11, head: 12.5, snout: 0.6, ears: 'pointy', tail: 'curl', main: '#dc7a30', belly: '#fff1dc', dark: '#b45a1c', pattern: 'urajiro', smile: true }),
  golden:     dog({ len: 46, ht: 20, leg: 13, head: 13, snout: 0.85, ears: 'floppy', tail: 'feather', main: '#e2a84e', belly: '#f2cb7e', dark: '#c08431', smile: true }),
  husky:      dog({ len: 44, ht: 20, leg: 13, head: 13, snout: 0.8, ears: 'pointy', tail: 'bushy', main: '#6b707a', belly: '#ffffff', dark: '#3d4048', pattern: 'husky', eye: '#3ea6ff' }),
  dalmatian:  dog({ len: 46, ht: 20, leg: 15, head: 12, snout: 0.85, ears: 'floppy', tail: 'long', main: '#ffffff', belly: '#ffffff', dark: '#1d1d1d', pattern: 'spots' }),
  samoyed:    dog({ len: 40, ht: 22, leg: 12, head: 13.5, snout: 0.6, ears: 'pointy', tail: 'curlFluffy', main: '#fbfaf6', belly: '#ffffff', dark: '#e4e0d6', fluffy: true, smile: true }),
  // Cats
  britishshorthair: cat({ len: 36, ht: 19, leg: 9, head: 13.5, main: '#8f99a7', belly: '#a5aebb', dark: '#76808e', eye: '#e8a13a', nose: '#6e7682' }),
  siamese:    cat({ len: 38, ht: 16, leg: 11, head: 11.5, main: '#efe3cf', belly: '#f6eee0', dark: '#4a3527', pattern: 'points', eye: '#4aa3ff' }),
  persian:    cat({ len: 34, ht: 19, leg: 7, head: 13.5, snout: 0.12, main: '#eab97c', belly: '#f6d6a8', dark: '#c98f4f', fluffy: true, tail: 'bushy', eye: '#e8832a', ears: 'catSmall' }),
  ragdoll:    cat({ len: 40, ht: 19, leg: 9, head: 13, main: '#f5f0e7', belly: '#ffffff', dark: '#6d5a4c', pattern: 'points', fluffy: true, tail: 'bushy', eye: '#4aa3ff' }),
  scottishfold: cat({ len: 34, ht: 18, leg: 9, head: 13.5, ears: 'fold', main: '#bdbdbd', belly: '#e6e6e6', dark: '#6b6b6b', pattern: 'tabby', eye: '#e8b23a' }),
  mainecoon:  cat({ len: 46, ht: 22, leg: 12, head: 14, ears: 'tufted', main: '#7c7c7c', belly: '#dedede', dark: '#3a3a3a', pattern: 'tabby', fluffy: true, tail: 'bushy', eye: '#9ccc3a' }),
  bengal:     cat({ len: 42, ht: 18, leg: 11, head: 12, main: '#e2a24c', belly: '#f8deb0', dark: '#4e2e14', pattern: 'rosettes', eye: '#8ccf3a' }),
  sphynx:     cat({ len: 36, ht: 16, leg: 11, head: 12, ears: 'catBig', main: '#f1c9b4', belly: '#f6d8c8', dark: '#dca48c', wrinkles: true, tail: 'thin', eye: '#8ccf3a', whiskers: false }),
  // Birds
  budgie:     bird({ size: 0.55, main: '#7fd34a', belly: '#a8e35e', face: '#f5e44a', wing: '#3a7a2a', wing2: '#f5e44a', tail: '#2d5fab', beak: '#f0d49a', scallop: true, tailLen: 1.0 }),
  cockatiel:  bird({ size: 0.68, main: '#9b9b9b', belly: '#a8a8a8', face: '#f6e05a', cheek: '#f08a32', crest: '#f6e05a', crestType: 'tall', wing: '#808080', wing2: '#ffffff', tail: '#8a8a8a', beak: '#b8a898', tailLen: 1.1 }),
  lorikeet:   bird({ size: 0.72, main: '#46b43a', belly: '#ff6a1f', face: '#2f4fd4', wing: '#2f9a2f', tail: '#46b43a', beak: '#ff3b2f', tailLen: 0.8 }),
  bluegold:   bird({ size: 1.05, main: '#2d8ad8', belly: '#ffc928', face: '#ffffff', faceLines: true, wing: '#1f62b0', wing2: '#1d4f96', tail: '#2d8ad8', beak: '#262626', bigBeak: true, tailLen: 1.6 }),
  cockatoo:   bird({ size: 0.95, main: '#fbfbf5', belly: '#ffffff', face: '#ffffff', crest: '#ffd72e', crestType: 'big', wing: '#ecece4', tail: '#f4f4ec', beak: '#262626', bigBeak: true, tailLen: 0.8 }),
  africangrey: bird({ size: 0.86, main: '#8e949a', belly: '#9aa0a6', face: '#dde1e4', wing: '#767c82', tail: '#e03a2f', beak: '#1d1d1d', bigBeak: true, scallop: true, tailLen: 0.6 }),
  scarlet:    bird({ size: 1.05, main: '#e5302a', belly: '#e5302a', face: '#ffffff', wing: '#ffd23a', wing2: '#2f6fd8', tail: '#e5302a', tail2: '#2f6fd8', beak: '#efe4cc', bigBeak: true, tailLen: 1.7 }),
  greenwing:  bird({ size: 1.12, main: '#c62a2a', belly: '#c62a2a', face: '#ffffff', faceLines: true, faceLineCol: '#c62a2a', wing: '#3fae5a', wing2: '#2f5fd0', tail: '#c62a2a', tail2: '#2f5fd0', beak: '#efe4cc', bigBeak: true, tailLen: 1.7 }),
  peacock:    bird({ size: 1.1, main: '#1f62d6', belly: '#1d4fb0', face: '#1f62d6', crest: '#1f62d6', crestType: 'fan', wing: '#c9b27a', tail: '#2f9e5a', beak: '#8a8a8a', train: true, tailLen: 2.2 }),
  toucan:     bird({ size: 0.9, main: '#1d1d1d', belly: '#1d1d1d', face: '#ffffff', wing: '#141414', tail: '#1d1d1d', beak: '#ff8a1f', toucanBeak: true, eyeRing: '#4fa8ff', tailLen: 0.9 }),
  hyacinth:   bird({ size: 1.18, main: '#2b3fae', belly: '#2f46b8', face: '#2b3fae', eyeRing: '#ffd82e', jaw: '#ffd82e', wing: '#23348f', tail: '#2b3fae', beak: '#1d1d1d', bigBeak: true, tailLen: 1.8 }),
  // Reptiles
  redeared:   { plan: 'turtle', size: 0.85, shell: '#5f7a2e', scute: '#3d5520', skin: '#6e8a3a', stripe: '#e8d64a', ear: '#e03a2a', eye: '#1d1d1d' },
  boxturtle:  { plan: 'turtle', size: 0.85, dome: 1.4, shell: '#5c3a1a', scute: '#f0a02a', blotch: true, skin: '#c88a3a', stripe: '#f0b040', eye: '#c0301a' },
  leopardtortoise: { plan: 'turtle', size: 1.15, dome: 1.6, shell: '#e6c88a', scute: '#3d2a1a', blotch: true, skin: '#d4b47c', eye: '#1d1d1d' },
  galapagos:  { plan: 'turtle', size: 1.7, dome: 1.35, shell: '#5c5448', scute: '#433c33', skin: '#77705f', longNeck: true, eye: '#1d1d1d' },
  seaturtle:  { plan: 'turtle', size: 1.35, shell: '#7a5a2e', scute: '#4a3216', skin: '#8a9a6a', flippers: true, eye: '#1d1d1d', swims: true },
  leopardgecko: { plan: 'lizard', size: 0.75, main: '#f2d24a', belly: '#fff3d0', spot: '#3a2a1a', spots: true, tailFat: true, eye: '#3a3a3a', bigEye: true },
  beardie:    { plan: 'lizard', size: 1.0, main: '#d9a45a', belly: '#efcf98', spot: '#b07a3a', beard: true, eye: '#3a2412' },
  bluetongue: { plan: 'lizard', size: 1.0, main: '#a89a82', belly: '#d4c8b0', spot: '#5a4a3a', bands: true, tongue: '#2f5fd8', shortLegs: true, eye: '#1d1d1d' },
  chameleon:  { plan: 'lizard', size: 0.9, main: '#5ec44a', belly: '#9ee07a', spot: '#e8d84a', stripes: true, casque: true, curlTail: true, eye: '#5ec44a', coneEye: true },
  ballpython: { plan: 'snake', size: 1.0, main: '#4a3424', blotch: '#c89a4a', belly: '#efe2c2', eye: '#1d1d1d' },
  // Small pets
  hamster:    { plan: 'blob', size: 0.6, main: '#e9a65a', belly: '#fff3e0', ears: 'round', cheeks: true, eye: '#1d1d1d', nose: '#f29aa6' },
  guineapig:  { plan: 'blob', size: 0.85, long: 1.3, main: '#ffffff', patch: '#2a2422', patch2: '#c87a3a', ears: 'petal', eye: '#1d1d1d', nose: '#e8a0a8' },
  hollandlop: { plan: 'blob', size: 0.85, main: '#c9a171', belly: '#efdcc0', ears: 'lop', tail: 'cotton', eye: '#2a1a10', nose: '#e8a0a8', hops: true },
  ferret:     { plan: 'quad', kind: 'ferret', len: 42, ht: 12, leg: 5.5, head: 9, snout: 0.6, ears: 'round', tail: 'long', main: '#f0e6d2', belly: '#f6efe2', dark: '#5a4632', pattern: 'ferret', eye: '#1d1d1d', nose: '#f29aa6' },
  hedgehog:   { plan: 'blob', size: 0.75, main: '#f0dcc0', spikes: '#7a6650', ears: 'round', eye: '#1d1d1d', nose: '#2a1c10' },
  chinchilla: { plan: 'blob', size: 0.75, main: '#9aa0a6', belly: '#f0f0f0', ears: 'big', tail: 'bushy', eye: '#1d1d1d', nose: '#f29aa6', hops: true },
  sugarglider: { plan: 'blob', size: 0.55, main: '#a8a8ae', belly: '#f2ead8', stripe: '#3a3a3a', ears: 'big', tail: 'long', eye: '#1d1d1d', bigEye: true, nose: '#f29aa6' },
  // Aquatic
  goldfish:   { plan: 'fish', size: 0.6, main: '#ff8a1f', fin: '#ffb04a', fancy: true, eye: '#1d1d1d' },
  koi:        { plan: 'fish', size: 0.95, long: 1.4, main: '#ffffff', fin: '#f4f4f4', patch: '#e8401f', patch2: '#1d1d1d', eye: '#1d1d1d' },
  clownfish:  { plan: 'fish', size: 0.6, main: '#ff7a1a', fin: '#ff9a3a', bands: true, eye: '#1d1d1d' },
  axolotl:    { plan: 'axolotl', size: 0.85, main: '#f6b6c8', gills: '#e0487a', belly: '#fbd2de', eye: '#1d1d1d' },
  // Farm
  goat:       { plan: 'quad', kind: 'goat', len: 36, ht: 18, leg: 14, head: 11, snout: 0.65, ears: 'side', tail: 'stub', horns: true, beard: true, main: '#a06c3c', belly: '#ead6b6', dark: '#5a3a1e', pattern: 'chest', eye: '#c8902a', nose: '#3a2a1a' },
  minipig:    { plan: 'quad', kind: 'pig', len: 38, ht: 21, leg: 8, head: 13, snout: 0.45, pigNose: true, ears: 'pig', tail: 'pig', main: '#e9b896', belly: '#f2cbb0', dark: '#3a2a22', pattern: 'pigspots', tassels: true, eye: '#1d1d1d', nose: '#d68a7a' },
  alpaca:     { plan: 'quad', kind: 'alpaca', len: 34, ht: 20, leg: 16, neck: 24, head: 10, snout: 0.45, ears: 'banana', tail: 'puff', main: '#f3ece1', belly: '#f8f4ec', dark: '#d8ccb8', fluffy: true, eye: '#1d1d1d', nose: '#3a2a1a' },
  pony:       { plan: 'quad', kind: 'horse', len: 44, ht: 22, leg: 17, neck: 12, head: 11, snout: 1.15, ears: 'pointySmall', tail: 'hair', mane: '#2e2016', main: '#8a5a2e', belly: '#9a6a3e', dark: '#2e2016', eye: '#1d1d1d', nose: '#3a2a1a', hooves: true },
  capybara:   { plan: 'quad', kind: 'capy', len: 48, ht: 22, leg: 8, head: 14, snout: 1.05, blunt: true, ears: 'tiny', tail: 'none', main: '#a8784a', belly: '#b88a5a', dark: '#7a5230', eye: '#1d1d1d', nose: '#3a2a1a' },
  kangaroo:   { plan: 'biped', size: 1.25, main: '#c4643a', belly: '#ead0b2', dark: '#7a3a1e', ears: 'tall', eye: '#1d1d1d', nose: '#2a1c10', tail: 'thick', hops: true },
  // Exotic
  fennec:     { plan: 'quad', kind: 'fox', len: 32, ht: 14, leg: 11, head: 10, snout: 0.72, ears: 'huge', tail: 'bushy', main: '#f2d2a0', belly: '#fff6e6', dark: '#3a2a1a', tailTip: '#3a2a1a', eye: '#2a1a10', nose: '#2a1c10' },
  quokka:     { plan: 'biped', size: 0.8, main: '#8b6b4a', belly: '#bea07e', dark: '#5a4028', ears: 'round', eye: '#1d1d1d', nose: '#2a1c10', tail: 'thin', smile: true, hops: true },
  wombat:     { plan: 'quad', kind: 'wombat', len: 40, ht: 21, leg: 7, head: 13.5, snout: 0.5, blunt: true, ears: 'pointySmall', tail: 'none', main: '#8a7a6a', belly: '#9a8a7a', dark: '#5a4a3a', eye: '#1d1d1d', nose: '#2a1c10' },
  redpanda:   { plan: 'quad', kind: 'panda', len: 36, ht: 16, leg: 9, head: 12, snout: 0.38, ears: 'pointyWhite', tail: 'ringed', main: '#c8502a', belly: '#2a1a14', dark: '#2a1a14', pattern: 'redpanda', eye: '#1d1d1d', nose: '#1d1d1d', fluffy: true },
  koala:      { plan: 'sitter', size: 1.0, main: '#9a9aa4', belly: '#ececec', ears: 'koala', nose: '#2a2a2a', bigNose: true, eye: '#1d1d1d' },
  arcticfox:  { plan: 'quad', kind: 'fox', len: 36, ht: 16, leg: 11, head: 11, snout: 0.6, ears: 'pointy', tail: 'bushy', main: '#f6f8fb', belly: '#ffffff', dark: '#dfe5ec', eye: '#2a1a10', nose: '#2a1c10', fluffy: true },
  sloth:      { plan: 'sitter', size: 1.0, main: '#a89478', belly: '#c4b496', face: '#eadfc4', mask: '#3a2a1a', ears: 'none', nose: '#2a1c10', eye: '#1d1d1d', longArms: true, smile: true },
  platypus:   { plan: 'quad', kind: 'platypus', len: 40, ht: 12, leg: 4.5, head: 10, snout: 0, bill: '#3a3a3a', ears: 'none', tail: 'paddle', main: '#6b4a2e', belly: '#8a6a4a', dark: '#4a3220', eye: '#1d1d1d', nose: '#3a3a3a', webbed: true },
  snowleopard: { plan: 'quad', kind: 'bigcat', len: 50, ht: 20, leg: 12, head: 13, snout: 0.35, ears: 'catSmall', tail: 'thick', main: '#e9e5dd', belly: '#f6f4f0', dark: '#4a4a4a', pattern: 'rosettes', eye: '#9ab8a0', nose: '#d89a9a', whiskers: true },
  wildfox:    { plan: 'quad', kind: 'fox', len: 38, ht: 15, leg: 12, head: 11, snout: 0.8, ears: 'pointy', tail: 'bushy', main: '#e0662a', belly: '#fff4e8', dark: '#2a1a10', tailTip: '#ffffff', eye: '#d8a020', nose: '#1d1d1d', pattern: 'blaze' },
  whitetiger: { plan: 'quad', kind: 'bigcat', len: 54, ht: 23, leg: 14, head: 14.5, snout: 0.38, ears: 'catSmall', tail: 'long', main: '#f6f2ea', belly: '#ffffff', dark: '#262626', pattern: 'stripes', eye: '#4aa3ff', nose: '#e8a0a8', whiskers: true },
};

// ---------- drawing primitives ----------
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
function fill(c, col) { c.fillStyle = col; c.fill(); }
function fs(c, col) { c.fillStyle = col; c.fill(); c.stroke(); }
function rrect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); }

// Seeded random so markings stay put between frames.
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const seedOf = str => { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return h || 1; };

// Cloud-like fluffy fill around an ellipse.
function fluffy(c, x, y, rx, ry, col, n = 14, rot = 0) {
  const r = Math.min(rx, ry) * 0.42;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = Math.cos(a) * rx * 0.88, py = Math.sin(a) * ry * 0.88;
    pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  for (const [px, py] of pts) { circle(c, px, py, r); c.stroke(); }
  for (const [px, py] of pts) { circle(c, px, py, r); fill(c, col); }
  ell(c, x, y, rx * 0.95, ry * 0.95, rot); fill(c, col);
}

function eye(c, x, y, r, P, st) {
  if (st.closed) {
    c.beginPath(); c.arc(x, y - r * 0.2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); c.lineWidth = c.lineWidth; c.stroke();
    return;
  }
  ell(c, x, y, r, r * (st.blink ? 0.12 : 1.05)); fs(c, '#ffffff');
  if (st.blink) return;
  circle(c, x + r * 0.22, y + r * 0.08, r * 0.68); fill(c, P.eye || '#1d1d1d');
  if (P.eye && P.eye !== '#1d1d1d' && P.eye !== '#2a1a10' && P.eye !== '#3a2412') { circle(c, x + r * 0.26, y + r * 0.1, r * 0.36); fill(c, '#111'); }
  circle(c, x + r * 0.42, y - r * 0.28, r * 0.26); fill(c, '#ffffff');
}

function zzz(c, x, y, t) {
  c.save(); c.font = 'bold 9px Fredoka, sans-serif'; c.fillStyle = '#ffffff'; c.strokeStyle = OUT; c.lineWidth = 2.2;
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.5 + i / 3) % 1);
    const s = 0.6 + p * 0.8;
    c.globalAlpha = 1 - p;
    c.save(); c.translate(x + p * 10 + Math.sin(p * 6) * 2, y - p * 22); c.scale(s, s);
    c.strokeText('z', 0, 0); c.fillText('z', 0, 0); c.restore();
  }
  c.restore();
}

// ---------- body plans ----------
function legPath(c, x, top, len, w, angle, col, foot) {
  c.save(); c.translate(x, top); c.rotate(angle);
  rrect(c, -w / 2, -2, w, len + 2, w / 2); fs(c, col);
  if (foot) { ell(c, w * 0.15, len, w * 0.62, w * 0.42); fs(c, foot); }
  c.restore();
}

function drawTail(c, A, P, x, y, wag, scale = 1) {
  const col = P.main, t = A.tail;
  c.save(); c.translate(x, y); c.rotate(wag);
  switch (t) {
    case 'curl': c.beginPath(); c.arc(-3, -5, 5 * scale, 0.5 * Math.PI, 2.3 * Math.PI); c.lineWidth = 4.5 * scale; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.6 * scale; c.strokeStyle = col; c.stroke(); break;
    case 'curlFluffy': c.lineWidth = 1.6; fluffy(c, -4, -9, 8 * scale, 7 * scale, P.belly || col, 9); break;
    case 'long': case 'thin': case 'feather': {
      const w = t === 'thin' ? 2.6 : t === 'feather' ? 5.5 : 4;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-12 * scale, -2, -16 * scale, -14 * scale);
      c.lineCap = 'round'; c.lineWidth = w + 2.6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = w; c.strokeStyle = A.pattern === 'points' || A.pattern === 'husky' ? P.dark : col; c.stroke();
      if (A.pattern === 'stripes' || A.pattern === 'tabby') { c.strokeStyle = P.dark; c.lineWidth = w * 0.9; c.setLineDash([2.2, 3.5]); c.stroke(); c.setLineDash([]); }
      if (A.pattern === 'spots') { circle(c, -13 * scale, -9 * scale, 1.6); fill(c, P.dark); }
      break; }
    case 'thick': {
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-16 * scale, 2, -22 * scale, -10 * scale);
      c.lineCap = 'round'; c.lineWidth = 9.5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 7; c.strokeStyle = col; c.stroke();
      if (A.pattern === 'rosettes') { [[-8, 1], [-15, -2], [-20, -8]].forEach(([px, py]) => { circle(c, px * scale, py * scale, 1.8); fill(c, P.dark); }); }
      break; }
    case 'bushy': case 'ringed':
      c.lineWidth = 1.6;
      ell(c, -12 * scale, -7 * scale, 13 * scale, 6.5 * scale, -0.45); fs(c, col);
      if (t === 'ringed') { c.save(); ell(c, -12 * scale, -7 * scale, 13 * scale, 6.5 * scale, -0.45); c.clip(); c.fillStyle = '#f6e0c8'; for (let i = 0; i < 4; i++) { c.save(); c.translate(-4 * scale - i * 6 * scale, -3 * scale - i * 2.6 * scale); c.rotate(-0.45); c.fillRect(-1.5, -10, 3, 20); c.restore(); } c.restore(); ell(c, -12 * scale, -7 * scale, 13 * scale, 6.5 * scale, -0.45); c.stroke(); }
      if (P.tailTip || A.pattern === 'husky') { ell(c, -22 * scale, -11.5 * scale, 4 * scale, 3.4 * scale, -0.45); fs(c, P.tailTip || '#ffffff'); }
      break;
    case 'stub': ell(c, -1, -3, 3.2, 2.6); fs(c, col); break;
    case 'puff': ell(c, -2, -3, 5, 4.5); fs(c, col); break;
    case 'pig': c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-6, -1, -6, -7, -2, -6); c.bezierCurveTo(1, -5, -2, -2, -5, -3); c.lineWidth = 3.4; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 1.8; c.strokeStyle = col; c.stroke(); break;
    case 'hair':
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(-10, 0, -9, 18); c.quadraticCurveTo(-4, 12, 2, 4); c.closePath(); fs(c, A.mane || P.dark); break;
    case 'paddle': ell(c, -8, 1, 10, 4, 0.1); fs(c, P.dark); c.save(); c.globalAlpha = 0.3; c.strokeStyle = '#000'; for (let i = -14; i < -2; i += 3) { c.beginPath(); c.moveTo(i, -2); c.lineTo(i + 1, 4); c.stroke(); } c.restore(); break;
  }
  c.restore();
}

function drawEars(c, A, P, hx, hy, r, back, st) {
  const e = A.ears;
  const dark = A.pattern === 'points' || A.pattern === 'mask' || A.pattern === 'husky' || A.pattern === 'collie' ? P.dark : P.main;
  c.save();
  const flop = st.walk ? Math.sin(st.ph) * 0.12 : 0;
  const tri = (bx, by, h, w, lean, col, inner) => {
    c.beginPath(); c.moveTo(bx - w / 2, by); c.lineTo(bx + lean, by - h); c.lineTo(bx + w / 2, by); c.closePath(); fs(c, col);
    if (inner) { c.beginPath(); c.moveTo(bx - w * 0.25, by - 1); c.lineTo(bx + lean * 0.8, by - h * 0.7); c.lineTo(bx + w * 0.25, by - 1); c.closePath(); fill(c, inner); }
  };
  const side = back ? -1 : 1;
  const bx = hx + (back ? -r * 0.45 : r * 0.05);
  const by = hy - r * 0.62;
  if (back) c.filter = 'none';
  const bcol = back ? shade(dark, -0.08) : dark;
  switch (e) {
    case 'cat': case 'catSmall': case 'catBig': case 'tufted': case 'fold': {
      const h = e === 'catBig' ? r * 1.15 : e === 'catSmall' ? r * 0.55 : r * 0.8;
      if (e === 'fold') { ell(c, bx + 1, by + 1, r * 0.32, r * 0.2, 0.4); fs(c, bcol); break; }
      tri(bx, by + 2, h, r * 0.75, r * 0.05, bcol, back ? null : '#f6b8b8');
      if (e === 'tufted' && !back) { c.beginPath(); c.moveTo(bx, by + 2 - h); c.lineTo(bx + 1, by - h - 4); c.stroke(); }
      break; }
    case 'pointy': case 'pointyBig': case 'pointySmall': case 'pointyWhite': {
      const h = e === 'pointyBig' ? r * 1.05 : e === 'pointySmall' ? r * 0.55 : r * 0.8;
      tri(bx, by + 2, h, r * 0.72, r * 0.08, bcol, back ? null : (e === 'pointyWhite' ? '#ffffff' : shade(P.belly || P.main, 0.05)));
      break; }
    case 'huge': tri(bx - 1, by + 3, r * 1.9, r * 1.05, -r * 0.1, bcol, back ? null : '#f6c8b0'); break;
    case 'bat': ell(c, bx, by - r * 0.32, r * 0.42, r * 0.68, back ? -0.35 : 0.15); fs(c, bcol); if (!back) { ell(c, bx + 0.5, by - r * 0.25, r * 0.22, r * 0.45, 0.15); fill(c, '#d89a9a'); } break;
    case 'semi': c.save(); c.translate(bx, by + 2); c.rotate(0.25); tri(0, 0, r * 0.7, r * 0.7, r * 0.35, bcol); c.restore(); break;
    case 'floppy': case 'floppyLong': case 'floppySmall': {
      const L = e === 'floppyLong' ? r * 1.25 : e === 'floppySmall' ? r * 0.55 : r * 0.95;
      c.save(); c.translate(bx - side, by + 3); c.rotate(0.35 + flop + (back ? -0.2 : 0));
      ell(c, -1, L * 0.45, r * 0.34, L * 0.6); fs(c, A.pattern === 'mask' ? P.dark : shade(P.main, -0.12)); c.restore(); break; }
    case 'round': circle(c, bx, by + 1, r * 0.32); fs(c, bcol); if (!back) { circle(c, bx, by + 1, r * 0.17); fill(c, '#f2b0b0'); } break;
    case 'tiny': circle(c, bx - 1, by + 2, r * 0.2); fs(c, bcol); break;
    case 'side': c.save(); c.translate(bx - 2, by + 4); c.rotate(-0.9 - flop); ell(c, -r * 0.4, 0, r * 0.5, r * 0.2); fs(c, bcol); c.restore(); break;
    case 'pig': c.save(); c.translate(bx, by + 2); c.rotate(0.3); c.beginPath(); c.moveTo(-r * 0.3, 0); c.quadraticCurveTo(r * 0.2, -r * 0.8, r * 0.55, -r * 0.2); c.closePath(); fs(c, bcol); c.restore(); break;
    case 'banana': c.save(); c.translate(bx, by + 3); c.rotate(0.15); ell(c, 0, -r * 0.5, r * 0.2, r * 0.6); fs(c, bcol); c.restore(); break;
  }
  c.restore();
}

function drawPattern(c, A, P, bx, by, L, H, seed) {
  const R = rng(seed);
  switch (A.pattern) {
    case 'spots': for (let i = 0; i < 14; i++) { circle(c, bx + (R() - 0.5) * L, by + (R() - 0.5) * H, 1.4 + R() * 1.8); fill(c, P.dark); } break;
    case 'rosettes': for (let i = 0; i < 16; i++) { const x = bx + (R() - 0.5) * L, y = by + (R() - 0.6) * H; c.lineWidth = 1.3; circle(c, x, y, 1.8 + R()); c.strokeStyle = P.dark; c.stroke(); } c.strokeStyle = OUT; break;
    case 'stripes': case 'tabby': {
      c.strokeStyle = P.dark; c.lineWidth = A.pattern === 'stripes' ? 2.4 : 1.8; c.lineCap = 'round';
      for (let x = bx - L / 2 + 5; x < bx + L / 2 - 3; x += A.pattern === 'stripes' ? 5.5 : 6.5) { c.beginPath(); c.moveTo(x, by - H / 2 - 1); c.quadraticCurveTo(x + 2, by - H * 0.1, x - 1, by + H * 0.15); c.stroke(); }
      c.strokeStyle = OUT; break; }
    case 'patches': case 'pigspots': for (let i = 0; i < 4; i++) { ell(c, bx + (R() - 0.5) * L * 0.8, by + (R() - 0.7) * H * 0.6, 3 + R() * 4, 2.5 + R() * 3, R()); fill(c, P.dark); } break;
    case 'collie': ell(c, bx + L * 0.38, by + 1, L * 0.16, H * 0.55); fill(c, P.belly); break;
    case 'husky': case 'urajiro': case 'chest': case 'blaze': ell(c, bx + L * 0.32, by + H * 0.25, L * 0.2, H * 0.4); fill(c, P.belly); break;
    case 'ferret': break;
    case 'redpanda': ell(c, bx, by + H * 0.4, L * 0.5, H * 0.3); fill(c, P.dark); break;
  }
  ell(c, bx, by + H * 0.32, L * 0.38, H * 0.22); fill(c, P.belly && A.pattern !== 'redpanda' ? P.belly : 'rgba(0,0,0,0)');
}

function quad(c, A, P, pose, t, st) {
  const L = A.len, H = A.ht, leg = A.leg, r = A.head;
  const walk = pose === 'walk', sleep = pose === 'sleep', play = pose === 'play', eat = pose === 'eat';
  const ph = t * (A.kind === 'wombat' || A.kind === 'capy' ? 9 : 12);
  st.ph = ph; st.walk = walk;
  const lift = play ? Math.abs(Math.sin(t * 7)) * 10 : 0;
  const bob = walk ? Math.abs(Math.sin(ph)) * 1.4 : Math.sin(t * 2.2) * 0.4;
  const legLen = sleep ? 0 : leg;
  const by = sleep ? -H * 0.48 : -(legLen + H * 0.42) - bob - lift;
  const bx = 0;
  const legTop = by + H * 0.22;
  const swing = walk ? Math.sin(ph) * 0.55 : play ? 0.5 : 0;
  const legCol = A.pattern === 'points' || A.pattern === 'redpanda' || A.pattern === 'ferret' ? P.dark : P.main;
  const farLeg = shade(legCol, -0.12);
  const footCol = A.pattern === 'collie' || A.pattern === 'husky' ? P.belly : A.hooves ? '#2a2018' : null;
  const lw = A.kind === 'horse' || A.kind === 'alpaca' || A.kind === 'goat' ? 4.5 : Math.max(4.5, H * 0.32);
  const fx = L * 0.33, rx = -L * 0.32;
  // far legs
  if (!sleep) {
    legPath(c, fx + 3, legTop, legLen + bob + lift * 0.3, lw, -swing, farLeg, footCol && shade(footCol, -0.1));
    legPath(c, rx + 3, legTop, legLen + bob + lift * 0.3, lw, swing, farLeg, footCol && shade(footCol, -0.1));
  }
  // tail
  const wag = pose === 'idle' || play ? Math.sin(t * (A.kind === 'cat' || A.kind === 'bigcat' ? 2 : 9)) * 0.3 : walk ? Math.sin(ph) * 0.15 : 0;
  if (A.tail && A.tail !== 'none') {
    if (sleep && (A.tail === 'long' || A.tail === 'thick' || A.tail === 'bushy' || A.tail === 'ringed')) drawTail(c, A, P, -L * 0.45, by + H * 0.2, -1.9);
    else drawTail(c, A, P, -L * 0.47, by - H * 0.15, wag);
  }
  // body
  c.lineWidth = 1.6;
  if (A.fluffy) fluffy(c, bx, by, L * 0.52, H * 0.55, P.main, 16);
  else { ell(c, bx, by, L * 0.52, H * 0.52); fs(c, P.main); }
  c.save(); ell(c, bx, by, L * 0.52, H * 0.52); c.clip(); drawPattern(c, A, P, bx, by, L, H, st.seed); c.restore();
  if (A.pattern === 'husky') { c.save(); ell(c, bx, by, L * 0.52, H * 0.52); c.clip(); ell(c, bx, by - H * 0.45, L * 0.55, H * 0.35); fill(c, P.dark); c.restore(); }
  if (A.pattern === 'collie') { c.save(); ell(c, bx, by, L * 0.52, H * 0.52); c.clip(); ell(c, bx, by + H * 0.55, L * 0.55, H * 0.35); fill(c, P.belly); c.restore(); }
  if (A.pattern === 'urajiro' || A.pattern === 'blaze' || A.pattern === 'chest') { c.save(); ell(c, bx, by, L * 0.52, H * 0.52); c.clip(); ell(c, bx + L * 0.1, by + H * 0.55, L * 0.45, H * 0.3); fill(c, P.belly); c.restore(); }
  if (!A.fluffy) { ell(c, bx, by, L * 0.52, H * 0.52); c.stroke(); }
  // near legs
  if (!sleep) {
    legPath(c, fx, legTop, legLen + bob + lift * 0.3, lw, swing, legCol, footCol);
    legPath(c, rx, legTop, legLen + bob + lift * 0.3, lw, -swing, legCol, footCol);
  } else {
    ell(c, fx + 2, -2.5, lw * 1.1, 2.6); fs(c, legCol);
  }
  // neck and head
  const neck = A.neck || 0;
  let hx = L * 0.42 + (A.kind === 'horse' ? 6 : 0), hy = by - H * 0.38 - neck;
  if (sleep) { hx = L * 0.48; hy = -r * 0.85; }
  if (eat) { hx = L * 0.52 + neck * 0.3; hy = -r * 0.9; }
  if (neck && !sleep) {
    const nx = L * 0.36, ny = by - H * 0.2;
    c.beginPath(); c.moveTo(nx - 5, ny); c.quadraticCurveTo(hx - 6, (ny + hy) / 2, hx - r * 0.5, hy + r * 0.3);
    c.lineTo(hx + r * 0.3, hy + r * 0.5); c.quadraticCurveTo(hx, (ny + hy) / 2 + 4, nx + 6, ny + 2); c.closePath();
    if (A.fluffy) { fs(c, P.main); } else fs(c, P.main);
    if (A.mane) { c.beginPath(); c.moveTo(nx - 6, ny - 1); c.quadraticCurveTo(hx - 9, (ny + hy) / 2 - 2, hx - r * 0.55, hy - r * 0.4); c.lineTo(hx - r * 0.2, hy - r * 0.2); c.quadraticCurveTo(hx - 5, (ny + hy) / 2, nx, ny); c.closePath(); fs(c, A.mane); }
  }
  const headBob = walk ? Math.sin(ph * 2) * 0.6 : 0;
  hy += headBob;
  drawEars(c, A, P, hx, hy, r, true, st);
  // head shape
  c.lineWidth = 1.6;
  if (A.fluffy && A.kind !== 'alpaca') fluffy(c, hx, hy, r * 1.02, r * 0.95, P.main, 11);
  else { ell(c, hx, hy, r, r * 0.92); fs(c, P.main); }
  if (A.pattern === 'husky' || A.pattern === 'urajiro' || A.pattern === 'collie' || A.pattern === 'blaze') {
    c.save(); ell(c, hx, hy, r, r * 0.92); c.clip();
    if (A.pattern === 'husky') { ell(c, hx + r * 0.3, hy + r * 0.35, r * 0.85, r * 0.6); fill(c, P.belly); }
    if (A.pattern === 'urajiro') { ell(c, hx + r * 0.45, hy + r * 0.45, r * 0.6, r * 0.5); fill(c, P.belly); }
    if (A.pattern === 'collie' || A.pattern === 'blaze') { c.fillStyle = P.belly; c.fillRect(hx + r * 0.05, hy - r, r * 0.3, r * 2); ell(c, hx + r * 0.5, hy + r * 0.5, r * 0.6, r * 0.45); fill(c, P.belly); }
    c.restore();
  }
  if (A.pattern === 'points' || A.pattern === 'ferret') { c.save(); ell(c, hx, hy, r, r * 0.92); c.clip(); ell(c, hx + r * 0.55, hy + r * 0.2, r * 0.7, r * 0.6); fill(c, P.dark); c.restore(); }
  if (A.pattern === 'redpanda') { c.save(); ell(c, hx, hy, r, r * 0.92); c.clip(); ell(c, hx + r * 0.45, hy + r * 0.45, r * 0.55, r * 0.45); fill(c, '#ffffff'); ell(c, hx + r * 0.25, hy - r * 0.45, r * 0.3, r * 0.2); fill(c, '#ffffff'); c.restore(); }
  if (A.pattern === 'stripes') { c.save(); ell(c, hx, hy, r, r * 0.92); c.clip(); c.strokeStyle = P.dark; c.lineWidth = 1.6; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx - r * 0.2 + i * 3, hy - r); c.lineTo(hx + i * 2, hy - r * 0.55); c.stroke(); } c.strokeStyle = OUT; c.restore(); }
  if (A.pattern === 'tabby' || A.pattern === 'rosettes') { c.save(); ell(c, hx, hy, r, r * 0.92); c.clip(); c.strokeStyle = P.dark; c.lineWidth = 1.3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx + i * 2.5, hy - r); c.lineTo(hx + i * 2, hy - r * 0.6); c.stroke(); } c.strokeStyle = OUT; c.restore(); }
  if (A.fluffy && A.kind !== 'alpaca') { /* outline drawn by fluffy */ } else { ell(c, hx, hy, r, r * 0.92); c.stroke(); }
  // snout / muzzle
  const sl = A.snout;
  const sx = hx + r * 0.62, sy = hy + r * 0.28;
  if (A.bill) { ell(c, hx + r * 1.15, hy + r * 0.25, r * 0.85, r * 0.3, 0.05); fs(c, A.bill); circle(c, hx + r * 1.6, hy + r * 0.15, 0.8); fill(c, '#888'); }
  else if (A.pigNose) { ell(c, hx + r * 0.95, hy + r * 0.25, r * 0.32, r * 0.38); fs(c, P.nose); circle(c, hx + r * 1.02, hy + r * 0.12, 0.9); fill(c, OUT); circle(c, hx + r * 1.02, hy + r * 0.38, 0.9); fill(c, OUT); }
  else if (sl > 0.3) {
    const mcol = A.pattern === 'mask' || A.pattern === 'points' ? P.dark : A.pattern === 'husky' || A.pattern === 'collie' || A.pattern === 'urajiro' || A.pattern === 'blaze' ? P.belly : (A.kind === 'horse' ? shade(P.main, -0.05) : shade(P.main, 0.04));
    const mx = sx + sl * r * 0.35, mrx = r * (0.25 + sl * 0.45), mry = r * (A.blunt ? 0.5 : 0.38);
    ell(c, mx, sy, mrx, mry, A.kind === 'horse' ? 0.35 : 0.05); fs(c, mcol);
    if (A.kind !== 'horse' && A.kind !== 'capy' && A.kind !== 'wombat') { circle(c, mx + mrx * 0.85, sy - mry * 0.45, r * 0.16); fs(c, P.nose); }
    else { circle(c, mx + mrx * 0.6, sy - mry * 0.1, r * 0.08); fill(c, OUT); }
  } else {
    const mcol = A.pattern === 'mask' ? P.dark : (P.belly || P.main);
    ell(c, hx + r * 0.68, hy + r * 0.3, r * 0.36, r * 0.3); fs(c, mcol);
    ell(c, hx + r * 0.88, hy + r * 0.14, r * 0.17, r * 0.12); fs(c, P.nose);
  }
  if (A.wrinkles) { c.lineWidth = 1; c.beginPath(); c.arc(hx + r * 0.35, hy - r * 0.45, r * 0.25, 1.1 * Math.PI, 1.8 * Math.PI); c.stroke(); c.beginPath(); c.arc(hx + r * 0.4, hy - r * 0.25, r * 0.3, 1.1 * Math.PI, 1.8 * Math.PI); c.stroke(); c.lineWidth = 1.6; }
  if (A.whiskers && !sleep) { c.save(); c.lineWidth = 0.6; c.strokeStyle = 'rgba(40,30,20,.7)'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(hx + r * 0.85, hy + r * 0.38); c.lineTo(hx + r * 1.6, hy + r * 0.3 + i * 2.2); c.stroke(); } c.restore(); }
  // mouth & tongue
  if ((A.smile || play) && !sleep && !eat && A.kind === 'dog') {
    c.beginPath(); c.arc(hx + r * 0.85, hy + r * 0.48, r * 0.25, 0.1 * Math.PI, 0.8 * Math.PI); c.lineWidth = 1.1; c.stroke(); c.lineWidth = 1.6;
    if (play || walk) { ell(c, hx + r * 0.85, hy + r * 0.78, r * 0.13, r * 0.2); fs(c, P.tongue); }
  }
  if (A.beard) { c.beginPath(); c.moveTo(hx + r * 0.75, hy + r * 0.5); c.lineTo(hx + r * 0.6, hy + r * 1.2); c.lineTo(hx + r * 0.95, hy + r * 0.55); c.closePath(); fs(c, shade(P.main, -0.1)); }
  if (A.tassels) { circle(c, hx + r * 0.15, hy + r * 1.05, 2); fs(c, P.main); }
  if (A.horns) { c.beginPath(); c.moveTo(hx - r * 0.1, hy - r * 0.7); c.quadraticCurveTo(hx - r * 0.7, hy - r * 1.6, hx - r * 0.95, hy - r * 0.9); c.lineTo(hx - r * 0.5, hy - r * 0.6); c.closePath(); fs(c, '#d8c8a8'); }
  // eye
  eye(c, hx + r * 0.32, hy - r * 0.12, r * (A.kind === 'cat' || A.kind === 'fox' ? 0.27 : 0.24), P, st);
  if (A.pattern === 'mask' && !sleep) { /* mask darkens around eye via muzzle */ }
  drawEars(c, A, P, hx + r * 0.3, hy, r, false, st);
  if (sleep) zzz(c, hx + r * 0.6, hy - r, t);
}

function birdDraw(c, A, P, pose, t, st) {
  const s = A.size || 1;
  c.save(); c.scale(s, s);
  const fly = pose === 'fly', sleep = pose === 'sleep', walk = pose === 'walk', play = pose === 'play';
  const hop = walk ? Math.abs(Math.sin(t * 9)) * 3 : play ? Math.abs(Math.sin(t * 6)) * 6 : 0;
  const by = -14 - hop;
  const flap = fly ? Math.sin(t * 22) : 0;
  c.lineWidth = 1.6 / s;
  const tl = A.tailLen || 1;
  // peacock train on the ground
  if (A.train) {
    if (play) { // fan display
      c.save(); c.translate(-2, by - 4);
      for (let i = -6; i <= 6; i++) { c.save(); c.rotate(i * 0.2 - 0.3); ell(c, 0, -26, 4.5, 26); fs(c, P.tail); circle(c, 0, -46, 3.6); fs(c, '#2fb0a8'); circle(c, 0, -46, 1.8); fill(c, '#1d3fa0'); c.restore(); }
      c.restore();
    } else {
      c.beginPath(); c.moveTo(-6, by + 4); c.quadraticCurveTo(-30, by + 10, -46, -2); c.lineTo(-40, 0); c.quadraticCurveTo(-20, -1, -2, by + 10); c.closePath(); fs(c, P.tail);
      [[-22, -6], [-32, -4], [-40, -2]].forEach(([x, y]) => { circle(c, x, y, 2.3); fs(c, '#2fb0a8'); circle(c, x, y, 1.1); fill(c, '#1d3fa0'); });
    }
  }
  // tail
  if (!A.train) {
    c.save(); c.translate(-5, by + 6); c.rotate(fly ? 1.35 : 0.5);
    c.beginPath(); c.moveTo(-3.2, 0); c.lineTo(-1.5, 20 * tl); c.lineTo(1.5, 21 * tl); c.lineTo(3.2, 0); c.closePath(); fs(c, P.tail);
    if (A.tail2) { c.beginPath(); c.moveTo(-1.6, 8 * tl); c.lineTo(-0.8, 19.5 * tl); c.lineTo(1.2, 20.5 * tl); c.lineTo(2, 8 * tl); c.closePath(); fill(c, A.tail2); c.beginPath(); c.moveTo(-3.2, 0); c.lineTo(-1.5, 20 * tl); c.lineTo(1.5, 21 * tl); c.lineTo(3.2, 0); c.closePath(); c.stroke(); }
    c.restore();
  }
  // legs
  if (!fly) { c.strokeStyle = '#5a5050'; c.lineWidth = 1.8 / s; c.beginPath(); c.moveTo(-1, by + 9); c.lineTo(-2, -hop); c.moveTo(3, by + 9); c.lineTo(3, -hop); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.6 / s; }
  // far wing when flying
  if (fly) { c.save(); c.translate(0, by - 2); c.rotate(-0.4 - flap * 0.9); ell(c, -6, -8, 6, 14, 0.2); fs(c, shade(A.wing || P.main, -0.1)); c.restore(); }
  // body
  const rot = fly ? 1.15 : 0.45;
  ell(c, 0, by, 10, 13, rot); fs(c, P.main);
  c.save(); ell(c, 0, by, 10, 13, rot); c.clip(); ell(c, 6, by + 5, 7, 10, rot); fill(c, P.belly); if (A.scallop) { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.8; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-4 + (i % 3) * 4, by - 6 + Math.floor(i / 3) * 4, 2, 0, Math.PI); c.stroke(); } c.strokeStyle = OUT; } c.restore();
  ell(c, 0, by, 10, 13, rot); c.stroke();
  // wing
  c.save(); c.translate(-2, by - 2);
  c.rotate(fly ? -0.3 + flap * 0.9 : 0.5 + (play ? Math.sin(t * 12) * 0.3 : 0));
  ell(c, -2, 4, 6, 11, 0.15); fs(c, A.wing || P.main);
  if (A.wing2) { ell(c, -3, 11, 4, 5, 0.15); fill(c, A.wing2); ell(c, -2, 4, 6, 11, 0.15); c.stroke(); }
  c.restore();
  // head
  let hx = fly ? 12 : 6, hy = fly ? by - 4 : by - 13;
  if (sleep) { hx = 3; hy = by - 9; }
  if (pose === 'eat') { hx = 10; hy = by - 4; }
  if (A.crest) {
    c.save(); c.translate(hx - 2, hy - 6);
    if (A.crestType === 'tall') { c.rotate(-0.5); ell(c, 0, -7, 2, 8); fs(c, A.crest); }
    else if (A.crestType === 'big') { for (let i = 0; i < 4; i++) { c.save(); c.rotate(-0.9 + i * 0.22); ell(c, 0, -8, 2.2, 9); fs(c, A.crest); c.restore(); } }
    else if (A.crestType === 'fan') { for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(i * 2.5, -8); c.stroke(); circle(c, i * 2.5, -9, 1.3); fs(c, A.crest); } }
    c.restore();
  }
  circle(c, hx, hy, 8); fs(c, P.main);
  c.save(); circle(c, hx, hy, 8); c.clip();
  if (P.face && P.face !== P.main) { ell(c, hx + 3, hy + 1, 6, 6.5); fill(c, P.face); }
  if (A.faceLines) { c.strokeStyle = A.faceLineCol || '#1d1d1d'; c.lineWidth = 0.6; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(hx + 1, hy - 1 + i * 2); c.lineTo(hx + 6, hy + i * 2); c.stroke(); } c.strokeStyle = OUT; }
  if (A.cheek) { circle(c, hx + 3, hy + 3, 2.6); fill(c, A.cheek); }
  if (A.jaw) { ell(c, hx + 6, hy + 4, 3, 2); fill(c, A.jaw); }
  c.restore();
  circle(c, hx, hy, 8); c.stroke();
  // beak
  c.lineWidth = 1.3 / s;
  if (A.toucanBeak) {
    c.beginPath(); c.moveTo(hx + 4, hy - 4); c.quadraticCurveTo(hx + 26, hy - 6, hx + 27, hy + 2); c.quadraticCurveTo(hx + 18, hy + 4, hx + 5, hy + 3); c.closePath(); fs(c, A.beak);
    c.beginPath(); c.moveTo(hx + 22, hy - 4); c.quadraticCurveTo(hx + 27, hy - 3, hx + 27, hy + 2); c.lineTo(hx + 22, hy + 2); c.closePath(); fill(c, '#1d1d1d');
  } else {
    const bs = A.bigBeak ? 1.4 : 0.8;
    c.beginPath(); c.moveTo(hx + 6, hy - 3 * bs); c.quadraticCurveTo(hx + 12 * bs, hy - 3 * bs, hx + 10 * bs, hy + 5 * bs); c.quadraticCurveTo(hx + 8, hy + 2, hx + 6, hy + 2); c.closePath(); fs(c, P.beak);
    if (A.bigBeak) { c.beginPath(); c.moveTo(hx + 6, hy + 2); c.quadraticCurveTo(hx + 10, hy + 3, hx + 9, hy + 6); c.quadraticCurveTo(hx + 7, hy + 6, hx + 5, hy + 4); c.closePath(); fs(c, shade(P.beak, -0.08)); }
  }
  c.lineWidth = 1.6 / s;
  if (A.eyeRing) { circle(c, hx + 2, hy - 1.5, 3.4); fill(c, A.eyeRing); }
  eye(c, hx + 2, hy - 1.5, 2.4, P, st);
  if (sleep) zzz(c, hx + 6, hy - 8, t);
  c.restore();
}

function turtleDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s); c.lineWidth = 1.6 / s;
  const walk = pose === 'walk' || pose === 'swim', sleep = pose === 'sleep';
  const ph = t * 5;
  const dome = A.dome || 1;
  const legSw = walk ? Math.sin(ph) * 2.5 : 0;
  // legs / flippers
  if (A.flippers) {
    c.save(); c.translate(6, -6); c.rotate(0.6 + Math.sin(t * 4) * 0.4); ell(c, 6, 0, 9, 3.2); fs(c, P.skin); c.restore();
    c.save(); c.translate(-10, -5); c.rotate(-0.4 - Math.sin(t * 4) * 0.3); ell(c, -4, 0, 5, 2.4); fs(c, P.skin); c.restore();
  } else if (!sleep) {
    [[9 + legSw, 0], [-9 - legSw, 0], [5 - legSw, 0], [-5 + legSw, 0]].forEach(([x], i) => { rrect(c, x - 2.6, -6, 5.2, 6.5, 2.4); fs(c, i > 1 ? P.skin : shade(P.skin, -0.12)); });
  }
  // head
  if (!sleep) {
    const hx = 15 + (walk ? Math.sin(ph * 0.5) * 1 : 0), hy = A.longNeck ? -15 : -7;
    if (A.longNeck) { c.beginPath(); c.moveTo(8, -8); c.quadraticCurveTo(13, -14, hx - 2, hy + 1); c.lineTo(hx, hy + 5); c.quadraticCurveTo(14, -8, 9, -4); c.closePath(); fs(c, P.skin); }
    ell(c, hx, hy, 5.5, 4.2); fs(c, P.skin);
    if (P.stripe) { c.save(); ell(c, hx, hy, 5.5, 4.2); c.clip(); c.strokeStyle = P.stripe; c.lineWidth = 0.9; c.beginPath(); c.moveTo(hx - 6, hy + 1); c.lineTo(hx + 5, hy + 2); c.stroke(); c.restore(); c.strokeStyle = OUT; c.lineWidth = 1.6 / s; }
    if (P.ear) { ell(c, hx - 2, hy, 1.8, 1); fill(c, P.ear); }
    eye(c, hx + 1.8, hy - 1.2, 1.6, P, st);
  }
  // shell
  const sh = 9 * dome;
  c.beginPath(); c.moveTo(-14, -3); c.quadraticCurveTo(-13, -3 - sh * 1.5, 0, -3 - sh * 1.45); c.quadraticCurveTo(13, -3 - sh * 1.5, 14, -3); c.closePath(); fs(c, P.shell);
  c.save(); c.clip(); c.strokeStyle = P.scute; c.lineWidth = 1.2;
  if (A.blotch) { const R = rng(st.seed); c.fillStyle = P.scute; for (let i = 0; i < 7; i++) { ell(c, -10 + i * 3.4, -5 - R() * sh, 1.6, 1.2); c.fill(); } }
  else { for (let x = -8; x <= 8; x += 8) { c.beginPath(); c.moveTo(x - 3, -3); c.lineTo(x - 2, -3 - sh * 0.8); c.lineTo(x + 3, -3 - sh * 1.1); c.stroke(); } c.beginPath(); c.moveTo(-13, -3 - sh * 0.7); c.lineTo(13, -3 - sh * 0.7); c.stroke(); }
  c.restore();
  rrect(c, -15, -4.5, 30, 3.5, 1.5); fs(c, shade(P.shell, -0.08));
  if (sleep) zzz(c, 12, -12, t);
  c.restore();
}

function lizardDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s); c.lineWidth = 1.6 / s;
  const walk = pose === 'walk', sleep = pose === 'sleep';
  const ph = t * 10;
  const wig = walk ? Math.sin(ph) * 2 : 0;
  const lift = pose === 'play' ? Math.abs(Math.sin(t * 5)) * 4 : 0;
  c.translate(0, -lift);
  // tail
  c.beginPath();
  if (A.curlTail) { c.moveTo(-10, -6); c.quadraticCurveTo(-20, -4, -20, 2); c.arc(-16, 2, 4, Math.PI, 0.2 * Math.PI, true); c.lineWidth = 4.5; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 2.8; c.strokeStyle = P.main; c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.6 / s; }
  else { c.moveTo(-9, -7); c.quadraticCurveTo(-22, -4 + wig, -32, -1 - wig); c.quadraticCurveTo(-22, -1 + wig, -9, -2); c.closePath(); if (A.tailFat) { c.beginPath(); ell(c, -17, -4, 10, 3.6, 0.05); } fs(c, P.main); }
  // legs
  const legY = -3;
  if (!sleep) {
    const ls = A.shortLegs ? 3 : 5;
    [[9, wig], [-6, -wig]].forEach(([x, w]) => { c.beginPath(); c.moveTo(x, legY - 1); c.lineTo(x + 3 + w, 0); c.lineTo(x + 6 + w, 0); c.lineWidth = 2.6; c.stroke(); c.lineWidth = 1.6 / s; });
    c.lineWidth = 1.6 / s; void ls;
  }
  // body
  ell(c, 1, -6, 12, 5); fs(c, P.main);
  c.save(); ell(c, 1, -6, 12, 5); c.clip();
  ell(c, 1, -2.5, 11, 2.5); fill(c, P.belly);
  const R = rng(st.seed);
  if (A.spots) for (let i = 0; i < 9; i++) { circle(c, -10 + R() * 22, -10 + R() * 5, 0.9 + R() * 0.8); fill(c, P.spot); }
  if (A.bands) for (let x = -8; x < 12; x += 5) { c.fillStyle = P.spot; c.fillRect(x, -12, 2.2, 8); }
  if (A.stripes) { c.strokeStyle = P.spot; c.lineWidth = 1.2; for (let x = -8; x < 12; x += 4.5) { c.beginPath(); c.moveTo(x, -11); c.lineTo(x + 1, -3); c.stroke(); } }
  c.restore(); ell(c, 1, -6, 12, 5); c.stroke();
  if (A.beard) { c.fillStyle = shade(P.main, -0.12); for (let x = -8; x < 10; x += 3.5) { c.beginPath(); c.moveTo(x, -10.5); c.lineTo(x + 1.5, -13); c.lineTo(x + 3, -10.5); c.closePath(); c.fill(); c.stroke(); } }
  // head
  const hx = 15, hy = sleep ? -4 : -7;
  c.beginPath(); c.moveTo(hx - 5, hy - 4); c.quadraticCurveTo(hx + 4, hy - 5, hx + 8, hy + 0.5); c.quadraticCurveTo(hx + 3, hy + 3.5, hx - 5, hy + 3); c.closePath(); fs(c, P.main);
  if (A.beard) { c.beginPath(); c.moveTo(hx - 4, hy + 2.5); c.lineTo(hx - 1, hy + 6); c.lineTo(hx + 3, hy + 2.8); c.closePath(); fs(c, shade(P.main, -0.1)); }
  if (A.casque) { c.beginPath(); c.moveTo(hx - 5, hy - 3); c.quadraticCurveTo(hx - 4, hy - 11, hx + 1, hy - 4); c.closePath(); fs(c, P.main); }
  if (A.tongue && pose === 'idle' && Math.sin(t * 1.5) > 0.7) { c.beginPath(); c.moveTo(hx + 7, hy + 1); c.lineTo(hx + 12, hy + 1.5); c.lineWidth = 2.2; c.strokeStyle = P.tongue; c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.6 / s; }
  if (A.coneEye) { circle(c, hx + 1, hy - 1.5, 2.6); fs(c, P.main); }
  eye(c, hx + 1.5, hy - 1.4, A.bigEye ? 2.2 : 1.6, P, st);
  if (sleep) zzz(c, hx + 4, hy - 6, t);
  c.restore();
}

function snakeDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s);
  const sleep = pose === 'sleep', move = pose === 'walk';
  const ph = t * 4;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const pts = [];
  if (sleep) { for (let i = 0; i <= 30; i++) { const a = i * 0.42; const r = 4 + i * 0.32; pts.push([Math.cos(a) * r, -5 + Math.sin(a) * r * 0.45]); } pts.reverse(); }
  else for (let i = 0; i <= 30; i++) { const x = -26 + i * 1.7; pts.push([x, -4 + Math.sin(i * 0.38 - (move ? ph : t * 0.6)) * 3.2 * (i / 30 + 0.3)]); }
  const path = () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); };
  path(); c.lineWidth = 9; c.strokeStyle = OUT; c.stroke();
  path(); c.lineWidth = 6.6; c.strokeStyle = P.main; c.stroke();
  c.setLineDash([3, 4]); path(); c.lineWidth = 4; c.strokeStyle = P.blotch; c.stroke(); c.setLineDash([]);
  const [hx, hy] = pts[pts.length - 1];
  c.lineWidth = 1.6; c.strokeStyle = OUT;
  ell(c, hx + 2, hy, 5, 3.8); fs(c, P.main);
  ell(c, hx + 1, hy - 1.2, 2.5, 1.2); fill(c, P.blotch);
  eye(c, hx + 3, hy - 1, 1.4, P, st);
  if (!sleep && Math.sin(t * 2) > 0.6) { c.beginPath(); c.moveTo(hx + 6.5, hy + 0.5); c.lineTo(hx + 10, hy + 0.5); c.lineTo(hx + 11.5, hy - 0.8); c.moveTo(hx + 10, hy + 0.5); c.lineTo(hx + 11.5, hy + 1.8); c.strokeStyle = '#e8404a'; c.lineWidth = 0.8; c.stroke(); }
  if (sleep) zzz(c, hx + 4, hy - 6, t);
  c.restore();
}

function blobDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s); c.lineWidth = 1.6 / s;
  const walk = pose === 'walk', sleep = pose === 'sleep', play = pose === 'play';
  const hopping = A.hops && (walk || play);
  const lift = hopping ? Math.abs(Math.sin(t * (play ? 7 : 9))) * (play ? 12 : 6) : play ? Math.abs(Math.sin(t * 9)) * 8 : 0;
  const scoot = walk && !A.hops ? Math.abs(Math.sin(t * 16)) * 1.2 : 0;
  const breathe = Math.sin(t * 3) * 0.6;
  const lg = A.long || 1;
  const rx = 15 * lg, ry = 12 + breathe * 0.3;
  const by = -ry + 2 - lift - scoot + (sleep ? 2 : 0);
  // tail
  if (A.tail === 'cotton') { circle(c, -rx + 1, by + 2, 4.5); fs(c, '#ffffff'); }
  if (A.tail === 'bushy') { ell(c, -rx - 4, by - 2, 7, 4, -0.6); fs(c, P.main); }
  if (A.tail === 'long') { c.beginPath(); c.moveTo(-rx + 2, by + 4); c.quadraticCurveTo(-rx - 14, by + 6, -rx - 18, by - 4); c.lineWidth = 6; c.strokeStyle = OUT; c.stroke(); c.lineWidth = 4; c.strokeStyle = P.main; c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.6 / s; }
  // feet
  if (!sleep) { [[rx * 0.5, 0], [-rx * 0.5, 0]].forEach(([x]) => { ell(c, x, -1.5 - lift, 3.4, 2.2); fs(c, shade(P.main, -0.05)); }); }
  // spikes (hedgehog)
  if (P.spikes) {
    c.save(); c.translate(-2, by);
    for (let i = 0; i < 22; i++) { const a = Math.PI * 0.95 + (i / 21) * Math.PI * 1.1; const x0 = Math.cos(a) * rx * 0.9, y0 = Math.sin(a) * ry * 0.95; const x1 = Math.cos(a) * (rx + 7), y1 = Math.sin(a) * (ry + 7);
      c.beginPath(); c.moveTo(x0 - 2, y0); c.lineTo(x1, y1); c.lineTo(x0 + 2, y0); c.closePath(); fs(c, i % 3 ? P.spikes : shade(P.spikes, 0.25)); }
    c.restore();
  }
  // body
  ell(c, 0, by, rx, ry); fs(c, P.main);
  c.save(); ell(c, 0, by, rx, ry); c.clip();
  if (P.belly) { ell(c, rx * 0.35, by + ry * 0.55, rx * 0.7, ry * 0.55); fill(c, P.belly); }
  if (P.patch) { ell(c, -rx * 0.35, by - ry * 0.2, rx * 0.45, ry * 0.7); fill(c, P.patch); }
  if (P.patch2) { ell(c, rx * 0.15, by - ry * 0.75, rx * 0.35, ry * 0.4); fill(c, P.patch2); }
  if (P.stripe) { c.fillStyle = P.stripe; c.fillRect(-rx, by - ry * 0.95, rx * 2, 2.4); }
  if (P.spikes) { ell(c, rx * 0.4, by - 1, rx * 0.65, ry * 0.85); fill(c, P.main); }
  c.restore();
  ell(c, 0, by, rx, ry); c.stroke();
  // ears
  const hx = rx * 0.62, hy = by - ry * 0.25;
  if (A.ears === 'lop') { c.save(); c.translate(hx - 4, hy - ry * 0.55); c.rotate(0.6 + (walk ? Math.sin(t * 9) * 0.2 : 0)); ell(c, 0, 7, 3.6, 9); fs(c, shade(P.main, -0.08)); c.restore(); }
  else if (A.ears === 'big') { circle(c, hx - 4, hy - ry * 0.7, 6); fs(c, P.main); circle(c, hx - 4, hy - ry * 0.7, 3.5); fill(c, '#f2b8b8'); }
  else if (A.ears === 'round') { circle(c, hx - 3, hy - ry * 0.62, 3.5); fs(c, P.main); circle(c, hx - 3, hy - ry * 0.62, 1.8); fill(c, '#f2b0b0'); }
  else if (A.ears === 'petal') { ell(c, hx - 4, hy - ry * 0.58, 3.4, 2.4, -0.5); fs(c, P.patch2 || P.main); }
  if (A.cheeks) { circle(c, hx + 2, hy + 4, 4.5); fs(c, P.belly); }
  // face
  eye(c, hx + 1, hy - 1, A.bigEye ? 3.4 : 2.3, P, sleep ? { closed: true } : st);
  ell(c, hx + rx * 0.33, hy + 2, 1.5, 1.1); fs(c, P.nose);
  if (!sleep) { c.lineWidth = 0.5; c.beginPath(); c.moveTo(hx + rx * 0.34, hy + 3); c.lineTo(hx + rx * 0.62, hy + 2); c.moveTo(hx + rx * 0.34, hy + 3.4); c.lineTo(hx + rx * 0.62, hy + 4.5); c.stroke(); c.lineWidth = 1.6 / s; }
  if (sleep) zzz(c, hx + 2, hy - 10, t);
  c.restore();
}

function fishDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s); c.lineWidth = 1.6 / s;
  const sw = Math.sin(t * (pose === 'walk' || pose === 'swim' ? 12 : 4));
  const lg = A.long || 1;
  const L = 13 * lg, H = A.fancy ? 9 : 7;
  const y0 = -10;
  // tail
  c.save(); c.translate(-L + 1, y0); c.rotate(sw * 0.35);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-8, -9, -11 * (A.fancy ? 1.4 : 1), -8); c.quadraticCurveTo(-6, 0, -11 * (A.fancy ? 1.4 : 1), 8); c.quadraticCurveTo(-8, 9, 0, 0); fs(c, P.fin);
  c.restore();
  // dorsal
  c.beginPath(); c.moveTo(-4, y0 - H + 1); c.quadraticCurveTo(1, y0 - H - 6, 5, y0 - H + 1); fs(c, P.fin);
  ell(c, 0, y0, L, H); fs(c, P.main);
  c.save(); ell(c, 0, y0, L, H); c.clip();
  if (P.patch) { ell(c, -3, y0 - 3, 5, 3.5); fill(c, P.patch); ell(c, 7, y0 - 4, 3, 2.5); fill(c, P.patch); }
  if (P.patch2) { ell(c, -9, y0 - 2, 2.5, 2); fill(c, P.patch2); }
  if (A.bands) for (const x of [5, -2, -9]) { c.fillStyle = '#1d1d1d'; c.fillRect(x - 2.2, y0 - H, 4.4, H * 2); c.fillStyle = '#ffffff'; c.fillRect(x - 1.4, y0 - H, 2.8, H * 2); }
  ell(c, 2, y0 + H * 0.6, L * 0.8, H * 0.4); fill(c, 'rgba(255,255,255,.25)');
  c.restore(); ell(c, 0, y0, L, H); c.stroke();
  ell(c, 1, y0 + 2, 3.5, 2, 0.5 + sw * 0.2); fs(c, P.fin);
  eye(c, L * 0.6, y0 - 1.5, 2.2, P, st);
  c.restore();
}

function axolotlDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s); c.lineWidth = 1.6 / s;
  const sw = Math.sin(t * (pose === 'walk' || pose === 'swim' ? 10 : 3));
  const y0 = -8;
  c.beginPath(); c.moveTo(-8, y0 - 2); c.quadraticCurveTo(-20, y0 - 6 + sw * 2, -27, y0 + sw * 3); c.quadraticCurveTo(-20, y0 + 4 + sw * 2, -8, y0 + 3); c.closePath(); fs(c, P.main);
  [[7, 1], [-5, -1]].forEach(([x, d]) => { c.beginPath(); c.moveTo(x, y0 + 3); c.lineTo(x + 2 + sw * d, y0 + 8); c.lineWidth = 2.4; c.stroke(); c.lineWidth = 1.6 / s; });
  ell(c, 0, y0, 11, 5); fs(c, P.main);
  ell(c, 0, y0 + 2, 9, 2.2); fill(c, P.belly);
  const hx = 12, hy = y0 - 1;
  for (let i = -1; i <= 1; i++) { c.save(); c.translate(hx - 4, hy - 2 + i * 3); c.rotate(-0.9 + i * 0.55 + Math.sin(t * 3 + i) * 0.1); ell(c, -4, 0, 5, 1.6); fs(c, P.gills); c.restore(); }
  ell(c, hx, hy, 7, 5.5); fs(c, P.main);
  eye(c, hx + 2.5, hy - 1.5, 1.4, P, pose === 'sleep' ? { closed: true } : st);
  c.beginPath(); c.arc(hx + 3.5, hy + 1.5, 2.2, 0.1 * Math.PI, 0.7 * Math.PI); c.lineWidth = 0.9; c.stroke();
  c.restore();
}

function bipedDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s); c.lineWidth = 1.6 / s;
  const walk = pose === 'walk', sleep = pose === 'sleep', play = pose === 'play';
  const hop = (walk || play) ? Math.abs(Math.sin(t * (play ? 6 : 7))) * (play ? 14 : 8) : 0;
  const by = -16 - hop;
  // tail
  if (A.tail === 'thick') { c.beginPath(); c.moveTo(-6, by + 6); c.quadraticCurveTo(-18, by + 14, -26, -1); c.lineTo(-22, 0); c.quadraticCurveTo(-14, by + 16, -2, by + 12); c.closePath(); fs(c, P.main); }
  else { c.beginPath(); c.moveTo(-6, by + 8); c.quadraticCurveTo(-12, by + 12, -15, -2); c.lineWidth = 3.5; c.stroke(); c.lineWidth = 1.6 / s; }
  // hind leg (big foot)
  const tuck = hop > 2 ? 0.5 : 0;
  c.save(); c.translate(-1, by + 8); c.rotate(tuck); ell(c, 0, 0, 7, 9); fs(c, shade(P.main, -0.06)); c.restore();
  ell(c, 4 - tuck * 4, -2 - hop * 0.8, 9, 2.6); fs(c, shade(P.main, -0.1));
  // body
  ell(c, 2, by - (sleep ? -4 : 0), 10, sleep ? 11 : 14, sleep ? 0.9 : 0.25); fs(c, P.main);
  c.save(); ell(c, 2, by, 10, 14, 0.25); c.clip(); ell(c, 7, by + 3, 5, 10, 0.25); fill(c, P.belly); c.restore();
  ell(c, 2, by - (sleep ? -4 : 0), 10, sleep ? 11 : 14, sleep ? 0.9 : 0.25); c.stroke();
  // arms
  c.save(); c.translate(9, by - 3); c.rotate(0.6 + Math.sin(t * 2) * 0.1); rrect(c, -1.5, 0, 3, 8, 1.5); fs(c, P.main); c.restore();
  // head
  const hx = sleep ? 12 : 9, hy = sleep ? by + 2 : by - 15;
  if (A.ears === 'tall') { [[-3, -0.2], [0, 0.15]].forEach(([dx, rot], i) => { c.save(); c.translate(hx + dx - 1, hy - 5); c.rotate(rot - (i ? 0 : 0.2)); ell(c, 0, -6, 2.6, 7); fs(c, i ? P.main : shade(P.main, -0.1)); if (i) { ell(c, 0, -6, 1.2, 4.5); fill(c, '#e8b0a0'); } c.restore(); }); }
  else { circle(c, hx - 3, hy - 6, 3.2); fs(c, P.main); circle(c, hx - 3, hy - 6, 1.6); fill(c, '#e8b0a0'); }
  ell(c, hx, hy, 7, 6.5); fs(c, P.main);
  ell(c, hx + 5.5, hy + 1.6, 4.2, 3.2); fs(c, shade(P.main, 0.06));
  circle(c, hx + 8.6, hy + 0.6, 1.4); fill(c, P.nose);
  if (A.smile && !sleep) { c.beginPath(); c.arc(hx + 6.5, hy + 2.6, 1.8, 0.1 * Math.PI, 0.9 * Math.PI); c.lineWidth = 0.8; c.stroke(); c.lineWidth = 1.6 / s; }
  eye(c, hx + 2.2, hy - 1.6, 1.9, P, st);
  if (sleep) zzz(c, hx + 6, hy - 8, t);
  c.restore();
}

function sitterDraw(c, A, P, pose, t, st) {
  const s = A.size || 1; c.save(); c.scale(s, s); c.lineWidth = 1.6 / s;
  const walk = pose === 'walk', sleep = pose === 'sleep';
  const sway = walk ? Math.sin(t * 6) * 2 : Math.sin(t * 1.5) * 0.6;
  const by = -14;
  // legs
  ell(c, -4, -3, 6, 4); fs(c, shade(P.main, -0.08));
  ell(c, 6, -3, 6, 4); fs(c, shade(P.main, -0.05));
  // body
  ell(c, sway * 0.3, by, 13, 14); fs(c, P.main);
  c.save(); ell(c, sway * 0.3, by, 13, 14); c.clip(); ell(c, 4, by + 4, 8, 10); fill(c, P.belly); c.restore(); ell(c, sway * 0.3, by, 13, 14); c.stroke();
  // arms
  const armL = A.longArms ? 15 : 9;
  c.save(); c.translate(7 + sway * 0.3, by - 6); c.rotate(walk ? -0.3 + Math.sin(t * 6) * 0.4 : 0.35); rrect(c, -2.5, 0, 5, armL, 2.5); fs(c, P.main);
  if (A.longArms) { c.beginPath(); c.moveTo(-1.5, armL); c.lineTo(-2, armL + 3); c.moveTo(1, armL); c.lineTo(1, armL + 3.4); c.lineWidth = 1; c.stroke(); }
  c.restore();
  // head
  const hx = 4 + sway, hy = sleep ? by - 9 : by - 16;
  if (A.ears === 'koala') { [-7, 7].forEach(dx => { fluffy(c, hx + dx, hy - 6, 5.5, 5, P.main, 8); circle(c, hx + dx, hy - 6, 3); fill(c, P.belly); }); }
  circle(c, hx, hy, 10); fs(c, A.face || P.main);
  if (A.mask) { ell(c, hx - 2.5, hy - 0.5, 4.2, 2.2, -0.25); fill(c, A.mask); ell(c, hx + 4.5, hy - 0.5, 4.2, 2.2, 0.25); fill(c, A.mask); }
  const closed = sleep;
  eye(c, hx - 3, hy - 1, 1.9, P, closed ? { closed: true } : st);
  eye(c, hx + 4, hy - 1, 1.9, P, closed ? { closed: true } : st);
  if (A.bigNose) { ell(c, hx + 0.6, hy + 3.5, 2.8, 3.8); fs(c, P.nose); }
  else { ell(c, hx + 0.6, hy + 3, 1.8, 1.3); fs(c, P.nose); }
  if (A.smile) { c.beginPath(); c.arc(hx + 0.6, hy + 4, 3, 0.15 * Math.PI, 0.85 * Math.PI); c.lineWidth = 0.9; c.stroke(); }
  if (sleep) zzz(c, hx + 8, hy - 8, t);
  c.restore();
}

const PLANS = { quad, bird: birdDraw, turtle: turtleDraw, lizard: lizardDraw, snake: snakeDraw, blob: blobDraw, fish: fishDraw, axolotl: axolotlDraw, biped: bipedDraw, sitter: sitterDraw };

// Draw a species at the current transform origin. opts: { pose, t, facing (1 right, -1 left), mut, scale, seed, shadow, sick }
export function drawAnimal(c, species, opts = {}) {
  const A = ART[species];
  if (!A) return;
  const t = opts.t || 0;
  const pose = opts.pose || 'idle';
  const P = mutatePalette(A, opts.mut, t);
  const seed = opts.seed || seedOf(species);
  const blinkPhase = (t + (seed % 100) / 25) % 4.2;
  const st = { blink: pose !== 'sleep' && blinkPhase < 0.14, closed: pose === 'sleep', seed };
  c.save();
  c.scale(opts.scale || 1, opts.scale || 1);
  if (opts.shadow !== false && !(A.plan === 'fish' || A.plan === 'axolotl')) {
    const w = A.plan === 'quad' ? A.len * 0.55 : A.plan === 'bird' ? 10 * (A.size || 1) : 16 * (A.size || 1);
    ell(c, 0, 0, w, w * 0.22); c.fillStyle = 'rgba(30,20,0,.22)'; c.fill();
  }
  if ((opts.facing || 1) < 0) c.scale(-1, 1);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 1.6;
  PLANS[A.plan](c, A, P, pose, t, st);
  if (opts.mut === 'cosmic' || opts.mut === 'rainbow' || opts.mut === 'golden' || opts.mut === 'frost') sparkles(c, A, t, opts.mut);
  c.restore();
}

function sparkles(c, A, t, mut) {
  const col = { cosmic: '#e8d0ff', rainbow: '#ffffff', golden: '#fff6a8', frost: '#e6f8ff' }[mut];
  c.save(); c.fillStyle = col;
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.7 + i * 0.25) % 1;
    const x = Math.sin(i * 2.3 + t) * 16, y = -12 - p * 22;
    c.globalAlpha = Math.sin(p * Math.PI);
    const r = 1.4 + Math.sin(p * Math.PI) * 1.2;
    c.beginPath(); c.moveTo(x, y - r * 2); c.lineTo(x + r * 0.5, y); c.lineTo(x, y + r * 2); c.lineTo(x - r * 0.5, y); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x - r * 2, y); c.lineTo(x, y + r * 0.5); c.lineTo(x + r * 2, y); c.lineTo(x, y - r * 0.5); c.closePath(); c.fill();
  }
  c.restore();
}

// Approximate drawn size, used to fit portraits and hit-test in the world.
export function artBounds(species) {
  const A = ART[species];
  if (!A) return { w: 40, h: 40 };
  switch (A.plan) {
    case 'quad': return { w: A.len + A.head * 2.4 + 18, h: A.leg + A.ht + A.head * 1.9 + (A.neck || 0) + (A.ears === 'huge' ? A.head : 0) };
    case 'bird': return { w: 50 * A.size * (A.train ? 1.4 : 1), h: 46 * A.size };
    case 'turtle': return { w: 40 * A.size, h: (18 + 12 * (A.dome || 1)) * A.size };
    case 'lizard': return { w: 56 * A.size, h: 18 * A.size };
    case 'snake': return { w: 46, h: 16 };
    case 'blob': return { w: 40 * A.size * (A.long || 1), h: 34 * A.size };
    case 'fish': return { w: 40 * A.size * (A.long || 1), h: 24 * A.size };
    case 'axolotl': return { w: 46 * A.size, h: 22 * A.size };
    case 'biped': return { w: 40 * A.size, h: 46 * A.size };
    case 'sitter': return { w: 34 * A.size, h: 46 * A.size };
  }
  return { w: 40, h: 40 };
}

// Cached portrait images (data URLs) for the HTML interface.
const cache = new Map();
export function portrait(species, mut = null, size = 160, silhouette = false) {
  const key = species + '|' + (mut || '') + '|' + size + (silhouette ? '|s' : '');
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const bg = c.createRadialGradient(size / 2, size * 0.45, size * 0.1, size / 2, size / 2, size * 0.72);
  bg.addColorStop(0, '#fffaf0'); bg.addColorStop(1, '#e9dfc6');
  c.fillStyle = bg; c.fillRect(0, 0, size, size);
  c.fillStyle = 'rgba(110,170,80,.35)'; c.beginPath(); c.ellipse(size / 2, size * 0.86, size * 0.42, size * 0.1, 0, 0, Math.PI * 2); c.fill();
  const b = artBounds(species);
  const sc = Math.min((size * 0.82) / b.w, (size * 0.74) / b.h);
  const ox = size / 2 + (ART[species].plan === 'quad' ? -size * 0.04 : 0), oy = size * 0.86;
  if (silhouette) {
    const cv2 = document.createElement('canvas'); cv2.width = cv2.height = size;
    const c2 = cv2.getContext('2d'); c2.translate(ox, oy);
    drawAnimal(c2, species, { pose: 'idle', t: 0.6, scale: sc, shadow: false });
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalCompositeOperation = 'source-in'; c2.fillStyle = 'rgba(70,55,35,.55)'; c2.fillRect(0, 0, size, size);
    c.drawImage(cv2, 0, 0);
  } else {
    c.translate(ox, oy);
    drawAnimal(c, species, { pose: 'idle', t: 0.6, mut, scale: sc, shadow: true });
  }
  const url = cv.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
