import type { Word } from './store';

export interface Falling { word: Word; x: number; delay: number }
export interface Round { target: Word; items: Falling[] }

export const MIN_WORDS = 4;

export function shuffle<T>(a: readonly T[], rng = Math.random): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 1 chữ đúng + 3 chữ nhiễu, chia đều theo cột để không chồng nhau. */
export function makeRound(words: readonly Word[], rng = Math.random): Round {
  if (words.length < MIN_WORDS) throw new Error(`need ${MIN_WORDS} words`);
  const [target, ...rest] = shuffle(words, rng);
  const picked = shuffle([target, ...rest.slice(0, MIN_WORDS - 1)], rng);
  const col = 100 / MIN_WORDS;
  const items = picked.map((word, i) => ({ word, x: (i + 0.5) * col + (rng() - 0.5) * 10, delay: rng() * 1.2 }));
  return { target, items };
}

/** Thời gian rơi (giây): nhanh dần theo điểm, chạm sàn 2.5s. */
export const fallSeconds = (score: number) => Math.max(2.5, 6 - score * 0.2);
