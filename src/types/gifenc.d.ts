// Type declarations for gifenc (no official @types package)
declare module 'gifenc' {
  /** A palette entry: [r, g, b] or [r, g, b, a] */
  type PaletteEntry = number[];
  type Palette = PaletteEntry[];

  interface WriteFrameOptions {
    /** Color palette for this frame */
    palette?: Palette;
    /** Frame delay in centiseconds (1/100 of a second) */
    delay?: number;
    /** Loop count: -1 = play once, 0 = loop forever, >0 = count */
    repeat?: number;
    /** Whether this frame uses a transparent color */
    transparent?: boolean;
    /** Index in palette to treat as transparent */
    transparentIndex?: number;
    /** Disposal method: -1=default, 0=none, 1=keep, 2=clear, 3=restore */
    dispose?: number;
    /** In manual mode only: marks this as the first frame */
    first?: boolean;
    /** Color depth (bits), default 8 */
    colorDepth?: number;
  }

  interface GIFEncoderOptions {
    initialCapacity?: number;
    /** If true (default), auto-writes header on first frame */
    auto?: boolean;
  }

  interface GIFEncoderInstance {
    /**
     * Write an indexed pixel frame.
     * @param index - Uint8Array of palette indices, one per pixel
     * @param width - Frame width in pixels
     * @param height - Frame height in pixels
     * @param opts - Frame options
     */
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: WriteFrameOptions
    ): void;

    /** Write the GIF trailer byte (call once after all frames) */
    finish(): void;

    /** Returns a copy of the encoded bytes */
    bytes(): Uint8Array;

    /** Returns a view of the encoded bytes (zero-copy, invalidated on next write) */
    bytesView(): Uint8Array;

    /** Resets the encoder to its initial state */
    reset(): void;
  }

  /** Creates a new GIF encoder instance */
  export function GIFEncoder(options?: GIFEncoderOptions): GIFEncoderInstance;

  /** Quantize RGBA pixel data into a palette using PNNQuant2 algorithm */
  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean;
      clearAlpha?: boolean;
      clearAlphaColor?: number;
      clearAlphaThreshold?: number;
    }
  ): Palette;

  /** Map RGBA pixel data to nearest palette index per pixel */
  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: Palette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;

  export function prequantize(
    rgba: Uint8ClampedArray | Uint8Array,
    options?: { roundRGB?: number; oneBitAlpha?: boolean; clearAlpha?: boolean }
  ): void;

  export function nearestColorIndex(
    palette: Palette,
    r: number,
    g: number,
    b: number,
    a?: number
  ): number;

  export function nearestColor(
    palette: Palette,
    r: number,
    g: number,
    b: number,
    a?: number
  ): PaletteEntry;

  export default GIFEncoder;
}
