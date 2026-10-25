import type { Rect } from "@web-games/core";
import { type App, W, btn, shade, sheet, viewRect } from "./app";
import { hud } from "./hud";
import {
  C,
  bar,
  bubble,
  coin,
  framed,
  heart,
  panel,
  sprite,
  stars,
  text,
  FONT,
} from "./art";
import {
  BOX_FROM,
  BOX_SIZES,
  CHANGE_COINS,
  CHANGE_MAKING,
  CLOSE_AT,
  DISCOUNT_FROM,
  DOOR_TILE,
  OPEN,
  type Placed,
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
  slept,
} from "./logic";
import {
  furniture,
  seatPatience,
  serviceTile,
  standFront,
  tillOf,
  walkPath,
} from "./furniture";
import {
  ROOM,
  drawLight,
  drawPiece,
  drawRoom,
  floorAt,
  glassRects,
  pieceDepth,
  drawShelf,
  feet,
  shelve,
  tileRect,
} from "./storefront";
import { dialogButtons } from "./kit";

// Opening hours, in real time: customers walk in, take what they want from the
// cake stands and queue at the checkout counter in the room, where Mây rings
// them up on a timer the player can hurry along by tapping the counter; big
// orders still get a box. No baking now: last night's batches are all there is.

type Mood = "happy" | "ok" | "angry" | "sad";

type Tile = { x: number; y: number };
type Point = { x: number; y: number };

interface Walker {
  v: Visitor;
  x: number;
  y: number;
  s: number;
  /** "browse": on the way to a stand; "queue": in line for the till. */
  phase: "browse" | "queue";
  /** The tile they are heading for, and the points of the way there. */
  tile: Tile;
  route: Point[];
  /** How far along the route (in points). */
  ri: number;
  /** Seconds left looking at the stand before taking their pick. */
  pause: number;
  /** What they took from the stands, carried to the till. */
  picked: Piece[];
  /** Facing right (1) or left (−1), the way they walk. */
  face: 1 | -1;
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
  /** The queue's tiles, the till first, back along the walkway to the door. */
  slots: Tile[];
  /** Customers in line for the till, first served first. */
  line: Walker[];
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
  /** How far the front customer's checkout has got (0–1). */
  ring: number;
}

/** The room fills the screen under the bar; the stock strip sits under it. */
/** Room top below the top of the screen, clear of the status bar. */
const ROOM_BELOW_TOP = 128;
let FLOOR = floorAt(ROOM_BELOW_TOP);
const stripY = () => FLOOR.top + ROOM.size + 22;

/** Fit the room under the status bar on this screen (taller phones show more). */
function fitRoom(app: App) {
  const top = Math.round(viewRect(app).y + ROOM_BELOW_TOP);
  if (top !== FLOOR.top) FLOOR = floorAt(top);
}
/** Seconds Mây takes to ring someone up; a tap on the counter takes off a third. */
const CHECKOUT_SECONDS = 3.2;
const TAP_RING = 0.34;
/** Customers' size in the room (their sprites are drawn 250 × this tall). */
const CUSTOMER_S = 0.46;
/** The light turns golden between these minutes of the day. */
const DUSK_FROM = 14 * 60 + 30;
const DUSK_TO = 16 * 60;
const MIN_PER_SECOND = (CLOSE_AT - OPEN_AT) / SELL_SECONDS;
/** Steps of the walkway a customer covers in a second. */
const WALK_SPEED = 3.2;
/** Seconds a customer spends choosing at a stand. */
const BROWSE_SECONDS = 1.1;

/** 9:00: save the morning (a reload replays the day from here) and open the doors. Still up? Sleep first. */
export function openShop(app: App) {
  let save = app.save;
  if (!slept(save)) {
    const { save: rested, hours } = goToBed(save);
    save = rested;
    app.toast(app.tr().slept(Math.round(hours * 60)), W / 2, 330, C.text, 22);
  }
  const opened: SaveData = { ...save, phase: "open" };
  fitRoom(app);
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
    slots: queueSlots(opened.decor.placed),
    line: [],
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
    ring: 0,
  };
}

const queue = (s: ShopState) => s.walkers.filter((w) => !w.leaving);
/** The one at the till: first in line, and arrived there. */
const front = (s: ShopState): Walker | undefined => {
  const w = s.line[0];
  return w && w.ri >= w.route.length - 1 && same(w.tile, s.slots[0])
    ? w
    : undefined;
};
const same = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
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
  // Whatever they picked but didn't pay for goes back on the stands
  for (const p of w.picked) putBack(s, p);
  w.picked = [];
  s.line = s.line.filter((x) => x !== w);
  w.leaving = true;
  w.mood = mood;
  goTo(s, w, DOOR_TILE);
}

/** Queue tiles: the walkway from the till back towards the door. */
function queueSlots(placed: SaveData["decor"]["placed"]): Tile[] {
  const pay = serviceTile(placed) ?? DOOR_TILE;
  const path = walkPath(placed) ?? [DOOR_TILE, pay];
  return path.length > 1 ? path.slice(1).reverse() : [pay];
}

const DOOR_STEP = () => {
  const d = feet(FLOOR, DOOR_TILE);
  return { x: d.x, y: FLOOR.y0 - 4 };
};

/** Set off for a tile over free tiles (straight there if no way is found). */
function goTo(s: ShopState, w: Walker, to: Tile) {
  const placed = s.opened.decor.placed;
  const from = w.tile;
  const tiles = walkPath(placed, from, to) ?? [from, to];
  const points = tiles.map((t) => feet(FLOOR, t));
  // Leaving: out through the door step
  if (same(to, DOOR_TILE)) points.push(DOOR_STEP());
  w.route = [{ x: w.x, y: w.y }, ...points.slice(1)];
  w.ri = 0;
  w.tile = to;
}

/** Which stand a customer heads for: one showing what they want, else any with cakes. */
function standFor(s: ShopState, v: Visitor): Tile | null {
  const placed = s.opened.decor.placed;
  const spots = shelve(placed, displaySlots(s));
  const wanted = v.lines.map((l) => l.recipe);
  const pick =
    spots.find((x) => wanted.includes(x.item.recipe)) ??
    spots.find((x) => x.item.count > 0);
  if (pick) return standFront(placed, pick.stand);
  // Cakes past the last shelf still sell: any stand will do
  const stand = placed.find((p) => furniture(p.id).kind === "stand");
  return stand && s.stock.length ? standFront(placed, stand) : null;
}

/** At a stand: take what they want (or something else), best pieces first. */
function takeFromStands(app: App, s: ShopState, w: Walker) {
  const tr = app.tr();
  const v = w.v;
  // The critic only takes 3★ pieces
  const offer =
    v.kind === "vip" ? s.stock.filter((x) => x.stars === 3) : s.stock;
  const { lines, lost } = arrive(offer, v);
  for (const l of lost)
    s.ledger.soldOut[l.recipe] = (s.ledger.soldOut[l.recipe] ?? 0) + l.qty;
  for (const l of lines) {
    for (let i = 0; i < l.qty; i++) {
      const at = s.stock
        .filter(
          (x) =>
            x.recipe === l.recipe &&
            x.count > 0 &&
            (v.kind !== "vip" || x.stars === 3),
        )
        .sort((a, b) => b.stars - a.stars)[0];
      if (!at) break;
      at.count--;
      w.picked.push({ recipe: at.recipe, stars: at.stars, cost: at.cost });
    }
  }
  s.stock = s.stock.filter((x) => x.count > 0);
  if (!w.picked.length) {
    s.ledger.walked++;
    s.ledger.rep += REP.soldOut;
    if (v.kind === "vip") {
      s.ledger.vip = "missed";
      s.ledger.rep += REP.vipSad;
    }
    app.toast(tr.soldOut, w.x, w.y - 270 * w.s, C.bad, 20);
    leave(s, w, "sad");
    return;
  }
  app.sfx.tap();
  joinLine(s, w);
}

function joinLine(s: ShopState, w: Walker) {
  w.phase = "queue";
  s.line.push(w);
}

export function updateShop(app: App, s: ShopState, dt: number) {
  const tr = app.tr();
  fitRoom(app);
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
      const d = DOOR_STEP();
      app.toast(tr.queueFull, d.x + 60, d.y - 60, C.bad, 18);
      continue;
    }
    // Nothing on the stands: a look through the door is enough
    const stand = v.kind === "preorder" ? null : standFor(s, v);
    if (v.kind !== "preorder" && !stand) {
      s.ledger.walked++;
      s.ledger.rep += REP.soldOut;
      if (v.kind === "vip") s.ledger.vip = "missed";
      const d = DOOR_STEP();
      app.toast(tr.soldOut, d.x + 60, d.y - 60, C.bad, 18);
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
    const d = DOOR_STEP();
    const w: Walker = {
      v,
      x: d.x,
      y: d.y,
      s: CUSTOMER_S,
      phase: "browse",
      tile: DOOR_TILE,
      route: [d],
      ri: 0,
      pause: BROWSE_SECONDS,
      picked: [],
      face: 1,
      patience: max,
      max,
      lines: null,
      leaving: false,
    };
    s.walkers.push(w);
    // Pre-orders go straight to the till; everyone else to a stand first
    if (stand) goTo(s, w, stand);
    else joinLine(s, w);
    app.sfx.bell();
  }
  moveWalkers(s, dt);
  // At a stand: a moment to choose, then take their pick
  for (const w of [...s.walkers]) {
    if (w.leaving || w.phase !== "browse" || w.ri < w.route.length - 1)
      continue;
    w.pause -= dt;
    if (w.pause <= 0) takeFromStands(app, s, w);
  }
  // The line shuffles up towards the till
  s.line.forEach((w, i) => {
    const slot = s.slots[Math.min(i, s.slots.length - 1)];
    if (!same(w.tile, slot) && w.ri >= w.route.length - 1) goTo(s, w, slot);
  });

  const f = front(s);
  if (f && !f.lines) atCounter(app, s, f);
  // Mây rings up the front customer; a box choice waits for the player
  if (f?.lines && !f.leaving && !s.checkout) {
    s.ring += dt / CHECKOUT_SECONDS;
    if (s.ring >= 1) {
      s.ring = 0;
      handOver(app, s, f);
    }
  } else if (!f) s.ring = 0;
  for (const w of s.line) {
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
      app.toast(tr.walked, w.x, w.y - 270 * w.s, C.bad, 20);
      leave(s, w, "angry");
    }
  }
  if (s.clock >= CLOSE_AT) close(app, s);
}

/** At the till: what they bring, or the pre-order kept for them. */
function atCounter(app: App, s: ShopState, w: Walker) {
  const tr = app.tr();
  const v = w.v;
  if (v.kind === "preorder") {
    const held = v.preorder !== undefined ? (s.held[v.preorder] ?? []) : [];
    if (held.length && v.preorder !== undefined) {
      w.lines = v.lines;
      s.tray = [...held];
      s.held[v.preorder] = [];
      return;
    }
    s.ledger.preorders.missed++;
    s.ledger.rep += REP.preorderMissed;
    app.sfx.bad();
    app.toast(tr.preorderMissing, w.x, w.y - 270 * w.s, C.bad, 20);
    leave(s, w, "sad");
    return;
  }
  // Their pick goes on the tray, ready to ring up
  const counts = new Map<RecipeId, number>();
  for (const p of w.picked)
    counts.set(p.recipe, (counts.get(p.recipe) ?? 0) + 1);
  w.lines = [...counts].map(([recipe, qty]) => ({ recipe, qty }));
  s.tray = w.picked;
  w.picked = [];
}

/** Where along a route someone is, `ri` points in. */
function along(route: Point[], ri: number) {
  const i = Math.max(0, Math.min(route.length - 1, Math.floor(ri)));
  const a = route[i];
  const b = route[Math.min(route.length - 1, i + 1)];
  const k = Math.max(0, Math.min(1, ri - i));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function moveWalkers(s: ShopState, dt: number) {
  for (const w of s.walkers) {
    const end = w.route.length - 1;
    w.ri = Math.min(end, w.ri + WALK_SPEED * dt);
    const at = along(w.route, w.ri);
    if (Math.abs(at.x - w.x) > 0.5) w.face = at.x > w.x ? 1 : -1;
    w.x = at.x;
    w.y = at.y;
  }
  s.walkers = s.walkers.filter(
    (w) => !(w.leaving && w.ri >= w.route.length - 1),
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
  s.ring = 0;
  app.sfx.coin();
  const y = w.y - 270 * w.s;
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
  fitRoom(app);
  // Under the room: the shop's own floor colour, then the room on top
  ctx.fillStyle = "#f3dfc0";
  ctx.fillRect(
    v.x,
    FLOOR.top + ROOM.size - 2,
    v.w,
    v.y + v.h - FLOOR.top - ROOM.size + 2,
  );
  drawRoom(app, FLOOR, v, s.opened.decor);
  if (weather === "rainy") drawRain(app, glassRects(FLOOR));
  drawLight(app, FLOOR, weather, dusk);
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
        { x: W - 190, y: stripY() + 92, w: 176, h: 56 },
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
        { x: 14, y: stripY() + 92, w: 220, h: 56 },
        tr.closeEarly,
        () => close(app, s),
        { fill: C.green, size: 19 },
      );
    }
  }

  // Furniture (stands showing their cakes) and customers, back to front, then
  // the counter in front of them
  const shelves = shelve(s.opened.decor.placed, displaySlots(s));
  const scene: { y: number; draw: () => void }[] = [
    ...s.opened.decor.placed.map((p) => ({
      y: pieceDepth(FLOOR, p),
      draw: () => {
        drawPiece(app, FLOOR, p);
        for (const spot of shelves)
          if (spot.stand === p)
            drawShelf(
              app,
              FLOOR,
              p,
              spot.shelf,
              recipe(spot.item.recipe).sprite,
              spot.item.count,
            );
      },
    })),
    ...s.walkers.map((w) => ({
      y: w.y + 1,
      draw: () => drawWalker(app, s, w),
    })),
  ];
  // Mây behind the checkout counter
  const till = tillOf(s.opened.decor.placed);
  if (till)
    scene.push({
      y: FLOOR.y0 + (till.y + 1) * FLOOR.th - 1,
      draw: () => drawCashier(app, till),
    });
  for (const d of scene.sort((a, b) => a.y - b.y)) d.draw();
  if (till) drawTill(app, s, till, f);
  drawStrip(app, s);

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
  // A little hop while walking
  const moving =
    w.ri < w.route.length - 1 ? Math.abs(Math.sin(app.time * 12)) * 4 : 0;
  const h = 250 * w.s;
  ctx.save();
  // Fading in and out at the door
  const door = DOOR_STEP();
  ctx.globalAlpha = Math.min(
    1,
    0.25 + Math.hypot(w.x - door.x, w.y - door.y) / 40,
  );
  // Facing the way they walk (the art faces right)
  ctx.translate(w.x, w.y - moving);
  if (w.face < 0) ctx.scale(-1, 1);
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
  if (!w.leaving && w.phase === "queue" && w !== front(s)) {
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

/** Mây at work behind the counter, a little bob while someone is paying. */
function drawCashier(app: App, till: Placed) {
  const def = furniture(till.id);
  const r = tileRect(FLOOR, till.x, till.y, def.w, 1);
  const h = 250 * CUSTOMER_S * 1.05;
  const bob = Math.abs(Math.sin(app.time * 3)) * 2;
  sprite(
    app.ctx,
    app.sprites.get("mascot-happy"),
    r.x + r.w / 2,
    r.y + r.h - 2 - bob,
    h,
    h,
    "bottom",
  );
}

/**
 * Over the counter: what the front customer brings, the checkout's progress
 * and the total. Tapping the counter hurries Mây along.
 */
function drawTill(app: App, s: ShopState, till: Placed, f: Walker | undefined) {
  const { ctx } = app;
  const tr = app.tr();
  const def = furniture(till.id);
  const r = tileRect(FLOOR, till.x, till.y, def.w, def.h);
  const serving = f?.lines && !f.leaving && s.closing === null;
  app.ui.add({
    rect: { x: r.x - 10, y: r.y - 60, w: r.w + 20, h: r.h + 70 },
    key: "till",
    tap: () => {
      if (!serving || s.checkout) return;
      app.sfx.tap();
      s.ring = Math.min(0.999, s.ring + TAP_RING);
    },
  });
  if (!serving || !f) return;
  const count = s.tray.length;
  const total = Math.round(
    orderTotal(s.tray, s.discount, f.v.kind === "preorder"),
  );
  // Above Mây, who stands on the counter's back row
  const b = {
    x: Math.min(W - 222, Math.max(14, r.x + r.w / 2 - 104)),
    y: r.y + FLOOR.th - 250 * CUSTOMER_S * 1.05 - 70,
    w: 208,
    h: 62,
  };
  bubble(ctx, b, r.x + r.w / 2);
  // The pieces, a few at most, then the bar and the price
  const kinds = [...new Set(s.tray.map((p) => p.recipe))].slice(0, 3);
  kinds.forEach((id, i) => {
    sprite(
      ctx,
      app.sprites.get(recipe(id).sprite),
      b.x + 26 + i * 30,
      b.y + 24,
      30,
      28,
    );
  });
  text(ctx, `×${count}`, b.x + 26 + kinds.length * 30, b.y + 24, {
    size: 15,
    align: "left",
  });
  coin(ctx, b.x + b.w - 54, b.y + 22, 10);
  text(ctx, `${total}`, b.x + b.w - 40, b.y + 23, { size: 17, align: "left" });
  bar(
    ctx,
    { x: b.x + 14, y: b.y + 42, w: b.w - 28, h: 10 },
    s.checkout ? 1 : s.ring,
    C.good,
  );
  if (f.v.kind === "vip" || f.v.kind === "preorder")
    text(
      ctx,
      f.v.kind === "vip" ? tr.vipWants : tr.preorderTag,
      b.x + b.w / 2,
      b.y - 12,
      {
        size: 13,
        fill: f.v.kind === "vip" ? C.warn : C.text,
        outline: C.white,
      },
    );
}

/** Under the room: what is left on the stands, and the hint to tap the counter. */
function drawStrip(app: App, s: ShopState) {
  const { ctx } = app;
  const tr = app.tr();
  const strip = { x: 14, y: stripY(), w: W - 28, h: 78 };
  panel(ctx, strip, { fill: "#fff8eb", radius: 20, line: 2.5 });
  sectionLabel(app, strip.x + 12, strip.y - 13, tr.onStands);
  const slots = displaySlots(s).slice(0, 6);
  if (!slots.length)
    text(ctx, tr.emptyDisplay, W / 2, strip.y + strip.h / 2, {
      size: 16,
      fill: C.muted,
    });
  slots.forEach((slot, i) => {
    const cx = strip.x + 40 + i * 78;
    sprite(
      ctx,
      app.sprites.get(recipe(slot.recipe).sprite),
      cx,
      strip.y + 38,
      50,
      46,
    );
    text(ctx, `×${slot.count}`, cx + 26, strip.y + 22, {
      size: 14,
      outline: C.white,
    });
    stars(ctx, cx, strip.y + 66, slot.stars, 6);
  });
  if (front(s) && !s.checkout && s.closing === null)
    text(ctx, tr.tapTill, W / 2, stripY() + 168, {
      size: 14,
      fill: C.muted,
      outline: C.white,
    });
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

/** Rain falling past the window and the door's glass. */
function drawRain(app: App, glass: Rect[]) {
  const { ctx } = app;
  ctx.save();
  ctx.strokeStyle = "rgba(225, 235, 255, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const r of glass) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    for (let i = 0; i < 18; i++) {
      const fx = (i * 0.618 * 997) % 1;
      const fall = (app.time * (0.9 + (i % 5) * 0.12) + i * 0.37) % 1;
      const x = r.x + fx * (r.w + 20) - 10 - fall * 10;
      const y = r.y - 20 + fall * (r.h + 40);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 12);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
