// Key art for the portal: the lacquer-painting key art (img/, generated with
// Codex) with the title baked in. Not imported by the game: `bun run art`
// renders it to poster.webp / banner.webp.
import type { Locale, Localized } from "@web-games/core";
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

/** The poster title; the manifest holds the same name. */
const POSTER_TITLE: Localized<string> = { vi: "CỜ TỶ PHÚ", en: "TYCOON" };

/** Gold letters with a deep lacquer-red rim, like the in-game board centre. */
function title(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, max: number) {
  let s = size;
  ctx.font = `800 ${s}px ${TITLE_FONT}`;
  while (s > 30 && ctx.measureText(str).width > max) {
    s -= 2;
    ctx.font = `800 ${s}px ${TITLE_FONT}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = s * 0.2;
  ctx.strokeStyle = "#5a120c";
  ctx.strokeText(str, x, y);
  const g = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2);
  g.addColorStop(0, "#ffe9a0");
  g.addColorStop(0.55, "#f2c04e");
  g.addColorStop(1, "#c8862a");
  ctx.fillStyle = g;
  ctx.fillText(str, x, y);
}

/** 600×800 poster with the title in the warm sky. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  ctx.fillStyle = "#8a2a1c";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  const veil = ctx.createLinearGradient(0, 0, 0, 260);
  veil.addColorStop(0, "rgba(70,14,8,0.55)");
  veil.addColorStop(1, "rgba(70,14,8,0)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, 600, 260);
  title(ctx, POSTER_TITLE[locale], 300, 112, 104, 540);
}

/** 1200×600 banner: the miniature country on the right, a calm dusk left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#8a2a1c";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(60,14,10,0.6)");
  calm.addColorStop(1, "rgba(60,14,10,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
