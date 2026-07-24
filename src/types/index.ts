// Character data from Make Me a Hanzi dataset
export interface CharacterData {
  character: string;
  strokes: string[]; // SVG path strings for each stroke
  medians: number[][][]; // Center-line points for each stroke [[x,y], ...]
}

// Result of generating one GIF
export interface GifResult {
  character: string;
  blob: Blob | null;
  url: string | null;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

// Options for GIF generation
export interface GenerationOptions {
  size: 256 | 512 | 1024;
  strokeColor: string;
  outlineColor: string;
  backgroundColor: string;
  strokeSpeed: number; // frames per stroke animation (1-30)
  delayBetweenStrokes: number; // ms between strokes
  finalDelay: number; // ms for final pause
  loop: boolean;
  showStrokeNumbers: boolean;
  showOutline: boolean;
  transparentBackground: boolean;
}

// A single captured animation frame
export interface FrameData {
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
  delay: number; // in ms
}

// Progress callback
export type ProgressCallback = (
  current: number,
  total: number,
  character: string
) => void;

// Default generation options
export const DEFAULT_OPTIONS: GenerationOptions = {
  size: 512,
  strokeColor: '#1a1a2e',
  outlineColor: '#d4d4d4',
  backgroundColor: '#ffffff',
  strokeSpeed: 15,
  delayBetweenStrokes: 350,
  finalDelay: 2000,
  loop: true,
  showStrokeNumbers: true,
  showOutline: true,
  transparentBackground: false,
};
