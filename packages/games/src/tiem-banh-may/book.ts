import {
  type App,
  H,
  W,
  btn,
  close,
  icon,
  priceLabel,
  shade,
  sheet,
} from "./app";
import { hud } from "./hud";
import {
  C,
  FONT,
  button,
  card,
  coin,
  dialog,
  framed,
  pageArrow,
  panel,
  paperHeading,
  sprite,
  stars,
  text,
  wrap,
} from "./art";
import {
  FAST_STARS,
  MASTERY_BAKES,
  RECIPES,
  type RecipeId,
  UPGRADES,
} from "./config";
import {
  batchMinutes,
  buyRecipe,
  buyUpgrade,
  canBake,
  clockAt,
  fastBake,
  formatClock,
  has,
  ingredient,
  mastered,
  missing,
  needs,
  pantryQty,
  piecePrice,
  recipe,
} from "./logic";
import type { IngredientId, Step } from "./config";
import { startBake } from "./kitchen";
import { dialogButtons, K } from "./kit";

// The recipe book: a dialog menu with pages (recipes, then upgrades) turned
// with the side arrows; cream cards are for sale, mint sunburst ones are owned.
// Also a recipe's card, and the "what shall I bake" sheet.

export function drawBook(app: App, tab: 0 | 1, detail: RecipeId | null) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = app.rt.stage.view;
  ctx.fillStyle = C.page;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  const y0 = hud(app, formatClock(clockAt(save.night)));
  const board = { x: 14, y: y0 + 58, w: W - 28, h: H - 28 - y0 - 58 };
  const paper = dialog(ctx, board, tr.book);
  const top = paperHeading(
    ctx,
    paper,
    tab === 0 ? tr.recipesTab : tr.upgradesTab,
    `${tab + 1}/2`,
  );
  close(app, board, () => app.go({ kind: "hub" }));
  // Page arrows on the board's edges
  ([-1, 1] as const).forEach((dir) => {
    const to = tab + dir;
    const cx = dir < 0 ? board.x + 4 : board.x + board.w - 4;
    const cy = paper.y + paper.h / 2;
    const key = `page${dir}`;
    pageArrow(ctx, cx, cy, dir, app.ui.isPressed(key), to < 0 || to > 1);
    if (to < 0 || to > 1) return;
    app.ui.add({
      rect: { x: cx - 30, y: cy - 44, w: 60, h: 88 },
      key,
      tap: () => {
        app.sfx.tap();
        app.go({ kind: "book", tab: to as 0 | 1, detail: null });
      },
    });
  });
  const inner = {
    x: paper.x + 24,
    y: top,
    w: paper.w - 48,
    h: paper.y + paper.h - 40 - top,
  };
  if (tab === 0) {
    const cols = 2;
    const gap = 12;
    const cw = (inner.w - gap * (cols - 1)) / cols;
    const ch = (inner.h - gap * 2) / 3;
    RECIPES.forEach((r, i) => {
      const rect = {
        x: inner.x + (i % cols) * (cw + gap),
        y: inner.y + Math.floor(i / cols) * (ch + gap),
        w: cw,
        h: ch,
      };
      const owned = save.recipes.includes(r.id);
      const key = `rc-${r.id}`;
      const pressed = app.ui.isPressed(key);
      const tile = card(ctx, rect, owned ? "owned" : "pink", pressed, ch - 76);
      sprite(
        ctx,
        app.sprites.get(r.sprite),
        tile.x + tile.w / 2,
        tile.y + tile.h / 2,
        tile.w - 20,
        tile.h - 16,
      );
      text(ctx, r.name[locale], rect.x + rect.w / 2, tile.y + tile.h + 13, {
        size: 16,
        maxWidth: rect.w - 10,
      });
      const pill = {
        x: rect.x + 30,
        y: rect.y + rect.h - 40,
        w: rect.w - 60,
        h: 34,
      };
      panel(ctx, pill, { fill: C.cream, radius: 19, line: 3.5 });
      if (owned) {
        if (mastered(save, r.id))
          text(ctx, tr.mastered, pill.x + pill.w / 2, pill.y + 19, {
            size: 16,
            maxWidth: pill.w - 10,
          });
        else
          stars(
            ctx,
            pill.x + pill.w / 2,
            pill.y + 19,
            Math.min(3, save.mastery[r.id] ?? 0),
            8,
          );
      } else {
        coin(ctx, pill.x + 22, pill.y + 19, 13);
        text(ctx, tr.num(r.cost), pill.x + pill.w / 2 + 12, pill.y + 19, {
          size: 20,
          fill: r.cost > save.coins ? C.bad : C.text,
        });
      }
      app.ui.add({
        rect,
        key,
        tap: () => {
          app.sfx.tap();
          app.go({ kind: "book", tab, detail: r.id });
        },
      });
    });
  } else {
    const gap = 12;
    const cw = (inner.w - gap) / 2;
    const ch = (inner.h - gap) / 2;
    UPGRADES.forEach((u, i) => {
      const rect = {
        x: inner.x + (i % 2) * (cw + gap),
        y: inner.y + Math.floor(i / 2) * (ch + gap),
        w: cw,
        h: ch,
      };
      const owned = has(save, u.id);
      const tile = card(ctx, rect, owned ? "owned" : "pink", false, ch - 142);
      sprite(
        ctx,
        app.sprites.get(u.sprite),
        tile.x + tile.w / 2,
        tile.y + tile.h / 2,
        tile.w - 40,
        tile.h - 16,
      );
      text(ctx, u.name[locale], rect.x + rect.w / 2, tile.y + tile.h + 18, {
        size: 19,
        maxWidth: rect.w - 16,
      });
      wrap(ctx, tr.upgradeInfo[u.id], rect.w - 24, 14)
        .slice(0, 2)
        .forEach((l, k) => {
          text(ctx, l, rect.x + rect.w / 2, tile.y + tile.h + 42 + k * 18, {
            size: 14,
            weight: 700,
            fill: C.muted,
          });
        });
      const pr = {
        x: rect.x + 14,
        y: rect.y + rect.h - 54,
        w: rect.w - 28,
        h: 48,
      };
      if (owned) {
        panel(
          ctx,
          { ...pr, h: pr.h - 5 },
          { fill: C.cream, radius: 20, line: 3.5 },
        );
        text(ctx, tr.owned, pr.x + pr.w / 2, pr.y + 21, { size: 18 });
      } else {
        const key = `up-${u.id}`;
        const short = u.cost > save.coins;
        btn(
          app,
          key,
          pr,
          "",
          () => {
            const res = buyUpgrade(save, u.id);
            if (!res.ok) return;
            app.sfx.coin();
            app.commit(res.save, { now: true });
            app.toast(tr.bought, rect.x + rect.w / 2, rect.y + 40, C.good);
          },
          {
            disabled: short,
            onDisabled: () =>
              app.toast(tr.noCoins, rect.x + rect.w / 2, pr.y - 10, C.bad),
          },
        );
        priceLabel(app, pr, tr.num(u.cost), 20, {
          pressed: app.ui.isPressed(key),
          disabled: short,
        });
      }
    });
  }
  if (detail) drawRecipeCard(app, detail, tab);
}

function drawRecipeCard(app: App, id: RecipeId, tab: 0 | 1) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const r = recipe(id);
  const back = () => app.go({ kind: "book", tab, detail: null });
  shade(app, back);
  // Pictures first, words last: the name is the title, everything else is
  // icons with a number. Blocks: the dish and its numbers, the ingredients,
  // the steps as a strip of pictures, then the button.
  const list = Object.entries(needs(r)) as [IngredientId, number][];
  const ingCols = 4;
  const ingRows = Math.ceil(list.length / ingCols);
  const stepCols = 5;
  const stepRows = Math.ceil(r.steps.length / stepCols);
  const heroH = 150;
  const ingH = 34 + ingRows * 74;
  const stepH = 34 + stepRows * 86;
  const h = 44 + heroH + 10 + ingH + 10 + stepH + 24 + K.button + K.inset + 24;
  const m = { x: 20, y: Math.max(56, (H - h) / 2), w: W - 40, h };
  const paper = sheet(app, m, r.name[locale]);
  // The X sits a little in from the corner so it stays on screen
  close(app, { ...m, w: m.w - 16, y: m.y + 4 }, back);
  const x = paper.x;
  const w = paper.w;
  let y = paper.y;

  // ---- the dish and its numbers
  const hero = { x, y, w, h: heroH };
  panel(ctx, hero, { fill: "#fdf1d4", radius: 20, line: 2.5 });
  const splash = app.sprites.get("splash");
  if (splash?.naturalWidth)
    sprite(ctx, splash, hero.x + 90, hero.y + hero.h / 2, 170, 140);
  sprite(
    ctx,
    app.sprites.get(r.sprite),
    hero.x + 90,
    hero.y + hero.h / 2,
    128,
    118,
  );
  const price = Math.max(
    1,
    Math.round(piecePrice({ recipe: id, stars: 3, cost: 0 }, false, false)),
  );
  const facts: {
    icon: string;
    value: string;
    draw?: (cx: number, cy: number) => void;
  }[] = [
    { icon: "timer", value: `${batchMinutes(save, r)}'` },
    { icon: "pieces", value: `×${r.yield}` },
    { icon: "tag", value: `${price}` },
    {
      icon: "",
      value: `${price * r.yield}`,
      draw: (cx, cy) => coin(ctx, cx, cy, 13),
    },
  ];
  const fx = hero.x + 190;
  const fw = (hero.x + hero.w - 12 - fx) / 2;
  facts.forEach((f, i) => {
    const cx = fx + (i % 2) * fw;
    const cy = hero.y + 34 + Math.floor(i / 2) * 44;
    if (f.draw) f.draw(cx + 14, cy);
    else icon(app, f.icon, cx + 14, cy, 30, () => undefined);
    text(ctx, f.value, cx + 36, cy + 1, { size: 21, align: "left" });
  });
  // Mastery: a chef's hat and one dot per batch towards it
  const owned = save.recipes.includes(id);
  const done = Math.min(MASTERY_BAKES, save.mastery[id] ?? 0);
  const my = hero.y + hero.h - 28;
  icon(app, "chef", fx + 14, my, 30, () => undefined);
  for (let i = 0; i < MASTERY_BAKES; i++) {
    ctx.beginPath();
    ctx.arc(fx + 44 + i * 22, my, 7, 0, Math.PI * 2);
    ctx.fillStyle = i < done ? C.good : "#efe3d3";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
  if (!owned)
    icon(app, "lock", hero.x + hero.w - 26, hero.y + 24, 30, () => undefined);
  y += heroH + 10;

  // ---- ingredients: picture and amount, green when the pantry has it
  y = blockTitle(app, x, y, w, tr.ingredientsTitle);
  const iw = w / ingCols;
  list.forEach(([ing, amount], i) => {
    const cx = x + iw * ((i % ingCols) + 0.5);
    const cy = y + Math.floor(i / ingCols) * 74;
    const def = ingredient(ing);
    const enough = pantryQty(save, ing) >= amount;
    panel(
      ctx,
      { x: cx - iw / 2 + 4, y: cy, w: iw - 8, h: 66 },
      {
        fill: enough ? "#eef8e8" : "#fdeeea",
        radius: 14,
        line: 2,
      },
    );
    sprite(ctx, app.sprites.get(def.sprite), cx, cy + 24, 40, 36);
    text(
      ctx,
      tr.amount(amount, def.unit, def.measure === "spoon"),
      cx,
      cy + 54,
      {
        size: 13,
        fill: enough ? C.good : C.bad,
        maxWidth: iw - 14,
      },
    );
  });
  y += ingRows * 74 + 10;

  // ---- the steps, as pictures
  y = blockTitle(app, x, y, w, tr.stepsTitle);
  const sw = w / stepCols;
  r.steps.forEach((step, i) => {
    const cx = x + sw * ((i % stepCols) + 0.5);
    const top = y + Math.floor(i / stepCols) * 86;
    stepTile(app, step, i, cx, top, sw - 8);
  });

  // ---- the button
  const br = {
    x: m.x + 22 + K.inset,
    y: m.y + m.h - 24 - K.inset - K.button,
    w: m.w - (22 + K.inset) * 2,
    h: K.button,
  };
  if (owned) {
    btn(app, "detail-bake", br, tr.bake, () => app.go({ kind: "pick" }), {
      fill: C.green,
      size: 24,
    });
  } else {
    btn(
      app,
      "detail-buy",
      br,
      "",
      () => {
        const res = buyRecipe(save, id);
        if (!res.ok) return;
        app.sfx.coin();
        app.commit(res.save, { now: true });
        app.go({ kind: "learned", recipe: id, tab, at: app.time });
      },
      {
        size: 26,
        disabled: r.cost > save.coins,
        onDisabled: () => app.toast(tr.noCoins, W / 2, br.y - 16, C.bad),
      },
    );
    priceLabel(app, br, tr.num(r.cost), 26, {
      pressed: app.ui.isPressed("detail-buy"),
      disabled: r.cost > save.coins,
    });
  }
}

/** A small heading pill over a block; returns the y under it. */
function blockTitle(app: App, x: number, y: number, w: number, label: string) {
  const { ctx } = app;
  ctx.font = `700 15px ${FONT}`;
  const tw = ctx.measureText(label).width + 28;
  panel(
    ctx,
    { x: x + (w - tw) / 2, y, w: tw, h: 26 },
    {
      fill: "#e9d9c4",
      radius: 13,
      line: 2,
    },
  );
  text(ctx, label, x + w / 2, y + 13, { size: 15 });
  return y + 34;
}

/** One step as a picture: what it uses, a number, and its one figure. */
function stepTile(
  app: App,
  step: Step,
  i: number,
  cx: number,
  top: number,
  w: number,
) {
  const { ctx } = app;
  const tr = app.tr();
  const tile = { x: cx - w / 2, y: top, w, h: 78 };
  panel(ctx, tile, { fill: C.white, radius: 14, line: 2 });
  let art = "";
  let caption = "";
  switch (step.kind) {
    case "add": {
      const d = ingredient(step.ing);
      art = d.sprite;
      caption = tr.amount(step.amount, d.unit, d.measure === "spoon");
      break;
    }
    case "mix":
      art = "tool-whisk";
      caption = `×${step.turns}`;
      break;
    case "stove":
      art = step.mode === "fry" ? "raw-donut" : "tool-saucepan";
      break;
    case "wait":
      art = step.mode === "proof" ? "dough-proofed" : "sponge-cooling";
      caption = `${step.minutes}'`;
      break;
    case "oven":
      art = "tool-oven";
      caption = `${step.temp}° ${step.minutes}'`;
      break;
    case "pipe":
      art = "tool-piping-bag";
      break;
  }
  sprite(
    ctx,
    app.sprites.get(art),
    cx,
    tile.y + (caption ? 32 : 40),
    w - 22,
    caption ? 42 : 52,
  );
  if (caption)
    text(ctx, caption, cx, tile.y + 64, { size: 12, maxWidth: w - 8 });
  // The step's number, top left
  ctx.beginPath();
  ctx.arc(tile.x + 11, tile.y + 11, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#f6c56b";
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  text(ctx, `${i + 1}`, tile.x + 11, tile.y + 11, { size: 11 });
}

/** "What shall I bake?" over the kitchen: every owned recipe, and why one can't be made now. */
export function drawPicker(app: App) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  shade(app, () => app.go({ kind: "hub" }));
  const owned = RECIPES.filter((r) => save.recipes.includes(r.id));
  const rowH = 100;
  const h = 96 + owned.length * (rowH + 8) + 90;
  const m = {
    x: 16,
    y: Math.max(app.rt.stage.view.y + 70, (H - h) / 2),
    w: W - 32,
    h,
  };
  sheet(app, m, tr.bake);
  owned.forEach((r, i) => {
    const row = {
      x: m.x + 14,
      y: m.y + 76 + i * (rowH + 8),
      w: m.w - 28,
      h: rowH,
    };
    framed(ctx, row, C.card, 20);
    sprite(
      ctx,
      app.sprites.get(r.sprite),
      row.x + 50,
      row.y + rowH / 2,
      74,
      74,
    );
    text(ctx, r.name[locale], row.x + 100, row.y + 26, {
      size: 19,
      align: "left",
      maxWidth: 190,
    });
    const why = canBake(save, r.id);
    let line = `${tr.makes(r.yield)}, ${tr.minutes(batchMinutes(save, r))}`;
    let color: string = C.muted;
    if (why === "ingredients") {
      const miss = missing(save, r)[0];
      line = tr.missing(ingredient(miss.ing).name[locale]);
      color = C.bad;
    } else if (why === "display") {
      line = tr.displayFull;
      color = C.bad;
    } else if (why === "time") {
      line = tr.needTime;
      color = C.bad;
    } else if (why === "tired") {
      line = tr.tired;
      color = C.bad;
    }
    text(ctx, line, row.x + 100, row.y + 54, {
      size: 15,
      weight: 700,
      align: "left",
      fill: color,
      maxWidth: 200,
    });
    stars(
      ctx,
      row.x + 124,
      row.y + 80,
      Math.min(3, save.mastery[r.id] ?? 0),
      7,
    );
    const fast = mastered(save, r.id);
    const bw = fast ? 100 : 120;
    const make = {
      x: row.x + row.w - bw - 12,
      y: row.y + (fast ? 8 : 22),
      w: bw,
      h: fast ? 46 : 56,
    };
    btn(app, `make-${r.id}`, make, tr.make, () => startBake(app, r.id), {
      fill: C.green,
      size: 20,
      disabled: why !== null,
      onDisabled: () => app.toast(line, row.x + row.w / 2, row.y, C.bad),
    });
    if (fast) {
      const quick = { x: make.x - 8, y: row.y + 54, w: bw + 8, h: 42 };
      button(ctx, quick, tr.makeFast.replace(`${FAST_STARS}★`, "").trim(), {
        size: 14,
        pressed: app.ui.isPressed(`fast-${r.id}`),
        disabled: why !== null,
      });
      app.ui.add({
        rect: quick,
        key: `fast-${r.id}`,
        tap: () => {
          const res = fastBake(save, r.id);
          if (!res.ok) return app.sfx.bad();
          app.sfx.good();
          app.commit(res.save);
          app.toast(tr.baked(r.yield, r.name[locale]), W / 2, row.y, C.good);
        },
      });
    }
  });
  dialogButtons(app, m, [
    {
      key: "pick-close",
      label: tr.close,
      onTap: () => app.go({ kind: "hub" }),
    },
  ]);
}
