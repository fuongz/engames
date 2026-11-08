import type { Rect } from "@web-games/core";
import { SIZE, W } from "./config";

// Drawing for Caro: a school squared-notebook page, red and blue ballpoint
// marks that ink themselves in, a yellow highlighter over the winning row, and
// sticky-note buttons. Everything is procedural, so it stays sharp at any zoom.

type Ctx = CanvasRenderingContext2D;
/** In-game text: Mali (rounded, handwriting-like, full Vietnamese). Weights 600 and 700 are loaded in game.ts. */
export const FONT = '"Mali", "Trebuchet MS", system-ui, sans-serif';
/** The CARO title only, matching the poster. */
export const TITLE_FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export const INK = "#2a2d38";
export const INK_SOFT = "#6b6f7d";
export const RED = "#d2342c";
export const BLUE = "#2756c5";
export const PAPER = "#fbf7ec";
export const GRID = "rgba(86,140,204,0.32)";
export const GRID_STRONG = "rgba(64,112,182,0.55)";
export const HIGHLIGHT = "rgba(255,214,0,0.5)";
export const NOTE = "#fff3a8";
export const NOTE_BLUE = "#d9ecff";
export const NOTE_PINK = "#ffd9d4";

export const markColor = (side: number) => (side === 1 ? RED : BLUE);

// ---------------------------------------------------------------- layout

/** Where the board is shown; at zoom 1 the whole 19×19 fits exactly. */
export const VP: Rect = { x: 10, y: 150, w: W - 20, h: W - 20 };
/** One square at zoom 1. */
export const CELL = VP.w / SIZE;
export const BOARD_PX = CELL * SIZE;
export const STATUS_Y = VP.y + VP.h + 34;
export const BUTTON_Y = STATUS_Y + 50;
export const BUTTON_H = 70;

// ---------------------------------------------------------------- text

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = INK, align: CanvasTextAlign = "center", weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** Largest size (≤ size) at which `str` fits `max` wide. */
export function fitSize(ctx: Ctx, str: string, size: number, max: number, weight = 700) {
  let s = size;
  for (; s > 10; s -= 1) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(str).width <= max) break;
  }
  return s;
}

// ---------------------------------------------------------------- paper

/** Fill the visible area with notebook paper; the grid lines up with the board at zoom 1. */
export function drawPaper(ctx: Ctx, view: Rect) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.strokeStyle = "rgba(86,140,204,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const x0 = VP.x - Math.ceil((VP.x - view.x) / CELL) * CELL;
  for (let x = x0; x <= view.x + view.w; x += CELL) {
    ctx.moveTo(x, view.y);
    ctx.lineTo(x, view.y + view.h);
  }
  const y0 = VP.y - Math.ceil((VP.y - view.y) / CELL) * CELL;
  for (let y = y0; y <= view.y + view.h; y += CELL) {
    ctx.moveTo(view.x, y);
    ctx.lineTo(view.x + view.w, y);
  }
  ctx.stroke();
  // Red margin line, like a real exercise book
  ctx.strokeStyle = "rgba(214,64,64,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(VP.x + 2, view.y);
  ctx.lineTo(VP.x + 2, VP.y - 8);
  ctx.moveTo(VP.x + 2, VP.y + VP.h + 8);
  ctx.lineTo(VP.x + 2, view.y + view.h);
  ctx.stroke();
}

export interface Camera {
  z: number;
  /** Board point (zoom-1 px) at the viewport's top-left. */
  ox: number;
  oy: number;
}

/** Screen point of a board point. */
export const toScreen = (cam: Camera, bx: number, by: number) => ({
  x: VP.x + (bx - cam.ox) * cam.z,
  y: VP.y + (by - cam.oy) * cam.z,
});
export const cellCenter = (cam: Camera, at: number) => toScreen(cam, ((at % SIZE) + 0.5) * CELL, (Math.floor(at / SIZE) + 0.5) * CELL);

/** The play area: a white sheet with the 19×19 grid ruled in pen. */
export function drawBoard(ctx: Ctx, cam: Camera) {
  const s = CELL * cam.z;
  const tl = toScreen(cam, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(VP.x, VP.y, VP.w, VP.h);
  ctx.clip();
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(tl.x, tl.y, BOARD_PX * cam.z, BOARD_PX * cam.z);
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < SIZE; i++) {
    ctx.moveTo(tl.x + i * s, tl.y);
    ctx.lineTo(tl.x + i * s, tl.y + SIZE * s);
    ctx.moveTo(tl.x, tl.y + i * s);
    ctx.lineTo(tl.x + SIZE * s, tl.y + i * s);
  }
  ctx.stroke();
  // Centre dot and the four star points, so a zoomed view still has landmarks
  ctx.fillStyle = GRID_STRONG;
  for (const [cx, cy] of [
    [9, 9],
    [3, 3],
    [15, 3],
    [3, 15],
    [15, 15],
  ]) {
    ctx.beginPath();
    ctx.arc(tl.x + (cx + 0.5) * s, tl.y + (cy + 0.5) * s, Math.max(1.5, s * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Ruled border
  ctx.strokeStyle = GRID_STRONG;
  ctx.lineWidth = 2;
  ctx.strokeRect(VP.x, VP.y, VP.w, VP.h);
}

// ---------------------------------------------------------------- marks

/** A small stable wobble per square, so marks look hand-drawn but don't jitter. */
function wobble(at: number, k: number) {
  const n = Math.sin(at * 12.9898 + k * 78.233) * 43758.5453;
  return n - Math.floor(n) - 0.5;
}

/** A ballpoint X or O in square `at`, inked up to `progress` (0..1). */
export function drawMark(ctx: Ctx, side: number, x: number, y: number, size: number, at: number, progress = 1, alpha = 1) {
  if (progress <= 0) return;
  const r = size * 0.32;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = markColor(side);
  ctx.lineWidth = Math.max(1.6, size * 0.11);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (side === 1) {
    const a = Math.min(1, progress * 2);
    const b = Math.max(0, progress * 2 - 1);
    const j = (k: number) => wobble(at, k) * size * 0.08;
    const x1 = x - r + j(1);
    const y1 = y - r + j(2);
    const x2 = x + r + j(3);
    const y2 = y + r + j(4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x + j(5), y + j(6), x1 + (x2 - x1) * a, y1 + (y2 - y1) * a);
    ctx.stroke();
    if (b > 0) {
      const x3 = x + r + j(7);
      const y3 = y - r + j(8);
      const x4 = x - r + j(9);
      const y4 = y + r + j(10);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.quadraticCurveTo(x + j(11), y + j(12), x3 + (x4 - x3) * b, y3 + (y4 - y3) * b);
      ctx.stroke();
    }
  } else {
    const start = -Math.PI * 0.6 + wobble(at, 13) * 0.6;
    const rx = r * (1 + wobble(at, 14) * 0.12);
    const ry = r * (1 + wobble(at, 15) * 0.12);
    ctx.beginPath();
    // A touch past a full turn, the way a pen closes a circle
    ctx.ellipse(x, y, rx, ry, wobble(at, 16), start, start + Math.PI * 2.08 * progress);
    ctx.stroke();
  }
  ctx.restore();
}

/** Yellow highlighter behind a square (last move) or along a run (the win). */
export function drawHighlight(ctx: Ctx, a: { x: number; y: number }, b: { x: number; y: number }, width: number, progress = 1, color = HIGHLIGHT) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(a.x + (b.x - a.x) * progress, a.y + (b.y - a.y) * progress);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- notes & buttons

export function roundRect(ctx: Ctx, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

/** A sticky note with a soft shadow, tilted by `tilt` radians. */
export function drawNote(ctx: Ctx, r: Rect, fill: string, tilt = 0, lift = 0) {
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - lift);
  ctx.rotate(tilt);
  ctx.shadowColor = "rgba(60,40,20,0.22)";
  ctx.shadowBlur = 10 + lift * 2;
  ctx.shadowOffsetY = 3 + lift;
  ctx.fillStyle = fill;
  roundRect(ctx, { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h }, 10);
  ctx.fill();
  ctx.restore();
}

export type Icon = "undo" | "zoom-in" | "zoom-out" | "new" | "menu" | "back";

function drawIcon(ctx: Ctx, icon: Icon, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (icon) {
    case "undo":
    case "back":
      ctx.arc(x + 2, y + 2, s * 0.38, Math.PI * 1.15, Math.PI * 0.4, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.2);
      ctx.lineTo(x - s * 0.33, y + s * 0.12);
      ctx.lineTo(x - s * 0.05, y - s * 0.12);
      ctx.stroke();
      break;
    case "zoom-in":
    case "zoom-out":
      ctx.arc(x - 3, y - 3, s * 0.3, 0, Math.PI * 2);
      ctx.moveTo(x + s * 0.18, y + s * 0.18);
      ctx.lineTo(x + s * 0.45, y + s * 0.45);
      ctx.moveTo(x - 3 - s * 0.14, y - 3);
      ctx.lineTo(x - 3 + s * 0.14, y - 3);
      if (icon === "zoom-in") {
        ctx.moveTo(x - 3, y - 3 - s * 0.14);
        ctx.lineTo(x - 3, y - 3 + s * 0.14);
      }
      ctx.stroke();
      break;
    case "new":
      ctx.moveTo(x, y - s * 0.4);
      ctx.lineTo(x, y + s * 0.4);
      ctx.moveTo(x - s * 0.4, y);
      ctx.lineTo(x + s * 0.4, y);
      ctx.stroke();
      break;
    case "menu":
      for (const dy of [-0.3, 0, 0.3]) {
        ctx.moveTo(x - s * 0.4, y + dy * s);
        ctx.lineTo(x + s * 0.4, y + dy * s);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

export interface Button {
  id: string;
  rect: Rect;
  label: string;
  icon?: Icon;
  fill?: string;
  disabled?: boolean;
  /** Small count in the corner (take-backs left). */
  badge?: string;
}

export function drawButton(ctx: Ctx, b: Button, pressed = false) {
  const { rect: r } = b;
  ctx.save();
  if (b.disabled) ctx.globalAlpha = 0.45;
  drawNote(ctx, r, b.fill ?? NOTE, 0, pressed ? 0 : 1.5);
  const color = INK;
  if (b.icon) {
    drawIcon(ctx, b.icon, r.x + r.w / 2, r.y + r.h * 0.36, 26, color);
    text(ctx, b.label, r.x + r.w / 2, r.y + r.h * 0.76, fitSize(ctx, b.label, 17, r.w - 12), color);
  } else {
    text(ctx, b.label, r.x + r.w / 2, r.y + r.h / 2 + 1, fitSize(ctx, b.label, 22, r.w - 20, 700), color, "center", 700);
  }
  if (b.badge) {
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(r.x + r.w - 10, r.y + 10, 11, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, b.badge, r.x + r.w - 10, r.y + 11, 14, "#fff", "center", 700);
  }
  ctx.restore();
}

/** The game's title as on the key art: red C·A, blue R·O. */
export function drawTitle(ctx: Ctx, x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${TITLE_FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const letters = ["C", "A", "R", "O"];
  const widths = letters.map((l) => ctx.measureText(l).width);
  let cx = x - (widths.reduce((a, b) => a + b, 0) + size * 0.06 * 3) / 2;
  letters.forEach((l, i) => {
    ctx.fillStyle = i % 2 === 0 ? RED : BLUE;
    ctx.fillText(l, cx, y);
    cx += widths[i] + size * 0.06;
  });
}
