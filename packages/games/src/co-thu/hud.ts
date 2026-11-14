// Drawing helpers for the 2D HUD over the 3D board: cream leaf-edged panels,
// chunky buttons, fitted text and wrapped lines. No game state here.
import type { Rect } from "@web-games/core";
import { BLUE_DARK, BLUE_HEX, RED_DARK, RED_HEX } from "./config";
import type { Side } from "./logic";

export const FONT = '"Baloo 2", system-ui, sans-serif';
export const INK = "#22402a";
export const INK_SOFT = "#4f6b52";
export const CREAM = "#fff8e6";
export const LEAF = "#7cc35b";
export const LEAF_DARK = "#3f7f34";
export const SAND = "#f3dfb0";

export const sideColor = (s: Side) => (s === 1 ? RED_HEX : BLUE_HEX);
export const sideDark = (s: Side) => (s === 1 ? RED_DARK : BLUE_DARK);

export interface Button {
  id: string;
  rect: Rect;
  label: string;
  fill?: string;
  ink?: string;
  disabled?: boolean;
  /** Drawn pressed in (a chosen option). */
  on?: boolean;
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color = INK, align: CanvasTextAlign = "center", weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** Largest size up to `size` at which `str` fits in `max`. */
export function fitSize(ctx: CanvasRenderingContext2D, str: string, size: number, max: number, weight = 700) {
  let s = size;
  for (; s > 11; s -= 1) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(str).width <= max) break;
  }
  return s;
}

/** Split `str` into lines no wider than `max` at `size`. */
export function wrap(ctx: CanvasRenderingContext2D, str: string, size: number, max: number, weight = 600): string[] {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const lines: string[] = [];
  let cur = "";
  for (const w of str.split(" ")) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** A soft cream card with a leafy green edge and a drop shadow. */
export function panel(ctx: CanvasRenderingContext2D, r: Rect, fill = CREAM, edge = LEAF_DARK, radius = 22) {
  ctx.save();
  ctx.shadowColor = "rgba(20,50,25,0.28)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = edge;
  ctx.beginPath();
  ctx.roundRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, radius - 1);
  ctx.stroke();
}

export function button(ctx: CanvasRenderingContext2D, b: Button) {
  const { x, y, w, h } = b.rect;
  const fill = b.fill ?? LEAF;
  ctx.save();
  if (b.disabled) ctx.globalAlpha = 0.45;
  const press = b.on ? 3 : 0;
  // A darker lip under the button, like a pressed tile
  ctx.fillStyle = "rgba(25,55,30,0.35)";
  ctx.beginPath();
  ctx.roundRect(x, y + 4, w, h, 16);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y + press, w, h, 16);
  ctx.fill();
  ctx.lineWidth = b.on ? 4 : 2.5;
  ctx.strokeStyle = b.on ? "#fff27a" : "rgba(25,55,30,0.55)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.roundRect(x + 6, y + press + 4, w - 12, h * 0.36, 10);
  ctx.fill();
  const size = fitSize(ctx, b.label, Math.min(26, h * 0.46), w - 18, 800);
  text(ctx, b.label, x + w / 2, y + press + h / 2 + 1, size, b.ink ?? "#ffffff", "center", 800);
  ctx.restore();
}

/** A round rank chip in a side's colour. */
export function chip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, side: Side, rank: number) {
  ctx.fillStyle = sideColor(side);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = "#fffaf0";
  ctx.stroke();
  text(ctx, String(rank), x, y + 1, r * 1.15, "#ffffff", "center", 800);
}
