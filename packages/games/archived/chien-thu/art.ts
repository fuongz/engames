import {
  CENTER,
  FIELD_R,
  H,
  SLOT_R,
  SLOT_ROWS,
  SPECIES,
  TRACK_OUTER,
  W,
  critterSize,
  speciesFor,
  type EnemyKind,
  type Species,
} from "./config";
import { mulberry32 } from "@web-games/core";
import { SLOTS } from "./logic";

// Everything is drawn procedurally in the thick-outline cartoon style of the
// reference ad, so the game ships with zero image assets.

type Ctx = CanvasRenderingContext2D;

export const OUTLINE = "#2a1f1a";
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = "#fff", stroke = OUTLINE, align: CanvasTextAlign = "center") {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.22);
  ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke: string | null = OUTLINE, lw = 2.5) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function poly(ctx: Ctx, pts: number[], fill: string, stroke: string | null = OUTLINE, lw = 2.5) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke: string | null = OUTLINE, lw = 3) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- critters

export interface CritterLook {
  t: number;
  scale?: number;
  /** All-black shape for the evolution reveal. */
  silhouette?: boolean;
  glow?: boolean;
}

export function drawCritter(ctx: Ctx, level: number, x: number, y: number, look: CritterLook) {
  const sp = speciesFor(level);
  const tier = SPECIES.indexOf(sp);
  const s = critterSize(level) * (look.scale ?? 1);
  const black = look.silhouette;
  const c = (color: string) => (black ? "#0a0a0a" : color);
  const line = black ? "#0a0a0a" : OUTLINE;
  const breathe = 1 + Math.sin(look.t * 4 + x) * 0.03;

  if (!black) ellipse(ctx, x, y + s * 0.78, s * 0.95, s * 0.3, "rgba(0,0,0,0.22)", null);
  if (look.glow && !black) {
    ctx.save();
    ctx.shadowColor = "#e15bff";
    ctx.shadowBlur = 14;
    ellipse(ctx, x, y + s * 0.72, s * 1.05, s * 0.34, "rgba(225,91,255,0.35)", "rgba(240,140,255,0.9)", 2);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / breathe, breathe);

  if (tier === 3) drawWings(ctx, s, c, line, look.t);
  if (tier !== 2) drawEars(ctx, s, sp, c, line);
  if (tier === 1 || tier === 3) drawCrest(ctx, s, sp, c, line);

  // Body
  ellipse(ctx, 0, 0, s, s * 0.86, c(sp.body), line);
  ellipse(ctx, 0, s * 0.32, s * 0.58, s * 0.42, c(sp.belly), null);
  if (!black) {
    ellipse(ctx, -s * 0.45, -s * 0.45, s * 0.22, s * 0.12, "rgba(255,255,255,0.45)", null);
    // Spots
    ellipse(ctx, s * 0.62, s * 0.12, s * 0.12, s * 0.1, sp.bodyDark, null);
    ellipse(ctx, -s * 0.7, s * 0.25, s * 0.09, s * 0.08, sp.bodyDark, null);
  }

  if (tier === 2) {
    // Frog eyes sit on bumps above the head
    ellipse(ctx, -s * 0.42, -s * 0.62, s * 0.34, s * 0.3, c(sp.body), line);
    ellipse(ctx, s * 0.42, -s * 0.62, s * 0.34, s * 0.3, c(sp.body), line);
    drawEyes(ctx, s, -s * 0.62, black);
    drawEggShell(ctx, s, c, line);
  } else {
    drawEyes(ctx, s, -s * 0.12, black);
  }

  if (!black) {
    // Blush + mouth
    ellipse(ctx, -s * 0.55, s * 0.12, s * 0.13, s * 0.08, "rgba(255,110,150,0.6)", null);
    ellipse(ctx, s * 0.55, s * 0.12, s * 0.13, s * 0.08, "rgba(255,110,150,0.6)", null);
    ctx.beginPath();
    const my = tier === 2 ? -s * 0.2 : s * 0.15;
    ctx.moveTo(-s * 0.14, my);
    ctx.quadraticCurveTo(-s * 0.07, my + s * 0.1, 0, my);
    ctx.quadraticCurveTo(s * 0.07, my + s * 0.1, s * 0.14, my);
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }

  if (tier === 3) drawCrown(ctx, s, c, line);
  ctx.restore();
}

function drawEars(ctx: Ctx, s: number, sp: Species, c: (v: string) => string, line: string) {
  for (const side of [-1, 1]) {
    poly(ctx, [side * s * 0.8, -s * 0.25, side * s * 0.95, -s * 1.25, side * s * 0.15, -s * 0.72], c(sp.accent), line);
    poly(ctx, [side * s * 0.72, -s * 0.42, side * s * 0.84, -s * 1.0, side * s * 0.38, -s * 0.7], c("#ffc0d6"), null);
  }
}

function drawCrest(ctx: Ctx, s: number, sp: Species, c: (v: string) => string, line: string) {
  // Dragon-fruit petals: pink scales with green tips fanning over the head
  for (let i = -2; i <= 2; i++) {
    const a = -Math.PI / 2 + i * 0.42;
    const bx = Math.cos(a) * s * 0.55;
    const by = Math.sin(a) * s * 0.55;
    const tx = Math.cos(a) * s * 1.35;
    const ty = Math.sin(a) * s * 1.35;
    const nx = -Math.sin(a) * s * 0.24;
    const ny = Math.cos(a) * s * 0.24;
    poly(ctx, [bx - nx, by - ny, tx, ty, bx + nx, by + ny], c(sp.accent), line);
    poly(ctx, [tx, ty, bx + (tx - bx) * 0.65 - nx * 0.4, by + (ty - by) * 0.65 - ny * 0.4, bx + (tx - bx) * 0.65 + nx * 0.4, by + (ty - by) * 0.65 + ny * 0.4], c("#9be35a"), null);
  }
}

function drawEyes(ctx: Ctx, s: number, y: number, black?: boolean) {
  if (black) return;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * s * 0.36, y, s * 0.27, s * 0.31, "#fff", OUTLINE, 2);
    ellipse(ctx, side * s * 0.36 + s * 0.04, y + s * 0.04, s * 0.15, s * 0.18, "#1d1410", null);
    ellipse(ctx, side * s * 0.36 + s * 0.09, y - s * 0.05, s * 0.06, s * 0.06, "#fff", null);
  }
}

function drawEggShell(ctx: Ctx, s: number, c: (v: string) => string, line: string) {
  const pts: number[] = [-s * 1.08, s * 0.25];
  const teeth = 7;
  for (let i = 0; i <= teeth; i++) {
    const px = -s * 1.08 + (i / teeth) * s * 2.16;
    pts.push(px, s * (i % 2 ? 0.08 : 0.32));
  }
  pts.push(s * 0.95, s * 0.75, 0, s * 1.0, -s * 0.95, s * 0.75);
  poly(ctx, pts, c("#f6e3b8"), line);
  if (line !== "#0a0a0a") {
    ellipse(ctx, -s * 0.5, s * 0.6, s * 0.14, s * 0.1, "#e4c88e", null);
    ellipse(ctx, s * 0.45, s * 0.5, s * 0.1, s * 0.08, "#e4c88e", null);
  }
}

function drawWings(ctx: Ctx, s: number, c: (v: string) => string, line: string, t: number) {
  const flap = Math.sin(t * 6) * 0.15;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * flap);
    poly(ctx, [side * s * 0.6, -s * 0.2, side * s * 1.7, -s * 0.9, side * s * 1.5, -s * 0.2, side * s * 1.75, s * 0.2, side * s * 0.7, s * 0.3], c("#ffe28a"), line);
    ctx.restore();
  }
}

function drawCrown(ctx: Ctx, s: number, c: (v: string) => string, line: string) {
  poly(ctx, [-s * 0.45, -s * 0.8, -s * 0.5, -s * 1.3, -s * 0.22, -s * 1.05, 0, -s * 1.42, s * 0.22, -s * 1.05, s * 0.5, -s * 1.3, s * 0.45, -s * 0.8], c("#ffd23f"), line);
  if (line !== "#0a0a0a") ellipse(ctx, 0, -s * 1.0, s * 0.09, s * 0.09, "#ff4d6d", null);
}

// ---------------------------------------------------------------- blades

export function drawBlade(ctx: Ctx, kind: Species["blade"], x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
  if (kind === "leek") {
    // Spring onion: white stalk, green leaves fanning out
    roundRect(ctx, 0, -4, len * 0.5, 8, 4, "#f7f9ef", OUTLINE, 2);
    poly(ctx, [len * 0.45, -4, len, -9, len * 0.82, 0, len, 9, len * 0.45, 4], "#5fd24a", OUTLINE, 2);
    poly(ctx, [len * 0.5, -1.5, len * 0.92, -5, len * 0.92, 3, len * 0.5, 1.5], "#9cf06c", null);
  } else {
    const blade = kind === "gold" ? "#ffd23f" : "#45e08c";
    const shine = kind === "gold" ? "#fff2a8" : "#b8ffd6";
    roundRect(ctx, 0, -3.5, len * 0.22, 7, 3, "#c58a2e", OUTLINE, 2);
    poly(ctx, [len * 0.22, -9, len * 0.27, -9, len * 0.27, 9, len * 0.22, 9], "#ffcf3a", OUTLINE, 2);
    poly(ctx, [len * 0.27, -7, len * 0.85, -6, len, 0, len * 0.85, 6, len * 0.27, 7], blade, OUTLINE, 2);
    poly(ctx, [len * 0.3, -2, len * 0.86, -1.5, len * 0.95, 0, len * 0.3, 1], shine, null);
  }
  ctx.restore();
}

/** Motion smear behind a spinning blade. */
export function drawBladeTrail(ctx: Ctx, x: number, y: number, radius: number, width: number, angle: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, radius, angle - 0.9, angle - 0.05);
  ctx.stroke();
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = width * 1.6;
  ctx.beginPath();
  ctx.arc(x, y, radius, angle - 0.6, angle - 0.05);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- enemies

const ZOMBIE_LOOKS: Record<Exclude<EnemyKind, "egg">, { skin: string; shirt: string; pants: string }> = {
  walker: { skin: "#8fc9b4", shirt: "#eef2f2", pants: "#2d2a36" },
  miner: { skin: "#b39270", shirt: "#7c5b3c", pants: "#3e2f22" },
  runner: { skin: "#93cdb8", shirt: "#f2e6c4", pants: "#31415a" },
  shield: { skin: "#86b4cc", shirt: "#d9dde6", pants: "#273047" },
  brute: { skin: "#c9724e", shirt: "#e8e0d2", pants: "#5a2e22" },
};

export function drawEnemy(ctx: Ctx, kind: EnemyKind, x: number, y: number, t: number, facing: number, flash: number) {
  if (kind === "egg") {
    const wob = Math.sin(t * 9) * 0.18;
    ellipse(ctx, x, y + 14, 13, 4, "rgba(0,0,0,0.22)", null);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wob);
    drawEgg(ctx, 0, 0, 15);
    ctx.restore();
    if (flash > 0) ellipse(ctx, x, y, 14, 17, `rgba(255,255,255,${flash * 5})`, null);
    return;
  }
  const look = ZOMBIE_LOOKS[kind];
  // Drawn ~1.3x the hitbox so they read at the ad's scale
  const r = (kind === "brute" ? 21 : kind === "shield" ? 16 : 15) * 1.3;
  const step = Math.sin(t * 11);
  const bob = Math.abs(step) * 2;

  ellipse(ctx, x, y + r * 1.05, r * 0.9, r * 0.28, "rgba(0,0,0,0.25)", null);
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(facing, 1);

  // Legs
  roundRect(ctx, -r * 0.42, r * 0.45, r * 0.32, r * 0.6 + step * 2, 3, look.pants, OUTLINE, 2);
  roundRect(ctx, r * 0.1, r * 0.45, r * 0.32, r * 0.6 - step * 2, 3, look.pants, OUTLINE, 2);
  // Back arm, body, front arm reaching forward
  roundRect(ctx, 0, -r * 0.15, r * 1.1, r * 0.28, 4, look.skin, OUTLINE, 2);
  roundRect(ctx, -r * 0.6, -r * 0.3, r * 1.15, r * 0.95, 6, look.shirt, OUTLINE, 2.5);
  if (kind === "walker") poly(ctx, [-r * 0.1, -r * 0.3, r * 0.05, r * 0.2, r * 0.18, -r * 0.3], "#c8323c", null);
  roundRect(ctx, r * 0.05, r * 0.05, r * 1.15, r * 0.28, 4, look.skin, OUTLINE, 2);

  // Head
  const hy = -r * 0.95;
  ellipse(ctx, 0, hy, r * 0.82, r * 0.78, look.skin, OUTLINE, 2.5);
  ellipse(ctx, r * 0.08, hy - r * 0.15, r * 0.3, r * 0.32, "#fff", OUTLINE, 1.8);
  ellipse(ctx, r * 0.5, hy - r * 0.1, r * 0.2, r * 0.22, "#fff", OUTLINE, 1.8);
  ellipse(ctx, r * 0.14, hy - r * 0.12, r * 0.09, r * 0.09, "#1d1410", null);
  ellipse(ctx, r * 0.54, hy - r * 0.08, r * 0.07, r * 0.07, "#1d1410", null);
  ellipse(ctx, r * 0.35, hy + r * 0.35, r * 0.2, r * 0.16, "#4a1f24", OUTLINE, 1.5);
  if (kind !== "brute") ellipse(ctx, -r * 0.35, hy - r * 0.45, r * 0.14, r * 0.1, "rgba(60,90,80,0.5)", null);

  if (kind === "miner") {
    ellipse(ctx, 0, hy - r * 0.5, r * 1.05, r * 0.25, "#9a7a4a", OUTLINE, 2);
    ellipse(ctx, 0, hy - r * 0.68, r * 0.7, r * 0.42, "#b8925a", OUTLINE, 2);
    ellipse(ctx, r * 0.45, hy - r * 0.72, r * 0.16, r * 0.16, "#ffe47a", OUTLINE, 1.5);
  } else if (kind === "runner") {
    poly(ctx, [-r * 0.8, hy - r * 0.2, -r * 0.6, hy - r * 1.15, -r * 0.25, hy - r * 0.65, 0, hy - r * 1.3, r * 0.25, hy - r * 0.7, r * 0.7, hy - r * 1.05, r * 0.65, hy - r * 0.45], "#ffd84d", OUTLINE, 2);
  } else if (kind === "brute") {
    for (let i = -1; i <= 1; i++) {
      const fl = Math.sin(t * 14 + i * 2) * r * 0.15;
      poly(ctx, [i * r * 0.45 - r * 0.25, hy - r * 0.55, i * r * 0.45, hy - r * 1.4 + fl, i * r * 0.45 + r * 0.25, hy - r * 0.55], "#ff7a2e", "#c43d16", 2);
      poly(ctx, [i * r * 0.45 - r * 0.12, hy - r * 0.6, i * r * 0.45, hy - r * 1.05 + fl, i * r * 0.45 + r * 0.12, hy - r * 0.6], "#ffd84d", null);
    }
  } else if (kind === "shield") {
    roundRect(ctx, r * 0.55, -r * 1.45, r * 0.75, r * 2.5, 6, "#5c7fe0", OUTLINE, 2.5);
    roundRect(ctx, r * 0.68, -r * 1.3, r * 0.5, r * 2.2, 4, "rgba(255,255,255,0.18)", null);
    poly(ctx, [r * 1.0, -r * 0.8, r * 0.78, -r * 0.1, r * 0.96, -r * 0.1, r * 0.82, r * 0.5, r * 1.12, -r * 0.3, r * 0.94, -r * 0.3], "#ffe14a", null);
  }
  ctx.restore();

  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, flash * 6);
    ellipse(ctx, x, y - r * 0.4, r, r * 1.4, "#fff", null);
    ctx.restore();
  }
}

export function drawEgg(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.82, s, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(x, y - s, x, y + s);
  g.addColorStop(0, "#ffcc3d");
  g.addColorStop(1, "#ff7b1c");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Flame pattern like the ad's egg icon
  poly(ctx, [x - s, y + s, x - s * 0.5, y - s * 0.1, x - s * 0.2, y + s * 0.4, x + s * 0.1, y - s * 0.45, x + s * 0.45, y + s * 0.3, x + s, y - s * 0.2, x + s, y + s], "#e5481b", null);
  ctx.restore();
  ellipse(ctx, x, y, s * 0.82, s, "rgba(0,0,0,0)", OUTLINE, 2.2);
  ellipse(ctx, x - s * 0.3, y - s * 0.45, s * 0.16, s * 0.24, "rgba(255,255,255,0.65)", null);
}

// ---------------------------------------------------------------- kid & gate

export function drawKid(ctx: Ctx, x: number, y: number, t: number, hurt: number) {
  const shake = hurt > 0 ? Math.sin(t * 60) * 3 : 0;
  ctx.save();
  ctx.translate(x + shake, y);
  ellipse(ctx, 0, 28, 16, 5, "rgba(0,0,0,0.25)", null);
  roundRect(ctx, -7, 14, 6, 14, 2, "#3a2b22", OUTLINE, 2);
  roundRect(ctx, 2, 14, 6, 14, 2, "#3a2b22", OUTLINE, 2);
  roundRect(ctx, -17, -6, 12, 18, 4, "#d84a3c", OUTLINE, 2); // backpack
  roundRect(ctx, -11, -8, 23, 25, 7, "#e9f2fb", OUTLINE, 2.5);
  roundRect(ctx, -11, 6, 23, 8, 3, "#5b8fd6", null);
  ellipse(ctx, 1, -18, 13, 12, "#ffd9b8", OUTLINE, 2.5);
  ellipse(ctx, 5, -17, 2, 2.5, "#2a1f1a", null);
  ellipse(ctx, -3, -17, 2, 2.5, "#2a1f1a", null);
  // Cap
  ctx.beginPath();
  ctx.arc(1, -22, 13, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#f4f7fb";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  roundRect(ctx, 3, -24, 16, 5, 2.5, "#4a7fd0", OUTLINE, 2);
  ctx.restore();
  if (hurt > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, hurt * 2);
    ellipse(ctx, x, y - 2, 20, 30, "#ff3b3b", null);
    ctx.restore();
  }
}

/** Red striped barrier across the track: the base HP bar from the ad. */
export function drawBaseBar(ctx: Ctx, x: number, y: number, ratio: number, t: number) {
  const w = 70;
  const h = 18;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 5, "#5a1a22", OUTLINE, 3);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 2, y - h / 2 + 2, (w - 4) * ratio, h - 4, 3);
  ctx.clip();
  ctx.fillStyle = ratio > 0.3 || Math.sin(t * 10) > 0 ? "#ff3d55" : "#ff9aa8";
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  for (let i = -2; i < 8; i++) {
    ctx.beginPath();
    const sx = x - w / 2 + i * 12 + ((t * 20) % 12);
    ctx.moveTo(sx, y + h / 2);
    ctx.lineTo(sx + 6, y + h / 2);
    ctx.lineTo(sx + 14, y - h / 2);
    ctx.lineTo(sx + 8, y - h / 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHand(ctx: Ctx, x: number, y: number, pressed: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  const s = pressed ? 0.9 : 1;
  ctx.scale(s, s);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  // Pointing glove, fingertip at the origin
  ctx.beginPath();
  ctx.roundRect(-6, -2, 12, 30, 6);
  ctx.roundRect(-4, 18, 36, 34, 14);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, 26);
  ctx.lineTo(8, 34);
  ctx.moveTo(18, 24);
  ctx.lineTo(18, 34);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- scenery

/** Static scenery, rendered once at 2x into an offscreen canvas. */
export function renderBackground(): HTMLCanvasElement {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  const rand = mulberry32(42);

  const grass = ctx.createLinearGradient(0, 0, 0, H);
  grass.addColorStop(0, "#7fcb48");
  grass.addColorStop(1, "#6cbb3e");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, W, H);

  // Grass tufts and flowers
  for (let i = 0; i < 140; i++) {
    const x = rand() * W;
    const y = 100 + rand() * (H - 160);
    if (Math.hypot(x - CENTER.x, y - CENTER.y) < TRACK_OUTER + 6) continue;
    ctx.strokeStyle = rand() < 0.5 ? "#5fa836" : "#94d95a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 5);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + 4, y - 6);
    ctx.stroke();
  }
  for (let i = 0; i < 10; i++) {
    const x = rand() * W;
    const y = 220 + rand() * 600;
    if (Math.hypot(x - CENTER.x, y - CENTER.y) < TRACK_OUTER + 10) continue;
    for (let p = 0; p < 5; p++) ellipse(ctx, x + Math.cos(p * 1.26) * 3.5, y + Math.sin(p * 1.26) * 3.5, 2.6, 2.6, "#fff6e0", null);
    ellipse(ctx, x, y, 2, 2, "#ffc93d", null);
  }

  drawForest(ctx, rand, 0, 70, 22);
  drawForest(ctx, rand, H - 70, H + 20, 22);
  drawVan(ctx, 92, 150);
  drawStoneHut(ctx, 455, 150);
  drawCamp(ctx, 270, 150);

  // Sand ring
  ctx.save();
  ctx.shadowColor = "rgba(60,90,20,0.35)";
  ctx.shadowBlur = 10;
  ellipse(ctx, CENTER.x, CENTER.y, TRACK_OUTER, TRACK_OUTER, "#f3dc8e", "#d6b862", 4);
  ctx.restore();
  ellipse(ctx, CENTER.x, CENTER.y, TRACK_OUTER - 10, TRACK_OUTER - 10, "rgba(0,0,0,0)", "rgba(255,247,210,0.6)", 3);
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const r = FIELD_R + 8 + rand() * (TRACK_OUTER - FIELD_R - 16);
    ellipse(ctx, CENTER.x + Math.cos(a) * r, CENTER.y + Math.sin(a) * r, 1.6, 1.2, "#d9bd6c", null);
  }

  // Inner field
  ctx.save();
  ctx.shadowColor = "rgba(120,90,20,0.45)";
  ctx.shadowBlur = 8;
  ellipse(ctx, CENTER.x, CENTER.y, FIELD_R, FIELD_R, "#8fd24f", "#6aac38", 4);
  ctx.restore();
  ellipse(ctx, CENTER.x, CENTER.y, FIELD_R - 14, FIELD_R - 14, "rgba(0,0,0,0)", "rgba(175,230,110,0.5)", 3);

  // Checkered slots, alternating light/dark like the ad
  let i = 0;
  SLOT_ROWS.forEach((count, row) => {
    for (let col = 0; col < count; col++, i++) {
      const s = SLOTS[i];
      const light = (row + col) % 2 === 0;
      ellipse(ctx, s.x, s.y + 2, SLOT_R, SLOT_R, "rgba(60,110,30,0.35)", null);
      ellipse(ctx, s.x, s.y, SLOT_R, SLOT_R, light ? "#c9e66c" : "#79bd45", light ? "#b2d25a" : "#69a83c", 2);
    }
  });

  return canvas;
}

function drawForest(ctx: Ctx, rand: () => number, top: number, bottom: number, count: number) {
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * W + (rand() - 0.5) * 20;
    const y = top + rand() * (bottom - top);
    const s = 22 + rand() * 14;
    roundRect(ctx, x - 4, y + s * 0.6, 8, 14, 2, "#6b4a2b", null);
    poly(ctx, [x - s, y + s * 0.8, x, y - s * 0.9, x + s, y + s * 0.8], "#2f8a3c", "#1f5e2a", 2);
    poly(ctx, [x - s * 0.75, y + s * 0.15, x, y - s * 1.4, x + s * 0.75, y + s * 0.15], "#3fa34a", "#1f5e2a", 2);
  }
}

function drawVan(ctx: Ctx, x: number, y: number) {
  ellipse(ctx, x, y + 44, 80, 12, "rgba(0,0,0,0.2)", null);
  roundRect(ctx, x - 52, y - 68, 92, 22, 6, "#f0d9a8", OUTLINE, 3); // luggage
  roundRect(ctx, x - 36, y - 76, 30, 16, 4, "#b8794a", OUTLINE, 2.5);
  // Two-tone body: cream top, red bottom, clipped to the rounded shell
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - 74, y - 48, 148, 82, 22);
  ctx.clip();
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(x - 74, y - 48, 148, 82);
  ctx.fillStyle = "#c93a3f";
  ctx.fillRect(x - 74, y - 2, 148, 36);
  ctx.restore();
  roundRect(ctx, x - 74, y - 48, 148, 82, 22, "rgba(0,0,0,0)", OUTLINE, 3.5);
  for (let k = 0; k < 3; k++) roundRect(ctx, x - 62 + k * 40, y - 38, 32, 26, 6, "#9fd6ea", OUTLINE, 2.5);
  ellipse(ctx, x - 44, y + 34, 15, 15, "#3a3533", OUTLINE, 3);
  ellipse(ctx, x + 44, y + 34, 15, 15, "#3a3533", OUTLINE, 3);
  ellipse(ctx, x - 44, y + 34, 6, 6, "#bbb", null);
  ellipse(ctx, x + 44, y + 34, 6, 6, "#bbb", null);
  roundRect(ctx, x + 38, y + 4, 24, 10, 3, "#e8eef5", OUTLINE, 2);
}

function drawStoneHut(ctx: Ctx, x: number, y: number) {
  ellipse(ctx, x, y + 46, 85, 14, "rgba(0,0,0,0.2)", null);
  ctx.beginPath();
  ctx.ellipse(x, y + 40, 82, 105, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#c9cdc6";
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  const rand = mulberry32(7);
  for (let i = 0; i < 18; i++) {
    const a = Math.PI + rand() * Math.PI;
    const r = 0.3 + rand() * 0.6;
    ellipse(ctx, x + Math.cos(a) * 82 * r, y + 40 + Math.sin(a) * 105 * r, 10, 7, "#adb3aa", "#8d938b", 1.5);
  }
  for (const [wx, wy] of [[-38, 10], [0, -30], [38, 10]]) {
    roundRect(ctx, x + wx - 12, y + wy - 14, 24, 30, 12, "#ff9a2e", OUTLINE, 3);
    roundRect(ctx, x + wx - 6, y + wy - 6, 12, 18, 6, "#ffd36b", null);
  }
  ellipse(ctx, x + 60, y + 34, 18, 12, "#9aa196", OUTLINE, 2.5);
  ellipse(ctx, x - 64, y + 36, 14, 10, "#9aa196", OUTLINE, 2.5);
}

function drawCamp(ctx: Ctx, x: number, y: number) {
  for (const dx of [-48, 48]) {
    roundRect(ctx, x + dx - 16, y - 18, 32, 30, 5, "#4e8fd6", OUTLINE, 2.5);
    roundRect(ctx, x + dx - 16, y + 8, 32, 8, 3, "#2f5f9a", OUTLINE, 2);
  }
  ellipse(ctx, x, y + 2, 20, 9, "#b88552", OUTLINE, 2.5);
  roundRect(ctx, x - 4, y - 14, 8, 12, 2, "#ff6a5a", OUTLINE, 2);
}
