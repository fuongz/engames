import { C, CELL, WALLS, WORLD_H, WORLD_W } from "./config";
import type { Enemy, State } from "./logic";
export const FONT = '"Baloo 2", system-ui, sans-serif';
export function text(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  size = 20,
  color: string = C.white,
  align: CanvasTextAlign = "center",
) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}
export function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = C.panel,
  stroke: string = C.wallTop,
) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.stroke();
}
export function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
export function renderFloor() {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let y = 30; y < WORLD_H - 30; y += CELL)
    for (let x = 30; x < WORLD_W - 30; x += CELL) {
      ctx.fillStyle = (x * 7 + y * 13) % 19 < 7 ? C.tile : C.floor;
      ctx.fillRect(x, y, CELL - 2, CELL - 2);
      ctx.fillStyle = C.seam;
      ctx.fillRect(x + 4, y + 4, 3, 3);
    }
  // Faded traffic markings down the central laboratory aisle.
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = C.gold;
  for (let y = 50; y < WORLD_H; y += 70)
    for (const x of [338, 738]) ctx.fillRect(x, y, 4, 34);
  text(ctx, "07", 540, 870, 100, C.edge);
  ctx.globalAlpha = 1;
  for (const w of WALLS) {
    ctx.fillStyle = C.shadow;
    ctx.fillRect(w.x + 12, w.y + 18, w.w + 6, w.h + 8);
    ctx.fillStyle = C.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = C.wallTop;
    ctx.fillRect(w.x, w.y, w.w, 8);
    ctx.fillStyle = C.ink;
    ctx.fillRect(w.x, w.y + w.h - 12, w.w, 12);
    ctx.fillStyle = C.edge;
    ctx.fillRect(w.x + 7, w.y + 10, 3, w.h - 26);
    for (let x = w.x + 20; x < w.x + w.w - 12; x += 34) {
      ctx.fillStyle = C.seam;
      ctx.fillRect(x, w.y + 24, 22, w.h - 50);
      ctx.fillStyle = C.floor;
      ctx.fillRect(x + 3, w.y + 27, 16, w.h - 56);
    }
    ctx.fillStyle = C.cyan;
    ctx.fillRect(w.x + w.w / 2 - 18, w.y + w.h - 7, 36, 3);
    ctx.fillStyle = C.gold;
    ctx.fillRect(w.x + w.w - 8, w.y + 10, 4, 18);
  }
  // Perimeter rails and emergency lights.
  ctx.strokeStyle = C.wallTop;
  ctx.lineWidth = 14;
  ctx.strokeRect(22, 22, WORLD_W - 44, WORLD_H - 44);
  for (let y = 80; y < WORLD_H; y += 180) {
    for (const x of [30, WORLD_W - 36]) {
      ctx.fillStyle = C.red;
      ctx.fillRect(x, y, 6, 30);
    }
  }
  return canvas;
}
export function drawMarine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  t: number,
  moving: boolean,
  firing: boolean,
  invuln = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  circle(ctx, 2, 6, 20, C.shadow);
  ctx.strokeStyle = C.lime;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 4, 25, 19, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (invuln > 0 && Math.floor(invuln * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.rotate(angle);
  const stride = moving ? Math.sin(t * 18) * 5 : 0;
  panel(ctx, -14 + stride, -12, 15, 8, C.ink, C.wall);
  panel(ctx, -14 - stride, 4, 15, 8, C.ink, C.wall);
  panel(ctx, -12, -12, 25, 24, C.wallTop, C.ink);
  ctx.fillStyle = C.lime;
  ctx.fillRect(-8, -10, 4, 20);
  circle(ctx, 1, -14, 6, C.wallTop);
  circle(ctx, 1, 14, 6, C.wallTop);
  panel(ctx, 5, -5, 32, 10, C.ink, C.edge);
  ctx.fillStyle = C.gold;
  ctx.fillRect(21, -3, 8, 3);
  circle(ctx, -1, 0, 11, C.wall);
  ctx.fillStyle = C.cyan;
  ctx.fillRect(4, -7, 4, 14);
  if (firing) {
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.moveTo(36, -5);
    ctx.lineTo(58, 0);
    ctx.lineTo(37, 6);
    ctx.lineTo(41, 0);
    ctx.fill();
    circle(ctx, 39, 0, 4, C.white);
  }
  ctx.restore();
}
export function drawAlien(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  player: { x: number; y: number },
  t: number,
) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const r = e.radius,
    stride = Math.sin(t * (e.kind === "runner" ? 20 : 12) + e.id) * 4;
  circle(ctx, 3, 6, r + 3, C.shadow);
  ctx.rotate(Math.atan2(player.y - e.y, player.x - e.x));
  const color =
    e.flash > 0
      ? C.white
      : e.kind === "boss" || e.kind === "brute"
        ? C.brute
        : e.kind === "runner"
          ? C.runner
          : C.alien;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = r * 0.38;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, side * r * 0.5);
    ctx.lineTo(-r * 0.9 + stride * side, side * r);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.27;
    ctx.beginPath();
    ctx.moveTo(0, side * r * 0.5);
    ctx.lineTo(r * 0.6 + stride * side, side * r * 1.1);
    ctx.lineTo(r * 1.25, side * r * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, 0, r * 0.95, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(-r * 0.55 + i * r * 0.3, -r * 0.45, 2, r * 0.9);
  }
  circle(ctx, r * 0.6, 0, r * 0.55, color);
  circle(ctx, r * 0.9, -r * 0.25, 2.5, C.red);
  circle(ctx, r * 0.9, r * 0.25, 2.5, C.red);
  ctx.restore();
  if (e.hp < e.maxHp || e.kind === "boss") {
    ctx.fillStyle = C.ink;
    ctx.fillRect(e.x - r, e.y - r - 10, r * 2, 4);
    ctx.fillStyle = e.kind === "boss" ? C.red : C.lime;
    ctx.fillRect(e.x - r, e.y - r - 10, (r * 2 * e.hp) / e.maxHp, 4);
  }
}
export function drawWorld(
  ctx: CanvasRenderingContext2D,
  s: State,
  floor: HTMLCanvasElement,
  t: number,
  moving: boolean,
) {
  ctx.drawImage(floor, 0, 0);
  for (const p of s.pickups) {
    if (p.life < 3 && Math.floor(t * 8) % 2 === 0) continue;
    circle(ctx, p.x, p.y, 22 + Math.sin(t * 4) * 2, C.shadow);
    panel(ctx, p.x - 13, p.y - 13, 26, 26, C.white, C.lime);
    ctx.fillStyle = C.red;
    ctx.fillRect(p.x - 3, p.y - 9, 6, 18);
    ctx.fillRect(p.x - 9, p.y - 3, 18, 6);
  }
  const bodies = [...s.enemies].sort((a, b) => a.y - b.y);
  let marine = false;
  for (const e of bodies) {
    if (!marine && e.y > s.player.y) {
      drawMarine(
        ctx,
        s.player.x,
        s.player.y,
        s.angle,
        t,
        moving,
        s.fire > 0.075 && s.fire < 0.12,
        s.invuln,
      );
      marine = true;
    }
    drawAlien(ctx, e, s.player, t);
  }
  if (!marine)
    drawMarine(
      ctx,
      s.player.x,
      s.player.y,
      s.angle,
      t,
      moving,
      s.fire > 0.075 && s.fire < 0.12,
      s.invuln,
    );
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const b of s.bullets) {
    ctx.strokeStyle = b.plasma ? C.cyan : C.gold;
    ctx.lineWidth = b.plasma ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
    ctx.stroke();
    circle(ctx, b.x, b.y, b.plasma ? 4 : 2, C.white);
  }
}
