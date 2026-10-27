// Builds the app icon from the Blue-and-gold Macaw photo.
// Usage: node scripts/make-icon.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const size = 1024;
const photo = await sharp(join(root, 'www/img/animals/bluegold.jpg'))
  .resize(780, 780, { fit: 'cover', position: 'attention' })
  .composite([{ input: Buffer.from(`<svg width="780" height="780"><circle cx="390" cy="390" r="390" fill="#fff"/></svg>`), blend: 'dest-in' }])
  .png().toBuffer();

const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc06a"/><stop offset="1" stop-color="#3a7d33"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <circle cx="512" cy="512" r="410" fill="#fff6dc"/>
  <circle cx="512" cy="512" r="410" fill="none" stroke="#a86f3d" stroke-width="22"/>
</svg>`);

mkdirSync(join(root, 'assets'), { recursive: true });
const icon = await sharp(bg).composite([{ input: photo, left: 122, top: 122 }]).png().toBuffer();
await sharp(icon).toFile(join(root, 'assets/icon-only.png'));
await sharp(icon).resize(192).toFile(join(root, 'www/img/icon.png'));
await sharp(icon).resize(512).toFile(join(root, 'www/img/icon-512.png'));
// Adaptive icon layers for Android
await sharp(photo).resize(560).extend({ top: 232, bottom: 232, left: 232, right: 232, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(root, 'assets/icon-foreground.png'));
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#4f9d45"/></svg>`)).png().toFile(join(root, 'assets/icon-background.png'));
// Splash screen
const splash = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="2732" height="2732" fill="#4f9d45"/></svg>`);
await sharp(splash).composite([{ input: await sharp(icon).resize(800).toBuffer(), gravity: 'center' }]).png().toFile(join(root, 'assets/splash.png'));
console.log('Icons written');
