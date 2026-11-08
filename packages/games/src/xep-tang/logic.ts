// Pure rules for Xếp Tầng: the slab sliding over the tower, slicing what hangs
// over, perfect snaps, growing back, speed and score. Deterministic for a seed
// (the random state is a plain number), no DOM.
import { nextRandom } from "@web-games/core/math";
import { BASE, GROW, GROW_STREAK, HUE_STEP, MIN_OVERLAP, PERFECT_TOL, SPAN, speedFor } from "./config";

/** A slab's footprint: centre (x, z) on the ground plane, size w along x and d along z. */
export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
}

export type Axis = "x" | "z";

export interface Mover {
  axis: Axis;
  /** Centre along `axis`; the other coordinate matches the top slab. */
  pos: number;
  dir: 1 | -1;
}

export interface Run {
  /** mulberry32 state. */
  seed: number;
  phase: "ready" | "play" | "over";
  /** Hue of the first slab, in degrees. */
  hue0: number;
  /** [0] is the pedestal; every placed slab follows. */
  stack: Box[];
  mover: Mover;
  /** Slabs placed. */
  score: number;
  perfects: number;
  streak: number;
  bestStreak: number;
}

export type Drop =
  | {
      kind: "place";
      axis: Axis;
      /** The slab that stays on the tower. */
      box: Box;
      /** The part sliced off, falling away (null on a perfect). */
      cut: Box | null;
      perfect: boolean;
      streak: number;
      grew: boolean;
    }
  | { kind: "miss"; axis: Axis; box: Box };

const size = (b: Box, axis: Axis) => (axis === "x" ? b.w : b.d);
const centre = (b: Box, axis: Axis) => (axis === "x" ? b.x : b.z);
const along = (b: Box, axis: Axis, c: number, s: number): Box =>
  axis === "x" ? { ...b, x: c, w: s } : { ...b, z: c, d: s };

export const top = (r: Run) => r.stack[r.stack.length - 1];

/** Hue (degrees) of the slab on floor `level` (the pedestal is floor 0). */
export const hueFor = (r: Run, level: number) => (((r.hue0 + level * HUE_STEP) % 360) + 360) % 360;

/** The sliding slab where it is now. */
export function moverBox(r: Run): Box {
  return along(top(r), r.mover.axis, r.mover.pos, size(top(r), r.mover.axis));
}

/** The next slab comes in from a random end of the other axis, heading for the tower. */
function nextMover(r: Run, axis: Axis): Mover {
  const side = nextRandom(r) < 0.5 ? -1 : 1;
  return { axis, pos: centre(top(r), axis) + side * SPAN, dir: side === -1 ? 1 : -1 };
}

export function createRun(seed: number): Run {
  const r: Run = {
    seed: seed | 0,
    phase: "ready",
    hue0: 0,
    stack: [{ x: 0, z: 0, w: BASE, d: BASE }],
    mover: { axis: "x", pos: 0, dir: 1 },
    score: 0,
    perfects: 0,
    streak: 0,
    bestStreak: 0,
  };
  r.hue0 = Math.floor(nextRandom(r) * 360);
  r.mover = nextMover(r, "x");
  return r;
}

export function start(r: Run) {
  if (r.phase === "ready") r.phase = "play";
}

/** Slide the slab back and forth over the tower. */
export function tick(r: Run, dt: number) {
  if (r.phase !== "play") return;
  const m = r.mover;
  const c = centre(top(r), m.axis);
  // Unfold the bounce into a straight line of period 4·SPAN, move, fold it back
  const period = 4 * SPAN;
  const u = (((m.pos - c + SPAN + m.dir * speedFor(r.score) * dt) % period) + period) % period;
  if (u <= 2 * SPAN) {
    m.pos = c + u - SPAN;
  } else {
    m.pos = c + period - u - SPAN;
    m.dir = m.dir === 1 ? -1 : 1;
  }
}

/** The player taps: drop the slab where it is. */
export function drop(r: Run): Drop | null {
  if (r.phase !== "play") return null;
  const axis = r.mover.axis;
  const below = top(r);
  const s = size(below, axis);
  const c = centre(below, axis);
  const delta = r.mover.pos - c;
  const falling = moverBox(r);

  if (Math.abs(delta) <= PERFECT_TOL) {
    r.streak++;
    r.perfects++;
    r.bestStreak = Math.max(r.bestStreak, r.streak);
    const grown = r.streak >= GROW_STREAK ? Math.min(BASE, s + GROW) : s;
    const box = along(below, axis, c, grown);
    return place(r, { kind: "place", axis, box, cut: null, perfect: true, streak: r.streak, grew: grown > s });
  }

  const overlap = s - Math.abs(delta);
  if (overlap < MIN_OVERLAP) {
    r.phase = "over";
    r.streak = 0;
    return { kind: "miss", axis, box: falling };
  }
  r.streak = 0;
  const sign = Math.sign(delta);
  const box = along(below, axis, c + delta / 2, overlap);
  // The overhang: from the edge of the slab below out to the slab's own far edge
  const cut = along(below, axis, c + sign * (s / 2 + Math.abs(delta) / 2), Math.abs(delta));
  return place(r, { kind: "place", axis, box, cut, perfect: false, streak: 0, grew: false });
}

function place(r: Run, d: Drop & { kind: "place" }): Drop {
  r.stack.push(d.box);
  r.score++;
  r.mover = nextMover(r, d.axis === "x" ? "z" : "x");
  return d;
}

/** Parse a stored best-of record defensively (storage can hold anything). */
export const parseBest = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
