import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import {
  useWords, useDecks, useCurrentDeck, addWord, addMany, updateWord, removeWord, importWords, exportData,
  addDeck, renameDeck, removeDeck, setCurrentDeck, isHanzi, DEFAULT_DECK, type Word, type Deck,
} from './store';
import { lookup, loadHsk, normalizeHan, fold, HSK_LEVELS, type HskLevel } from './dict';
import StrokeCanvas from './StrokeCanvas';
import { saveBlob } from '../platform';

const field =
  'w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-subtle ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60 hover:border-border-2 transition-all duration-200';
const small = 'w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60';
const tool = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-surface border border-border text-muted hover:text-text hover:border-border-2 disabled:opacity-50';
const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
    on ? 'bg-text text-bg border-text shadow-sm' : 'bg-surface text-muted border-border hover:text-text hover:border-border-2'}`;
const EMPTY = { char: '', pinyin: '', meaning: '', note: '', deck: DEFAULT_DECK };
type Form = typeof EMPTY;
const toForm = (w: Word): Form => ({ char: w.char, pinyin: w.pinyin, meaning: w.meaning, note: w.note, deck: w.deck });
const same = (a: Form, b: Form) => a.pinyin === b.pinyin && a.meaning === b.meaning && a.note === b.note && a.deck === b.deck;

/**
 * Sổ từ. Panel trái = một trình soạn thảo duy nhất: thêm mới, hoặc sửa từ đang chọn
 * (bấm thẻ / double-click chữ). Khi sửa: tự lưu sau 600 ms im lặng, có nút Xong / Xóa.
 */
export default function Notes() {
  const { t } = useI18n();
  const words = useWords();
  const decks = useDecks();
  const current = useCurrentDeck();
  const nameOf = (d: Deck) => d.name || t('deckDefault');
  const cur = decks.find((d) => d.id === current) ?? decks[0];
  const countOf = useMemo(() => { const m = new Map<string, number>(); for (const w of words) m.set(w.deck, (m.get(w.deck) ?? 0) + 1); return m; }, [words]);

  // ── soạn thảo ──
  const [selected, setSelected] = useState<string | null>(null);     // chữ đang sửa; null = thêm mới
  const [form, setForm] = useState<Form>({ ...EMPTY, deck: current });
  const auto = useRef({ pinyin: true, meaning: true });               // ô trống / chưa gõ tay → tự điền
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [saved, setSaved] = useState(false);
  const charInput = useRef<HTMLInputElement>(null);
  const editing = selected ? words.find((w) => w.char === selected) ?? null : null;

  // ── danh sách ──
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [newDeck, setNewDeck] = useState<string | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = fold(q.trim());
  const inDeck = useMemo(() => {
    const list = words.filter((w) => w.deck === current);
    if (!query) return list;
    return list.filter((w) => w.char.includes(query) || fold(w.pinyin).includes(query) || fold(w.meaning).includes(query) || fold(w.note).includes(query));
  }, [words, current, query]);

  // Từ đang sửa bị xóa (ở máy khác qua đồng bộ…) → về chế độ thêm mới
  useEffect(() => { if (selected && !editing) reset(); }, [selected, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setConfirmDel(false); setRename(null); if (!selected) setForm((f) => ({ ...f, deck: current })); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(''), 2600); return () => clearTimeout(id); }, [msg]);
  useEffect(() => { if (!saved) return; const id = setTimeout(() => setSaved(false), 1400); return () => clearTimeout(id); }, [saved]);

  // Tự điền khi THÊM MỚI (sửa thì không ghi đè dữ liệu người dùng)
  const char = normalizeHan(form.char.trim());
  useEffect(() => {
    if (selected) return;
    let live = true;
    const apply = (e: { pinyin: string; meaning: string } | null) =>
      setForm((f) => ({ ...f, pinyin: auto.current.pinyin ? e?.pinyin ?? '' : f.pinyin, meaning: auto.current.meaning ? e?.meaning ?? '' : f.meaning }));
    if (!isHanzi(char)) { apply(null); return; }
    lookup(char).then((e) => { if (live) apply(e); });
    return () => { live = false; };
  }, [char, selected]);

  // Tự lưu khi SỬA: 600 ms sau lần gõ cuối
  useEffect(() => {
    if (!editing || same(form, toForm(editing))) return;
    const id = setTimeout(() => {
      updateWord(editing.char, { pinyin: form.pinyin.trim(), meaning: form.meaning.trim(), note: form.note.trim(), deck: form.deck });
      setSaved(true);
    }, 600);
    return () => clearTimeout(id);
  }, [form, editing]);

  const reset = () => { setSelected(null); setForm({ ...EMPTY, deck: current }); auto.current = { pinyin: true, meaning: true }; setErr(''); };
  const select = (w: Word) => { setSelected(w.char); setForm(toForm(w)); setErr(''); charInput.current?.closest('aside')?.scrollTo({ top: 0, behavior: 'smooth' }); };
  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.value;
    if (!selected && (k === 'pinyin' || k === 'meaning')) auto.current[k] = v.trim() === '';
    setForm((f) => ({ ...f, [k]: v }));
    setErr('');
  };
  const fail = (m: string) => { setErr(m); setShake(true); setTimeout(() => setShake(false), 350); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (selected) { reset(); return; }                                 // chế độ sửa: nút = Xong
    if (!isHanzi(char)) return fail(t('noteErrChar'));
    if (!addWord({ char, pinyin: form.pinyin.trim(), meaning: form.meaning.trim(), note: form.note.trim() }, form.deck)) {
      const owner = decks.find((d) => d.id === words.find((w) => w.char === char)?.deck);
      return fail(t('noteErrDupIn', { d: owner ? nameOf(owner) : '?' }));
    }
    if (form.deck !== current) setCurrentDeck(form.deck);
    setForm({ ...EMPTY, deck: form.deck });
    auto.current = { pinyin: true, meaning: true };
    setMsg(t('noteAdded', { c: char }));
    charInput.current?.focus();
  };
  const remove = () => { if (!editing) return; const c = editing.char; removeWord(c); reset(); setMsg(t('noteDeleted', { c })); };

  const loadLevel = async (l: HskLevel) => {
    setBusy(true);
    try {
      const name = `HSK ${l}`;
      const id = decks.find((d) => d.name === name)?.id ?? addDeck(name);
      setCurrentDeck(id);
      const n = addMany(await loadHsk(l), id);
      setMsg(n ? t('hskAdded', { n, l }) : t('hskNone', { l }));
    } finally { setBusy(false); }
  };
  const exportJson = () => void saveBlob(new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' }), `so-tu-${new Date().toISOString().slice(0, 10)}.json`);
  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setMsg(t('noteImported', { n: importWords(JSON.parse(await f.text())) })); } catch { setMsg(t('noteImportErr')); }
  };
  const createDeck = (e: FormEvent) => { e.preventDefault(); const name = (newDeck ?? '').trim(); if (!name) return; addDeck(name); setNewDeck(null); setMsg(t('deckCreated', { d: name })); };
  const saveRename = (e: FormEvent) => { e.preventDefault(); const name = (rename ?? '').trim(); if (name) renameDeck(current, name); setRename(null); };
  const deleteDeck = () => { if (!confirmDel) { setConfirmDel(true); return; } const name = nameOf(cur); removeDeck(current); setMsg(t('deckDeleted', { d: name })); };

  const deckSelect = (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-muted">{t('deckMove')}</span>
      <select value={form.deck} onChange={set('deck')} className={field}>
        {decks.map((d) => <option key={d.id} value={d.id}>{nameOf(d)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row md:min-h-0">
      {/* ── Panel soạn thảo ── */}
      <aside className="w-full md:w-[380px] lg:w-[420px] md:flex-shrink-0 md:overflow-y-auto p-4 sm:p-5 md:pr-0">
        <form onSubmit={submit} className={`rounded-2xl bg-surface border ${editing ? 'border-accent/40' : 'border-border'} shadow-[0_1px_0_rgb(var(--c-border)),0_12px_32px_-16px_rgb(0_0_0/0.25)] p-5 space-y-4 transition-colors ${shake ? 'animate-shake' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">
                {editing ? t('noteEditTitle') : t('noteFormTitle')}
                {!editing && <span className="text-accent"> · {nameOf(decks.find((d) => d.id === form.deck) ?? cur)}</span>}
              </h2>
              <p className="mt-0.5 text-xs text-muted">{editing ? t('noteEditHint') : t('noteAutoHint')}</p>
            </div>
            {editing && (
              <span className={`flex-shrink-0 text-[11px] font-medium transition-opacity ${saved ? 'text-emerald-600 dark:text-emerald-400 opacity-100' : 'opacity-0'}`} aria-live="polite">
                ✓ {t('noteSaved')}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            {editing ? (
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <StrokeCanvas char={editing.char} size={88} className="flex-shrink-0 rounded-xl bg-surface-2" />
                <div className="min-w-0">
                  <p className="font-hanzi text-4xl leading-none truncate">{editing.char}</p>
                  <p className="mt-1.5 text-[11px] text-subtle">{t('noteReviews', { n: editing.reviews, b: editing.box + 1 })}</p>
                </div>
              </div>
            ) : (
              <>
                <label className="block flex-1 space-y-1.5">
                  <span className="text-[11px] font-medium text-muted">{t('noteChar')}</span>
                  <input ref={charInput} value={form.char} onChange={set('char')} maxLength={16} placeholder="下邊" autoFocus
                    aria-invalid={!!err} className={`${field} font-hanzi text-3xl h-[88px] text-center`} />
                </label>
                <div className="w-[88px] h-[88px] mt-[22px] flex-shrink-0 rounded-xl bg-surface-2 border border-border grid place-items-center overflow-hidden" aria-hidden>
                  {isHanzi(char) ? <StrokeCanvas char={char} size={80} /> : <span className="font-hanzi text-2xl text-border-2 select-none">永</span>}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted">{t('notePinyin')}</span>
              <input value={form.pinyin} onChange={set('pinyin')} placeholder="xué" className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-muted">{t('noteMeaning')}</span>
              <input value={form.meaning} onChange={set('meaning')} placeholder={t('noteMeaningHint')} className={field} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-muted">{t('noteExtra')}</span>
            <textarea value={form.note} onChange={set('note')} rows={editing ? 4 : 2} className={`${field} resize-y min-h-[60px]`} />
          </label>
          {decks.length > 1 && deckSelect}

          <div className="min-h-[18px]" aria-live="polite">{err && <span className="text-xs text-accent font-medium">{err}</span>}</div>

          {editing ? (
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-h">{t('noteDone')}</button>
              <a href={`#/learn/write?w=${encodeURIComponent(editing.char)}`} className="px-3.5 py-2.5 rounded-xl text-sm font-medium bg-surface-2 border border-border text-muted hover:text-text" title={t('tabWrite')}>✍</a>
              <button type="button" onClick={remove} className="px-3.5 py-2.5 rounded-xl text-sm font-medium bg-surface-2 border border-border text-muted hover:text-white hover:bg-accent hover:border-accent" aria-label={t('noteDelete')}>
                {t('noteDelete')}
              </button>
            </div>
          ) : (
            <button type="submit"
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-h shadow-[0_8px_20px_-6px_rgb(var(--c-accent)/0.55)] hover:-translate-y-px">
              {t('noteAddTo', { d: nameOf(decks.find((d) => d.id === form.deck) ?? cur) })}
            </button>
          )}
        </form>

        {!editing && (
          <div className="mt-4 px-1">
            <p className="text-[11px] font-medium text-muted mb-2">{t('presets')}</p>
            <div className="flex flex-wrap gap-2">
              {HSK_LEVELS.map((l) => (
                <button key={l} type="button" disabled={busy} onClick={() => loadLevel(l)} className={tool}>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />{t('hskLoad', { n: l })}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-subtle">{t('hskHint')}</p>
          </div>
        )}
      </aside>

      {/* ── Danh sách ── */}
      <main className="flex-1 min-w-0 md:overflow-y-auto p-4 sm:p-5 md:p-6">
        {/* Bộ từ: xuống dòng, không cuộn ngang */}
        <div role="tablist" aria-label={t('decks')} className="flex flex-wrap items-center gap-1.5 mb-3">
          {decks.map((d) => (
            <button key={d.id} type="button" role="tab" aria-selected={d.id === current} onClick={() => setCurrentDeck(d.id)} className={chip(d.id === current)}>
              {nameOf(d)}<span className={`tabular-nums ${d.id === current ? 'opacity-70' : 'text-subtle'}`}>{countOf.get(d.id) ?? 0}</span>
            </button>
          ))}
          {newDeck === null ? (
            <button type="button" onClick={() => setNewDeck('')} className={`${chip(false)} border-dashed`} aria-label={t('deckNew')}><span aria-hidden>+</span> {t('deckNew')}</button>
          ) : (
            <form onSubmit={createDeck} className="flex items-center gap-1.5">
              <input value={newDeck} onChange={(e) => setNewDeck(e.target.value)} placeholder={t('deckNamePlaceholder')} autoFocus maxLength={40}
                onKeyDown={(e) => { if (e.key === 'Escape') setNewDeck(null); }} className={`${small} w-44`} />
              <button type="submit" className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-accent hover:bg-accent-h">{t('deckCreate')}</button>
              <button type="button" onClick={() => setNewDeck(null)} className="px-2 py-1.5 text-[11px] text-muted hover:text-text">{t('noteCancel')}</button>
            </form>
          )}
        </div>

        {/* Tiêu đề bộ + tìm + quản lý */}
        <div className="flex flex-wrap items-center gap-2 mb-4 min-h-[36px]">
          {rename === null ? (
            <h2 className="text-base font-semibold tracking-tight mr-auto">
              {nameOf(cur)} <span className="text-xs font-normal text-subtle ml-1">{query ? t('noteFound', { n: inDeck.length, total: countOf.get(current) ?? 0 }) : t('noteCount', { n: countOf.get(current) ?? 0 })}</span>
            </h2>
          ) : (
            <form onSubmit={saveRename} className="flex items-center gap-1.5 mr-auto">
              <input value={rename} onChange={(e) => setRename(e.target.value)} autoFocus maxLength={40} onKeyDown={(e) => { if (e.key === 'Escape') setRename(null); }} className={`${small} w-48`} />
              <button type="submit" className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-accent hover:bg-accent-h">{t('noteSave')}</button>
              <button type="button" onClick={() => setRename(null)} className="px-2 py-1.5 text-[11px] text-muted hover:text-text">{t('noteCancel')}</button>
            </form>
          )}
          <label className="relative">
            <span className="sr-only">{t('noteSearch')}</span>
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="7" strokeWidth={1.8} /><path strokeLinecap="round" strokeWidth={1.8} d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('noteSearch')} className={`${small} pl-8 w-44 sm:w-56`} />
          </label>
          {current !== DEFAULT_DECK && rename === null && (
            <>
              <button type="button" onClick={() => setRename(cur.name)} className="text-[11px] text-muted hover:text-text">{t('deckRename')}</button>
              <button type="button" onClick={deleteDeck} onBlur={() => setConfirmDel(false)}
                className={`text-[11px] px-2 py-1 rounded-md ${confirmDel ? 'bg-accent text-white font-semibold' : 'text-muted hover:text-accent'}`}>
                {confirmDel ? t('deckDeleteConfirm', { d: t('deckDefault') }) : t('deckDelete')}
              </button>
            </>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className={tool}>{t('noteImport')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={importJson} className="sr-only" />
          <button type="button" onClick={exportJson} disabled={words.length === 0} className={tool}>{t('noteExport')}</button>
        </div>

        {inDeck.length === 0 ? (
          <div className="min-h-[40vh] grid place-items-center text-center">
            <div className="max-w-xs animate-in">
              <div className="mx-auto w-24 h-24 rounded-2xl bg-surface border border-border grid place-items-center shadow-sm"><StrokeCanvas char="學" size={96} /></div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{query ? t('noteNoMatch') : t('deckEmptyTitle', { d: nameOf(cur) })}</h3>
              {!query && <p className="mt-1.5 text-sm text-muted text-balance">{t('noteEmpty')}</p>}
            </div>
          </div>
        ) : (
          <ul key={current} className="stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {inDeck.map((w, i) => {
              const on = selected === w.char;
              return (
                <li key={w.char} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}>
                  <button type="button" onClick={() => select(w)} onDoubleClick={() => select(w)} aria-pressed={on}
                    title={t('noteOpenHint')}
                    className={`group relative w-full text-left flex gap-4 p-3.5 rounded-2xl bg-surface border transition-all duration-200 hover:shadow-[0_12px_28px_-14px_rgb(0_0_0/0.3)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                      on ? 'border-accent ring-1 ring-accent/40' : 'border-border hover:border-border-2'}`}>
                    <StrokeCanvas char={w.char} size={112} className="flex-shrink-0 rounded-xl bg-surface-2" />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-hanzi text-[28px] leading-none">{w.char}</span>
                        {w.pinyin && <span className="text-sm font-medium text-accent">{w.pinyin}</span>}
                      </div>
                      {w.meaning && <p className="mt-1.5 text-sm font-medium line-clamp-2">{w.meaning}</p>}
                      {w.note && <p className="mt-1 text-xs text-muted leading-relaxed whitespace-pre-wrap line-clamp-2">{w.note}</p>}
                    </div>
                    {w.reviews > 0 && (
                      <span className="absolute top-2 right-2 flex items-center gap-0.5" title={t('cardBox', { b: w.box + 1 })} aria-hidden>
                        {Array.from({ length: 5 }, (_, k) => <span key={k} className={`w-1 h-1 rounded-full ${k <= w.box ? 'bg-accent' : 'bg-border-2'}`} />)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {msg && <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-text text-bg text-xs font-medium shadow-lg animate-in">{msg}</div>}
    </div>
  );
}
