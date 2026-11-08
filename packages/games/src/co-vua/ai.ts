import { AI_LEVELS, AI_MAX_NODES, type Difficulty } from "./config";
import {
  BISHOP,
  CASTLE,
  type Color,
  EP,
  type Game,
  KING,
  KNIGHT,
  PAWN,
  type Pos,
  QUEEN,
  ROOK,
  WHITE,
  attacked,
  clonePos,
  genMoves,
  inCheck,
  kingIdx,
  legalMoves,
  mFlag,
  mFrom,
  mPromo,
  mTo,
  make,
  replay,
  unmake,
} from "./logic";

// The computer player. Pure: no DOM, only Date.now() for its time budget.
// Negamax alpha-beta with a quiescence search on captures, iterative
// deepening, a small transposition table, and move ordering by hash move,
// MVV-LVA captures, killer moves and the history heuristic. The evaluation is
// material plus piece-square tables (Michniewski's "simplified evaluation"),
// with the king's table blended from middlegame to endgame.
//
// Levels differ by depth, time and noise (config.ts AI_LEVELS): Easy looks one
// move ahead with a lot of noise and sometimes plays a random move; Normal
// looks three plies ahead with a little noise; Hard deepens until ~300 ms.

const VALUE = [0, 100, 320, 330, 500, 900, 0];
const MATE = 100_000;
const INF = 1_000_000;
const MAX_PLY = 64;

// Piece-square tables from White's side, rank 8 first (as usually printed).
// prettier-ignore
const PST_RAW: number[][] = [
  [],
  [ 0,  0,  0,  0,  0,  0,  0,  0,
   50, 50, 50, 50, 50, 50, 50, 50,
   10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0],
  [-50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50],
  [-20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20],
  [ 0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0],
  [-20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20],
  // King, middlegame: stay behind the pawns
  [-30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20],
];
// prettier-ignore
const KING_END_RAW = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

/** PST[t][sq] for White on our square numbering (a1 = 0); Black mirrors the rank. */
const toSq = (raw: number[]) => Array.from({ length: 64 }, (_, sq) => raw[(7 - (sq >> 3)) * 8 + (sq & 7)]);
const PST: number[][] = PST_RAW.map((t) => (t.length ? toSq(t) : []));
const KING_END = toSq(KING_END_RAW);
const mirror = (sq: number) => sq ^ 56;

/** Static evaluation from the side to move's point of view, in centipawns. */
export function evaluate(p: Pos): number {
  const { b } = p;
  let mg = 0;
  let phase = 0;
  let wb = 0;
  let bb = 0;
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq];
    if (!v) continue;
    const t = v > 0 ? v : -v;
    if (t === KING) continue;
    const s = v > 0 ? sq : mirror(sq);
    const score = VALUE[t] + PST[t][s];
    mg += v > 0 ? score : -score;
    if (t === KNIGHT || t === BISHOP) phase += 1;
    else if (t === ROOK) phase += 2;
    else if (t === QUEEN) phase += 4;
    if (t === BISHOP) {
      if (v > 0) wb++;
      else bb++;
    }
  }
  // Kings: middlegame table with the queens and rooks on, endgame table as they come off
  const k = Math.min(phase, 24) / 24;
  const [wk, bk] = p.kings;
  mg += k * PST[KING][wk] + (1 - k) * KING_END[wk];
  mg -= k * PST[KING][mirror(bk)] + (1 - k) * KING_END[mirror(bk)];
  if (wb >= 2) mg += 30;
  if (bb >= 2) mg -= 30;
  const score = Math.round(mg);
  return p.turn === WHITE ? score : -score;
}

// ---------------------------------------------------------------- hashing

/** Two independent 32-bit Zobrist keys: one indexes the table, the other checks the hit. */
const Z1: Int32Array[] = [];
const Z2: Int32Array[] = [];
{
  let s = 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
  // 13 piece codes (-6..6), then castling (16), en passant files (8), side
  for (let i = 0; i < 13 + 3; i++) {
    const a = new Int32Array(64);
    const c = new Int32Array(64);
    for (let j = 0; j < 64; j++) {
      a[j] = next();
      c[j] = next();
    }
    Z1.push(a);
    Z2.push(c);
  }
}
const ZC = 13;
const ZE = 14;
const ZT = 15;

function hashOf(p: Pos, z: Int32Array[]): number {
  let h = 0;
  for (let sq = 0; sq < 64; sq++) if (p.b[sq]) h ^= z[p.b[sq] + 6][sq];
  h ^= z[ZC][p.castle];
  if (p.ep >= 0) h ^= z[ZE][p.ep & 7];
  if (p.turn !== WHITE) h ^= z[ZT][0];
  return h;
}

const TT_BITS = 16;
const TT_SIZE = 1 << TT_BITS;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

// ---------------------------------------------------------------- search

class Search {
  readonly p: Pos;
  nodes = 0;
  stopped = false;
  readonly deadline: number;
  readonly maxNodes: number;
  h1 = 0;
  h2 = 0;
  /** Keys of the positions on the path (and the game before it), for repetition. */
  readonly path: number[];
  readonly killers = new Int32Array(MAX_PLY * 2);
  readonly history = new Int32Array(64 * 64);
  readonly ttCheck = new Int32Array(TT_SIZE);
  readonly ttMove = new Int32Array(TT_SIZE);
  readonly ttScore = new Int32Array(TT_SIZE);
  readonly ttDepth = new Int8Array(TT_SIZE);
  readonly ttFlag = new Int8Array(TT_SIZE);

  constructor(p: Pos, past: number[], deadline: number, maxNodes: number) {
    this.p = p;
    this.deadline = deadline;
    this.maxNodes = maxNodes;
    this.h1 = hashOf(p, Z1);
    this.h2 = hashOf(p, Z2);
    this.path = past;
  }

  /** make() plus the Zobrist update. */
  private play(m: number) {
    const p = this.p;
    const from = mFrom(m);
    const to = mTo(m);
    const piece = p.b[from];
    const us = p.turn;
    const oldCastle = p.castle;
    const oldEp = p.ep;
    const u = make(p, m);
    let a = this.h1;
    let c = this.h2;
    const pz = piece + 6;
    a ^= Z1[pz][from];
    c ^= Z2[pz][from];
    const nz = p.b[to] + 6;
    a ^= Z1[nz][to];
    c ^= Z2[nz][to];
    if (u.cap) {
      const capSq = mFlag(m) === EP ? to - 8 * us : to;
      a ^= Z1[u.cap + 6][capSq];
      c ^= Z2[u.cap + 6][capSq];
    }
    if (mFlag(m) === CASTLE) {
      const rf = to > from ? to + 1 : to - 2;
      const rt = to > from ? to - 1 : to + 1;
      const rz = ROOK * us + 6;
      a ^= Z1[rz][rf] ^ Z1[rz][rt];
      c ^= Z2[rz][rf] ^ Z2[rz][rt];
    }
    if (oldCastle !== p.castle) {
      a ^= Z1[ZC][oldCastle] ^ Z1[ZC][p.castle];
      c ^= Z2[ZC][oldCastle] ^ Z2[ZC][p.castle];
    }
    if (oldEp >= 0) {
      a ^= Z1[ZE][oldEp & 7];
      c ^= Z2[ZE][oldEp & 7];
    }
    if (p.ep >= 0) {
      a ^= Z1[ZE][p.ep & 7];
      c ^= Z2[ZE][p.ep & 7];
    }
    a ^= Z1[ZT][0];
    c ^= Z2[ZT][0];
    const saved = [this.h1, this.h2];
    this.h1 = a;
    this.h2 = c;
    this.path.push(a);
    return { u, saved };
  }

  private back(s: { u: ReturnType<typeof make>; saved: number[] }) {
    unmake(this.p, s.u);
    this.path.pop();
    this.h1 = s.saved[0];
    this.h2 = s.saved[1];
  }

  /** Did the move just made leave our own king in check? */
  private illegal() {
    const p = this.p;
    const us = -p.turn as Color;
    return attacked(p.b, p.kings[kingIdx(us)], p.turn);
  }

  private tick() {
    if ((++this.nodes & 1023) === 0 && (Date.now() > this.deadline || this.nodes > this.maxNodes)) this.stopped = true;
  }

  /** Order: hash move, captures by MVV-LVA, promotions, killers, then history. */
  private scoreMoves(moves: number[], ply: number, hashMove: number): number[] {
    const b = this.p.b;
    return moves.map((m) => {
      if (m === hashMove) return 10_000_000;
      const victim = mFlag(m) === EP ? PAWN : Math.abs(b[mTo(m)]);
      if (victim) return 1_000_000 + victim * 100 - Math.abs(b[mFrom(m)]);
      if (mPromo(m)) return 900_000 + mPromo(m);
      if (m === this.killers[ply * 2]) return 800_000;
      if (m === this.killers[ply * 2 + 1]) return 700_000;
      return this.history[mFrom(m) * 64 + mTo(m)];
    });
  }

  /** Swap the best remaining move to index i. */
  private static pick(moves: number[], scores: number[], i: number) {
    let best = i;
    for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[best]) best = j;
    if (best !== i) {
      [moves[i], moves[best]] = [moves[best], moves[i]];
      [scores[i], scores[best]] = [scores[best], scores[i]];
    }
  }

  quiesce(alpha: number, beta: number, ply: number): number {
    this.tick();
    if (this.stopped) return 0;
    const stand = evaluate(this.p);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply >= MAX_PLY - 1) return stand;
    const moves = genMoves(this.p, [], true);
    const scores = this.scoreMoves(moves, ply, 0);
    for (let i = 0; i < moves.length; i++) {
      Search.pick(moves, scores, i);
      const m = moves[i];
      // Delta pruning: even winning this piece can't lift us to alpha
      const victim = mFlag(m) === EP ? PAWN : Math.abs(this.p.b[mTo(m)]);
      if (!mPromo(m) && stand + VALUE[victim] + 200 < alpha) continue;
      const s = this.play(m);
      if (this.illegal()) {
        this.back(s);
        continue;
      }
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      this.back(s);
      if (this.stopped) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private repeated() {
    const path = this.path;
    const key = path[path.length - 1];
    // Same side to move, within the reversible stretch (half-move clock)
    const limit = Math.max(0, path.length - 1 - this.p.half);
    for (let i = path.length - 3; i >= limit; i -= 2) if (path[i] === key) return true;
    return false;
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    const p = this.p;
    if (ply > 0) {
      if (p.half >= 100 || this.repeated()) return 0;
    }
    const check = inCheck(p);
    if (check && ply < MAX_PLY / 2) depth++;
    if (depth <= 0 || ply >= MAX_PLY - 1) return this.quiesce(alpha, beta, ply);
    this.tick();
    if (this.stopped) return 0;

    const slot = this.h1 & (TT_SIZE - 1);
    let hashMove = 0;
    if (this.ttCheck[slot] === this.h2 && this.ttFlag[slot]) {
      hashMove = this.ttMove[slot];
      if (ply > 0 && this.ttDepth[slot] >= depth) {
        let s = this.ttScore[slot];
        if (s > MATE - 1000) s -= ply;
        else if (s < -MATE + 1000) s += ply;
        const flag = this.ttFlag[slot];
        if (flag === EXACT || (flag === LOWER && s >= beta) || (flag === UPPER && s <= alpha)) return s;
      }
    }

    const moves = genMoves(p);
    const scores = this.scoreMoves(moves, ply, hashMove);
    const alpha0 = alpha;
    let best = -INF;
    let bestMove = 0;
    let legal = 0;
    for (let i = 0; i < moves.length; i++) {
      Search.pick(moves, scores, i);
      const m = moves[i];
      const s = this.play(m);
      if (this.illegal()) {
        this.back(s);
        continue;
      }
      legal++;
      let score: number;
      // Principal variation search: a null window for all but the first move
      if (legal === 1) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      else {
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1);
        if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      }
      this.back(s);
      if (this.stopped) return 0;
      if (score > best) {
        best = score;
        bestMove = m;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        const quiet = !p.b[mTo(m)] && mFlag(m) !== EP && !mPromo(m);
        if (quiet) {
          if (this.killers[ply * 2] !== m) {
            this.killers[ply * 2 + 1] = this.killers[ply * 2];
            this.killers[ply * 2] = m;
          }
          this.history[mFrom(m) * 64 + mTo(m)] += depth * depth;
        }
        break;
      }
    }
    if (legal === 0) return check ? -MATE + ply : 0;

    let stored = best;
    if (stored > MATE - 1000) stored += ply;
    else if (stored < -MATE + 1000) stored -= ply;
    this.ttCheck[slot] = this.h2;
    this.ttMove[slot] = bestMove;
    this.ttScore[slot] = stored;
    this.ttDepth[slot] = depth;
    this.ttFlag[slot] = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    return best;
  }

  /**
   * One root iteration. `noise[i]` is added to root move i's score (Easy and
   * Normal), applied exactly by shifting each move's search bounds.
   */
  root(moves: number[], noise: number[], depth: number): { move: number; score: number } | null {
    let alpha = -INF;
    let best: { move: number; score: number } | null = null;
    for (let i = 0; i < moves.length; i++) {
      const n = noise[i];
      const s = this.play(moves[i]);
      const score = n - this.negamax(depth - 1, -INF, -(alpha - n), 1);
      this.back(s);
      if (this.stopped) return best;
      if (score > alpha || !best) {
        alpha = score;
        best = { move: moves[i], score };
      }
    }
    return best;
  }
}

export interface AiOptions {
  /** Override the level's time budget (tests). */
  ms?: number;
  /** Override the level's depth. */
  depth?: number;
}

/**
 * The computer's move for the side to move in `g`, packed (see logic.mv), or
 * -1 if there is none. `rand` makes Easy and Normal vary between games.
 */
export function chooseMove(g: Game, level: Difficulty, rand: () => number, opts: AiOptions = {}): number {
  const cfg = AI_LEVELS[level];
  const p = clonePos(g.pos);
  const moves = legalMoves(p);
  if (moves.length === 0) return -1;
  if (moves.length === 1) return moves[0];
  if (cfg.random > 0 && rand() < cfg.random) return moves[Math.floor(rand() * moves.length)];

  // The game so far, as keys the search can match repetitions against
  const past: number[] = [];
  const walk = replay([]);
  past.push(hashOf(walk.pos, Z1));
  for (const m of g.history) {
    make(walk.pos, m);
    past.push(hashOf(walk.pos, Z1));
  }
  past.pop();

  const ms = opts.ms ?? cfg.ms;
  const start = Date.now();
  const search = new Search(p, past, start + ms, AI_MAX_NODES);
  search.path.push(search.h1);
  // A little variety for Hard in the opening too
  const spread = cfg.noise || (g.history.length < 10 ? 12 : 0);
  const noise = moves.map(() => (spread ? Math.round((rand() * 2 - 1) * spread) : 0));
  const maxDepth = opts.depth ?? cfg.depth;

  let best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const r = search.root(moves, noise, depth);
    if (search.stopped) {
      // A partial iteration still counts once its first (previous best) move was searched
      if (r && r.move !== best && depth > 1) best = r.move;
      break;
    }
    if (!r) break;
    best = r.move;
    // Best first next time, keeping its noise with it
    const i = moves.indexOf(best);
    moves.unshift(...moves.splice(i, 1));
    noise.unshift(...noise.splice(i, 1));
    if (Math.abs(r.score) > MATE - 1000) break;
    // The next iteration would not finish in time
    if (Date.now() - start > ms * 0.45) break;
  }
  return best;
}
