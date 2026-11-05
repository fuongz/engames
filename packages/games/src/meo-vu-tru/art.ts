// Drawing for Mèo Vũ Trụ. The pictures are generated art processed by
// tools/meo-vu-tru-sprites.py into img/*.webp; game.ts loads them and passes
// them in. Until an image has decoded, simple shapes stand in. Shots, bullets,
// rocks, sparks and the HUD are drawn here procedurally.
import type { Rect } from "@web-games/core";
import { type EnemyKind, type Family, H, type PickupKind, W } from "./config";
import type { Bullet, Enemy, Pickup, Shot } from "./logic";

type Ctx = CanvasRenderingContext2D;
type Img = HTMLImageElement | null;

export const FONT = '"Baloo 2", system-ui, sans-serif';
export const INK = "#1b1240";
export const CREAM = "#fff6e0";
export const GOLD = "#ffd23f";
export const SPACE = "#1a1060";

export const FAMILY_COLOR: Record<Family, string> = {
  spread: "#ff5a3a",
  laser: "#3ac8ff",
  bolt: "#7cff5a",
};

// ---------------------------------------------------------------- atlases

/** sprites.webp: 160 px cells (see tools/meo-vu-tru-sprites.py). */
export const CELL = 160;
export const SPRITE = {
  ship: 0,
  grunt: 1,
  jet: 2,
  gunner: 3,
  saucer: 4,
  kitten: 5,
  fish: 6,
  bone: 7,
  orb: 8,
  ufo: 9,
  canSpread: 13,
  canLaser: 14,
  canBolt: 15,
  missile: 16,
  heart: 17,
} as const;
const BOSS_CELL = 420;

/** Drawn size (px across) of each enemy kind. */
const ENEMY_SIZE: Record<EnemyKind, number> = {
  grunt: 70,
  jet: 72,
  gunner: 72,
  saucer: 80,
  kitten: 58,
  ufo: 66,
  rock: 0,
  mini: 190,
  boss1: 300,
  boss2: 290,
  boss3: 300,
};

export function sprite(
  ctx: Ctx,
  img: Img,
  index: number,
  x: number,
  y: number,
  size: number,
  flip = false,
) {
  if (!img) {
    ctx.fillStyle = "#c9b8ff";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.38, 0, Math.PI * 2);
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
    ctx.lineWidth = Math.max(3, size * 0.2);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

export function panel(
  ctx: Ctx,
  r: Rect,
  fill = "rgba(36,22,96,0.92)",
  radius = 26,
) {
  ctx.fillStyle = "rgba(8,4,30,0.45)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 6, r.w, r.h, radius);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.strokeStyle = "#8f7bff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.stroke();
}

export const ORANGE: [string, string] = ["#ffb347", "#e8641c"];

export function button(
  ctx: Ctx,
  r: Rect,
  label: string,
  colors: [string, string],
  size = 28,
) {
  ctx.save();
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

// ---------------------------------------------------------------- world

interface Star {
  x: number;
  y: number;
  z: number;
}
const STARS: Star[] = Array.from({ length: 70 }, (_, i) => ({
  // A fixed scatter (no RNG needed: decoration only, same every run)
  x: (i * 197.3) % W,
  y: (i * 331.7) % (H * 1.4),
  z: 0.3 + ((i * 37) % 10) / 10,
}));

/** Scrolling space: the painted backdrop tiled (every other copy mirrored), plus fast star streaks. */
export function drawSpace(ctx: Ctx, bg: Img, v: Rect, t: number) {
  ctx.fillStyle = SPACE;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  if (bg) {
    const w = Math.max(W, v.w);
    const h = (bg.naturalHeight / bg.naturalWidth) * w;
    const x = W / 2 - w / 2;
    // Tile k sits at off + k·h; odd tiles are mirrored so the seams always match
    const off = (t * 22) % (h * 2);
    const last = Math.ceil((v.y + v.h - off) / h);
    for (let k = Math.floor((v.y - off) / h); k <= last; k++) {
      const y = off + k * h;
      ctx.save();
      if (((k % 2) + 2) % 2) {
        ctx.translate(0, y + h);
        ctx.scale(1, -1);
        ctx.drawImage(bg, x, 0, w, h);
      } else ctx.drawImage(bg, x, y, w, h);
      ctx.restore();
    }
  }
  const span = H * 1.4;
  for (const s of STARS) {
    const y = ((s.y + t * 120 * s.z) % span) + v.y - 40;
    if (y > v.y + v.h) continue;
    ctx.globalAlpha = 0.35 + 0.5 * s.z;
    ctx.fillStyle = "#e8e4ff";
    ctx.fillRect(s.x + Math.min(v.x, 0), y, 2, 2 + s.z * 7);
  }
  ctx.globalAlpha = 1;
}

/** The player's rocket: banks with sideways speed; a flickering flame under it. */
export function drawShip(
  ctx: Ctx,
  img: Img,
  x: number,
  y: number,
  vx: number,
  t: number,
  shield: number,
) {
  const flame = 18 + Math.sin(t * 40) * 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.max(-0.22, Math.min(0.22, vx / 2600)));
  const g = ctx.createLinearGradient(0, 30, 0, 30 + flame + 14);
  g.addColorStop(0, "#fff7c0");
  g.addColorStop(0.4, "#ffb020");
  g.addColorStop(1, "rgba(255,80,20,0)");
  ctx.fillStyle = g;
  for (const fx of [-13, 13]) {
    ctx.beginPath();
    ctx.ellipse(fx, 34 + flame / 2, 7, flame / 2 + 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  sprite(ctx, img, SPRITE.ship, 0, 0, 92);
  ctx.restore();
  if (shield > 0 && (shield > 0.8 || Math.floor(t * 12) % 2 === 0)) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    const r = 52 + Math.sin(t * 6) * 2;
    const sg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
    sg.addColorStop(0, "rgba(120,220,255,0)");
    sg.addColorStop(1, "rgba(150,230,255,0.85)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Index into sprites.webp for an ordinary enemy. */
function enemyIndex(e: Enemy) {
  if (e.kind === "ufo") return SPRITE.ufo + (e.color % 4);
  if (e.kind === "mini") return SPRITE.saucer;
  return SPRITE[e.kind as "grunt" | "jet" | "gunner" | "saucer" | "kitten"];
}

export function drawEnemy(
  ctx: Ctx,
  sprites: Img,
  bosses: Img,
  e: Enemy,
  t: number,
) {
  if (e.kind === "rock") return drawRock(ctx, e);
  const size = ENEMY_SIZE[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === "boss1" || e.kind === "boss2" || e.kind === "boss3") {
    const i = Number(e.kind.slice(4)) - 1;
    ctx.rotate(Math.sin(t * 1.3) * 0.025);
    if (bosses)
      ctx.drawImage(
        bosses,
        i * BOSS_CELL,
        0,
        BOSS_CELL,
        BOSS_CELL,
        -size / 2,
        -size / 2,
        size,
        size,
      );
    else sprite(ctx, null, 0, 0, 0, size);
    if (e.flash > 0 && bosses) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35;
      ctx.drawImage(
        bosses,
        i * BOSS_CELL,
        0,
        BOSS_CELL,
        BOSS_CELL,
        -size / 2,
        -size / 2,
        size,
        size,
      );
    }
    ctx.restore();
    return;
  }
  // Bob and wobble so still sprites feel alive
  const ph = e.id * 1.7;
  ctx.translate(0, Math.sin(t * 4 + ph) * 3);
  let rot = Math.sin(t * 3 + ph) * 0.08;
  if (e.mode === "dive")
    rot += 0.3 * Math.sign(Math.cos(e.p * Math.PI * 2)) * e.side;
  if (e.mode === "kami" && e.p > 0) {
    // Wind-up: shake and glow red so the dash is telegraphed
    ctx.translate(Math.sin(t * 60) * 2.5, 0);
    ctx.fillStyle = `rgba(255,70,70,${0.35 + 0.25 * Math.sin(t * 20)})`;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.mode === "kami" && e.p <= 0) rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
  ctx.rotate(rot);
  const flip = (e.kind === "jet" || e.kind === "grunt") && e.vx < -0.5;
  sprite(ctx, sprites, enemyIndex(e), 0, 0, size, flip);
  if (e.flash > 0 && sprites) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    sprite(ctx, sprites, enemyIndex(e), 0, 0, size, flip);
  }
  ctx.restore();
}

const ROCK_COLORS = [
  ["#8a7f9e", "#5e5474"],
  ["#9e8a72", "#6e5a46"],
  ["#7f92a6", "#55667a"],
];

/** Space junk: a lumpy cratered rock (the shape is fixed per rock by its id). */
function drawRock(ctx: Ctx, e: Enemy) {
  const [light, dark] = ROCK_COLORS[e.color % 3];
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.p);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = e.r * (0.82 + 0.18 * Math.sin(e.id * 3.1 + i * 2.3));
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = e.flash > 0 ? "#ffffff" : light;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark;
  for (const [cx, cy, cr] of [
    [-0.3, -0.2, 0.22],
    [0.3, 0.25, 0.16],
    [0.1, -0.45, 0.1],
  ]) {
    ctx.beginPath();
    ctx.arc(cx * e.r, cy * e.r, cr * e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawShot(ctx: Ctx, s: Shot) {
  if (s.family === "spread") {
    const a = Math.atan2(s.vy, s.vx);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(a);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    g.addColorStop(0, "#fffbe0");
    g.addColorStop(0.45, "#ffb020");
    g.addColorStop(1, "rgba(255,80,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(-4, 0, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(60,200,255,0.45)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x, s.y + 46);
  ctx.stroke();
  ctx.strokeStyle = "#e8fbff";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/** Enemy fire: bright, outlined and unlike anything friendly, so it reads on a phone. */
export function drawBullet(ctx: Ctx, b: Bullet, t: number) {
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.kind === "dart") {
    // A little fish-bone dart, pointing where it flies
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = "rgba(255,60,120,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(10, 0);
    for (const x of [-5, 1]) {
      ctx.moveTo(x, -5);
      ctx.lineTo(x + 3, 0);
      ctx.lineTo(x, 5);
    }
    ctx.stroke();
    ctx.strokeStyle = "#fff4e8";
    ctx.lineWidth = 2.4;
    ctx.stroke();
  } else if (b.kind === "yarn") {
    ctx.rotate(t * 3);
    ctx.fillStyle = "#ff5aa8";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#ffd0e8";
    ctx.lineWidth = 2;
    for (const k of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        b.r * 0.8,
        b.r * (0.3 + Math.abs(k) * 0.4),
        k * 2,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else {
    // Hairball: a fuzzy amber puff with a hot pink rim
    ctx.fillStyle = "rgba(255,60,130,0.6)";
    ctx.beginPath();
    ctx.arc(0, 0, b.r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb85a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + t * 4;
      const r = b.r * (i % 2 ? 0.85 : 1.08);
      if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff0d0";
    ctx.beginPath();
    ctx.arc(-b.r * 0.3, -b.r * 0.3, b.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const PICKUP_SIZE: Record<PickupKind, number> = {
  fish: 46,
  bone: 40,
  can: 58,
  orb: 48,
  heart: 48,
};

export function canIndex(f: Family) {
  return f === "spread"
    ? SPRITE.canSpread
    : f === "laser"
      ? SPRITE.canLaser
      : SPRITE.canBolt;
}

export function drawPickup(ctx: Ctx, img: Img, p: Pickup, t: number) {
  const size = PICKUP_SIZE[p.kind];
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.kind === "can" || p.kind === "orb") {
    const c = p.kind === "can" ? FAMILY_COLOR[p.family] : "#7ee8ff";
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin(t * 8);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, size * 0.75);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate(Math.sin(t * 3 + p.x) * 0.25);
  } else ctx.rotate(t * p.spin * 0.4);
  const index =
    p.kind === "can"
      ? canIndex(p.family)
      : p.kind === "fish"
        ? SPRITE.fish
        : p.kind === "bone"
          ? SPRITE.bone
          : p.kind === "orb"
            ? SPRITE.orb
            : SPRITE.heart;
  sprite(ctx, img, index, 0, 0, size);
  ctx.restore();
}

/** One lightning chain, re-jagged every frame. */
export function drawZap(
  ctx: Ctx,
  pts: { x: number; y: number }[],
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  for (const [w, c] of [
    [9, "rgba(120,255,90,0.35)"],
    [3, "#f4ffd8"],
  ] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (i === 0) ctx.moveTo(a.x, a.y);
      const n = Math.max(3, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 26));
      for (let k = 1; k <= n; k++) {
        const j = k === n ? 0 : (Math.random() - 0.5) * 22;
        ctx.lineTo(
          a.x + ((b.x - a.x) * k) / n + j,
          a.y + ((b.y - a.y) * k) / n + j * 0.4,
        );
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** An expanding fireball ring, k = 0..1. */
export function blast(ctx: Ctx, x: number, y: number, k: number, size = 1) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - k);
  const r = (16 + k * 70) * size;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "#fff7c0");
  g.addColorStop(0.4, "#ffb020");
  g.addColorStop(1, "rgba(255,60,120,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A heart for the lives row (procedural so it never waits on the atlas). */
export function heart(
  ctx: Ctx,
  x: number,
  y: number,
  s: number,
  full: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 32, s / 32);
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.bezierCurveTo(-18, 0, -16, -16, -7, -15);
  ctx.bezierCurveTo(-3, -15, 0, -12, 0, -9);
  ctx.bezierCurveTo(0, -12, 3, -15, 7, -15);
  ctx.bezierCurveTo(16, -16, 18, 0, 0, 12);
  ctx.closePath();
  ctx.fillStyle = full ? "#ff3b55" : "rgba(255,255,255,0.15)";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  if (full) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(-7, -9, 3, 2, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
