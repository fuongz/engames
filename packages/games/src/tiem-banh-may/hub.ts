import { type App, H, W, btn, icon, shade, sheet, viewRect } from "./app";
import { hud } from "./hud";
import {
  dialogButtons,
  dialogHeight,
  dialogPage,
  toolbar,
  weatherCard,
} from "./kit";
import {
  C,
  FONT,
  card,
  framed,
  clockIcon,
  cover,
  dot,
  panel,
  sprite,
  text,
  weatherIcon,
  wrap,
  coverY,
  onTable,
} from "./art";
import {
  BEDTIME,
  INGREDIENTS,
  LATEST_BED,
  MARKET_TRIP,
  NAP_MINUTES,
  RECIPES,
} from "./config";
import {
  canBake,
  clockAt,
  drinkCoffee,
  goToBed,
  nap,
  type Job,
  canOpen,
  elapsed,
  mustOpen,
  ovens,
  ovensBusy,
  pastBedtime,
  slept,
  customer,
  dayInfo,
  displayCap,
  formatClock,
  pantryQty,
  recipe,
  stockCount,
  timeLeft,
} from "./logic";
import { baked, ovenWindow, rawSprite } from "./bakeart";
import { resumeJob } from "./kitchen";
import { openShop } from "./shop";

// The kitchen at night: tomorrow's forecast, the hours left, what is on the
// display, and the way to the market, the recipe book, the oven and the door.

export function drawHub(app: App) {
  const { ctx, save } = app;
  const tr = app.tr();
  const v = viewRect(app);
  cover(ctx, app.sprites.get("bg-kitchen"), v, 0.45);
  const y0 = hud(app, formatClock(clockAt(save.night)), {
    settings: () => app.go({ kind: "settings", confirm: 0 }),
    pause: true,
  });

  // ---- tomorrow
  const info = dayInfo(save);
  const locale = app.rt.locale();
  // The weekday is on the calendar above; the card leads with the weather
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
  const fc = weatherCard(app, 18, y0 + 4, W - 36, {
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

  // ---- the night: time to the next wall, and ways to get some energy back
  const left = timeLeft(save);
  const wy = fc.y + fc.h + 12;
  const timeLine = slept(save)
    ? canOpen(save)
      ? tr.openNow
      : tr.beforeOpen(left)
    : pastBedtime(save)
      ? tr.lateNight(left)
      : tr.beforeBed(left - (LATEST_BED - BEDTIME));
  const cups = pantryQty(save, "coffee");
  const noTime = () => app.toast(tr.noTime, W / 2, wy - 10, C.bad, 18);
  toolbar(app, 18, wy, W - 36, [
    {
      kind: "info",
      icon: {
        name: "clock",
        fallback: (cx, cy, s) =>
          clockIcon(ctx, cx, cy, s * 0.45, clockAt(save.night)),
      },
      text: timeLine,
      color: pastBedtime(save) ? C.warn : C.text,
    },
    {
      kind: "button",
      key: "ff",
      w: 58,
      active: app.fast,
      icon: {
        name: "fastforward",
        fallback: (cx, cy) => text(ctx, "▶▶", cx, cy, { size: 16 }),
      },
      onTap: () => {
        app.fast = !app.fast;
      },
    },
    {
      kind: "button",
      key: "nap",
      w: 100,
      label: tr.napLabel,
      disabled: left < NAP_MINUTES,
      onDisabled: noTime,
      onTap: () => {
        const r = nap(save);
        if (!r.ok) return noTime();
        app.commit(r.save);
        app.toast("+⚡", W - 170, wy - 6, C.good, 22);
      },
    },
    {
      kind: "button",
      key: "coffee",
      w: 84,
      icon: {
        name: "ing-coffee",
        sprite: true,
        fallback: () => undefined,
      },
      count: cups,
      disabled: cups < 1,
      onDisabled: () => app.toast(tr.noCoffee, W / 2, wy - 10, C.bad, 18),
      onTap: () => {
        const r = drinkCoffee(save);
        if (!r.ok) return;
        app.sfx.good();
        app.commit(r.save);
        app.toast("+⚡", W - 70, wy - 6, C.good, 22);
      },
    },
  ]);

  // ---- the worktop: pinned to the counter painted in bg-kitchen (its top
  // surface sits at 56% of the picture), so it never drifts on other screens
  const worktop = coverY(app.sprites.get("bg-kitchen"), v, 0.555, 0.45);
  const bob = Math.sin(app.time * 2) * 2;
  // Batches left proofing or cooling sit on the worktop; ovens show what bakes
  const waits = save.jobs.filter((j) => j.kind === "wait");
  const inOvens = save.jobs.filter((j) => j.kind === "oven");
  if (waits[0]) {
    jobSpot(
      app,
      waits[0],
      { x: 104, y: worktop + 8, w: 150, h: 120 },
      waits[0].recipe === "shortcake" ? "sponge-cooling" : "dough-proofed",
    );
  } else {
    onTable(ctx, app.sprites.get("tool-bowl"), 104, worktop + 8, 140, 110);
  }
  if (ovens(save) > 1) ovenSpot(app, inOvens[1], 250, worktop + 8, 150, 140);
  else onTable(ctx, app.sprites.get("tool-scale"), 232, worktop + 8, 100, 100);
  ovenSpot(app, inOvens[0], 418, worktop + 8, 190, 180);
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

  // ---- the display case: a button to its own screen, with a peek inside
  const dy = H - 330;
  const pressed = app.ui.isPressed("display");
  const dp = { x: 18, y: dy + (pressed ? 3 : 0), w: W - 36, h: 112 };
  framed(ctx, dp, "#fff8eb", 24, pressed ? 2 : 5);
  const count = stockCount(save.stock);
  const caseImg = app.sprites.get("display-case");
  if (caseImg?.naturalWidth)
    sprite(ctx, caseImg, dp.x + 52, dp.y + dp.h / 2 + 2, 70, 88);
  text(ctx, tr.display(count, displayCap(save)), dp.x + 98, dp.y + 28, {
    size: 19,
    align: "left",
  });
  if (!save.stock.length) {
    text(ctx, tr.emptyDisplay, dp.x + 98, dp.y + 68, {
      size: 17,
      align: "left",
      fill: C.muted,
    });
  } else {
    const peek = save.stock.slice(0, 5);
    peek.forEach((g, i) => {
      const cx = dp.x + 122 + i * 66;
      sprite(
        ctx,
        app.sprites.get(recipe(g.recipe).sprite),
        cx,
        dp.y + 70,
        48,
        42,
      );
      text(ctx, `×${g.count}`, cx + 22, dp.y + 50, { size: 13, fill: C.text });
    });
  }
  // A chevron: this opens
  text(ctx, "›", dp.x + dp.w - 26, dp.y + dp.h / 2, {
    size: 40,
    fill: C.muted,
  });
  app.ui.add({
    rect: dp,
    key: "display",
    tap: () => {
      app.sfx.tap();
      app.go({ kind: "display" });
    },
  });

  // ---- a hint for what to do next
  const hint = nextHint(app);
  if (hint) {
    const lines2 = wrap(ctx, hint, W - 90, 18);
    const hh = 18 + lines2.length * 24;
    const hy = dy - hh - 12;
    framed(ctx, { x: 30, y: hy, w: W - 60, h: hh }, C.white, 18, 3);
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
  const awake = !slept(save);
  if (awake) {
    btn(
      app,
      "bed",
      { x: 18, y: cy, w: 190, h: 70 },
      `${tr.sleep}`,
      () => sleepNow(app),
      {
        fill: "#c9cdea",
        size: 24,
      },
    );
  }
  if (mustOpen(save)) {
    app.toast(tr.autoOpened, W / 2, 330, C.text, 20);
    openShop(app);
    return;
  }
  const open = canOpen(save);
  btn(
    app,
    "open",
    awake
      ? { x: 220, y: cy, w: W - 238, h: 70 }
      : { x: 18, y: cy, w: W - 36, h: 70 },
    open ? `${tr.open}  ▶` : tr.openAt,
    () => openShop(app),
    {
      fill: pulse && Math.sin(app.time * 5) > 0 ? "#c9f0a6" : C.green,
      size: open ? 28 : 22,
      disabled: !open,
    },
  );

  // 22:00: ask once a night; 1:00: bed, no choice
  if (awake && left <= 0) {
    bedtimeSheet(app, tr.mustSleep, false);
  } else if (awake && pastBedtime(save) && askedDay !== save.day) {
    bedtimeSheet(app, tr.bedtimeAsk, true);
  }
  drawSleep(app);
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

/** One oven on the worktop: dark when empty, glowing with a countdown while it bakes. Tap to tend it. */
function ovenSpot(
  app: App,
  job: Job | undefined,
  cx: number,
  bottom: number,
  w: number,
  h: number,
) {
  const { ctx } = app;
  const img = app.sprites.get("tool-oven");
  onTable(ctx, img, cx, bottom, w, h);
  const win = ovenWindow(img, cx, bottom, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(win.x, win.y, win.w, win.h);
  ctx.clip();
  if (!job) {
    ctx.fillStyle = "#4a2c20";
    ctx.fillRect(win.x, win.y, win.w, win.h);
    ctx.restore();
    return;
  }
  ctx.fillStyle = `rgba(255, ${150 + Math.sin(app.time * 6) * 20}, 60, 0.85)`;
  ctx.fillRect(win.x, win.y, win.w, win.h);
  const k = progress(app, job);
  baked(
    ctx,
    app.sprites.get(rawSprite(job.recipe)),
    k,
    win.x + win.w / 2,
    win.y + win.h - 2,
    win.w * 0.7,
    win.h * 0.8,
    "bottom",
  );
  if (k > 1) {
    ctx.fillStyle = `rgba(40, 20, 10, ${Math.min(0.75, (k - 1) * 0.9)})`;
    ctx.fillRect(win.x, win.y, win.w, win.h);
  }
  ctx.restore();
  timerChip(app, job, cx, win.y - 14);
  app.ui.add({
    rect: { x: cx - w / 2, y: bottom - h, w, h },
    tap: () => {
      app.sfx.tap();
      resumeJob(app, job);
    },
  });
}

/** A proofing / cooling batch on the worktop. */
function jobSpot(
  app: App,
  job: Job,
  r: { x: number; y: number; w: number; h: number },
  art: string,
) {
  onTable(app.ctx, app.sprites.get(art), r.x, r.y, r.w, r.h);
  timerChip(app, job, r.x, r.y - r.h - 6);
  app.ui.add({
    rect: { x: r.x - r.w / 2, y: r.y - r.h, w: r.w, h: r.h },
    tap: () => {
      app.sfx.tap();
      resumeJob(app, job);
    },
  });
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
