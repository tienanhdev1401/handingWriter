// Âm báo bằng WebAudio, không cần file. Tắt/bật lưu localStorage.
const KEY = 'learn.sound';
let ctx: AudioContext | null = null;

export const soundOn = () => localStorage.getItem(KEY) !== 'off';
export const setSound = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ } };

export function beep(kind: 'hit' | 'miss') {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.connect(g).connect(ctx.destination);
    if (kind === 'hit') {
      o.frequency.setValueAtTime(660, t);
      o.frequency.exponentialRampToValueAtTime(990, t + 0.08);
    } else {
      o.type = 'square';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.15);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'hit' ? 0.15 : 0.22));
    o.start(t);
    o.stop(t + 0.25);
  } catch { /* autoplay bị chặn hoặc không có AudioContext: im lặng */ }
}
