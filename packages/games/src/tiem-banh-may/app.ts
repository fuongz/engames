import type { Rect, Runtime } from "../core";
import {
  C,
  FONT,
  backButton,
  button,
  chip,
  coin,
  coinCounter,
  heart,
  panel,
  text,
} from "./art";
import type { RecipeId, UpgradeId } from "./config";
import { H, W } from "./config";
import type { BakeState } from "./kitchen";
import type { Cart, DayReport, SaveData } from "./logic";
import type { ShopState } from "./shop";
import type { Sprites } from "./sprites";
import type { Strings } from "./strings";
import type { Ui } from "./ui";

// What every screen shares: the runtime, the save, navigation, toasts, sounds,
// and the HUD drawn the same way everywhere.

export type Screen =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "hub" }
  | { kind: "market"; cart: Cart }
  | {
      kind: "book";
      tab: 0 | 1;
      detail: RecipeId | null;
      bought?: RecipeId | UpgradeId;
    }
  | { kind: "pick" }
  | { kind: "bake"; bake: BakeState }
  | { kind: "shop"; shop: ShopState }
  | { kind: "report"; report: DayReport };

export interface Toast {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
  size: number;
}

export interface Sfx {
  tap(): void;
  coin(): void;
  good(): void;
  bad(): void;
  bell(): void;
  pour(): void;
}

export interface App {
  rt: Runtime;
  ctx: CanvasRenderingContext2D;
  ui: Ui;
  sprites: Sprites;
  sfx: Sfx;
  tr(): Strings;
  save: SaveData;
  screen: Screen;
  /** Seconds since mount, for idle animation. */
  time: number;
  go(screen: Screen): void;
  /** Replace the save and send it to the account (debounced unless `now`). */
  commit(next: SaveData, opts?: { now?: boolean; score?: boolean }): void;
  toast(
    text: string,
    x: number,
    y: number,
    color?: string,
    size?: number,
  ): void;
}

export { H, W };

/** Top of the visible area (the stage bleeds past 0 on tall phones). */
export const top = (app: App) => app.rt.stage.view.y;
/** The whole visible area, for backgrounds and modal shades. */
export const viewRect = (app: App): Rect => {
  const v = app.rt.stage.view;
  return { x: v.x, y: v.y, w: v.w, h: v.h };
};

export function makeSfx(rt: Runtime): Sfx {
  const a = rt.game.audio;
  return {
    tap: () =>
      a.tone({ freq: 720, to: 900, dur: 0.05, type: "triangle", vol: 0.12 }),
    coin: () => {
      a.tone({ freq: 988, dur: 0.08, type: "square", vol: 0.07 });
      a.tone({ freq: 1319, dur: 0.16, type: "square", vol: 0.07, delay: 0.07 });
    },
    good: () => {
      for (const [i, f] of [523, 659, 784, 1047].entries())
        a.tone({
          freq: f,
          dur: 0.14,
          type: "triangle",
          vol: 0.12,
          delay: i * 0.07,
        });
    },
    bad: () =>
      a.tone({ freq: 240, to: 110, dur: 0.35, type: "sawtooth", vol: 0.08 }),
    bell: () => {
      a.tone({ freq: 1568, dur: 0.25, type: "sine", vol: 0.1 });
      a.tone({ freq: 2093, dur: 0.3, type: "sine", vol: 0.07, delay: 0.12 });
    },
    pour: () => a.noise(0.06, 0.03),
  };
}

/**
 * Coins and reputation on the left, day and clock on the right. Returns the y
 * just under the HUD.
 */
export function hud(app: App, clock: string, coins = app.save.coins) {
  const { ctx } = app;
  const tr = app.tr();
  const y = top(app) + 14;
  coinCounter(ctx, 14, y, tr.num(coins), 50);
  chip(ctx, 18, y + 58, `${Math.round(app.save.rep)}`, 34, "left", 26);
  heart(ctx, 36, y + 75, 10);
  const day = `${tr.day(app.save.day)} · ${tr.weekdays[(app.save.day - 1) % 7]}`;
  chip(ctx, W - 14, y + 4, day, 38, "right");
  chip(ctx, W - 14, y + 50, clock, 38, "right");
  return y + 100;
}

/** Bottom-left round back button (the reference's), registered for taps. */
export function back(app: App, onTap: () => void) {
  const cx = 62;
  const cy = H - 66;
  const r = 40;
  backButton(app.ctx, cx, cy, r, app.ui.isPressed("back"));
  app.ui.add({
    rect: { x: cx - r - 6, y: cy - r - 6, w: r * 2 + 12, h: r * 2 + 12 },
    key: "back",
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}

/** Dim everything and swallow taps; `close` runs when the shade is tapped. */
export function shade(app: App, close?: () => void) {
  const v = viewRect(app);
  app.ctx.fillStyle = C.shade;
  app.ctx.fillRect(v.x, v.y, v.w, v.h);
  app.ui.block(v, close);
}

/** A lavender modal sheet with a white title. */
export function sheet(app: App, r: Rect, title: string) {
  panel(app.ctx, r, {
    fill: C.lavender,
    stroke: C.lavenderDeep,
    radius: 30,
    line: 5,
    lip: 6,
  });
  app.ui.block(r);
  text(app.ctx, title, r.x + r.w / 2, r.y + 38, {
    size: 32,
    fill: C.white,
    outline: C.ink,
    maxWidth: r.w - 40,
  });
}

/** Draw a cream button and register it; a disabled one runs `onDisabled` instead (to explain why). */
export function btn(
  app: App,
  key: string,
  r: Rect,
  label: string,
  onTap: () => void,
  opts: {
    fill?: string;
    disabled?: boolean;
    size?: number;
    color?: string;
    silent?: boolean;
    onDisabled?: () => void;
  } = {},
) {
  const disabled = !!opts.disabled;
  button(app.ctx, r, label, {
    fill: opts.fill,
    pressed: app.ui.isPressed(key) && !disabled,
    disabled,
    size: opts.size,
    color: opts.color,
  });
  app.ui.add({
    rect: r,
    key,
    tap: () => {
      if (disabled) {
        if (opts.onDisabled) {
          app.sfx.bad();
          opts.onDisabled();
        }
        return;
      }
      if (!opts.silent) app.sfx.tap();
      onTap();
    },
  });
}

/** A price on a cream button drawn with an empty label: coin and amount centred as one group. */
export function priceLabel(
  app: App,
  r: Rect,
  amount: string,
  size: number,
  opts: { pressed?: boolean; disabled?: boolean; color?: string } = {},
) {
  const { ctx } = app;
  ctx.save();
  if (opts.disabled) ctx.globalAlpha = 0.55;
  ctx.font = `800 ${size}px ${FONT}`;
  const radius = size * 0.55;
  const gap = 6;
  const width = radius * 2 + gap + ctx.measureText(amount).width;
  const x = r.x + r.w / 2 - width / 2;
  // Same baseline as button(): the face sits above a 5px lip and sinks 4px when pressed
  const y = r.y + (r.h - 5) / 2 + (opts.pressed ? 4 : 0);
  coin(ctx, x + radius, y, radius);
  text(ctx, amount, x + radius * 2 + gap, y, {
    size,
    align: "left",
    fill: opts.color,
  });
  ctx.restore();
}
