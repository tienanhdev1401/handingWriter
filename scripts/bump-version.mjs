// Tăng phiên bản ở MỘT chỗ (package.json) rồi đồng bộ sang Android.
//   node scripts/bump-version.mjs            → tăng patch (1.8.0 → 1.8.1)
//   node scripts/bump-version.mjs minor|major|1.9.0
// versionCode Android = major*10000 + minor*100 + patch (1.8.1 → 10801), luôn tăng dần.
import { readFileSync, writeFileSync } from 'node:fs';

const arg = process.argv[2] ?? 'patch';
const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
let [ma, mi, pa] = pkg.version.split('.').map(Number);
if (/^\d+\.\d+\.\d+$/.test(arg)) [ma, mi, pa] = arg.split('.').map(Number);
else if (arg === 'major') { ma++; mi = 0; pa = 0; }
else if (arg === 'minor') { mi++; pa = 0; }
else pa++;
const version = `${ma}.${mi}.${pa}`;
const code = ma * 10000 + mi * 100 + pa;

pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const lockPath = 'package-lock.json';
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  lock.version = version; if (lock.packages?.['']) lock.packages[''].version = version;
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
} catch { /* không có lock */ }

const gradlePath = 'android/app/build.gradle';
const gradle = readFileSync(gradlePath, 'utf8')
  .replace(/versionCode \d+/, `versionCode ${code}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`);
writeFileSync(gradlePath, gradle);
console.log(`version → ${version} (android versionCode ${code})`);
