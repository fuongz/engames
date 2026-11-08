// Key art for the portal: the brick-courtyard key art (img/, generated with
// Codex from the approved "sân gạch" sample) with the title baked in. Not
// imported by the game: `bun run art` renders it to poster.webp / banner.webp.
import type { Locale } from "@web-games/core";
import { FONT } from "./art";
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

/** The title as if chalked on the bricks: cream letters with a deep terracotta edge. */
function title(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(40,15,5,0.55)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = "#6b2614";
  ctx.strokeText("Ô Ăn Quan", x, y);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#fff6e4";
  ctx.fillText("Ô Ăn Quan", x, y);
}

/** 600×800 poster with the title over the top of the courtyard. The title reads the same in both languages. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  ctx.fillStyle = "#b85c3c";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  // A soft shade behind the title so it reads over the doorstep
  const shade = ctx.createLinearGradient(0, 0, 0, 260);
  shade.addColorStop(0, "rgba(50,20,8,0.55)");
  shade.addColorStop(1, "rgba(50,20,8,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 600, 260);
  title(ctx, 300, 112, 104);
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff6e4";
  ctx.shadowColor = "rgba(40,15,5,0.8)";
  ctx.shadowBlur = 8;
  ctx.fillText(locale === "vi" ? "Trò chơi dân gian Việt Nam" : "A Vietnamese folk game", 300, 190);
  ctx.shadowColor = "transparent";
}

/** 1200×600 banner: the game on the right, calm bricks left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#b85c3c";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(40,18,8,0.55)");
  calm.addColorStop(1, "rgba(40,18,8,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
