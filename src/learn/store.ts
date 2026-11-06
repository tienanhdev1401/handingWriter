import { useSyncExternalStore } from 'react';

export interface Deck { id: string; name: string; createdAt: number; updatedAt: number }
export interface Word {
  id: string;        // dinh danh on dinh; mot chu co the o nhieu bo nen khong dung chu lam khoa
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
  order: number;   // vị trí hiển thị (nhỏ → trước); từ cũ = createdAt. Kéo thả chỉ đổi số này của một từ
  updatedAt: number; // ms — hợp nhất đa thiết bị: bản mới hơn thắng
}
export type WordInput = Pick<Word, 'char' | 'pinyin' | 'meaning' | 'note'>;
/** Bia mộ: thứ đã xóa, để máy khác (và mây) không hồi sinh. key = 'w:<chữ>' | 'd:<deckId>'. */
export interface Tombstone { key: string; at: number }
export interface Backup { decks: Deck[]; words: Word[]; deleted: Tombstone[] }
export const wKey = (id: string) => `w:${id}`;
export const dKey = (id: string) => `d:${id}`;

/** Bộ mặc định luôn tồn tại, không xóa được; tên hiển thị qua i18n khi name rỗng. */
export const DEFAULT_DECK = 'default';
const K = { words: 'learn.words', decks: 'learn.decks', del: 'learn.deleted', sel: 'learn.sel', cur: 'learn.deck' };
/** Một chữ Hán hoặc một từ 2–8 chữ (giản thể hay phồn thể đều được). */
export const isHanzi = (s: string) => /^\p{Script=Han}{1,8}$/u.test(s);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const read = (k: string): unknown => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* đầy bộ nhớ / private mode: giữ trong RAM */ } };
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const now = () => Date.now();

function normWord(raw: unknown): Word | null {
  const w = raw as Partial<Word> | null;
  if (!w || typeof w.char !== 'string' || !isHanzi(w.char)) return null;
  return {
    id: str(w.id) || w.char, // du lieu cu chua co id -> dung chu (khi do moi chu con la duy nhat)
    char: w.char, pinyin: str(w.pinyin), meaning: str(w.meaning), note: str(w.note),
    createdAt: num(w.createdAt), box: Math.min(4, Math.max(0, Math.floor(num(w.box)))),
    due: num(w.due), reviews: num(w.reviews), lapses: num(w.lapses),
    deck: str(w.deck) || DEFAULT_DECK,
    order: typeof w.order === 'number' && Number.isFinite(w.order) ? w.order : num(w.createdAt),
    updatedAt: num(w.updatedAt) || num(w.createdAt),
  };
}
function normDeck(raw: unknown): Deck | null {
  const d = raw as Partial<Deck> | null;
  if (!d || typeof d.id !== 'string' || !d.id) return null;
  return { id: d.id, name: str(d.name), createdAt: num(d.createdAt), updatedAt: num(d.updatedAt) || num(d.createdAt) };
}
export function parseWords(raw: unknown): Word[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const r of raw) { const w = normWord(r); if (w && !seen.has(w.id)) { seen.add(w.id); out.push(w); } }
  return out;
}
export function parseDecks(raw: unknown): Deck[] {
  const seen = new Set<string>([DEFAULT_DECK]);
  const out: Deck[] = [{ id: DEFAULT_DECK, name: '', createdAt: 0, updatedAt: 0 }];
  if (Array.isArray(raw)) for (const r of raw) { const d = normDeck(r); if (d && !seen.has(d.id)) { seen.add(d.id); out.push(d); } }
  return out;
}
export function parseDeleted(raw: unknown): Tombstone[] {
  if (!Array.isArray(raw)) return [];
  const m = new Map<string, number>();
  for (const r of raw as Partial<Tombstone>[]) if (r && typeof r.key === 'string' && /^[wd]:/.test(r.key)) m.set(r.key, Math.max(m.get(r.key) ?? 0, num(r.at)));
  return [...m].map(([key, at]) => ({ key, at }));
}

interface State { decks: Deck[]; words: Word[]; deleted: Tombstone[]; sel: string[] | null; current: string; study: Word[] }

/** Chuẩn hoá bất biến: từ trỏ tới bộ không tồn tại → Sổ chung; chọn rỗng = tất cả. */
function build(decks: Deck[], words: Word[], deleted: Tombstone[], sel: string[] | null, current: string): State {
  const ids = new Set(decks.map((d) => d.id));
  // sort ổn định: cùng order (từ cũ nhập cùng lúc) giữ thứ tự đã lưu
  const ws = words.map((w) => (ids.has(w.deck) ? w : { ...w, deck: DEFAULT_DECK })).sort((a, b) => a.order - b.order);
  let s = sel ? sel.filter((id) => ids.has(id)) : null;
  if (s && s.length === 0) s = null;
  const set = s ? new Set(s) : null;
  return { decks, words: ws, deleted, sel: s, current: ids.has(current) ? current : DEFAULT_DECK, study: set ? ws.filter((w) => set.has(w.deck)) : ws };
}

// ponytail: toàn bộ trong localStorage; tombstone giữ mãi (vài KB cho dùng cá nhân).
// Dọn tombstone cũ hơn 90 ngày khi vượt ~1k mục.
const rawSel = read(K.sel);
let state = build(parseDecks(read(K.decks)), parseWords(read(K.words)), parseDeleted(read(K.del)),
  Array.isArray(rawSel) ? rawSel.filter((x): x is string => typeof x === 'string') : null, str(read(K.cur)));

const subs = new Set<() => void>();
function commit(p: Partial<Pick<State, 'decks' | 'words' | 'deleted' | 'sel' | 'current'>>) {
  state = build(p.decks ?? state.decks, p.words ?? state.words, p.deleted ?? state.deleted, 'sel' in p ? (p.sel ?? null) : state.sel, p.current ?? state.current);
  write(K.words, state.words); write(K.decks, state.decks.slice(1)); write(K.del, state.deleted); write(K.sel, state.sel); write(K.cur, state.current);
  subs.forEach((f) => f());
}
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Lắng nghe mọi thay đổi (dùng cho đồng bộ đám mây). */
export const subscribe = sub;
/** Chuẩn hoá một Backup thô (document Firestore, file nhập, bản cũ thiếu id/order…) trước khi dùng. */
export const parseBackup = (b: Partial<Backup> | null | undefined): Backup => ({ decks: parseDecks(b?.decks), words: parseWords(b?.words), deleted: parseDeleted(b?.deleted) });
/** Thay toàn bộ dữ liệu bằng bản đã hợp nhất từ mây (giữ bộ đang chọn/hiện tại nếu còn tồn tại). */
export const replaceAll = (b: Backup) => commit(parseBackup(b));

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

const bury = (keys: string[]) => {
  const at = now(), m = new Map(state.deleted.map((t) => [t.key, t.at]));
  for (const k of keys) m.set(k, at);
  return [...m].map(([key, at]) => ({ key, at }));
};
const unbury = (keys: string[]) => { const s = new Set(keys); return state.deleted.filter((t) => !s.has(t.key)); };

// ── Bộ từ ──
export function addDeck(name: string): string {
  const id = uid();
  commit({ decks: [...state.decks, { id, name: name.trim(), createdAt: now(), updatedAt: now() }], current: id });
  return id;
}
export const renameDeck = (id: string, name: string) =>
  commit({ decks: state.decks.map((d) => (d.id === id ? { ...d, name: name.trim(), updatedAt: now() } : d)) });
/**
 * Xóa bộ. mode 'move' (mặc định): từ bên trong về Sổ chung; 'delete': xóa luôn từ.
 * Ghi tombstone cho bộ (và từ, nếu xóa) để đồng bộ không hồi sinh. Không xóa được Sổ chung.
 */
export function removeDeck(id: string, mode: 'move' | 'delete' = 'move') {
  if (id === DEFAULT_DECK) return;
  const inside = state.words.filter((w) => w.deck === id);
  const t = now();
  const words = mode === 'delete'
    ? state.words.filter((w) => w.deck !== id)
    : state.words.map((w) => (w.deck === id ? { ...w, deck: DEFAULT_DECK, updatedAt: t } : w));
  commit({ decks: state.decks.filter((d) => d.id !== id), words, deleted: bury([dKey(id), ...(mode === 'delete' ? inside.map((w) => wKey(w.id)) : [])]) });
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
const fresh = (w: WordInput, deck: string, order: number): Word => ({ id: uid(), ...w, createdAt: now(), box: 0, due: 0, reviews: 0, lapses: 0, deck, order, updatedAt: now() });

/** Thêm nhiều từ vào một bộ (mặc định: bộ hiện tại), bỏ qua chữ đã có trong bộ đó. Trả về số từ mới. */
export function addMany(list: WordInput[], deck = state.current): number {
  const inDeck = new Set(state.words.filter((w) => w.deck === deck).map((w) => w.char));
  const add: Word[] = [];
  const t = now();
  for (const w of list) {
    const char = w.char.normalize('NFC'); // chu tuong thich U+F900... -> chu thong nhat
    if (isHanzi(char) && !inDeck.has(char)) { inDeck.add(char); add.push(fresh({ ...w, char }, deck, t + add.length)); } // t+i: giữ thứ tự nhập
  }
  if (add.length) commit({ words: [...state.words, ...add], deleted: unbury(add.map((w) => wKey(w.id))) });
  return add.length;
}
export const addWord = (w: WordInput, deck?: string) => addMany([w], deck) === 1;
export const updateWord = (id: string, patch: Partial<Omit<Word, 'id'>>) =>
  commit({ words: state.words.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: now() } : w)) });
export const removeWord = (id: string) =>
  commit({ words: state.words.filter((w) => w.id !== id), deleted: bury([wKey(id)]) });
/**
 * Đưa từ `id` vào vị trí của từ `targetId` (cùng bộ): kéo lên → đứng trước nó, kéo xuống → đứng sau nó.
 * Chỉ đổi order của một từ (trung điểm hai hàng xóm) để đồng bộ không đụng từ khác.
 * ponytail: hết khoảng trống (kéo qua lại cùng chỗ ~50 lần) → đánh số lại cả bộ, cách nhau 1024.
 */
export function moveWord(id: string, targetId: string) {
  const a = state.words.find((w) => w.id === id), b = state.words.find((w) => w.id === targetId);
  if (!a || !b || a === b || a.deck !== b.deck) return;
  const list = state.words.filter((w) => w.deck === a.deck && w.id !== id);
  const to = list.indexOf(b) + (state.words.indexOf(a) > state.words.indexOf(b) ? 0 : 1); // so chỉ số, không so order: từ cũ có thể trùng order
  const prev = list[to - 1], next = list[to], t = now();
  const order = prev && next ? (prev.order + next.order) / 2 : prev ? prev.order + 1 : next ? next.order - 1 : a.order;
  if ((!prev || prev.order < order) && (!next || order < next.order)) {
    return commit({ words: state.words.map((w) => (w.id === id ? { ...w, order, updatedAt: t } : w)) });
  }
  list.splice(to, 0, a);
  const re = new Map(list.map((w, i) => [w.id, i * 1024]));
  commit({ words: state.words.map((w) => (re.has(w.id) ? { ...w, order: re.get(w.id)!, updatedAt: t } : w)) });
}

// ── Xuất / nhập ──
export const exportData = (): Backup => ({ decks: state.decks, words: state.words, deleted: state.deleted });
/**
 * Nhận cả mảng từ (bản cũ) lẫn { decks, words }. Chữ mới được thêm, chữ trùng lấy bản trong file (giữ tiến độ ôn).
 * Bộ lạ trong file được tạo thêm; từ không có bộ → bộ hiện tại. Nhập là ý người dùng → gỡ tombstone của những gì nhập vào.
 * Trả về số từ mới.
 */
export function importWords(raw: unknown): number {
  const isBackup = !!raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as Backup).words);
  const list = parseWords(isBackup ? (raw as Backup).words : raw);
  const src = isBackup ? (raw as Backup).words : raw;
  if (!Array.isArray(src) || (src.length > 0 && list.length === 0)) throw new Error('invalid');
  const haveDeck = new Set(state.decks.map((d) => d.id));
  const newDecks = (isBackup ? parseDecks((raw as Backup).decks).slice(1) : []).filter((d) => !haveDeck.has(d.id));
  newDecks.forEach((d) => haveDeck.add(d.id));
  const t = now();
  const fixed = list.map((w) => ({ ...(haveDeck.has(w.deck) && (isBackup || w.deck !== DEFAULT_DECK) ? w : { ...w, deck: state.current }), updatedAt: t }));
  const have = new Set(state.words.map((w) => w.id));
  const incoming = new Map(fixed.map((w) => [w.id, w]));
  const added = fixed.filter((w) => !have.has(w.id));
  commit({
    decks: [...state.decks, ...newDecks.map((d) => ({ ...d, updatedAt: t }))],
    words: [...state.words.map((w) => incoming.get(w.id) ?? w), ...added],
    deleted: unbury([...fixed.map((w) => wKey(w.id)), ...newDecks.map((d) => dKey(d.id))]),
  });
  return added.length;
}
