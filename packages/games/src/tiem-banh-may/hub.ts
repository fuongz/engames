import { newDecor } from "./decor";
import { DOOR_TILE, GRID_ROWS } from "./config";
import { furniture } from "./furniture";
import { shopName } from "./name";
import {
  type Floor,
  drawRoom,
  drawStorefront,
  floorAt,
  tileRect,
} from "./storefront";
import { type App, H, W, btn, icon, shade, sheet, top, viewRect } from "./app";
import { SIDE_STEP, SIDE_X, hud, sideIcon, sideTop } from "./hud";
import { DUR, easeOut } from "./motion";
import {
  dialogButtons,
  dialogHeight,
  dialogPage,
  raise,
  weatherCard,
} from "./kit";
import {
  C,
  FONT,
  dot,
  framed,
  panel,
  sprite,
  text,
  weatherIcon,
  wrap,
} from "./art";
import {
  BEDTIME,
  INGREDIENTS,
  LATEST_BED,
  MARKET_TRIP,
  RECIPES,
} from "./config";
import {
  canBake,
  clockAt,
  drinkCoffee,
  goToBed,
  type Job,
  canOpen,
  elapsed,
  mustOpen,
  ovensBusy,
  pastBedtime,
  slept,
  customer,
  dayInfo,
  formatClock,
  pantryQty,
  recipe,
  stockCount,
  timeLeft,
} from "./logic";
import { resumeJob } from "./kitchen";
import { openShop } from "./shop";

// The bakery at night, closed: the storefront the player has furnished (dim,
// a "closed" sign on the door, last night's batches on the stands) with the
// HUD over it. Round buttons run down the sides (the record, the night's
// speed and coffee on the left; pause and settings on the right), the four
// places to go stand lower on each side (market and recipes left, baking and
// decor right), and the big bed / open button sits at the bottom. Batches in
// the oven show as chips above it.

/** Whether the forecast card is open over the shop. */
let forecastOpen = false;

export function drawHub(app: App) {
  const { ctx, save } = app;
  const tr = app.tr();
  const v = viewRect(app);
  const locale = app.rt.locale();
  ctx.fillStyle = "#f3dfc0";
  ctx.fillRect(v.x, v.y, v.w, v.h);
  // The HUD's height is fixed: lay the room out under it, draw the room, then
  // the HUD over its top
  const y0 = top(app) + 90;

  // ---- the shop, closed for the night
  // The grid starts under the HUD; the floor carries on up behind it and
  // down to the bottom of the screen (those tiles are decoration)
  const f = floorAt(y0 + 2);
  const sideAt = f.top + 10;
  const by = Math.max(H - 94, v.y + v.h - 98);
  const rows = Math.max(GRID_ROWS, Math.ceil((v.y + v.h - f.y0) / f.th));
  const from = -Math.ceil((f.y0 - v.y) / f.th);
  drawRoom(app, f, v, save.decor, rows, from);
  // The name sign hangs just under the HUD, where it shows
  drawStorefront(
    app,
    f,
    save.decor,
    save.stock,
    shopName(save, locale),
    [],
    top(app) + 70,
  );
  // Daylight until evening; after dark the lamps give the room a warm glow
  const dark = darkness(clockAt(save.night));
  if (dark > 0) {
    ctx.save();
    ctx.globalAlpha = dark;
    ctx.fillStyle = "rgba(255, 176, 72, 0.2)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    // Pools of lamplight under the wall
    const g = ctx.createRadialGradient(
      W / 2,
      f.top + 80,
      20,
      W / 2,
      f.top + 80,
      420,
    );
    g.addColorStop(0, "rgba(255, 214, 140, 0.28)");
    g.addColorStop(1, "rgba(120, 70, 40, 0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.restore();
  }
  closedSign(app, f);
  // Tomorrow's weather sits on the calendar; tap it for the forecast
  const info = dayInfo(save);
  hud(app, formatClock(clockAt(save.night)), {
    settings: () => app.go({ kind: "settings", confirm: 0 }),
    pause: true,
    music: () => app.go({ kind: "music" }),
    side: sideAt,
    forecast: {
      weather: info.weather,
      dot: info.vip || save.preorders.length > 0,
      onTap: () => {
        forecastOpen = true;
      },
    },
  });
  // The stands open the display (what is out for tomorrow)
  for (const p of save.decor.placed.filter(
    (x) => furniture(x.id).kind === "stand",
  )) {
    const def = furniture(p.id);
    const r = tileRect(f, p.x, p.y, def.w, def.h);
    app.ui.add({
      rect: { x: r.x, y: r.y - f.th, w: r.w, h: r.h + f.th },
      key: "display",
      tap: () => {
        app.sfx.tap();
        app.go({ kind: "display" });
      },
    });
  }

  // ---- the night: time to the next wall, under the stats
  const left = timeLeft(save);
  const timeLine = slept(save)
    ? canOpen(save)
      ? tr.openNow
      : tr.beforeOpen(left)
    : pastBedtime(save)
      ? tr.lateNight(left)
      : tr.beforeBed(left - (LATEST_BED - BEDTIME));
  text(ctx, timeLine, 16, top(app) + 74, {
    size: 14,
    align: "left",
    fill: pastBedtime(save) ? C.warn : C.text,
    outline: C.cream,
    maxWidth: 160,
  });

  // ---- down the left side, under the record: the night's speed and coffee
  const sy = sideTop(sideAt);
  const lx = SIDE_X.left;
  sideIcon(
    app,
    "speed",
    lx,
    sy + SIDE_STEP,
    "icon-speed",
    (cx, cy) => text(ctx, "▶▶", cx, cy, { size: 15, fill: C.good }),
    () => {
      app.speed = app.speed === 3 ? 1 : ((app.speed + 1) as 2 | 3);
    },
    { tag: app.speed > 1 ? `×${app.speed}` : undefined },
  );
  const cups = pantryQty(save, "coffee");
  sideIcon(
    app,
    "coffee",
    lx,
    sy + SIDE_STEP * 2,
    "icon-coffee",
    (cx, cy) => sprite(ctx, app.sprites.get("ing-coffee"), cx, cy, 26, 26),
    () => {
      const r = drinkCoffee(save);
      if (!r.ok) {
        app.sfx.bad();
        app.toast(tr.noCoffee, W / 2, sy + SIDE_STEP * 2, C.bad, 18);
        return;
      }
      app.sfx.good();
      app.commit(r.save);
      app.toast("+⚡", lx + 40, sy + SIDE_STEP * 2, C.good, 22);
    },
    { count: cups },
  );

  // ---- the bottom: the four places to go on the sides, bed / open between
  const affordable = RECIPES.some(
    (r) => !save.recipes.includes(r.id) && r.cost <= save.coins,
  );
  const nav = [
    {
      key: "market",
      label: tr.market,
      img: "ing-strawberry",
      go: () => app.go({ kind: "market", cart: {} }),
    },
    {
      key: "book",
      label: tr.bookShort,
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
    {
      key: "decor",
      label: tr.decor.title,
      img: "f-pink-chair",
      go: () => app.go({ kind: "decor", decor: newDecor(save.decor) }),
    },
  ];
  // A bottom bar of square tiles with names, like a shop's shelf: market and
  // recipes on the left, baking and decor on the right, bed / open between
  const navIcon = ["icon-market", "icon-recipes", "icon-bake", "icon-decor"];
  const TW = 80;
  const TH = 84;
  const mid = { x: 14 + 2 * (TW + 6), w: W - 2 * (14 + 2 * (TW + 6)) };
  // The bar's shelf behind the tiles
  panel(
    ctx,
    { x: 6, y: by + 16, w: W - 12, h: TH - 8 },
    {
      fill: "#e9b48f",
      radius: 16,
      line: 3,
      lip: 5,
    },
  );
  nav.forEach((t, i) => {
    const right = i >= 2;
    const slot = right ? i - 2 : i;
    const x = right
      ? mid.x + mid.w + 6 + slot * (TW + 6)
      : 14 + slot * (TW + 6);
    const pressed = app.ui.isPressed(t.key);
    const r = { x, y: by + (pressed ? 3 : 0), w: TW, h: TH };
    raise(ctx, r, 16);
    panel(ctx, r, {
      fill: "#fff6e8",
      radius: 16,
      line: 3,
      lip: pressed ? 0 : 4,
    });
    const img = app.sprites.get(navIcon[i]);
    if (img?.naturalWidth) sprite(ctx, img, r.x + TW / 2, r.y + 32, 50, 46);
    else sprite(ctx, app.sprites.get(t.img), r.x + TW / 2, r.y + 32, 44, 40);
    text(ctx, t.label, r.x + TW / 2, r.y + TH - 14, {
      size: 14,
      fill: C.white,
      outline: C.ink,
      maxWidth: TW - 6,
    });
    if (t.badge) dot(ctx, r.x + TW - 6, r.y + 6);
    app.ui.add({
      rect: r,
      key: t.key,
      tap: () => {
        app.sfx.tap();
        t.go();
      },
    });
  });
  const jobs = jobChips(app, by - 10);
  hintToast(app, nextHint(app), jobs - 8);

  const pulse =
    left < Math.min(MARKET_TRIP, 37) || nextHint(app) === tr.hintOpen;
  const awake = !slept(save);
  if (mustOpen(save)) {
    app.toast(tr.autoOpened, W / 2, 330, C.text, 20);
    openShop(app);
    return;
  }
  const big = { x: mid.x, y: by + 2, w: mid.w, h: TH };
  if (awake) {
    btn(app, "bed", big, tr.sleep, () => sleepNow(app), {
      fill: "#c9cdea",
      size: 26,
    });
  } else {
    const open = canOpen(save);
    btn(
      app,
      "open",
      big,
      open ? `${tr.open} ▶` : tr.openAt,
      () => openShop(app),
      {
        fill: pulse && Math.sin(app.time * 5) > 0 ? "#c9f0a6" : C.green,
        size: open ? 26 : 19,
        disabled: !open,
      },
    );
  }

  if (forecastOpen) drawForecast(app);
  // 22:00: ask once a night; 1:00: bed, no choice
  if (awake && left <= 0) {
    bedtimeSheet(app, tr.mustSleep, false);
  } else if (awake && pastBedtime(save) && askedDay !== save.day) {
    bedtimeSheet(app, tr.bedtimeAsk, true);
  }
  drawSleep(app);
}

/** A little "closed" board standing on the door tile (always kept clear). */
function closedSign(app: App, f: Floor) {
  const { ctx } = app;
  const tr = app.tr();
  const t = tileRect(f, DOOR_TILE.x, 0);
  ctx.font = `700 13px ${FONT}`;
  const w = Math.max(64, ctx.measureText(tr.closedSign).width + 18);
  const r = { x: t.x + t.w / 2 - w / 2, y: t.y + t.h - 46, w, h: 26 };
  // Two little legs
  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r.x + 12, r.y + r.h);
  ctx.lineTo(r.x + 8, t.y + t.h - 8);
  ctx.moveTo(r.x + w - 12, r.y + r.h);
  ctx.lineTo(r.x + w - 8, t.y + t.h - 8);
  ctx.stroke();
  ctx.restore();
  panel(ctx, r, { fill: "#f6b7a8", radius: 8, line: 2.5 });
  text(ctx, tr.closedSign, r.x + w / 2, r.y + r.h / 2 + 1, { size: 13 });
}

/** Tomorrow in full, over the shop. */
function drawForecast(app: App) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const shut = () => {
    forecastOpen = false;
  };
  shade(app, shut);
  const info = dayInfo(save);
  const lines: { text: string; color: string }[] = [
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
  const card = weatherCard(app, 18, 230, W - 36, {
    title: tr.forecast(save.day),
    headline: tr.weather[info.weather],
    icon: {
      name: info.weather,
      fallback: (cx, cy, size) =>
        weatherIcon(ctx, cx, cy, info.weather, size * 0.36),
    },
    tint:
      info.weather === "sunny"
        ? "#fff0bf"
        : info.weather === "cloudy"
          ? "#e8edf2"
          : "#d9e8f6",
    lines,
  });
  app.ui.add({ rect: card, tap: shut });
}

/** Batches baking or resting, as chips above the bar; tap one to tend it. Returns the top. */
function jobChips(app: App, bottom: number) {
  const { ctx, save } = app;
  if (!save.jobs.length) return bottom;
  const y = bottom - 44;
  save.jobs.slice(0, 3).forEach((job, i) => {
    const r = { x: 80 + i * 130, y, w: 122, h: 44 };
    const k = progress(app, job);
    const ready = k >= 1;
    framed(ctx, r, ready ? "#d6ecb0" : C.cream, 22, 3);
    sprite(
      ctx,
      app.sprites.get(recipe(job.recipe).sprite),
      r.x + 24,
      r.y + r.h / 2,
      34,
      34,
    );
    timerChip(app, job, r.x + 80, r.y + 37);
    app.ui.add({
      rect: r,
      tap: () => {
        app.sfx.tap();
        resumeJob(app, job);
      },
    });
  });
  return y;
}

let askedDay = -1;
let sleptAt = -99;

function sleepNow(app: App) {
  const { save, hours } = goToBed(app.save);
  if (!hours) return;
  askedDay = app.save.day;
  sleptAt = app.time;
  app.commit(save, { now: true });
  app.toast(app.tr().slept(Math.round(hours * 60)), W / 2, 330, C.text, 22);
}

function bedtimeSheet(app: App, prompt: string, canStay: boolean) {
  const { ctx } = app;
  const tr = app.tr();
  app.held = true;
  const message = ovensBusy(app.save) > 0 ? `${prompt} ${tr.ovenWarn}` : prompt;
  shade(app);
  const lines = wrap(ctx, message, dialogPage(W - 80) - 40, 18);
  const h = Math.max(330, dialogHeight(44 + 106, lines.length, 26));
  const m = { x: 40, y: 330, w: W - 80, h };
  const paper = sheet(app, m, tr.bedtimeTitle);
  // Moon over the page
  const moonX = paper.x + paper.w / 2;
  const moonY = paper.y + 54;
  icon(app, "moon", moonX, moonY, 64, () => {
    ctx.beginPath();
    ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe9a8";
    ctx.fill();
  });
  lines.forEach((l, i) => {
    text(ctx, l, paper.x + paper.w / 2, paper.y + 106 + i * 26, {
      size: 18,
      weight: 700,
    });
  });
  dialogButtons(app, m, [
    ...(canStay
      ? [
          {
            key: "stay",
            label: tr.stayUp,
            onTap: () => {
              askedDay = app.save.day;
            },
          },
        ]
      : []),
    {
      key: "sleep",
      label: tr.sleep,
      onTap: () => sleepNow(app),
      fill: "#c9cdea",
      size: 23,
      weight: 1.3,
    },
  ]);
}

/** Night falls and lifts again after going to bed. */
function drawSleep(app: App) {
  const k = (app.time - sleptAt) / 1.8;
  if (k < 0 || k > 1) return;
  const { ctx } = app;
  const v = viewRect(app);
  const a = k < 0.5 ? k * 2 : (1 - k) * 2;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 1.3);
  ctx.fillStyle = "#2a2f52";
  ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.beginPath();
  ctx.arc(W / 2, 380, 46, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe9a8";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2 + 20, 366, 40, 0, Math.PI * 2);
  ctx.fillStyle = "#2a2f52";
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    text(ctx, "z", W / 2 + 60 + i * 22, 330 - i * 24 - k * 30, {
      size: 26 + i * 6,
      fill: C.white,
    });
  }
  ctx.restore();
}

/** Seconds a hint stays up before it tucks itself away. */
const HINT_LIFE = 8;
/** The hint showing: since when, when it started to leave, and whether the player skipped it. */
const hints = new WeakMap<
  App,
  { text: string; at: number; out: number | null; skipped: boolean }
>();

/**
 * The next-step hint as a toast resting on `bottom`: it rises in, leaves on
 * its own after HINT_LIFE seconds or when tapped, and comes back when the
 * advice changes or the player returns to the kitchen (unless they skipped it).
 */
function hintToast(app: App, hint: string | null, bottom: number) {
  const { ctx } = app;
  // First frame of a visit to the kitchen (the hub stays drawn under its dialogs)
  const back = app.motion.age("hub") === 0;
  if (!hint || app.tour !== null) return;
  let s = hints.get(app);
  if (!s || s.text !== hint) {
    s = { text: hint, at: app.time, out: null, skipped: false };
    hints.set(app, s);
  } else if (back && !s.skipped) {
    s.at = app.time;
    s.out = null;
  }
  if (s.out === null && app.time - s.at > HINT_LIFE) s.out = s.at + HINT_LIFE;
  const enter = easeOut((app.time - s.at) / DUR.sheetIn);
  const leave = s.out === null ? 0 : easeOut((app.time - s.out) / DUR.sheetOut);
  if (leave >= 1) return;
  const k = enter * (1 - leave);

  const x = 100;
  const w = W - 200;
  const lines = wrap(ctx, hint, w - 128, 17);
  const h = Math.max(64, 22 + lines.length * 23);
  const y = bottom - h;
  ctx.save();
  ctx.globalAlpha *= k;
  if (!app.motion.reduce) ctx.translate(0, (1 - k) * 18);
  framed(ctx, { x, y, w, h }, C.white, 18, 3);
  // Mây says it
  const ax = x + 36;
  const ay = y + h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, 22, 0, Math.PI * 2);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.clip();
  sprite(ctx, app.sprites.get("mascot-avatar"), ax, ay + 3, 52, 52);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ax, ay, 22, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  lines.forEach((l, i) => {
    text(ctx, l, x + 68, y + h / 2 + (i - (lines.length - 1) / 2) * 23, {
      size: 17,
      align: "left",
    });
  });
  // The way to skip it
  text(ctx, "✕", x + w - 26, y + h / 2, { size: 18, fill: C.muted });
  ctx.restore();
  if (s.out === null) {
    const cur = s;
    app.ui.add({
      rect: { x, y, w, h },
      key: "hint",
      tap: () => {
        app.sfx.tap();
        cur.skipped = true;
        cur.out = app.time;
      },
    });
  }
}

/** The next sensible thing to do tonight, for players finding their feet. */
function nextHint(app: App) {
  const tr = app.tr();
  const s = app.save;
  if (s.energy <= 0) return tr.hintTired;
  if (slept(s) && timeLeft(s) < 30) return tr.hintTimeUp;
  if (stockCount(s.stock) > 0) return s.day <= 2 ? tr.hintOpen : null;
  const anyIngredients = INGREDIENTS.some((i) => pantryQty(s, i.id) > 0);
  if (!anyIngredients) return tr.hintMarket;
  return s.recipes.some((id) => canBake(s, id) === null)
    ? tr.hintBake
    : tr.hintMarket;
}

/** 0 → 1 as the timed step runs (past 1: overdone). */
function progress(app: App, job: Job) {
  const step = recipe(job.recipe).steps[job.step];
  const target =
    step?.kind === "oven" || step?.kind === "wait" ? step.minutes : 1;
  return elapsed(app.save, job) / target;
}

/** "12'" while it runs, a bouncing "Xong!" when it is ready. */
function timerChip(app: App, job: Job, cx: number, y: number) {
  const tr = app.tr();
  const k = progress(app, job);
  const step = recipe(job.recipe).steps[job.step];
  const target =
    step?.kind === "oven" || step?.kind === "wait" ? step.minutes : 0;
  const ready = k >= 1;
  const label = ready
    ? tr.done
    : `${Math.ceil(target - elapsed(app.save, job))}'`;
  const bounce = ready ? Math.abs(Math.sin(app.time * 5)) * 6 : 0;
  app.ctx.font = `800 18px ${FONT}`;
  const w = app.ctx.measureText(label).width + 26;
  panel(
    app.ctx,
    { x: cx - w / 2, y: y - 30 - bounce, w, h: 30 },
    {
      fill: ready
        ? job.kind === "oven" && k > 1.4
          ? "#ffb3a0"
          : "#d6ecb0"
        : C.cream,
      radius: 15,
      line: 3,
    },
  );
  text(app.ctx, label, cx, y - 15 - bounce, { size: 18 });
}

/** 0 in daylight, 1 at night: fades in 17:30–18:30 and out 5:30–6:30. */
function darkness(clock: number) {
  const t = ((clock % 1440) + 1440) % 1440;
  const ramp = (a: number, b: number) =>
    Math.min(1, Math.max(0, (t - a) / (b - a)));
  if (t >= 12 * 60) return ramp(17.5 * 60, 18.5 * 60);
  return 1 - ramp(5.5 * 60, 6.5 * 60);
}
