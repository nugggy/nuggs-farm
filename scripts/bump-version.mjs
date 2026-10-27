// Sets the app version everywhere it lives.
// Usage: node scripts/bump-version.mjs 1.0.1 "What changed in this release"
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [version, notes = ''] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Usage: node scripts/bump-version.mjs <major.minor.patch> "release notes"');
  process.exit(1);
}

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const vPath = join(root, 'www/js/version.js');
writeFileSync(vPath, readFileSync(vPath, 'utf8').replace(/APP_VERSION = '[^']*'/, `APP_VERSION = '${version}'`));

writeFileSync(join(root, 'www/version.json'), JSON.stringify({ version, notes }) + '\n');
console.log(`Version set to ${version}. Commit, then tag with: git tag v${version} && git push --tags`);
