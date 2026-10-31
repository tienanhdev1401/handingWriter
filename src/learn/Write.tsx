import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { CharacterData } from '../types';
import { getCharacterData } from '../services/hanzi';
import { renderFrame } from '../utils/canvas';
import { useI18n } from '../i18n';
import { useWords, useStudyWords, updateWord } from './store';
import DeckPicker from './DeckPicker';
import { grade, bumpStreak } from './srs';
import { judge, toScreen, type Pt } from './judge';
import { beep } from './sound';
import Hint from './Hint';

const SIZE = 360;
const cssRgb = (v: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim()})`;
const ghost = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-surface border border-border text-muted hover:text-text hover:border-border-2 hover:-translate-y-px disabled:opacity-40';

/** Vẽ chữ mờ + các nét đã xong (+ nét gợi ý đang chạy) rồi phủ nét người dùng đang kéo. */
function draw(canvas: HTMLCanvasElement, data: CharacterData, done: number, progress: number, stroke?: Pt[]) {
  renderFrame(canvas, data, { completedStrokes: done, currentStrokeProgress: progress }, {
    size: SIZE, strokeColor: cssRgb('--c-text'), outlineColor: cssRgb('--c-border-2'), backgroundColor: '',
    showOutline: true, showStrokeNumbers: false, transparentBackground: true,
  });
  if (!stroke || stroke.length < 2) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.strokeStyle = cssRgb('--c-accent');
  ctx.lineWidth = SIZE * 0.035;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke[0][0], stroke[0][1]);
  for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i][0], stroke[i][1]);
  ctx.stroke();
  ctx.restore();
}

export default function Write() {
  const { t } = useI18n();
  const all = useWords();
  const words = useStudyWords();
  const [idx, setIdx] = useState(0);
  const word = words.length ? words[idx % words.length] : undefined;
  const chars = word ? [...word.char] : [];
  const [ci, setCi] = useState(0);           // chữ đang luyện trong từ nhiều chữ
  const key = chars[ci] ?? chars[0];
  const [data, setData] = useState<CharacterData | null | undefined>(undefined);
  const [done, setDone] = useState(0);
  const [fails, setFails] = useState(0);   // sai liên tiếp ở nét hiện tại → 3 lần thì gợi ý
  const [misses, setMisses] = useState(0); // tổng sai cả chữ → chấm nhớ/quên
  const [hint, setHint] = useState(false);
  const [flash, setFlash] = useState<'' | 'ok' | 'bad'>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pts = useRef<Pt[]>([]);
  const drawing = useRef(false);

  useEffect(() => { setCi(0); setMisses(0); }, [word?.char]);
  useEffect(() => {
    let live = true;
    setData(undefined); setDone(0); setFails(0); setHint(false); pts.current = [];
    if (!key) return;
    getCharacterData(key).then((d) => { if (live) setData(d ?? null); });
    return () => { live = false; };
  }, [key]);

  useEffect(() => {
    const c = canvasRef.current;
    if (c && data) draw(c, data, done, -1);
  }, [data, done]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!hint || !c || !data) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      draw(c, data, done, Math.min(1, ((now - t0) % 1400) / 1000));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); draw(c, data, done, -1); };
  }, [hint, data, done]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(''), 450);
    return () => clearTimeout(id);
  }, [flash]);

  if (all.length === 0) return <Hint text={t('writeNeed')} />;
  if (!word) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <DeckPicker className="justify-center" />
        <p className="text-sm text-muted">{t('deckStudyEmpty')}</p>
      </div>
    );
  }

  const n = data?.strokes.length ?? 0;
  const charDone = !!data && n > 0 && done >= n;
  const lastChar = ci >= chars.length - 1;
  const finished = charDone && lastChar;
  const pos = (e: PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) * SIZE) / r.width, ((e.clientY - r.top) * SIZE) / r.height];
  };
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!data || charDone) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    pts.current = [pos(e)];
    setHint(false);
  };
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !data) return;
    pts.current.push(pos(e));
    draw(e.currentTarget, data, done, -1, pts.current);
  };
  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !data) return;
    drawing.current = false;
    const ok = judge(pts.current, toScreen(data.medians[done], SIZE), SIZE).ok;
    pts.current = [];
    if (ok) {
      beep('hit'); setFlash('ok'); setFails(0);
      const next = done + 1;
      setDone(next);
      if (next >= n) {
        if (lastChar) { updateWord(word.char, grade(word, misses < 3)); bumpStreak(); }
        else setTimeout(() => setCi((c) => c + 1), 600); // sang chữ tiếp theo trong từ
      }
    } else {
      beep('miss'); setFlash('bad'); setMisses((m) => m + 1);
      const f = fails + 1;
      setFails(f);
      if (f >= 3) setHint(true); else draw(e.currentTarget, data, done, -1);
    }
  };
  const onCancel = () => { drawing.current = false; pts.current = []; };
  const restart = () => { setCi(0); setDone(0); setFails(0); setMisses(0); setHint(false); pts.current = []; };
  const goWord = (d: number) => setIdx((i) => (i + d + words.length) % words.length);
  // Pinyin tách theo âm tiết ("péng you" → ["péng","you"]); chỉ gán theo chữ khi số âm tiết khớp số chữ.
  const syll = word.pinyin.trim().split(/\s+/).filter(Boolean);
  const curPy = chars.length > 1 && syll.length === chars.length ? syll[ci] : '';

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
      <DeckPicker className="justify-center max-w-xl" />
      <div className="w-full max-w-[360px] text-xs space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="font-hanzi text-2xl text-text leading-none">{word.char}</span>
            {word.pinyin && <span className="text-accent font-medium truncate">{word.pinyin}</span>}
          </span>
          <span className="text-subtle flex-shrink-0">{data ? t('writeStroke', { i: Math.min(done + 1, n), n }) : ''}</span>
        </div>
        {chars.length > 1 && (
          <div className="flex items-center gap-1.5">
            {chars.map((c, i) => (
              <span key={i} className={`inline-flex items-baseline gap-1 px-2 py-0.5 rounded-md border ${i === ci ? 'bg-text text-bg border-text' : i < ci ? 'bg-surface-2 text-muted border-border line-through' : 'bg-surface text-muted border-border'}`}>
                <span className="font-hanzi text-sm leading-none">{c}</span>
                {syll.length === chars.length && <span className={`text-[11px] ${i === ci ? 'opacity-80' : ''}`}>{syll[i]}</span>}
              </span>
            ))}
            <span className="ml-auto text-subtle">{t('writeCharOf', { i: ci + 1, n: chars.length })}{curPy ? ` · ${curPy}` : ''}</span>
          </div>
        )}
      </div>

      <div className={`relative rounded-3xl bg-surface border-2 transition-colors duration-200 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)] ${
          flash === 'bad' ? 'border-accent' : flash === 'ok' ? 'border-emerald-500' : finished ? 'border-emerald-500/40' : 'border-border'}`}
        style={{ width: 'min(100%, 360px)', aspectRatio: '1 / 1' }}>
        <svg className="absolute inset-0 w-full h-full text-border pointer-events-none" viewBox="0 0 100 100" aria-hidden>
          <path d="M0 0L100 100M100 0L0 100M50 0V100M0 50H100" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 2" fill="none" />
        </svg>
        {data === null ? (
          <p className="absolute inset-0 grid place-items-center text-xs text-accent px-6 text-center">{t('errNoStroke')}</p>
        ) : (
          <canvas key={`${word.char}-${ci}`} ref={canvasRef} width={SIZE} height={SIZE} role="img" aria-label={key}
            className="relative w-full h-full touch-none cursor-crosshair rounded-3xl"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} />
        )}
        {finished && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center animate-in pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/30">
              {t('writeDone')}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted max-w-xs text-center text-balance">{t('writeIntro')}</p>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => goWord(-1)} className={ghost} aria-label={t('cardPrev')} disabled={words.length < 2}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6l-6 6 6 6" /></svg>
          {t('cardPrev')}
        </button>
        <button type="button" onClick={() => setHint(true)} className={ghost} disabled={!data || charDone}>{t('writeHint')}</button>
        <button type="button" onClick={restart} className={ghost} disabled={!data || (done === 0 && ci === 0)}>{t('writeReset')}</button>
        <button type="button" onClick={() => goWord(1)} disabled={words.length < 2}
          className={finished
            ? 'inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-accent hover:bg-accent-h shadow-[0_8px_20px_-6px_rgb(var(--c-accent)/0.55)] hover:-translate-y-px'
            : ghost}>
          {t('cardNext')}
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
