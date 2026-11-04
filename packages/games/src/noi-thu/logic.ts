import { nextRandom } from "@web-games/core/math";
import {
  BONUS_EVERY,
  BOOSTER_MAX,
  COLS,
  COMBO_MAX,
  COMBO_POINTS,
  COMBO_WINDOW,
  FREEZE_TIME,
  type Gravity,
  KINDS,
  MAX_TURNS,
  PAIR_POINTS,
  ROWS,
  START_FREEZES,
  START_HINTS,
  START_SHUFFLES,
  TIME_BONUS,
  gravityFor,
  kindsFor,
  timeFor,
} from "./config";

// Pure rules for Nối Thú. The board is stored with a one-cell empty ring around
// it (classic: a path may run outside the tiles), so every grid below is
// (cols + 2) × (rows + 2) and the tiles live at x 1..cols, y 1..rows.

export const EMPTY = -1;

export interface Cell {
  x: number;
  y: number;
}

export interface Board {
  cols: number;
  rows: number;
  /** Kind per cell, row-major over the padded grid; EMPTY for none. */
  cells: number[];
}

export interface Pair {
  a: Cell;
  b: Cell;
  /** Corner points from a to b: 2 (straight) to 4 (two bends). */
  path: Cell[];
}

/** One tile slid by gravity, for the shell's animation. */
export interface Slide {
  from: Cell;
  to: Cell;
}

export type Phase = "play" | "won" | "over";

export interface Run {
  level: number;
  board: Board;
  score: number;
  /** Matches in a row, each within COMBO_WINDOW of the last. */
  combo: number;
  /** Seconds since the last match. */
  sinceMatch: number;
  time: number;
  timeMax: number;
  /** Seconds of freeze left. */
  frozen: number;
  hints: number;
  shuffles: number;
  freezes: number;
  phase: Phase;
  /** PRNG state for shuffles: the whole run is a plain, saveable object. */
  rng: { seed: number };
  /** Bonus paid when the level was cleared (shown on the win screen). */
  bonus: number;
}

// ---------------------------------------------------------------- board

const width = (b: Board) => b.cols + 2;
export const at = (b: Board, c: Cell) =>
  c.x < 0 || c.y < 0 || c.x > b.cols + 1 || c.y > b.rows + 1
    ? undefined
    : b.cells[c.y * width(b) + c.x];
const put = (b: Board, c: Cell, kind: number) => {
  b.cells[c.y * width(b) + c.x] = kind;
};
const free = (b: Board, c: Cell) => at(b, c) === EMPTY;
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

export function emptyBoard(cols = COLS, rows = ROWS): Board {
  return { cols, rows, cells: new Array((cols + 2) * (rows + 2)).fill(EMPTY) };
}

/** Board from rows of kinds ("." or -1 for empty); used by tests. */
export function boardFrom(rows: (number | ".")[][]): Board {
  const b = emptyBoard(rows[0].length, rows.length);
  for (const [y, row] of rows.entries())
    for (const [x, k] of row.entries()) put(b, { x: x + 1, y: y + 1 }, k === "." ? EMPTY : k);
  return b;
}

/** Every tile on the board, in reading order. */
export function tiles(b: Board): Cell[] {
  const out: Cell[] = [];
  for (let y = 1; y <= b.rows; y++)
    for (let x = 1; x <= b.cols; x++) if (!free(b, { x, y })) out.push({ x, y });
  return out;
}

export const cleared = (b: Board) => tiles(b).length === 0;

// ---------------------------------------------------------------- paths

/** Straight and clear between p and q (both ends excluded). */
function clearLine(b: Board, p: Cell, q: Cell) {
  if (p.x !== q.x && p.y !== q.y) return false;
  const dx = Math.sign(q.x - p.x);
  const dy = Math.sign(q.y - p.y);
  for (let x = p.x + dx, y = p.y + dy; x !== q.x || y !== q.y; x += dx, y += dy)
    if (!free(b, { x, y })) return false;
  return true;
}

const length = (path: Cell[]) =>
  path.slice(1).reduce((n, c, i) => n + Math.abs(c.x - path[i].x) + Math.abs(c.y - path[i].y), 0);

/**
 * The shortest path of at most MAX_TURNS bends joining a and b through empty
 * cells and the outer ring, as its corner points; null if there is none.
 * Fewer bends win over a shorter route.
 */
export function findPath(b: Board, a: Cell, c: Cell): Cell[] | null {
  if (same(a, c)) return null;
  // 0 bends
  if (clearLine(b, a, c)) return [a, c];
  // 1 bend: the corner shares a row with one end and a column with the other
  let best: Cell[] | null = null;
  for (const k of [{ x: a.x, y: c.y }, { x: c.x, y: a.y }]) {
    if (free(b, k) && clearLine(b, a, k) && clearLine(b, k, c)) {
      const p = [a, k, c];
      if (!best || length(p) < length(best)) best = p;
    }
  }
  if (best || MAX_TURNS < 2) return best;
  // 2 bends: walk out from a in each direction; from every empty cell p, turn
  // and meet c's row (or column) at q, then run straight into c
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let p = { x: a.x + dx, y: a.y + dy }; free(b, p); p = { x: p.x + dx, y: p.y + dy }) {
      const q = dx !== 0 ? { x: p.x, y: c.y } : { x: c.x, y: p.y };
      if (same(q, c) || !free(b, q)) continue;
      if (clearLine(b, p, q) && clearLine(b, q, c)) {
        const path = [a, p, q, c];
        if (!best || length(path) < length(best)) best = path;
      }
    }
  }
  return best;
}

/** a and b hold the same kind and can be joined. */
export function canMatch(b: Board, a: Cell, c: Cell): Cell[] | null {
  const k = at(b, a);
  if (k === undefined || k === EMPTY || k !== at(b, c)) return null;
  return findPath(b, a, c);
}

/** Any pair that can be removed right now (for the hint and deadlock check). */
export function findPair(b: Board): Pair | null {
  const byKind = new Map<number, Cell[]>();
  for (const t of tiles(b)) {
    const k = at(b, t) as number;
    const list = byKind.get(k) ?? [];
    list.push(t);
    byKind.set(k, list);
  }
  for (const list of byKind.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const path = findPath(b, list[i], list[j]);
        if (path) return { a: list[i], b: list[j], path };
      }
  }
  return null;
}

// ---------------------------------------------------------------- gravity

/**
 * Pack the tiles of one line (a column or a row, as cells in order) toward its
 * start, keeping their order. Returns the slides it made.
 */
function pack(b: Board, line: Cell[]): Slide[] {
  const kinds = line.map((c) => at(b, c) as number);
  const slides: Slide[] = [];
  let to = 0;
  kinds.forEach((k, from) => {
    if (k === EMPTY) return;
    if (from !== to) slides.push({ from: line[from], to: line[to] });
    to++;
  });
  const packed = kinds.filter((k) => k !== EMPTY);
  for (const [i, c] of line.entries()) put(b, c, i < packed.length ? packed[i] : EMPTY);
  return slides;
}

const column = (x: number, y0: number, y1: number) => {
  const out: Cell[] = [];
  const step = y1 >= y0 ? 1 : -1;
  for (let y = y0; y !== y1 + step; y += step) out.push({ x, y });
  return out;
};
const row = (y: number, x0: number, x1: number) => {
  const out: Cell[] = [];
  const step = x1 >= x0 ? 1 : -1;
  for (let x = x0; x !== x1 + step; x += step) out.push({ x, y });
  return out;
};

/** Shift every tile the level's way (classic: after each removed pair). */
export function applyGravity(b: Board, mode: Gravity): Slide[] {
  const { cols, rows } = b;
  const midY = Math.floor(rows / 2);
  const midX = Math.floor(cols / 2);
  const lines: Cell[][] = [];
  for (let x = 1; x <= cols; x++) {
    if (mode === "down") lines.push(column(x, rows, 1));
    if (mode === "up") lines.push(column(x, 1, rows));
    // Top half to the top edge, bottom half to the bottom edge
    if (mode === "split-v-out") lines.push(column(x, 1, midY), column(x, rows, midY + 1));
    // Both halves toward the middle line
    if (mode === "split-v-in") lines.push(column(x, midY, 1), column(x, midY + 1, rows));
  }
  for (let y = 1; y <= rows; y++) {
    if (mode === "left") lines.push(row(y, 1, cols));
    if (mode === "right") lines.push(row(y, cols, 1));
    if (mode === "split-h-out") lines.push(row(y, 1, midX), row(y, cols, midX + 1));
    if (mode === "split-h-in") lines.push(row(y, midX, 1), row(y, midX + 1, cols));
  }
  return lines.flatMap((line) => pack(b, line));
}

// ---------------------------------------------------------------- shuffle

/** Shuffle the kinds among the occupied cells until a pair exists (capped). */
export function shuffle(b: Board, rng: { seed: number }) {
  const cells = tiles(b);
  const kinds = cells.map((c) => at(b, c) as number);
  for (let attempt = 0; attempt < 200; attempt++) {
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom(rng) * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    for (const [i, c] of cells.entries()) put(b, c, kinds[i]);
    if (cells.length === 0 || findPair(b)) return;
  }
}

/** No pair left, but tiles remain: the board needs a shuffle. */
export const deadlocked = (b: Board) => !cleared(b) && !findPair(b);

// ---------------------------------------------------------------- levels

/**
 * A full board for `level`: kindsFor(level) kinds picked from the 36, each an
 * even number of times (pairs dealt round-robin), placed at random so at least
 * one pair is open. Same level and seed → same board.
 */
export function createBoard(level: number, seed: number, cols = COLS, rows = ROWS): Board {
  const rng = { seed: seed ^ Math.imul(level, 0x9e3779b1) };
  const pool = Array.from({ length: KINDS }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(rng) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const pairs = (cols * rows) / 2;
  const kinds = pool.slice(0, Math.min(kindsFor(level), pairs));
  const deck: number[] = [];
  for (let p = 0; p < pairs; p++) {
    const k = kinds[p % kinds.length];
    deck.push(k, k);
  }
  const b = emptyBoard(cols, rows);
  let i = 0;
  for (let y = 1; y <= rows; y++) for (let x = 1; x <= cols; x++) put(b, { x, y }, deck[i++]);
  shuffle(b, rng);
  return b;
}

/** A new run from level 1 (or a later level for tests). */
export function createRun(seed: number, level = 1): Run {
  const run: Run = {
    level,
    board: emptyBoard(),
    score: 0,
    combo: 0,
    sinceMatch: COMBO_WINDOW,
    time: 0,
    timeMax: 0,
    frozen: 0,
    hints: START_HINTS,
    shuffles: START_SHUFFLES,
    freezes: START_FREEZES,
    phase: "play",
    rng: { seed },
    bonus: 0,
  };
  startLevel(run, level);
  return run;
}

export function startLevel(run: Run, level: number) {
  run.level = level;
  run.board = createBoard(level, run.rng.seed);
  run.time = run.timeMax = timeFor(level);
  run.frozen = 0;
  run.combo = 0;
  run.sinceMatch = COMBO_WINDOW;
  run.phase = "play";
  run.bonus = 0;
}

// ---------------------------------------------------------------- play

export interface MatchResult {
  path: Cell[];
  kind: number;
  points: number;
  /** Combo step this match reached (0: no combo). */
  combo: number;
  slides: Slide[];
  /** The board had no pair left, so it was shuffled for free. */
  shuffled: boolean;
  cleared: boolean;
}

/** Points for a pair at combo step `combo`. */
export const pairPoints = (combo: number) =>
  PAIR_POINTS + COMBO_POINTS * Math.min(combo, COMBO_MAX);

/** Remove a and b if they match: score, gravity, deadlock shuffle, win. */
export function match(run: Run, a: Cell, b: Cell): MatchResult | null {
  if (run.phase !== "play") return null;
  const kind = at(run.board, a) as number;
  const path = canMatch(run.board, a, b);
  if (!path) return null;
  put(run.board, a, EMPTY);
  put(run.board, b, EMPTY);
  run.combo = run.sinceMatch < COMBO_WINDOW ? run.combo + 1 : 0;
  run.sinceMatch = 0;
  const points = pairPoints(run.combo);
  run.score += points;
  const slides = applyGravity(run.board, gravityFor(run.level));
  const done = cleared(run.board);
  let shuffled = false;
  if (done) win(run);
  else if (!findPair(run.board)) {
    shuffle(run.board, run.rng);
    shuffled = true;
  }
  return { path, kind, points, combo: run.combo, slides, shuffled, cleared: done };
}

function win(run: Run) {
  run.phase = "won";
  run.bonus = Math.ceil(run.time) * TIME_BONUS;
  run.score += run.bonus;
  run.hints = Math.min(BOOSTER_MAX, run.hints + 1);
  if (run.level % BONUS_EVERY === 0) {
    run.shuffles = Math.min(BOOSTER_MAX, run.shuffles + 1);
    run.freezes = Math.min(BOOSTER_MAX, run.freezes + 1);
  }
}

/** After the win screen. */
export const nextLevel = (run: Run) => startLevel(run, run.level + 1);

/** Advance the clock; returns true on the frame time runs out. */
export function tick(run: Run, dt: number): boolean {
  if (run.phase !== "play") return false;
  run.sinceMatch += dt;
  if (run.frozen > 0) {
    run.frozen = Math.max(0, run.frozen - dt);
    return false;
  }
  run.time = Math.max(0, run.time - dt);
  if (run.time > 0) return false;
  run.phase = "over";
  return true;
}

export function useHint(run: Run): Pair | null {
  if (run.phase !== "play" || run.hints <= 0) return null;
  const pair = findPair(run.board);
  if (pair) run.hints--;
  return pair;
}

export function useShuffle(run: Run): boolean {
  if (run.phase !== "play" || run.shuffles <= 0) return false;
  run.shuffles--;
  shuffle(run.board, run.rng);
  return true;
}

export function useFreeze(run: Run): boolean {
  if (run.phase !== "play" || run.freezes <= 0 || run.frozen > 0) return false;
  run.freezes--;
  run.frozen = FREEZE_TIME;
  return true;
}

/** A saved run, if it has the shape this version writes (else null: start over). */
export function parseRun(raw: unknown): Run | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Run;
  const ok =
    Number.isInteger(r.level) &&
    r.level >= 1 &&
    r.board?.cols === COLS &&
    r.board?.rows === ROWS &&
    Array.isArray(r.board.cells) &&
    r.board.cells.length === (COLS + 2) * (ROWS + 2) &&
    typeof r.score === "number" &&
    typeof r.time === "number" &&
    typeof r.rng?.seed === "number";
  if (!ok || r.phase === "over") return null;
  return { ...r, combo: 0, sinceMatch: COMBO_WINDOW };
}
