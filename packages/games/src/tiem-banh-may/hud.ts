import { type App, W, top } from "./app";
import { bolt, coinCounter, face, gear, heart, text } from "./art";
import { C } from "./art";
import { calendar, K, pauseButton, pill, roundButton } from "./kit";

// The bar across the top of every screen, built from the kit: coins, the
// record (in the kitchen) and the day on the first row; reputation,
// energy, mood, settings and the clock on the second. Every piece is one pill
// high.

/** Energy and mood pills keep one width as their numbers change. */
const STAT_W = 108;

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
  } = {},
) {
  const coins = opts.coins ?? app.save.coins;
  const { ctx, save } = app;
  const tr = app.tr();
  const y = top(app) + 14;
  coinCounter(ctx, 14, y, tr.num(coins), 50);
  // The day as a little desk calendar
  const cal = calendar(
    app,
    W - 14,
    y - 2,
    tr.weekdays[(save.day - 1) % 7],
    tr.day(save.day),
  );
  if (opts.music) recordDisc(app, cal.x - K.gap, y - 2, opts.music);

  const y2 = y + 58;
  const rep = pill(app, 14, y2, `${Math.round(save.rep)}`, {
    icon: {
      name: "heart",
      fallback: (cx, cy, s) => heart(ctx, cx, cy, s * 0.4),
    },
    minWidth: 78,
  });
  // Tapping a stat explains it
  const explain = (
    r: { x: number; y: number; w: number; h: number },
    stat: "rep" | "energy" | "mood",
  ) =>
    app.ui.add({
      rect: { x: r.x - 2, y: r.y - 6, w: r.w + 4, h: r.h + 12 },
      key: `stat-${stat}`,
      tap: () => {
        app.sfx.tap();
        app.info = stat;
      },
    });
  explain(rep, "rep");
  // Energy and mood as plain numbers out of 100, tinted when they run low
  const energy = pill(
    app,
    rep.x + rep.w + K.gap,
    y2,
    `${Math.round(save.energy)}/100`,
    {
      icon: {
        name: "energy",
        fallback: (cx, cy, s) => bolt(ctx, cx, cy, s * 0.42),
      },
      minWidth: STAT_W,
      color: save.energy < 25 ? C.bad : save.energy < 50 ? C.warn : C.text,
    },
  );
  const mood = pill(
    app,
    energy.x + energy.w + K.gap,
    y2,
    `${Math.round(save.mood)}/100`,
    {
      icon: {
        name: "mood",
        fallback: (cx, cy, s) => face(ctx, cx, cy, s * 0.42, save.mood),
      },
      minWidth: STAT_W,
      color: save.mood < 30 ? C.bad : C.text,
    },
  );
  explain(energy, "energy");
  explain(mood, "mood");
  const time = pill(app, W - 14, y2, clock, {
    align: "right",
    minWidth: 84,
  });
  // Round buttons stack leftwards from the clock
  let bx = time.x - K.gap - K.pill / 2;
  const cy = y2 + K.pill / 2;
  if (opts.settings) {
    roundButton(
      app,
      "settings",
      bx,
      cy,
      {
        name: "settings",
        fallback: (cx, cy, s) => gear(ctx, cx, cy, s * 0.46),
      },
      opts.settings,
    );
    bx -= K.pill + K.gap;
  }
  if (opts.pause) pauseButton(app, bx, cy);
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
