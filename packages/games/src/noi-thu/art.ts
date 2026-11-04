import type { Rect } from "@web-games/core";
import { COLS, type Gravity, ROWS, W } from "./config";
import type { Cell } from "./logic";

// Layout and drawing for Nối Thú: a teal table, pink pixel tiles cut from one
// atlas (img/tiles.webp, made by tools/noi-thu-sprites.py), a lime link line,
// a rainbow timer and three round booster buttons (art-src samples).

type Ctx = CanvasRenderingContext2D;
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

// ---------------------------------------------------------------- layout

export const TILE_W = 60;
export const TILE_H = 64;
export const BOARD_X = (W - COLS * TILE_W) / 2;
export const BOARD_Y = 96;
/** How far outside the tiles a path through the outer ring is drawn. */
export const RING = 16;
export const BOARD_BOTTOM = BOARD_Y + ROWS * TILE_H;
export const BUTTON_Y = 918;
export const BUTTON_R = 34;

/** Centre of a padded-grid cell (ring cells sit RING outside the tiles). */
export function cellCenter(c: Cell) {
  const x =
    c.x === 0 ? BOARD_X - RING : c.x === COLS + 1 ? BOARD_X + COLS * TILE_W + RING : BOARD_X + (c.x - 0.5) * TILE_W;
  const y =
    c.y === 0 ? BOARD_Y - RING : c.y === ROWS + 1 ? BOARD_BOTTOM + RING : BOARD_Y + (c.y - 0.5) * TILE_H;
  return { x, y };
}

/** The tile under a point, or null. */
export function cellAt(p: { x: number; y: number }): Cell | null {
  const x = Math.floor((p.x - BOARD_X) / TILE_W) + 1;
  const y = Math.floor((p.y - BOARD_Y) / TILE_H) + 1;
  return x >= 1 && x <= COLS && y >= 1 && y <= ROWS ? { x, y } : null;
}

export type Booster = "hint" | "shuffle" | "freeze";
export const BOOSTERS: Booster[] = ["hint", "shuffle", "freeze"];
export function buttonRect(b: Booster): Rect {
  const x = W / 2 + (BOOSTERS.indexOf(b) - 1) * 112;
  return { x: x - BUTTON_R, y: BUTTON_Y - BUTTON_R, w: BUTTON_R * 2, h: BUTTON_R * 2 };
}

// ---------------------------------------------------------------- atlas

/** Atlas cell size in px; kinds run left to right, 6 per row (sheet a, b, c). */
export const ATLAS = { w: 96, h: 104, cols: 6 };

/** Each kind's dominant colour, for the pop particles. Same order as the atlas. */
export const KIND_COLORS = [
  // sheet a: red panda, axolotl, capybara, hedgehog, otter, leaf bunny,
  // fox, penguin, frog, owl, hamster, turtle
  "#d8582a", "#f29ac0", "#b8743a", "#8a5a34", "#6e4630", "#7cc858",
  "#f07a2a", "#2e3e78", "#6cc83c", "#8a5ac8", "#f0a83a", "#3aa078",
  // sheet b: panda, koala, lion cub, elephant, giraffe, sheep,
  // black kitten, tiger cub, monkey, dinosaur, unicorn, bat
  "#ffffff", "#9a9aa8", "#f2c43a", "#8ab8f0", "#f2d050", "#f4ecd8",
  "#2a2a32", "#f08a2a", "#8a5634", "#5ac8a8", "#f0b8e8", "#5a3a7a",
  // sheet c: duckling, flamingo, toucan, peacock, whale, octopus,
  // crab, jellyfish, bee, snail, butterfly, seal
  "#f8dc3a", "#e83a7a", "#f09a2a", "#2a5ad8", "#2a5ab8", "#9a5ac8",
  "#e0362a", "#5ad8e0", "#f2c43a", "#a8e040", "#5ad0e8", "#b8bcc8",
];

/** One tile at (x, y) top-left, w × h; a plain pink tile while the atlas loads. */
export function drawTile(ctx: Ctx, atlas: HTMLImageElement | null, kind: number, x: number, y: number, w = TILE_W, h = TILE_H) {
  if (atlas) {
    const sx = (kind % ATLAS.cols) * ATLAS.w;
    const sy = Math.floor(kind / ATLAS.cols) * ATLAS.h;
    ctx.drawImage(atlas, sx, sy, ATLAS.w, ATLAS.h, x, y, w, h);
    return;
  }
  ctx.fillStyle = "#c86478";
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 2, w - 2, h - 2, 6);
  ctx.fill();
  ctx.fillStyle = "#f6b4bc";
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 3, h - 4, 6);
  ctx.fill();
  ctx.fillStyle = KIND_COLORS[kind] ?? "#fff";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w * 0.24, 0, Math.PI * 2);
  ctx.fill();
}

/** Glowing frame around a tile: yellow when picked, cyan for a hint. */
export function tileGlow(ctx: Ctx, x: number, y: number, color: string, pulse = 1) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 * pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, TILE_W - 3, TILE_H - 3, 7);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- table

const TEAL = "#17877c";

/** Teal table with a faint pixel check, over the whole visible area. */
export function drawTable(ctx: Ctx, view: Rect) {
  ctx.fillStyle = TEAL;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  const s = 24;
  for (let y = Math.floor(view.y / s) * s; y < view.y + view.h; y += s)
    for (let x = Math.floor(view.x / s) * s; x < view.x + view.w; x += s)
      if ((x / s + y / s) % 2 === 0) ctx.fillRect(x, y, s, s);
  const g = ctx.createRadialGradient(W / 2, 480, 200, W / 2, 480, 760);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,30,28,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

// ---------------------------------------------------------------- text

export function text(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size: number,
  fill = "#fff",
  align: CanvasTextAlign = "center",
  weight = 800,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.min(6, Math.max(2.5, size * 0.16));
  ctx.strokeStyle = "rgba(14,24,30,0.9)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** A dark pill behind a line of text, for toasts over the board. */
export function pill(ctx: Ctx, str: string, x: number, y: number, size: number, color: string) {
  ctx.font = `700 ${size}px ${FONT}`;
  const w = Math.min(W - 24, ctx.measureText(str).width + 32);
  ctx.fillStyle = "rgba(10,28,32,0.86)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size, w, size * 2, size);
  ctx.fill();
  text(ctx, str, x, y + 1, size, color, "center", 700);
}

// ---------------------------------------------------------------- link

/** The lime connecting line through the path's corner points. */
export function drawLink(ctx: Ctx, path: Cell[], alpha: number) {
  if (path.length < 2) return;
  const pts = path.map(cellCenter);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "miter";
  ctx.lineCap = "square";
  const stroke = (width: number, color: string, blur = 0) => {
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [i, p] of pts.entries()) if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    ctx.stroke();
  };
  stroke(9, "#0c3a10");
  stroke(5, "#8cff3a", 14);
  stroke(2, "#eaffc8");
  ctx.restore();
}

// ---------------------------------------------------------------- HUD

/** The cream top panel (sample: score left, rainbow timer right). */
export function drawPanel(ctx: Ctx, r: Rect) {
  ctx.fillStyle = "#0e3c38";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 4, r.w, r.h, 18);
  ctx.fill();
  ctx.fillStyle = "#fbf3df";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1c2a30";
  ctx.stroke();
}

/** Rainbow timer bar draining right to left; icy when frozen, pulsing when low. */
export function drawTimer(ctx: Ctx, r: Rect, frac: number, frozen: boolean, t: number) {
  const k = Math.max(0, Math.min(1, frac));
  ctx.save();
  ctx.fillStyle = "#c9c4bc";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.clip();
  if (k > 0) {
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    for (const [i, c] of ["#ff3b30", "#ff9500", "#ffe620", "#4cd964", "#2ab8ff", "#5856d6", "#c040e0"].entries())
      g.addColorStop(i / 6, c);
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w * k, r.h);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(r.x, r.y + 2, r.w * k, r.h * 0.28);
    if (frozen) {
      ctx.fillStyle = "rgba(200,240,255,0.55)";
      ctx.fillRect(r.x, r.y, r.w * k, r.h);
    } else if (k < 0.15) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.25 * Math.sin(t * 12)})`;
      ctx.fillRect(r.x, r.y, r.w * k, r.h);
    }
  }
  ctx.restore();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#1c2a30";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.stroke();
}

/** A small arrow glyph for the level's gravity. */
export function gravityIcon(ctx: Ctx, mode: Gravity, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = "round";
  const arrow = (angle: number, ox = 0, oy = 0, len = s * 0.42) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(len * 0.4, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(len * 0.25, -len * 0.55);
    ctx.lineTo(len * 0.25, len * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  const d = s * 0.26;
  const short = s * 0.22;
  switch (mode) {
    case "none":
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "down":
      arrow(Math.PI / 2);
      break;
    case "up":
      arrow(-Math.PI / 2);
      break;
    case "left":
      arrow(Math.PI);
      break;
    case "right":
      arrow(0);
      break;
    case "split-v-out":
      arrow(-Math.PI / 2, 0, -d, short);
      arrow(Math.PI / 2, 0, d, short);
      break;
    case "split-v-in":
      arrow(Math.PI / 2, 0, -d, short);
      arrow(-Math.PI / 2, 0, d, short);
      break;
    case "split-h-out":
      arrow(Math.PI, -d, 0, short);
      arrow(0, d, 0, short);
      break;
    case "split-h-in":
      arrow(0, -d, 0, short);
      arrow(Math.PI, d, 0, short);
      break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- buttons

const BUTTON_COLORS: Record<Booster, [string, string]> = {
  hint: ["#ffd84a", "#f0a018"],
  shuffle: ["#a07af0", "#6a46c8"],
  freeze: ["#5ac8ff", "#1a7ad8"],
};

/** Round booster button with its glyph and a count badge (sample: bulb, shuffle, frozen clock). */
export function drawButton(ctx: Ctx, kind: Booster, count: number, enabled: boolean, press: number) {
  const r = buttonRect(kind);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + press * 3;
  const [top, bottom] = enabled ? BUTTON_COLORS[kind] : ["#9aa2a6", "#6c7478"];
  ctx.save();
  ctx.fillStyle = "#0c2a2a";
  ctx.beginPath();
  ctx.arc(cx, cy + 5 - press * 3, BUTTON_R, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, cy - BUTTON_R, 0, cy + BUTTON_R);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, BUTTON_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1c2a30";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy - BUTTON_R * 0.5, BUTTON_R * 0.55, BUTTON_R * 0.22, -0.2, 0, Math.PI * 2);
  ctx.fill();
  glyph(ctx, kind, cx, cy, BUTTON_R * 1.1);
  // Count badge on the top-right
  const bx = cx + BUTTON_R * 0.72;
  const by = cy - BUTTON_R * 0.72;
  ctx.fillStyle = enabled ? "#e8433a" : "#4a4e52";
  ctx.beginPath();
  ctx.arc(bx, by, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#1c2a30";
  ctx.stroke();
  ctx.font = `800 16px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(String(count), bx, by + 1);
  ctx.restore();
}

function glyph(ctx: Ctx, kind: Booster, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1c2a30";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = s * 0.07;
  if (kind === "hint") {
    // Light bulb with rays
    ctx.beginPath();
    ctx.arc(0, -s * 0.08, s * 0.22, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(s * 0.1, s * 0.18);
    ctx.lineTo(-s * 0.1, s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4a5054";
    ctx.fillRect(-s * 0.1, s * 0.2, s * 0.2, s * 0.1);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.05;
    for (const a of [-2.4, -1.9, -1.57, -1.25, -0.75]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.3, -s * 0.08 + Math.sin(a) * s * 0.3);
      ctx.lineTo(Math.cos(a) * s * 0.38, -s * 0.08 + Math.sin(a) * s * 0.38);
      ctx.stroke();
    }
  } else if (kind === "shuffle") {
    // Two crossing arrows
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.08;
    const w = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(-w, -s * 0.14);
    ctx.bezierCurveTo(0, -s * 0.14, 0, s * 0.14, w * 0.7, s * 0.14);
    ctx.moveTo(-w, s * 0.14);
    ctx.bezierCurveTo(0, s * 0.14, 0, -s * 0.14, w * 0.7, -s * 0.14);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const dy of [-s * 0.14, s * 0.14]) {
      ctx.beginPath();
      ctx.moveTo(w + s * 0.06, dy);
      ctx.lineTo(w * 0.6, dy - s * 0.1);
      ctx.lineTo(w * 0.6, dy + s * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Snowflake around a clock face
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = s * 0.05;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2);
      ctx.lineTo(Math.cos(a) * s * 0.38, Math.sin(a) * s * 0.38);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1c2a30";
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.12);
    ctx.lineTo(0, 0);
    ctx.lineTo(s * 0.09, s * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

/** A rounded call-to-action button (win / game-over screens). */
export function bigButton(ctx: Ctx, r: Rect, label: string) {
  ctx.fillStyle = "#3a2a06";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 5, r.w, r.h, 18);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, "#ffe25a");
  g.addColorStop(1, "#f4b010");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2a1e04";
  ctx.stroke();
  ctx.font = `800 26px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#2a1e04";
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
}

export const CONFETTI = ["#ffd43a", "#ff6a8a", "#5ac8ff", "#8cff3a", "#a07af0", "#ff9a3a"];
