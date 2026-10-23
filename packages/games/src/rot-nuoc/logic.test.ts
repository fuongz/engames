import { describe, expect, it } from "vitest";
import { CAPACITY, EMPTY_TUBES, colorsFor } from "./config";
import {
  addTube,
  canPour,
  createBoard,
  generateLevel,
  isSolved,
  pour,
  restart,
  solvable,
  solved,
  topRun,
  undo,
} from "./logic";

describe("rules", () => {
  it("pours the whole top run when it fits, onto empty or matching tops only", () => {
    const b = createBoard(1);
    b.tubes = [[0, 1, 1], [1], [], [0]];
    b.capacity = 4;
    expect(canPour(b.tubes, 4, 0, 3)).toBe(false); // 1 onto 0
    const m = pour(b, 0, 1);
    expect(m).toEqual({ from: 0, to: 1, color: 1, count: 2 });
    expect(b.tubes[1]).toEqual([1, 1, 1]);
    expect(b.tubes[0]).toEqual([0]);
  });

  it("only pours as much as the target can hold", () => {
    const b = createBoard(1);
    b.capacity = 4;
    b.tubes = [
      [2, 2, 2],
      [0, 0, 2],
    ];
    const m = pour(b, 0, 1);
    expect(m?.count).toBe(1);
    expect(b.tubes[0]).toEqual([2, 2]);
  });

  it("undo restores exactly; restart keeps an extra tube that was used", () => {
    const b = createBoard(5);
    const before = JSON.stringify(b.tubes);
    const from = b.tubes.findIndex((t) => t.length > 0);
    const to = b.tubes.findIndex((t) => t.length === 0);
    expect(pour(b, from, to)).not.toBeNull();
    undo(b);
    expect(JSON.stringify(b.tubes)).toBe(before);
    expect(addTube(b)).toBe(true);
    expect(addTube(b)).toBe(false);
    pour(b, from, to);
    restart(b);
    expect(b.tubes.length).toBe(colorsFor(5) + EMPTY_TUBES + 1);
    expect(b.moves).toBe(0);
  });

  it("knows a solved board", () => {
    expect(isSolved([[1, 1, 1, 1], [], [2, 2, 2, 2]], 4)).toBe(true);
    expect(isSolved([[1, 1, 1], [1]], 4)).toBe(false);
    expect(topRun([3, 1, 1])).toEqual({ color: 1, count: 2 });
  });
});

describe("levels", () => {
  it("are deterministic, use every colour exactly CAPACITY times, and are all solvable", () => {
    for (const level of [1, 2, 7, 20, 25, 40, 58, 80]) {
      const a = generateLevel(level);
      expect(JSON.stringify(generateLevel(level))).toBe(JSON.stringify(a));
      const colors = colorsFor(level);
      expect(a.length).toBe(colors + EMPTY_TUBES);
      const counts = new Map<number, number>();
      for (const t of a)
        for (const c of t) counts.set(c, (counts.get(c) ?? 0) + 1);
      expect(counts.size).toBe(colors);
      for (const n of counts.values()) expect(n).toBe(CAPACITY);
      expect(solvable(a, CAPACITY, 200000), `level ${level}`).toBe(true);
    }
  });

  it("start unsolved and get harder", () => {
    expect(solved(createBoard(1))).toBe(false);
    expect(colorsFor(1)).toBe(3);
    expect(colorsFor(25)).toBe(9); // the ad's level-58 board has 9
    expect(colorsFor(200)).toBe(12);
  });
});
