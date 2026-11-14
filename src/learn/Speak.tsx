import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useVoice, initVoice, installVoice, removeVoice, setVoice, setAuto, canSay, say, VOICES, type VoiceId } from './voice';

/**
 * Nút loa + bảng cài giọng (tải gói, chọn Đài/đại lục, tự đọc khi lật thẻ).
 * Chưa tải gói → bấm loa mở bảng. Đã tải mà từ này không có âm chuẩn → loa xám, không đọc.
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

  const ready = !!v.pack;
  const ok = ready && canSay(text, pinyin);
  const label = !ready ? t('voiceSetup') : ok ? t('voiceSpeak') : t('voiceNone');
  const onClick = () => { if (!ready) setOpen(true); else if (ok) say(text, pinyin); };

  return (
    <span ref={box} className={`relative inline-flex items-center ${className}`}>
      <button type="button" onClick={onClick} aria-label={label} title={label} aria-disabled={ready && !ok}
        className={`grid place-items-center w-7 h-7 rounded-lg border transition-colors ${
          ok ? 'bg-surface border-border text-accent hover:border-accent' : ready ? 'bg-surface border-border text-subtle cursor-default' : 'bg-surface border-dashed border-border-2 text-muted hover:text-text'}`}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 10v4h3l4 3.5v-11L7 10H4z" />
          {ok && <path strokeLinecap="round" strokeWidth={1.8} d="M15 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10" />}
          {ready && !ok && <path strokeLinecap="round" strokeWidth={1.8} d="M15 9l5 5m0-5l-5 5" />}
          {!ready && <path strokeLinecap="round" strokeWidth={1.8} d="M17 8v5m0 0l-2-2m2 2l2-2" />}
        </svg>
      </button>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={t('voiceSetup')} aria-expanded={open}
        className="ml-0.5 w-4 h-7 grid place-items-center text-subtle hover:text-text">
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div role="dialog" aria-label={t('voiceSetup')}
          className="absolute left-0 top-9 z-30 w-72 p-3 rounded-2xl bg-surface border border-border shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] animate-in text-left normal-case">
          <p className="text-[11px] text-muted leading-relaxed">{t('voiceIntro')}</p>
          {(Object.keys(VOICES) as VoiceId[]).map((id) => (
            <div key={id} className="mt-2 flex items-center gap-2">
              <label className="flex-1 flex items-center gap-2 text-xs text-text cursor-pointer">
                <input type="radio" name="voice" checked={v.voice === id} onChange={() => void setVoice(id)} />
                {t(id === 'tw' ? 'voiceTw' : 'voiceCn')}
              </label>
              {v.ready[id] ? (
                <>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{t('voiceInstalled')}</span>
                  <button type="button" onClick={() => void removeVoice(id)} className="text-[10px] text-muted hover:text-accent">{t('voiceRemove')}</button>
                </>
              ) : v.progress !== null && v.voice === id ? (
                <span className="text-[10px] text-muted tabular-nums">{t('voiceDownloading', { p: v.progress < 0 ? '…' : Math.round(v.progress * 100) })}</span>
              ) : (
                <button type="button" disabled={v.progress !== null} onClick={() => { void setVoice(id); void installVoice(id); }}
                  className="px-2 py-1 rounded-md text-[10px] font-semibold text-white bg-accent hover:bg-accent-h disabled:opacity-50">{t('voiceDownload', { mb: VOICES[id].mb })}</button>
              )}
            </div>
          ))}
          {v.progress !== null && v.progress >= 0 && (
            <div className="mt-2 h-1 rounded-full bg-surface-2 overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${v.progress * 100}%` }} /></div>
          )}
          {v.error && <p className="mt-2 text-[11px] text-accent break-words" role="alert">{t('voiceErr', { e: v.error })}</p>}
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
