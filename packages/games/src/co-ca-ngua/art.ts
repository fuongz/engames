import type { Rect } from "@web-games/core";
import { TRACK, homeColumn } from "./board";
import { GRID, STARS, W } from "./config";

// Drawing for Cờ Cá Ngựa: a sunny toy-box look to match the key art — a
// lacquered wooden board, glossy horse tokens (img/tokens.webp, from the
// Codex sprite sheet), a chunky 3D-ish die, and candy-coloured buttons.

type Ctx = CanvasRenderingContext2D;
/** All text: Baloo 2 (full Vietnamese); weights 600 and 800 are loaded in game.ts. */
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export const INK = "#4a2c17";
export const INK_SOFT = "#8a6448";
export const CREAM = "#fff8ec";
export const PANEL = "#fffaf2";
/** By corner: red bottom-left, green top-left, yellow top-right, blue bottom-right. */
export const COLORS = ["#e5453a", "#3daa4a", "#f2b31b", "#2f7fe0"];
export const DARK = ["#a8261d", "#23782f", "#b77d06", "#1d55a6"];
export const LIGHT = ["#ffd3cc", "#cdeecb", "#ffeaa8", "#cfe2ff"];
const UNUSED = "#d9cdbb";
const UNUSED_DARK = "#b3a58f";

// ---------------------------------------------------------------- layout

export const BOARD: Rect = { x: 10, y: 142, w: W - 20, h: W - 20 };
export const CELL = BOARD.w / GRID;
export const CHIP_W = 188;
export const CHIP_H = 94;
export const TOP_CHIP_Y = 32;
export const BOTTOM_CHIP_Y = BOARD.y + BOARD.h + 16;
/** Where each view corner's player card sits: 0 bottom-left, then clockwise. */
export const CHIPS: Rect[] = [
  { x: 12, y: BOTTOM_CHIP_Y, w: CHIP_W, h: CHIP_H },
  { x: 12, y: TOP_CHIP_Y, w: CHIP_W, h: CHIP_H },
  { x: W - 12 - CHIP_W, y: TOP_CHIP_Y, w: CHIP_W, h: CHIP_H },
  { x: W - 12 - CHIP_W, y: BOTTOM_CHIP_Y, w: CHIP_W, h: CHIP_H },
];
/** The two dice sit side by side between the two bottom cards. */
export const DIE = { x: W / 2, y: BOTTOM_CHIP_Y + CHIP_H / 2 + 2, size: 40, gap: 31 };
export const DIE_HIT: Rect = { x: W / 2 - 70, y: BOTTOM_CHIP_Y - 10, w: 140, h: CHIP_H + 24 };
/** Tap areas for die 0 (left) and die 1 (right). */
export const DIE_HITS: Rect[] = [
  { x: DIE_HIT.x, y: DIE_HIT.y, w: DIE_HIT.w / 2, h: DIE_HIT.h },
  { x: DIE_HIT.x + DIE_HIT.w / 2, y: DIE_HIT.y, w: DIE_HIT.w / 2, h: DIE_HIT.h },
];
export const STATUS_Y = BOTTOM_CHIP_Y + CHIP_H + 50;
export const BUTTON_Y = STATUS_Y + 28;
export const BUTTON_H = 64;

// ---------------------------------------------------------------- text

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = INK, align: CanvasTextAlign = "center", weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** Largest size (≤ size) at which `str` fits `max` wide. */
export function fitSize(ctx: Ctx, str: string, size: number, max: number, weight = 800) {
  let s = size;
  for (; s > 10; s -= 1) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(str).width <= max) break;
  }
  return s;
}

/** Word-wrap `str` to `max` wide at the current font. */
export function wrap(ctx: Ctx, str: string, max: number) {
  const lines: string[] = [];
  let cur = "";
  for (const w of str.split(" ")) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function roundRect(ctx: Ctx, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

// ---------------------------------------------------------------- geometry (view space)

/** A board point (in squares, 0..15) turned a quarter clockwise `k` times. */
export function rotatePoint(x: number, y: number, k: number) {
  let p = { x, y };
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) p = { x: GRID - p.y, y: p.x };
  return p;
}

/** Screen point of a board point (in squares). */
export const toScreen = (x: number, y: number) => ({ x: BOARD.x + x * CELL, y: BOARD.y + y * CELL });

/** Centre of a base's slot `t`, for a base in view corner `vc`, in squares. */
export function baseSlot(vc: number, t: number) {
  const dx = t % 2 === 0 ? -1.15 : 1.15;
  const dy = t < 2 ? -1.15 : 1.15;
  return rotatePoint(3 + dx, 12 + dy, vc);
}

/** Where finished token `t` stands in the middle triangle of view corner `vc`, in squares. */
export const homeSpot = (vc: number, t: number) => rotatePoint(6.95 + t * 0.37, 8.45, vc);

// ---------------------------------------------------------------- background

/** A warm sunny backdrop with soft out-of-focus blobs, like the key art. */
export function drawBackground(ctx: Ctx, view: Rect) {
  const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
  g.addColorStop(0, "#ffe6c2");
  g.addColorStop(0.55, "#ffd7a6");
  g.addColorStop(1, "#f6bf86");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.save();
  for (const [x, y, r, a] of [
    [40, 90, 70, 0.22],
    [500, 70, 90, 0.18],
    [470, 900, 110, 0.16],
    [70, 880, 80, 0.2],
    [280, -20, 60, 0.15],
  ]) {
    const b = ctx.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, `rgba(255,255,240,${a})`);
    b.addColorStop(1, "rgba(255,255,240,0)");
    ctx.fillStyle = b;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- board

function star(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/**
 * The board as seen from view rotation: `colorOf[vc]` is the colour index in
 * view corner vc, or null for a corner nobody plays at this table.
 */
export function drawBoard(ctx: Ctx, colorOf: (number | null)[]) {
  const { x, y, w, h } = BOARD;
  const fill = (vc: number) => {
    const c = colorOf[vc];
    return c === null || c === undefined ? UNUSED : COLORS[c];
  };
  const dark = (vc: number) => {
    const c = colorOf[vc];
    return c === null || c === undefined ? UNUSED_DARK : DARK[c];
  };
  // Wooden frame
  ctx.save();
  ctx.shadowColor = "rgba(110,60,20,0.35)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  const wood = ctx.createLinearGradient(x, y, x + w, y + h);
  wood.addColorStop(0, "#e2a666");
  wood.addColorStop(1, "#b9773c");
  ctx.fillStyle = wood;
  roundRect(ctx, { x: x - 6, y: y - 6, w: w + 12, h: h + 12 }, 22);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#f7ead3";
  roundRect(ctx, { x: x + 2, y: y + 2, w: w - 4, h: h - 4 }, 16);
  ctx.fill();

  // Path squares
  const square = (cx: number, cy: number, color: string) => {
    ctx.fillStyle = color;
    roundRect(ctx, { x: x + cx * CELL + 1.5, y: y + cy * CELL + 1.5, w: CELL - 3, h: CELL - 3 }, 5);
    ctx.fill();
  };
  for (const [cx, cy] of TRACK) square(cx, cy, CREAM);
  for (let vc = 0; vc < 4; vc++) {
    for (const [cx, cy] of homeColumn(vc)) square(cx, cy, fill(vc));
    const [sx, sy] = TRACK[vc * 13];
    square(sx, sy, fill(vc));
    // An arrow on the start square, pointing the way round
    const next = TRACK[vc * 13 + 1];
    const c = { x: x + (sx + 0.5) * CELL, y: y + (sy + 0.5) * CELL };
    const a = Math.atan2(next[1] - sy, next[0] - sx);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(a);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(CELL * 0.28, 0);
    ctx.lineTo(-CELL * 0.16, -CELL * 0.22);
    ctx.lineTo(-CELL * 0.16, CELL * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Safe stars
  for (const i of STARS) {
    const [cx, cy] = TRACK[i];
    const c = { x: x + (cx + 0.5) * CELL, y: y + (cy + 0.5) * CELL };
    star(ctx, c.x, c.y, CELL * 0.36);
    ctx.fillStyle = "#f6c94a";
    ctx.fill();
    ctx.strokeStyle = "#c58f12";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Bases: a coloured tray with a cream inset and four round sockets
  for (let vc = 0; vc < 4; vc++) {
    const o = rotatePoint(0.5, 9.5, vc);
    const p = rotatePoint(5.5, 14.5, vc);
    const r: Rect = {
      x: x + Math.min(o.x, p.x) * CELL - CELL * 0.5 + 3,
      y: y + Math.min(o.y, p.y) * CELL - CELL * 0.5 + 3,
      w: CELL * 6 - 6,
      h: CELL * 6 - 6,
    };
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, fill(vc));
    g.addColorStop(1, dark(vc));
    ctx.fillStyle = g;
    roundRect(ctx, r, 18);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, { x: r.x + 6, y: r.y + 5, w: r.w - 12, h: r.h * 0.35 }, 14);
    ctx.fill();
    const inset: Rect = { x: r.x + CELL * 0.75, y: r.y + CELL * 0.75, w: r.w - CELL * 1.5, h: r.h - CELL * 1.5 };
    ctx.fillStyle = "rgba(255,250,240,0.92)";
    roundRect(ctx, inset, 14);
    ctx.fill();
    for (let t = 0; t < 4; t++) {
      const s = baseSlot(vc, t);
      const c = toScreen(s.x, s.y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, CELL * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = fill(vc);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x, c.y + 2, CELL * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fill();
    }
  }

  // The middle: four triangles, one per colour, pointing in
  const mid = toScreen(7.5, 7.5);
  for (let vc = 0; vc < 4; vc++) {
    const a = rotatePoint(6, 9, vc);
    const b = rotatePoint(9, 9, vc);
    const pa = toScreen(a.x, a.y);
    const pb = toScreen(b.x, b.y);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.lineTo(mid.x, mid.y);
    ctx.closePath();
    ctx.fillStyle = fill(vc);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** A pulsing ring on a square a token can reach (white inside, so it shows on any square). */
export function drawTarget(ctx: Ctx, x: number, y: number, color: number, pulse: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, CELL * (0.3 + 0.05 * pulse), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.3 * pulse})`;
  ctx.fill();
  ctx.strokeStyle = DARK[color];
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, CELL * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = COLORS[color];
  ctx.fill();
  ctx.restore();
}

/** A chunky down arrow over a token you can tap. */
export function drawPointer(ctx: Ctx, x: number, y: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 11, y - 12);
  ctx.lineTo(x + 11, y - 12);
  ctx.lineTo(x + 11, y - 2);
  ctx.lineTo(x + 17, y - 2);
  ctx.lineTo(x, y + 13);
  ctx.lineTo(x - 17, y - 2);
  ctx.lineTo(x - 11, y - 2);
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- tokens

/**
 * A horse token standing on (x, y) — the bottom of its base. `img` is the
 * token strip (four 120×150 cells); without it, a plain pawn.
 */
export function drawToken(
  ctx: Ctx,
  img: HTMLImageElement | null,
  color: number,
  x: number,
  y: number,
  scale: number,
  opts: { lift?: number; glow?: number; alpha?: number } = {},
) {
  const w = CELL * 1.02 * scale;
  const h = w * 1.25;
  const lift = opts.lift ?? 0;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  // Shadow shrinks as it hops
  ctx.fillStyle = "rgba(60,30,10,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y - 1, w * 0.36 * (1 - Math.min(0.4, lift / 60)), w * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  if (opts.glow !== undefined && opts.glow > 0) {
    // A bright halo under a token you can move
    const g = ctx.createRadialGradient(x, y - 2, 2, x, y - 2, w * 0.75);
    g.addColorStop(0, "rgba(255,248,200,0.95)");
    g.addColorStop(1, "rgba(255,248,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, w * 0.75, w * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y - 2, w * 0.5 + opts.glow * 3, w * 0.2 + opts.glow, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = DARK[color];
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const top = y - h - lift + h * 0.04;
  if (img?.complete && img.naturalWidth) {
    ctx.drawImage(img, color * 120, 0, 120, 150, x - w / 2, top, w, h);
  } else {
    ctx.fillStyle = COLORS[color];
    ctx.strokeStyle = DARK[color];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, top + h * 0.85, w * 0.42, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, top + h * 0.35, w * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- die

/** Pip spots on a face of side 1, centred on 0. */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.25, -0.25],
    [0.25, 0.25],
  ],
  3: [
    [-0.27, -0.27],
    [0, 0],
    [0.27, 0.27],
  ],
  4: [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ],
  5: [
    [-0.27, -0.27],
    [0.27, -0.27],
    [0, 0],
    [-0.27, 0.27],
    [0.27, 0.27],
  ],
  6: [
    [-0.25, -0.29],
    [0.25, -0.29],
    [-0.25, 0],
    [0.25, 0],
    [-0.25, 0.29],
    [0.25, 0.29],
  ],
};
/** The faces you see on top and to the right when `front` faces you (never an opposite pair). */
const SIDES: Record<number, [number, number]> = { 1: [2, 3], 2: [1, 4], 3: [1, 2], 4: [1, 5], 5: [1, 3], 6: [2, 4] };

function pips(ctx: Ctx, value: number, s: number, color: string) {
  ctx.fillStyle = color;
  for (const [px, py] of PIPS[value] ?? []) {
    ctx.beginPath();
    ctx.arc(px * s, py * s, s * (value === 1 ? 0.13 : 0.085), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A chunky ivory die, front face `value`, centred on (x, y), turned `spin`
 * radians. The top and right faces show in perspective, so it reads as a cube.
 */
export function drawDie(ctx: Ctx, x: number, y: number, size: number, value: number, spin = 0, pipColor = "#2b1d14") {
  const s = size;
  const d = s * 0.24;
  const [top, right] = SIDES[value] ?? [2, 3];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  const x0 = -s / 2 - d / 2;
  const y0 = -s / 2 + d / 2;
  ctx.lineJoin = "round";
  ctx.lineWidth = s * 0.16;
  // Top face
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + d, y0 - d);
  ctx.lineTo(x0 + s + d, y0 - d);
  ctx.lineTo(x0 + s, y0);
  ctx.closePath();
  ctx.fillStyle = "#fffdf8";
  ctx.strokeStyle = "#fffdf8";
  ctx.stroke();
  ctx.fill();
  // Right face
  ctx.beginPath();
  ctx.moveTo(x0 + s, y0);
  ctx.lineTo(x0 + s + d, y0 - d);
  ctx.lineTo(x0 + s + d, y0 + s - d);
  ctx.lineTo(x0 + s, y0 + s);
  ctx.closePath();
  ctx.fillStyle = "#dcd2c2";
  ctx.strokeStyle = "#dcd2c2";
  ctx.stroke();
  ctx.fill();
  // Front face
  const g = ctx.createLinearGradient(x0, y0, x0, y0 + s);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#efe6d8");
  ctx.fillStyle = g;
  roundRect(ctx, { x: x0 - s * 0.04, y: y0 - s * 0.04, w: s * 1.08, h: s * 1.08 }, s * 0.18);
  ctx.fill();
  // Pips: front flat, top and right sheared into their faces
  ctx.save();
  ctx.translate(x0 + s / 2, y0 + s / 2);
  pips(ctx, value, s, pipColor);
  ctx.restore();
  ctx.save();
  ctx.transform(1, 0, d / s, -d / s, x0, y0);
  ctx.translate(s / 2, s / 2);
  ctx.scale(0.8, 0.8);
  pips(ctx, top, s, "rgba(43,29,20,0.55)");
  ctx.restore();
  ctx.save();
  ctx.transform(d / s, -d / s, 0, 1, x0 + s, y0);
  ctx.translate(s / 2, s / 2);
  ctx.scale(0.8, 0.8);
  pips(ctx, right, s, "rgba(43,29,20,0.45)");
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- buttons & panels

export interface Button {
  id: string;
  rect: Rect;
  label: string;
  /** Colour index for a coloured button, or a CSS colour. */
  fill?: string;
  edge?: string;
  ink?: string;
  disabled?: boolean;
  /** A selected segment (menus). */
  on?: boolean;
}

/** A candy button: a coloured top over a darker edge, pressed in when `on`. */
export function drawButton(ctx: Ctx, b: Button) {
  const r = b.rect;
  const depth = b.on ? 2 : 5;
  ctx.save();
  if (b.disabled) ctx.globalAlpha = 0.45;
  const fill = b.fill ?? "#ffb43c";
  const edge = b.edge ?? "#d9851a";
  ctx.fillStyle = "rgba(90,45,10,0.18)";
  roundRect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, 16);
  ctx.fill();
  ctx.fillStyle = edge;
  roundRect(ctx, r, 16);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, { x: r.x, y: r.y + (5 - depth), w: r.w, h: r.h - 5 }, 16);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(ctx, { x: r.x + 6, y: r.y + (5 - depth) + 4, w: r.w - 12, h: (r.h - 5) * 0.38 }, 10);
  ctx.fill();
  if (b.on) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    roundRect(ctx, { x: r.x + 2, y: r.y + 5, w: r.w - 4, h: r.h - 9 }, 14);
    ctx.stroke();
  }
  const ink = b.ink ?? "#ffffff";
  const size = fitSize(ctx, b.label, Math.min(26, r.h * 0.42), r.w - 18);
  text(ctx, b.label, r.x + r.w / 2, r.y + (5 - depth) + (r.h - 5) / 2 + 2, size, ink);
  ctx.restore();
}

/** A rounded cream card with a soft shadow. */
export function drawPanel(ctx: Ctx, r: Rect, fill = PANEL) {
  ctx.save();
  ctx.shadowColor = "rgba(90,45,10,0.3)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = fill;
  roundRect(ctx, r, 26);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(201,135,74,0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 12 }, 21);
  ctx.stroke();
}

/** The title in the four colours, as on the poster: a word each, or a letter each for one word. */
export function drawTitle(ctx: Ctx, str: string, x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const single = !str.includes(" ");
  const words = single ? [...str] : str.split(" ");
  const gap = single ? size * 0.03 : ctx.measureText(" ").width;
  const widths = words.map((w) => ctx.measureText(w).width);
  let cx = x - (widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1)) / 2;
  ctx.lineJoin = "round";
  words.forEach((w, i) => {
    const c = i % 4;
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(w, cx, y);
    ctx.fillStyle = DARK[c];
    ctx.fillText(w, cx, y + size * 0.05);
    ctx.fillStyle = COLORS[c];
    ctx.fillText(w, cx, y);
    cx += widths[i] + gap;
  });
}
