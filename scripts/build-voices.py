#!/usr/bin/env python
# Tạo gói giọng đọc offline — chạy MỘT LẦN trên máy dev, không chạy trong app.
#   pip install edge-tts pypinyin   +   ffmpeg trên PATH
#   python scripts/build-voices.py tw            # zh-TW HsiaoChen (nữ)
#   python scripts/build-voices.py cn            # zh-CN Xiaoxiao (nữ)
#   tuỳ chọn: --limit N (thử nhanh)  --out DIR (mặc định public/voices — đóng thẳng vào app)  --jobs 6
# Ra: voice-<id>.bin (các clip ogg/opus nối liền) + voice-<id>.json ({"v":1,"e":{text:[offset,length(,pykey)]}}).
# Chạy lại thì dùng cache clip trong <out>/cache-<id>/ nên tiếp tục được sau khi ngắt.
#
# Vì sao không dùng TTS của máy: chữ đa âm (行 xíng/háng, 长 cháng/zhǎng…) máy đoán sai với người mới
# là học sai. Ở đây mỗi chữ đơn được ép đọc đúng âm ghi trong dict.json: nếu âm mặc định của TTS khác,
# thay bằng một chữ đồng âm chỉ có MỘT cách đọc (TTS không nhận SSML <phoneme>). Không có chữ thay → bỏ,
# app hiện loa xám chứ không đọc bừa. Từ ghép đọc nguyên từ nên TTS tự chọn đúng âm theo ngữ cảnh.
import argparse, asyncio, hashlib, json, os, re, subprocess, sys, time, unicodedata
from pathlib import Path

import edge_tts
from pypinyin import Style, pinyin

VOICES = {'tw': 'zh-TW-HsiaoChenNeural', 'cn': 'zh-CN-XiaoxiaoNeural'}
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'public' / 'data'
TONE = {'ā': 'a1', 'á': 'a2', 'ǎ': 'a3', 'à': 'a4', 'ē': 'e1', 'é': 'e2', 'ě': 'e3', 'è': 'e4', 'ī': 'i1', 'í': 'i2', 'ǐ': 'i3', 'ì': 'i4',
        'ō': 'o1', 'ó': 'o2', 'ǒ': 'o3', 'ò': 'o4', 'ū': 'u1', 'ú': 'u2', 'ǔ': 'u3', 'ù': 'u4', 'ǖ': 'v1', 'ǘ': 'v2', 'ǚ': 'v3', 'ǜ': 'v4',
        'ü': 'v', 'ê': 'e', 'ḿ': 'm2', 'ń': 'n2', 'ň': 'n3', 'ǹ': 'n4'}
FFMPEG_AF = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'


def pykey(py: str) -> str:
    """'zěn me' → 'zen3-me5': so sánh âm bất chấp cách viết dấu."""
    out = []
    for s in py.lower().replace('u:', 'v').split():
        tone, base = '5', ''
        for ch in unicodedata.normalize('NFC', s):
            if ch in TONE:
                r = TONE[ch]; base += r[0]
                if len(r) > 1: tone = r[1]
            else:
                base += ch
        base = re.sub(r'[^a-z]', '', base)
        if base: out.append(base + tone)
    return '-'.join(out)


def load_items(voice_id: str):
    d = json.loads((DATA / 'dict.json').read_text('utf-8'))
    w = json.loads((DATA / 'words.json').read_text('utf-8'))
    t2s = json.loads((DATA / 't2s.json').read_text('utf-8'))
    simp = lambda s: ''.join(t2s.get(c, c) for c in s)

    # Chữ đơn âm (toàn dải CJK) theo âm → chữ, để thay thế chữ đa âm khi TTS mặc định đọc khác dict.
    mono = {}
    for cp in range(0x4E00, 0xA000):
        c = chr(cp); alts = pinyin(c, style=Style.TONE, heteronym=True)[0]
        if len(alts) == 1 and alts[0] != c: mono.setdefault(pykey(alts[0]), c)

    items = {}   # tts_text → set(alias)
    keys = {}    # chữ đơn → pykey của clip (app so với pinyin trong sổ trước khi ghép từng chữ cho từ lạ)
    skipped = []
    for c, (py, _) in d.items():
        if not 0x4E00 <= ord(c) <= 0x9FFF: continue  # ext-A/tương thích: TTS không đọc, người học không gặp
        want = pykey(py.split(',')[0])
        if not want: skipped.append((c, py, 'pinyin rỗng')); continue
        alts = [pykey(a) for a in pinyin(c, style=Style.TONE, heteronym=True)[0]]
        text = c if (not alts or alts[0] == want) else mono.get(want)
        if not text: skipped.append((c, py, 'đa âm, không có chữ đồng âm đơn')); continue
        items.setdefault(text, set()).add(c); keys[c] = want
    groups = {}
    for k, (py, _) in w.items(): groups.setdefault(pykey(py), set()).add(k)
    for forms in groups.values():
        # tw đọc dạng phồn thể, cn dạng giản thể; không có dạng đó (từ viết giống nhau ở cả hai) → lấy dạng đầu
        trad = sorted(f for f in forms if simp(f) != f)
        simpl = sorted(f for f in forms if simp(f) == f)
        text = ((trad if voice_id == 'tw' else simpl) or sorted(forms))[0]
        items.setdefault(text, set()).update(forms)
    return items, keys, skipped


async def synth(text: str, voice: str, cache: Path, sem: asyncio.Semaphore, fails: list) -> bytes | None:
    ogg = cache / (hashlib.md5(text.encode()).hexdigest() + '.ogg')
    if ogg.exists(): return ogg.read_bytes()
    mp3 = ogg.with_suffix('.mp3')
    async with sem:
        for attempt in range(5):
            try:
                await edge_tts.Communicate(text, voice, rate='-10%').save(str(mp3)); break
            except Exception as e:  # mạng / giới hạn tốc độ: lùi dần rồi thử lại
                if attempt == 4: fails.append((text, str(e)[:80])); return None
                await asyncio.sleep(2 * (attempt + 1))
    r = await asyncio.to_thread(subprocess.run, ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(mp3), '-af', FFMPEG_AF,
                                                 '-c:a', 'libopus', '-b:a', '24k', '-vbr', 'on', '-ac', '1', str(ogg)], capture_output=True)
    mp3.unlink(missing_ok=True)
    if r.returncode or not ogg.exists(): fails.append((text, f"ffmpeg: {r.stderr.decode(errors='ignore')[:80]}")); return None
    return ogg.read_bytes()


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('voice', choices=VOICES)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--out', default=str(ROOT / 'public' / 'voices'))
    ap.add_argument('--jobs', type=int, default=6)
    a = ap.parse_args()
    out = Path(a.out); cache = Path('C:/builds/voices') / f'cache-{a.voice}'; cache.mkdir(parents=True, exist_ok=True); out.mkdir(parents=True, exist_ok=True)

    items, keys, skipped = load_items(a.voice)
    texts = sorted(items)[: a.limit or None]
    print(f'{a.voice}: {len(texts)} clip cần tạo ({len(skipped)} chữ bỏ qua) → {out}', flush=True)
    for c, py, why in skipped: print(f'  bỏ {c} ({py}): {why}')

    sem = asyncio.Semaphore(a.jobs); fails = []; done = 0; t0 = time.time()
    async def run(text):
        nonlocal done
        b = await synth(text, VOICES[a.voice], cache, sem, fails); done += 1
        if done % 200 == 0: print(f'  {done}/{len(texts)}  {done / (time.time() - t0):.1f}/s  lỗi {len(fails)}', flush=True)
        return text, b
    results = await asyncio.gather(*(run(t) for t in texts))

    index, blob, off = {}, bytearray(), 0
    for text, b in results:
        if not b: continue
        for alias in items[text]:
            index[unicodedata.normalize('NFC', alias)] = [off, len(b), keys[alias]] if alias in keys else [off, len(b)]
        blob += b; off += len(b)
    (out / f'voice-{a.voice}.bin').write_bytes(blob)
    (out / f'voice-{a.voice}.json').write_text(json.dumps({'v': 1, 'voice': a.voice, 'e': index}, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    print(f'xong: {len(results) - len(fails)} clip, {len(index)} khoá, bin {len(blob) / 1048576:.1f} MB, {time.time() - t0:.0f}s, lỗi {len(fails)}')
    for t, e in fails[:20]: print('  LỖI', t, e)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
