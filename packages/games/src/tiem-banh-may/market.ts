import { type App, H, W, btn, close, hud } from "./app";
import { C, card, clipboard, coin, panel, sprite, text } from "./art";
import { INGREDIENTS, MARKET_TRIP } from "./config";
import {
  buyIngredients,
  cartCost,
  clockAt,
  formatClock,
  freshDays,
  pantryQty,
} from "./logic";
import type { Cart } from "./logic";

// The market: tap an ingredient to put a pack in the basket, pay once. The trip
// costs MARKET_TRIP minutes of the night however much is bought.

export function drawMarket(app: App, cart: Cart) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = app.rt.stage.view;
  ctx.fillStyle = C.page;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  const y0 = hud(app, formatClock(clockAt(save.prepUsed)));

  const board = { x: 14, y: y0 + 46, w: W - 28, h: H - 150 - y0 - 46 };
  const paper = clipboard(ctx, board, tr.market);
  close(app, board, () => app.go({ kind: "hub" }));
  const cols = 3;
  const rows = 4;
  const gap = 8;
  const gx = paper.x + 10;
  const gy = paper.y + 12;
  const cw = (paper.w - 20 - gap * (cols - 1)) / cols;
  const ch = (paper.h - 24 - gap * (rows - 1)) / rows;
  INGREDIENTS.forEach((ing, i) => {
    const r = {
      x: gx + (i % cols) * (cw + gap),
      y: gy + Math.floor(i / cols) * (ch + gap),
      w: cw,
      h: ch,
    };
    const n = cart[ing.id] ?? 0;
    const key = `ing-${ing.id}`;
    const pressed = app.ui.isPressed(key);
    const tileH = Math.max(50, ch - 76);
    const tile = card(ctx, r, n ? "green" : "pink", pressed, tileH);
    sprite(
      ctx,
      app.sprites.get(ing.sprite),
      tile.x + tile.w / 2,
      tile.y + tile.h / 2,
      tile.w - 30,
      tile.h - 8,
    );
    if (ing.fresh) {
      panel(
        ctx,
        { x: tile.x + 4, y: tile.y + 4, w: 66, h: 20 },
        { fill: "#c8f0d8", radius: 10, line: 2 },
      );
      text(
        ctx,
        tr.fresh(freshDays(save)).split(" · ")[1] ?? "",
        tile.x + 37,
        tile.y + 14,
        { size: 12 },
      );
    }
    const ty = tile.y + tile.h;
    text(ctx, ing.name[locale], r.x + r.w / 2, ty + 15, {
      size: 17,
      maxWidth: r.w - 12,
    });
    text(
      ctx,
      `${tr.pack(ing.pack, ing.unit)} · ${ing.price}`,
      r.x + r.w / 2 - 8,
      ty + 36,
      { size: 14, weight: 700, maxWidth: r.w - 36 },
    );
    ctx.font = `700 14px "Baloo 2"`;
    coin(
      ctx,
      r.x +
        r.w / 2 +
        ctx.measureText(`${tr.pack(ing.pack, ing.unit)} · ${ing.price}`).width /
          2 +
        2,
      ty + 36,
      7,
    );
    const have = pantryQty(save, ing.id);
    text(
      ctx,
      tr.inPantry(have ? tr.pack(Math.round(have), ing.unit) : "0"),
      r.x + r.w / 2,
      ty + 55,
      { size: 13, weight: 700, fill: C.muted, maxWidth: r.w - 12 },
    );
    app.ui.add({
      rect: r,
      key,
      tap: () => {
        app.sfx.tap();
        app.go({ kind: "market", cart: { ...cart, [ing.id]: n + 1 } });
      },
    });
    if (n) {
      // Count on the right, a minus on the left
      const bx = tile.x + tile.w - 18;
      const by = tile.y + 18;
      ctx.beginPath();
      ctx.arc(bx, by, 17, 0, Math.PI * 2);
      ctx.fillStyle = C.good;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      text(ctx, `${n}`, bx, by, { size: 18, fill: C.white });
      const mr = { x: tile.x - 4, y: tile.y + tile.h - 40, w: 44, h: 44 };
      ctx.beginPath();
      ctx.arc(mr.x + 22, mr.y + 22, 16, 0, Math.PI * 2);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.stroke();
      text(ctx, "−", mr.x + 22, mr.y + 20, { size: 24 });
      app.ui.add({
        rect: mr,
        tap: () => {
          app.sfx.tap();
          app.go({ kind: "market", cart: { ...cart, [ing.id]: n - 1 } });
        },
      });
    }
  });

  const cost = cartCost(cart);
  const r = { x: 200, y: H - 96, w: W - 214, h: 76 };
  panel(
    ctx,
    { x: 14, y: r.y + 4, w: 174, h: 64 },
    { fill: C.cream, radius: 20, line: 3.5 },
  );
  text(ctx, tr.total, 101, r.y + 22, { size: 15, fill: C.muted });
  text(ctx, tr.coins(cost), 101, r.y + 46, {
    size: 22,
    fill: cost > save.coins ? C.bad : C.text,
    maxWidth: 160,
  });
  btn(
    app,
    "pay",
    r,
    tr.checkout(MARKET_TRIP),
    () => {
      const res = buyIngredients(save, cart);
      if (!res.ok) {
        app.sfx.bad();
        app.toast(
          res.why === "coins"
            ? tr.noCoins
            : res.why === "time"
              ? tr.noTime
              : "",
          W / 2,
          H - 150,
          C.bad,
        );
        return;
      }
      app.sfx.coin();
      app.commit(res.save);
      app.toast(`−${tr.coins(cost)}`, W / 2, 140, C.bad);
      app.go({ kind: "hub" });
    },
    { fill: C.green, size: 22, disabled: cost <= 0 },
  );
}
