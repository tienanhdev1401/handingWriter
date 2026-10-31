import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useWords, useStudyWords, updateWord, selectAllDecks } from './store';
import DeckPicker from './DeckPicker';
import { shuffle } from './game';
import { filterScope, grade, bumpStreak, BOXES, type Scope } from './srs';
import StrokeCanvas from './StrokeCanvas';
import ScopePills from './ScopePills';
import Hint from './Hint';

const ghost = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-surface border border-border text-muted hover:text-text hover:border-border-2 hover:-translate-y-px';

export default function Flashcards() {
  const { t } = useI18n();
  const words = useWords();
  const study = useStudyWords();
  const [scope, setScope] = useState<Scope>('all');
  const list = useMemo(() => filterScope(study, scope), [study, scope]);
  const n = list.length;
  const [order, setOrder] = useState<number[]>(() => shuffle(list.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Đổi phạm vi hoặc số thẻ thay đổi (vd. thẻ vừa ôn rời khỏi "cần ôn") → xáo lại từ đầu.
  useEffect(() => {
    setOrder(shuffle(Array.from({ length: n }, (_, i) => i)));
    setPos(0);
    setFlipped(false);
  }, [scope, n]);

  const w = n ? (list[order[pos]] ?? list[0]) : undefined;
  const go = (d: number) => { if (n) setPos((p) => (p + d + n) % n); setFlipped(false); };
  const rate = (ok: boolean) => {
    if (!w || !flipped) return;
    updateWord(w.char, grade(w, ok));
    bumpStreak();
    setFlipped(false);
    setPos((p) => (n ? (p + 1) % n : 0));
  };
  const reshuffle = () => { setOrder((o) => shuffle(o)); setPos(0); setFlipped(false); };

  // Phím tắt đọc hành động mới nhất qua ref → không cần đăng ký lại listener.
  const act = useRef({ go, flip: () => setFlipped((f) => !f), rate });
  act.current = { go, flip: () => setFlipped((f) => !f), rate };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') act.current.go(1);
      else if (e.key === 'ArrowLeft') act.current.go(-1);
      else if (e.key === ' ') { e.preventDefault(); act.current.flip(); }
      else if (e.key === '1') act.current.rate(false);
      else if (e.key === '2') act.current.rate(true);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (words.length === 0) return <Hint text={t('cardNeed')} />;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <DeckPicker className="justify-center max-w-xl" />
      <div className="w-full max-w-sm lg:max-w-lg">
        <div className="flex items-center justify-between gap-3 mb-2">
          <ScopePills value={scope} onChange={setScope} />
          <span className="text-xs text-subtle">{n ? t('cardProgress', { i: pos + 1, n }) : ''}</span>
        </div>
        <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: n ? `${((pos + 1) / n) * 100}%` : 0 }} />
        </div>
      </div>

      {!w ? (
        <div className="w-full max-w-sm lg:max-w-lg aspect-[4/3] grid place-items-center rounded-3xl bg-surface border border-dashed border-border-2 text-center p-6">
          <div>
            <p className="text-sm text-muted">{study.length === 0 ? t('deckStudyEmpty') : t('scopeEmpty')}</p>
            <button type="button" onClick={() => { setScope('all'); selectAllDecks(); }} className={`${ghost} mt-3`}>{t('scopeAll')}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flip w-full max-w-sm lg:max-w-lg aspect-[4/3]">
            <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}
              className={`flip-inner block rounded-3xl text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${flipped ? 'is-flipped' : ''}`}>
              <div className="flip-face grid place-items-center rounded-3xl bg-surface border border-border shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35),inset_0_1px_0_rgb(255_255_255/0.06)]">
                <span className={`font-hanzi leading-none ${[...w.char].length === 1 ? 'text-[7rem] lg:text-[9rem]' : [...w.char].length === 2 ? 'text-[5rem] lg:text-[6.5rem]' : 'text-5xl lg:text-6xl px-4 text-center'}`}>{w.char}</span>
                <span className="absolute bottom-4 text-[11px] text-subtle">{t('cardFront')}</span>
              </div>
              <div className="flip-face flip-back grid place-items-center rounded-3xl bg-surface border border-accent/30 shadow-[0_24px_48px_-24px_rgb(var(--c-accent)/0.35),inset_0_1px_0_rgb(255_255_255/0.06)]">
                <div className="flex flex-col items-center gap-1.5 px-6">
                  <StrokeCanvas char={w.char} size={136} className="lg:hidden" />
                  <StrokeCanvas char={w.char} size={180} className="hidden lg:inline-grid lg:[&_canvas]:inline" />
                  {w.pinyin && <span className="text-xl font-semibold text-accent tracking-tight">{w.pinyin}</span>}
                  {w.meaning && <span className="text-base font-medium line-clamp-2">{w.meaning}</span>}
                  {w.note && <span className="text-xs text-muted leading-relaxed whitespace-pre-wrap line-clamp-2">{w.note}</span>}
                </div>
                <div className="absolute bottom-4 flex items-center gap-1" title={t('cardBox', { b: w.box + 1 })} aria-label={t('cardBox', { b: w.box + 1 })}>
                  {Array.from({ length: BOXES }, (_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= w.box ? 'bg-accent' : 'bg-border-2'}`} />
                  ))}
                </div>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-2">
            <button type="button" onClick={() => go(-1)} className={ghost} aria-label={t('cardPrev')}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6l-6 6 6 6" /></svg>
              {t('cardPrev')}
            </button>
            {flipped ? (
              <>
                <button type="button" onClick={() => rate(false)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-surface border border-accent/40 text-accent hover:bg-accent/10 hover:-translate-y-px">
                  {t('cardForgot')} <span className="opacity-60 font-mono ml-1">1</span>
                </button>
                <button type="button" onClick={() => rate(true)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-[0_8px_20px_-6px_rgb(5_150_105/0.5)] hover:-translate-y-px">
                  {t('cardKnew')} <span className="opacity-70 font-mono ml-1">2</span>
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setFlipped(true)}
                className="px-6 py-2 rounded-xl text-xs font-semibold text-white bg-accent hover:bg-accent-h shadow-[0_8px_20px_-6px_rgb(var(--c-accent)/0.55)] hover:-translate-y-px">
                {t('cardFlip')}
              </button>
            )}
            <button type="button" onClick={() => go(1)} className={ghost} aria-label={t('cardNext')}>
              {t('cardNext')}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" /></svg>
            </button>
            <button type="button" onClick={reshuffle} className={ghost}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h3l8 10h5m0 0l-3-3m3 3l-3 3M4 17h3l2.5-3M20 7h-5l-2.5 3M20 7l-3-3m3 3l-3 3" /></svg>
              {t('cardShuffle')}
            </button>
          </div>
          <p className="text-[11px] text-subtle hidden md:block">{t('cardKeys')}</p>
        </>
      )}
    </div>
  );
}
