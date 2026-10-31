// Chạy: npx tsc --ignoreConfig src/learn/learn.check.ts --outDir node_modules/.tmp/chk --module commonjs --target es2023 --skipLibCheck --lib es2023,dom && node node_modules/.tmp/chk/learn.check.js
import './check.stub';
import { makeRound, shuffle, fallSeconds, MIN_WORDS } from './game';
import * as Store from './store';
import { grade, filterScope, nextStreak } from './srs';
import { judge, resample, toScreen, type Pt } from './judge';
import type { Word } from './store';
import { mergeBackups, sameBackup } from './merge';

const ok = (c: boolean, m: string) => { if (!c) throw new Error('FAIL: ' + m); };
const mk = (char: string, i: number): Word => ({ char, pinyin: '', meaning: String(i), note: '', createdAt: 0, box: 0, due: 0, reviews: 0, lapses: 0, deck: 'default' });
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
ok(!Store.addWord({ char: '水', pinyin: '', meaning: '', note: '' }), 'chữ đã có ở bộ khác → từ chối');
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
const D = (id: string, name: string) => ({ id, name, createdAt: 0 });
const W = (char: string, reviews: number, due: number, deck = 'default', note = ''): Word => ({ char, pinyin: '', meaning: '', note, createdAt: 0, box: 0, due, reviews, lapses: 0, deck });
const local = { decks: [D('default', ''), D('shop', 'Mua sắm')], words: [W('買', 3, 100, 'shop', 'local'), W('學', 0, 0)] };
const remote = { decks: [D('default', ''), D('shop', ''), D('hsk', 'HSK 1')], words: [W('買', 5, 50, 'shop', 'remote'), W('水', 2, 10, 'hsk')] };
ok(mergeBackups(local, null) === local, 'không có mây → giữ nguyên local');
const m = mergeBackups(local, remote);
ok(m.decks.length === 3 && m.decks.find((d) => d.id === 'shop')?.name === 'Mua sắm', 'hợp bộ theo id, tên không rỗng thắng');
ok(m.words.length === 3, 'hợp từ theo chữ');
ok(m.words.find((w) => w.char === '買')?.note === 'remote', 'cùng chữ → bản ôn nhiều hơn (reviews 5 > 3) thắng');
const m2 = mergeBackups(remote, local);
ok(sameBackup(m, m2), 'merge giao hoán → hai máy hội tụ');
ok(sameBackup(mergeBackups(m, remote), m), 'merge luỹ đẳng với bản đã hợp');
ok(!sameBackup(local, remote) && sameBackup(local, { decks: [...local.decks].reverse(), words: [...local.words].reverse() }), 'sameBackup bỏ qua thứ tự');
const tie = mergeBackups({ decks: [D('default', '')], words: [W('一', 1, 5, 'default', 'L')] }, { decks: [D('default', '')], words: [W('一', 1, 9, 'default', 'R')] });
ok(tie.words[0].note === 'R', 'hoà reviews → due muộn hơn thắng');

console.log('learn.check OK');
