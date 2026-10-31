import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { useWords, useStudyWords, updateWord, selectAllDecks, type Word } from './store';
import DeckPicker from './DeckPicker';
import { makeRound, fallSeconds, MIN_WORDS, type Falling, type Round } from './game';
import { filterScope, grade, bumpStreak, type Scope } from './srs';
import { beep, soundOn, setSound } from './sound';
import ScopePills from './ScopePills';
import Hint from './Hint';

const BEST_KEY = 'learn.shootBest';
const LIVES = 3;
type Mode = 'char' | 'meaning';
const MODES: Mode[] = ['char', 'meaning'];

/** Nghĩa rút gọn để vừa ô rơi: lấy vế đầu, tối đa 28 ký tự. */
const short = (m: string) => m.split(/[;,(]/)[0].trim().slice(0, 28);
const labelOf = (w: Word) => short(w.meaning) || w.pinyin || w.char;

export default function Shooter() {
  const { t } = useI18n();
  const words = useWords();
  const study = useStudyWords();
  const [scope, setScope] = useState<Scope>('all');
  const [mode, setMode] = useState<Mode>('char');
  const [sound, setSoundOn] = useState(soundOn);
  const [phase, setPhase] = useState<'idle' | 'play' | 'over'>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [round, setRound] = useState<Round | null>(null);
  const [roundId, setRoundId] = useState(0);
  const [gone, setGone] = useState<string[]>([]);
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY)) || 0);
  const [startBest] = useState(best);
  const [fx, setFx] = useState<'' | 'pop' | 'shake'>('');

  const pool = filterScope(study, scope);

  useEffect(() => { if (phase === 'play' && lives <= 0) setPhase('over'); }, [phase, lives]);
  useEffect(() => {
    if (score > best) { setBest(score); try { localStorage.setItem(BEST_KEY, String(score)); } catch { /* ignore */ } }
  }, [score, best]);
  useEffect(() => {
    if (!fx) return;
    const id = setTimeout(() => setFx(''), 350);
    return () => clearTimeout(id);
  }, [fx, score, lives]);

  if (words.length < MIN_WORDS) return <Hint text={t('shootNeed', { n: MIN_WORDS })} />;

  const next = () => {
    if (pool.length < MIN_WORDS) { setPhase('over'); return; }
    setRound(makeRound(pool)); setRoundId((r) => r + 1); setGone([]);
  };
  const start = () => { setScore(0); setLives(LIVES); setPhase('play'); next(); };
  const hit = (target: Word) => {
    setScore((s) => s + 1); setFx('pop'); beep('hit');
    updateWord(target.char, grade(target, true)); bumpStreak();
    next();
  };
  const lose = (target: Word) => {
    setLives((l) => l - 1); setFx('shake'); beep('miss');
    updateWord(target.char, grade(target, false));
  };
  const shoot = (f: Falling) => {
    if (phase !== 'play' || !round) return;
    if (f.word === round.target) hit(round.target);
    else { setGone((g) => [...g, f.word.char]); lose(round.target); }
  };
  const landed = (f: Falling) => {
    if (phase !== 'play' || !round) return;
    if (f.word === round.target) { lose(round.target); next(); }
    else setGone((g) => [...g, f.word.char]);
  };
  const toggleSound = () => { setSound(!sound); setSoundOn(!sound); };

  const prompt = round ? round.target.meaning || round.target.pinyin || round.target.note || round.target.char : '';
  const alive = Math.max(0, lives);
  const isNewBest = phase === 'over' && score > startBest && score > 0;
  const canStart = pool.length >= MIN_WORDS;
  // ponytail: ô nghĩa rộng 144px, 4 cột — chồng nhau khi sân < ~600px; chia 2 hàng khi cần mobile.
  // Chế độ chữ: ô rộng theo từ dài nhất trong vòng (1 chữ = 64px, mỗi chữ thêm 36px).
  const longest = round ? Math.max(1, ...round.items.map((f) => [...f.word.char].length)) : 1;
  // ponytail: kích thước ô theo bề rộng cửa sổ lúc render; xoay máy giữa ván → ván sau mới cập nhật.
  const big = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const unit = big ? 80 : 64;
  const tileW = mode === 'char' ? unit + (longest - 1) * (big ? 44 : 36) : big ? 176 : 144;
  const tile = mode === 'char' ? `${big ? 'h-20' : 'h-16'} font-hanzi ${longest > 1 ? (big ? 'text-3xl' : 'text-2xl') + ' px-2 whitespace-nowrap' : big ? 'text-4xl' : 'text-3xl'}` : `${big ? 'h-16 text-sm' : 'h-14 text-xs'} px-2 font-medium leading-tight`;
  const half = tileW / 2;
  const modeLabel: Record<Mode, string> = { char: t('shootModeChar'), meaning: t('shootModeMeaning') };

  return (
    <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
      {/* HUD */}
      <div className="flex items-center justify-between gap-4 py-2 text-xs">
        <div className="flex items-center gap-4">
          <div className={`flex flex-col ${fx === 'pop' ? 'animate-pop' : ''}`}>
            <span className="text-[10px] uppercase tracking-wider text-subtle">{t('shootScore')}</span>
            <span className="text-2xl font-bold tracking-tight leading-none">{score}</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-subtle">{t('shootBest')}</span>
            <span className="text-2xl font-bold tracking-tight leading-none text-muted">{best}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={toggleSound} aria-pressed={sound} aria-label={t('shootSound')} title={t('shootSound')}
            className={`w-8 h-8 grid place-items-center rounded-lg border ${sound ? 'bg-surface border-border text-text' : 'bg-surface-2 border-border text-subtle'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 10v4h3l5 4V6L7 10H4z" />
              {sound ? <path strokeLinecap="round" strokeWidth={1.8} d="M15.5 9.5a3.5 3.5 0 010 5M18 7a7 7 0 010 10" />
                     : <path strokeLinecap="round" strokeWidth={1.8} d="M16 9l5 5m0-5l-5 5" />}
            </svg>
          </button>
          <div className={`flex items-center gap-1.5 ${fx === 'shake' ? 'animate-shake' : ''}`} role="img" aria-label={`${t('shootLives')}: ${alive}`}>
            {Array.from({ length: LIVES }, (_, i) => (
              <svg key={i} className={`w-5 h-5 transition-colors ${i < alive ? 'text-accent' : 'text-border-2'}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.3 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.6 0 5.9 3.5 4.4 7.2C19.5 16.4 12 21 12 21z" />
              </svg>
            ))}
          </div>
        </div>
      </div>

      {/* Sân chơi */}
      <div className="relative flex-1 min-h-[400px] rounded-3xl bg-surface/60 border border-border overflow-hidden shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_24px_48px_-32px_rgb(0_0_0/0.4)]">
        <div className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(rgb(var(--c-border)/0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-border)/0.6) 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }} aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-accent/10 to-transparent pointer-events-none" aria-hidden />

        {phase === 'play' && round && (
          <>
            <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-10">
              <div key={roundId} className="animate-in px-4 py-2 rounded-full bg-bg/80 backdrop-blur border border-border shadow-sm text-center flex items-center gap-2" aria-live="polite">
                <span className="text-[10px] uppercase tracking-wider text-subtle">{mode === 'char' ? t('shootFindLabel') : t('shootFindChar')}</span>
                {mode === 'char'
                  ? <b className="text-base font-semibold tracking-tight">{prompt}</b>
                  : <b className="font-hanzi text-2xl leading-none">{round.target.char}</b>}
              </div>
            </div>
            <div key={roundId}>
              {round.items.filter((f) => !gone.includes(f.word.char)).map((f) => (
                <button key={f.word.char} type="button" onClick={() => shoot(f)} onAnimationEnd={() => landed(f)}
                  className={`absolute grid place-items-center rounded-2xl bg-surface border border-border hover:border-accent hover:bg-accent/10 text-text shadow-[0_10px_24px_-10px_rgb(0_0_0/0.4)] cursor-crosshair ${tile}`}
                  style={{ width: tileW, left: `calc(${f.x}% - ${half}px)`, top: -72, animation: `fall ${fallSeconds(score)}s linear ${f.delay}s forwards` }}>
                  <span className={mode === 'meaning' ? 'line-clamp-2 text-center' : ''}>{mode === 'char' ? f.word.char : labelOf(f.word)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {phase !== 'play' && (
          <div className="absolute inset-0 grid place-items-center p-6 animate-in overflow-y-auto">
            <div className="w-full max-w-sm rounded-3xl bg-surface border border-border p-7 text-center shadow-[0_24px_48px_-24px_rgb(0_0_0/0.4)]">
              {phase === 'over' ? (
                <>
                  <p className="text-[11px] uppercase tracking-wider text-subtle">{isNewBest ? t('shootNewBest') : t('shootOver')}</p>
                  <p className={`mt-1 text-6xl font-bold tracking-tight ${isNewBest ? 'text-accent' : ''}`}>{score}</p>
                </>
              ) : (
                <>
                  <span className="font-hanzi text-5xl text-accent leading-none select-none" aria-hidden>射</span>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight">{t('tabShoot')}</h2>
                </>
              )}

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <div role="radiogroup" className="inline-flex p-0.5 rounded-lg bg-surface-2 border border-border">
                  {MODES.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${mode === m ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}>
                      {modeLabel[m]}
                    </button>
                  ))}
                </div>
                <ScopePills value={scope} onChange={setScope} />
              </div>
              <DeckPicker className="mt-3 justify-center" />

              <ol className="mt-5 space-y-2 text-left">
                {[t('shootRule1'), t('shootRule2'), t('shootRule3')].map((r, i) => (
                  <li key={i} className="flex gap-3 text-xs text-muted leading-relaxed">
                    <span className="flex-shrink-0 w-5 h-5 rounded-md bg-surface-2 border border-border grid place-items-center text-[10px] font-semibold text-text">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>

              {!canStart && (
                <p className="mt-4 text-xs text-accent">
                  {t('shootNeedScope', { n: MIN_WORDS })}{' '}
                  <button type="button" onClick={() => { setScope('all'); selectAllDecks(); }} className="underline font-medium">{t('scopeAll')}</button>
                </p>
              )}
              <button type="button" onClick={start} autoFocus disabled={!canStart}
                className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-h shadow-[0_8px_20px_-6px_rgb(var(--c-accent)/0.55)] hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0">
                {phase === 'over' ? t('shootAgain') : t('shootStart')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
