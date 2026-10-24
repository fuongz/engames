import { type App, H, W, btn, hud, viewRect } from "./app";
import {
  C,
  bar,
  card,
  clockIcon,
  cover,
  dot,
  panel,
  sprite,
  stars,
  text,
  weatherIcon,
  wrap,
} from "./art";
import { INGREDIENTS, MARKET_TRIP, PREP_BUDGET, RECIPES } from "./config";
import {
  canBake,
  clockAt,
  customer,
  dayInfo,
  displayCap,
  formatClock,
  pantryQty,
  recipe,
  stockCount,
  timeLeft,
} from "./logic";
import { openShop } from "./shop";

// The kitchen at night: tomorrow's forecast, the hours left, what is on the
// display, and the way to the market, the recipe book, the oven and the door.

export function drawHub(app: App) {
  const { ctx, save } = app;
  const tr = app.tr();
  const v = viewRect(app);
  cover(ctx, app.sprites.get("bg-kitchen"), v, 0.45);
  const y0 = hud(app, formatClock(clockAt(save.prepUsed)));

  // ---- tomorrow
  const info = dayInfo(save);
  const locale = app.rt.locale();
  const lines: { text: string; color: string }[] = [
    {
      text: `${tr.weekdays[info.weekday]} · ${tr.weather[info.weather]}`,
      color: C.text,
    },
    { text: tr.crowd(info.customers), color: C.text },
  ];
  if (info.trend)
    lines.push({
      text: tr.trend(recipe(info.trend).name[locale]),
      color: C.text,
    });
  if (info.vip) lines.push({ text: tr.vipRumour, color: C.warn });
  for (const p of save.preorders) {
    const cake = recipe(p.recipe).name[locale].toLowerCase();
    lines.push({
      text: tr.preorder(
        customer(p.customer).name[locale],
        p.qty,
        cake,
        formatClock(p.at),
      ),
      color: C.good,
    });
  }
  const wrapped = lines.flatMap((l) =>
    wrap(ctx, l.text, W - 110, 19).map((t) => ({ text: t, color: l.color })),
  );
  const fc = { x: 18, y: y0 + 4, w: W - 36, h: 58 + wrapped.length * 27 };
  panel(ctx, fc, { fill: C.card, stroke: C.cardBorder, radius: 24, line: 5 });
  text(ctx, tr.forecast(save.day), fc.x + 22, fc.y + 30, {
    size: 25,
    align: "left",
    maxWidth: fc.w - 110,
  });
  weatherIcon(ctx, fc.x + fc.w - 46, fc.y + 40, info.weather, 22);
  wrapped.forEach((l, i) => {
    text(ctx, l.text, fc.x + 22, fc.y + 64 + i * 27, {
      size: 19,
      weight: 700,
      align: "left",
      fill: l.color,
    });
  });

  // ---- hours left tonight
  const left = timeLeft(save);
  const wy = fc.y + fc.h + 12;
  panel(
    ctx,
    { x: 18, y: wy, w: W - 36, h: 48 },
    { fill: C.cream, radius: 24, line: 3.5 },
  );
  clockIcon(ctx, 46, wy + 24, 15, clockAt(save.prepUsed));
  text(ctx, tr.workLeft(left), 72, wy + 24, { size: 19, align: "left" });
  bar(
    ctx,
    { x: W - 190, y: wy + 15, w: 150, h: 18 },
    left / PREP_BUDGET,
    left < 60 ? C.warn : "#9fd7a0",
  );

  // ---- the worktop (decoration)
  const worktop = v.y + v.h * 0.53;
  const bob = Math.sin(app.time * 2) * 2;
  sprite(
    ctx,
    app.sprites.get("tool-bowl"),
    104,
    worktop + 10,
    140,
    110,
    "bottom",
  );
  sprite(
    ctx,
    app.sprites.get("tool-scale"),
    232,
    worktop + 6,
    100,
    100,
    "bottom",
  );
  sprite(
    ctx,
    app.sprites.get("tool-oven"),
    418,
    worktop + 14,
    190,
    180,
    "bottom",
  );
  if (save.recipes.length && stockCount(save.stock) > 0) {
    const top = save.stock[0];
    sprite(
      ctx,
      app.sprites.get(recipe(top.recipe).sprite),
      104,
      worktop - 50 + bob,
      70,
      70,
    );
  }

  // ---- the display
  const dy = H - 330;
  const dp = { x: 18, y: dy, w: W - 36, h: 112 };
  panel(ctx, dp, {
    fill: "rgba(255, 248, 235, 0.95)",
    stroke: C.cardBorder,
    radius: 22,
    line: 4,
  });
  const count = stockCount(save.stock);
  text(ctx, tr.display(count, displayCap(save)), dp.x + 18, dp.y + 22, {
    size: 18,
    align: "left",
  });
  if (!save.stock.length) {
    text(ctx, tr.emptyDisplay, dp.x + dp.w / 2, dp.y + 68, {
      size: 18,
      weight: 700,
      fill: C.muted,
    });
  } else {
    const groups = save.stock.slice(0, 7);
    const gw = (dp.w - 20) / 7;
    groups.forEach((g, i) => {
      const cx = dp.x + 10 + gw * i + gw / 2;
      sprite(
        ctx,
        app.sprites.get(recipe(g.recipe).sprite),
        cx,
        dp.y + 60,
        46,
        40,
      );
      stars(ctx, cx, dp.y + 88, g.stars, 6);
      text(ctx, `×${g.count}`, cx + 18, dp.y + 44, { size: 15, fill: C.text });
    });
  }

  // ---- a hint for what to do next
  const hint = nextHint(app);
  if (hint) {
    const lines2 = wrap(ctx, hint, W - 90, 18);
    const hh = 18 + lines2.length * 24;
    const hy = dy - hh - 12;
    panel(
      ctx,
      { x: 30, y: hy, w: W - 60, h: hh },
      { fill: C.white, radius: 18, line: 3 },
    );
    lines2.forEach((l, i) => {
      text(ctx, l, W / 2, hy + 21 + i * 24, { size: 18, weight: 700 });
    });
  }

  // ---- where to go
  const ty = H - 206;
  const tw = (W - 36 - 20) / 3;
  const affordable = RECIPES.some(
    (r) => !save.recipes.includes(r.id) && r.cost <= save.coins,
  );
  const tiles: {
    key: string;
    label: string;
    img: string;
    go: () => void;
    badge?: boolean;
  }[] = [
    {
      key: "market",
      label: tr.market,
      img: "ing-strawberry",
      go: () => app.go({ kind: "market", cart: {} }),
    },
    {
      key: "book",
      label: tr.book,
      img: "cake-shortcake",
      go: () => app.go({ kind: "book", tab: 0, detail: null }),
      badge: affordable,
    },
    {
      key: "bake",
      label: tr.bake,
      img: "tool-bowl",
      go: () => app.go({ kind: "pick" }),
    },
  ];
  tiles.forEach((t, i) => {
    const r = { x: 18 + i * (tw + 10), y: ty, w: tw, h: 112 };
    const pressed = app.ui.isPressed(t.key);
    const tile = card(ctx, r, "pink", pressed);
    sprite(
      ctx,
      app.sprites.get(t.img),
      tile.x + tile.w / 2,
      tile.y + 34 + (pressed ? 2 : 0),
      tile.w - 40,
      52,
    );
    text(ctx, t.label, r.x + r.w / 2, r.y + r.h - 22 + (pressed ? 2 : 0), {
      size: 19,
      maxWidth: r.w - 16,
    });
    if (t.badge) dot(ctx, r.x + r.w - 8, r.y + 8);
    app.ui.add({
      rect: r,
      key: t.key,
      tap: () => {
        app.sfx.tap();
        t.go();
      },
    });
  });

  const pulse =
    left < Math.min(MARKET_TRIP, 37) || nextHint(app) === tr.hintOpen;
  const cy = H - 82;
  btn(
    app,
    "open",
    { x: 18, y: cy, w: W - 36, h: 70 },
    `${tr.open}  ▶`,
    () => openShop(app),
    {
      fill: pulse && Math.sin(app.time * 5) > 0 ? "#c9f0a6" : C.green,
      size: 28,
    },
  );
}

/** The next sensible thing to do tonight, for players finding their feet. */
function nextHint(app: App) {
  const tr = app.tr();
  const s = app.save;
  if (timeLeft(s) < 30) return tr.hintTimeUp;
  if (stockCount(s.stock) > 0) return s.day <= 2 ? tr.hintOpen : null;
  const anyIngredients = INGREDIENTS.some((i) => pantryQty(s, i.id) > 0);
  if (!anyIngredients) return tr.hintMarket;
  return s.recipes.some((id) => canBake(s, id) === null)
    ? tr.hintBake
    : tr.hintMarket;
}
