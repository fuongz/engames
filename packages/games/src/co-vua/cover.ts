// Key art for the portal: the warm study key art (img/, generated with Codex)
// with the localized title baked in. Not imported by the game: `bun run art`
// renders it to poster.webp / poster-en.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { TITLE_FONT } from "./art";
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

const POSTER_TITLE: Localized<string> = { vi: "CỜ VUA", en: "CHESS" };

/** 600×800 poster: the title in warm cream over the calm window light at the top. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  ctx.fillStyle = "#3a2214";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  // Darken the top a touch so the title reads on the bright window
  const shade = ctx.createLinearGradient(0, 0, 0, 300);
  shade.addColorStop(0, "rgba(40,20,8,0.62)");
  shade.addColorStop(1, "rgba(40,20,8,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 600, 300);
  const title = POSTER_TITLE[locale];
  const size = fitFontSize(ctx, title, 132, 520, TITLE_FONT, 800);
  ctx.font = `800 ${size}px ${TITLE_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(20,8,2,0.6)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.lineWidth = size * 0.12;
  ctx.strokeStyle = "#5a2c10";
  ctx.strokeText(title, 300, 128);
  ctx.shadowColor = "transparent";
  const fill = ctx.createLinearGradient(0, 128 - size / 2, 0, 128 + size / 2);
  fill.addColorStop(0, "#fff6dc");
  fill.addColorStop(1, "#f2b955");
  ctx.fillStyle = fill;
  ctx.fillText(title, 300, 128);
}

/** 1200×600 banner: the pieces on the right, calm dark study left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#2a170c";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(30,16,8,0.6)");
  calm.addColorStop(1, "rgba(30,16,8,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
