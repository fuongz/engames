import { type Move, type Seat, capturesAt, destination, distinctOptions, loopIndex } from "./board";
import { type Difficulty, HOME, LAST_TRACK, TRACK_LEN } from "./config";

// The computer player. Pure (runs on the phone and, for the computer's seats,
// autopilot and timed-out turns, in the realtime room). One decision: which
// horse takes the roll (the two dice together).
//   Easy   — any legal move, at random.
//   Normal — a rule of thumb: capture > leave base > reach the home column >
//            progress, and don't stop where an opponent can hit it next turn.
//   Hard   — weighs the whole board the move leaves: every horse out is
//            worth a lot, more the further it has come, less the chance it
//            is hit next turn (exact two-dice odds, blocked paths included);
//            its own standing against the rivals' average, so a capture,
//            a horse brought out and a risky stop all fall out of one number.
//            A one-ply look at the rivals' replies was tried and was no
//            stronger.
// Ludo is mostly dice; see RE_NOTES.md for how often each level wins
// (logic.test.ts keeps a floor under Hard and Normal vs Easy).

/** Chance that two dice add up to d (2..12). */
const SUM: number[] = Array.from({ length: 13 }, (_, d) => (d < 2 ? 0 : (6 - Math.abs(d - 7)) / 36));
/** Chance of a bonus roll (doubles or 1-6), which brings a horse out onto its start square. */
const EXIT = 8 / 36;

/** Loop squares (0..51) that have a horse on them. */
function taken(players: readonly Seat[]) {
  const s = new Set<number>();
  for (const q of players) for (const p of q.tokens) if (p >= 0 && p <= LAST_TRACK) s.add(loopIndex(q.corner, p));
  return s;
}

/** Nobody stands on the d - 1 loop squares after `from`. */
function clear(occupied: Set<number>, from: number, d: number) {
  for (let k = 1; k < d; k++) if (occupied.has((from + k) % TRACK_LEN)) return false;
  return true;
}

/** Chance (0..1) that some opponent can land on loop square `at` on their next roll. */
function threat(players: readonly Seat[], me: number, at: number) {
  const occupied = taken(players);
  let safe = 1;
  players.forEach((q, i) => {
    if (i === me) return;
    // Coming out of base onto its start square
    if (loopIndex(q.corner, 0) === at && q.tokens.some((p) => p < 0)) safe *= 1 - EXIT;
    for (const p of q.tokens) {
      if (p < 0 || p > LAST_TRACK) continue;
      const qa = loopIndex(q.corner, p);
      const d = (at - qa + TRACK_LEN) % TRACK_LEN;
      // Two dice make 2..12; it must not have turned up its home column, nor jump anyone on the way
      if (d < 2 || d > 12 || p + d > LAST_TRACK || !clear(occupied, qa, d)) continue;
      safe *= 1 - SUM[d];
    }
  });
  return 1 - safe;
}

/** The board after `me` moves `token` to `to` (captures included). */
function after(players: readonly Seat[], me: number, token: number, to: number): Seat[] {
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
function rule(players: readonly Seat[], me: number, token: number, dice: readonly number[]) {
  const { corner, tokens } = players[me];
  const from = tokens[token];
  const to = destination(players, me, token, dice);
  if (to === null) return -Infinity;
  let s = (to - Math.max(from, 0)) * 0.25;
  const hits = capturesAt(players, me, to);
  if (hits.length) s += 60 + hits.reduce((a, h) => a + players[h.player].tokens[h.token], 0) * 0.4;
  if (from < 0) s += 35;
  if (to === HOME) s += 40;
  else if (to > LAST_TRACK && from <= LAST_TRACK) s += 28;
  // Danger: stopping where someone can hit it next turn, and staying where someone could
  const board = after(players, me, token, to);
  if (to <= LAST_TRACK) s -= threat(board, me, loopIndex(corner, to)) * 6 * (12 + to * 0.4);
  if (from >= 0 && from <= LAST_TRACK) s += threat(players, me, loopIndex(corner, from)) * 6 * (8 + from * 0.4);
  return s;
}

/** What a horse is worth to its colour: being out at all counts most, then how far it has come. */
const worth = (p: number) => (p < 0 ? 0 : 100 + Math.min(p, HOME));

/** One colour's standing: its horses' worth, less what it stands to lose next turn. */
function standing(board: readonly Seat[], who: number) {
  let s = 0;
  for (const p of board[who].tokens) {
    s += worth(p);
    if (p >= 0 && p <= LAST_TRACK) s -= threat(board, who, loopIndex(board[who].corner, p)) * worth(p);
  }
  return s;
}

/** Hard: the board the move leaves, its own standing against the rivals' average (a capture shows up there). */
function judge(players: readonly Seat[], me: number, token: number, dice: readonly number[]) {
  const to = destination(players, me, token, dice);
  if (to === null) return -Infinity;
  const board = after(players, me, token, to);
  let rivals = 0;
  for (let i = 0; i < board.length; i++) if (i !== me) rivals += standing(board, i);
  return standing(board, me) - rivals / (board.length - 1);
}

/**
 * The horse for `players[me]` to move by `dice`, from `moves` (the legal
 * ones; must not be empty). `rand` breaks ties and makes Easy vary.
 */
export function chooseMove(
  players: readonly Seat[],
  me: number,
  dice: readonly number[],
  moves: readonly Move[],
  level: Difficulty,
  rand: () => number,
): Move {
  const options = distinctOptions(players[me].tokens, moves);
  if (options.length <= 1) return options[0] ?? moves[0] ?? { token: 0 };
  if (level === "easy") return options[Math.floor(rand() * options.length)] ?? options[0];
  const score = level === "hard" ? judge : rule;
  let best = options[0];
  let bestScore = -Infinity;
  for (const m of options) {
    const s = score(players, me, m.token, dice) + rand() * 0.01;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best;
}
