import type { Rect } from "@web-games/core";
import { W } from "./config";

// Drawing for Cờ Vua: a warm walnut-and-maple board in a dark study, carved
// Staunton-style pieces drawn as vector paths (ivory and walnut, like the key
// art) and cached per size, plus panels and buttons. All procedural, so it
// stays sharp on every screen.

type Ctx = CanvasRenderingContext2D;
/** In-game text: Mali (rounded, full Vietnamese). Weights 600 and 700 are loaded in game.ts. */
export const FONT = '"Mali", "Trebuchet MS", system-ui, sans-serif';
/** The title only, matching the poster. */
export const TITLE_FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export const BG = "#24170f";
export const PANEL = "#3a281c";
export const PANEL_HI = "#4d3524";
export const CREAM = "#f7e8c9";
export const CREAM_SOFT = "#c8ad88";
export const AMBER = "#eeb04c";
export const TEAL = "#3a8f86";
export const RED = "#e0604a";
export const LIGHT_SQ = "#f0dcb2";
export const DARK_SQ = "#b47a4c";

// ---------------------------------------------------------------- layout

/** The board fills the width. */
export const BOARD: Rect = { x: 0, y: 132, w: W, h: W };
export const SQ = BOARD.w / 8;
export const TOP_CARD: Rect = { x: 14, y: 34, w: W - 28, h: 86 };
export const BOTTOM_CARD: Rect = { x: 14, y: BOARD.y + BOARD.h + 12, w: W - 28, h: 86 };
export const STATUS_Y = BOTTOM_CARD.y + BOTTOM_CARD.h + 28;
export const MOVES_Y = STATUS_Y + 32;
export const BUTTON_Y = MOVES_Y + 28;
export const BUTTON_H = 76;

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

/** Word-wrap `str` to `max` px at the given font. */
export function wrap(ctx: Ctx, str: string, size: number, max: number, weight = 600): string[] {
  ctx.font = `${weight} ${size}px ${FONT}`;
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

// ---------------------------------------------------------------- backdrop

/** A dark warm study: walnut gradient with a lamp glow behind the board. */
export function drawBackdrop(ctx: Ctx, view: Rect) {
  const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
  g.addColorStop(0, "#2d1d13");
  g.addColorStop(0.5, BG);
  g.addColorStop(1, "#170e09");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  const glow = ctx.createRadialGradient(W / 2, BOARD.y + BOARD.h / 2, 60, W / 2, BOARD.y + BOARD.h / 2, 560);
  glow.addColorStop(0, "rgba(255,180,90,0.16)");
  glow.addColorStop(1, "rgba(255,180,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

// ---------------------------------------------------------------- board

/** Screen rect of a square, with White at the bottom unless `flipped`. */
export function squareRect(sq: number, flipped: boolean): Rect {
  const f = sq & 7;
  const r = sq >> 3;
  const col = flipped ? 7 - f : f;
  const row = flipped ? r : 7 - r;
  return { x: BOARD.x + col * SQ, y: BOARD.y + row * SQ, w: SQ, h: SQ };
}

/** The square under a screen point, or -1. */
export function squareAt(p: { x: number; y: number }, flipped: boolean): number {
  const col = Math.floor((p.x - BOARD.x) / SQ);
  const row = Math.floor((p.y - BOARD.y) / SQ);
  if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
  const f = flipped ? 7 - col : col;
  const r = flipped ? row : 7 - row;
  return r * 8 + f;
}

/** Maple and walnut squares with a little grain, and coordinates in the corners. */
export function drawBoard(ctx: Ctx, flipped: boolean) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = DARK_SQ;
  ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  ctx.restore();
  for (let sq = 0; sq < 64; sq++) {
    const r = squareRect(sq, flipped);
    const light = ((sq >> 3) + (sq & 7)) % 2 === 1;
    ctx.fillStyle = light ? LIGHT_SQ : DARK_SQ;
    ctx.fillRect(r.x, r.y, r.w + 0.5, r.h + 0.5);
    // Faint grain lines, stable per square
    ctx.strokeStyle = light ? "rgba(150,100,50,0.07)" : "rgba(60,30,10,0.1)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const y = r.y + r.h * (0.22 + 0.28 * k) + Math.sin(sq * 3.1 + k) * 5;
      ctx.moveTo(r.x + 4, y);
      ctx.bezierCurveTo(r.x + r.w * 0.35, y - 4, r.x + r.w * 0.65, y + 4, r.x + r.w - 4, y + Math.sin(sq + k) * 3);
    }
    ctx.stroke();
  }
}

/** Coordinates in the corner squares, lichess-style: files along the bottom row, ranks up the left column. Drawn over the pieces. */
export function drawCoords(ctx: Ctx, flipped: boolean) {
  for (let i = 0; i < 8; i++) {
    const fileSq = flipped ? 63 - i : i;
    const fr = squareRect(fileSq, flipped);
    text(ctx, "abcdefgh"[fileSq & 7], fr.x + fr.w - 7, fr.y + fr.h - 9, 13, isLightSq(fileSq) ? DARK_SQ : LIGHT_SQ, "center", 700);
    const rankSq = flipped ? i * 8 + 7 : (7 - i) * 8;
    const rr = squareRect(rankSq, flipped);
    text(ctx, String((rankSq >> 3) + 1), rr.x + 7, rr.y + 10, 13, isLightSq(rankSq) ? DARK_SQ : LIGHT_SQ, "center", 700);
  }
}

const isLightSq = (sq: number) => ((sq >> 3) + (sq & 7)) % 2 === 1;

/** A tinted square (last move, selection). */
export function tint(ctx: Ctx, r: Rect, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w + 0.5, r.h + 0.5);
}

/** A legal destination: a dot on an empty square, a ring around a capture. */
export function drawTarget(ctx: Ctx, r: Rect, capture: boolean) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  if (capture) {
    ctx.strokeStyle = "rgba(40,24,12,0.38)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r.w * 0.44, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(40,24,12,0.3)";
    ctx.beginPath();
    ctx.arc(cx, cy, r.w * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A red glow under a king in check. */
export function drawCheck(ctx: Ctx, r: Rect) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r.w * 0.62);
  g.addColorStop(0, "rgba(255,40,20,0.95)");
  g.addColorStop(0.5, "rgba(230,40,20,0.55)");
  g.addColorStop(1, "rgba(230,40,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

// ---------------------------------------------------------------- pieces

/**
 * Each piece as layered shapes in a 100×100 box, drawn back to front; each
 * layer is filled and outlined, so the joins read like a carved set.
 * "line:" entries are detail strokes only.
 */
const BASE = "M17 93 Q14 93 14 89 L14 87 Q14 81 21 80 L79 80 Q86 81 86 87 L86 89 Q86 93 83 93 Z";
const COLLAR = "M25 82 Q22 82 23 78 Q24 74 29 74 L71 74 Q76 74 77 78 Q78 82 75 82 Z";

const SHAPES: Record<number, string[]> = {
  // Pawn: a round head on a ringed, flaring stem
  1: [
    "M33 76 C37 68 42 60 43 52 L57 52 C58 60 63 68 67 76 Z",
    "M33 54 C33 48 67 48 67 54 C67 58 33 58 33 54 Z",
    "M50 20 C59 20 65 27 65 35 C65 43 59 49 50 49 C41 49 35 43 35 35 C35 27 41 20 50 20 Z",
    COLLAR,
    BASE,
  ],
  // Knight: a horse's head and arched neck, facing left
  2: [
    "M30 76 C31 66 36 60 45 55 C38 58 31 60 25 61 C18 62 14 56 17 51 L31 33 C35 25 41 20 48 18 L51 8 L58 16 C71 21 79 36 77 54 C76 63 72 70 72 76 Z",
    "line:M60 19 C70 28 73 42 70 58",
    "dot:42 31 3.2",
    "dot:22 53 2",
    COLLAR,
    BASE,
  ],
  // Bishop: a mitre with a slit, on a slim stem
  3: [
    "M34 76 C39 68 42 62 43 57 L57 57 C58 62 61 68 66 76 Z",
    "M50 15 C61 23 68 34 65 45 C63 52 57 55 50 55 C43 55 37 52 35 45 C32 34 39 23 50 15 Z",
    "line:M57 26 L47 38",
    "M32 58 C32 52 68 52 68 58 C68 62 32 62 32 58 Z",
    "M50 6 C54 6 56 9 56 12 C56 15 54 17 50 17 C46 17 44 15 44 12 C44 9 46 6 50 6 Z",
    COLLAR,
    BASE,
  ],
  // Rook: a tower with three battlements
  4: [
    "M31 76 L34 44 L66 44 L69 76 Z",
    "M25 46 L25 19 L36 19 L36 27 L44 27 L44 19 L56 19 L56 27 L64 27 L64 19 L75 19 L75 46 Z",
    "line:M30 38 L70 38",
    COLLAR,
    BASE,
  ],
  // Queen: a flared body under a five-point crown with pearls
  5: [
    "M32 76 C36 64 41 54 40 42 L60 42 C59 54 64 64 68 76 Z",
    "M31 45 L23 20 L34 31 L37 15 L45 29 L50 11 L55 29 L63 15 L66 31 L77 20 L69 45 Z",
    "M30 48 C30 41 70 41 70 48 C70 53 30 53 30 48 Z",
    "dot:23 19 4",
    "dot:37 14 4",
    "dot:50 9 4.5",
    "dot:63 14 4",
    "dot:77 19 4",
    COLLAR,
    BASE,
  ],
  // King: a domed crown under a cross
  6: [
    "M32 76 C36 64 41 55 40 44 L60 44 C59 55 64 64 68 76 Z",
    "M46 28 L46 19 L39 19 L39 12 L46 12 L46 4 L54 4 L54 12 L61 12 L61 19 L54 19 L54 28 Z",
    "M31 44 C26 34 33 24 50 26 C67 24 74 34 69 44 Z",
    "M29 48 C29 41 71 41 71 48 C71 53 29 53 29 48 Z",
    COLLAR,
    BASE,
  ],
};

interface Layer {
  kind: "fill" | "line" | "dot";
  path: Path2D;
}
let layers: Record<number, Layer[]> | null = null;
function pieceLayers() {
  if (layers) return layers;
  const out: Record<number, Layer[]> = {};
  for (const [t, list] of Object.entries(SHAPES)) {
    out[Number(t)] = list.map((s) => {
      if (s.startsWith("line:")) return { kind: "line", path: new Path2D(s.slice(5)) };
      if (s.startsWith("dot:")) {
        const [x, y, r] = s.slice(4).split(" ").map(Number);
        const p = new Path2D();
        p.arc(x, y, r, 0, Math.PI * 2);
        return { kind: "dot", path: p };
      }
      return { kind: "fill", path: new Path2D(s) };
    });
  }
  layers = out;
  return out;
}

/** Ivory or walnut, as on the key art. */
const PALETTE = {
  white: { top: "#fffaf0", bottom: "#e2c89c", line: "#3d2716", detail: "#7a5634", shine: "rgba(255,255,255,0.55)" },
  black: { top: "#7a4e33", bottom: "#2b1910", line: "#120a05", detail: "#c79a6c", shine: "rgba(255,210,160,0.35)" },
};

/** Draw piece `v` (signed: White > 0) in a `size` box at (x, y) top-left. */
export function drawPieceRaw(ctx: Ctx, v: number, x: number, y: number, size: number) {
  const t = Math.abs(v);
  const list = pieceLayers()[t];
  if (!list) return;
  const pal = v > 0 ? PALETTE.white : PALETTE.black;
  const k = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  // Soft contact shadow
  ctx.fillStyle = "rgba(20,10,4,0.28)";
  ctx.beginPath();
  ctx.ellipse(52, 93, 36, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createLinearGradient(20, 8, 80, 92);
  grad.addColorStop(0, pal.top);
  grad.addColorStop(1, pal.bottom);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const l of list) {
    if (l.kind === "line") {
      ctx.strokeStyle = pal.detail;
      ctx.lineWidth = 3;
      ctx.stroke(l.path);
      continue;
    }
    ctx.fillStyle = l.kind === "dot" && t !== 5 ? pal.line : grad;
    ctx.fill(l.path);
    if (l.kind === "dot" && t !== 5) continue;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 3.6;
    ctx.stroke(l.path);
  }
  // A highlight down the left edge, like light from the window
  ctx.strokeStyle = pal.shine;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(38, 72);
  ctx.quadraticCurveTo(43, 64, 44, 58);
  ctx.stroke();
  ctx.restore();
}

/** Pieces are drawn once per (piece, pixel size) into a canvas and blitted. */
const cache = new Map<string, HTMLCanvasElement>();
export function drawPiece(ctx: Ctx, v: number, x: number, y: number, size: number) {
  const scale = ctx.getTransform().a || 1;
  const px = Math.max(8, Math.round(size * scale));
  const key = `${v}:${px}`;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    const cctx = c.getContext("2d");
    if (cctx) drawPieceRaw(cctx, v, 0, 0, px);
    cache.set(key, c);
  }
  ctx.drawImage(c, x, y, size, size);
}

// ---------------------------------------------------------------- panels & buttons

export function roundRect(ctx: Ctx, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

/** A rounded wooden panel with a soft shadow and a fine top highlight. */
export function drawPanel(ctx: Ctx, r: Rect, fill = PANEL, radius = 16, glow: string | null = null) {
  ctx.save();
  ctx.shadowColor = glow ?? "rgba(0,0,0,0.45)";
  ctx.shadowBlur = glow ? 22 : 14;
  ctx.shadowOffsetY = glow ? 0 : 4;
  ctx.fillStyle = fill;
  roundRect(ctx, r, radius);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, r, radius);
  ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, "rgba(255,230,190,0.12)");
  g.addColorStop(0.5, "rgba(255,230,190,0)");
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    roundRect(ctx, { x: r.x + 1.5, y: r.y + 1.5, w: r.w - 3, h: r.h - 3 }, radius - 1);
    ctx.stroke();
  }
}

export type Icon = "undo" | "flip" | "new" | "menu" | "flag" | "hand" | "check" | "cross";

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
    case "flip":
      // Two arrows chasing each other round
      ctx.arc(x, y, s * 0.36, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.36, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.36 + 6, y - s * 0.2);
      ctx.lineTo(x + s * 0.36, y - s * 0.02);
      ctx.lineTo(x + s * 0.36 - 7, y - s * 0.2);
      ctx.moveTo(x - s * 0.36 - 6, y + s * 0.2);
      ctx.lineTo(x - s * 0.36, y + s * 0.02);
      ctx.lineTo(x - s * 0.36 + 7, y + s * 0.2);
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
    case "flag":
      ctx.moveTo(x - s * 0.3, y + s * 0.45);
      ctx.lineTo(x - s * 0.3, y - s * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y - s * 0.42);
      ctx.lineTo(x + s * 0.4, y - s * 0.24);
      ctx.lineTo(x - s * 0.3, y - s * 0.02);
      ctx.closePath();
      ctx.fill();
      break;
    case "hand":
      // ½, the draw in a score sheet
      ctx.font = `700 ${Math.round(s * 1.05)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("½", x, y + 1);
      break;
    case "check":
      ctx.moveTo(x - s * 0.36, y);
      ctx.lineTo(x - s * 0.08, y + s * 0.28);
      ctx.lineTo(x + s * 0.4, y - s * 0.3);
      ctx.stroke();
      break;
    case "cross":
      ctx.moveTo(x - s * 0.3, y - s * 0.3);
      ctx.lineTo(x + s * 0.3, y + s * 0.3);
      ctx.moveTo(x + s * 0.3, y - s * 0.3);
      ctx.lineTo(x - s * 0.3, y + s * 0.3);
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
  /** "primary" is amber with dark text; "accent" teal; default a wooden panel. */
  tone?: "primary" | "accent" | "danger";
  disabled?: boolean;
  /** Draw as chosen (a toggle that is on). */
  on?: boolean;
  /** Small count in the corner (take-backs left). */
  badge?: string;
}

export function drawButton(ctx: Ctx, b: Button) {
  const { rect: r } = b;
  ctx.save();
  if (b.disabled) ctx.globalAlpha = 0.42;
  const fill = b.tone === "primary" ? AMBER : b.tone === "accent" ? TEAL : b.tone === "danger" ? "#a8432f" : PANEL_HI;
  drawPanel(ctx, r, fill, 14, b.on ? AMBER : null);
  const color = b.tone === "primary" ? "#2a1a0e" : CREAM;
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

/** The title, cream with an amber shadow, as on the poster. */
export function drawTitle(ctx: Ctx, str: string, x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${TITLE_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8a4b1c";
  ctx.fillText(str, x, y + size * 0.05);
  ctx.fillStyle = CREAM;
  ctx.fillText(str, x, y);
}
