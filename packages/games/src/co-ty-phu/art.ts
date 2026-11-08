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

// ---------------------------------------------------------------- the board: a ring round the whole screen

/** The board's geometry for a given visible area: corners in the corners, 9 squares a side. */
export interface Ring {
  /** The whole ring (the visible area). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner (and side-square) width, corner (and top/bottom square) height. */
  cw: number;
  ch: number;
  /** Width of a top/bottom square, height of a side square. */
  tw: number;
  sh: number;
  /** The space inside the ring: the dashboard. */
  inner: Rect;
}

/** Strip on each square's inner edge: owner colour and houses. */
const STRIP = 10;

export function ringLayout(view: Rect): Ring {
  const ch = Math.round(Math.min(84, Math.max(62, view.h * 0.13)));
  const cw = Math.round(Math.min(150, Math.max(112, view.w * 0.12)));
  const tw = (view.w - 2 * cw) / 9;
  const sh = (view.h - 2 * ch) / 9;
  return { x: view.x, y: view.y, w: view.w, h: view.h, cw, ch, tw, sh, inner: { x: view.x + cw, y: view.y + ch, w: view.w - 2 * cw, h: view.h - 2 * ch } };
}

/** Where square `sq` sits, and which edge it is on (0 bottom, 1 left, 2 top, 3 right). */
export function tileRect(L: Ring, sq: number): Rect & { side: 0 | 1 | 2 | 3 } {
  const right = L.x + L.w - L.cw;
  const bottom = L.y + L.h - L.ch;
  if (sq === 0) return { x: right, y: bottom, w: L.cw, h: L.ch, side: 0 };
  if (sq < 10) return { x: right - sq * L.tw, y: bottom, w: L.tw, h: L.ch, side: 0 };
  if (sq === 10) return { x: L.x, y: bottom, w: L.cw, h: L.ch, side: 1 };
  if (sq < 20) return { x: L.x, y: bottom - (sq - 10) * L.sh, w: L.cw, h: L.sh, side: 1 };
  if (sq === 20) return { x: L.x, y: L.y, w: L.cw, h: L.ch, side: 2 };
  if (sq < 30) return { x: L.x + L.cw + (sq - 21) * L.tw, y: L.y, w: L.tw, h: L.ch, side: 2 };
  if (sq === 30) return { x: right, y: L.y, w: L.cw, h: L.ch, side: 3 };
  return { x: right, y: L.y + L.ch + (sq - 31) * L.sh, w: L.cw, h: L.sh, side: 3 };
}

/** The strip along the inner edge (towards the dashboard). */
function stripRect(r: Rect & { side: number }): Rect {
  switch (r.side) {
    case 0:
      return { x: r.x, y: r.y, w: r.w, h: STRIP };
    case 1:
      return { x: r.x + r.w - STRIP, y: r.y, w: STRIP, h: r.h };
    case 2:
      return { x: r.x, y: r.y + r.h - STRIP, w: r.w, h: STRIP };
    default:
      return { x: r.x, y: r.y, w: STRIP, h: r.h };
  }
}

/** The square minus its inner strip. */
function bodyRect(r: Rect & { side: number }): Rect {
  switch (r.side) {
    case 0:
      return { x: r.x, y: r.y + STRIP, w: r.w, h: r.h - STRIP };
    case 1:
      return { x: r.x, y: r.y, w: r.w - STRIP, h: r.h };
    case 2:
      return { x: r.x, y: r.y, w: r.w, h: r.h - STRIP };
    default:
      return { x: r.x + STRIP, y: r.y, w: r.w - STRIP, h: r.h };
  }
}

/** Where tokens stand: on the square's inner edge, so its name and price stay readable. */
export function tokenSpot(L: Ring, sq: number, jailed = false): { x: number; y: number } {
  const r = tileRect(L, sq);
  if (sq === 10) return jailed ? { x: r.x + r.w * 0.3, y: r.y + r.h * 0.42 } : { x: r.x + r.w * 0.78, y: r.y + r.h * 0.22 };
  if (sq % 10 === 0) return { x: r.x + r.w / 2, y: r.y + r.h * 0.36 };
  switch (r.side) {
    case 0:
      return { x: r.x + r.w / 2, y: r.y + 2 };
    case 1:
      return { x: r.x + r.w - 2, y: r.y + r.h / 2 };
    case 2:
      return { x: r.x + r.w / 2, y: r.y + r.h - 2 };
    default:
      return { x: r.x + 2, y: r.y + r.h / 2 };
  }
}

/** Which square is under a point, or -1. */
export function squareAt(L: Ring, p: { x: number; y: number }): number {
  for (let sq = 0; sq < SQUARES; sq++) {
    const r = tileRect(L, sq);
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return sq;
  }
  return -1;
}

export interface BoardLook {
  owner: readonly number[];
  houses: readonly number[];
  mortgaged: readonly boolean[];
  /** Square to highlight (the deed being decided on), or -1. */
  focus: number;
  now: number;
}

/** Mix a #rrggbb colour toward paper (k = share of paper). */
function tint(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const p = [251, 241, 220];
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (p[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function drawRing(ctx: Ctx, L: Ring, look: BoardLook, names: (sq: number) => string, labels: { mortgaged: string; salary: string }) {
  for (let sq = 0; sq < SQUARES; sq++) drawTile(ctx, L, sq, look, names(sq), labels);
}

function drawTile(ctx: Ctx, L: Ring, sq: number, look: BoardLook, name: string, labels: { mortgaged: string; salary: string }) {
  const square = BOARD[sq];
  const r = tileRect(L, sq);
  const corner = sq % 10 === 0;
  const prop = square.kind === "prop";
  ctx.fillStyle = prop ? tint(GROUP_COLORS[square.group], 0.62) : corner ? "#fff4d8" : PAPER;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (corner) {
    drawCorner(ctx, r, square.kind, name, labels.salary);
  } else {
    const body = bodyRect(r);
    if (prop) {
      // A solid band of the group colour along the outer edge
      ctx.fillStyle = GROUP_COLORS[square.group];
      if (r.side === 0) ctx.fillRect(r.x, r.y + r.h - 5, r.w, 5);
      else if (r.side === 1) ctx.fillRect(r.x, r.y, 5, r.h);
      else if (r.side === 2) ctx.fillRect(r.x, r.y, r.w, 5);
      else ctx.fillRect(r.x + r.w - 5, r.y, 5, r.h);
    }
    drawTileText(ctx, sq, body, name, r.side === 1 || r.side === 3);
    const strip = stripRect(r);
    const owner = look.owner[sq];
    ctx.fillStyle = owner >= 0 ? PLAYER_COLORS[owner] : "rgba(70,25,18,0.28)";
    ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
    drawPips(ctx, strip, look.houses[sq], r.side === 0 || r.side === 2);
  }
  ctx.strokeStyle = "#8a6a44";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  if (look.mortgaged[sq]) {
    ctx.save();
    // Dimmed, with a diagonal stroke; the deed card spells it out
    ctx.fillStyle = "rgba(40,22,16,0.45)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "rgba(255,241,210,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x + 4, r.y + r.h - 4);
    ctx.lineTo(r.x + r.w - 4, r.y + 4);
    ctx.stroke();
    ctx.restore();
    void labels;
  }
  if (sq === look.focus) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3.5 + Math.sin(look.now * 6) * 1.2;
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  }
}

/** Name and price (or an icon) of an edge square, as large as its space allows. */
function drawTileText(ctx: Ctx, sq: number, body: Rect, name: string, sideways: boolean) {
  const square = BOARD[sq];
  const cx = body.x + body.w / 2;
  const glyph: IconName | null =
    square.kind === "chance" || square.kind === "chest" || square.kind === "tax"
      ? square.kind
      : square.kind === "transport"
        ? transportIcon(sq)
        : square.kind === "utility"
          ? sq === 12
            ? "power"
            : "water"
          : null;
  const price = square.price > 0 ? `${square.price}K` : "";
  const priceColor = square.kind === "tax" ? RED : "#5a3a24";
  if (sideways) {
    // A wide, short square on the left/right edges: icon at the side, name over price
    let tx = cx;
    let tw = body.w - 10;
    if (glyph && square.kind !== "prop") {
      icon(ctx, glyph, body.x + 18, body.y + body.h / 2, Math.min(22, body.h * 0.5));
      tx = cx + 14;
      tw = body.w - 40;
    }
    if (square.kind === "chance" || square.kind === "chest") {
      fitText(ctx, name, tx, body.y + body.h / 2, 17, tw, INK, "center", 700);
      return;
    }
    fitText(ctx, name, tx, body.y + body.h * 0.33, 17, tw, INK, "center", 700);
    fitText(ctx, price, tx, body.y + body.h * 0.74, 17, tw, priceColor, "center", 800, TITLE_FONT);
    return;
  }
  // A tall square on the top/bottom edges: name (one or two lines), icon, price
  const lines = wrap(ctx, name, body.w - 8, 16);
  const two = lines.length > 1;
  const show = two ? [lines[0], lines.slice(1).join(" ")] : lines;
  const top = body.y + (two ? 12 : 14);
  for (const [i, l] of show.entries()) fitText(ctx, l, cx, top + i * 16, 16, body.w - 6, INK, "center", 700);
  if (square.kind === "chance" || square.kind === "chest") {
    if (glyph) icon(ctx, glyph, cx, body.y + body.h * 0.64, Math.min(28, body.h * 0.45));
    return;
  }
  if (glyph && !two) icon(ctx, glyph, cx, body.y + body.h * 0.5, Math.min(18, body.h * 0.28));
  fitText(ctx, price, cx, body.y + body.h - 12, 17, body.w - 6, priceColor, "center", 800, TITLE_FONT);
}

const transportIcon = (sq: number): IconName => (sq === 5 ? "bus" : sq === 15 ? "train" : sq === 25 ? "ship" : "plane");

/** Houses as pips in the strip; a hotel as one wide red pip. */
function drawPips(ctx: Ctx, strip: Rect, h: number, horizontal: boolean) {
  if (h <= 0) return;
  ctx.save();
  if (h === 5) {
    ctx.fillStyle = "#d0342c";
    const len = horizontal ? strip.w * 0.5 : strip.h * 0.6;
    if (horizontal) ctx.fillRect(strip.x + (strip.w - len) / 2, strip.y + 1.5, len, strip.h - 3);
    else ctx.fillRect(strip.x + 1.5, strip.y + (strip.h - len) / 2, strip.w - 3, len);
    ctx.strokeStyle = "#fff8e6";
    ctx.lineWidth = 1.5;
    if (horizontal) ctx.strokeRect(strip.x + (strip.w - len) / 2, strip.y + 1.5, len, strip.h - 3);
    else ctx.strokeRect(strip.x + 1.5, strip.y + (strip.h - len) / 2, strip.w - 3, len);
    ctx.restore();
    return;
  }
  const s = STRIP - 3;
  for (let i = 0; i < h; i++) {
    const k = (i - (h - 1) / 2) * (s + 4);
    const x = horizontal ? strip.x + strip.w / 2 + k - s / 2 : strip.x + 1.5;
    const y = horizontal ? strip.y + 1.5 : strip.y + strip.h / 2 + k - s / 2;
    ctx.fillStyle = "#36a35f";
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = "#fff8e6";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, s, s);
  }
  ctx.restore();
}

function drawCorner(ctx: Ctx, r: Rect, kind: string, name: string, salary: string) {
  const cx = r.x + r.w / 2;
  const s = Math.min(34, r.h * 0.5);
  switch (kind) {
    case "start": {
      ctx.save();
      ctx.translate(cx, r.y + r.h * 0.4);
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.moveTo(-s * 1.3, 0);
      ctx.lineTo(-s * 0.5, -s * 0.55);
      ctx.lineTo(-s * 0.5, -s * 0.22);
      ctx.lineTo(s * 1.3, -s * 0.22);
      ctx.lineTo(s * 1.3, s * 0.22);
      ctx.lineTo(-s * 0.5, s * 0.22);
      ctx.lineTo(-s * 0.5, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      fitText(ctx, name, cx - 20, r.y + r.h - 14, 16, r.w * 0.55, INK, "center", 700);
      text(ctx, salary, r.x + r.w - 26, r.y + r.h - 14, 15, JADE, "center", 800, TITLE_FONT);
      break;
    }
    case "jail": {
      const cell = { x: r.x + 6, y: r.y + 5, w: r.w * 0.5, h: r.h - 26 };
      ctx.fillStyle = "#e8c8a0";
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.strokeStyle = "#5a3a28";
      ctx.lineWidth = 3;
      for (let i = 1; i < 5; i++) {
        const x = cell.x + (cell.w * i) / 5;
        ctx.beginPath();
        ctx.moveTo(x, cell.y);
        ctx.lineTo(x, cell.y + cell.h);
        ctx.stroke();
      }
      ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
      fitText(ctx, name, cx, r.y + r.h - 11, 16, r.w - 10, INK, "center", 700);
      break;
    }
    case "rest":
      icon(ctx, "tea", cx, r.y + r.h * 0.4, s);
      fitText(ctx, name, cx, r.y + r.h - 12, 16, r.w - 10, INK, "center", 700);
      break;
    default:
      icon(ctx, "whistle", cx, r.y + r.h * 0.4, s);
      fitText(ctx, name, cx, r.y + r.h - 12, 16, r.w - 10, RED, "center", 700);
      break;
  }
}


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
