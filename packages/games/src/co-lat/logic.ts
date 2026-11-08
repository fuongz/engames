import { mulberry32 } from "@web-games/core/math";
import { chooseMove } from "./ai";
import {
  BETWEEN_GAMES,
  type BestOf,
  CELLS,
  DEFAULT_BEST_OF,
  GAME_WIN_SCORE,
  MATCH_MARGIN_BONUS,
  MATCH_WIN_SCORE,
  MAX_TIMEOUTS,
  RECONNECT_SECONDS,
  SIZE,
  TURN_SECONDS,
  maxGames,
  winsNeeded,
} from "./config";

// Reversi rules (the standard Othello rules), pure. One `Game` is one board; a
// `Match` is the online best-of-N the realtime room runs (online.ts), with turn
// clocks and forfeits.
//
// A move must outflank: the new disc and another disc of the mover's colour
// bracket an unbroken line of the opponent's discs, in any of the 8 directions,
// and every such line flips. A player with no legal move passes; when neither
// can move the game ends and the most discs wins.

/** 1 = Black (moves first), 2 = White. */
export type Side = 1 | 2;
export const BLACK: Side = 1;
export const WHITE: Side = 2;
export const other = (s: Side): Side => (s === 1 ? 2 : 1);

export const idx = (x: number, y: number) => y * SIZE + x;
export const inBoard = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

export const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** The standard opening: White on d4 and e5, Black on e4 and d5. */
export function startCells(): number[] {
  const cells = new Array(CELLS).fill(0);
  cells[idx(3, 3)] = WHITE;
  cells[idx(4, 4)] = WHITE;
  cells[idx(4, 3)] = BLACK;
  cells[idx(3, 4)] = BLACK;
  return cells;
}

/**
 * The discs `side` would turn over by playing `at`, nearest first in each
 * direction; empty when the move is illegal.
 */
export function flipsFor(cells: readonly number[], at: number, side: Side): number[] {
  if (!Number.isInteger(at) || at < 0 || at >= CELLS || cells[at] !== 0) return [];
  const x0 = at % SIZE;
  const y0 = Math.floor(at / SIZE);
  const opp = other(side);
  const out: number[] = [];
  for (const [dx, dy] of DIRS) {
    let x = x0 + dx;
    let y = y0 + dy;
    const line: number[] = [];
    while (inBoard(x, y) && cells[idx(x, y)] === opp) {
      line.push(idx(x, y));
      x += dx;
      y += dy;
    }
    if (line.length > 0 && inBoard(x, y) && cells[idx(x, y)] === side) out.push(...line);
  }
  return out;
}

export const isLegal = (cells: readonly number[], at: number, side: Side) => flipsFor(cells, at, side).length > 0;

/** Every square `side` may play, in board order. */
export function legalMoves(cells: readonly number[], side: Side): number[] {
  const out: number[] = [];
  for (let at = 0; at < CELLS; at++) if (cells[at] === 0 && isLegal(cells, at, side)) out.push(at);
  return out;
}

/** Disc counts: [black, white]. */
export function countDiscs(cells: readonly number[]): [number, number] {
  let b = 0;
  let w = 0;
  for (const c of cells) {
    if (c === 1) b++;
    else if (c === 2) w++;
  }
  return [b, w];
}

/** Distance in squares between two squares (the flip ripple runs outward from the move). */
export const distance = (a: number, b: number) => Math.max(Math.abs((a % SIZE) - (b % SIZE)), Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)));

// ---------------------------------------------------------------- one game

export interface Game {
  /** CELLS squares: 0 empty, 1 black, 2 white. */
  cells: number[];
  /** Who moves next (meaningless once the game is decided). */
  turn: Side;
  /** Squares in play order (passes are forced, so they are not recorded). */
  moves: number[];
  /** Who played each of `moves`. */
  movers: Side[];
  /** The side that had to pass after the last move, if any. */
  passed: Side | null;
  /** null while playing; the winner, or 0 for an equal count. */
  result: Side | 0 | null;
}

export function newGame(): Game {
  return { cells: startCells(), turn: BLACK, moves: [], movers: [], passed: null, result: null };
}

export const canPlay = (g: Game, at: number) => g.result === null && isLegal(g.cells, at, g.turn);

/**
 * Play the side-to-move's disc at `at`. Returns the discs it turned over, or
 * null (and no change) if the move is illegal. Hands the turn on, passing a
 * player who cannot move, and decides the game when neither can.
 */
export function play(g: Game, at: number): number[] | null {
  if (g.result !== null) return null;
  const side = g.turn;
  const flips = flipsFor(g.cells, at, side);
  if (flips.length === 0) return null;
  g.cells[at] = side;
  for (const f of flips) g.cells[f] = side;
  g.moves.push(at);
  g.movers.push(side);
  g.passed = null;
  const opp = other(side);
  if (legalMoves(g.cells, opp).length > 0) g.turn = opp;
  else if (legalMoves(g.cells, side).length > 0) {
    g.turn = side;
    g.passed = opp;
  } else {
    const [b, w] = countDiscs(g.cells);
    g.result = b === w ? 0 : b > w ? BLACK : WHITE;
  }
  return flips;
}

/** A game rebuilt from its moves (stops at the first illegal one). */
export function replay(moves: readonly number[]): Game {
  const g = newGame();
  for (const at of moves) if (!play(g, at)) break;
  return g;
}

/** Take back the last `n` moves. */
export function undo(g: Game, n = 1): Game {
  return replay(g.moves.slice(0, Math.max(0, g.moves.length - n)));
}

// ---------------------------------------------------------------- online match

export interface Seat {
  name: string;
  /** This game's colour: seat 0 is Black in odd games, White in even ones. */
  side: Side;
  wins: number;
  /** Disc margin summed over the games this seat won (for the score). */
  margin: number;
  /** Seconds since this player dropped, or null while connected. */
  away: number | null;
  /** Timed-out turns in a row. */
  timeouts: number;
}

export type MatchEvent =
  | { type: "place"; at: number; side: Side; flips: number[]; auto: boolean }
  | { type: "pass"; side: Side }
  | { type: "result"; winner: Side | 0; black: number; white: number }
  | { type: "game"; n: number; black: number }
  | { type: "over"; winner: number | null; forfeit: boolean };

export interface Match {
  /** Best of 1, 3 or 5, as the host chose. */
  bestOf: BestOf;
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

/** The seat playing Black in game `n`: colours swap every game. */
export const blackSeatOf = (n: number) => (n % 2 === 1 ? 0 : 1);

function seatSides(m: Match) {
  const b = blackSeatOf(m.n);
  for (const [i, s] of m.seats.entries()) s.side = i === b ? BLACK : WHITE;
}

export function createMatch(seed: number, names: string[], bestOf: BestOf = DEFAULT_BEST_OF): Match {
  const m: Match = {
    bestOf,
    seats: [0, 1].map((i) => ({
      name: names[i] ?? (i === 0 ? "1" : "2"),
      side: BLACK,
      wins: 0,
      margin: 0,
      away: null,
      timeouts: 0,
    })),
    game: newGame(),
    n: 1,
    phase: "play",
    clock: TURN_SECONDS,
    pause: 0,
    winner: null,
    forfeit: false,
    seed: seed >>> 0,
    events: [{ type: "game", n: 1, black: blackSeatOf(1) }],
  };
  seatSides(m);
  return m;
}

/** The seat playing `side` this game. */
export const seatOfSide = (m: Match, side: Side) => (m.seats[0]?.side === side ? 0 : 1);

function end(m: Match, winner: number | null, forfeit: boolean) {
  m.phase = "over";
  m.winner = winner;
  m.forfeit = forfeit;
  m.events.push({ type: "over", winner, forfeit });
}

function place(m: Match, at: number, auto: boolean) {
  const g = m.game;
  const side = g.turn;
  const flips = play(g, at);
  if (!flips) return false;
  const seat = m.seats[seatOfSide(m, side)];
  seat.timeouts = auto ? seat.timeouts + 1 : 0;
  m.events.push({ type: "place", at, side, flips, auto });
  m.clock = TURN_SECONDS;
  if (g.result === null) {
    if (g.passed) m.events.push({ type: "pass", side: g.passed });
    if (seat.timeouts >= MAX_TIMEOUTS) end(m, 1 - seatOfSide(m, side), true);
    return true;
  }
  const [black, white] = countDiscs(g.cells);
  m.events.push({ type: "result", winner: g.result, black, white });
  if (g.result !== 0) {
    const w = m.seats[seatOfSide(m, g.result)];
    w.wins++;
    w.margin += Math.abs(black - white);
  }
  const leader = m.seats.findIndex((s) => s.wins >= winsNeeded(m.bestOf));
  if (leader >= 0) end(m, leader, false);
  else if (m.n >= maxGames(m.bestOf)) {
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
      m.game = newGame();
      seatSides(m);
      m.phase = "play";
      m.clock = TURN_SECONDS;
      m.events.push({ type: "game", n: m.n, black: blackSeatOf(m.n) });
    }
    return;
  }
  const mover = seatOfSide(m, m.game.turn);
  const at = inputs[mover];
  if (at !== null && at !== undefined && place(m, at, false)) return;
  m.clock -= dt;
  if (m.clock > 0) return;
  // Out of time: the room plays the Normal computer's move for them
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

/** How the match went for a seat, once over. */
export function outcomeOf(m: Match, seat: number): "win" | "loss" | "draw" {
  return m.winner === null ? "draw" : m.winner === seat ? "win" : "loss";
}

/** Leaderboard score for a seat once the match is over. */
export function matchScore(m: Match, seat: number): number {
  const s = m.seats[seat];
  if (!s) return 0;
  if (m.winner === seat) return MATCH_WIN_SCORE + s.margin * MATCH_MARGIN_BONUS;
  return s.wins * GAME_WIN_SCORE;
}
