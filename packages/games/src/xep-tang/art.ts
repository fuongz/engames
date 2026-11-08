// Drawing for Xếp Tầng: an isometric camera, flat three-face slabs, the sky
// that turns from dawn to night as the tower climbs, and the few UI pieces.
import { type Rect, clamp, lerp, smoothstep } from "@web-games/core";
import { SCALE, SKY_FLOORS, W } from "./config";
import type { Box } from "./logic";

export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

// ---------------------------------------------------------------- camera

const C = Math.cos(Math.PI / 6);

export interface Camera {
  /** World height that sits on `anchorY`. */
  focusY: number;
  zoom: number;
  anchorY: number;
  /** Screen nudge in logical px (landing thump, miss shake). */
  dx: number;
  dy: number;
}

export function project(cam: Camera, x: number, y: number, z: number) {
  const s = SCALE * cam.zoom;
  return {
    x: W / 2 + cam.dx + (x - z) * C * s,
    y: cam.anchorY + cam.dy + ((x + z) * 0.5 - (y - cam.focusY)) * s,
  };
}

// ---------------------------------------------------------------- slabs

/** The three faces of a slab of hue `h`: lit top, softer front-left, shaded front-right. */
export function faces(h: number, dim = 0) {
  return {
    top: `hsl(${h} 64% ${72 - dim}%)`,
    left: `hsl(${h} 52% ${58 - dim}%)`,
    right: `hsl(${h} 48% ${46 - dim}%)`,
    edge: `hsl(${h} 80% ${86 - dim}%)`,
  };
}

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** One slab from height y0 to y1, footprint `b`. */
export function drawSlab(ctx: CanvasRenderingContext2D, cam: Camera, b: Box, y0: number, y1: number, h: number, dim = 0) {
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const z0 = b.z - b.d / 2;
  const z1 = b.z + b.d / 2;
  const p = (x: number, y: number, z: number) => project(cam, x, y, z);
  const f = faces(h, dim);
  // Front-right face (+x), front-left face (+z), then the top
  poly(ctx, [p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1), p(x1, y0, z0)], f.right);
  poly(ctx, [p(x0, y1, z1), p(x1, y1, z1), p(x1, y0, z1), p(x0, y0, z1)], f.left);
  const top = [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)];
  poly(ctx, top, f.top);
  // A hairline of light on the two front edges of the top
  ctx.strokeStyle = f.edge;
  ctx.lineWidth = Math.max(0.6, 1.2 * cam.zoom);
  ctx.beginPath();
  ctx.moveTo(top[3].x, top[3].y);
  ctx.lineTo(top[2].x, top[2].y);
  ctx.lineTo(top[1].x, top[1].y);
  ctx.stroke();
}

/** The pedestal: the first slab's colour running down into the haze. */
export function drawPlinth(ctx: CanvasRenderingContext2D, cam: Camera, b: Box, depth: number, h: number) {
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const z0 = b.z - b.d / 2;
  const z1 = b.z + b.d / 2;
  const p = (x: number, y: number, z: number) => project(cam, x, y, z);
  const f = faces(h, 6);
  const fade = (from: string, a: { y: number }, bottom: { y: number }) => {
    const g = ctx.createLinearGradient(0, a.y, 0, bottom.y);
    g.addColorStop(0, from);
    g.addColorStop(0.45, from.replace(")", " / 0.75)"));
    g.addColorStop(1, from.replace(")", " / 0)"));
    return g;
  };
  const r = [p(x1, 0, z0), p(x1, 0, z1), p(x1, -depth, z1), p(x1, -depth, z0)];
  poly(ctx, r, fade(f.right, r[1], r[2]));
  const l = [p(x0, 0, z1), p(x1, 0, z1), p(x1, -depth, z1), p(x0, -depth, z1)];
  poly(ctx, l, fade(f.left, l[1], l[2]));
  const top = [p(x0, 0, z0), p(x1, 0, z0), p(x1, 0, z1), p(x0, 0, z1)];
  poly(ctx, top, f.top);
  ctx.strokeStyle = f.edge;
  ctx.lineWidth = Math.max(0.6, 1.2 * cam.zoom);
  ctx.beginPath();
  ctx.moveTo(top[3].x, top[3].y);
  ctx.lineTo(top[2].x, top[2].y);
  ctx.lineTo(top[1].x, top[1].y);
  ctx.stroke();
}

/** A perfect's ripple: the top face's outline spreading out and fading. */
export function drawRipple(ctx: CanvasRenderingContext2D, cam: Camera, b: Box, y: number, k: number) {
  const grow = 0.04 + k * 0.32;
  const x0 = b.x - b.w / 2 - grow;
  const x1 = b.x + b.w / 2 + grow;
  const z0 = b.z - b.d / 2 - grow;
  const z1 = b.z + b.d / 2 + grow;
  const pts = [project(cam, x0, y, z0), project(cam, x1, y, z0), project(cam, x1, y, z1), project(cam, x0, y, z1)];
  ctx.globalAlpha = (1 - k) ** 1.5 * 0.9;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = (3.5 - 2.5 * k) * cam.zoom;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- sky

type RGB = [number, number, number];

/** Our own day: top colour, horizon colour. */
const SKIES: [RGB, RGB][] = [
  [[246, 178, 164], [255, 230, 204]], // dawn: rose over peach
  [[132, 196, 230], [226, 243, 240]], // day: soft blue over mist
  [[112, 84, 162], [246, 158, 112]], // sunset: violet over apricot
  [[16, 22, 58], [58, 50, 112]], // night: indigo
];

const mix = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const css = (c: RGB, a = 1) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${a})`;

/** The sky at a (fractional) floor: each stage holds a while, then blends into the next. */
export function skyAt(floor: number) {
  const k = Math.max(0, floor) / SKY_FLOORS;
  const i = Math.floor(k);
  const f = smoothstep(clamp((k - i - 0.45) / 0.55, 0, 1));
  const a = SKIES[i % SKIES.length];
  const b = SKIES[(i + 1) % SKIES.length];
  const top = mix(a[0], b[0], f);
  const bottom = mix(a[1], b[1], f);
  const night = i % 4 === 3 ? 1 - f : i % 4 === 2 ? f : 0;
  // Relative luminance of the top, for picking the ink of the score
  const lum = (0.2126 * top[0] + 0.7152 * top[1] + 0.0722 * top[2]) / 255;
  return { top, bottom, night, lum };
}

const STARS = Array.from({ length: 46 }, (_, i) => {
  // A fixed scatter, the same every run
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.1234;
  return { x: a - Math.floor(a), y: b - Math.floor(b), r: 0.6 + ((i * 7) % 5) * 0.28, p: i * 1.7 };
});

const MOTES = Array.from({ length: 14 }, (_, i) => {
  const a = Math.sin(i * 3.7 + 1) * 9183.31;
  const b = Math.sin(i * 5.3 + 2) * 7121.77;
  return { x: a - Math.floor(a), y: b - Math.floor(b), r: 3 + (i % 4) * 2.2, s: 6 + (i % 5) * 3 };
});

export function drawSky(ctx: CanvasRenderingContext2D, v: Rect, floor: number, t: number) {
  const sky = skyAt(floor);
  const g = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
  g.addColorStop(0, css(sky.top));
  g.addColorStop(1, css(sky.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  if (sky.night > 0.01) {
    for (const s of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(t * 1.3 + s.p);
      ctx.globalAlpha = sky.night * tw * (1 - s.y * 0.6);
      ctx.fillStyle = "#fffbe8";
      ctx.beginPath();
      ctx.arc(v.x + s.x * v.w, v.y + s.y * v.h * 0.7, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Slow, soft motes drifting up through the light
  for (const m of MOTES) {
    const y = v.y + ((((m.y * v.h - t * m.s) % v.h) + v.h) % v.h);
    ctx.globalAlpha = 0.12 + 0.06 * sky.night;
    ctx.fillStyle = "#fff4e0";
    ctx.beginPath();
    ctx.arc(v.x + m.x * v.w, y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return sky;
}

/** Ink that reads on the current sky: deep plum on light skies, warm white on dark. */
export function inkFor(lum: number) {
  const k = smoothstep(clamp((lum - 0.5) / 0.2, 0, 1));
  return {
    ink: css(mix([255, 252, 246], [52, 38, 74], k)),
    soft: css(mix([255, 252, 246], [52, 38, 74], k), 0.78),
    shadow: k > 0.5 ? "rgba(255,255,255,0.35)" : "rgba(20,12,40,0.35)",
  };
}

// ---------------------------------------------------------------- text and UI

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { weight?: 600 | 800; align?: CanvasTextAlign; shadow?: string; spacing?: number } = {},
) {
  ctx.font = `${opts.weight ?? 800} ${size}px ${FONT}`;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = `${opts.spacing ?? 0}px`;
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow;
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.04;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.letterSpacing = "0px";
}

/** The game-over card: frosted, rounded, centred. */
export function drawCard(ctx: CanvasRenderingContext2D, r: Rect, a: number) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = "rgba(20,12,40,0.28)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "rgba(255,251,246,0.94)";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 28);
  ctx.fill();
  ctx.restore();
}

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, hue: number, pressed: boolean, a: number) {
  ctx.save();
  ctx.globalAlpha = a;
  const y = r.y + (pressed ? 3 : 0);
  // An isometric-feeling button: a darker lip under a lit face
  ctx.fillStyle = `hsl(${hue} 50% 32%)`;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 6, r.w, r.h, 20);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue} 52% ${pressed ? 44 : 48}%)`;
  ctx.beginPath();
  ctx.roundRect(r.x, y, r.w, r.h, 20);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = a;
  text(ctx, label, r.x + r.w / 2, y + r.h / 2 + 2, 28, "#ffffff", { shadow: "rgba(0,0,0,0.18)" });
  ctx.globalAlpha = 1;
}
