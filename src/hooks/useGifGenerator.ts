import { useState, useCallback, useRef } from 'react';
import type { GifResult, GenerationOptions, ProgressCallback } from '../types';
import { getCharacterData } from '../services/hanzi';
import { generateCharacterFrames } from '../utils/canvas';
import { encodeGif } from '../services/gif';

interface UseGifGeneratorReturn {
  results: GifResult[];
  isGenerating: boolean;
  progress: { current: number; total: number; character: string };
  generate: (characters: string[], options: GenerationOptions) => Promise<void>;
  cancel: () => void;
  clearResults: () => void;
  removeResult: (index: number) => void;
}

/** Small helper to yield the event loop so the UI can repaint */
const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

export function useGifGenerator(): UseGifGeneratorReturn {
  const [results, setResults] = useState<GifResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    character: '',
  });

  // Cancel flag — set to true to abort mid-generation
  const cancelRef = useRef(false);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const clearResults = useCallback(() => {
    // Revoke any object URLs to free memory
    setResults((prev) => {
      prev.forEach((r) => {
        if (r.url) URL.revokeObjectURL(r.url);
      });
      return [];
    });
  }, []);

  const removeResult = useCallback((index: number) => {
    setResults((prev) => {
      const r = prev[index];
      if (r?.url) URL.revokeObjectURL(r.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const generate = useCallback(
    async (characters: string[], options: GenerationOptions) => {
      if (characters.length === 0) return;

      cancelRef.current = false;
      setIsGenerating(true);
      setProgress({ current: 0, total: characters.length, character: '' });

      // Initialize all results as pending
      setResults(
        characters.map((char) => ({
          character: char,
          blob: null,
          url: null,
          status: 'pending',
        }))
      );

      const onProgress: ProgressCallback = (current, total, character) => {
        setProgress({ current, total, character });
      };

      for (let i = 0; i < characters.length; i++) {
        if (cancelRef.current) break;

        const char = characters[i];
        onProgress(i + 1, characters.length, char);

        // Mark as processing
        setResults((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'processing' };
          return next;
        });

        await yieldToUI(); // Let React render the "processing" state

        try {
          // 1. Get stroke data from dataset
          const charData = await getCharacterData(char);

          if (!charData) {
            setResults((prev) => {
              const next = [...prev];
              next[i] = {
                ...next[i],
                status: 'error',
                error: 'Không tìm thấy dữ liệu nét cho ký tự này.',
              };
              return next;
            });
            continue;
          }

          await yieldToUI();
          if (cancelRef.current) break;

          // 2. Generate all animation frames
          const frames = generateCharacterFrames(charData, options);

          await yieldToUI();
          if (cancelRef.current) break;

          // 3. Encode frames to GIF
          const blob = await encodeGif(frames, options);
          const url = URL.createObjectURL(blob);

          setResults((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], blob, url, status: 'success' };
            return next;
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định.';
          setResults((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'error', error: message };
            return next;
          });
        }

        // Yield between characters to keep UI responsive
        await yieldToUI();
      }

      setIsGenerating(false);
      if (!cancelRef.current) {
        setProgress((p) => ({ ...p, current: p.total }));
      }
    },
    []
  );

  return {
    results,
    isGenerating,
    progress,
    generate,
    cancel,
    clearResults,
    removeResult,
  };
}
