// Numbers marked "ad" were read off the reference recording (RE_NOTES.md); the
// rest is our own tuning, checked by logic.test.ts.

export const W = 540;
export const H = 960;

export const CAPACITY = 4; // ad: four layers per tube
export const EMPTY_TUBES = 2; // ad: two empty tubes at level 58
export const MAX_COLORS = 12;

/** Colours grow with the level: 3 at the start, 9 by level 25 (the ad's level 58 has 9), 12 at most. */
export function colorsFor(level: number) {
  return Math.min(MAX_COLORS, 3 + Math.floor((level - 1) / 4));
}

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

export const START_UNDOS = 5; // ad: "↶5"
export const START_TUBES = 2; // ad: "+🧪2"
export const MAX_UNDOS = 20;
/** Every cleared level adds an undo. */
export const UNDO_PER_LEVEL = 1;
/** ad: the gift box "Claim". It fills over this many levels. */
export const GIFT_EVERY = 5;
export const GIFT_UNDOS = 3;
export const GIFT_TUBES = 1;
/** Only one extra tube per level, so it helps without solving the puzzle. */
export const EXTRA_TUBES_PER_LEVEL = 1;

/** The portal's save dialog appears every this many levels, not after each one. */
export const REPORT_EVERY = 5;

// ---------------------------------------------------------------- animation

export const POUR_TIME = 0.8;
export const LIFT = 26;
