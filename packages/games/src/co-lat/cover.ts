// Key art for the portal: the felt-and-walnut key art (img/, generated with
// Codex) with the localized title baked in. Not imported by the game:
// `bun run art` renders it to poster.webp / banner.webp.
import type { Locale } from "@web-games/core";
import { FONT, drawTitle } from "./art";
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

/** 600×800 poster: the title in gold over the dark lamp-lit top of the art. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const lines = STRINGS[locale].title;
  // The Vietnamese letters live in their own font subset: load it for these exact glyphs
  await document.fonts?.load(`800 100px ${FONT}`, lines.join(" "));
  const art = await painted(posterArt);
  ctx.fillStyle = "#24160e";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  const shade = ctx.createLinearGradient(0, 0, 0, 300);
  shade.addColorStop(0, "rgba(16,9,5,0.75)");
  shade.addColorStop(1, "rgba(16,9,5,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 600, 300);
  drawTitle(ctx, lines, 300, 118, 124, 540);
}

/** 1200×600 banner: the board on the right, calm dark wood on the left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#24160e";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(16,9,5,0.6)");
  calm.addColorStop(1, "rgba(16,9,5,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
