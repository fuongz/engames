import type { Rect } from "@web-games/core";
import { type App, H, W, btn, icon, viewRect } from "./app";
import { C, panel, rr, text, wrap } from "./art";
import type { IngredientId } from "./config";
import { canOpen, pantryQty, slept, stockCount } from "./logic";
import type { Strings } from "./strings";

// The first day, hand in hand: Mây, the bakery's white kitten, walks a new baker through
// shopping, the first batch of cookies, bed, and the first customers. Each
// step names the button it points at (a Ui region key); the overlay darkens
// everything else and only that button takes taps. A step is over when the
// game reaches its goal, so a player who runs ahead simply skips steps.

type Mascot = "wave" | "point" | "happy";

interface Step {
  /** Shown on this screen. */
  on: (app: App) => boolean;
  /** Its words. */
  say: (tr: Strings) => string;
  mascot: Mascot;
  /** The region it points at; none for a plain dialog. */
  target?: (app: App) => string | undefined;
  /** Reached: move on. Checked on every screen, so steps can be skipped. */
  done?: (app: App) => boolean;
  /** A dialog with a button instead of a goal (and a skip, on the first). */
  button?: (tr: Strings) => string;
  /** Only a hint: no shade, nothing blocked. */
  hint?: boolean;
}

const COOKIE: IngredientId[] = ["flour", "sugar", "butter", "eggs"];
const stocked = (app: App) => COOKIE.every((i) => pantryQty(app.save, i) > 0);
const inCart = (app: App) => {
  const s = app.screen;
  return s.kind === "market" ? s.cart : {};
};

const STEPS: Step[] = [
  {
    on: (a) => a.screen.kind === "hub",
    say: (tr) => tr.tour.welcome,
    mascot: "wave",
    button: (tr) => tr.tour.start,
  },
  {
    on: (a) => a.screen.kind === "hub",
    say: (tr) => tr.tour.market,
    mascot: "point",
    target: () => "market",
    done: (a) => a.screen.kind === "market" || stocked(a),
  },
  {
    on: (a) => a.screen.kind === "market",
    say: (tr) => tr.tour.shopping,
    mascot: "point",
    hint: true,
    done: (a) => COOKIE.every((i) => (inCart(a)[i] ?? 0) > 0) || stocked(a),
  },
  {
    on: (a) => a.screen.kind === "market",
    say: (tr) => tr.tour.pay,
    mascot: "point",
    target: () => "pay",
    done: (a) => stocked(a),
  },
  {
    on: (a) => a.screen.kind === "hub",
    say: (tr) => tr.tour.bake,
    mascot: "point",
    target: () => "bake",
    done: (a) =>
      a.screen.kind === "pick" ||
      a.screen.kind === "bake" ||
      stockCount(a.save.stock) > 0,
  },
  {
    on: (a) => a.screen.kind === "pick",
    say: (tr) => tr.tour.pickCookie,
    mascot: "point",
    target: () => "make-cookie",
    done: (a) => a.screen.kind === "bake" || stockCount(a.save.stock) > 0,
  },
  {
    on: (a) => a.screen.kind === "bake",
    say: (tr) => tr.tour.kitchen,
    mascot: "wave",
    button: (tr) => tr.tour.next,
    done: (a) => stockCount(a.save.stock) > 0,
  },
  {
    on: (a) => a.screen.kind === "hub" && stockCount(a.save.stock) > 0,
    say: (tr) => tr.tour.display,
    mascot: "happy",
    target: () => "display",
    button: (tr) => tr.tour.next,
    done: (a) => slept(a.save),
  },
  {
    on: (a) => a.screen.kind === "hub" && !slept(a.save),
    say: (tr) => tr.tour.bed,
    mascot: "point",
    target: () => "bed",
    done: (a) => slept(a.save) || a.screen.kind === "shop",
  },
  {
    on: (a) => a.screen.kind === "hub" && canOpen(a.save),
    say: (tr) => tr.tour.open,
    mascot: "point",
    target: () => "open",
    done: (a) => a.screen.kind === "shop",
  },
  {
    on: (a) => a.screen.kind === "shop",
    say: (tr) => tr.tour.selling,
    mascot: "wave",
    button: (tr) => tr.tour.next,
  },
  {
    on: () => true,
    say: (tr) => tr.tour.done,
    mascot: "happy",
    button: (tr) => tr.tour.thanks,
  },
];

export const TOUR_STEPS = STEPS.length;

/** Draw the tour's current step over the screen (call after the screen). */
export function drawTour(app: App) {
  if (app.tour === null) return;
  // Skip every step whose goal is already reached
  let i = app.tour;
  while (i < STEPS.length && STEPS[i].done?.(app)) i++;
  if (i !== app.tour) app.setTour(i < STEPS.length ? i : null);
  if (app.tour === null) return;
  const step = STEPS[app.tour];
  if (!step.on(app)) return;
  const tr = app.tr();
  const key = step.target?.(app);
  const target = key ? app.ui.find(key) : undefined;
  if (key && !target) return;
  const next = () => app.setTour(app.tour === null ? null : app.tour + 1);

  if (!step.hint) {
    app.held = true;
    shadeAround(app, target);
  }
  if (target) pointAt(app, target);
  bubble(app, step, target, tr, next);
}

/** Darken everything but the target, and let taps through only there. */
function shadeAround(app: App, hole: Rect | undefined) {
  const { ctx } = app;
  const v = viewRect(app);
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  if (hole) {
    // The hole, added to the same path (rr() would start a new one)
    const pad = 8;
    roundedPath(
      ctx,
      hole.x - pad,
      hole.y - pad,
      hole.w + pad * 2,
      hole.h + pad * 2,
      18,
    );
  }
  ctx.fillStyle = "rgba(40, 24, 16, 0.55)";
  ctx.fill("evenodd");
  ctx.restore();
  // Block the four strips around the hole (or everything, for a dialog)
  if (!hole) {
    app.ui.block(v);
    return;
  }
  const pad = 8;
  const hx = hole.x - pad;
  const hy = hole.y - pad;
  const hw = hole.w + pad * 2;
  const hh = hole.h + pad * 2;
  app.ui.block({ x: v.x, y: v.y, w: v.w, h: hy - v.y });
  app.ui.block({ x: v.x, y: hy + hh, w: v.w, h: v.y + v.h - hy - hh });
  app.ui.block({ x: v.x, y: hy, w: hx - v.x, h: hh });
  app.ui.block({ x: hx + hw, y: hy, w: v.x + v.w - hx - hw, h: hh });
}

/** A rounded rectangle added to the current path. */
function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A pulsing ring round the target and a hand bobbing down onto it. */
function pointAt(app: App, r: Rect) {
  const { ctx } = app;
  const t = app.time;
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.save();
  rr(
    ctx,
    r.x - 6 - pulse * 4,
    r.y - 6 - pulse * 4,
    r.w + 12 + pulse * 8,
    r.h + 12 + pulse * 8,
    20,
  );
  ctx.lineWidth = 4;
  ctx.strokeStyle = `rgba(255, 228, 140, ${0.6 + 0.4 * pulse})`;
  ctx.stroke();
  ctx.restore();
  const bob = Math.abs(Math.sin(t * 4)) * 14;
  const hx = r.x + r.w / 2 + 10;
  const hy = r.y - 28 - bob;
  // Above the target, or below it when it sits near the top
  const below = r.y < 200;
  const y = below ? r.y + r.h + 30 + bob : hy;
  ctx.save();
  if (below) {
    ctx.translate(hx, y);
    ctx.scale(1, -1);
    ctx.translate(-hx, -y);
  }
  icon(app, "hand-point", hx, y, 60, () => {
    ctx.beginPath();
    ctx.moveTo(hx, y + 22);
    ctx.lineTo(hx - 14, y);
    ctx.lineTo(hx + 14, y);
    ctx.closePath();
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  });
  ctx.restore();
}

/** Mây and a speech bubble, away from the target; buttons for dialog steps. */
function bubble(
  app: App,
  step: Step,
  target: Rect | undefined,
  tr: Strings,
  next: () => void,
) {
  const { ctx } = app;
  const v = viewRect(app);
  const lines = wrap(ctx, step.say(tr), W - 190, 18);
  const withButtons = !!step.button;
  const h = Math.max(120, 36 + lines.length * 26 + (withButtons ? 74 : 0));
  // Put it where the target is not; a hint sits low, over the busy screen's
  // least important part
  const top = !step.hint && (!target || target.y + target.h / 2 > H / 2);
  const y = top
    ? Math.max(v.y + 120, 150)
    : step.hint
      ? H - h - 186
      : H - h - 40;
  const box = { x: 118, y, w: W - 136, h };
  panel(ctx, box, { fill: C.cream, radius: 24, line: 3, lip: 4 });
  // The tail towards Mây
  ctx.beginPath();
  ctx.moveTo(box.x + 2, box.y + 40);
  ctx.lineTo(box.x - 16, box.y + 52);
  ctx.lineTo(box.x + 2, box.y + 64);
  ctx.closePath();
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  const bob = Math.sin(app.time * 2.4) * 4;
  icon(app, `mascot-${step.mascot}`, 64, box.y + 52 + bob, 108, () => {
    ctx.beginPath();
    ctx.arc(64, box.y + 52 + bob, 40, 0, Math.PI * 2);
    ctx.fillStyle = C.white;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  });
  lines.forEach((l, i) => {
    text(ctx, l, box.x + 20, box.y + 30 + i * 26, { size: 18, align: "left" });
  });
  app.ui.block(box);
  if (!step.button) return;
  const first = app.tour === 0;
  const by = box.y + box.h - 66;
  if (first)
    btn(
      app,
      "tour-skip",
      { x: box.x + 16, y: by, w: 120, h: 54 },
      tr.tour.skip,
      () => app.setTour(null),
      { size: 18 },
    );
  btn(
    app,
    "tour-next",
    first
      ? { x: box.x + 146, y: by, w: box.w - 162, h: 54 }
      : { x: box.x + box.w - 176, y: by, w: 160, h: 54 },
    step.button(tr),
    () => {
      app.sfx.tap();
      next();
    },
    { fill: C.green, size: 19 },
  );
}
