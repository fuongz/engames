import { type App, W, top } from "./app";
import {
  FONT,
  bolt,
  coin,
  dot,
  face,
  gear,
  heart,
  panel,
  text,
  weatherIcon,
} from "./art";
import { icon } from "./app";
import type { Weather } from "./config";
import { C } from "./art";
import { calendar, K, pauseGlyph, pill } from "./kit";

// The bar across the top of every screen, built from the kit: coins,
// reputation, energy and mood (plain numbers) on the first row and a desk
// calendar on the right (weekday, date, time, tomorrow's weather); round
// buttons run down the sides: the record on the left, pause and settings on
// the right.

/** The side columns: centres, and the distance from one button to the next. */
export const SIDE_X = { left: 14 + 26, right: W - 14 - 26 };
export const SIDE_STEP = 68;
/** The first side button's centre for columns starting at `top`. */
export const sideTop = (top: number) => top + 34;

/** How big a side icon is drawn. */
const SIDE_ICON = 58;

/**
 * A side button: the sticker icon `name` (img/<name>.webp) with a hard drop
 * shadow, or a cream disc with `fallback` drawn in it until the art loads.
 * Extras: a small tag under it (×2), a count on its corner, a red dot.
 */
export function sideIcon(
  app: App,
  key: string,
  cx: number,
  cy: number,
  name: string,
  fallback: (cx: number, cy: number) => void,
  onTap: () => void,
  extra: { tag?: string; count?: number; dot?: boolean; dim?: boolean } = {},
) {
  const { ctx } = app;
  const sink = app.ui.isPressed(key) ? 3 : 0;
  const img = app.sprites.get(name);
  ctx.save();
  if (extra.dim) ctx.globalAlpha *= 0.55;
  // A hard shadow under the sticker, like it stands off the screen
  ctx.shadowColor = "rgba(74, 44, 30, 0.55)";
  ctx.shadowOffsetY = sink ? 1 : 4;
  ctx.shadowOffsetX = sink ? 0 : 1;
  if (img?.naturalWidth) {
    const k = SIDE_ICON / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    ctx.drawImage(img, cx - w / 2, cy - h / 2 + sink, w, h);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy + sink, K.pill / 2 + 2, 0, Math.PI * 2);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy + sink, K.pill / 2 + 2, 0, Math.PI * 2);
    ctx.lineWidth = K.line;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    fallback(cx, cy + sink);
  }
  if (extra.tag) {
    ctx.font = `800 14px ${FONT}`;
    const w = ctx.measureText(extra.tag).width + 14;
    const t = { x: cx - w / 2, y: cy + SIDE_ICON / 2 - 12 + sink, w, h: 22 };
    panel(ctx, t, { fill: "#ffd6a8", radius: 11, line: 2.5 });
    text(ctx, extra.tag, cx, t.y + 11, { size: 14 });
  }
  if (extra.count !== undefined) {
    const bx = cx + SIDE_ICON / 2 - 8;
    const by = cy - SIDE_ICON / 2 + 8 + sink;
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fillStyle = extra.count ? C.good : C.muted;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    text(ctx, `${extra.count}`, bx, by, { size: 13, fill: C.white });
  }
  if (extra.dot) dot(ctx, cx + SIDE_ICON / 2 - 6, cy - SIDE_ICON / 2 + 6);
  const r = SIDE_ICON / 2 + 4;
  app.ui.add({
    rect: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r },
    key,
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}

/** Stat pills keep one width as their numbers change. */
const STAT_W = 70;

/** Draw the HUD; returns the y just under it. */
export function hud(
  app: App,
  clock: string,
  opts: {
    /** Coins to show (the shop counts the till up as the day goes). */
    coins?: number;
    /** Show the settings gear. */
    settings?: () => void;
    /** Show the pause button (screens where time runs). */
    pause?: boolean;
    /** Show the record by the calendar; tapping it opens the records. */
    music?: () => void;
    /** Tomorrow's weather as a badge on the calendar; tapping it opens the forecast. */
    forecast?: { weather: Weather; dot: boolean; onTap: () => void };
    /** Where the side buttons start going down (under the screen's own top row). */
    side?: number;
  } = {},
) {
  const coins = opts.coins ?? app.save.coins;
  const { ctx, save } = app;
  const tr = app.tr();
  const y = top(app) + 14;
  // A terracotta band across the top, like a shop awning's edge, that the
  // stats sit on
  {
    const v = app.rt.stage.view;
    const bandH = y - v.y + 52;
    ctx.fillStyle = "#c98a6a";
    ctx.fillRect(v.x, v.y, v.w, bandH);
    ctx.fillStyle = "#b07253";
    ctx.fillRect(v.x, v.y + bandH - 6, v.w, 6);
    ctx.fillStyle = "#6b4a3a";
    ctx.fillRect(v.x, v.y + bandH, v.w, 3);
  }

  // The day as a little desk calendar: tomorrow's weather, the date, the time
  const fc = opts.forecast;
  const pressed = !!fc && app.ui.isPressed("forecast");
  const cal = calendar(
    app,
    W - 14,
    y - 2 + (pressed ? 2 : 0),
    tr.weekdays[(save.day - 1) % 7],
    tr.day(save.day),
    {
      raised: true,
      time: clock,
      badge: fc
        ? (cx, cy) =>
            icon(app, `icon-${fc.weather}`, cx, cy, 30, () =>
              weatherIcon(ctx, cx, cy, fc.weather, 11),
            )
        : undefined,
    },
  );
  if (fc) {
    if (fc.dot) dot(ctx, cal.x + cal.w - 4, cal.y + 4);
    app.ui.add({
      rect: { x: cal.x - 4, y: cal.y - 8, w: cal.w + 8, h: cal.h + 12 },
      key: "forecast",
      tap: () => {
        app.sfx.tap();
        fc.onTap();
      },
    });
  }

  // Coins and the stats on one row, one pill high, plain numbers
  const y1 = y + 4;
  const cash = pill(app, 14, y1, tr.num(coins), {
    icon: {
      name: "coin",
      fallback: (cx, cy, s) => coin(ctx, cx, cy, s * 0.42),
    },
    minWidth: 104,
    raised: true,
  });
  // Tapping a stat explains it
  const explain = (
    r: { x: number; y: number; w: number; h: number },
    stat: "coins" | "rep" | "energy" | "mood",
  ) =>
    app.ui.add({
      rect: { x: r.x - 2, y: r.y - 6, w: r.w + 4, h: r.h + 12 },
      key: `stat-${stat}`,
      tap: () => {
        app.sfx.tap();
        app.info = stat;
      },
    });
  const rep = pill(
    app,
    cash.x + cash.w + K.gap,
    y1,
    `${Math.round(save.rep)}`,
    {
      icon: {
        name: "heart",
        fallback: (cx, cy, s) => heart(ctx, cx, cy, s * 0.4),
      },
      minWidth: STAT_W,
      raised: true,
    },
  );
  const energy = pill(
    app,
    rep.x + rep.w + K.gap,
    y1,
    `${Math.round(save.energy)}`,
    {
      icon: {
        name: "energy",
        fallback: (cx, cy, s) => bolt(ctx, cx, cy, s * 0.42),
      },
      minWidth: STAT_W,
      raised: true,
      color: save.energy < 25 ? C.bad : save.energy < 50 ? C.warn : C.text,
    },
  );
  const mood = pill(
    app,
    energy.x + energy.w + K.gap,
    y1,
    `${Math.round(save.mood)}`,
    {
      icon: {
        name: "mood",
        fallback: (cx, cy, s) => face(ctx, cx, cy, s * 0.42, save.mood),
      },
      minWidth: STAT_W,
      raised: true,
      color: save.mood < 30 ? C.bad : C.text,
    },
  );
  explain(cash, "coins");
  explain(rep, "rep");
  explain(energy, "energy");
  explain(mood, "mood");

  // Down the sides, evenly spaced, icons only: the record on the left;
  // pause and settings on the right (screens add theirs under them)
  const sy = sideTop(opts.side ?? y + 84);
  if (opts.music) {
    const onTap = opts.music;
    if (app.sprites.get("icon-music")?.naturalWidth)
      sideIcon(
        app,
        "musicbox",
        SIDE_X.left,
        sy,
        "icon-music",
        () => {},
        onTap,
        {
          dim: !save.playing,
        },
      );
    else recordDisc(app, SIDE_X.left + 27, sy - 27, onTap);
  }
  let ry = sy;
  if (opts.pause) {
    sideIcon(
      app,
      "pause",
      SIDE_X.right,
      ry,
      "icon-pause",
      (x, cy) => pauseGlyph(ctx, x, cy, K.icon),
      () => app.setPaused(true),
    );
    ry += SIDE_STEP;
  }
  if (opts.settings)
    sideIcon(
      app,
      "settings",
      SIDE_X.right,
      ry,
      "icon-settings",
      (x, cy) => gear(ctx, x, cy, K.icon * 0.46),
      opts.settings,
    );
  return y + 100;
}

/** Where each bakery's record has turned to, so it spins up and down smoothly. */
const spins = new WeakMap<App, { angle: number; last: number }>();

/**
 * The record by the calendar, a vinyl disc: playing, it spins and notes drift
 * up; off, it slows to a stop and dims. Tap it to choose a record.
 */
function recordDisc(app: App, right: number, y: number, onTap: () => void) {
  const { ctx, save } = app;
  const d = 54;
  const cx = right - d / 2;
  const cy = y + d / 2;
  const playing = !!save.playing;
  // 0 (off) .. 1 (playing): the turntable's speed, eased up and down
  const k = app.motion.slide("record", playing, 0.4);
  const spin = spins.get(app) ?? { angle: 0, last: app.time };
  const dt = Math.min(0.1, Math.max(0, app.time - spin.last));
  if (!app.motion.reduce) spin.angle += dt * 2.4 * k;
  spin.last = app.time;
  spins.set(app, spin);

  const vinyl = app.sprites.get("vinyl");
  const press = app.ui.isPressed("musicbox") ? 0.94 : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(press, press);
  ctx.globalAlpha *= 0.6 + 0.4 * k;
  // Lifted off the wall a little, like the things on the worktop
  ctx.shadowColor = "rgba(74, 40, 25, 0.35)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.rotate(spin.angle);
  if (vinyl?.naturalWidth) ctx.drawImage(vinyl, -d / 2, -d / 2, d, d);
  else {
    ctx.beginPath();
    ctx.arc(0, 0, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#2b2220";
    ctx.fill();
  }
  ctx.restore();
  // Notes drifting up while a record plays
  if (playing && !app.motion.reduce)
    for (let i = 0; i < 2; i++) {
      const t = (app.time * 0.6 + i * 0.5) % 1;
      ctx.save();
      ctx.globalAlpha = k * (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8);
      text(ctx, i ? "♫" : "♪", cx - 30 - i * 10, cy - 12 - t * 26, {
        size: 15,
        fill: "#c46a8a",
        outline: C.white,
      });
      ctx.restore();
    }
  app.ui.add({
    rect: { x: cx - d / 2 - 6, y: y - 6, w: d + 12, h: d + 12 },
    key: "musicbox",
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}
