import { type App, H, W, btn, viewRect } from "./app";
import { C, clipboard, cover, heart, panel, sprite, text } from "./art";
import type { RecipeId } from "./config";
import { type DayReport, customer, formatClock, recipe } from "./logic";

// 16:30: the day's books. Money first (what came in, what the night cost),
// then what to learn from it: what ran out, what was binned, who walked off.

export function drawReport(app: App, r: DayReport) {
  const { ctx } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = viewRect(app);
  cover(ctx, app.sprites.get("bg-shop"), v, 0.3);
  ctx.fillStyle = "rgba(246, 231, 205, 0.86)";
  ctx.fillRect(v.x, v.y, v.w, v.h);

  const y0 = Math.max(v.y + 16, 20) + 50;
  const m = { x: 16, y: y0, w: W - 32, h: H - 132 - y0 };
  clipboard(ctx, m, tr.reportTitle(r.day));

  // ---- money
  const money = { x: m.x + 28, y: m.y + 56, w: m.w - 56, h: 0 };
  const rows: [string, number][] = [
    [tr.revenue, r.revenue],
    [tr.tips, r.tips],
    ...(r.boxes ? [[tr.boxes, -r.boxes] as [string, number]] : []),
    [tr.ingredients, -r.ingredients],
  ];
  money.h = 30 + rows.length * 34 + 70;
  panel(ctx, money, {
    fill: C.card,
    stroke: C.cardBorder,
    radius: 22,
    line: 4,
  });
  rows.forEach(([label, value], i) => {
    const y = money.y + 30 + i * 34;
    text(ctx, label, money.x + 20, y, { size: 19, weight: 700, align: "left" });
    text(
      ctx,
      `${value >= 0 ? "+" : "−"}${tr.num(Math.abs(value))}`,
      money.x + money.w - 20,
      y,
      { size: 20, align: "right", fill: value >= 0 ? C.good : C.bad },
    );
  });
  const ly = money.y + 30 + rows.length * 34 - 8;
  ctx.strokeStyle = C.cardBorder;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(money.x + 16, ly);
  ctx.lineTo(money.x + money.w - 16, ly);
  ctx.stroke();
  const gain = r.profit >= 0;
  text(ctx, gain ? tr.profit : tr.loss, money.x + 20, ly + 34, {
    size: 26,
    align: "left",
  });
  text(
    ctx,
    `${gain ? "+" : "−"}${tr.coins(Math.abs(r.profit))}`,
    money.x + money.w - 20,
    ly + 34,
    { size: 30, align: "right", fill: gain ? C.good : C.bad },
  );

  // ---- what happened
  const notes: { text: string; color?: string; icon?: () => void }[] = [];
  notes.push({
    text: `${tr.served(r.served)}${r.walked ? ` · ${tr.walkedOff(r.walked)}` : ""}`,
  });
  if (r.wasted.pieces)
    notes.push({
      text: `${tr.wasted(r.wasted.pieces)} · −${tr.num(r.wasted.cost)}`,
      color: C.bad,
    });
  if (r.spoiled > 0.5)
    notes.push({ text: `${tr.spoiled} · −${tr.num(r.spoiled)}`, color: C.bad });
  if (r.overChange)
    notes.push({ text: tr.overGiven(r.overChange), color: C.warn });
  if (r.vip !== "none")
    notes.push({
      text: tr.vipReport[r.vip],
      color: r.vip === "happy" ? C.good : C.bad,
    });
  if (r.preorders.done || r.preorders.missed)
    notes.push({
      text: tr.preorderReport(r.preorders.done, r.preorders.missed),
      color: r.preorders.missed ? C.bad : C.good,
    });
  if (r.bailout) notes.push({ text: tr.bailout(r.bailout), color: C.warn });
  for (const p of r.tomorrow) {
    notes.push({
      text: tr.preorder(
        customer(p.customer).name[locale],
        p.qty,
        recipe(p.recipe).name[locale].toLowerCase(),
        formatClock(p.at),
      ),
      color: C.text,
    });
  }

  const info = {
    x: m.x + 28,
    y: money.y + money.h + 12,
    w: m.w - 56,
    h: m.y + m.h - money.y - money.h - 40,
  };
  panel(ctx, info, { fill: C.card, stroke: C.cardBorder, radius: 22, line: 4 });
  // Reputation
  heart(ctx, info.x + 30, info.y + 30, 11);
  text(ctx, tr.rep(r.rep.before, r.rep.after), info.x + 50, info.y + 30, {
    size: 19,
    align: "left",
    fill:
      r.rep.after > r.rep.before
        ? C.good
        : r.rep.after < r.rep.before
          ? C.bad
          : C.text,
  });
  let y = info.y + 64;
  for (const n of notes) {
    text(ctx, n.text, info.x + 20, y, {
      size: 17,
      weight: 700,
      align: "left",
      fill: n.color ?? C.text,
      maxWidth: info.w - 36,
    });
    y += 30;
  }
  // What ran out, as pictures
  const sold = Object.entries(r.soldOut).filter(([, n]) => (n ?? 0) > 0) as [
    RecipeId,
    number,
  ][];
  if (sold.length && y < info.y + info.h - 60) {
    text(ctx, tr.soldOutLine, info.x + 20, y, {
      size: 17,
      weight: 700,
      align: "left",
      fill: C.warn,
    });
    y += 34;
    sold.slice(0, 6).forEach(([id, n], i) => {
      const x = info.x + 44 + i * 76;
      sprite(ctx, app.sprites.get(recipe(id).sprite), x, y, 44, 40);
      text(ctx, `×${n}`, x + 26, y + 14, { size: 16, outline: C.white });
    });
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
