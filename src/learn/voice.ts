import { useSyncExternalStore } from 'react';

/**
 * Giọng đọc offline, đóng sẵn trong app tại public/voices/ (do scripts/build-voices.py tạo bằng TTS neural,
 * đã ép đúng âm cho chữ đa âm). Không có clip chuẩn → không đọc (loa xám); tuyệt đối không rơi về TTS máy
 * đọc sai cho người mới. Gói nạp lười lần đầu bấm loa (~26 MB/giọng, đọc từ đĩa nên nhanh).
 */
export type VoiceId = 'tw' | 'cn';
export const VOICE_IDS: VoiceId[] = ['tw', 'cn'];
const K = { voice: 'learn.voice', auto: 'learn.voiceAuto' };

type Seg = [off: number, len: number, key?: string]; // key: pykey của clip (chỉ chữ đơn)
interface Pack { index: Record<string, Seg>; blob: Blob }
interface State {
  voice: VoiceId;
  auto: boolean;             // tự đọc khi lật thẻ
  pack: Pack | null;         // gói của giọng đang chọn
  loading: boolean;
  missing: boolean;          // bản build không kèm gói (dev chưa chạy build-voices.py)
}
let state: State = {
  voice: localStorage.getItem(K.voice) === 'cn' ? 'cn' : 'tw',
  auto: localStorage.getItem(K.auto) === '1',
  pack: null, loading: false, missing: false,
};
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useVoice = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);

let t2s: Record<string, string> = {}; // dị thể/phồn → giản, để 什麽 tra ra 什么
const packs: Partial<Record<VoiceId, Promise<Pack | null>>> = {};
const loadPack = (id: VoiceId) => (packs[id] ??= (async () => {
  try {
    const [j, b] = await Promise.all([fetch(`/voices/voice-${id}.json`), fetch(`/voices/voice-${id}.bin`)]);
    if (!j.ok || !b.ok) return null;
    return { index: ((await j.json()) as { e: Record<string, Seg> }).e, blob: await b.blob() };
  } catch { return null; }
})());

/** Nạp gói của giọng đang chọn; gọi nhiều lần vô hại. */
export async function initVoice() {
  if (state.pack || state.loading || state.missing) return;
  set({ loading: true });
  if (!Object.keys(t2s).length) t2s = await fetch('/data/t2s.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const pack = await loadPack(state.voice);
  set({ pack, loading: false, missing: !pack });
}

export async function setVoice(id: VoiceId) {
  try { localStorage.setItem(K.voice, id); } catch { /* ignore */ }
  set({ voice: id, pack: null, loading: true, missing: false });
  const pack = await loadPack(id);
  if (state.voice === id) set({ pack, loading: false, missing: !pack });
}
export const setAuto = (on: boolean) => { try { localStorage.setItem(K.auto, on ? '1' : '0'); } catch { /* ignore */ } set({ auto: on }); };

// ── So âm ──
const TONES: Record<string, string> = {
  ā: 'a1', á: 'a2', ǎ: 'a3', à: 'a4', ē: 'e1', é: 'e2', ě: 'e3', è: 'e4', ī: 'i1', í: 'i2', ǐ: 'i3', ì: 'i4',
  ō: 'o1', ó: 'o2', ǒ: 'o3', ò: 'o4', ū: 'u1', ú: 'u2', ǔ: 'u3', ù: 'u4', ǖ: 'v1', ǘ: 'v2', ǚ: 'v3', ǜ: 'v4',
  ü: 'v', ê: 'e', ḿ: 'm2', ń: 'n2', ň: 'n3', ǹ: 'n4',
};
/** 'zěn me' → 'zen3-me5' — cùng thuật toán với scripts/build-voices.py, để so âm bất chấp cách viết dấu. */
export const pykey = (py: string) =>
  py.toLowerCase().replace(/u:/g, 'v').split(/\s+/).filter(Boolean).map((s) => {
    let tone = '5', base = '';
    for (const ch of s.normalize('NFC')) { const r = TONES[ch]; if (r) { base += r[0]; if (r.length > 1) tone = r[1]; } else base += ch; }
    base = base.replace(/[^a-z]/g, '');
    return base ? base + tone : '';
  }).filter(Boolean).join('-');

const norm = (s: string) => s.normalize('NFC').trim();
const toSimp = (s: string) => [...s].map((c) => t2s[c] ?? c).join('');
const find = (p: Pack, text: string): Seg | undefined => p.index[text] ?? p.index[toSimp(text)];

/**
 * Từ không có clip nguyên từ → được ghép từng chữ CHỈ KHI chắc chắn đọc đúng: pinyin trong sổ tách đúng số chữ,
 * âm từng chữ TRÙNG âm của clip chữ đó (好 clip hǎo thì 愛好 hào không ghép), không có 不/一 (biến điệu theo chữ sau),
 * không có hai thanh 3 liền nhau (nǐ hǎo → ní hǎo). Không đạt → null: im lặng còn hơn đọc sai.
 */
export function safeSplit(text: string, pinyin: string, keyOf: (c: string) => string | undefined): string[] | null {
  const chars = [...norm(text)];
  const keys = pinyin.trim().split(/\s+/).filter(Boolean).map(pykey);
  if (chars.length < 2 || keys.length !== chars.length) return null;
  if (chars.some((c, i) => c === '不' || c === '一' || keyOf(c) !== keys[i])) return null;
  for (let i = 1; i < keys.length; i++) if (keys[i - 1].endsWith('3') && keys[i].endsWith('3')) return null;
  return chars;
}
function segments(p: Pack, text: string, pinyin: string): Seg[] | null {
  const k = norm(text);
  const whole = find(p, k);
  if (whole) return [whole];
  const parts = safeSplit(k, pinyin, (c) => find(p, c)?.[2]);
  return parts ? parts.map((c) => find(p, c) as Seg) : null;
}

/** Có âm chuẩn cho chuỗi này (theo giọng đang chọn) không. */
export const canSay = (text: string, pinyin = '') => !!state.pack && !!segments(state.pack, text, pinyin);

let stop: (() => void) | null = null;
/** Phát; trả về false nếu không có âm chuẩn. Bấm liên tiếp thì cắt lần trước. */
export function say(text: string, pinyin = ''): boolean {
  const p = state.pack, segs = p && segments(p, text, pinyin);
  if (!p || !segs) return false;
  stop?.();
  const srcs = segs.map(([o, l]) => URL.createObjectURL(p.blob.slice(o, o + l, 'audio/ogg')));
  let audio: HTMLAudioElement | null = null, i = 0;
  const done = () => { audio?.pause(); srcs.forEach((u) => URL.revokeObjectURL(u)); if (stop === done) stop = null; };
  stop = done;
  const next = () => {
    if (i >= srcs.length) return done();
    audio = new Audio(srcs[i++]);
    audio.onended = next; audio.onerror = done;
    audio.play().catch(done); // autoplay bị chặn (chưa có tương tác): im lặng
  };
  next();
  return true;
}
