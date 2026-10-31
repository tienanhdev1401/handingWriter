import { useI18n } from '../i18n';
import { useDecks, useSelection, useWords, toggleDeck, selectAllDecks } from './store';

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
    on ? 'bg-text text-bg border-text' : 'bg-surface text-muted border-border hover:text-text hover:border-border-2'}`;

/** Chọn một hoặc nhiều bộ để học; dùng chung cho Lật thẻ, Bắn chữ, Tập viết. */
export default function DeckPicker({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const decks = useDecks();
  const sel = useSelection();
  const words = useWords();
  if (decks.length < 2) return null; // chỉ có Sổ chung → không cần chọn
  const count = (id: string) => words.filter((w) => w.deck === id).length;
  const on = (id: string) => sel !== null && sel.includes(id);
  return (
    <div role="group" aria-label={t('deckPick')} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="text-[11px] text-subtle mr-0.5">{t('deckPick')}</span>
      <button type="button" aria-pressed={sel === null} onClick={selectAllDecks} className={chip(sel === null)}>
        {t('deckAll')} <span className="opacity-60 tabular-nums">{words.length}</span>
      </button>
      {decks.map((d) => (
        <button key={d.id} type="button" aria-pressed={on(d.id)} onClick={() => toggleDeck(d.id)} className={chip(on(d.id))}>
          {d.name || t('deckDefault')} <span className="opacity-60 tabular-nums">{count(d.id)}</span>
        </button>
      ))}
    </div>
  );
}
