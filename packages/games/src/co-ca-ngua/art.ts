import type { Rect } from "@web-games/core";
import { TRACK, homeColumn } from "./board";
import { GRID, W } from "./config";

// Drawing for Cờ Cá Ngựa: a raised board tray on a deep-blue doodle
// backdrop; each colour's corner is a little Vietnamese scene (Hội An, the
// countryside, a pagoda, the bay) built from Codex prop sprites
// (img/props.webp) around a clean stable inset; round portrait avatars
// (img/avatars.webp); glossy horse tokens (img/tokens.webp); two chunky dice in
// a glossy roll button. The track itself is drawn here so it lines up with
// board.ts exactly.

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
const UNUSED = "#c9c9d6";
const UNUSED_DARK = "#9b9cb0";

// ---------------------------------------------------------------- layout

export const BOARD: Rect = { x: 16, y: 240, w: W - 32, h: W - 32 };
export const CELL = BOARD.w / GRID;
/** Round buttons along the top: menu on the left, rules and new game on the right. */
export const TOP_Y = 44;
export const ROUND_R = 25;
/** Avatar portraits by view corner (0 bottom-left, then clockwise). */
export const AVATAR_R = 36;
export const AVATARS = [
  { x: 50, y: 836 },
  { x: 50, y: 152 },
  { x: W - 50, y: 152 },
  { x: W - 50, y: 836 },
];
/** The glossy roll button between the bottom avatars; it holds the two dice. */
export const ROLL: Rect = { x: W / 2 - 62, y: 778, w: 124, h: 108 };
export const DIE = { x: W / 2, y: ROLL.y + 52, size: 35, gap: 26 };
export const DIE_HIT: Rect = { x: ROLL.x - 6, y: ROLL.y - 6, w: ROLL.w + 12, h: ROLL.h + 12 };
export const STATUS_Y = 924;

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
  const dx = t % 2 === 0 ? -0.95 : 0.95;
  const dy = t < 2 ? -0.95 : 0.95;
  return rotatePoint(STABLE.x + STABLE.size / 2 + dx, STABLE.y + STABLE.size / 2 + dy, vc);
}

/** The stable inset of the bottom-left corner, in squares, tucked toward the cross; the scene wraps round it. */
const STABLE = { x: 1.85, y: 9.45, size: 3.7 };

/** Where finished token `t` stands in the middle triangle of view corner `vc`, in squares. */
export const homeSpot = (vc: number, t: number) => rotatePoint(6.95 + t * 0.37, 8.45, vc);

// ---------------------------------------------------------------- background

/** Faint line doodles (conical hat, lantern, lotus, boat, star), tiled once into a pattern. */
let doodles: CanvasPattern | null = null;
function doodlePattern(ctx: Ctx) {
  if (doodles) return doodles;
  const S = 2;
  const c = document.createElement("canvas");
  c.width = 220 * S;
  c.height = 220 * S;
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(S, S);
  g.strokeStyle = "rgba(255,255,255,0.075)";
  g.lineWidth = 2.2;
  g.lineCap = "round";
  g.lineJoin = "round";
  const hat = (x: number, y: number) => {
    g.beginPath();
    g.moveTo(x - 22, y + 10);
    g.lineTo(x, y - 14);
    g.lineTo(x + 22, y + 10);
    g.quadraticCurveTo(x, y + 18, x - 22, y + 10);
    g.moveTo(x - 10, y - 1);
    g.lineTo(x + 10, y - 1);
    g.stroke();
  };
  const lantern = (x: number, y: number) => {
    g.beginPath();
    g.moveTo(x, y - 24);
    g.lineTo(x, y - 14);
    g.ellipse(x, y, 11, 14, 0, -Math.PI / 2, Math.PI * 1.5);
    g.moveTo(x - 6, y - 12);
    g.quadraticCurveTo(x - 9, y, x - 6, y + 12);
    g.moveTo(x + 6, y - 12);
    g.quadraticCurveTo(x + 9, y, x + 6, y + 12);
    g.moveTo(x, y + 14);
    g.lineTo(x, y + 22);
    g.stroke();
  };
  const lotus = (x: number, y: number) => {
    g.beginPath();
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
      g.moveTo(x, y + 8);
      g.quadraticCurveTo(x + Math.sin(a) * 26, y - 6 - Math.cos(a) * 8, x + Math.sin(a) * 6, y - 16 * Math.cos(a));
    }
    g.moveTo(x - 18, y + 10);
    g.lineTo(x + 18, y + 10);
    g.stroke();
  };
  const boat = (x: number, y: number) => {
    g.beginPath();
    g.moveTo(x - 24, y);
    g.quadraticCurveTo(x, y + 14, x + 24, y);
    g.lineTo(x - 24, y);
    g.moveTo(x - 4, y);
    g.lineTo(x - 4, y - 26);
    g.lineTo(x + 14, y - 6);
    g.lineTo(x - 4, y - 6);
    g.moveTo(x - 30, y + 14);
    g.quadraticCurveTo(x - 20, y + 9, x - 10, y + 14);
    g.moveTo(x + 10, y + 14);
    g.quadraticCurveTo(x + 20, y + 9, x + 30, y + 14);
    g.stroke();
  };
  const star = (x: number, y: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 11 : 4.5;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
    g.stroke();
  };
  hat(40, 40);
  lantern(150, 50);
  lotus(95, 120);
  boat(180, 150);
  star(30, 170);
  star(200, 92);
  lantern(60, 200);
  hat(150, 215);
  doodles = ctx.createPattern(c, "repeat");
  doodles?.setTransform(new DOMMatrix().scale(1 / S));
  return doodles;
}

/** Deep blue with a faint doodle pattern, filling the whole visible area. */
export function drawBackground(ctx: Ctx, view: Rect) {
  const g = ctx.createRadialGradient(W / 2, 480, 60, W / 2, 480, 760);
  g.addColorStop(0, "#2a66b0");
  g.addColorStop(1, "#163f7c");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  const p = doodlePattern(ctx);
  if (p) {
    ctx.fillStyle = p;
    ctx.fillRect(view.x, view.y, view.w, view.h);
  }
}

// ---------------------------------------------------------------- board

/** Prop sprites: img/props.webp, cells of PROP px, PROP_COLS across; each prop stands on its cell's bottom centre. */
export const PROP = 150;
const PROP_COLS = 6;
export const P = {
  shophouse: 0,
  junk: 1,
  pagoda: 2,
  terraces: 3,
  lotus: 4,
  bridge: 5,
  stall: 6,
  cyclo: 7,
  gate: 8,
  palm: 9,
  bamboo: 10,
  banana: 11,
  lanterns: 12,
  cart: 13,
  buffalo: 14,
  pot: 15,
  baskets: 16,
  stoneLantern: 17,
} as const;

/** Each colour's corner scene, by board corner: the floor, and the sprites for the four prop slots (big corner piece first). */
const SCENES: { floor: string; tile: string; props: number[] }[] = [
  // Red: Hội An old town
  { floor: "#f6d9c2", tile: "rgba(190,110,70,0.16)", props: [P.shophouse, P.lanterns, P.stall, P.pot, P.baskets] },
  // Green: rice terraces in the hills
  { floor: "#d6ebb0", tile: "rgba(90,140,50,0.16)", props: [P.terraces, P.bamboo, P.buffalo, P.banana, P.bridge] },
  // Yellow: a pagoda by the lotus pond
  { floor: "#f1e3bf", tile: "rgba(170,130,50,0.16)", props: [P.pagoda, P.stoneLantern, P.lotus, P.gate, P.banana] },
  // Blue: the bay
  { floor: "#d3eef0", tile: "rgba(40,140,170,0.16)", props: [P.junk, P.palm, P.cyclo, P.cart, P.pot] },
];

/**
 * Where the five props stand in each view corner (foot point and width, in
 * squares): the big piece in the outer corner, then along the two outer
 * strips the stable leaves free. Sprites stay upright, so these are per corner
 * rather than rotated.
 */
const SLOTS: [number, number, number][][] = [
  [
    [1.15, 14.85, 2.6],
    [0.92, 12.55, 1.45],
    [3.8, 14.9, 1.9],
    [5.45, 14.9, 1.1],
    [0.92, 10.8, 1.35],
  ],
  [
    [1.15, 1.95, 2.6],
    [0.92, 4.65, 1.45],
    [3.8, 1.75, 1.8],
    [0.92, 6.0, 1.05],
    [5.45, 1.75, 1.2],
  ],
  [
    [13.85, 1.95, 2.6],
    [14.08, 4.65, 1.45],
    [11.2, 1.75, 1.8],
    [14.08, 6.0, 1.05],
    [9.55, 1.75, 1.2],
  ],
  [
    [13.85, 14.85, 2.6],
    [14.08, 12.55, 1.45],
    [11.2, 14.9, 1.9],
    [9.55, 14.9, 1.1],
    [14.08, 10.8, 1.35],
  ],
];

/** A rectangle in squares (bottom-left-corner coordinates) turned to view corner `vc`, in screen px. */
function cornerRect(x: number, y: number, w: number, h: number, vc: number): Rect {
  const a = rotatePoint(x, y, vc);
  const b = rotatePoint(x + w, y + h, vc);
  const p = toScreen(Math.min(a.x, b.x), Math.min(a.y, b.y));
  const q = toScreen(Math.max(a.x, b.x), Math.max(a.y, b.y));
  return { x: p.x, y: p.y, w: q.x - p.x, h: q.y - p.y };
}

/**
 * The board as seen from view rotation: `colorOf[vc]` is the colour index in
 * view corner vc, or null for a corner nobody plays at this table (its scene
 * still shows, its stable greyed). `props` is the prop atlas, if loaded.
 */
export function drawBoard(ctx: Ctx, colorOf: (number | null)[], rot: number, props: HTMLImageElement | null) {
  const { x, y, w, h } = BOARD;
  const fill = (vc: number) => {
    const c = colorOf[vc];
    return c === null || c === undefined ? UNUSED : COLORS[c];
  };
  const dark = (vc: number) => {
    const c = colorOf[vc];
    return c === null || c === undefined ? UNUSED_DARK : DARK[c];
  };
  // The raised tray: a pale rim over a darker edge, with a soft shadow
  ctx.save();
  ctx.shadowColor = "rgba(5,20,50,0.5)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#8e98cf";
  roundRect(ctx, { x: x - 10, y: y - 8, w: w + 20, h: h + 22 }, 26);
  ctx.fill();
  ctx.restore();
  const rim = ctx.createLinearGradient(0, y - 10, 0, y + h + 10);
  rim.addColorStop(0, "#eef0fb");
  rim.addColorStop(1, "#c9cfee");
  ctx.fillStyle = rim;
  roundRect(ctx, { x: x - 10, y: y - 10, w: w + 20, h: h + 18 }, 26);
  ctx.fill();
  ctx.fillStyle = "#b8bfe3";
  roundRect(ctx, { x: x - 2, y: y - 2, w: w + 4, h: h + 4 }, 18);
  ctx.fill();

  // Corner scenes: floor, then the stable inset
  for (let vc = 0; vc < 4; vc++) {
    const scene = SCENES[(vc + rot) % 4];
    const floor = cornerRect(0.06, 9.06, 5.88, 5.88, vc);
    ctx.fillStyle = scene.floor;
    roundRect(ctx, floor, 14);
    ctx.fill();
    // Paving
    ctx.save();
    roundRect(ctx, floor, 14);
    ctx.clip();
    ctx.strokeStyle = scene.tile;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 1; k < 6; k++) {
      ctx.moveTo(floor.x + k * CELL, floor.y);
      ctx.lineTo(floor.x + k * CELL, floor.y + floor.h);
      ctx.moveTo(floor.x, floor.y + k * CELL);
      ctx.lineTo(floor.x + floor.w, floor.y + k * CELL);
    }
    ctx.stroke();
    ctx.restore();
    const inset = cornerRect(STABLE.x, STABLE.y, STABLE.size, STABLE.size, vc);
    ctx.fillStyle = "rgba(60,40,20,0.18)";
    roundRect(ctx, { x: inset.x - 4, y: inset.y - 2, w: inset.w + 8, h: inset.h + 9 }, 16);
    ctx.fill();
    ctx.fillStyle = "#fff6e4";
    roundRect(ctx, { x: inset.x - 5, y: inset.y - 5, w: inset.w + 10, h: inset.h + 10 }, 16);
    ctx.fill();
    const g = ctx.createLinearGradient(0, inset.y, 0, inset.y + inset.h);
    g.addColorStop(0, fill(vc));
    g.addColorStop(1, dark(vc));
    ctx.fillStyle = g;
    roundRect(ctx, inset, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, { x: inset.x + 5, y: inset.y + 4, w: inset.w - 10, h: inset.h * 0.32 }, 9);
    ctx.fill();
    for (let t = 0; t < 4; t++) {
      const s = baseSlot(vc, t);
      const c = toScreen(s.x, s.y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, CELL * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x, c.y + 2, CELL * 0.6, 0, Math.PI);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Path squares
  const square = (cx: number, cy: number, color: string, shade = "rgba(80,90,150,0.22)") => {
    const r = { x: x + cx * CELL + 1.5, y: y + cy * CELL + 1.5, w: CELL - 3, h: CELL - 3 };
    ctx.fillStyle = shade;
    roundRect(ctx, { x: r.x, y: r.y + 2, w: r.w, h: r.h }, 6);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, r, 6);
    ctx.fill();
  };
  for (const [cx, cy] of TRACK) square(cx, cy, CREAM);
  for (let vc = 0; vc < 4; vc++) {
    for (const [cx, cy] of homeColumn(vc)) square(cx, cy, fill(vc), "rgba(0,0,0,0.18)");
    // The start square: the colour (no safe squares: anyone can be hit anywhere on the loop)
    const [sx, sy] = TRACK[vc * 13];
    square(sx, sy, fill(vc), "rgba(0,0,0,0.18)");
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
    const tg = ctx.createLinearGradient(pa.x, pa.y, mid.x, mid.y);
    tg.addColorStop(0, fill(vc));
    tg.addColorStop(1, dark(vc));
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Props last, back to front, so tall ones overlap the rim like toys on a tray
  if (props?.complete && props.naturalWidth) {
    const list: { i: number; x: number; y: number; w: number }[] = [];
    for (let vc = 0; vc < 4; vc++)
      SCENES[(vc + rot) % 4].props.forEach((i, k) => {
        const [px, py, pw] = SLOTS[vc][k];
        list.push({ i, x: px, y: py, w: pw });
      });
    list.sort((a, b) => a.y - b.y);
    for (const p of list) {
      const s = toScreen(p.x, p.y);
      const pw = p.w * CELL;
      ctx.drawImage(props, (p.i % PROP_COLS) * PROP, Math.floor(p.i / PROP_COLS) * PROP, PROP, PROP, s.x - pw / 2, s.y - pw, pw, pw);
    }
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
  // A soft drop shadow that shrinks and fades as it hops
  const k = 1 - Math.min(0.45, lift / 50);
  const sh = ctx.createRadialGradient(x, y - 1, 0, x, y - 1, w * 0.46 * k);
  sh.addColorStop(0, `rgba(20,20,50,${0.45 * k})`);
  sh.addColorStop(1, "rgba(20,20,50,0)");
  ctx.fillStyle = sh;
  ctx.save();
  ctx.translate(x, y - 1);
  ctx.scale(1, 0.38);
  ctx.translate(-x, -(y - 1));
  ctx.beginPath();
  ctx.arc(x, y - 1, w * 0.46 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

// ---------------------------------------------------------------- players & buttons

/** Portraits: img/avatars.webp, 8 cells of 128 px — the people by colour (0–3), then the computer's faces (4–7). */
export const AVATAR_PX = 128;

/**
 * A round portrait in its colour's ring. `glow` (0..1) pulses the ring for
 * the player whose turn it is; `clock` (0..1) runs an arc round it online.
 */
export function drawAvatar(
  ctx: Ctx,
  img: HTMLImageElement | null,
  face: number,
  color: number,
  x: number,
  y: number,
  r: number,
  opts: { glow?: number; clock?: number | null; dim?: boolean } = {},
) {
  ctx.save();
  if (opts.glow !== undefined) {
    ctx.shadowColor = COLORS[color];
    ctx.shadowBlur = 16 + 14 * opts.glow;
    ctx.beginPath();
    ctx.arc(x, y, r + 7 + opts.glow * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.4 * opts.glow})`;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Ring: white rim, then the colour
  ctx.beginPath();
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = COLORS[color];
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = LIGHT[color];
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (img?.complete && img.naturalWidth) ctx.drawImage(img, face * AVATAR_PX, 0, AVATAR_PX, AVATAR_PX, x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
  if (opts.dim) {
    ctx.fillStyle = "rgba(30,40,60,0.62)";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  if (opts.clock !== undefined && opts.clock !== null) {
    ctx.beginPath();
    ctx.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * opts.clock);
    ctx.strokeStyle = opts.clock < 0.3 ? "#ff5a4e" : "#ffffff";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

/** White text with a dark outline, readable on the blue backdrop. */
export function outlined(ctx: Ctx, str: string, x: number, y: number, size: number, align: CanvasTextAlign = "center", fill = "#ffffff") {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.22);
  ctx.strokeStyle = "rgba(10,30,70,0.85)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** A small rounded tag, e.g. "Máy · Khó". */
export function drawTag(ctx: Ctx, str: string, x: number, y: number, size: number, fill: string, align: "left" | "right" | "center" = "center") {
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(str).width + size;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.fillStyle = fill;
  roundRect(ctx, { x: left, y: y - size * 0.72, w, h: size * 1.44 }, size * 0.72);
  ctx.fill();
  text(ctx, str, left + w / 2, y + 1, size, "#ffffff");
}

export type RoundIcon = "menu" | "rules" | "new";

/** A small round glossy button with an icon, and its label under it. */
export function drawRoundButton(ctx: Ctx, icon: RoundIcon, label: string, x: number, y: number, r: number) {
  ctx.save();
  ctx.fillStyle = "rgba(5,20,50,0.35)";
  ctx.beginPath();
  ctx.arc(x, y + 4, r + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = "#f7c948";
  ctx.fill();
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, "#5cc3ff");
  g.addColorStop(1, "#1f7ad6");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.45, r * 0.7, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  const s = r * 0.42;
  if (icon === "menu") {
    for (const dy of [-0.55, 0, 0.55]) {
      ctx.moveTo(x - s, y + dy * s);
      ctx.lineTo(x + s, y + dy * s);
    }
    ctx.stroke();
  } else if (icon === "new") {
    // A circular arrow
    ctx.arc(x, y, s * 0.9, -Math.PI * 0.2, Math.PI * 1.45);
    ctx.stroke();
    ctx.beginPath();
    const ax = x + Math.cos(-Math.PI * 0.2) * s * 0.9;
    const ay = y + Math.sin(-Math.PI * 0.2) * s * 0.9;
    ctx.moveTo(ax + s * 0.45, ay - s * 0.05);
    ctx.lineTo(ax, ay + s * 0.05);
    ctx.lineTo(ax - s * 0.05, ay - s * 0.5);
    ctx.stroke();
  } else {
    ctx.font = `800 ${r * 1.15}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x, y + r * 0.08);
  }
  ctx.restore();
  outlined(ctx, label, x, y + r + 17, 15);
}

/** The glossy square roll button (the dice are drawn into it by the caller). `color` tints the frame. */
export function drawRollButton(ctx: Ctx, r: Rect, color: number, pulse: number, pressed: boolean) {
  const lift = pressed ? 0 : 5;
  ctx.save();
  if (pulse > 0) {
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 14 + 16 * pulse;
  } else {
    ctx.shadowColor = "rgba(5,20,50,0.5)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
  }
  ctx.fillStyle = DARK[color];
  roundRect(ctx, { x: r.x - 8, y: r.y - 8 + 5, w: r.w + 16, h: r.h + 16 }, 30);
  ctx.fill();
  ctx.restore();
  const g = ctx.createLinearGradient(0, r.y - 8, 0, r.y + r.h);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.12, COLORS[color]);
  g.addColorStop(1, DARK[color]);
  ctx.fillStyle = g;
  roundRect(ctx, { x: r.x - 8, y: r.y - 8 + 5 - lift, w: r.w + 16, h: r.h + 16 - 5 }, 30);
  ctx.fill();
  // The inner well, warm wood
  const well = { x: r.x + 4, y: r.y + 4 - lift, w: r.w - 8, h: r.h - 12 };
  const wg = ctx.createLinearGradient(0, well.y, 0, well.y + well.h);
  wg.addColorStop(0, "#c98a52");
  wg.addColorStop(1, "#8c5427");
  ctx.fillStyle = wg;
  roundRect(ctx, well, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  roundRect(ctx, { x: well.x + 6, y: well.y + 4, w: well.w - 12, h: well.h * 0.3 }, 14);
  ctx.fill();
  return lift;
}

