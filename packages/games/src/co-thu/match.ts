// An online Cờ Thú match, pure: two seats, one game of logic.ts, an optional
// clock per move, resigning, and forfeits for a player who keeps timing out or
// stays away. The realtime room runs it (online.ts); a client only draws its
// snapshots. Plain JSON, no DOM, no clock of its own: time comes in as `dt`.
import { chooseMove } from "./ai";
import {
  DEFAULT_TURN,
  MATCH_DRAW_SCORE,
  MATCH_QUICK_BONUS,
  MATCH_QUICK_MOVES,
  MATCH_WIN_SCORE,
  MAX_TIMEOUTS,
  RECONNECT_SECONDS,
  type RedChoice,
  type TurnSeconds,
} from "./config";
import { BLUE, type Move, RED, type ResultReason, type Side, type State, applyMove, initialState, isLegal } from "./logic";

/** What a seat may ask for: a move, or to give up. */
export type Action = { type: "move"; from: number; to: number } | { type: "resign" };

export interface Seat {
  name: string;
  side: Side;
  /** Seconds since this player dropped, or null while connected. */
  away: number | null;
  /** Timed-out turns in a row. */
  timeouts: number;
  /** Moves made over the match. */
  moves: number;
}

/** Why the match ended: the board's own reasons, or a resignation, timeouts, or a player gone too long. */
export type OverReason = ResultReason | "resign" | "timeout" | "away";

export type MatchEvent =
  | { type: "move"; from: number; to: number; side: Side; auto: boolean }
  | { type: "over"; winner: number | null; reason: OverReason };

export interface Match {
  seats: Seat[];
  game: State;
  phase: "play" | "over";
  /** Seconds per move (0: no clock). */
  turn: TurnSeconds;
  /** Seconds left on the current move (meaningless when `turn` is 0). */
  clock: number;
  /** The winning seat once over; null for a draw. */
  winner: number | null;
  reason: OverReason | null;
  /** Seed for the moves the room plays on a timeout (kept as data so a snapshot is plain JSON). */
  seed: number;
  events: MatchEvent[];
}

/** Which seat plays Red: seat 0 is the host. */
export const redSeat = (choice: RedChoice, seed: number): number => (choice === "host" ? 0 : choice === "guest" ? 1 : (seed >>> 0) & 1);

export function createMatch(seed: number, names: string[], red: RedChoice = "host", turn: TurnSeconds = DEFAULT_TURN): Match {
  const r = redSeat(red, seed);
  return {
    seats: [0, 1].map((i) => ({
      name: names[i] ?? (i === r ? "Red" : "Blue"),
      side: i === r ? RED : BLUE,
      away: null,
      timeouts: 0,
      moves: 0,
    })),
    game: initialState(),
    phase: "play",
    turn,
    clock: turn,
    winner: null,
    reason: null,
    seed: seed >>> 0,
    events: [],
  };
}

export const seatOfSide = (m: Match, side: Side) => (m.seats[0].side === side ? 0 : 1);

function end(m: Match, winner: number | null, reason: OverReason) {
  m.phase = "over";
  m.winner = winner;
  m.reason = reason;
  m.events.push({ type: "over", winner, reason });
}

function play(m: Match, mv: Move, auto: boolean): boolean {
  if (!isLegal(m.game, mv)) return false;
  const side = m.game.turn;
  const seatNo = seatOfSide(m, side);
  const seat = m.seats[seatNo];
  m.game = applyMove(m.game, mv);
  seat.moves++;
  seat.timeouts = auto ? seat.timeouts + 1 : 0;
  m.clock = m.turn;
  m.events.push({ type: "move", from: mv.from, to: mv.to, side, auto });
  const r = m.game.result;
  if (r) end(m, r.winner === 0 ? null : seatOfSide(m, r.winner), r.reason);
  else if (seat.timeouts >= MAX_TIMEOUTS) end(m, 1 - seatNo, "timeout");
  return true;
}

/**
 * One step of `dt` seconds. `inputs[seat]` is what that seat asks for, or null.
 * Either seat may resign at any time; only the seat to move may move, and only
 * a legal move counts.
 */
export function stepMatch(m: Match, dt: number, inputs: readonly (Action | null)[]) {
  if (m.phase === "over") return;
  for (const [i, a] of inputs.entries()) if (a?.type === "resign" && m.seats[i]) return end(m, 1 - i, "resign");
  for (const [i, s] of m.seats.entries()) {
    if (s.away === null) continue;
    s.away += dt;
    if (s.away >= RECONNECT_SECONDS) return end(m, 1 - i, "away");
  }
  const mover = seatOfSide(m, m.game.turn);
  const a = inputs[mover];
  if (a?.type === "move" && play(m, { from: a.from, to: a.to }, false)) return;
  if (m.turn === 0) return;
  m.clock -= dt;
  if (m.clock > 0) return;
  // Out of time: the room plays a quick, sensible move for them
  const auto = chooseMove(m.game, "easy", m.seed);
  m.seed = (m.seed + 0x9e3779b9) >>> 0;
  if (auto) play(m, auto, true);
  else m.clock = m.turn;
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
  if (!s || m.phase !== "over") return 0;
  if (m.winner === null) return MATCH_DRAW_SCORE;
  if (m.winner !== seat) return 0;
  return MATCH_WIN_SCORE + Math.max(0, MATCH_QUICK_MOVES - s.moves) * MATCH_QUICK_BONUS;
}

/** What a client draws from: the match without pending events or the repetition keys. */
export const snapshotOf = (m: Match): Match => ({ ...m, events: [], game: { ...m.game, keys: [] } });

/** Parse an untrusted snapshot into a Match a client can draw, or null. */
export function parseMatch(raw: unknown): Match | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Partial<Match>;
  if (!Array.isArray(m.seats) || m.seats.length !== 2 || typeof m.game !== "object" || m.game === null) return null;
  if (m.phase !== "play" && m.phase !== "over") return null;
  if (!Array.isArray(m.game.board) || (m.game.turn !== RED && m.game.turn !== BLUE)) return null;
  return m as Match;
}
