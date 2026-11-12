import { easeOutCubic } from "@web-games/core/math";
import { drawStormSheet } from "./storm-sheet";
import { DRAGON_STORM, KNIFE_EFFECTS } from "./config";

const { color, accent } = KNIFE_EFFECTS.dragon;
const TAU = Math.PI * 2;

/** Re-stroke one path instead of using animated blur or allocating glow textures. */
function electricStroke(c: CanvasRenderingContext2D, alpha: number, width = 1) {
  const inherited = c.globalAlpha;
  c.strokeStyle = color;
  c.lineWidth = width * 8;
  c.globalAlpha = inherited * alpha * 0.08;
  c.stroke();
  c.lineWidth = width * 3;
  c.globalAlpha = inherited * alpha * 0.3;
  c.stroke();
  c.strokeStyle = accent;
  c.lineWidth = width;
  c.globalAlpha = inherited * alpha;
  c.stroke();
  c.globalAlpha = inherited;
}

/** Coordinates are knife-local. Only the ready knife / shop preview gets the full charging halo. */
export function dragonCharge(
  c: CanvasRenderingContext2D,
  time: number,
  power: number,
) {
  if (power < 0.6) return;
  c.save();
  c.globalCompositeOperation = "lighter";
  const breath = 0.7 + Math.sin(time * 2) * 0.12;
  c.translate(0, -5);
  for (const direction of [-1, 1]) {
    c.save();
    c.rotate(direction * 0.25 + Math.sin(time * 0.7) * 0.12);
    c.beginPath();
    c.ellipse(
      0,
      0,
      15,
      39,
      0,
      time * direction,
      time * direction + Math.PI * 1.35,
    );
    electricStroke(c, power * breath * 0.48, 0.55);
    c.restore();
  }
  for (let i = 0; i < 3; i++) {
    const a = time * 1.7 + (i * TAU) / 3;
    const x = Math.cos(a) * 15;
    const y = Math.sin(a) * 37;
    c.fillStyle = accent;
    c.globalAlpha *= 0.7;
    c.beginPath();
    c.moveTo(x, y - 1.8);
    c.lineTo(x + 1, y);
    c.lineTo(x, y + 1.8);
    c.lineTo(x - 1, y);
    c.closePath();
    c.fill();
    c.globalAlpha /= 0.7;
  }
  c.restore();
}

/** A live white-violet current travels along the blade; no random full-frame flashing. */
export function dragonBlade(
  c: CanvasRenderingContext2D,
  time: number,
  power: number,
) {
  c.save();
  c.globalCompositeOperation = "lighter";
  c.beginPath();
  c.moveTo(0, -37);
  for (let i = 1; i <= 9; i++) {
    const wave = Math.sin(i * 2.6 + time * 7) * Math.sin((i / 9) * Math.PI);
    c.lineTo(wave * 6, -37 + i * 5.8);
  }
  electricStroke(c, power * 0.7, 0.7);
  if (power >= 0.6) {
    const y = -35 + ((time * 0.35) % 1) * 38;
    c.strokeStyle = accent;
    c.lineWidth = 1;
    c.globalAlpha *= 0.6;
    c.beginPath();
    c.moveTo(-3, y + 2);
    c.lineTo(3, y - 2);
    c.stroke();
  }
  c.restore();
}

/** Persistent wake makes a 60 ms shot readable without slowing the physical knife. */
export function stormWake(
  c: CanvasRenderingContext2D,
  x: number,
  fromY: number,
  toY: number,
  age: number,
  seed: number,
) {
  const k = Math.min(1, age / DRAGON_STORM.wakeLife);
  if (k >= 1) return;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.lineJoin = "round";
  const alpha = (1 - k) ** 2 * 0.72;
  c.beginPath();
  c.moveTo(x, fromY);
  const count = 12;
  for (let i = 1; i <= count; i++) {
    const u = i / count;
    const dx = Math.sin(i * 2.7 + seed + age * 14) * Math.sin(u * Math.PI) * 14;
    const y = fromY + (toY - fromY) * u;
    c.lineTo(x + dx, y);
    if (i === 4 || i === 8) {
      const side = i === 4 ? -1 : 1;
      c.lineTo(x + dx + side * 15, y + 6);
      c.lineTo(x + dx + side * 9, y + 15);
      c.moveTo(x + dx, y);
    }
  }
  electricStroke(c, alpha, 1.15);
  // Two faint tapered ribbons give the bolt volume without a full-screen glow.
  c.globalAlpha *= alpha * 0.15;
  c.strokeStyle = color;
  c.lineWidth = 3;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(x, fromY);
    c.bezierCurveTo(
      x + side * 26,
      fromY + 35,
      x + side * 20,
      toY - 30,
      x + side * 4,
      toY,
    );
    c.stroke();
  }
  c.restore();
}

/** A local impact seal: expanding broken rings, radial branches, then lingering shards. */
export function stormImpact(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  age: number,
  sheet?: HTMLImageElement,
) {
  if (drawStormSheet(c, sheet, x, y, age)) return;
  const k = Math.min(1, age / DRAGON_STORM.impactLife);
  if (k >= 1) return;
  const radius = 7 + easeOutCubic(k) * 43;
  const fade = (1 - k) ** 2;
  c.save();
  c.translate(x, y);
  c.globalCompositeOperation = "lighter";
  c.beginPath();
  for (let ring = 0; ring < 2; ring++) {
    const r = radius + ring * 6;
    for (let arc = 0; arc < 3; arc++) {
      const a = (arc * TAU) / 3 + age * (ring ? -2 : 2);
      c.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.55);
      c.ellipse(0, 0, r, r * 0.55, 0, a, a + 1.5);
    }
  }
  electricStroke(c, fade * 0.8, 1);
  c.beginPath();
  for (let ray = 0; ray < 6; ray++) {
    const a = (ray * TAU) / 6 + 0.2;
    for (let segment = 0; segment <= 4; segment++) {
      const length = radius * (0.45 + segment * 0.2);
      const bend = segment % 2 ? 0.15 : -0.08;
      const px = Math.cos(a + bend) * length;
      const py = Math.sin(a + bend) * length * 0.65;
      if (segment === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
  }
  electricStroke(c, fade * 0.65, 0.8);
  if (k < 0.35) {
    const core = (1 - k / 0.35) * 7;
    c.fillStyle = accent;
    c.globalAlpha *= 0.55;
    c.beginPath();
    c.moveTo(0, -core);
    c.lineTo(core * 0.5, 0);
    c.lineTo(0, core);
    c.lineTo(-core * 0.5, 0);
    c.closePath();
    c.fill();
  }
  c.restore();
}
