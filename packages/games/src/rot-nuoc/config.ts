// Numbers marked "ad" were read off the reference recording (RE_NOTES.md); the
// rest is our own tuning, checked by logic.test.ts.

export const W = 540;
export const H = 960;

export const CAPACITY = 4; // ad: four layers per tube
export const EMPTY_TUBES = 2; // ad: two empty tubes at level 58
export const MAX_COLORS = 12;

/** From level 20, every even level has a single empty tube. */
export const ONE_EMPTY_FROM = 20;
export function emptiesFor(level: number) {
  return level >= ONE_EMPTY_FROM && level % 2 === 0 ? 1 : EMPTY_TUBES;
}

/**
 * Colours grow with the level: 4 at the start, one more every 3 levels, 12
 * from level 25. A one-empty-tube level is capped lower: random layouts with
 * one spare tube are almost never solvable past 8 colours, and 7–8 colours
 * with one spare is already the hardest board in the game.
 */
export function colorsFor(level: number) {
  const ramp = Math.min(MAX_COLORS, 4 + Math.floor((level - 1) / 3));
  if (emptiesFor(level) === 1) return Math.min(ramp, level >= 40 ? 8 : 7);
  return ramp;
}

/** From level 15, every third level hides each layer under the top as "?" until it is uncovered. */
export const HIDDEN_FROM = 15;
export const hiddenFor = (level: number) =>
  level >= HIDDEN_FROM && level % 3 === 0;

/** Solvable layouts generated per level; the one the solver finds hardest is kept. */
export const CANDIDATES = 5;

/** At most this many tubes per row; more than that wraps to a second row. */
export const ROW_MAX = 8;

// Liquid palette (ad: purple, indigo, olive, grey, red, pink, sky, green,
// orange), plus three more for the hardest levels.
export const COLORS = [
  "#7a2fa0", // purple
  "#3a32c8", // indigo
  "#6e8c16", // olive
  "#5c5c62", // grey
  "#c42a2c", // red
  "#ec5c78", // pink
  "#4aa0e8", // sky
  "#5ad270", // green
  "#ec8838", // orange
  "#f2d040", // yellow
  "#3ad0d0", // cyan
  "#8a5634", // brown
];

// ---------------------------------------------------------------- boosters

export const START_UNDOS = 3; // ad: "↶5", fewer to make levels count
export const START_TUBES = 2; // ad: "+🧪2"
export const MAX_UNDOS = 20;
/** Every second cleared level adds an undo. */
export const UNDO_EVERY = 2;
/** ad: the gift box "Claim". It fills over this many levels. */
export const GIFT_EVERY = 5;
export const GIFT_UNDOS = 3;
export const GIFT_TUBES = 1;
/** Only one extra tube per level, so it helps without solving the puzzle. */
export const EXTRA_TUBES_PER_LEVEL = 1;

/** The portal's save dialog appears every this many levels, not after each one. */
export const REPORT_EVERY = 5;

// ---------------------------------------------------------------- animation

export const POUR_TIME = 0.5;
export const LIFT = 26;
