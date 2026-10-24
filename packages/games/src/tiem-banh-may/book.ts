import {
  type App,
  H,
  W,
  btn,
  close,
  hud,
  priceLabel,
  shade,
  sheet,
} from "./app";
import {
  C,
  button,
  card,
  coin,
  panel,
  sprite,
  stars,
  clipboard,
  pageArrow,
  paperHeading,
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
  recipe,
} from "./logic";
import type { IngredientId } from "./config";
import { startBake } from "./kitchen";

// The recipe book: a clipboard menu with pages (recipes, then upgrades) turned
// with the side arrows; cream cards are for sale, mint sunburst ones are owned.
// Also a recipe's card, and the "what shall I bake" sheet.

export function drawBook(app: App, tab: 0 | 1, detail: RecipeId | null) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = app.rt.stage.view;
  ctx.fillStyle = C.page;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  const y0 = hud(app, formatClock(clockAt(save.prepUsed)));
  const board = { x: 14, y: y0 + 46, w: W - 28, h: H - 28 - y0 - 46 };
  const paper = clipboard(ctx, board, tr.book);
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
  const close = () => app.go({ kind: "book", tab, detail: null });
  shade(app, close);
  const m = { x: 24, y: 120, w: W - 48, h: 720 };
  sheet(app, m, r.name[locale]);
  const body = { x: m.x + 18, y: m.y + 70, w: m.w - 36, h: m.h - 170 };
  panel(ctx, body, { fill: C.card, stroke: C.cardBorder, radius: 22, line: 4 });
  sprite(ctx, app.sprites.get(r.sprite), body.x + 80, body.y + 80, 120, 120);
  text(ctx, tr.yieldLine(r.yield, r.base), body.x + 160, body.y + 46, {
    size: 18,
    align: "left",
    maxWidth: body.w - 170,
  });
  text(ctx, tr.timeLine(batchMinutes(save, r)), body.x + 160, body.y + 76, {
    size: 18,
    align: "left",
    maxWidth: body.w - 170,
  });
  const owned = save.recipes.includes(id);
  if (owned) {
    const n = save.mastery[id] ?? 0;
    text(
      ctx,
      n >= MASTERY_BAKES ? tr.mastered : tr.mastery(n, MASTERY_BAKES),
      body.x + 160,
      body.y + 106,
      {
        size: 17,
        align: "left",
        fill: n >= MASTERY_BAKES ? C.good : C.muted,
        maxWidth: body.w - 170,
      },
    );
  }
  // Ingredients, two columns
  const list = Object.entries(needs(r)) as [IngredientId, number][];
  list.forEach(([ing, amount], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = body.x + 20 + col * (body.w / 2);
    const y = body.y + 170 + row * 56;
    const def = ingredient(ing);
    sprite(ctx, app.sprites.get(def.sprite), x + 22, y, 44, 44);
    text(ctx, def.name[locale], x + 52, y - 10, {
      size: 16,
      align: "left",
      maxWidth: body.w / 2 - 60,
    });
    text(
      ctx,
      tr.amount(amount, def.unit, def.measure === "spoon"),
      x + 52,
      y + 12,
      { size: 15, weight: 700, align: "left", fill: C.muted },
    );
  });
  const steps = r.steps.length;
  text(
    ctx,
    `${steps} ${locale === "vi" ? "bước" : "steps"}`,
    body.x + body.w / 2,
    body.y + body.h - 24,
    { size: 16, weight: 700, fill: C.muted },
  );

  const br = { x: m.x + 24, y: m.y + m.h - 88, w: m.w - 48, h: 70 };
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
        app.toast(tr.bought, W / 2, m.y + 160, C.good, 30);
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
    panel(ctx, row, {
      fill: C.card,
      stroke: C.cardBorder,
      radius: 20,
      line: 4,
    });
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
    let line = `${tr.yieldLine(r.yield, r.base).split(" · ")[0]} · ${tr.minutes(batchMinutes(save, r))}`;
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
  btn(
    app,
    "pick-close",
    { x: m.x + 60, y: m.y + m.h - 78, w: m.w - 120, h: 62 },
    tr.close,
    () => app.go({ kind: "hub" }),
    { size: 22 },
  );
}
