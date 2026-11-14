import { useSyncExternalStore } from 'react';

/**
 * Giọng đọc offline. Gói do scripts/build-voices.py tạo sẵn bằng TTS neural (đã ép đúng âm cho chữ đa âm),
 * tải MỘT LẦN rồi lưu Cache Storage — chạy giống nhau trên web, Electron (app://) và Android (WebView).
 * Không có clip chuẩn → không đọc (loa xám); tuyệt đối không rơi về TTS máy đọc sai cho người mới.
 */
export type VoiceId = 'tw' | 'cn';
export const VOICES: Record<VoiceId, { mb: number }> = { tw: { mb: 26 }, cn: { mb: 26 } };
// ponytail: gói đặt ở GitHub Release của repo; đổi host thì sửa dòng này (hoặc localStorage learn.voiceBase để thử cục bộ).
const BASE = localStorage.getItem('learn.voiceBase') || 'https://github.com/tienanhdev1401/handingWriter/releases/download/voices-v1';
const CACHE = 'voices-v1';
const K = { voice: 'learn.voice', auto: 'learn.voiceAuto' };

type Seg = [off: number, len: number, key?: string]; // key: pykey của clip (chỉ chữ đơn)
interface Pack { index: Record<string, Seg>; blob: Blob }
interface State {
  voice: VoiceId;
  auto: boolean;                      // tự đọc khi lật thẻ
  ready: Partial<Record<VoiceId, boolean>>;
  pack: Pack | null;                  // gói của giọng đang chọn (Blob lười, không chiếm RAM)
  progress: number | null;            // 0..1 khi đang tải; -1 = đang tải, chưa rõ kích thước
  error: string;
  checked: boolean;                   // đã dò Cache Storage lần đầu
}
let state: State = {
  voice: localStorage.getItem(K.voice) === 'cn' ? 'cn' : 'tw',
  auto: localStorage.getItem(K.auto) === '1',
  ready: {}, pack: null, progress: null, error: '', checked: false,
};
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const useVoice = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state, () => state);

const hasCache = () => typeof caches !== 'undefined';
const urls = (id: VoiceId) => ({ json: `${BASE}/voice-${id}.json`, bin: `${BASE}/voice-${id}.bin` });
let t2s: Record<string, string> = {}; // dị thể/phồn → giản, để 什麽 tra ra 什么

async function loadPack(id: VoiceId): Promise<Pack | null> {
  if (!hasCache()) return null;
  const c = await caches.open(CACHE), u = urls(id);
  const [j, b] = await Promise.all([c.match(u.json), c.match(u.bin)]);
  if (!j || !b) return null;
  return { index: ((await j.json()) as { e: Record<string, Seg> }).e, blob: await b.blob() };
}

/** Dò gói đã tải + nạp bảng dị thể; gọi nhiều lần vô hại. */
export async function initVoice() {
  if (state.checked) return;
  set({ checked: true });
  t2s = await fetch('/data/t2s.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  if (!hasCache()) return;
  const ready: State['ready'] = {};
  const c = await caches.open(CACHE);
  for (const id of Object.keys(VOICES) as VoiceId[]) ready[id] = !!(await c.match(urls(id).json)) && !!(await c.match(urls(id).bin));
  set({ ready, pack: ready[state.voice] ? await loadPack(state.voice) : null });
}

export async function setVoice(id: VoiceId) {
  try { localStorage.setItem(K.voice, id); } catch { /* ignore */ }
  set({ voice: id, pack: null });
  if (state.ready[id]) set({ pack: await loadPack(id) });
}
export const setAuto = (on: boolean) => { try { localStorage.setItem(K.auto, on ? '1' : '0'); } catch { /* ignore */ } set({ auto: on }); };

/** Tải gói (có tiến độ) rồi cất vào Cache Storage. Lỗi mạng/CORS → state.error, không ném. */
export async function installVoice(id: VoiceId) {
  if (!hasCache()) return set({ error: 'no-cache' });
  set({ progress: -1, error: '' });
  try {
    const u = urls(id);
    const jr = await fetch(u.json); if (!jr.ok) throw new Error(`HTTP ${jr.status}`);
    const jsonBody = await jr.arrayBuffer();
    const br = await fetch(u.bin); if (!br.ok || !br.body) throw new Error(`HTTP ${br.status}`);
    const total = Number(br.headers.get('content-length')) || 0;
    const reader = br.body.getReader(); const chunks: BlobPart[] = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      chunks.push(value); got += value.length;
      set({ progress: total ? got / total : -1 });
    }
    const c = await caches.open(CACHE);
    await c.put(u.json, new Response(jsonBody, { headers: { 'content-type': 'application/json' } }));
    await c.put(u.bin, new Response(new Blob(chunks), { headers: { 'content-type': 'application/octet-stream' } }));
    set({ ready: { ...state.ready, [id]: true }, progress: null, pack: state.voice === id ? await loadPack(id) : state.pack });
  } catch (e) {
    set({ progress: null, error: (e as Error).message || 'failed' });
  }
}

export async function removeVoice(id: VoiceId) {
  if (!hasCache()) return;
  const c = await caches.open(CACHE), u = urls(id);
  await Promise.all([c.delete(u.json), c.delete(u.bin)]);
  set({ ready: { ...state.ready, [id]: false }, pack: state.voice === id ? null : state.pack });
}

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
