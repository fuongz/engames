import { BEAM_HALF, H, type PickupKind } from "./config";
import { mulberry32 } from "./logic";

// Procedural art in the ad's palette: deep blue-violet space, pink/gold rider,
// obsidian enemies with purple or lava fire. Static shapes are pre-rendered to
// offscreen canvases once; animated parts (hair, flames, boss) draw per frame.

type Ctx = CanvasRenderingContext2D;
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

/** Offscreen sprite drawn around its centre at 2x for crisp scaling. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

function sprite(w: number, h: number, draw: (ctx: Ctx) => void): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(2, 2);
    ctx.translate(w / 2, h / 2);
    draw(ctx);
  }
  return { canvas, w, h };
}

export function blit(ctx: Ctx, s: Sprite, x: number, y: number, scale = 1) {
  ctx.drawImage(s.canvas, x - (s.w * scale) / 2, y - (s.h * scale) / 2, s.w * scale, s.h * scale);
}

function poly(ctx: Ctx, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function glowDot(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = "#fff", align: CanvasTextAlign = "center", weight = 800, italic = false) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.min(6, Math.max(2.5, size * 0.16));
  ctx.strokeStyle = "rgba(10,8,40,0.85)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

// ---------------------------------------------------------------- sprites

export interface Sprites {
  bulletPink: Sprite;
  bulletGold: Sprite;
  fighter: Sprite;
  meteor: Sprite;
  crystal: Sprite;
  pickups: Record<PickupKind, Sprite>;
  shot: Sprite;
}

export function makeSprites(): Sprites {
  const bullet = (core: string, edge: string) =>
    sprite(34, 14, (ctx) => {
      glowDot(ctx, 0, 0, 16, edge, 0.55);
      const g = ctx.createLinearGradient(-15, 0, 15, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, core);
      g.addColorStop(1, "#fff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(2, 0, 14, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });

  const fighter = sprite(84, 44, (ctx) => {
    glowDot(ctx, 30, 0, 22, "#3f8cff", 0.7); // engine
    ctx.shadowColor = "#4fa8ff";
    ctx.shadowBlur = 8;
    poly(ctx, [-38, 2, -6, -9, 12, -20, 34, -14, 22, -4, 34, 4, 14, 16, -4, 10]);
    const g = ctx.createLinearGradient(0, -20, 0, 16);
    g.addColorStop(0, "#2b3566");
    g.addColorStop(1, "#0d1024");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#5fb8ff";
    ctx.stroke();
    poly(ctx, [-26, 1, -4, -4, 8, 0, -4, 4]);
    ctx.fillStyle = "#7fe3ff";
    ctx.fill();
    ctx.strokeStyle = "rgba(160,120,255,0.8)";
    ctx.beginPath();
    ctx.moveTo(10, -16);
    ctx.lineTo(30, -12);
    ctx.stroke();
  });

  const meteor = sprite(56, 56, (ctx) => {
    poly(ctx, [-20, -6, -10, -20, 8, -22, 22, -10, 22, 10, 6, 22, -14, 18, -22, 6]);
    const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 26);
    g.addColorStop(0, "#5a3a3a");
    g.addColorStop(1, "#1a1012");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#0a0608";
    ctx.stroke();
    ctx.shadowColor = "#ff7a1a";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "#ffb03a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(-2, -2);
    ctx.lineTo(4, 10);
    ctx.moveTo(-2, -2);
    ctx.lineTo(12, -8);
    ctx.stroke();
  });

  const crystal = sprite(110, 110, (ctx) => {
    glowDot(ctx, 0, 0, 56, "#8a3cff", 0.35);
    // Purple crystal flames licking up and back
    for (const [x, y, h, w] of [[-18, -26, 30, 10], [4, -34, 36, 12], [24, -22, 26, 9], [30, 4, 22, 8]] as const) {
      ctx.beginPath();
      ctx.moveTo(x - w, y + 8);
      ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.4, x + w * 0.6, y - h);
      ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.3, x + w, y + 8);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y + 8, 0, y - h);
      g.addColorStop(0, "#c45cff");
      g.addColorStop(1, "rgba(240,180,255,0.2)");
      ctx.fillStyle = g;
      ctx.fill();
    }
    poly(ctx, [-38, -8, -22, -32, 6, -38, 32, -22, 40, 6, 24, 34, -6, 40, -32, 24]);
    const g = ctx.createLinearGradient(-30, -30, 30, 30);
    g.addColorStop(0, "#4a4566");
    g.addColorStop(0.5, "#24203a");
    g.addColorStop(1, "#110e1e");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0b0814";
    ctx.stroke();
    // Facets
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    poly(ctx, [-22, -32, 6, -38, -4, -6, -38, -8]);
    ctx.fill();
    ctx.shadowColor = "#d07bff";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#d98bff";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-26, 10);
    ctx.lineTo(-6, 2);
    ctx.lineTo(4, 22);
    ctx.moveTo(-6, 2);
    ctx.lineTo(18, -10);
    ctx.lineTo(30, 0);
    ctx.stroke();
  });

  const bubble = (inner: string, outer: string, icon: (ctx: Ctx) => void) =>
    sprite(60, 60, (ctx) => {
      glowDot(ctx, 0, 0, 30, outer, 0.6);
      const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 24);
      g.addColorStop(0, inner);
      g.addColorStop(0.75, outer);
      g.addColorStop(1, "#fff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
      icon(ctx);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(-8, -12, 7, 4, -0.5, 0, Math.PI * 2);
      ctx.fill();
    });

  const blade = (ctx: Ctx, angle: number) => {
    ctx.save();
    ctx.rotate(angle);
    poly(ctx, [0, -15, 4, -2, 0, 8, -4, -2]);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
  };

  const pickups: Record<PickupKind, Sprite> = {
    // ad: blue bubble with three spreading blades
    pierce: bubble("#9fd0ff", "#2f5cff", (ctx) => {
      blade(ctx, -0.5);
      blade(ctx, 0);
      blade(ctx, 0.5);
    }),
    multi: bubble("#9fd0ff", "#2f5cff", (ctx) => {
      ctx.fillStyle = "#fff";
      for (const y of [-8, 0, 8]) {
        poly(ctx, [-10, y - 2, 6, y - 2, 6, y - 5, 13, y, 6, y + 5, 6, y + 2, -10, y + 2]);
        ctx.fill();
      }
    }),
    // ad: gold orb carrying the skill emblem
    energy: bubble("#fff4b0", "#e89a1a", (ctx) => skillGlyph(ctx, 0, 0, 13, "#fff")),
    // ad: purple bubble labelled "2→3"
    capacity: bubble("#e9b8ff", "#8a3cff", (ctx) => {
      skillGlyph(ctx, 0, -5, 9, "#fff");
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText("+1", 0, 15);
    }),
  };

  // Boss fire orb: must read clearly against the busy boss art
  const shot = sprite(40, 40, (ctx) => {
    glowDot(ctx, 0, 0, 20, "#ff5a1a", 1);
    ctx.fillStyle = "#ff8a2a";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6c0";
    ctx.beginPath();
    ctx.arc(-1, -1, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  return {
    bulletPink: bullet("#ff9ad8", "#ff5cc8"),
    bulletGold: bullet("#ffd36b", "#ffae2e"),
    fighter,
    meteor,
    crystal,
    pickups,
    shot,
  };
}

/** The ad's skill emblem: a crescent bow with an arrow through it. */
export function skillGlyph(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.22;
  ctx.beginPath();
  ctx.arc(0, 0, r, -2.3, 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.75, r * 0.75);
  ctx.lineTo(r * 0.55, -r * 0.55);
  ctx.stroke();
  poly(ctx, [r * 0.85, -r * 0.85, r * 0.2, -r * 0.6, r * 0.6, -r * 0.2]);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- background

export interface Sky {
  nebula: HTMLCanvasElement;
  stars: { x: number; y: number; r: number; layer: number; twinkle: number }[];
}

export const SKY_W = 1920;

export function makeSky(): Sky {
  const rand = mulberry32(7);
  const nebula = document.createElement("canvas");
  nebula.width = SKY_W;
  nebula.height = H;
  const ctx = nebula.getContext("2d");
  if (ctx) {
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#0c1150");
    base.addColorStop(0.5, "#1b1d86");
    base.addColorStop(1, "#0d0f48");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SKY_W, H);
    ctx.globalCompositeOperation = "lighter";
    const tints = ["#3b1f8a", "#5a2a9a", "#1f3fb0", "#7a2a8a", "#203a9a"];
    for (let i = 0; i < 26; i++) {
      const x = rand() * SKY_W;
      const y = rand() * H;
      const r = 120 + rand() * 260;
      // Draw wrapped copies so the strip tiles seamlessly
      for (const dx of [-SKY_W, 0, SKY_W]) glowDot(ctx, x + dx, y, r, tints[i % tints.length], 0.35);
    }
    // Faint diagonal nebula streaks
    ctx.strokeStyle = "rgba(255,120,200,0.06)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 30; i++) {
      const x = rand() * SKY_W;
      const y = rand() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 120, y - 30);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(200,210,255,${0.2 + rand() * 0.4})`;
      ctx.fillRect(rand() * SKY_W, rand() * H, 1, 1);
    }
  }
  const stars = Array.from({ length: 70 }, () => ({
    x: rand() * SKY_W,
    y: rand() * H,
    r: 0.8 + rand() * 1.6,
    layer: rand() < 0.6 ? 1 : 2,
    twinkle: rand() * Math.PI * 2,
  }));
  return { nebula, stars };
}

/** Parallax space: nebula strip at 18 px/s, two star layers faster. */
export function drawSky(ctx: Ctx, sky: Sky, t: number, left: number, right: number, top: number, bottom: number) {
  const off = (t * 18) % SKY_W;
  for (let x = left - ((left + off) % SKY_W) - SKY_W; x < right; x += SKY_W) {
    ctx.drawImage(sky.nebula, x, 0, SKY_W, H);
  }
  if (top < 0 || bottom > H) {
    ctx.fillStyle = "#0b0f45";
    ctx.fillRect(left, top, right - left, -top);
    ctx.fillRect(left, H, right - left, bottom - H);
  }
  for (const s of sky.stars) {
    const speed = s.layer === 1 ? 50 : 120;
    let x = (s.x - t * speed) % SKY_W;
    if (x < 0) x += SKY_W;
    x += left - 20;
    if (x > right + 20) continue;
    const a = 0.5 + Math.sin(t * 3 + s.twinkle) * 0.4;
    ctx.globalAlpha = a;
    ctx.fillStyle = "#e8ecff";
    ctx.beginPath();
    ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.r > 2) {
      // 4-point sparkle like the ad's bright stars
      ctx.fillRect(x - s.r * 4, s.y - 0.5, s.r * 8, 1);
      ctx.fillRect(x - 0.5, s.y - s.r * 4, 1, s.r * 8);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- rider

/** The star rider on her flying blade, facing right, centred on the board. */
export function drawRider(ctx: Ctx, x: number, y: number, t: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Rainbow trail off the tail of the board
  const trail = ctx.createLinearGradient(-130, 0, -40, 0);
  trail.addColorStop(0, "rgba(120,255,190,0)");
  trail.addColorStop(0.5, "rgba(255,140,220,0.35)");
  trail.addColorStop(1, "rgba(255,240,200,0.6)");
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(-44, -2);
  ctx.quadraticCurveTo(-90, 2 + Math.sin(t * 6) * 3, -130, 6);
  ctx.quadraticCurveTo(-90, 12, -44, 10);
  ctx.closePath();
  ctx.fill();

  // Twin tails streaming back, pink → gold → mint like the ad
  for (const [dy, len, phase] of [[-2, 64, 0], [8, 54, 1.4]] as const) {
    const wave = Math.sin(t * 5 + phase) * 6;
    const g = ctx.createLinearGradient(-6, 0, -6 - len, 0);
    g.addColorStop(0, "#ff86c8");
    g.addColorStop(0.55, "#ffe27a");
    g.addColorStop(1, "#7dffc0");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, -30 + dy);
    ctx.bezierCurveTo(-26, -40 + dy + wave, -46 - len * 0.3, -18 + dy - wave, -10 - len, -22 + dy + wave);
    ctx.bezierCurveTo(-40, -8 + dy + wave, -22, -14 + dy, -4, -20 + dy);
    ctx.closePath();
    ctx.fill();
  }

  // Board: long golden blade with a cyan gem
  const board = ctx.createLinearGradient(0, -6, 0, 12);
  board.addColorStop(0, "#fff6d8");
  board.addColorStop(0.5, "#e2b25a");
  board.addColorStop(1, "#8a5a24");
  poly(ctx, [-58, 6, -44, -2, 36, -4, 64, 2, 38, 8, -42, 12]);
  ctx.fillStyle = board;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#5a3a14";
  ctx.stroke();
  ctx.fillStyle = "rgba(200,170,255,0.8)";
  poly(ctx, [-30, 11, 20, 8, 6, 16, -24, 16]);
  ctx.fill();
  ctx.fillStyle = "#7ff0ff";
  poly(ctx, [14, 2, 19, -2, 24, 2, 19, 6]);
  ctx.fill();
  glowDot(ctx, 19, 2, 9, "#7ff0ff", 0.6);

  // Legs and dress
  ctx.fillStyle = "#f4ecff";
  poly(ctx, [-4, -4, 22, -6, 24, -1, -2, 2]);
  ctx.fill();
  const dress = ctx.createLinearGradient(0, -22, 0, 0);
  dress.addColorStop(0, "#ffffff");
  dress.addColorStop(1, "#c9b0ff");
  ctx.fillStyle = dress;
  ctx.beginPath();
  ctx.ellipse(-8, -10, 10, 11, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e2b25a";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Head, bangs, crystal crown
  ctx.fillStyle = "#ffe4d6";
  ctx.beginPath();
  ctx.arc(-2, -30, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8fcf";
  ctx.beginPath();
  ctx.arc(-4, -33, 10.5, Math.PI * 0.95, Math.PI * 2.15);
  ctx.quadraticCurveTo(2, -28, -6, -26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  for (const [cx, h] of [[-10, 10], [-3, 14], [4, 9]] as const) {
    poly(ctx, [cx - 2.5, -40, cx, -40 - h, cx + 2.5, -40]);
    ctx.fill();
  }
  ctx.fillStyle = "#3a1a4a";
  ctx.beginPath();
  ctx.ellipse(4, -29, 1.8, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,120,170,0.6)";
  ctx.beginPath();
  ctx.arc(3, -25, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawHearts(ctx: Ctx, x: number, y: number, hearts: number, max: number) {
  for (let i = 0; i < max; i++) {
    const hx = x + (i - (max - 1) / 2) * 20;
    ctx.save();
    ctx.translate(hx, y);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-10, -1, -7, -9, 0, -4);
    ctx.bezierCurveTo(7, -9, 10, -1, 0, 6);
    ctx.fillStyle = i < hearts ? "#ffb8ea" : "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = i < hearts ? "#fff" : "rgba(255,255,255,0.35)";
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- enemies

/** Lava mane trailing behind a meteor (to its right, since it flies left). */
export function drawFlames(ctx: Ctx, x: number, y: number, t: number, size: number) {
  // Normal blending: "lighter" over the blue sky turns orange fire pink
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const wob = Math.sin(t * 18 + i * 1.7) * size * 0.12;
    const len = size * (1.4 + i * 0.25);
    const g = ctx.createLinearGradient(x, y, x + len, y);
    g.addColorStop(0, "rgba(255,230,120,0.9)");
    g.addColorStop(0.4, "rgba(255,120,30,0.7)");
    g.addColorStop(1, "rgba(255,60,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.6 + i * size * 0.35);
    ctx.quadraticCurveTo(x + len * 0.6, y - size * 0.4 + i * size * 0.3 + wob, x + len, y - size * 0.2 + i * size * 0.15);
    ctx.quadraticCurveTo(x + len * 0.5, y + i * size * 0.15 + wob, x, y + size * 0.1 + i * size * 0.2);
    ctx.fill();
  }
  ctx.restore();
}

/** White-hot overlay when an enemy takes a hit. */
export function hitFlash(ctx: Ctx, x: number, y: number, r: number, amount: number) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glowDot(ctx, x, y, r * 1.3, "#ffffff", Math.min(0.9, amount * 9));
  ctx.restore();
}

// ---------------------------------------------------------------- boss

/** Obsidian lava serpent filling the right edge, head facing left. */
export function drawBoss(ctx: Ctx, x: number, y: number, t: number, flash: number, dying: number) {
  ctx.save();
  if (dying > 0) {
    ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    ctx.globalAlpha = Math.min(1, dying);
  }
  // Lava aura
  ctx.globalCompositeOperation = "lighter";
  glowDot(ctx, x + 20, y, 220, "#ff5a1a", 0.35);
  ctx.globalCompositeOperation = "source-over";

  // Spine: plates from above the screen to below it, swaying
  for (let i = -6; i <= 6; i++) {
    if (i === 0) continue;
    const sy = y + i * 62;
    const sx = x + 40 + Math.sin(t * 1.5 + i * 0.7) * 22 + Math.abs(i) * 8;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.sin(t + i) * 0.15);
    glowDot(ctx, 0, 0, 46, "#ff8a2a", 0.5);
    poly(ctx, [-34, -10, -14, -38, 26, -30, 44, 0, 24, 30, -12, 36, -40, 14]);
    const g = ctx.createLinearGradient(-30, -30, 30, 30);
    g.addColorStop(0, "#3a3550");
    g.addColorStop(1, "#0e0b18");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#ff9a3a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#b45cff";
    poly(ctx, [10, -30, 30, -56, 26, -26]);
    ctx.fill();
    ctx.restore();
  }

  // Head
  ctx.save();
  ctx.translate(x, y);
  glowDot(ctx, -10, 0, 120, "#ffb03a", 0.45);
  poly(ctx, [-110, -6, -60, -46, 10, -70, 70, -40, 80, 30, 20, 70, -50, 52, -100, 20]);
  const head = ctx.createLinearGradient(-90, -60, 60, 60);
  head.addColorStop(0, "#4a4466");
  head.addColorStop(0.6, "#1c1830");
  head.addColorStop(1, "#0a0812");
  ctx.fillStyle = head;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ff8a2a";
  ctx.stroke();
  // Horns
  ctx.fillStyle = "#b45cff";
  poly(ctx, [-20, -56, 10, -120, 18, -60]);
  ctx.fill();
  poly(ctx, [30, -46, 80, -100, 56, -36]);
  ctx.fill();
  // Molten jaw line and eyes
  const jaw = Math.sin(t * 3) * 6;
  ctx.strokeStyle = "#ffd04a";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#ff7a1a";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(-100, 14);
  ctx.lineTo(-40, 20 + jaw);
  ctx.lineTo(10, 30);
  ctx.stroke();
  ctx.fillStyle = "#ff3b3b";
  ctx.beginPath();
  ctx.ellipse(-46, -18, 10, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  if (flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    glowDot(ctx, x, y, 130, "#ffffff", Math.min(0.6, flash * 8));
  }
  ctx.restore();
}

export function drawBossBar(ctx: Ctx, x: number, y: number, ratio: number) {
  const w = 170;
  ctx.fillStyle = "rgba(10,8,30,0.75)";
  ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, "#3ddc84");
  g.addColorStop(1, "#9bff6a");
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 6);
}

// ---------------------------------------------------------------- skill

/** Ornate mirror portal the beam pours out of. */
export function drawPortal(ctx: Ctx, x: number, y: number, t: number, open: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(open, open);
  ctx.globalCompositeOperation = "lighter";
  glowDot(ctx, 0, 0, 150, "#7fd0ff", 0.6);
  ctx.globalCompositeOperation = "source-over";
  // Gold crescent wings
  ctx.fillStyle = "#fff1c8";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-6, s * 70);
    ctx.quadraticCurveTo(-34, s * 140, 4, s * 170);
    ctx.quadraticCurveTo(-10, s * 120, 18, s * 74);
    ctx.closePath();
    ctx.fill();
  }
  // Glass disc with a star pattern
  const glass = ctx.createRadialGradient(0, 0, 4, 0, 0, 74);
  glass.addColorStop(0, "#ffffff");
  glass.addColorStop(0.6, "#9fdcff");
  glass.addColorStop(1, "#4a7bff");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = t * 1.5 + (i * Math.PI * 4) / 7;
    const px = Math.cos(a) * 30;
    const py = Math.sin(a) * 60;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#f6e7c0";
  ctx.beginPath();
  ctx.ellipse(0, 0, 44, 86, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawBeam(ctx: Ctx, x: number, y: number, right: number, t: number, strength: number) {
  const half = BEAM_HALF * (0.85 + Math.sin(t * 40) * 0.05);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const layers: [number, string, number][] = [
    [1.25, "rgba(255,120,220,1)", 0.25],
    [1, "rgba(110,200,255,1)", 0.45],
    [0.55, "rgba(220,245,255,1)", 0.7],
    [0.22, "rgba(255,255,255,1)", 0.95],
  ];
  for (const [k, color, a] of layers) {
    const h = half * k;
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a * strength;
    ctx.fillStyle = g;
    ctx.fillRect(x, y - h, right - x, h * 2);
  }
  // Speed streaks racing down the beam
  ctx.globalAlpha = 0.6 * strength;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 18; i++) {
    const sx = x + ((t * 1600 + i * 137) % (right - x));
    const sy = y + Math.sin(i * 12.9) * half * 0.9;
    ctx.fillRect(sx, sy, 60, 2);
  }
  ctx.restore();
}

export const PICKUP_SIZE = 60;
