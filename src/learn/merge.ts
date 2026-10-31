import type { Backup, Deck, Word } from './store';

/**
 * Hợp nhất dữ liệu máy với dữ liệu trên mây. Thuần, không phụ thuộc React/Firebase.
 * - Bộ từ: hợp theo id; cùng id thì lấy tên không rỗng, ưu tiên bản local.
 * - Từ: hợp theo chữ; cùng chữ thì giữ bản đã ôn nhiều hơn (reviews), hoà → due muộn hơn
 *   (tiến độ ôn "đi xa" hơn thắng). Ghi chú/pinyin/nghĩa đi theo bản thắng.
 * Kết quả ổn định: merge(a, b) ≡ merge(b, a) về nội dung, nên hai máy hội tụ sau một vòng.
 */
export function mergeBackups(local: Backup, remote: Backup | null): Backup {
  if (!remote) return local;
  const decks = new Map<string, Deck>();
  for (const d of [...remote.decks, ...local.decks]) {
    const prev = decks.get(d.id);
    decks.set(d.id, prev ? { ...prev, name: d.name || prev.name } : d);
  }
  const words = new Map<string, Word>();
  for (const w of [...remote.words, ...local.words]) {
    const prev = words.get(w.char);
    words.set(w.char, prev ? pick(prev, w) : w);
  }
  return { decks: [...decks.values()], words: [...words.values()] };
}

function pick(a: Word, b: Word): Word {
  if (b.reviews !== a.reviews) return b.reviews > a.reviews ? b : a;
  if (b.due !== a.due) return b.due > a.due ? b : a;
  return b; // hoà hoàn toàn → bản local (đến sau trong vòng lặp)
}

/** So sánh nhanh hai bản để tránh ghi lên mây khi không có gì đổi. */
export const sameBackup = (a: Backup, b: Backup | null) => !!b && JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const norm = (x: Backup) => ({
  decks: [...x.decks].sort((p, q) => p.id.localeCompare(q.id)),
  words: [...x.words].sort((p, q) => p.char.localeCompare(q.char)),
});
