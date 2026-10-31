import { useI18n } from '../i18n';

export default function Hint({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="flex-1 grid place-items-center p-8 text-center">
      <div className="max-w-xs animate-in">
        <span className="font-hanzi text-6xl text-border-2 leading-none select-none" aria-hidden>學</span>
        <p className="mt-5 text-sm text-muted text-balance">{text}</p>
        <a href="#/learn/notes"
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-accent hover:bg-accent-h shadow-[0_6px_16px_-4px_rgb(var(--c-accent)/0.5)] transition-colors">
          {t('noteAdd')}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6l6 6-6 6" /></svg>
        </a>
      </div>
    </div>
  );
}
