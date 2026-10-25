import { clamp } from "@web-games/core";

// Motion for an immediate-mode screen. Nothing persists between frames, so
// motion is keyed by what is drawn: a sheet titled "Giỏ hàng" that was not
// drawn last frame has just opened, and its age drives its entrance. Exits
// cannot be drawn that way (the closed sheet is gone from the frame), so the
// shell snapshots the canvas before a tap and fades the old frame out over the
// new one (see game.ts).

/** Seconds each motion takes. UI motion stays well under 300ms. */
export const DUR = {
  /** A dialog popping open (shade and paper). */
  sheetIn: 0.22,
  /** A dialog fading away. */
  sheetOut: 0.16,
  /** One screen giving way to another. */
  screen: 0.22,
  /** A tab or page turning inside a screen. */
  page: 0.15,
  /** A count that changed nudging its badge. */
  bump: 0.2,
  /** A switch's knob sliding across. */
  toggle: 0.16,
};

/** cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const x = (s: number) => ((ax * s + bx) * s + cx) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Newton's method for the curve parameter whose x is t
    let s = t;
    for (let i = 0; i < 8; i++) {
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s = clamp(s - (x(s) - t) / d, 0, 1);
    }
    return ((ay * s + by) * s + cy) * s;
  };
}

/** The strong ease-out every entrance and exit uses: fast start, soft landing. */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);

export class Motion {
  /** The player asked for less motion: keep fades, drop movement and scale. */
  readonly reduce: boolean;
  private now = 0;
  private born = new Map<string, number>();
  private seen = new Set<string>();
  private values = new Map<string, { value: number; at: number }>();
  private slides = new Map<string, { on: boolean; from: number; at: number }>();
  private shades = 0;
  /** ctx.save()s pushed by pop() this frame, undone by settle(). */
  private layers = 0;
  /** Titles of the sheets drawn this frame: part of what the screen shows. */
  sheets: string[] = [];

  constructor(reduce: boolean) {
    this.reduce = reduce;
  }

  /** Call at the start of each render with the shell's clock (seconds). */
  frame(now: number) {
    for (const key of this.born.keys())
      if (!this.seen.has(key)) this.born.delete(key);
    this.seen.clear();
    this.now = now;
    this.shades = 0;
    this.layers = 0;
    this.sheets = [];
  }

  /** Seconds `key` has been drawn without a break (0 on the frame it appears). */
  age(key: string) {
    this.seen.add(key);
    let born = this.born.get(key);
    if (born === undefined) {
      born = this.now;
      this.born.set(key, born);
    }
    return this.now - born;
  }

  /** Eased 0..1 entrance of `key` over `dur` seconds. */
  enter(key: string, dur: number) {
    return easeOut(this.age(key) / dur);
  }

  /** Eased 0..1 entrance of the next shade drawn this frame. */
  shade() {
    return this.enter(`shade:${this.shades++}`, DUR.sheetIn);
  }

  /**
   * A sheet titled `title` is being drawn over `r`: until it has settled, scale
   * and fade everything drawn after this (the sheet and its contents) in from
   * its centre. Modals are not anchored to a trigger, so they grow from the middle.
   */
  pop(
    ctx: CanvasRenderingContext2D,
    title: string,
    r: { x: number; y: number; w: number; h: number },
  ) {
    this.sheets.push(title);
    const k = this.enter(`sheet:${title}`, DUR.sheetIn);
    if (k >= 1) return;
    ctx.save();
    this.layers++;
    ctx.globalAlpha *= k;
    if (this.reduce) return;
    const s = 0.95 + 0.05 * k;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  }

  /** End every pop() of this frame so what follows draws untransformed. */
  settle(ctx: CanvasRenderingContext2D) {
    while (this.layers > 0) {
      ctx.restore();
      this.layers--;
    }
  }

  /**
   * A badge's scale: 1, nudged up for a moment whenever `value` changes
   * (never on the frame it is first shown).
   */
  bump(key: string, value: number, amount = 0.14) {
    const last = this.values.get(key);
    if (!last) this.values.set(key, { value, at: -Infinity });
    else if (last.value !== value)
      this.values.set(key, { value, at: this.now });
    if (this.reduce) return 1;
    const t = (this.now - (this.values.get(key)?.at ?? -Infinity)) / DUR.bump;
    return t >= 1 ? 1 : 1 + amount * (1 - easeOut(t));
  }

  /**
   * Where a two-state thing stands, 0 (off) to 1 (on), easing across when it
   * flips. Flipped again halfway, it turns back from where it is.
   */
  slide(key: string, on: boolean, dur = DUR.toggle) {
    const at = (x: { on: boolean; from: number; at: number }) => {
      const to = x.on ? 1 : 0;
      if (this.reduce) return to;
      return x.from + (to - x.from) * easeOut((this.now - x.at) / dur);
    };
    const s = this.slides.get(key);
    if (!s) {
      this.slides.set(key, { on, from: on ? 1 : 0, at: -Infinity });
      return on ? 1 : 0;
    }
    if (s.on !== on) this.slides.set(key, { on, from: at(s), at: this.now });
    return at(this.slides.get(key) ?? s);
  }
}
