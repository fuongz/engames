import { mulberry32 } from "@web-games/core/math";
import { chooseMove } from "./ai";
import {
  BETWEEN_GAMES,
  CELLS,
  GAME_WIN_SCORE,
  MATCH_QUICK_BONUS,
  MATCH_QUICK_MOVES,
  MATCH_WIN_SCORE,
  MATCH_WINS,
  MAX_GAMES,
  MAX_TIMEOUTS,
  RECONNECT_SECONDS,
  SIZE,
  TURN_SECONDS,
  WIN_LEN,
} from "./config";

// Caro rules, pure. One `Game` is one board; a `Match` is the online best-of-3
// the realtime room runs (online.ts), with turn clocks and forfeits.
//
// The Vietnamese rule ("chặn hai đầu"): five or more in a row wins, unless the
// opponent has a mark right past BOTH ends of the row. The board edge does not
// block.

/** 1 = X (red, moves first in game 1), 2 = O (blue). */
export type Side = 1 | 2;
export const other = (s: Side): Side => (s === 1 ? 2 : 1);

export const idx = (x: number, y: number) => y * SIZE + x;
export const inBoard = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/**
 * The winning run through `at` (its squares, end to end), or null. Assumes the
 * mark at `at` was just played.
 */
export function findWin(cells: readonly number[], at: number): number[] | null {
  const side = cells[at];
  if (side !== 1 && side !== 2) return null;
  const x0 = at % SIZE;
  const y0 = Math.floor(at / SIZE);
  for (const [dx, dy] of DIRS) {
    const run = [at];
    let x = x0 + dx;
    let y = y0 + dy;
    while (inBoard(x, y) && cells[idx(x, y)] === side) {
      run.push(idx(x, y));
      x += dx;
      y += dy;
    }
    const endA = inBoard(x, y) && cells[idx(x, y)] === other(side);
    x = x0 - dx;
    y = y0 - dy;
    while (inBoard(x, y) && cells[idx(x, y)] === side) {
      run.unshift(idx(x, y));
      x -= dx;
      y -= dy;
    }
    const endB = inBoard(x, y) && cells[idx(x, y)] === other(side);
    if (run.length >= WIN_LEN && !(endA && endB)) return run;
  }
  return null;
}

// ---------------------------------------------------------------- one game

export interface Game {
  /** CELLS squares: 0 empty, 1 X, 2 O. */
  cells: number[];
  /** Who moves next (meaningless once the game is decided). */
  turn: Side;
  /** Squares in play order. */
  moves: number[];
  /** null while playing; the winner, or 0 for a full board. */
  result: Side | 0 | null;
  /** The winning run, for the highlighter stroke. */
  line: number[] | null;
}

export function newGame(first: Side = 1): Game {
  return {
    cells: new Array(CELLS).fill(0),
    turn: first,
    moves: [],
    result: null,
    line: null,
  };
}

export const canPlay = (g: Game, at: number) => g.result === null && Number.isInteger(at) && at >= 0 && at < CELLS && g.cells[at] === 0;

/** Place the side-to-move's mark at `at`. False (and no change) if it is not a legal move. */
export function play(g: Game, at: number): boolean {
  if (!canPlay(g, at)) return false;
  g.cells[at] = g.turn;
  g.moves.push(at);
  const line = findWin(g.cells, at);
  if (line) {
    g.result = g.turn;
    g.line = line;
  } else if (g.moves.length >= CELLS) {
    g.result = 0;
  } else {
    g.turn = other(g.turn);
  }
  return true;
}

/** Take back the last move. False if there is none. */
export function undo(g: Game): boolean {
  const at = g.moves.pop();
  if (at === undefined) return false;
  g.turn = g.cells[at] as Side;
  g.cells[at] = 0;
  g.result = null;
  g.line = null;
  return true;
}

/** Moves `side` has made in this game. */
export const movesBy = (g: Game, side: Side) => g.moves.filter((at) => g.cells[at] === side).length;

// ---------------------------------------------------------------- online match

export interface Seat {
  name: string;
  /** Seat 0 always plays X, seat 1 always O; who goes first alternates. */
  side: Side;
  wins: number;
  /** Seconds since this player dropped, or null while connected. */
  away: number | null;
  /** Timed-out turns in a row. */
  timeouts: number;
  /** Moves made over the whole match. */
  moves: number;
}

export type MatchEvent =
  | { type: "place"; at: number; side: Side; auto: boolean }
  | { type: "win"; side: Side; line: number[] }
  | { type: "draw" }
  | { type: "game"; n: number; first: Side }
  | { type: "over"; winner: number | null; forfeit: boolean };

export interface Match {
  seats: Seat[];
  game: Game;
  /** 1-based game number. */
  n: number;
  phase: "play" | "between" | "over";
  /** Seconds left on the current turn. */
  clock: number;
  /** Seconds left before the next game starts. */
  pause: number;
  /** The match winner's seat once over; null for a drawn match. */
  winner: number | null;
  forfeit: boolean;
  /** RNG state for timed-out moves (kept as data so a snapshot is plain JSON). */
  seed: number;
  events: MatchEvent[];
}

/** Who goes first in game `n`: X in odd games, O in even ones. */
export const firstOf = (n: number): Side => (n % 2 === 1 ? 1 : 2);

export function createMatch(seed: number, names: string[]): Match {
  return {
    seats: [0, 1].map((i) => ({
      name: names[i] ?? (i === 0 ? "X" : "O"),
      side: (i + 1) as Side,
      wins: 0,
      away: null,
      timeouts: 0,
      moves: 0,
    })),
    game: newGame(firstOf(1)),
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

export const seatOf = (side: Side) => (side === 1 ? 0 : 1);

function end(m: Match, winner: number | null, forfeit: boolean) {
  m.phase = "over";
  m.winner = winner;
  m.forfeit = forfeit;
  m.events.push({ type: "over", winner, forfeit });
}

function place(m: Match, at: number, auto: boolean) {
  const g = m.game;
  const side = g.turn;
  if (!play(g, at)) return false;
  const seat = m.seats[seatOf(side)];
  seat.moves++;
  seat.timeouts = auto ? seat.timeouts + 1 : 0;
  m.events.push({ type: "place", at, side, auto });
  m.clock = TURN_SECONDS;
  if (g.result === null) {
    if (seat.timeouts >= MAX_TIMEOUTS) end(m, seatOf(other(side)), true);
    return true;
  }
  if (g.result === 0) m.events.push({ type: "draw" });
  else {
    m.seats[seatOf(g.result)].wins++;
    m.events.push({ type: "win", side: g.result, line: g.line ?? [] });
  }
  const leader = m.seats.findIndex((s) => s.wins >= MATCH_WINS);
  if (leader >= 0) end(m, leader, false);
  else if (m.n >= MAX_GAMES) {
    const [a, b] = m.seats;
    end(m, a.wins === b.wins ? null : a.wins > b.wins ? 0 : 1, false);
  } else {
    m.phase = "between";
    m.pause = BETWEEN_GAMES;
  }
  return true;
}

/**
 * One step of `dt` seconds. `inputs[seat]` is the square that seat wants to
 * play, or null. Only the seat whose turn it is can move.
 */
export function stepMatch(m: Match, dt: number, inputs: readonly (number | null)[]) {
  if (m.phase === "over") return;
  for (const [i, s] of m.seats.entries()) {
    if (s.away === null) continue;
    s.away += dt;
    if (s.away >= RECONNECT_SECONDS) return end(m, 1 - i, true);
  }
  if (m.phase === "between") {
    m.pause -= dt;
    if (m.pause <= 0) {
      m.n++;
      m.game = newGame(firstOf(m.n));
      m.phase = "play";
      m.clock = TURN_SECONDS;
      m.events.push({ type: "game", n: m.n, first: m.game.turn });
    }
    return;
  }
  const mover = seatOf(m.game.turn);
  const at = inputs[mover];
  if (at !== null && at !== undefined && place(m, at, false)) return;
  m.clock -= dt;
  if (m.clock > 0) return;
  // Out of time: the room plays a sensible move for them
  const rand = mulberry32(m.seed);
  m.seed = (m.seed + 0x9e3779b9) >>> 0;
  const auto = chooseMove(m.game.cells, m.game.turn, "normal", rand);
  if (auto >= 0) place(m, auto, true);
}

export function setAway(m: Match, seat: number, away: boolean) {
  const s = m.seats[seat];
  if (!s) return;
  s.away = away ? (s.away ?? 0) : null;
}

/** Leaderboard score for a seat once the match is over. */
export function matchScore(m: Match, seat: number): number {
  const s = m.seats[seat];
  if (!s) return 0;
  if (m.winner === seat) return MATCH_WIN_SCORE + Math.max(0, MATCH_QUICK_MOVES - s.moves) * MATCH_QUICK_BONUS;
  return s.wins * GAME_WIN_SCORE;
}
