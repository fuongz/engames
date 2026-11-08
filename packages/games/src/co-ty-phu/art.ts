import type { Rect } from "@web-games/core";
import { BOARD, GROUP_COLORS, PLAYER_COLORS, SQUARES, type Token } from "./config";

// Drawing for Cờ Tỷ Phú: a lacquer-and-gold look to match the key art — deep
// red lacquer table, cream paper tiles with our own group colours, a jade
// centre, wooden-toy tokens. Everything is procedural so it stays sharp at
// any zoom. Text is Mali (600/700) and Baloo 2 (800), imported in game.ts.

type Ctx = CanvasRenderingContext2D;

export const FONT = '"Mali", "Trebuchet MS", system-ui, sans-serif';
export const TITLE_FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export const LACQUER = "#4a1712";
export const LACQUER_DARK = "#2c0d0a";
export const GOLD = "#e9b949";
export const GOLD_DARK = "#a8741f";
export const PAPER = "#fbf1dc";
export const PAPER_DARK = "#efdfbd";
export const INK = "#2b1a12";
export const INK_SOFT = "#7a6250";
export const JADE = "#1f7a5c";
export const JADE_DARK = "#145440";
export const RED = "#c8302a";
export const GREEN = "#2f9e6a";

// ---------------------------------------------------------------- text

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = INK, align: CanvasTextAlign = "center", weight = 700, font = FONT) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** Largest size (≤ size) at which `str` fits `max` wide. */
export function fitSize(ctx: Ctx, str: string, size: number, max: number, weight = 700, font = FONT) {
  let s = size;
  for (; s > 9; s -= 1) {
    ctx.font = `${weight} ${s}px ${font}`;
    if (ctx.measureText(str).width <= max) break;
  }
  return s;
}

/** Text shrunk to fit `max`. */
export function fitText(ctx: Ctx, str: string, x: number, y: number, size: number, max: number, fill = INK, align: CanvasTextAlign = "center", weight = 700, font = FONT) {
  text(ctx, str, x, y, fitSize(ctx, str, size, max, weight, font), fill, align, weight, font);
}

/** Word-wrap `str` to lines no wider than `max` at the current font. */
export function wrap(ctx: Ctx, str: string, max: number, size: number, weight = 700): string[] {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const words = str.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- panels and buttons

export function roundRect(ctx: Ctx, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

/** A cream paper panel with a gold rim, like a lacquer box lid. */
export function drawPanel(ctx: Ctx, r: Rect, fill = PAPER, radius = 22) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, r, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, radius - 4);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export type ButtonKind = "primary" | "secondary" | "danger" | "ghost" | "gold";

export interface ButtonLook {
  rect: Rect;
  label: string;
  kind?: ButtonKind;
  disabled?: boolean;
  /** A small second line under the label. */
  sub?: string;
  /** Selected state for toggle chips. */
  on?: boolean;
  size?: number;
}

const BUTTON_FILL: Record<ButtonKind, [string, string, string]> = {
  primary: ["#e4473b", "#b82a22", "#fff7e8"],
  secondary: ["#fff6e2", "#ead6ad", INK],
  danger: ["#5b5550", "#3c3733", "#fff7e8"],
  ghost: ["rgba(48,16,12,0.86)", "rgba(30,8,6,0.86)", "#fff1d2"],
  gold: ["#f6cf62", "#d79b2c", "#3a210c"],
};

export function drawButton(ctx: Ctx, b: ButtonLook) {
  const kind = b.on ? "gold" : (b.kind ?? "secondary");
  const [top, bottom, ink] = BUTTON_FILL[kind];
  const r = b.rect;
  const radius = Math.min(18, r.h / 2);
  ctx.save();
  if (b.disabled) ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  roundRect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, radius);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  roundRect(ctx, r, radius);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = kind === "secondary" ? GOLD_DARK : "rgba(255,230,160,0.55)";
  ctx.lineWidth = kind === "ghost" ? 1.5 : 2;
  ctx.stroke();
  const size = b.size ?? (r.h >= 64 ? 26 : r.h >= 52 ? 22 : 19);
  if (b.sub) {
    fitText(ctx, b.label, r.x + r.w / 2, r.y + r.h / 2 - size * 0.42, size, r.w - 16, ink);
    fitText(ctx, b.sub, r.x + r.w / 2, r.y + r.h / 2 + size * 0.62, size * 0.62, r.w - 16, ink, "center", 600);
  } else fitText(ctx, b.label, r.x + r.w / 2, r.y + r.h / 2 + 1, size, r.w - 16, ink);
  ctx.restore();
}

// ---------------------------------------------------------------- background

export function drawTable(ctx: Ctx, view: Rect) {
  const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
  g.addColorStop(0, "#5a1c15");
  g.addColorStop(0.5, LACQUER);
  g.addColorStop(1, LACQUER_DARK);
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Faint gold cloud scrolls in the lacquer
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const x = view.x + ((i * 173) % view.w);
    const y = view.y + ((i * 241) % view.h);
    cloud(ctx, x, y, 34 + (i % 3) * 14);
  }
  ctx.restore();
}

function cloud(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, Math.PI * 2);
  ctx.arc(x + r * 1.2, y, r * 0.6, Math.PI, Math.PI * 2.2);
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x - r * 1.6, y + r * 0.6, x - r * 0.7, y + r * 0.5);
  ctx.stroke();
}

// ---------------------------------------------------------------- the board (board px; 1200 square)

export const UNIT = 100;
export const CORNER = 150;
export const BOARD_PX = CORNER * 2 + UNIT * 9;
const BAND = 26;

/** Where square `sq` sits on the board, and which side it faces. */
export function tileRect(sq: number): Rect & { side: 0 | 1 | 2 | 3 } {
  const S = BOARD_PX;
  if (sq === 0) return { x: S - CORNER, y: S - CORNER, w: CORNER, h: CORNER, side: 0 };
  if (sq < 10) return { x: S - CORNER - sq * UNIT, y: S - CORNER, w: UNIT, h: CORNER, side: 0 };
  if (sq === 10) return { x: 0, y: S - CORNER, w: CORNER, h: CORNER, side: 1 };
  if (sq < 20) return { x: 0, y: S - CORNER - (sq - 10) * UNIT, w: CORNER, h: UNIT, side: 1 };
  if (sq === 20) return { x: 0, y: 0, w: CORNER, h: CORNER, side: 2 };
  if (sq < 30) return { x: CORNER + (sq - 21) * UNIT, y: 0, w: UNIT, h: CORNER, side: 2 };
  if (sq === 30) return { x: S - CORNER, y: 0, w: CORNER, h: CORNER, side: 3 };
  return { x: S - CORNER, y: CORNER + (sq - 31) * UNIT, w: CORNER, h: UNIT, side: 3 };
}

export const tileCenter = (sq: number) => {
  const r = tileRect(sq);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};

/** Where tokens stand on a square: low in the tile, so its name stays readable. */
export const tokenSpot = (sq: number) => {
  const r = tileRect(sq);
  if (sq % 10 === 0) return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  const body = bodyRect(r, BOARD[sq].kind === "prop");
  return { x: body.x + body.w / 2, y: body.y + body.h - 34 };
};

/** The colour band of a property, on the side facing the middle of the board. */
function bandRect(r: Rect & { side: number }): Rect {
  switch (r.side) {
    case 0:
      return { x: r.x, y: r.y, w: r.w, h: BAND };
    case 1:
      return { x: r.x + r.w - BAND, y: r.y, w: BAND, h: r.h };
    case 2:
      return { x: r.x, y: r.y + r.h - BAND, w: r.w, h: BAND };
    default:
      return { x: r.x, y: r.y, w: BAND, h: r.h };
  }
}

/** The tile's body (everything but the band). */
function bodyRect(r: Rect & { side: number }, hasBand: boolean): Rect {
  if (!hasBand) return r;
  switch (r.side) {
    case 0:
      return { x: r.x, y: r.y + BAND, w: r.w, h: r.h - BAND };
    case 1:
      return { x: r.x, y: r.y, w: r.w - BAND, h: r.h };
    case 2:
      return { x: r.x, y: r.y, w: r.w, h: r.h - BAND };
    default:
      return { x: r.x + BAND, y: r.y, w: r.w - BAND, h: r.h };
  }
}

export interface BoardLook {
  owner: readonly number[];
  houses: readonly number[];
  mortgaged: readonly boolean[];
  /** Square to highlight (the deed being decided on), or -1. */
  focus: number;
  now: number;
}

/**
 * The whole board, in board px; the caller has set the transform. `visible`
 * (board px) culls tiles off screen.
 */
export function drawBoard(ctx: Ctx, look: BoardLook, names: (sq: number) => string, labels: { title: string; chance: string; chest: string; mortgaged: string }, visible: Rect) {
  const S = BOARD_PX;
  // Gold frame and jade middle
  ctx.fillStyle = GOLD_DARK;
  ctx.fillRect(-10, -10, S + 20, S + 20);
  ctx.fillStyle = PAPER_DARK;
  ctx.fillRect(0, 0, S, S);
  const mid = { x: CORNER, y: CORNER, w: S - 2 * CORNER, h: S - 2 * CORNER };
  const g = ctx.createRadialGradient(S / 2, S / 2, 60, S / 2, S / 2, mid.w * 0.75);
  g.addColorStop(0, "#2a8c69");
  g.addColorStop(1, JADE_DARK);
  ctx.fillStyle = g;
  ctx.fillRect(mid.x, mid.y, mid.w, mid.h);
  drawCentre(ctx, mid, labels);
  for (let sq = 0; sq < SQUARES; sq++) {
    const r = tileRect(sq);
    if (r.x > visible.x + visible.w || r.x + r.w < visible.x || r.y > visible.y + visible.h || r.y + r.h < visible.y) continue;
    drawTile(ctx, sq, look, names(sq), labels.mortgaged);
  }
}

function drawCentre(ctx: Ctx, mid: Rect, labels: { title: string; chance: string; chest: string }) {
  const cx = mid.x + mid.w / 2;
  const cy = mid.y + mid.h / 2;
  // Gold lotus ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(233,185,73,0.35)";
  ctx.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.ellipse(0, -170, 40, 90, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.lineJoin = "round";
  const size = 120;
  ctx.font = `800 ${size}px ${TITLE_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let s = size;
  while (s > 40 && ctx.measureText(labels.title).width > 640) {
    s -= 4;
    ctx.font = `800 ${s}px ${TITLE_FONT}`;
  }
  ctx.lineWidth = s * 0.16;
  ctx.strokeStyle = "#7a1d14";
  ctx.strokeText(labels.title, 0, 0);
  ctx.fillStyle = GOLD;
  ctx.fillText(labels.title, 0, 0);
  ctx.restore();
  // The two decks
  deck(ctx, cx - 250, cy - 250, "#d9473b", labels.chance, "?");
  deck(ctx, cx + 250, cy + 250, "#2a6fc2", labels.chest, "★");
}

function deck(ctx: Ctx, x: number, y: number, color: string, label: string, glyph: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);
  for (let i = 2; i >= 0; i--) {
    roundRect(ctx, { x: -80 + i * 4, y: -55 + i * 4, w: 160, h: 110 }, 12);
    ctx.fillStyle = i === 0 ? color : "rgba(0,0,0,0.25)";
    ctx.fill();
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, { x: -72, y: -47, w: 144, h: 94 }, 8);
  ctx.stroke();
  text(ctx, glyph, 0, -12, 44, "#fff3d6", "center", 800, TITLE_FONT);
  text(ctx, label, 0, 28, 22, "#fff3d6", "center", 700);
  ctx.restore();
}

function drawTile(ctx: Ctx, sq: number, look: BoardLook, name: string, mortgagedLabel: string) {
  const square = BOARD[sq];
  const r = tileRect(sq);
  const hasBand = square.kind === "prop";
  ctx.fillStyle = sq === look.focus ? "#fff8d8" : PAPER;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = "#b99a68";
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  const body = bodyRect(r, hasBand);
  const cx = body.x + body.w / 2;
  if (hasBand) {
    const band = bandRect(r);
    ctx.fillStyle = GROUP_COLORS[square.group];
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(band.x, band.y, band.w, band.h);
    drawHouses(ctx, band, look.houses[sq], r.side);
  }
  const owner = look.owner[sq];
  switch (square.kind) {
    case "prop":
    case "transport":
    case "utility": {
      const lines = nameLines(ctx, name, body.w - 10);
      const top = body.y + (square.kind === "prop" ? 22 : 18);
      for (const [i, l] of lines.entries()) fitText(ctx, l, cx, top + i * 21, lineSize(lines), body.w - 8, INK, "center", 700);
      if (square.kind !== "prop") icon(ctx, square.kind === "transport" ? transportIcon(sq) : sq === 12 ? "power" : "water", cx, body.y + body.h * 0.6, 26);
      text(ctx, `${square.price}K`, cx, body.y + body.h - 15, 18, INK_SOFT, "center", 700);
      break;
    }
    case "chance":
    case "chest":
      icon(ctx, square.kind, cx, body.y + body.h * 0.5, 34);
      text(ctx, name, cx, body.y + 18, 15, INK, "center", 700);
      break;
    case "tax":
      for (const [i, l] of nameLines(ctx, name, body.w - 10).entries()) text(ctx, l, cx, body.y + 18 + i * 18, 15, INK, "center", 700);
      icon(ctx, "tax", cx, body.y + body.h * 0.62, 24);
      text(ctx, `${square.price}K`, cx, body.y + body.h - 14, 16, RED, "center", 700);
      break;
    case "start":
      drawStart(ctx, r, name);
      break;
    case "jail":
      drawJail(ctx, r, name);
      break;
    case "rest":
      icon(ctx, "tea", cx, r.y + r.h * 0.45, 46);
      text(ctx, name, cx, r.y + r.h - 24, 20, INK, "center", 700);
      break;
    case "gotojail":
      icon(ctx, "whistle", cx, r.y + r.h * 0.42, 46);
      text(ctx, name, cx, r.y + r.h - 24, 20, RED, "center", 700);
      break;
  }
  if (owner >= 0) {
    // The owner's colour along the outer edge
    ctx.fillStyle = PLAYER_COLORS[owner];
    const e = 9;
    if (r.side === 0) ctx.fillRect(r.x + 3, r.y + r.h - e - 2, r.w - 6, e);
    else if (r.side === 1) ctx.fillRect(r.x + 2, r.y + 3, e, r.h - 6);
    else if (r.side === 2) ctx.fillRect(r.x + 3, r.y + 2, r.w - 6, e);
    else ctx.fillRect(r.x + r.w - e - 2, r.y + 3, e, r.h - 6);
  }
  if (look.mortgaged[sq]) {
    ctx.save();
    ctx.fillStyle = "rgba(60,40,30,0.45)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(-0.5);
    fitText(ctx, mortgagedLabel, 0, 0, 16, Math.max(r.w, r.h) - 10, "#fff1d2", "center", 700);
    ctx.restore();
  }
  if (sq === look.focus) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 5 + Math.sin(look.now * 6) * 1.5;
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  }
}

function nameLines(ctx: Ctx, name: string, max: number): string[] {
  const lines = wrap(ctx, name, max, 19);
  return lines.length > 2 ? [lines[0], lines.slice(1).join(" ")] : lines;
}
const lineSize = (lines: string[]) => (lines.length > 1 ? 18 : 19);

const transportIcon = (sq: number) => (sq === 5 ? "bus" : sq === 15 ? "train" : sq === 25 ? "ship" : "plane");

function drawHouses(ctx: Ctx, band: Rect, h: number, side: number) {
  if (h <= 0) return;
  const horizontal = side === 0 || side === 2;
  if (h === 5) {
    house(ctx, band.x + band.w / 2, band.y + band.h / 2, 20, "#d0342c");
    return;
  }
  for (let i = 0; i < h; i++) {
    const k = (i - (h - 1) / 2) * 22;
    const x = horizontal ? band.x + band.w / 2 + k : band.x + band.w / 2;
    const y = horizontal ? band.y + band.h / 2 : band.y + band.h / 2 + k;
    house(ctx, x, y, 15, "#36a35f");
  }
}

function house(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y + s / 2);
  ctx.lineTo(x - s / 2, y - s * 0.05);
  ctx.lineTo(x, y - s / 2);
  ctx.lineTo(x + s / 2, y - s * 0.05);
  ctx.lineTo(x + s / 2, y + s / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff8e6";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawStart(ctx: Ctx, r: Rect, name: string) {
  const cx = r.x + r.w / 2;
  ctx.fillStyle = "#fff0c9";
  ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  // A big arrow pointing the way round (leftwards along the bottom)
  ctx.save();
  ctx.translate(cx, r.y + r.h * 0.62);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(-58, 0);
  ctx.lineTo(-22, -28);
  ctx.lineTo(-22, -12);
  ctx.lineTo(56, -12);
  ctx.lineTo(56, 12);
  ctx.lineTo(-22, 12);
  ctx.lineTo(-22, 28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, name, cx, r.y + 34, 22, INK, "center", 700);
  text(ctx, "+200K", cx, r.y + r.h - 26, 20, JADE, "center", 800, TITLE_FONT);
}

function drawJail(ctx: Ctx, r: Rect, name: string) {
  // The cell sits in the corner; the rest of the square is "just visiting"
  const cell = { x: r.x + 40, y: r.y + 6, w: r.w - 46, h: r.h - 46 };
  ctx.fillStyle = "#e8c8a0";
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  ctx.strokeStyle = "#5a3a28";
  ctx.lineWidth = 4;
  for (let i = 1; i < 5; i++) {
    const x = cell.x + (cell.w * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, cell.y);
    ctx.lineTo(x, cell.y + cell.h);
    ctx.stroke();
  }
  ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
  text(ctx, name, r.x + r.w / 2, r.y + r.h - 20, 18, INK, "center", 700);
}

/** Jail cell area (for tokens of jailed players). */
export const jailCell = () => {
  const r = tileRect(10);
  return { x: r.x + 40 + (r.w - 46) / 2, y: r.y + 6 + (r.h - 46) / 2 };
};

// ---------------------------------------------------------------- icons

export type IconName = "chance" | "chest" | "tax" | "bus" | "train" | "ship" | "plane" | "power" | "water" | "tea" | "whistle";

export function icon(ctx: Ctx, name: IconName, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (name) {
    case "chance":
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#d9473b";
      ctx.fill();
      text(ctx, "?", 0, 2, s * 0.8, "#fff3d6", "center", 800, TITLE_FONT);
      break;
    case "chest":
      // A red envelope with a gold seal
      roundRect(ctx, { x: -s * 0.4, y: -s * 0.55, w: s * 0.8, h: s * 1.1 }, 5);
      ctx.fillStyle = "#d33a2f";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.3);
      ctx.lineTo(0, -s * 0.05);
      ctx.lineTo(s * 0.4, -s * 0.3);
      ctx.strokeStyle = "#8f1d16";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -s * 0.05, s * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      break;
    case "tax":
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, s * 0.3 - i * s * 0.22, s * 0.45, s * 0.16, 0, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? "#f2c24f" : "#d9a23a";
        ctx.fill();
        ctx.strokeStyle = GOLD_DARK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      break;
    case "bus":
      roundRect(ctx, { x: -s * 0.6, y: -s * 0.4, w: s * 1.2, h: s * 0.7 }, 6);
      ctx.fillStyle = "#2f8fce";
      ctx.fill();
      ctx.fillStyle = "#dff3ff";
      for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.5 + i * s * 0.36, -s * 0.3, s * 0.28, s * 0.22);
      wheel(ctx, -s * 0.32, s * 0.32, s * 0.13);
      wheel(ctx, s * 0.32, s * 0.32, s * 0.13);
      break;
    case "train":
      ctx.fillStyle = "#3b3f4a";
      ctx.fillRect(-s * 0.6, -s * 0.15, s * 0.9, s * 0.45);
      ctx.fillRect(s * 0.1, -s * 0.5, s * 0.35, s * 0.4);
      ctx.fillRect(-s * 0.45, -s * 0.45, s * 0.16, s * 0.3);
      ctx.fillStyle = RED;
      ctx.fillRect(-s * 0.6, -s * 0.05, s * 0.9, s * 0.08);
      wheel(ctx, -s * 0.38, s * 0.36, s * 0.13);
      wheel(ctx, 0, s * 0.36, s * 0.13);
      wheel(ctx, s * 0.32, s * 0.36, s * 0.13);
      break;
    case "ship":
      ctx.beginPath();
      ctx.moveTo(-s * 0.65, s * 0.05);
      ctx.lineTo(s * 0.65, s * 0.05);
      ctx.lineTo(s * 0.42, s * 0.4);
      ctx.lineTo(-s * 0.45, s * 0.4);
      ctx.closePath();
      ctx.fillStyle = "#8a4b2a";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, s * 0.02);
      ctx.lineTo(-s * 0.05, -s * 0.6);
      ctx.lineTo(s * 0.45, -s * 0.05);
      ctx.closePath();
      ctx.fillStyle = "#e0552f";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, -s * 0.5);
      ctx.lineTo(-s * 0.5, -s * 0.02);
      ctx.lineTo(-s * 0.12, -s * 0.02);
      ctx.closePath();
      ctx.fill();
      break;
    case "plane":
      ctx.fillStyle = "#5b6f8a";
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.7, s * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, 0);
      ctx.lineTo(-s * 0.35, -s * 0.55);
      ctx.lineTo(-s * 0.15, -s * 0.55);
      ctx.lineTo(s * 0.25, 0);
      ctx.lineTo(-s * 0.15, s * 0.55);
      ctx.lineTo(-s * 0.35, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, 0);
      ctx.lineTo(-s * 0.7, -s * 0.25);
      ctx.lineTo(-s * 0.6, -s * 0.25);
      ctx.lineTo(-s * 0.45, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case "power":
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.6);
      ctx.lineTo(-s * 0.35, s * 0.08);
      ctx.lineTo(-s * 0.02, s * 0.08);
      ctx.lineTo(-s * 0.12, s * 0.6);
      ctx.lineTo(s * 0.35, -s * 0.1);
      ctx.lineTo(s * 0.02, -s * 0.1);
      ctx.closePath();
      ctx.fillStyle = "#f2b81f";
      ctx.fill();
      ctx.strokeStyle = GOLD_DARK;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    case "water":
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.6);
      ctx.bezierCurveTo(s * 0.5, -s * 0.05, s * 0.45, s * 0.55, 0, s * 0.55);
      ctx.bezierCurveTo(-s * 0.45, s * 0.55, -s * 0.5, -s * 0.05, 0, -s * 0.6);
      ctx.fillStyle = "#3a9ad9";
      ctx.fill();
      break;
    case "tea":
      ctx.fillStyle = "#3d8c6a";
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.2);
      ctx.lineTo(s * 0.45, -s * 0.2);
      ctx.lineTo(s * 0.32, s * 0.4);
      ctx.lineTo(-s * 0.32, s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#9b7a4f";
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.18, -s * 0.3);
        ctx.quadraticCurveTo(i * s * 0.18 + s * 0.1, -s * 0.45, i * s * 0.18, -s * 0.6);
        ctx.stroke();
      }
      break;
    case "whistle":
      // A traffic warden's cap
      ctx.fillStyle = "#2d4a7a";
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.05, s * 0.55, s * 0.32, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-s * 0.55, -s * 0.08, s * 1.1, s * 0.18);
      ctx.fillStyle = "#1c1c1c";
      ctx.beginPath();
      ctx.ellipse(s * 0.1, s * 0.12, s * 0.6, s * 0.12, 0, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -s * 0.18, s * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
      break;
  }
  ctx.restore();
}

function wheel(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#222";
  ctx.fill();
}

// ---------------------------------------------------------------- tokens

/** A wooden-toy token: a coloured base with the seat's symbol. `s` is its diameter. */
export function drawToken(ctx: Ctx, token: Token, seat: number, x: number, y: number, s: number, lift = 0, dim = false) {
  const color = PLAYER_COLORS[seat] ?? "#888";
  ctx.save();
  if (dim) ctx.globalAlpha = 0.45;
  // Shadow on the board
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.32, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y - lift);
  // Base disc
  ctx.beginPath();
  ctx.ellipse(0, s * 0.22, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = shade(color, -0.25);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, s * 0.16, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff6e0";
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.stroke();
  tokenGlyph(ctx, token, color, s);
  ctx.restore();
}

function tokenGlyph(ctx: Ctx, token: Token, color: string, s: number) {
  const edge = "#fff6e0";
  ctx.lineWidth = Math.max(1.5, s * 0.035);
  ctx.strokeStyle = shade(color, -0.45);
  switch (token) {
    case "hat": {
      // Nón lá on a little body
      ctx.fillStyle = color;
      roundRect(ctx, { x: -s * 0.18, y: -s * 0.2, w: s * 0.36, h: s * 0.38 }, s * 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.18);
      ctx.lineTo(0, -s * 0.55);
      ctx.lineTo(s * 0.4, -s * 0.18);
      ctx.quadraticCurveTo(0, -s * 0.1, -s * 0.4, -s * 0.18);
      ctx.fillStyle = "#f3d98c";
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "lantern": {
      ctx.fillStyle = "#3a2a1c";
      ctx.fillRect(-s * 0.02, -s * 0.62, s * 0.04, s * 0.12);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.22, s * 0.28, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = edge;
      ctx.lineWidth = Math.max(1, s * 0.025);
      for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.22, s * 0.28 * Math.abs(k || 0.02), s * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = GOLD;
      ctx.fillRect(-s * 0.14, -s * 0.54, s * 0.28, s * 0.05);
      ctx.fillRect(-s * 0.14, s * 0.06, s * 0.28, s * 0.05);
      break;
    }
    case "lotus": {
      ctx.fillStyle = "#f6a3c0";
      for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
        ctx.save();
        ctx.translate(0, -s * 0.05);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.24, s * 0.11, s * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = shade("#f6a3c0", -0.35);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.02, s * 0.26, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      break;
    }
    case "boat": {
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.1);
      ctx.lineTo(s * 0.4, -s * 0.1);
      ctx.lineTo(s * 0.28, s * 0.1);
      ctx.lineTo(-s * 0.28, s * 0.1);
      ctx.closePath();
      ctx.fillStyle = "#8a4b2a";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.02, -s * 0.12);
      ctx.lineTo(-s * 0.02, -s * 0.6);
      ctx.lineTo(s * 0.3, -s * 0.16);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
}

/** Lighten (k > 0) or darken (k < 0) a #rrggbb colour. */
export function shade(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------- dice

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
};

/** An ivory die showing `n`, rotated by `rot`. */
export function drawDie(ctx: Ctx, n: number, x: number, y: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  roundRect(ctx, { x: -s / 2 + 3, y: -s / 2 + 5, w: s, h: s }, s * 0.2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, "#fffaf0");
  g.addColorStop(1, "#ead9b8");
  ctx.fillStyle = g;
  roundRect(ctx, { x: -s / 2, y: -s / 2, w: s, h: s }, s * 0.2);
  ctx.fill();
  ctx.strokeStyle = "#c2a676";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = n === 1 ? RED : "#3a2418";
  for (const [px, py] of PIPS[n] ?? []) {
    ctx.beginPath();
    ctx.arc(px * s * 0.25, py * s * 0.25, s * (n === 1 ? 0.12 : 0.085), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- deed chip

/** A small deed label: colour band on the left, name, optional right-hand text. */
export function drawDeedChip(ctx: Ctx, r: Rect, sq: number, name: string, opts: { on?: boolean; disabled?: boolean; right?: string; mortgaged?: boolean } = {}) {
  ctx.save();
  if (opts.disabled) ctx.globalAlpha = 0.4;
  roundRect(ctx, r, 10);
  ctx.fillStyle = opts.on ? "#ffe7a3" : "#fffaf0";
  ctx.fill();
  ctx.strokeStyle = opts.on ? GOLD_DARK : "#d8c39a";
  ctx.lineWidth = opts.on ? 3 : 1.5;
  ctx.stroke();
  const square = BOARD[sq];
  ctx.fillStyle = GROUP_COLORS[square.group] ?? "#999";
  roundRect(ctx, { x: r.x + 5, y: r.y + 5, w: 14, h: r.h - 10 }, 4);
  ctx.fill();
  const right = opts.right ?? "";
  ctx.font = `600 15px ${FONT}`;
  const rw = right ? ctx.measureText(right).width + 10 : 0;
  fitText(ctx, name, r.x + 28, r.y + r.h / 2, 18, r.w - 36 - rw, opts.mortgaged ? INK_SOFT : INK, "left", 700);
  if (right) text(ctx, right, r.x + r.w - 8, r.y + r.h / 2, 15, INK_SOFT, "right", 600);
  ctx.restore();
}
