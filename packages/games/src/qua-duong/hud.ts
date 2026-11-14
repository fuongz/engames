// The 2D overlay drawn on the engine's stage canvas over the 3D street: score,
// best and coins, the start screen with the outfit picker, pause and game over.
// Plain drawing functions; game.ts owns the state and passes it in.
import type { Rect } from "@web-games/core";
import { fitFontSize } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { TICKETS_PER_COIN } from "./config";
import type { Strings } from "./strings";

export const FONT = '"Baloo 2", system-ui, sans-serif';
const INK = "#2b1d14";
const CREAM = "#fffaf0";
const GOLD = "#ffc928";

/** Visible area in logical units, already inside the safe-area insets. */
export type Safe = Rect;

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

function coinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(x - s / 2 - 3, y - s / 2 - 3, s + 6, s + 6);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
  ctx.fillStyle = "#ffe27a";
  ctx.fillRect(x - s / 4, y - s / 4, s / 2, s / 2);
}

function panel(ctx: CanvasRenderingContext2D, r: Rect, fill: string) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 22);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 18);
  ctx.fill();
}

export function button(ctx: CanvasRenderingContext2D, r: Rect, text: string, pressed: boolean) {
  const dy = pressed ? 4 : 0;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(r.x - 3, r.y - 3 + 6, r.w + 6, r.h + 6, 18);
  ctx.fill();
  ctx.fillStyle = "#e0453a";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + dy, r.w, r.h, 16);
  ctx.fill();
  label(ctx, text, r.x + r.w / 2, r.y + r.h / 2 + dy, Math.min(30, fitFontSize(ctx, text, 30, r.w - 24, FONT)));
}

export function drawScore(ctx: CanvasRenderingContext2D, safe: Safe, tr: Strings, score: number, best: number | null, coins: number, tickets: number | null = null) {
  label(ctx, String(score), safe.x + 22, safe.y + 44, 58, "left");
  if (best !== null) label(ctx, tr.best(best), safe.x + 24, safe.y + 92, 22, "left", CREAM, 600);
  const right = safe.x + safe.w - 22;
  ctx.font = `800 34px ${FONT}`;
  const w = ctx.measureText(String(coins)).width;
  label(ctx, String(coins), right, safe.y + 40, 34, "right", GOLD);
  coinIcon(ctx, right - w - 26, safe.y + 40, 22);
  if (tickets !== null) label(ctx, tr.tickets(tickets), right, safe.y + 80, 20, "right", CREAM, 700);
}

/** The outfit picker's two arrows, either side of the outfit name. */
export function skinArrows(safe: Safe): { prev: Rect; next: Rect; y: number } {
  const y = safe.y + safe.h - 168;
  return {
    prev: { x: safe.x + safe.w / 2 - 190, y: y - 30, w: 64, h: 60 },
    next: { x: safe.x + safe.w / 2 + 126, y: y - 30, w: 64, h: 60 },
    y,
  };
}

export function drawReady(
  ctx: CanvasRenderingContext2D,
  safe: Safe,
  tr: Strings,
  t: number,
  skinName: string,
  showKeys: boolean,
  /** Outfits not owned yet (sold at the Prize Counter). */
  locked: number,
  /** More than one outfit owned: the arrows do something. */
  canCycle: boolean,
) {
  const cx = safe.x + safe.w / 2;
  const size = fitFontSize(ctx, tr.title, 68, safe.w - 60, FONT);
  label(ctx, tr.title, cx, safe.y + safe.h * 0.2, size);
  const pulse = 1 + Math.sin(t * 4) * 0.04;
  ctx.save();
  ctx.translate(cx, safe.y + safe.h - 92);
  ctx.scale(pulse, pulse);
  label(ctx, tr.tapToStart, 0, 0, 34);
  ctx.restore();
  label(ctx, showKeys ? tr.keysHint : tr.startHint, cx, safe.y + safe.h - 48, 19, "center", CREAM, 600);
  const a = skinArrows(safe);
  label(ctx, `${tr.skin}: ${skinName}`, cx, a.y, 24, "center", CREAM, 700);
  if (locked > 0) label(ctx, tr.moreSkins(locked), cx, a.y + 42, 17, "center", "#ffe27a", 600);
  ctx.globalAlpha = canCycle ? 1 : 0.45;
  for (const [r, glyph] of [
    [a.prev, "◀"],
    [a.next, "▶"],
  ] as const) {
    panel(ctx, r, "rgba(255,250,240,0.92)");
    ctx.fillStyle = INK;
    ctx.font = `800 28px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyph, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
  ctx.globalAlpha = 1;
}

export function drawHurry(ctx: CanvasRenderingContext2D, safe: Safe, tr: Strings, t: number) {
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 10);
  label(ctx, tr.hurry, safe.x + safe.w / 2, safe.y + safe.h - 60, 22, "center", "#ffe27a", 700);
  ctx.globalAlpha = 1;
}

export function drawPaused(ctx: CanvasRenderingContext2D, view: Rect, safe: Safe, tr: Strings) {
  ctx.fillStyle = "rgba(20,12,8,0.45)";
  ctx.fillRect(view.x, view.y, view.w, view.h);
  label(ctx, tr.paused, safe.x + safe.w / 2, safe.y + safe.h / 2 - 24, 48);
  label(ctx, tr.tapToResume, safe.x + safe.w / 2, safe.y + safe.h / 2 + 30, 24, "center", CREAM, 600);
}

export interface OverCard {
  reason: string;
  rows: number;
  coins: number;
  best: number;
  newBest: boolean;
  /** Tickets paid into the shared wallet, when signed in. */
  tickets: number | null;
  ticketCap: boolean;
}

/** Game-over card; returns the retry button's rect. */
export function drawOver(ctx: CanvasRenderingContext2D, view: Rect, safe: Safe, tr: Strings, card: OverCard, k: number, pressed: boolean): Rect {
  ctx.fillStyle = `rgba(20,12,8,${0.35 * k})`;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  const w = Math.min(440, safe.w - 40);
  const h = 380;
  const r: Rect = { x: safe.x + (safe.w - w) / 2, y: safe.y + safe.h / 2 - h / 2 + (1 - k) * 60, w, h };
  ctx.globalAlpha = k;
  panel(ctx, r, "rgba(255,248,232,0.97)");
  const cx = r.x + w / 2;
  label(ctx, tr.over, cx, r.y + 44, 40);
  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.fillText(card.reason, cx, r.y + 86, w - 30);
  label(ctx, tr.rows(card.rows), cx, r.y + 134, 46, "center", GOLD);
  label(ctx, card.newBest ? tr.newBest : tr.best(card.best), cx, r.y + 182, 24, "center", card.newBest ? "#ffe27a" : CREAM, 700);
  // What the coins were for: each one is worth TICKETS_PER_COIN tickets
  const coinLine = tr.coinValue(card.coins, card.coins * TICKETS_PER_COIN);
  ctx.font = `800 22px ${FONT}`;
  const cw = ctx.measureText(coinLine).width;
  coinIcon(ctx, cx - cw / 2 - 14, r.y + 218, 18);
  label(ctx, coinLine, cx + 14, r.y + 218, 22, "center", GOLD);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  if (card.tickets === null) {
    ctx.fillText(tr.signInForTickets, cx, r.y + 250, w - 30);
  } else {
    label(ctx, tr.ticketsWon(card.tickets), cx, r.y + 252, 24, "center", "#ffe27a");
    if (card.ticketCap) {
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.fillText(tr.ticketCap, cx, r.y + 280, w - 30);
    }
  }
  const again: Rect = { x: cx - 130, y: r.y + h - 82, w: 260, h: 60 };
  button(ctx, again, tr.again, pressed);
  ctx.globalAlpha = 1;
  return again;
}

export function drawNoWebGL(ctx: CanvasRenderingContext2D, view: Rect, safe: Safe, text: string) {
  ctx.fillStyle = "#9fdcff";
  ctx.fillRect(view.x, view.y, view.w, view.h);
  label(ctx, text, safe.x + safe.w / 2, safe.y + safe.h / 2, 24, "center", CREAM, 700);
}

// ---------------------------------------------------------------- online race

/** Big centred line: the countdown, "Go!", "Time's up!". */
export function drawCenter(ctx: CanvasRenderingContext2D, safe: Safe, text: string, k = 1) {
  ctx.globalAlpha = clamp01(k);
  label(ctx, text, safe.x + safe.w / 2, safe.y + safe.h * 0.36, 92);
  ctx.globalAlpha = 1;
}

/** The race clock, top centre. */
export function drawClock(ctx: CanvasRenderingContext2D, safe: Safe, seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  label(ctx, text, safe.x + safe.w / 2, safe.y + 40, 34, "center", s <= 10 ? "#ffe27a" : CREAM);
}

export interface StandingRow {
  name: string;
  rows: number;
  me: boolean;
  out: boolean;
}

/** Who is where, under the coins: one line per racer, furthest first. */
export function drawStandings(ctx: CanvasRenderingContext2D, safe: Safe, rows: readonly StandingRow[]) {
  const right = safe.x + safe.w - 22;
  rows.forEach((r, i) => {
    const y = safe.y + 116 + i * 28;
    ctx.globalAlpha = r.out ? 0.5 : 1;
    const name = r.name.length > 12 ? `${r.name.slice(0, 11)}…` : r.name;
    label(ctx, `${i + 1}. ${name}  ${r.rows}`, right, y, 19, "right", r.me ? "#ffe27a" : CREAM, 700);
  });
  ctx.globalAlpha = 1;
}

/** A racer's name above their duck, at a stage point. */
export function drawNameTag(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, me: boolean) {
  const text = name.length > 14 ? `${name.slice(0, 13)}…` : name;
  ctx.font = `700 17px ${FONT}`;
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = me ? "rgba(255,226,122,0.92)" : "rgba(43,29,20,0.72)";
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 14, w, 26, 13);
  ctx.fill();
  ctx.fillStyle = me ? INK : CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

/** A pulsing red "!" badge, over a dog-thief bike about to swing its net. */
export function drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number) {
  const r = 17 + Math.sin(clock * 22) * 2.5;
  const by = y - Math.abs(Math.sin(clock * 11)) * 5;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, by, r + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e5322b";
  ctx.beginPath();
  ctx.arc(x, by, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.fillRect(x - 3, by - r * 0.6, 6, r * 0.75);
  ctx.fillRect(x - 3, by + r * 0.3, 6, 6);
}

/** A line along the bottom: "You're out! Watching An". */
export function drawBanner(ctx: CanvasRenderingContext2D, safe: Safe, text: string) {
  label(ctx, text, safe.x + safe.w / 2, safe.y + safe.h - 60, 24, "center", "#ffe27a", 700);
}

/** The race result card; returns the back-to-lobby button's rect. */
export function drawResults(
  ctx: CanvasRenderingContext2D,
  view: Rect,
  safe: Safe,
  tr: Strings,
  results: readonly SeatResult[],
  you: number,
  k: number,
  pressed: boolean,
): Rect {
  ctx.fillStyle = `rgba(20,12,8,${0.4 * k})`;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  const w = Math.min(440, safe.w - 40);
  const h = 170 + results.length * 46;
  const r: Rect = { x: safe.x + (safe.w - w) / 2, y: safe.y + safe.h / 2 - h / 2 + (1 - k) * 60, w, h };
  ctx.globalAlpha = clamp01(k);
  panel(ctx, r, "rgba(255,248,232,0.97)");
  const cx = r.x + w / 2;
  const mine = results.find((x) => x.seat === you);
  label(ctx, mine?.outcome ? tr.outcome[mine.outcome] : tr.raceOver, cx, r.y + 44, 38);
  const sorted = [...results].sort((a, b) => b.score - a.score);
  sorted.forEach((x, i) => {
    const y = r.y + 100 + i * 46;
    const me = x.seat === you;
    if (me) {
      ctx.fillStyle = "rgba(255,201,40,0.35)";
      ctx.beginPath();
      ctx.roundRect(r.x + 16, y - 20, w - 32, 40, 12);
      ctx.fill();
    }
    ctx.font = `700 22px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const name = x.name.length > 16 ? `${x.name.slice(0, 15)}…` : x.name;
    ctx.fillText(`${i + 1}. ${name}`, r.x + 30, y, w - 150);
    ctx.textAlign = "right";
    ctx.fillText(tr.rows(x.score), r.x + w - 30, y);
  });
  const back: Rect = { x: cx - 130, y: r.y + h - 82, w: 260, h: 60 };
  button(ctx, back, tr.backToLobby, pressed);
  ctx.globalAlpha = 1;
  return back;
}

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
