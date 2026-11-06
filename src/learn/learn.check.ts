// Chạy: npx tsc --ignoreConfig src/learn/learn.check.ts --outDir node_modules/.tmp/chk --module commonjs --target es2023 --skipLibCheck --lib es2023,dom && node node_modules/.tmp/chk/learn.check.js
import './check.stub';
import { makeRound, shuffle, fallSeconds, MIN_WORDS } from './game';
import * as Store from './store';
import { grade, filterScope, nextStreak } from './srs';
import { judge, resample, toScreen, type Pt } from './judge';
import type { Word } from './store';
import { mergeBackups, sameBackup, canon } from './merge';

const ok = (c: boolean, m: string) => { if (!c) throw new Error('FAIL: ' + m); };
const mk = (char: string, i: number): Word => ({ id: char, char, pinyin: '', meaning: String(i), note: '', createdAt: 0, box: 0, due: 0, reviews: 0, lapses: 0, deck: 'default', updatedAt: 0 });
const words = ['一', '二', '三', '四', '五'].map(mk);
let seed = 1;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ── game ──
for (let i = 0; i < 200; i++) {
  const r = makeRound(words, rng);
  ok(r.items.length === MIN_WORDS, 'round size');
  ok(r.items.some((f) => f.word === r.target), 'target present');
  ok(new Set(r.items.map((f) => f.word.char)).size === MIN_WORDS, 'no duplicates');
  ok(r.items.every((f) => f.x >= 0 && f.x <= 100 && f.delay >= 0), 'x/delay in range');
}
let threw = false;
try { makeRound(words.slice(0, 3), rng); } catch { threw = true; }
ok(threw, 'rejects <4 words');
ok(shuffle([3, 1, 2], rng).sort().join() === '1,2,3', 'shuffle keeps elements');
ok(fallSeconds(0) === 6 && fallSeconds(100) === 2.5, 'speed clamps');

// ── srs ──
const now = 1_700_000_000_000, DAY = 86_400_000;
let w = grade(words[0], true, now);
ok(w.box === 1 && w.due === now + DAY && w.reviews === 1, 'nhớ → hộp 1, ôn lại sau 1 ngày');
for (let i = 0; i < 5; i++) w = grade(w, true, now);
ok(w.box === 4 && w.due === now + 14 * DAY, 'hộp tối đa 4, 14 ngày');
w = grade(w, false, now);
ok(w.box === 0 && w.due === now && w.lapses === 1, 'quên → hộp 0, cần ôn ngay');
ok(filterScope([w, words[1]], 'new').length === 1, 'new = chưa ôn lần nào');
ok(filterScope([{ ...w, due: now + 1 }, words[1]], 'due', now).length === 1, 'due = due <= now');
ok(filterScope(words, 'all').length === 5, 'all');
ok(nextStreak(null, 'd2', 'd1').count === 1, 'streak bắt đầu');
ok(nextStreak({ last: 'd1', count: 3 }, 'd2', 'd1').count === 4, 'streak nối tiếp');
ok(nextStreak({ last: 'd0', count: 3 }, 'd2', 'd1').count === 1, 'streak đứt');
ok(nextStreak({ last: 'd2', count: 3 }, 'd2', 'd1').count === 3, 'cùng ngày không cộng');

// ── write ──
const S = 300;
const median = toScreen([[200, 700], [800, 700]], S); // nét ngang trái → phải
ok(resample(median, 5).length === 5, 'resample count');
const good: Pt[] = [[60, 100], [120, 96], [180, 92], [234, 95]];
ok(judge(good, median, S).ok, 'vẽ bám nét → đạt');
ok(!judge([...good].reverse(), median, S).ok, 'vẽ ngược chiều → trượt');
ok(!judge([[60, 100], [100, 99]], median, S).ok, 'quá ngắn → trượt');
ok(!judge([[60, 220], [234, 220]], median, S).ok, 'lệch xa → trượt');
ok(judge([[150, 150]], toScreen([[500, 500], [520, 480]], S), S).ok, 'nét chấm: chạm đúng chỗ là đạt');
ok(!judge([], median, S).ok, 'không vẽ gì → trượt');

// ── store: bộ từ ──
ok(Store.importWords([{ char: '水', pinyin: '', meaning: '', note: '' }]) === 1, 'nhập mảng cũ (không có deck)');
ok(Store.getWords()[0].deck === Store.DEFAULT_DECK, 'từ cũ về Sổ chung');
const shop = Store.addDeck('Đi mua sắm');
ok(Store.getCurrentDeck() === shop, 'tạo bộ → thành bộ hiện tại');
ok(Store.addWord({ char: '买', pinyin: 'mǎi', meaning: 'to buy', note: '' }), 'thêm vào bộ hiện tại');
ok(Store.getWords().find((w) => w.char === '买')?.deck === shop, 'từ mới thuộc bộ Đi mua sắm');
ok(Store.addWord({ char: '水', pinyin: '', meaning: '', note: '' }, shop), 'cùng chữ, bộ khác → thêm được (đa bộ)');
ok(Store.getWords().filter((w) => w.char === '水').length === 2, '水 ở 2 bộ');
ok(!Store.addWord({ char: '水', pinyin: '', meaning: '', note: '' }, shop), 'cùng chữ, CÙNG bộ → từ chối');
Store.removeWord(Store.getWords().find((w) => w.char === '水' && w.deck === shop)!.id); // dọn để các test sau giữ nguyên trạng thái
ok(Store.getStudyWords().length === 2 && Store.getSelection() === null, 'mặc định học tất cả');
Store.toggleDeck(shop);
ok(Store.getStudyWords().length === 1 && Store.getStudyWords()[0].char === '买', 'chọn 1 bộ → chỉ từ trong bộ');
Store.toggleDeck(Store.DEFAULT_DECK);
ok(Store.getStudyWords().length === 2, 'kết hợp 2 bộ');
Store.toggleDeck(shop); Store.toggleDeck(Store.DEFAULT_DECK);
ok(Store.getSelection() === null, 'bỏ chọn bộ cuối → về tất cả');
Store.toggleDeck(shop);
Store.updateWord('水', { deck: shop });
ok(Store.getStudyWords().length === 2, 'chuyển từ sang bộ khác');
const backup = Store.exportData();
ok(backup.decks.length === 2 && backup.words.length === 2, 'xuất gồm decks + words');
Store.removeDeck(shop);
ok(Store.getWords().every((w) => w.deck === Store.DEFAULT_DECK), 'xóa bộ → từ về Sổ chung');
ok(Store.getSelection() === null && Store.getCurrentDeck() === Store.DEFAULT_DECK, 'xóa bộ → reset chọn/hiện tại');
Store.removeDeck(Store.DEFAULT_DECK);
ok(Store.getWords().length === 2, 'không xóa được Sổ chung');
ok(Store.importWords(backup) === 0, 'nhập lại backup: không thêm từ trùng');
ok(Store.getWords().find((w) => w.char === '买')?.deck === shop, 'nhập backup khôi phục bộ + vị trí từ');
let bad = false;
try { Store.importWords({ nope: 1 }); } catch { bad = true; }
ok(bad, 'file không hợp lệ → ném lỗi');

// ── từ nhiều chữ ──
ok(Store.isHanzi('下邊') && Store.isHanzi('學') && Store.isHanzi('一二三四五六七八'), 'isHanzi: 1–8 chữ Hán');
ok(!Store.isHanzi('下邊x') && !Store.isHanzi('') && !Store.isHanzi('一二三四五六七八九') && !Store.isHanzi('xué'), 'isHanzi: từ chối chữ Latin, rỗng, >8');
ok(Store.addWord({ char: '下邊', pinyin: 'xià bian', meaning: 'under', note: '' }), 'thêm từ 2 chữ');
ok(!Store.addWord({ char: '下邊', pinyin: '', meaning: '', note: '' }), 'từ 2 chữ trùng → từ chối');
ok(Store.getWords().some((w) => w.char === '下邊' && w.pinyin === 'xià bian'), 'từ 2 chữ lưu nguyên chuỗi');

// ── merge (đồng bộ mây) ──
const D = (id: string, name: string, up = 0) => ({ id, name, createdAt: 0, updatedAt: up });
const W = (char: string, reviews: number, due: number, deck = 'default', note = '', up = 0, id = char): Word => ({ id, char, pinyin: '', meaning: '', note, createdAt: 0, box: 0, due, reviews, lapses: 0, deck, updatedAt: up });
const T = (key: string, at: number) => ({ key, at });
const local = { decks: [D('default', ''), D('shop', 'Mua sắm')], words: [W('買', 3, 100, 'shop', 'local'), W('學', 0, 0)], deleted: [] };
const remote = { decks: [D('default', ''), D('shop', ''), D('hsk', 'HSK 1')], words: [W('買', 5, 50, 'shop', 'remote'), W('水', 2, 10, 'hsk')], deleted: [] };
ok(mergeBackups(local, null) === local, 'không có mây → giữ nguyên local');
const m = mergeBackups(local, remote);
ok(m.decks.length === 3 && m.decks.find((d) => d.id === 'shop')?.name === 'Mua sắm', 'hợp bộ theo id, tên không rỗng thắng');
ok(m.words.length === 3, 'hợp từ theo chữ');
ok(m.words.find((w) => w.char === '買')?.note === 'remote', 'cùng chữ → bản ôn nhiều hơn (reviews 5 > 3) thắng');
const m2 = mergeBackups(remote, local);
ok(sameBackup(m, m2), 'merge giao hoán → hai máy hội tụ');
ok(sameBackup(mergeBackups(m, remote), m), 'merge luỹ đẳng với bản đã hợp');
ok(!sameBackup(local, remote) && sameBackup(local, { decks: [...local.decks].reverse(), words: [...local.words].reverse(), deleted: [] }), 'sameBackup bỏ qua thứ tự');
const tie = mergeBackups({ decks: [D('default', '')], words: [W('一', 1, 5, 'default', 'L')], deleted: [] }, { decks: [D('default', '')], words: [W('一', 1, 9, 'default', 'R')], deleted: [] });
ok(tie.words[0].note === 'R', 'hoà reviews → due muộn hơn thắng');

// ── tombstone & updatedAt (lỗi "xóa rồi vẫn hiện lại") ──
const base = { decks: [D('default', '')], words: [W('一', 0, 0, 'default', '', 100), W('二', 0, 0, 'default', '', 100)], deleted: [] };
const delB = { decks: [D('default', '')], words: [W('一', 0, 0, 'default', '', 100)], deleted: [T('w:二', 200)] };
ok(mergeBackups(base, delB).words.length === 1 && mergeBackups(delB, base).words.length === 1, 'xóa từ ở một máy → mất ở cả hai chiều merge');
ok(mergeBackups(base, delB).deleted.length === 1, 'tombstone được giữ sau merge');
ok(sameBackup(mergeBackups(base, delB), delB), 'máy chưa xóa hội tụ về bản đã xóa → không ghi ngược');
const readd = { decks: [D('default', '')], words: [W('二', 0, 0, 'default', 'lại', 300)], deleted: [] };
ok(mergeBackups(readd, delB).words.some((w) => w.char === '二'), 'thêm lại sau khi xóa (updatedAt > tombstone) → sống');
const eA = { decks: [D('default', '')], words: [W('三', 2, 10, 'default', 'A', 500)], deleted: [] };
const eB = { decks: [D('default', '')], words: [W('三', 2, 10, 'default', 'B', 400)], deleted: [] };
ok(mergeBackups(eB, eA).words[0].note === 'A' && mergeBackups(eA, eB).words[0].note === 'A', 'sửa mới hơn thắng ở cả hai chiều (không ping-pong)');
ok(sameBackup(mergeBackups(eB, eA), eA), 'máy cũ hội tụ đúng về bản mới');
const dk = { decks: [D('default', ''), D('x', 'X', 50)], words: [W('四', 0, 0, 'x', '', 100), W('五', 0, 0, 'x', '', 100)], deleted: [] };
const dkMove = { decks: [D('default', '')], words: [W('四', 0, 0, 'default', '', 200), W('五', 0, 0, 'default', '', 200)], deleted: [T('d:x', 200)] };
const mm = mergeBackups(dk, dkMove);
ok(mm.decks.length === 1 && mm.words.every((w) => w.deck === 'default'), 'xóa bộ (giữ từ) → bộ mất, từ về Sổ chung ở máy kia');
const dkDel = { decks: [D('default', '')], words: [], deleted: [T('d:x', 200), T('w:四', 200), T('w:五', 200)] };
ok(mergeBackups(dk, dkDel).words.length === 0 && mergeBackups(dk, dkDel).decks.length === 1, 'xóa bộ kèm từ → bộ và từ đều mất ở máy kia');
ok(!sameBackup(dk, dkDel) && sameBackup(mergeBackups(dk, dkDel), dkDel), 'merge luỹ đẳng với tombstone');

// ── store: xóa có tombstone, thêm lại gỡ tombstone ──
const g2 = Store.addDeck('G2');
Store.addWord({ char: '九', pinyin: '', meaning: '', note: '' }, g2);
const nine1 = Store.getWords().find((w) => w.char === '九' && w.deck === g2)!.id;
ok(!!nine1, 'thêm 九 vào bộ G2');
Store.removeDeck(g2, 'delete');
ok(!Store.getWords().some((w) => w.char === '九'), "removeDeck 'delete' → từ bên trong biến mất");
ok(Store.exportData().deleted.some((x) => x.key === 'w:' + nine1) && Store.exportData().deleted.some((x) => x.key === 'd:' + g2), 'ghi tombstone cho cả bộ lẫn từ');
Store.addWord({ char: '九', pinyin: '', meaning: '', note: '' });
const nine2 = Store.getWords().find((w) => w.char === '九')!.id;
ok(!!nine2 && nine2 !== nine1, 'thêm lại 九 được (id mới → không bị tombstone cũ giết)');
ok(!Store.exportData().deleted.some((x) => x.key === 'w:' + nine2), 'từ mới không có tombstone');
Store.removeWord(nine2);
ok(Store.exportData().deleted.some((x) => x.key === 'w:' + nine2), 'removeWord → tombstone');
const buyId = Store.getWords().find((w) => w.char === '买')!.id;
const before = Store.getWords().find((w) => w.id === buyId)!.updatedAt;
Store.updateWord(buyId, { note: 'x' });
ok(Store.getWords().find((w) => w.id === buyId)!.updatedAt > before, 'updateWord → updatedAt tăng');

// ── sameBackup bất chấp thứ tự khoá (Firestore trả khoá theo thứ tự khác → từng gây ping-pong 2 máy) ──
const reorder = (o: Record<string, unknown>) => Object.fromEntries(Object.keys(o).sort().reverse().map((k) => [k, o[k]]));
const fromCloud = { words: eA.words.map((w) => reorder(w as unknown as Record<string, unknown>)), deleted: [], decks: eA.decks.map((d) => reorder(d as unknown as Record<string, unknown>)) } as unknown as typeof eA;
ok(JSON.stringify(fromCloud.words[0]) !== JSON.stringify(eA.words[0]), 'mô phỏng: cùng dữ liệu, khác thứ tự khoá');
ok(sameBackup(eA, fromCloud), 'sameBackup coi là giống nhau → không ghi lại → không ping-pong');
ok(canon({ b: 1, a: [{ y: 2, x: 1 }] }) === canon({ a: [{ x: 1, y: 2 }], b: 1 }), 'canon sắp khoá đệ quy');
ok(canon({ a: 1 }) !== canon({ a: 2 }), 'canon phân biệt giá trị khác');

// ── đếm từ khi bộ thay đổi (kịch bản người dùng nêu) ──
const unsorted = () => Store.getWords().filter((w) => w.deck === Store.DEFAULT_DECK).length;
const total = () => Store.getWords().length;
const inD = (id: string) => Store.getWords().filter((w) => w.deck === id).length;
const t0 = total(), u0 = unsorted();
const cA = Store.addDeck('A');
['甲', '乙', '丙', '丁'].forEach((c) => Store.addWord({ char: c, pinyin: '', meaning: '', note: '' }, cA));
ok(inD(cA) === 4 && total() === t0 + 4 && unsorted() === u0, 'bộ A 4 chữ → Tất cả +4, Chưa phân loại không đổi');
Store.removeDeck(cA, 'delete');
ok(total() === t0 && unsorted() === u0, 'xóa bộ A (xóa cả từ) → Tất cả về như cũ, Chưa phân loại không đổi');
const cB = Store.addDeck('B');
['戊', '己', '庚', '辛', '壬'].forEach((c) => Store.addWord({ char: c, pinyin: '', meaning: '', note: '' }, cB));
ok(inD(cB) === 5 && total() === t0 + 5, 'bộ B 5 chữ → Tất cả +5');
Store.removeWord(Store.getWords().find((w) => w.char === '壬')!.id);
ok(inD(cB) === 4 && total() === t0 + 4, 'xóa 1 chữ trong B → B=4, Tất cả +4');
Store.removeDeck(cB, 'move');
ok(unsorted() === u0 + 4 && total() === t0 + 4, 'xóa bộ B (chuyển từ) → 4 từ sang Chưa phân loại, Tất cả không đổi');
['戊', '己', '庚', '辛'].forEach((c) => { const w = Store.getWords().find((x) => x.char === c); if (w) Store.removeWord(w.id); });
ok(unsorted() === u0 && total() === t0, 'xóa 4 từ đó → về như cũ');

// ── da bo: mot chu o nhieu bo, tien do rieng ──
Store.replaceAll({ decks: [], words: [], deleted: [] });
const dX = Store.addDeck('X'); const dY = Store.addDeck('Y');
ok(Store.addWord({ char: '一', pinyin: '', meaning: 'nghia X', note: '' }, dX), 'thêm 一 vào X');
ok(Store.addWord({ char: '一', pinyin: '', meaning: 'nghia Y', note: '' }, dY), 'thêm 一 vào Y (đa bộ)');
const oneX = Store.getWords().find((w) => w.char === '一' && w.deck === dX)!;
const oneY = Store.getWords().find((w) => w.char === '一' && w.deck === dY)!;
ok(oneX.id !== oneY.id && oneX.meaning === 'nghia X' && oneY.meaning === 'nghia Y', '一 ở 2 bộ với id + nghĩa riêng');
Store.updateWord(oneX.id, { reviews: 3 });
ok(Store.getWords().find((w) => w.id === oneX.id)!.reviews === 3 && Store.getWords().find((w) => w.id === oneY.id)!.reviews === 0, 'ôn ở bộ X không ảnh hưởng bộ Y');
Store.removeWord(oneX.id);
ok(Store.getWords().filter((w) => w.char === '一').length === 1 && Store.getWords()[0].deck === dY, 'xóa 一 ở X → vẫn còn 一 ở Y');
// merge: cung chu khac id -> ca hai song
const mAB = mergeBackups(
  { decks: [D('default', '')], words: [W('雨', 0, 0, 'a', '', 1, 'ida')], deleted: [] },
  { decks: [D('default', '')], words: [W('雨', 0, 0, 'b', '', 1, 'idb')], deleted: [] });
ok(mAB.words.length === 2, 'merge: cùng chữ khác id (2 bộ) → giữ cả hai');

console.log('learn.check OK');
