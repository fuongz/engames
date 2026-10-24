import { type App, W, top } from "./app";
import { bolt, coinCounter, face, gear, heart } from "./art";
import { C } from "./art";
import { calendar, K, pauseButton, pill, roundButton } from "./kit";

// The bar across the top of every screen, built from the kit: coins and the
// day on the first row; reputation, energy, mood, settings and the clock on
// the second. Every piece is one pill high.

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
  } = {},
) {
  const coins = opts.coins ?? app.save.coins;
  const { ctx, save } = app;
  const tr = app.tr();
  const y = top(app) + 14;
  coinCounter(ctx, 14, y, tr.num(coins), 50);
  // The day as a little desk calendar
  calendar(
    app,
    W - 14,
    y - 2,
    tr.weekdays[(save.day - 1) % 7],
    tr.day(save.day),
  );

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
