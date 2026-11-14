// The rules of Cờ Thú (jungle animal chess), pure and deterministic: no DOM, no
// clock, no randomness. The state is plain JSON (numbers, arrays, strings) so a
// later online room can run, snapshot and send it as is.
//
// Board: 7 columns (x 0..6) × 9 rows (y 0..8), square index = y * 7 + x.
// Blue sits at the top (den at row 0), Red at the bottom (den at row 8) and
// moves first. A square holds 0 (empty), +rank (a red piece) or -rank (blue).

export const COLS = 7;
export const ROWS = 9;
export const SQUARES = COLS * ROWS;

/** Red is +1 and moves first; Blue is -1. A piece's sign is its side. */
export type Side = 1 | -1;
export const RED: Side = 1;
export const BLUE: Side = -1;

/** 1 Rat (Chuột) … 8 Elephant (Voi). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const RAT = 1;
export const CAT = 2;
export const DOG = 3;
export const WOLF = 4;
export const LEOPARD = 5;
export const TIGER = 6;
export const LION = 7;
export const ELEPHANT = 8;

/** Plies without a capture that end the game in a draw. */
export const QUIET_LIMIT = 200;
/** The same position (and side to move) this many times is a draw. */
export const REPEAT_LIMIT = 3;

export const sq = (x: number, y: number) => y * COLS + x;
export const colOf = (s: number) => s % COLS;
export const rowOf = (s: number) => Math.floor(s / COLS);

/** Each side's den: the centre of its back row. */
export const DEN: Record<Side, number> = { [RED]: sq(3, 8), [BLUE]: sq(3, 0) } as Record<Side, number>;
/** Each side's three traps, around its own den. */
export const TRAPS: Record<Side, readonly number[]> = {
  [RED]: [sq(2, 8), sq(4, 8), sq(3, 7)],
  [BLUE]: [sq(2, 0), sq(4, 0), sq(3, 1)],
} as Record<Side, readonly number[]>;

const WATER_MASK: boolean[] = Array.from({ length: SQUARES }, (_, s) => {
  const x = colOf(s);
  const y = rowOf(s);
  return y >= 3 && y <= 5 && (x === 1 || x === 2 || x === 4 || x === 5);
});
/** 0 none, 1 a red trap, -1 a blue trap (indexed by square). */
const TRAP_OWNER: number[] = Array.from({ length: SQUARES }, (_, s) => (TRAPS[RED].includes(s) ? RED : TRAPS[BLUE].includes(s) ? BLUE : 0));

export const isWater = (s: number) => WATER_MASK[s];
/** Whose trap this square is (0 for none). */
export const trapOwner = (s: number) => TRAP_OWNER[s];
export const isDen = (s: number) => s === DEN[RED] || s === DEN[BLUE];

export const sideOf = (piece: number): Side | 0 => (piece > 0 ? RED : piece < 0 ? BLUE : 0);
export const rankOf = (piece: number) => Math.abs(piece) as Rank | 0;

export interface Move {
  from: number;
  to: number;
}

export type ResultReason = "den" | "wipe" | "stuck" | "quiet" | "repeat";

export interface Result {
  /** The side that won, or 0 for a draw. */
  winner: Side | 0;
  reason: ResultReason;
}

/** The whole game, JSON-safe. Treat it as immutable: applyMove returns a new one. */
export interface State {
  board: number[];
  turn: Side;
  /** Plies played. */
  ply: number;
  /** Plies since the last capture (the 200-ply draw rule). */
  quiet: number;
  /** Position keys since the last capture, including the current one (repetition). */
  keys: string[];
  result: Result | null;
  /** The last move played, for the "last move" marker. */
  last: Move | null;
}

/** Standard set-up for Blue at the top; Red is the same turned half a turn. */
const BLUE_START: [number, number, Rank][] = [
  [0, 0, LION],
  [6, 0, TIGER],
  [1, 1, DOG],
  [5, 1, CAT],
  [0, 2, RAT],
  [2, 2, LEOPARD],
  [4, 2, WOLF],
  [6, 2, ELEPHANT],
];

export function initialBoard(): number[] {
  const board = new Array<number>(SQUARES).fill(0);
  for (const [x, y, r] of BLUE_START) {
    board[sq(x, y)] = -r;
    board[sq(COLS - 1 - x, ROWS - 1 - y)] = r;
  }
  return board;
}

/** A position's identity for repetition: the board and the side to move. */
export const positionKey = (board: readonly number[], turn: Side) => `${turn > 0 ? "r" : "b"}${board.map((p) => String.fromCharCode(72 + p)).join("")}`;

export function initialState(): State {
  const board = initialBoard();
  return { board, turn: RED, ply: 0, quiet: 0, keys: [positionKey(board, RED)], result: null, last: null };
}

/**
 * May the piece on `from` take the piece on `to`? (Both occupied by opposite
 * sides; the caller checked the step itself.)
 */
export function canCapture(board: readonly number[], from: number, to: number): boolean {
  const a = board[from];
  const d = board[to];
  if (a === 0 || d === 0 || sideOf(a) === sideOf(d)) return false;
  const ar = rankOf(a);
  const dr = rankOf(d);
  const fromWater = WATER_MASK[from];
  const toWater = WATER_MASK[to];
  // Water and land don't fight: a swimming rat can't bite onto the bank, and a
  // rat on the bank can't reach one in the water. Rat against rat in water is fine.
  if (fromWater !== toWater) return false;
  // An enemy standing in one of your traps is worth nothing
  if (TRAP_OWNER[to] === sideOf(a)) return true;
  if (ar === RAT && dr === ELEPHANT) return true;
  if (ar === ELEPHANT && dr === RAT) return false;
  return ar >= dr;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Can the piece on `from` end its move on `to` (empty, or an enemy it may take)? */
function canLand(board: readonly number[], from: number, to: number, side: Side): boolean {
  if (to === DEN[side]) return false;
  const t = board[to];
  if (t === 0) return true;
  if (sideOf(t) === side) return false;
  return canCapture(board, from, to);
}

/**
 * Where a lion or tiger on `from` lands jumping across the pond in (dx, dy),
 * or -1: the jump needs water next to it, no rat anywhere on the way, and a
 * land square on the far bank.
 */
export function jumpTarget(board: readonly number[], from: number, dx: number, dy: number): number {
  let x = colOf(from) + dx;
  let y = rowOf(from) + dy;
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS || !WATER_MASK[sq(x, y)]) return -1;
  while (x >= 0 && x < COLS && y >= 0 && y < ROWS && WATER_MASK[sq(x, y)]) {
    if (board[sq(x, y)] !== 0) return -1; // only a rat can be in the water
    x += dx;
    y += dy;
  }
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return -1;
  return sq(x, y);
}

/** Every move of the piece on `from` (empty list when there is none, or it isn't that side's turn's business). */
export function movesFrom(board: readonly number[], from: number): Move[] {
  const out: Move[] = [];
  pushMovesFrom(board, from, out);
  return out;
}

function pushMovesFrom(board: readonly number[], from: number, out: Move[]) {
  const p = board[from];
  if (p === 0) return;
  const side = sideOf(p) as Side;
  const r = rankOf(p);
  const x = colOf(from);
  const y = rowOf(from);
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
    const to = sq(nx, ny);
    if (WATER_MASK[to]) {
      if (r === RAT) {
        if (canLand(board, from, to, side)) out.push({ from, to });
      } else if (r === LION || r === TIGER) {
        const j = jumpTarget(board, from, dx, dy);
        if (j >= 0 && canLand(board, from, j, side)) out.push({ from, to: j });
      }
      continue;
    }
    if (canLand(board, from, to, side)) out.push({ from, to });
  }
}

/** Every legal move for the side to move (none once the game is over). */
export function legalMoves(state: State): Move[] {
  if (state.result) return [];
  return movesFor(state.board, state.turn);
}

/** Every move `side` could make on `board`, ignoring whose turn it is. */
export function movesFor(board: readonly number[], side: Side): Move[] {
  const out: Move[] = [];
  for (let s = 0; s < SQUARES; s++) if (board[s] !== 0 && sideOf(board[s]) === side) pushMovesFrom(board, s, out);
  return out;
}

export const isLegal = (state: State, m: Move) => legalMoves(state).some((l) => l.from === m.from && l.to === m.to);

/** A jump across the pond (lion or tiger), for the arc in the UI. */
export const isJump = (m: Move) => Math.abs(colOf(m.from) - colOf(m.to)) + Math.abs(rowOf(m.from) - rowOf(m.to)) > 1;

/** The outcome after `mover` moved and it is now the other side's turn, or null. */
function judge(board: readonly number[], mover: Side, to: number, quiet: number, keys: readonly string[]): Result | null {
  if (to === DEN[(-mover) as Side]) return { winner: mover, reason: "den" };
  const foe = (-mover) as Side;
  if (!board.some((p) => sideOf(p) === foe)) return { winner: mover, reason: "wipe" };
  if (movesFor(board, foe).length === 0) return { winner: mover, reason: "stuck" };
  const key = keys[keys.length - 1];
  if (keys.filter((k) => k === key).length >= REPEAT_LIMIT) return { winner: 0, reason: "repeat" };
  if (quiet >= QUIET_LIMIT) return { winner: 0, reason: "quiet" };
  return null;
}

/**
 * Play `m` (it must be legal: check with isLegal for untrusted input). Returns
 * the next state and whether a piece was taken; the old state is untouched.
 */
export function applyMove(state: State, m: Move): State {
  const board = state.board.slice();
  const captured = board[m.to] !== 0;
  board[m.to] = board[m.from];
  board[m.from] = 0;
  const turn = (-state.turn) as Side;
  const quiet = captured ? 0 : state.quiet + 1;
  const key = positionKey(board, turn);
  const keys = captured ? [key] : [...state.keys, key];
  return {
    board,
    turn,
    ply: state.ply + 1,
    quiet,
    keys,
    result: judge(board, state.turn, m.to, quiet, keys),
    last: { from: m.from, to: m.to },
  };
}

/** The game's outcome, or null while it is still on. */
export const result = (state: State): Result | null => state.result;

/** Pieces each side has lost so far, by rank, highest first. */
export function lostPieces(board: readonly number[], side: Side): Rank[] {
  const left = new Set<number>();
  for (const p of board) if (sideOf(p) === side) left.add(rankOf(p));
  const out: Rank[] = [];
  for (let r = ELEPHANT; r >= RAT; r--) if (!left.has(r)) out.push(r as Rank);
  return out;
}

/** Build a state from a move list (a saved run, a replay); stops at the first illegal move. */
export function replay(moves: readonly Move[]): State {
  let s = initialState();
  for (const m of moves) {
    if (!isLegal(s, m)) break;
    s = applyMove(s, m);
  }
  return s;
}

/** A state from a hand-made board, for tests and puzzles. */
export function stateFrom(board: readonly number[], turn: Side = RED): State {
  const b = board.slice();
  return { board: b, turn, ply: 0, quiet: 0, keys: [positionKey(b, turn)], result: null, last: null };
}

/** Parse untrusted JSON (a saved or received state) into a State, or null. */
export function parseState(raw: unknown): State | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Partial<State>;
  if (!Array.isArray(s.board) || s.board.length !== SQUARES || !s.board.every((p) => Number.isInteger(p) && Math.abs(p) <= ELEPHANT)) return null;
  if (s.turn !== RED && s.turn !== BLUE) return null;
  if (typeof s.ply !== "number" || typeof s.quiet !== "number" || !Array.isArray(s.keys)) return null;
  return {
    board: s.board.slice(),
    turn: s.turn,
    ply: s.ply,
    quiet: s.quiet,
    keys: s.keys.filter((k): k is string => typeof k === "string"),
    result: s.result ?? null,
    last: s.last ?? null,
  };
}
