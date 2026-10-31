import { useI18n } from '../i18n';
import { SCOPES, type Scope } from './srs';

export default function ScopePills({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const { t } = useI18n();
  const label: Record<Scope, string> = { all: t('scopeAll'), due: t('scopeDue'), new: t('scopeNew') };
  return (
    <div role="radiogroup" className="inline-flex p-0.5 rounded-lg bg-surface-2 border border-border">
      {SCOPES.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} onClick={() => onChange(s)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
            value === s ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}>
          {label[s]}
        </button>
      ))}
    </div>
  );
}
