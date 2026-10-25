import "@fontsource/mali/600.css";
import "@fontsource/mali/700.css";
import { type GameHooks, type Runtime, SUMMARY_KEY } from "@web-games/core";
import {
  type App,
  H,
  type Screen,
  type Toast,
  W,
  btn,
  icon,
  makeSfx,
  shade,
  sheet,
  viewRect,
} from "./app";
import { C, bar, bolt, chip, face, heart, sprite, text, wrap } from "./art";
import { drawBook, drawPicker } from "./book";
import { SaveSync, listSlots } from "./cloud";
import { drawHub } from "./hub";
import { drawBake, updateBake } from "./kitchen";
import { BEDTIME, FAST_SPEED, NIGHT_SPEED, OPEN } from "./config";
import {
  type SaveData,
  advance,
  assets,
  clockCap,
  elapsed,
  newGame,
  recipe,
} from "./logic";
import { drawDisplay } from "./display";
import { drawLearned } from "./learned";
import { drawMarket } from "./market";
import { drawMusicBox } from "./musicbox";
import { drawReport } from "./report";
import { drawShop, newDay, updateShop } from "./shop";
import { loadSprites } from "./sprites";
import { STRINGS } from "./strings";
import type { RecordId } from "./config";
import { trackUrl } from "./music";

import { drawSettings, drawSlots } from "./slots";
import { drawTour } from "./tour";
import { Ui } from "./ui";
import { dialogButtons, dialogHeight, dialogPage, pauseGlyph } from "./kit";

// The shell: loads the bakery from the player's account, routes between the
// screens, and floats toasts. Screens draw themselves and register their taps
// with the Ui every frame; the rules live in logic.ts.

const TOAST_LIFE = 1.5;
/** Where a bakery's tour progress is kept (this device; -1 when over). */
const tourKey = (playerId: string, slot: number) => `tour:${playerId}:${slot}`;
/** Real seconds between background saves while the night clock runs. */
const SAVE_EVERY = 15;

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const ui = new Ui();
  const sprites = loadSprites();
  const toasts: Toast[] = [];
  let sync: SaveSync | null = null;
  let failure: "signin" | "network" | null = null;
  // The music box: whichever record is on it, from Cozy Tunes by Pizza Doggy
  const silent = { hold() {}, release() {}, stop() {} };
  let tune: { hold(): void; release(): void; stop(): void } = silent;
  let tuneId: RecordId | null = null;
  let musicHeld = false;
  // Music on/off is the player's choice on this device
  let musicOn = rt.game.storage.get("music", true);
  /** Play the record on the box (switching tracks when it changes). */
  const syncMusic = () => {
    const want =
      app.save.playing && trackUrl(app.save.playing) ? app.save.playing : null;
    if (want === tuneId) return;
    tune.stop();
    tuneId = want;
    const url = want ? trackUrl(want) : undefined;
    tune = url ? rt.game.audio.loop(url, 0.3) : silent;
    if (!musicOn || app.paused) tune.hold();
  };

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
    fast: false,
    held: false,
    paused: false,
    info: null,
    tour: null,
    setTour(step) {
      app.tour = step;
      const cloud = rt.game.cloud;
      if (cloud)
        rt.game.storage.set(tourKey(cloud.playerId, app.slot), step ?? -1);
    },
    setPaused(on) {
      app.paused = on;
      app.fast = false;
      ui.cancel();
      // The music rests with the bakery
      if (on) tune.hold();
      else if (musicOn) tune.release();
    },
    slot: rt.game.storage.get("lastSlot", 0),
    shell: {
      open: (slot) => void open(slot),
      pick: () => void pickSlot(),
      restart,
      get music() {
        return musicOn;
      },
      setMusic(on) {
        musicOn = on;
        rt.game.storage.set("music", on);
        if (on) tune.release();
        else tune.hold();
      },
    },
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

  /** Signed in: show the account's bakeries to choose from. */
  async function boot() {
    failure = null;
    sync?.dispose();
    sync = null;
    const cloud = rt.game.cloud;
    if (!cloud) {
      failure = "signin";
      app.go({ kind: "error" });
      return;
    }
    await pickSlot();
  }

  async function pickSlot() {
    const cloud = rt.game.cloud;
    if (!cloud) return;
    // Whatever is unsent stays in the local backup; the picker reads it too
    sync?.dispose();
    sync = null;
    const screen: Screen = { kind: "slots", list: null };
    app.go(screen);
    try {
      const list = await listSlots(cloud, rt.game.storage);
      if (app.screen === screen) app.go({ kind: "slots", list });
    } catch {
      failure = "network";
      app.go({ kind: "error" });
    }
  }

  /** Load the bakery in `slot` (a new one if it is empty). */
  async function open(slot: number) {
    const cloud = rt.game.cloud;
    if (!cloud) return;
    failure = null;
    app.go({ kind: "loading" });
    sync?.dispose();
    sync = null;
    app.slot = slot;
    rt.game.storage.set("lastSlot", slot);
    const mine = new SaveSync(cloud, rt.game.storage, slot);
    try {
      const save = await mine.load();
      sync = mine;
      app.save = save;
      app.fast = false;
      // The first day comes with a guide (unless this bakery finished or skipped it)
      const seen = rt.game.storage.get<number | null>(
        tourKey(cloud.playerId, slot),
        null,
      );
      app.tour =
        seen === null ? (save.day === 1 ? 0 : null) : seen < 0 ? null : seen;
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

  /** Start the current bakery over: erase its slot, then open it fresh. */
  async function restart() {
    if (!sync) return false;
    try {
      await sync.erase();
    } catch {
      return false;
    }
    sync = null;
    await open(app.slot);
    return true;
  }
  void boot();

  let sinceSave = 0;
  let lastSaved: SaveData | null = null;

  /** The night clock: minutes pass in the kitchen, ovens bake, alarms ring. */
  function tickNight(dt: number) {
    const before = app.save;
    const after = advance(before, dt * (app.fast ? FAST_SPEED : NIGHT_SPEED));
    if (after === before) {
      app.fast = false;
      return;
    }
    app.save = after;
    // Fast-forward stops at bedtime, at 9:00 and when something is ready
    const crossed = (t: number) => before.night < t && after.night >= t;
    if (crossed(BEDTIME) || crossed(OPEN) || after.night >= clockCap(after))
      app.fast = false;
    const timers: {
      recipe: Parameters<typeof recipe>[0];
      step: number;
      start: number;
    }[] = [...after.jobs];
    const s = app.screen;
    if (s.kind === "bake") {
      const p = s.bake.phase;
      if ((p.kind === "ovenRun" || p.kind === "wait") && p.start !== null)
        timers.push({
          recipe: s.bake.recipe,
          step: s.bake.step,
          start: p.start,
        });
    }
    for (const t of timers) {
      const step = recipe(t.recipe).steps[t.step];
      const target =
        step?.kind === "oven" || step?.kind === "wait" ? step.minutes : 0;
      if (
        target &&
        elapsed(before, t) < target &&
        elapsed(after, t) >= target
      ) {
        app.fast = false;
        app.sfx.bell();
        app.toast(
          app.tr().ready(recipe(t.recipe).name[rt.locale()]),
          W / 2,
          260,
          C.good,
          24,
        );
      }
    }
    sinceSave += dt;
    if (sinceSave > SAVE_EVERY && lastSaved !== app.save) {
      sinceSave = 0;
      lastSaved = app.save;
      app.commit(app.save);
    }
  }

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
      dialogButtons(app, m, [
        {
          key: "reload",
          label: tr.reload,
          onTap: () => void open(app.slot),
          fill: C.green,
          size: 24,
        },
      ]);
    }
  }

  /** What a HUD stat means, with its value now. */
  function drawInfo(stat: "rep" | "energy" | "mood") {
    const tr = app.tr();
    const save = app.save;
    const info = tr.stat[stat];
    const value = Math.round(stat === "rep" ? save.rep : save[stat]);
    const lines = wrap(ctx, info.body, dialogPage(W - 80) - 40, 17);
    const h = dialogHeight(44 + 120, lines.length, 25);
    const m = { x: 40, y: Math.max(140, (H - h) / 2), w: W - 80, h };
    const done = () => {
      app.info = null;
    };
    shade(app, done);
    const paper = sheet(app, m, info.title);
    const iy = paper.y + 50;
    icon(app, stat === "rep" ? "heart" : stat, W / 2 - 58, iy, 52, () =>
      stat === "rep"
        ? heart(ctx, W / 2 - 58, iy, 20)
        : stat === "energy"
          ? bolt(ctx, W / 2 - 58, iy, 22)
          : face(ctx, W / 2 - 58, iy, 22, save.mood),
    );
    text(ctx, `${value}/100`, W / 2 + 30, iy + 2, { size: 30 });
    lines.forEach((l, i) => {
      text(ctx, l, W / 2, paper.y + 120 + i * 25, { size: 17 });
    });
    dialogButtons(app, m, [
      { key: "got-it", label: tr.gotIt, onTap: done, fill: C.green },
    ]);
  }

  function drawPause() {
    const tr = app.tr();
    shade(app);
    const m = { x: 50, y: H / 2 - 170, w: W - 100, h: 330 };
    const paper = sheet(app, m, tr.pauseTitle);
    pauseGlyph(ctx, W / 2, paper.y + 50, 64);
    wrap(ctx, tr.pausedNote, paper.w - 40, 19).forEach((l, i) => {
      text(ctx, l, W / 2, paper.y + 108 + i * 27, { size: 19 });
    });
    dialogButtons(app, m, [
      {
        key: "resume",
        label: tr.goOn,
        fill: C.green,
        size: 24,
        onTap: () => app.setPaused(false),
      },
    ]);
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
      syncMusic();
      // The loop only runs while the game is live: back from a hold, so is the music
      if (musicHeld) {
        musicHeld = false;
        if (musicOn && !app.paused) tune.release();
      }
      for (const t of toasts) t.t += dt;
      while (toasts.length && toasts[0].t > TOAST_LIFE) toasts.shift();
      const s = app.screen;
      // Paused, or reading about a stat: nothing moves until the player is back
      if (app.paused || app.info) return;
      if ((s.kind === "hub" || s.kind === "bake") && sync && !app.held)
        tickNight(dt);
      if (s.kind === "bake") updateBake(app, s.bake, dt);
      else if (s.kind === "shop" && sync?.status !== "conflict")
        updateShop(app, s.shop, dt);
    },
    render() {
      stage.begin();
      ui.frame();
      app.held = false;
      const s = app.screen;
      if (s.kind === "loading" || (!sprites.ready && s.kind !== "error"))
        drawLoading();
      else if (s.kind === "error") drawError();
      else if (s.kind === "hub") drawHub(app);
      else if (s.kind === "display") drawDisplay(app);
      else if (s.kind === "music") drawMusicBox(app);
      else if (s.kind === "learned") drawLearned(app, s);
      else if (s.kind === "market")
        drawMarket(app, s.cart, s.aisle ?? 0, s.records ?? []);
      else if (s.kind === "book") drawBook(app, s.tab, s.detail, s.page ?? 0);
      else if (s.kind === "pick") {
        drawHub(app);
        drawPicker(app, s.page ?? 0);
      } else if (s.kind === "bake") drawBake(app, s.bake);
      else if (s.kind === "shop") drawShop(app, s.shop);
      else if (s.kind === "report") drawReport(app, s.report);
      else if (s.kind === "slots") drawSlots(app, s);
      else if (s.kind === "settings") drawSettings(app, s);
      if (s.kind !== "loading" && s.kind !== "error" && s.kind !== "slots")
        drawTour(app);
      drawToasts();
      if (app.info) drawInfo(app.info);
      if (app.paused) drawPause();
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
      musicHeld = true;
      tune.hold();
    },
    dispose() {
      sync?.dispose();
      tune.stop();
    },
  };
}
