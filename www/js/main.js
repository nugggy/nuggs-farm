// Entry point: loads the save, runs the game loop and checks the update channel.
import * as E from './engine.js';
import * as UI from './ui.js';
import { createWorld } from './world.js';
import { APP_VERSION, RELEASES_API, RELEASES_PAGE } from './version.js';

const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());

const hadSave = E.load();
const away = hadSave ? E.catchUp() : null;
const world = createWorld(document.getElementById('world'), {
  habitat: i => UI.showModal('habitat', i),
  building: i => UI.showModal('building', i),
  build: i => UI.showModal('buildMenu', i),
  rushBuild: i => UI.showModal('construction', i),
  buyLand: () => E.buyLand(),
  collect: i => E.collectMill(i),
  animal: id => UI.showModal('animal', id),
  house: () => UI.goTab('more'),
  prompt: label => UI.setPrompt(label),
  modalOpen: () => UI.modalOpen(),
});
UI.attachWorld(world);
world.setQuality(E.S.settings.quality || 'high');
window.addEventListener('resize', () => world.resize());
UI.init();

if (!E.S.seenIntro) { E.S.seenIntro = true; UI.showModal('intro'); }
else if (away && away.away > 120) UI.showModal('offline', away);

// While hidden (app in the background, screen off, tab switched) the live loop stops and the
// time is simulated on return with the gentler away rules instead.
setInterval(() => { if (!document.hidden) E.tick(); }, 1000);
setInterval(() => E.save(), 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) E.goAway();
  else { const r = E.catchUp(); if (r && r.away > 120) UI.showModal('offline', r); }
});
window.addEventListener('pagehide', () => E.goAway());

// Android hardware back button closes modals first.
if (isNative && Cap.Plugins && Cap.Plugins.App) {
  Cap.Plugins.App.addListener('backButton', () => { if (!UI.backButton()) Cap.Plugins.App.minimizeApp?.(); });
}

// ---------- update channel ----------
// Native builds compare against the latest GitHub Release and offer the new APK.
// Web builds compare against version.json on the server and offer a reload.
const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number), pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
};
let pendingUpdate = null;

async function checkForUpdate(manual) {
  try {
    let info = null;
    if (isNative) {
      const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (!res.ok) throw new Error('Release check failed: ' + res.status);
      const rel = await res.json();
      const apk = (rel.assets || []).find(a => a.name.endsWith('.apk'));
      if (newer(rel.tag_name, APP_VERSION)) info = { version: rel.tag_name.replace(/^v/, ''), notes: (rel.body || '').slice(0, 600), url: apk ? apk.browser_download_url : RELEASES_PAGE, native: true };
    } else if (location.protocol.startsWith('http')) {
      const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Version check failed: ' + res.status);
      const v = await res.json();
      if (newer(v.version, APP_VERSION)) info = { version: v.version, notes: v.notes || '', native: false };
    }
    if (info) { pendingUpdate = info; UI.showModal('update', info); }
    else if (manual) UI.showModal('message', { title: 'Up to date', text: `You have the latest version (${APP_VERSION}).` });
  } catch (err) {
    console.warn(err);
    if (manual) UI.showModal('message', { title: 'Could not check', text: 'Could not reach the update server. Check your internet connection and try again.' });
  }
}

window.addEventListener('nf-check-update', e => checkForUpdate(e.detail && e.detail.manual));
window.addEventListener('nf-do-update', () => {
  if (!pendingUpdate) return;
  E.save();
  if (pendingUpdate.native) {
    const Browser = Cap.Plugins && Cap.Plugins.Browser;
    if (Browser) Browser.open({ url: pendingUpdate.url });
    else window.open(pendingUpdate.url, '_system');
  } else {
    location.reload();
  }
});

setTimeout(() => checkForUpdate(false), 2500);

// Fade out the loading screen once fonts are ready and the first frame is drawn.
const splash = document.getElementById('splash');
Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]).then(() => {
  requestAnimationFrame(() => { splash.classList.add('done'); setTimeout(() => splash.remove(), 600); });
});
