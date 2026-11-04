// Tuning for Nối Thú. Genre conventions (classic Onet / "Pikachu") are noted as
// "classic"; everything else is our own, checked by logic.test.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- board

export const COLS = 8;
export const ROWS = 12;
/** Kinds of animal in the art (atlas cells, 6 per row). */
export const KINDS = 36;
/** classic: a path may bend at most twice (three straight segments). */
export const MAX_TURNS = 2;

/** Kinds on the board grow with the level: 12 at level 1, +4 a level, all 36 from level 7. */
export const kindsFor = (level: number) => Math.min(KINDS, 12 + 4 * (level - 1));

// ---------------------------------------------------------------- gravity

/**
 * classic: after every removed pair the tiles shift, a different way each level,
 * cycling every seven levels. "out" splits send each half to its own edge; "in"
 * splits pull both halves toward the middle line.
 */
export type Gravity =
  | "none"
  | "down"
  | "up"
  | "left"
  | "right"
  | "split-v-out"
  | "split-v-in"
  | "split-h-out"
  | "split-h-in";

export const CYCLE = 7;

/** Levels 1–7: none, down, up, left, right, top/bottom split, left/right split; splits alternate out/in each cycle. */
export function gravityFor(level: number): Gravity {
  const k = (level - 1) % CYCLE;
  const round = Math.floor((level - 1) / CYCLE);
  const dir = round % 2 === 0 ? "out" : "in";
  const order = ["none", "down", "up", "left", "right"] as const;
  if (k < order.length) return order[k];
  return k === 5 ? `split-v-${dir}` : `split-h-${dir}`;
}

// ---------------------------------------------------------------- timer

/** Seconds for a level: 300 at level 1, 4 s less each level, never under 150. */
export const timeFor = (level: number) => Math.max(150, 300 - 4 * (level - 1));
/** A freeze stops the clock this long. */
export const FREEZE_TIME = 10;

// ---------------------------------------------------------------- score

export const PAIR_POINTS = 10;
/** Matches this close together build a combo. */
export const COMBO_WINDOW = 3;
/** Each combo step adds this much to a pair, up to COMBO_MAX steps. */
export const COMBO_POINTS = 5;
export const COMBO_MAX = 10;
/** Clearing the board pays this much per second left on the clock. */
export const TIME_BONUS = 3;

// ---------------------------------------------------------------- boosters

export const START_HINTS = 3;
export const START_SHUFFLES = 2;
export const START_FREEZES = 2;
export const BOOSTER_MAX = 9;
/** Every cleared level gives a hint; every third level also a shuffle and a freeze. */
export const BONUS_EVERY = 3;

// ---------------------------------------------------------------- animation (game.ts)

export const LINE_TIME = 0.32;
export const SLIDE_DELAY = 0.16;
export const SLIDE_TIME = 0.18;
