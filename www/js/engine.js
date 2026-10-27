// Game state, simulation and every player action. The UI only calls functions exported here.
import {
  GROUPS, SPECIES, SPECIES_LIST, RECIPES, MUTATIONS, BASE_MUTATION_CHANCE, TRAITS, TRAIT_IDS,
  BUILDINGS, STAFF, HABITAT_UPGRADES, LAND, FEED_PRICE, MILL, xpForLevel, MAX_LEVEL, NAMES,
  GOALS, ACHIEVEMENTS,
} from './data.js';

const SAVE_KEY = 'nuggsfarm.save.v1';
const OFFLINE_CAP = 8 * 3600;
const SHOW_LENGTH = 600;

export let S = null;
const listeners = new Set();
export const on = fn => listeners.add(fn);
const emit = (type, data) => listeners.forEach(fn => fn(type, data));
export const notify = (msg, kind = 'info') => emit('toast', { msg, kind });

// ---------- helpers ----------
export const now = () => Date.now();
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const weighted = obj => {
  const total = Object.values(obj).reduce((t, m) => t + m.weight, 0);
  let r = Math.random() * total;
  for (const [k, m] of Object.entries(obj)) { r -= m.weight; if (r <= 0) return k; }
  return Object.keys(obj)[0];
};

export const geneAvg = a => (a.genes.vig + a.genes.charm + a.genes.smarts) / 3;
export const stars = a => { const g = geneAvg(a); return g >= 80 ? 5 : g >= 64 ? 4 : g >= 48 ? 3 : g >= 30 ? 2 : 1; };
export const isAdult = a => now() >= a.adultAt;
export const animalsIn = idx => Object.values(S.animals).filter(a => a.home === idx);
export const nursery = () => Object.values(S.animals).filter(a => a.home === -1);
export const habitatCap = p => HABITAT_UPGRADES[p.lvl - 1].cap;
export const ownedPlots = () => S.plotsOwned;
export const has = (kind, type) => S.plots.some(p => p && !p.building && (p.kind === kind) && (p.type === type || p.group === type));
export const countBuilding = type => S.plots.filter(p => p && p.kind === 'building' && p.type === type).length;
export const eventActive = id => S.event && S.event.id === id && now() < S.event.ends;

// ---------- new game / persistence ----------
function freshState() {
  const t = now();
  return {
    v: 1, created: t, last: t,
    coins: 1000, gems: 15, feed: 40, xp: 0, level: 1, rep: 50,
    plotsOwned: LAND.startPlots,
    plots: Array(LAND.maxPlots).fill(null),
    animals: {}, nextId: 1,
    orders: [], nextOrderAt: t + 20000,
    show: null, showHistory: [],
    discovered: {}, mutSeen: {}, recipesFound: {},
    staff: {}, items: { charm: 0, tonic: 0 },
    goal: 0, achievements: {},
    stats: { feeds: 0, litters: 0, babies: 0, sold: 0, orders: 0, mutations: 0, recipes: 0, ribbons: 0, firsts: 0, earned: 0, removed: 0, best4: false, best5: false, rainbow: false },
    daily: { last: '', streak: 0 },
    event: null, nextEventAt: t + 6 * 60000,
    settings: { sound: true, music: false },
    seenIntro: false,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { S = migrate(JSON.parse(raw)); return true; }
  } catch (e) { console.warn('Save could not be read', e); }
  S = freshState();
  return false;
}

function migrate(s) {
  const base = freshState();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.stats = { ...base.stats, ...s.stats };
  s.items = { ...base.items, ...s.items };
  s.settings = { ...base.settings, ...s.settings };
  while (s.plots.length < LAND.maxPlots) s.plots.push(null);
  return s;
}

export function save() {
  if (!S) return;
  S.last = now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { console.warn('Save failed', e); }
}

export function exportSave() { save(); return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
export function importSave(code) {
  const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!parsed || !parsed.plots || !parsed.animals) throw new Error('That does not look like a Nuggs Farm save code.');
  S = migrate(parsed); save(); emit('change');
}
export function resetGame() { localStorage.removeItem(SAVE_KEY); S = freshState(); save(); emit('change'); }

// ---------- currency ----------
function spend(coins = 0, gems = 0) {
  if (S.coins < coins) { notify(`You need ${fmt(coins - S.coins)} more coins.`, 'bad'); return false; }
  if (S.gems < gems) { notify(`You need ${gems - S.gems} more gems.`, 'bad'); return false; }
  S.coins -= coins; S.gems -= gems; return true;
}
function earn({ coins = 0, gems = 0, xp = 0, feed = 0 } = {}) {
  S.coins += coins; S.gems += gems; S.feed += feed;
  if (coins > 0) S.stats.earned += coins;
  if (xp) addXp(xp);
  emit('reward', { coins, gems, xp, feed });
}
function addXp(xp) {
  S.xp += xp;
  while (S.level < MAX_LEVEL && S.xp >= xpForLevel(S.level)) {
    S.xp -= xpForLevel(S.level);
    S.level++;
    const coins = S.level * 60;
    S.coins += coins; S.gems += 3;
    emit('levelup', { level: S.level, coins, gems: 3 });
  }
}
export const fmt = n => Math.round(n).toLocaleString('en-AU');
export const gemCost = secondsLeft => Math.max(1, Math.ceil(secondsLeft / 150));

// ---------- animals ----------
function makeAnimal(species, opts = {}) {
  const t = now();
  const sp = SPECIES[species];
  const id = 'a' + (S.nextId++);
  const g = opts.genes || { vig: randInt(18, 55), charm: randInt(18, 55), smarts: randInt(18, 55) };
  const a = {
    id, species, name: pick(NAMES), sex: opts.sex || (Math.random() < 0.5 ? 'm' : 'f'),
    born: t, adultAt: opts.baby ? t + sp.grow * 1000 : t,
    genes: g, mut: opts.mut || null, trait: opts.trait !== undefined ? opts.trait : (Math.random() < 0.25 ? pick(TRAIT_IDS) : null),
    hunger: opts.baby ? 70 : 85, happy: 75, health: 100, sick: false,
    home: opts.home ?? -1, breeding: null, restUntil: 0, petAt: 0, ribbons: 0, gen: opts.gen || 1,
  };
  S.animals[id] = a;
  discover(a);
  return a;
}

function discover(a) {
  if (!S.discovered[a.species]) { S.discovered[a.species] = now(); emit('discover', a); }
  if (a.mut) { S.mutSeen[a.species] = S.mutSeen[a.species] || {}; S.mutSeen[a.species][a.mut] = true; }
  const st = stars(a);
  if (st >= 4) S.stats.best4 = true;
  if (st >= 5) S.stats.best5 = true;
}

export function animalValue(a) {
  const sp = SPECIES[a.species];
  const st = stars(a);
  let v = sp.value * [0, 0.55, 0.8, 1, 1.5, 2.5][st];
  v *= 0.85 + geneAvg(a) / 400;
  if (a.mut) v *= MUTATIONS[a.mut].mult;
  if (!isAdult(a)) v *= 0.5;
  if (a.sick) v *= 0.5;
  v *= 0.6 + (a.health / 100) * 0.4;
  if (a.trait) v *= TRAITS[a.trait].good ? 1.12 : 0.85;
  v *= 1 + 0.1 * Math.min(a.ribbons, 10);
  if (eventActive('festival')) v *= 1.4;
  return Math.max(5, Math.round(v));
}

export function buyAnimal(species, sex, plotIdx) {
  const sp = SPECIES[species];
  const p = S.plots[plotIdx];
  if (!sp.price || S.level < sp.level) return false;
  if (!p || p.kind !== 'habitat' || p.group !== sp.group || p.building) { notify(`Build a ${GROUPS[sp.group].name} first.`, 'bad'); return false; }
  if (animalsIn(plotIdx).length >= habitatCap(p)) { notify('That habitat is full. Upgrade it or build another.', 'bad'); return false; }
  if (!spend(sp.price)) return false;
  const a = makeAnimal(species, { sex, home: plotIdx });
  addXp(Math.round(4 + sp.tier * 3));
  emit('sfx', 'buy'); emit('change');
  return a;
}

export function sellAnimal(id) {
  const a = S.animals[id];
  if (!a || a.breeding) { notify('You cannot sell an animal while it is breeding.', 'bad'); return; }
  if (S.show && S.show.entry === id) S.show.entry = null;
  const v = animalValue(a);
  delete S.animals[id];
  S.stats.sold++;
  earn({ coins: v, xp: 3 + SPECIES[a.species].tier * 2 });
  emit('sfx', 'coins'); emit('change');
  notify(`Sold ${a.name} for ${fmt(v)} coins.`, 'good');
}

export function renameAnimal(id, name) {
  const a = S.animals[id];
  if (a && name.trim()) { a.name = name.trim().slice(0, 18); emit('change'); }
}

export function feedAnimal(id, silent) {
  const a = S.animals[id];
  if (!a) return false;
  const cost = SPECIES[a.species].feed;
  if (a.hunger > 92) { if (!silent) notify(`${a.name} is already full.`); return false; }
  if (S.feed < cost) { if (!silent) notify('Out of feed. Collect from a Feed Mill or buy some in the shop.', 'bad'); return false; }
  S.feed -= cost; a.hunger = 100; a.happy = clamp(a.happy + 4, 0, 100);
  S.stats.feeds++;
  if (!silent) { emit('sfx', 'feed'); emit('change'); }
  return true;
}

export function feedHabitat(idx) {
  let fed = 0, short = false;
  for (const a of animalsIn(idx)) {
    if (a.hunger > 92) continue;
    if (S.feed < SPECIES[a.species].feed) { short = true; break; }
    if (feedAnimal(a.id, true)) fed++;
  }
  if (fed) { emit('sfx', 'feed'); notify(`Fed ${fed} animal${fed > 1 ? 's' : ''}.`, 'good'); }
  else if (!short) notify('Everyone here is already full.');
  if (short) notify('Ran out of feed before everyone was fed.', 'bad');
  emit('change');
}

export function feedAll() {
  let fed = 0;
  for (const a of Object.values(S.animals).sort((x, y) => x.hunger - y.hunger)) {
    if (a.hunger > 92) continue;
    if (S.feed < SPECIES[a.species].feed) break;
    if (feedAnimal(a.id, true)) fed++;
  }
  if (fed) emit('sfx', 'feed');
  notify(fed ? `Fed ${fed} animals.` : (S.feed < 1 ? 'Out of feed.' : 'Everyone is already full.'), fed ? 'good' : 'info');
  emit('change');
}

export function petAnimal(id) {
  const a = S.animals[id];
  if (!a) return;
  const wait = a.petAt + 90000 - now();
  if (wait > 0) { notify(`${a.name} needs a break. Try again in ${Math.ceil(wait / 1000)}s.`); return; }
  a.petAt = now(); a.happy = clamp(a.happy + 18, 0, 100);
  addXp(1);
  emit('sfx', 'pet'); emit('change');
}

export function treatCost(a) {
  return Math.round((30 + SPECIES[a.species].tier * 45) * (has('building', 'vet') ? 0.5 : 1));
}
export function treatAnimal(id, silent) {
  const a = S.animals[id];
  if (!a || !a.sick) return false;
  const c = treatCost(a);
  if (S.coins < c) { if (!silent) notify(`Treatment costs ${c} coins.`, 'bad'); return false; }
  S.coins -= c; a.sick = false; a.health = clamp(a.health + 35, 0, 100);
  if (!silent) { emit('sfx', 'heal'); notify(`${a.name} is feeling better.`, 'good'); emit('change'); }
  return true;
}

export function moveAnimal(id, idx) {
  const a = S.animals[id], p = S.plots[idx];
  if (!a || !p || p.kind !== 'habitat' || p.building) return;
  if (p.group !== SPECIES[a.species].group) { notify(`${SPECIES[a.species].name}s need a ${GROUPS[SPECIES[a.species].group].name}.`, 'bad'); return; }
  if (a.breeding) { notify('Wait until breeding has finished.', 'bad'); return; }
  if (animalsIn(idx).length >= habitatCap(p)) { notify('That habitat is full.', 'bad'); return; }
  a.home = idx; emit('change');
}

// ---------- breeding ----------
export function findRecipe(a, b) {
  return RECIPES.find(r => (r.a === a.species && r.b === b.species) || (r.b === a.species && r.a === b.species));
}

export function canBreed(a, b) {
  if (!a || !b) return 'Choose two animals.';
  if (a.sex === b.sex) return 'You need one male and one female.';
  if (a.home !== b.home || a.home < 0) return 'Both animals must live in the same habitat.';
  if (a.species !== b.species && !findRecipe(a, b)) return 'These species cannot breed together.';
  for (const x of [a, b]) {
    if (!isAdult(x)) return `${x.name} is still a baby.`;
    if (x.breeding) return `${x.name} is already breeding.`;
    if (x.restUntil > now()) return `${x.name} is resting for another ${dur((x.restUntil - now()) / 1000)}.`;
    if (x.sick) return `${x.name} is sick. Treat them first.`;
    if (x.hunger < 25) return `${x.name} is too hungry to breed.`;
    if (x.health < 40) return `${x.name} is not healthy enough.`;
  }
  return null;
}

export function breedChance(a, b) {
  let c = 0.55 + ((a.happy + b.happy) / 2 - 50) / 160 + ((a.genes.vig + b.genes.vig) / 2) / 600;
  c += 0.06 * Math.min(countBuilding('gazebo'), 2);
  if (eventActive('bumper')) c += 0.2;
  return clamp(c, 0.2, 0.97);
}

export function breedTime(a, b) {
  const tiers = [SPECIES[a.species], SPECIES[b.species]];
  const r = findRecipe(a, b);
  let t = Math.max(...tiers.map(s => s.breed));
  if (r) t = Math.max(t, SPECIES[r.result].breed * 0.6);
  for (const x of [a, b]) { if (x.trait === 'fertile') t *= 0.75; if (x.trait === 'lazy') t *= 1.25; }
  return Math.round(t);
}

export function startBreeding(aId, bId, useTonic) {
  const a = S.animals[aId], b = S.animals[bId];
  const err = canBreed(a, b);
  if (err) { notify(err, 'bad'); return false; }
  const mum = a.sex === 'f' ? a : b, dad = a.sex === 'f' ? b : a;
  let t = breedTime(a, b);
  if (useTonic) { if (S.items.tonic < 1) return false; S.items.tonic--; t = Math.round(t / 2); }
  const charm = S.items.charm > 0;
  if (charm) S.items.charm--;
  mum.breeding = { partner: dad.id, starts: now(), ends: now() + t * 1000, charm };
  dad.breeding = { partner: mum.id, starts: now(), ends: now() + t * 1000, mate: true };
  emit('sfx', 'love'); emit('change');
  return true;
}

export function rushBreeding(id) {
  const a = S.animals[id];
  if (!a || !a.breeding) return;
  const cost = gemCost((a.breeding.ends - now()) / 1000);
  if (!spend(0, cost)) return;
  const p = S.animals[a.breeding.partner];
  a.breeding.ends = now(); if (p && p.breeding) p.breeding.ends = now();
  tick(0); emit('change');
}

function inheritGene(x, y) {
  let g = (x + y) / 2 + gauss() * 11 + 1.5;
  if (Math.random() < 0.05) g += 14;
  return clamp(Math.round(g), 1, 100);
}

function finishBreeding(mum) {
  const dad = S.animals[mum.breeding.partner];
  const charm = mum.breeding.charm;
  mum.breeding = null;
  if (!dad) return;
  dad.breeding = null;
  const rest = breedTime(mum, dad) * 500;
  mum.restUntil = dad.restUntil = now() + rest;
  mum.happy = clamp(mum.happy - 8, 0, 100); dad.happy = clamp(dad.happy - 5, 0, 100);

  if (Math.random() > breedChance(mum, dad)) {
    emit('breedfail', { mum, dad });
    notify(`${mum.name} and ${dad.name} did not have a litter this time. Happier animals breed more reliably.`, 'bad');
    return;
  }
  const recipe = mum.species !== dad.species ? findRecipe(mum, dad) : null;
  let species = mum.species, litter, discoveredRecipe = false;
  if (recipe) {
    if (S.level >= SPECIES[recipe.result].level && Math.random() < recipe.chance * (eventActive('bumper') ? 1.5 : 1)) {
      species = recipe.result; discoveredRecipe = true; litter = 1;
    } else { species = Math.random() < 0.5 ? mum.species : dad.species; litter = 1; }
  } else {
    const sp = SPECIES[species];
    litter = randInt(sp.litter[0], sp.litter[1]);
    if (mum.trait === 'prolific' || dad.trait === 'prolific') litter++;
    if (eventActive('bumper')) litter++;
  }

  let mutChance = BASE_MUTATION_CHANCE;
  if (mum.trait === 'lucky' || dad.trait === 'lucky') mutChance *= 2;
  if (has('building', 'lab')) mutChance *= 1.5;
  if (charm) mutChance *= 5;

  const babies = [];
  for (let i = 0; i < litter; i++) {
    let mut = null;
    const parentMut = [mum.mut, dad.mut].filter(Boolean);
    if (parentMut.length && Math.random() < 0.3 * parentMut.length) mut = pick(parentMut);
    else if (Math.random() < mutChance) mut = weighted(MUTATIONS);
    const traitRoll = Math.random();
    const trait = traitRoll < 0.38 ? mum.trait : traitRoll < 0.76 ? dad.trait : (Math.random() < 0.5 ? pick(TRAIT_IDS) : null);
    const genes = {
      vig: inheritGene(mum.genes.vig, dad.genes.vig),
      charm: inheritGene(mum.genes.charm, dad.genes.charm),
      smarts: inheritGene(mum.genes.smarts, dad.genes.smarts),
    };
    const free = habitatCap(S.plots[mum.home]) - animalsIn(mum.home).length;
    const home = free > 0 ? mum.home : -1;
    if (home === -1 && nursery().length >= nurseryCap()) {
      const tmp = { species, genes, mut, trait, health: 100, ribbons: 0, adultAt: now() + 1e9, sick: false };
      const v = Math.round(animalValue(tmp) * 0.6);
      earn({ coins: v });
      notify(`No room for a baby ${SPECIES[species].name}. A neighbour adopted it for ${v} coins.`, 'bad');
      continue;
    }
    const baby = makeAnimal(species, { baby: true, genes, mut, trait, home, gen: Math.max(mum.gen, dad.gen) + 1 });
    babies.push(baby);
    if (mut) { S.stats.mutations++; if (mut === 'rainbow') S.stats.rainbow = true; }
  }
  S.stats.litters++;
  S.stats.babies += babies.length;
  if (discoveredRecipe && !S.recipesFound[recipe.result]) { S.recipesFound[recipe.result] = true; S.stats.recipes++; }
  const sp = SPECIES[species];
  addXp(Math.round((6 + sp.tier * 8) * Math.max(1, babies.length * 0.6)));
  emit('litter', { mum, dad, babies, recipe: discoveredRecipe ? recipe : null });
}

export const nurseryCap = () => 6;

export function rushGrowth(id) {
  const a = S.animals[id];
  if (!a || isAdult(a)) return;
  if (!spend(0, gemCost((a.adultAt - now()) / 1000))) return;
  a.adultAt = now(); emit('change');
}

// ---------- plots & buildings ----------
export function buildHabitat(idx, group) {
  const g = GROUPS[group];
  if (idx >= S.plotsOwned || S.plots[idx]) return false;
  if (S.level < g.unlock) { notify(`Unlocks at level ${g.unlock}.`, 'bad'); return false; }
  if (!spend(g.cost)) return false;
  S.plots[idx] = { kind: 'habitat', group, lvl: 1, clean: 100, building: now() + g.build * 1000 };
  addXp(10); emit('sfx', 'build'); emit('change');
  return true;
}

export function buildBuilding(idx, type) {
  const b = BUILDINGS[type];
  if (idx >= S.plotsOwned || S.plots[idx]) return false;
  if (S.level < b.unlock) { notify(`Unlocks at level ${b.unlock}.`, 'bad'); return false; }
  if (countBuilding(type) >= b.max) { notify(`You can only have ${b.max} of these.`, 'bad'); return false; }
  if (!spend(b.cost)) return false;
  S.plots[idx] = { kind: 'building', type, lvl: 1, building: now() + b.build * 1000, stock: 0 };
  addXp(15); emit('sfx', 'build'); emit('change');
  return true;
}

export function rushBuild(idx) {
  const p = S.plots[idx];
  if (!p || !p.building) return;
  if (!spend(0, gemCost((p.building - now()) / 1000))) return;
  p.building = now(); tick(0); emit('change');
}

export function upgradeCost(p) {
  const next = HABITAT_UPGRADES[p.lvl];
  return next ? Math.round(GROUPS[p.group].cost * next.cost) : null;
}
export function upgradeHabitat(idx) {
  const p = S.plots[idx];
  const c = upgradeCost(p);
  if (c == null || p.building) return;
  if (!spend(c)) return;
  p.lvl++; addXp(10 + p.lvl * 5); emit('sfx', 'build'); emit('change');
  notify(`${GROUPS[p.group].name} upgraded. It now holds ${habitatCap(p)} animals.`, 'good');
}

export function millUpgradeCost(p) { return p.lvl < 3 ? [0, 1800, 5000][p.lvl] : null; }
export function upgradeMill(idx) {
  const p = S.plots[idx]; const c = millUpgradeCost(p);
  if (c == null || !spend(c)) return;
  p.lvl++; emit('sfx', 'build'); emit('change');
}

export function cleanHabitat(idx) {
  const p = S.plots[idx];
  if (!p || p.kind !== 'habitat') return;
  if (p.clean > 95) { notify('It is already spotless.'); return; }
  p.clean = 100;
  for (const a of animalsIn(idx)) a.happy = clamp(a.happy + 5, 0, 100);
  addXp(2); emit('sfx', 'clean'); emit('change');
}

export function collectMill(idx) {
  const p = S.plots[idx];
  const n = Math.floor(p.stock);
  if (n < 1) { notify('Nothing to collect yet.'); return; }
  p.stock -= n; S.feed += n;
  emit('sfx', 'collect'); emit('reward', { feed: n }); emit('change');
}

export function demolish(idx) {
  const p = S.plots[idx];
  if (!p) return;
  if (p.kind === 'habitat' && animalsIn(idx).length) { notify('Move or sell the animals first.', 'bad'); return; }
  S.plots[idx] = null; emit('change');
}

export function landCost() {
  const row = S.plotsOwned / LAND.perRow;
  return LAND.rowCost[row] ?? null;
}
export function buyLand() {
  const c = landCost();
  if (c == null || S.plotsOwned >= LAND.maxPlots) return;
  if (!spend(c)) return;
  S.plotsOwned += LAND.perRow; addXp(20); emit('sfx', 'build'); emit('change');
  notify('New land cleared. Three more plots are ready.', 'good');
}

export function buyFeed(n) {
  if (!spend(n * FEED_PRICE)) return;
  S.feed += n; emit('sfx', 'coins'); emit('change');
}

export const ITEMS = {
  charm: { name: 'Lucky Charm', gems: 8, desc: 'The next pairing you start has five times the mutation chance.' },
  tonic: { name: 'Fertility Tonic', gems: 4, desc: 'Halves the breeding time of one pairing.' },
};
export function buyItem(id) {
  if (!spend(0, ITEMS[id].gems)) return;
  S.items[id]++; emit('sfx', 'buy'); emit('change');
}
export function buyCoinsWithGems() {
  if (!spend(0, 10)) return;
  earn({ coins: 1000 + S.level * 150 }); emit('change');
}

export function hireStaff(id) {
  const st = STAFF[id];
  if (S.level < st.unlock) return;
  if (S.staff[id]) { S.staff[id] = false; notify(`${st.name} has been let go.`); emit('change'); return; }
  if (!spend(st.fee)) return;
  S.staff[id] = true; emit('sfx', 'buy'); emit('change');
  notify(`${st.name} hired. Their wage is ${st.wage} coins a minute.`, 'good');
}

// ---------- orders ----------
function maxOrders() { return Math.min(5, 3 + Math.floor(S.level / 8)); }

function newOrder(special) {
  const pool = SPECIES_LIST.filter(sp => sp.level <= S.level && (sp.price || S.discovered[sp.id]) && GROUPS[sp.group].unlock <= S.level);
  if (!pool.length) return null;
  const weights = pool.map(sp => (S.discovered[sp.id] ? 3 : 1) * (Object.values(S.animals).some(a => a.species === sp.id) ? 2 : 1));
  let r = Math.random() * weights.reduce((t, w) => t + w, 0), sp = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { sp = pool[i]; break; } }
  const maxStar = Math.min(5, 2 + Math.floor(S.level / 5));
  const req = { species: sp.id, stars: randInt(1, maxStar) };
  if (Math.random() < 0.3) req.sex = Math.random() < 0.5 ? 'm' : 'f';
  if (S.level >= 5 && Math.random() < 0.12) req.trait = pick(TRAIT_IDS.filter(t => TRAITS[t].good));
  if (special || (S.level >= 8 && Math.random() < 0.07)) req.mut = special ? pick(Object.keys(MUTATIONS).slice(0, 4)) : 'any';
  let coins = sp.value * (1.3 + 0.32 * req.stars) * (0.85 + S.rep / 330);
  if (req.sex) coins *= 1.1;
  if (req.trait) coins *= 1.35;
  if (req.mut) coins *= req.mut === 'any' ? 3 : 3.5;
  if (special) coins *= 1.6;
  const names = ['Mrs Nguyen', 'Dr Patel', 'Uncle Bruce', 'The Kowalskis', 'Aunty Mere', 'Coach Riley', 'Ms Okafor', 'Grandpa Joe', 'Sienna', 'Marco', 'The Hendersons', 'Priya', 'Tane', 'Big Kev', 'Lachlan', 'Zoe', 'Mr Takahashi', 'Harbourside Pet Café', 'Sunny Days School', 'Coffs Coast Rescue'];
  const minutes = special ? 6 : randInt(12, 30);
  return {
    id: 'o' + (S.nextId++), who: special ? 'A famous collector' : pick(names), req,
    coins: Math.round(coins), xp: Math.round(8 + sp.tier * 7 + req.stars * 5 + (req.mut ? 40 : 0)),
    gems: req.mut ? randInt(2, 4) : (req.stars >= 4 ? 1 : 0),
    ends: now() + minutes * 60000, special: !!special,
  };
}

export function meetsOrder(a, o) {
  const r = o.req;
  if (a.species !== r.species || !isAdult(a) || a.breeding || a.sick) return false;
  if (stars(a) < r.stars) return false;
  if (r.sex && a.sex !== r.sex) return false;
  if (r.trait && a.trait !== r.trait) return false;
  if (r.mut && (r.mut === 'any' ? !a.mut : a.mut !== r.mut)) return false;
  return true;
}

export function fillOrder(orderId, animalId) {
  const o = S.orders.find(x => x.id === orderId), a = S.animals[animalId];
  if (!o || !a || !meetsOrder(a, o)) return;
  if (S.show && S.show.entry === animalId) S.show.entry = null;
  delete S.animals[animalId];
  S.orders = S.orders.filter(x => x !== o);
  S.stats.orders++;
  S.rep = clamp(S.rep + (o.special ? 5 : 2), 0, 100);
  earn({ coins: o.coins, gems: o.gems, xp: o.xp });
  emit('sfx', 'fanfare'); emit('change');
  notify(`${o.who} is thrilled with ${a.name}.`, 'good');
}

export function dismissOrder(orderId) {
  S.orders = S.orders.filter(o => o.id !== orderId);
  S.rep = clamp(S.rep - 1, 0, 100);
  S.nextOrderAt = Math.min(S.nextOrderAt, now() + 60000);
  emit('change');
}

// ---------- shows ----------
export function showScore(a) {
  const gene = (a.genes.vig + a.genes.charm * 1.6 + a.genes.smarts) / 3.6;
  let sc = gene * 0.75 + a.happy * 0.12 + a.health * 0.05;
  if (a.mut) sc += 8 + MUTATIONS[a.mut].mult * 2;
  if (a.trait === 'charmer') sc += 15;
  sc += Math.min(a.ribbons, 10);
  return sc;
}

function newShow() {
  const groups = Object.keys(GROUPS).filter(g => S.plots.some(p => p && p.kind === 'habitat' && p.group === g));
  const group = pick(groups.length ? groups : ['kennel']);
  const skill = 34 + S.level * 1.5;
  const rivals = ['Maple Grove Kennels', 'Bellingen Breeders', 'Coastal Critters', 'Sunset Ridge', 'Kempsey Champions', 'Hilltop Hollow', 'Bluegum Farm', 'Nambucca Pets', 'Riverbend Ranch', 'Dorrigo Dale'];
  const npc = rivals.sort(() => Math.random() - 0.5).slice(0, 5).map(n => ({ name: n, score: Math.round(skill + rand(-8, 22)) }));
  S.show = { group, ends: now() + SHOW_LENGTH * 1000, entry: null, npc, fee: 40 + S.level * 10 };
}

export function enterShow(id) {
  const a = S.animals[id];
  if (!S.show || !a) return;
  if (SPECIES[a.species].group !== S.show.group) { notify(`This show is for ${GROUPS[S.show.group].plural.toLowerCase()} only.`, 'bad'); return; }
  if (!isAdult(a) || a.sick) { notify('Only healthy adults can enter.', 'bad'); return; }
  if (S.show.entry) { notify('You already have an entrant in this show.', 'bad'); return; }
  if (!spend(S.show.fee)) return;
  S.show.entry = id; emit('sfx', 'buy'); emit('change');
  notify(`${a.name} is entered. Results when the show ends.`, 'good');
}

function judgeShow() {
  const sh = S.show;
  const a = sh.entry && S.animals[sh.entry];
  S.show = null;
  if (!a) { newShow(); return; }
  const mine = Math.round(showScore(a) + rand(0, 12));
  const board = [...sh.npc, { name: 'Nuggs Farm', score: mine, you: true }].sort((x, y) => y.score - x.score);
  const place = board.findIndex(b => b.you) + 1;
  const tierBoost = 1 + SPECIES[a.species].tier * 0.35;
  const prizes = { 1: { coins: 500, gems: 5, xp: 80 }, 2: { coins: 250, gems: 2, xp: 50 }, 3: { coins: 120, gems: 1, xp: 30 } };
  const prize = prizes[place];
  if (prize) {
    a.ribbons++; S.stats.ribbons++; if (place === 1) S.stats.firsts++;
    S.rep = clamp(S.rep + (4 - place), 0, 100);
    earn({ coins: Math.round(prize.coins * tierBoost * (1 + S.level / 20)), gems: prize.gems, xp: prize.xp });
  } else addXp(10);
  const result = { group: sh.group, animal: a.name, species: a.species, place, board, at: now() };
  S.showHistory.unshift(result); S.showHistory = S.showHistory.slice(0, 8);
  emit('showresult', result);
  newShow();
}

// ---------- events ----------
export const EVENTS = {
  heatwave: { name: 'Heatwave', desc: 'Animals get hungry twice as fast. Keep the feed coming.', mins: 4 },
  festival: { name: 'Pet Festival', desc: 'The town is pet mad. Market prices are up 40%.', mins: 4 },
  bumper:   { name: 'Love Is in the Air', desc: 'Breeding success is up, litters are bigger and secret pairings are more likely.', mins: 5 },
  storm:    { name: 'Summer Storm', desc: 'Mud everywhere. Habitats get dirty twice as fast.', mins: 4 },
  fox:      { name: 'Fox on the Prowl', desc: 'A fox is sniffing around the aviaries and hutches. Chase it off before it causes trouble.', mins: 1.5, action: 'Chase it off' },
  outbreak: { name: 'Sniffles Outbreak', desc: 'A bug is going around. Some animals have fallen ill.', mins: 3 },
  collector:{ name: 'Famous Collector', desc: 'A wealthy collector has posted a lucrative order for a colour mutation.', mins: 6 },
};

function startEvent() {
  const pool = ['heatwave', 'festival', 'bumper', 'storm', 'collector'];
  if (Object.values(S.animals).some(a => ['aviary', 'hutch'].includes(SPECIES[a.species].group))) pool.push('fox', 'fox');
  if (Object.keys(S.animals).length > 6) pool.push('outbreak');
  const id = pick(pool);
  S.event = { id, ends: now() + EVENTS[id].mins * 60000 };
  if (id === 'outbreak') {
    const victims = Object.values(S.animals).filter(a => a.trait !== 'hardy').sort(() => Math.random() - 0.5).slice(0, 2);
    victims.forEach(a => { a.sick = true; });
  }
  if (id === 'collector' && S.level >= 6) {
    const o = newOrder(true);
    if (o) S.orders.unshift(o);
  }
  emit('event', S.event); emit('sfx', 'alert');
}

export function eventAction() {
  if (!S.event || S.event.id !== 'fox') return;
  S.event = null; addXp(15); earn({ coins: 50 });
  notify('You chased the fox away. Everyone is safe.', 'good');
  emit('sfx', 'whoosh'); emit('change');
}

function endEvent() {
  const ev = S.event;
  S.event = null;
  if (ev.id === 'fox') {
    const prey = Object.values(S.animals).filter(a => ['aviary', 'hutch'].includes(SPECIES[a.species].group));
    if (prey.length) {
      const a = pick(prey);
      a.health = clamp(a.health - 45, 1, 100); a.happy = clamp(a.happy - 40, 0, 100);
      notify(`The fox got into the enclosures and frightened ${a.name}. Their health has dropped.`, 'bad');
    }
  }
  S.nextEventAt = now() + rand(6, 12) * 60000;
  emit('change');
}

// ---------- daily reward ----------
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
export function dailyAvailable() { return S.daily.last !== todayStr(); }
export function dailyReward(streak) { return { coins: 150 * streak, gems: streak === 7 ? 10 : streak >= 4 ? 2 : 1, feed: 20 + streak * 5 }; }
export function nextStreak() {
  const y = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  return S.daily.last === y ? (S.daily.streak % 7) + 1 : 1;
}
export function claimDaily() {
  if (!dailyAvailable()) return;
  const streak = nextStreak();
  S.daily = { last: todayStr(), streak };
  earn(dailyReward(streak)); emit('sfx', 'fanfare'); emit('change');
}

// ---------- goals & achievements ----------
export function currentGoal() { return GOALS[S.goal] || null; }
export function claimGoal() {
  const g = currentGoal();
  if (!g) return;
  const [have, need] = g.check(S);
  if (have < need) return;
  S.goal++; earn(g.reward); emit('sfx', 'fanfare'); emit('change');
}
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!S.achievements[a.id] && a.check(S)) {
      S.achievements[a.id] = now(); S.gems += a.gems;
      emit('achievement', a);
    }
  }
}

// ---------- simulation ----------
export const dur = s => {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
  return Math.floor(s / 3600) + 'h ' + String(Math.floor(s / 60) % 60).padStart(2, '0') + 'm';
};

function happinessDrain(a) {
  let d = 100 / (35 * 60);
  if (a.trait === 'cheerful') d *= 0.6;
  if (a.trait === 'grumpy') d *= 1.5;
  d *= 1 - 0.1 * Math.min(countBuilding('fountain') + countBuilding('gazebo'), 4);
  if (a.hunger < 30) d *= 2;
  const p = S.plots[a.home];
  if (p && p.kind === 'habitat') {
    if (p.clean < 30) d *= 2;
    if (animalsIn(a.home).length >= habitatCap(p)) d *= 1.2;
  }
  if (eventActive('heatwave')) d *= 1.3;
  return d;
}

function step(dt, offline) {
  const t = now();
  const soft = offline ? 0.5 : 1;
  for (const a of Object.values(S.animals)) {
    let h = 100 / (22 * 60);
    if (a.trait === 'hearty') h *= 0.7;
    if (a.trait === 'greedy') h *= 1.4;
    if (eventActive('heatwave')) h *= 2;
    a.hunger = clamp(a.hunger - h * dt * soft, 0, 100);
    a.happy = clamp(a.happy - happinessDrain(a) * dt * soft, 0, 100);
    const p = S.plots[a.home];
    const dirty = p && p.kind === 'habitat' && p.clean < 15;
    if (a.hunger < 8 || dirty || a.happy < 8) a.health -= (100 / (18 * 60)) * dt * soft;
    else if (!a.sick && a.hunger > 40) a.health += (100 / (25 * 60)) * dt;
    if (a.sick) a.health -= (100 / (30 * 60)) * dt * soft;
    a.health = clamp(a.health, 0, 100);
    if (!a.sick) {
      let chance = a.health < 50 ? 0.0015 : 0.00003;
      if (a.trait === 'sickly') chance *= 3;
      if (a.trait === 'hardy') chance *= 0.15;
      if (Math.random() < chance * dt) { a.sick = true; if (!offline) notify(`${a.name} is looking unwell. Treat them before it gets worse.`, 'bad'); }
    } else if (has('building', 'vet') && Math.random() < 0.0008 * dt) a.sick = false;
    if (a.health <= 0) {
      delete S.animals[a.id];
      S.rep = clamp(S.rep - 10, 0, 100); S.stats.removed++;
      emit('removed', a);
      continue;
    }
    if (a.breeding && !S.animals[a.breeding.partner]) a.breeding = null;
    if (a.breeding && !a.breeding.mate && t >= a.breeding.ends) finishBreeding(a);
  }
  for (let i = 0; i < S.plots.length; i++) {
    const p = S.plots[i];
    if (!p) continue;
    if (p.building && t >= p.building) {
      p.building = null;
      emit('built', { idx: i, p });
    }
    if (p.building) continue;
    if (p.kind === 'habitat') {
      const n = animalsIn(i).length;
      let d = (0.012 + 0.011 * n) * dt * soft;
      if (eventActive('storm')) d *= 2;
      p.clean = clamp(p.clean - d, 0, 100);
    } else if (p.type === 'feedmill') {
      let r = MILL.perLevel[p.lvl - 1] / MILL.rate;
      if (eventActive('storm')) r *= 2;
      p.stock = Math.min(MILL.cap * p.lvl, (p.stock || 0) + r * dt);
    }
  }
  // Staff
  const wage = Object.entries(S.staff).filter(([, v]) => v).reduce((t2, [k]) => t2 + STAFF[k].wage, 0);
  if (wage) {
    S.coins -= (wage / 60) * dt;
    if (S.coins < 0) {
      S.coins = 0;
      for (const k of Object.keys(S.staff)) S.staff[k] = false;
      notify('You could not pay your staff, so they have all left.', 'bad');
    }
    if (S.staff.cleaner) S.plots.forEach((p, i) => { if (p && p.kind === 'habitat' && !p.building && p.clean < 40) p.clean = 100; });
    if (S.staff.feeder) Object.values(S.animals).forEach(a => { if (a.hunger < 35) feedAnimal(a.id, true); });
    if (S.staff.nurse) Object.values(S.animals).forEach(a => { if (a.sick) treatAnimal(a.id, true); });
  }
  // Orders
  S.orders = S.orders.filter(o => {
    if (t < o.ends) return true;
    S.rep = clamp(S.rep - 2, 0, 100);
    if (!offline) notify(`${o.who} gave up waiting for their order.`, 'bad');
    return false;
  });
  if (t >= S.nextOrderAt) {
    if (S.orders.length < maxOrders()) { const o = newOrder(); if (o) { S.orders.push(o); if (!offline) emit('neworder', o); } }
    S.nextOrderAt = t + rand(2, 4) * 60000;
  }
  // Shows
  if (has('building', 'showring')) {
    if (!S.show) newShow();
    else if (t >= S.show.ends) judgeShow();
  }
  // Events
  if (S.event && t >= S.event.ends) endEvent();
  else if (!S.event && t >= S.nextEventAt && Object.keys(S.animals).length >= 3 && !offline) startEvent();
}

let lastTick = 0;
export function tick(dtOverride) {
  const t = now();
  const dt = dtOverride ?? (lastTick ? (t - lastTick) / 1000 : 0);
  lastTick = t;
  if (dt > 0) step(Math.min(dt, 5), false);
  else step(0, false);
  checkAchievements();
  emit('tick');
}

// Simulate the time the player was away, in coarse steps.
export function catchUp() {
  const away = Math.min(OFFLINE_CAP, (now() - S.last) / 1000);
  lastTick = now();
  if (away < 30) return null;
  const before = { coins: S.coins, animals: Object.keys(S.animals).length, babies: S.stats.babies };
  let left = away;
  while (left > 0) { const d = Math.min(10, left); step(d, true); left -= d; }
  return { away, babies: S.stats.babies - before.babies, lost: Math.max(0, before.animals + (S.stats.babies - before.babies) - Object.keys(S.animals).length) };
}

export function alertsFor(idx) {
  const list = animalsIn(idx);
  return {
    hungry: list.filter(a => a.hunger < 30).length,
    sick: list.filter(a => a.sick).length,
    sad: list.filter(a => a.happy < 30).length,
    ready: list.filter(a => isAdult(a) && !a.breeding && a.restUntil < now() && !a.sick).length,
    breeding: list.filter(a => a.breeding && !a.breeding.mate).length,
  };
}

export function pairsAvailable(idx) {
  const list = animalsIn(idx);
  const males = list.filter(a => a.sex === 'm'), females = list.filter(a => a.sex === 'f');
  const pairs = [];
  for (const f of females) for (const m of males) if (!canBreed(f, m)) pairs.push([f, m]);
  return pairs;
}
