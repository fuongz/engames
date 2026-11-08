import { GRID, HOME, HOME_COLUMN, LAST_TRACK, QUARTER, SIX, STARS, STARTS, TRACK_LEN } from "./config";

// The board and single moves, pure: shared by the rules (logic.ts), the
// computer (ai.ts) and the drawing (art.ts).

// ---------------------------------------------------------------- board geometry

export type Cell = [x: number, y: number];

/** The 52 loop squares, clockwise from the bottom-left colour's start square. */
export const TRACK: Cell[] = (() => {
  const t: Cell[] = [];
  for (let y = 13; y >= 9; y--) t.push([6, y]);
  for (let x = 5; x >= 0; x--) t.push([x, 8]);
  t.push([0, 7]);
  for (let x = 0; x <= 5; x++) t.push([x, 6]);
  for (let y = 5; y >= 0; y--) t.push([6, y]);
  t.push([7, 0]);
  for (let y = 0; y <= 5; y++) t.push([8, y]);
  for (let x = 9; x <= 14; x++) t.push([x, 6]);
  t.push([14, 7]);
  for (let x = 14; x >= 9; x--) t.push([x, 8]);
  for (let y = 9; y <= 14; y++) t.push([8, y]);
  t.push([7, 14]);
  t.push([6, 14]);
  return t;
})();

/** A square turned a quarter clockwise `k` times about the centre. */
export function rotate([x, y]: Cell, k: number): Cell {
  let c: Cell = [x, y];
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) c = [GRID - 1 - c[1], c[0]];
  return c;
}

/** Track squares no one can be captured on: every start square and the four stars. */
export const SAFE = new Set([...STARTS, ...STARS]);

/** Which loop square (0..51, from the bottom-left start) a colour's progress `pos` sits on. */
export const loopIndex = (corner: number, pos: number) => (corner * QUARTER + pos) % TRACK_LEN;

/** The board square of a token on the loop or in its home column; null in base or home. */
export function squareOf(corner: number, pos: number): Cell | null {
  if (pos < 0 || pos >= HOME) return null;
  if (pos <= LAST_TRACK) return TRACK[loopIndex(corner, pos)];
  // The bottom-left colour's column runs up from (7,13); the others are that turned
  return rotate([7, 13 - (pos - LAST_TRACK - 1)], corner);
}

/** Home-column squares of a colour, outside in (for painting). */
export const homeColumn = (corner: number): Cell[] =>
  Array.from({ length: HOME_COLUMN }, (_, i) => squareOf(corner, LAST_TRACK + 1 + i) as Cell);

// ---------------------------------------------------------------- moves

/** Where a token at `pos` lands with `die`, or null if it can't move. */
export function target(pos: number, die: number): number | null {
  if (pos >= HOME) return null;
  if (pos < 0) return die === SIX ? 0 : null;
  return pos + die <= HOME ? pos + die : null;
}

/** Tokens that can move with `die`. */
export const legalTokens = (tokens: readonly number[], die: number) => tokens.flatMap((p, t) => (target(p, die) === null ? [] : [t]));

/** Movable tokens with identical moves folded together (all tokens in base, or stacked on one square). */
export function distinctMoves(tokens: readonly number[], movable: readonly number[]) {
  const seen = new Set<number>();
  return movable.filter((t) => {
    if (seen.has(tokens[t])) return false;
    seen.add(tokens[t]);
    return true;
  });
}

/** Opponent tokens a move to `to` would send home: everyone else on that loop square, unless it is safe. */
export function capturesAt(players: readonly { corner: number; tokens: readonly number[] }[], me: number, to: number) {
  const hits: { player: number; token: number }[] = [];
  if (to < 0 || to > LAST_TRACK) return hits;
  const at = loopIndex(players[me].corner, to);
  if (SAFE.has(at)) return hits;
  players.forEach((q, i) => {
    if (i === me) return;
    q.tokens.forEach((p, t) => {
      if (p >= 0 && p <= LAST_TRACK && loopIndex(q.corner, p) === at) hits.push({ player: i, token: t });
    });
  });
  return hits;
}

/** Progress for ranking and the computer: 0 in base, up to HOME + 1 at home. */
export const progressOf = (tokens: readonly number[]) => tokens.reduce((s, p) => s + p + 1, 0);
export const finished = (tokens: readonly number[]) => tokens.every((p) => p === HOME);

/** One decision: spend die `die` (0 or 1) on horse `token`. */
export interface Move {
  die: number;
  token: number;
}

/** Where `token` stands after `move` (own horses only; captures don't change what you can do). */
function afterOwn(tokens: readonly number[], m: Move, dice: readonly number[]) {
  const next = tokens.slice();
  next[m.token] = target(tokens[m.token], dice[m.die]) ?? tokens[m.token];
  return next;
}

/**
 * Every legal (die, horse) pair. Use as much of the roll as you can: while
 * both dice are unspent, a first move that would leave the other die
 * unplayable is only allowed when no first move keeps both playable.
 */
export function legalMoves(tokens: readonly number[], dice: readonly number[], used: readonly boolean[]): Move[] {
  const free = [0, 1].filter((i) => !used[i] && dice[i] > 0);
  const all = free.flatMap((die) => legalTokens(tokens, dice[die]).map((token) => ({ die, token })));
  if (free.length < 2) return all;
  const both = all.filter((m) => legalTokens(afterOwn(tokens, m, dice), dice[1 - m.die]).length > 0);
  return both.length ? both : all;
}

/** Legal moves with identical ones folded (same die value, horses on the same square). */
export function distinctOptions(tokens: readonly number[], dice: readonly number[], moves: readonly Move[]) {
  const seen = new Set<string>();
  return moves.filter((m) => {
    const key = `${dice[m.die]}:${tokens[m.token]}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
