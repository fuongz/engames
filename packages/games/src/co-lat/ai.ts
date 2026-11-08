import { CELLS, type Difficulty, SIZE } from "./config";

// The computer player. Pure (runs in the browser and, for timed-out turns, in
// the realtime room). It plays on its own fast board (an Int8Array with a flip
// stack, so a move and its take-back cost a few array writes).
//
// - Easy: often a random legal move, otherwise the square the weight table
//   likes best, with a lot of noise.
// - Normal: a 3-ply alpha-beta search on the full evaluation, near-ties broken
//   at random.
// - Hard: iterative deepening alpha-beta (PV move first) under a node budget,
//   and a perfect endgame solve once few enough squares are empty.
//
// Budgets count nodes, not milliseconds: the result is the same on every
// machine, and the realtime room (where the clock does not advance during a
// request) never stalls. The test checks the slowest move stays well under
// 400 ms on a laptop.

type Side = 1 | 2;

/** Hard: deepest iteration, and the node budget for the whole midgame search. */
const HARD_MAX_DEPTH = 10;
const HARD_NODES = 50_000;
/** Hard solves the endgame exactly from this many empty squares down… */
const SOLVE_EMPTIES = 14;
/** …unless the solve needs more nodes than this; then the midgame search answers. */
const SOLVE_NODES = 400_000;
const NORMAL_DEPTH = 3;
/** Easy plays a random legal move this often. */
const EASY_RANDOM = 0.3;

const WIN = 100_000;
const INF = 1_000_000;

/** Classic square weights: corners gold, the squares next to them poison while the corner is open. */
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];
/** What a square next to a corner is worth once that corner is taken. */
const NEAR_TAKEN_CORNER = 5;

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const inBoard = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

/** RAYS[sq]: the lines leaving `sq`, nearest square first (only lines long enough to flip along). */
const RAYS: number[][][] = [];
/** NEIGH[sq]: the up-to-8 squares touching `sq`. */
const NEIGH: number[][] = [];
for (let sq = 0; sq < CELLS; sq++) {
  const x0 = sq % SIZE;
  const y0 = Math.floor(sq / SIZE);
  const rays: number[][] = [];
  const neigh: number[] = [];
  for (const [dx, dy] of DIRS) {
    const ray: number[] = [];
    for (let x = x0 + dx, y = y0 + dy; inBoard(x, y); x += dx, y += dy) ray.push(y * SIZE + x);
    if (ray.length >= 2) rays.push(ray);
    if (ray.length >= 1) neigh.push(ray[0]);
  }
  RAYS.push(rays);
  NEIGH.push(neigh);
}

const CORNERS = [0, 7, 56, 63];
/** The three squares touching each corner. */
const CORNER_NEAR = CORNERS.map((c) => NEIGH[c]);
/** From each corner, the two edges walked outward (for edge stability). */
const CORNER_EDGES = [
  [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 16, 24, 32, 40, 48, 56],
  ],
  [
    [6, 5, 4, 3, 2, 1, 0],
    [15, 23, 31, 39, 47, 55, 63],
  ],
  [
    [57, 58, 59, 60, 61, 62, 63],
    [48, 40, 32, 24, 16, 8, 0],
  ],
  [
    [62, 61, 60, 59, 58, 57, 56],
    [55, 47, 39, 31, 23, 15, 7],
  ],
];

/** Squares in the order moves are tried: best static weight first (ties: board order). */
const ORDER = Array.from({ length: CELLS }, (_, i) => i).sort((a, b) => WEIGHTS[b] - WEIGHTS[a] || a - b);

class Engine {
  readonly b = new Int8Array(CELLS);
  private readonly stack = new Int8Array(CELLS * 64);
  private sp = 0;
  nodes = 0;
  budget = Number.POSITIVE_INFINITY;
  aborted = false;
  private readonly stableMark = new Uint8Array(CELLS);

  constructor(cells: readonly number[]) {
    for (let i = 0; i < CELLS; i++) this.b[i] = cells[i] === 1 || cells[i] === 2 ? cells[i] : 0;
  }

  /** Play `me` at `at`; returns the number of discs turned (0 = illegal, nothing changed). */
  play(at: number, me: number): number {
    const b = this.b;
    if (b[at] !== 0) return 0;
    const opp = 3 - me;
    let n = 0;
    for (const ray of RAYS[at]) {
      let k = 0;
      const len = ray.length;
      while (k < len && b[ray[k]] === opp) k++;
      if (k > 0 && k < len && b[ray[k]] === me) {
        for (let j = 0; j < k; j++) {
          b[ray[j]] = me;
          this.stack[this.sp++] = ray[j];
        }
        n += k;
      }
    }
    if (n) b[at] = me;
    return n;
  }

  unplay(at: number, me: number, n: number) {
    const b = this.b;
    const opp = 3 - me;
    b[at] = 0;
    for (let i = 0; i < n; i++) b[this.stack[--this.sp]] = opp;
  }

  canPlay(at: number, me: number): boolean {
    const b = this.b;
    if (b[at] !== 0) return false;
    const opp = 3 - me;
    for (const ray of RAYS[at]) {
      let k = 0;
      const len = ray.length;
      while (k < len && b[ray[k]] === opp) k++;
      if (k > 0 && k < len && b[ray[k]] === me) return true;
    }
    return false;
  }

  /** Legal squares for `me`, in static order. */
  moves(me: number): number[] {
    const out: number[] = [];
    for (const sq of ORDER) if (this.canPlay(sq, me)) out.push(sq);
    return out;
  }

  mobility(me: number): number {
    let n = 0;
    for (let sq = 0; sq < CELLS; sq++) if (this.canPlay(sq, me)) n++;
    return n;
  }

  hasMove(me: number): boolean {
    for (let sq = 0; sq < CELLS; sq++) if (this.canPlay(sq, me)) return true;
    return false;
  }

  empties(): number {
    let n = 0;
    for (let sq = 0; sq < CELLS; sq++) if (this.b[sq] === 0) n++;
    return n;
  }

  /** Discs of `me` minus discs of the other side. */
  diff(me: number): number {
    let d = 0;
    for (let sq = 0; sq < CELLS; sq++) {
      const v = this.b[sq];
      if (v === me) d++;
      else if (v !== 0) d--;
    }
    return d;
  }

  /** Discs anchored to a corner along an edge: they can never be turned. */
  private edgeStable(me: number): number {
    const b = this.b;
    const mark = this.stableMark;
    mark.fill(0);
    let n = 0;
    for (let c = 0; c < 4; c++) {
      if (b[CORNERS[c]] !== me) continue;
      if (!mark[CORNERS[c]]) {
        mark[CORNERS[c]] = 1;
        n++;
      }
      for (const edge of CORNER_EDGES[c]) {
        for (const sq of edge) {
          if (b[sq] !== me) break;
          if (!mark[sq]) {
            mark[sq] = 1;
            n++;
          }
        }
      }
    }
    return n;
  }

  /** How good the position is for `me` (positive = better), mid-game heuristic. */
  evaluate(me: number): number {
    const b = this.b;
    const opp = 3 - me;
    let pos = 0;
    let mine = 0;
    let theirs = 0;
    let frontier = 0;
    for (let sq = 0; sq < CELLS; sq++) {
      const v = b[sq];
      if (v === 0) continue;
      let open = false;
      for (const n of NEIGH[sq])
        if (b[n] === 0) {
          open = true;
          break;
        }
      if (v === me) {
        pos += WEIGHTS[sq];
        mine++;
        if (open) frontier++;
      } else {
        pos -= WEIGHTS[sq];
        theirs++;
        if (open) frontier--;
      }
    }
    // A taken corner makes its neighbours ordinary squares
    for (let c = 0; c < 4; c++) {
      if (b[CORNERS[c]] === 0) continue;
      for (const sq of CORNER_NEAR[c]) {
        const v = b[sq];
        if (v === me) pos += NEAR_TAKEN_CORNER - WEIGHTS[sq];
        else if (v === opp) pos -= NEAR_TAKEN_CORNER - WEIGHTS[sq];
      }
    }
    const mm = this.mobility(me);
    const om = this.mobility(opp);
    const mob = (100 * (mm - om)) / (mm + om + 2);
    const stable = this.edgeStable(me) - this.edgeStable(opp);
    const empties = CELLS - mine - theirs;
    let score = pos + mob * 1.5 + stable * 18 - frontier * 4;
    // Late on, the discs themselves start to matter
    if (empties < 18) score += (mine - theirs) * (18 - empties) * 0.6;
    return score;
  }

  /** Final score for `me` when the game is over. */
  private final(me: number): number {
    const d = this.diff(me);
    return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0;
  }

  private tick(): boolean {
    if (++this.nodes > this.budget) this.aborted = true;
    return this.aborted;
  }

  /** Negamax alpha-beta to `depth` with the heuristic at the leaves. */
  search(me: number, depth: number, alpha: number, beta: number, passed: boolean): number {
    if (this.tick()) return 0;
    if (depth <= 0) return this.evaluate(me);
    const opp = 3 - me;
    const list = this.moves(me);
    if (list.length === 0) {
      if (passed) return this.final(me);
      return -this.search(opp, depth, -beta, -alpha, true);
    }
    let best = -INF;
    for (const at of list) {
      const n = this.play(at, me);
      const v = -this.search(opp, depth - 1, -beta, -alpha, false);
      this.unplay(at, me, n);
      if (this.aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Exact disc difference for `me` with perfect play from here. */
  solve(me: number, alpha: number, beta: number, passed: boolean): number {
    if (this.tick()) return 0;
    const opp = 3 - me;
    let list = this.moves(me);
    if (list.length === 0) {
      if (passed) return this.diff(me);
      return -this.solve(opp, -beta, -alpha, true);
    }
    // Fastest-first: try the moves that leave the opponent fewest replies
    if (list.length > 1 && this.empties() > 6) {
      const keyed = list.map((at) => {
        const n = this.play(at, me);
        const k = this.mobility(opp) * 16 - WEIGHTS[at] / 10;
        this.unplay(at, me, n);
        return { at, k };
      });
      keyed.sort((a, b) => a.k - b.k);
      list = keyed.map((e) => e.at);
    }
    let best = -INF;
    for (const at of list) {
      const n = this.play(at, me);
      const v = -this.solve(opp, -beta, -alpha, false);
      this.unplay(at, me, n);
      if (this.aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

/** Every root move with its score at `depth` (exact scores, so near-ties can be told apart). */
function scoreRoot(e: Engine, me: number, list: readonly number[], depth: number): { at: number; v: number }[] {
  const opp = 3 - me;
  return list.map((at) => {
    const n = e.play(at, me);
    const v = -e.search(opp, depth - 1, -INF, INF, false);
    e.unplay(at, me, n);
    return { at, v };
  });
}

/** The best root move at `depth`, trying `first` before the rest; null if the budget ran out. */
function bestAt(e: Engine, me: number, list: readonly number[], depth: number, first: number): { at: number; v: number } | null {
  const opp = 3 - me;
  const ordered = [first, ...list.filter((at) => at !== first)];
  let alpha = -INF;
  let best = ordered[0];
  for (const at of ordered) {
    const n = e.play(at, me);
    const v = -e.search(opp, depth - 1, -INF, -alpha, false);
    e.unplay(at, me, n);
    if (e.aborted) return null;
    if (v > alpha) {
      alpha = v;
      best = at;
    }
  }
  return { at: best, v: alpha };
}

/** Perfect endgame play within `budget` nodes, or null if it needs more. */
function solveRoot(e: Engine, me: number, list: readonly number[], budget: number): number | null {
  const opp = 3 - me;
  e.nodes = 0;
  e.budget = budget;
  e.aborted = false;
  let alpha = -INF;
  let best = list[0];
  for (const at of list) {
    const n = e.play(at, me);
    const v = -e.solve(opp, -INF, -alpha, false);
    e.unplay(at, me, n);
    if (e.aborted) return null;
    if (v > alpha) {
      alpha = v;
      best = at;
    }
  }
  return best;
}

/**
 * The computer's square for `side`, or -1 when it has no legal move (it must
 * pass). `rand` makes Easy and Normal vary between games; Hard is deterministic.
 */
export function chooseMove(cells: readonly number[], side: Side, level: Difficulty, rand: () => number): number {
  const e = new Engine(cells);
  const list = e.moves(side);
  if (list.length === 0) return -1;
  if (list.length === 1) return list[0];

  if (level === "easy") {
    if (rand() < EASY_RANDOM) return list[Math.floor(rand() * list.length)] ?? list[0];
    let best = list[0];
    let bestScore = -INF;
    for (const at of list) {
      const n = e.play(at, side);
      e.unplay(at, side, n);
      const s = WEIGHTS[at] + n * 3 + (rand() - 0.5) * 60;
      if (s > bestScore) {
        bestScore = s;
        best = at;
      }
    }
    return best;
  }

  if (level === "normal") {
    const scored = scoreRoot(e, side, list, NORMAL_DEPTH);
    const top = Math.max(...scored.map((s) => s.v));
    const close = scored.filter((s) => s.v >= top - 3);
    return close[Math.floor(rand() * close.length)]?.at ?? scored[0].at;
  }

  // Hard: a perfect endgame if it fits the budget…
  if (e.empties() <= SOLVE_EMPTIES) {
    const solved = solveRoot(e, side, list, SOLVE_NODES);
    if (solved !== null) return solved;
  }
  // …else iterative deepening, keeping the last depth that finished
  e.nodes = 0;
  e.budget = HARD_NODES;
  e.aborted = false;
  let best = list[0];
  for (let depth = 1; depth <= HARD_MAX_DEPTH; depth++) {
    const r = bestAt(e, side, list, depth, best);
    if (!r) break;
    best = r.at;
    // A forced win or loss found: deeper won't change the answer
    if (Math.abs(r.v) >= WIN) break;
  }
  return best;
}
