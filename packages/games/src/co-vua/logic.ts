import { AWAY_SECONDS, MATCH_QUICK_BONUS, MATCH_QUICK_MOVES, MATCH_WIN_SCORE, OFFER_GAP } from "./config";

// The laws of chess, pure. A `Pos` is one position (make/unmake for speed, used
// by the computer too); a `Game` is a position plus its history and result; a
// `Match` is the online game the realtime room runs (online.ts).
//
// Squares: sq = rank * 8 + file, a1 = 0, h1 = 7, a8 = 56, h8 = 63.
// Pieces: White positive, Black negative: pawn 1, knight 2, bishop 3, rook 4,
// queen 5, king 6. Moves are packed into one int (see `mv`).

export type Color = 1 | -1;
export const WHITE: Color = 1;
export const BLACK: Color = -1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
/** What a pawn may become. */
export const PROMOS = [QUEEN, ROOK, BISHOP, KNIGHT] as const;
export type Promo = (typeof PROMOS)[number];

export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
export const sqName = (sq: number) => `${"abcdefgh"[sq & 7]}${(sq >> 3) + 1}`;
export const sqOf = (name: string) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
/** A light square? (a1 is dark.) */
export const isLight = (sq: number) => ((sq >> 3) + (sq & 7)) % 2 === 1;

// ---------------------------------------------------------------- moves

/** Move flags. */
export const EP = 1;
export const CASTLE = 2;
export const DOUBLE = 3;

export const mv = (from: number, to: number, promo = 0, flag = 0) => from | (to << 6) | (promo << 12) | (flag << 16);
export const mFrom = (m: number) => m & 63;
export const mTo = (m: number) => (m >> 6) & 63;
export const mPromo = (m: number) => (m >> 12) & 7;
export const mFlag = (m: number) => m >> 16;

// ---------------------------------------------------------------- tables

const KNIGHT_JUMPS: [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
/** Orthogonal directions first (0–3), then diagonals (4–7). */
const DIRS: [number, number][] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const steps = (sq: number, jumps: [number, number][]) => {
  const out: number[] = [];
  for (const [df, dr] of jumps) {
    const f = fileOf(sq) + df;
    const r = rankOf(sq) + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(r * 8 + f);
  }
  return out;
};
const SQUARES = Array.from({ length: 64 }, (_, i) => i);
export const KNIGHT_T: number[][] = SQUARES.map((sq) => steps(sq, KNIGHT_JUMPS));
export const KING_T: number[][] = SQUARES.map((sq) => steps(sq, DIRS));
/** RAYS[dir][sq]: the squares outward from sq, nearest first. */
export const RAYS: number[][][] = DIRS.map(([df, dr]) =>
  SQUARES.map((sq) => {
    const out: number[] = [];
    let f = fileOf(sq) + df;
    let r = rankOf(sq) + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      out.push(r * 8 + f);
      f += df;
      r += dr;
    }
    return out;
  }),
);

/** Castling rights: 1 White O-O, 2 White O-O-O, 4 Black O-O, 8 Black O-O-O. Moving from/to these squares clears them. */
const CASTLE_MASK: number[] = SQUARES.map((sq) => {
  if (sq === 0) return ~2 & 15;
  if (sq === 7) return ~1 & 15;
  if (sq === 4) return ~3 & 15;
  if (sq === 56) return ~8 & 15;
  if (sq === 63) return ~4 & 15;
  if (sq === 60) return ~12 & 15;
  return 15;
});

// ---------------------------------------------------------------- position

export interface Pos {
  /** 64 squares, see the header. */
  b: number[];
  turn: Color;
  castle: number;
  /** The square a pawn just skipped (en passant target), or -1. */
  ep: number;
  /** Plies since the last capture or pawn move (fifty-move rule). */
  half: number;
  full: number;
  /** King squares: [White, Black]. */
  kings: [number, number];
}

export const kingIdx = (c: Color) => (c === WHITE ? 0 : 1);

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const LETTERS = " pnbrqk";

export function fromFen(fen: string): Pos {
  const [board, turn = "w", castle = "-", ep = "-", half = "0", full = "1"] = fen.trim().split(/\s+/);
  const b = new Array(64).fill(0);
  const kings: [number, number] = [-1, -1];
  let r = 7;
  let f = 0;
  for (const ch of board) {
    if (ch === "/") {
      r--;
      f = 0;
    } else if (ch >= "1" && ch <= "8") f += Number(ch);
    else {
      const t = LETTERS.indexOf(ch.toLowerCase());
      const c = ch === ch.toUpperCase() ? 1 : -1;
      b[r * 8 + f] = t * c;
      if (t === KING) kings[c === 1 ? 0 : 1] = r * 8 + f;
      f++;
    }
  }
  let cr = 0;
  if (castle.includes("K")) cr |= 1;
  if (castle.includes("Q")) cr |= 2;
  if (castle.includes("k")) cr |= 4;
  if (castle.includes("q")) cr |= 8;
  return {
    b,
    turn: turn === "b" ? BLACK : WHITE,
    castle: cr,
    ep: ep === "-" ? -1 : sqOf(ep),
    half: Number(half) || 0,
    full: Number(full) || 1,
    kings,
  };
}

export function toFen(p: Pos): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = "";
    let gap = 0;
    for (let f = 0; f < 8; f++) {
      const v = p.b[r * 8 + f];
      if (!v) {
        gap++;
        continue;
      }
      if (gap) row += gap;
      gap = 0;
      const ch = LETTERS[Math.abs(v)];
      row += v > 0 ? ch.toUpperCase() : ch;
    }
    rows.push(gap ? row + gap : row);
  }
  const cr = `${p.castle & 1 ? "K" : ""}${p.castle & 2 ? "Q" : ""}${p.castle & 4 ? "k" : ""}${p.castle & 8 ? "q" : ""}` || "-";
  return `${rows.join("/")} ${p.turn === WHITE ? "w" : "b"} ${cr} ${p.ep < 0 ? "-" : sqName(p.ep)} ${p.half} ${p.full}`;
}

export const clonePos = (p: Pos): Pos => ({ ...p, b: p.b.slice(), kings: [p.kings[0], p.kings[1]] });

/** Is `sq` attacked by any piece of colour `by`? */
export function attacked(b: readonly number[], sq: number, by: Color): boolean {
  const f = fileOf(sq);
  const r = rankOf(sq) - by;
  // A pawn of `by` one rank behind, on a neighbouring file
  if (r >= 0 && r < 8) {
    if (f > 0 && b[r * 8 + f - 1] === by) return true;
    if (f < 7 && b[r * 8 + f + 1] === by) return true;
  }
  for (const t of KNIGHT_T[sq]) if (b[t] === KNIGHT * by) return true;
  for (const t of KING_T[sq]) if (b[t] === KING * by) return true;
  for (let d = 0; d < 8; d++) {
    const slider = d < 4 ? ROOK * by : BISHOP * by;
    for (const t of RAYS[d][sq]) {
      const v = b[t];
      if (!v) continue;
      if (v === slider || v === QUEEN * by) return true;
      break;
    }
  }
  return false;
}

export const inCheck = (p: Pos, c: Color = p.turn) => attacked(p.b, p.kings[kingIdx(c)], -c as Color);

function pushPawn(out: number[], from: number, to: number, promoRank: boolean, flag = 0) {
  if (promoRank) for (const pr of PROMOS) out.push(mv(from, to, pr));
  else out.push(mv(from, to, 0, flag));
}

/**
 * Pseudo-legal moves for the side to move (may leave its king in check;
 * castling is checked fully). `captures` limits it to captures and promotions.
 */
export function genMoves(p: Pos, out: number[] = [], captures = false): number[] {
  const { b } = p;
  const us = p.turn;
  for (let sq = 0; sq < 64; sq++) {
    const v = b[sq] * us;
    if (v <= 0) continue;
    if (v === PAWN) {
      const one = sq + 8 * us;
      const r = rankOf(sq);
      const lastRank = rankOf(one) === (us === WHITE ? 7 : 0);
      if (b[one] === 0 && (!captures || lastRank)) {
        pushPawn(out, sq, one, lastRank);
        const two = one + 8 * us;
        if (!captures && r === (us === WHITE ? 1 : 6) && b[two] === 0) out.push(mv(sq, two, 0, DOUBLE));
      }
      const f = fileOf(sq);
      for (const df of [-1, 1]) {
        if (f + df < 0 || f + df > 7) continue;
        const t = one + df;
        if (b[t] * us < 0) pushPawn(out, sq, t, lastRank);
        else if (t === p.ep) out.push(mv(sq, t, 0, EP));
      }
    } else if (v === KNIGHT || v === KING) {
      for (const t of (v === KNIGHT ? KNIGHT_T : KING_T)[sq]) {
        const w = b[t] * us;
        if (w < 0 || (w === 0 && !captures)) out.push(mv(sq, t));
      }
    } else {
      const d0 = v === BISHOP ? 4 : 0;
      const d1 = v === ROOK ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        for (const t of RAYS[d][sq]) {
          const w = b[t] * us;
          if (w > 0) break;
          if (w < 0) {
            out.push(mv(sq, t));
            break;
          }
          if (!captures) out.push(mv(sq, t));
        }
      }
    }
  }
  if (!captures) {
    // Castling: rights kept, squares between empty, and the king never in, through or into check
    const them = -us as Color;
    const home = us === WHITE ? 0 : 56;
    const kRight = us === WHITE ? 1 : 4;
    const qRight = us === WHITE ? 2 : 8;
    if (p.castle & (kRight | qRight) && b[home + 4] === KING * us && !attacked(b, home + 4, them)) {
      if (p.castle & kRight && b[home + 5] === 0 && b[home + 6] === 0 && b[home + 7] === ROOK * us && !attacked(b, home + 5, them) && !attacked(b, home + 6, them))
        out.push(mv(home + 4, home + 6, 0, CASTLE));
      if (
        p.castle & qRight &&
        b[home + 3] === 0 &&
        b[home + 2] === 0 &&
        b[home + 1] === 0 &&
        b[home] === ROOK * us &&
        !attacked(b, home + 3, them) &&
        !attacked(b, home + 2, them)
      )
        out.push(mv(home + 4, home + 2, 0, CASTLE));
    }
  }
  return out;
}

/** What `make` changed, so `unmake` can put it back. */
export interface Undo {
  m: number;
  cap: number;
  castle: number;
  ep: number;
  half: number;
}

export function make(p: Pos, m: number): Undo {
  const { b } = p;
  const from = mFrom(m);
  const to = mTo(m);
  const promo = mPromo(m);
  const flag = mFlag(m);
  const us = p.turn;
  const piece = b[from];
  const u: Undo = { m, cap: b[to], castle: p.castle, ep: p.ep, half: p.half };
  if (flag === EP) {
    const capSq = to - 8 * us;
    u.cap = b[capSq];
    b[capSq] = 0;
  }
  b[to] = promo ? promo * us : piece;
  b[from] = 0;
  if (flag === CASTLE) {
    if (to > from) {
      b[to - 1] = b[to + 1];
      b[to + 1] = 0;
    } else {
      b[to + 1] = b[to - 2];
      b[to - 2] = 0;
    }
  }
  if (piece * us === KING) p.kings[kingIdx(us)] = to;
  p.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
  p.ep = flag === DOUBLE ? (from + to) >> 1 : -1;
  p.half = piece * us === PAWN || u.cap ? 0 : p.half + 1;
  if (us === BLACK) p.full++;
  p.turn = -us as Color;
  return u;
}

export function unmake(p: Pos, u: Undo) {
  const { b } = p;
  const { m } = u;
  const from = mFrom(m);
  const to = mTo(m);
  const flag = mFlag(m);
  const us = -p.turn as Color;
  p.turn = us;
  b[from] = mPromo(m) ? PAWN * us : b[to];
  if (flag === EP) {
    b[to] = 0;
    b[to - 8 * us] = u.cap;
  } else b[to] = u.cap;
  if (flag === CASTLE) {
    if (to > from) {
      b[to + 1] = b[to - 1];
      b[to - 1] = 0;
    } else {
      b[to - 2] = b[to + 1];
      b[to + 1] = 0;
    }
  }
  if (b[from] * us === KING) p.kings[kingIdx(us)] = from;
  p.castle = u.castle;
  p.ep = u.ep;
  p.half = u.half;
  if (us === BLACK) p.full--;
}

/** Fully legal moves for the side to move. */
export function legalMoves(p: Pos): number[] {
  const us = p.turn;
  const out: number[] = [];
  for (const m of genMoves(p)) {
    const u = make(p, m);
    if (!attacked(p.b, p.kings[kingIdx(us)], p.turn)) out.push(m);
    unmake(p, u);
  }
  return out;
}

/** Count leaf positions `depth` plies deep (the standard move-generator test). */
export function perft(p: Pos, depth: number): number {
  if (depth === 0) return 1;
  const us = p.turn;
  let n = 0;
  for (const m of genMoves(p)) {
    const u = make(p, m);
    if (!attacked(p.b, p.kings[kingIdx(us)], p.turn)) n += depth === 1 ? 1 : perft(p, depth - 1);
    unmake(p, u);
  }
  return n;
}

/** Neither side can possibly mate: K v K, K + minor v K, or only bishops all on one square colour. */
export function insufficient(b: readonly number[]): boolean {
  let knights = 0;
  let light = 0;
  let dark = 0;
  for (let sq = 0; sq < 64; sq++) {
    const t = Math.abs(b[sq]);
    if (t === PAWN || t === ROOK || t === QUEEN) return false;
    if (t === KNIGHT) knights++;
    else if (t === BISHOP) {
      if (isLight(sq)) light++;
      else dark++;
    }
  }
  const minors = knights + light + dark;
  if (minors <= 1) return true;
  return knights === 0 && (light === 0 || dark === 0);
}

// ---------------------------------------------------------------- notation

const SAN_LETTERS = ["", "", "N", "B", "R", "Q", "K"];

/** Standard algebraic notation for legal move `m` (with + or #). */
export function san(p: Pos, m: number, legal: readonly number[] = legalMoves(p)): string {
  const from = mFrom(m);
  const to = mTo(m);
  const t = Math.abs(p.b[from]);
  let s: string;
  if (mFlag(m) === CASTLE) s = to > from ? "O-O" : "O-O-O";
  else {
    const capture = p.b[to] !== 0 || mFlag(m) === EP;
    if (t === PAWN) {
      s = capture ? `${"abcdefgh"[fileOf(from)]}x${sqName(to)}` : sqName(to);
      if (mPromo(m)) s += `=${SAN_LETTERS[mPromo(m)]}`;
    } else {
      const rivals = legal.filter((o) => o !== m && mTo(o) === to && Math.abs(p.b[mFrom(o)]) === t).map(mFrom);
      let dis = "";
      if (rivals.length) {
        if (!rivals.some((r) => fileOf(r) === fileOf(from))) dis = "abcdefgh"[fileOf(from)];
        else if (!rivals.some((r) => rankOf(r) === rankOf(from))) dis = String(rankOf(from) + 1);
        else dis = sqName(from);
      }
      s = `${SAN_LETTERS[t]}${dis}${capture ? "x" : ""}${sqName(to)}`;
    }
  }
  const u = make(p, m);
  if (inCheck(p)) s += legalMoves(p).length ? "+" : "#";
  unmake(p, u);
  return s;
}

// ---------------------------------------------------------------- repetition keys

/** cyrb53: a 53-bit string hash, safe as a JSON number. */
function hash53(str: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * The position as FIDE counts repetitions: pieces, side to move, castling
 * rights, and the en passant square only when a capture there is legal.
 */
export function posKey(p: Pos, legal: readonly number[] = legalMoves(p)): number {
  const ep = p.ep >= 0 && legal.some((m) => mFlag(m) === EP) ? p.ep : -1;
  return hash53(`${p.b.join(",")}|${p.turn}|${p.castle}|${ep}`);
}

// ---------------------------------------------------------------- a game

export type EndReason = "mate" | "stalemate" | "repetition" | "fifty" | "material" | "resign" | "agreement" | "forfeit";

export interface Result {
  /** The winning colour, or 0 for a draw. */
  winner: Color | 0;
  reason: EndReason;
}

export interface Game {
  pos: Pos;
  /** Packed moves from the start position, in order. */
  history: number[];
  /** The same moves in algebraic notation. */
  san: string[];
  /** Repetition keys of every position so far, the start included. */
  keys: number[];
  last: { from: number; to: number } | null;
  result: Result | null;
}

export function newGame(): Game {
  const pos = fromFen(START_FEN);
  return { pos, history: [], san: [], keys: [posKey(pos)], last: null, result: null };
}

/** The legal move from→to (with `promo` when it promotes), or null. */
export function findMove(p: Pos, from: number, to: number, promo: number = QUEEN): number | null {
  for (const m of legalMoves(p)) {
    if (mFrom(m) !== from || mTo(m) !== to) continue;
    if (mPromo(m) && mPromo(m) !== promo) continue;
    return m;
  }
  return null;
}

/** Legal destinations of the piece on `from` (each promotion once). */
export function targetsFrom(p: Pos, from: number): number[] {
  const out = new Set<number>();
  for (const m of legalMoves(p)) if (mFrom(m) === from) out.add(mTo(m));
  return [...out];
}

/** Does from→to need a promotion choice? */
export const isPromotion = (p: Pos, from: number, to: number) =>
  Math.abs(p.b[from]) === PAWN && (rankOf(to) === 7 || rankOf(to) === 0) && legalMoves(p).some((m) => mFrom(m) === from && mTo(m) === to);

/** Decide the game after a move, if it is over. */
function judge(g: Game, legal: readonly number[]) {
  const p = g.pos;
  if (legal.length === 0) {
    g.result = inCheck(p) ? { winner: -p.turn as Color, reason: "mate" } : { winner: 0, reason: "stalemate" };
    return;
  }
  const key = g.keys[g.keys.length - 1];
  if (g.keys.filter((k) => k === key).length >= 3) g.result = { winner: 0, reason: "repetition" };
  else if (p.half >= 100) g.result = { winner: 0, reason: "fifty" };
  else if (insufficient(p.b)) g.result = { winner: 0, reason: "material" };
}

/** Play from→to for the side to move. False (and no change) if it is not legal or the game is over. */
export function playMove(g: Game, from: number, to: number, promo: number = QUEEN): boolean {
  if (g.result) return false;
  const m = findMove(g.pos, from, to, promo);
  if (m === null) return false;
  g.san.push(san(g.pos, m));
  make(g.pos, m);
  g.history.push(m);
  g.last = { from, to };
  const legal = legalMoves(g.pos);
  g.keys.push(posKey(g.pos, legal));
  judge(g, legal);
  return true;
}

/** A game replayed from its packed moves (stops at the first illegal one). */
export function replay(history: readonly number[]): Game {
  const g = newGame();
  for (const m of history) if (!playMove(g, mFrom(m), mTo(m), mPromo(m) || QUEEN)) break;
  return g;
}

/** The game with its last `n` plies taken back. */
export const takeBack = (g: Game, n: number): Game => replay(g.history.slice(0, Math.max(0, g.history.length - n)));

/** The square of the king in check, or -1. */
export const checkedKing = (p: Pos) => (inCheck(p) ? p.kings[kingIdx(p.turn)] : -1);

export const PIECE_VALUE = [0, 1, 3, 3, 5, 9, 0];

/**
 * Material balance as captured pieces: for each type, the side with more of it
 * shows the difference. `up` is White's lead in points (negative: Black's).
 */
export function material(b: readonly number[]): { white: number[]; black: number[]; up: number } {
  const count = new Array(13).fill(0);
  for (const v of b) count[v + 6]++;
  const white: number[] = [];
  const black: number[] = [];
  let up = 0;
  for (const t of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN]) {
    const d = count[t + 6] - count[-t + 6];
    for (let i = 0; i < Math.abs(d); i++) (d > 0 ? white : black).push(t);
    up += d * PIECE_VALUE[t];
  }
  return { white, black, up };
}

/** Moves a colour has made (counted from the notation, which snapshots keep). */
export const movesBy = (g: Game, c: Color) => (c === WHITE ? Math.ceil(g.san.length / 2) : Math.floor(g.san.length / 2));

// ---------------------------------------------------------------- online match

export interface Seat {
  name: string;
  /** Seat 0 plays White, seat 1 Black. */
  color: Color;
  /** Seconds since this player dropped, or null while connected. */
  away: number | null;
  /** The ply count when this seat last offered a draw. */
  offeredAt: number;
}

export type Action =
  | { type: "move"; from: number; to: number; promo?: Promo }
  | { type: "resign" }
  | { type: "draw" }
  | { type: "accept" }
  | { type: "decline" };

export type MatchEvent =
  | { type: "move"; from: number; to: number; promo: number; san: string; color: Color; capture: boolean }
  | { type: "offer"; seat: number }
  | { type: "decline"; seat: number }
  | { type: "over"; winner: number | null; reason: EndReason };

export interface Match {
  seats: Seat[];
  game: Game;
  phase: "play" | "over";
  /** The seat whose draw offer is on the table, or null. */
  offer: number | null;
  /** The winner's seat once over; null for a draw. */
  winner: number | null;
  reason: EndReason | null;
  events: MatchEvent[];
}

export const seatOf = (c: Color) => (c === WHITE ? 0 : 1);

export function createMatch(names: string[]): Match {
  return {
    seats: [0, 1].map((i) => ({
      name: names[i] ?? (i === 0 ? "White" : "Black"),
      color: (i === 0 ? WHITE : BLACK) as Color,
      away: null,
      offeredAt: -OFFER_GAP,
    })),
    game: newGame(),
    phase: "play",
    offer: null,
    winner: null,
    reason: null,
    events: [],
  };
}

function end(m: Match, winner: number | null, reason: EndReason) {
  m.phase = "over";
  m.winner = winner;
  m.reason = reason;
  m.offer = null;
  if (!m.game.result) m.game.result = { winner: winner === null ? 0 : (m.seats[winner]?.color ?? 0), reason };
  m.events.push({ type: "over", winner, reason });
}

/** Can `seat` offer a draw now? */
export const canOffer = (m: Match, seat: number) =>
  m.phase === "play" && m.offer === null && m.game.san.length >= (m.seats[seat]?.offeredAt ?? 0) + OFFER_GAP;

function act(m: Match, seat: number, a: Action) {
  const g = m.game;
  const s = m.seats[seat];
  if (!s) return;
  switch (a.type) {
    case "move": {
      if (g.pos.turn !== s.color) return;
      const capture = g.pos.b[a.to] !== 0 || (Math.abs(g.pos.b[a.from]) === PAWN && a.to === g.pos.ep);
      if (!playMove(g, a.from, a.to, a.promo ?? QUEEN)) return;
      m.events.push({
        type: "move",
        from: a.from,
        to: a.to,
        promo: mPromo(g.history[g.history.length - 1]),
        san: g.san[g.san.length - 1],
        color: s.color,
        capture,
      });
      // Moving answers the other side's offer with a no
      if (m.offer !== null && m.offer !== seat) {
        m.events.push({ type: "decline", seat });
        m.offer = null;
      }
      if (g.result) end(m, g.result.winner === 0 ? null : seatOf(g.result.winner), g.result.reason);
      return;
    }
    case "resign":
      return end(m, 1 - seat, "resign");
    case "draw":
      if (!canOffer(m, seat)) return;
      m.offer = seat;
      s.offeredAt = g.san.length;
      m.events.push({ type: "offer", seat });
      return;
    case "accept":
      if (m.offer === null || m.offer === seat) return;
      return end(m, null, "agreement");
    case "decline":
      if (m.offer === null || m.offer === seat) return;
      m.offer = null;
      m.events.push({ type: "decline", seat });
      return;
  }
}

/** One step of `dt` seconds with at most one action per seat. There is no clock; only being away too long loses. */
export function stepMatch(m: Match, dt: number, inputs: readonly (Action | null)[]) {
  if (m.phase === "over") return;
  for (const [i, s] of m.seats.entries()) {
    if (s.away === null) continue;
    s.away += dt;
    if (s.away >= AWAY_SECONDS) return end(m, 1 - i, "forfeit");
  }
  for (let seat = 0; seat < m.seats.length && m.phase === "play"; seat++) {
    const a = inputs[seat];
    if (a) act(m, seat, a);
  }
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

/** Leaderboard score for a seat once over: only a win scores, more for a quick checkmate. */
export function matchScore(m: Match, seat: number): number {
  const s = m.seats[seat];
  if (!s || m.winner !== seat) return 0;
  const quick = m.reason === "mate" ? Math.max(0, MATCH_QUICK_MOVES - movesBy(m.game, s.color)) * MATCH_QUICK_BONUS : 0;
  return MATCH_WIN_SCORE + quick;
}
