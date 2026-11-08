// Key art for the portal: the sunny toy-board key art (img/, generated with
// Codex) with the title baked in. Not imported by the game: `bun run art`
// renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { COLORS, DARK, FONT } from "./art";
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

/** The poster title: Vietnamese colours a word each, English a letter each. */
const POSTER_TITLE: Localized<{ text: string; per: "word" | "letter" }> = {
  vi: { text: "Cờ Cá Ngựa", per: "word" },
  en: { text: "LUDO", per: "letter" },
};

/** Chunky toy lettering: white outline, a darker drop, then the colour. */
function title(ctx: CanvasRenderingContext2D, str: string, per: "word" | "letter", x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const parts = per === "word" ? str.split(" ") : [...str];
  const gap = per === "word" ? ctx.measureText(" ").width : size * 0.04;
  const widths = parts.map((p) => ctx.measureText(p).width);
  let cx = x - (widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1)) / 2;
  ctx.lineJoin = "round";
  parts.forEach((p, i) => {
    const c = i % 4;
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "rgba(120,60,10,0.35)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.strokeText(p, cx, y);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = DARK[c];
    ctx.fillText(p, cx, y + size * 0.05);
    ctx.fillStyle = COLORS[c];
    ctx.fillText(p, cx, y);
    cx += widths[i] + gap;
  });
}

/** 600×800 poster: the art with the title across its calm top. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  ctx.fillStyle = "#ffd9a8";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  const { text, per } = POSTER_TITLE[locale];
  const size = fitFontSize(ctx, text, per === "word" ? 108 : 150, 540, FONT);
  title(ctx, text, per, 300, 112, size);
}

/** 1200×600 banner: the board on the right, calm warm light left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#ffd9a8";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(70,32,8,0.6)");
  calm.addColorStop(1, "rgba(70,32,8,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
