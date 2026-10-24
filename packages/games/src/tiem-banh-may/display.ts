import type { Rect } from "../core";
import { type App, H, W, btn, close, viewRect } from "./app";
import { C, cover, panel, rr, sprite, stars, text, wrap } from "./art";
import { hud } from "./hud";
import { K, pillWidth, priceSticker } from "./kit";
import {
  clockAt,
  displayCap,
  formatClock,
  piecePrice,
  recipe,
  type StockItem,
  stockCount,
} from "./logic";

// The display case on its own screen: a glass cabinet with three shelves, each
// batch standing on a shelf with a tag (name, stars, how many). What is in the
// case is sold tomorrow; it keeps one day.

/** The cabinet's glass shelves, as fractions of the display-case picture (measured). */
const SHELVES = [0.312, 0.53, 0.768];
const PER_SHELF = 3;
/** The open interior, as fractions of the picture's width. */
const INSIDE = { left: 0.09, right: 0.91 };

export function drawDisplay(app: App) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = viewRect(app);
  ctx.fillStyle = C.page;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  cover(ctx, app.sprites.get("bg-shopfront"), v, 0.5);
  const y0 = hud(app, formatClock(clockAt(save.night)));

  // Title and the way out
  const tw = Math.max(150, pillWidth(app, tr.displayTitle, false) + 20);
  const title = { x: (W - tw) / 2, y: y0 + 2, w: tw, h: K.pill };
  panel(ctx, title, { fill: "#dff3f6", radius: K.pill / 2, line: K.line });
  text(ctx, tr.displayTitle, W / 2, title.y + title.h / 2, { size: 22 });
  const back = () => app.go({ kind: "hub" });
  close(app, { x: 0, y: y0 + 14, w: W - 30, h: 0 }, back);

  // The cabinet, as large as fits between the title and the footer
  const footer = 150;
  const room = { top: y0 + 54, bottom: H - footer };
  const img = app.sprites.get("display-case");
  const aspect = img?.naturalWidth
    ? img.naturalWidth / img.naturalHeight
    : 0.68;
  const ch = room.bottom - room.top;
  const cw = Math.min(W - 40, ch * aspect);
  const box: Rect = { x: (W - cw) / 2, y: room.top, w: cw, h: cw / aspect };
  if (img?.naturalWidth) ctx.drawImage(img, box.x, box.y, box.w, box.h);
  else {
    panel(ctx, box, { fill: "#fbefe6", radius: 28, line: 4 });
    for (const f of SHELVES)
      panel(
        ctx,
        { x: box.x + 16, y: box.y + box.h * f, w: box.w - 32, h: 8 },
        { fill: "#e3f3f0", radius: 4, line: 2 },
      );
  }

  // Batches on the shelves, three to a shelf
  const inside = {
    x: box.x + box.w * INSIDE.left,
    w: box.w * (INSIDE.right - INSIDE.left),
  };
  const slotW = inside.w / PER_SHELF;
  const shown = save.stock.slice(0, SHELVES.length * PER_SHELF);
  shown.forEach((item, i) => {
    const shelfY = box.y + box.h * SHELVES[Math.floor(i / PER_SHELF)];
    const cx = inside.x + slotW * ((i % PER_SHELF) + 0.5);
    drawBatch(app, item, cx, shelfY, slotW, locale, box.h * 0.034);
  });
  if (!save.stock.length) {
    const mid = box.y + box.h * ((SHELVES[0] + SHELVES[1]) / 2);
    text(ctx, tr.emptyDisplay, W / 2, mid, {
      size: 20,
      fill: C.muted,
      outline: C.cream,
    });
  }

  // The footer: how full it is, and that cakes keep a day
  const f = { x: 18, y: H - footer + 8, w: W - 36, h: footer - 22 };
  panel(ctx, f, { fill: C.card, radius: 22, line: 3, lip: 4 });
  const count = stockCount(save.stock);
  const cap = displayCap(save);
  text(ctx, tr.displaySpaces(count, cap), f.x + 20, f.y + 26, {
    size: 20,
    align: "left",
  });
  const bar = { x: f.x + 150, y: f.y + 18, w: f.w - 170, h: 16 };
  panel(ctx, bar, { fill: "#f6e6dc", radius: 8, line: 2 });
  if (count > 0) {
    ctx.save();
    rr(ctx, bar.x, bar.y, bar.w, bar.h, 8);
    ctx.clip();
    ctx.fillStyle = count >= cap ? C.warn : "#8fcf6a";
    ctx.fillRect(bar.x, bar.y, (bar.w * Math.min(count, cap)) / cap, bar.h);
    ctx.restore();
  }
  wrap(ctx, tr.displayKeep, f.w - 40, 16).forEach((l, i) => {
    text(ctx, l, f.x + 20, f.y + 58 + i * 22, {
      size: 16,
      align: "left",
      fill: C.muted,
    });
  });
  if (!save.stock.length)
    btn(
      app,
      "display-bake",
      { x: f.x + f.w - 150, y: f.y + f.h - 62, w: 136, h: 54 },
      tr.bake,
      () => app.go({ kind: "pick" }),
      { fill: C.green, size: 18 },
    );
}

/** One batch on a shelf: a few of the cakes, and its tag on the glass edge. */
function drawBatch(
  app: App,
  item: StockItem,
  cx: number,
  shelfY: number,
  w: number,
  locale: "vi" | "en",
  /** The glass plank's thickness, so the tag hangs under it. */
  glass: number,
) {
  const { ctx } = app;
  const r = recipe(item.recipe);
  const img = app.sprites.get(r.sprite);
  // One plate per batch, sitting on the glass (the tag says how many)
  const size = Math.min(w - 10, 92);
  sprite(ctx, img, cx, shelfY + 4, size, size * 0.9, "bottom");
  // What one piece sells for (before any discount)
  const price = Math.max(1, Math.round(piecePrice(item, false, false)));
  priceSticker(app, cx - size / 2 + 6, shelfY - size * 0.62, price, 20);
  // The tag
  const tag = { x: cx - w / 2 + 6, y: shelfY + glass + 2, w: w - 12, h: 40 };
  ctx.save();
  rr(ctx, tag.x, tag.y, tag.w, tag.h, 9);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
  text(ctx, r.name[locale], cx, tag.y + 12, { size: 12, maxWidth: tag.w - 8 });
  stars(ctx, cx - 14, tag.y + 29, item.stars, 5);
  text(ctx, `×${item.count}`, cx + 22, tag.y + 29, { size: 14, fill: C.good });
}
