// Small numeric helpers every game reaches for. Pure, so logic.ts files and
// their tests can use them as freely as game.ts.

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Edges inclusive, so a tap on a button's border still counts. */
export const inRect = (p: Point, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Smoothstep on 0..1, clamped: slow in, slow out. */
export const smoothstep = (k: number) =>
  k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);

export const easeOutCubic = (k: number) => 1 - (1 - clamp(k, 0, 1)) ** 3;

/**
 * Seeded PRNG returning floats in [0, 1). Use it for anything that must replay
 * the same way — level generation, waves, baked art — and keep `Math.random`
 * for pure decoration.
 */
export function mulberry32(seed: number) {
  const state = { seed };
  return () => nextRandom(state);
}

/**
 * The same generator over a state object you own: the sequence lives in a plain
 * number, so a game state holding it can be snapshotted and sent over the wire.
 */
export function nextRandom(state: { seed: number }) {
  state.seed |= 0;
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  const seed = state.seed;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type Rng = () => number;
