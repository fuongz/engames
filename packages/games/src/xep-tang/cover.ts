// Key art for the portal: the generated isometric tower (img/, made with Codex)
// with the title baked in. Not imported by the game: `bun run art` renders it to
// poster.webp / banner.webp.
import { type Locale, fitFontSize } from "@web-games/core";
import { FONT } from "./art";
import bannerArt from "./img/banner-art.webp";
import posterArt from "./img/poster-art.webp";
import { STRINGS } from "./strings";

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

/** 600×800 poster: the tower, and the title set in the calm haze at its foot. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  ctx.fillStyle = "#f6b9a0";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  const title = STRINGS[locale].title;
  const size = fitFontSize(ctx, title, 104, 520, FONT);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "4px";
  ctx.shadowColor = "rgba(120,50,70,0.45)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#fffaf3";
  ctx.fillText(title, 300, 706);
  ctx.shadowColor = "transparent";
  ctx.letterSpacing = "0px";
}

/** 1200×600 banner: the tower on the right, calm dusk on the left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#6a4a9a";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(28,18,52,0.55)");
  calm.addColorStop(1, "rgba(28,18,52,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
