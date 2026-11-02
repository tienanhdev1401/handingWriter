import { DEFAULT_DECK, type Backup, type Deck, type Tombstone, type Word } from './store';

/**
 * Hợp nhất dữ liệu máy với dữ liệu trên mây. Thuần, không phụ thuộc React/Firebase.
 * - Tombstone: hợp theo key, lấy mốc muộn nhất. Mục nào có tombstone với at >= updatedAt thì bị loại
 *   (xóa ở một máy → mất ở mọi máy; thêm lại sau khi xóa có updatedAt mới hơn nên vẫn sống).
 * - Bộ / từ: hợp theo id / chữ; cùng khoá → bản updatedAt mới hơn thắng (sửa ở máy A thắng ở máy B,
 *   không ping-pong). Hoà → nhiều reviews hơn, rồi due muộn hơn, rồi local.
 * - Từ trỏ tới bộ đã bị loại → về Sổ chung.
 * Giao hoán và luỹ đẳng về nội dung, nên hai máy hội tụ sau một vòng.
 */
export function mergeBackups(local: Backup, remote: Backup | null): Backup {
  if (!remote) return local;
  const dead = new Map<string, number>();
  for (const t of [...(remote.deleted ?? []), ...(local.deleted ?? [])]) dead.set(t.key, Math.max(dead.get(t.key) ?? 0, t.at));
  const gone = (key: string, updatedAt: number) => (dead.get(key) ?? -1) >= updatedAt;

  const decks = new Map<string, Deck>();
  for (const d of [...remote.decks, ...local.decks]) {
    const p = decks.get(d.id);
    decks.set(d.id, p ? (d.updatedAt > p.updatedAt ? d : d.updatedAt < p.updatedAt ? p : { ...d, name: d.name || p.name }) : d);
  }
  for (const [id, d] of decks) if (id !== DEFAULT_DECK && gone(`d:${id}`, d.updatedAt)) decks.delete(id);

  const words = new Map<string, Word>();
  for (const w of [...remote.words, ...local.words]) {
    const p = words.get(w.char);
    words.set(w.char, p ? pick(p, w) : w);
  }
  const out: Word[] = [];
  for (const [char, w] of words) {
    if (gone(`w:${char}`, w.updatedAt)) continue;
    out.push(decks.has(w.deck) ? w : { ...w, deck: DEFAULT_DECK });
  }
  const deleted: Tombstone[] = [...dead].map(([key, at]) => ({ key, at }));
  return { decks: [...decks.values()], words: out, deleted };
}

function pick(a: Word, b: Word): Word {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt > a.updatedAt ? b : a;
  if (b.reviews !== a.reviews) return b.reviews > a.reviews ? b : a;
  if (b.due !== a.due) return b.due > a.due ? b : a;
  return b; // hoà hoàn toàn → bản local (đến sau trong vòng lặp)
}

/**
 * So sánh hai bản để tránh ghi lên mây khi không có gì đổi.
 * Firestore trả object với thứ tự khoá khác máy → phải so sánh bất chấp thứ tự khoá, nếu không
 * hai thiết bị mở cùng lúc sẽ ping-pong vô tận (mỗi bên tưởng bên kia "khác" rồi ghi đè lại).
 */
export const sameBackup = (a: Backup, b: Backup | null) => !!b && canon(norm(a)) === canon(norm(b));
const norm = (x: Backup) => ({
  decks: [...x.decks].sort((p, q) => p.id.localeCompare(q.id)),
  words: [...x.words].sort((p, q) => p.char.localeCompare(q.char)),
  deleted: [...(x.deleted ?? [])].sort((p, q) => p.key.localeCompare(q.key)),
});
/** JSON với khoá object sắp xếp đệ quy — ổn định bất kể nguồn dữ liệu. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + canon((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v);
}
