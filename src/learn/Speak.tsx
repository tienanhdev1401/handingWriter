import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useVoice, initVoice, setVoice, setAuto, canSay, say, VOICE_IDS } from './voice';

/**
 * Nút loa + bảng chọn giọng (Đài/đại lục, tự đọc khi lật thẻ). Gói đóng sẵn trong app, nạp lười lần đầu.
 * Từ không có âm chuẩn → loa xám, không đọc.
 */
export default function Speak({ text, pinyin = '', autoToggle = false, className = '' }: { text: string; pinyin?: string; autoToggle?: boolean; className?: string }) {
  const { t } = useI18n();
  const v = useVoice();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => { void initVoice(); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', close); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', close); removeEventListener('keydown', esc); };
  }, [open]);

  const ok = !!v.pack && canSay(text, pinyin);
  const label = v.loading ? t('voiceLoading') : v.missing ? t('voiceMissing') : ok ? t('voiceSpeak') : t('voiceNone');

  return (
    <span ref={box} className={`relative inline-flex items-center ${className}`}>
      <button type="button" onClick={() => { if (ok) say(text, pinyin); }} aria-label={label} title={label} aria-disabled={!ok}
        className={`grid place-items-center w-7 h-7 rounded-lg border transition-colors ${
          ok ? 'bg-surface border-border text-accent hover:border-accent' : 'bg-surface border-border text-subtle cursor-default'}`}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 10v4h3l4 3.5v-11L7 10H4z" />
          {ok ? <path strokeLinecap="round" strokeWidth={1.8} d="M15 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10" />
            : v.loading ? <path strokeLinecap="round" strokeWidth={1.8} d="M15 12h5" className="animate-pulse" />
            : <path strokeLinecap="round" strokeWidth={1.8} d="M15 9l5 5m0-5l-5 5" />}
        </svg>
      </button>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={t('voiceSetup')} aria-expanded={open}
        className="ml-0.5 w-4 h-7 grid place-items-center text-subtle hover:text-text">
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div role="dialog" aria-label={t('voiceSetup')}
          className="absolute left-0 top-9 z-30 w-64 p-3 rounded-2xl bg-surface border border-border shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] animate-in text-left normal-case">
          <p className="text-[11px] text-muted leading-relaxed">{t('voiceIntro')}</p>
          {VOICE_IDS.map((id) => (
            <label key={id} className="mt-2 flex items-center gap-2 text-xs text-text cursor-pointer">
              <input type="radio" name="voice" checked={v.voice === id} onChange={() => void setVoice(id)} />
              {t(id === 'tw' ? 'voiceTw' : 'voiceCn')}
            </label>
          ))}
          {autoToggle && (
            <label className="mt-3 flex items-center justify-between gap-2 text-xs text-text cursor-pointer">
              <span>{t('voiceAuto')}</span>
              <input type="checkbox" checked={v.auto} onChange={(e) => setAuto(e.target.checked)} />
            </label>
          )}
        </div>
      )}
    </span>
  );
}
