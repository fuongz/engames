// The computer player: iterative-deepening negamax with alpha-beta, a short
// capture-only tail (quiescence), killer moves and a history table for move
// ordering. Depth-limited, never time-limited, so the same position, level and
// seed always give the same move (tests stay stable).
//
// The search can run in slices: `createSearch(...).step()` searches one root
// move at a time, so the shell can spread a deep search across frames and the
// UI never freezes. `chooseMove` runs it to the end in one go.
import { mulberry32 } from "@web-games/core/math";
import { AI_DEPTH, AI_NOISE, type Difficulty } from "./config";
import {
  COLS,
  DEN,
  ELEPHANT,
  LION,
  type Move,
  RAT,
  ROWS,
  SQUARES,
  type Side,
  type State,
  TIGER,
  applyMove,
  isWater,
  legalMoves,
  trapOwner,
} from "./logic";

const WIN = 100_000;
const INF = 1_000_000;
const MAX_PLY = 32;
const Q_DEPTH = 4;

/** Material by rank: the rat is worth more than its rank (it kills elephants and blocks jumps). */
const VALUE = [0, 420, 230, 280, 360, 480, 760, 860, 950];

// Precomputed geometry
const WATER: boolean[] = Array.from({ length: SQUARES }, (_, s) => isWater(s));
const TRAP: number[] = Array.from({ length: SQUARES }, (_, s) => trapOwner(s));
const RED_DEN = DEN[1];
const BLUE_DEN = DEN[-1];
/** Manhattan distance from each square to each den. */
const DIST: Record<Side, number[]> = {
  1: Array.from({ length: SQUARES }, (_, s) => Math.abs((s % COLS) - 3) + Math.floor(s / COLS)),
  [-1]: Array.from({ length: SQUARES }, (_, s) => Math.abs((s % COLS) - 3) + (ROWS - 1 - Math.floor(s / COLS))),
} as Record<Side, number[]>;
/** For each square, up to four neighbours as [to, dx, dy], or for a pond edge the jump landing. */
const STEPS: [number, number, number][][] = Array.from({ length: SQUARES }, (_, s) => {
  const x = s % COLS;
  const y = Math.floor(s / COLS);
  const out: [number, number, number][] = [];
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) out.push([ny * COLS + nx, dx, dy]);
  }
  return out;
});

/** Advancement per rank toward the enemy den (the elephant and lion lead the push). */
const ADV = [0, 7, 5, 5, 6, 7, 9, 9, 8];

/** The board seen by the side whose distance table we use: positive = good for `side`. */
function evaluate(b: Int8Array, side: Side): number {
  let score = 0;
  for (let s = 0; s < SQUARES; s++) {
    const p = b[s];
    if (p === 0) continue;
    const own: Side = p > 0 ? 1 : -1;
    const r = p > 0 ? p : -p;
    // Distance to the den this piece attacks (the other side's)
    const d = own === 1 ? DIST[1][s] : DIST[-1][s];
    let v = VALUE[r] + ADV[r] * (11 - d);
    if (d === 1) v += 160;
    else if (d === 2) v += 50;
    // Standing in an enemy trap: weak until it moves on
    if (TRAP[s] === -own) v -= 60;
    // A swimming rat shields the pond from jumps
    if (r === RAT && WATER[s]) v += 25;
    score += own === side ? v : -v;
  }
  return score;
}

/** Can the piece `a` on `from` take the piece `d` on `to`? (logic.canCapture, inlined on Int8Array). */
function takes(a: number, from: number, d: number, to: number): boolean {
  if (WATER[from] !== WATER[to]) return false;
  const side = a > 0 ? 1 : -1;
  if (TRAP[to] === side) return true;
  const ar = a > 0 ? a : -a;
  const dr = d > 0 ? d : -d;
  if (ar === RAT && dr === ELEPHANT) return true;
  if (ar === ELEPHANT && dr === RAT) return false;
  return ar >= dr;
}

/** Fill `out` with moves for `side` as from * 64 + to; returns the count. */
function generate(b: Int8Array, side: Side, out: Int16Array, capturesOnly: boolean): number {
  let n = 0;
  const ownDen = side === 1 ? RED_DEN : BLUE_DEN;
  for (let from = 0; from < SQUARES; from++) {
    const p = b[from];
    if (p === 0 || (p > 0 ? 1 : -1) !== side) continue;
    const r = p > 0 ? p : -p;
    for (const [to0, dx, dy] of STEPS[from]) {
      let to = to0;
      if (WATER[to]) {
        if (r === LION || r === TIGER) {
          // Jump across: every water square on the way must be empty
          let x = (to % COLS) + 0;
          let y = Math.floor(to / COLS);
          let blocked = false;
          while (x >= 0 && x < COLS && y >= 0 && y < ROWS && WATER[y * COLS + x]) {
            if (b[y * COLS + x] !== 0) {
              blocked = true;
              break;
            }
            x += dx;
            y += dy;
          }
          if (blocked || x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
          to = y * COLS + x;
        } else if (r !== RAT) continue;
      }
      if (to === ownDen) continue;
      const t = b[to];
      if (t !== 0) {
        if ((t > 0 ? 1 : -1) === side || !takes(p, from, t, to)) continue;
      } else if (capturesOnly) continue;
      out[n++] = from * 64 + to;
    }
  }
  return n;
}

export interface Search {
  /** Search one more root move; true once the search is finished. */
  step(): boolean;
  /** The chosen move (valid once step() returned true; null when there is no move). */
  readonly move: Move | null;
  /** Nodes visited so far (for tuning). */
  readonly nodes: number;
}

/**
 * A search for the side to move in `state`. Deterministic for a given state,
 * level and seed. Call step() until it returns true, then read move.
 */
export function createSearch(state: State, level: Difficulty, seed: number): Search {
  const rand = mulberry32(seed >>> 0);
  const depthMax = AI_DEPTH[level];
  const noise = AI_NOISE[level];
  const root = state.turn;
  const b = Int8Array.from(state.board);
  const counts: Record<Side, number> = { 1: 0, [-1]: 0 } as Record<Side, number>;
  for (const p of b) if (p !== 0) counts[p > 0 ? 1 : -1]++;
  const bufs = Array.from({ length: MAX_PLY + Q_DEPTH + 2 }, () => new Int16Array(160));
  const keys = Array.from({ length: MAX_PLY + Q_DEPTH + 2 }, () => new Int32Array(160));
  const killers = Array.from({ length: MAX_PLY + 2 }, () => [-1, -1]);
  const history = new Int32Array(64 * 64);
  let nodes = 0;

  // Root moves, shuffled by the seed so equal moves vary from game to game,
  // and moves that repeat the position a third time scored as draws.
  const legal = legalMoves(state);
  for (let i = legal.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [legal[i], legal[j]] = [legal[j], legal[i]];
  }
  const rootMoves = legal.map((m) => {
    const next = applyMove(state, m);
    return {
      m,
      code: m.from * 64 + m.to,
      score: -INF,
      final: next.result ? (next.result.winner === 0 ? 0 : next.result.winner === root ? WIN : -WIN) : null,
      noise: noise ? (rand() - 0.5) * 2 * noise : 0,
    };
  });

  function order(moves: Int16Array, n: number, side: Side, ply: number, k: Int32Array) {
    const enemyDen = side === 1 ? BLUE_DEN : RED_DEN;
    const kill = killers[ply] ?? [-1, -1];
    for (let i = 0; i < n; i++) {
      const code = moves[i];
      const from = code >> 6;
      const to = code & 63;
      const victim = b[to];
      let s = history[code];
      if (to === enemyDen) s += 1 << 28;
      else if (victim !== 0) s += (1 << 24) + (victim > 0 ? victim : -victim) * 64 - (b[from] > 0 ? b[from] : -b[from]);
      else if (code === kill[0]) s += 1 << 22;
      else if (code === kill[1]) s += 1 << 21;
      k[i] = s;
    }
    // Insertion sort, high first (n is small)
    for (let i = 1; i < n; i++) {
      const mv = moves[i];
      const kv = k[i];
      let j = i - 1;
      while (j >= 0 && k[j] < kv) {
        moves[j + 1] = moves[j];
        k[j + 1] = k[j];
        j--;
      }
      moves[j + 1] = mv;
      k[j + 1] = kv;
    }
  }

  /** Captures only, from `side`'s point of view, with a stand-pat floor. */
  function quiesce(side: Side, alpha: number, beta: number, ply: number, qd: number): number {
    nodes++;
    const stand = evaluate(b, side);
    if (qd === 0) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const moves = bufs[ply];
    const n = generate(b, side, moves, true);
    order(moves, n, side, Math.min(ply, MAX_PLY), keys[ply]);
    const foe = (-side) as Side;
    for (let i = 0; i < n; i++) {
      const code = moves[i];
      const from = code >> 6;
      const to = code & 63;
      const cap = b[to];
      b[to] = b[from];
      b[from] = 0;
      counts[foe]--;
      const score = counts[foe] === 0 ? WIN - ply : -quiesce(foe, -beta, -alpha, ply + 1, qd - 1);
      counts[foe]++;
      b[from] = b[to];
      b[to] = cap;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(side: Side, depth: number, alpha: number, beta: number, ply: number): number {
    if (depth <= 0) return quiesce(side, alpha, beta, ply, Q_DEPTH);
    nodes++;
    const moves = bufs[ply];
    const n = generate(b, side, moves, false);
    if (n === 0) return -WIN + ply; // no move: this side loses
    order(moves, n, side, ply, keys[ply]);
    const foe = (-side) as Side;
    const enemyDen = side === 1 ? BLUE_DEN : RED_DEN;
    let best = -INF;
    for (let i = 0; i < n; i++) {
      const code = moves[i];
      const from = code >> 6;
      const to = code & 63;
      if (to === enemyDen) return WIN - ply - 1;
      const cap = b[to];
      b[to] = b[from];
      b[from] = 0;
      if (cap !== 0) counts[foe]--;
      const score = cap !== 0 && counts[foe] === 0 ? WIN - ply - 1 : -negamax(foe, depth - 1, -beta, -alpha, ply + 1);
      if (cap !== 0) counts[foe]++;
      b[from] = b[to];
      b[to] = cap;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (cap === 0) {
          const kl = killers[ply];
          if (kl[0] !== code) {
            kl[1] = kl[0];
            kl[0] = code;
          }
          history[code] += depth * depth;
        }
        break;
      }
    }
    return best;
  }

  /** Score one root move at `depth` inside (alpha, beta). */
  function searchRoot(code: number, depth: number, alpha: number, beta: number): number {
    const from = code >> 6;
    const to = code & 63;
    const foe = (-root) as Side;
    const cap = b[to];
    b[to] = b[from];
    b[from] = 0;
    if (cap !== 0) counts[foe]--;
    const score = -negamax(foe, depth - 1, -beta, -alpha, 1);
    if (cap !== 0) counts[foe]++;
    b[from] = b[to];
    b[to] = cap;
    return score;
  }

  let depth = 1;
  let index = 0;
  let alpha = -INF;
  let done = rootMoves.length === 0;
  let chosen: Move | null = null;
  // A decided root move (a den entry, the last capture, a third repetition) needs no search
  const winNow = rootMoves.find((r) => r.final === WIN);
  if (winNow) {
    chosen = winNow.m;
    done = true;
  } else if (rootMoves.length === 1) {
    chosen = rootMoves[0].m;
    done = true;
  }

  const finishDepth = () => {
    // Best first for the next, deeper pass (stable: ties keep the shuffled order)
    rootMoves.sort((a, c) => c.score + c.noise - (a.score + a.noise));
    chosen = rootMoves[0]?.m ?? null;
  };

  return {
    get move() {
      return chosen;
    },
    get nodes() {
      return nodes;
    },
    step() {
      if (done) return true;
      const r = rootMoves[index];
      if (r.final !== null) r.score = r.final;
      else if (noise) {
        // Easy: every move scored exactly, then shaken
        r.score = searchRoot(r.code, depth, -INF, INF);
      } else {
        // Principal variation search at the root: a null window after the first move
        if (index === 0) r.score = searchRoot(r.code, depth, -INF, INF);
        else {
          let s = searchRoot(r.code, depth, alpha, alpha + 1);
          if (s > alpha) s = searchRoot(r.code, depth, alpha, INF);
          r.score = s;
        }
      }
      if (r.score > alpha) alpha = r.score;
      index++;
      if (index >= rootMoves.length) {
        finishDepth();
        if (depth >= depthMax || Math.abs(rootMoves[0].score) >= WIN - MAX_PLY * 2) {
          done = true;
          return true;
        }
        depth++;
        index = 0;
        alpha = -INF;
      }
      return false;
    },
  };
}

/** The computer's move for the side to move, searched to the end. Null when it has none. */
export function chooseMove(state: State, level: Difficulty, seed: number): Move | null {
  const s = createSearch(state, level, seed);
  while (!s.step()) {
    // keep searching
  }
  return s.move;
}
