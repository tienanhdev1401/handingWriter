import { useI18n, LANGS } from '../i18n';
import { useTheme } from '../theme';
import { useHash } from '../route';

export default function TopBar() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const isLearn = useHash().startsWith('#/learn');
  const seg = (active: boolean) =>
    `relative px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight whitespace-nowrap transition-all duration-200 ${
      active ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`;

  return (
    <header className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14 border-b border-border/80 bg-surface/70 backdrop-blur-md flex-shrink-0 z-10">
      <a href="#/gif" className="flex items-center gap-2.5 min-w-0 group">
        <img src="/logo.svg" alt="" width={32} height={32}
          className="w-8 h-8 rounded-lg flex-shrink-0 shadow-[0_4px_12px_-2px_rgb(var(--c-accent)/0.45)] group-hover:scale-105 transition-transform select-none" />
        <div className="min-w-0 leading-tight hidden sm:block">
          <h1 className="text-[13px] font-semibold tracking-tight text-text truncate">{t('appTitle')}</h1>
          <p className="text-[11px] text-subtle truncate">{t('tagline')}</p>
        </div>
      </a>

      <nav aria-label="Primary" className="flex items-center p-1 rounded-xl bg-surface-2 border border-border">
        <a href="#/gif" className={seg(!isLearn)} aria-current={!isLearn ? 'page' : undefined}>{t('navGif')}</a>
        <a href="#/learn/notes" className={seg(isLearn)} aria-current={isLearn ? 'page' : undefined}>{t('navLearn')}</a>
      </nav>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
          title={theme === 'dark' ? t('themeToLight') : t('themeToDark')}
          className="grid place-items-center w-8 h-8 rounded-lg bg-surface-2 border border-border text-muted hover:text-text hover:border-border-2 focus:outline-none focus:ring-1 focus:ring-accent/60"
        >
          {theme === 'dark' ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="4" strokeWidth={1.6} />
              <path strokeLinecap="round" strokeWidth={1.6}
                d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10l1.4 1.4m0-12.8l-1.4 1.4m-10 10l-1.4 1.4" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
            </svg>
          )}
        </button>

        <label>
          <span className="sr-only">Language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="h-8 bg-surface-2 border border-border rounded-lg text-xs font-medium text-muted px-2 cursor-pointer hover:text-text hover:border-border-2 focus:outline-none focus:ring-1 focus:ring-accent/60 transition-colors"
          >
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
      </div>
    </header>
  );
}
