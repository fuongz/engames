// The avatar crop maths and encoder: no React. The crop is `{ zoom, cx, cy }`:
// `zoom` 1 shows the largest centred square of the photo, and (cx, cy) is the
// point of the photo (in its own pixels) at the middle of the frame. Keeping it
// in photo pixels means a resize of the frame never moves the picture.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export type Crop = { zoom: number; cx: number; cy: number };
export type Dims = { width: number; height: number };

/** Highest quality first; each step is tried until the file fits. */
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Side of the square the frame shows, in photo pixels. */
export const cropSide = (d: Dims, zoom: number) => Math.min(d.width, d.height) / zoom;

/** Keep the zoom in range and the frame inside the photo. */
export function clampCrop(d: Dims, c: Crop): Crop {
  const zoom = clamp(c.zoom, MIN_ZOOM, MAX_ZOOM);
  const half = cropSide(d, zoom) / 2;
  return { zoom, cx: clamp(c.cx, half, d.width - half), cy: clamp(c.cy, half, d.height - half) };
}

export const initialCrop = (d: Dims): Crop => ({ zoom: MIN_ZOOM, cx: d.width / 2, cy: d.height / 2 });

/** Paints the framed square of `bitmap` to fill a `size`×`size` canvas. */
export function drawCrop(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, c: Crop, size: number) {
  const side = cropSide(bitmap, c.zoom);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, c.cx - side / 2, c.cy - side / 2, side, side, 0, 0, size, size);
}

/**
 * Decodes a picked file with its EXIF orientation applied. Throws when the
 * browser cannot read it as an image.
 */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older engines reject the options bag; they also tend to apply EXIF themselves
    return createImageBitmap(file);
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Renders the crop to a square `size` canvas and encodes it: WebP when the
 * browser can, JPEG when not, lowering the quality a step at a time until the
 * file is at most `maxBytes`. Throws `avatar-too-large` when no step fits.
 */
export async function encodeAvatar(bitmap: ImageBitmap, crop: Crop, size: number, maxBytes: number): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("avatar-invalid");
  drawCrop(ctx, bitmap, crop, size);

  let type = "image/webp";
  let blob = await toBlob(canvas, type, QUALITY_STEPS[0]);
  if (!blob || blob.type !== type) {
    // No WebP encoder: JPEG has no alpha, so lay the photo on white first
    type = "image/jpeg";
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    blob = await toBlob(canvas, type, QUALITY_STEPS[0]);
  }
  for (const quality of QUALITY_STEPS) {
    if (quality !== QUALITY_STEPS[0]) blob = await toBlob(canvas, type, quality);
    if (!blob) throw new Error("avatar-invalid");
    if (blob.size <= maxBytes) return new File([blob], type === "image/webp" ? "avatar.webp" : "avatar.jpg", { type });
  }
  throw new Error("avatar-too-large");
}
