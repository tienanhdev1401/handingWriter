import type { WordInput } from './store';

// Dữ liệu offline trong public/data:
//   dict.json  — rút gọn từ Make Me a Hanzi dictionary.txt: { "学": ["xué", "learning, ..."] } (có cả phồn thể)
//   words.json — từ ≥2 chữ từ complete-hsk-vocabulary, khoá cả giản lẫn phồn: { "下边": ["xià bian","under"], "下邊": ... }
//   t2s.json   — phồn/dị thể → giản thể theo từng chữ: { "邊": "边" }, dùng khi khoá phồn thể không có sẵn
//   hsk.json   — chữ đơn HSK 1–3 (bản 2012) có dữ liệu nét: { "1": [["爱","ài","to love"], ...] }
type Entry = [pinyin: string, meaning: string];
type HskRow = [char: string, pinyin: string, meaning: string];
type Table = Record<string, Entry>;

const getJson = <T>(url: string, fallback: T): Promise<T> =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : fallback)).catch(() => fallback);
const get = (m: Table, k: string): Entry | undefined => m[k];

/** Chữ tương thích (U+F900…, vd. 說 dán từ nguồn Hàn/Nhật) → chữ thống nhất, để tra từ điển và dữ liệu nét. */
export const normalizeHan = (s: string) => s.normalize('NFC');
/** Bỏ dấu thanh và dấu tiếng Việt để tìm không dấu: 'huǒ' → 'huo', 'bạn bè' → 'ban be'. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let dict: Promise<Table> | null = null;
let words: Promise<Table> | null = null;
let t2s: Promise<Record<string, string>> | null = null;
const loadDict = () => (dict ??= getJson<Table>('/data/dict.json', {}));
const loadWords = () => (words ??= getJson<Table>('/data/words.json', {}));
const loadT2s = () => (t2s ??= getJson<Record<string, string>>('/data/t2s.json', {}));

/**
 * Pinyin + nghĩa (tiếng Anh) cho một chữ hoặc một từ nhiều chữ.
 * Thứ tự: tra đúng chuỗi → quy từng chữ về giản thể rồi tra → (từ nhiều chữ) ghép pinyin từng chữ, nghĩa để trống.
 */
export async function lookup(input: string): Promise<{ pinyin: string; meaning: string } | null> {
  const word = normalizeHan(input);
  const chars = [...word];
  const [d, map] = await Promise.all([loadDict(), loadT2s()]);
  const simp = chars.map((c) => map[c] ?? c).join('');
  if (chars.length === 1) {
    const e = get(d, word) ?? get(d, simp);
    return e ? { pinyin: e[0], meaning: e[1] } : null;
  }
  const w = await loadWords();
  const e = get(w, word) ?? get(w, simp);
  if (e) return { pinyin: e[0], meaning: e[1] };
  // ponytail: từ ngoài danh sách HSK → chỉ ghép pinyin từng chữ, không đoán nghĩa. Muốn tra nghĩa mọi từ cần CC-CEDICT (~4MB).
  const parts = chars.map((c) => (get(d, c) ?? get(d, map[c] ?? ''))?.[0]);
  return parts.every(Boolean) ? { pinyin: parts.join(' '), meaning: '' } : null;
}

export type HskLevel = 1 | 2 | 3;
export const HSK_LEVELS: HskLevel[] = [1, 2, 3];
let hsk: Promise<Record<string, HskRow[]>> | null = null;
export async function loadHsk(level: HskLevel): Promise<WordInput[]> {
  hsk ??= getJson<Record<string, HskRow[]>>('/data/hsk.json', {});
  return ((await hsk)[String(level)] ?? []).map(([char, pinyin, meaning]) => ({ char, pinyin, meaning, note: '' }));
}
