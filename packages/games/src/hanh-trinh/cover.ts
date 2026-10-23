// Key art for the portal, composed from the game's own drawing code. Not
// imported by the game: `bun run art` renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "../core";
import { drawArrow, drawCoin, drawEnemy, drawFlame, drawHero, drawHpBar, drawScene, FONT, text } from "./art";
import { GROUND_Y, H, HERO_X, W } from "./config";

/** The battle line in game coordinates (540×960). */
function scene(ctx: CanvasRenderingContext2D, background = true) {
  if (background) drawScene(ctx, 260, 0, W, 0, H);
  const line = ["grunt", "axe", "archer", "helmet", "axe"] as const;
  for (let i = line.length - 1; i >= 0; i--) {
    drawEnemy(ctx, line[i], 186 + i * 90, GROUND_Y, { t: i, swing: 0, flash: i === 0 ? 0.1 : 0, lunge: 0 });
    drawHpBar(ctx, 186 + i * 90, GROUND_Y + 14, [8, 30, 10, 55, 30][i], [14, 30, 10, 55, 30][i], false);
  }
  drawHero(ctx, HERO_X, GROUND_Y, 1, { t: 0, swing: 0.62, flash: 0, lunge: 14 });
  drawHpBar(ctx, HERO_X, GROUND_Y + 14, 126, 145, true);
  drawArrow(ctx, 300, GROUND_Y - 50);
  drawFlame(ctx, 172, GROUND_Y - 118, 14);
  text(ctx, "20", 204, GROUND_Y - 118, 34, "#ffd23f");
  for (const [x, y] of [[214, 380], [244, 350], [190, 345]]) drawCoin(ctx, x, y, 12);
}

/** The poster's two title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["HÀNH TRÌNH", "ANH HÙNG"],
  en: ["HERO'S", "JOURNEY"],
};

/** 600×800 poster with the title baked in. */
export function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Zoom into the front of the line
  const k = 1.75;
  ctx.save();
  ctx.translate(-10, -360);
  ctx.scale(k, k);
  scene(ctx);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 540, 0, 800);
  fade.addColorStop(0, "rgba(20,40,16,0)");
  fade.addColorStop(1, "rgba(20,40,16,0.9)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 540, 600, 260);
  const [line1, line2] = POSTER_TITLE[locale];
  text(ctx, line1, 300, 676, fitFontSize(ctx, line1, 76, 540, FONT), "#ffe680");
  text(ctx, line2, 300, 744, fitFontSize(ctx, line2, 58, 540, FONT), "#ffffff");
}

/** 1200×600 banner: the fight on the right, calm grass on the left for the title. */
export function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const k = 1.5;
  ctx.save();
  ctx.translate(430, -470);
  ctx.scale(k, k);
  // One continuous strip of scenery under the whole banner, then the fighters
  drawScene(ctx, 260, -320, W + 120, 0, H);
  scene(ctx, false);
  ctx.restore();
  const calm = ctx.createLinearGradient(0, 0, 520, 0);
  calm.addColorStop(0, "rgba(16,32,14,0.9)");
  calm.addColorStop(1, "rgba(16,32,14,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 520, 600);
}
