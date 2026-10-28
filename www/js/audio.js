// Small synthesised sound effects using the Web Audio API, so no audio files are needed.
let ctx = null;
let enabled = true;
export const setSound = v => { enabled = v; };

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, len, type = 'sine', vol = 0.18, slide = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + len + 0.05);
}

function noise(start, len, vol = 0.12, hp = 1200) {
  const c = ac(); if (!c) return;
  const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.buffer = buf; s.connect(f).connect(g).connect(c.destination);
  s.start(c.currentTime + start);
}

const SFX = {
  tap:     () => tone(660, 0, 0.06, 'triangle', 0.08),
  buy:     () => { tone(523, 0, 0.1, 'triangle'); tone(784, 0.08, 0.14, 'triangle'); },
  coins:   () => { tone(988, 0, 0.08, 'square', 0.06); tone(1319, 0.07, 0.18, 'square', 0.06); },
  feed:    () => { noise(0, 0.12, 0.08, 2500); tone(330, 0.05, 0.12, 'sine', 0.1, 120); },
  pet:     () => { tone(587, 0, 0.12, 'sine', 0.12, 200); tone(880, 0.1, 0.16, 'sine', 0.1); },
  play:    () => { [523, 784, 659, 1047].forEach((f, i) => tone(f, i * 0.07, 0.12, 'triangle', 0.1)); },
  heal:    () => { [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.18, 'sine', 0.12)); },
  clean:   () => { noise(0, 0.25, 0.1, 3500); noise(0.15, 0.2, 0.08, 4500); },
  collect: () => { [440, 554, 659, 880].forEach((f, i) => tone(f, i * 0.05, 0.12, 'triangle', 0.1)); },
  build:   () => { noise(0, 0.06, 0.2, 400); noise(0.14, 0.06, 0.2, 400); tone(196, 0.28, 0.2, 'triangle', 0.12); },
  love:    () => { tone(659, 0, 0.18, 'sine', 0.12, 80); tone(880, 0.14, 0.24, 'sine', 0.12, 60); },
  birth:   () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.22, 'triangle', 0.12)); },
  rare:    () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, i * 0.09, 0.35, 'sine', 0.12)); noise(0.3, 0.5, 0.05, 6000); },
  fanfare: () => { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(([f, t]) => tone(f, t, 0.3, 'square', 0.06)); },
  level:   () => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.35, 'square', 0.07)); },
  alert:   () => { tone(880, 0, 0.12, 'square', 0.06); tone(660, 0.15, 0.18, 'square', 0.06); },
  bad:     () => { tone(220, 0, 0.25, 'sawtooth', 0.06, -60); },
  whoosh:  () => noise(0, 0.35, 0.12, 800),
};

export function sfx(name) {
  if (!enabled || !SFX[name]) return;
  try { SFX[name](); } catch { /* audio is optional */ }
}
