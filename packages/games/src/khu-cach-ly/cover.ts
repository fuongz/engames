import type { Locale } from "@web-games/core";
import { C } from "./config";
import { drawWorld, renderFloor, text } from "./art";
import { createGame } from "./logic";
import { STRINGS } from "./strings";
function scene(ctx: CanvasRenderingContext2D) {
  const s = createGame(7);
  s.angle = -1.2;
  s.fire = 0.1;
  for (let i = 0; i < 38; i++) {
    const a = i * 2.4,
      radius = 115 + (i % 5) * 44;
    s.enemies.push({
      id: i,
      x: 540 + Math.cos(a) * radius,
      y: 900 + Math.sin(a) * radius,
      kind: i % 7 === 0 ? "brute" : i % 3 === 0 ? "runner" : "drone",
      hp: 40,
      maxHp: 40,
      radius: i % 7 === 0 ? 21 : 13,
      speed: 60,
      flash: 0,
    });
  }
  for (let i = 0; i < 7; i++)
    s.bullets.push({
      x: 552 + i * 13,
      y: 930 - i * 26,
      vx: 440,
      vy: -880,
      life: 0.4,
      damage: 16,
      plasma: false,
    });
  drawWorld(ctx, s, renderFloor(), 1.8, true);
}
export function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, 600, 800);
  ctx.save();
  ctx.translate(-400, -920);
  ctx.scale(1.3, 1.3);
  scene(ctx);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 400, 0, 800);
  fade.addColorStop(0, "transparent");
  fade.addColorStop(1, C.void);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 600, 800);
  text(ctx, `07 / ${STRINGS[locale].incoming}`, 300, 574, 20, C.lime);
  text(
    ctx,
    STRINGS[locale].title,
    300,
    650,
    locale === "vi" ? 65 : 61,
    C.white,
  );
  text(ctx, STRINGS[locale].shoot, 300, 711, 25, C.muted);
  ctx.fillStyle = C.lime;
  ctx.fillRect(250, 752, 100, 4);
}
export function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, 1200, 600);
  ctx.save();
  ctx.translate(100, -1100);
  ctx.scale(1.45, 1.45);
  scene(ctx);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 0, 850, 0);
  fade.addColorStop(0, C.void);
  fade.addColorStop(1, "transparent");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 1200, 600);
}
