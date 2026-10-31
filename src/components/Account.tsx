import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { isFirebaseConfigured } from '../firebase.config';
import { useCloud, canGoogle, signInGoogle, signInEmail, signUpEmail, signOut, type SyncStatus } from '../learn/cloud';

const field = 'w-full bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60';
const DOT: Record<SyncStatus, string> = { idle: 'bg-border-2', syncing: 'bg-amber-500 animate-pulse', synced: 'bg-emerald-500', error: 'bg-accent' };

/** Nút tài khoản trên TopBar: đăng nhập Google / email, trạng thái đồng bộ, đăng xuất. Ẩn khi chưa cấu hình Firebase. */
export default function Account() {
  const { t } = useI18n();
  const { user, status, error, ready } = useCloud();
  const [open, setOpen] = useState(false);
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', close); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', close); removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => { if (user) { setOpen(false); setPw(''); } }, [user]);

  if (!isFirebaseConfigured) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); }
    catch (e) { setErr(t('authFailed', { e: (e as { code?: string; message: string }).code ?? (e as Error).message })); }
    finally { setBusy(false); }
  };
  const submitEmail = (e: FormEvent) => { e.preventDefault(); void run(() => (create ? signUpEmail(email, pw) : signInEmail(email, pw))); };
  const statusText: Record<SyncStatus, string> = { idle: t('syncIdle'), syncing: t('syncSyncing'), synced: t('syncSynced'), error: t('syncError') };
  const initial = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <div ref={box} className="relative">
      {user ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('account')} title={`${user.email ?? ''} · ${statusText[status]}`}
          className="relative grid place-items-center w-8 h-8 rounded-lg bg-surface-2 border border-border text-xs font-semibold text-text hover:border-border-2">
          {user.photoURL ? <img src={user.photoURL} alt="" className="w-6 h-6 rounded-md" referrerPolicy="no-referrer" /> : initial}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${DOT[status]}`} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={!ready}
          className="h-8 px-3 rounded-lg text-xs font-semibold text-white bg-accent hover:bg-accent-h disabled:opacity-50">
          {t('signIn')}
        </button>
      )}

      {open && (
        <div role="dialog" aria-label={t('account')}
          className="absolute right-0 top-10 z-30 w-72 p-4 rounded-2xl bg-surface border border-border shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] animate-in">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-surface-2 border border-border font-semibold text-sm">{initial}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName || user.email}</p>
                  {user.displayName && <p className="text-[11px] text-muted truncate">{user.email}</p>}
                </div>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted">
                <span className={`w-2 h-2 rounded-full ${DOT[status]}`} aria-hidden />{statusText[status]}
                {status === 'error' && error && <span className="text-accent truncate" title={error}>· {error}</span>}
              </p>
              <button type="button" onClick={() => void run(signOut)} disabled={busy}
                className="w-full py-2 rounded-lg text-xs font-medium bg-surface-2 border border-border text-muted hover:text-text disabled:opacity-50">
                {t('signOut')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted leading-relaxed">{t('syncIntro')}</p>
              {canGoogle() && (
                <>
                  <button type="button" onClick={() => void run(signInGoogle)} disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-text text-bg hover:opacity-90 disabled:opacity-50">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"/><path fill="currentColor" opacity=".7" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="currentColor" opacity=".5" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="currentColor" opacity=".85" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/></svg>
                    {t('signInGoogle')}
                  </button>
                  <p className="text-[11px] text-subtle text-center">{t('orEmail')}</p>
                </>
              )}
              <form onSubmit={submitEmail} className="space-y-2">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('email')} autoComplete="email" required className={field} />
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('password')} autoComplete={create ? 'new-password' : 'current-password'} required minLength={6} className={field} />
                <button type="submit" disabled={busy}
                  className="w-full py-2 rounded-lg text-xs font-semibold text-white bg-accent hover:bg-accent-h disabled:opacity-50">
                  {create ? t('createAccount') : t('signInEmail')}
                </button>
              </form>
              <button type="button" onClick={() => { setCreate((c) => !c); setErr(''); }} className="w-full text-[11px] text-muted hover:text-text">
                {create ? t('switchToSignIn') : t('switchToCreate')}
              </button>
              {err && <p className="text-[11px] text-accent break-words" role="alert">{err}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
