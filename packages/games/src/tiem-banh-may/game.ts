import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, type Runtime, SUMMARY_KEY } from "../core";
import {
  type App,
  H,
  type Screen,
  type Toast,
  W,
  btn,
  makeSfx,
  shade,
  sheet,
  viewRect,
} from "./app";
import { C, bar, chip, sprite, text, wrap } from "./art";
import { drawBook, drawPicker } from "./book";
import { SaveSync } from "./cloud";
import { drawHub } from "./hub";
import { drawBake, updateBake } from "./kitchen";
import { type SaveData, assets, newGame } from "./logic";
import { drawMarket } from "./market";
import { drawReport } from "./report";
import { drawShop, newDay, updateShop } from "./shop";
import { loadSprites } from "./sprites";
import { STRINGS } from "./strings";
import { Ui } from "./ui";

// The shell: loads the bakery from the player's account, routes between the
// screens, and floats toasts. Screens draw themselves and register their taps
// with the Ui every frame; the rules live in logic.ts.

const TOAST_LIFE = 1.5;

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const ui = new Ui();
  const sprites = loadSprites();
  const toasts: Toast[] = [];
  let sync: SaveSync | null = null;
  let failure: "signin" | "network" | null = null;

  const writeSummary = (s: SaveData) =>
    rt.game.storage.set(SUMMARY_KEY, {
      vi: STRINGS.vi.summary(s.day, s.coins),
      en: STRINGS.en.summary(s.day, s.coins),
    });

  const app: App = {
    rt,
    ctx,
    ui,
    sprites,
    sfx: makeSfx(rt),
    tr: () => STRINGS[rt.locale()],
    save: newGame(0),
    screen: { kind: "loading" },
    time: 0,
    go(screen: Screen) {
      app.screen = screen;
    },
    commit(next, opts = {}) {
      app.save = next;
      writeSummary(next);
      if (!sync) return;
      // The board ranks the bakery's worth after each closed day
      const score = opts.score
        ? {
            score: Math.max(1, Math.round(assets(next))),
            detail: app.tr().detail(next.day - 1),
          }
        : undefined;
      sync.queue(next, score, opts.now || opts.score);
    },
    toast(str, x, y, color = C.text, size = 22) {
      toasts.push({ text: str, x, y, t: 0, color, size });
    },
  };

  async function boot() {
    failure = null;
    app.go({ kind: "loading" });
    sync?.dispose();
    sync = null;
    const cloud = rt.game.cloud;
    if (!cloud) {
      failure = "signin";
      app.go({ kind: "error" });
      return;
    }
    const mine = new SaveSync(cloud, rt.game.storage);
    try {
      const save = await mine.load();
      sync = mine;
      app.save = save;
      writeSummary(save);
      // Closed mid-day: the day starts again from the morning's display
      app.go(
        save.phase === "open"
          ? { kind: "shop", shop: newDay(save) }
          : { kind: "hub" },
      );
    } catch {
      mine.dispose();
      failure = "network";
      app.go({ kind: "error" });
    }
  }
  void boot();

  function drawLoading() {
    const v = viewRect(app);
    ctx.fillStyle = C.page;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    const bob = Math.sin(app.time * 4) * 8;
    sprite(ctx, sprites.get("cake-cupcake"), W / 2, H / 2 - 80 + bob, 150, 150);
    text(ctx, app.tr().loading, W / 2, H / 2 + 40, {
      size: 26,
      fill: C.white,
      outline: C.ink,
    });
    bar(
      ctx,
      { x: W / 2 - 120, y: H / 2 + 80, w: 240, h: 20 },
      sprites.progress,
      C.cardBorder,
    );
  }

  function drawError() {
    const tr = app.tr();
    const v = viewRect(app);
    ctx.fillStyle = C.page;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    sprite(ctx, sprites.get("fail-flat"), W / 2, H / 2 - 120, 180, 150);
    const msg = failure === "signin" ? tr.needSignIn : tr.loadFailed;
    wrap(ctx, msg, W - 80, 24).forEach((l, i) => {
      text(ctx, l, W / 2, H / 2 + i * 32, {
        size: 24,
        fill: C.white,
        outline: C.ink,
      });
    });
    if (failure === "network")
      btn(
        app,
        "retry",
        { x: W / 2 - 120, y: H / 2 + 110, w: 240, h: 76 },
        tr.retry,
        () => void boot(),
        { fill: C.green, size: 24 },
      );
  }

  function drawSync() {
    if (!sync) return;
    const tr = app.tr();
    if (sync.status === "offline") {
      chip(ctx, 14, H - 160, tr.saveFailed, 30, "left");
    } else if (sync.status === "conflict") {
      shade(app);
      const m = { x: 40, y: H / 2 - 150, w: W - 80, h: 300 };
      sheet(app, m, tr.conflict.split(".")[0]);
      wrap(ctx, tr.conflict, m.w - 60, 20).forEach((l, i) => {
        text(ctx, l, W / 2, m.y + 110 + i * 28, { size: 20, fill: C.text });
      });
      btn(
        app,
        "reload",
        { x: m.x + 40, y: m.y + m.h - 100, w: m.w - 80, h: 76 },
        tr.reload,
        () => void boot(),
        { fill: C.green, size: 24 },
      );
    }
  }

  function drawToasts() {
    for (const t of toasts) {
      const k = t.t / TOAST_LIFE;
      ctx.save();
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      text(ctx, t.text, t.x, t.y - k * 46, {
        size: t.size,
        fill: t.color,
        outline: C.white,
        maxWidth: W - 30,
      });
      ctx.restore();
    }
  }

  return {
    update(dt) {
      app.time += dt;
      for (const t of toasts) t.t += dt;
      while (toasts.length && toasts[0].t > TOAST_LIFE) toasts.shift();
      const s = app.screen;
      if (s.kind === "bake") updateBake(app, s.bake, dt);
      else if (s.kind === "shop" && sync?.status !== "conflict")
        updateShop(app, s.shop, dt);
    },
    render() {
      stage.begin();
      ui.frame();
      const s = app.screen;
      if (s.kind === "loading" || (!sprites.ready && s.kind !== "error"))
        drawLoading();
      else if (s.kind === "error") drawError();
      else if (s.kind === "hub") drawHub(app);
      else if (s.kind === "market") drawMarket(app, s.cart);
      else if (s.kind === "book") drawBook(app, s.tab, s.detail);
      else if (s.kind === "pick") {
        drawHub(app);
        drawPicker(app);
      } else if (s.kind === "bake") drawBake(app, s.bake);
      else if (s.kind === "shop") drawShop(app, s.shop);
      else if (s.kind === "report") drawReport(app, s.report);
      drawToasts();
      drawSync();
      stage.end();
    },
    pointer: {
      down: (p) => ui.down(p),
      move: (p) => ui.move(p),
      up: (p) => ui.up(p),
    },
    suspend() {
      ui.cancel();
    },
    dispose() {
      sync?.dispose();
    },
  };
}
