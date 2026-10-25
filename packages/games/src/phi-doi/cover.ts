// Key art for the portal, composed from the game's own drawing code. Not
// imported by the game: `bun run art` renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import {
  blit,
  drawBattleship,
  drawSea,
  glowDot,
  makeSea,
  makeSprites,
  FONT,
  text,
} from "./art";
import { H, W, WINGMEN } from "./config";

/** Battleship up top, a fighter trio, red bead chains and the hero squadron below. */
function scene(ctx: CanvasRenderingContext2D, heroY: number, sea = true) {
  const sprites = makeSprites();
  if (sea) drawSea(ctx, makeSea(), 300, 0, W, 0, H);
  drawBattleship(ctx, W / 2 + 40, 170, 1.2, 0, 0);
  for (const [i, a] of [-0.3, -0.1, 0.1, 0.3].entries()) {
    for (let k = 0; k < 7; k++) {
      blit(
        ctx,
        sprites.orb,
        W / 2 + 40 + (i - 1.5) * 14 + Math.sin(a) * (40 + k * 30),
        330 + Math.cos(a) * (40 + k * 30),
      );
    }
  }
  for (const [x, y] of [
    [110, 380],
    [160, 330],
    [60, 330],
  ] as const)
    blit(ctx, sprites.zero, x, y, 1.1, Math.PI);
  blit(ctx, sprites.missile, 430, 470, 1.1);
  for (let i = 0; i < 5; i++) {
    for (const dx of [-14, -4, 6, 16])
      blit(
        ctx,
        sprites.bullet,
        W / 2 - 20 + dx + i * dx * 0.2,
        heroY - 80 - i * 70,
      );
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glowDot(ctx, 140, 350, 70, "rgba(255,180,60,0.9)", 0.8);
  ctx.restore();
  const px = W / 2 - 20;
  const py = heroY;
  for (const w of WINGMEN)
    blit(ctx, sprites.wingman, px + w.dx * 1.3, py + w.dy * 1.3, 1.3);
  blit(ctx, sprites.hero, px, py, 1.3);
  blit(ctx, sprites.pickups.power, 96, heroY - 30);
}

/** The poster's two title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["PHI ĐỘI", "1945"],
  en: ["SQUADRON", "1945"],
};

/** 600×800 poster with the title baked in. */
export function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const k = 600 / W;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(0, -40);
  scene(ctx, 540);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 560, 0, 800);
  fade.addColorStop(0, "rgba(8,20,60,0)");
  fade.addColorStop(1, "rgba(8,20,60,0.92)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 560, 600, 240);
  const [line1, line2] = POSTER_TITLE[locale];
  text(ctx, line1, 300, 688, fitFontSize(ctx, line1, 96, 540, FONT), "#ffe27a");
  text(ctx, line2, 300, 756, fitFontSize(ctx, line2, 54, 540, FONT), "#ffffff");
}

/** 1200×600 banner: the squadron and battleship on the right, calm sea on the left. */
export function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawSea(ctx, makeSea(), 300, 0, 1200, 0, 600);
  // A 540-wide slice of the portrait scene, scaled to fill the height
  const k = 600 / 800;
  ctx.save();
  ctx.translate(1200 - W * k - 60, 0);
  ctx.scale(k, k);
  ctx.translate(0, -100);
  scene(ctx, 720, false);
  ctx.restore();
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(8,20,60,0.9)");
  calm.addColorStop(1, "rgba(8,20,60,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
