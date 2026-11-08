import { GRID, HOME, HOME_COLUMN, LAST_TRACK, QUARTER, TRACK_LEN } from "./config";

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

/** A colour at the table, as the rules need it. */
export interface Seat {
  corner: number;
  tokens: readonly number[];
}

/** Doubles, or a 1 and a 6: it brings a horse out of base and earns another roll. */
export const isBonusRoll = (dice: readonly number[]) =>
  dice[0] > 0 && (dice[0] === dice[1] || (dice[0] === 1 && dice[1] === 6) || (dice[0] === 6 && dice[1] === 1));

/** How far a horse goes: both dice together, always on one horse. */
export const rollTotal = (dice: readonly number[]) => dice[0] + dice[1];

/**
 * Who stands on square `pos` (0..HOME-1) of `me`'s path, not counting `me`'s
 * horse `skip`: one of `me`'s own, a rival's (only on the shared loop), or nobody.
 */
export function occupant(players: readonly Seat[], me: number, pos: number, skip = -1): "own" | "rival" | null {
  const mine = players[me];
  if (mine.tokens.some((p, t) => t !== skip && p === pos)) return "own";
  if (pos > LAST_TRACK) return null;
  const at = loopIndex(mine.corner, pos);
  for (let i = 0; i < players.length; i++) {
    if (i === me) continue;
    const q = players[i];
    if (q.tokens.some((p) => p >= 0 && p <= LAST_TRACK && loopIndex(q.corner, p) === at)) return "rival";
  }
  return null;
}

/**
 * Where `me`'s horse `token` lands with `dice`, or null if it can't move.
 * Out of base only on a bonus roll, onto its start square. On the board it
 * goes the total of both dice, can't jump any horse (its own or a rival's),
 * can't stop on its own horse, and stopping on a rival captures it. Reaching
 * home needs the total or more: two dice never show 1, so an exact rule could
 * strand a horse one square short.
 */
export function destination(players: readonly Seat[], me: number, token: number, dice: readonly number[]): number | null {
  const from = players[me].tokens[token];
  if (from >= HOME) return null;
  if (from < 0) return isBonusRoll(dice) && occupant(players, me, 0, token) !== "own" ? 0 : null;
  const to = Math.min(HOME, from + rollTotal(dice));
  for (let p = from + 1; p < to; p++) if (occupant(players, me, p, token)) return null;
  if (to < HOME && occupant(players, me, to, token) === "own") return null;
  return to;
}

/** Rival tokens a move to `to` sends back to base: whoever stands on that loop square. */
export function capturesAt(players: readonly Seat[], me: number, to: number) {
  const hits: { player: number; token: number }[] = [];
  if (to < 0 || to > LAST_TRACK) return hits;
  const at = loopIndex(players[me].corner, to);
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

/** One decision: which horse takes the roll. */
export interface Move {
  token: number;
}

/** Every horse of `me` that can take this roll. */
export const legalMoves = (players: readonly Seat[], me: number, dice: readonly number[]): Move[] =>
  players[me].tokens.flatMap((_, token) => (destination(players, me, token, dice) === null ? [] : [{ token }]));

/** Legal moves with identical ones folded (horses on the same square: in base). */
export function distinctOptions(tokens: readonly number[], moves: readonly Move[]) {
  const seen = new Set<number>();
  return moves.filter((m) => {
    if (seen.has(tokens[m.token])) return false;
    seen.add(tokens[m.token]);
    return true;
  });
}
