import type { Word } from './store';

// ── Lặp lại ngắt quãng kiểu Leitner 5 hộp ────────────────────────────────────
// Nhớ → lên một hộp, quên → về hộp 0. Khoảng cách ôn (ngày) theo hộp.
// ponytail: đủ cho vài trăm từ; đổi sang SM-2 khi cần hệ số dễ/khó riêng từng từ.
export const BOXES = 5;
const DAYS = [0, 1, 3, 7, 14];
const DAY = 86_400_000;

export function grade(w: Word, ok: boolean, now = Date.now()): Word {
  const box = ok ? Math.min(w.box + 1, BOXES - 1) : 0;
  return { ...w, box, due: now + DAYS[box] * DAY, reviews: w.reviews + 1, lapses: w.lapses + (ok ? 0 : 1) };
}
export const isDue = (w: Word, now = Date.now()) => w.due <= now;

export type Scope = 'all' | 'due' | 'new';
export const SCOPES: Scope[] = ['all', 'due', 'new'];
export function filterScope(words: readonly Word[], scope: Scope, now = Date.now()): Word[] {
  if (scope === 'due') return words.filter((w) => isDue(w, now));
  if (scope === 'new') return words.filter((w) => w.reviews === 0);
  return [...words];
}

// ── Chuỗi ngày học ───────────────────────────────────────────────────────────
export interface Streak { last: string; count: number }
export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Thuần, dễ test: chuỗi mới sau khi học vào `today`. */
export function nextStreak(prev: Streak | null, today: string, yesterday: string): Streak {
  if (!prev) return { last: today, count: 1 };
  if (prev.last === today) return prev;
  return { last: today, count: prev.last === yesterday ? prev.count + 1 : 1 };
}

const SKEY = 'learn.streak';
function readStreak(): Streak | null {
  try {
    const s = JSON.parse(localStorage.getItem(SKEY) ?? 'null') as Streak | null;
    return s && typeof s.last === 'string' && typeof s.count === 'number' ? s : null;
  } catch { return null; }
}
export function bumpStreak(now = new Date()) {
  const next = nextStreak(readStreak(), dayKey(now), dayKey(new Date(now.getTime() - DAY)));
  try { localStorage.setItem(SKEY, JSON.stringify(next)); } catch { /* ignore */ }
}
/** Chuỗi hiện tại; về 0 nếu hôm qua không học. */
export function getStreak(now = new Date()): number {
  const s = readStreak();
  if (!s) return 0;
  const today = dayKey(now), yesterday = dayKey(new Date(now.getTime() - DAY));
  return s.last === today || s.last === yesterday ? s.count : 0;
}
