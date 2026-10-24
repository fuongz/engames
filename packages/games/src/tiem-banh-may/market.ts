import type { Rect } from "../core";
import { type App, H, W, btn, close, viewRect } from "./app";
import { C, cover, nine, panel, rr, sprite, text } from "./art";
import { INGREDIENTS, type IngredientId, MARKET_TRIP } from "./config";
import { hud } from "./hud";
import { K, pillWidth, priceSticker, tabs } from "./kit";
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
// case, flavours and fruit) and the coffee by the till. Each product wears a
// round price sticker; the tag clipped to the shelf below it says what it is,
// the pack size and what is already in the pantry, so price and amounts never
// share a line. Tap a product to put a pack in the basket, pay once; the trip
// costs MARKET_TRIP minutes of the night however much is bought.

type Aisle = "dry" | "cold" | "flavour";

const AISLES: { id: Aisle; items: IngredientId[] }[] = [
  { id: "dry", items: ["flour", "sugar", "bakingPowder", "yeast"] },
  { id: "cold", items: ["milk", "cream", "butter", "eggs"] },
  { id: "flavour", items: ["vanilla", "chocolate", "oil", "strawberry"] },
];

const ing = (id: IngredientId) => {
  const found = INGREDIENTS.find((i) => i.id === id);
  if (!found) throw new Error(`No ingredient ${id}`);
  return found;
};

/** Tag height under a shelf item (big on the aisles, small at the till). */
const TAG = { big: 70, small: 50 };
const PLANK_H = 16;

export function drawMarket(app: App, cart: Cart, open: number) {
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
    (i) => app.go({ kind: "market", cart, aisle: i }),
  );
  drawAisle(app, cart, aisle, {
    x: 10,
    y: y0 + 102,
    w: W - 20,
    h: H - 184 - (y0 + 102),
  });
  drawTill(app, cart);
}

/** An aisle page: two shelves of two products. */
function drawAisle(
  app: App,
  cart: Cart,
  aisle: (typeof AISLES)[number],
  r: Rect,
) {
  const { ctx } = app;
  const rows = 2;
  const perRow = Math.ceil(aisle.items.length / rows);
  const rowH = r.h / rows;
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
  const sr = big ? 30 : 22;
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

/** The market screen as it stands (keeps the open aisle when the cart changes). */
function currentMarket(app: App) {
  const s = app.screen;
  return s.kind === "market" ? s : { kind: "market" as const, cart: {} };
}

/** The till: coffee by the counter, the basket with its total, and pay. */
function drawTill(app: App, cart: Cart) {
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

  // The basket and what it all costs
  const items = Object.values(cart).reduce((n, q) => n + (q ?? 0), 0);
  const cost = cartCost(cart);
  const bx = counter.x + 186;
  sprite(ctx, app.sprites.get("basket"), bx, counter.y + 48, 84, 70);
  text(ctx, tr.basket(items), bx, counter.y + 98, { size: 15, maxWidth: 140 });
  text(ctx, tr.coins(cost), bx, counter.y + 126, {
    size: 22,
    fill: cost > save.coins ? C.bad : C.text,
    maxWidth: 150,
  });

  btn(
    app,
    "pay",
    { x: counter.x + 268, y: counter.y + 40, w: counter.w - 282, h: 76 },
    tr.checkout(MARKET_TRIP),
    () => {
      const res = buyIngredients(save, cart);
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
    },
    { fill: C.green, size: 20, disabled: cost <= 0 },
  );
}
