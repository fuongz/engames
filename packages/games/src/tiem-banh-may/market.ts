import type { Rect } from "@web-games/core";
import { type App, H, W, btn, close, shade, sheet, top, viewRect } from "./app";
import { C, cover, nine, panel, rr, sprite, text, wrap } from "./art";
import {
  INGREDIENTS,
  type IngredientId,
  MARKET_TRIP,
  RECORDS,
  type RecordId,
} from "./config";
import { playable } from "./musicbox";
import { hud } from "./hud";
import { K, dialogButtons, pillWidth, priceSticker, tabs } from "./kit";
import {
  buyIngredients,
  type Cart,
  cartCost,
  clockAt,
  formatClock,
  freshDays,
  pantryQty,
} from "./logic";

// The market is a little grocery with one page per aisle (dry goods, a chilled
// case, flavours and fruit, Vietnamese specials) and the coffee by the till. Each product wears a
// round price sticker; the tag clipped to the shelf below it says what it is,
// the pack size and what is already in the pantry, so price and amounts never
// share a line. Tap a product to put a pack in the basket, pay once; the trip
// costs MARKET_TRIP minutes of the night however much is bought. Tap the
// basket at the till to see everything in it, change amounts and pay there.

type Aisle = "dry" | "cold" | "flavour" | "special" | "records";

const AISLES: { id: Aisle; items: IngredientId[] }[] = [
  {
    id: "dry",
    items: [
      "flour",
      "sugar",
      "bakingPowder",
      "yeast",
      "riceFlour",
      "almondFlour",
    ],
  },
  {
    id: "cold",
    items: ["milk", "cream", "butter", "eggs", "mascarpone", "coconutMilk"],
  },
  {
    id: "flavour",
    items: ["vanilla", "chocolate", "cocoa", "oil", "strawberry", "banana"],
  },
  { id: "special", items: ["saltedEgg", "porkFloss"] },
  // Records for the music box: bought at once, not through the basket
  { id: "records", items: [] },
];

const ing = (id: IngredientId) => {
  const found = INGREDIENTS.find((i) => i.id === id);
  if (!found) throw new Error(`No ingredient ${id}`);
  return found;
};

/** Tag height under a shelf item (big on the aisles, small at the till). */
const TAG = { big: 70, small: 50 };
const PLANK_H = 16;

export function drawMarket(
  app: App,
  cart: Cart,
  open: number,
  records: RecordId[] = [],
  basket?: number,
) {
  const { ctx, save } = app;
  const tr = app.tr();
  const v = viewRect(app);
  ctx.fillStyle = C.page;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  cover(ctx, app.sprites.get("bg-market"), v, 0.5);
  const y0 = hud(app, formatClock(clockAt(save.night)));

  // Title and the way out
  const tw = Math.max(150, pillWidth(app, tr.market, false) + 20);
  const title = { x: (W - tw) / 2, y: y0 + 2, w: tw, h: K.pill };
  panel(ctx, title, { fill: "#dff3f6", radius: K.pill / 2, line: K.line });
  text(ctx, tr.market, W / 2, title.y + title.h / 2, { size: 22 });
  close(app, { x: 0, y: y0 + 14, w: W - 30, h: 0 }, () =>
    app.go({ kind: "hub" }),
  );

  // One aisle per page
  const aisle = AISLES[Math.max(0, Math.min(AISLES.length - 1, open))];
  tabs(
    app,
    { x: 14, y: y0 + 52, w: W - 28, h: 40 },
    AISLES.map((a) => tr.aisles[a.id]),
    AISLES.indexOf(aisle),
    (i) => app.go({ ...currentMarket(app), aisle: i }),
  );
  const area = { x: 10, y: y0 + 102, w: W - 20, h: H - 184 - (y0 + 102) };
  if (aisle.id === "records") drawRecords(app, area, records);
  else drawAisle(app, cart, aisle, area);
  drawTill(app, cart, records);
  if (basket !== undefined) drawBasket(app, cart, records, basket);
}

/** An aisle page: up to two shelves of three products. */
function drawAisle(
  app: App,
  cart: Cart,
  aisle: (typeof AISLES)[number],
  r: Rect,
) {
  const { ctx } = app;
  // Three to a shelf, two shelves to a page (a short aisle keeps the same size)
  const perRow = Math.min(3, aisle.items.length);
  const rows = Math.ceil(aisle.items.length / perRow);
  const rowH = r.h / 2;
  if (aisle.id === "cold") {
    // The chilled case behind the dairy
    const box = { x: r.x, y: r.y, w: r.w, h: r.h - TAG.big + 8 };
    if (!nine(ctx, app.sprites.get("fridge-back"), box, 60, 22))
      panel(ctx, box, { fill: "#e6f6f3", radius: 18, line: 2.5 });
  }
  for (let row = 0; row < rows; row++) {
    const top = r.y + row * rowH;
    const plankY = top + rowH - TAG.big - PLANK_H + 2;
    shelf(app, aisle.id === "cold", r.x, plankY, r.w);
    const items = aisle.items.slice(row * perRow, row * perRow + perRow);
    const colW = r.w / perRow;
    items.forEach((id, i) => {
      drawItem(app, cart, id, {
        cx: r.x + colW * (i + 0.5),
        w: colW,
        top: top + 12,
        shelf: plankY,
        size: "big",
      });
    });
  }
}

/** A shelf board across `w` whose top is at `y`. */
function shelf(app: App, cold: boolean, x: number, y: number, w: number) {
  const { ctx } = app;
  const plank = app.sprites.get(cold ? "shelf-fridge" : "shelf-wood");
  if (plank?.naturalWidth) {
    const pw = w + 12;
    ctx.drawImage(
      plank,
      x - 6,
      y - 4,
      pw,
      (pw * plank.naturalHeight) / plank.naturalWidth,
    );
    return;
  }
  panel(
    ctx,
    { x, y, w, h: PLANK_H },
    { fill: cold ? "#d7efe9" : "#e2b47e", radius: 6, line: 2.5 },
  );
}

/** One product on a shelf: picture, price sticker, tag, basket controls. */
function drawItem(
  app: App,
  cart: Cart,
  id: IngredientId,
  at: {
    cx: number;
    w: number;
    /** Top of the space above the shelf, and the shelf line. */
    top: number;
    shelf: number;
    size: "big" | "small";
  },
) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const it = ing(id);
  const big = at.size === "big";
  const { cx, w } = at;
  const inCart = cart[id] ?? 0;
  const key = `ing-${id}`;
  const lift = app.ui.isPressed(key) ? 4 : 0;
  const artH = at.shelf - at.top + 2;
  const artW = Math.min(w - 40, artH * 1.1);
  sprite(
    ctx,
    app.sprites.get(it.sprite),
    cx,
    at.shelf + 4 - lift,
    artW,
    artH - (big ? 6 : 0),
    "bottom",
  );

  // Price on the product, top left
  const sr = big ? 24 : 20;
  priceSticker(app, cx - artW / 2 + sr * 0.4, at.top + sr, it.price, sr);
  if (it.fresh) {
    // Keeps only a few days
    const f = { x: cx + artW / 2 - 52, y: at.top, w: 62, h: 22 };
    panel(ctx, f, { fill: "#c8f0d8", radius: 11, line: 1.8 });
    text(ctx, tr.fresh(freshDays(save)), f.x + f.w / 2, f.y + f.h / 2, {
      size: 12,
    });
  }

  // The shelf tag: what it is, the pack, and what is at home
  const th = big ? TAG.big : TAG.small;
  const tag = {
    x: cx - w / 2 + 8,
    y: at.shelf + PLANK_H - 2,
    w: w - 16,
    h: th - 6,
  };
  ctx.save();
  rr(ctx, tag.x, tag.y, tag.w, tag.h, 10);
  ctx.fillStyle = inCart ? "#eaf7e1" : C.white;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
  panel(
    ctx,
    { x: cx - 9, y: tag.y - 6, w: 18, h: 10 },
    { fill: "#c9a27e", radius: 3, line: 1.6 },
  );
  const have = pantryQty(save, id);
  const stock = tr.inStock(have ? tr.pack(Math.round(have), it.unit) : "0");
  if (big) {
    text(ctx, it.name[locale], cx, tag.y + 16, {
      size: 17,
      maxWidth: tag.w - 12,
    });
    text(ctx, tr.packOf(tr.pack(it.pack, it.unit)), cx, tag.y + 37, {
      size: 14,
      maxWidth: tag.w - 12,
    });
    text(ctx, stock, cx, tag.y + 55, {
      size: 12,
      fill: C.muted,
      maxWidth: tag.w - 12,
    });
  } else {
    text(ctx, it.name[locale], cx, tag.y + 14, {
      size: 14,
      maxWidth: tag.w - 8,
    });
    text(ctx, stock, cx, tag.y + 32, {
      size: 11,
      fill: C.muted,
      maxWidth: tag.w - 8,
    });
  }

  app.ui.add({
    rect: { x: cx - w / 2, y: at.top, w, h: tag.y + tag.h - at.top },
    key,
    tap: () => {
      app.sfx.tap();
      app.go({ ...currentMarket(app), cart: { ...cart, [id]: inCart + 1 } });
    },
  });
  if (inCart) {
    // How many packs are in the basket, and a way to put one back
    const bx = cx + artW / 2 - 2;
    const by = at.shelf - 22;
    ctx.beginPath();
    ctx.arc(bx, by, 16, 0, Math.PI * 2);
    ctx.fillStyle = C.good;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    text(ctx, `×${inCart}`, bx, by, { size: 15, fill: C.white });
    const mx = cx - artW / 2 + 2;
    ctx.beginPath();
    ctx.arc(mx, by, 16, 0, Math.PI * 2);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.stroke();
    text(ctx, "−", mx, by - 1, { size: 22 });
    app.ui.add({
      rect: { x: mx - 22, y: by - 22, w: 44, h: 44 },
      tap: () => {
        app.sfx.tap();
        app.go({ ...currentMarket(app), cart: { ...cart, [id]: inCart - 1 } });
      },
    });
  }
}

/** The record shelf: sleeves standing in a crate, bought with one tap. */
function drawRecords(app: App, r: Rect, basket: RecordId[]) {
  const { ctx, save } = app;
  const tr = app.tr();
  const list = RECORDS.filter((x) => x.price > 0 && playable(x));
  const cols = 3;
  const cw = r.w / cols;
  const ch = 150;
  list.forEach((rec, i) => {
    const cx = r.x + cw * ((i % cols) + 0.5);
    const top = r.y + Math.floor(i / cols) * ch;
    const owned = save.records.includes(rec.id);
    const picked = basket.includes(rec.id);
    const key = `buy-${rec.id}`;
    const sink = app.ui.isPressed(key) && !owned ? 3 : 0;
    panel(
      ctx,
      { x: cx - cw / 2 + 5, y: top + sink, w: cw - 10, h: ch - 10 },
      {
        fill: owned ? "#f1ece4" : picked ? "#eaf7e1" : C.white,
        radius: 16,
        line: picked ? 3 : 2,
      },
    );
    sprite(ctx, app.sprites.get(rec.sprite), cx, top + 62 + sink, cw - 40, 92);
    text(ctx, rec.title, cx, top + 124 + sink, { size: 12, maxWidth: cw - 22 });
    if (owned)
      text(ctx, tr.musicBox.owned, cx, top + 144, { size: 13, fill: C.good });
    else {
      priceSticker(app, cx - cw / 2 + 26, top + 22, rec.price, 18);
      // In the basket: a green tick
      if (picked) {
        ctx.beginPath();
        ctx.arc(cx + cw / 2 - 22, top + 20, 14, 0, Math.PI * 2);
        ctx.fillStyle = C.good;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
        text(ctx, "✓", cx + cw / 2 - 22, top + 20, { size: 16, fill: C.white });
      }
    }
    app.ui.add({
      rect: { x: cx - cw / 2 + 5, y: top, w: cw - 10, h: ch - 10 },
      key,
      tap: () => {
        if (owned) return;
        app.sfx.tap();
        // Into the basket, or back on the shelf
        app.go({
          ...currentMarket(app),
          records: picked
            ? basket.filter((id) => id !== rec.id)
            : [...basket, rec.id],
        });
      },
    });
  });
}

/** The market screen as it stands (keeps the open aisle when the cart changes). */
function currentMarket(app: App) {
  const s = app.screen;
  return s.kind === "market" ? s : { kind: "market" as const, cart: {} };
}

/** The till: coffee by the counter, the basket with its total, and pay. */
function drawTill(app: App, cart: Cart, records: RecordId[]) {
  const { ctx, save } = app;
  const tr = app.tr();
  const counter = { x: 10, y: H - 170, w: W - 20, h: 156 };
  panel(ctx, counter, { fill: "#e9c79c", radius: 22, line: 3, lip: 5 });

  // Coffee, an impulse buy by the till
  drawItem(app, cart, "coffee", {
    cx: counter.x + 66,
    w: 122,
    top: counter.y + 8,
    shelf: counter.y + 84,
    size: "small",
  });

  // The basket and what it all costs; tap it to see what is in it
  const items = basketCount(cart, records);
  const cost = cartCost(cart, records);
  const bx = counter.x + 186;
  const by = counter.y + 48;
  const sink = app.ui.isPressed("basket") ? 3 : 0;
  // A nudge each time something goes in or comes out
  const k = app.motion.bump("basket", items);
  ctx.save();
  ctx.translate(bx, by + sink);
  ctx.scale(k, k);
  sprite(ctx, app.sprites.get("basket"), 0, 0, 84, 70);
  ctx.restore();
  if (items) {
    const cx = bx + 34;
    const cy = by - 26 + sink;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = C.good;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    text(ctx, `${items}`, 0, 0, { size: 15, fill: C.white });
    ctx.restore();
  }
  text(ctx, tr.basket(items), bx, counter.y + 98, { size: 15, maxWidth: 140 });
  text(ctx, tr.coins(cost), bx, counter.y + 126, {
    size: 22,
    fill: cost > save.coins ? C.bad : C.text,
    maxWidth: 150,
  });
  app.ui.add({
    rect: { x: bx - 60, y: counter.y + 4, w: 120, h: 140 },
    key: "basket",
    tap: () => {
      app.sfx.tap();
      app.go({ ...currentMarket(app), basket: 0 });
    },
  });

  btn(
    app,
    "pay",
    { x: counter.x + 268, y: counter.y + 40, w: counter.w - 282, h: 76 },
    tr.checkout(MARKET_TRIP),
    () => checkout(app, cart, records),
    { fill: C.green, size: 20, disabled: cost <= 0 },
  );
}

const basketCount = (cart: Cart, records: RecordId[]) =>
  Object.values(cart).reduce((n, q) => n + (q ?? 0), 0) + records.length;

/** Pay for the basket and head home, or say why not. */
function checkout(app: App, cart: Cart, records: RecordId[]) {
  const tr = app.tr();
  const cost = cartCost(cart, records);
  const res = buyIngredients(app.save, cart, records);
  if (!res.ok) {
    app.sfx.bad();
    app.toast(
      res.why === "tired"
        ? tr.tired
        : res.why === "coins"
          ? tr.noCoins
          : res.why === "time"
            ? tr.noTime
            : "",
      W / 2,
      H - 200,
      C.bad,
    );
    return;
  }
  app.sfx.coin();
  app.commit(res.save);
  app.toast(`−${tr.coins(cost)}`, W / 2, 140, C.bad);
  app.go({ kind: "hub" });
}

/** One line of the basket: a pack of something, or a record. */
type Line =
  | { kind: "ing"; id: IngredientId; packs: number }
  | { kind: "record"; id: RecordId };

/** Lines on one page of the basket. */
const PER_PAGE = 6;
const ROW = 76;

/** Everything in the basket, shelf by shelf, then the coffee, then records. */
function basketLines(cart: Cart, records: RecordId[]): Line[] {
  const ids = [...AISLES.flatMap((a) => a.items), "coffee" as const];
  return [
    ...ids
      .filter((id) => (cart[id] ?? 0) > 0)
      .map((id) => ({ kind: "ing" as const, id, packs: cart[id] ?? 0 })),
    ...records.map((id) => ({ kind: "record" as const, id })),
  ];
}

/**
 * The basket's list over the market: a picture, name and pack per line with
 * − and + (a record has ✕), the line's price, then the total, "put it all
 * back" and pay.
 */
function drawBasket(app: App, cart: Cart, records: RecordId[], page: number) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const shut = () => {
    const s = currentMarket(app);
    app.go({ ...s, basket: undefined });
  };
  const lines = basketLines(cart, records);
  const pages = Math.max(1, Math.ceil(lines.length / PER_PAGE));
  const at = Math.min(page, pages - 1);
  const shown = lines.slice(at * PER_PAGE, at * PER_PAGE + PER_PAGE);
  const cost = cartCost(cart, records);

  shade(app, shut);
  const body = lines.length ? shown.length * ROW : 140;
  const pager = pages > 1 ? 48 : 0;
  const h = 44 + 20 + body + pager + 56 + K.button + K.inset + 24 + 8;
  const m = { x: 24, y: Math.max(top(app) + 40, (H - h) / 2), w: W - 48, h };
  const paper = sheet(app, m, tr.basketTitle);
  close(app, { ...m, w: m.w - 16, y: m.y + 4 }, shut);

  // Nothing in it yet
  if (!lines.length) {
    sprite(ctx, app.sprites.get("basket"), W / 2, paper.y + 70, 110, 92);
    text(ctx, tr.basketEmpty, W / 2, paper.y + 140, { size: 20 });
    text(ctx, tr.basketHint, W / 2, paper.y + 170, {
      size: 15,
      fill: C.muted,
      maxWidth: paper.w - 20,
    });
    dialogButtons(app, m, [
      {
        key: "keep-shopping",
        label: tr.keepShopping,
        onTap: shut,
        fill: C.green,
      },
    ]);
    return;
  }

  const set = (next: { cart?: Cart; records?: RecordId[] }) => {
    const s = currentMarket(app);
    app.go({ ...s, ...next, basket: at });
  };
  shown.forEach((line, i) => {
    const y = paper.y + 10 + i * ROW;
    const cy = y + ROW / 2;
    if (i > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = C.ink;
      ctx.fillRect(paper.x + 8, y, paper.w - 16, 1.5);
      ctx.restore();
    }
    const right = paper.x + paper.w - 6;
    if (line.kind === "ing") {
      const it = ing(line.id);
      sprite(ctx, app.sprites.get(it.sprite), paper.x + 34, cy, 58, 58);
      const have = pantryQty(save, line.id);
      text(ctx, it.name[locale], paper.x + 72, cy - 13, {
        size: 18,
        align: "left",
        maxWidth: 150,
      });
      text(ctx, tr.packOf(tr.pack(it.pack, it.unit)), paper.x + 72, cy + 13, {
        size: 13,
        align: "left",
        fill: C.muted,
        maxWidth: 150,
      });
      text(
        ctx,
        tr.inStock(have ? tr.pack(Math.round(have), it.unit) : "0"),
        paper.x + 72,
        cy + 30,
        { size: 11, align: "left", fill: C.muted, maxWidth: 150 },
      );
      // − packs +
      const sx = paper.x + paper.w - 196;
      stepper(app, `less-${line.id}`, sx, cy, "−", () =>
        set({ cart: { ...cart, [line.id]: line.packs - 1 } }),
      );
      text(ctx, `${line.packs}`, sx + 38, cy, { size: 20 });
      stepper(app, `more-${line.id}`, sx + 76, cy, "+", () =>
        set({ cart: { ...cart, [line.id]: line.packs + 1 } }),
      );
      text(ctx, tr.coins(it.price * line.packs), right, cy, {
        size: 17,
        align: "right",
        maxWidth: 84,
      });
    } else {
      const rec = RECORDS.find((x) => x.id === line.id);
      if (!rec) return;
      sprite(ctx, app.sprites.get(rec.sprite), paper.x + 34, cy, 58, 58);
      // A long title takes two lines rather than shrinking out of reach
      const sx = paper.x + paper.w - 120;
      const title = wrap(ctx, rec.title, sx - 30 - (paper.x + 72), 16).slice(
        0,
        2,
      );
      title.forEach((l, j) => {
        text(ctx, l, paper.x + 72, cy - 12 - (title.length - 1) * 9 + j * 19, {
          size: 16,
          align: "left",
          maxWidth: sx - 30 - (paper.x + 72),
        });
      });
      text(
        ctx,
        tr.aisles.records,
        paper.x + 72,
        cy + 10 + (title.length - 1) * 10,
        {
          size: 13,
          align: "left",
          fill: C.muted,
        },
      );
      stepper(app, `drop-${line.id}`, sx, cy, "✕", () =>
        set({ records: records.filter((id) => id !== line.id) }),
      );
      text(ctx, tr.coins(rec.price), right, cy, {
        size: 17,
        align: "right",
        maxWidth: 84,
      });
    }
  });

  // More lines than a page holds
  let y = paper.y + 10 + shown.length * ROW;
  if (pages > 1) {
    const cy = y + 24;
    if (at > 0)
      stepper(app, "basket-prev", W / 2 - 70, cy, "‹", () =>
        app.go({ ...currentMarket(app), basket: at - 1 }),
      );
    text(ctx, `${at + 1}/${pages}`, W / 2, cy, { size: 17, fill: C.muted });
    if (at < pages - 1)
      stepper(app, "basket-next", W / 2 + 70, cy, "›", () =>
        app.go({ ...currentMarket(app), basket: at + 1 }),
      );
    y += pager;
  }

  // The total, then put it all back or pay
  text(ctx, tr.total, paper.x + 14, y + 30, { size: 19, align: "left" });
  text(ctx, tr.coins(cost), paper.x + paper.w - 6, y + 30, {
    size: 24,
    align: "right",
    fill: cost > save.coins ? C.bad : C.text,
  });
  dialogButtons(app, m, [
    {
      key: "basket-clear",
      label: tr.clearBasket,
      onTap: () => set({ cart: {}, records: [] }),
    },
    {
      key: "pay",
      label: tr.checkout(MARKET_TRIP),
      onTap: () => checkout(app, cart, records),
      fill: C.green,
      size: 19,
      weight: 1.7,
    },
  ]);
}

/** A small round button with one glyph (−, +, ✕, ‹, ›), registered for taps. */
function stepper(
  app: App,
  key: string,
  cx: number,
  cy: number,
  glyph: string,
  onTap: () => void,
) {
  const { ctx } = app;
  const r = 18;
  const sink = app.ui.isPressed(key) ? 2 : 0;
  ctx.beginPath();
  ctx.arc(cx, cy + sink, r, 0, Math.PI * 2);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  text(ctx, glyph, cx, cy + sink - 1, { size: glyph === "✕" ? 16 : 22 });
  app.ui.add({
    rect: { x: cx - 24, y: cy - 24, w: 48, h: 48 },
    key,
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}
