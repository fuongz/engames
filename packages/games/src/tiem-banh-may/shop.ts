import type { Rect } from "@web-games/core";
import { type App, H, W, btn, shade, sheet, viewRect } from "./app";
import { hud } from "./hud";
import {
  C,
  bar,
  bubble,
  coin,
  cover,
  framed,
  heart,
  panel,
  sprite,
  stars,
  text,
  FONT,
  nine,
} from "./art";
import {
  BOX_FROM,
  BOX_SIZES,
  CHANGE_COINS,
  CHANGE_MAKING,
  CLOSE_AT,
  DISCOUNT_FROM,
  OPEN,
  OPEN_AT,
  PATIENCE,
  PREORDER_PATIENCE,
  QUEUE_MAX,
  REP,
  RECIPES,
  type RecipeId,
  SELL_SECONDS,
  VIP_PATIENCE,
} from "./config";
import { pick, shopBackdrop } from "./bakeart";
import {
  type Ledger,
  type Line,
  type Piece,
  type SaveData,
  type StockItem,
  type Visitor,
  arrive,
  boxFit,
  closeDay,
  customer,
  dayInfo,
  emptyLedger,
  formatClock,
  goToBed,
  orderTotal,
  patienceFactor,
  payment,
  planDay,
  recipe,
  reserve,
  settle,
  shake,
  slept,
  piecePrice,
} from "./logic";
import { seatPatience } from "./furniture";
import { dialogButtons, priceSticker } from "./kit";

// Opening hours, in real time: customers walk in, queue, say what they want;
// the player picks it from the display, boxes big orders and counts the change.
// No baking now: what was made last night is all there is.

type Mood = "happy" | "ok" | "angry" | "sad";

interface Walker {
  v: Visitor;
  x: number;
  y: number;
  s: number;
  patience: number;
  max: number;
  /** What they ask for, settled when they reach the counter. */
  lines: Line[] | null;
  leaving: boolean;
  mood?: Mood;
}

type Checkout =
  | { kind: "box"; walker: Walker }
  | {
      kind: "change";
      walker: Walker;
      box: number | null;
      total: number;
      paid: number;
      given: number;
    };

export interface ShopState {
  clock: number;
  stock: StockItem[];
  held: Record<number, Piece[]>;
  plan: Visitor[];
  next: number;
  walkers: Walker[];
  tray: Piece[];
  discount: boolean;
  ledger: Ledger;
  checkout: Checkout | null;
  /** Seconds since the doors closed, or null while open. */
  closing: number | null;
  /** The save as it was at opening: the day is settled against it. */
  opened: SaveData;
  /** Seconds before tired hands can pick the next piece. */
  busy: number;
}

const DOOR = { x: 96, y: 440, s: 0.55 };
const SLOTS = [
  { x: 262, y: 604, s: 1 },
  { x: 120, y: 538, s: 0.8 },
  { x: 410, y: 528, s: 0.76 },
  { x: 250, y: 488, s: 0.68 },
];
const COUNTER_Y = 566;
/** The light turns golden between these minutes of the day. */
const DUSK_FROM = 14 * 60 + 30;
const DUSK_TO = 16 * 60;
const MIN_PER_SECOND = (CLOSE_AT - OPEN_AT) / SELL_SECONDS;
const WALK_SPEED = 420;

/** 9:00: save the morning (a reload replays the day from here) and open the doors. Still up? Sleep first. */
export function openShop(app: App) {
  let save = app.save;
  if (!slept(save)) {
    const { save: rested, hours } = goToBed(save);
    save = rested;
    app.toast(app.tr().slept(Math.round(hours * 60)), W / 2, 330, C.text, 22);
  }
  const opened: SaveData = { ...save, phase: "open" };
  app.commit(opened, { now: true });
  app.go({ kind: "shop", shop: newDay(opened) });
}

export function newDay(opened: SaveData): ShopState {
  const { stock, held } = reserve(opened.stock, opened.preorders);
  // Opened late (up to 9:30): customers who came earlier found the door shut
  const clock = Math.max(OPEN_AT, OPEN_AT + opened.night - OPEN);
  const plan = planDay(opened);
  const next = plan.findIndex((v) => v.at >= clock);
  return {
    clock,
    stock,
    held: Object.fromEntries(held),
    plan,
    next: next < 0 ? plan.length : next,
    walkers: [],
    tray: [],
    discount: false,
    ledger: emptyLedger(),
    checkout: null,
    closing: null,
    opened,
    busy: 0,
  };
}

const queue = (s: ShopState) => s.walkers.filter((w) => !w.leaving);
const front = (s: ShopState) => queue(s)[0];
const heldCount = (s: ShopState) =>
  Object.values(s.held).reduce((n, p) => n + p.length, 0);
const stockLeft = (s: ShopState) => s.stock.reduce((n, x) => n + x.count, 0);

function putBack(s: ShopState, p: Piece) {
  const at = s.stock.find((x) => x.recipe === p.recipe && x.stars === p.stars);
  if (at) at.count++;
  else
    s.stock.push({ recipe: p.recipe, stars: p.stars, count: 1, cost: p.cost });
}

function emptyTray(s: ShopState, w: Walker | undefined) {
  if (w?.v.kind === "preorder" && w.v.preorder !== undefined) {
    // Pre-ordered pieces go back on hold, not on sale
    s.held[w.v.preorder] = [...(s.held[w.v.preorder] ?? []), ...s.tray];
  } else for (const p of s.tray) putBack(s, p);
  s.tray = [];
}

function leave(s: ShopState, w: Walker, mood: Mood) {
  if (w === front(s)) {
    emptyTray(s, w);
    if (s.checkout?.walker === w) s.checkout = null;
  }
  w.leaving = true;
  w.mood = mood;
}

export function updateShop(app: App, s: ShopState, dt: number) {
  const tr = app.tr();
  if (s.closing !== null) {
    s.closing += dt;
    moveWalkers(s, dt);
    if (s.closing > 1.6 && !app.screen.kind.startsWith("report"))
      finishDay(app, s);
    return;
  }
  s.clock += dt * MIN_PER_SECOND;
  s.busy = Math.max(0, s.busy - dt);
  // Arrivals
  while (s.next < s.plan.length && s.plan[s.next].at <= s.clock) {
    const v = s.plan[s.next++];
    if (v.rush && !s.discount) continue;
    if (queue(s).length >= QUEUE_MAX) {
      s.ledger.walked++;
      s.ledger.rep += REP.queueFull;
      if (v.kind === "vip") s.ledger.vip = "missed";
      if (v.kind === "preorder") s.ledger.preorders.missed++;
      app.toast(tr.queueFull, DOOR.x + 60, DOOR.y - 160, C.bad, 18);
      continue;
    }
    // A cheerful baker and somewhere to sit both make the wait easier
    const max =
      patienceFactor(s.opened.mood) *
      seatPatience(s.opened.decor) *
      (v.kind === "vip"
        ? VIP_PATIENCE
        : v.kind === "preorder"
          ? PREORDER_PATIENCE
          : PATIENCE);
    s.walkers.push({
      v,
      x: DOOR.x,
      y: DOOR.y,
      s: DOOR.s,
      patience: max,
      max,
      lines: null,
      leaving: false,
    });
    app.sfx.bell();
  }
  moveWalkers(s, dt);

  const f = front(s);
  if (f && !f.lines && Math.hypot(f.x - SLOTS[0].x, f.y - SLOTS[0].y) < 6)
    atCounter(app, s, f);
  for (const w of queue(s)) {
    // The one being served doesn't lose patience while paying
    if (s.checkout?.walker === w) continue;
    w.patience -= dt;
    if (w.patience <= 0) {
      s.ledger.walked++;
      s.ledger.rep += REP.walkedOff;
      if (w.v.kind === "vip") {
        s.ledger.vip = "missed";
        s.ledger.rep += REP.vipSad;
      }
      if (w.v.kind === "preorder") {
        s.ledger.preorders.missed++;
        s.ledger.rep += REP.preorderMissed;
      }
      app.toast(tr.walked, w.x, w.y - 240 * w.s, C.bad, 20);
      leave(s, w, "angry");
    }
  }
  if (s.clock >= CLOSE_AT) close(app, s);
}

/** At the counter: what they ask for, given what is left. */
function atCounter(app: App, s: ShopState, w: Walker) {
  const tr = app.tr();
  const v = w.v;
  if (v.kind === "preorder") {
    const ready =
      v.preorder !== undefined && (s.held[v.preorder]?.length ?? 0) > 0;
    if (ready) {
      w.lines = v.lines;
      return;
    }
    s.ledger.preorders.missed++;
    s.ledger.rep += REP.preorderMissed;
    app.sfx.bad();
    app.toast(tr.preorderMissing, w.x, w.y - 250, C.bad, 20);
    leave(s, w, "sad");
    return;
  }
  const { lines, lost } = arrive(s.stock, v);
  for (const l of lost)
    s.ledger.soldOut[l.recipe] = (s.ledger.soldOut[l.recipe] ?? 0) + l.qty;
  if (!lines.length) {
    s.ledger.walked++;
    s.ledger.rep += REP.soldOut;
    if (v.kind === "vip") {
      s.ledger.vip = "missed";
      s.ledger.rep += REP.vipSad;
    }
    app.toast(tr.soldOut, w.x, w.y - 250, C.bad, 20);
    leave(s, w, "sad");
    return;
  }
  w.lines = lines;
}

function moveWalkers(s: ShopState, dt: number) {
  const q = queue(s);
  for (const w of s.walkers) {
    const target = w.leaving
      ? DOOR
      : SLOTS[Math.min(q.indexOf(w), SLOTS.length - 1)];
    const dx = target.x - w.x;
    const dy = target.y - w.y;
    const d = Math.hypot(dx, dy);
    const step = WALK_SPEED * dt;
    if (d <= step) {
      w.x = target.x;
      w.y = target.y;
    } else {
      w.x += (dx / d) * step;
      w.y += (dy / d) * step;
    }
    w.s += (target.s - w.s) * Math.min(1, dt * 6);
  }
  s.walkers = s.walkers.filter(
    (w) => !(w.leaving && Math.hypot(w.x - DOOR.x, w.y - DOOR.y) < 4),
  );
}

function close(app: App, s: ShopState) {
  if (s.closing !== null) return;
  s.closing = 0;
  emptyTray(s, front(s));
  s.checkout = null;
  for (const w of queue(s)) leave(s, w, "ok");
  app.sfx.bell();
}

function finishDay(app: App, s: ShopState) {
  // Whatever is still on hold was never collected: it is binned with the rest
  const leftover = [...s.stock.map((x) => ({ ...x }))];
  for (const pieces of Object.values(s.held)) {
    for (const p of pieces) {
      const at = leftover.find(
        (x) => x.recipe === p.recipe && x.stars === p.stars,
      );
      if (at) at.count++;
      else
        leftover.push({
          recipe: p.recipe,
          stars: p.stars,
          count: 1,
          cost: p.cost,
        });
    }
  }
  const { report, next } = closeDay(
    s.opened,
    s.ledger,
    leftover.filter((x) => x.count > 0),
  );
  app.commit(next, { now: true, score: true });
  app.go({ kind: "report", report });
}

/** Does the tray hold exactly what the front customer asked for? */
function trayMatches(s: ShopState, lines: Line[]) {
  const counts = new Map<RecipeId, number>();
  for (const p of s.tray) counts.set(p.recipe, (counts.get(p.recipe) ?? 0) + 1);
  return (
    lines.every((l) => counts.get(l.recipe) === l.qty) &&
    s.tray.length === lines.reduce((n, l) => n + l.qty, 0)
  );
}

function handOver(app: App, s: ShopState, w: Walker) {
  if (s.tray.length >= BOX_FROM) s.checkout = { kind: "box", walker: w };
  else pay(app, s, w, null);
}

function pay(app: App, s: ShopState, w: Walker, box: number | null) {
  const preorder = w.v.kind === "preorder";
  const total = orderTotal(s.tray, s.discount, preorder);
  const paid = payment(total, w.v);
  if (paid === total) {
    app.toast(app.tr().exactPaid, W / 2, 470, C.text, 18);
    return finish(app, s, w, box, total, paid, 0);
  }
  // With hand-counted change switched off (CHANGE_MAKING), the till gives it exactly
  if (!CHANGE_MAKING) return finish(app, s, w, box, total, paid, paid - total);
  s.checkout = { kind: "change", walker: w, box, total, paid, given: 0 };
}

function finish(
  app: App,
  s: ShopState,
  w: Walker,
  box: number | null,
  total: number,
  paid: number,
  given: number,
) {
  const tr = app.tr();
  const out = settle(w.v, s.tray, paid, total, given, box, s.opened.mood);
  const L = s.ledger;
  L.revenue += out.coins;
  L.tips += out.tip;
  L.boxes += out.boxCost;
  L.overChange += out.over;
  L.served++;
  L.rep += out.rep;
  if (out.vip) L.vip = out.vip;
  if (w.v.kind === "preorder" && !out.short) L.preorders.done++;
  if (w.v.kind === "preorder" && w.v.preorder !== undefined)
    delete s.held[w.v.preorder];
  s.tray = [];
  s.checkout = null;
  app.sfx.coin();
  const y = w.y - 250;
  app.toast(`+${tr.num(out.coins - out.boxCost)}`, w.x, y, C.good, 26);
  if (out.tip) app.toast(tr.tip(out.tip), w.x + 70, y + 30, C.warn, 20);
  const line =
    out.vip === "happy"
      ? tr.vipHappy
      : out.vip === "sad"
        ? tr.vipSad
        : out.short
          ? tr.shortChange
          : out.over
            ? tr.overChange(out.over)
            : tr.thanks;
  app.toast(line, w.x, y - 34, out.mood === "angry" ? C.bad : C.text, 19);
  leave(s, w, out.mood === "angry" ? "angry" : "happy");
}

// ---------------------------------------------------------------- drawing

interface Slot {
  recipe: RecipeId;
  stars: 1 | 2 | 3;
  count: number;
}

export function drawShop(app: App, s: ShopState) {
  const { ctx } = app;
  const tr = app.tr();
  const v = viewRect(app);
  // The day's weather outside, the light going golden towards closing time
  const weather = dayInfo(s.opened).weather;
  const dusk = Math.min(
    1,
    Math.max(0, (s.clock - DUSK_FROM) / (DUSK_TO - DUSK_FROM)),
  );
  cover(
    ctx,
    pick(app.sprites, shopBackdrop(weather, false), "bg-shop"),
    v,
    0.3,
  );
  if (dusk > 0) {
    ctx.save();
    ctx.globalAlpha = dusk;
    cover(
      ctx,
      pick(app.sprites, shopBackdrop(weather, true), "bg-shop"),
      v,
      0.3,
    );
    ctx.restore();
  }
  if (weather === "rainy") drawRain(app, v);
  // The till counts up as the day goes
  const L = s.ledger;
  hud(app, formatClock(Math.min(s.clock, CLOSE_AT)), {
    coins: s.opened.coins + L.revenue + L.tips - L.boxes,
    pause: true,
  });

  // Day progress under the clock, then the shop's two switches
  const top = app.rt.stage.view.y + 14;
  bar(
    ctx,
    { x: W - 150, y: top + 104, w: 136, h: 14 },
    (s.clock - OPEN_AT) / (CLOSE_AT - OPEN_AT),
    "#ffc46b",
  );
  const f = front(s);
  if (s.closing === null) {
    if (s.clock >= DISCOUNT_FROM) {
      btn(
        app,
        "discount",
        { x: W - 176, y: top + 126, w: 162, h: 54 },
        s.discount ? tr.discountOn : tr.discount,
        () => (s.discount = true),
        {
          fill: s.discount ? "#ffd6a8" : C.cream,
          size: 18,
          disabled: s.discount,
        },
      );
    }
    if (stockLeft(s) === 0 && heldCount(s) === 0 && !s.tray.length) {
      btn(
        app,
        "close-early",
        { x: W / 2 - 110, y: top + 126, w: 220, h: 56 },
        tr.closeEarly,
        () => close(app, s),
        { fill: C.green, size: 19 },
      );
    }
  }

  // Customers, back to front, then the counter in front of their legs
  const order = [...s.walkers].sort((a, b) => a.y - b.y);
  for (const w of order) drawWalker(app, s, w);
  drawCounter(app, s);
  if (f?.lines && !f.leaving && s.closing === null) drawOrder(app, s, f);
  drawTray(app, s, f);

  if (s.checkout?.kind === "box") drawBoxes(app, s, s.checkout.walker);
  else if (s.checkout?.kind === "change") drawChange(app, s, s.checkout);
  if (s.closing !== null) {
    const k = Math.min(1, s.closing / 0.4);
    ctx.save();
    ctx.globalAlpha = k;
    text(ctx, tr.closed, W / 2, 380, {
      size: 64,
      fill: C.white,
      outline: C.ink,
    });
    ctx.restore();
  }
}

function drawWalker(app: App, s: ShopState, w: Walker) {
  const { ctx } = app;
  const def = customer(w.v.customer);
  const moving =
    !(w.x === SLOTS[0].x && w.y === SLOTS[0].y) && !w.leaving
      ? Math.abs(Math.sin(app.time * 12)) * 6
      : 0;
  const h = 250 * w.s;
  ctx.save();
  if (w.leaving)
    ctx.globalAlpha = Math.min(1, Math.hypot(w.x - DOOR.x, w.y - DOOR.y) / 60);
  // Facing the way they walk
  const flip = w.leaving && w.x > DOOR.x;
  ctx.translate(w.x, w.y - moving);
  if (flip) ctx.scale(-1, 1);
  sprite(ctx, app.sprites.get(def.sprite), 0, 0, h, h, "bottom");
  ctx.restore();
  if (w.leaving && w.mood === "happy") heart(ctx, w.x + 40 * w.s, w.y - h, 12);
  else if (w.leaving && (w.mood === "angry" || w.mood === "sad")) {
    text(ctx, w.mood === "angry" ? "!" : "…", w.x + 40 * w.s, w.y - h - 6, {
      size: 30,
      fill: w.mood === "angry" ? C.bad : C.muted,
      outline: C.white,
    });
  }
  if (!w.leaving && w !== front(s)) {
    // Queued: a small patience bar over their head
    const k = w.patience / w.max;
    bar(
      ctx,
      { x: w.x - 30, y: w.y - h - 18, w: 60, h: 10 },
      k,
      k < 0.3 ? C.bad : k < 0.6 ? C.warn : C.good,
    );
  }
}

function drawCounter(app: App, s: ShopState) {
  const { ctx } = app;
  const tr = app.tr();
  const v = app.rt.stage.view;
  // Counter top, then the glass case on its pink front
  panel(
    ctx,
    { x: v.x - 10, y: COUNTER_Y, w: v.w + 20, h: 34 },
    { fill: "#f4d3a1", stroke: C.ink, radius: 10, line: 4 },
  );
  ctx.fillStyle = "#e7b08a";
  ctx.fillRect(v.x, COUNTER_Y + 34, v.w, H - COUNTER_Y - 34 + 200);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(v.x, COUNTER_Y + 34);
  ctx.lineTo(v.x + v.w, COUNTER_Y + 34);
  ctx.stroke();
  // The glass case: a honey-wood frame round icy glass, with its name on top
  const glass = { x: 14, y: COUNTER_Y + 46, w: W - 28, h: 262 };
  panel(
    ctx,
    { x: glass.x - 6, y: glass.y - 6, w: glass.w + 12, h: glass.h + 12 },
    { fill: "#e2b47e", stroke: C.ink, radius: 22, line: 3.5 },
  );
  if (!nine(ctx, app.sprites.get("fridge-back"), glass, 60, 18))
    panel(ctx, glass, {
      fill: "rgba(232, 247, 255, 0.92)",
      stroke: C.ink,
      radius: 18,
      line: 4,
    });
  sectionLabel(app, glass.x + 12, glass.y - 18, tr.displayTitle);
  const slots = displaySlots(s);
  const cols = 4;
  const rows = 3;
  const cw = (glass.w - 16) / cols;
  const ch = (glass.h - 16) / rows;
  const f = front(s);
  const serving = f?.lines && !f.leaving && s.closing === null && !s.checkout;
  // Glass shelves between the rows
  const plank = app.sprites.get("shelf-fridge");
  for (let r = 1; r < rows; r++) {
    const sy = glass.y + 8 + r * ch - 8;
    if (plank?.naturalWidth)
      ctx.drawImage(plank, glass.x + 4, sy, glass.w - 8, 16);
    else {
      ctx.fillStyle = "rgba(201, 225, 240, 0.9)";
      ctx.fillRect(glass.x + 6, sy + 6, glass.w - 12, 4);
    }
  }

  slots.slice(0, cols * rows).forEach((slot, i) => {
    const rect = {
      x: glass.x + 8 + (i % cols) * cw,
      y: glass.y + 8 + Math.floor(i / cols) * ch,
      w: cw,
      h: ch,
    };
    const key = `slot-${i}`;
    const pressed = app.ui.isPressed(key);
    const wanted = serving && f?.lines?.some((l) => l.recipe === slot.recipe);
    if (wanted) {
      panel(
        ctx,
        { x: rect.x + 3, y: rect.y + 3, w: rect.w - 6, h: rect.h - 6 },
        { fill: "rgba(255, 236, 160, 0.65)", radius: 14, line: 0 },
      );
    }
    sprite(
      ctx,
      app.sprites.get(recipe(slot.recipe).sprite),
      rect.x + rect.w / 2,
      rect.y + rect.h / 2 - 6 + (pressed ? 3 : 0),
      rect.w - 30,
      rect.h - 30,
    );
    stars(ctx, rect.x + rect.w / 2, rect.y + rect.h - 13, slot.stars, 8);
    // What one piece sells for
    const price = Math.max(
      1,
      Math.round(piecePrice({ ...slot, cost: 0 }, !!s.discount, false)),
    );
    priceSticker(app, rect.x + 18, rect.y + 18, price, 14);
    text(ctx, `×${slot.count}`, rect.x + rect.w - 22, rect.y + 16, {
      size: 17,
      fill: C.text,
      outline: C.white,
    });
    app.ui.add({ rect, key, tap: () => takePiece(app, s, slot) });
  });
  // Pre-ordered cakes on hold
  const held = Object.entries(s.held).filter(([, p]) => p.length);
  held.forEach(([id, pieces], i) => {
    const idx = Math.min(slots.length, cols * rows - held.length) + i;
    const rect = {
      x: glass.x + 8 + (idx % cols) * cw,
      y: glass.y + 8 + Math.floor(idx / cols) * ch,
      w: cw,
      h: ch,
    };
    panel(
      ctx,
      { x: rect.x + 3, y: rect.y + 3, w: rect.w - 6, h: rect.h - 6 },
      { fill: "#fff1c7", stroke: C.warn, radius: 14, line: 3 },
    );
    sprite(
      ctx,
      app.sprites.get("cake-box"),
      rect.x + rect.w / 2,
      rect.y + rect.h / 2 - 4,
      rect.w - 40,
      rect.h - 34,
    );
    text(ctx, tr.preorderTag, rect.x + rect.w / 2, rect.y + rect.h - 12, {
      size: 12,
      maxWidth: rect.w - 8,
    });
    text(ctx, `×${pieces.length}`, rect.x + rect.w - 22, rect.y + 16, {
      size: 17,
      outline: C.white,
    });
    app.ui.add({
      rect,
      tap: () => {
        if (
          f?.v.kind !== "preorder" ||
          String(f.v.preorder) !== id ||
          !f.lines ||
          s.checkout
        )
          return app.sfx.bad();
        app.sfx.tap();
        s.tray.push(...pieces);
        s.held[Number(id)] = [];
      },
    });
  });
  if (!slots.length && !held.length)
    text(ctx, tr.emptyDisplay, W / 2, glass.y + glass.h / 2, {
      size: 20,
      weight: 700,
      fill: C.muted,
    });
}

/** A little name tag sitting on the top edge of a panel. */
function sectionLabel(app: App, x: number, y: number, label: string) {
  const { ctx } = app;
  ctx.font = `700 14px ${FONT}`;
  const w = ctx.measureText(label).width + 24;
  panel(ctx, { x, y, w, h: 26 }, { fill: C.cream, radius: 13, line: 2.5 });
  text(ctx, label, x + w / 2, y + 13, { size: 14 });
}

function displaySlots(s: ShopState): Slot[] {
  const order = RECIPES.map((r) => r.id);
  return s.stock
    .filter((x) => x.count > 0)
    .map((x) => ({ recipe: x.recipe, stars: x.stars, count: x.count }))
    .sort(
      (a, b) =>
        order.indexOf(a.recipe) - order.indexOf(b.recipe) || b.stars - a.stars,
    );
}

function takePiece(app: App, s: ShopState, slot: Slot) {
  const tr = app.tr();
  const f = front(s);
  if (!f?.lines || f.leaving || s.checkout || s.closing !== null) return;
  // Tired hands: a beat between pieces
  if (s.busy > 0) return;
  const want = f.lines.find((l) => l.recipe === slot.recipe)?.qty ?? 0;
  const have = s.tray.filter((p) => p.recipe === slot.recipe).length;
  if (have >= want || f.v.kind === "preorder") {
    app.sfx.bad();
    app.toast(tr.notOrdered, W / 2, COUNTER_Y - 20, C.bad, 18);
    return;
  }
  const at = s.stock.find(
    (x) => x.recipe === slot.recipe && x.stars === slot.stars && x.count > 0,
  );
  if (!at) return;
  at.count--;
  s.tray.push({ recipe: at.recipe, stars: at.stars, cost: at.cost });
  s.stock = s.stock.filter((x) => x.count > 0);
  s.busy = shake(s.opened.energy) * 0.4;
  app.sfx.tap();
}

function drawOrder(app: App, s: ShopState, w: Walker) {
  const { ctx } = app;
  const tr = app.tr();
  const lines = w.lines ?? [];
  const special =
    w.v.kind === "vip"
      ? tr.vipWants
      : w.v.kind === "preorder"
        ? tr.preorderTag
        : null;
  const r: Rect = {
    x: 318,
    y: 262,
    w: 206,
    h: 30 + lines.length * 64 + (special ? 26 : 0),
  };
  bubble(ctx, r, 340);
  lines.forEach((l, i) => {
    const y = r.y + 46 + i * 64;
    sprite(ctx, app.sprites.get(recipe(l.recipe).sprite), r.x + 50, y, 62, 54);
    const got = s.tray.filter((p) => p.recipe === l.recipe).length;
    text(ctx, `${got}/${l.qty}`, r.x + 140, y, {
      size: 26,
      fill: got === l.qty ? C.good : C.text,
    });
  });
  if (special)
    text(ctx, special, r.x + r.w / 2, r.y + r.h - 20, {
      size: 15,
      fill: w.v.kind === "vip" ? C.warn : C.text,
      maxWidth: r.w - 16,
    });
  const k = w.patience / w.max;
  bar(
    ctx,
    { x: r.x + 14, y: r.y - 22, w: r.w - 28, h: 14 },
    k,
    k < 0.3 ? C.bad : k < 0.6 ? C.warn : C.good,
  );
}

function drawTray(app: App, s: ShopState, f: Walker | undefined) {
  const { ctx } = app;
  const tr = app.tr();
  const ty = H - 108;
  const tray = { x: 14, y: ty, w: 300, h: 92 };
  panel(ctx, tray, { fill: "#f4d3a1", stroke: C.ink, radius: 20, line: 4 });
  // Cakes line up to the right of the tray's name tag
  const start = 74;
  sectionLabel(app, tray.x + 10, tray.y + tray.h / 2 - 13, tr.trayLabel);
  if (!s.tray.length)
    text(ctx, tr.trayHint, tray.x + (start + tray.w) / 2, tray.y + tray.h / 2, {
      size: 13,
      fill: C.muted,
      maxWidth: tray.w - start - 14,
    });
  const size = Math.min(52, (tray.w - start - 10) / Math.max(4, s.tray.length));
  s.tray.forEach((p, i) => {
    const rect = {
      x: tray.x + start + i * size,
      y: tray.y + 12,
      w: size,
      h: tray.h - 24,
    };
    sprite(
      ctx,
      app.sprites.get(recipe(p.recipe).sprite),
      rect.x + size / 2,
      rect.y + rect.h / 2,
      size - 4,
      size - 4,
    );
    app.ui.add({
      rect,
      tap: () => {
        if (s.checkout || f?.v.kind === "preorder") return;
        app.sfx.tap();
        s.tray.splice(i, 1);
        putBack(s, p);
      },
    });
  });
  const ready =
    !!f?.lines &&
    !f.leaving &&
    !s.checkout &&
    s.closing === null &&
    trayMatches(s, f.lines);
  btn(
    app,
    "give",
    { x: W - 206, y: ty, w: 192, h: 92 },
    tr.give,
    () => f && handOver(app, s, f),
    {
      fill: ready ? C.green : C.cream,
      size: 24,
      disabled: !ready,
    },
  );
}

function drawBoxes(app: App, s: ShopState, w: Walker) {
  const { ctx } = app;
  const tr = app.tr();
  shade(app);
  const m = { x: 24, y: 300, w: W - 48, h: 360 };
  sheet(app, m, tr.pickBox);
  const n = s.tray.length;
  const bw = (m.w - 40 - 3 * 10) / 4;
  BOX_SIZES.forEach((size, i) => {
    const r = { x: m.x + 20 + i * (bw + 10), y: m.y + 80, w: bw, h: 180 };
    const key = `box-${size}`;
    const pressed = app.ui.isPressed(key);
    panel(
      ctx,
      { ...r, y: r.y + (pressed ? 3 : 0) },
      { fill: C.card, stroke: C.cardBorder, radius: 18, line: 4 },
    );
    const k = 0.55 + (i / (BOX_SIZES.length - 1)) * 0.45;
    sprite(
      ctx,
      app.sprites.get("cake-box"),
      r.x + r.w / 2,
      r.y + 80 + (pressed ? 3 : 0),
      (r.w - 16) * k,
      100 * k,
    );
    text(ctx, tr.box(size), r.x + r.w / 2, r.y + r.h - 26, {
      size: 18,
      maxWidth: r.w - 10,
    });
    app.ui.add({
      rect: r,
      key,
      tap: () => {
        if (boxFit(n, size) === "small") {
          app.sfx.bad();
          app.toast(tr.boxSmall, r.x + r.w / 2, r.y - 10, C.bad, 20);
          return;
        }
        app.sfx.tap();
        s.checkout = null;
        pay(app, s, w, size);
      },
    });
  });
  text(ctx, tr.pieces(n), m.x + m.w / 2 - 20, m.y + m.h - 54, {
    size: 22,
    fill: C.white,
    outline: C.ink,
  });
  sprite(
    ctx,
    app.sprites.get(recipe(s.tray[0]?.recipe ?? "cookie").sprite),
    m.x + m.w / 2 + 50,
    m.y + m.h - 54,
    34,
    30,
  );
}

function drawChange(
  app: App,
  s: ShopState,
  c: Extract<Checkout, { kind: "change" }>,
) {
  const { ctx } = app;
  const tr = app.tr();
  shade(app);
  const m = { x: 20, y: 250, w: W - 40, h: 470 };
  sheet(app, m, tr.giveChange);
  const info = { x: m.x + 20, y: m.y + 74, w: m.w - 40, h: 110 };
  framed(ctx, info, C.card, 20);
  text(ctx, tr.totalPaid(c.total, c.paid), info.x + info.w / 2, info.y + 32, {
    size: 22,
    maxWidth: info.w - 20,
  });
  text(ctx, tr.counted(c.given), info.x + info.w / 2, info.y + 76, {
    size: 30,
    fill: C.good,
  });
  const coins = CHANGE_COINS.filter((v) => v < c.paid);
  const cw = (m.w - 40) / coins.length;
  coins.forEach((value, i) => {
    const cx = m.x + 20 + cw * i + cw / 2;
    const cy = m.y + 250;
    const key = `coin-${value}`;
    const r = Math.min(34, cw / 2 - 4);
    const pressed = app.ui.isPressed(key);
    coin(ctx, cx, cy + (pressed ? 3 : 0), r);
    text(ctx, `${value}`, cx, cy + r + 18, {
      size: 20,
      fill: C.white,
      outline: C.ink,
    });
    app.ui.add({
      rect: { x: cx - cw / 2, y: cy - r - 6, w: cw, h: r * 2 + 40 },
      key,
      tap: () => {
        app.sfx.coin();
        c.given += value;
      },
    });
  });
  dialogButtons(app, m, [
    {
      key: "recount",
      label: tr.recount,
      size: 20,
      onTap: () => {
        c.given = 0;
      },
    },
    {
      key: "give-change",
      label: tr.giveChange,
      fill: C.green,
      size: 22,
      weight: 1.3,
      onTap: () => finish(app, s, c.walker, c.box, c.total, c.paid, c.given),
    },
  ]);
}

/** Glass in the shop backdrop (fractions of the image): the window and the door. */
const GLASS = [
  { x: 0.4, y: 0.12, w: 0.36, h: 0.27 },
  { x: 0.08, y: 0.16, w: 0.21, h: 0.24 },
];

/** Rain falling past the window and the door, mapped onto the covered backdrop. */
function drawRain(app: App, v: Rect) {
  const img = app.sprites.get("bg-shop");
  if (!img?.naturalWidth) return;
  const { ctx } = app;
  const k = Math.max(v.w / img.naturalWidth, v.h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  const x0 = v.x + (v.w - dw) / 2;
  const y0 = v.y + (v.h - dh) * 0.3;
  ctx.save();
  ctx.strokeStyle = "rgba(225, 235, 255, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const g of GLASS) {
    const r = { x: x0 + g.x * dw, y: y0 + g.y * dh, w: g.w * dw, h: g.h * dh };
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    for (let i = 0; i < 26; i++) {
      const fx = (i * 0.618 * 997) % 1;
      const fall = (app.time * (0.9 + (i % 5) * 0.12) + i * 0.37) % 1;
      const x = r.x + fx * (r.w + 20) - 10 - fall * 10;
      const y = r.y - 20 + fall * (r.h + 40);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 16);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
