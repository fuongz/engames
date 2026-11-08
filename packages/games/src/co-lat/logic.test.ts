import { mulberry32 } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import { chooseMove } from "./ai";
import { CELLS, type Difficulty, MAX_TIMEOUTS, RECONNECT_SECONDS, TURN_SECONDS } from "./config";
import {
  type Game,
  type Match,
  type Side,
  countDiscs,
  createMatch,
  flipsFor,
  idx,
  legalMoves,
  matchScore,
  newGame,
  other,
  play,
  replay,
  seatOfSide,
  setAway,
  stepMatch,
  undo,
} from "./logic";
import { bestOfOf, coLatOnline, parsePlace } from "./online";

/** A board from rows of "." (empty), "b" and "w". */
const board = (rows: string[]) => rows.join("").split("").map((c) => (c === "b" ? 1 : c === "w" ? 2 : 0));
const gameOf = (cells: number[], turn: Side): Game => ({ cells, turn, moves: [], movers: [], passed: null, result: null });

describe("the rules", () => {
  it("opens with four discs and Black's four standard moves", () => {
    const g = newGame();
    expect(countDiscs(g.cells)).toEqual([2, 2]);
    expect(g.turn).toBe(1);
    // d3, c4, f5, e6
    expect(legalMoves(g.cells, 1)).toEqual([idx(3, 2), idx(2, 3), idx(5, 4), idx(4, 5)]);
  });

  it("flips the outflanked disc and hands the turn over", () => {
    const g = newGame();
    expect(play(g, idx(3, 2))).toEqual([idx(3, 3)]);
    expect(countDiscs(g.cells)).toEqual([4, 1]);
    expect(g.turn).toBe(2);
  });

  it("refuses moves that outflank nothing, taken squares and garbage", () => {
    const g = newGame();
    expect(play(g, idx(0, 0))).toBeNull();
    expect(play(g, idx(3, 3))).toBeNull();
    expect(play(g, -1)).toBeNull();
    expect(play(g, 64)).toBeNull();
    expect(play(g, 2.5)).toBeNull();
    expect(g.moves).toEqual([]);
    expect(g.turn).toBe(1);
  });

  it("flips every outflanked line in all eight directions at once, and nothing past a gap", () => {
    const cells = board([
      "b..b..b.",
      ".w.w.w..",
      "..www...",
      "bww.wwb.",
      "..www...",
      ".w.w.w..",
      "b..b..b.",
      "........",
    ]);
    const flips = flipsFor(cells, idx(3, 3), 1);
    expect(flips).toHaveLength(16);
    // A line with no black disc at its end does not flip
    const open = board(["........", "........", "........", "..b.ww..", "........", "........", "........", "........"]);
    expect(flipsFor(open, idx(6, 3), 1)).toEqual([]);
    expect(flipsFor(open, idx(6, 3), 2)).toEqual([]);
  });

  it("passes a player with no legal move", () => {
    // Black plays h1; White then has nothing, Black still has a move
    const cells = board([
      "bbbbbbw.",
      "bbbbbbbb",
      "bbbbbbbb",
      "bbbbbbbb",
      "bbbbbbbb",
      "bbbbbbbb",
      "bbbbbbbb",
      "bbbbbw..",
    ]);
    const g = gameOf(cells, 1);
    expect(play(g, idx(7, 0))).toEqual([idx(6, 0)]);
    expect(g.result).toBeNull();
    expect(g.passed).toBe(2);
    expect(g.turn).toBe(1);
  });

  it("ends when neither side can move, most discs winning (or a draw)", () => {
    const g = gameOf(board(["bbbbbbw.", "wwwwwwww", "wwwwwwww", "wwwwwwww", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb"]), 1);
    play(g, idx(7, 0));
    expect(g.result).toBe(1);
    expect(countDiscs(g.cells)).toEqual([46, 18]);
    // 32 – 32
    const d = gameOf(board(["bbbbbbw.", "wwwwwwbb", "wwwwwwww", "wwwwwwww", "wwwwwwww", "wwbbbbbb", "bbbbbbbb", "bbbbbbbb"]), 1);
    play(d, idx(7, 0));
    expect(countDiscs(d.cells)).toEqual([32, 32]);
    expect(d.result).toBe(0);
  });

  it("takes moves back by replaying", () => {
    const g = newGame();
    play(g, idx(3, 2));
    play(g, idx(2, 2));
    const back = undo(g);
    expect(back.moves).toEqual([idx(3, 2)]);
    expect(back.turn).toBe(2);
    expect(back.cells).toEqual(replay([idx(3, 2)]).cells);
    expect(undo(back, 5).cells).toEqual(newGame().cells);
  });
});

// ---------------------------------------------------------------- the computer

/** Perfect play by brute force: the best final disc difference for the side to move. */
function exact(cells: number[], side: Side, passed = false): number {
  const moves = legalMoves(cells, side);
  if (moves.length === 0) {
    if (passed) {
      const [b, w] = countDiscs(cells);
      return side === 1 ? b - w : w - b;
    }
    return -exact(cells, other(side), true);
  }
  let best = -Infinity;
  for (const at of moves) {
    const next = cells.slice();
    next[at] = side;
    for (const f of flipsFor(cells, at, side)) next[f] = side;
    best = Math.max(best, -exact(next, other(side)));
  }
  return best;
}

/** A position from a seeded game of random moves, `empties` squares left. */
function randomPosition(seed: number, empties: number): Game {
  const rand = mulberry32(seed);
  let g = newGame();
  while (g.cells.filter((c) => c === 0).length > empties) {
    if (g.result !== null) g = newGame();
    const moves = legalMoves(g.cells, g.turn);
    play(g, moves[Math.floor(rand() * moves.length)]);
  }
  return g;
}

describe("the computer", () => {
  const levels: Difficulty[] = ["easy", "normal", "hard"];

  it("always plays a legal move, and -1 when it must pass", () => {
    for (const level of levels) {
      for (let s = 0; s < 6; s++) {
        const g = randomPosition(s, 40 - s * 5);
        if (g.result !== null) continue;
        expect(legalMoves(g.cells, g.turn)).toContain(chooseMove(g.cells, g.turn, level, mulberry32(s)));
      }
    }
    const stuck = board(["bbbbbbw.", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb", "bbbbbbbb"]);
    expect(chooseMove(stuck, 2, "hard", mulberry32(1))).toBe(-1);
  });

  it("grabs a free corner (Normal and Hard)", () => {
    const cells = board([
      "........",
      ".w......",
      "..b.....",
      "...bw...",
      "...wb...",
      "........",
      "........",
      "........",
    ]);
    // Black takes a1 over b2
    for (const level of ["normal", "hard"] as Difficulty[]) expect(chooseMove(cells, 1, level, mulberry32(2))).toBe(idx(0, 0));
  });

  it("solves the endgame perfectly on Hard", () => {
    for (let s = 0; s < 5; s++) {
      const g = randomPosition(100 + s, 8);
      if (g.result !== null) continue;
      const best = exact(g.cells, g.turn);
      const at = chooseMove(g.cells, g.turn, "hard", mulberry32(s));
      const next = g.cells.slice();
      next[at] = g.turn;
      for (const f of flipsFor(g.cells, at, g.turn)) next[f] = g.turn;
      expect(-exact(next, other(g.turn))).toBe(best);
    }
  });

  /** A game from a short random opening (so games differ); returns the winner. */
  function duel(black: Difficulty, white: Difficulty, seed: number): Side | 0 {
    const rand = mulberry32(seed);
    const g = newGame();
    for (let i = 0; i < 4; i++) {
      const moves = legalMoves(g.cells, g.turn);
      play(g, moves[Math.floor(rand() * moves.length)]);
    }
    while (g.result === null) play(g, chooseMove(g.cells, g.turn, g.turn === 1 ? black : white, rand));
    return g.result;
  }

  it("ranks the levels: Hard beats Easy and Normal, Normal beats Easy", { timeout: 180_000 }, () => {
    let hard = 0;
    let normal = 0;
    // Each plays both colours
    if (duel("hard", "easy", 1) === 1) hard++;
    if (duel("easy", "hard", 2) === 2) hard++;
    if (duel("hard", "normal", 3) === 1) hard++;
    if (duel("normal", "hard", 4) === 2) hard++;
    for (let i = 0; i < 3; i++) {
      if (duel("normal", "easy", i + 10) === 1) normal++;
      if (duel("easy", "normal", i + 20) === 2) normal++;
    }
    expect(hard).toBe(4);
    expect(normal).toBeGreaterThanOrEqual(5);
  });

  it("thinks fast enough for a phone on Hard, mid-game and at the endgame solve", () => {
    for (const empties of [44, 30, 14]) {
      const g = randomPosition(7 + empties, empties);
      chooseMove(g.cells, g.turn, "hard", mulberry32(1));
      const t = performance.now();
      chooseMove(g.cells, g.turn, "hard", mulberry32(1));
      expect(performance.now() - t).toBeLessThan(400);
    }
  });
});

// ---------------------------------------------------------------- online

const tick = 1 / coLatOnline.tickRate;

/** Plays out the current game: `winner`'s seat plays Normal, the other the worst move it can find. */
function playGame(m: Match, winner: 0 | 1, rand: () => number) {
  const n = m.n;
  for (let i = 0; m.game.result === null && m.n === n && m.phase === "play"; i++) {
    const mover = seatOfSide(m, m.game.turn);
    const moves = legalMoves(m.game.cells, m.game.turn);
    const at =
      mover === winner
        ? chooseMove(m.game.cells, m.game.turn, "normal", rand)
        : moves.reduce((a, b) => (flipsFor(m.game.cells, b, m.game.turn).length < flipsFor(m.game.cells, a, m.game.turn).length ? b : a));
    const inputs: (number | null)[] = [null, null];
    inputs[mover] = at;
    stepMatch(m, tick, inputs);
    expect(i).toBeLessThan(64);
  }
}

describe("an online match", () => {
  it("plays only the mover's input, swaps colours, first to two games", () => {
    const m = createMatch(1, ["An", "Bình"]);
    expect(m.seats.map((s) => s.side)).toEqual([1, 2]);
    // Seat 1 (White) can't move on Black's turn
    stepMatch(m, tick, [null, idx(3, 2)]);
    expect(m.game.moves).toEqual([]);
    const rand = mulberry32(3);
    playGame(m, 0, rand);
    expect(m.seats[0].wins).toBe(1);
    expect(m.seats[0].margin).toBeGreaterThan(0);
    expect(m.phase).toBe("between");
    while (m.phase === "between") stepMatch(m, tick, [null, null]);
    expect(m.n).toBe(2);
    // Colours swap: seat 1 has Black and moves first
    expect(m.seats.map((s) => s.side)).toEqual([2, 1]);
    expect(seatOfSide(m, m.game.turn)).toBe(1);
    playGame(m, 0, rand);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
    expect(matchScore(m, 0)).toBeGreaterThan(1000);
    expect(matchScore(m, 1)).toBe(0);
  });

  it("plays for a player whose clock runs out, and forfeits after too many", () => {
    const m = createMatch(2, ["An", "Bình"]);
    let steps = 0;
    while (m.phase !== "over" && steps < (TURN_SECONDS + 1) * coLatOnline.tickRate * MAX_TIMEOUTS * 2) {
      // White answers instantly; Black never moves
      const inputs: (number | null)[] = [null, null];
      if (m.game.turn === 2) inputs[1] = legalMoves(m.game.cells, 2)[0] ?? null;
      stepMatch(m, tick, inputs);
      steps++;
    }
    expect(m.phase).toBe("over");
    expect(m.forfeit).toBe(true);
    expect(m.winner).toBe(1);
  });

  it("forfeits a player who stays away", () => {
    const m = createMatch(3, ["An", "Bình"]);
    setAway(m, 1, true);
    for (let t = 0; t < (RECONNECT_SECONDS - 1) * coLatOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).not.toBe("over");
    setAway(m, 1, false);
    setAway(m, 1, true);
    for (let t = 0; t < (RECONNECT_SECONDS + 1) * coLatOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
  });

  it("ends after 1, 2 or 3 wins for Bo1, Bo3 and Bo5", () => {
    for (const [bestOf, wins] of [
      [1, 1],
      [3, 2],
      [5, 3],
    ] as const) {
      const m = createMatch(1, ["An", "Bình"], bestOf);
      const rand = mulberry32(bestOf);
      let games = 0;
      while (m.phase !== "over" && games < 10) {
        playGame(m, 0, rand);
        games++;
        while (m.phase === "between") stepMatch(m, tick, [null, null]);
      }
      expect(games).toBe(wins);
      expect(m.winner).toBe(0);
    }
  });

  it("reads the host's setting, defaulting to Bo3", () => {
    expect(bestOfOf({ bestOf: "5" })).toBe(5);
    expect(bestOfOf({ bestOf: "1" })).toBe(1);
    expect(bestOfOf({ bestOf: "7" })).toBe(3);
    expect(bestOfOf({})).toBe(3);
    const sim = coLatOnline.create(1, [{ name: "An" }, { name: "Bình" }], { bestOf: "5" });
    expect((sim.snapshot() as { bestOf: number }).bestOf).toBe(5);
  });
});

describe("online adapter", () => {
  it("accepts only a place action on a real square", () => {
    expect(parsePlace([{ type: "place", at: 19 }])).toBe(19);
    expect(parsePlace([{ type: "place", at: CELLS }])).toBeNull();
    expect(parsePlace([{ type: "place", at: -1 }])).toBeNull();
    expect(parsePlace([{ type: "place", at: "4" }])).toBeNull();
    expect(parsePlace([{ type: "place", at: 1.5 }])).toBeNull();
    expect(parsePlace([null, 7, "x", { type: "nuke" }, { type: "place", at: 0 }])).toBe(0);
    expect(coLatOnline.parseInput({ move: { x: 0, y: 0 }, actions: [] })).toBeNull();
  });

  it("runs a whole match with no input to an end with a result per seat", () => {
    const sim = coLatOnline.create(5, [{ name: "An" }, { name: "Bình" }], {});
    const seen = new Set<string>();
    let ticks = 0;
    while (!sim.over && ticks < 20000) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    expect(seen.has("place")).toBe(true);
    expect(seen.has("over")).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    expect(results.map((r) => r.outcome).sort()).toEqual(["loss", "win"]);
    for (const r of results) expect(r.detail.length).toBeLessThanOrEqual(40);
    const snap = sim.snapshot();
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    expect(snap).toMatchObject({ phase: "over" });
  });

  it("plays a real match through the adapter to a single result", () => {
    const sim = coLatOnline.create(9, [{ name: "An" }, { name: "Bình" }], { bestOf: "1" });
    const rand = mulberry32(9);
    let ticks = 0;
    const types: string[] = [];
    while (!sim.over && ticks < 2000) {
      const m = sim.snapshot() as Match;
      const inputs: (number | null)[] = [null, null];
      if (m.phase === "play") inputs[seatOfSide(m, m.game.turn)] = chooseMove(m.game.cells, m.game.turn, "easy", rand);
      sim.step(inputs);
      for (const e of sim.drainEvents() as { type: string }[]) types.push(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    expect(types.filter((t) => t === "result").length).toBeGreaterThanOrEqual(1);
    expect(types.at(-1)).toBe("over");
    expect(sim.results().every((r) => r.detail.length <= 40)).toBe(true);
  });
});
