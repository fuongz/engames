import type { Rect } from "../core";
import type { Weather } from "./config";

// The interface is drawn in code in the style of the reference shop screen:
// pink page, lavender panels, white cards with pink borders, cream buttons with
// a chunky brown outline and a lip underneath, sunburst tiles for owned items.
// The world (cakes, customers, rooms) is bitmap art from img/.

type Ctx = CanvasRenderingContext2D;

export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

export const C = {
  ink: "#5b3233",
  text: "#4a2829",
  muted: "#8a6a64",
  page: "#fad6df",
  pageDeep: "#f3bccb",
  lavender: "#bfc2f6",
  lavenderDeep: "#8c87cd",
  lavenderDim: "#9da1dc",
  card: "#fffaf6",
  cardBorder: "#f1a2ae",
  cardInner: "#fde3df",
  cream: "#fdecd5",
  creamDeep: "#e8c9a6",
  blue: "#d3f0ff",
  blueRay: "#e9f8ff",
  blueBorder: "#7fc9ec",
  green: "#ddf6b6",
  greenRay: "#eefbd8",
  greenBorder: "#8fd46d",
  red: "#ff6b6b",
  coin: "#ffcb3d",
  coinRim: "#f29b20",
  good: "#58b65a",
  warn: "#f08a2e",
  bad: "#e04848",
  white: "#ffffff",
  shade: "rgba(74, 40, 41, 0.45)",
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

/** A rounded slab with a thick outline and a lip, the reference's basic shape. */
export function panel(ctx: Ctx, r: Rect, s: PanelStyle) {
  const radius = s.radius ?? 22;
  const line = s.line ?? 4;
  const lip = s.lip ?? 0;
  if (lip) {
    rr(ctx, r.x, r.y + lip, r.w, r.h, radius);
    ctx.fillStyle = s.stroke ?? C.ink;
    ctx.fill();
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
  const weight = s.weight ?? 800;
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

/** Cream pill with a brown outline; pressed sinks onto its lip. */
export function button(ctx: Ctx, r: Rect, label: string, s: ButtonStyle = {}) {
  const lip = 5;
  const sink = s.pressed ? lip - 1 : 0;
  ctx.save();
  if (s.disabled) ctx.globalAlpha = 0.55;
  rr(ctx, r.x, r.y + lip, r.w, r.h - lip, s.radius ?? (r.h - lip) / 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  panel(
    ctx,
    { x: r.x, y: r.y + sink, w: r.w, h: r.h - lip },
    { fill: s.fill ?? C.cream, radius: s.radius ?? (r.h - lip) / 2 },
  );
  if (label)
    text(ctx, label, r.x + r.w / 2, r.y + sink + (r.h - lip) / 2, {
      size: s.size ?? 22,
      fill: s.color ?? C.text,
      maxWidth: r.w - 24,
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

export type CardTone = "pink" | "blue" | "green";

const TONES: Record<CardTone, { border: string; inner: string; ray?: string }> =
  {
    pink: { border: C.cardBorder, inner: C.cardInner },
    blue: { border: C.blueBorder, inner: C.blue, ray: C.blueRay },
    green: { border: C.greenBorder, inner: C.green, ray: C.greenRay },
  };

/** White card with a coloured border and an inner tile; owned tiles get a sunburst. Returns the tile rect. */
export function card(
  ctx: Ctx,
  r: Rect,
  tone: CardTone,
  pressed = false,
  tileH?: number,
): Rect {
  const t = TONES[tone];
  const y = r.y + (pressed ? 2 : 0);
  panel(
    ctx,
    { x: r.x, y, w: r.w, h: r.h },
    { fill: C.card, stroke: t.border, radius: 22, line: 5 },
  );
  const pad = 9;
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
  star(ctx, x, y + r * 0.03, r * 0.48, C.coin, Math.max(1.5, r * 0.08));
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
  ctx.lineWidth = 3;
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
  ctx.lineWidth = 3.5;
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

/** Lavender board with a tab row on top, as in the reference shop. */
export function tabBoard(
  ctx: Ctx,
  r: Rect,
  tabs: string[],
  active: number,
  tabH = 70,
) {
  const tw = (r.w - 40) / tabs.length;
  tabs.forEach((label, i) => {
    if (i === active) return;
    const tr = { x: r.x + 20 + i * tw + 6, y: r.y + 8, w: tw - 12, h: tabH };
    panel(ctx, tr, {
      fill: C.lavenderDim,
      stroke: C.lavenderDeep,
      radius: 20,
      line: 4,
    });
    text(ctx, label, tr.x + tr.w / 2, tr.y + tabH / 2 - 2, {
      size: 28,
      fill: "#eceaff",
      outline: C.ink,
      maxWidth: tr.w - 20,
    });
  });
  panel(
    ctx,
    { x: r.x, y: r.y + tabH - 6, w: r.w, h: r.h - tabH + 6 },
    { fill: C.lavender, stroke: C.lavenderDeep, radius: 26, line: 4 },
  );
  const ar = { x: r.x + 20 + active * tw, y: r.y, w: tw, h: tabH + 4 };
  panel(ctx, ar, {
    fill: C.lavender,
    stroke: C.lavenderDeep,
    radius: 22,
    line: 4,
  });
  ctx.fillStyle = C.lavender;
  ctx.fillRect(ar.x + 4, ar.y + ar.h - 8, ar.w - 8, 14);
  text(ctx, tabs[active], ar.x + ar.w / 2, ar.y + tabH / 2, {
    size: 30,
    fill: C.white,
    outline: C.ink,
    maxWidth: ar.w - 20,
  });
  return tabs.map((_, i) => ({ x: r.x + 20 + i * tw, y: r.y, w: tw, h: tabH }));
}
