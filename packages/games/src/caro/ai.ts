import { CELLS, type Difficulty, SIZE, WIN_LEN } from "./config";

// The computer player. Pure (runs in the browser and, for timed-out turns, in
// the realtime room). It scores every run of five squares ("window"): a window
// holding only one side's marks is worth more the more marks it has. Easy and
// Normal pick the best-scoring square; Hard looks four moves ahead with
// alpha-beta over the best few squares.

type Side = 1 | 2;

/** Value of a window holding k marks of one side and none of the other. */
const WEIGHT = [0, 1, 14, 200, 4000, 1_000_000];
const WIN = 1_000_000_000;

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** Every window of WIN_LEN squares in a line, as square indices. */
const WINDOWS: number[][] = [];
/** The windows each square belongs to. */
const CELL_WINDOWS: number[][] = Array.from({ length: CELLS }, () => []);
for (const [dx, dy] of DIRS) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const ex = x + dx * (WIN_LEN - 1);
      const ey = y + dy * (WIN_LEN - 1);
      if (ex < 0 || ex >= SIZE || ey < 0 || ey >= SIZE) continue;
      const w: number[] = [];
      for (let i = 0; i < WIN_LEN; i++) w.push((y + dy * i) * SIZE + x + dx * i);
      const id = WINDOWS.length;
      WINDOWS.push(w);
      for (const c of w) CELL_WINDOWS[c].push(id);
    }
  }
}

/** Squares within two steps of each square: where a sensible move can be. */
const NEAR: number[][] = Array.from({ length: CELLS }, (_, c) => {
  const x = c % SIZE;
  const y = Math.floor(c / SIZE);
  const out: number[] = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) out.push(ny * SIZE + nx);
    }
  return out;
});

const CENTER = Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2);

/** A board with per-window mark counts kept up to date as marks come and go. */
class Board {
  readonly cells: number[];
  /** counts[side][window] */
  private readonly counts: [Int8Array, Int8Array, Int8Array];
  /** Sum of window values from X's point of view. */
  private total = 0;
  stones = 0;

  constructor(cells: readonly number[]) {
    this.cells = cells.slice();
    this.counts = [new Int8Array(0), new Int8Array(WINDOWS.length), new Int8Array(WINDOWS.length)];
    for (let w = 0; w < WINDOWS.length; w++)
      for (const c of WINDOWS[w]) {
        const v = this.cells[c];
        if (v === 1 || v === 2) this.counts[v][w]++;
      }
    for (let w = 0; w < WINDOWS.length; w++) this.total += this.value(w);
    for (const v of this.cells) if (v) this.stones++;
  }

  private value(w: number) {
    const x = this.counts[1][w];
    const o = this.counts[2][w];
    if (x && o) return 0;
    return WEIGHT[x] - WEIGHT[o];
  }

  /** Place a mark; true if it completes five in some window (a run of five) */
  place(c: number, side: Side): boolean {
    let five = false;
    for (const w of CELL_WINDOWS[c]) {
      this.total -= this.value(w);
      if (++this.counts[side][w] === WIN_LEN) five = true;
      this.total += this.value(w);
    }
    this.cells[c] = side;
    this.stones++;
    return five;
  }

  remove(c: number, side: Side) {
    for (const w of CELL_WINDOWS[c]) {
      this.total -= this.value(w);
      this.counts[side][w]--;
      this.total += this.value(w);
    }
    this.cells[c] = 0;
    this.stones--;
  }

  evalFor(side: Side) {
    return side === 1 ? this.total : -this.total;
  }

  /** What playing `c` does for `side` (attack) and against the other (defence). */
  gain(c: number, side: Side, defence: number) {
    const mine = this.counts[side];
    const theirs = this.counts[side === 1 ? 2 : 1];
    let attack = 0;
    let block = 0;
    for (const w of CELL_WINDOWS[c]) {
      if (!theirs[w]) attack += WEIGHT[mine[w] + 1];
      if (!mine[w]) block += WEIGHT[theirs[w] + 1];
    }
    return attack + block * defence;
  }

  /** Empty squares near a mark, best first by `gain`, at most `limit`. */
  candidates(side: Side, limit: number, defence = 0.9): number[] {
    if (this.stones === 0) return [this.cells[CENTER] ? 0 : CENTER];
    const seen = new Uint8Array(CELLS);
    const scored: { c: number; s: number }[] = [];
    for (let c = 0; c < CELLS; c++) {
      if (!this.cells[c]) continue;
      for (const n of NEAR[c]) {
        if (this.cells[n] || seen[n]) continue;
        seen[n] = 1;
        scored.push({ c: n, s: this.gain(n, side, defence) });
      }
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit).map((e) => e.c);
  }
}

function negamax(b: Board, depth: number, alpha: number, beta: number, side: Side, width: number): number {
  if (depth === 0) return b.evalFor(side);
  const moves = b.candidates(side, width);
  if (moves.length === 0) return 0;
  const other: Side = side === 1 ? 2 : 1;
  let best = -Infinity;
  for (const c of moves) {
    const five = b.place(c, side);
    const score = five ? WIN + depth : -negamax(b, depth - 1, -beta, -alpha, other, width);
    b.remove(c, side);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * The computer's square for `side`, or -1 when the board is full. `rand` makes
 * Easy and Normal vary between games; Hard is deterministic.
 */
export function chooseMove(cells: readonly number[], side: Side, level: Difficulty, rand: () => number): number {
  const b = new Board(cells);
  if (b.stones >= CELLS) return -1;
  const other: Side = side === 1 ? 2 : 1;

  if (level === "easy") {
    // Short-sighted: half-hearted defence and a lot of noise, but it will take a win it sees
    const moves = b.candidates(side, 8, 0.45);
    if (moves.length === 0) return -1;
    let best = moves[0];
    let bestScore = -Infinity;
    for (const c of moves) {
      const s = b.gain(c, side, 0.45) * (0.45 + rand() * 0.9);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    for (const c of moves) {
      if (b.place(c, side)) {
        b.remove(c, side);
        if (rand() < 0.75) return c;
        break;
      }
      b.remove(c, side);
    }
    return best;
  }

  if (level === "normal") {
    const moves = b.candidates(side, 4, 0.9);
    if (moves.length === 0) return -1;
    // Near-ties go either way so it doesn't open every game identically
    const top = b.gain(moves[0], side, 0.9);
    const close = moves.filter((c) => b.gain(c, side, 0.9) >= top * 0.97);
    return close[Math.floor(rand() * close.length)] ?? moves[0];
  }

  // Hard: win now, else stop their win now, else search
  const moves = b.candidates(side, 12);
  if (moves.length === 0) return -1;
  for (const c of moves) {
    const five = b.place(c, side);
    b.remove(c, side);
    if (five) return c;
  }
  for (const c of b.candidates(other, 12)) {
    const five = b.place(c, other);
    b.remove(c, other);
    if (five) return c;
  }
  let best = moves[0];
  let alpha = -Infinity;
  for (const c of moves.slice(0, 10)) {
    b.place(c, side);
    const score = -negamax(b, 3, -Infinity, -alpha, other, 9);
    b.remove(c, side);
    if (score > alpha) {
      alpha = score;
      best = c;
    }
  }
  return best;
}
