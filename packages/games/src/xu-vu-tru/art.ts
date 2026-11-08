// Drawing for Xu Vũ Trụ: the cabinet, wheel, shelf and LED counters are drawn
// here (static parts cached to offscreen canvases); the two robot mascots are
// generated art (img/robots.webp, see art-src/xu-vu-tru/). The shelf is 2D
// physics seen from above; `proj` tilts it into a 3/4 view and every disc is
// drawn squashed, with a rim, a shadow and a size that grows toward the front.
import { type Rect, clamp, lerp, mulberry32 } from "@web-games/core";
import { PUSH_MAX, SEG_SIZE, SEG_START, SHELF_D, SHELF_W, SIDE_WALL_D, W, WHEEL } from "./config";
import type { Body } from "./physics";

type Ctx = CanvasRenderingContext2D;

export const FONT = '"Baloo 2", system-ui, sans-serif';
export const LED_FONT = '"Handjet", "Baloo 2", monospace';

export const INK = "#0b0820";
export const NEON = "#4ff3ff";
export const GOLD = "#ffcf4a";
export const PINK = "#ff4fa3";
export const AMBER = "#ffb43c";
export const MINT = "#5dffb0";
/** The six energy cores: red, orange, yellow, green, cyan, violet. */
export const CORE_COLORS = ["#ff4d5e", "#ff9a3c", "#ffe14d", "#4dff88", "#4dd8ff", "#b77bff"];

// ---------------------------------------------------------------- layout (logical px)

export const WHEEL_C = { x: 270, y: 262 };
export const WHEEL_R = 138;
export const MARQUEE: Rect = { x: 94, y: 8, w: 352, h: 54 };
export const LAMPS_Y = 86;
export const REEL: Rect = { x: 104, y: 420, w: 292, h: 52 };
export const SPINS_BOX: Rect = { x: 404, y: 420, w: 104, h: 52 };
export const MENU_BTN: Rect = { x: 8, y: 8, w: 78, h: 54 };
export const COINS_BOX: Rect = { x: 14, y: 858, w: 168, h: 62 };
export const TICKETS_BOX: Rect = { x: 358, y: 858, w: 150, h: 62 };
export const SHOOT = { x: 270, y: 886, r: 60 };
/** Screen rows of the shelf's back wall line and front edge, and the front's screen span. */
export const SHELF_TOP = 494;
export const SHELF_BOTTOM = 802;
const FRONT_L = 38;
const FRONT_R = 502;
const BACK_SCALE = 0.8;
/** The chute from the button round to the wheel's 3 o'clock. */
export const CHUTE_X = 524;
export const CHUTE: { x: number; y: number }[] = [
  { x: SHOOT.x + 20, y: SHOOT.y + 30 },
  { x: 330, y: 944 },
  { x: CHUTE_X, y: 944 },
  { x: CHUTE_X, y: WHEEL_C.y },
  { x: WHEEL_C.x + WHEEL_R + 10, y: WHEEL_C.y },
];

// ---------------------------------------------------------------- projection

/** Shelf world (x across, y back→front) to the screen; `s` is the size factor there. */
export function proj(x: number, y: number) {
  const k = y / SHELF_D;
  const s = lerp(BACK_SCALE, 1, k) * ((FRONT_R - FRONT_L) / SHELF_W);
  return {
    x: W / 2 + (x - SHELF_W / 2) * s,
    y: SHELF_TOP + k * (SHELF_BOTTOM - SHELF_TOP),
    s,
  };
}

/** A point along a polyline, `k` 0..1 by length. */
export function along(pts: { x: number; y: number }[], k: number) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let d = clamp(k, 0, 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg || i === pts.length - 1) {
      const f = seg > 0 ? Math.min(1, d / seg) : 0;
      return { x: lerp(pts[i - 1].x, pts[i].x, f), y: lerp(pts[i - 1].y, pts[i].y, f) };
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

// ---------------------------------------------------------------- text and UI

export function text(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size: number,
  fill = "#ffffff",
  align: CanvasTextAlign = "center",
  stroke: string | null = INK,
  font = FONT,
  weight = 800,
) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.2);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** Neon text: a coloured glow under a white-hot core. */
export function neon(ctx: Ctx, str: string, x: number, y: number, size: number, color: string, glow = 1, font = FONT) {
  ctx.save();
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * glow;
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = color;
  ctx.strokeText(str, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** Largest size ≤ `size` at which `str` fits `maxW`. */
export function fitSize(ctx: Ctx, str: string, size: number, maxW: number, font = FONT) {
  let s = size;
  for (; s > 10; s -= 1) {
    ctx.font = `800 ${s}px ${font}`;
    if (ctx.measureText(str).width <= maxW) break;
  }
  return s;
}

export function panel(ctx: Ctx, r: Rect, radius = 22) {
  ctx.save();
  ctx.shadowColor = "rgba(79,243,255,0.45)";
  ctx.shadowBlur = 24;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, "#1b1446");
  g.addColorStop(1, "#0c0a26");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, radius - 6);
  ctx.stroke();
  ctx.restore();
}

/** A chunky arcade button; `colors` top→bottom. */
export function button(ctx: Ctx, r: Rect, label: string, colors: [string, string], size = 26, pressed = false) {
  ctx.save();
  const dy = pressed ? 3 : 0;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 6, r.w, r.h, r.h / 2.4);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + dy, r.w, r.h, r.h / 2.4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.roundRect(r.x + 10, r.y + dy + 5, r.w - 20, r.h * 0.26, r.h * 0.13);
  ctx.fill();
  text(ctx, label, r.x + r.w / 2, r.y + dy + r.h / 2 + 2, fitSize(ctx, label, size, r.w - 24), "#ffffff");
  ctx.restore();
}

// ---------------------------------------------------------------- cached sprites

export interface Sprites {
  coin: HTMLCanvasElement;
  cores: HTMLCanvasElement[];
  wheel: HTMLCanvasElement;
  stars: { x: number; y: number; r: number; tw: number }[];
}

const COIN_PX = 64;
/** The coin sprite: a tilted disc with its rim, drawn at COIN_PX across. */
function coinSprite() {
  const c = document.createElement("canvas");
  c.width = COIN_PX + 4;
  c.height = Math.round(COIN_PX * 0.62 + 14);
  const g = c.getContext("2d") as Ctx;
  const cx = c.width / 2;
  const rx = COIN_PX / 2;
  const ry = rx * 0.62;
  const top = ry + 2;
  // Rim (the coin's edge, seen below the face)
  g.fillStyle = "#9a5a08";
  g.beginPath();
  g.ellipse(cx, top + 8, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - rx, top, rx * 2, 8);
  g.fillStyle = "#c97d12";
  g.beginPath();
  g.ellipse(cx, top + 5, rx, ry, 0, 0, Math.PI);
  g.fill();
  // Face
  const face = g.createLinearGradient(cx - rx, top - ry, cx + rx, top + ry);
  face.addColorStop(0, "#fff3a8");
  face.addColorStop(0.45, "#ffcc33");
  face.addColorStop(1, "#e08a10");
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#a8640a";
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = "rgba(160,92,8,0.8)";
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(cx, top, rx * 0.7, ry * 0.7, 0, 0, Math.PI * 2);
  g.stroke();
  // An embossed four-point star
  g.fillStyle = "rgba(255,250,210,0.9)";
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? rx * 0.42 : rx * 0.13;
    g.lineTo(cx + Math.cos(a) * rr, top + Math.sin(a) * rr * 0.62);
  }
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(cx - rx * 0.35, top - ry * 0.4, rx * 0.28, ry * 0.18, -0.3, 0, Math.PI * 2);
  g.fill();
  return c;
}

const CORE_PX = 96;
/** An energy-core capsule: a glowing orb standing in a chrome ring, seen at 3/4. */
function coreSprite(color: string) {
  const c = document.createElement("canvas");
  c.width = CORE_PX + 8;
  c.height = Math.round(CORE_PX * 1.15);
  const g = c.getContext("2d") as Ctx;
  const cx = c.width / 2;
  const rx = CORE_PX / 2;
  const base = c.height - rx * 0.62 - 6;
  // Chrome base ring
  const chrome = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
  chrome.addColorStop(0, "#5d6b80");
  chrome.addColorStop(0.35, "#f2f6ff");
  chrome.addColorStop(0.6, "#9aa7bd");
  chrome.addColorStop(1, "#3c4658");
  g.fillStyle = "#2a3140";
  g.beginPath();
  g.ellipse(cx, base + 7, rx, rx * 0.62, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = chrome;
  g.beginPath();
  g.ellipse(cx, base, rx, rx * 0.62, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1a1f2b";
  g.beginPath();
  g.ellipse(cx, base, rx * 0.72, rx * 0.44, 0, 0, Math.PI * 2);
  g.fill();
  // The orb
  const oy = base - rx * 0.55;
  const or = rx * 0.78;
  const orb = g.createRadialGradient(cx - or * 0.35, oy - or * 0.35, or * 0.1, cx, oy, or);
  orb.addColorStop(0, "#ffffff");
  orb.addColorStop(0.3, color);
  orb.addColorStop(1, shade(color, 0.35));
  g.fillStyle = orb;
  g.beginPath();
  g.arc(cx, oy, or, 0, Math.PI * 2);
  g.fill();
  // Facets: a hex cage over the orb
  g.strokeStyle = "rgba(230,240,255,0.75)";
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    g.lineTo(cx + Math.cos(a) * or * 0.55, oy + Math.sin(a) * or * 0.55);
  }
  g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * or * 0.55, oy + Math.sin(a) * or * 0.55);
    g.lineTo(cx + Math.cos(a) * or * 0.97, oy + Math.sin(a) * or * 0.97);
    g.stroke();
  }
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(cx, oy, or, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath();
  g.ellipse(cx - or * 0.38, oy - or * 0.45, or * 0.22, or * 0.12, -0.6, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Darken a #rrggbb colour by `k` (0 = black, 1 = unchanged). */
export function shade(hex: string, k: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

const SEG_COLORS: Record<number, [string, string]> = {
  2: ["#19b8c9", "#0c6f7d"],
  3: ["#3a7bff", "#1d3fa8"],
  6: ["#9a5bff", "#5420b0"],
  12: ["#ffc93a", "#e07a10"],
};

/** The wheel face at 2× (it is rotated as one image each frame). */
function wheelSprite() {
  const R = WHEEL_R * 2;
  const c = document.createElement("canvas");
  c.width = R * 2 + 8;
  c.height = R * 2 + 8;
  const g = c.getContext("2d") as Ctx;
  const cx = c.width / 2;
  const cy = c.height / 2;
  for (let i = 0; i < WHEEL.length; i++) {
    const a0 = SEG_START[i];
    const a1 = a0 + SEG_SIZE[i];
    const seg = WHEEL[i];
    let cols: [string, string];
    if (seg.kind === "tickets") cols = SEG_COLORS[seg.value] ?? SEG_COLORS[2];
    else if (seg.kind === "core") cols = ["#2a2f5a", "#0d1030"];
    else cols = ["#ff3d6e", "#a3103a"];
    const grad = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    grad.addColorStop(0, cols[1]);
    grad.addColorStop(0.7, cols[0]);
    grad.addColorStop(1, cols[1]);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, R, a0, a1);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.lineWidth = 3;
    g.stroke();
    // Label along the radius, reading outward
    const mid = (a0 + a1) / 2;
    g.save();
    g.translate(cx, cy);
    g.rotate(mid);
    if (seg.kind === "tickets") {
      g.font = `800 ${seg.value >= 10 ? 46 : 52}px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 8;
      g.strokeStyle = "rgba(10,8,32,0.85)";
      g.save();
      g.translate(R * 0.74, 0);
      g.rotate(Math.PI / 2);
      g.strokeText(String(seg.value), 0, 0);
      g.fillStyle = seg.value === 12 ? "#fff6c8" : "#ffffff";
      g.fillText(String(seg.value), 0, 0);
      g.restore();
    } else if (seg.kind === "core") {
      // Six little orbs in a ring: the core slot
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g.fillStyle = CORE_COLORS[k];
        g.beginPath();
        g.arc(R * 0.76 + Math.cos(a) * 14, Math.sin(a) * 14, 7, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(R * 0.76, 0, 6, 0, Math.PI * 2);
      g.fill();
    } else {
      // A star for BONUS
      g.fillStyle = GOLD;
      g.strokeStyle = "#6a0820";
      g.lineWidth = 4;
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = k % 2 === 0 ? 22 : 9;
        g.lineTo(R * 0.76 + Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }
  // Inner ring and hub
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
  g.stroke();
  return c;
}

export function makeSprites(): Sprites {
  const rnd = mulberry32(0xc0115);
  const stars = Array.from({ length: 90 }, () => ({
    x: rnd() * W,
    y: -140 + rnd() * 1240,
    r: 0.6 + rnd() * 1.8,
    tw: rnd() * Math.PI * 2,
  }));
  return { coin: coinSprite(), cores: CORE_COLORS.map(coreSprite), wheel: wheelSprite(), stars };
}

// ---------------------------------------------------------------- background and cabinet

export function drawBackground(ctx: Ctx, sp: Sprites, view: Rect, t: number) {
  const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h);
  g.addColorStop(0, "#160b3a");
  g.addColorStop(0.5, "#0c0826");
  g.addColorStop(1, "#05040f");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  for (const s of sp.stars) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + s.tw);
    ctx.fillStyle = "#cfe9ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The cabinet body: metal sides, the dark glass-backed interior and a chase of bulbs. */
export function drawCabinet(ctx: Ctx, view: Rect, t: number, chase: number, rainbow: boolean) {
  const top = Math.min(view.y + 4, -10);
  const bottom = Math.max(view.y + view.h - 4, 970);
  // Body
  const body = ctx.createLinearGradient(0, 0, W, 0);
  body.addColorStop(0, "#0a3a48");
  body.addColorStop(0.08, "#16798a");
  body.addColorStop(0.5, "#0d2c3c");
  body.addColorStop(0.92, "#16798a");
  body.addColorStop(1, "#0a3a48");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(2, top, W - 4, bottom - top, 26);
  ctx.fill();
  // Interior behind the glass
  const inner = ctx.createLinearGradient(0, 100, 0, 820);
  inner.addColorStop(0, "#1b1150");
  inner.addColorStop(0.45, "#120c38");
  inner.addColorStop(1, "#0a0820");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.roundRect(14, 104, W - 28, 724, 18);
  ctx.fill();
  // Neon trim
  ctx.save();
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(14, 104, W - 28, 724, 18);
  ctx.stroke();
  ctx.restore();
  // Bulbs down both sides
  const n = 22;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < n; i++) {
      const y = 118 + (i / (n - 1)) * 690;
      const x = side === 0 ? 8 : W - 8;
      const on = (i + Math.floor(chase)) % 3 === (side === 0 ? 0 : 1);
      const col = rainbow ? CORE_COLORS[(i + Math.floor(chase)) % 6] : on ? GOLD : "#6a5a2a";
      bulb(ctx, x, y, 4.2, col, on || rainbow);
    }
  }
  void t;
}

export function bulb(ctx: Ctx, x: number, y: number, r: number, color: string, on: boolean) {
  ctx.save();
  if (on) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
  }
  ctx.fillStyle = on ? color : "#3a3350";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (on) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The top marquee: "SUPER BONUS 250" in neon, flashing when it pays. */
export function drawMarquee(ctx: Ctx, label: string, t: number, hot: boolean) {
  const r = MARQUEE;
  ctx.save();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, "#2a0d4a");
  g.addColorStop(1, "#120626");
  ctx.fillStyle = g;
  ctx.shadowColor = PINK;
  ctx.shadowBlur = hot ? 30 : 14;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hot && Math.floor(t * 8) % 2 === 0 ? GOLD : PINK;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Marquee bulbs along the top and bottom
  const n = 16;
  for (let i = 0; i < n; i++) {
    const x = r.x + 16 + (i / (n - 1)) * (r.w - 32);
    const on = (i + Math.floor(t * (hot ? 14 : 5))) % 2 === 0;
    bulb(ctx, x, r.y + 5, 2.6, hot ? CORE_COLORS[i % 6] : GOLD, on);
    bulb(ctx, x, r.y + r.h - 5, 2.6, hot ? CORE_COLORS[(i + 3) % 6] : GOLD, !on);
  }
  const size = fitSize(ctx, label, 34, r.w - 40);
  neon(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 2, size, hot ? GOLD : PINK, hot ? 1.6 : 1);
  ctx.restore();
}

/** Six core lamps under the marquee. `flash` blinks them all (Super Bonus). */
export function drawCoreLamps(ctx: Ctx, sp: Sprites, cores: boolean[], t: number, flash: boolean, pulse: number[]) {
  const gap = 58;
  const x0 = W / 2 - (gap * (cores.length - 1)) / 2;
  for (let i = 0; i < cores.length; i++) {
    const x = x0 + i * gap;
    const y = LAMPS_Y;
    const lit = flash ? Math.floor(t * 10 + i) % 2 === 0 : cores[i];
    const p = pulse[i] ?? 0;
    ctx.save();
    // Socket
    ctx.fillStyle = "#0b0a20";
    ctx.strokeStyle = lit ? CORE_COLORS[i] : "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    hex(ctx, x, y, 20 + p * 6);
    ctx.fill();
    ctx.stroke();
    if (lit) {
      ctx.shadowColor = CORE_COLORS[i];
      ctx.shadowBlur = 18 + p * 20;
      ctx.drawImage(sp.cores[i], x - 17 - p * 4, y - 22 - p * 5, 34 + p * 8, 38 + p * 9);
    } else {
      ctx.globalAlpha = 0.28;
      ctx.drawImage(sp.cores[i], x - 15, y - 19, 30, 33);
    }
    ctx.restore();
  }
}

function hex(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** The robots stand in the top corners, bobbing; `cheer` makes them hop. */
export function drawRobots(ctx: Ctx, img: HTMLImageElement | null, t: number, cheer: number) {
  if (!img) return;
  const hop = cheer > 0 ? Math.abs(Math.sin(t * 12)) * 12 * Math.min(1, cheer) : 0;
  const bob0 = Math.sin(t * 2.2) * 4 + hop;
  const bob1 = Math.sin(t * 2.2 + 1.7) * 2 + hop * 0.8;
  ctx.drawImage(img, 0, 0, 240, 260, 10, 136 - bob0, 104, 113);
  ctx.drawImage(img, 240, 0, 240, 260, 420, 132 - bob1, 100, 108);
}

// ---------------------------------------------------------------- wheel

/** The target wheel behind glass, its pointer at 3 o'clock where the chute ends. */
export function drawWheel(ctx: Ctx, sp: Sprites, angle: number, t: number, chase: number, hit: { seg: number; t: number } | null) {
  const { x, y } = WHEEL_C;
  const R = WHEEL_R;
  ctx.save();
  // Rim with bulbs
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 20;
  const rim = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
  rim.addColorStop(0, "#d8e8ff");
  rim.addColorStop(0.5, "#5f6f8f");
  rim.addColorStop(1, "#c8d8f0");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, R + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#151236";
  ctx.beginPath();
  ctx.arc(x, y, R + 3, 0, Math.PI * 2);
  ctx.fill();
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const on = (i + Math.floor(chase)) % 4 === 0 || (i + Math.floor(chase)) % 4 === 2;
    bulb(ctx, x + Math.cos(a) * (R + 8.5), y + Math.sin(a) * (R + 8.5), 3, on ? "#fff3b0" : "#8a7a40", on);
  }
  // The face
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(sp.wheel, -R - 2, -R - 2, R * 2 + 4, R * 2 + 4);
  ctx.restore();
  // Flash the segment that was just hit
  if (hit && hit.t < 0.6) {
    const a0 = angle + SEG_START[hit.seg];
    ctx.save();
    ctx.globalAlpha = (1 - hit.t / 0.6) * (Math.floor(hit.t * 16) % 2 === 0 ? 0.7 : 0.35);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, R, a0, a0 + SEG_SIZE[hit.seg]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Hub: a glowing robot eye
  ctx.save();
  const hub = ctx.createRadialGradient(x - 8, y - 8, 4, x, y, 40);
  hub.addColorStop(0, "#f4f8ff");
  hub.addColorStop(0.6, "#8d9ab8");
  hub.addColorStop(1, "#3a4460");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(x, y, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0b0d22";
  ctx.beginPath();
  ctx.roundRect(x - 26, y - 13, 52, 26, 13);
  ctx.fill();
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 12;
  ctx.fillStyle = NEON;
  const blink = Math.sin(t * 1.3) > 0.97 ? 0.15 : 1;
  ctx.beginPath();
  ctx.ellipse(x - 11, y, 6, 7 * blink, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 11, y, 6, 7 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Pointer at the chute's mouth
  ctx.save();
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x + R - 14, y);
  ctx.lineTo(x + R + 16, y - 15);
  ctx.lineTo(x + R + 16, y + 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Glass over the wheel and the shelf: two soft diagonal reflections. */
export function drawGlass(ctx: Ctx, r: Rect, t: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.clip();
  const sweep = ((t * 0.07) % 1.6) - 0.3;
  for (const [off, wd, a] of [
    [0, 60, 0.07],
    [90, 22, 0.05],
  ] as const) {
    const x = r.x + (sweep * r.w) + off;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x + wd, r.y);
    ctx.lineTo(x + wd - r.h * 0.5, r.y + r.h);
    ctx.lineTo(x - r.h * 0.5, r.y + r.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The clear tube the coin shoots up; a coin inside is drawn by the caller. */
export function drawChute(ctx: Ctx, glow: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = () => {
    ctx.beginPath();
    for (const p of CHUTE) ctx.lineTo(p.x, p.y);
  };
  path();
  ctx.strokeStyle = "rgba(10,12,40,0.85)";
  ctx.lineWidth = 22;
  ctx.stroke();
  path();
  ctx.strokeStyle = `rgba(79,243,255,${0.22 + glow * 0.5})`;
  ctx.lineWidth = 18;
  ctx.stroke();
  path();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** A coin seen edge-on-ish, spinning as it flies (k: spin phase). */
export function drawFlyingCoin(ctx: Ctx, sp: Sprites, x: number, y: number, size: number, k: number) {
  const w = size * Math.max(0.25, Math.abs(Math.cos(k)));
  ctx.drawImage(sp.coin, x - w / 2, y - size * 0.4, w, size * 0.85);
}

// ---------------------------------------------------------------- reels and counters

/** An LED counter panel: label on top, ghost 8s behind the lit digits. */
export function drawCounter(ctx: Ctx, r: Rect, label: string, value: number, color: string, digits: number, bump = 0) {
  ctx.save();
  ctx.fillStyle = "#05040c";
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.stroke();
  // Label tab
  const lw = Math.max(44, label.length * 13 + 18);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(r.x + 10, r.y - 13, lw, 22, 8);
  ctx.fill();
  text(ctx, label, r.x + 10 + lw / 2, r.y - 2, 17, INK, "center", null);
  const size = r.h * 0.95 * (1 + bump * 0.12);
  ctx.font = `700 ${size}px ${LED_FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const right = r.x + r.w - 12;
  const cy = r.y + r.h / 2 + 4;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillText("8".repeat(digits), right, cy);
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 + bump * 16;
  ctx.fillStyle = color;
  ctx.fillText(String(Math.max(0, Math.round(value))).slice(-digits), right, cy);
  ctx.restore();
}

/** The "YOU WIN" reels window for the Bonus Spin. `offset` scrolls the strip (in prizes). */
export function drawReels(
  ctx: Ctx,
  label: string,
  prizes: readonly number[],
  offset: number,
  active: boolean,
  won: boolean,
  t: number,
) {
  const r = REEL;
  ctx.save();
  ctx.shadowColor = active ? GOLD : NEON;
  ctx.shadowBlur = active ? 24 : 8;
  ctx.fillStyle = "#07061a";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = active ? GOLD : "rgba(79,243,255,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  const split = r.x + 122;
  text(ctx, label, r.x + 62, r.y + r.h / 2 + 2, fitSize(ctx, label, 22, 110), active ? GOLD : "#bfc6ff", "center", null);
  // Reel strip
  const rw = r.x + r.w - 8 - split;
  ctx.fillStyle = "#e9ecf8";
  ctx.beginPath();
  ctx.roundRect(split, r.y + 6, rw, r.h - 12, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(split, r.y + 6, rw, r.h - 12, 8);
  ctx.clip();
  const cellH = r.h - 12;
  const base = Math.floor(offset);
  const frac = offset - base;
  for (let k = -1; k <= 1; k++) {
    const idx = (((base + k) % prizes.length) + prizes.length) % prizes.length;
    const yy = r.y + r.h / 2 + (k - frac) * cellH;
    const flash = won && k === 0 && Math.floor(t * 8) % 2 === 0;
    ctx.font = `700 ${cellH * 1.05}px ${LED_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = flash ? "#e0115f" : "#1a1440";
    ctx.fillText(String(prizes[idx]), split + rw / 2, yy + 3);
  }
  // Curved-glass shading
  const sh = ctx.createLinearGradient(0, r.y + 6, 0, r.y + r.h - 6);
  sh.addColorStop(0, "rgba(0,0,20,0.55)");
  sh.addColorStop(0.35, "rgba(0,0,20,0)");
  sh.addColorStop(0.65, "rgba(0,0,20,0)");
  sh.addColorStop(1, "rgba(0,0,20,0.55)");
  ctx.fillStyle = sh;
  ctx.fillRect(split, r.y + 6, rw, r.h - 12);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- the shelf

/** Shelf floor, side rails and gutters, all behind the bodies. */
export function drawShelf(ctx: Ctx, t: number) {
  const bl = proj(0, 0);
  const br = proj(SHELF_W, 0);
  const fl = proj(0, SHELF_D);
  const fr = proj(SHELF_W, SHELF_D);
  ctx.save();
  // Back wall panel above the pusher
  const wall = ctx.createLinearGradient(0, REEL.y + REEL.h, 0, bl.y);
  wall.addColorStop(0, "#1a1645");
  wall.addColorStop(1, "#2a2560");
  ctx.fillStyle = wall;
  ctx.fillRect(bl.x - 30, REEL.y + REEL.h + 6, br.x - bl.x + 60, bl.y - REEL.y - REEL.h - 6);
  // Gutters: the dark drop beside the open part of the shelf
  ctx.fillStyle = "#04030c";
  const gs = proj(0, SIDE_WALL_D);
  const ge = proj(SHELF_W, SIDE_WALL_D);
  ctx.beginPath();
  ctx.moveTo(gs.x, gs.y);
  ctx.lineTo(fl.x, fl.y);
  ctx.lineTo(fl.x - 26, fl.y + 6);
  ctx.lineTo(gs.x - 22, gs.y);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ge.x, ge.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fr.x + 26, fr.y + 6);
  ctx.lineTo(ge.x + 22, ge.y);
  ctx.closePath();
  ctx.fill();
  // Floor: brushed metal deck with a faint grid
  const floor = ctx.createLinearGradient(0, bl.y, 0, fl.y);
  floor.addColorStop(0, "#2d3a5e");
  floor.addColorStop(1, "#4a5a86");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fl.x, fl.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(140,200,255,0.10)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const a = proj((i / 8) * SHELF_W, 0);
    const b = proj((i / 8) * SHELF_W, SHELF_D);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i++) {
    const a = proj(0, (i / 6) * SHELF_D);
    const b = proj(SHELF_W, (i / 6) * SHELF_D);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Side walls along the back part
  for (const side of [0, 1]) {
    const x = side === 0 ? 0 : SHELF_W;
    const a = proj(x, -10);
    const b = proj(x, SIDE_WALL_D);
    const dx = side === 0 ? -1 : 1;
    ctx.fillStyle = "#7f8db0";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 26);
    ctx.lineTo(b.x, b.y - 22);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(a.x, a.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c9d6f2";
    ctx.fillRect(Math.min(a.x, b.x) - (dx < 0 ? 4 : 0), a.y - 28, 4, 3);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 26);
    ctx.lineTo(b.x, b.y - 22);
    ctx.stroke();
  }
  ctx.restore();
  void t;
}

/** The pusher block: its top from the back wall to its face, and the face with an LED strip. */
export function drawPusher(ctx: Ctx, py: number, t: number, rainbow: boolean) {
  const bl = proj(-4, 0);
  const br = proj(SHELF_W + 4, 0);
  const fl = proj(-4, py);
  const fr = proj(SHELF_W + 4, py);
  const h = 24 * fl.s;
  ctx.save();
  // Top surface
  const top = ctx.createLinearGradient(0, bl.y - h, 0, fl.y - h);
  top.addColorStop(0, "#2c3558");
  top.addColorStop(1, "#8492b8");
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y - h);
  ctx.lineTo(br.x, br.y - h);
  ctx.lineTo(fr.x, fr.y - h);
  ctx.lineTo(fl.x, fl.y - h);
  ctx.closePath();
  ctx.fill();
  // Panel seams and rivets on the top plate
  ctx.strokeStyle = "rgba(20,24,50,0.35)";
  ctx.lineWidth = 1.5;
  for (const k of [0.33, 0.66]) {
    const a = proj(-4, py * k);
    const b = proj(SHELF_W + 4, py * k);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - h);
    ctx.lineTo(b.x, b.y - h);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i++) {
    const a = proj((i / 6) * SHELF_W, 0);
    const b = proj((i / 6) * SHELF_W, py);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - h);
    ctx.lineTo(b.x, b.y - h);
    ctx.stroke();
    ctx.fillStyle = "rgba(240,246,255,0.55)";
    ctx.beginPath();
    ctx.arc(b.x, b.y - h - 16 * b.s, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hazard stripes along the front of the top
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y - h - 10);
  ctx.lineTo(fr.x, fr.y - h - 10);
  ctx.lineTo(fr.x, fr.y - h);
  ctx.lineTo(fl.x, fl.y - h);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#ffcf4a";
  ctx.fillRect(fl.x, fl.y - h - 10, fr.x - fl.x, 10);
  ctx.fillStyle = "#1a1440";
  for (let x = fl.x - 20; x < fr.x; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, fl.y - h);
    ctx.lineTo(x + 10, fl.y - h);
    ctx.lineTo(x + 20, fl.y - h - 10);
    ctx.lineTo(x + 10, fl.y - h - 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Face
  const face = ctx.createLinearGradient(0, fl.y - h, 0, fl.y);
  face.addColorStop(0, "#e8eefc");
  face.addColorStop(0.5, "#8592b4");
  face.addColorStop(1, "#4a5578");
  ctx.fillStyle = face;
  ctx.fillRect(fl.x, fl.y - h, fr.x - fl.x, h);
  // LED strip
  const n = 18;
  for (let i = 0; i < n; i++) {
    const x = fl.x + 14 + (i / (n - 1)) * (fr.x - fl.x - 28);
    const on = Math.floor(t * 6 + i) % 3 === 0;
    bulb(ctx, x, fl.y - h * 0.45, 2.4, rainbow ? CORE_COLORS[i % 6] : NEON, on || rainbow);
  }
  ctx.restore();
  void PUSH_MAX;
}

/** Soft shadow under a body (drawn in a pass before the bodies). */
export function drawShadow(ctx: Ctx, b: Body) {
  const p = proj(b.x, b.y);
  const r = b.r * p.s;
  ctx.fillStyle = "rgba(0,0,10,0.35)";
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 5 * p.s, r * 1.02, r * 0.64, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One body on the shelf. Coins: a stack of discs; capsules: the orb sprite.
 * `drop` 0..1 raises it (just landed), `glow` lights a capsule whose core is lit.
 */
export function drawBody(ctx: Ctx, sp: Sprites, b: Body, t: number, drop = 0, glow = 0) {
  const p = proj(b.x, b.y);
  const lift = drop * 40 * p.s;
  if (b.kind === "coin") {
    const w = b.r * 2 * p.s * (COIN_PX + 4) / COIN_PX;
    const h = w * (sp.coin.height / sp.coin.width);
    const th = 4.6 * p.s;
    for (let i = 0; i < b.stack; i++) {
      ctx.drawImage(sp.coin, p.x - w / 2, p.y - h * 0.36 - i * th - lift, w, h);
    }
    return;
  }
  const img = sp.cores[b.core];
  const w = b.r * 2 * p.s * ((CORE_PX + 8) / CORE_PX);
  const h = w * (img.height / img.width);
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(t * 4 + b.core);
  ctx.shadowColor = CORE_COLORS[b.core];
  ctx.shadowBlur = 10 + pulse * 10 + glow * 16;
  ctx.drawImage(img, p.x - w / 2, p.y - h + w * 0.34 - lift, w, h);
  ctx.restore();
}

/** The chrome front lip with its chase lights. */
export function drawFrontLip(ctx: Ctx, chase: number, rainbow: boolean) {
  const fl = proj(0, SHELF_D);
  const fr = proj(SHELF_W, SHELF_D);
  ctx.save();
  const g = ctx.createLinearGradient(0, fl.y, 0, fl.y + 22);
  g.addColorStop(0, "#f2f6ff");
  g.addColorStop(0.5, "#7d8aa8");
  g.addColorStop(1, "#2b3350");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(fl.x - 8, fl.y + 2, fr.x - fl.x + 16, 20, 6);
  ctx.fill();
  const n = 20;
  for (let i = 0; i < n; i++) {
    const x = fl.x + 6 + (i / (n - 1)) * (fr.x - fl.x - 12);
    const on = (i + Math.floor(chase)) % 4 < 2;
    bulb(ctx, x, fl.y + 13, 3, rainbow ? CORE_COLORS[i % 6] : on ? PINK : "#6a2a50", on || rainbow);
  }
  // The tray below where returned coins land
  const tray = ctx.createLinearGradient(0, fl.y + 22, 0, 850);
  tray.addColorStop(0, "#05040f");
  tray.addColorStop(1, "#141038");
  ctx.fillStyle = tray;
  ctx.fillRect(fl.x - 8, fl.y + 22, fr.x - fl.x + 16, 850 - fl.y - 22);
  ctx.restore();
}

/** The big round SHOOT button. */
export function drawShootButton(ctx: Ctx, label: string, pressed: boolean, t: number, enabled: boolean) {
  const { x, y, r } = SHOOT;
  ctx.save();
  // Bezel
  const bezel = ctx.createLinearGradient(0, y - r - 10, 0, y + r + 10);
  bezel.addColorStop(0, "#e8eefc");
  bezel.addColorStop(1, "#46516e");
  ctx.fillStyle = bezel;
  ctx.beginPath();
  ctx.arc(x, y, r + 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1030";
  ctx.beginPath();
  ctx.arc(x, y + 4, r + 2, 0, Math.PI * 2);
  ctx.fill();
  const glow = enabled ? 0.6 + 0.4 * Math.sin(t * 5) : 0;
  ctx.shadowColor = "#ff8a2a";
  ctx.shadowBlur = 20 + glow * 24;
  const dy = pressed ? 5 : 0;
  const face = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4 + dy, r * 0.1, x, y + dy, r);
  face.addColorStop(0, enabled ? "#fff1b0" : "#9a9aaa");
  face.addColorStop(0.4, enabled ? "#ffa22a" : "#6a6a7a");
  face.addColorStop(1, enabled ? "#c73a0a" : "#3a3a4a");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(x, y + dy, r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.15, y - r * 0.52 + dy, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, label, x, y + dy + 6, fitSize(ctx, label, 36, r * 1.6), "#ffffff", "center", "#7a1a00");
  ctx.restore();
}

/** Small BETA chip. */
export function betaTag(ctx: Ctx, x: number, y: number, label: string) {
  ctx.save();
  ctx.font = `800 15px ${FONT}`;
  const w = ctx.measureText(label).width + 16;
  ctx.fillStyle = MINT;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 11, w, 22, 11);
  ctx.fill();
  text(ctx, label, x, y + 1, 15, INK, "center", null);
  ctx.restore();
}

/** The coin tray under the controls (seen on tall phones): a little heap that grows with your coins. */
export function drawTray(ctx: Ctx, sp: Sprites, coins: number, view: Rect) {
  const y = 972;
  if (view.y + view.h < y + 30) return;
  const r: Rect = { x: 150, y, w: 240, h: 64 };
  ctx.save();
  ctx.fillStyle = "#05040f";
  ctx.strokeStyle = "rgba(200,220,255,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.clip();
  const n = Math.min(26, Math.ceil(Math.max(0, coins) / 8));
  const rnd = mulberry32(77);
  for (let i = 0; i < n; i++) {
    const row = i < 12 ? 0 : i < 21 ? 1 : 2;
    const x = r.x + 22 + rnd() * (r.w - 44) * (1 - row * 0.25) + row * 30;
    const yy = r.y + r.h - 14 - row * 9 - rnd() * 6;
    ctx.drawImage(sp.coin, x - 15, yy - 10, 30, 30 * (sp.coin.height / sp.coin.width));
  }
  ctx.restore();
}
