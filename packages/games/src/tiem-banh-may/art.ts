import type { Rect } from "@web-games/core";
import type { Weather } from "./config";

// The interface is drawn in code, cosy bakery style: cream paper pages on a
// terracotta dialog, cards with caramel borders, cream buttons with a chunky
// brown outline and a lip underneath, sunburst tiles for owned items, a round
// orange close button. The world (cakes, customers, rooms) is bitmap art in img/.

type Ctx = CanvasRenderingContext2D;

export const FONT = '"Mali", "Trebuchet MS", system-ui, sans-serif';

export const C = {
  ink: "#5a3424",
  text: "#4b2a1c",
  muted: "#8f6c58",
  page: "#f6e7cd",
  pageDeep: "#ecd3ad",
  board: "#d98a5f",
  boardDeep: "#9a5235",
  boardDim: "#c99a7a",
  card: "#fffaf0",
  cardBorder: "#e4c493",
  cardInner: "#f9ecd6",
  cream: "#fdf1dc",
  creamDeep: "#e3c79f",
  owned: "#e4f0cf",
  ownedRay: "#f1f8e4",
  ownedBorder: "#9cc27f",
  green: "#d6ecb0",
  greenRay: "#ecf6d6",
  greenBorder: "#93c06e",
  red: "#ef6a4c",
  coin: "#ffcb3d",
  coinRim: "#f29b20",
  good: "#5fa34f",
  warn: "#e0872f",
  bad: "#d9503c",
  white: "#ffffff",
  shade: "rgba(74, 40, 25, 0.45)",
} as const;

// ---------------------------------------------------------------- shapes

export function rr(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export interface PanelStyle {
  fill: string;
  stroke?: string;
  radius?: number;
  line?: number;
  /** Height of the darker lip under the shape. */
  lip?: number;
}

/** Outlines are drawn thin and hand-made: every `line` is scaled by this. */
export const LINE = 0.6;

/** A darker shade of a #rrggbb colour (for button bases and lips). */
export function shadeOf(color: string, k = 0.2) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return C.creamDeep;
  const c = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  const ink = [90, 52, 36];
  return `rgb(${c.map((v, i) => Math.round(v + (ink[i] - v) * k)).join(",")})`;
}

/** A rounded slab with a thin outline; `lip` adds a darker base under it. */
export function panel(ctx: Ctx, r: Rect, s: PanelStyle) {
  const radius = s.radius ?? 22;
  const line = (s.line ?? 4) * LINE;
  const lip = s.lip ?? 0;
  if (lip) {
    rr(ctx, r.x, r.y + lip, r.w, r.h, radius);
    ctx.fillStyle = shadeOf(s.fill, 0.22);
    ctx.fill();
    if (line) {
      ctx.lineWidth = line;
      ctx.strokeStyle = s.stroke ?? C.ink;
      ctx.stroke();
    }
  }
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = s.fill;
  ctx.fill();
  if (line) {
    ctx.lineWidth = line;
    ctx.strokeStyle = s.stroke ?? C.ink;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- text

export interface TextStyle {
  size?: number;
  fill?: string;
  /** White title text with a brown outline, like the reference tabs. */
  outline?: string;
  align?: CanvasTextAlign;
  weight?: number;
  maxWidth?: number;
}

export function text(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  s: TextStyle = {},
) {
  let size = s.size ?? 22;
  const weight = s.weight ?? 700;
  ctx.font = `${weight} ${size}px ${FONT}`;
  if (s.maxWidth) {
    while (size > 11 && ctx.measureText(str).width > s.maxWidth) {
      size -= 1;
      ctx.font = `${weight} ${size}px ${FONT}`;
    }
  }
  ctx.textAlign = s.align ?? "center";
  ctx.textBaseline = "middle";
  if (s.outline) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.22);
    ctx.strokeStyle = s.outline;
    ctx.strokeText(str, x, y + 1);
  }
  ctx.fillStyle = s.fill ?? C.text;
  ctx.fillText(str, x, y + 1);
  return size;
}

/** Word-wrapped lines that fit `maxWidth` at the current font. */
export function wrap(
  ctx: Ctx,
  str: string,
  maxWidth: number,
  size: number,
  weight = 700,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const lines: string[] = [];
  let line = "";
  for (const word of str.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------------------------------------------------------- buttons

export interface ButtonStyle {
  fill?: string;
  pressed?: boolean;
  disabled?: boolean;
  size?: number;
  color?: string;
  radius?: number;
}

/** A broken "stitched" line, the hand-made accent of every button and dialog. */
export function stitch(ctx: Ctx, draw: () => void, alpha = 0.55) {
  ctx.save();
  ctx.setLineDash([18, 7, 5, 7]);
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(90, 52, 36, ${alpha})`;
  ctx.beginPath();
  draw();
  ctx.stroke();
  ctx.restore();
}

/** Pill on a darker base of its own colour, a stitched line along the bottom; pressed sinks onto the base. */
export function button(ctx: Ctx, r: Rect, label: string, s: ButtonStyle = {}) {
  const lip = 6;
  const sink = s.pressed ? lip - 1 : 0;
  const fill = s.fill ?? C.cream;
  const radius = s.radius ?? (r.h - lip) / 2;
  ctx.save();
  if (s.disabled) ctx.globalAlpha = 0.55;
  rr(ctx, r.x, r.y + lip, r.w, r.h - lip, radius);
  ctx.fillStyle = shadeOf(fill, 0.25);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  const face = { x: r.x, y: r.y + sink, w: r.w, h: r.h - lip };
  rr(ctx, face.x, face.y, face.w, face.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
  if (face.w > 70) {
    const inset = Math.min(radius, face.h / 2) * 0.9;
    stitch(ctx, () => {
      ctx.moveTo(face.x + inset, face.y + face.h - 6);
      ctx.lineTo(face.x + face.w - inset, face.y + face.h - 6);
    });
  }
  if (label)
    text(ctx, label, r.x + r.w / 2, face.y + face.h / 2 - 1, {
      size: s.size ?? 22,
      fill: s.color ?? C.text,
      maxWidth: r.w - 24,
      weight: 600,
    });
  ctx.restore();
}

/** Round cream button with a brown arrow (the reference's back button). */
export function backButton(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  pressed: boolean,
) {
  const sink = pressed ? 3 : 0;
  ctx.beginPath();
  ctx.arc(cx, cy + 4, r, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + sink, r, 0, Math.PI * 2);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  const k = r * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - k, cy + sink);
  ctx.lineTo(cx, cy + sink - k * 0.8);
  ctx.lineTo(cx, cy + sink - k * 0.35);
  ctx.lineTo(cx + k, cy + sink - k * 0.35);
  ctx.lineTo(cx + k, cy + sink + k * 0.35);
  ctx.lineTo(cx, cy + sink + k * 0.35);
  ctx.lineTo(cx, cy + sink + k * 0.8);
  ctx.closePath();
  ctx.fillStyle = C.ink;
  ctx.fill();
}

// ---------------------------------------------------------------- cards

export type CardTone = "pink" | "owned" | "green";

const TONES: Record<CardTone, { border: string; inner: string; ray?: string }> =
  {
    pink: { border: C.cardBorder, inner: C.cardInner },
    owned: { border: C.ownedBorder, inner: C.owned, ray: C.ownedRay },
    green: { border: C.greenBorder, inner: C.green, ray: C.greenRay },
  };

/** A cream frame on a darker base with a stitched inner border: info panels, rows, tiles. */
export function framed(
  ctx: Ctx,
  r: Rect,
  fill: string = C.card,
  radius = 24,
  lip = 5,
) {
  panel(ctx, r, { fill, radius, line: 4, lip });
  const k = Math.min(7, r.h / 6);
  stitch(
    ctx,
    () =>
      rr(
        ctx,
        r.x + k,
        r.y + k,
        r.w - k * 2,
        r.h - k * 2,
        Math.max(4, radius - k),
      ),
    0.38,
  );
}

/** A framed card with an inner tile (owned tiles get a sunburst). Returns the tile rect. */
export function card(
  ctx: Ctx,
  r: Rect,
  tone: CardTone,
  pressed = false,
  tileH?: number,
): Rect {
  const t = TONES[tone];
  const y = r.y + (pressed ? 3 : 0);
  framed(ctx, { x: r.x, y, w: r.w, h: r.h }, C.card, 22, pressed ? 2 : 5);
  const pad = 10;
  const tile = {
    x: r.x + pad,
    y: y + pad,
    w: r.w - pad * 2,
    h: tileH ?? Math.min(r.w - pad * 2, r.h - pad * 2),
  };
  ctx.save();
  rr(ctx, tile.x, tile.y, tile.w, tile.h, 16);
  ctx.fillStyle = t.inner;
  ctx.fill();
  ctx.clip();
  if (t.ray)
    sunburst(ctx, tile.x + tile.w / 2, tile.y + tile.h / 2, tile.w, t.ray);
  ctx.restore();
  rr(ctx, tile.x, tile.y, tile.w, tile.h, 16);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = t.border;
  ctx.stroke();
  return tile;
}

export function sunburst(
  ctx: Ctx,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  rays = 14,
  spin = 0,
) {
  ctx.fillStyle = color;
  for (let i = 0; i < rays; i++) {
    const a = spin + (i / rays) * Math.PI * 2;
    const b = a + Math.PI / rays;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.lineTo(cx + Math.cos(b) * radius, cy + Math.sin(b) * radius);
    ctx.closePath();
    ctx.fill();
  }
}

/** Little red dot for "something new here". */
export function dot(ctx: Ctx, x: number, y: number, r = 12) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = C.red;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.white;
  ctx.stroke();
}

// ---------------------------------------------------------------- icons

export function coin(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = C.coinRim;
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = C.coin;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.stroke();
  fish(ctx, x, y, r * 0.5, Math.max(1.2, r * 0.07));
}

/** The little fish embossed on a coin, `r` from its middle to its nose. */
export function fish(ctx: Ctx, x: number, y: number, r: number, line: number) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = line;
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = "#fff0b3";
  // Body: a plump teardrop facing left, with a forked tail on the right
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.bezierCurveTo(
    x - r * 0.7,
    y - r * 0.72,
    x + r * 0.25,
    y - r * 0.7,
    x + r * 0.42,
    y,
  );
  ctx.lineTo(x + r * 0.95, y - r * 0.5);
  ctx.quadraticCurveTo(x + r * 0.8, y, x + r * 0.95, y + r * 0.5);
  ctx.lineTo(x + r * 0.42, y);
  ctx.bezierCurveTo(
    x + r * 0.25,
    y + r * 0.7,
    x - r * 0.7,
    y + r * 0.72,
    x - r,
    y,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // An eye, once there is room for one
  if (r > 4) {
    ctx.beginPath();
    ctx.arc(
      x - r * 0.55,
      y - r * 0.12,
      Math.max(0.8, r * 0.11),
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = C.ink;
    ctx.fill();
  }
  ctx.restore();
}

export function star(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  fill: string = C.coin,
  line = 2.5,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? r * 0.48 : r;
    ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = line;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

/** A row of `n` stars out of three, centred on x. */
export function stars(ctx: Ctx, x: number, y: number, n: number, r = 9) {
  for (let i = 0; i < 3; i++)
    star(
      ctx,
      x + (i - 1) * r * 2.2,
      y,
      r,
      i < n ? C.coin : "#e9d9cf",
      Math.max(1.5, r * 0.22),
    );
}

export function heart(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  fill: string = C.red,
) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(
    x - r * 1.4,
    y - r * 0.1,
    x - r * 0.6,
    y - r * 1.2,
    x,
    y - r * 0.45,
  );
  ctx.bezierCurveTo(
    x + r * 0.6,
    y - r * 1.2,
    x + r * 1.4,
    y - r * 0.1,
    x,
    y + r * 0.9,
  );
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

export function weatherIcon(
  ctx: Ctx,
  x: number,
  y: number,
  kind: Weather,
  r = 18,
) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  if (kind === "sunny") {
    ctx.fillStyle = "#ffd257";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
      ctx.lineTo(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  const cloud = (cx: number, cy: number, k: number) => {
    ctx.beginPath();
    ctx.arc(
      cx - k * 0.45,
      cy + k * 0.1,
      k * 0.45,
      Math.PI * 0.5,
      Math.PI * 1.5,
    );
    ctx.arc(cx, cy - k * 0.2, k * 0.55, Math.PI, 0);
    ctx.arc(cx + k * 0.5, cy + k * 0.1, k * 0.42, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fillStyle = kind === "rainy" ? "#c9d4ee" : "#ffffff";
    ctx.fill();
    ctx.stroke();
  };
  if (kind === "cloudy") {
    ctx.fillStyle = "#ffd257";
    ctx.beginPath();
    ctx.arc(x + r * 0.45, y - r * 0.35, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  cloud(x, y + (kind === "rainy" ? -r * 0.2 : r * 0.1), r);
  if (kind === "rainy") {
    ctx.strokeStyle = "#5aa0e0";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * r * 0.45, y + r * 0.5);
      ctx.lineTo(x + i * r * 0.45 - 3, y + r * 0.9);
      ctx.stroke();
    }
  }
}

/** Clock face, for the work-time chip and waiting steps. */
export function clockIcon(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  minutes: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  const hand = (a: number, k: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(a) * r * k, y - Math.cos(a) * r * k);
    ctx.stroke();
  };
  ctx.lineCap = "round";
  hand(((minutes / 60) % 12) * (Math.PI / 6), 0.5);
  hand(((minutes % 60) / 60) * Math.PI * 2, 0.75);
  ctx.lineCap = "butt";
}

// ---------------------------------------------------------------- pieces

/** Coin + cream pill with a number, the reference's money counter. */
export function coinCounter(
  ctx: Ctx,
  x: number,
  y: number,
  label: string,
  h = 46,
) {
  ctx.font = `800 ${h * 0.6}px ${FONT}`;
  const w = Math.max(96, ctx.measureText(label).width + h + 28);
  panel(
    ctx,
    { x: x + h * 0.35, y: y + h * 0.12, w, h: h * 0.76 },
    { fill: C.cream, radius: h * 0.38, line: 3.5 },
  );
  text(ctx, label, x + h * 0.35 + (w + h * 0.55) / 2, y + h / 2, {
    size: h * 0.56,
    fill: C.text,
  });
  coin(ctx, x + h / 2, y + h / 2, h / 2);
  return h * 0.35 + w;
}

/** A cream chip with text, for HUD facts (clock, reputation). */
export function chip(
  ctx: Ctx,
  x: number,
  y: number,
  label: string,
  h = 38,
  align: "left" | "right" = "left",
  icon = 0,
) {
  ctx.font = `800 ${h * 0.55}px ${FONT}`;
  const w = ctx.measureText(label).width + 26 + icon;
  const left = align === "left" ? x : x - w;
  panel(ctx, { x: left, y, w, h }, { fill: C.cream, radius: h / 2, line: 3.5 });
  text(ctx, label, left + icon + (w - icon) / 2, y + h / 2, { size: h * 0.55 });
  return { x: left, y, w, h };
}

/** A small cog for the settings button. */
export function gear(ctx: Ctx, cx: number, cy: number, r: number) {
  const teeth = 8;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i * Math.PI) / teeth - Math.PI / 2;
    const out = i % 2 === 0;
    const d = out ? r : r * 0.74;
    // Square-ish teeth: two points per edge
    const half = (Math.PI / teeth) * 0.42;
    ctx.lineTo(cx + Math.cos(a - half) * d, cy + Math.sin(a - half) * d);
    ctx.lineTo(cx + Math.cos(a + half) * d, cy + Math.sin(a + half) * d);
  }
  ctx.closePath();
  ctx.fillStyle = "#c9a27e";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.stroke();
}

export function bar(
  ctx: Ctx,
  r: Rect,
  k: number,
  fill: string,
  back = "#f6e6dc",
) {
  panel(ctx, r, { fill: back, radius: r.h / 2, line: 3 });
  if (k <= 0) return;
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w * Math.min(1, k), r.h);
  ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

/** Speech bubble whose tail points down at `tailX`. */
export function bubble(ctx: Ctx, r: Rect, tailX: number) {
  ctx.beginPath();
  ctx.moveTo(tailX - 12, r.y + r.h - 2);
  ctx.lineTo(tailX - 4, r.y + r.h + 16);
  ctx.lineTo(tailX + 12, r.y + r.h - 2);
  ctx.closePath();
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  panel(ctx, r, { fill: C.white, radius: 18, line: 3.5 });
  ctx.fillStyle = C.white;
  ctx.fillRect(tailX - 10, r.y + r.h - 4, 20, 5);
}

/** Draw an image to fit inside a w×h box, anchored at its centre or its bottom edge. */
export function sprite(
  ctx: Ctx,
  img: HTMLImageElement | undefined,
  cx: number,
  cy: number,
  w: number,
  h: number,
  anchor: "center" | "bottom" = "center",
) {
  if (!img?.naturalWidth) return;
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  ctx.drawImage(
    img,
    cx - dw / 2,
    anchor === "center" ? cy - dh / 2 : cy - dh,
    dw,
    dh,
  );
}

/** Cover a rect with an image (cropping its edges), for room backgrounds. */
/**
 * Draw `img` stretched over `r` as a 9-slice: its corners (`src` px of the
 * image) keep their shape at `dst` px, the edges and middle stretch.
 */
export function nine(
  ctx: Ctx,
  img: HTMLImageElement | undefined,
  r: Rect,
  src: number,
  dst: number,
) {
  if (!img?.naturalWidth) return false;
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const xs = [0, src, sw - src, sw];
  const ys = [0, src, sh - src, sh];
  const xd = [r.x, r.x + dst, r.x + r.w - dst, r.x + r.w];
  const yd = [r.y, r.y + dst, r.y + r.h - dst, r.y + r.h];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      ctx.drawImage(
        img,
        xs[i],
        ys[j],
        xs[i + 1] - xs[i],
        ys[j + 1] - ys[j],
        xd[i],
        yd[j],
        xd[i + 1] - xd[i],
        yd[j + 1] - yd[j],
      );
  return true;
}

/** A soft contact shadow on the table under something `w` wide. */
export function tableShadow(ctx: Ctx, cx: number, y: number, w: number) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, y, 0, cx, y, w / 2);
  g.addColorStop(0, "rgba(92, 52, 28, 0.32)");
  g.addColorStop(0.6, "rgba(92, 52, 28, 0.16)");
  g.addColorStop(1, "rgba(92, 52, 28, 0)");
  ctx.translate(cx, y);
  ctx.scale(1, 0.16);
  ctx.translate(-cx, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, y, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A picture standing on the table at `bottom`, with its shadow under it. */
export function onTable(
  ctx: Ctx,
  img: HTMLImageElement | undefined,
  cx: number,
  bottom: number,
  w: number,
  h: number,
) {
  if (!img?.naturalWidth) return;
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  tableShadow(ctx, cx, bottom - 4, img.naturalWidth * k * 1.08);
  sprite(ctx, img, cx, bottom, w, h, "bottom");
}

/** Where a fraction `f` of an image's height lands once drawn by `cover`. */
export function coverY(
  img: HTMLImageElement | undefined,
  r: Rect,
  f: number,
  focusY = 0.5,
) {
  if (!img?.naturalWidth) return r.y + r.h * f;
  const k = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight);
  const dh = img.naturalHeight * k;
  return r.y + (r.h - dh) * focusY + dh * f;
}

export function cover(
  ctx: Ctx,
  img: HTMLImageElement | undefined,
  r: Rect,
  focusY = 0.5,
) {
  if (!img?.naturalWidth) return;
  const k = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  ctx.drawImage(img, r.x + (r.w - dw) / 2, r.y + (r.h - dh) * focusY, dw, dh);
}

/**
 * A big rounded cream dialog with a stitched inner border and its title on a
 * pale-blue pill over the top edge. Returns the inner page to draw on.
 */
export function dialog(ctx: Ctx, r: Rect, title: string): Rect {
  panel(ctx, r, { fill: "#f4f0da", radius: 46, line: 4.4 });
  const inner = { x: r.x + 16, y: r.y + 30, w: r.w - 32, h: r.h - 48 };
  rr(ctx, inner.x, inner.y, inner.w, inner.h, 36);
  ctx.fillStyle = "#f8f6e8";
  ctx.fill();
  stitch(
    ctx,
    () => rr(ctx, inner.x + 6, inner.y + 6, inner.w - 12, inner.h - 12, 32),
    0.6,
  );
  // Title pill
  ctx.font = `600 26px ${FONT}`;
  const tw = Math.min(
    r.w - 90,
    Math.max(170, ctx.measureText(title).width + 70),
  );
  const pill = { x: r.x + r.w / 2 - tw / 2, y: r.y - 26, w: tw, h: 54 };
  panel(ctx, pill, { fill: "#d9f2f7", radius: 27, line: 4.4 });
  stitch(
    ctx,
    () => {
      ctx.moveTo(pill.x + 24, pill.y + pill.h - 8);
      ctx.lineTo(pill.x + pill.w - 24, pill.y + pill.h - 8);
    },
    0.4,
  );
  text(ctx, title, r.x + r.w / 2, pill.y + pill.h / 2, {
    size: 26,
    weight: 600,
    maxWidth: tw - 30,
  });
  return { x: inner.x + 10, y: inner.y + 14, w: inner.w - 20, h: inner.h - 24 };
}

/** Page heading on the paper ("Main" in the reference): brown text over a soft band and a rule. */
export function paperHeading(
  ctx: Ctx,
  paper: Rect,
  label: string,
  right?: string,
) {
  const y = paper.y + 34;
  ctx.fillStyle = "rgba(233, 205, 160, 0.45)";
  rr(ctx, paper.x + paper.w / 2 - 90, y - 18, 180, 36, 18);
  ctx.fill();
  text(ctx, label, paper.x + paper.w / 2, y, {
    size: 24,
    fill: C.muted,
    maxWidth: paper.w - 140,
  });
  if (right)
    text(ctx, right, paper.x + paper.w - 22, y + 4, {
      size: 18,
      fill: "#c9a98a",
      align: "right",
    });
  ctx.strokeStyle = "#e6cfa9";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(paper.x + 24, y + 28);
  ctx.lineTo(paper.x + paper.w - 24, y + 28);
  ctx.stroke();
  return y + 40;
}

/** Round orange close button with a cream cross. */
export function closeButton(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  pressed: boolean,
) {
  const y = cy + (pressed ? 2 : 0);
  ctx.beginPath();
  ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f2a796";
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, y, r - 4, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();
  ctx.lineCap = "round";
  const k = r * 0.36;
  const cross = () => {
    ctx.beginPath();
    ctx.moveTo(cx - k, y - k);
    ctx.lineTo(cx + k, y + k);
    ctx.moveTo(cx + k, y - k);
    ctx.lineTo(cx - k, y + k);
    ctx.stroke();
  };
  ctx.lineWidth = r * 0.38;
  ctx.strokeStyle = C.ink;
  cross();
  ctx.lineWidth = r * 0.26;
  ctx.strokeStyle = C.white;
  cross();
  ctx.lineCap = "butt";
}

/** Cream triangle page arrow pointing left (-1) or right (1), white-rimmed like the reference. */
export function pageArrow(
  ctx: Ctx,
  cx: number,
  cy: number,
  dir: -1 | 1,
  pressed: boolean,
  disabled = false,
) {
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.35;
  ctx.translate(cx + (pressed ? dir * 3 : 0), cy);
  ctx.scale(dir, 1);
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.quadraticCurveTo(-20, -36, -12, -34);
  ctx.lineTo(18, -6);
  ctx.quadraticCurveTo(24, 0, 18, 6);
  ctx.lineTo(-12, 34);
  ctx.quadraticCurveTo(-20, 36, -14, 30);
  ctx.closePath();
  ctx.fillStyle = "#d8efab";
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.moveTo(-8, -22);
  ctx.lineTo(10, -4);
  ctx.stroke();
  ctx.restore();
}

/** Lightning bolt (energy). */
export function bolt(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r * 0.15, y - r);
  ctx.lineTo(x - r * 0.55, y + r * 0.15);
  ctx.lineTo(x - r * 0.02, y + r * 0.15);
  ctx.lineTo(x - r * 0.2, y + r);
  ctx.lineTo(x + r * 0.6, y - r * 0.2);
  ctx.lineTo(x + r * 0.05, y - r * 0.2);
  ctx.closePath();
  ctx.fillStyle = "#ffcf3d";
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

/** A little face whose mouth follows the mood (0 frown … 100 grin). */
export function face(ctx: Ctx, x: number, y: number, r: number, mood: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = mood >= 60 ? "#ffd98a" : mood >= 30 ? "#f6e3b8" : "#cfd8e8";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.ink;
  for (const dx of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y - r * 0.15, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  const curve = ((mood - 50) / 50) * r * 0.35;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.38, y + r * 0.3);
  ctx.quadraticCurveTo(x, y + r * 0.3 + curve, x + r * 0.38, y + r * 0.3);
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

// ---------------------------------------------------------------- line icons
// The settings' icons: thin brown line over white, like the reference settings
// screen. Each fits a `s`-sized square centred on (cx, cy).

function lineStyle(ctx: Ctx, s: number) {
  ctx.lineWidth = Math.max(2.4, s * 0.06);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.white;
}

/** A speaker: sound waves when on, a cross when off. */
export function speakerIcon(
  ctx: Ctx,
  cx: number,
  cy: number,
  s: number,
  on: boolean,
) {
  ctx.save();
  lineStyle(ctx, s);
  const x = cx - s * 0.12;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, cy - s * 0.12);
  ctx.lineTo(x - s * 0.12, cy - s * 0.12);
  ctx.lineTo(x + s * 0.1, cy - s * 0.3);
  ctx.lineTo(x + s * 0.1, cy + s * 0.3);
  ctx.lineTo(x - s * 0.12, cy + s * 0.12);
  ctx.lineTo(x - s * 0.3, cy + s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (on)
    for (const r of [0.2, 0.34]) {
      ctx.beginPath();
      ctx.arc(x + s * 0.1, cy, s * r, -0.85, 0.85);
      ctx.stroke();
    }
  else {
    const k = s * 0.1;
    const ox = x + s * 0.32;
    ctx.beginPath();
    ctx.moveTo(ox - k, cy - k);
    ctx.lineTo(ox + k, cy + k);
    ctx.moveTo(ox + k, cy - k);
    ctx.lineTo(ox - k, cy + k);
    ctx.stroke();
  }
  ctx.restore();
}

/** Two beamed notes; struck through when the music is off. */
export function noteIcon(
  ctx: Ctx,
  cx: number,
  cy: number,
  s: number,
  on: boolean,
) {
  ctx.save();
  lineStyle(ctx, s);
  const heads = [
    { x: cx - s * 0.2, y: cy + s * 0.24 },
    { x: cx + s * 0.22, y: cy + s * 0.16 },
  ];
  // Stems up from each head's right side to a slanted beam
  const top = [cy - s * 0.26, cy - s * 0.34];
  ctx.beginPath();
  heads.forEach((h, i) => {
    ctx.moveTo(h.x + s * 0.11, h.y - s * 0.02);
    ctx.lineTo(h.x + s * 0.11, top[i]);
  });
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(heads[0].x + s * 0.11, top[0]);
  ctx.lineTo(heads[1].x + s * 0.11, top[1]);
  ctx.lineTo(heads[1].x + s * 0.11, top[1] + s * 0.1);
  ctx.lineTo(heads[0].x + s * 0.11, top[0] + s * 0.1);
  ctx.closePath();
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.white;
  for (const h of heads) {
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, s * 0.12, s * 0.085, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (!on) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.38, cy - s * 0.38);
    ctx.lineTo(cx + s * 0.38, cy + s * 0.38);
    ctx.stroke();
  }
  ctx.restore();
}

/** A little shop with a red roof: another bakery. */
export function shopIcon(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.save();
  lineStyle(ctx, s);
  ctx.beginPath();
  ctx.rect(cx - s * 0.3, cy - s * 0.04, s * 0.6, s * 0.38);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy);
  ctx.lineTo(cx, cy - s * 0.36);
  ctx.lineTo(cx + s * 0.4, cy);
  ctx.closePath();
  ctx.fillStyle = "#ef8a7e";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx - s * 0.08, cy + s * 0.12, s * 0.16, s * 0.22);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A circular arrow: start again. */
export function restartIcon(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.save();
  lineStyle(ctx, s);
  const r = s * 0.28;
  // Clockwise from just below the right, round to the upper right
  const end = -Math.PI * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.05, end);
  ctx.stroke();
  // The arrowhead points along the turn at its end
  const tx = cx + Math.cos(end) * r;
  const ty = cy + Math.sin(end) * r;
  const dir = Math.atan2(Math.cos(end), -Math.sin(end));
  const k = s * 0.15;
  ctx.beginPath();
  ctx.moveTo(tx - Math.cos(dir - 0.6) * k, ty - Math.sin(dir - 0.6) * k);
  ctx.lineTo(tx, ty);
  ctx.lineTo(tx - Math.cos(dir + 0.6) * k, ty - Math.sin(dir + 0.6) * k);
  ctx.stroke();
  ctx.restore();
}
