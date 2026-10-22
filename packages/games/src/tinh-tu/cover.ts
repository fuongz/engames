// Key art for the portal, composed from the game's own drawing code. Not
// imported by the game: `bun run art` renders it to poster.webp / banner.webp.
import { blit, drawBeam, drawBoss, drawFlames, drawPortal, drawRider, drawSky, makeSky, makeSprites, text } from "./art";
import { H, W } from "./config";

function scene(ctx: CanvasRenderingContext2D, beam: boolean) {
  const sprites = makeSprites();
  drawSky(ctx, makeSky(), 3.2, 0, W, 0, H);
  drawBoss(ctx, 860, 250, 1.1, 0, 0);
  for (const [x, y, k] of [[560, 120, "crystal"], [640, 420, "meteor"], [470, 330, "fighter"], [720, 190, "fighter"]] as const) {
    if (k === "meteor") drawFlames(ctx, x + 10, y, 2, 34);
    blit(ctx, sprites[k], x, y);
  }
  for (let i = 0; i < 6; i++) blit(ctx, i % 2 ? sprites.bulletPink : sprites.bulletGold, 300 + i * 40, 262 + (i % 2) * 14);
  blit(ctx, sprites.pickups.multi, 420, 140);
  if (beam) {
    drawBeam(ctx, 330, 300, W, 1.3, 0.85);
    drawPortal(ctx, 334, 300, 0.5, 0.8);
  }
  drawRider(ctx, 230, 270, 0.6, 1.5);
}

/** 600×800 poster with the title baked in. */
export function renderPoster(canvas: HTMLCanvasElement) {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Centre a 540-tall crop of the landscape scene, scaled up to fill
  const k = 800 / H;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-120, 0);
  scene(ctx, false);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 520, 0, 800);
  fade.addColorStop(0, "rgba(8,6,40,0)");
  fade.addColorStop(1, "rgba(8,6,40,0.9)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 520, 600, 280);
  text(ctx, "TINH TÚ", 300, 660, 96, "#ffe7a6");
  text(ctx, "PHI HÀNH", 300, 738, 58, "#ffb8ea");
}

/** 1200×600 banner: rider and beam on the right half, calm left for the HTML title. */
export function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const k = 600 / H;
  ctx.save();
  ctx.translate(1200 - W * k + 150, 0);
  ctx.scale(k, k);
  scene(ctx, true);
  ctx.restore();
  const calm = ctx.createLinearGradient(0, 0, 480, 0);
  calm.addColorStop(0, "rgba(8,8,50,0.9)");
  calm.addColorStop(1, "rgba(8,8,50,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 480, 600);
}
