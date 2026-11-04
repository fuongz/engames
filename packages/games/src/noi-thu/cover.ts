// Key art for the portal: the generated pixel key art (img/, made by
// tools/noi-thu-sprites.py) with the title baked in. Not imported by the game:
// `bun run art` renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { FONT, text } from "./art";
import bannerArt from "./img/banner-art.webp";
import posterArt from "./img/poster-art.webp";

async function painted(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** The poster's title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<string[]> = {
  vi: ["NỐI THÚ"],
  en: ["CRITTER", "CONNECT"],
};

/** 600×800 poster with the title baked in. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  ctx.fillStyle = "#17877c";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  const fade = ctx.createLinearGradient(0, 520, 0, 800);
  fade.addColorStop(0, "rgba(8,40,38,0)");
  fade.addColorStop(1, "rgba(8,40,38,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 520, 600, 280);
  const lines = POSTER_TITLE[locale];
  const colors = ["#ffe14a", "#8cff3a"];
  if (lines.length === 1) {
    text(ctx, lines[0], 300, 690, fitFontSize(ctx, lines[0], 116, 540, FONT), colors[0]);
    return;
  }
  for (const [i, line] of lines.entries())
    text(ctx, line, 300, 640 + i * 86, fitFontSize(ctx, line, 88, 540, FONT), colors[i % 2]);
}

/** 1200×600 banner: the board on the right, calm teal left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#17877c";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(8,40,38,0.75)");
  calm.addColorStop(1, "rgba(8,40,38,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
