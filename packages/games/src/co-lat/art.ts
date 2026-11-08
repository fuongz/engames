import type { Rect } from "@web-games/core";
import { SIZE, W } from "./config";

// Drawing for Cờ Lật: a green felt board in a walnut frame with brass corners
// on a dark lamp-lit table (the key art's look), glossy black and ivory discs
// that turn over in 3D, and brass-trimmed buttons. All procedural.

type Ctx = CanvasRenderingContext2D;
/** Everything is Baloo 2 (600/700/800 loaded in game.ts; full Vietnamese). */
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export const CREAM = "#f6ead2";
export const SOFT = "#cdb894";
export const GOLD = "#e7c172";
export const BRASS = "#c39a4e";
export const RED = "#f07a5c";
export const PANEL = "rgba(28,17,11,0.82)";
export const FELT = "#1d6a45";
export const FELT_DARK = "#124a30";
const TABLE_TOP = "#3a2416";
const TABLE_BOTTOM = "#170d08";

// ---------------------------------------------------------------- layout

/** The felt: SIZE × SIZE squares. */
export const BOARD: Rect = { x: 30, y: 224, w: W - 60, h: W - 60 };
export const CELL = BOARD.w / SIZE;
/** The walnut frame around the felt. */
export const FRAME = 16;
export const CARD_Y = 72;
export const CARD_H = 112;
export const STATUS_Y = BOARD.y + BOARD.h + FRAME + 34;
export const BUTTON_Y = STATUS_Y + 32;
export const BUTTON_H = 80;

export const cellCenter = (at: number) => ({
  x: BOARD.x + ((at % SIZE) + 0.5) * CELL,
  y: BOARD.y + (Math.floor(at / SIZE) + 0.5) * CELL,
});

export function squareAt(p: { x: number; y: number }): number | null {
  const x = Math.floor((p.x - BOARD.x) / CELL);
  const y = Math.floor((p.y - BOARD.y) / CELL);
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE ? y * SIZE + x : null;
}

// ---------------------------------------------------------------- text

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = CREAM, align: CanvasTextAlign = "center", weight = 700) {
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

/** `str` broken into lines no wider than `max` at the current font. */
export function wrap(ctx: Ctx, str: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of str.split(" ")) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- table & board

/** The dark wooden table under a warm lamp. */
export function drawTable(ctx: Ctx, view: Rect) {
  const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
  g.addColorStop(0, TABLE_TOP);
  g.addColorStop(1, TABLE_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Faint wood grain
  ctx.save();
  ctx.strokeStyle = "rgba(255,210,150,0.035)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = view.y + (i / 26) * view.h;
    ctx.beginPath();
    ctx.moveTo(view.x, y);
    ctx.bezierCurveTo(view.x + view.w * 0.3, y + 14 * Math.sin(i), view.x + view.w * 0.7, y - 12 * Math.cos(i * 1.7), view.x + view.w, y + 6);
    ctx.stroke();
  }
  ctx.restore();
  // Lamp glow from the top right
  const lamp = ctx.createRadialGradient(W * 0.85, view.y + 40, 10, W * 0.85, view.y + 40, view.h * 0.75);
  lamp.addColorStop(0, "rgba(255,190,110,0.22)");
  lamp.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = lamp;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

/** Walnut frame, brass corners, the felt and its grid. */
export function drawBoard(ctx: Ctx) {
  const o: Rect = { x: BOARD.x - FRAME, y: BOARD.y - FRAME, w: BOARD.w + FRAME * 2, h: BOARD.h + FRAME * 2 };
  ctx.save();
  // Shadow on the table
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.roundRect(o.x + 4, o.y + 12, o.w, o.h, 14);
  ctx.fill();
  const wood = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
  wood.addColorStop(0, "#8a4f2a");
  wood.addColorStop(0.5, "#6a3818");
  wood.addColorStop(1, "#4a240e");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(o.x, o.y, o.w, o.h, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,220,170,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2, 13);
  ctx.stroke();
  // Felt with a soft vignette
  const felt = ctx.createRadialGradient(BOARD.x + BOARD.w * 0.45, BOARD.y + BOARD.h * 0.4, 30, BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2, BOARD.w * 0.75);
  felt.addColorStop(0, "#23794f");
  felt.addColorStop(1, FELT_DARK);
  ctx.fillStyle = felt;
  ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(BOARD.x - 1.5, BOARD.y - 1.5, BOARD.w + 3, BOARD.h + 3);
  // Grid
  ctx.strokeStyle = "rgba(6,30,18,0.75)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 1; i < SIZE; i++) {
    ctx.moveTo(BOARD.x + i * CELL, BOARD.y);
    ctx.lineTo(BOARD.x + i * CELL, BOARD.y + BOARD.h);
    ctx.moveTo(BOARD.x, BOARD.y + i * CELL);
    ctx.lineTo(BOARD.x + BOARD.w, BOARD.y + i * CELL);
  }
  ctx.stroke();
  // The four star points
  ctx.fillStyle = "rgba(6,30,18,0.85)";
  for (const [cx, cy] of [
    [2, 2],
    [6, 2],
    [2, 6],
    [6, 6],
  ]) {
    ctx.beginPath();
    ctx.arc(BOARD.x + cx * CELL, BOARD.y + cy * CELL, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Brass corner caps
  for (const [cx, cy, sx, sy] of [
    [o.x, o.y, 1, 1],
    [o.x + o.w, o.y, -1, 1],
    [o.x, o.y + o.h, 1, -1],
    [o.x + o.w, o.y + o.h, -1, -1],
  ]) {
    const brass = ctx.createLinearGradient(cx, cy, cx + sx * 30, cy + sy * 30);
    brass.addColorStop(0, "#f0d58f");
    brass.addColorStop(1, "#9c7232");
    ctx.fillStyle = brass;
    ctx.beginPath();
    ctx.moveTo(cx + sx * 3, cy + sy * 3);
    ctx.lineTo(cx + sx * 34, cy + sy * 3);
    ctx.lineTo(cx + sx * 34, cy + sy * (FRAME - 3));
    ctx.lineTo(cx + sx * FRAME, cy + sy * FRAME);
    ctx.lineTo(cx + sx * (FRAME - 3), cy + sy * 34);
    ctx.lineTo(cx + sx * 3, cy + sy * 34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- discs

const FACE: Record<number, [string, string, string]> = {
  1: ["#5d5d68", "#202026", "#08080a"],
  2: ["#ffffff", "#f3ead7", "#c9b996"],
};
const EDGE: Record<number, string> = { 1: "#000000", 2: "#9d8d6c" };

/**
 * A disc of `side` at (x, y). `turn` (0..1) turns it over from `from` to
 * `side`: it lifts, narrows to its edge and lands showing the other face.
 * `scale` > 1 for a disc being set down.
 */
export function drawDisc(ctx: Ctx, side: number, x: number, y: number, r: number, turn = 1, from = side, scale = 1, alpha = 1) {
  const theta = Math.min(1, Math.max(0, turn)) * Math.PI;
  const flipping = turn < 1;
  const sy = flipping ? Math.max(0.07, Math.abs(Math.cos(theta))) : 1;
  const face = flipping && theta < Math.PI / 2 ? from : side;
  const hidden = face === 1 ? 2 : 1;
  const lift = flipping ? Math.sin(theta) * r * 0.55 : 0;
  const rr = r * scale;
  const thick = r * (0.13 + (flipping ? 0.22 * Math.sin(theta) : 0));
  ctx.save();
  ctx.globalAlpha = alpha;
  // Shadow on the felt, softer the higher it is
  const up = lift / r;
  ctx.fillStyle = `rgba(0,0,0,${0.38 - up * 0.4})`;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.07 + up * r * 0.2, y + r * 0.16, rr * (1 - up * 0.35), rr * (0.95 - up * 0.45), 0, 0, Math.PI * 2);
  ctx.fill();
  const cy = y - lift;
  // The edge: the other face's colour shows as the disc tilts
  ctx.fillStyle = flipping ? EDGE[hidden] : EDGE[face];
  ctx.beginPath();
  ctx.ellipse(x, cy + thick, rr, rr * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  if (flipping) {
    ctx.fillRect(x - rr, cy, rr * 2, thick);
  }
  // The face
  const [hi, mid, lo] = FACE[face];
  const g = ctx.createRadialGradient(x - rr * 0.35, cy - rr * 0.45 * sy, rr * 0.05, x, cy, rr * 1.05);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, cy, rr, rr * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  // An inner ring, like a turned disc, and a specular glint
  if (sy > 0.3) {
    ctx.strokeStyle = face === 1 ? "rgba(255,255,255,0.08)" : "rgba(120,100,60,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, cy, rr * 0.72, rr * 0.72 * sy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = face === 1 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(x - rr * 0.33, cy - rr * 0.42 * sy, rr * 0.26, rr * 0.12 * sy, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A legal-move hint: a faint disc-coloured dot. */
export function drawHint(ctx: Ctx, side: number, x: number, y: number, pulse: number) {
  ctx.save();
  ctx.fillStyle = side === 1 ? `rgba(10,10,14,${0.38 + pulse * 0.12})` : `rgba(250,244,230,${0.4 + pulse * 0.14})`;
  ctx.beginPath();
  ctx.arc(x, y, CELL * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = side === 1 ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, CELL * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The last move: a small coral pip on the disc. */
export function drawLastMarker(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = RED;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- panels & buttons

/** A dark leather panel with a brass hairline. */
export function drawPanel(ctx: Ctx, r: Rect, glow = 0, fill = PANEL) {
  ctx.save();
  if (glow > 0) {
    ctx.shadowColor = `rgba(240,196,110,${0.6 * glow})`;
    ctx.shadowBlur = 22 * glow;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = glow > 0 ? `rgba(240,200,120,${0.45 + 0.5 * glow})` : "rgba(195,154,78,0.45)";
  ctx.lineWidth = glow > 0 ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.roundRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, 15.5);
  ctx.stroke();
  ctx.restore();
}

export type Icon = "undo" | "hints" | "new" | "menu";

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
      ctx.arc(x + 2, y + 2, s * 0.38, Math.PI * 1.15, Math.PI * 0.4, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, y - s * 0.2);
      ctx.lineTo(x - s * 0.33, y + s * 0.12);
      ctx.lineTo(x - s * 0.05, y - s * 0.12);
      ctx.stroke();
      break;
    case "hints":
      for (const [dx, dy] of [
        [-0.3, -0.3],
        [0.3, -0.3],
        [-0.3, 0.3],
        [0.3, 0.3],
      ]) {
        ctx.moveTo(x + dx * s + 4, y + dy * s);
        ctx.arc(x + dx * s, y + dy * s, 4, 0, Math.PI * 2);
      }
      ctx.fill();
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
  /** A disc drawn beside the label (colour choice). */
  disc?: 1 | 2;
  /** Gold, filled: the main choice or an active toggle. */
  primary?: boolean;
  disabled?: boolean;
  /** Small count in the corner (take-backs left). */
  badge?: string;
}

export function drawButton(ctx: Ctx, b: Button) {
  const { rect: r } = b;
  ctx.save();
  if (b.disabled) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 4, r.w, r.h, 14);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (b.primary) {
    g.addColorStop(0, "#f3d58e");
    g.addColorStop(1, "#c4943f");
  } else {
    g.addColorStop(0, "#4a3020");
    g.addColorStop(1, "#2c1b11");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 14);
  ctx.fill();
  ctx.strokeStyle = b.primary ? "rgba(255,240,200,0.7)" : "rgba(195,154,78,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, 13);
  ctx.stroke();
  const color = b.primary ? "#2a170b" : CREAM;
  if (b.icon) {
    drawIcon(ctx, b.icon, r.x + r.w / 2, r.y + r.h * 0.36, 26, color);
    text(ctx, b.label, r.x + r.w / 2, r.y + r.h * 0.75, fitSize(ctx, b.label, 19, r.w - 12), color);
  } else if (b.disc) {
    const size = fitSize(ctx, b.label, 24, r.w - 70);
    ctx.font = `700 ${size}px ${FONT}`;
    const tw = ctx.measureText(b.label).width;
    const left = r.x + (r.w - tw - 40) / 2;
    drawDisc(ctx, b.disc, left + 14, r.y + r.h / 2 - 2, 14);
    text(ctx, b.label, left + 40, r.y + r.h / 2 + 2, size, color, "left");
  } else {
    text(ctx, b.label, r.x + r.w / 2, r.y + r.h / 2 + 2, fitSize(ctx, b.label, 25, r.w - 20), color);
  }
  if (b.badge) {
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(r.x + r.w - 12, r.y + 12, 12, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, b.badge, r.x + r.w - 12, r.y + 13, 15, "#fff");
  }
  ctx.restore();
}

/** The title in gold, one line per entry, with a dark outline. */
export function drawTitle(ctx: Ctx, lines: string[], x: number, y: number, size: number, max: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const lh = size * 0.95;
  lines.forEach((line, i) => {
    const s = fitSize(ctx, line, size, max, 800);
    ctx.font = `800 ${s}px ${FONT}`;
    const ly = y + (i - (lines.length - 1) / 2) * lh;
    ctx.lineWidth = s * 0.12;
    ctx.strokeStyle = "rgba(20,10,4,0.85)";
    ctx.strokeText(line, x, ly);
    const g = ctx.createLinearGradient(0, ly - s / 2, 0, ly + s / 2);
    g.addColorStop(0, "#fff0c4");
    g.addColorStop(0.55, GOLD);
    g.addColorStop(1, "#b98838");
    ctx.fillStyle = g;
    ctx.fillText(line, x, ly);
  });
  ctx.restore();
}
