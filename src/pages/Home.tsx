import { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import type { GenerationOptions } from '../types';
import { DEFAULT_OPTIONS } from '../types';
import { useGifGenerator } from '../hooks/useGifGenerator';
import { preloadDataset } from '../services/hanzi';
import GifPreview from '../components/GifPreview';
import OptionsPanel from '../components/OptionsPanel';

type DatasetStatus = 'idle' | 'loading' | 'ready' | 'error';

function extractChineseChars(input: string): string[] {
  const seen = new Set<string>();
  const chars: string[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isCJK =
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df) ||
      (code >= 0xf900 && code <= 0xfaff);
    if (isCJK && !seen.has(ch)) {
      seen.add(ch);
      chars.push(ch);
    }
  }
  return chars;
}

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_OPTIONS);
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus>('idle');
  const [datasetCount, setDatasetCount] = useState(0);
  const [error, setError] = useState('');
  const [saveFolder, setSaveFolder] = useState<string | null>(null);

  const { results, isGenerating, progress, generate, cancel, clearResults, removeResult } =
    useGifGenerator();

  useEffect(() => {
    setDatasetStatus('loading');
    preloadDataset()
      .then((n) => { setDatasetCount(n); setDatasetStatus('ready'); })
      .catch(() => setDatasetStatus('error'));

    // Khôi phục thư mục lưu đã chọn trước đó (chỉ trong Electron)
    if (window.electronAPI) {
      window.electronAPI.getSaveFolder().then(setSaveFolder);
    }
  }, []);

  const charList = extractChineseChars(inputText);

  // Chọn thư mục lưu mới
  const handleSelectFolder = useCallback(async (): Promise<string | null> => {
    if (!window.electronAPI) return null;
    const folder = await window.electronAPI.selectSaveFolder();
    if (folder) setSaveFolder(folder);
    return folder;
  }, []);

  // Xóa thư mục đã chọn
  const handleClearFolder = useCallback(async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.clearSaveFolder();
    setSaveFolder(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    setError('');
    if (!inputText.trim()) { setError('Vui lòng nhập ký tự.'); return; }
    if (charList.length === 0) { setError('Không phát hiện chữ Hán hợp lệ.'); return; }
    if (charList.length > 200) { setError('Tối đa 200 ký tự mỗi lần.'); return; }
    clearResults();
    await generate(charList, options);
  }, [inputText, charList, options, generate, clearResults]);

  const handleDownloadZip = useCallback(async () => {
    const ok = results.filter((r) => r.status === 'success' && r.blob);
    if (!ok.length) return;
    const zip = new JSZip();
    ok.forEach((r) => { if (r.blob) zip.file(`${r.character}.gif`, r.blob); });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'hanzi-gifs.zip'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [results]);

  const successCount = results.filter((r) => r.status === 'success').length;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-3xl mx-auto px-5 py-12 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-text mb-1">
            Tạo GIF nét chữ Hán
          </h1>
          <p className="text-muted text-sm">
            {datasetStatus === 'ready' && `${datasetCount.toLocaleString()} ký tự · Offline`}
            {datasetStatus === 'loading' && 'Đang tải dữ liệu…'}
            {datasetStatus === 'error' && (
              <span className="text-accent">Lỗi tải dữ liệu — kiểm tra public/data/graphics.txt</span>
            )}
          </p>
        </header>

        {/* ── Input ──────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <textarea
            id="hanzi-input"
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); setError(''); }}
            disabled={isGenerating}
            placeholder="你好&#10;学习&#10;中华人民共和国"
            rows={4}
            className="
              w-full bg-surface border border-border rounded-lg
              px-4 py-3 text-xl font-hanzi text-text
              placeholder:text-subtle placeholder:text-sm placeholder:font-sans
              focus:outline-none focus:ring-1 focus:ring-accent/60 focus:border-accent/40
              resize-none disabled:opacity-50 transition-colors
            "
          />
          <div className="flex items-center justify-between">
            {error
              ? <span className="text-xs text-accent">{error}</span>
              : <span className="text-xs text-subtle">
                  {charList.length > 0 ? `${charList.length} ký tự` : ''}
                </span>
            }
          </div>
        </section>

        {/* ── Quick Options Row ───────────────────────────────────────────── */}
        <section className="flex flex-wrap items-center gap-5">
          {/* Size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted whitespace-nowrap">Kích thước</span>
            <div className="flex gap-1">
              {([256, 512, 1024] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, size: s }))}
                  disabled={isGenerating}
                  className={`
                    px-2.5 py-1 rounded text-xs font-medium transition-colors
                    ${options.size === s
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-muted hover:text-text border border-border'}
                    disabled:opacity-40
                  `}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Stroke numbers toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Số nét</span>
            <button
              type="button"
              role="switch"
              aria-checked={options.showStrokeNumbers}
              disabled={isGenerating}
              onClick={() => setOptions((o) => ({ ...o, showStrokeNumbers: !o.showStrokeNumbers }))}
              className={`
                relative w-8 h-4.5 rounded-full transition-colors
                ${options.showStrokeNumbers ? 'bg-accent' : 'bg-surface-2 border border-border'}
                disabled:opacity-40
              `}
              style={{ height: '18px' }}
            >
              <span className={`
                absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm
                transition-transform duration-150
                ${options.showStrokeNumbers ? 'left-[calc(100%-15px)]' : 'left-0.5'}
              `} />
            </button>
          </div>
        </section>

        {/* ── Advanced Options (collapsible) ─────────────────────────────── */}
        <OptionsPanel options={options} onChange={setOptions} disabled={isGenerating} />

        {/* ── Save Folder (chỉ hiển thị trong Electron) ───────────────────── */}
        {window.electronAPI && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface border border-border">
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-3.5 h-3.5 text-subtle flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              {saveFolder ? (
                <span className="text-xs text-muted truncate" title={saveFolder}>
                  {saveFolder.split(/[\\/]/).pop()}
                </span>
              ) : (
                <span className="text-xs text-subtle italic">Chưa chọn thư mục lưu</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleSelectFolder}
                className="text-xs text-muted hover:text-text transition-colors"
              >
                {saveFolder ? 'Thay đổi' : 'Chọn thư mục'}
              </button>
              {saveFolder && (
                <button
                  type="button"
                  onClick={handleClearFolder}
                  className="text-xs text-subtle hover:text-accent transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {!isGenerating ? (
            <button
              id="generate-btn"
              onClick={handleGenerate}
              disabled={datasetStatus !== 'ready'}
              className="
                flex-1 py-2.5 rounded-lg text-sm font-semibold text-white
                bg-accent hover:bg-accent-h
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              Tạo GIF
            </button>
          ) : (
            <button
              id="cancel-btn"
              onClick={cancel}
              className="
                flex-1 py-2.5 rounded-lg text-sm font-medium
                bg-surface-2 border border-border text-muted hover:text-text
                transition-colors
              "
            >
              Hủy
            </button>
          )}

          {successCount >= 2 && !isGenerating && (
            <button
              id="download-zip-btn"
              onClick={handleDownloadZip}
              className="
                px-4 py-2.5 rounded-lg text-sm font-medium
                bg-surface-2 border border-border text-muted hover:text-text
                transition-colors
              "
            >
              ZIP ({successCount})
            </button>
          )}
        </div>

        {/* ── Progress ────────────────────────────────────────────────────── */}
        {progress.total > 0 && (
          <div className="space-y-1.5 animate-in">
            <div className="flex justify-between text-xs text-muted">
              <span>
                {isGenerating
                  ? `Đang xử lý "${progress.character}"…`
                  : `Hoàn thành ${successCount}/${progress.total}`}
              </span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div className="h-px bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {results.length > 0 && (
          <section className="space-y-3 animate-in">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted uppercase tracking-wider">
                Kết quả · {results.length} ký tự
              </span>
              <button
                onClick={clearResults}
                disabled={isGenerating}
                className="text-xs text-subtle hover:text-accent transition-colors disabled:opacity-40"
              >
                Xóa tất cả
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {results.map((r, i) => (
                <GifPreview
                  key={`${r.character}-${i}`}
                  result={r}
                  index={i}
                  onRemove={removeResult}
                  saveFolder={saveFolder}
                  onRequestSelectFolder={handleSelectFolder}
                />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
