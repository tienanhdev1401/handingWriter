// Chấm nét người dùng vẽ so với median chuẩn của Make Me a Hanzi (cùng hệ toạ độ canvas).
export type Pt = [number, number];
const HANZI = 1024;

export const toScreen = (median: number[][], size: number): Pt[] =>
  median.map(([x, y]) => [(x * size) / HANZI, size - (y * size) / HANZI]);

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const pathLength = (p: Pt[]) => p.reduce((s, q, i) => (i ? s + dist(p[i - 1], q) : 0), 0);

/** Lấy mẫu lại n điểm cách đều theo chiều dài đường. */
export function resample(p: Pt[], n: number): Pt[] {
  if (p.length === 0) return [];
  const total = pathLength(p);
  if (p.length === 1 || total === 0) return Array.from({ length: n }, () => p[0]);
  const step = total / (n - 1);
  const out: Pt[] = [p[0]];
  let acc = 0;
  for (let i = 1; i < p.length && out.length < n; i++) {
    let a = p[i - 1];
    const b = p[i];
    let seg = dist(a, b);
    while (acc + seg >= step && out.length < n) {
      const t = (step - acc) / seg;
      const q: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(q);
      a = q; seg = dist(a, b); acc = 0;
    }
    acc += seg;
  }
  while (out.length < n) out.push(p[p.length - 1]);
  return out;
}

export interface Verdict { ok: boolean; meanDist: number; startDist: number; lenRatio: number }

/**
 * Đạt khi: đường đi bám median (sai số trung bình ≤ 11% cạnh canvas), bắt đầu đúng đầu nét,
 * và độ dài hợp lý. Nét chấm (median rất ngắn) chỉ cần chạm đúng chỗ.
 */
export function judge(drawn: Pt[], median: Pt[], size: number): Verdict {
  if (drawn.length === 0 || median.length === 0) return { ok: false, meanDist: Infinity, startDist: Infinity, lenRatio: 0 };
  const N = 24;
  const a = resample(drawn, N), b = resample(median, N);
  const meanDist = a.reduce((s, p, i) => s + dist(p, b[i]), 0) / N;
  const startDist = dist(a[0], b[0]);
  const medLen = pathLength(median);
  const lenRatio = pathLength(drawn) / Math.max(medLen, size * 0.05);
  const isDot = medLen < size * 0.1;
  const ok = meanDist <= size * 0.11 && (isDot || (startDist <= size * 0.2 && lenRatio >= 0.45 && lenRatio <= 2.2));
  return { ok, meanDist, startDist, lenRatio };
}
