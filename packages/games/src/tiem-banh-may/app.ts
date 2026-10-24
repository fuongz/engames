import type { Rect, Runtime } from "../core";
import {
  C,
  FONT,
  backButton,
  button,
  dialog,
  closeButton,
  coin,
  text,
} from "./art";
import type { RecipeId, UpgradeId } from "./config";
import { H, W } from "./config";
import type { BakeState } from "./kitchen";
import type { Cart, DayReport, SaveData } from "./logic";
import type { SlotSummary } from "./cloud";
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
  /** `aisle`: which shelf page is open (0 dry goods, 1 chilled, 2 flavours). */
  | { kind: "market"; cart: Cart; aisle?: number }
  | {
      kind: "book";
      tab: 0 | 1;
      detail: RecipeId | null;
      bought?: RecipeId | UpgradeId;
    }
  | { kind: "pick" }
  /** A recipe just bought: a moment to enjoy it, then back to its page. */
  | { kind: "learned"; recipe: RecipeId; tab: 0 | 1; at: number }
  /** The display case, shelf by shelf. */
  | { kind: "display" }
  | { kind: "bake"; bake: BakeState }
  | { kind: "shop"; shop: ShopState }
  | { kind: "report"; report: DayReport }
  /** Choose one of the account's bakeries; `list` is null while it loads. */
  | { kind: "slots"; list: SlotSummary[] | null }
  /** Settings over the hub; `confirm` walks the two steps of starting over. */
  | { kind: "settings"; confirm: 0 | 1 | 2; busy?: boolean };

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
  /** Fast-forward the night clock (waiting on the oven, or for morning). */
  fast: boolean;
  /** A prompt is up: the night clock holds for this frame. */
  held: boolean;
  /** The player paused: clock, ovens and customers stand still. */
  paused: boolean;
  setPaused(on: boolean): void;
  /** A HUD stat's explanation is open (the clock holds while it is). */
  info: "rep" | "energy" | "mood" | null;
  /** The save slot being played (0-based). */
  slot: number;
  /** Account actions the slot picker and the settings call back into the shell. */
  shell: {
    /** Load (or start) the bakery in `slot`. */
    open(slot: number): void;
    /** Back to the slot picker. */
    pick(): void;
    /** Erase the current slot and start it fresh; false when offline. */
    restart(): Promise<boolean>;
    music: boolean;
    setMusic(on: boolean): void;
  };
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

/** A dialog modal: blocks taps behind it; returns the paper to draw on. */
export function sheet(app: App, r: Rect, title: string) {
  app.ui.block(r);
  return dialog(app.ctx, r, title);
}

/** The round orange close button at a board's top-right corner, registered for taps. */
export function close(app: App, board: Rect, onTap: () => void) {
  const cx = board.x + board.w - 10;
  const cy = board.y + 8;
  closeButton(app.ctx, cx, cy, 26, app.ui.isPressed("close"));
  app.ui.add({
    rect: { x: cx - 34, y: cy - 34, w: 68, h: 68 },
    key: "close",
    tap: () => {
      app.sfx.tap();
      onTap();
    },
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

/** A UI icon from img/icon-*.webp, or the code-drawn fallback while it is missing. */
export function icon(
  app: App,
  name: string,
  cx: number,
  cy: number,
  size: number,
  fallback: () => void,
) {
  // Icons live in img/icon-*.webp; a full sprite name works too
  const img =
    app.sprites.get(name.startsWith("icon-") ? name : `icon-${name}`) ??
    app.sprites.get(name);
  if (!img?.naturalWidth) return fallback();
  const k = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  app.ctx.drawImage(
    img,
    cx - (img.naturalWidth * k) / 2,
    cy - (img.naturalHeight * k) / 2,
    img.naturalWidth * k,
    img.naturalHeight * k,
  );
}
