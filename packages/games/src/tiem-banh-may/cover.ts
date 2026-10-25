// Key art for the portal: the painted shopfront (poster-art / banner-art, made
// with the game's sprites' style) with the title on top. Not imported by the
// game: `bun run art` renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { C, FONT } from "./art";
import bannerArt from "./banner-art.webp";
import posterArt from "./poster-art.webp";

async function load(src: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Cover the canvas with the image, cropping evenly. */
function fill(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  focusY = 0.5,
) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) * focusY, dw, dh);
}

function title(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = "center",
) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.26;
  ctx.strokeStyle = C.ink;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = C.white;
  ctx.fillText(str, x, y);
}

const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["TIỆM BÁNH", "MÂY"],
  en: ["CLOUD", "BAKERY"],
};

export async function renderPoster(
  canvas: HTMLCanvasElement,
  locale: Locale = "vi",
) {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  fill(ctx, await load(posterArt), 600, 800, 0.6);
  const [a, b] = POSTER_TITLE[locale];
  title(ctx, a, 300, 86, fitFontSize(ctx, a, 88, 520, FONT));
  title(ctx, b, 300, 196, fitFontSize(ctx, b, 106, 520, FONT));
}

export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  fill(ctx, await load(bannerArt), 1200, 600, 0.55);
}
