import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import {
  useWords, useDecks, useCurrentDeck, addWord, addMany, updateWord, removeWord, importWords, exportData,
  addDeck, renameDeck, removeDeck, setCurrentDeck, isHanzi, DEFAULT_DECK, type Word, type Deck,
} from './store';
import { lookup, loadHsk, normalizeHan, HSK_LEVELS, type HskLevel } from './dict';
import StrokeCanvas from './StrokeCanvas';
import { saveBlob } from '../platform';

const field =
  'w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm text-text placeholder:text-subtle ' +
  'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60 hover:border-border-2 transition-all duration-200';
const small = 'w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60';
const tool = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-surface border border-border text-muted hover:text-text hover:border-border-2 disabled:opacity-50';
const tab = (on: boolean) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
    on ? 'bg-text text-bg border-text shadow-sm' : 'bg-surface text-muted border-border hover:text-text hover:border-border-2'}`;
const EMPTY = { char: '', pinyin: '', meaning: '', note: '' };

export default function Notes() {
  const { t } = useI18n();
  const words = useWords();
  const decks = useDecks();
  const current = useCurrentDeck();
  const nameOf = (d: Deck) => d.name || t('deckDefault');
  const cur = decks.find((d) => d.id === current) ?? decks[0];
  const inDeck = words.filter((w) => w.deck === current);

  const [form, setForm] = useState(EMPTY);
  const auto = useRef({ pinyin: true, meaning: true }); // ô trống / chưa gõ tay → tự điền từ từ điển
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY, deck: DEFAULT_DECK });
  const [busy, setBusy] = useState(false);
  const [newDeck, setNewDeck] = useState<string | null>(null);   // null = đóng
  const [rename, setRename] = useState<string | null>(null);     // null = đóng
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const char = normalizeHan(form.char.trim());
  useEffect(() => {
    let live = true;
    // Ô tự điền luôn phản ánh chữ hiện tại: tra trượt (hoặc xóa chữ) → xóa, không để lại pinyin của chữ trước.
    const apply = (e: { pinyin: string; meaning: string } | null) =>
      setForm((f) => ({ ...f, pinyin: auto.current.pinyin ? e?.pinyin ?? '' : f.pinyin, meaning: auto.current.meaning ? e?.meaning ?? '' : f.meaning }));
    if (!isHanzi(char)) { apply(null); return; }
    lookup(char).then((e) => { if (live) apply(e); });
    return () => { live = false; };
  }, [char]);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(''), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  useEffect(() => { setConfirmDel(false); setRename(null); setEditing(null); }, [current]);

  const set = (k: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (k === 'pinyin' || k === 'meaning') auto.current[k] = v.trim() === '';
    setForm((f) => ({ ...f, [k]: v }));
    setErr('');
  };
  const fail = (m: string) => { setErr(m); setShake(true); setTimeout(() => setShake(false), 350); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isHanzi(char)) return fail(t('noteErrChar'));
    if (!addWord({ char, pinyin: form.pinyin.trim(), meaning: form.meaning.trim(), note: form.note.trim() })) {
      const owner = decks.find((d) => d.id === words.find((w) => w.char === char)?.deck);
      return fail(t('noteErrDupIn', { d: owner ? nameOf(owner) : '?' }));
    }
    setForm(EMPTY);
    auto.current = { pinyin: true, meaning: true };
  };

  /** Nạp HSK vào bộ riêng tên "HSK n" (tạo nếu chưa có). */
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
  const exportJson = () => {
    void saveBlob(new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' }), `so-tu-${new Date().toISOString().slice(0, 10)}.json`);
  };
  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setMsg(t('noteImported', { n: importWords(JSON.parse(await f.text())) })); }
    catch { setMsg(t('noteImportErr')); }
  };
  const createDeck = (e: FormEvent) => {
    e.preventDefault();
    const name = (newDeck ?? '').trim();
    if (!name) return;
    addDeck(name);
    setNewDeck(null);
    setMsg(t('deckCreated', { d: name }));
  };
  const saveRename = (e: FormEvent) => {
    e.preventDefault();
    const name = (rename ?? '').trim();
    if (name) renameDeck(current, name);
    setRename(null);
  };
  const deleteDeck = () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    const name = nameOf(cur);
    removeDeck(current);
    setMsg(t('deckDeleted', { d: name }));
  };
  const startEdit = (w: Word) => { setEditing(w.char); setDraft({ char: w.char, pinyin: w.pinyin, meaning: w.meaning, note: w.note, deck: w.deck }); };
  const saveEdit = () => {
    if (!editing) return;
    updateWord(editing, { pinyin: draft.pinyin.trim(), meaning: draft.meaning.trim(), note: draft.note.trim(), deck: draft.deck });
    setEditing(null);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row md:min-h-0">
      <aside className="w-full md:w-[360px] md:flex-shrink-0 md:overflow-y-auto p-4 sm:p-5 md:pr-0">
        <form onSubmit={submit} className={`rounded-2xl bg-surface border border-border shadow-[0_1px_0_rgb(var(--c-border)),0_12px_32px_-16px_rgb(0_0_0/0.25)] p-5 space-y-4 ${shake ? 'animate-shake' : ''}`}>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {t('noteFormTitle')} <span className="text-accent">· {nameOf(cur)}</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted">{t('noteAutoHint')}</p>
          </div>

          <div className="flex gap-3">
            <label className="block flex-1 space-y-1.5">
              <span className="text-[11px] font-medium text-muted">{t('noteChar')}</span>
              <input value={form.char} onChange={set('char')} maxLength={16} placeholder="下邊" autoFocus
                aria-invalid={!!err} className={`${field} font-hanzi text-3xl h-[72px] text-center`} />
            </label>
            <div className="w-[72px] h-[72px] mt-[22px] flex-shrink-0 rounded-xl bg-surface-2 border border-border grid place-items-center overflow-hidden" aria-hidden>
              {isHanzi(char)
                ? <StrokeCanvas char={char} size={64} />
                : <span className="font-hanzi text-2xl text-border-2 select-none">永</span>}
            </div>
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
            <textarea value={form.note} onChange={set('note')} rows={2} className={`${field} resize-none`} />
          </label>

          <div className="min-h-[18px]" aria-live="polite">
            {err && <span className="text-xs text-accent font-medium">{err}</span>}
          </div>
          <button type="submit"
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-h shadow-[0_8px_20px_-6px_rgb(var(--c-accent)/0.55)] hover:shadow-[0_10px_24px_-6px_rgb(var(--c-accent)/0.6)] hover:-translate-y-px">
            {t('noteAddTo', { d: nameOf(cur) })}
          </button>
        </form>

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
      </aside>

      <main className="flex-1 min-w-0 md:overflow-y-auto p-4 sm:p-5 md:p-6">
        {/* Tab bộ từ */}
        <div className="flex items-center gap-2 mb-3">
          <div role="tablist" aria-label={t('decks')} className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0 pb-1">
            {decks.map((d) => (
              <button key={d.id} type="button" role="tab" aria-selected={d.id === current} onClick={() => setCurrentDeck(d.id)} className={tab(d.id === current)}>
                {nameOf(d)}
                <span className={`tabular-nums ${d.id === current ? 'opacity-70' : 'text-subtle'}`}>{words.filter((w) => w.deck === d.id).length}</span>
              </button>
            ))}
            {newDeck === null ? (
              <button type="button" onClick={() => setNewDeck('')} className={`${tab(false)} border-dashed`} aria-label={t('deckNew')}>
                <span aria-hidden>+</span> {t('deckNew')}
              </button>
            ) : (
              <form onSubmit={createDeck} className="flex items-center gap-1.5">
                <input value={newDeck} onChange={(e) => setNewDeck(e.target.value)} placeholder={t('deckNamePlaceholder')} autoFocus maxLength={40}
                  onKeyDown={(e) => { if (e.key === 'Escape') setNewDeck(null); }} className={`${small} w-44`} />
                <button type="submit" className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-accent hover:bg-accent-h">{t('deckCreate')}</button>
                <button type="button" onClick={() => setNewDeck(null)} className="px-2 py-1.5 text-[11px] text-muted hover:text-text">{t('noteCancel')}</button>
              </form>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => fileRef.current?.click()} className={tool}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
              {t('noteImport')}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={importJson} className="sr-only" />
            <button type="button" onClick={exportJson} disabled={words.length === 0} className={tool}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v12m0 0l-4-4m4 4l4-4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
              {t('noteExport')}
            </button>
          </div>
        </div>

        {/* Tiêu đề bộ + quản lý */}
        <div className="flex flex-wrap items-center gap-2 mb-4 min-h-[32px]">
          {rename === null ? (
            <h2 className="text-base font-semibold tracking-tight mr-auto">
              {nameOf(cur)} <span className="text-xs font-normal text-subtle ml-1">{t('noteCount', { n: inDeck.length })}</span>
            </h2>
          ) : (
            <form onSubmit={saveRename} className="flex items-center gap-1.5 mr-auto">
              <input value={rename} onChange={(e) => setRename(e.target.value)} autoFocus maxLength={40}
                onKeyDown={(e) => { if (e.key === 'Escape') setRename(null); }} className={`${small} w-48`} />
              <button type="submit" className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-accent hover:bg-accent-h">{t('noteSave')}</button>
              <button type="button" onClick={() => setRename(null)} className="px-2 py-1.5 text-[11px] text-muted hover:text-text">{t('noteCancel')}</button>
            </form>
          )}
          {current !== DEFAULT_DECK && rename === null && (
            <>
              <button type="button" onClick={() => setRename(cur.name)} className="text-[11px] text-muted hover:text-text">{t('deckRename')}</button>
              <button type="button" onClick={deleteDeck} onBlur={() => setConfirmDel(false)}
                className={`text-[11px] px-2 py-1 rounded-md ${confirmDel ? 'bg-accent text-white font-semibold' : 'text-muted hover:text-accent'}`}>
                {confirmDel ? t('deckDeleteConfirm', { d: t('deckDefault') }) : t('deckDelete')}
              </button>
            </>
          )}
        </div>

        {inDeck.length === 0 ? (
          <div className="min-h-[40vh] grid place-items-center text-center">
            <div className="max-w-xs animate-in">
              <div className="mx-auto w-24 h-24 rounded-2xl bg-surface border border-border grid place-items-center shadow-sm">
                <StrokeCanvas char="學" size={80} />
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{t('deckEmptyTitle', { d: nameOf(cur) })}</h3>
              <p className="mt-1.5 text-sm text-muted text-balance">{t('noteEmpty')}</p>
            </div>
          </div>
        ) : (
          <ul key={current} className="stagger grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {inDeck.map((w, i) => (
              <li key={w.char} style={{ '--i': Math.min(i, 12) } as React.CSSProperties}
                className="group relative flex gap-4 p-3.5 rounded-2xl bg-surface border border-border hover:border-border-2 hover:shadow-[0_12px_28px_-14px_rgb(0_0_0/0.3)] hover:-translate-y-0.5 transition-all duration-200">
                <StrokeCanvas char={w.char} size={88} className="flex-shrink-0 rounded-xl bg-surface-2" />
                {editing === w.char ? (
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-hanzi text-2xl leading-none">{w.char}</span>
                      <input value={draft.pinyin} onChange={(e) => setDraft({ ...draft, pinyin: e.target.value })} placeholder={t('notePinyin')} className={small} autoFocus />
                    </div>
                    <input value={draft.meaning} onChange={(e) => setDraft({ ...draft, meaning: e.target.value })} placeholder={t('noteMeaning')} className={small} />
                    <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder={t('noteExtra')} className={small} />
                    <label className="flex items-center gap-2 text-[11px] text-muted">
                      {t('deckMove')}
                      <select value={draft.deck} onChange={(e) => setDraft({ ...draft, deck: e.target.value })} className={`${small} flex-1`}>
                        {decks.map((d) => <option key={d.id} value={d.id}>{nameOf(d)}</option>)}
                      </select>
                    </label>
                    <div className="flex gap-2 pt-0.5">
                      <button type="button" onClick={saveEdit} className="px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-accent hover:bg-accent-h">{t('noteSave')}</button>
                      <button type="button" onClick={() => setEditing(null)} className="px-3 py-1 rounded-lg text-[11px] font-medium text-muted hover:text-text">{t('noteCancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-hanzi text-[28px] leading-none">{w.char}</span>
                      {w.pinyin && <span className="text-sm font-medium text-accent">{w.pinyin}</span>}
                    </div>
                    {w.meaning && <p className="mt-1.5 text-sm font-medium line-clamp-2">{w.meaning}</p>}
                    {w.note && <p className="mt-1 text-xs text-muted leading-relaxed whitespace-pre-wrap line-clamp-2">{w.note}</p>}
                  </div>
                )}
                {editing !== w.char && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button type="button" onClick={() => startEdit(w)} aria-label={`${t('noteEdit')} ${w.char}`}
                      className="w-6 h-6 grid place-items-center rounded-md bg-surface-2 text-subtle hover:text-text">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20l4.5-1 10-10a2.1 2.1 0 00-3-3l-10 10L4 20z" /></svg>
                    </button>
                    <button type="button" onClick={() => removeWord(w.char)} aria-label={`${t('noteDelete')} ${w.char}`}
                      className="w-6 h-6 grid place-items-center rounded-md bg-surface-2 text-subtle hover:text-white hover:bg-accent text-sm leading-none">
                      ×
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {msg && (
        <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-text text-bg text-xs font-medium shadow-lg animate-in">
          {msg}
        </div>
      )}
    </div>
  );
}
