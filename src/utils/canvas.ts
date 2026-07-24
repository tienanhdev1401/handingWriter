import type { CharacterData, GenerationOptions, FrameData } from '../types';

/** Make Me a Hanzi uses a 1024×1024 coordinate space */
const HANZI_COORD_SIZE = 1024;

/** Half-width of the clip mask polygon in coordinate units */
const CLIP_HALF_WIDTH = 160;

// ─── Coordinate Transform ────────────────────────────────────────────────────

/**
 * Apply the Make Me a Hanzi → Canvas coordinate transform.
 * MakeMeAHanzi: origin bottom-left, y increases upward.
 * Canvas: origin top-left, y increases downward.
 */
function applyHanziTransform(ctx: CanvasRenderingContext2D, size: number): void {
  const scale = size / HANZI_COORD_SIZE;
  ctx.translate(0, size);
  ctx.scale(scale, -scale);
}

// ─── Stroke Drawing ──────────────────────────────────────────────────────────

function drawStrokeFull(
  ctx: CanvasRenderingContext2D,
  svgPath: string,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(svgPath));
}

function drawAllCompletedStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: string[],
  count: number,
  color: string
): void {
  for (let i = 0; i < count; i++) {
    drawStrokeFull(ctx, strokes[i], color);
  }
}

// ─── Stroke Number Badges (drawn in screen space, after transform restore) ───

/**
 * Draw a small circular number badge at the tip of a completed stroke.
 * Drawn in screen coordinates (after the hanzi transform has been restored).
 *
 * @param ctx         - Canvas 2D context (must be in screen space, not hanzi space)
 * @param median      - The median path points for this stroke (hanzi coordinates)
 * @param strokeIndex - Zero-based stroke index
 * @param size        - Canvas pixel size
 * @param strokeColor - The stroke fill color (badge outline uses a softer version)
 * @param bgColor     - Background color for the badge circle
 */
function drawStrokeNumberBadge(
  ctx: CanvasRenderingContext2D,
  median: number[][],
  strokeIndex: number,
  size: number,
  strokeColor: string,
  bgColor: string
): void {
  if (!median || median.length === 0) return;

  const scale = size / HANZI_COORD_SIZE;

  // Tip of the stroke = last median point, converted to screen space
  const tip = median[median.length - 1];
  const tipX = tip[0] * scale;
  const tipY = size - tip[1] * scale; // flip Y

  // Compute stroke end direction (second-to-last → last median point, in screen space)
  let dirX = 0;
  let dirY = 0;
  if (median.length >= 2) {
    const prev = median[median.length - 2];
    const prevScreenX = prev[0] * scale;
    const prevScreenY = size - prev[1] * scale;
    dirX = tipX - prevScreenX;
    dirY = tipY - prevScreenY;
    const len = Math.hypot(dirX, dirY);
    if (len > 0.001) { dirX /= len; dirY /= len; }
  } else {
    // Fallback: push badge slightly upward
    dirX = 0; dirY = -1;
  }

  const radius = Math.max(9, size * 0.028);
  const fontSize = Math.max(7, size * 0.03);

  // Offset the badge center beyond the stroke tip: radius + gap so it doesn't touch the stroke
  const gap = radius * 0.55;
  const screenX = tipX + dirX * (radius + gap);
  const screenY = tipY + dirY * (radius + gap);

  ctx.save();

  // Shadow for readability over the stroke
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 3;

  // Badge circle fill
  ctx.beginPath();
  ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Badge border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(1, size * 0.0025);
  ctx.stroke();

  // Number text
  ctx.fillStyle = strokeColor;
  ctx.font = `bold ${fontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(strokeIndex + 1), screenX, screenY);

  ctx.restore();
}

// ─── Progressive Clip Mask ───────────────────────────────────────────────────

interface Point2D {
  x: number;
  y: number;
}

function interpolateMedian(medians: number[][], progress: number): Point2D[] {
  if (medians.length === 0) return [];
  if (progress >= 1) return medians.map(([x, y]) => ({ x, y }));
  if (progress <= 0) return [{ x: medians[0][0], y: medians[0][1] }];

  const totalSegments = medians.length - 1;
  const floatPos = progress * totalSegments;
  const segIndex = Math.min(Math.floor(floatPos), totalSegments - 1);
  const segFrac = floatPos - segIndex;

  const pts: Point2D[] = medians
    .slice(0, segIndex + 1)
    .map(([x, y]) => ({ x, y }));

  // Add the interpolated point at the current stroke tip
  const p0 = medians[segIndex];
  const p1 = medians[segIndex + 1] ?? medians[segIndex];
  pts.push({
    x: p0[0] + (p1[0] - p0[0]) * segFrac,
    y: p0[1] + (p1[1] - p0[1]) * segFrac,
  });

  return pts;
}

function getDirection(pts: Point2D[], idx: number): Point2D {
  if (pts.length < 2) return { x: 1, y: 0 };
  if (idx === 0) {
    return { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
  }
  if (idx === pts.length - 1) {
    return {
      x: pts[idx].x - pts[idx - 1].x,
      y: pts[idx].y - pts[idx - 1].y,
    };
  }
  return {
    x: pts[idx + 1].x - pts[idx - 1].x,
    y: pts[idx + 1].y - pts[idx - 1].y,
  };
}

/**
 * Builds a convex-capsule clip path that covers the stroke up to `progress`.
 * Uses the median path to determine the visible region.
 */
function buildProgressClipPath(
  ctx: CanvasRenderingContext2D,
  medians: number[][],
  progress: number
): void {
  const pts = interpolateMedian(medians, progress);
  if (pts.length === 0) return;

  const hw = CLIP_HALF_WIDTH;

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, hw, 0, Math.PI * 2);
    ctx.clip();
    return;
  }

  // Compute normals (perpendicular to direction, scaled by half-width)
  const leftSide: Point2D[] = [];
  const rightSide: Point2D[] = [];

  for (let i = 0; i < pts.length; i++) {
    const dir = getDirection(pts, i);
    const len = Math.hypot(dir.x, dir.y);
    if (len < 0.001) {
      leftSide.push({ x: pts[i].x, y: pts[i].y });
      rightSide.push({ x: pts[i].x, y: pts[i].y });
      continue;
    }
    // Normal = perpendicular rotated 90°
    const nx = (-dir.y / len) * hw;
    const ny = (dir.x / len) * hw;
    leftSide.push({ x: pts[i].x + nx, y: pts[i].y + ny });
    rightSide.push({ x: pts[i].x - nx, y: pts[i].y - ny });
  }

  ctx.beginPath();

  // Start cap (semicircle at the beginning)
  const startDir = getDirection(pts, 0);
  const startAngle = Math.atan2(startDir.y, startDir.x);
  ctx.arc(pts[0].x, pts[0].y, hw, startAngle + Math.PI / 2, startAngle + (Math.PI * 3) / 2);

  // Right side: from start to end
  for (const p of rightSide) {
    ctx.lineTo(p.x, p.y);
  }

  // End cap (semicircle at the stroke tip)
  const endDir = getDirection(pts, pts.length - 1);
  const endAngle = Math.atan2(endDir.y, endDir.x);
  ctx.arc(
    pts[pts.length - 1].x,
    pts[pts.length - 1].y,
    hw,
    endAngle - Math.PI / 2,
    endAngle + Math.PI / 2
  );

  // Left side: from end back to start
  for (let i = leftSide.length - 1; i >= 0; i--) {
    ctx.lineTo(leftSide[i].x, leftSide[i].y);
  }

  ctx.closePath();
  ctx.clip();
}

// ─── Frame Renderer ──────────────────────────────────────────────────────────

export interface RenderState {
  /** Number of fully completed strokes */
  completedStrokes: number;
  /** Progress of the current (next) stroke: 0.0–1.0, or -1 if no active stroke */
  currentStrokeProgress: number;
}

/**
 * Renders a single animation frame onto the canvas.
 *
 * @param canvas  - The target canvas element
 * @param data    - Character stroke data from Make Me a Hanzi
 * @param state   - Which strokes are complete and current progress
 * @param options - Visual options
 */
export function renderFrame(
  canvas: HTMLCanvasElement,
  data: CharacterData,
  state: RenderState,
  options: Pick<
    GenerationOptions,
    | 'size'
    | 'strokeColor'
    | 'outlineColor'
    | 'backgroundColor'
    | 'showOutline'
    | 'showStrokeNumbers'
    | 'transparentBackground'
  >
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  const {
    size,
    strokeColor,
    outlineColor,
    backgroundColor,
    showOutline,
    showStrokeNumbers,
    transparentBackground,
  } = options;

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Background
  if (!transparentBackground) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
  }

  // ── Hanzi coordinate space ────────────────────────────────────────────────
  ctx.save();
  applyHanziTransform(ctx, size);

  // ① Outline: all strokes in light outline color
  if (showOutline) {
    for (const stroke of data.strokes) {
      drawStrokeFull(ctx, stroke, outlineColor);
    }
  }

  // ② Completed strokes: fully filled in stroke color
  drawAllCompletedStrokes(ctx, data.strokes, state.completedStrokes, strokeColor);

  // ③ Current stroke: progressively revealed
  const { completedStrokes, currentStrokeProgress } = state;
  if (currentStrokeProgress > 0 && completedStrokes < data.strokes.length) {
    const strokePath = data.strokes[completedStrokes];
    const medians = data.medians[completedStrokes] as number[][];

    if (currentStrokeProgress >= 1 || !medians || medians.length < 2) {
      // Draw the full stroke (edge case: no medians or at 100%)
      drawStrokeFull(ctx, strokePath, strokeColor);
    } else {
      ctx.save();
      buildProgressClipPath(ctx, medians, currentStrokeProgress);
      drawStrokeFull(ctx, strokePath, strokeColor);
      ctx.restore();
    }
  }

  ctx.restore();
  // ── Back to screen coordinates ────────────────────────────────────────────

  // ④ Stroke number badges (drawn in screen space — no coordinate flip issue)
  if (showStrokeNumbers && state.completedStrokes > 0) {
    // Badge background: invert the stroke color for contrast
    const badgeBg = transparentBackground ? 'rgba(255,255,255,0.92)' : backgroundColor;

    for (let i = 0; i < state.completedStrokes; i++) {
      const median = data.medians[i] as number[][];
      drawStrokeNumberBadge(ctx, median, i, size, strokeColor, badgeBg);
    }
  }
}

// ─── Frame Sequence Generator ────────────────────────────────────────────────

/**
 * Generates all animation frames for a character as raw ImageData.
 * This is the main entry point for GIF creation.
 *
 * Frame sequence:
 *   1. Initial pause (outline only)
 *   2. For each stroke: animation frames (progress 0→1)
 *   3. Inter-stroke pause
 *   4. Final pause (all strokes drawn)
 */
export function generateCharacterFrames(
  data: CharacterData,
  options: GenerationOptions
): FrameData[] {
  const {
    size,
    strokeSpeed,
    delayBetweenStrokes,
    finalDelay,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context unavailable');

  const frames: FrameData[] = [];

  const capture = (delayMs: number) => {
    const imageData = ctx.getImageData(0, 0, size, size);
    frames.push({
      imageData: new Uint8ClampedArray(imageData.data),
      width: size,
      height: size,
      delay: delayMs,
    });
  };

  // ① Initial frame: outline only
  renderFrame(canvas, data, { completedStrokes: 0, currentStrokeProgress: -1 }, options);
  capture(500); // 500ms initial pause

  // ② Animate each stroke
  const framesPerStroke = Math.max(4, Math.min(30, strokeSpeed));

  for (let strokeIdx = 0; strokeIdx < data.strokes.length; strokeIdx++) {
    const medians = data.medians[strokeIdx] as number[][];
    const hasMedians = medians && medians.length >= 2;

    if (hasMedians) {
      // Animate the stroke progressively
      for (let f = 1; f <= framesPerStroke; f++) {
        const progress = f / framesPerStroke;
        renderFrame(
          canvas,
          data,
          { completedStrokes: strokeIdx, currentStrokeProgress: progress },
          options
        );
        capture(40); // ~25fps during animation
      }
    } else {
      // No median data: just pop the stroke in
      renderFrame(
        canvas,
        data,
        { completedStrokes: strokeIdx, currentStrokeProgress: 1 },
        options
      );
      capture(100);
    }

    // After stroke completes, show it as "done" then pause
    renderFrame(
      canvas,
      data,
      { completedStrokes: strokeIdx + 1, currentStrokeProgress: -1 },
      options
    );

    if (strokeIdx < data.strokes.length - 1) {
      capture(delayBetweenStrokes);
    }
  }

  // ③ Final pause: all strokes drawn
  renderFrame(
    canvas,
    data,
    { completedStrokes: data.strokes.length, currentStrokeProgress: -1 },
    options
  );
  capture(finalDelay);

  return frames;
}
