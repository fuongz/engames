import { mulberry32 } from "@web-games/core/math";
import {
  CAPACITY,
  EMPTY_TUBES,
  EXTRA_TUBES_PER_LEVEL,
  colorsFor,
} from "./config";

// Pure Water Sort rules: no DOM, no canvas. A tube is a list of colour ids from
// bottom to top; the renderer animates moves after they are applied here.

export type Tube = number[];

export interface Move {
  from: number;
  to: number;
  color: number;
  count: number;
}

export interface Board {
  level: number;
  capacity: number;
  tubes: Tube[];
  /** The starting layout, for Restart. */
  initial: Tube[];
  history: Move[];
  moves: number;
  extraTubes: number;
}

const clone = (tubes: Tube[]) => tubes.map((t) => [...t]);

// ---------------------------------------------------------------- rules

/** The colour on top and how many layers of it sit together there. */
export function topRun(tube: Tube) {
  if (tube.length === 0) return null;
  const color = tube[tube.length - 1];
  let count = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i--) count++;
  return { color, count };
}

/** Full of a single colour: done, and never a source again. */
export const isComplete = (tube: Tube, capacity: number) =>
  tube.length === capacity && tube.every((c) => c === tube[0]);

/** A pour moves the top run onto an empty tube or a matching top, as much as fits. */
export function canPour(
  tubes: Tube[],
  capacity: number,
  from: number,
  to: number,
) {
  if (from === to) return false;
  const src = tubes[from];
  const dst = tubes[to];
  const run = topRun(src);
  if (!run || dst.length >= capacity || isComplete(src, capacity)) return false;
  return dst.length === 0 || dst[dst.length - 1] === run.color;
}

function pourInto(
  tubes: Tube[],
  capacity: number,
  from: number,
  to: number,
): Move | null {
  if (!canPour(tubes, capacity, from, to)) return null;
  const run = topRun(tubes[from]);
  if (!run) return null;
  const count = Math.min(run.count, capacity - tubes[to].length);
  for (let i = 0; i < count; i++) {
    tubes[from].pop();
    tubes[to].push(run.color);
  }
  return { from, to, color: run.color, count };
}

export const isSolved = (tubes: Tube[], capacity: number) =>
  tubes.every((t) => t.length === 0 || isComplete(t, capacity));

// ---------------------------------------------------------------- solver

/**
 * Depth-first search with a visited set over canonical states (tube order does
 * not matter). Used to make sure every generated level can be solved without
 * boosters. Returns null when the node budget runs out.
 */
export function solvable(
  start: Tube[],
  capacity: number,
  budget = 60000,
): boolean | null {
  const seen = new Set<string>();
  const key = (tubes: Tube[]) =>
    tubes
      .map((t) => t.join(","))
      .sort()
      .join("|");
  let nodes = 0;
  const search = (tubes: Tube[]): boolean | null => {
    if (isSolved(tubes, capacity)) return true;
    const k = key(tubes);
    if (seen.has(k)) return false;
    seen.add(k);
    if (++nodes > budget) return null;
    let exhausted = false;
    for (let from = 0; from < tubes.length; from++) {
      const src = tubes[from];
      const run = topRun(src);
      if (!run) continue;
      const uniform = run.count === src.length;
      let triedEmpty = false;
      for (let to = 0; to < tubes.length; to++) {
        if (!canPour(tubes, capacity, from, to)) continue;
        const dst = tubes[to];
        if (dst.length === 0) {
          // Moving a one-colour tube into an empty one changes nothing; one empty target is enough
          if (uniform || triedEmpty) continue;
          triedEmpty = true;
        }
        const next = clone(tubes);
        pourInto(next, capacity, from, to);
        const r = search(next);
        if (r) return true;
        if (r === null) exhausted = true;
      }
    }
    return exhausted ? null : false;
  };
  return search(start);
}

// ---------------------------------------------------------------- levels

/** Shuffle every layer into the coloured tubes, then add the empty ones. Same level, same layout. */
export function generateLevel(level: number, capacity = CAPACITY): Tube[] {
  const colors = colorsFor(level);
  const rng = mulberry32(level * 7919 + 17);
  for (let attempt = 0; attempt < 200; attempt++) {
    const layers: number[] = [];
    for (let c = 0; c < colors; c++)
      for (let i = 0; i < capacity; i++) layers.push(c);
    for (let i = layers.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [layers[i], layers[j]] = [layers[j], layers[i]];
    }
    const tubes: Tube[] = [];
    for (let c = 0; c < colors; c++)
      tubes.push(layers.slice(c * capacity, (c + 1) * capacity));
    for (let e = 0; e < EMPTY_TUBES; e++) tubes.push([]);
    // Not already (nearly) done, and not a tube that starts complete
    if (tubes.some((t) => t.length > 0 && isComplete(t, capacity))) continue;
    if (solvable(tubes, capacity) !== true) continue;
    return tubes;
  }
  // Fallback that is always solvable: a striped layout (in practice never reached)
  const tubes: Tube[] = [];
  for (let c = 0; c < colors; c++)
    tubes.push(Array.from({ length: capacity }, (_, i) => (c + i) % colors));
  for (let e = 0; e < EMPTY_TUBES; e++) tubes.push([]);
  return tubes;
}

export function createBoard(level: number): Board {
  const tubes = generateLevel(level);
  return {
    level,
    capacity: CAPACITY,
    tubes: clone(tubes),
    initial: clone(tubes),
    history: [],
    moves: 0,
    extraTubes: 0,
  };
}

/** Apply a pour; returns the move (for the animation) or null if it is not allowed. */
export function pour(b: Board, from: number, to: number): Move | null {
  const m = pourInto(b.tubes, b.capacity, from, to);
  if (!m) return null;
  b.history.push(m);
  b.moves++;
  return m;
}

/** Take back the last pour. Extra tubes stay. */
export function undo(b: Board): Move | null {
  const m = b.history.pop();
  if (!m) return null;
  for (let i = 0; i < m.count; i++) {
    b.tubes[m.to].pop();
    b.tubes[m.from].push(m.color);
  }
  b.moves = Math.max(0, b.moves - 1);
  return m;
}

export const canAddTube = (b: Board) => b.extraTubes < EXTRA_TUBES_PER_LEVEL;

export function addTube(b: Board) {
  if (!canAddTube(b)) return false;
  b.tubes.push([]);
  b.extraTubes++;
  return true;
}

/** Back to the starting layout (any extra tube used this level stays used). */
export function restart(b: Board) {
  b.tubes = clone(b.initial);
  for (let i = 0; i < b.extraTubes; i++) b.tubes.push([]);
  b.history = [];
  b.moves = 0;
}

export const solved = (b: Board) => isSolved(b.tubes, b.capacity);
