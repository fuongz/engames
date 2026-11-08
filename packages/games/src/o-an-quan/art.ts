import type { Rect } from "@web-games/core";
import { PITS, type ThemeId, W } from "./config";

// Drawing for Ô Ăn Quan. Three themes share one layout: a Codex backdrop per
// theme (img/bg-*.webp), Codex stones (img/stones-*.webp: six pebbles and two
// quan stones in a row), and a board drawn here so the pits line up with the
// rules exactly — white chalk on a brick courtyard, a red-and-gold lacquer
// tray, or a black woodblock print on rice paper.

type Ctx = CanvasRenderingContext2D;
/** All text: Baloo 2 (full Vietnamese); weights 600 and 800 are loaded in game.ts. */
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

// ---------------------------------------------------------------- layout

/** The board: two rows of five pits between two half-oval quan pits. */
export const BOARD: Rect = { x: 12, y: 346, w: W - 24, h: 250 };
export const CAP_W = 74;
export const PIT_W = (BOARD.w - 2 * CAP_W) / 5;
export const ROW_H = BOARD.h / 2;
/** The two player cards: the far side at the top, the near side at the bottom. */
export const CARD_TOP: Rect = { x: 18, y: 40, w: W - 36, h: 128 };
export const CARD_BOTTOM: Rect = { x: 18, y: 722, w: W - 36, h: 128 };
export const NOTICE_Y = 236;
export const STATUS_Y = 690;
export const BUTTON_Y = 872;
export const BUTTON_H = 62;
/** Direction arrows sit just outside the board, on the side of the chosen pit. */
export const ARROW_W = 70;
export const ARROW_H = 58;

/**
 * Screen slots 0–11 run round the board like the pits: 0 the left quan pit,
 * 1–5 the bottom row left to right, 6 the right quan pit, 7–11 the top row
 * right to left. A pit sits in slot (pit + rot) % 12, so the player online is
 * always at the bottom.
 */
export function slotRect(slot: number): Rect {
  const { x, y, w, h } = BOARD;
  if (slot === 0) return { x, y, w: CAP_W, h };
  if (slot === 6) return { x: x + w - CAP_W, y, w: CAP_W, h };
  if (slot >= 1 && slot <= 5) return { x: x + CAP_W + (slot - 1) * PIT_W, y: y + ROW_H, w: PIT_W, h: ROW_H };
  return { x: x + CAP_W + (11 - slot) * PIT_W, y, w: PIT_W, h: ROW_H };
}
export const slotCentre = (slot: number) => {
  const r = slotRect(slot);
  // A half oval's middle sits towards its flat side
  const dx = slot === 0 ? 6 : slot === 6 ? -6 : 0;
  return { x: r.x + r.w / 2 + dx, y: r.y + r.h / 2 };
};
export const isBottomSlot = (slot: number) => slot >= 1 && slot <= 5;
export const isTopSlot = (slot: number) => slot >= 7 && slot <= 11;

/** The slot under a point, or null. */
export function slotAt(p: { x: number; y: number }): number | null {
  for (let s = 0; s < PITS; s++) {
    const r = slotRect(s);
    if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return s;
  }
  return null;
}

// ---------------------------------------------------------------- themes

export interface Theme {
  id: ThemeId;
  ink: string;
  inkSoft: string;
  panel: string;
  panelEdge: string;
  panelText: string;
  panelSoft: string;
  button: string;
  buttonText: string;
  /** The primary button (play, again). */
  primary: string;
  primaryText: string;
  accent: string;
  /** Each seat's colour (bottom, top as dealt): names, rows, hand. */
  seat: [string, string];
  /** Light behind the row whose turn it is. */
  glow: string;
  /** Text drawn straight on the backdrop. */
  onBg: string;
  onBgShadow: string;
  pebbleShadow: string | null;
  badge: string;
  badgeText: string;
}

export const THEME: Record<ThemeId, Theme> = {
  "san-gach": {
    id: "san-gach",
    ink: "#4a2a18",
    inkSoft: "#8a5f44",
    panel: "#fbf1df",
    panelEdge: "#e2c9a6",
    panelText: "#4a2a18",
    panelSoft: "#8a5f44",
    button: "#fff8ea",
    buttonText: "#5a3220",
    primary: "#c4532d",
    primaryText: "#fff8ea",
    accent: "#c4532d",
    seat: ["#2f7d4f", "#2c5fa8"],
    glow: "rgba(255,244,210,0.22)",
    onBg: "#fff8ea",
    onBgShadow: "rgba(60,25,10,0.75)",
    pebbleShadow: "rgba(40,15,5,0.35)",
    badge: "rgba(255,248,234,0.92)",
    badgeText: "#5a3220",
  },
  "son-mai": {
    id: "son-mai",
    ink: "#f6e7c8",
    inkSoft: "#c9ab78",
    panel: "#2b0f0b",
    panelEdge: "#d6a94a",
    panelText: "#f6e7c8",
    panelSoft: "#c9ab78",
    button: "#3a1510",
    buttonText: "#f6e7c8",
    primary: "#d6a94a",
    primaryText: "#2b0f0b",
    accent: "#f0c766",
    seat: ["#7fd19a", "#8fb6ff"],
    glow: "rgba(255,210,120,0.13)",
    onBg: "#f6e7c8",
    onBgShadow: "rgba(0,0,0,0.8)",
    pebbleShadow: "rgba(0,0,0,0.5)",
    badge: "rgba(43,15,11,0.9)",
    badgeText: "#f0c766",
  },
  "dong-ho": {
    id: "dong-ho",
    ink: "#2a211a",
    inkSoft: "#6e5a46",
    panel: "#f6e8c9",
    panelEdge: "#2a211a",
    panelText: "#2a211a",
    panelSoft: "#6e5a46",
    button: "#fbf2dc",
    buttonText: "#2a211a",
    primary: "#b8322a",
    primaryText: "#fbf2dc",
    accent: "#b8322a",
    seat: ["#3f7a3a", "#2c4a8a"],
    glow: "rgba(200,140,40,0.14)",
    onBg: "#2a211a",
    onBgShadow: "rgba(250,240,215,0.9)",
    pebbleShadow: null,
    badge: "rgba(42,33,26,0.88)",
    badgeText: "#fbf2dc",
  },
};

// ---------------------------------------------------------------- text

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "center", weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** Text straight on the backdrop, with a soft halo so it reads on any theme. */
export function haloText(ctx: Ctx, th: Theme, str: string, x: number, y: number, size: number, weight = 700, color = th.onBg) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size * 0.28);
  ctx.strokeStyle = th.onBgShadow;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** The largest size ≤ `size` at which `str` fits in `max`. */
export function fitSize(ctx: Ctx, str: string, size: number, max: number, weight = 600) {
  let s = size;
  for (; s > 10; s -= 1) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(str).width <= max) break;
  }
  return s;
}

/** Word-wrap `str` to `max` px at the current font. */
export function wrap(ctx: Ctx, str: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of str.split(" ")) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- backdrop

/** The theme's backdrop over the whole visible area (cover fit). */
export function drawBackdrop(ctx: Ctx, view: Rect, bg: HTMLImageElement | null, fallback: string) {
  ctx.fillStyle = fallback;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  if (!bg?.complete || !bg.naturalWidth) return;
  const s = Math.max(view.w / bg.naturalWidth, view.h / bg.naturalHeight);
  const w = bg.naturalWidth * s;
  const h = bg.naturalHeight * s;
  ctx.drawImage(bg, view.x + (view.w - w) / 2, view.y + (view.h - h) / 2, w, h);
}

export const BACKDROP_FALLBACK: Record<ThemeId, string> = {
  "san-gach": "#b85c3c",
  "son-mai": "#3a1610",
  "dong-ho": "#f1e2c2",
};

// ---------------------------------------------------------------- panels and buttons

export interface Button {
  id: string;
  rect: Rect;
  label: string;
  primary?: boolean;
  disabled?: boolean;
  /** Shown selected (a chosen level, theme or rule). */
  on?: boolean;
  /** A small line under the label. */
  sub?: string;
}

export function panel(ctx: Ctx, th: Theme, r: Rect, radius = 22, lift = 0) {
  ctx.save();
  ctx.shadowColor = "rgba(20,8,4,0.35)";
  ctx.shadowBlur = 18 + lift * 2;
  ctx.shadowOffsetY = 6 + lift;
  ctx.fillStyle = th.panel;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y - lift, r.w, r.h, radius);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = th.id === "dong-ho" ? 3 : 2;
  ctx.strokeStyle = th.panelEdge;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y - lift, r.w, r.h, radius);
  ctx.stroke();
  if (th.id === "son-mai") {
    // A thin inner gold line, like inlay
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.roundRect(r.x + 5, r.y - lift + 5, r.w - 10, r.h - 10, Math.max(4, radius - 5));
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawButton(ctx: Ctx, th: Theme, b: Button) {
  const { x, y, w, h } = b.rect;
  const fill = b.primary ? th.primary : b.on ? th.accent : th.button;
  const ink = b.primary ? th.primaryText : b.on ? (th.id === "son-mai" ? th.panel : "#fff8ea") : th.buttonText;
  ctx.save();
  ctx.globalAlpha = b.disabled ? 0.45 : 1;
  ctx.shadowColor = "rgba(20,8,4,0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(18, h / 2));
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = th.id === "dong-ho" ? 3 : 2;
  ctx.strokeStyle = th.id === "san-gach" ? "rgba(90,50,32,0.35)" : th.panelEdge;
  ctx.stroke();
  const size = fitSize(ctx, b.label, Math.min(26, h * 0.42), w - 20, 800);
  text(ctx, b.label, x + w / 2, y + h / 2 + (b.sub ? -9 : 1), size, ink, "center", 800);
  if (b.sub) text(ctx, b.sub, x + w / 2, y + h / 2 + 17, fitSize(ctx, b.sub, 15, w - 16), ink, "center", 600);
  ctx.restore();
}

/** A left or right arrow button for picking which way to sow. */
export function drawArrow(ctx: Ctx, th: Theme, r: Rect, right: boolean, pulse: number) {
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(1 + pulse * 0.05, 1 + pulse * 0.05);
  ctx.shadowColor = "rgba(20,8,4,0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = th.primary;
  ctx.beginPath();
  ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 18);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = th.id === "son-mai" ? th.panel : "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const d = right ? 1 : -1;
  ctx.fillStyle = th.primaryText;
  ctx.beginPath();
  ctx.moveTo(d * 18, 0);
  ctx.lineTo(d * -4, -16);
  ctx.lineTo(d * -4, -6);
  ctx.lineTo(d * -18, -6);
  ctx.lineTo(d * -18, 6);
  ctx.lineTo(d * -4, 6);
  ctx.lineTo(d * -4, 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the board

function outline(ctx: Ctx, inset = 0) {
  const { x, y, w, h } = BOARD;
  const rx = CAP_W - inset;
  const ry = h / 2 - inset;
  ctx.beginPath();
  ctx.moveTo(x + CAP_W, y + inset);
  ctx.lineTo(x + w - CAP_W, y + inset);
  ctx.ellipse(x + w - CAP_W, y + h / 2, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + CAP_W, y + h - inset);
  ctx.ellipse(x + CAP_W, y + h / 2, rx, ry, 0, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

function innerLines(ctx: Ctx) {
  const { x, y, w, h } = BOARD;
  ctx.beginPath();
  for (let k = 0; k <= 5; k++) {
    const lx = x + CAP_W + k * PIT_W;
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + h);
  }
  ctx.moveTo(x + CAP_W, y + h / 2);
  ctx.lineTo(x + w - CAP_W, y + h / 2);
}

/** A rough, hand-drawn stroke of the current path: chalk or ink. */
function rough(ctx: Ctx, color: string, width: number, passes: [number, number, number][]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [dx, dy, a] of passes) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.globalAlpha = a;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }
}

/** The pit shapes, for fills (a quan pit is its half oval). */
function pitPath(ctx: Ctx, slot: number, inset: number) {
  const r = slotRect(slot);
  if (slot === 0 || slot === 6) {
    const cx = slot === 0 ? r.x + r.w : r.x;
    ctx.beginPath();
    ctx.ellipse(cx, r.y + r.h / 2, r.w - inset, r.h / 2 - inset, 0, slot === 0 ? Math.PI / 2 : -Math.PI / 2, slot === 0 ? (3 * Math.PI) / 2 : Math.PI / 2);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.roundRect(r.x + inset, r.y + inset, r.w - 2 * inset, r.h - 2 * inset, 10);
}

export function drawBoard(ctx: Ctx, th: Theme) {
  if (th.id === "san-gach") {
    // Chalk on brick: a faint dusty fill, then rough white lines
    outline(ctx);
    ctx.fillStyle = "rgba(255,240,220,0.08)";
    ctx.fill();
    outline(ctx);
    rough(ctx, "#fffaf0", 5, [
      [0, 0, 0.85],
      [1.2, 0.8, 0.35],
      [-0.8, 1, 0.25],
    ]);
    innerLines(ctx);
    rough(ctx, "#fffaf0", 4.5, [
      [0, 0, 0.82],
      [1, -0.8, 0.3],
      [-0.6, 0.9, 0.22],
    ]);
    return;
  }
  if (th.id === "son-mai") {
    // A lacquer tray: red-brown body, gold rim, recessed pits
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    outline(ctx, -10);
    const body = ctx.createLinearGradient(0, BOARD.y, 0, BOARD.y + BOARD.h);
    body.addColorStop(0, "#8c1d16");
    body.addColorStop(1, "#5e0f0b");
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
    outline(ctx, -10);
    ctx.strokeStyle = "#d6a94a";
    ctx.lineWidth = 4;
    ctx.stroke();
    outline(ctx, -4);
    ctx.strokeStyle = "rgba(240,199,102,0.5)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    for (let s = 0; s < PITS; s++) {
      pitPath(ctx, s, 5);
      const r = slotRect(s);
      const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.38, 4, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.7);
      g.addColorStop(0, "#5a0f0b");
      g.addColorStop(1, "#320605");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(214,169,74,0.75)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Gloss along the top rim
    ctx.save();
    outline(ctx, -10);
    ctx.clip();
    const gloss = ctx.createLinearGradient(0, BOARD.y - 10, 0, BOARD.y + 40);
    gloss.addColorStop(0, "rgba(255,230,190,0.22)");
    gloss.addColorStop(1, "rgba(255,230,190,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(BOARD.x - 12, BOARD.y - 12, BOARD.w + 24, 52);
    ctx.restore();
    return;
  }
  // Woodblock print: bold black lines, slightly uneven ink
  outline(ctx);
  ctx.fillStyle = "rgba(255,250,235,0.35)";
  ctx.fill();
  outline(ctx);
  rough(ctx, "#1f1a16", 6, [
    [0, 0, 0.92],
    [0.9, 0.6, 0.3],
  ]);
  innerLines(ctx);
  rough(ctx, "#1f1a16", 4.5, [
    [0, 0, 0.9],
    [-0.7, 0.6, 0.28],
  ]);
}

/** Light up a pit (the row to play, the chosen pit, a capture). */
export function lightPit(ctx: Ctx, slot: number, color: string) {
  pitPath(ctx, slot, 5);
  ctx.fillStyle = color;
  ctx.fill();
}

/** A ring round a pit: the chosen one. */
export function ringPit(ctx: Ctx, slot: number, color: string, width = 4) {
  pitPath(ctx, slot, 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([10, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------- stones

/** img/stones-*.webp: six pebbles of PEBBLE px, then two quan stones of QUAN px, in one row. */
export const PEBBLE_PX = 72;
export const QUAN_PX = 144;
/** Drawn sizes. */
export const PEBBLE = 26;
export const QUAN_STONE = 58;

/** A cheap deterministic hash → [0, 1). */
export function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawPebble(ctx: Ctx, th: Theme, img: HTMLImageElement | null, variant: number, x: number, y: number, size = PEBBLE, rot = 0) {
  if (th.pebbleShadow) {
    ctx.fillStyle = th.pebbleShadow;
    ctx.beginPath();
    ctx.ellipse(x + size * 0.1, y + size * 0.16, size * 0.44, size * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!img?.complete || !img.naturalWidth) {
    ctx.fillStyle = th.seat[variant % 2];
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, (variant % 6) * PEBBLE_PX, 0, PEBBLE_PX, PEBBLE_PX, -size / 2, -size / 2, size, size);
  ctx.restore();
}

export function drawQuanStone(ctx: Ctx, th: Theme, img: HTMLImageElement | null, which: number, x: number, y: number, size = QUAN_STONE) {
  if (th.pebbleShadow) {
    ctx.fillStyle = th.pebbleShadow;
    ctx.beginPath();
    ctx.ellipse(x + size * 0.08, y + size * 0.14, size * 0.46, size * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!img?.complete || !img.naturalWidth) {
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.drawImage(img, 6 * PEBBLE_PX + (which % 2) * QUAN_PX, 0, QUAN_PX, QUAN_PX, x - size / 2, y - size / 2, size, size);
}

/**
 * Where the i-th dân sits in a pit: a sunflower spiral, squashed to the pit's
 * shape, so stones never stack in a heap however many there are. A quan pit
 * leaves room for its quan in the middle.
 */
export function stoneSpot(slot: number, i: number, n: number, withQuan: boolean) {
  const c = slotCentre(slot);
  const quanPit = slot === 0 || slot === 6;
  const a = i * 2.39996 + slot * 1.3;
  if (quanPit) {
    // Start straight below the quan, then alternate above and below
    const b = Math.PI / 2 + i * 2.39996;
    // Round the quan stone, above and below it (the half oval is tall and narrow)
    const r = withQuan ? 36 + 3.2 * Math.sqrt(i) : 8 * Math.sqrt(i + 0.5);
    return { x: c.x + Math.cos(b) * r * 0.5, y: c.y + Math.sin(b) * r * 1.5 };
  }
  // Loose while there are few, tighter as the pit fills
  const spread = n <= 6 ? 10.5 : n <= 12 ? 8 : 6.2;
  const r = spread * Math.sqrt(i + 0.5);
  return { x: c.x + Math.cos(a) * r * 0.95, y: c.y + Math.sin(a) * r * 1.25 };
}

/** The pit's stone count, on a little tag at its outer edge. */
export function drawBadge(ctx: Ctx, th: Theme, slot: number, n: number, pop: number) {
  const r = slotRect(slot);
  let x = r.x + r.w / 2;
  let y = isTopSlot(slot) ? r.y + 15 : r.y + r.h - 15;
  if (slot === 0 || slot === 6) {
    x = slot === 0 ? r.x + r.w - 14 : r.x + 14;
    y = r.y + 16;
  }
  const s = 1 + pop * 0.35;
  const label = String(n);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.font = `800 15px ${FONT}`;
  const w = Math.max(24, ctx.measureText(label).width + 12);
  ctx.fillStyle = th.badge;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -11, w, 22, 11);
  ctx.fill();
  text(ctx, label, 0, 1, 15, th.badgeText, "center", 800);
  ctx.restore();
}

/** Spots for a captured pile in a card, `w` × `h`, as a loose heap. */
export function pileSpot(i: number, w: number, h: number) {
  const a = i * 2.39996;
  const r = Math.sqrt(i + 0.5) / Math.sqrt(40);
  return { x: Math.cos(a) * r * (w / 2), y: Math.sin(a) * r * (h / 2) };
}

// ---------------------------------------------------------------- title

export function drawTitle(ctx: Ctx, th: Theme, x: number, y: number, size: number) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = th.id === "son-mai" ? "#1a0705" : th.id === "dong-ho" ? "#fbf2dc" : "#fff8ea";
  ctx.strokeText("Ô Ăn Quan", x, y);
  ctx.fillStyle = th.id === "son-mai" ? "#f0c766" : th.accent;
  ctx.fillText("Ô Ăn Quan", x, y);
}
