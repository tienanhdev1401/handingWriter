import { memo, useState } from 'react';
import type { GifResult } from '../types';

interface GifPreviewProps {
  result: GifResult;
  index: number;
  onRemove: (index: number) => void;
  saveFolder: string | null;
  onRequestSelectFolder: () => Promise<string | null>;
}

const statusLabel: Record<GifResult['status'], string> = {
  pending: 'Chờ',
  processing: 'Đang xử lý',
  success: 'Xong',
  error: 'Lỗi',
};

const GifPreview = memo(function GifPreview({
  result,
  index,
  onRemove,
  saveFolder,
  onRequestSelectFolder,
}: GifPreviewProps) {
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!result.url) return;

    // ── Electron: lưu trực tiếp ra disk ──────────────────────────────────
    if (window.electronAPI) {
      setSaving(true);
      try {
        // Lấy thư mục lưu (hoặc hỏi chọn lần đầu)
        let folder = saveFolder;
        if (!folder) {
          folder = await onRequestSelectFolder();
          if (!folder) return; // User bấm Cancel
        }

        // Convert blob URL → Uint8Array
        const response = await fetch(result.url);
        const buffer = await response.arrayBuffer();
        const res = await window.electronAPI.saveGifFile(
          `${result.character}.gif`,
          new Uint8Array(buffer)
        );

        if (res.success && res.filePath) {
          setSavedPath(res.filePath);
          // Highlight file trong Finder/Explorer
          await window.electronAPI.showInFolder(res.filePath);
        } else {
          console.error('Save failed:', res.error);
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── Browser fallback: dùng <a> download ──────────────────────────────
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${result.character}.gif`;
    a.click();
  };

  return (
    <div className="
      group relative flex flex-col bg-surface border border-border rounded-xl
      overflow-hidden hover:border-border-2 transition-colors animate-in
    ">
      {/* Remove */}
      <button
        onClick={() => onRemove(index)}
        className="
          absolute top-1.5 right-1.5 z-10 w-5 h-5 flex items-center justify-center
          rounded bg-surface-2 text-subtle hover:text-accent
          opacity-0 group-hover:opacity-100 transition-opacity text-xs
        "
      >×</button>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="font-hanzi text-2xl leading-none text-text">{result.character}</span>
        <span className={`text-[10px] font-medium ${
          result.status === 'success'    ? 'text-emerald-500' :
          result.status === 'error'      ? 'text-accent' :
          result.status === 'processing' ? 'text-blue-400' : 'text-subtle'
        }`}>
          {savedPath ? '✓ Đã lưu' : statusLabel[result.status]}
        </span>
      </div>

      {/* Preview */}
      <div className="mx-2.5 mb-2.5 rounded-lg overflow-hidden bg-surface-2 border border-border flex items-center justify-center min-h-[130px]">
        {result.status === 'processing' && (
          <div className="w-5 h-5 border border-border-2 border-t-accent rounded-full animate-spin" />
        )}
        {result.status === 'pending' && (
          <div className="w-4 h-4 rounded-full bg-border" />
        )}
        {result.status === 'error' && (
          <p className="text-xs text-accent text-center px-3">{result.error}</p>
        )}
        {result.status === 'success' && result.url && (
          <img
            src={result.url}
            alt={result.character}
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Download / Save button */}
      {result.status === 'success' && (
        <button
          id={`download-${index}`}
          onClick={handleDownload}
          disabled={saving}
          className="
            mx-2.5 mb-2.5 py-1.5 rounded-lg text-xs font-medium
            bg-accent hover:bg-accent-h text-white transition-colors
            disabled:opacity-60
          "
        >
          {saving ? 'Đang lưu…' : savedPath ? 'Lưu lại' : 'Tải về'}
        </button>
      )}
    </div>
  );
});

export default GifPreview;
