// Key art for the portal. Not imported by the game: `bun run art` renders it to
// poster.webp / poster-en.webp / banner.webp. The paintings in img/ are generated
// art (art-src/xu-vu-tru/gen.sh → process.sh); only the titles are drawn here.
import { type Locale, fitFontSize } from "@web-games/core";
import { FONT, NEON, neon } from "./art";
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

/** 600×800 poster with the neon title over the calm starry sky at the top. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  else {
    ctx.fillStyle = "#160b3a";
    ctx.fillRect(0, 0, 600, 800);
  }
  const fade = ctx.createLinearGradient(0, 0, 0, 220);
  fade.addColorStop(0, "rgba(10,6,34,0.75)");
  fade.addColorStop(1, "rgba(10,6,34,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 600, 220);
  const title = STRINGS[locale].title;
  neon(ctx, title, 300, 96, fitFontSize(ctx, title, 96, 540, FONT), NEON, 1.6);
}

/** 1200×600 banner: the machine on the right, calm space on the left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  else {
    ctx.fillStyle = "#160b3a";
    ctx.fillRect(0, 0, 1200, 600);
  }
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(10,6,34,0.5)");
  calm.addColorStop(1, "rgba(10,6,34,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
