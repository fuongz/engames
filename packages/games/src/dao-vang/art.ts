// Drawing for Đào Vàng. The pictures are generated art processed by
// tools/dao-vang-sprites.py into img/*.webp; game.ts loads them and passes
// them in. Until an image has decoded, simple shapes stand in.
import type { Rect } from "@web-games/core";
import { H, type ItemKind, PIVOT, type ShopKind, W } from "./config";
import { type Claw, direction, tipOf } from "./logic";

type Ctx = CanvasRenderingContext2D;
type Img = HTMLImageElement | null;

export const FONT = '"Baloo 2", system-ui, sans-serif';

export const INK = "#3b1e0e";
export const CREAM = "#fff3d6";
export const GOLD = "#ffd23f";
export const SKY = "#20a8fe";
export const DEEP = "#562317";

// ---------------------------------------------------------------- atlases

/** items.webp: 16 square cells, in the order the two generated sheets were read. */
export const CELL = 200;
export const ICON = {
  goldS: 0,
  goldM: 1,
  goldL: 2,
  diamond: 3,
  rockS: 4,
  rockL: 5,
  sack: 6,
  coin: 7,
  mole: 8,
  moleStep: 9,
  moleDiamond: 10,
  dynamite: 11,
  strength: 12,
  clover: 13,
  polish: 14,
  book: 15,
} as const;
export const SHOP_ICON: Record<ShopKind, number> = {
  dynamite: ICON.dynamite,
  strength: ICON.strength,
  clover: ICON.clover,
  polish: ICON.polish,
  book: ICON.book,
};
/** How much bigger than its hit circle each sprite is drawn (art has padding, sparkles, tails). */
const DRAW_SCALE: Record<ItemKind, number> = {
  goldS: 1.25,
  goldM: 1.2,
  goldL: 1.15,
  rockS: 1.2,
  rockL: 1.15,
  diamond: 1.75,
  sack: 1.3,
  mole: 1.6,
  moleDiamond: 1.6,
};

/** miner.webp: three 300×260 cells drawn at 0.58×; the rope leaves the winch at ROPE. */
const MINER = { w: 300, h: 260, scale: 0.58, ropeX: 233, ropeY: 224 };
/** claw.webp: open and closed, 128×128, ring at the top centre. */
const CLAW = { size: 128, draw: 64 };
/** From the rope's end (the claw's ring) to the grabbing tip. */
export const CLAW_REACH = 44;

// ---------------------------------------------------------------- text and UI

export function text(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size: number,
  fill = "#ffffff",
  align: CanvasTextAlign = "center",
  weight = 800,
  stroke: string | null = INK,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.18);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

export function panel(ctx: Ctx, r: Rect, fill = CREAM, radius = 22) {
  ctx.fillStyle = "rgba(40,16,4,0.35)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 5, r.w, r.h, radius);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.stroke();
}

/** A chunky candy button; dims when disabled. */
export function button(
  ctx: Ctx,
  r: Rect,
  label: string,
  colors: [string, string],
  enabled = true,
  size = 26,
) {
  ctx.save();
  if (!enabled) ctx.globalAlpha *= 0.5;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 5, r.w, r.h, r.h / 2.4);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2.4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.roundRect(r.x + 10, r.y + 6, r.w - 20, r.h * 0.28, r.h * 0.14);
  ctx.fill();
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, size, "#ffffff");
  ctx.restore();
}

export const GREEN: [string, string] = ["#7ee04f", "#2f9a2a"];
export const ORANGE: [string, string] = ["#ffb347", "#e8641c"];
export const GREY: [string, string] = ["#b9a99a", "#7d6b5c"];

/** A rounded label pill for the HUD. */
export function pill(ctx: Ctx, r: Rect) {
  ctx.fillStyle = "rgba(59,30,14,0.3)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 3, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.stroke();
}

/** A simple stopwatch glyph (no sprite needed). */
export function clock(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  urgent: boolean,
) {
  ctx.fillStyle = urgent ? "#ff5a4a" : "#ff8a3a";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x - 3, y - r - 6, 6, 6, 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - r + 7);
  ctx.moveTo(x, y);
  ctx.lineTo(x + r - 8, y);
  ctx.stroke();
}

// ---------------------------------------------------------------- pictures

/** The dig site: the picture covers the logical area; the bleed carries on in sky and deep earth. */
export function drawWorld(ctx: Ctx, bg: Img, v: Rect) {
  ctx.fillStyle = SKY;
  ctx.fillRect(v.x, v.y, v.w, H / 2 - v.y);
  ctx.fillStyle = DEEP;
  ctx.fillRect(v.x, H / 2, v.w, v.y + v.h - H / 2);
  if (bg) {
    // Wider screens: stretch the earth sideways rather than show a seam
    ctx.drawImage(bg, Math.min(0, v.x), 0, Math.max(W, v.w), H);
  } else {
    ctx.fillStyle = "#c06a2a";
    ctx.fillRect(v.x, 178, v.w, H - 178);
    ctx.fillStyle = "#7ed321";
    ctx.fillRect(v.x, 170, v.w, 12);
  }
}

/** Cover the visible area with a picture, centred on the logical area. */
export function cover(ctx: Ctx, img: Img, v: Rect, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  if (!img) return;
  const k = Math.max(
    v.w / img.naturalWidth,
    v.h / img.naturalHeight,
    W / img.naturalWidth,
  );
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, W / 2 - w / 2, H / 2 - h / 2, w, h);
}

/** The miner at her winch; frame 0 idle, 1 and 2 cranking. */
export function drawMiner(ctx: Ctx, img: Img, frame: number) {
  const s = MINER.scale;
  const x = PIVOT.x - MINER.ropeX * s;
  const y = PIVOT.y - MINER.ropeY * s;
  if (!img) {
    ctx.fillStyle = "#8a4b22";
    ctx.fillRect(PIVOT.x - 30, PIVOT.y - 40, 60, 40);
    return;
  }
  ctx.drawImage(
    img,
    frame * MINER.w,
    0,
    MINER.w,
    MINER.h,
    x,
    y,
    MINER.w * s,
    MINER.h * s,
  );
}

/** Rope from the winch to the claw, then the claw turned along the rope. */
export function drawClaw(ctx: Ctx, img: Img, claw: Claw, closed: boolean) {
  const d = direction(claw.angle);
  const tip = tipOf(claw);
  const end = { x: tip.x - d.x * CLAW_REACH, y: tip.y - d.y * CLAW_REACH };
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(PIVOT.x, PIVOT.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.strokeStyle = "#e8c98a";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(-claw.angle);
  if (img) {
    ctx.drawImage(
      img,
      closed ? CLAW.size : 0,
      0,
      CLAW.size,
      CLAW.size,
      -CLAW.draw / 2,
      -6,
      CLAW.draw,
      CLAW.draw,
    );
  } else {
    ctx.fillStyle = "#9aa0a8";
    ctx.fillRect(-14, 0, 28, CLAW_REACH);
  }
  ctx.restore();
}

/** One cell of items.webp, centred at x,y and `size` across; `flip` mirrors it. */
export function icon(
  ctx: Ctx,
  img: Img,
  index: number,
  x: number,
  y: number,
  size: number,
  flip = false,
) {
  if (!img) {
    ctx.fillStyle = index === ICON.coin || index <= 2 ? GOLD : "#8a8f99";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(
    img,
    index * CELL,
    0,
    CELL,
    CELL,
    -size / 2,
    -size / 2,
    size,
    size,
  );
  ctx.restore();
}

/** A board object: moles walk (two frames) and face where they go; gold and diamonds glint. */
export function drawItem(
  ctx: Ctx,
  img: Img,
  kind: ItemKind,
  x: number,
  y: number,
  r: number,
  t: number,
  dir = 1,
  walking = true,
) {
  const size = r * 2 * DRAW_SCALE[kind];
  if (kind === "mole" || kind === "moleDiamond") {
    const step = walking ? Math.floor(t * 6) % 2 : 0;
    const index =
      kind === "moleDiamond"
        ? ICON.moleDiamond
        : step
          ? ICON.moleStep
          : ICON.mole;
    const bob =
      kind === "moleDiamond" && walking ? Math.abs(Math.sin(t * 9)) * 2 : 0;
    icon(ctx, img, index, x, y - bob, size, dir < 0);
    return;
  }
  icon(ctx, img, ICON[kind], x, y, size);
  if (kind === "diamond" || kind === "goldL") glint(ctx, x, y, r, t + x * 0.01);
}

function glint(ctx: Ctx, x: number, y: number, r: number, t: number) {
  const k = (Math.sin(t * 2.2) + 1) / 2;
  if (k < 0.75) return;
  const a = (k - 0.75) * 4;
  const s = r * 0.45 * a;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x + r * 0.35, y - r * 0.35);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(0, 0, s, 0);
  ctx.quadraticCurveTo(0, 0, 0, s);
  ctx.quadraticCurveTo(0, 0, -s, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s);
  ctx.fill();
  ctx.restore();
}

/** A burst ring for dynamite. */
export function blast(ctx: Ctx, x: number, y: number, k: number) {
  ctx.save();
  ctx.globalAlpha = 1 - k;
  const r = 20 + k * 90;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "#fff7c0");
  g.addColorStop(0.4, "#ffb020");
  g.addColorStop(1, "rgba(255,80,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
