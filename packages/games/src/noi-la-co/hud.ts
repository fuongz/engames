// The 2D overlay drawn on the engine's stage canvas over the 3D sandbank: who
// is alive, whose turn it is to write, the word that just landed, the writing
// panel, the thumb controls and the result cards. Plain drawing functions;
// game.ts owns the state and passes it in.
import type { Rect } from "@web-games/core";
import { fitFontSize } from "@web-games/core";
import { MAX_HEARTS } from "./config";
import type { Strings } from "./strings";

export const FONT = '"Baloo 2", system-ui, sans-serif';
const INK = "#2b1d14";
const CREAM = "#fffaf0";
const GOLD = "#ffc928";
const RED = "#e5322b";

/** Visible area in logical units, already inside the safe-area insets. */
export type Safe = Rect;

export const cssColor = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const short = (name: string, max: number) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

function label(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, align: CanvasTextAlign = "center", fill = CREAM, weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size * 0.2);
  ctx.strokeStyle = INK;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** Text without an outline, shrunk to fit `max`. */
function plain(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, max: number, fill = INK, weight = 600, align: CanvasTextAlign = "center") {
  ctx.font = `${weight} ${Math.min(size, fitFontSize(ctx, str, size, max, FONT))}px ${FONT}`;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}

function panel(ctx: CanvasRenderingContext2D, r: Rect, fill: string, radius = 18) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, radius + 4);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
}

export function button(ctx: CanvasRenderingContext2D, r: Rect, text: string, pressed: boolean, fill = RED) {
  const dy = pressed ? 4 : 0;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(r.x - 3, r.y - 3 + 6, r.w + 6, r.h + 6, 18);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + dy, r.w, r.h, 16);
  ctx.fill();
  label(ctx, text, r.x + r.w / 2, r.y + r.h / 2 + dy, Math.min(28, fitFontSize(ctx, text, 28, r.w - 24, FONT)));
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean) {
  ctx.fillStyle = INK;
  ctx.fillRect(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4);
  ctx.fillStyle = full ? RED : "rgba(255,250,240,0.35)";
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  if (full) {
    ctx.fillStyle = "#ff8a80";
    ctx.fillRect(x - s / 2 + 2, y - s / 2 + 2, s / 3, s / 3);
  }
}

// ---------------------------------------------------------------- the top of the screen

export interface RosterSeat {
  color: number;
  hearts: number;
  alive: boolean;
  me: boolean;
  writer: boolean;
}

/** One chip per seat across the top: shirt colour, hearts, a gold frame on the writer. Returns its bottom edge. */
export function drawRoster(ctx: CanvasRenderingContext2D, safe: Safe, seats: readonly RosterSeat[]): number {
  const gap = 6;
  const w = Math.min(58, (safe.w - 24 - gap * (seats.length - 1)) / seats.length);
  const total = w * seats.length + gap * (seats.length - 1);
  const y = safe.y + 14;
  seats.forEach((p, i) => {
    const x = safe.x + (safe.w - total) / 2 + i * (w + gap);
    ctx.globalAlpha = p.alive ? 1 : 0.5;
    ctx.fillStyle = p.writer ? GOLD : INK;
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, w + 6, 50, 12);
    ctx.fill();
    ctx.fillStyle = p.alive ? cssColor(p.color) : "#8f97a8";
    ctx.beginPath();
    ctx.roundRect(x, y, w, 26, 9);
    ctx.fill();
    if (p.me) plain(ctx, "★", x + w / 2, y + 14, 18, w, CREAM, 800);
    ctx.fillStyle = "rgba(43,29,20,0.85)";
    ctx.beginPath();
    ctx.roundRect(x, y + 28, w, 16, 6);
    ctx.fill();
    const s = Math.min(9, (w - 12) / MAX_HEARTS - 3);
    for (let h = 0; h < MAX_HEARTS; h++) {
      ctx.fillStyle = h < p.hearts ? RED : "rgba(255,250,240,0.25)";
      ctx.fillRect(x + w / 2 + (h - (MAX_HEARTS - 1) / 2) * (s + 4) - s / 2, y + 36 - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  });
  return y + 50;
}

/** My own hearts, big, under the roster on the left. */
export function drawHearts(ctx: CanvasRenderingContext2D, x: number, y: number, hearts: number) {
  for (let h = 0; h < MAX_HEARTS; h++) heart(ctx, x + 14 + h * 34, y, 24, h < hearts);
}

/** Whose turn it is: one line under the roster. */
export function drawTurn(ctx: CanvasRenderingContext2D, safe: Safe, y: number, text: string, mine: boolean) {
  const size = fitFontSize(ctx, text, mine ? 26 : 21, safe.w - 40, FONT);
  label(ctx, text, safe.x + safe.w / 2, y, size, "center", mine ? GOLD : CREAM, mine ? 800 : 700);
}

export interface ActivePill {
  name: string;
  /** 1 → 0 as the event runs out. */
  left: number;
  kind: "harm" | "help" | "twist";
}

const PILL: Record<ActivePill["kind"], string> = { harm: "#e5484d", help: "#22a559", twist: "#7c5cff" };

/** The events running now, as small pills down the left edge with their time draining. */
export function drawActive(ctx: CanvasRenderingContext2D, safe: Safe, y: number, pills: readonly ActivePill[]) {
  pills.forEach((p, i) => {
    const r = { x: safe.x + 12, y: y + i * 32, w: 128, h: 26 };
    ctx.fillStyle = "rgba(43,29,20,0.78)";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 13);
    ctx.fill();
    ctx.fillStyle = PILL[p.kind];
    ctx.beginPath();
    ctx.roundRect(r.x + 3, r.y + 3, Math.max(8, (r.w - 6) * clamp01(p.left)), r.h - 6, 10);
    ctx.fill();
    plain(ctx, p.name, r.x + r.w / 2, r.y + r.h / 2 + 1, 15, r.w - 14, CREAM, 700);
  });
}

/** The word that just landed: its name big, how to live through it, who wrote it. */
export function drawWord(ctx: CanvasRenderingContext2D, safe: Safe, y: number, name: string, tip: string, by: string, k: number, kind: ActivePill["kind"]) {
  const cx = safe.x + safe.w / 2;
  const pop = 1 + Math.max(0, 1 - k * 6) * 0.35;
  ctx.globalAlpha = clamp01((1 - k) * 5);
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(pop, pop);
  label(ctx, name.toUpperCase(), 0, 0, fitFontSize(ctx, name.toUpperCase(), 54, safe.w - 60, FONT), "center", kind === "help" ? "#8df0a8" : kind === "twist" ? "#d5c8ff" : "#ffd9a8");
  ctx.restore();
  const w = Math.min(safe.w - 28, 480);
  ctx.fillStyle = "rgba(43,29,20,0.78)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y + 36, w, 34, 14);
  ctx.fill();
  plain(ctx, tip, cx, y + 54, 18, w - 20, CREAM, 700);
  plain(ctx, by, cx, y + 86, 15, w, "rgba(255,250,240,0.9)", 600);
  ctx.globalAlpha = 1;
}

/** Big centred line: the countdown, "Run!". */
export function drawCenter(ctx: CanvasRenderingContext2D, safe: Safe, text: string, k = 1) {
  ctx.globalAlpha = clamp01(k);
  label(ctx, text, safe.x + safe.w / 2, safe.y + safe.h * 0.38, 92);
  ctx.globalAlpha = 1;
}

/** A line near the bottom: "Connecting…", "Watching this match". */
export function drawNote(ctx: CanvasRenderingContext2D, safe: Safe, text: string) {
  label(ctx, text, safe.x + safe.w / 2, safe.y + safe.h - 60, 22, "center", "#ffe27a", 700);
}

/** A name over a head, at a stage point. */
export function drawNameTag(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, me: boolean, note = "") {
  const text = short(name, 12) + note;
  ctx.font = `700 15px ${FONT}`;
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = me ? "rgba(255,226,122,0.92)" : "rgba(43,29,20,0.66)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 11, w, 22, 11);
  ctx.fill();
  ctx.fillStyle = me ? INK : CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 1);
}

/** The dark word: everything black but a pool of light around you. */
export function drawDark(ctx: CanvasRenderingContext2D, view: Rect, x: number, y: number, k: number) {
  const radius = 150;
  const g = ctx.createRadialGradient(x, y, radius * 0.45, x, y, radius);
  g.addColorStop(0, "rgba(8,8,24,0)");
  g.addColorStop(1, `rgba(8,8,24,${0.93 * clamp01(k)})`);
  ctx.fillStyle = g;
  ctx.fillRect(view.x, view.y, view.w, view.h);
}

// ---------------------------------------------------------------- thumbs

export const STICK_R = 58;

export function drawStick(ctx: CanvasRenderingContext2D, base: { x: number; y: number }, knob: { x: number; y: number }, held: boolean) {
  ctx.globalAlpha = held ? 0.9 : 0.45;
  ctx.fillStyle = "rgba(255,250,240,0.2)";
  ctx.strokeStyle = "rgba(255,250,240,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(base.x, base.y, STICK_R + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,250,240,0.85)";
  ctx.beginPath();
  ctx.arc(knob.x, knob.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A round thumb button (jump, dash); `ready` is 0 → 1 as it recharges. */
export function drawDash(ctx: CanvasRenderingContext2D, r: Rect, text: string, ready: number, pressed: boolean, fill = "#3b82f6") {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + (pressed ? 3 : 0);
  const radius = r.w / 2;
  ctx.globalAlpha = ready >= 1 ? 0.95 : 0.55;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy + 4, radius + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  if (ready < 1) {
    ctx.fillStyle = "rgba(43,29,20,0.55)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - clamp01(ready)));
    ctx.closePath();
    ctx.fill();
  }
  label(ctx, text, cx, cy, Math.min(22, fitFontSize(ctx, text, 22, r.w - 16, FONT)));
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the map and the arrows

export interface MapMark {
  /** 0..1 across the bank. */
  x: number;
  y: number;
  color: string;
  size: number;
  ring?: boolean;
}

/**
 * The minimap: the bank (pre-drawn by the shell, one pixel per tile), the
 * players and the trouble on it, and a wedge for where the camera looks.
 */
export function drawMinimap(ctx: CanvasRenderingContext2D, r: Rect, bank: CanvasImageSource, marks: readonly MapMark[], view: { x: number; y: number; yaw: number } | null) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 10);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bank, r.x, r.y, r.w, r.h);
  if (view) {
    // The camera looks along -(sin yaw, cos yaw) on the bank
    const cx = r.x + view.x * r.w;
    const cy = r.y + view.y * r.h;
    const a = Math.atan2(-Math.cos(view.yaw), -Math.sin(view.yaw));
    ctx.fillStyle = "rgba(255,250,240,0.35)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r.w * 0.45, a - 0.55, a + 0.55);
    ctx.closePath();
    ctx.fill();
  }
  for (const m of marks) {
    const x = r.x + m.x * r.w;
    const y = r.y + m.y * r.h;
    ctx.beginPath();
    ctx.arc(x, y, m.size, 0, Math.PI * 2);
    if (m.ring) {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A red arrow on the edge of the screen pointing at trouble the camera does not show. */
export function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, clock: number) {
  const pulse = 1 + Math.sin(clock * 10) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -16);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -11);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the writing panel

export interface WriteLayout {
  panel: Rect;
  chips: Rect[];
  field: Rect;
  send: Rect;
}

/** Where the writing panel sits: above the thumb controls, across the screen. */
export function writeLayout(safe: Safe): WriteLayout {
  const w = Math.min(safe.w - 24, 500);
  const x = safe.x + (safe.w - w) / 2;
  const y = safe.y + safe.h - 372;
  const chipW = (w - 24 - 10) / 2;
  const chips: Rect[] = [];
  for (let i = 0; i < 4; i++) chips.push({ x: x + 12 + (i % 2) * (chipW + 10), y: y + 12 + Math.floor(i / 2) * 50, w: chipW, h: 42 });
  const field = { x: x + 12, y: y + 114, w: w - 24 - 100, h: 46 };
  const send = { x: x + w - 12 - 90, y: y + 114, w: 90, h: 46 };
  return { panel: { x, y, w, h: 172 }, chips, field, send };
}

export function drawWrite(ctx: CanvasRenderingContext2D, l: WriteLayout, tr: Strings, chips: readonly string[], pressed: number, left: number, keys: boolean) {
  panel(ctx, l.panel, "rgba(255,248,232,0.96)");
  // The time left, as a bar along the top edge
  ctx.fillStyle = left < 0.3 ? RED : GOLD;
  ctx.beginPath();
  ctx.roundRect(l.panel.x + 10, l.panel.y - 2, (l.panel.w - 20) * clamp01(left), 6, 3);
  ctx.fill();
  l.chips.forEach((r, i) => {
    if (!chips[i]) return;
    const dy = pressed === i ? 3 : 0;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(r.x - 2, r.y - 2 + 4, r.w + 4, r.h + 4, 14);
    ctx.fill();
    ctx.fillStyle = i < 2 ? "#ffd9a8" : i === 2 ? "#d5c8ff" : "#b6f0c5";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y + dy, r.w, r.h, 12);
    ctx.fill();
    plain(ctx, keys ? `${i + 1}. ${chips[i]}` : chips[i], r.x + r.w / 2, r.y + r.h / 2 + dy + 1, 21, r.w - 16, INK, 800);
  });
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(l.field.x - 2, l.field.y - 2, l.field.w + 4, l.field.h + 4, 14);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(l.field.x, l.field.y, l.field.w, l.field.h, 12);
  ctx.fill();
  button(ctx, l.send, tr.send, pressed === 4, "#22a559");
  if (keys) plain(ctx, tr.typeKeys.replace(/[[\]]/g, ""), l.panel.x + l.panel.w / 2, l.panel.y + l.panel.h + 16, 15, l.panel.w, CREAM, 700);
}

// ---------------------------------------------------------------- screens and cards

export function drawReady(ctx: CanvasRenderingContext2D, safe: Safe, tr: Strings, t: number, best: number, keys: boolean) {
  const cx = safe.x + safe.w / 2;
  label(ctx, tr.title, cx, safe.y + safe.h * 0.16, fitFontSize(ctx, tr.title, 68, safe.w - 50, FONT));
  label(ctx, tr.sub, cx, safe.y + safe.h * 0.16 + 54, fitFontSize(ctx, tr.sub, 22, safe.w - 40, FONT), "center", "#ffe27a", 700);
  if (best > 0) label(ctx, tr.best(best), cx, safe.y + safe.h * 0.16 + 90, 20, "center", CREAM, 600);
  const pulse = 1 + Math.sin(t * 4) * 0.04;
  ctx.save();
  ctx.translate(cx, safe.y + safe.h - 96);
  ctx.scale(pulse, pulse);
  label(ctx, tr.tapToStart, 0, 0, 34);
  ctx.restore();
  const hint = keys ? tr.keysHint : tr.startHint;
  label(ctx, hint, cx, safe.y + safe.h - 50, fitFontSize(ctx, hint, 19, safe.w - 30, FONT), "center", CREAM, 600);
}

export function drawPaused(ctx: CanvasRenderingContext2D, view: Rect, safe: Safe, tr: Strings) {
  ctx.fillStyle = "rgba(20,12,8,0.5)";
  ctx.fillRect(view.x, view.y, view.w, view.h);
  label(ctx, tr.paused, safe.x + safe.w / 2, safe.y + safe.h / 2 - 24, 48);
  label(ctx, tr.tapToResume, safe.x + safe.w / 2, safe.y + safe.h / 2 + 30, 24, "center", CREAM, 600);
}

export function drawNoWebGL(ctx: CanvasRenderingContext2D, view: Rect, safe: Safe, text: string) {
  ctx.fillStyle = "#8a6a4c";
  ctx.fillRect(view.x, view.y, view.w, view.h);
  label(ctx, text, safe.x + safe.w / 2, safe.y + safe.h / 2, fitFontSize(ctx, text, 22, safe.w - 40, FONT), "center", CREAM, 700);
}

export interface SoloCard {
  title: string;
  place: string;
  points: number;
  best: number;
  newBest: boolean;
  /** Out but the match goes on: offer to stay and write as a ghost. */
  canStay: boolean;
}

/** The solo result card; returns the buttons' rects. */
export function drawSoloCard(ctx: CanvasRenderingContext2D, view: Rect, safe: Safe, tr: Strings, card: SoloCard, k: number, pressed: "again" | "stay" | null): { again: Rect; stay: Rect | null } {
  ctx.fillStyle = `rgba(20,12,8,${0.4 * clamp01(k)})`;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  const w = Math.min(440, safe.w - 40);
  const h = card.canStay ? 400 : 320;
  const r: Rect = { x: safe.x + (safe.w - w) / 2, y: safe.y + safe.h / 2 - h / 2 + (1 - clamp01(k)) * 60, w, h };
  ctx.globalAlpha = clamp01(k);
  panel(ctx, r, "rgba(255,248,232,0.97)");
  const cx = r.x + w / 2;
  label(ctx, card.title, cx, r.y + 46, fitFontSize(ctx, card.title, 38, w - 40, FONT));
  label(ctx, card.place, cx, r.y + 100, 30, "center", "#ffe27a");
  label(ctx, tr.points(card.points), cx, r.y + 150, 44, "center", GOLD);
  label(ctx, card.newBest ? tr.newBest : tr.best(card.best), cx, r.y + 196, 22, "center", card.newBest ? "#ffe27a" : CREAM, 700);
  const again: Rect = { x: cx - 130, y: r.y + 232, w: 260, h: 58 };
  button(ctx, again, tr.again, pressed === "again");
  let stay: Rect | null = null;
  if (card.canStay) {
    stay = { x: cx - 130, y: r.y + 306, w: 260, h: 52 };
    button(ctx, stay, tr.keepHaunting, pressed === "stay", "#7c5cff");
    plain(ctx, tr.ghostHint, cx, r.y + 378, 15, w - 30);
  }
  ctx.globalAlpha = 1;
  return { again, stay };
}

export interface ResultRow {
  name: string;
  score: number;
  me: boolean;
  color: number;
}

/** The online result card; returns the back-to-lobby button's rect. */
export function drawResults(ctx: CanvasRenderingContext2D, view: Rect, safe: Safe, tr: Strings, title: string, rows: readonly ResultRow[], k: number, pressed: boolean): Rect {
  ctx.fillStyle = `rgba(20,12,8,${0.4 * clamp01(k)})`;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  const w = Math.min(440, safe.w - 40);
  const h = 170 + rows.length * 40;
  const r: Rect = { x: safe.x + (safe.w - w) / 2, y: safe.y + safe.h / 2 - h / 2 + (1 - clamp01(k)) * 60, w, h };
  ctx.globalAlpha = clamp01(k);
  panel(ctx, r, "rgba(255,248,232,0.97)");
  const cx = r.x + w / 2;
  label(ctx, title, cx, r.y + 44, fitFontSize(ctx, title, 38, w - 40, FONT));
  rows.forEach((x, i) => {
    const y = r.y + 98 + i * 40;
    if (x.me) {
      ctx.fillStyle = "rgba(255,201,40,0.35)";
      ctx.beginPath();
      ctx.roundRect(r.x + 14, y - 18, w - 28, 36, 12);
      ctx.fill();
    }
    ctx.fillStyle = cssColor(x.color);
    ctx.fillRect(r.x + 26, y - 9, 18, 18);
    plain(ctx, `${i + 1}. ${short(x.name, 16)}`, r.x + 54, y + 1, 21, w - 190, INK, 700, "left");
    plain(ctx, tr.points(x.score), r.x + w - 28, y + 1, 21, 120, INK, 700, "right");
  });
  const back: Rect = { x: cx - 130, y: r.y + h - 78, w: 260, h: 58 };
  button(ctx, back, tr.backToLobby, pressed);
  ctx.globalAlpha = 1;
  return back;
}

/** A small corner button (solo, once you are a ghost): play again without waiting. */
export function drawCorner(ctx: CanvasRenderingContext2D, safe: Safe, text: string, pressed: boolean): Rect {
  const r: Rect = { x: safe.x + safe.w - 148, y: safe.y + safe.h - 70, w: 136, h: 46 };
  button(ctx, r, text, pressed);
  return r;
}
