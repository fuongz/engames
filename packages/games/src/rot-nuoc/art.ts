import { COLORS } from "./config";
import { mulberry32 } from "./logic";

// Procedural art in the ad's palette: charcoal background with faint doodles,
// glossy yellow buttons, glass tubes with flat-coloured layers whose surfaces
// stay level when a tube tilts to pour.

type Ctx = CanvasRenderingContext2D;
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

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
  ctx.strokeStyle = "rgba(10,10,14,0.85)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

// ---------------------------------------------------------------- background

/** Charcoal with faint hand-drawn doodles (ad), tiled. */
export function makeBackdrop(): HTMLCanvasElement {
  const size = 360;
  const canvas = document.createElement("canvas");
  canvas.width = size * 2;
  canvas.height = size * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(2, 2);
  ctx.fillStyle = "#222224";
  ctx.fillRect(0, 0, size, size);
  const rng = mulberry32(3);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 10 + rng() * 14;
    const kind = Math.floor(rng() * 5);
    ctx.beginPath();
    if (kind === 0)
      ctx.arc(x, y, r, 0, Math.PI * 2); // sun / ball
    else if (kind === 1) {
      // star
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rr = k % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
    } else if (kind === 2) {
      // umbrella
      ctx.arc(x, y, r, Math.PI, 0);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + r);
      ctx.arc(x - 3, y + r, 3, 0, Math.PI);
    } else if (kind === 3) {
      // heart
      ctx.moveTo(x, y + r * 0.7);
      ctx.bezierCurveTo(
        x - r * 1.2,
        y - r * 0.2,
        x - r * 0.4,
        y - r,
        x,
        y - r * 0.3,
      );
      ctx.bezierCurveTo(
        x + r * 0.4,
        y - r,
        x + r * 1.2,
        y - r * 0.2,
        x,
        y + r * 0.7,
      );
    } else {
      // wave
      ctx.moveTo(x - r, y);
      for (let k = 0; k <= 4; k++)
        ctx.quadraticCurveTo(
          x - r + k * r * 0.5 - r * 0.25,
          y + (k % 2 ? 6 : -6),
          x - r + k * r * 0.5,
          y,
        );
    }
    ctx.stroke();
  }
  return canvas;
}

export function drawBackdrop(
  ctx: Ctx,
  tile: HTMLCanvasElement,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  const s = 360;
  for (let y = Math.floor(top / s) * s; y < bottom; y += s) {
    for (let x = Math.floor(left / s) * s; x < right; x += s)
      ctx.drawImage(tile, x, y, s + 1, s + 1);
  }
}

// ---------------------------------------------------------------- buttons

/** ad: glossy yellow rounded buttons with a dark outline. */
export function yellowButton(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  enabled: boolean,
) {
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.45;
  ctx.fillStyle = "#3a2a06";
  ctx.beginPath();
  ctx.roundRect(x, y + 3, w, h, 12);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#ffe25a");
  g.addColorStop(1, "#f4b010");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#2a1e04";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 4, w - 12, h * 0.28, 6);
  ctx.fill();
  ctx.restore();
}

export type Glyph = "undo" | "restart" | "tube";

export function glyph(ctx: Ctx, kind: Glyph, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#2a1e04";
  ctx.fillStyle = "#2a1e04";
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "undo") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.15);
    ctx.lineTo(s * 0.15, -s * 0.15);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.15, s * 0.45, s * 0.12);
    ctx.quadraticCurveTo(s * 0.45, s * 0.38, s * 0.15, s * 0.38);
    ctx.lineTo(-s * 0.05, s * 0.38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 0.15);
    ctx.lineTo(-s * 0.18, -s * 0.38);
    ctx.lineTo(-s * 0.18, s * 0.08);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "restart") {
    for (const dir of [1, -1]) {
      ctx.beginPath();
      ctx.arc(
        0,
        0,
        s * 0.32,
        dir > 0 ? Math.PI * 1.1 : Math.PI * 0.1,
        dir > 0 ? Math.PI * 1.9 : Math.PI * 0.9,
      );
      ctx.stroke();
      const ax = dir * s * 0.3;
      const ay = dir * -s * 0.12;
      ctx.beginPath();
      ctx.moveTo(ax + dir * s * 0.12, ay);
      ctx.lineTo(ax - dir * s * 0.06, ay - dir * s * 0.16);
      ctx.lineTo(ax - dir * s * 0.1, ay + dir * s * 0.08);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // "+" and a small tube
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, 0);
    ctx.lineTo(-s * 0.12, 0);
    ctx.moveTo(-s * 0.27, -s * 0.15);
    ctx.lineTo(-s * 0.27, s * 0.15);
    ctx.stroke();
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(s * 0.04, -s * 0.38);
    ctx.lineTo(s * 0.04, s * 0.22);
    ctx.arc(s * 0.19, s * 0.22, s * 0.15, Math.PI, 0, true);
    ctx.lineTo(s * 0.34, -s * 0.38);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- gift

/** ad: an orange gift box with a purple bow and a "Claim" tag. `fill` is progress 0..1. */
export function drawGift(
  ctx: Ctx,
  x: number,
  y: number,
  fill: number,
  ready: boolean,
  label: string,
  t: number,
) {
  const bob = ready ? Math.sin(t * 5) * 3 : 0;
  ctx.save();
  ctx.translate(x, y + bob);
  if (ready) {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
    g.addColorStop(0, "rgba(255,230,120,0.55)");
    g.addColorStop(1, "rgba(255,230,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-44, -44, 88, 88);
  }
  ctx.globalAlpha = ready ? 1 : 0.85;
  ctx.fillStyle = "#e86a22";
  ctx.beginPath();
  ctx.roundRect(-20, -8, 40, 30, 4);
  ctx.fill();
  ctx.fillStyle = "#f4883a";
  ctx.fillRect(-23, -14, 46, 9);
  ctx.fillStyle = "#8a3ad0";
  ctx.fillRect(-4, -14, 8, 36);
  ctx.beginPath();
  ctx.ellipse(-8, -18, 9, 6, -0.5, 0, Math.PI * 2);
  ctx.ellipse(8, -18, 9, 6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Tag: "Claim" when ready, progress bar otherwise
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(-26, 20, 52, 16, 8);
  ctx.fill();
  if (ready) {
    ctx.font = `800 11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#c8302a";
    ctx.fillText(label, 0, 28.5);
  } else {
    ctx.fillStyle = "#e0e0e6";
    ctx.beginPath();
    ctx.roundRect(-20, 25, 40, 6, 3);
    ctx.fill();
    ctx.fillStyle = "#5ad270";
    ctx.beginPath();
    ctx.roundRect(-20, 25, Math.max(6, 40 * fill), 6, 3);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- tubes

export const TUBE_W = 46;
export const UNIT_H = 38;
export const MOUTH_H = 18;
export const tubeLength = (capacity: number) => MOUTH_H + capacity * UNIT_H;

/** Liquid layers, bottom to top; `amount` may be fractional while pouring. */
export interface Layer {
  color: number;
  amount: number;
}

function tubePath(ctx: Ctx, len: number, inset: number) {
  const r = TUBE_W / 2 - inset;
  ctx.beginPath();
  ctx.moveTo(-r, inset);
  ctx.lineTo(-r, len - TUBE_W / 2);
  ctx.arc(0, len - TUBE_W / 2, r, Math.PI, 0, true);
  ctx.lineTo(r, inset);
}

/**
 * A tube drawn from its mouth: (x, y) is the top centre of the opening and the
 * tube hangs down from there, rotated by `angle` (radians) about that point.
 * Liquid surfaces stay horizontal in screen space whatever the tilt.
 */
export function drawTube(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  layers: Layer[],
  capacity: number,
  selected: boolean,
) {
  const len = tubeLength(capacity);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Glass
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  tubePath(ctx, len, 0);
  ctx.closePath();
  ctx.fill();
  // Liquid, clipped to the inside of the glass
  ctx.save();
  tubePath(ctx, len, 3);
  ctx.closePath();
  ctx.clip();
  ctx.rotate(-angle);
  // Lowest point of the rounded bottom, in this level frame
  const cx = -Math.sin(angle) * (len - TUBE_W / 2);
  const cy = Math.cos(angle) * (len - TUBE_W / 2);
  const bottom = cy + TUBE_W / 2;
  // A tilted tube is wider across, so each unit of liquid stands shorter
  const squash = Math.max(0.32, Math.cos(angle));
  let level = bottom;
  for (const l of layers) {
    if (l.amount <= 0) continue;
    const h = l.amount * UNIT_H * squash;
    ctx.fillStyle = COLORS[l.color];
    ctx.fillRect(cx - 200, level - h, 400, h + 0.6);
    level -= h;
  }
  ctx.restore();
  // Rim and glass outline (ad: light grey)
  ctx.lineWidth = 3;
  ctx.strokeStyle = selected ? "#ffffff" : "#b8bac4";
  tubePath(ctx, len, 0);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(-TUBE_W / 2 + 6, 8, 4, len - TUBE_W / 2 - 6);
  ctx.restore();
}

/** The colour stream falling from a tilted tube's lip into the target. */
export function drawStream(
  ctx: Ctx,
  x: number,
  y0: number,
  y1: number,
  color: number,
  width: number,
) {
  ctx.fillStyle = COLORS[color];
  ctx.fillRect(x - width / 2, y0, width, Math.max(0, y1 - y0));
}

export const CONFETTI = [
  "#ffd43a",
  "#ec5c78",
  "#4aa0e8",
  "#5ad270",
  "#7a2fa0",
  "#ec8838",
];
