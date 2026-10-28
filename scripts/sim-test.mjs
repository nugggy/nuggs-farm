// Headless smoke test of the game engine: plays the core loop with simulated time.
// Usage: node scripts/sim-test.mjs
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');

let clock = Date.now();
Date.now = () => clock;
const advance = secs => { for (let i = 0; i < secs; i++) { clock += 1000; E.tick(1); } };

const E = await import('../www/js/engine.js');
const { SPECIES_LIST, RECIPES, GOALS } = await import('../www/js/data.js');
const events = {};
E.on((t, d) => { events[t] = (events[t] || 0) + 1; if (t === 'toast' && d.kind === 'bad') console.log('  toast:', d.msg); });

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

E.load();
const S = () => E.S;
ok(S().coins === 1000 && S().plotsOwned === 6, 'fresh state');
ok(SPECIES_LIST.length === 68, '68 species defined');
ok(RECIPES.every(r => E.S && r.a && r.b), 'recipes valid');

ok(E.buildHabitat(0, 'hutch'), 'build hutch');
ok(!E.buyAnimal('guineapig', 'm', 0), 'cannot buy before construction finishes');
advance(16);
ok(!S().plots[0].building, 'hutch finished');
const m = E.buyAnimal('guineapig', 'm', 0), f = E.buyAnimal('guineapig', 'f', 0);
ok(m && f, 'bought a pair');
E.feedHabitat(0);
ok(E.canBreed(f, m) === null, 'pair can breed: ' + E.canBreed(f, m));
ok(E.startBreeding(f.id, m.id), 'breeding started');
advance(50);
ok(!S().animals[f.id].breeding, 'breeding finished');
const babies = Object.values(S().animals).filter(a => !E.isAdult(a));
console.log('  litters', S().stats.litters, 'babies', babies.length, 'events', JSON.stringify(events));
advance(65);
ok(babies.every(b => !S().animals[b.id] || E.isAdult(S().animals[b.id])), 'babies grew up');

// Goals progress
let claimed = 0;
for (let i = 0; i < 6; i++) { const g = E.currentGoal(); const [h, n] = g.check(S()); if (h >= n) { E.claimGoal(); claimed++; } }
ok(claimed >= 2, `claimed ${claimed} goals`);

// Selling
const before = S().coins;
const sellable = Object.values(S().animals).find(a => !a.breeding && a.id !== m.id && a.id !== f.id) || S().animals[m.id];
E.sellAnimal(sellable.id);
ok(S().coins > before, 'selling earns coins');

// Neglect: no food for a long time leads to removal and lost reputation
const repBefore = S().rep;
advance(60 * 60);
ok(S().stats.removed > 0 && S().rep < repBefore, `neglect has consequences (removed ${S().stats.removed}, rep ${Math.round(S().rep)})`);

// Recipe breeding
S().level = 20; S().coins = 1e6;
ok(E.buildHabitat(1, 'kennel'), 'build kennel');
advance(25);
E.upgradeHabitat(1); E.upgradeHabitat(1);
const hu = E.buyAnimal('husky', 'm', 1), po = E.buyAnimal('pomeranian', 'f', 1);
ok(E.findRecipe(hu, po)?.result === 'samoyed', 'husky + pomeranian recipe found');
let got = false;
for (let i = 0; i < 40 && !got; i++) {
  S().feed = 999; E.feedHabitat(1); S().event = null; for (const x of [hu, po]) { x.restUntil = 0; x.happy = 100; x.sick = false; x.health = 100; }
  E.cleanHabitat(1);
  E.startBreeding(hu.id, po.id);
  advance(E.breedTime(hu, po) + 1);
  got = Object.values(S().animals).some(a => a.species === 'samoyed');
  for (const a of Object.values(S().animals)) if (a.home === 1 && a.id !== hu.id && a.id !== po.id) E.sellAnimal(a.id);
}
ok(got, 'secret pairing produced a Samoyed within 40 tries');

// Orders, shows, events appear over time
S().feed = 9999;
E.buildBuilding(2, 'showring'); E.buildBuilding(3, 'feedmill');
for (let i = 0; i < 30; i++) { E.feedAll(); advance(60); }
ok(S().orders.length > 0, `orders generated (${S().orders.length})`);
ok(!!S().show, 'show running');
ok((events.event || 0) > 0, 'random events fired');

// Save round trip
E.save();
const code = E.exportSave();
E.importSave(code);
ok(Object.keys(E.S.animals).length >= 0 && E.S.level === 20, 'save code round trip');

// More ways to make animals happy
const pal = Object.values(S().animals).find(x => x.home === 1) || E.buyAnimal('husky', 'm', 1);
pal.happy = 20; E.playWith(pal.id);
ok(pal.happy === 45, 'playing raises happiness');
E.playWith(pal.id);
ok(pal.happy === 45, 'play has a cooldown');
const snacks = S().items.snack; E.giveSnack(pal.id);
ok(pal.happy === 75 && S().items.snack === snacks - 1, 'a snack raises happiness and is used up');
E.buySnacks();
ok(S().items.snack === snacks - 1 + E.SNACK_PACK.n, 'snacks can be bought');
const hab = E.animalsIn(1); hab.forEach(x => { x.happy = 10; }); E.playtime(1);
ok(hab.every(x => x.happy === 25), 'habitat play time cheers everyone up');

// Offline catch-up: the farm rests while you are away
const count = Object.keys(S().animals).length;
for (const x of Object.values(S().animals)) { x.hunger = 100; x.happy = 100; x.health = 100; x.sick = false; }
S().plots.forEach(p => { if (p && p.kind === 'habitat') p.clean = 100; });
S().staff = {};
E.goAway();
clock += 30 * 1000; E.save();
clock += 8 * 3600 * 1000;
const r = E.catchUp();
ok(r && r.away > 8 * 3600 - 1, 'saves while hidden do not shorten the time away');
const all = Object.values(S().animals);
ok(Object.keys(S().animals).length >= count && r.lost === 0, 'no animals lost while away');
ok(all.every(x => !x.sick && x.health === 100), 'nobody gets sick while away');
ok(all.every(x => x.hunger >= 54 && x.happy >= 54), 'needs stay comfortable after a full work day away');

console.log(fails ? `\n${fails} FAILURES` : '\nAll checks passed');
process.exit(fails ? 1 : 0);
