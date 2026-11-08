import { mulberry32 } from "@web-games/core/math";
import { BEAST_MAX, FLOOR_Y, type FighterId, H, STATS, W, moveSpec } from "./config";
import { type Fighter, moveStage } from "./logic";

// Procedural chibi fighters on canvas: no image files. A fighter is a small
// skeleton (body, head, two arms, two legs) posed per state and per move, drawn
// with thick rounded strokes. Beast form swaps the head for an animal's and adds
// claws, a tail and a glow. Cartoon impacts only — no blood.

type Ctx = CanvasRenderingContext2D;
/** Handjet: a pixel display face that covers Vietnamese diacritics (most pixel fonts don't). */
export const FONT = '"Handjet", "Baloo 2", system-ui, sans-serif';
const OUTLINE = "#140c10";

/**
 * Pixel-style text: a blocky outline made of copies offset on a 2px grid (not
 * a round stroke), a hard drop shadow, then the fill. Handjet runs narrow, so
 * sizes are scaled up a little to read like the rest of the HUD.
 */
export function text(ctx: Ctx, str: string, x: number, y: number, size: number, fill = "#fff", align: CanvasTextAlign = "center", weight = 800) {
  const px = size >= 40 ? 4 : 2;
  ctx.font = `${weight} ${Math.round(size * 1.18)}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = OUTLINE;
  ctx.fillText(str, x + px, y + px * 2);
  for (const [dx, dy] of [[-px, 0], [px, 0], [0, -px], [0, px], [-px, -px], [px, -px], [-px, px], [px, px]]) ctx.fillText(str, x + dx, y + dy);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

// ---------------------------------------------------------------- stage

/** The arena, painted once: a temple courtyard at dusk with lanterns and a wooden floor. */
export function makeStage(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, "#2a1b4a");
  sky.addColorStop(0.55, "#a8456a");
  sky.addColorStop(1, "#f29a5a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FLOOR_Y);
  // A big low moon
  ctx.fillStyle = "rgba(255,226,170,0.85)";
  ctx.beginPath();
  ctx.arc(720, 170, 70, 0, Math.PI * 2);
  ctx.fill();
  // Mountains
  const rand = mulberry32(11);
  for (const [base, color] of [[300, "#5b2b5a"], [350, "#3e1f44"]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    for (let x = 0; x <= W; x += 60) ctx.lineTo(x, base - rand() * 90);
    ctx.lineTo(W, FLOOR_Y);
    ctx.fill();
  }
  // Temple gate silhouette
  ctx.fillStyle = "#24122a";
  ctx.fillRect(130, 250, 26, FLOOR_Y - 250);
  ctx.fillRect(804, 250, 26, FLOOR_Y - 250);
  ctx.beginPath();
  ctx.moveTo(90, 240);
  ctx.quadraticCurveTo(480, 200, 870, 240);
  ctx.lineTo(870, 262);
  ctx.quadraticCurveTo(480, 224, 90, 262);
  ctx.fill();
  ctx.fillRect(110, 280, 740, 14);
  // Lanterns
  for (const x of [230, 380, 580, 730]) {
    ctx.strokeStyle = "#24122a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 294);
    ctx.lineTo(x, 318);
    ctx.stroke();
    const g = ctx.createRadialGradient(x, 334, 2, x, 334, 34);
    g.addColorStop(0, "rgba(255,190,90,0.55)");
    g.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 34, 300, 68, 68);
    ctx.fillStyle = "#e8402a";
    ctx.beginPath();
    ctx.ellipse(x, 334, 13, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd36b";
    ctx.fillRect(x - 6, 318, 12, 4);
    ctx.fillRect(x - 6, 348, 12, 4);
  }
  // Floor
  const floor = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  floor.addColorStop(0, "#8a5a36");
  floor.addColorStop(1, "#4a2c1a");
  ctx.fillStyle = floor;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.strokeStyle = "rgba(30,14,8,0.35)";
  ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 40, FLOOR_Y);
    ctx.lineTo(W / 2 + i * 120, H);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,220,170,0.25)";
  ctx.fillRect(0, FLOOR_Y, W, 3);
  return c;
}

// ---------------------------------------------------------------- the rig

interface Limb {
  /** Upper segment angle (0 = forward, π/2 = down), joint bend added to it. */
  a: number;
  b: number;
}

interface Pose {
  lean: number;
  /** Body drop (crouch), px. */
  drop: number;
  front: Limb;
  back: Limb;
  legF: Limb;
  legB: Limb;
  /** Whole-body rotation (tumbling), radians. */
  spin: number;
  /** Lying on the floor. */
  lying: boolean;
  head: number;
}

const GUARD: Pose = {
  lean: 0.08,
  drop: 0,
  front: { a: 0.9, b: -1.9 },
  back: { a: 1.4, b: -2.3 },
  legF: { a: 1.25, b: 0.25 },
  legB: { a: 1.9, b: -0.2 },
  spin: 0,
  lying: false,
  head: 0,
};

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const limb = (a: Limb, b: Limb, k: number): Limb => ({ a: mix(a.a, b.a, k), b: mix(a.b, b.b, k) });

/** 0 → 1 → 0 across a move: wind-up to full extension during startup+active, back during recovery. */
function extension(f: Fighter) {
  const m = moveSpec(f.char, f.move ?? "jab");
  const stage = moveStage(f);
  if (stage === "startup") return ease(f.frame / Math.max(1, m.startup)) * 0.85;
  if (stage === "active") return 1;
  return 1 - ease((f.frame - m.startup - m.active) / Math.max(1, m.recovery));
}

export function poseOf(f: Fighter, t: number, guarding: boolean): Pose {
  const p: Pose = structuredClone(GUARD);
  const bob = Math.sin(t * 5 + f.side) * 1.5;
  switch (f.state) {
    case "idle":
    case "getup":
      p.drop = bob + (f.state === "getup" ? Math.max(0, 24 - f.frame) : 0);
      if (guarding) Object.assign(p, { front: { a: -0.2, b: -2.2 }, back: { a: 0.1, b: -2.4 }, lean: -0.05 });
      break;
    case "walk": {
      const k = Math.sin(f.frame * 0.28);
      p.legF = { a: 1.4 + k * 0.45, b: 0.3 };
      p.legB = { a: 1.75 - k * 0.45, b: 0.1 };
      p.drop = Math.abs(k) * 2;
      if (guarding) Object.assign(p, { front: { a: -0.2, b: -2.2 }, back: { a: 0.1, b: -2.4 } });
      break;
    }
    case "crouch":
      p.drop = 30;
      p.legF = { a: 0.55, b: 1.9 };
      p.legB = { a: 2.2, b: -1.6 };
      if (guarding) Object.assign(p, { front: { a: -0.3, b: -2.2 }, back: { a: 0, b: -2.4 } });
      break;
    case "jump":
      p.legF = { a: 0.6, b: 1.8 };
      p.legB = { a: 1.4, b: 1.6 };
      p.front = { a: 0.4, b: -1.2 };
      break;
    case "blockstun":
      Object.assign(p, { front: { a: -0.3, b: -2.2 }, back: { a: 0, b: -2.4 }, lean: -0.15 });
      break;
    case "hitstun":
      p.lean = -0.45;
      p.head = -0.4;
      p.front = { a: 2.4, b: 0.4 };
      p.back = { a: 2.9, b: 0.3 };
      break;
    case "juggle":
    case "ko":
      if (f.y < FLOOR_Y - 2) {
        p.spin = -0.5 - Math.min(1.2, Math.abs(f.vy) * 0.05);
        p.front = { a: 2.6, b: 0.2 };
        p.back = { a: 3.1, b: 0.2 };
        p.legF = { a: 0.9, b: 0.4 };
        p.legB = { a: 1.3, b: 0.5 };
      } else p.lying = true;
      break;
    case "knockdown":
      p.lying = true;
      break;
    case "transform":
      p.lean = -0.3;
      p.front = { a: -1.1, b: -0.3 };
      p.back = { a: -1.5, b: -0.2 };
      p.head = -0.3;
      break;
    case "dizzy":
      p.lean = Math.sin(t * 3) * 0.25;
      p.head = Math.sin(t * 3 + 1) * 0.3;
      p.front = { a: 1.6, b: 0.3 };
      p.back = { a: 1.8, b: 0.2 };
      break;
    case "win":
      p.front = { a: -1.4, b: -0.4 };
      p.back = { a: 1.5, b: -1.9 };
      p.drop = bob;
      break;
    case "attack":
      attackPose(f, p, t);
      break;
  }
  return p;
}

function attackPose(f: Fighter, p: Pose, t: number) {
  const k = extension(f);
  switch (f.move) {
    case "jab":
      p.front = limb(GUARD.front, { a: 0.05, b: 0 }, k);
      p.lean = mix(0.08, 0.2, k);
      break;
    case "kick":
      p.legF = limb(GUARD.legF, { a: 0.15, b: 0 }, k);
      p.lean = mix(0.08, -0.25, k);
      break;
    case "lowJab":
      p.drop = 30;
      p.legF = { a: 0.55, b: 1.9 };
      p.legB = { a: 2.2, b: -1.6 };
      p.front = limb(GUARD.front, { a: 0.35, b: 0 }, k);
      break;
    case "sweep":
      p.drop = 34;
      p.legB = { a: 2.3, b: -1.7 };
      p.legF = limb({ a: 0.55, b: 1.9 }, { a: 1.35, b: 0 }, k);
      p.lean = 0.35;
      break;
    case "airPunch":
      p.front = limb(GUARD.front, { a: 0.7, b: 0 }, k);
      p.legF = { a: 0.7, b: 1.6 };
      p.legB = { a: 1.5, b: 1.4 };
      break;
    case "airKick":
      p.legF = limb({ a: 0.6, b: 1.8 }, { a: 0.75, b: 0 }, k);
      p.legB = { a: 1.4, b: 1.6 };
      p.lean = -0.2;
      break;
    case "rush":
      if (f.char === "soi") {
        // Howl: both palms out
        p.front = limb(GUARD.front, { a: 0.1, b: 0 }, k);
        p.back = limb(GUARD.back, { a: 0.2, b: 0 }, k);
        p.head = -0.35 * k;
      } else {
        p.lean = mix(0.08, 0.55, k);
        p.front = limb(GUARD.front, f.char === "gau" ? { a: 1.2, b: -1.8 } : { a: -0.1, b: 0.2 }, k);
        p.back = limb(GUARD.back, { a: 0.3, b: 0 }, k);
        p.legB = { a: 2.1, b: 0 };
      }
      break;
    case "rising":
      p.front = limb(GUARD.front, { a: -1.45, b: 0 }, k);
      p.legF = { a: 0.9, b: 1.4 };
      p.lean = mix(0.1, -0.15, k);
      break;
    case "third":
      if (f.char === "soi") {
        p.drop = 36;
        p.legF = limb({ a: 0.6, b: 1.8 }, { a: 1.45, b: 0 }, k);
        p.legB = { a: 2.4, b: -1.8 };
        p.lean = -0.5;
      } else if (f.char === "gau") {
        p.front = limb({ a: -1.3, b: 0 }, { a: 1.2, b: 0 }, k);
        p.back = limb({ a: -1.5, b: 0 }, { a: 1.3, b: 0 }, k);
        p.lean = mix(-0.2, 0.5, k);
      } else {
        p.front = { a: -0.3, b: 0.2 };
        p.back = { a: -0.1, b: 0.1 };
        p.legF = { a: 0.8, b: 1.4 };
        p.lean = 0.3;
      }
      break;
    case "frenzy": {
      const swing = Math.sin(f.frame * 0.9);
      p.lean = 0.45;
      p.front = { a: 0.2 + swing * 0.9, b: -0.2 };
      p.back = { a: 0.4 - swing * 0.9, b: -0.2 };
      p.legB = { a: 2.1, b: 0 };
      break;
    }
  }
  void t;
}

const UPPER = 19;
const LOWER = 17;
const THIGH = 21;
const SHIN = 20;

function drawLimb(ctx: Ctx, x: number, y: number, l: Limb, len1: number, len2: number, w: number, color: string, end: string, endR: number, claws = false) {
  const ex = x + Math.cos(l.a) * len1;
  const ey = y + Math.sin(l.a) * len1;
  const hx = ex + Math.cos(l.a + l.b) * len2;
  const hy = ey + Math.sin(l.a + l.b) * len2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.fillStyle = end;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(hx, hy, endR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (claws) {
    const a = l.a + l.b;
    ctx.strokeStyle = "#fff6e0";
    ctx.lineWidth = 2.5;
    for (const off of [-0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a + off) * endR, hy + Math.sin(a + off) * endR);
      ctx.lineTo(hx + Math.cos(a + off) * (endR + 8), hy + Math.sin(a + off) * (endR + 8));
      ctx.stroke();
    }
  }
}

function ears(ctx: Ctx, char: FighterId, r: number, fur: string, inner: string) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.fillStyle = fur;
    ctx.beginPath();
    if (char === "soi") {
      ctx.moveTo(side * r * 0.25, -r * 0.7);
      ctx.lineTo(side * r * 0.85, -r * 1.55);
      ctx.lineTo(side * r * 0.95, -r * 0.45);
    } else {
      ctx.arc(side * r * 0.62, -r * 0.78, r * (char === "gau" ? 0.42 : 0.36), 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = inner;
    ctx.beginPath();
    if (char === "soi") {
      ctx.moveTo(side * r * 0.42, -r * 0.75);
      ctx.lineTo(side * r * 0.8, -r * 1.3);
      ctx.lineTo(side * r * 0.82, -r * 0.6);
    } else ctx.arc(side * r * 0.62, -r * 0.78, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHead(ctx: Ctx, f: Fighter, beast: boolean, r: number, t: number) {
  const pal = STATS[f.char].palette;
  if (beast) ears(ctx, f.char, r, pal.fur, "#ffb8b0");
  ctx.fillStyle = beast ? pal.fur : pal.skin;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (beast) {
    // Stripes for the tiger, a mask for the wolf, a light muzzle for all
    if (f.char === "ho") {
      ctx.strokeStyle = pal.stripe;
      ctx.lineWidth = 3.5;
      for (const sx of [-1, 1])
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(sx * r * 0.95, -r * 0.2 + i * 7 - 6);
          ctx.lineTo(sx * r * 0.55, -r * 0.1 + i * 7 - 6);
          ctx.stroke();
        }
      ctx.beginPath();
      ctx.moveTo(-4, -r * 0.95);
      ctx.lineTo(0, -r * 0.55);
      ctx.lineTo(4, -r * 0.95);
      ctx.stroke();
    }
    if (f.char === "soi") {
      ctx.fillStyle = pal.stripe;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.35, r * 0.85, r * 0.42, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff1dc";
    ctx.beginPath();
    ctx.ellipse(r * 0.42, r * 0.32, r * 0.5, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(r * 0.82, r * 0.18, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glowing eye
    ctx.fillStyle = pal.eye;
    ctx.shadowColor = pal.eye;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(r * 0.3, -r * 0.12, 4.5, 3.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Fangs
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(r * 0.55, r * 0.55);
    ctx.lineTo(r * 0.62, r * 0.8);
    ctx.lineTo(r * 0.7, r * 0.55);
    ctx.fill();
    return;
  }
  // Human: hair cap, headband, eye
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(0, -2, r, Math.PI * 0.95, Math.PI * 2.05);
  ctx.quadraticCurveTo(r * 0.2, -r * 0.35, -r * 0.95, r * 0.1);
  ctx.fill();
  ctx.fillStyle = STATS[f.char].palette.gi;
  ctx.fillRect(-r, -r * 0.42, r * 2, 6);
  const tail = Math.sin(t * 8 + f.side) * 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.4);
  ctx.lineTo(-r * 1.6, -r * 0.2 + tail);
  ctx.lineTo(-r * 1.5, -r * 0.05 + tail);
  ctx.closePath();
  ctx.fill();
  const hurt = f.state === "hitstun" || f.state === "juggle" || f.state === "ko" || f.state === "dizzy";
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = OUTLINE;
  if (hurt) {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.05);
    ctx.lineTo(r * 0.5, r * 0.18);
    ctx.moveTo(r * 0.5, -r * 0.05);
    ctx.lineTo(r * 0.2, r * 0.18);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(r * 0.38, r * 0.05, 3, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(r * 0.2, r * 0.48);
  ctx.lineTo(r * 0.55, r * (f.state === "attack" ? 0.42 : 0.5));
  ctx.stroke();
}

/** Draw a fighter with its feet at (f.x, f.y). `guarding` = holding back (arms up). */
export function drawFighter(ctx: Ctx, f: Fighter, t: number, guarding: boolean) {
  const pal = STATS[f.char].palette;
  const beast = f.beastLeft > 0 || (f.state === "transform" && f.frame > 20);
  const p = poseOf(f, t, guarding);
  const scale = beast ? 1.12 : 1;
  ctx.save();
  ctx.translate(f.x, f.y);
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, FLOOR_Y - f.y + 2, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(f.facing * scale, scale);
  if (p.lying) {
    ctx.translate(-10, -10);
    ctx.rotate(-Math.PI / 2 + 0.12);
    ctx.translate(0, 34);
  }
  if (p.spin) {
    ctx.translate(0, -60);
    ctx.rotate(p.spin);
    ctx.translate(0, 60);
  }
  if (beast) {
    // Aura and a tail
    const g = ctx.createRadialGradient(0, -70, 10, 0, -70, 90);
    g.addColorStop(0, `${pal.eye}55`);
    g.addColorStop(1, `${pal.eye}00`);
    ctx.fillStyle = g;
    ctx.fillRect(-90, -160, 180, 180);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    const wag = Math.sin(t * 6) * 6;
    ctx.beginPath();
    ctx.moveTo(-14, -48);
    ctx.quadraticCurveTo(-46, -52 + wag, -50, -78 + wag);
    ctx.stroke();
    ctx.strokeStyle = pal.fur;
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  const hipY = -44 + p.drop;
  const hipX = 0;
  // Back limbs first
  drawLimb(ctx, hipX - 4, hipY, p.legB, THIGH, SHIN, 11, pal.gi, OUTLINE, 6);
  const shX = Math.sin(p.lean) * 30;
  const shY = hipY - Math.cos(p.lean) * 30;
  drawLimb(ctx, shX - 5, shY + 2, p.back, UPPER, LOWER, 9, beast ? pal.fur : pal.gi, beast ? pal.fur : pal.skin, 6.5, beast);
  // Body (a rounded gi)
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(p.lean);
  ctx.fillStyle = beast ? pal.fur : pal.gi;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(-15, -36, 30, 40, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.belt;
  ctx.fillRect(-15, -6, 30, 6);
  if (!beast) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -34);
    ctx.lineTo(6, -12);
    ctx.stroke();
  } else if (f.char === "ho") {
    ctx.strokeStyle = pal.stripe;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-14, -30 + i * 9);
      ctx.lineTo(-4, -27 + i * 9);
      ctx.stroke();
    }
  }
  ctx.restore();
  drawLimb(ctx, hipX + 4, hipY, p.legF, THIGH, SHIN, 11, pal.gi, OUTLINE, 6);
  // Head
  ctx.save();
  ctx.translate(shX + Math.sin(p.lean) * 6, shY - 20);
  ctx.rotate(p.head + p.lean * 0.4);
  drawHead(ctx, f, beast, 22, t);
  ctx.restore();
  drawLimb(ctx, shX + 5, shY + 2, p.front, UPPER, LOWER, 9, beast ? pal.fur : pal.gi, beast ? pal.fur : pal.skin, 6.5, beast);
  ctx.restore();

  if (f.state === "dizzy") {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      star(ctx, f.x + Math.cos(a) * 26, f.y - 148 + Math.sin(a) * 7, 7, "#ffe14a");
    }
  }
}

function star(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------- effects

/** A cartoon impact: a burst of rays and a white core. Blue and smaller when blocked. */
export function drawSpark(ctx: Ctx, x: number, y: number, k: number, kind: "hit" | "heavy" | "block") {
  const size = kind === "heavy" ? 46 : kind === "hit" ? 34 : 26;
  const color = kind === "block" ? "#7ad8ff" : kind === "heavy" ? "#ffd23a" : "#fff0a0";
  const r = size * (0.5 + k * 0.8);
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 + k;
    const rr = i % 2 ? r * 0.35 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The wolf's howl: a pale crescent of sound. */
export function drawWave(ctx: Ctx, x: number, y: number, dir: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(160,235,255,${0.9 - i * 0.28})`;
    ctx.lineWidth = 7 - i * 2;
    ctx.beginPath();
    ctx.arc(-i * 12, 0, 24 + Math.sin(t * 20 + i) * 3, -1.1, 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** The transform: a ring of light expanding from the fighter. */
export function drawRing(ctx: Ctx, x: number, y: number, k: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = color;
  ctx.lineWidth = 10 * (1 - k) + 2;
  ctx.beginPath();
  ctx.arc(x, y, 30 + k * 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- HUD

/** The pixel UI kit (img/px/ui.webp + ui.json): element rects in true pixels, drawn at 2x. */
export interface UiKit {
  img: HTMLImageElement;
  rects: Record<string, { x: number; y: number; w: number; h: number }>;
}

/** Draw one UI-kit element with its top-left at (x, y), at 2x, optionally mirrored. */
export function drawUi(ctx: Ctx, ui: UiKit, name: string, x: number, y: number, flip = false, scale = 2) {
  const r = ui.rects[name];
  if (!r) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x + (flip ? r.w * scale : 0)), Math.round(y));
  ctx.scale(flip ? -scale : scale, scale);
  ctx.drawImage(ui.img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  ctx.restore();
}

/** A flat two-tone pixel bar: no gradient, a light band on top. */
function pixelBar(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, light: string) {
  if (w <= 0) return;
  const X = Math.round(x / 2) * 2;
  const Wd = Math.max(2, Math.round(w / 2) * 2);
  ctx.fillStyle = fill;
  ctx.fillRect(X, y, Wd, h);
  ctx.fillStyle = light;
  ctx.fillRect(X, y, Wd, Math.max(2, Math.round(h / 3 / 2) * 2));
}

/** A hard-edged pixel panel: black edge, light rim, flat fill (no rounded corners). */
export function pixelPanel(ctx: Ctx, x: number, y: number, w: number, h: number, fill = "#1a1020", rim = "#5a4468") {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = rim;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

export function drawHud(ctx: Ctx, fighters: [Fighter, Fighter], names: [string, string], timer: number, left: number, right: number, top: number, ui: UiKit | null) {
  // Inner slots of the kit's frames, measured from ui.webp (fractions of each frame)
  const SLOT = { l: 0.24, r: 0.113, t: 0.297, b: 0.297 };
  const METER = { l: 0.2, r: 0.11, t: 0.235, b: 0.235 };
  const hr = ui?.rects.health;
  const barW = hr ? hr.w * 2 : Math.min(360, (right - left) / 2 - 70);
  const barH = hr ? hr.h * 2 : 24;
  for (const f of fighters) {
    const flip = f.side === 1;
    const x0 = flip ? right - 16 - barW : left + 16;
    const y0 = top + 6;
    const k = Math.max(0, f.hp / f.maxHp);
    const low = k <= 0.3;
    // Slot rect inside the frame, mirrored for P2
    const sl = flip ? SLOT.r : SLOT.l;
    const sr = flip ? SLOT.l : SLOT.r;
    const sx = x0 + barW * sl;
    const sw = barW * (1 - sl - sr);
    const sy = y0 + barH * SLOT.t;
    const sh = Math.max(6, barH * (1 - SLOT.t - SLOT.b));
    if (ui) drawUi(ctx, ui, "health", x0, y0, flip);
    else pixelPanel(ctx, sx, sy, sw, sh, "#2a1414", "#8a6a3a");
    // Health drains toward the outside, so what is left stays near the timer
    const w = sw * k;
    pixelBar(ctx, flip ? sx : sx + sw - w, sy, w, sh, low ? "#e8402a" : "#f2b21a", low ? "#ff8a6a" : "#ffe46a");
    text(ctx, names[f.side], flip ? x0 + barW : x0, y0 + barH + 10, 17, "#fff", flip ? "right" : "left");
    // Round wins
    for (let i = 0; i < 2; i++) {
      const px = flip ? x0 + 6 + i * 26 : x0 + barW - 26 - i * 26;
      const py = y0 + barH + 2;
      if (ui) drawUi(ctx, ui, i < f.wins ? "gem" : "gemOff", px, py);
      else {
        ctx.fillStyle = i < f.wins ? "#ffd23a" : "#3a3040";
        ctx.fillRect(px, py, 16, 16);
      }
    }
    // Beast meter
    const mr = ui?.rects.meter;
    const mw = mr ? mr.w * 2 : barW * 0.6;
    const mh = mr ? mr.h * 2 : 12;
    const mx = flip ? x0 + barW - mw : x0;
    const my = y0 + barH + 24;
    const ml = flip ? METER.r : METER.l;
    const mrr = flip ? METER.l : METER.r;
    const inX = mx + mw * ml;
    const inW = mw * (1 - ml - mrr);
    const inY = my + mh * METER.t;
    const inH = Math.max(4, mh * (1 - METER.t - METER.b));
    if (ui) drawUi(ctx, ui, "meter", mx, my, flip);
    else pixelPanel(ctx, inX, inY, inW, inH, "#1a1020", "#5a4468");
    const full = f.beast >= BEAST_MAX || f.beastLeft > 0;
    const bw = (inW * f.beast) / BEAST_MAX;
    pixelBar(ctx, flip ? inX + inW - bw : inX, inY, bw, inH, full ? STATS[f.char].palette.eye : "#a24ae8", full ? "#ffffff" : "#d29aff");
  }
  // Timer
  const secs = Math.max(0, Math.ceil(timer / 60));
  const tr = ui?.rects.timer;
  if (ui && tr) drawUi(ctx, ui, "timer", W / 2 - tr.w, top + 4);
  else pixelPanel(ctx, W / 2 - 32, top + 8, 64, 48);
  // Centred in the medallion's dark face (measured: 22.6% from the top, 19.4% from the bottom)
  const faceY = tr ? (tr.h * 0.226 + (tr.h * (1 - 0.226 - 0.194)) / 2) * 2 : 28;
  text(ctx, String(secs), W / 2, top + 4 + faceY, 26, secs <= 10 ? "#ff7a5a" : "#fff");
}

// ---------------------------------------------------------------- touch controls

export interface TouchLayout {
  stick: { x: number; y: number; r: number };
  buttons: { id: "P" | "K" | "S" | "B"; x: number; y: number; r: number }[];
}

export function touchLayout(left: number, right: number, bottom: number): TouchLayout {
  return {
    stick: { x: left + 110, y: bottom - 110, r: 62 },
    buttons: [
      { id: "P", x: right - 175, y: bottom - 70, r: 38 },
      { id: "K", x: right - 80, y: bottom - 110, r: 38 },
      { id: "S", x: right - 190, y: bottom - 165, r: 34 },
      { id: "B", x: right - 92, y: bottom - 205, r: 34 },
    ],
  };
}

/** `active` is the floating stick under the thumb (centre + knob); idle, it rests at its home spot. */
export function drawTouch(
  ctx: Ctx,
  layout: TouchLayout,
  active: { ox: number; oy: number; x: number; y: number } | null,
  held: Set<string>,
  labels: Record<string, string>,
  beastReady: boolean,
  t: number,
  ui: UiKit | null = null,
) {
  const s = active ? { ...layout.stick, x: active.ox, y: active.oy } : layout.stick;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const k = active ?? { x: s.x, y: s.y };
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(k.x, k.y, 26, 0, Math.PI * 2);
  ctx.fill();
  const colors: Record<string, string> = { P: "#ff8a3a", K: "#4ab8ff", S: "#b06aff", B: "#ffd23a" };
  const icon: Record<string, string> = { P: "punch", K: "kick", S: "special", B: "beast" };
  for (const b of layout.buttons) {
    const on = held.has(b.id);
    const r = ui?.rects[icon[b.id]];
    if (ui && r) {
      // The kit's round buttons, scaled to the hit circle; pressed ones dip
      const scale = (b.r * 2) / r.w;
      ctx.save();
      ctx.globalAlpha = on ? 1 : b.id === "B" && beastReady ? 0.8 + Math.sin(t * 8) * 0.2 : 0.82;
      drawUi(ctx, ui, icon[b.id], b.x - b.r, b.y - b.r + (on ? 3 : 0), false, scale);
      ctx.restore();
      continue;
    }
    const pulse = b.id === "B" && beastReady ? 0.5 + Math.sin(t * 8) * 0.5 : 0;
    ctx.save();
    ctx.globalAlpha = 0.55 + (on ? 0.35 : 0) + pulse * 0.2;
    ctx.fillStyle = colors[b.id];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * (on ? 0.94 : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text(ctx, labels[b.id], b.x, b.y + 1, b.r > 35 ? 17 : 15, "#fff");
  }
}

// ---------------------------------------------------------------- pixel sprites

/**
 * The 20 poses in each fighter-form atlas (img/px/<id>-<form>.webp), in the
 * order of the two generated pose sheets: sheet A then sheet B.
 */
export const POSE = {
  idle: 0,
  idle2: 1,
  walk1: 2,
  walk2: 3,
  crouch: 4,
  jump: 5,
  jab: 6,
  kick: 7,
  lowJab: 8,
  sweep: 9,
  airKick: 10,
  rush: 11,
  rising: 12,
  third: 13,
  frenzy: 14,
  hit: 15,
  block: 16,
  down: 17,
  win: 18,
  /** Human: dizzy. Beast: the transformation roar. */
  last: 19,
} as const;

/** Atlas cells, set by the normalization step: 144×112 true pixels, feet at (60, 109), drawn at 2×. */
export const CELL = { w: 144, h: 112, ax: 60, by: 109, cols: 10, scale: 2 };

/** The effects atlas (img/px/effects.webp): ten 96×96 cells. */
export const FX = { size: 96, spark: 0, bigSpark: 1, block: 2, claw: 3, wave: 4, dust: 5, aura: 6, burst: 7, puff: 8, spin: 9 };

/** Which pose shows for a fighter's state and move right now. */
export function poseFor(f: Fighter, guarding: boolean, t: number): number {
  const breathe = Math.floor(t * 2.2 + f.side * 0.5) % 2 === 0;
  switch (f.state) {
    case "idle":
      return guarding ? POSE.block : breathe ? POSE.idle : POSE.idle2;
    case "getup":
      return f.frame < 10 ? POSE.crouch : POSE.idle;
    case "walk":
      return guarding ? POSE.block : Math.floor(f.frame / 9) % 2 === 0 ? POSE.walk1 : POSE.walk2;
    case "crouch":
      return guarding ? POSE.block : POSE.crouch;
    case "jump":
      return POSE.jump;
    case "blockstun":
      return POSE.block;
    case "hitstun":
      return POSE.hit;
    case "juggle":
    case "ko":
      return f.y < FLOOR_Y - 2 ? POSE.hit : POSE.down;
    case "knockdown":
      return POSE.down;
    case "transform":
      return f.frame > 12 ? POSE.last : POSE.block;
    case "dizzy":
      return POSE.last;
    case "win":
      return POSE.win;
    case "attack":
      switch (f.move) {
        case "jab":
          return POSE.jab;
        case "kick":
          return POSE.kick;
        case "lowJab":
          return POSE.lowJab;
        case "sweep":
          return POSE.sweep;
        case "airPunch":
        case "airKick":
          return POSE.airKick;
        case "rush":
          return POSE.rush;
        case "rising":
          return POSE.rising;
        case "third":
          return POSE.third;
        case "frenzy":
          return POSE.frenzy;
      }
  }
  return POSE.idle;
}

/**
 * A fighter from its pixel atlas: feet at (f.x, f.y), mirrored when facing
 * left. Attacks lunge a couple of pixels on their active frames, so a hit reads
 * as a hit even with one pose per move.
 */
export function drawSprite(ctx: Ctx, atlas: HTMLImageElement, f: Fighter, pose: number, t: number, fx: HTMLImageElement | null) {
  const beast = f.beastLeft > 0;
  ctx.save();
  // Shadow on the floor
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(f.x, FLOOR_Y + 2, 34, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  if (beast && fx) {
    // A flickering aura behind the beast
    ctx.globalAlpha = 0.45 + Math.sin(t * 9) * 0.15;
    const s = 2.2;
    ctx.drawImage(fx, FX.aura * FX.size, 0, FX.size, FX.size, f.x - (FX.size * s) / 2, f.y - FX.size * s + 20, FX.size * s, FX.size * s);
    ctx.globalAlpha = 1;
  }
  const lunge = f.state === "attack" && moveStage(f) === "active" ? 6 : 0;
  const recoil = f.state === "hitstun" ? -Math.max(0, 8 - f.frame) : 0;
  let spin = 0;
  if ((f.state === "juggle" || f.state === "ko") && f.y < FLOOR_Y - 2) spin = -Math.min(1.1, 0.4 + Math.abs(f.vy) * 0.06);
  ctx.translate(f.x + f.facing * (lunge + recoil), f.y);
  ctx.scale(f.facing * CELL.scale, CELL.scale);
  if (spin) {
    ctx.translate(0, -30);
    ctx.rotate(spin);
    ctx.translate(0, 30);
  }
  const sx = (pose % CELL.cols) * CELL.w;
  const sy = Math.floor(pose / CELL.cols) * CELL.h;
  ctx.drawImage(atlas, sx, sy, CELL.w, CELL.h, -CELL.ax, -CELL.by, CELL.w, CELL.h);
  ctx.restore();
  if (f.state === "dizzy") {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      star(ctx, f.x + Math.cos(a) * 26, f.y - 140 + Math.sin(a) * 7, 7, "#ffe14a");
    }
  }
}

/** One cell of the effects atlas centred at (x, y), `k` 0→1 over its life. */
export function drawFx(ctx: Ctx, fx: HTMLImageElement, cell: number, x: number, y: number, k: number, scale = 1.6, flip = 1) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = Math.max(0, 1 - k);
  const s = scale * (0.8 + k * 0.5);
  ctx.translate(x, y);
  ctx.scale(flip * s, s);
  ctx.drawImage(fx, cell * FX.size, 0, FX.size, FX.size, -FX.size / 2, -FX.size / 2, FX.size, FX.size);
  ctx.restore();
}
