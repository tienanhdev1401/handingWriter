// Tạo public/data/s2t.json: bảng giản thể → phồn thể (OpenCC STCharacters),
// chỉ giữ cặp mà cả hai ký tự đều có trong graphics.txt.
// Chạy: node scripts/build-s2t.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/STCharacters.txt';
const have = new Set();
for (const line of readFileSync('public/data/graphics.txt', 'utf8').split('\n')) {
  const m = line.match(/"character":"(.)"/u);
  if (m) have.add(m[1]);
}

const map = {};
for (const line of (await (await fetch(SRC)).text()).split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [s, v] = line.split('\t');
  const t = v.trim().split(' ').find((c) => have.has(c)); // ponytail: lấy biến thể đầu tiên OpenCC gợi ý (发→發, không phải 髮)
  if (have.has(s) && t && t !== s) map[s] = t;
}
writeFileSync('public/data/s2t.json', JSON.stringify(map));
console.log(`s2t.json: ${Object.keys(map).length} cặp`);
