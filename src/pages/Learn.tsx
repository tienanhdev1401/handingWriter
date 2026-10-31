import { useI18n } from '../i18n';
import TopBar from '../components/TopBar';
import { useWords } from '../learn/store';
import { isDue, getStreak } from '../learn/srs';
import Notes from '../learn/Notes';
import Flashcards from '../learn/Flashcards';
import Shooter from '../learn/Shooter';
import Write from '../learn/Write';

const ICONS = {
  notes: 'M4 5.5A1.5 1.5 0 015.5 4H16l4 4v10.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5v-13zM8 12h8M8 15.5h5',
  cards: 'M7 6h11a2 2 0 012 2v9M4 9h11a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2v-7a2 2 0 012-2z',
  shoot: 'M12 3v3m0 12v3M3 12h3m12 0h3M12 8a4 4 0 100 8 4 4 0 000-8z',
  write: 'M4 20l4.5-1 10-10a2.1 2.1 0 00-3-3l-10 10L4 20zM13.5 7.5l3 3',
} as const;

export default function Learn({ tab }: { tab: string }) {
  const { t } = useI18n();
  const words = useWords();
  const due = words.filter((w) => isDue(w)).length;
  const streak = getStreak();
  const tabs = [['notes', t('tabNotes')], ['cards', t('tabCards')], ['shoot', t('tabShoot')], ['write', t('tabWrite')]] as const;

  return (
    <div className="flex flex-col min-h-[100dvh] md:h-screen text-text ambient grain">
      <TopBar />
      <nav aria-label={t('navLearn')} className="flex items-center gap-1 px-4 sm:px-6 py-2.5 flex-shrink-0 overflow-x-auto">
        {tabs.map(([k, label]) => {
          const active = tab === k;
          return (
            <a key={k} href={`#/learn/${k}`} aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                active ? 'bg-text text-bg shadow-sm' : 'text-muted hover:text-text hover:bg-surface-2'}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={ICONS[k]} />
              </svg>
              {label}
            </a>
          );
        })}
        {words.length > 0 && (
          <div className="ml-auto hidden sm:flex items-center gap-2 pl-3 text-[11px] text-subtle whitespace-nowrap">
            <span>{t('noteCount', { n: words.length })}</span>
            <span aria-hidden>·</span>
            <span className={due ? 'text-text font-medium' : ''}>{t('statsDue', { n: due })}</span>
            <span aria-hidden>·</span>
            <span className={streak ? 'text-accent font-medium' : ''}>{t('statsStreak', { n: streak })}</span>
          </div>
        )}
      </nav>
      <div key={tab} className="flex-1 flex flex-col md:min-h-0 md:overflow-y-auto animate-in">
        {tab === 'cards' ? <Flashcards /> : tab === 'shoot' ? <Shooter /> : tab === 'write' ? <Write /> : <Notes />}
      </div>
    </div>
  );
}
