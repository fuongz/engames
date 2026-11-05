// Key art for the portal. Not imported by the game: `bun run art` renders it to
// poster.webp / poster-en.webp / banner.webp. The paintings in img/ are generated
// art (see tools/meo-vu-tru-sprites.py); only the titles are drawn here.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { FONT, GOLD, text } from "./art";
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

const POSTER_TITLE: Localized<string> = { vi: "MÈO VŨ TRỤ", en: "COSMIC CATS" };

/** 600×800 poster with the title baked in over the calm space at the bottom. */
export async function renderPoster(
  canvas: HTMLCanvasElement,
  locale: Locale = "vi",
) {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  else {
    ctx.fillStyle = "#1a1060";
    ctx.fillRect(0, 0, 600, 800);
  }
  const fade = ctx.createLinearGradient(0, 580, 0, 800);
  fade.addColorStop(0, "rgba(14,8,50,0)");
  fade.addColorStop(1, "rgba(14,8,50,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 580, 600, 220);
  const title = POSTER_TITLE[locale];
  text(ctx, title, 300, 712, fitFontSize(ctx, title, 100, 540, FONT), GOLD);
}

/** 1200×600 banner: the fight on the right, calm space on the left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  else {
    ctx.fillStyle = "#1a1060";
    ctx.fillRect(0, 0, 1200, 600);
  }
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(10,6,40,0.5)");
  calm.addColorStop(1, "rgba(10,6,40,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
