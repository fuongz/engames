import type { Rect } from "@web-games/core";
import { type App, btn, icon } from "./app";
import { C, FONT, button, framed, panel, rr, text, wrap } from "./art";

// The bakery's UI kit: every HUD fact, gauge, round button, info card and
// toolbar is built from these, so they share one height, one stroke and one
// icon slot. Change a size here and every screen follows.

/** The kit's measurements (logical px). */
export const K = {
  /** Height of a pill, gauge and round button. */
  pill: 40,
  /** Outline of every kit piece. */
  line: 3,
  /** The icon slot inside a pill or button. */
  icon: 26,
  /** Space between neighbours. */
  gap: 8,
  /** Inner padding at a pill's ends. */
  pad: 10,
  /** Label size inside pills and toolbar buttons. */
  label: 18,
  /** Height of a toolbar strip and its buttons. */
  bar: 56,
  barButton: 44,
  /** Space between a dialog's stitched border and the buttons inside it. */
  inset: 16,
  /** Height of a dialog button. */
  button: 64,
} as const;

/** An icon from the sprite set, or a drawn fallback while it is missing. */
export interface KitIcon {
  /** `icon-<name>` from img/, or with `sprite` any picture by its own name. */
  name: string;
  sprite?: boolean;
  fallback: (cx: number, cy: number, size: number) => void;
}

function drawIcon(
  app: App,
  ic: KitIcon,
  cx: number,
  cy: number,
  size: number = K.icon,
) {
  icon(app, ic.sprite ? ic.name : `icon-${ic.name}`, cx, cy, size, () =>
    ic.fallback(cx, cy, size),
  );
}

/** Width a pill needs for this label (and icon). */
export function pillWidth(app: App, label: string, withIcon: boolean) {
  app.ctx.font = `700 ${K.label}px ${FONT}`;
  return (
    K.pad * 2 +
    app.ctx.measureText(label).width +
    (withIcon ? K.icon + K.gap - 4 : 0)
  );
}

/**
 * A cream pill with an optional icon and a label: a HUD fact (reputation, day,
 * clock). `x` is its left edge, or its right edge when `align` is "right".
 */
export function pill(
  app: App,
  x: number,
  y: number,
  label: string,
  opts: {
    icon?: KitIcon;
    align?: "left" | "right";
    minWidth?: number;
    /** Label colour (a warning, say). */
    color?: string;
    /** Stand off the screen like a button: a lip and a soft shadow. */
    raised?: boolean;
  } = {},
): Rect {
  const w = Math.max(opts.minWidth ?? 0, pillWidth(app, label, !!opts.icon));
  const r = { x: opts.align === "right" ? x - w : x, y, w, h: K.pill };
  if (opts.raised) raise(app.ctx, r, K.pill / 2);
  panel(app.ctx, r, {
    fill: C.cream,
    radius: K.pill / 2,
    line: K.line,
    lip: opts.raised ? 4 : 0,
  });
  let tx = r.x + K.pad;
  if (opts.icon) {
    drawIcon(app, opts.icon, tx + K.icon / 2 - 2, r.y + K.pill / 2);
    tx += K.icon + K.gap - 4;
  }
  text(app.ctx, label, (tx + r.x + r.w - K.pad) / 2, r.y + K.pill / 2, {
    size: K.label,
    fill: opts.color ?? C.text,
  });
  return r;
}

const noop = () => undefined;

/** A round cream button holding one icon (settings, pause...). */
export function roundButton(
  app: App,
  key: string,
  cx: number,
  cy: number,
  ic: KitIcon,
  onTap: () => void,
) {
  const r = K.pill / 2;
  const sink = app.ui.isPressed(key) ? 2 : 0;
  panel(
    app.ctx,
    { x: cx - r, y: cy - r + sink, w: r * 2, h: r * 2 },
    { fill: C.cream, radius: r, line: K.line },
  );
  drawIcon(app, ic, cx, cy + sink, K.icon);
  app.ui.add({
    rect: { x: cx - r - 6, y: cy - r - 6, w: r * 2 + 12, h: r * 2 + 12 },
    key,
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}

/** A stitched card with a title, an icon at the top right and wrapped lines. */
export function infoCard(
  app: App,
  x: number,
  y: number,
  w: number,
  title: string,
  lines: { text: string; color?: string }[],
  ic?: KitIcon,
): Rect {
  const { ctx } = app;
  const wrapped = lines.flatMap((l) =>
    wrap(ctx, l.text, w - 92, 19).map((t) => ({ text: t, color: l.color })),
  );
  const r = { x, y, w, h: 58 + wrapped.length * 27 };
  framed(ctx, r, C.card, 26);
  text(ctx, title, r.x + 22, r.y + 30, {
    size: 25,
    align: "left",
    maxWidth: r.w - 110,
  });
  if (ic) drawIcon(app, ic, r.x + r.w - 48, r.y + 40, 56);
  wrapped.forEach((l, i) => {
    text(ctx, l.text, r.x + 22, r.y + 64 + i * 27, {
      size: 19,
      align: "left",
      fill: l.color ?? C.text,
    });
  });
  return r;
}

/** One piece of a toolbar: an icon with text, or a button. */
export type ToolbarItem =
  | {
      kind: "info";
      icon: KitIcon;
      text: string;
      color?: string;
    }
  | {
      kind: "button";
      key: string;
      /** Fixed width; info items share what is left. */
      w: number;
      label?: string;
      icon?: KitIcon;
      /** A count after the icon ("×2"). */
      count?: number;
      active?: boolean;
      disabled?: boolean;
      onTap: () => void;
      onDisabled?: () => void;
    };

/** A stitched strip of info and buttons, all one height. Returns the strip. */
export function toolbar(
  app: App,
  x: number,
  y: number,
  w: number,
  items: ToolbarItem[],
): Rect {
  const { ctx } = app;
  const r = { x, y, w, h: K.bar };
  framed(ctx, r, C.cream, K.bar / 2, 4);
  const inner = K.pad - 4;
  const fixed = items.reduce(
    (n, it) => n + (it.kind === "button" ? it.w : 0),
    0,
  );
  const infos = items.filter((it) => it.kind === "info").length;
  const free =
    (r.w - inner * 2 - fixed - K.gap * (items.length - 1)) / Math.max(1, infos);
  let cx = r.x + inner;
  const by = r.y + (K.bar - K.barButton) / 2 - 2;
  for (const it of items) {
    if (it.kind === "info") {
      drawIcon(app, it.icon, cx + K.icon / 2 + 4, r.y + K.bar / 2);
      text(ctx, it.text, cx + K.icon + 12, r.y + K.bar / 2, {
        size: 16,
        align: "left",
        maxWidth: free - K.icon - 14,
        fill: it.color ?? C.text,
      });
      cx += free + K.gap;
      continue;
    }
    const b = { x: cx, y: by, w: it.w, h: K.barButton };
    // An unavailable button stays solid (a see-through one looks broken);
    // only its content fades, and a tap explains why
    btn(app, it.key, b, "", (it.disabled ? it.onDisabled : it.onTap) ?? noop, {
      fill: it.active ? "#ffd6a8" : it.disabled ? "#efe6da" : C.cream,
    });
    // Icon and label sit together in the middle of the button's face
    const sink = app.ui.isPressed(it.key) ? 5 : 0;
    const face = b.y + (b.h - 6) / 2 + sink;
    const label = it.label ?? (it.count !== undefined ? `×${it.count}` : "");
    ctx.font = `700 ${K.label - 1}px ${FONT}`;
    const lw = label ? ctx.measureText(label).width : 0;
    const iw = it.icon ? K.icon : 0;
    const total = iw + (iw && lw ? 6 : 0) + lw;
    let ix = b.x + (b.w - total) / 2;
    ctx.save();
    if (it.disabled) ctx.globalAlpha = 0.5;
    if (it.icon) {
      drawIcon(app, it.icon, ix + iw / 2, face);
      ix += iw + (lw ? 6 : 0);
    }
    if (label) text(ctx, label, ix, face, { size: K.label - 1, align: "left" });
    ctx.restore();
    cx += it.w + K.gap;
  }
  return r;
}

/** The page width inside a dialog drawn on a board `w` wide. */
export const dialogPage = (w: number) => w - 52;

/**
 * How tall a dialog must be so `lines` of text, the first centred `textTop`
 * below the board's top and `lineH` apart, clear its button row.
 */
export const dialogHeight = (textTop: number, lines: number, lineH: number) =>
  textTop + (lines - 1) * lineH + lineH / 2 + 22 + K.button + K.inset + 24;

/** A dialog button: the label, what it does, and how it looks. */
export interface DialogButton {
  key: string;
  label: string;
  onTap: () => void;
  fill?: string;
  size?: number;
  disabled?: boolean;
  /** Share of the row's width (default 1). */
  weight?: number;
}

/**
 * A row of buttons along the bottom of a dialog drawn on `board` (the rect
 * passed to `dialog`/`sheet`), kept K.inset inside its stitched border.
 * Returns the row, so content above can stop short of it.
 */
export function dialogButtons(
  app: App,
  board: Rect,
  buttons: DialogButton[],
): Rect {
  // The stitch runs 22px in from the board's sides and 24px up from its bottom
  const row = {
    x: board.x + 22 + K.inset,
    y: board.y + board.h - 24 - K.inset - K.button,
    w: board.w - (22 + K.inset) * 2,
    h: K.button,
  };
  const total = buttons.reduce((n, b) => n + (b.weight ?? 1), 0);
  const free = row.w - K.gap * 1.5 * (buttons.length - 1);
  let x = row.x;
  for (const b of buttons) {
    const w = (free * (b.weight ?? 1)) / total;
    btn(app, b.key, { x, y: row.y, w, h: row.h }, b.label, b.onTap, {
      fill: b.fill,
      size: b.size ?? 21,
      disabled: b.disabled,
    });
    x += w + K.gap * 1.5;
  }
  return row;
}

/** Two rounded bars: the pause glyph. */
export function pauseGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const w = size * 0.22;
  const h = size * 0.62;
  for (const dx of [-size * 0.17, size * 0.17]) {
    rr(ctx, cx + dx - w / 2, cy - h / 2, w, h, w / 2);
    ctx.fillStyle = "#c9a27e";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
}

/** The round pause button, wherever time runs. */
export function pauseButton(app: App, cx: number, cy: number) {
  roundButton(
    app,
    "pause",
    cx,
    cy,
    { name: "pause", fallback: (x, y, s) => pauseGlyph(app.ctx, x, y, s) },
    () => app.setPaused(true),
  );
}

/** A row of tabs; the open one is tinted like a dialog title. */
export function tabs(
  app: App,
  r: Rect,
  labels: string[],
  open: number,
  onPick: (i: number) => void,
) {
  const { ctx } = app;
  const w = (r.w - K.gap * (labels.length - 1)) / labels.length;
  labels.forEach((label, i) => {
    const key = `tab-${i}`;
    const on = i === open;
    const t = { x: r.x + i * (w + K.gap), y: r.y, w, h: r.h };
    const sink = app.ui.isPressed(key) && !on ? 2 : 0;
    panel(
      ctx,
      { ...t, y: t.y + sink },
      { fill: on ? "#dff3f6" : C.cream, radius: r.h / 2, line: K.line },
    );
    text(ctx, label, t.x + w / 2, t.y + r.h / 2 + sink, {
      size: on ? K.label : K.label - 2,
      fill: on ? C.text : C.muted,
      maxWidth: w - 16,
    });
    app.ui.add({
      rect: t,
      key,
      tap: () => {
        if (on) return;
        app.sfx.tap();
        onPick(i);
      },
    });
  });
}

/**
 * A forecast card that leads with the weather: a big icon on a tinted disc,
 * a small title, the weather in large type, then the details.
 */
export function weatherCard(
  app: App,
  x: number,
  y: number,
  w: number,
  card: {
    title: string;
    headline: string;
    icon: KitIcon;
    /** Disc colour behind the icon (sunny yellow, cloudy grey...). */
    tint: string;
    lines: { text: string; color?: string }[];
  },
): Rect {
  const { ctx } = app;
  const disc = 84;
  const tx = x + 22 + disc + 16;
  const tw = x + w - 18 - tx;
  const wrapped = card.lines.flatMap((l) =>
    wrap(ctx, l.text, tw, 17).map((t) => ({ text: t, color: l.color })),
  );
  const r = { x, y, w, h: Math.max(120, 84 + wrapped.length * 24 + 10) };
  framed(ctx, r, C.card, 26);
  const dcx = x + 22 + disc / 2;
  const dcy = y + 14 + disc / 2 + 2;
  ctx.beginPath();
  ctx.arc(dcx, dcy, disc / 2, 0, Math.PI * 2);
  ctx.fillStyle = card.tint;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(90, 52, 36, 0.35)";
  ctx.stroke();
  drawIcon(app, card.icon, dcx, dcy, disc - 14);
  text(ctx, card.title, tx, y + 26, {
    size: 15,
    align: "left",
    fill: C.muted,
    maxWidth: tw,
  });
  text(ctx, card.headline, tx, y + 56, {
    size: 28,
    align: "left",
    maxWidth: tw,
  });
  wrapped.forEach((l, i) => {
    text(ctx, l.text, tx, y + 88 + i * 24, {
      size: 17,
      align: "left",
      fill: l.color ?? C.text,
    });
  });
  return r;
}

/** A little desk calendar: the weekday on a red band, the day below. */
export function calendar(
  app: App,
  right: number,
  y: number,
  weekday: string,
  day: string,
  extra: {
    /** The time of day, under the date. */
    time?: string;
    /** A picture on the left of the page (tomorrow's weather). */
    badge?: (cx: number, cy: number) => void;
    /** Stand off the screen like a button: a lip and a soft shadow. */
    raised?: boolean;
  } = {},
): Rect {
  const { ctx } = app;
  const pic = extra.badge ? 34 : 0;
  ctx.font = `700 13px ${FONT}`;
  const ww = ctx.measureText(weekday).width;
  ctx.font = `700 ${extra.time ? 18 : 21}px ${FONT}`;
  const dw = ctx.measureText(day).width;
  const w = Math.max(92, ww + 28, dw + 28 + pic);
  const r = { x: right - w, y, w, h: extra.time ? 72 : 54 };
  if (extra.raised) {
    raise(ctx, r, 12);
    panel(
      ctx,
      { ...r, y: r.y + 4 },
      { fill: "#d9c6a8", radius: 12, line: K.line },
    );
  }
  panel(ctx, r, { fill: C.cream, radius: 12, line: K.line });
  // The band, clipped to the card's rounded top
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.clip();
  ctx.fillStyle = "#ef8a7e";
  ctx.fillRect(r.x, r.y, r.w, 20);
  ctx.fillStyle = C.ink;
  ctx.fillRect(r.x, r.y + 20, r.w, 2);
  ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.lineWidth = K.line;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // Two binder rings over the band
  for (const dx of [0.3, 0.7]) {
    const rx = r.x + r.w * dx;
    rr(ctx, rx - 3, r.y - 6, 6, 12, 3);
    ctx.fillStyle = "#c9a27e";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  text(ctx, weekday, r.x + r.w / 2, r.y + 11, {
    size: 13,
    fill: C.white,
    maxWidth: r.w - 10,
  });
  // The page: the picture on the left, the date (and the time) beside it
  const body = r.y + 22 + (r.h - 22) / 2;
  if (extra.badge) extra.badge(r.x + 8 + pic / 2, body);
  const tx = r.x + pic + (r.w - pic) / 2;
  if (extra.time) {
    text(ctx, day, tx, body - 11, { size: 18, maxWidth: r.w - pic - 10 });
    text(ctx, extra.time, tx, body + 12, { size: 17, fill: C.muted });
  } else text(ctx, day, tx, r.y + 38, { size: 21, maxWidth: r.w - pic - 10 });
  return r;
}

/** The round price sticker on a product: the price, nothing else. */
export function priceSticker(
  app: App,
  cx: number,
  cy: number,
  price: number,
  r: number,
) {
  const { ctx } = app;
  // A scalloped sticker, like a supermarket price burst
  ctx.beginPath();
  const bumps = 14;
  for (let i = 0; i <= bumps * 2; i++) {
    const a = (i / (bumps * 2)) * Math.PI * 2;
    const d = i % 2 ? r : r * 0.9;
    ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffd86b";
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // The yellow burst already says "price": just the number, big
  text(ctx, String(price), cx, cy + 1, {
    size: r * (price >= 100 ? 0.7 : 0.9),
    fill: "#b0412c",
    maxWidth: r * 1.5,
  });
}

/**
 * A small tinted tile: a picture on top, a short label, and a value. The
 * building block for summaries (the day's report, a recipe's facts).
 */
export function statTile(
  app: App,
  r: Rect,
  tile: {
    /** A sprite name (or an icon-* name). */
    picture: string;
    label: string;
    value: string;
    color?: string;
    tint?: string;
    /** Draw the picture greyed out (something that went wrong). */
    faded?: boolean;
  },
) {
  const { ctx } = app;
  panel(ctx, r, { fill: tile.tint ?? C.white, radius: 16, line: 2 });
  ctx.save();
  if (tile.faded) ctx.globalAlpha *= 0.55;
  icon(app, tile.picture, r.x + r.w / 2, r.y + 26, 36, () => undefined);
  ctx.restore();
  text(ctx, tile.label, r.x + r.w / 2, r.y + 54, {
    size: 12,
    fill: C.muted,
    maxWidth: r.w - 10,
  });
  text(ctx, tile.value, r.x + r.w / 2, r.y + r.h - 16, {
    size: 18,
    fill: tile.color ?? C.text,
    maxWidth: r.w - 10,
  });
}

/**
 * An on/off switch: a pill track, green when on, with a white knob that slides
 * across when tapped. `cx`, `cy` is its centre.
 */
export function toggle(
  app: App,
  key: string,
  cx: number,
  cy: number,
  on: boolean,
  onTap: () => void,
) {
  const { ctx } = app;
  const w = 92;
  const h = 46;
  const lip = 4;
  const k = app.motion.slide(key, on);
  const x = cx - w / 2;
  const y = cy - h / 2;
  // The base under the track, then the track itself
  rr(ctx, x, y + lip, w, h - lip, (h - lip) / 2);
  ctx.fillStyle = on ? "#93c06e" : "#cbbfb1";
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  rr(ctx, x, y, w, h - lip, (h - lip) / 2);
  ctx.fillStyle = on ? C.green : "#e9e2d8";
  ctx.fill();
  ctx.stroke();
  const r = (h - lip) / 2 - 5;
  const kx = x + 5 + r + k * (w - 10 - r * 2);
  ctx.beginPath();
  ctx.arc(kx, y + (h - lip) / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.stroke();
  app.ui.add({
    rect: { x: x - 10, y: y - 10, w: w + 20, h: h + 20 },
    key,
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}

/**
 * A wide cream button with an icon in a white circle before its label (the
 * settings' list). `drawIcon` draws into an `s`-sized square at (cx, cy).
 */
export function menuButton(
  app: App,
  key: string,
  r: Rect,
  label: string,
  drawIcon: (cx: number, cy: number, s: number) => void,
  onTap: () => void,
  opts: { fill?: string } = {},
) {
  const { ctx } = app;
  const pressed = app.ui.isPressed(key);
  button(ctx, r, "", { fill: opts.fill, pressed });
  // Same face as button(): it stands on a 6px lip and sinks 5px when pressed
  const face = r.h - 6;
  const cy = r.y + face / 2 + (pressed ? 5 : 0);
  const ir = face * 0.36;
  const icx = r.x + 16 + ir;
  ctx.beginPath();
  ctx.arc(icx, cy, ir, 0, Math.PI * 2);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  drawIcon(icx, cy, ir * 1.5);
  text(ctx, label, icx + ir + 14, cy - 1, {
    size: 21,
    weight: 600,
    align: "left",
    maxWidth: r.x + r.w - (icx + ir + 14) - 18,
  });
  app.ui.add({
    rect: r,
    key,
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}

/** A soft shadow under a shape that stands off the screen (drawn before it). */
export function raise(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.save();
  ctx.shadowColor = "rgba(74, 44, 30, 0.35)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 5;
  rr(ctx, r.x, r.y + 4, r.w, r.h, radius);
  ctx.fillStyle = "#d9c6a8";
  ctx.fill();
  ctx.restore();
}
