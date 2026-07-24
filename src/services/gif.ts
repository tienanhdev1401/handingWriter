import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { FrameData, GenerationOptions } from '../types';

/**
 * Converts raw RGBA pixel frames into a GIF Blob using gifenc.
 *
 * Important: gifenc's writeFrame `delay` is in centiseconds (1/100 second),
 * but our FrameData.delay is in milliseconds, so we convert here.
 */
export async function encodeGif(
  frames: FrameData[],
  options: Pick<GenerationOptions, 'loop' | 'transparentBackground'>
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('Không có frame nào để encode');
  }

  const { loop, transparentBackground } = options;
  const { width, height } = frames[0];

  const encoder = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    const { imageData, delay } = frames[i];
    // Convert ms → centiseconds (gifenc unit)
    const centiseconds = Math.max(2, Math.round(delay / 10));

    if (transparentBackground) {
      // rgba4444 format with 1-bit alpha for GIF transparency support
      const palette = quantize(imageData, 256, {
        format: 'rgba4444',
        oneBitAlpha: true,
      });

      const index = applyPalette(imageData, palette, 'rgba4444');

      // Find which palette slot is transparent (alpha component = 0)
      let transparentIndex = -1;
      for (let p = 0; p < palette.length; p++) {
        const entry = palette[p];
        if (entry.length >= 4 && entry[3] === 0) {
          transparentIndex = p;
          break;
        }
      }

      encoder.writeFrame(index, width, height, {
        palette,
        delay: centiseconds,
        // Only set repeat on the first frame (goes into NETSCAPE extension)
        repeat: i === 0 ? (loop ? 0 : -1) : undefined,
        transparent: transparentIndex >= 0,
        transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
      });
    } else {
      // Solid background: rgb565 gives best color quality for GIF's 256-color limit
      const palette = quantize(imageData, 256, { format: 'rgb565' });
      const index = applyPalette(imageData, palette, 'rgb565');

      encoder.writeFrame(index, width, height, {
        palette,
        delay: centiseconds,
        repeat: i === 0 ? (loop ? 0 : -1) : undefined,
      });
    }
  }

  encoder.finish();

  // bytesView() returns a zero-copy view — copy it before creating the Blob
  const rawBytes = encoder.bytesView();
  const safeCopy = new Uint8Array(rawBytes);

  return new Blob([safeCopy], { type: 'image/gif' });
}

/**
 * Triggers a browser download of a Blob as the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
