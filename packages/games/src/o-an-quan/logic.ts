import { mulberry32 } from "@web-games/core/math";
import { chooseMove } from "./ai";
import {
  BETWEEN_GAMES,
  type BestOf,
  CAPTURE_STEP,
  DAN_START,
  DEFAULT_BEST_OF,
  GAME_WIN_SCORE,
  MATCH_POINT_BONUS,
  MATCH_WIN_SCORE,
  MAX_PLIES,
  MAX_RELAYS,
  MAX_TIMEOUTS,
  PITS,
  QUAN_NON_MIN,
  QUAN_VALUE,
  RECONNECT_SECONDS,
  REFILL,
  REFILL_STEP,
  SOW_STEP,
  SWEEP_STEP,
  TAKE_STEP,
  TURN_SECONDS,
  maxGames,
  winsNeeded,
} from "./config";

// Ô Ăn Quan rules, pure. One `Game` is one board; a `Match` is the online
// best-of-N the realtime room runs (online.ts), with turn clocks and forfeits.
//
// A move: take every dân from one of your five pits and sow them one by one,
// either way round. Then look at the pit after the last one sown:
//   • a dân pit with stones → take them and keep sowing;
//   • a quan pit with anything in it → your turn ends;
//   • an empty pit → capture the pit after it (if it holds anything), then
//     again for every "empty, then full" pair that follows; two empties in a
//     row end the turn with nothing.
// Your row empty on your turn → put back one dân per pit from what you have
// captured, borrowing from the other side if you are short (repaid at the end).
// Both quan pits empty → each side keeps the dân left in its own row; most
// points wins (a dân is 1, a quan 10).

export type Seat = 0 | 1;
export const otherSeat = (s: Seat): Seat => (s === 0 ? 1 : 0);
export type Dir = 1 | -1;

export interface Move {
  pit: number;
  dir: Dir;
}

/** What happened during a move, in order, for the animation and the sounds. */
export type Step =
  | { k: "take"; pit: number; n: number }
  | { k: "drop"; pit: number }
  | { k: "capture"; pit: number; seat: Seat; dan: number; quan: boolean }
  | { k: "stop"; why: "quan" | "empty" | "young" | "loop" }
  | { k: "refill"; seat: Seat; own: number; borrowed: number }
  | { k: "sweep"; seat: Seat; dan: number }
  | { k: "end"; winner: Seat | null };

export interface Game {
  /** Dân in each of the PITS pits (quan pits can hold dân too). */
  dan: number[];
  /** Is the big quan stone still in pit 0 / pit 6? */
  quan: [boolean, boolean];
  /** Dân each seat has captured (and not yet put back). */
  caps: [number, number];
  /** Quan stones each seat has captured. */
  quans: [number, number];
  /** Dân each seat has borrowed from the other to refill its row. */
  debt: [number, number];
  turn: Seat;
  plies: number;
  /** With "no young quan": a quan pit with fewer than QUAN_NON_MIN dân can't be captured. */
  quanNon: boolean;
  over: boolean;
  /** Once over: the winner, or null for a draw. */
  winner: Seat | null;
  last: Move | null;
}

export const isQuanPit = (p: number) => p === 0 || p === 6;
/** Which quan stone (0 left, 1 right) a quan pit holds. */
const quanIdx = (p: number) => (p === 0 ? 0 : 1);
export const ownerOf = (p: number): Seat | null => (p >= 1 && p <= 5 ? 0 : p >= 7 && p <= 11 ? 1 : null);
export const rowOf = (s: Seat): number[] => (s === 0 ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11]);
export const wrap = (p: number) => ((p % PITS) + PITS) % PITS;

export const hasQuan = (g: Game, p: number) => isQuanPit(p) && g.quan[quanIdx(p)];
/** Anything in the pit at all. */
export const hasStones = (g: Game, p: number) => g.dan[p] > 0 || hasQuan(g, p);
/** Points in a pit. */
export const pitValue = (g: Game, p: number) => g.dan[p] + (hasQuan(g, p) ? QUAN_VALUE : 0);

export function newGame(first: Seat = 0, quanNon = false): Game {
  const dan = new Array(PITS).fill(DAN_START);
  dan[0] = 0;
  dan[6] = 0;
  return {
    dan,
    quan: [true, true],
    caps: [0, 0],
    quans: [0, 0],
    debt: [0, 0],
    turn: first,
    plies: 0,
    quanNon,
    over: false,
    winner: null,
    last: null,
  };
}

export const cloneGame = (g: Game): Game => ({
  ...g,
  dan: g.dan.slice(),
  quan: [g.quan[0], g.quan[1]],
  caps: [g.caps[0], g.caps[1]],
  quans: [g.quans[0], g.quans[1]],
  debt: [g.debt[0], g.debt[1]],
  last: g.last ? { ...g.last } : null,
});

/** Points a seat holds now: captures, less what it borrowed, plus what it lent. Board stones not included. */
export const pointsOf = (g: Game, s: Seat) => g.caps[s] + g.quans[s] * QUAN_VALUE - g.debt[s] + g.debt[otherSeat(s)];

export const canMove = (g: Game, m: Move) =>
  !g.over && Number.isInteger(m.pit) && ownerOf(m.pit) === g.turn && g.dan[m.pit] > 0 && (m.dir === 1 || m.dir === -1);

export function legalMoves(g: Game): Move[] {
  if (g.over) return [];
  const out: Move[] = [];
  for (const pit of rowOf(g.turn)) {
    if (g.dan[pit] === 0) continue;
    out.push({ pit, dir: 1 }, { pit, dir: -1 });
  }
  return out;
}

/** Can the pit at `p` be captured right now? */
function capturable(g: Game, p: number) {
  if (!hasStones(g, p)) return false;
  return !(g.quanNon && hasQuan(g, p) && g.dan[p] < QUAN_NON_MIN);
}

function finish(g: Game, steps: Step[]) {
  // Each side keeps the dân left in its own row; anything left in a quan pit counts for nobody
  for (const s of [0, 1] as Seat[]) {
    let n = 0;
    for (const p of rowOf(s)) {
      n += g.dan[p];
      g.dan[p] = 0;
    }
    g.caps[s] += n;
    if (n > 0) steps.push({ k: "sweep", seat: s, dan: n });
  }
  g.over = true;
  const a = pointsOf(g, 0);
  const b = pointsOf(g, 1);
  g.winner = a === b ? null : a > b ? 0 : 1;
  steps.push({ k: "end", winner: g.winner });
}

/** The side to move has an empty row: put one dân back in each pit, borrowing if short. False if even that is impossible. */
function refill(g: Game, steps: Step[]): boolean {
  const s = g.turn;
  const o = otherSeat(s);
  const own = Math.min(g.caps[s], REFILL);
  const borrowed = REFILL - own;
  if (borrowed > g.caps[o]) return false;
  g.caps[s] -= own;
  g.caps[o] -= borrowed;
  g.debt[s] += borrowed;
  for (const p of rowOf(s)) g.dan[p] = 1;
  steps.push({ k: "refill", seat: s, own, borrowed });
  return true;
}

/** Hand the turn over, refilling or ending the game as needed. */
function nextTurn(g: Game, steps: Step[]) {
  if (!hasStones(g, 0) && !hasStones(g, 6)) return finish(g, steps);
  if (g.plies >= MAX_PLIES) return finish(g, steps);
  g.turn = otherSeat(g.turn);
  if (rowOf(g.turn).every((p) => g.dan[p] === 0) && !refill(g, steps)) finish(g, steps);
}

/**
 * Play `m` for the side to move. Returns what happened, step by step, or null
 * (and no change) if the move is not legal.
 */
export function play(g: Game, m: Move): Step[] | null {
  if (!canMove(g, m)) return null;
  const steps: Step[] = [];
  const me = g.turn;
  const { dir } = m;
  let pos = m.pit;
  let hand = g.dan[pos];
  g.dan[pos] = 0;
  steps.push({ k: "take", pit: pos, n: hand });
  let relays = 0;
  for (;;) {
    while (hand > 0) {
      pos = wrap(pos + dir);
      g.dan[pos]++;
      hand--;
      steps.push({ k: "drop", pit: pos });
    }
    const next = wrap(pos + dir);
    if (!isQuanPit(next) && g.dan[next] > 0) {
      if (++relays > MAX_RELAYS) {
        steps.push({ k: "stop", why: "loop" });
        break;
      }
      hand = g.dan[next];
      g.dan[next] = 0;
      pos = next;
      steps.push({ k: "take", pit: pos, n: hand });
      continue;
    }
    if (hasStones(g, next)) {
      steps.push({ k: "stop", why: "quan" });
      break;
    }
    // An empty pit: capture what follows, for as long as "empty, then full" repeats
    let empty = next;
    for (;;) {
      const target = wrap(empty + dir);
      if (!hasStones(g, target)) {
        steps.push({ k: "stop", why: "empty" });
        break;
      }
      if (!capturable(g, target)) {
        steps.push({ k: "stop", why: "young" });
        break;
      }
      const dan = g.dan[target];
      const quan = hasQuan(g, target);
      g.caps[me] += dan;
      g.dan[target] = 0;
      if (quan) {
        g.quan[quanIdx(target)] = false;
        g.quans[me]++;
      }
      steps.push({ k: "capture", pit: target, seat: me, dan, quan });
      empty = wrap(target + dir);
      if (hasStones(g, empty)) break;
    }
    break;
  }
  g.plies++;
  g.last = { pit: m.pit, dir };
  nextTurn(g, steps);
  return steps;
}

/** Seconds a move's steps take to play out on screen. */
export function stepsTime(steps: readonly Step[]): number {
  let t = 0;
  for (const s of steps) {
    if (s.k === "drop") t += SOW_STEP;
    else if (s.k === "take") t += TAKE_STEP;
    else if (s.k === "capture") t += CAPTURE_STEP;
    else if (s.k === "refill") t += REFILL_STEP;
    else if (s.k === "sweep") t += SWEEP_STEP;
  }
  return t;
}

/** Points each seat ends a finished game with. */
export const finalPoints = (g: Game): [number, number] => [pointsOf(g, 0), pointsOf(g, 1)];

// ---------------------------------------------------------------- online match

export interface MatchSeat {
  name: string;
  wins: number;
  /** Points over every finished game. */
  points: number;
  /** Seconds since this player dropped, or null while connected. */
  away: number | null;
  /** Timed-out turns in a row. */
  timeouts: number;
}

export type MatchEvent =
  | { type: "move"; seat: Seat; move: Move; steps: Step[]; auto: boolean }
  | { type: "game"; n: number; first: Seat }
  | { type: "over"; winner: number | null; forfeit: boolean };

export interface Match {
  bestOf: BestOf;
  quanNon: boolean;
  seats: MatchSeat[];
  game: Game;
  /** 1-based game number. */
  n: number;
  phase: "play" | "between" | "over";
  /** Seconds left on the current turn (includes the last move's playing-out time). */
  clock: number;
  /** Seconds left before the next game. */
  pause: number;
  /** The match winner's seat once over; null for a drawn match. */
  winner: number | null;
  forfeit: boolean;
  /** RNG state for timed-out moves, kept as data so a snapshot is plain JSON. */
  seed: number;
  events: MatchEvent[];
}

/** Seat 0 opens odd games, seat 1 even ones. */
export const firstOf = (n: number): Seat => (n % 2 === 1 ? 0 : 1);

export function createMatch(seed: number, names: string[], bestOf: BestOf = DEFAULT_BEST_OF, quanNon = false): Match {
  return {
    bestOf,
    quanNon,
    seats: [0, 1].map((i) => ({ name: names[i] ?? `P${i + 1}`, wins: 0, points: 0, away: null, timeouts: 0 })),
    game: newGame(firstOf(1), quanNon),
    n: 1,
    phase: "play",
    clock: TURN_SECONDS,
    pause: 0,
    winner: null,
    forfeit: false,
    seed: seed >>> 0,
    events: [{ type: "game", n: 1, first: firstOf(1) }],
  };
}

function endMatch(m: Match, winner: number | null, forfeit: boolean) {
  m.phase = "over";
  m.winner = winner;
  m.forfeit = forfeit;
  m.events.push({ type: "over", winner, forfeit });
}

function apply(m: Match, move: Move, auto: boolean): boolean {
  const g = m.game;
  const seat = g.turn;
  const steps = play(g, move);
  if (!steps) return false;
  const s = m.seats[seat];
  s.timeouts = auto ? s.timeouts + 1 : 0;
  m.events.push({ type: "move", seat, move, steps, auto });
  const playOut = stepsTime(steps);
  m.clock = TURN_SECONDS + playOut;
  if (!g.over) {
    if (s.timeouts >= MAX_TIMEOUTS) endMatch(m, otherSeat(seat), true);
    return true;
  }
  const pts = finalPoints(g);
  m.seats.forEach((x, i) => {
    x.points += Math.max(0, pts[i]);
  });
  if (g.winner !== null) m.seats[g.winner].wins++;
  const leader = m.seats.findIndex((x) => x.wins >= winsNeeded(m.bestOf));
  if (leader >= 0) endMatch(m, leader, false);
  else if (m.n >= maxGames(m.bestOf)) {
    const [a, b] = m.seats;
    endMatch(m, a.wins === b.wins ? null : a.wins > b.wins ? 0 : 1, false);
  } else {
    m.phase = "between";
    m.pause = BETWEEN_GAMES + playOut;
  }
  return true;
}

/**
 * One step of `dt` seconds. `inputs[seat]` is the move that seat wants, or
 * null. Only the seat whose turn it is can move.
 */
export function stepMatch(m: Match, dt: number, inputs: readonly (Move | null)[]) {
  if (m.phase === "over") return;
  for (const [i, s] of m.seats.entries()) {
    if (s.away === null) continue;
    s.away += dt;
    if (s.away >= RECONNECT_SECONDS) return endMatch(m, 1 - i, true);
  }
  if (m.phase === "between") {
    m.pause -= dt;
    if (m.pause <= 0) {
      m.n++;
      m.game = newGame(firstOf(m.n), m.quanNon);
      m.phase = "play";
      m.clock = TURN_SECONDS;
      m.events.push({ type: "game", n: m.n, first: m.game.turn });
    }
    return;
  }
  const mv = inputs[m.game.turn];
  if (mv && apply(m, mv, false)) return;
  m.clock -= dt;
  if (m.clock > 0) return;
  // Out of time: the room plays a sensible move for them
  const rand = mulberry32(m.seed);
  m.seed = (m.seed + 0x9e3779b9) >>> 0;
  const auto = chooseMove(m.game, "normal", rand);
  if (auto) apply(m, auto, true);
}

export function setAway(m: Match, seat: number, away: boolean) {
  const s = m.seats[seat];
  if (!s) return;
  s.away = away ? (s.away ?? 0) : null;
}

/** How the match went for a seat, once over. */
export function outcomeOf(m: Match, seat: number): "win" | "loss" | "draw" {
  return m.winner === null ? "draw" : m.winner === seat ? "win" : "loss";
}

/** Leaderboard score for a seat once the match is over. */
export function matchScore(m: Match, seat: number): number {
  const s = m.seats[seat];
  if (!s) return 0;
  if (m.winner === seat) return MATCH_WIN_SCORE + s.points * MATCH_POINT_BONUS;
  return s.wins * GAME_WIN_SCORE;
}
