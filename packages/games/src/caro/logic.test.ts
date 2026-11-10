import { mulberry32 } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import { chooseMove } from "./ai";
import { type Difficulty, MAX_TIMEOUTS, RECONNECT_SECONDS, SIZE, TURN_SECONDS } from "./config";
import { type Side, createMatch, findWin, idx, matchScore, newGame, play, setAway, stepMatch, undo } from "./logic";
import { bestOfOf, caroOnline, parsePlace } from "./online";

const board = (marks: [number, number, Side][]) => {
  const cells = new Array(SIZE * SIZE).fill(0);
  for (const [x, y, s] of marks) cells[idx(x, y)] = s;
  return cells;
};
const row = (x0: number, y: number, n: number, s: Side, dx = 1, dy = 0): [number, number, Side][] =>
  Array.from({ length: n }, (_, i) => [x0 + i * dx, y + i * dy, s]);

describe("five in a row", () => {
  it("wins across, down and on both diagonals", () => {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ]) {
      const cells = board(row(5, 8, 5, 1, dx, dy));
      expect(findWin(cells, idx(5 + 2 * dx, 8 + 2 * dy))).toHaveLength(5);
    }
  });

  it("does not count four", () => {
    expect(findWin(board(row(3, 3, 4, 1)), idx(3, 3))).toBeNull();
  });

  it("does not count a five blocked at both ends", () => {
    const cells = board([...row(4, 2, 5, 2), [3, 2, 1], [9, 2, 1]]);
    expect(findWin(cells, idx(6, 2))).toBeNull();
  });

  it("counts a five blocked at one end, or against the board edge", () => {
    expect(findWin(board([...row(4, 2, 5, 2), [3, 2, 1]]), idx(8, 2))).not.toBeNull();
    expect(findWin(board([...row(0, 2, 5, 2), [5, 2, 1]]), idx(0, 2))).not.toBeNull();
  });

  it("counts six or more", () => {
    expect(findWin(board(row(2, 2, 6, 1)), idx(4, 2))).toHaveLength(6);
  });
});

describe("a game", () => {
  it("alternates turns, refuses taken squares, and can take moves back", () => {
    const g = newGame();
    expect(play(g, idx(9, 9))).toBe(true);
    expect(g.turn).toBe(2);
    expect(play(g, idx(9, 9))).toBe(false);
    expect(play(g, -1)).toBe(false);
    expect(play(g, 1.5)).toBe(false);
    play(g, idx(9, 10));
    expect(undo(g)).toBe(true);
    expect(g.turn).toBe(2);
    expect(g.cells[idx(9, 10)]).toBe(0);
  });

  it("ends on a five and accepts no more moves", () => {
    const g = newGame();
    for (let i = 0; i < 4; i++) {
      play(g, idx(i, 0));
      play(g, idx(i, 5));
    }
    play(g, idx(4, 0));
    expect(g.result).toBe(1);
    expect(g.line).toHaveLength(5);
    expect(play(g, idx(10, 10))).toBe(false);
  });
});

describe("the computer", () => {
  const levels: Difficulty[] = ["easy", "normal", "hard"];

  it("opens in the centre", () => {
    for (const level of levels) expect(chooseMove(board([]), 1, level, mulberry32(1))).toBe(idx(9, 9));
  });

  it("finishes its own four and blocks an open four (Normal and Hard)", () => {
    const win = board([...row(5, 5, 4, 2), ...row(5, 9, 3, 1)]);
    for (const level of ["normal", "hard"] as Difficulty[]) {
      expect([idx(4, 5), idx(9, 5)]).toContain(chooseMove(win, 2, level, mulberry32(2)));
    }
    const block = board([...row(5, 5, 4, 1), [12, 12, 2]]);
    for (const level of ["normal", "hard"] as Difficulty[]) {
      expect([idx(4, 5), idx(9, 5)]).toContain(chooseMove(block, 2, level, mulberry32(3)));
    }
  });

  it("blocks an open three on Hard", () => {
    const cells = board([...row(7, 7, 3, 1), [12, 3, 2]]);
    expect([idx(6, 7), idx(10, 7), idx(5, 7), idx(11, 7)]).toContain(chooseMove(cells, 2, "hard", mulberry32(4)));
  });

  function duel(a: Difficulty, b: Difficulty, seed: number): Side | 0 {
    const rand = mulberry32(seed);
    const g = newGame();
    // A random opening so games differ
    play(g, idx(9, 9));
    play(g, idx(9 + Math.floor(rand() * 3) - 1, 8 + Math.floor(rand() * 2) * 2));
    while (g.result === null) play(g, chooseMove(g.cells, g.turn, g.turn === 1 ? a : b, rand));
    return g.result;
  }

  it("ranks the levels: Hard beats Normal, Normal beats Easy", () => {
    let hard = 0;
    let normal = 0;
    for (let i = 0; i < 6; i++) {
      // Each plays both colours
      if (duel("hard", "normal", i) === 1) hard++;
      if (duel("normal", "hard", i + 50) === 2) hard++;
      if (duel("normal", "easy", i + 100) === 1) normal++;
      if (duel("easy", "normal", i + 150) === 2) normal++;
    }
    expect(hard).toBeGreaterThanOrEqual(8);
    expect(normal).toBeGreaterThanOrEqual(9);
  }, 30_000); // a full AI-vs-AI tournament: slow under the parallel test run

  it("thinks fast enough for a phone on Hard", () => {
    const g = newGame();
    const rand = mulberry32(9);
    for (let i = 0; i < 24; i++) play(g, chooseMove(g.cells, g.turn, "normal", rand));
    const t = performance.now();
    chooseMove(g.cells, g.turn, "hard", rand);
    expect(performance.now() - t).toBeLessThan(400);
  });
});

describe("an online match", () => {
  const tick = 1 / caroOnline.tickRate;

  it("plays only the mover's input, first to two games", () => {
    const m = createMatch(1, ["An", "Bình"]);
    // Seat 1 (O) can't move on X's turn
    stepMatch(m, tick, [null, idx(0, 0)]);
    expect(m.game.cells[idx(0, 0)]).toBe(0);
    const winGame = (winner: 0 | 1) => {
      const loser = 1 - winner;
      const made = [0, 0];
      // The loser spreads its marks out so only the winner can make five
      for (let i = 0; m.game.result === null; i++) {
        const mover = m.game.turn === 1 ? 0 : 1;
        const k = made[mover]++;
        const at = mover === winner ? idx(k, 2) : idx(k * 2, 10);
        const inputs: (number | null)[] = [null, null];
        inputs[mover] = at;
        stepMatch(m, tick, inputs);
        expect(i).toBeLessThan(20);
      }
      expect(m.seats[winner].wins).toBeGreaterThan(0);
      expect(m.seats[loser].wins).toBeLessThan(2);
    };
    winGame(0);
    expect(m.phase).toBe("between");
    for (let t = 0; t < 40 && m.phase === "between"; t++) stepMatch(m, tick, [null, null]);
    expect(m.n).toBe(2);
    // O goes first in game 2
    expect(m.game.turn).toBe(2);
    winGame(0);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
    expect(matchScore(m, 0)).toBeGreaterThan(1000);
    expect(matchScore(m, 1)).toBe(0);
  });

  it("plays for a player whose clock runs out, and forfeits after too many", () => {
    const m = createMatch(2, ["An", "Bình"]);
    let steps = 0;
    while (m.phase !== "over" && steps < (TURN_SECONDS + 1) * caroOnline.tickRate * MAX_TIMEOUTS * 2) {
      // O answers instantly; X never moves
      const inputs: (number | null)[] = [null, null];
      if (m.game.turn === 2) inputs[1] = m.game.cells.indexOf(0, idx(0, 15));
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
    for (let t = 0; t < (RECONNECT_SECONDS - 1) * caroOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).not.toBe("over");
    setAway(m, 1, false);
    setAway(m, 1, true);
    for (let t = 0; t < (RECONNECT_SECONDS + 1) * caroOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
  });
});

describe("match length", () => {
  const tick = 1 / caroOnline.tickRate;
  /** Seat 0 wins games until the match ends; returns how many it took. */
  function sweep(bestOf: 1 | 3 | 5) {
    const m = createMatch(1, ["An", "Bình"], bestOf);
    let games = 0;
    while (m.phase !== "over" && games < 10) {
      const made = [0, 0];
      while (m.game.result === null) {
        const mover = m.game.turn === 1 ? 0 : 1;
        const k = made[mover]++;
        const inputs: (number | null)[] = [null, null];
        inputs[mover] = mover === 0 ? idx(k, 2) : idx(k * 2, 10);
        stepMatch(m, tick, inputs);
      }
      games++;
      while (m.phase === "between") stepMatch(m, tick, [null, null]);
    }
    return { games, m };
  }

  it("ends after 1, 2 or 3 wins for Bo1, Bo3 and Bo5", () => {
    for (const [bestOf, wins] of [
      [1, 1],
      [3, 2],
      [5, 3],
    ] as const) {
      const { games, m } = sweep(bestOf);
      expect(games).toBe(wins);
      expect(m.winner).toBe(0);
    }
  });

  it("reads the host's setting, defaulting to Bo3", () => {
    expect(bestOfOf({ bestOf: "5" })).toBe(5);
    expect(bestOfOf({ bestOf: "1" })).toBe(1);
    expect(bestOfOf({})).toBe(3);
    const sim = caroOnline.create(1, [{ name: "An" }, { name: "Bình" }], { bestOf: "5" });
    expect((sim.snapshot() as { bestOf: number }).bestOf).toBe(5);
  });
});

describe("online adapter", () => {
  it("accepts only a place action on a real square", () => {
    expect(parsePlace([{ type: "place", at: 40 }])).toBe(40);
    expect(parsePlace([{ type: "place", at: 400 }])).toBeNull();
    expect(parsePlace([{ type: "place", at: "4" }])).toBeNull();
    expect(parsePlace([{ type: "nuke" }, { type: "place", at: 0 }])).toBe(0);
    expect(caroOnline.parseInput({ move: { x: 0, y: 0 }, actions: [] })).toBeNull();
  });

  it("runs a whole match to an end with a result per seat", () => {
    const sim = caroOnline.create(5, [{ name: "An" }, { name: "Bình" }], {});
    const seen = new Set<string>();
    let ticks = 0;
    while (!sim.over && ticks < 20000) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    expect(seen.has("over")).toBe(true);
    expect(sim.results().map((r) => r.seat)).toEqual([0, 1]);
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({
      phase: "over",
    });
  });
});
