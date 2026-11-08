// Tuning for Xếp Tầng. World units: the first slab is BASE × BASE on the ground
// plane (x, z); heights are counted in slabs. Checked by logic.test.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- slabs

/** Side of the first slab, and the most a slab can ever grow back to. */
export const BASE = 1;
/** A slab whose centre lands this close to the one below snaps exactly ("perfect"). */
export const PERFECT_TOL = 0.035;
/** An overlap thinner than this is a miss: no slab of near-zero width. */
export const MIN_OVERLAP = 0.004;
/** After this many perfects in a row, each further perfect grows the slab back. */
export const GROW_STREAK = 3;
/** How much a slab grows along its axis per streak perfect (capped at BASE). */
export const GROW = 0.06;

// ---------------------------------------------------------------- motion

/** A sliding slab's centre swings this far either side of the slab below. */
export const SPAN = 1.25;
/** Slide speed in units per second: gentle at first, a little faster each floor, then capped. */
export const SPEED_START = 1.5;
export const SPEED_STEP = 0.02;
export const SPEED_MAX = 3;

export const speedFor = (level: number) => Math.min(SPEED_MAX, SPEED_START + SPEED_STEP * Math.max(0, level));

// ---------------------------------------------------------------- colour

/** Hue turns this many degrees per floor, so the tower walks the colour wheel slowly. */
export const HUE_STEP = 5;

// ---------------------------------------------------------------- shell (game.ts / art.ts)

/** Pixels per world unit at zoom 1. */
export const SCALE = 132;
/** Slab thickness in world units. */
export const SLAB_H = 0.15;
/** The pedestal under the first slab, in world units. */
export const PLINTH_H = 1.4;
/** Where the tower's top face sits on screen while playing. */
export const PLAY_ANCHOR_Y = 510;
/** Floors per sky cycle stop: dawn → day → sunset → night → dawn again. */
export const SKY_FLOORS = 22;
