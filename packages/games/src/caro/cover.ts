// Key art for the portal: the notebook key art (img/, generated with Codex from
// the approved "school notebook" sample) with the title baked in. Not imported
// by the game: `bun run art` renders it to poster.webp / banner.webp.
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

/** The title as on a notebook cover label: red C·A, blue R·O. */
function title(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const letters = ["C", "A", "R", "O"];
  const gap = size * 0.06;
  const widths = letters.map((l) => ctx.measureText(l).width);
  let cx = x - (widths.reduce((a, b) => a + b, 0) + gap * 3) / 2;
  ctx.lineJoin = "round";
  letters.forEach((l, i) => {
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = "#fffdf6";
    ctx.strokeText(l, cx, y);
    ctx.fillStyle = i % 2 === 0 ? "#d2342c" : "#2756c5";
    ctx.fillText(l, cx, y);
    cx += widths[i] + gap;
  });
}

/** 600×800 poster with the title on a paper label. The title reads the same in both languages. */
export async function renderPoster(canvas: HTMLCanvasElement, _locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  ctx.fillStyle = "#fbf7ec";
  ctx.fillRect(0, 0, 600, 800);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  // A torn paper label across the top, like a name sticker on an exercise book
  ctx.save();
  ctx.translate(300, 92);
  ctx.rotate(-0.035);
  ctx.shadowColor = "rgba(60,40,20,0.3)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#fffdf6";
  ctx.beginPath();
  ctx.roundRect(-190, -62, 380, 124, 18);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(300, 96);
  ctx.rotate(-0.035);
  title(ctx, 0, 0, 104);
  ctx.restore();
}

/** 1200×600 banner: the game on the right, calm paper left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  ctx.fillStyle = "#fbf7ec";
  ctx.fillRect(0, 0, 1200, 600);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(40,28,18,0.55)");
  calm.addColorStop(1, "rgba(40,28,18,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
