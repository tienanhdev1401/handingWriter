// Kiểm tra nội suy median theo độ dài cung. Chạy: node scripts/check-median.mjs
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const out = mkdtempSync(join(tmpdir(), 'median-check-'));
execSync(`npx tsc src/utils/canvas.ts --outDir "${out}" --module esnext --target es2022 --moduleResolution bundler --skipLibCheck --ignoreConfig`, { stdio: 'inherit' });
const { interpolateMedian, medianLength } = await import(pathToFileURL(join(out, 'utils', 'canvas.js')).href);

// Điểm cách không đều: 0→10 (10), 10→100 (90)
const m = [[0, 0], [10, 0], [100, 0]];
assert.equal(medianLength(m), 100);
assert.deepEqual(interpolateMedian(m, 0.05), [{ x: 0, y: 0 }, { x: 5, y: 0 }]);          // trước điểm giữa
assert.deepEqual(interpolateMedian(m, 0.5), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 50, y: 0 }]); // nửa đường theo khoảng cách, không phải theo chỉ số
assert.deepEqual(interpolateMedian(m, 1), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 100, y: 0 }]);
assert.deepEqual(interpolateMedian(m, 0), [{ x: 0, y: 0 }]);
// Tốc độ đều: đầu bút đi quãng bằng nhau mỗi bước
const tip = (p) => interpolateMedian(m, p).at(-1).x;
for (let i = 1; i <= 10; i++) assert.ok(Math.abs(tip(i / 10) - tip((i - 1) / 10) - 10) < 1e-9);

rmSync(out, { recursive: true, force: true });
console.log('check-median: OK');
