import { type Move, SAFE, capturesAt, distinctOptions, legalMoves, loopIndex, progressOf, target } from "./board";
import { type Difficulty, HOME, LAST_TRACK, TRACK_LEN } from "./config";

// The computer player. Pure (runs on the phone and, for the computer's seats,
// autopilot and timed-out turns, in the realtime room). One decision spends
// one of the two dice on one horse.
//   Easy   — any legal move, at random.
//   Normal — a rule of thumb: capture > leave base > reach safety > progress,
//            and don't stop right in front of an opponent.
//   Hard   — the same priorities with exact two-dice odds (one die or
//            their sum), each token weighed by how far it has come, the leader
//            hunted first, and opponents it can reach next turn; with both
//            dice unspent it plans the pair (best first move + best second).
// Ludo is mostly dice; see RE_NOTES.md for how often each level wins
// (logic.test.ts keeps a floor under Hard and Normal vs Easy).

export interface Seat {
  corner: number;
  tokens: readonly number[];
}

/** Chance that a roll of two dice can carry a horse exactly d squares (one die, or both together). */
const REACH: number[] = Array.from({ length: 13 }, (_, d) => {
  let n = 0;
  for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) if (x === d || y === d || x + y === d) n++;
  return n / 36;
});

/**
 * Chance (0..1) that some opponent can land on loop square `at` on their next
 * turn. A token d squares behind needs a die showing d; with `exact`, both dice
 * adding up to d count too.
 */
function threat(players: readonly Seat[], me: number, at: number, exact: boolean) {
  if (SAFE.has(at)) return 0;
  let safe = 1;
  players.forEach((q, i) => {
    if (i === me) return;
    for (const p of q.tokens) {
      if (p < 0 || p > LAST_TRACK) continue;
      const d = (at - loopIndex(q.corner, p) + TRACK_LEN) % TRACK_LEN;
      // It must still be on the loop when it gets there (not turned up its home column)
      if (d === 0 || p + d > LAST_TRACK) continue;
      const chance = d > 12 ? 0 : exact ? REACH[d] : d <= 6 ? 11 / 36 : 0;
      safe *= 1 - chance;
    }
  });
  return 1 - safe;
}

/** The board after `me` moves `token` by `die` (captures included). */
function after(players: readonly Seat[], me: number, token: number, die: number): Seat[] {
  const to = target(players[me].tokens[token], die) ?? players[me].tokens[token];
  const hits = capturesAt(players, me, to);
  return players.map((q, i) => ({
    corner: q.corner,
    tokens: q.tokens.map((p, t) => {
      if (i === me && t === token) return to;
      return hits.some((h) => h.player === i && h.token === t) ? -1 : p;
    }),
  }));
}

/** Normal's rule of thumb for one move. */
function rule(players: readonly Seat[], me: number, token: number, die: number) {
  const { corner, tokens } = players[me];
  const from = tokens[token];
  const to = target(from, die);
  if (to === null) return -Infinity;
  let s = die * 0.5;
  const hits = capturesAt(players, me, to);
  if (hits.length) s += 60 + hits.reduce((a, h) => a + players[h.player].tokens[h.token], 0) * 0.4;
  if (from < 0) s += 35;
  if (to === HOME) s += 40;
  else if (to > LAST_TRACK && from <= LAST_TRACK) s += 28;
  else if (to <= LAST_TRACK && SAFE.has(loopIndex(corner, to))) s += 18;
  // Danger: stopping where someone can hit it next turn, and staying where someone could
  if (to <= LAST_TRACK) s -= threat(players, me, loopIndex(corner, to), false) * 6 * (12 + to * 0.4);
  if (from >= 0 && from <= LAST_TRACK) s += threat(players, me, loopIndex(corner, from), false) * 6 * (8 + from * 0.4);
  return s;
}

/** Hard's sharper rule for one move. */
function tactics(players: readonly Seat[], me: number, token: number, die: number) {
  const { corner, tokens } = players[me];
  const from = tokens[token];
  const to = target(from, die);
  if (to === null) return -Infinity;
  /** What losing a token at `p` would cost. */
  const worth = (p: number) => 14 + p;
  let s = die * 0.4;
  const lead = Math.max(...players.map((q, i) => (i === me ? -1 : progressOf(q.tokens))));
  for (const h of capturesAt(players, me, to)) {
    const q = players[h.player];
    s += 70 + q.tokens[h.token] * 0.8 + (progressOf(q.tokens) === lead ? 15 : 0);
  }
  if (from < 0) s += 38 + (tokens.every((p) => p < 0 || p >= HOME) ? 15 : 0);
  if (to === HOME) s += 45;
  // Into the home column: safe for good, the further it came the better
  else if (to > LAST_TRACK && from <= LAST_TRACK) s += 26 + from * 0.35;
  else if (to <= LAST_TRACK && SAFE.has(loopIndex(corner, to))) s += 14;
  const board = after(players, me, token, die);
  if (to <= LAST_TRACK) {
    const at = loopIndex(corner, to);
    s -= threat(board, me, at, true) * 6 * worth(to) * 0.4;
    // Opponents it could hit next turn
    players.forEach((q, i) => {
      if (i === me) return;
      for (const p of board[i].tokens) {
        if (p < 0 || p > LAST_TRACK) continue;
        const qa = loopIndex(q.corner, p);
        const d = (qa - at + TRACK_LEN) % TRACK_LEN;
        if (d >= 1 && d <= 6 && to + d <= LAST_TRACK && !SAFE.has(qa)) s += 3 + p * 0.08;
      }
    });
  }
  if (from >= 0 && from <= LAST_TRACK) s += threat(players, me, loopIndex(corner, from), true) * 6 * worth(from) * 0.4;
  return s;
}

/**
 * The die and horse for `players[me]`, from `moves` (the legal ones; must not
 * be empty). `rand` breaks ties and makes Easy vary.
 */
export function chooseMove(
  players: readonly Seat[],
  me: number,
  dice: readonly number[],
  used: readonly boolean[],
  moves: readonly Move[],
  level: Difficulty,
  rand: () => number,
): Move {
  const options = distinctOptions(players[me].tokens, dice, moves);
  if (options.length <= 1) return options[0] ?? moves[0] ?? { die: 0, token: 0 };
  if (level === "easy") return options[Math.floor(rand() * options.length)] ?? options[0];
  const score = level === "hard" ? tactics : rule;
  const plan = level === "hard" && !used[0] && !used[1];
  let best = options[0];
  let bestScore = -Infinity;
  for (const m of options) {
    let s = score(players, me, m.token, dice[m.die]);
    if (plan) {
      // Then the other die, from the board this move leaves
      const board = after(players, me, m.token, dice[m.die]);
      const spent = [false, false];
      spent[m.die] = true;
      let second = Number.NEGATIVE_INFINITY;
      for (const n of distinctOptions(board[me].tokens, dice, legalMoves(board[me].tokens, dice, spent)))
        second = Math.max(second, score(board, me, n.token, dice[n.die]));
      if (second > Number.NEGATIVE_INFINITY) s += second;
    }
    s += rand() * 0.01;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}
