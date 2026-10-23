import { GROUND_Y, H, ROAD_BOTTOM, ROAD_TOP, W, type EnemyKind } from "./config";

// Chibi style from the ad: round heads, bean bodies, thick dark outlines, flat
// colours. Everything is procedural; the scenery is generated per 180px tile
// from a hash, so it scrolls forever without repeating visibly.

type Ctx = CanvasRenderingContext2D;
export const OUTLINE = "#23201c";
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = "#fff", align: CanvasTextAlign = "center") {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.min(6, Math.max(3, size * 0.2));
  ctx.strokeStyle = OUTLINE;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, lw = 3) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

function poly(ctx: Ctx, pts: number[], fill: string, lw = 3) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, lw = 0) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- weapons

/**
 * Weapon in hand-local space: grip at the origin, pointing along +x.
 * `tier` is the hero ladder (0 stick … 7 heaven sword); enemies pass their own.
 */
export function drawWeapon(ctx: Ctx, kind: string) {
  switch (kind) {
    case "stick": // ad: knobbly olive club
      poly(ctx, [-6, -4, 40, -7, 52, -3, 52, 5, 40, 7, -6, 4], "#7d8a3a");
      blob(ctx, 22, -6, 4, 3, "#6b7730", 0);
      break;
    case "club":
      poly(ctx, [-6, -4, 38, -7, 50, -3, 50, 5, 38, 7, -6, 4], "#8a4a2a");
      break;
    case "axe":
      poly(ctx, [-6, -3, 40, -3, 40, 3, -6, 3], "#9a6a3a");
      poly(ctx, [30, -4, 44, -16, 52, -4, 52, 6, 44, 16, 30, 4], "#d9dde3");
      break;
    case "sword":
      poly(ctx, [-6, -3, 8, -3, 8, 3, -6, 3], "#7a4a2a");
      poly(ctx, [8, -10, 12, -10, 12, 10, 8, 10], "#e2b64a");
      poly(ctx, [12, -5, 52, -5, 62, 0, 52, 5, 12, 5], "#e8edf2");
      break;
    case "hammer":
      poly(ctx, [-6, -3, 42, -3, 42, 3, -6, 3], "#6a4a2a");
      roundRect(ctx, 36, -14, 22, 28, 4, "#9aa3ad", 3);
      break;
    case "flame":
      poly(ctx, [-6, -3, 8, -3, 8, 3, -6, 3], "#5a2a1a");
      poly(ctx, [8, -10, 12, -10, 12, 10, 8, 10], "#ffcf3a");
      poly(ctx, [12, -6, 54, -6, 66, 0, 54, 6, 12, 6], "#ff7a2a");
      poly(ctx, [16, -2, 52, -2, 60, 0, 52, 2, 16, 2], "#ffe08a", 0);
      break;
    case "divine":
      poly(ctx, [-6, -3, 8, -3, 8, 3, -6, 3], "#e2b64a");
      poly(ctx, [8, -12, 13, -12, 13, 12, 8, 12], "#7fe0ff");
      poly(ctx, [13, -6, 58, -6, 70, 0, 58, 6, 13, 6], "#dff6ff");
      break;
    case "glaive":
      poly(ctx, [-6, -3, 44, -3, 44, 3, -6, 3], "#3a2a5a");
      poly(ctx, [40, -4, 58, -18, 70, 0, 58, 10, 40, 4], "#9a6aff");
      break;
    case "heaven":
      poly(ctx, [-6, -3, 8, -3, 8, 3, -6, 3], "#fff3c4");
      poly(ctx, [8, -14, 14, -14, 14, 14, 8, 14], "#ffd23f");
      poly(ctx, [14, -7, 64, -7, 78, 0, 64, 7, 14, 7], "#fffbe6");
      poly(ctx, [18, -2, 62, -2, 72, 0, 62, 2, 18, 2], "#ffe066", 0);
      break;
    case "bow":
      ctx.lineWidth = 6;
      ctx.strokeStyle = OUTLINE;
      ctx.beginPath();
      ctx.arc(14, 0, 22, -1.3, 1.3);
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#c0392b";
      ctx.stroke();
      break;
    case "log": // the helmet brutes swing a fat log
      roundRect(ctx, -6, -8, 58, 16, 8, "#c45a5a", 3);
      break;
    case "mace":
      poly(ctx, [-6, -3, 40, -3, 40, 3, -6, 3], "#5a3a2a");
      blob(ctx, 48, 0, 12, 12, "#8a8f99");
      break;
  }
}

export const HERO_WEAPONS = ["stick", "axe", "sword", "hammer", "flame", "divine", "glaive", "heaven"];

const ENEMY_WEAPON: Record<EnemyKind, string> = {
  grunt: "club",
  axe: "axe",
  archer: "bow",
  helmet: "log",
  chief: "mace",
};

// ---------------------------------------------------------------- fighters

/**
 * Swing pose from an attack progress in [0, 1]: wind up overhead, then slam
 * forward past rest. Returns the weapon's rotation (radians, toward facing).
 */
export function swingAngle(p: number) {
  if (p <= 0 || p >= 1) return 0.35;
  if (p < 0.45) return 0.35 - (p / 0.45) * 2.2; // raise over the head
  const k = (p - 0.45) / 0.55;
  return -1.85 + k * 2.5; // slam down
}

export interface Look {
  t: number;
  /** 0..1 swing progress, or 0 when idle. */
  swing: number;
  flash: number;
  /** Slide toward the foe during the slam. */
  lunge: number;
  scale?: number;
}

function eyesDot(ctx: Ctx, x: number, y: number, s: number) {
  for (const dx of [-0.2, 0.18]) blob(ctx, x + dx * s, y, s * 0.07, s * 0.14, OUTLINE, 0);
}

function eyesBig(ctx: Ctx, x: number, y: number, s: number, dead = false) {
  for (const dx of [-0.28, 0.22]) {
    blob(ctx, x + dx * s, y, s * 0.2, s * 0.22, "#fff", 2.5);
    if (dead) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + dx * s - 5, y - 5);
      ctx.lineTo(x + dx * s + 5, y + 5);
      ctx.moveTo(x + dx * s + 5, y - 5);
      ctx.lineTo(x + dx * s - 5, y + 5);
      ctx.stroke();
    } else blob(ctx, x + dx * s - s * 0.05, y + 1, s * 0.09, s * 0.11, OUTLINE, 0);
  }
}

/** Green hero facing right, feet at (x, y). */
export function drawHero(ctx: Ctx, x: number, y: number, weaponTier: number, look: Look) {
  const s = 26;
  const bob = Math.sin(look.t * 4) * 1.2;
  ctx.save();
  ctx.translate(x + look.lunge, y);
  blob(ctx, 0, 2, 26, 7, "rgba(0,0,0,0.18)", 0);
  // Weapon behind the body when raised, in front when slamming
  const angle = swingAngle(look.swing);
  const drawArm = () => {
    ctx.save();
    ctx.translate(12, -22 + bob);
    ctx.rotate(angle);
    drawWeapon(ctx, HERO_WEAPONS[weaponTier] ?? "stick");
    ctx.restore();
  };
  if (angle < -0.6) drawArm();
  blob(ctx, 0, -18 + bob, 19, 17, "#4cc94c");
  blob(ctx, 2, -48 + bob, s, s * 0.95, "#f3b9a3");
  eyesDot(ctx, 10, -50 + bob, s);
  if (angle >= -0.6) drawArm();
  if (look.flash > 0) {
    ctx.globalAlpha = Math.min(0.8, look.flash * 6);
    blob(ctx, 0, -36, 30, 40, "#ff5a5a", 0);
  }
  ctx.restore();
}

const ENEMY_SKIN = "#f06b6b";
const ENEMY_BODY = "#c92f2f";

/** Red foe facing left, feet at (x, y). */
export function drawEnemy(ctx: Ctx, kind: EnemyKind, x: number, y: number, look: Look) {
  const scale = look.scale ?? (kind === "chief" ? 1.35 : 1);
  const s = 25;
  const bob = Math.sin(look.t * 4 + x * 0.05) * 1.2;
  ctx.save();
  ctx.translate(x - look.lunge, y);
  ctx.scale(-scale, scale); // mirror: everything is drawn facing right
  blob(ctx, 0, 2, 26, 7, "rgba(0,0,0,0.18)", 0);
  const weapon = ENEMY_WEAPON[kind];
  const angle = kind === "archer" ? 0 : swingAngle(look.swing);
  const drawArm = () => {
    ctx.save();
    ctx.translate(12, -22 + bob);
    ctx.rotate(kind === "archer" ? 0 : angle);
    drawWeapon(ctx, weapon);
    ctx.restore();
  };
  if (angle < -0.6) drawArm();
  blob(ctx, 0, -18 + bob, 19, 17, kind === "chief" ? "#8e1f1f" : ENEMY_BODY);
  blob(ctx, 2, -48 + bob, s, s * 0.95, ENEMY_SKIN);
  eyesBig(ctx, 4, -50 + bob, s);
  if (kind === "helmet") {
    // ad: dark-red pointy helmet with a gold band
    poly(ctx, [-24, -54 + bob, -14, -82 + bob, 4, -94 + bob, 20, -84 + bob, 28, -54 + bob], "#a52a2a");
    roundRect(ctx, -25, -60 + bob, 54, 9, 4, "#e0a63a", 2.5);
  }
  if (kind === "chief") {
    poly(ctx, [-18, -68 + bob, -14, -90 + bob, -4, -76 + bob, 4, -94 + bob, 12, -76 + bob, 22, -90 + bob, 24, -68 + bob], "#ffd23f");
    poly(ctx, [-24, -58 + bob, -40, -80 + bob, -22, -68 + bob], "#f4efe0");
    poly(ctx, [26, -58 + bob, 42, -80 + bob, 24, -68 + bob], "#f4efe0");
  }
  if (angle >= -0.6) drawArm();
  if (look.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, look.flash * 7);
    blob(ctx, 0, -36, 30, 42, "#ffffff", 0);
  }
  ctx.restore();
}

export function drawArrow(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(44, 0);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#d8452e";
  ctx.stroke();
  poly(ctx, [-8, 0, 2, -6, 2, 6], "#d9dde3", 2);
  poly(ctx, [40, 0, 50, -7, 48, 0, 50, 7], "#ffcf3a", 2);
  ctx.restore();
}

export function drawHpBar(ctx: Ctx, x: number, y: number, hp: number, max: number, hero: boolean) {
  const w = 64;
  const h = 18;
  roundRect(ctx, x - w / 2, y, w, h, 3, "#1c1c1c", 2.5);
  const ratio = Math.max(0, Math.min(1, hp / max));
  if (ratio > 0) roundRect(ctx, x - w / 2 + 2, y + 2, (w - 4) * ratio, h - 4, 2, hero ? "#4ee04e" : "#e23b3b");
  text(ctx, String(Math.max(0, Math.ceil(hp))), x, y + h / 2 + 1, 15);
}

export function drawCoin(ctx: Ctx, x: number, y: number, r: number) {
  blob(ctx, x, y, r, r, "#ffd23f", Math.max(1.5, r * 0.18));
  blob(ctx, x, y, r * 0.62, r * 0.62, "#f0b429", 0);
  ctx.strokeStyle = "#fff6c0";
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, -2.6, -1.2);
  ctx.stroke();
}

export function drawSkull(ctx: Ctx, x: number, y: number, r: number) {
  blob(ctx, x, y - r * 0.1, r, r * 0.9, "#f4f4f4", 2);
  roundRect(ctx, x - r * 0.5, y + r * 0.5, r, r * 0.45, 2, "#f4f4f4", 2);
  for (const dx of [-0.38, 0.38]) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + dx * r - 3, y - 4);
    ctx.lineTo(x + dx * r + 3, y + 2);
    ctx.moveTo(x + dx * r + 3, y - 4);
    ctx.lineTo(x + dx * r - 3, y + 2);
    ctx.stroke();
  }
}

/** Flame glyph for critical hits (ad: red/yellow flame next to the number). */
export function drawFlame(ctx: Ctx, x: number, y: number, s: number) {
  poly(ctx, [x - s, y + s, x - s * 0.9, y - s * 0.1, x - s * 0.45, y + s * 0.2, x - s * 0.3, y - s, x + s * 0.15, y - s * 0.1, x + s * 0.5, y - s * 0.7, x + s, y + s], "#e8432a", 2);
  poly(ctx, [x - s * 0.5, y + s, x - s * 0.3, y + s * 0.1, x, y + s * 0.4, x + s * 0.4, y, x + s * 0.55, y + s], "#ffcf3a", 0);
}

export function drawShieldIcon(ctx: Ctx, x: number, y: number, s: number, tier: number) {
  const fills = ["#8a8a8a", "#b06a3a", "#9aa3ad", "#e0b23a", "#3aa86a", "#7fd0ff", "#fff3c4"];
  const fill = fills[Math.min(tier, fills.length - 1)];
  poly(ctx, [x, y - s, x + s * 0.85, y - s * 0.65, x + s * 0.75, y + s * 0.25, x, y + s, x - s * 0.75, y + s * 0.25, x - s * 0.85, y - s * 0.65], fill, 3);
  poly(ctx, [x, y - s * 0.62, x + s * 0.5, y - s * 0.4, x + s * 0.44, y + s * 0.15, x, y + s * 0.6, x - s * 0.44, y + s * 0.15, x - s * 0.5, y - s * 0.4], "rgba(0,0,0,0.18)", 0);
}

// ---------------------------------------------------------------- scenery

const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const TILE = 180;

/** Grass, road and props, scrolled by `offset` world pixels (grows as the party walks). */
export function drawScene(ctx: Ctx, offset: number, left: number, right: number, top: number, bottom: number) {
  ctx.fillStyle = "#68a64a";
  ctx.fillRect(left, top, right - left, bottom - top);
  // Mowed stripes
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let y = 0; y < H; y += 60) ctx.fillRect(left, y, right - left, 30);

  const first = Math.floor((left + offset) / TILE) - 1;
  const last = Math.floor((right + offset) / TILE) + 1;
  // Back props (above the road): trees, bushes, rocks
  for (let i = first; i <= last; i++) {
    const x = i * TILE - offset;
    const r = hash(i);
    if (r < 0.35) drawTree(ctx, x + hash(i + 7) * 120, 40 + hash(i + 3) * 60);
    if (hash(i + 11) < 0.7) drawBush(ctx, x + hash(i + 13) * 140, 240 + hash(i + 17) * 70);
    if (hash(i + 19) < 0.35) blob(ctx, x + hash(i + 23) * 160, 180 + hash(i + 29) * 120, 18, 10, "#b8bcc2", 3);
    for (let k = 0; k < 3; k++) tuft(ctx, x + hash(i * 3 + k) * TILE, 120 + hash(i * 5 + k) * 220);
  }

  // Road with a ragged grass edge
  ctx.fillStyle = "#c39a7c";
  ctx.fillRect(left, ROAD_TOP, right - left, ROAD_BOTTOM - ROAD_TOP);
  edge(ctx, ROAD_TOP, -1, offset, left, right);
  edge(ctx, ROAD_BOTTOM, 1, offset, left, right);
  for (let i = first; i <= last; i++) {
    const x = i * TILE - offset;
    for (let k = 0; k < 4; k++) {
      blob(ctx, x + hash(i * 7 + k) * TILE, ROAD_TOP + 30 + hash(i * 9 + k) * (ROAD_BOTTOM - ROAD_TOP - 60), 3 + hash(i + k) * 3, 2, "#a88066", 0);
    }
  }

  // Front props (below the road)
  for (let i = first; i <= last; i++) {
    const x = i * TILE - offset;
    for (let k = 0; k < 3; k++) tuft(ctx, x + hash(i * 11 + k) * TILE, 690 + hash(i * 13 + k) * 260);
    if (hash(i + 37) < 0.3) flower(ctx, x + hash(i + 41) * 160, 700 + hash(i + 43) * 60);
  }
}

function edge(ctx: Ctx, y: number, dir: number, offset: number, left: number, right: number) {
  ctx.beginPath();
  const step = 14;
  const start = Math.floor((left + offset) / step) * step - offset - step;
  ctx.moveTo(start, y + dir * 20);
  for (let x = start, n = Math.floor((left + offset) / step) - 1; x <= right + step; x += step, n++) {
    ctx.lineTo(x, y + dir * (hash(n) * 7));
  }
  ctx.lineTo(right + step, y + dir * 20);
  ctx.closePath();
  ctx.fillStyle = "#5c9a40";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#3f7a2a";
  ctx.stroke();
}

function tuft(ctx: Ctx, x: number, y: number) {
  ctx.strokeStyle = "#7fbe5a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.lineTo(x - 2, y - 7);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 1, y - 9);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 4, y - 6);
  ctx.stroke();
}

function flower(ctx: Ctx, x: number, y: number) {
  for (let i = 0; i < 5; i++) blob(ctx, x + Math.cos(i * 1.26) * 4, y + Math.sin(i * 1.26) * 4, 3, 3, "#fff6e0", 0);
  blob(ctx, x, y, 2.4, 2.4, "#ffc93d", 0);
}

function drawBush(ctx: Ctx, x: number, y: number) {
  for (const [dx, dy, r] of [[-26, 6, 24], [4, -8, 30], [32, 6, 22]] as const) blob(ctx, x + dx, y + dy, r, r * 0.85, "#5fc23a");
  for (const [dx, dy, r] of [[-26, 6, 24], [4, -8, 30], [32, 6, 22]] as const) blob(ctx, x + dx, y + dy, r - 3, r * 0.85 - 3, "#76d64c", 0);
  blob(ctx, x - 6, y - 16, 10, 5, "rgba(255,255,255,0.35)", 0);
}

function drawTree(ctx: Ctx, x: number, y: number) {
  roundRect(ctx, x - 14, y, 28, 110, 8, "#8a5a3a", 3);
  for (const [dx, dy, r] of [[-40, -10, 44], [10, -40, 54], [50, -6, 42]] as const) blob(ctx, x + dx, y + dy, r, r * 0.8, "#3f8f3a");
}

export const SCENE_W = W;
export const FEET_Y = GROUND_Y;
