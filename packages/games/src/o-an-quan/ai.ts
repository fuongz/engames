import { AI_DEPTH, type Difficulty, EASY_RANDOM } from "./config";
import { type Game, type Move, type Seat, cloneGame, finalPoints, legalMoves, otherSeat, play, pointsOf, rowOf } from "./logic";

// The computer player: negamax with alpha-beta over whole moves (a move's
// relays and captures are played out by logic.ts). The board is tiny (at most
// ten moves a turn), so Hard looks six plies ahead in a few milliseconds.

const WIN = 10_000;

/** How good the position is for `s`: points held, plus a share of the dân still in each row (they go to its owner at the end). */
function evaluate(g: Game, s: Seat): number {
  if (g.over) {
    const p = finalPoints(g);
    const d = p[s] - p[otherSeat(s)];
    return d === 0 ? 0 : Math.sign(d) * WIN + d;
  }
  const o = otherSeat(s);
  let mine = 0;
  let theirs = 0;
  for (const p of rowOf(s)) mine += g.dan[p];
  for (const p of rowOf(o)) theirs += g.dan[p];
  return pointsOf(g, s) - pointsOf(g, o) + 0.35 * (mine - theirs);
}

function negamax(g: Game, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || g.over) return evaluate(g, g.turn);
  let best = -Infinity;
  for (const m of legalMoves(g)) {
    const c = cloneGame(g);
    play(c, m);
    // A move always hands the turn over (or ends the game)
    const v = c.over ? evaluate(c, g.turn) : -negamax(c, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move for the side to move, or null if it has none. */
export function chooseMove(g: Game, level: Difficulty, rand: () => number): Move | null {
  const moves = legalMoves(g);
  if (moves.length === 0) return null;
  if (level === "easy" && rand() < EASY_RANDOM) return moves[Math.floor(rand() * moves.length)];
  // Shuffle first so equal moves don't always pick the leftmost pit
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  const depth = AI_DEPTH[level];
  let best = moves[0];
  let alpha = -Infinity;
  for (const m of moves) {
    const c = cloneGame(g);
    play(c, m);
    const v = c.over ? evaluate(c, g.turn) : -negamax(c, depth - 1, -Infinity, -alpha);
    if (v > alpha) {
      alpha = v;
      best = m;
    }
  }
  return best;
}
