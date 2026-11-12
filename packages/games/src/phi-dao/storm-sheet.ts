import { STORM_SHEET } from "./config";

/** Row-major cells share one fixed pivot; never crop each frame to its changing silhouette. */
export function stormSheetFrame(
  age: number,
): { column: number; row: number } | null {
  if (!Number.isFinite(age) || age < 0 || age >= STORM_SHEET.duration)
    return null;
  const index = Math.min(
    STORM_SHEET.frames - 1,
    Math.floor((age / STORM_SHEET.duration) * STORM_SHEET.frames),
  );
  return {
    column: index % STORM_SHEET.columns,
    row: Math.floor(index / STORM_SHEET.columns),
  };
}

/** False means the texture is unavailable: the caller can draw its procedural fallback. */
export function drawStormSheet(
  c: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  age: number,
): boolean {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight)
    return false;
  const frame = stormSheetFrame(age);
  if (!frame) return true;
  const width = image.naturalWidth / STORM_SHEET.columns;
  const height = image.naturalHeight / STORM_SHEET.rows;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.globalAlpha *= 0.85;
  c.drawImage(
    image,
    frame.column * width,
    frame.row * height,
    width,
    height,
    x - STORM_SHEET.size / 2,
    y - STORM_SHEET.size / 2,
    STORM_SHEET.size,
    STORM_SHEET.size,
  );
  c.restore();
  return true;
}
