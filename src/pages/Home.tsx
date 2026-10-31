import { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import type { GenerationOptions } from '../types';
import { DEFAULT_OPTIONS } from '../types';
import { useGifGenerator } from '../hooks/useGifGenerator';
import { preloadDataset } from '../services/hanzi';
import { useI18n } from '../i18n';
import TopBar from '../components/TopBar';
import GifPreview from '../components/GifPreview';
import { saveBlob } from '../platform';
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
  const { t } = useI18n();
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
    if (!inputText.trim()) { setError(t('errEmpty')); return; }
    if (charList.length === 0) { setError(t('errNoHanzi')); return; }
    if (charList.length > 200) { setError(t('errTooMany')); return; }
    clearResults();
    await generate(charList, options);
  }, [inputText, charList, options, generate, clearResults, t]);

  const handleDownloadZip = useCallback(async () => {
    const ok = results.filter((r) => r.status === 'success' && r.blob);
    if (!ok.length) return;
    const zip = new JSZip();
    ok.forEach((r) => { if (r.blob) zip.file(`${r.character}.gif`, r.blob); });
    await saveBlob(await zip.generateAsync({ type: 'blob' }), 'hanzi-gifs.zip');
  }, [results]);

  const successCount = results.filter((r) => r.status === 'success').length;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const showEmpty = results.length === 0 && !isGenerating && progress.total === 0;

  return (
    <div className="flex flex-col min-h-screen md:h-screen bg-bg text-text">

      <TopBar />

      {/* ── Workbench ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row md:min-h-0">

        {/* Panel điều khiển (trái) */}
        <aside className="
          w-full md:w-[380px] md:flex-shrink-0
          border-b md:border-b-0 md:border-r border-border
          bg-surface md:overflow-y-auto
        ">
          <div className="p-5 space-y-5">

            {/* Dataset badge */}
            <div className="text-[11px]">
              {datasetStatus === 'ready' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-2 border border-border text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {t('datasetReady', { n: datasetCount.toLocaleString() })}
                </span>
              )}
              {datasetStatus === 'loading' && (
                <span className="text-muted">{t('datasetLoading')}</span>
              )}
              {datasetStatus === 'error' && (
                <span className="text-accent">{t('datasetError')}</span>
              )}
            </div>

            {/* Input */}
            <section className="space-y-2">
              <label htmlFor="hanzi-input" className="block text-[11px] text-muted font-medium">
                {t('inputLabel')}
              </label>
              <textarea
                id="hanzi-input"
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); setError(''); }}
                disabled={isGenerating}
                placeholder="你好&#10;学习&#10;中华人民共和国"
                rows={4}
                className="
                  w-full bg-bg border border-border rounded-lg
                  px-4 py-3 text-xl font-hanzi text-text
                  placeholder:text-subtle placeholder:text-sm placeholder:font-sans
                  focus:outline-none focus:ring-1 focus:ring-accent/60 focus:border-accent/40
                  resize-none disabled:opacity-50 transition-colors
                "
              />
              <div className="min-h-[16px]">
                {error
                  ? <span className="text-xs text-accent">{error}</span>
                  : charList.length > 0
                    ? <span className="text-xs text-subtle">{t('charCount', { n: charList.length })}</span>
                    : null
                }
              </div>
            </section>

            {/* Quick options */}
            <section className="space-y-3">
              {/* Size */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted">{t('size')}</span>
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
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted">{t('strokeNumbers')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={options.showStrokeNumbers}
                  disabled={isGenerating}
                  onClick={() => setOptions((o) => ({ ...o, showStrokeNumbers: !o.showStrokeNumbers }))}
                  className={`
                    relative w-8 rounded-full transition-colors flex-shrink-0
                    ${options.showStrokeNumbers ? 'bg-accent' : 'bg-border'}
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

            {/* Advanced options */}
            <OptionsPanel options={options} onChange={setOptions} disabled={isGenerating} />

            {/* Save folder (Electron) */}
            {window.electronAPI && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-bg border border-border">
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
                    <span className="text-xs text-subtle italic">{t('folderNone')}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="text-xs text-muted hover:text-text transition-colors"
                  >
                    {saveFolder ? t('folderChange') : t('folderChoose')}
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

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {!isGenerating ? (
                <button
                  id="generate-btn"
                  onClick={handleGenerate}
                  disabled={datasetStatus !== 'ready'}
                  className="
                    w-full py-2.5 rounded-lg text-sm font-semibold text-white
                    bg-accent hover:bg-accent-h
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors
                  "
                >
                  {t('generate')}
                </button>
              ) : (
                <button
                  id="cancel-btn"
                  onClick={cancel}
                  className="
                    w-full py-2.5 rounded-lg text-sm font-medium
                    bg-surface-2 border border-border text-muted hover:text-text
                    transition-colors
                  "
                >
                  {t('cancel')}
                </button>
              )}

              {successCount >= 2 && !isGenerating && (
                <button
                  id="download-zip-btn"
                  onClick={handleDownloadZip}
                  className="
                    w-full py-2.5 rounded-lg text-sm font-medium
                    bg-surface-2 border border-border text-muted hover:text-text
                    transition-colors
                  "
                >
                  {t('zip', { n: successCount })}
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Canvas kết quả (phải) */}
        <main className="flex-1 min-w-0 md:overflow-y-auto bg-bg">
          {showEmpty ? (
            <div className="min-h-[45vh] md:h-full grid place-items-center p-8">
              {datasetStatus === 'ready' ? (
                <div className="flex flex-col items-center text-center animate-in">
                  <span className="font-hanzi text-7xl text-border-2 leading-none select-none" aria-hidden>永</span>
                  <p className="mt-5 text-sm text-muted">
                    {t('emptyHint')} <span className="text-text font-medium">{t('generate')}</span>
                  </p>
                  <p className="mt-1.5 text-xs text-subtle max-w-xs">{t('emptyLine2')}</p>
                </div>
              ) : (
                <span className="text-sm text-subtle">
                  {datasetStatus === 'error' ? t('datasetError') : t('datasetLoading')}
                </span>
              )}
            </div>
          ) : (
            <div className="p-5 md:p-6 space-y-4">
              {/* Header + progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">
                    {t('resultsHeader', { n: results.length })}
                  </span>
                  <button
                    onClick={clearResults}
                    disabled={isGenerating}
                    className="text-xs text-subtle hover:text-accent transition-colors disabled:opacity-40"
                  >
                    {t('clearAll')}
                  </button>
                </div>

                {progress.total > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted">
                      <span>
                        {isGenerating
                          ? t('processingChar', { c: progress.character })
                          : t('doneCount', { n: successCount, total: progress.total })}
                      </span>
                      <span className="font-mono">{pct}%</span>
                    </div>
                    <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
