import { nextRandom } from "@web-games/core/math";
import { chooseMove } from "./ai";
import { type Move, capturesAt, destination, distinctOptions, finished, isBonusRoll, legalMoves, progressOf } from "./board";
import {
  AUTO_MOVE_DELAY,
  BASE,
  BOT_MOVE_DELAY,
  BOT_ROLL_DELAY,
  CAPTURE_TIME,
  type Difficulty,
  HOME,
  HOP_TIME,
  MAX_BONUS,
  MAX_TIMEOUTS,
  MAX_TURNS,
  ONLINE_SCORE,
  PASS_TIME,
  ROLL_TIME,
  SEAT_ORDER,
  SETTLE_TIME,
  TOKENS,
} from "./config";

// Ludo rules, pure, the Vietnamese way (cờ cá ngựa): two dice a turn, their
// total moves one horse; doubles or 1-6 bring a horse out and roll again; no
// jumping over horses. One `Match` is one game at a table of 2–4 colours, paced in
// seconds (dice tumble, hops, the computer's pauses) so the same code runs the
// game on a phone and in the realtime room (online.ts) — the client only draws
// it. Positions are per-colour progress: BASE, 0..50 around the loop from the
// colour's own start square, 51..55 up its home column, HOME in the middle.

// ---------------------------------------------------------------- the match

export type Input = { kind: "roll" } | { kind: "move"; token: number };

export interface Player {
  /** Board corner, 0 bottom-left then clockwise; it fixes the colour. */
  corner: number;
  /** A person's name; empty for the computer (the client names it in its language). */
  name: string;
  /** Human seat (in the room, or on this phone); null for the computer. */
  seat: number | null;
  /** How the computer plays this seat (and a human's seat when it plays for them). */
  level: Difficulty;
  tokens: number[];
  /** 1-based finishing place, null while still playing. */
  place: number | null;
  /** Disconnected: the computer plays for them until they return. */
  away: boolean;
  /** Timed out too often: the computer plays for them until they tap again. */
  idle: boolean;
  timeouts: number;
  captures: number;
}

export type Phase = "roll" | "rolling" | "move" | "moving" | "pass" | "over";

export interface Anim {
  token: number;
  from: number;
  to: number;
  captured: { player: number; token: number; from: number }[];
}

export type MatchEvent =
  | { type: "turn"; player: number }
  | { type: "roll"; player: number; dice: number[]; auto: boolean }
  | { type: "move"; player: number; token: number; from: number; to: number; auto: boolean }
  | { type: "capture"; player: number; victim: number; token: number }
  | { type: "home"; player: number; token: number }
  | { type: "finish"; player: number; place: number }
  | { type: "pass"; player: number; reason: "none" | "three" }
  | { type: "over" };

export interface Match {
  /** In turn order (clockwise by corner). */
  players: Player[];
  /** Index into players of whoever is playing. */
  turn: number;
  phase: Phase;
  /** Seconds spent in this phase. */
  t: number;
  /** Bumped on every phase change, so a client can tell a new phase from a newer snapshot of the same one. */
  phaseId: number;
  /** The last roll, two dice (0 before the first). */
  dice: number[];
  /** Bonus rolls (doubles or 1-6) in a row this turn. */
  bonus: number;
  /** Horses the current player can move with the roll (phase "move"). */
  moves: Move[];
  /** The move being animated (phase "moving"). */
  anim: Anim | null;
  passReason: "none" | "three" | null;
  /** Seconds a human has per decision; 0 = no clock (offline). */
  turnSeconds: number;
  turns: number;
  /** RNG state, kept as data so a snapshot is plain JSON. */
  seed: number;
  events: MatchEvent[];
}

export interface MatchSetup {
  /** People's names, in seat order. */
  humans: string[];
  /** Seats at the table, 2–4; the computer fills the rest. */
  total: number;
  /** How the computer plays. */
  level: Difficulty;
  turnSeconds: number;
  /** Per computer seat, overriding `level` (tests pit levels against each other). */
  botLevels?: Difficulty[];
}

export function createMatch(seed: number, setup: MatchSetup): Match {
  const total = Math.min(4, Math.max(2, Math.max(setup.total, setup.humans.length)));
  const order = SEAT_ORDER[total];
  const players: Player[] = order.map((corner, i) => {
    const human = i < setup.humans.length;
    return {
      corner,
      name: human ? setup.humans[i] : "",
      seat: human ? i : null,
      level: human ? "normal" : (setup.botLevels?.[i - setup.humans.length] ?? setup.level),
      tokens: new Array(TOKENS).fill(BASE),
      place: null,
      away: false,
      idle: false,
      timeouts: 0,
      captures: 0,
    };
  });
  players.sort((a, b) => a.corner - b.corner);
  const m: Match = {
    players,
    turn: 0,
    phase: "roll",
    t: 0,
    phaseId: 0,
    dice: [0, 0],
    bonus: 0,
    moves: [],
    anim: null,
    passReason: null,
    turnSeconds: setup.turnSeconds,
    turns: 0,
    seed: seed >>> 0,
    events: [],
  };
  // Whoever starts is drawn at random
  m.turn = Math.floor(nextRandom(m) * players.length);
  m.events.push({ type: "turn", player: m.turn });
  return m;
}

/** The computer (or autopilot) plays this player's turn. */
export const isAuto = (p: Player) => p.seat === null || p.away || p.idle;

/** Seconds the current move takes to animate. */
export function moveTime(a: Anim | null) {
  if (!a) return 0;
  const hops = a.from < 0 ? 1 : a.to - a.from;
  return hops * HOP_TIME + (a.captured.length ? CAPTURE_TIME : 0) + SETTLE_TIME;
}

/** Seconds left on a human's decision online, or null when no clock runs. */
export function clockLeft(m: Match): number | null {
  const p = m.players[m.turn];
  if (!m.turnSeconds || !p || isAuto(p) || (m.phase !== "roll" && m.phase !== "move")) return null;
  return Math.max(0, m.turnSeconds - m.t);
}

function setPhase(m: Match, phase: Phase) {
  m.phase = phase;
  m.t = 0;
  m.phaseId++;
}

function roll(m: Match, auto: boolean) {
  m.dice = [1 + Math.floor(nextRandom(m) * 6), 1 + Math.floor(nextRandom(m) * 6)];
  if (isBonusRoll(m.dice)) m.bonus++;
  m.events.push({ type: "roll", player: m.turn, dice: m.dice.slice(), auto });
  setPhase(m, "rolling");
}

function afterRoll(m: Match) {
  if (isBonusRoll(m.dice) && m.bonus >= MAX_BONUS) {
    m.passReason = "three";
  } else {
    m.moves = legalMoves(m.players, m.turn, m.dice);
    m.passReason = m.moves.length ? null : "none";
  }
  if (m.passReason) {
    m.moves = [];
    m.events.push({ type: "pass", player: m.turn, reason: m.passReason });
    setPhase(m, "pass");
  } else setPhase(m, "move");
}

/** Move horse `token` of the current player by the roll. False if that isn't legal. */
function move(m: Match, token: number, auto: boolean): boolean {
  const p = m.players[m.turn];
  if (!m.moves.some((x) => x.token === token)) return false;
  const from = p.tokens[token];
  const to = destination(m.players, m.turn, token, m.dice);
  if (to === null) return false;
  const hits = capturesAt(m.players, m.turn, to);
  p.tokens[token] = to;
  const captured = hits.map((h) => {
    const victim = m.players[h.player];
    const was = victim.tokens[h.token];
    victim.tokens[h.token] = BASE;
    m.events.push({ type: "capture", player: m.turn, victim: h.player, token: h.token });
    return { ...h, from: was };
  });
  p.captures += captured.length;
  m.events.push({ type: "move", player: m.turn, token, from, to, auto });
  if (to === HOME) m.events.push({ type: "home", player: m.turn, token });
  m.anim = { token, from, to, captured };
  m.moves = [];
  setPhase(m, "moving");
  return true;
}

/** Everyone still playing is ranked by how far along they are; the match is over. */
function finishMatch(m: Match) {
  let place = m.players.filter((p) => p.place !== null).length;
  const rest = m.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.place === null)
    .sort((a, b) => progressOf(b.p.tokens) - progressOf(a.p.tokens) || a.i - b.i);
  for (const { p } of rest) p.place = ++place;
  m.moves = [];
  setPhase(m, "over");
  m.events.push({ type: "over" });
}

/**
 * Over when at most one colour is left, or when every person at the table has
 * finished (the computer doesn't play on alone for the last places).
 */
function checkOver(m: Match) {
  const left = m.players.filter((p) => p.place === null);
  const people = m.players.some((p) => p.seat !== null);
  if (left.length <= 1 || (people && !left.some((p) => p.seat !== null))) {
    finishMatch(m);
    return true;
  }
  return false;
}

function nextTurn(m: Match) {
  m.turns++;
  if (m.turns >= MAX_TURNS) return finishMatch(m);
  const n = m.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (m.turn + k) % n;
    if (m.players[i].place === null) {
      m.turn = i;
      break;
    }
  }
  m.bonus = 0;
  m.passReason = null;
  m.events.push({ type: "turn", player: m.turn });
  setPhase(m, "roll");
}

/** The roll is done: doubles and 1-6 roll again, anything else hands over. */
function endRoll(m: Match) {
  if (isBonusRoll(m.dice)) setPhase(m, "roll");
  else nextTurn(m);
}

function afterMove(m: Match) {
  const p = m.players[m.turn];
  m.anim = null;
  if (p.place === null && finished(p.tokens)) {
    p.place = m.players.filter((q) => q.place !== null).length + 1;
    m.events.push({ type: "finish", player: m.turn, place: p.place });
    if (checkOver(m)) return;
    return nextTurn(m);
  }
  endRoll(m);
}

/** The computer's choice for the current player. */
function botMove(m: Match, level: Difficulty): Move {
  return chooseMove(m.players, m.turn, m.dice, m.moves, level, () => nextRandom(m));
}

function timedOut(p: Player) {
  p.timeouts++;
  if (p.timeouts >= MAX_TIMEOUTS) p.idle = true;
}

/**
 * One step of `dt` seconds. `inputs[seat]` is what that human seat asks for
 * this step, or null; only the player whose turn it is can act, and only with
 * a legal roll or move.
 */
export function stepMatch(m: Match, dt: number, inputs: readonly (Input | null | undefined)[]) {
  if (m.phase === "over") return;
  m.t += dt;
  // Any tap from someone the computer was covering for hands them their seat back
  for (const p of m.players)
    if (p.seat !== null && p.idle && inputs[p.seat]) {
      p.idle = false;
      p.timeouts = 0;
    }
  const p = m.players[m.turn];
  const auto = isAuto(p);
  const input = !auto && p.seat !== null ? (inputs[p.seat] ?? null) : null;
  const clockOut = !auto && m.turnSeconds > 0 && m.t >= m.turnSeconds;
  switch (m.phase) {
    case "roll":
      if (input?.kind === "roll") {
        p.timeouts = 0;
        return roll(m, false);
      }
      if (auto && m.t >= BOT_ROLL_DELAY) return roll(m, p.seat !== null);
      if (clockOut) {
        timedOut(p);
        return roll(m, true);
      }
      return;
    case "rolling":
      if (m.t >= ROLL_TIME) afterRoll(m);
      return;
    case "move": {
      if (input?.kind === "move" && move(m, input.token, false)) {
        p.timeouts = 0;
        return;
      }
      if (auto) {
        if (m.t >= BOT_MOVE_DELAY) {
          const b = botMove(m, p.level);
          move(m, b.token, p.seat !== null);
        }
        return;
      }
      // Only one thing to do: do it
      const options = distinctOptions(p.tokens, m.moves);
      if (options.length === 1 && m.t >= AUTO_MOVE_DELAY) return void move(m, options[0].token, false);
      if (clockOut) {
        timedOut(p);
        const b = botMove(m, "normal");
        move(m, b.token, true);
      }
      return;
    }
    case "moving":
      if (m.t >= moveTime(m.anim)) afterMove(m);
      return;
    case "pass":
      if (m.t < PASS_TIME) return;
      // A bonus roll that couldn't be played still earns the roll; the third in a row never does
      if (m.passReason === "none" && isBonusRoll(m.dice)) {
        m.passReason = null;
        setPhase(m, "roll");
      } else nextTurn(m);
      return;
  }
}

/** A human seat dropped (true) or came back (false). */
export function setAway(m: Match, seat: number, away: boolean) {
  const p = m.players.find((q) => q.seat === seat);
  if (!p) return;
  p.away = away;
  if (!away) {
    p.idle = false;
    p.timeouts = 0;
  }
}

/** Online leaderboard score for a finishing place at a table of `n`. */
export const placeScore = (place: number, n: number) => ONLINE_SCORE[n]?.[place - 1] ?? 0;
