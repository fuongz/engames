import { type App, H, W, btn, icon, viewRect } from "./app";
import { coin, C, cover, dialog, heart, panel, sprite, text } from "./art";
import { pick, shopBackdrop } from "./bakeart";
import type { RecipeId } from "./config";
import { statTile } from "./kit";
import { type DayReport, customer, formatClock, recipe } from "./logic";

// 16:30: the day's books, as pictures with a word each. The result first, big;
// then where the money came from and went; then how the day went; then the
// few things worth a sentence (the critic, pre-orders, a loan, tomorrow).

export function drawReport(app: App, r: DayReport) {
  const { ctx } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = viewRect(app);
  cover(
    ctx,
    pick(app.sprites, shopBackdrop(r.weather, true), "bg-shop"),
    v,
    0.3,
  );
  ctx.fillStyle = "rgba(246, 231, 205, 0.86)";
  ctx.fillRect(v.x, v.y, v.w, v.h);

  // As tall as what it holds: the result, two rows of tiles, what ran out,
  // and a line per note
  const soldCount = Object.values(r.soldOut).filter((n) => (n ?? 0) > 0).length;
  const noteCount =
    (r.vip !== "none" ? 1 : 0) +
    (r.preorders.done || r.preorders.missed ? 1 : 0) +
    (r.overChange ? 1 : 0) +
    (r.bailout ? 1 : 0) +
    (r.charmCustomers > 0 ? 1 : 0) +
    r.tomorrow.length;
  const content = 4 + 94 + 106 * 2 + (soldCount ? 84 : 0) + noteCount * 34 + 8;
  const y0 = Math.max(v.y + 16, 20) + 50;
  const room = H - 132 - y0;
  const h = Math.min(room, content + 72);
  const m = { x: 16, y: y0 + (room - h) / 2, w: W - 32, h };
  const paper = dialog(ctx, m, tr.reportTitle(r.day));
  let y = paper.y + 4;

  // ---- the result
  const gain = r.profit >= 0;
  const hero = { x: paper.x, y, w: paper.w, h: 84 };
  panel(ctx, hero, {
    fill: gain ? "#eaf7e1" : "#fdeeea",
    radius: 20,
    line: 2.5,
  });
  coin(ctx, hero.x + 50, hero.y + hero.h / 2, 26);
  text(ctx, gain ? tr.profit : tr.loss, hero.x + 92, hero.y + 26, {
    size: 16,
    align: "left",
    fill: C.muted,
  });
  text(
    ctx,
    `${gain ? "+" : "−"}${tr.coins(Math.abs(r.profit))}`,
    hero.x + 92,
    hero.y + 56,
    { size: 32, align: "left", fill: gain ? C.good : C.bad },
  );
  y += hero.h + 10;

  // ---- money in and out
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${tr.num(Math.abs(n))}`;
  const money: Parameters<typeof statTile>[2][] = [
    {
      picture: "cake-cupcake",
      label: tr.tile.revenue,
      value: signed(r.revenue),
      color: C.good,
    },
    {
      picture: "heart",
      label: tr.tile.tips,
      value: signed(r.tips),
      color: r.tips ? C.good : C.muted,
    },
    ...(r.boxes
      ? [
          {
            picture: "cake-box",
            label: tr.tile.boxes,
            value: signed(-r.boxes),
            color: C.bad,
          },
        ]
      : []),
    {
      picture: "basket",
      label: tr.tile.ingredients,
      value: signed(-r.ingredients),
      color: r.ingredients ? C.bad : C.muted,
    },
  ];
  y = tileRow(app, paper.x, y, paper.w, money);

  // ---- how the day went
  const repDelta = r.rep.after - r.rep.before;
  const day: Parameters<typeof statTile>[2][] = [
    {
      picture: "heart",
      label: tr.tile.rep,
      value: `${r.rep.before}→${r.rep.after}`,
      color: repDelta > 0 ? C.good : repDelta < 0 ? C.bad : C.text,
    },
    { picture: "customer-bear", label: tr.tile.served, value: `${r.served}` },
  ];
  if (r.walked)
    day.push({
      picture: "customer-bunny",
      label: tr.tile.walked,
      value: `${r.walked}`,
      color: C.bad,
      faded: true,
    });
  if (r.wasted.pieces)
    day.push({
      picture: "fail-flat",
      label: tr.tile.wasted,
      value: `${r.wasted.pieces}`,
      color: C.bad,
    });
  else if (r.spoiled > 0.5)
    day.push({
      picture: "fail-raw",
      label: tr.tile.spoiled,
      value: signed(-r.spoiled),
      color: C.bad,
    });
  y = tileRow(app, paper.x, y, paper.w, day);

  // ---- what ran out: the cakes people asked for
  const sold = Object.entries(r.soldOut).filter(([, n]) => (n ?? 0) > 0) as [
    RecipeId,
    number,
  ][];
  if (sold.length) {
    text(ctx, tr.soldOutLine, paper.x + 8, y + 12, {
      size: 15,
      align: "left",
      fill: C.warn,
    });
    sold.slice(0, 6).forEach(([id, n], i) => {
      const x = paper.x + 34 + i * 72;
      sprite(ctx, app.sprites.get(recipe(id).sprite), x, y + 48, 50, 44);
      text(ctx, `×${n}`, x + 24, y + 62, { size: 15, outline: C.white });
    });
    y += 84;
  }

  // ---- the few things that need a sentence, each with its picture
  const notes: { picture: string; text: string; color?: string }[] = [];
  if (r.vip !== "none")
    notes.push({
      picture: "customer-owl-critic",
      text: tr.vipReport[r.vip],
      color: r.vip === "happy" ? C.good : C.bad,
    });
  if (r.preorders.done || r.preorders.missed)
    notes.push({
      picture: "cake-box",
      text: tr.preorderReport(r.preorders.done, r.preorders.missed),
      color: r.preorders.missed ? C.bad : C.good,
    });
  if (r.overChange)
    notes.push({
      picture: "tag",
      text: tr.overGiven(r.overChange),
      color: C.warn,
    });
  if (r.charmCustomers > 0)
    notes.push({
      picture: "heart",
      text: tr.charmReport(r.charm, r.charmCustomers),
      color: C.good,
    });
  if (r.bailout)
    notes.push({
      picture: "heart",
      text: tr.bailout(r.bailout),
      color: C.warn,
    });
  for (const p of r.tomorrow) {
    const c = customer(p.customer);
    notes.push({
      picture: c.sprite,
      text: tr.preorder(
        c.name[locale],
        p.qty,
        recipe(p.recipe).name[locale].toLowerCase(),
        formatClock(p.at),
      ),
    });
  }
  const bottom = paper.y + paper.h - 8;
  for (const n of notes) {
    if (y + 34 > bottom) break;
    icon(app, n.picture, paper.x + 22, y + 16, 30, () =>
      heart(ctx, paper.x + 22, y + 16, 10),
    );
    text(ctx, n.text, paper.x + 46, y + 17, {
      size: 15,
      align: "left",
      fill: n.color ?? C.text,
      maxWidth: paper.w - 54,
    });
    y += 34;
  }

  btn(
    app,
    "next-day",
    { x: 30, y: H - 112, w: W - 60, h: 86 },
    tr.nextDay,
    () => app.go({ kind: "hub" }),
    { fill: C.green, size: 28 },
  );
}

/** A row of equal tiles across `w`; returns the y under it. */
function tileRow(
  app: App,
  x: number,
  y: number,
  w: number,
  tiles: Parameters<typeof statTile>[2][],
) {
  const gap = 8;
  const tw = (w - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach((t, i) => {
    statTile(app, { x: x + i * (tw + gap), y, w: tw, h: 96 }, t);
  });
  return y + 96 + 10;
}
