// Rendering and input handling. All game rules live in engine.js.
import * as E from './engine.js';
import { S } from './engine.js';
import {
  GROUPS, SPECIES, SPECIES_LIST, RECIPES, MUTATIONS, TRAITS, BUILDINGS, STAFF, FEED_PRICE, MILL,
  xpForLevel, GOALS, ACHIEVEMENTS, MAX_LEVEL, HABITAT_UPGRADES,
} from './data.js';
import { icon } from './icons.js';
import { portrait, drawAnimal, artBounds } from './art.js';
import { sfx, setSound } from './audio.js';
import { CREDITS } from './credits.js';
import { APP_VERSION } from './version.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = E.fmt;
const dur = E.dur;

let tab = 'farm';
let shopTab = 'animals';
let shopGroup = 'all';
let bookGroup = 'all';
let modalStack = [];
let confirmKey = null;
let lastSig = '';

// ---------- small building blocks ----------
const img = (species, mut, cls = '') =>
  `<img class="ph ${cls} ${mut === 'rainbow' ? 'mut-rainbow' : ''}" src="${portrait(species, mut, cls.includes('heroimg') ? 420 : 160, cls.includes('silhouette'))}" alt="${esc(SPECIES[species].name)}" draggable="false">`;
const liveCanvas = (species, mut, baby) => `<canvas class="livecv" data-sp="${species}" data-mut="${mut || ''}" data-baby="${baby ? 1 : 0}"></canvas>`;
const gauge = (kind, a, label, ic) => `<div class="gauge g-${kind}" data-gauge="${kind}|${a.id}" style="--v:${Math.round(a[kind])}"><div class="ring">${icon(ic)}</div><span>${label}</span><b>${Math.round(a[kind])}%</b></div>`;
const photo = species => `<figure class="realphoto"><img src="img/animals/${species}.jpg" alt="Photo of a ${esc(SPECIES[species].name)}" loading="lazy"><figcaption>Real-life photo${CREDITS[species] ? ` · ${esc(CREDITS[species].author.slice(0, 40))}, ${esc(CREDITS[species].licence)}` : ''}</figcaption></figure>`;
const starRow = n => `<span class="stars">${[1, 2, 3, 4, 5].map(i => icon(i <= n ? 'star' : 'starEmpty')).join('')}</span>`;
const sexIcon = s => icon(s === 'm' ? 'male' : 'female', 'sex');
const bar = (kind, id, val) => `<div class="bar ${kind}" title="${kind}"><i data-bar="${kind}|${id}" style="width:${val}%"></i></div>`;
const coins = n => `<span class="amt">${icon('coin')}${fmt(n)}</span>`;
const gems = n => `<span class="amt">${icon('gem')}${fmt(n)}</span>`;
const timer = ts => `<span data-timer="${ts}">${dur((ts - Date.now()) / 1000)}</span>`;
const prog = (start, end) => `<div class="prog"><i data-prog="${start}|${end}" style="width:${pct(start, end)}%"></i></div>`;
const pct = (a, b) => Math.max(0, Math.min(100, ((Date.now() - a) / (b - a)) * 100));
const btn = (act, label, arg = '', cls = '', extra = '') => `<button class="btn ${cls}" data-act="${act}" data-arg="${esc(arg)}" ${extra}>${label}</button>`;
const mutChip = m => m ? `<span class="chip mutchip mut-${m}-chip">${icon('sparkle')}${MUTATIONS[m].name}</span>` : '';
const traitChip = t => t ? `<span class="chip ${TRAITS[t].good ? 'good' : 'bad'}" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>` : '';

function animalStatus(a) {
  const t = Date.now();
  if (a.breeding) return `<span class="st love">${icon('heart')}Breeding ${timer(a.breeding.ends)}</span>`;
  if (!E.isAdult(a)) return `<span class="st baby">${icon('baby')}Grows up in ${timer(a.adultAt)}</span>`;
  if (a.sick) return `<span class="st sick">${icon('sick')}Sick</span>`;
  if (a.restUntil > t) return `<span class="st rest">${icon('clock')}Resting ${timer(a.restUntil)}</span>`;
  if (a.hunger < 30) return `<span class="st warn">${icon('bowl')}Hungry</span>`;
  if (a.happy < 30) return `<span class="st warn">${icon('sad')}Unhappy</span>`;
  return `<span class="st ok">Ready to breed</span>`;
}

function animalRow(a, act = 'animal', arg = a.id, right = '') {
  const sp = SPECIES[a.species];
  return `<div class="arow" data-act="${act}" data-arg="${arg}">
    <div class="thumb ${a.mut ? 'has-mut' : ''}">${img(a.species, a.mut)}${!E.isAdult(a) ? '<span class="babytag">Baby</span>' : ''}</div>
    <div class="ainfo">
      <div class="aname">${sexIcon(a.sex)}<b>${esc(a.name)}</b> ${mutChip(a.mut)}</div>
      <div class="asub">${esc(sp.name)} ${starRow(E.stars(a))}</div>
      <div class="asub">${animalStatus(a)}</div>
      <div class="bars">${bar('hunger', a.id, a.hunger)}${bar('happy', a.id, a.happy)}${bar('health', a.id, a.health)}</div>
    </div>${right}
  </div>`;
}

// ---------- HUD ----------
function renderHUD() {
  const need = xpForLevel(S.level);
  const p = S.level >= MAX_LEVEL ? 100 : (S.xp / need) * 100;
  $('#hud').innerHTML = `
    <button class="lvl" data-act="tab" data-arg="more" style="--p:${p}" aria-label="Level ${S.level}"><span>${S.level}</span></button>
    <div class="res"><span class="pill" id="h-coins">${icon('coin')}<b>${fmt(S.coins)}</b></span>
    <span class="pill" id="h-gems">${icon('gem')}<b>${fmt(S.gems)}</b></span>
    <span class="pill" id="h-feed" data-act="feedAll">${icon('feed')}<b>${fmt(S.feed)}</b></span>
    <span class="pill rep" title="Reputation">${icon('heart')}<b>${Math.round(S.rep)}</b></span></div>
    <button class="iconbtn" data-act="settings" aria-label="Settings">${icon('gear')}</button>`;
}
function updateHUD() {
  const set = (id, v) => { const el = document.querySelector(id + ' b'); if (el && el.textContent !== v) { el.textContent = v; el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump'); } };
  set('#h-coins', fmt(S.coins)); set('#h-gems', fmt(S.gems)); set('#h-feed', fmt(S.feed));
  const rep = document.querySelector('.pill.rep b'); if (rep) rep.textContent = Math.round(S.rep);
  const lvl = document.querySelector('.lvl');
  if (lvl) { lvl.style.setProperty('--p', S.level >= MAX_LEVEL ? 100 : (S.xp / xpForLevel(S.level)) * 100); lvl.querySelector('span').textContent = S.level; }
}

function renderEvent() {
  const el = $('#event');
  const active = S.event && Date.now() < S.event.ends;
  document.body.classList.toggle('has-event', !!active);
  if (!active) { el.innerHTML = ''; el.hidden = true; return; }
  const ev = E.EVENTS[S.event.id];
  el.hidden = false;
  el.className = 'event ev-' + S.event.id;
  el.innerHTML = `<div class="evicon">${icon(S.event.id === 'fox' ? 'fox' : S.event.id === 'heatwave' ? 'sun' : S.event.id === 'festival' ? 'gift' : S.event.id === 'outbreak' ? 'sick' : S.event.id === 'bumper' ? 'heart' : 'sparkle')}</div>
    <div class="evtext"><b>${ev.name}</b> <small>${timer(S.event.ends)}</small><div>${ev.desc}</div></div>
    ${ev.action ? btn('eventAction', ev.action, '', 'warn') : ''}`;
}

// ---------- views ----------
const VIEWS = {
  farm: renderFarm, shop: renderShop, orders: renderOrders, shows: renderShows, book: renderBook, more: renderMore,
};

function renderNav() {
  const items = [['farm', 'farm', 'Farm'], ['shop', 'shop', 'Shop'], ['orders', 'clipboard', 'Orders'], ['shows', 'ribbon', 'Shows'], ['book', 'book', 'Book'], ['more', 'trophy', 'Goals']];
  const badge = { orders: S.orders.filter(o => Object.values(S.animals).some(a => E.meetsOrder(a, o))).length, more: goalReady() ? 1 : 0, farm: farmAlerts() };
  $('#nav').innerHTML = items.map(([id, ic, label]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${icon(ic)}<span>${label}</span>${badge[id] ? `<em>${badge[id]}</em>` : ''}</button>`).join('');
}
const goalReady = () => { const g = E.currentGoal(); if (!g) return false; const [h, n] = g.check(S); return h >= n; };
const farmAlerts = () => Object.values(S.animals).filter(a => a.sick || a.hunger < 20).length;

function render() {
  renderHUD(); renderEvent(); renderNav();
  const view = $('#view'), wwrap = $('#worldwrap');
  const inWorld = tab === 'farm' && farmMode === 'world';
  wwrap.hidden = !inWorld; view.hidden = inWorld;
  document.body.classList.toggle('in-world', inWorld);
  if (inWorld) { world.show(); renderWorldOverlay(); }
  else {
    world.hide();
    const scroll = view.scrollTop;
    view.innerHTML = `<div class="page page-${tab}">${pageHead()}${tab === 'farm' ? renderFarm() : VIEWS[tab]()}</div>`;
    view.scrollTop = scroll;
  }
  renderModal();
  lastSig = signature();
}

const PAGES = {
  farm: ['Farm list', 'Every plot at a glance'],
  shop: ['Shop', 'Animals, buildings and supplies'],
  orders: ['Orders', 'Customers looking for the perfect animal'],
  shows: ['Show Ring', 'Compete for ribbons, coins and gems'],
  book: ['Encyclopaedia', 'Every species, mutation and secret pairing'],
  more: ['Goals', 'Your progress, achievements and settings'],
};
function pageHead() {
  const [title, sub] = PAGES[tab];
  return `<header class="pagehead">${tab === 'farm' ? btn('farmMode', icon('farm'), 'world', 'round soft', 'aria-label="Back to the farm"') : ''}<div><h1>${title}</h1><p>${sub}</p></div></header>`;
}

// Animated animal stages inside sheets
let liveRaf = 0;
function startLive() {
  if (liveRaf) return;
  const t0 = performance.now();
  const loop = now => {
    const list = document.querySelectorAll('canvas.livecv');
    if (!list.length) { liveRaf = 0; return; }
    const t = (now - t0) / 1000;
    for (const cv of list) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) continue;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const sp = cv.dataset.sp, b = artBounds(sp);
      const sc = Math.min((w * 0.6) / b.w, (h * 0.66) / b.h) * (cv.dataset.baby === '1' ? 0.7 : 1);
      const cycle = Math.floor(t / 3.2) % 4, pose = ['idle', 'play', 'idle', 'walk'][cycle];
      c.save(); c.translate(w / 2, h * 0.86);
      drawAnimal(c, sp, { pose, t, mut: cv.dataset.mut || null, scale: sc });
      c.restore();
    }
    liveRaf = requestAnimationFrame(loop);
  };
  liveRaf = requestAnimationFrame(loop);
}

function confetti(strength = 1) {
  if ((S.settings.quality || 'high') !== 'high') return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  document.body.appendChild(cv);
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const cols = ['#ff5f6d', '#ffd23f', '#4fd1c5', '#b98cff', '#3d9a4b', '#5fb4e6'];
  const bits = Array.from({ length: Math.round(130 * strength) }, () => ({ x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.38, vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 700, r: Math.random() * 6, s: 5 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)], w: (Math.random() - 0.5) * 14 }));
  let last = performance.now(), life = 0;
  const step = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; life += dt;
    c.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.vy += 1100 * dt; b.vx *= 0.985; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.w * dt;
      c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.scale(1, Math.cos(b.r * 2)); c.fillStyle = b.c; c.globalAlpha = Math.max(0, 1 - life / 2.8); c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); c.restore();
    }
    if (life < 2.8) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}

function renderWorldOverlay() {
  const g = E.currentGoal();
  let goal = '';
  if (g) {
    const [have, need] = g.check(S);
    const done = have >= need;
    goal = `<button class="wgoal ${done ? 'done' : ''}" data-act="${done ? 'claimGoal' : 'tab'}" data-arg="${done ? '' : 'more'}">${icon('clipboard')}<span><small>${done ? 'Goal complete. Tap to claim' : `Goal ${S.goal + 1}`}</small><b>${g.text}</b><i class="wbar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></i></span></button>`;
  }
  const nurse = E.nursery();
  $('#wui').innerHTML = `<div class="wtop">${goal}${E.dailyAvailable() ? btn('claimDaily', `${icon('gift')}Daily reward`, '', 'go tiny wdaily') : ''}</div>
    <div class="wside">
      ${btn('feedAll', icon('bowl'), '', 'round', 'title="Feed everyone" aria-label="Feed everyone"')}
      ${nurse.length ? btn('nursery', `${icon('baby')}<em>${nurse.length}</em>`, '', 'round warn', 'title="Nursery" aria-label="Nursery"') : ''}
      ${btn('zoomIn', icon('plus'), '', 'round soft', 'aria-label="Zoom in"')}
      ${btn('zoomOut', '<b class="minus">&minus;</b>', '', 'round soft', 'aria-label="Zoom out"')}
      ${btn('overview', icon('move'), '', 'round soft', 'title="Map overview" aria-label="Map overview"')}
      ${btn('farmMode', icon('menu'), 'list', 'round soft', 'title="List view" aria-label="List view"')}
    </div>
    <div class="whint">Tap to walk · Drag to steer · Walk to a gate to open it</div>`;
}

let farmMode = 'world';
let world = null;
export function attachWorld(w) { world = w; }
export function setPrompt(label) {
  const b = $('#interact');
  document.body.classList.toggle('has-prompt', !!label);
  if (!label) { b.hidden = true; return; }
  b.hidden = false; b.innerHTML = `${icon('paw')}${esc(label)}`;
}

function goalCard() {
  const g = E.currentGoal();
  if (!g) return '';
  const [have, need] = g.check(S);
  const done = have >= need;
  const r = g.reward;
  return `<div class="goal ${done ? 'done' : ''}">
    <div class="gicon">${icon('clipboard')}</div>
    <div class="gtext"><small>Goal ${S.goal + 1} of ${GOALS.length}</small><b>${g.text}</b>
      <div class="prog small"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></div>
      <small>${Math.min(have, need)} / ${need} · Reward ${r.coins ? coins(r.coins) : ''} ${r.gems ? gems(r.gems) : ''} ${r.feed ? `<span class="amt">${icon('feed')}${r.feed}</span>` : ''}</small></div>
    ${done ? btn('claimGoal', 'Claim', '', 'go') : ''}</div>`;
}

function renderFarm() {
  let html = goalCard();
  if (E.dailyAvailable()) {
    const st = E.nextStreak(), r = E.dailyReward(st);
    html += `<div class="daily">${icon('gift')}<div><b>Daily reward, day ${st} of 7</b><small>${coins(r.coins)} ${gems(r.gems)} <span class="amt">${icon('feed')}${r.feed}</span></small></div>${btn('claimDaily', 'Collect', '', 'go')}</div>`;
  }
  const nurse = E.nursery();
  html += `<div class="quick">
    ${btn('feedAll', `${icon('bowl')} Feed everyone`, '', 'soft')}
    ${nurse.length ? btn('nursery', `${icon('baby')} Nursery (${nurse.length}/${E.nurseryCap()})`, '', 'warn') : ''}
    ${S.items.charm ? `<span class="chip good">${icon('sparkle')}Lucky Charm ready</span>` : ''}
  </div>`;
  html += '<div class="grid">';
  for (let i = 0; i < S.plotsOwned; i++) html += plotCard(i);
  const lc = E.landCost();
  if (lc != null && S.plotsOwned < S.plots.length) html += `<button class="plot land" data-act="buyLand">${icon('lock')}<span><b>Clear more land</b><small>Three new plots for ${coins(lc)}</small></span></button>`;
  html += '</div>';
  return html;
}

function plotCard(i) {
  const p = S.plots[i];
  if (!p) return `<button class="plot empty" data-act="buildMenu" data-arg="${i}">${icon('plus')}<span>Build</span></button>`;
  if (p.building) {
    const meta = p.kind === 'habitat' ? GROUPS[p.group] : BUILDINGS[p.type];
    const total = (p.kind === 'habitat' ? GROUPS[p.group].build : BUILDINGS[p.type].build) * 1000;
    return `<div class="plot constructing" style="--c:${p.kind === 'habitat' ? meta.colour : '#8d6e4f'}">
      <div class="phead">${icon('hammer')}<b>${meta.name}</b></div>
      <div class="pbody center"><div class="crane"></div>${prog(p.building - total, p.building)}<small>${timer(p.building)}</small>
      ${btn('rushBuild', `Finish ${icon('gem')}${E.gemCost((p.building - Date.now()) / 1000)}`, i, 'tiny gem')}</div></div>`;
  }
  if (p.kind === 'building') return buildingCard(i, p);
  const g = GROUPS[p.group];
  const list = E.animalsIn(i);
  const al = E.alertsFor(i);
  const cap = E.habitatCap(p);
  return `<button class="plot hab hab-${p.group}" style="--c:${g.colour}" data-act="habitat" data-arg="${i}">
    <div class="phead"><b>${g.name}</b><small>Lv ${p.lvl} · ${list.length}/${cap}</small></div>
    <div class="pbody"><div class="pets">${list.slice(0, 6).map(a => `<span class="pet ${a.sick ? 'is-sick' : ''} ${a.hunger < 30 ? 'is-hungry' : ''} ${E.isAdult(a) ? '' : 'is-baby'}">${img(a.species, a.mut)}</span>`).join('')}${list.length > 6 ? `<span class="pet more">+${list.length - 6}</span>` : ''}${!list.length ? '<span class="emptytxt">No animals yet</span>' : ''}</div></div>
    <div class="pfoot">${bar('clean', 'p' + i, p.clean)}
      <span class="flags">${al.breeding ? `<i class="f love">${icon('heart')}${al.breeding}</i>` : ''}${al.hungry ? `<i class="f warn">${icon('bowl')}${al.hungry}</i>` : ''}${al.sick ? `<i class="f sick">${icon('sick')}${al.sick}</i>` : ''}${p.clean < 30 ? `<i class="f warn">${icon('broom')}</i>` : ''}</span></div>
  </button>`;
}

function buildingCard(i, p) {
  const b = BUILDINGS[p.type];
  let body = `<small>${b.desc}</small>`;
  if (p.type === 'feedmill') {
    const cap = MILL.cap * p.lvl;
    body = `<div class="mill"><div class="millbig">${icon('feed')}<b data-mill="${i}">${Math.floor(p.stock)}</b><small>/ ${cap}</small></div>${btn('collect', 'Collect', i, 'go tiny')}</div>`;
  }
  if (p.type === 'showring') body = S.show ? `<small>${GROUPS[S.show.group].plural} show</small><small>Ends in ${timer(S.show.ends)}</small>` : '<small>Setting up</small>';
  return `<div class="plot bld bld-${p.type}" data-act="building" data-arg="${i}">
    <div class="phead"><b>${b.name}</b>${p.type === 'feedmill' ? `<small>Lv ${p.lvl}</small>` : ''}</div>
    <div class="pbody center">${body}</div></div>`;
}

// Shop
function renderShop() {
  const tabs = [['animals', 'Animals'], ['build', 'Build'], ['supplies', 'Supplies'], ['staff', 'Staff']];
  let html = `<div class="seg">${tabs.map(([id, l]) => `<button class="${shopTab === id ? 'on' : ''}" data-act="shopTab" data-arg="${id}">${l}</button>`).join('')}</div>`;
  if (shopTab === 'animals') {
    html += groupChips('shopGroup', shopGroup);
    const list = SPECIES_LIST.filter(sp => shopGroup === 'all' || sp.group === shopGroup).sort((a, b) => (a.price == null) - (b.price == null) || a.level - b.level);
    html += '<div class="cards">' + list.map(sp => {
      const locked = S.level < sp.level || S.level < GROUPS[sp.group].unlock;
      const secret = sp.price == null;
      const known = S.discovered[sp.id];
      return `<button class="card sp ${locked ? 'locked' : ''} ${secret ? 'secret' : ''}" data-act="speciesShop" data-arg="${sp.id}">
        <div class="cimg">${secret && !known ? img(sp.id, null, 'silhouette') : img(sp.id)}${tierBadge(sp.tier)}</div>
        <div class="cbody"><b>${secret && !known ? 'Secret species' : sp.name}</b>
        <small>${GROUPS[sp.group].name}</small>
        <div class="price">${secret ? `<span class="chip">${icon('dna')}Breed only</span>` : locked ? `<span class="chip">${icon('lock')}Level ${Math.max(sp.level, GROUPS[sp.group].unlock)}</span>` : coins(sp.price)}</div></div></button>`;
    }).join('') + '</div>';
  }
  if (shopTab === 'build') {
    html += '<h3>Habitats</h3><div class="list">' + Object.entries(GROUPS).map(([id, g]) => buildRow('habitat', id, g.name, g.desc, g.cost, g.unlock, g.build)).join('') + '</div>';
    html += '<h3>Buildings</h3><div class="list">' + Object.entries(BUILDINGS).map(([id, b]) => buildRow('building', id, b.name, b.desc, b.cost, b.unlock, b.build, `${E.countBuilding(id)}/${b.max}`)).join('') + '</div>';
  }
  if (shopTab === 'supplies') {
    html += '<h3>Feed</h3><div class="list">' + [[25, ''], [100, 'Popular'], [400, 'Bulk']].map(([n, tag]) =>
      `<div class="lrow">${icon('feed', 'big')}<div><b>${n} feed</b>${tag ? ` <span class="chip good">${tag}</span>` : ''}<small>One meal for a common animal is 1 feed. Rarer animals eat more.</small></div>${btn('buyFeed', coins(n * FEED_PRICE), n)}</div>`).join('') + '</div>';
    html += `<h3>Treats</h3><div class="list"><div class="lrow">${icon('cookie', 'big')}<div><b>${E.SNACK_PACK.n} snacks</b> <small>Owned: ${S.items.snack}</small><small>A tasty snack gives one animal a big happiness boost and a little food. Happy animals breed more reliably.</small></div>${btn('buySnacks', coins(E.SNACK_PACK.coins))}</div></div>`;
    html += '<h3>Breeding supplies</h3><div class="list">' + Object.entries(E.ITEMS).map(([id, it]) =>
      `<div class="lrow">${icon(id === 'charm' ? 'sparkle' : 'dna', 'big')}<div><b>${it.name}</b> <small>Owned: ${S.items[id]}</small><small>${it.desc}</small></div>${btn('buyItem', gems(it.gems), id, 'gem')}</div>`).join('') + '</div>';
    html += `<h3>Exchange</h3><div class="list"><div class="lrow">${icon('coin', 'big')}<div><b>Coin pouch</b><small>Swap 10 gems for ${fmt(1000 + S.level * 150)} coins.</small></div>${btn('buyCoins', gems(10), '', 'gem')}</div></div>`;
    const lc = E.landCost();
    if (lc != null && S.plotsOwned < S.plots.length) html += `<h3>Land</h3><div class="list"><div class="lrow">${icon('farm', 'big')}<div><b>Clear three more plots</b><small>You own ${S.plotsOwned} of ${S.plots.length} plots.</small></div>${btn('buyLand', coins(lc))}</div></div>`;
  }
  if (shopTab === 'staff') {
    html += '<p class="note">Staff take care of chores while you play or while you are away. They charge a wage every minute, so keep some coins in the bank.</p><div class="list">' + Object.entries(STAFF).map(([id, st]) => {
      const locked = S.level < st.unlock;
      return `<div class="lrow ${locked ? 'locked' : ''}">${icon(id === 'cleaner' ? 'broom' : id === 'feeder' ? 'bowl' : 'cross', 'big')}<div><b>${st.name}</b> ${S.staff[id] ? '<span class="chip good">Hired</span>' : ''}<small>${st.desc}</small><small>Hiring fee ${coins(st.fee)} · Wage ${coins(st.wage)} a minute</small></div>
      ${locked ? `<span class="chip">${icon('lock')}Level ${st.unlock}</span>` : btn('hire', S.staff[id] ? 'Let go' : 'Hire', id, S.staff[id] ? 'soft' : '')}</div>`;
    }).join('') + '</div>';
  }
  return html;
}

const tierBadge = t => `<span class="tier t${t}">${['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][t]}</span>`;

function groupChips(act, current) {
  return `<div class="chips scrollx">${[['all', 'All'], ...Object.entries(GROUPS).map(([id, g]) => [id, g.plural])].map(([id, l]) => `<button class="chip ${current === id ? 'on' : ''}" data-act="${act}" data-arg="${id}">${l}</button>`).join('')}</div>`;
}

function buildRow(kind, id, name, desc, cost, unlock, secs, countTxt = '') {
  const locked = S.level < unlock;
  return `<div class="lrow ${locked ? 'locked' : ''}"><div class="bicon" style="--c:${kind === 'habitat' ? GROUPS[id].colour : '#8d6e4f'}">${icon(kind === 'habitat' ? 'paw' : 'hammer')}</div>
    <div><b>${name}</b> ${countTxt ? `<small class="inline">${countTxt}</small>` : ''}<small>${desc}</small><small>${icon('clock')} ${dur(secs)} to build</small></div>
    ${locked ? `<span class="chip">${icon('lock')}Level ${unlock}</span>` : btn('buildAny', coins(cost), kind + ':' + id)}</div>`;
}

// Orders
function renderOrders() {
  let html = `<p class="note">Customers want specific animals. Fill orders for big rewards and reputation. Letting them expire costs reputation. A higher reputation means better pay.</p>`;
  if (!S.orders.length) html += `<div class="emptybox">${icon('clipboard', 'huge')}<b>No orders right now</b><small>New customers arrive every few minutes.</small></div>`;
  html += '<div class="list">' + S.orders.map(o => {
    const r = o.req, sp = SPECIES[r.species];
    const ready = Object.values(S.animals).filter(a => E.meetsOrder(a, o));
    return `<div class="order ${o.special ? 'special' : ''} ${ready.length ? 'ready' : ''}">
      <div class="othumb">${img(r.species, r.mut && r.mut !== 'any' ? r.mut : null)}</div>
      <div class="obody"><small>${esc(o.who)} wants</small><b>${sp.name}</b>
        <div class="reqs">${starRow(r.stars)}<span>or better</span>${r.sex ? `<span class="chip">${sexIcon(r.sex)}${r.sex === 'm' ? 'Male' : 'Female'}</span>` : ''}${r.trait ? traitChip(r.trait) : ''}${r.mut ? (r.mut === 'any' ? `<span class="chip mutchip">${icon('sparkle')}Any mutation</span>` : mutChip(r.mut)) : ''}</div>
        <div class="reward">${coins(o.coins)} ${o.gems ? gems(o.gems) : ''} <span class="amt xp">+${o.xp} XP</span> <small class="time">${icon('clock')}${timer(o.ends)}</small></div></div>
      <div class="oact">${btn('fillOrder', ready.length ? 'Fill' : 'Check', o.id, ready.length ? 'go' : 'soft')}${btn('dismissOrder', icon('close'), o.id, 'tiny ghost', 'aria-label="Decline"')}</div></div>`;
  }).join('') + '</div>';
  return html;
}

// Shows
function renderShows() {
  if (!E.has('building', 'showring')) {
    const b = BUILDINGS.showring;
    return `<div class="emptybox">${icon('ribbon', 'huge')}<b>Build a Show Ring</b><small>Unlocks at level ${b.unlock}. Compete against rival breeders for ribbons, coins and gems. Ribbons also raise an animal's value.</small>${S.level >= b.unlock ? btn('buildAny', `Build for ${coins(b.cost)}`, 'building:showring', 'go') : ''}</div>`;
  }
  const sh = S.show;
  let html = '';
  if (sh) {
    const entry = sh.entry && S.animals[sh.entry];
    html += `<div class="showcard" style="--c:${GROUPS[sh.group].colour}">
      <div class="shead">${icon('ribbon', 'big')}<div><small>Now judging</small><b>${GROUPS[sh.group].plural} Championship</b><small>Results in ${timer(sh.ends)} · Entry fee ${coins(sh.fee)}</small></div></div>
      ${entry ? `<div class="entrant">${animalRow(entry)}<p>Estimated score <b>${Math.round(E.showScore(entry))}</b> plus a little luck on the day.</p></div>` : btn('showEnter', 'Choose an entrant', '', 'go wide')}
      <h4>Rival form guide</h4><div class="rivals">${sh.npc.map(n => `<div><span>${n.name}</span><b>${Math.max(0, n.score - 6)} to ${n.score + 6}</b></div>`).join('')}</div>
      <p class="note">Score comes mostly from genes (charm counts most), plus happiness, health, mutations, the Charmer trait and past ribbons.</p></div>`;
  }
  if (S.showHistory.length) {
    html += '<h3>Recent results</h3><div class="list">' + S.showHistory.map(r => `<div class="lrow">${img(r.species, null, 'mini')}<div><b>${esc(r.animal)}</b><small>${GROUPS[r.group].plural} show</small></div><span class="place p${r.place}">${ordinal(r.place)}</span></div>`).join('') + '</div>';
  }
  return html;
}
const ordinal = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

// Book
function renderBook() {
  const found = Object.keys(S.discovered).length;
  let html = `<div class="bookhead"><b>Animal Encyclopaedia</b><small>${found} of ${SPECIES_LIST.length} species discovered · ${Object.values(S.mutSeen).reduce((t, m) => t + Object.keys(m).length, 0)} colour mutations seen</small><div class="prog"><i style="width:${(found / SPECIES_LIST.length) * 100}%"></i></div></div>`;
  html += groupChips('bookGroup', bookGroup);
  html += '<div class="cards book">' + SPECIES_LIST.filter(sp => bookGroup === 'all' || sp.group === bookGroup).map(sp => {
    const k = S.discovered[sp.id];
    const muts = Object.keys(S.mutSeen[sp.id] || {});
    return `<button class="card bk ${k ? '' : 'unknown'}" data-act="speciesInfo" data-arg="${sp.id}">
      <div class="cimg">${img(sp.id, null, k ? '' : 'silhouette')}${tierBadge(sp.tier)}</div>
      <div class="cbody"><b>${k || sp.price ? sp.name : '???'}</b><span class="mutdots">${Object.keys(MUTATIONS).map(m => `<i class="${muts.includes(m) ? 'on mut-' + m + '-chip' : ''}"></i>`).join('')}</span></div></button>`;
  }).join('') + '</div>';
  html += '<h3>Secret pairings</h3><div class="list">' + RECIPES.map(r => {
    const done = S.recipesFound[r.result];
    const near = S.discovered[r.a] || S.discovered[r.b];
    return `<div class="lrow recipe ${done ? 'done' : ''}">${icon('dna', 'big')}<div>${done
      ? `<b>${SPECIES[r.a].name} + ${SPECIES[r.b].name}</b><small>Produces the ${SPECIES[r.result].name}</small>`
      : near ? `<b>Rumour</b><small>${r.hint}</small><small>Habitat: ${GROUPS[SPECIES[r.result].group].name}</small>` : '<b>Unknown pairing</b><small>Discover more species to hear rumours.</small>'}</div></div>`;
  }).join('') + '</div>';
  return html;
}

// More: goals, achievements, stats, settings
function renderMore() {
  const need = xpForLevel(S.level);
  let html = `<div class="levelcard"><div class="lvl big" style="--p:${S.level >= MAX_LEVEL ? 100 : (S.xp / need) * 100}"><span>${S.level}</span></div><div><b>Level ${S.level}</b><small>${S.level >= MAX_LEVEL ? 'Maximum level' : `${fmt(S.xp)} / ${fmt(need)} XP to level ${S.level + 1}`}</small><small>Next unlocks: ${nextUnlocks()}</small></div></div>`;
  html += goalCard();
  html += `<h3>Achievements <small>${Object.keys(S.achievements).length} / ${ACHIEVEMENTS.length}</small></h3><div class="ach">` + ACHIEVEMENTS.map(a => `<div class="achv ${S.achievements[a.id] ? 'got' : ''}">${icon('trophy')}<div><b>${a.name}</b><small>${a.desc}</small></div><span class="amt">${icon('gem')}${a.gems}</span></div>`).join('') + '</div>';
  const st = S.stats;
  html += `<h3>Farm records</h3><div class="statgrid">${[
    ['Litters bred', st.litters], ['Babies born', st.babies], ['Animals sold', st.sold], ['Orders filled', st.orders],
    ['Mutations bred', st.mutations], ['Ribbons won', st.ribbons], ['Coins earned', fmt(st.earned)], ['Taken by inspectors', st.removed]]
    .map(([l, v]) => `<div><b>${v}</b><small>${l}</small></div>`).join('')}</div>`;
  html += `<h3>Settings</h3><div class="list">
    <div class="lrow">${icon('sound', 'big')}<div><b>Sound effects</b></div>${btn('toggleSound', S.settings.sound ? 'On' : 'Off', '', 'soft')}</div>
    <div class="lrow">${icon('info', 'big')}<div><b>How to play</b></div>${btn('help', 'Open', '', 'soft')}</div>
    <div class="lrow">${icon('refresh', 'big')}<div><b>Check for updates</b><small>Version ${APP_VERSION}</small></div>${btn('checkUpdate', 'Check', '', 'soft')}</div>
    <div class="lrow">${icon('download', 'big')}<div><b>Back up or move your farm</b><small>Copy a save code, or paste one from another device.</small></div>${btn('saveCode', 'Open', '', 'soft')}</div>
    <div class="lrow">${icon('book', 'big')}<div><b>Photo credits</b><small>All animal photos are from Wikimedia Commons.</small></div>${btn('credits', 'View', '', 'soft')}</div>
    <div class="lrow danger">${icon('close', 'big')}<div><b>Start a new farm</b><small>Deletes all progress on this device.</small></div>${btn('reset', confirmKey === 'reset' ? 'Tap again to confirm' : 'Reset', '', 'bad')}</div>
  </div>`;
  return html;
}

function nextUnlocks() {
  const lv = S.level + 1;
  const items = [
    ...SPECIES_LIST.filter(s => s.level === lv && s.price).map(s => s.name),
    ...Object.values(GROUPS).filter(g => g.unlock === lv).map(g => g.name),
    ...Object.values(BUILDINGS).filter(b => b.unlock === lv).map(b => b.name),
    ...Object.values(STAFF).filter(b => b.unlock === lv).map(b => b.name),
  ];
  return items.length ? items.join(', ') : 'bigger rewards';
}

// ---------- modals ----------
function openModal(kind, arg) { modalStack.push({ kind, arg }); confirmKey = null; sfx('tap'); renderModal(); }
function closeModal() { modalStack.pop(); confirmKey = null; renderModal(); }
function closeAll() { modalStack = []; renderModal(); }
export const modalOpen = () => modalStack.length > 0;
export const backButton = () => { if (modalStack.length) { closeModal(); return true; } if (tab !== 'farm') { tab = 'farm'; render(); return true; } return false; };

function renderModal() {
  const root = $('#modal');
  const top = modalStack[modalStack.length - 1];
  if (!top) { root.innerHTML = ''; root.hidden = true; return; }
  const content = MODALS[top.kind] ? MODALS[top.kind](top.arg) : null;
  if (content == null) { modalStack.pop(); return renderModal(); }
  root.hidden = false;
  const sheet = root.querySelector('.sheet');
  const scroll = sheet && sheet.dataset.kind === top.kind + top.arg ? sheet.scrollTop : 0;
  root.innerHTML = `<div class="backdrop" data-act="closeModal"></div><div class="sheet ${top.kind}" data-kind="${esc(top.kind + top.arg)}">
    <div class="grab"></div><button class="x" data-act="closeModal" aria-label="Close">${icon('close')}</button>${content}</div>`;
  startLive();
  root.querySelector('.sheet').scrollTop = scroll;
}

const MODALS = {
  buildMenu(idx) {
    const items = [
      ...Object.entries(GROUPS).map(([id, g]) => ({ kind: 'habitat', id, name: g.name, desc: g.desc, cost: g.cost, unlock: g.unlock, colour: g.colour, secs: g.build })),
      ...Object.entries(BUILDINGS).map(([id, b]) => ({ kind: 'building', id, name: b.name, desc: b.desc, cost: b.cost, unlock: b.unlock, colour: '#8d6e4f', secs: b.build, full: E.countBuilding(id) >= b.max })),
    ];
    return `<h2>Build on this plot</h2><div class="list">${items.map(it => {
      const locked = S.level < it.unlock;
      return `<div class="lrow ${locked || it.full ? 'locked' : ''}"><div class="bicon" style="--c:${it.colour}">${icon(it.kind === 'habitat' ? 'paw' : 'hammer')}</div><div><b>${it.name}</b><small>${it.desc}</small><small>${icon('clock')} ${dur(it.secs)}</small></div>
      ${locked ? `<span class="chip">${icon('lock')}Lv ${it.unlock}</span>` : it.full ? '<span class="chip">Max built</span>' : btn('build', coins(it.cost), `${idx}:${it.kind}:${it.id}`)}</div>`;
    }).join('')}</div>`;
  },

  habitat(idx) {
    const p = S.plots[idx];
    if (!p || p.kind !== 'habitat') return null;
    const g = GROUPS[p.group];
    const list = E.animalsIn(idx).sort((a, b) => (a.sex > b.sex ? 1 : -1) || E.stars(b) - E.stars(a));
    const feedNeed = list.filter(a => a.hunger <= 92).reduce((t, a) => t + SPECIES[a.species].feed, 0);
    const up = E.upgradeCost(p);
    const pairs = E.pairsAvailable(idx).length;
    return `<div class="mhead" style="--c:${g.colour}"><h2>${g.name}</h2><small>Level ${p.lvl} · ${list.length} of ${E.habitatCap(p)} spaces used</small>
      <div class="cleanrow">${icon('broom')}<span>Cleanliness</span>${bar('clean', 'p' + idx, p.clean)}</div></div>
      <div class="actions">
        ${btn('feedHab', `${icon('bowl')}Feed (${feedNeed})`, idx, feedNeed ? 'go' : 'soft')}
        ${btn('clean', `${icon('broom')}Clean`, idx, p.clean < 50 ? 'warn' : 'soft')}
        ${list.length ? btn('playtime', E.playtimeWait(p) ? `${icon('ball')}Play <span data-timer="${Date.now() + E.playtimeWait(p)}">${dur(E.playtimeWait(p) / 1000)}</span>` : `${icon('ball')}Play time`, idx, list.some(a => a.happy < 50) && !E.playtimeWait(p) ? 'love' : 'soft') : ''}
        ${btn('breedPick', `${icon('heart')}Breed${pairs ? ` (${pairs})` : ''}`, idx, pairs ? 'love' : 'soft')}
        ${btn('shopFor', `${icon('shop')}Buy`, p.group, 'soft')}
        ${up != null ? btn('upgrade', `${icon('arrowUp')}${coins(up)}`, idx, 'soft', `title="Upgrade to hold ${HABITAT_UPGRADES[p.lvl].cap}"`) : ''}
      </div>
      <div class="list">${list.map(a => animalRow(a)).join('') || `<div class="emptybox">${icon('paw', 'huge')}<b>This ${g.name.toLowerCase()} is empty</b><small>Buy a male and a female of the same species to start breeding.</small>${btn('shopFor', 'Go to the shop', p.group, 'go')}</div>`}</div>
      ${!list.length ? `<div class="center">${btn('demolish', confirmKey === 'demolish' + idx ? 'Tap again to demolish' : 'Demolish', idx, 'ghost')}</div>` : ''}`;
  },

  building(idx) {
    const p = S.plots[idx];
    if (!p || p.kind !== 'building') return null;
    const b = BUILDINGS[p.type];
    let extra = '';
    if (p.type === 'feedmill') {
      const c = E.millUpgradeCost(p);
      const rate = (60 / (MILL.rate / MILL.perLevel[p.lvl - 1])).toFixed(1);
      extra = `<div class="mill big"><div class="millbig">${icon('feed')}<b data-mill="${idx}">${Math.floor(p.stock)}</b><small>/ ${MILL.cap * p.lvl}</small></div>${btn('collect', 'Collect', idx, 'go')}</div>
        <p class="note">Level ${p.lvl}. Makes about ${rate} feed a minute.</p>${c != null ? btn('upgradeMill', `Upgrade ${coins(c)}`, idx, 'soft wide') : ''}`;
    }
    if (p.type === 'showring') extra = btn('tab', 'Go to the shows', 'shows', 'go wide');
    return `<h2>${b.name}</h2><p>${b.desc}</p>${extra}<div class="center">${btn('demolish', confirmKey === 'demolish' + idx ? 'Tap again to demolish' : 'Demolish', idx, 'ghost')}</div>`;
  },

  animal(id) {
    const a = S.animals[id];
    if (!a) return null;
    const sp = SPECIES[a.species];
    const adult = E.isAdult(a);
    const inShow = S.show && SPECIES[a.species].group === S.show.group && !S.show.entry && adult && !a.sick;
    const g = a.genes;
    return `<div class="stage ${a.mut ? 'has-mut glow-' + a.mut : ''}" style="--hab:${GROUPS[sp.group].colour}">${liveCanvas(a.species, a.mut, !adult)}${a.mut ? `<div class="mutbanner mut-${a.mut}-chip">${icon('sparkle')}${MUTATIONS[a.mut].name}</div>` : ''}<span class="stage-tier">${tierBadge(sp.tier)}</span></div>
      <div class="namebar">${sexIcon(a.sex)}<h2 id="aname">${esc(a.name)}</h2>${btn('rename', 'Rename', id, 'tiny ghost')}</div>
      <div class="sub">${sp.name} · Generation ${a.gen} · ${starRow(E.stars(a))}</div>
      <div class="sub">${animalStatus(a)} ${traitChip(a.trait)} ${a.ribbons ? `<span class="chip">${icon('ribbon')}${a.ribbons}</span>` : ''}</div>
      ${a.trait ? `<p class="note">${TRAITS[a.trait].name}: ${TRAITS[a.trait].desc}</p>` : ''}
      <div class="gauges">${gauge('hunger', a, 'Hunger', 'bowl')}${gauge('happy', a, 'Happiness', 'heart')}${gauge('health', a, 'Health', 'cross')}</div>
      <div class="genes"><h4>${icon('dna')}Genes <small>(passed on to babies)</small></h4>
        ${[['Vigour', 'vig', 'Helps breeding success'], ['Charm', 'charm', 'Counts most at shows'], ['Smarts', 'smarts', 'Adds to overall quality']].map(([l, k, d]) => `<div class="gene"><span>${l}<small>${d}</small></span><div class="gbar"><i style="width:${g[k]}%"></i></div><b>${g[k]}</b></div>`).join('')}
      </div>
      <div class="value">Market value ${coins(E.animalValue(a))}</div>
      <div class="actions">
        ${btn('feed', `${icon('bowl')}Feed (${sp.feed})`, id, a.hunger < 50 ? 'go' : 'soft')}
        ${btn('pet', `${icon('heart')}Pet`, id, 'soft')}
        ${btn('play', E.playWait(a) ? `${icon('ball')}Play <span data-timer="${Date.now() + E.playWait(a)}">${dur(E.playWait(a) / 1000)}</span>` : `${icon('ball')}Play`, id, a.happy < 50 && !E.playWait(a) ? 'love' : 'soft')}
        ${btn('snack', `${icon('cookie')}Snack (${S.items.snack})`, id, 'soft')}
        ${a.sick ? btn('treat', `${icon('cross')}Treat ${coins(E.treatCost(a))}`, id, 'warn') : ''}
        ${adult && !a.breeding ? btn('breedWith', `${icon('heart')}Breed`, id, 'love') : ''}
        ${a.breeding ? btn('rushBreed', `Finish now ${icon('gem')}${E.gemCost((a.breeding.ends - Date.now()) / 1000)}`, id, 'gem') : ''}
        ${!adult ? btn('rushGrow', `Grow now ${icon('gem')}${E.gemCost((a.adultAt - Date.now()) / 1000)}`, id, 'gem') : ''}
        ${inShow ? btn('enterShow', `${icon('ribbon')}Enter show`, id, 'soft') : ''}
        ${btn('moveMenu', `${icon('move')}Move`, id, 'soft')}
        ${btn('sell', confirmKey === 'sell' + id ? `Confirm sale ${coins(E.animalValue(a))}` : `${icon('coin')}Sell`, id, 'bad')}
      </div>`;
  },

  rename(id) {
    const a = S.animals[id];
    if (!a) return null;
    return `<h2>Rename ${esc(a.name)}</h2><input id="renameInput" maxlength="18" value="${esc(a.name)}" autocomplete="off"><div class="actions">${btn('doRename', 'Save', id, 'go')}</div>`;
  },

  moveMenu(id) {
    const a = S.animals[id];
    if (!a) return null;
    const g = SPECIES[a.species].group;
    const opts = S.plots.map((p, i) => [p, i]).filter(([p, i]) => p && p.kind === 'habitat' && p.group === g && !p.building && i !== a.home);
    return `<h2>Move ${esc(a.name)}</h2><div class="list">${opts.map(([p, i]) => `<div class="lrow"><div class="bicon" style="--c:${GROUPS[g].colour}">${icon('paw')}</div><div><b>${GROUPS[g].name} (plot ${i + 1})</b><small>${E.animalsIn(i).length} of ${E.habitatCap(p)} spaces used</small></div>${btn('doMove', 'Move here', id + ':' + i)}</div>`).join('') || `<p class="note">You have no other ${GROUPS[g].name.toLowerCase()} with space. Build another one from the Farm screen.</p>`}</div>`;
  },

  nursery() {
    const list = E.nursery();
    if (!list.length) return null;
    return `<h2>Nursery</h2><p class="note">Babies born when their habitat was full wait here. Move them into a habitat with space or sell them. If the nursery fills up, new babies go to neighbours for a small fee.</p><div class="list">${list.map(a => animalRow(a)).join('')}</div>`;
  },

  breedPick(idx) {
    const list = E.animalsIn(idx);
    const fem = list.filter(a => a.sex === 'f'), mal = list.filter(a => a.sex === 'm');
    const pairs = E.pairsAvailable(idx);
    let html = `<h2>Choose a pair</h2>`;
    if (!fem.length || !mal.length) return html + `<p class="note">You need at least one adult male and one adult female in this habitat.</p>`;
    html += pairs.length ? `<div class="list">${pairs.map(([f, m]) => pairRow(f, m)).join('')}</div>` : '<p class="note">No pairs are ready right now. Animals must be adults, fed, healthy and rested.</p>';
    const blocked = [];
    for (const f of fem) for (const m of mal) { const err = E.canBreed(f, m); if (err && blocked.length < 6) blocked.push(`<li>${esc(f.name)} and ${esc(m.name)}: ${esc(err)}</li>`); }
    if (blocked.length) html += `<h4>Not ready</h4><ul class="why">${blocked.join('')}</ul>`;
    return html;
  },

  breedWith(id) {
    const a = S.animals[id];
    if (!a) return null;
    const partners = E.animalsIn(a.home).filter(b => b.sex !== a.sex);
    const ok = partners.filter(b => !E.canBreed(a, b));
    let html = `<h2>Breed ${esc(a.name)}</h2>`;
    html += ok.length ? `<div class="list">${ok.map(b => pairRow(a.sex === 'f' ? a : b, a.sex === 'f' ? b : a)).join('')}</div>` : `<p class="note">${partners.length ? esc(E.canBreed(a, partners[0])) : `There is no ${a.sex === 'f' ? 'male' : 'female'} in this habitat.`}</p>`;
    return html;
  },

  confirmBreed(arg) {
    const [fid, mid] = arg.split(':');
    const f = S.animals[fid], m = S.animals[mid];
    if (!f || !m) return null;
    const recipe = f.species !== m.species;
    const chance = Math.round(E.breedChance(f, m) * 100);
    const t = E.breedTime(f, m);
    return `<h2>Start breeding</h2>
      <div class="pairview"><div>${img(f.species, f.mut)}<b>${sexIcon('f')}${esc(f.name)}</b>${starRow(E.stars(f))}</div>${icon('heart', 'big')}<div>${img(m.species, m.mut)}<b>${sexIcon('m')}${esc(m.name)}</b>${starRow(E.stars(m))}</div></div>
      ${recipe ? `<p class="note special">${icon('dna')}A cross pairing. The outcome is uncertain, but something new could hatch.</p>` : ''}
      <div class="facts"><div><small>Success chance</small><b>${chance}%</b></div><div><small>Time</small><b>${dur(t)}</b></div><div><small>Litter</small><b>${recipe ? '1' : SPECIES[f.species].litter.join(' to ')}</b></div></div>
      <p class="note">Happier parents breed more reliably. Babies inherit the average of their parents' genes, with some variation, so pair your best animals to improve the bloodline.</p>
      ${S.items.charm ? `<p class="note good">${icon('sparkle')}A Lucky Charm will be used, boosting mutation chance.</p>` : ''}
      <div class="actions">${btn('startBreed', 'Start', fid + ':' + mid, 'love')}${S.items.tonic ? btn('startBreedTonic', `Use Fertility Tonic (${S.items.tonic})`, fid + ':' + mid, 'soft') : ''}</div>`;
  },

  speciesShop(spId) {
    const sp = SPECIES[spId];
    const habs = S.plots.map((p, i) => [p, i]).filter(([p]) => p && p.kind === 'habitat' && p.group === sp.group && !p.building);
    const locked = S.level < sp.level || S.level < GROUPS[sp.group].unlock;
    let html = speciesHeader(sp);
    if (sp.price == null) return html + `<p class="note special">${icon('dna')}This species cannot be bought. Look for rumours of a secret pairing in the Book.</p>`;
    if (locked) return html + `<p class="note">${icon('lock')}Unlocks at level ${Math.max(sp.level, GROUPS[sp.group].unlock)}.</p>`;
    if (!habs.length) return html + `<p class="note">You need a ${GROUPS[sp.group].name} first.</p>${btn('buildAny', `Build a ${GROUPS[sp.group].name} ${coins(GROUPS[sp.group].cost)}`, 'habitat:' + sp.group, 'go wide')}`;
    html += `<p class="note">Shop animals are adults with ordinary genes (1 to 3 stars). Breed them to raise better ones.</p>`;
    html += habs.map(([p, i]) => {
      const n = E.animalsIn(i).length, cap = E.habitatCap(p);
      return `<div class="lrow"><div class="bicon" style="--c:${GROUPS[sp.group].colour}">${icon('paw')}</div><div><b>${GROUPS[sp.group].name} (plot ${i + 1})</b><small>${n} of ${cap} spaces used</small></div>
        ${n < cap ? `<div class="btnpair">${btn('buy', `${sexIcon('m')}${coins(sp.price)}`, `${spId}:m:${i}`)}${btn('buy', `${sexIcon('f')}${coins(sp.price)}`, `${spId}:f:${i}`)}</div>` : '<span class="chip">Full</span>'}</div>`;
    }).join('');
    return html;
  },

  speciesInfo(spId) {
    const sp = SPECIES[spId];
    const k = S.discovered[spId];
    const muts = S.mutSeen[spId] || {};
    const recipe = RECIPES.find(r => r.result === spId);
    let html = speciesHeader(sp, !k);
    if (k) html += photo(spId);
    html += `<h4>Colour mutations seen</h4><div class="mutgrid">${Object.entries(MUTATIONS).map(([m, d]) => `<div class="${muts[m] ? 'on' : ''}">${muts[m] ? img(spId, m) : `<div class="mq">?</div>`}<small>${muts[m] ? d.name : 'Unknown'}</small></div>`).join('')}</div>`;
    if (recipe) html += `<p class="note special">${icon('dna')}${S.recipesFound[spId] ? `Bred from a ${SPECIES[recipe.a].name} and a ${SPECIES[recipe.b].name}.` : `Breed-only. Rumour has it: ${recipe.hint}`}</p>`;
    const owned = Object.values(S.animals).filter(a => a.species === spId).length;
    if (owned) html += `<p class="note">You own ${owned}.</p>`;
    return html;
  },

  orderFill(oid) {
    const o = S.orders.find(x => x.id === oid);
    if (!o) return null;
    const ok = Object.values(S.animals).filter(a => E.meetsOrder(a, o));
    const near = Object.values(S.animals).filter(a => a.species === o.req.species && !E.meetsOrder(a, o));
    let html = `<h2>${esc(o.who)}</h2><p>Wants a ${SPECIES[o.req.species].name} with at least ${o.req.stars} star${o.req.stars > 1 ? 's' : ''}${o.req.sex ? `, ${o.req.sex === 'm' ? 'male' : 'female'}` : ''}${o.req.trait ? `, with the ${TRAITS[o.req.trait].name} trait` : ''}${o.req.mut ? `, ${o.req.mut === 'any' ? 'with any colour mutation' : 'with the ' + MUTATIONS[o.req.mut].name + ' mutation'}` : ''}.</p>`;
    html += ok.length ? `<div class="list">${ok.map(a => animalRow(a, 'animal', a.id,`<span class="give">${btn('doFill', 'Give', o.id + ':' + a.id, 'go tiny')}</span>`)).join('')}</div>` : `<p class="note">None of your animals match yet. Buy or breed one before the timer runs out.</p>`;
    if (near.length) html += `<h4>Close, but not quite</h4><div class="list dim">${near.slice(0, 4).map(a => animalRow(a)).join('')}</div>`;
    if (SPECIES[o.req.species].price && !ok.length) html += btn('speciesShop', `Buy a ${SPECIES[o.req.species].name}`, o.req.species, 'soft wide');
    return html;
  },

  showEnter() {
    if (!S.show) return null;
    const list = Object.values(S.animals).filter(a => SPECIES[a.species].group === S.show.group && E.isAdult(a) && !a.sick).sort((a, b) => E.showScore(b) - E.showScore(a));
    return `<h2>Choose an entrant</h2><p class="note">Entry fee ${coins(S.show.fee)}. The estimated score is shown for each animal.</p><div class="list">${list.map(a => animalRow(a, 'enterShow', a.id, `<span class="score">${Math.round(E.showScore(a))}</span>`)).join('') || `<p class="note">You have no healthy adult ${GROUPS[S.show.group].plural.toLowerCase()}.</p>`}</div>`;
  },

  litter({ babies, recipe, mum, dad }) {
    return `<div class="celebrate">${icon('sparkle', 'huge spin')}<h2>${recipe ? 'A new species!' : babies.length > 1 ? `${babies.length} babies born` : 'A baby is born'}</h2>
      <p>${esc(mum.name)} and ${esc(dad.name)} ${recipe ? `produced something incredible: a ${SPECIES[babies[0]?.species]?.name}.` : 'have a new family.'}</p>
      <div class="babies">${babies.map(b => `<div class="baby ${b.mut ? 'has-mut glow-' + b.mut : ''}" data-act="animal" data-arg="${b.id}">${liveCanvas(b.species, b.mut, false)}<b>${sexIcon(b.sex)}${esc(b.name)}</b>${starRow(E.stars(b))}${mutChip(b.mut)}${traitChip(b.trait)}${b.home === -1 ? '<small class="bad">In nursery</small>' : ''}</div>`).join('')}</div>
      ${btn('closeModal', 'Lovely', '', 'go wide')}</div>`;
  },

  levelup({ level, coins: c, gems: g }) {
    const unlocked = [
      ...SPECIES_LIST.filter(s => s.level === level && s.price),
      ...Object.values(GROUPS).filter(x => x.unlock === level),
      ...Object.values(BUILDINGS).filter(x => x.unlock === level),
      ...Object.values(STAFF).filter(x => x.unlock === level),
    ];
    return `<div class="celebrate">${icon('trophy', 'huge spin')}<h2>Level ${level}</h2><p>${coins(c)} ${gems(g)}</p>
      ${unlocked.length ? `<h4>Now available</h4><div class="unlocks">${unlocked.map(u => u.id ? `<div>${img(u.id)}<small>${u.name}</small></div>` : `<div><div class="bicon">${icon('hammer')}</div><small>${u.name}</small></div>`).join('')}</div>` : ''}
      ${btn('closeModal', 'Great', '', 'go wide')}</div>`;
  },

  showresult(r) {
    return `<div class="celebrate">${icon('ribbon', 'huge')}<h2>${r.place <= 3 ? `${ordinal(r.place)} place!` : `${ordinal(r.place)} place`}</h2><p>${esc(r.animal)} competed in the ${GROUPS[r.group].plural} Championship.</p>
      <div class="board">${r.board.map((b, i) => `<div class="${b.you ? 'you' : ''}"><span>${i + 1}. ${b.you ? esc(r.animal) + ' (you)' : b.name}</span><b>${b.score}</b></div>`).join('')}</div>
      ${btn('closeModal', 'Continue', '', 'go wide')}</div>`;
  },

  offline(r) {
    return `<div class="celebrate">${icon('sun', 'huge')}<h2>Welcome back</h2><p>You were away for ${dur(r.away)}.</p>
      ${r.babies ? `<p>${r.babies} baby animal${r.babies > 1 ? 's were' : ' was'} born while you were gone.</p>` : ''}
      <p class="note">Your farm rests while you are away. Hunger, happiness and cleanliness only drift down a little, and nobody gets sick. Breeding, growing and feed mills keep going.</p>${btn('closeModal', "Let's go", '', 'go wide')}</div>`;
  },

  removed(a) {
    return `<div class="celebrate">${icon('shield', 'huge')}<h2>Welfare inspection</h2><p>${esc(a.name)} the ${SPECIES[a.species].name} was badly neglected and has been taken to a rescue shelter. Your reputation has dropped.</p><p class="note">Keep animals fed, their habitats clean, and treat sickness quickly.</p>${btn('closeModal', 'I will do better', '', 'go wide')}</div>`;
  },

  intro() {
    return `<div class="intro"><h2>Welcome to Nuggs Farm</h2>
      <p>You have inherited a patch of land on the Mid North Coast and a dream: to become the most famous animal breeder in the country.</p>
      <ol><li><b>Build habitats</b> on empty plots. Each kind of animal needs its own habitat.</li>
      <li><b>Buy a male and a female</b> of the same species, then pair them to breed.</li>
      <li><b>Keep them happy.</b> Feed them, clean their habitat and treat sickness. Pet them, play with them and spoil them with snacks. Neglect means a visit from the welfare inspector.</li>
      <li><b>Improve your bloodlines.</b> Babies inherit their parents' genes. Breed your best animals to reach five stars.</li>
      <li><b>Hunt for rare colour mutations</b> like Golden, Frost, Cosmic and the legendary Rainbow.</li>
      <li><b>Discover secret pairings</b> that create species you cannot buy.</li>
      <li><b>Fill orders, win shows</b> and level up to unlock 68 species.</li></ol>
      ${btn('closeModal', 'Start farming', '', 'go wide')}</div>`;
  },

  saveCode() {
    return `<h2>Save code</h2><p class="note">Copy this code somewhere safe to back up your farm, or paste a code from another device and tap Load.</p>
      <textarea id="saveText" rows="5" spellcheck="false">${E.exportSave()}</textarea>
      <div class="actions">${btn('copySave', 'Copy', '', 'soft')}${btn('loadSave', 'Load code', '', 'warn')}</div>`;
  },

  credits() {
    return `<h2>Photo credits</h2><p class="note">Animal photos come from Wikimedia Commons and are used under their free licences. Tap a name to view the original file and full licence.</p>
      <div class="credits">${SPECIES_LIST.map(sp => { const c = CREDITS[sp.id]; return c ? `<a href="${esc(c.source)}" target="_blank" rel="noopener"><b>${sp.name}</b><small>${esc(c.author)} · ${esc(c.licence)}</small></a>` : ''; }).join('')}</div>`;
  },

  update(info) {
    return `<div class="celebrate">${icon('download', 'huge')}<h2>Update available</h2><p>Version ${esc(info.version)} is ready. You have ${APP_VERSION}.</p>
      ${info.notes ? `<div class="notes">${esc(info.notes).replace(/\n/g, '<br>')}</div>` : ''}
      <p class="note">Your farm is saved on this device and will carry over.</p>
      ${btn('doUpdate', info.native ? 'Download update' : 'Reload now', '', 'go wide')}${btn('closeModal', 'Later', '', 'ghost wide')}</div>`;
  },

  construction(i) {
    const p = S.plots[i];
    if (!p || !p.building) return null;
    const name = p.kind === 'habitat' ? GROUPS[p.group].name : BUILDINGS[p.type].name;
    const total = (p.kind === 'habitat' ? GROUPS[p.group].build : BUILDINGS[p.type].build) * 1000;
    return `<h2>Building a ${name}</h2>${prog(p.building - total, p.building)}<p>Finishes in ${timer(p.building)}.</p>${btn('rushBuild', `Finish now ${icon('gem')}${E.gemCost((p.building - Date.now()) / 1000)}`, i, 'gem wide')}`;
  },

  settings() {
    const q = S.settings.quality || 'high';
    return `<h2>Settings</h2><div class="list">
      <div class="lrow">${icon('sound', 'big')}<div><b>Sound effects</b><small>Short synthesised sounds for actions.</small></div>${btn('toggleSound', S.settings.sound ? 'On' : 'Off', '', S.settings.sound ? 'go' : 'soft')}</div>
      <div class="lrow">${icon('sparkle', 'big')}<div><b>Graphics</b><small>Low turns off lighting, shading and ambient effects for older phones.</small></div><div class="btnpair">${btn('quality', 'High', 'high', q === 'high' ? 'go' : 'soft')}${btn('quality', 'Low', 'low', q === 'low' ? 'go' : 'soft')}</div></div>
      <div class="lrow">${icon('info', 'big')}<div><b>How to play</b></div>${btn('help', 'Open', '', 'soft')}</div>
      <div class="lrow">${icon('refresh', 'big')}<div><b>Check for updates</b><small>Version ${APP_VERSION}</small></div>${btn('checkUpdate', 'Check', '', 'soft')}</div>
      <div class="lrow">${icon('download', 'big')}<div><b>Back up or move your farm</b></div>${btn('saveCode', 'Open', '', 'soft')}</div>
      <div class="lrow">${icon('book', 'big')}<div><b>Photo credits</b></div>${btn('credits', 'View', '', 'soft')}</div>
    </div>`;
  },

  message({ title, text }) { return `<h2>${esc(title)}</h2><p>${esc(text)}</p>${btn('closeModal', 'OK', '', 'go wide')}`; },
};

function speciesHeader(sp, hide) {
  const secretUnknown = hide && sp.price == null;
  return `<div class="hero">${img(sp.id, null, 'heroimg ' + (hide ? 'silhouette' : ''))}${tierBadge(sp.tier)}</div>
    <h2>${secretUnknown ? '???' : sp.name}</h2>
    <p>${secretUnknown ? 'A mysterious species nobody has bred yet.' : sp.desc}</p>
    <div class="facts"><div><small>Habitat</small><b>${GROUPS[sp.group].name}</b></div><div><small>Breeding</small><b>${dur(sp.breed)}</b></div><div><small>Grows up</small><b>${dur(sp.grow)}</b></div><div><small>Litter</small><b>${sp.litter.join(' to ')}</b></div><div><small>Eats</small><b>${sp.feed} feed</b></div><div><small>Unlocks</small><b>Lv ${Math.max(sp.level, GROUPS[sp.group].unlock)}</b></div></div>`;
}

function pairRow(f, m) {
  const chance = Math.round(E.breedChance(f, m) * 100);
  const cross = f.species !== m.species;
  return `<div class="pair" data-act="confirmBreed" data-arg="${f.id}:${m.id}">
    <div>${img(f.species, f.mut, 'mini')}<span>${sexIcon('f')}${esc(f.name)} ${starRow(E.stars(f))}</span></div>
    <div>${img(m.species, m.mut, 'mini')}<span>${sexIcon('m')}${esc(m.name)} ${starRow(E.stars(m))}</span></div>
    <div class="pmeta">${cross ? `<span class="chip special">${icon('dna')}Cross</span>` : ''}<b>${chance}%</b><small>${dur(E.breedTime(f, m))}</small></div></div>`;
}

// ---------- actions ----------
const ACTIONS = {
  tab: a => { tab = a; if (a === 'farm') farmMode = 'world'; closeAll(); render(); document.getElementById('view').scrollTop = 0; },
  farmMode: m => { farmMode = m; render(); },
  zoomIn: () => world.zoomBy(1.2),
  zoomOut: () => world.zoomBy(1 / 1.2),
  overview: () => world.overview(),
  interact: () => world.interact(),
  closeModal: () => closeModal(),
  toggleSound: () => { S.settings.sound = !S.settings.sound; setSound(S.settings.sound); render(); },
  settings: () => openModal('settings'),
  quality: q => { S.settings.quality = q; world.setQuality(q); E.save(); renderModal(); },
  feedAll: () => E.feedAll(),
  claimGoal: () => E.claimGoal(),
  claimDaily: () => E.claimDaily(),
  nursery: () => openModal('nursery'),
  buildMenu: i => openModal('buildMenu', +i),
  build: arg => { const [i, kind, id] = arg.split(':'); if (kind === 'habitat' ? E.buildHabitat(+i, id) : E.buildBuilding(+i, id)) closeAll(); },
  buildAny: arg => {
    const [kind, id] = arg.split(':');
    const i = S.plots.findIndex((p, k) => !p && k < S.plotsOwned);
    if (i < 0) { E.notify('No empty plots. Clear more land or demolish something.', 'bad'); return; }
    if (kind === 'habitat' ? E.buildHabitat(i, id) : E.buildBuilding(i, id)) { closeAll(); tab = 'farm'; render(); }
  },
  rushBuild: i => { E.rushBuild(+i); if (!S.plots[+i]?.building) closeAll(); },
  buyLand: () => E.buyLand(),
  habitat: i => openModal('habitat', +i),
  building: i => openModal('building', +i),
  collect: i => E.collectMill(+i),
  upgradeMill: i => E.upgradeMill(+i),
  feedHab: i => E.feedHabitat(+i),
  clean: i => E.cleanHabitat(+i),
  upgrade: i => E.upgradeHabitat(+i),
  demolish: i => { if (confirmKey === 'demolish' + i) { E.demolish(+i); confirmKey = null; closeAll(); } else { confirmKey = 'demolish' + i; renderModal(); } },
  breedPick: i => openModal('breedPick', +i),
  breedWith: id => openModal('breedWith', id),
  confirmBreed: arg => openModal('confirmBreed', arg),
  startBreed: arg => { const [f, m] = arg.split(':'); if (E.startBreeding(f, m, false)) { modalStack = modalStack.filter(x => !['confirmBreed', 'breedPick', 'breedWith'].includes(x.kind)); renderModal(); } },
  startBreedTonic: arg => { const [f, m] = arg.split(':'); if (E.startBreeding(f, m, true)) { modalStack = modalStack.filter(x => !['confirmBreed', 'breedPick', 'breedWith'].includes(x.kind)); renderModal(); } },
  shopFor: g => { tab = 'shop'; shopTab = 'animals'; shopGroup = g; closeAll(); render(); },
  shopTab: t => { shopTab = t; render(); },
  shopGroup: g => { shopGroup = g; render(); },
  bookGroup: g => { bookGroup = g; render(); },
  speciesShop: id => openModal('speciesShop', id),
  speciesInfo: id => openModal('speciesInfo', id),
  buy: arg => { const [sp, sex, i] = arg.split(':'); E.buyAnimal(sp, sex, +i); },
  buyFeed: n => E.buyFeed(+n),
  buyItem: id => E.buyItem(id),
  buyCoins: () => E.buyCoinsWithGems(),
  hire: id => E.hireStaff(id),
  animal: id => openModal('animal', id),
  feed: id => E.feedAnimal(id),
  pet: id => E.petAnimal(id),
  play: id => E.playWith(id),
  snack: id => E.giveSnack(id),
  playtime: i => E.playtime(+i),
  buySnacks: () => E.buySnacks(),
  treat: id => E.treatAnimal(id),
  rushBreed: id => E.rushBreeding(id),
  rushGrow: id => E.rushGrowth(id),
  sell: id => { if (confirmKey === 'sell' + id) { confirmKey = null; E.sellAnimal(id); closeModal(); } else { confirmKey = 'sell' + id; renderModal(); } },
  rename: id => { openModal('rename', id); setTimeout(() => { const el = $('#renameInput'); if (el) { el.focus(); el.select(); } }, 30); },
  doRename: id => { E.renameAnimal(id, $('#renameInput').value); closeModal(); },
  moveMenu: id => openModal('moveMenu', id),
  doMove: arg => { const [id, i] = arg.split(':'); E.moveAnimal(id, +i); closeModal(); },
  fillOrder: id => openModal('orderFill', id),
  doFill: arg => { const [o, a] = arg.split(':'); E.fillOrder(o, a); closeAll(); },
  dismissOrder: id => E.dismissOrder(id),
  showEnter: () => openModal('showEnter'),
  enterShow: id => { E.enterShow(id); closeAll(); },
  eventAction: () => E.eventAction(),
  help: () => openModal('intro'),
  credits: () => openModal('credits'),
  saveCode: () => openModal('saveCode'),
  copySave: () => { const t = $('#saveText'); t.select(); navigator.clipboard?.writeText(t.value).then(() => E.notify('Save code copied.', 'good'), () => document.execCommand('copy')); },
  loadSave: () => { try { E.importSave($('#saveText').value); closeAll(); E.notify('Farm loaded.', 'good'); } catch (e) { E.notify(e.message || 'That code did not work.', 'bad'); } },
  reset: () => { if (confirmKey === 'reset') { confirmKey = null; E.resetGame(); tab = 'farm'; render(); openModal('intro'); } else { confirmKey = 'reset'; render(); } },
  checkUpdate: () => window.dispatchEvent(new CustomEvent('nf-check-update', { detail: { manual: true } })),
  doUpdate: () => window.dispatchEvent(new CustomEvent('nf-do-update')),
};

export function showModal(kind, arg) { openModal(kind, arg); }
export function goTab(t) { ACTIONS.tab(t); }

// ---------- live updates ----------
function signature() {
  const t = Date.now();
  const parts = [tab, S.level, S.goal, S.plotsOwned, S.event?.id, S.orders.map(o => o.id).join(), S.show?.entry, S.show?.group, E.dailyAvailable(), S.items.charm, S.items.snack];
  for (const p of S.plots) parts.push(p ? (p.building ? 'b' : p.kind[0] + p.lvl + (p.clean < 30 ? 'd' : '') + (E.playtimeWait(p) ? 'p' : '')) : '-');
  for (const a of Object.values(S.animals)) parts.push(a.id + a.home + (E.isAdult(a) ? 'A' : 'B') + (a.sick ? 'S' : '') + (a.breeding ? 'L' : '') + (a.restUntil > t ? 'R' : '') + (a.hunger < 30 ? 'H' : '') + (a.happy < 30 ? 'U' : '') + (E.playWait(a) ? 'P' : ''));
  return parts.join('|');
}

function liveUpdate() {
  updateHUD();
  const sig = signature();
  if (sig !== lastSig && !document.activeElement?.matches('input, textarea')) { render(); return; }
  const t = Date.now();
  document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = dur((+el.dataset.timer - t) / 1000); });
  document.querySelectorAll('[data-prog]').forEach(el => { const [a, b] = el.dataset.prog.split('|').map(Number); el.style.width = pct(a, b) + '%'; });
  document.querySelectorAll('[data-bar]').forEach(el => {
    const [kind, id] = el.dataset.bar.split('|');
    let v;
    if (kind === 'clean') v = S.plots[+id.slice(1)]?.clean;
    else v = S.animals[id]?.[kind];
    if (v != null) { el.style.width = v + '%'; el.parentElement.classList.toggle('low', v < 30); }
  });
  document.querySelectorAll('[data-gauge]').forEach(el => { const [k, id] = el.dataset.gauge.split('|'); const v = S.animals[id]?.[k]; if (v != null) { el.style.setProperty('--v', Math.round(v)); el.querySelector('b').textContent = Math.round(v) + '%'; el.classList.toggle('low', v < 30); } });
  document.querySelectorAll('[data-mill]').forEach(el => { const p = S.plots[+el.dataset.mill]; if (p) el.textContent = Math.floor(p.stock); });
}

// ---------- toasts & floating rewards ----------
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `${icon(kind === 'good' ? 'sparkle' : kind === 'bad' ? 'info' : kind === 'warn' ? 'sun' : 'paw')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  if (kind === 'bad') sfx('bad');
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
  const all = $('#toasts').children;
  if (all.length > 3) all[0].remove();
}

function floatReward(r) {
  const items = [];
  if (r.coins > 0) items.push(['#h-coins', '+' + fmt(r.coins)]);
  if (r.gems > 0) items.push(['#h-gems', '+' + r.gems]);
  if (r.feed > 0) items.push(['#h-feed', '+' + r.feed]);
  for (const [sel, txt] of items) {
    const anchor = $(sel); if (!anchor) continue;
    const rect = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'floaty'; el.textContent = txt;
    el.style.left = rect.left + rect.width / 2 + 'px'; el.style.top = rect.bottom + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

// ---------- init ----------
export function init() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = ACTIONS[el.dataset.act];
    if (!act) return;
    e.stopPropagation();
    if (el.dataset.act !== 'closeModal') sfx('tap');
    act(el.dataset.arg);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') backButton();
    if (e.key === 'Enter' && e.target.id === 'renameInput') ACTIONS.doRename(modalStack[modalStack.length - 1].arg);
  });

  E.on((type, d) => {
    switch (type) {
      case 'change': render(); break;
      case 'tick': liveUpdate(); break;
      case 'toast': toast(d.msg, d.kind); break;
      case 'sfx': sfx(d); break;
      case 'reward': floatReward(d); updateHUD(); break;
      case 'levelup': sfx('level'); openModal('levelup', d); confetti(1.2); break;
      case 'litter': sfx(d.recipe || d.babies.some(b => b.mut) ? 'rare' : 'birth'); openModal('litter', d); if (d.recipe || d.babies.some(b => b.mut)) confetti(1); break;
      case 'discover': if (S.stats.litters || Object.keys(S.discovered).length > 1) toast(`New species discovered: ${SPECIES[d.species].name}`, 'good'); break;
      case 'achievement': sfx('fanfare'); toast(`Achievement unlocked: ${d.name}. +${d.gems} gems`, 'good'); break;
      case 'showresult': sfx(d.place <= 3 ? 'fanfare' : 'bad'); openModal('showresult', d); if (d.place === 1) confetti(1); break;
      case 'removed': openModal('removed', d); break;
      case 'built': toast(`${d.p.kind === 'habitat' ? GROUPS[d.p.group].name : BUILDINGS[d.p.type].name} is finished.`, 'good'); sfx('collect'); break;
      case 'neworder': toast(`New order: ${SPECIES[d.req.species].name}`, 'info'); break;
      case 'event': toast(E.EVENTS[d.id].name + '!', 'warn'); break;
      case 'breedfail': break;
    }
  });
  setSound(S.settings.sound);
  render();
}
