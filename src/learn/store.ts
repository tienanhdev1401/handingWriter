import { useSyncExternalStore } from 'react';

export interface Deck { id: string; name: string; createdAt: number }
export interface Word {
  char: string;
  pinyin: string;
  meaning: string;
  note: string;
  createdAt: number;
  box: number;     // Leitner 0..4 — xem srs.ts
  due: number;     // epoch ms; <= now là cần ôn (0 = từ mới, luôn cần ôn)
  reviews: number;
  lapses: number;
  deck: string;    // Deck.id
}
export type WordInput = Pick<Word, 'char' | 'pinyin' | 'meaning' | 'note'>;
export interface Backup { decks: Deck[]; words: Word[] }

/** Bộ mặc định luôn tồn tại, không xóa được; tên hiển thị qua i18n khi name rỗng. */
export const DEFAULT_DECK = 'default';
const K = { words: 'learn.words', decks: 'learn.decks', sel: 'learn.sel', cur: 'learn.deck' };
/** Một chữ Hán hoặc một từ 2–8 chữ (giản thể hay phồn thể đều được). */
export const isHanzi = (s: string) => /^\p{Script=Han}{1,8}$/u.test(s);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const read = (k: string): unknown => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* đầy bộ nhớ / private mode: giữ trong RAM */ } };
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

function normWord(raw: unknown): Word | null {
  const w = raw as Partial<Word> | null;
  if (!w || typeof w.char !== 'string' || !isHanzi(w.char)) return null;
  return {
    char: w.char, pinyin: str(w.pinyin), meaning: str(w.meaning), note: str(w.note),
    createdAt: num(w.createdAt), box: Math.min(4, Math.max(0, Math.floor(num(w.box)))),
    due: num(w.due), reviews: num(w.reviews), lapses: num(w.lapses),
    deck: str(w.deck) || DEFAULT_DECK, // dữ liệu cũ chưa có bộ → Sổ chung
  };
}
function normDeck(raw: unknown): Deck | null {
  const d = raw as Partial<Deck> | null;
  if (!d || typeof d.id !== 'string' || !d.id) return null;
  return { id: d.id, name: str(d.name), createdAt: num(d.createdAt) };
}
function parseWords(raw: unknown): Word[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const r of raw) { const w = normWord(r); if (w && !seen.has(w.char)) { seen.add(w.char); out.push(w); } }
  return out;
}
function parseDecks(raw: unknown): Deck[] {
  const seen = new Set<string>([DEFAULT_DECK]);
  const out: Deck[] = [{ id: DEFAULT_DECK, name: '', createdAt: 0 }];
  if (Array.isArray(raw)) for (const r of raw) { const d = normDeck(r); if (d && !seen.has(d.id)) { seen.add(d.id); out.push(d); } }
  return out;
}

interface State { decks: Deck[]; words: Word[]; sel: string[] | null; current: string; study: Word[] }

/** Chuẩn hoá bất biến: từ trỏ tới bộ không tồn tại → Sổ chung; chọn rỗng = tất cả. */
function build(decks: Deck[], words: Word[], sel: string[] | null, current: string): State {
  const ids = new Set(decks.map((d) => d.id));
  const ws = words.map((w) => (ids.has(w.deck) ? w : { ...w, deck: DEFAULT_DECK }));
  let s = sel ? sel.filter((id) => ids.has(id)) : null;
  if (s && s.length === 0) s = null;
  const set = s ? new Set(s) : null;
  return { decks, words: ws, sel: s, current: ids.has(current) ? current : DEFAULT_DECK, study: set ? ws.filter((w) => set.has(w.deck)) : ws };
}

// ponytail: toàn bộ trong localStorage, 4 khoá; giữ ở module để trang GIF và trang học thấy cùng dữ liệu.
// Lên IndexedDB / đồng bộ khi cần >~5k từ hoặc nhiều thiết bị.
const rawSel = read(K.sel);
let state = build(parseDecks(read(K.decks)), parseWords(read(K.words)),
  Array.isArray(rawSel) ? rawSel.filter((x): x is string => typeof x === 'string') : null, str(read(K.cur)));

const subs = new Set<() => void>();
function commit(p: Partial<Pick<State, 'decks' | 'words' | 'sel' | 'current'>>) {
  state = build(p.decks ?? state.decks, p.words ?? state.words, 'sel' in p ? (p.sel ?? null) : state.sel, p.current ?? state.current);
  write(K.words, state.words); write(K.decks, state.decks.slice(1)); write(K.sel, state.sel); write(K.cur, state.current);
  subs.forEach((f) => f());
}
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

// ── Đọc ──
export const getWords = () => state.words;
export const getStudyWords = () => state.study;
export const getCurrentDeck = () => state.current;
export const getSelection = () => state.sel;
export const useWords = () => useSyncExternalStore(sub, () => state.words, () => state.words);
export const useDecks = () => useSyncExternalStore(sub, () => state.decks, () => state.decks);
/** Từ thuộc các bộ đang chọn để học (null = tất cả). */
export const useStudyWords = () => useSyncExternalStore(sub, () => state.study, () => state.study);
export const useSelection = () => useSyncExternalStore(sub, () => state.sel, () => state.sel);
export const useCurrentDeck = () => useSyncExternalStore(sub, () => state.current, () => state.current);

// ── Bộ từ ──
export function addDeck(name: string): string {
  const id = uid();
  commit({ decks: [...state.decks, { id, name: name.trim(), createdAt: Date.now() }], current: id });
  return id;
}
export const renameDeck = (id: string, name: string) =>
  commit({ decks: state.decks.map((d) => (d.id === id ? { ...d, name: name.trim() } : d)) });
/** Xóa bộ; từ bên trong chuyển về Sổ chung. Không xóa được Sổ chung. */
export function removeDeck(id: string) {
  if (id === DEFAULT_DECK) return;
  commit({ decks: state.decks.filter((d) => d.id !== id), words: state.words.map((w) => (w.deck === id ? { ...w, deck: DEFAULT_DECK } : w)) });
}
export const setCurrentDeck = (id: string) => commit({ current: id });

// ── Chọn bộ để học (dùng chung Lật thẻ / Bắn chữ / Tập viết) ──
export const setSelection = (ids: string[] | null) => commit({ sel: ids });
export const selectAllDecks = () => commit({ sel: null });
/** Đang "tất cả" mà bấm một bộ → chỉ bộ đó; bỏ chọn bộ cuối cùng → về tất cả. */
export function toggleDeck(id: string) {
  const sel = state.sel;
  if (sel === null) return commit({ sel: [id] });
  commit({ sel: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
}

// ── Từ ──
const fresh = (w: WordInput, deck: string): Word => ({ ...w, createdAt: Date.now(), box: 0, due: 0, reviews: 0, lapses: 0, deck });

/** Thêm nhiều từ vào một bộ (mặc định: bộ hiện tại), bỏ qua chữ đã có ở bất kỳ bộ nào. Trả về số từ mới. */
// ponytail: mỗi chữ chỉ nằm trong một bộ để tiến độ ôn là duy nhất; muốn một chữ ở nhiều bộ thì tách Word ↔ membership.
export function addMany(list: WordInput[], deck = state.current): number {
  const have = new Set(state.words.map((w) => w.char));
  const add: Word[] = [];
  for (const w of list) {
    const char = w.char.normalize('NFC'); // chữ tương thích U+F900… → chữ thống nhất
    if (isHanzi(char) && !have.has(char)) { have.add(char); add.push(fresh({ ...w, char }, deck)); }
  }
  if (add.length) commit({ words: [...state.words, ...add] });
  return add.length;
}
export const addWord = (w: WordInput, deck?: string) => addMany([w], deck) === 1;
export const updateWord = (char: string, patch: Partial<Omit<Word, 'char'>>) =>
  commit({ words: state.words.map((w) => (w.char === char ? { ...w, ...patch } : w)) });
export const removeWord = (char: string) => commit({ words: state.words.filter((w) => w.char !== char) });

// ── Xuất / nhập ──
export const exportData = (): Backup => ({ decks: state.decks, words: state.words });
/**
 * Nhận cả mảng từ (bản cũ) lẫn { decks, words }. Chữ mới được thêm, chữ trùng lấy bản trong file (giữ tiến độ ôn).
 * Bộ lạ trong file được tạo thêm; từ không có bộ → bộ hiện tại. Trả về số từ mới.
 */
export function importWords(raw: unknown): number {
  const isBackup = !!raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as Backup).words);
  const list = parseWords(isBackup ? (raw as Backup).words : raw);
  const src = isBackup ? (raw as Backup).words : raw;
  if (!Array.isArray(src) || (src.length > 0 && list.length === 0)) throw new Error('invalid');
  const haveDeck = new Set(state.decks.map((d) => d.id));
  const newDecks = (isBackup ? parseDecks((raw as Backup).decks).slice(1) : []).filter((d) => !haveDeck.has(d.id));
  newDecks.forEach((d) => haveDeck.add(d.id));
  const fixed = list.map((w) => (haveDeck.has(w.deck) && (isBackup || w.deck !== DEFAULT_DECK) ? w : { ...w, deck: state.current }));
  const have = new Set(state.words.map((w) => w.char));
  const incoming = new Map(fixed.map((w) => [w.char, w]));
  const added = fixed.filter((w) => !have.has(w.char));
  commit({ decks: [...state.decks, ...newDecks], words: [...state.words.map((w) => incoming.get(w.char) ?? w), ...added] });
  return added.length;
}
