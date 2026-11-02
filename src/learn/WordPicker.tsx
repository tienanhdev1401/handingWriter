import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Word } from './store';
import { fold } from './dict';

/** Chọn chính xác từ cần viết: ô tìm + lưới chữ; đang chọn được tô đậm. Thu gọn mặc định để không chiếm chỗ. */
export default function WordPicker({ words, index, onPick }: { words: readonly Word[]; index: number; onPick: (i: number) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const cur = words[index];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', close); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', close); removeEventListener('keydown', esc); };
  }, [open]);

  const query = fold(q.trim());
  const list = words.map((w, i) => ({ w, i })).filter(({ w }) => !query || w.char.includes(query) || fold(w.pinyin).includes(query) || fold(w.meaning).includes(query));
  const pick = (i: number) => { onPick(i); setOpen(false); setQ(''); };

  return (
    <div ref={box} className="relative w-full max-w-[360px] lg:max-w-[480px]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs text-muted hover:text-text hover:border-border-2">
        <span className="flex items-center gap-2 min-w-0">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h10M4 18h7" /></svg>
          <span className="truncate">{t('writePick')}</span>
          {cur && <span className="font-hanzi text-base text-text leading-none">{cur.char}</span>}
          <span className="text-subtle tabular-nums">{index + 1}/{words.length}</span>
        </span>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-20 p-3 rounded-2xl bg-surface border border-border shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] animate-in">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('noteSearch')} autoFocus
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60" />
          <div className="mt-2 max-h-64 overflow-y-auto grid grid-cols-4 sm:grid-cols-5 gap-1.5" role="listbox" aria-label={t('writePick')}>
            {list.length === 0 && <p className="col-span-full py-6 text-center text-xs text-subtle">{t('noteNoMatch')}</p>}
            {list.map(({ w, i }) => (
              <button key={w.char} type="button" role="option" aria-selected={i === index} onClick={() => pick(i)} title={`${w.pinyin} · ${w.meaning}`}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg border text-center transition-colors ${
                  i === index ? 'bg-text text-bg border-text' : 'bg-bg border-border text-text hover:border-accent'}`}>
                <span className={`font-hanzi leading-none ${[...w.char].length > 2 ? 'text-base' : 'text-2xl'}`}>{w.char}</span>
                <span className={`text-[10px] truncate w-full ${i === index ? 'opacity-70' : 'text-muted'}`}>{w.pinyin}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
