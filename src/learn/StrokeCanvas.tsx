import { useEffect, useRef, useState } from 'react';
import type { CharacterData } from '../types';
import { getCharacterData } from '../services/hanzi';
import { renderFrame } from '../utils/canvas';

const cssRgb = (v: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim()})`;
const PER_STROKE = 350, GAP = 250, END = 1500;

/** Một chữ: vẽ lặp thứ tự nét ngay trên trang (không encode GIF). Không có dữ liệu → hiện chữ thường. */
function One({ char, size, className = '' }: { char: string; size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<CharacterData | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    getCharacterData(char).then((d) => { if (live) setData(d); });
    return () => { live = false; };
  }, [char]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data) return;
    // ponytail: màu đọc 1 lần lúc mount; đổi theme giữa chừng cần đổi trang mới cập nhật.
    const opts = {
      size, strokeColor: cssRgb('--c-text'), outlineColor: cssRgb('--c-border'), backgroundColor: '',
      showOutline: true, showStrokeNumbers: false, transparentBackground: true,
    };
    const n = data.strokes.length, step = PER_STROKE + GAP, total = n * step + END;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) % total, idx = Math.floor(t / step), lt = t - idx * step;
      const state = idx >= n ? { completedStrokes: n, currentStrokeProgress: -1 }
        : lt < PER_STROKE ? { completedStrokes: idx, currentStrokeProgress: lt / PER_STROKE }
        : { completedStrokes: idx + 1, currentStrokeProgress: -1 };
      renderFrame(canvas, data, state, opts);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, size]);

  if (!data) {
    return (
      <span className={`font-hanzi grid place-items-center text-text leading-none ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.6 }} aria-hidden>{char}</span>
    );
  }
  return <canvas ref={ref} width={size} height={size} className={className} role="img" aria-label={char} />;
}

/**
 * Một chữ → một canvas vuông cạnh `size`.
 * Từ nhiều chữ → lưới 2 cột, mỗi chữ cạnh size/2; bề rộng tổng vẫn = size nên mọi chỗ gọi không cần đổi layout.
 */
export default function StrokeCanvas({ char, size = 160, className = '' }: { char: string; size?: number; className?: string }) {
  const chars = [...char];
  if (chars.length <= 1) return <One char={char} size={size} className={className} />;
  const per = Math.round(size * 0.6);
  const cols = Math.min(chars.length, 2);
  return (
    <span role="img" aria-label={char}
      className={`inline-grid content-center justify-items-center ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, ${per}px)`, width: per * cols, minHeight: size }}>
      {chars.map((c, i) => <One key={`${c}-${i}`} char={c} size={per} />)}
    </span>
  );
}
