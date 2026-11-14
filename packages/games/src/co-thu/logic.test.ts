import { describe, expect, it } from "vitest";
import { chooseMove, createSearch } from "./ai";
import { DIFFICULTIES } from "./config";
import {
  BLUE,
  CAT,
  DEN,
  DOG,
  ELEPHANT,
  LEOPARD,
  LION,
  type Move,
  QUIET_LIMIT,
  RAT,
  RED,
  SQUARES,
  type State,
  TIGER,
  TRAPS,
  WOLF,
  applyMove,
  initialState,
  isWater,
  legalMoves,
  lostPieces,
  parseState,
  replay,
  sq,
  stateFrom,
} from "./logic";

/** A board with only the given pieces: [x, y, piece] (+red, -blue). */
function board(...pieces: [number, number, number][]): number[] {
  const b = new Array<number>(SQUARES).fill(0);
  for (const [x, y, p] of pieces) b[sq(x, y)] = p;
  return b;
}

const targets = (s: State, from: number) =>
  legalMoves(s)
    .filter((m) => m.from === from)
    .map((m) => m.to)
    .sort((a, c) => a - c);
const can = (s: State, from: number, to: number) => legalMoves(s).some((m) => m.from === from && m.to === to);
const mv = (fx: number, fy: number, tx: number, ty: number): Move => ({ from: sq(fx, fy), to: sq(tx, ty) });

// Two spare pieces far apart so neither side runs out of pieces or moves by accident
const SPARE: [number, number, number][] = [
  [0, 8, CAT],
  [6, 0, -CAT],
];

describe("set-up", () => {
  it("places the standard sixteen pieces, point-symmetric, red to move", () => {
    const s = initialState();
    expect(s.turn).toBe(RED);
    expect(s.board.filter((p) => p > 0)).toHaveLength(8);
    expect(s.board.filter((p) => p < 0)).toHaveLength(8);
    expect(s.board[sq(0, 0)]).toBe(-LION);
    expect(s.board[sq(6, 0)]).toBe(-TIGER);
    expect(s.board[sq(6, 2)]).toBe(-ELEPHANT);
    expect(s.board[sq(0, 2)]).toBe(-RAT);
    expect(s.board[sq(6, 8)]).toBe(LION);
    expect(s.board[sq(0, 8)]).toBe(TIGER);
    expect(s.board[sq(0, 6)]).toBe(ELEPHANT);
    expect(s.board[sq(6, 6)]).toBe(RAT);
    expect(DEN[RED]).toBe(sq(3, 8));
    expect(TRAPS[BLUE]).toEqual([sq(2, 0), sq(4, 0), sq(3, 1)]);
    // Two 2×3 ponds
    const water = Array.from({ length: SQUARES }, (_, i) => i).filter(isWater);
    expect(water).toHaveLength(12);
    expect(isWater(sq(1, 3)) && isWater(sq(5, 5)) && !isWater(sq(3, 4))).toBe(true);
    expect(legalMoves(s).length).toBeGreaterThan(0);
  });

  it("round-trips through JSON", () => {
    const s = applyMove(initialState(), mv(6, 6, 6, 5));
    const back = parseState(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
    expect(parseState({ board: [1, 2] })).toBeNull();
  });
});

describe("water", () => {
  it("only the rat may step into water", () => {
    const s = stateFrom(board([1, 6, RAT], [2, 6, WOLF], ...SPARE));
    expect(can(s, sq(1, 6), sq(1, 5))).toBe(true);
    expect(can(s, sq(2, 6), sq(2, 5))).toBe(false);
  });

  it("a rat swims through the pond", () => {
    const s = stateFrom(board([1, 4, RAT], ...SPARE));
    expect(targets(s, sq(1, 4))).toEqual([sq(0, 4), sq(2, 4), sq(1, 3), sq(1, 5)].sort((a, c) => a - c));
  });
});

describe("lion and tiger jumps", () => {
  it("jump the pond vertically and horizontally to the first land square", () => {
    const s = stateFrom(board([1, 6, LION], [3, 4, TIGER], ...SPARE));
    expect(can(s, sq(1, 6), sq(1, 2))).toBe(true);
    expect(can(s, sq(3, 4), sq(0, 4))).toBe(true);
    expect(can(s, sq(3, 4), sq(6, 4))).toBe(true);
    // Never stopping in the water
    expect(can(s, sq(1, 6), sq(1, 5))).toBe(false);
  });

  it("others can't jump", () => {
    const s = stateFrom(board([1, 6, LEOPARD], [0, 4, ELEPHANT], ...SPARE));
    expect(targets(s, sq(1, 6)).some((t) => isWater(t) || t === sq(1, 2))).toBe(false);
    expect(can(s, sq(0, 4), sq(3, 4))).toBe(false);
  });

  it("a rat of either side in the water on the path blocks the jump", () => {
    for (const rat of [RAT, -RAT]) {
      const s = stateFrom(board([1, 6, LION], [1, 4, rat], [3, 4, TIGER], ...SPARE));
      expect(can(s, sq(1, 6), sq(1, 2))).toBe(false);
      // Horizontally through the other pond is still open
      expect(can(s, sq(3, 4), sq(6, 4))).toBe(true);
      // and this pond's row 4 is blocked for the tiger too
      expect(can(s, sq(3, 4), sq(0, 4))).toBe(false);
    }
  });

  it("a jump may capture on the far bank, under the usual ranks", () => {
    const s = stateFrom(board([1, 6, LION], [1, 2, -TIGER], [2, 6, TIGER], [2, 2, -ELEPHANT], ...SPARE));
    expect(can(s, sq(1, 6), sq(1, 2))).toBe(true);
    expect(can(s, sq(2, 6), sq(2, 2))).toBe(false);
  });
});

describe("captures", () => {
  it("equal or lower rank only", () => {
    const s = stateFrom(board([3, 4, WOLF], [3, 3, -WOLF], [3, 5, -LEOPARD], [2, 6, DOG], ...SPARE));
    expect(can(s, sq(3, 4), sq(3, 3))).toBe(true);
    expect(can(s, sq(3, 4), sq(3, 5))).toBe(false);
  });

  it("the rat takes the elephant; the elephant can't take the rat", () => {
    const a = stateFrom(board([3, 4, RAT], [3, 3, -ELEPHANT], ...SPARE), RED);
    expect(can(a, sq(3, 4), sq(3, 3))).toBe(true);
    const b = stateFrom(board([3, 4, RAT], [3, 3, -ELEPHANT], ...SPARE), BLUE);
    expect(can(b, sq(3, 3), sq(3, 4))).toBe(false);
  });

  it("a rat in water can't take onto land, nor a rat on land into water; rat v rat in water is fine", () => {
    // Swimming rat next to an elephant and a rat on the bank
    const s = stateFrom(board([1, 3, RAT], [1, 2, -ELEPHANT], [0, 3, -RAT], ...SPARE), RED);
    expect(can(s, sq(1, 3), sq(1, 2))).toBe(false);
    expect(can(s, sq(1, 3), sq(0, 3))).toBe(false);
    // The bank rat can't bite into the water either
    const t = stateFrom(board([1, 3, RAT], [0, 3, -RAT], ...SPARE), BLUE);
    expect(can(t, sq(0, 3), sq(1, 3))).toBe(false);
    // Both swimming
    const u = stateFrom(board([1, 3, RAT], [1, 4, -RAT], ...SPARE), RED);
    expect(can(u, sq(1, 3), sq(1, 4))).toBe(true);
  });

  it("an enemy in your trap has rank 0", () => {
    // Blue elephant standing in a red trap next to the red den: the red cat may take it
    const trap = sq(3, 7);
    expect(TRAPS[RED]).toContain(trap);
    const s = stateFrom(board([3, 7, -ELEPHANT], [2, 7, CAT], [0, 0, -CAT], [6, 0, -DOG]), RED);
    expect(can(s, sq(2, 7), trap)).toBe(true);
    // The same elephant one square away (not a trap) is safe from the cat
    const t = stateFrom(board([1, 7, -ELEPHANT], [2, 7, CAT], [0, 0, -CAT]), RED);
    expect(can(t, sq(2, 7), sq(1, 7))).toBe(false);
    // Your own trap doesn't weaken your own piece: a red elephant there stays an elephant
    const u = stateFrom(board([3, 7, ELEPHANT], [2, 7, -CAT], [0, 8, CAT]), BLUE);
    expect(can(u, sq(2, 7), trap)).toBe(false);
  });

  it("a capture resets the quiet counter and is counted as lost", () => {
    const s = stateFrom(board([3, 4, WOLF], [3, 3, -DOG], ...SPARE));
    const next = applyMove(s, mv(3, 4, 3, 3));
    expect(next.quiet).toBe(0);
    expect(next.board[sq(3, 3)]).toBe(WOLF);
    expect(lostPieces(next.board, BLUE)).toContain(DOG);
  });
});

describe("dens and the end of the game", () => {
  it("a piece may not enter its own den", () => {
    const s = stateFrom(board([3, 7, CAT], ...SPARE));
    expect(can(s, sq(3, 7), DEN[RED])).toBe(false);
  });

  it("entering the enemy den wins", () => {
    const s = stateFrom(board([3, 1, CAT], ...SPARE));
    const next = applyMove(s, mv(3, 1, 3, 0));
    expect(next.result).toEqual({ winner: RED, reason: "den" });
    expect(legalMoves(next)).toEqual([]);
  });

  it("taking the last enemy piece wins", () => {
    const s = stateFrom(board([3, 4, WOLF], [3, 3, -DOG], [0, 8, CAT]));
    expect(applyMove(s, mv(3, 4, 3, 3)).result).toEqual({ winner: RED, reason: "wipe" });
  });

  it("leaving the opponent without a legal move wins", () => {
    // A blue rat in the corner, boxed in by a red elephant (it can't take it from... it can: rats eat elephants) so use cats
    const s = stateFrom(board([0, 0, -CAT], [1, 1, DOG], [0, 2, DOG], [6, 8, LION]), RED);
    // Red dog steps to (1,0): the blue cat's only squares (1,0) and (0,1)...
    const next = applyMove(s, mv(1, 1, 1, 0));
    // ...(0,1) is still free, so the game goes on
    expect(next.result).toBeNull();
    const boxed = stateFrom(board([0, 0, -CAT], [1, 1, DOG], [1, 0, DOG], [6, 8, LION]), RED);
    const done = applyMove(boxed, mv(1, 1, 0, 1));
    expect(done.result).toEqual({ winner: RED, reason: "stuck" });
  });

  it("threefold repetition is a draw", () => {
    let s = stateFrom(board([0, 8, CAT], [6, 0, -CAT]));
    const cycle = [mv(0, 8, 1, 8), mv(6, 0, 5, 0), mv(1, 8, 0, 8), mv(5, 0, 6, 0)];
    for (let round = 0; round < 2; round++)
      for (const m of cycle) {
        expect(s.result).toBeNull();
        s = applyMove(s, m);
      }
    expect(s.result).toEqual({ winner: 0, reason: "repeat" });
  });

  it("200 plies without a capture is a draw", () => {
    // Walk two lone pieces round without ever repeating a position three times
    let s: State = { ...stateFrom(board([0, 8, CAT], [6, 0, -CAT])), quiet: QUIET_LIMIT - 1 };
    s = applyMove(s, mv(0, 8, 1, 8));
    expect(s.result).toEqual({ winner: 0, reason: "quiet" });
  });

  it("replays a move list", () => {
    const moves = [mv(6, 6, 6, 5), mv(0, 2, 0, 3)];
    const s = replay(moves);
    expect(s.ply).toBe(2);
    expect(s.last).toEqual(moves[1]);
  });
});

describe("computer player", () => {
  it("takes an immediate den entry at every level", () => {
    for (const level of DIFFICULTIES) {
      const s = stateFrom(board([3, 1, CAT], [5, 5, ELEPHANT], [0, 4, -LION], [6, 3, -RAT], [6, 0, -DOG]), RED);
      expect(chooseMove(s, level, 7), level).toEqual(mv(3, 1, 3, 0));
    }
  });

  it("stops an immediate den entry at Normal and Hard", () => {
    // A blue wolf next to the red den; red's dog can take it, otherwise red loses next move
    const s = stateFrom(board([3, 7, -WOLF], [2, 7, WOLF], [6, 3, ELEPHANT], [0, 0, -CAT], [6, 0, -DOG]), RED);
    for (const level of ["normal", "hard"] as const) {
      const m = chooseMove(s, level, 3);
      expect(m, level).toEqual(mv(2, 7, 3, 7));
    }
  });

  it("does not walk into a losing reply at Normal and Hard", () => {
    // Red elephant could take the blue cat at (4,4), but then the blue rat at (5,4)... is in water: can't take on land.
    // Instead: red lion next to an enemy elephant that would take it if it stepped forward.
    const s = stateFrom(board([3, 5, LION], [3, 3, -ELEPHANT], [0, 8, CAT], [6, 0, -CAT]), RED);
    for (const level of ["normal", "hard"] as const) {
      const m = chooseMove(s, level, 11);
      expect(m, level).not.toEqual(mv(3, 5, 3, 4));
    }
  });

  it("is deterministic for a seed and always plays a legal move", () => {
    let s = initialState();
    for (let i = 0; i < 16 && !s.result; i++) {
      const a = chooseMove(s, "normal", i);
      expect(a).not.toBeNull();
      expect(chooseMove(s, "normal", i)).toEqual(a);
      expect(can(s, (a as Move).from, (a as Move).to)).toBe(true);
      s = applyMove(s, a as Move);
    }
  });

  it("Normal beats Easy more often than not", () => {
    let strongWins = 0;
    let easyWins = 0;
    for (let g = 0; g < 4; g++) {
      let s = initialState();
      const strongSide = g % 2 === 0 ? RED : BLUE;
      while (!s.result && s.ply < 160) {
        const level = s.turn === strongSide ? "normal" : "easy";
        const m = chooseMove(s, level, g * 1000 + s.ply);
        if (!m) break;
        s = applyMove(s, m);
      }
      if (s.result?.winner === strongSide) strongWins++;
      else if (s.result && s.result.winner !== 0) easyWins++;
    }
    expect(strongWins).toBeGreaterThan(easyWins);
  });

  it("measures search size at each level from the opening and a middle game", () => {
    let s = initialState();
    for (let i = 0; i < 10; i++) s = applyMove(s, chooseMove(s, "normal", i) as Move);
    for (const pos of [initialState(), s])
      for (const level of DIFFICULTIES) {
        const t0 = performance.now();
        const search = createSearch(pos, level, 1);
        let steps = 0;
        while (!search.step()) steps++;
        const ms = performance.now() - t0;
        // Logged for tuning: the shell slices the search across frames by root move
        console.log(`co-thu ai ${level}: ${search.nodes} nodes, ${steps} slices, ${ms.toFixed(1)} ms`);
        expect(search.move).not.toBeNull();
      }
  });
});
