import { memo } from 'react';
import type { GifResult } from '../types';

interface GifPreviewProps {
  result: GifResult;
  index: number;
  onRemove: (index: number) => void;
}

const statusLabel: Record<GifResult['status'], string> = {
  pending: 'Chờ',
  processing: 'Đang xử lý',
  success: 'Xong',
  error: 'Lỗi',
};

const GifPreview = memo(function GifPreview({ result, index, onRemove }: GifPreviewProps) {
  const handleDownload = () => {
    if (!result.url) return;
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
          result.status === 'success' ? 'text-emerald-500' :
          result.status === 'error'   ? 'text-accent' :
          result.status === 'processing' ? 'text-blue-400' : 'text-subtle'
        }`}>
          {statusLabel[result.status]}
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

      {/* Download */}
      {result.status === 'success' && (
        <button
          id={`download-${index}`}
          onClick={handleDownload}
          className="
            mx-2.5 mb-2.5 py-1.5 rounded-lg text-xs font-medium
            bg-accent hover:bg-accent-h text-white transition-colors
          "
        >
          Tải về
        </button>
      )}
    </div>
  );
});

export default GifPreview;
