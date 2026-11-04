import { describe, expect, it } from "vitest";
import {
  COLS,
  COMBO_POINTS,
  FREEZE_TIME,
  PAIR_POINTS,
  ROWS,
  TIME_BONUS,
  gravityFor,
  kindsFor,
  timeFor,
} from "./config";
import {
  EMPTY,
  type Run,
  applyGravity,
  at,
  boardFrom,
  canMatch,
  createBoard,
  createRun,
  deadlocked,
  findPair,
  findPath,
  match,
  nextLevel,
  parseRun,
  shuffle,
  tick,
  tiles,
  useFreeze,
  useHint,
  useShuffle,
} from "./logic";

const _ = "." as const;
/** Kinds of the board's tiles row by row, "." for empty (the ring left out). */
const rowsOf = (b: ReturnType<typeof boardFrom>) =>
  Array.from({ length: b.rows }, (_r, y) =>
    Array.from({ length: b.cols }, (_c, x) => {
      const k = at(b, { x: x + 1, y: y + 1 });
      return k === EMPTY ? "." : k;
    }),
  );
const multiset = (b: ReturnType<typeof boardFrom>) =>
  tiles(b)
    .map((c) => at(b, c))
    .sort((p, q) => (p as number) - (q as number));
const turns = (path: { x: number; y: number }[] | null) => (path ? path.length - 2 : -1);

describe("paths", () => {
  it("joins neighbours and a clear straight line with no bend", () => {
    const b = boardFrom([
      [1, 1, 2],
      [3, _, 3],
    ]);
    expect(turns(findPath(b, { x: 1, y: 1 }, { x: 2, y: 1 }))).toBe(0);
    expect(turns(findPath(b, { x: 1, y: 2 }, { x: 3, y: 2 }))).toBe(0);
  });

  it("takes one bend through an empty corner", () => {
    const b = boardFrom([
      [1, _, _],
      [2, 2, 1],
    ]);
    const path = canMatch(b, { x: 1, y: 1 }, { x: 3, y: 2 });
    expect(turns(path)).toBe(1);
    expect(path?.[1]).toEqual({ x: 3, y: 1 });
  });

  it("takes two bends around a wall", () => {
    const b = boardFrom([
      [1, 2, 1],
      [_, 2, _],
      [_, _, _],
    ]);
    const path = canMatch(b, { x: 1, y: 1 }, { x: 3, y: 1 });
    // Through the ring above (row 0) is shorter than round the bottom
    expect(turns(path)).toBe(2);
    expect(path?.[1]).toEqual({ x: 1, y: 0 });
  });

  it("runs through the outer ring", () => {
    const b = boardFrom([
      [1, 2, 3, 1],
      [4, 4, 5, 5],
    ]);
    const path = canMatch(b, { x: 1, y: 1 }, { x: 4, y: 1 });
    expect(path).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
    ]);
    // Two tiles on opposite edges of a full board: round the side ring
    const side = boardFrom([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 1],
    ]);
    expect(turns(canMatch(side, { x: 1, y: 1 }, { x: 3, y: 3 }))).toBe(-1);
    const corners = boardFrom([
      [1, 2, 3],
      [4, 5, 6],
      [3, 8, 9],
    ]);
    expect(turns(canMatch(corners, { x: 3, y: 1 }, { x: 1, y: 3 }))).toBe(-1);
    const edge = boardFrom([
      [1, 2, 3],
      [4, 5, 6],
      [1, 8, 9],
    ]);
    // Both on the left edge: out into the ring, down, back in
    expect(turns(canMatch(edge, { x: 1, y: 1 }, { x: 1, y: 3 }))).toBe(2);
  });

  it("refuses three bends, different kinds and the same tile", () => {
    // The 1s are only joinable by a 3-bend snake: right, down, right, down
    const b = boardFrom([
      [9, 9, 9, 9, 9, 9],
      [9, 1, _, 9, 9, 9],
      [9, 9, _, _, _, 9],
      [9, 9, 9, 9, 1, 9],
    ]);
    expect(canMatch(b, { x: 2, y: 2 }, { x: 5, y: 4 })).toBeNull();
    const c = boardFrom([[1, 2]]);
    expect(canMatch(c, { x: 1, y: 1 }, { x: 2, y: 1 })).toBeNull();
    expect(canMatch(c, { x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });

  it("prefers fewer bends over a shorter route", () => {
    const b = boardFrom([
      [1, _, _, _, _, 1],
      [_, _, _, _, _, _],
    ]);
    expect(turns(findPath(b, { x: 1, y: 1 }, { x: 6, y: 1 }))).toBe(0);
  });
});

describe("gravity", () => {
  const start = () =>
    boardFrom([
      [1, _, 2, 3],
      [_, 4, _, _],
      [5, _, _, 6],
      [_, 7, 8, _],
    ]);

  it("none leaves the board alone", () => {
    const b = start();
    expect(applyGravity(b, "none")).toEqual([]);
    expect(rowsOf(b)).toEqual(rowsOf(start()));
  });

  it("down and up pack each column, keeping order", () => {
    const d = start();
    const slides = applyGravity(d, "down");
    expect(rowsOf(d)).toEqual([
      [_, _, _, _],
      [_, _, _, _],
      [1, 4, 2, 3],
      [5, 7, 8, 6],
    ]);
    expect(slides).toContainEqual({ from: { x: 1, y: 1 }, to: { x: 1, y: 3 } });
    const u = start();
    applyGravity(u, "up");
    expect(rowsOf(u)).toEqual([
      [1, 4, 2, 3],
      [5, 7, 8, 6],
      [_, _, _, _],
      [_, _, _, _],
    ]);
  });

  it("left and right pack each row", () => {
    const l = start();
    applyGravity(l, "left");
    expect(rowsOf(l)).toEqual([
      [1, 2, 3, _],
      [4, _, _, _],
      [5, 6, _, _],
      [7, 8, _, _],
    ]);
    const r = start();
    applyGravity(r, "right");
    expect(rowsOf(r)).toEqual([
      [_, 1, 2, 3],
      [_, _, _, 4],
      [_, _, 5, 6],
      [_, _, 7, 8],
    ]);
  });

  it("top/bottom split moves the halves outward or toward the centre", () => {
    const out = start();
    applyGravity(out, "split-v-out");
    expect(rowsOf(out)).toEqual([
      [1, 4, 2, 3],
      [_, _, _, _],
      [_, _, _, _],
      [5, 7, 8, 6],
    ]);
    const inn = start();
    applyGravity(inn, "split-v-in");
    expect(rowsOf(inn)).toEqual([
      [_, _, _, _],
      [1, 4, 2, 3],
      [5, 7, 8, 6],
      [_, _, _, _],
    ]);
  });

  it("left/right split moves the halves outward or toward the centre", () => {
    const out = start();
    applyGravity(out, "split-h-out");
    expect(rowsOf(out)).toEqual([
      [1, _, 2, 3],
      [4, _, _, _],
      [5, _, _, 6],
      [7, _, _, 8],
    ]);
    const inn = start();
    applyGravity(inn, "split-h-in");
    expect(rowsOf(inn)).toEqual([
      [_, 1, 2, 3],
      [_, 4, _, _],
      [_, 5, 6, _],
      [_, 7, 8, _],
    ]);
  });

  it("cycles the classic seven modes, splits alternating out and in", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(gravityFor)).toEqual([
      "none",
      "down",
      "up",
      "left",
      "right",
      "split-v-out",
      "split-h-out",
    ]);
    expect([8, 13, 14, 20, 21].map(gravityFor)).toEqual([
      "none",
      "split-v-in",
      "split-h-in",
      "split-v-out",
      "split-h-out",
    ]);
  });

  it("never changes the tiles, only where they are", () => {
    for (const mode of ["down", "up", "left", "right", "split-v-out", "split-v-in", "split-h-out", "split-h-in"] as const) {
      const b = start();
      applyGravity(b, mode);
      expect(multiset(b)).toEqual(multiset(start()));
    }
  });
});

describe("deadlock and shuffle", () => {
  it("spots a board with no open pair", () => {
    const b = boardFrom([
      [1, 2, 3],
      [4, 9, 5],
      [3, 6, 1],
    ]);
    // 1s and 3s sit in opposite corners, walled in by other kinds
    expect(findPair(b)).toBeNull();
    expect(deadlocked(b)).toBe(true);
    expect(deadlocked(boardFrom([[_, _]]))).toBe(false);
  });

  it("shuffle keeps the multiset of tiles and the empty cells, and opens a pair", () => {
    const b = boardFrom([
      [1, 2, 3],
      [4, _, 4],
      [3, 2, 1],
    ]);
    const before = multiset(b);
    shuffle(b, { seed: 7 });
    expect(multiset(b)).toEqual(before);
    expect(at(b, { x: 2, y: 2 })).toBe(EMPTY);
    expect(findPair(b)).not.toBeNull();
  });

  it("a match that leaves a deadlock shuffles for free", () => {
    const run = createRun(1);
    // Level 1 has no gravity; the 7s are the only open pair, and without them
    // the 1s and 3s are walled into opposite corners
    run.board = boardFrom([
      [1, 2, 3],
      [4, 9, 5],
      [3, 6, 1],
      [7, 8, 7],
    ]);
    const before = multiset(run.board).filter((k) => k !== 7);
    const r = match(run, { x: 1, y: 4 }, { x: 3, y: 4 });
    expect(r?.shuffled).toBe(true);
    expect(multiset(run.board)).toEqual(before);
    expect(findPair(run.board)).not.toBeNull();
  });
});

describe("levels", () => {
  it("generation is deterministic per level and seed", () => {
    expect(createBoard(3, 42).cells).toEqual(createBoard(3, 42).cells);
    expect(createBoard(3, 42).cells).not.toEqual(createBoard(3, 43).cells);
    expect(createBoard(4, 42).cells).not.toEqual(createBoard(3, 42).cells);
  });

  it("fills the 8 × 12 board with an even count of each kind and an open pair", () => {
    for (const level of [1, 2, 5, 7, 12, 30]) {
      const b = createBoard(level, 1234 + level);
      expect(tiles(b)).toHaveLength(COLS * ROWS);
      const counts = new Map<number, number>();
      for (const c of tiles(b)) counts.set(at(b, c) as number, (counts.get(at(b, c) as number) ?? 0) + 1);
      expect(counts.size).toBe(kindsFor(level));
      for (const n of counts.values()) expect(n % 2).toBe(0);
      expect(findPair(b)).not.toBeNull();
    }
    expect(kindsFor(1)).toBe(12);
    expect(kindsFor(7)).toBe(36);
    expect(kindsFor(50)).toBe(36);
  });

  it("every level can be cleared by taking any open pair (shuffles help when stuck)", () => {
    for (const level of [1, 2, 3, 4, 5, 6, 7, 13, 14]) {
      const run = createRun(99, level);
      for (let guard = 0; run.phase === "play" && guard < 200; guard++) {
        const p = findPair(run.board);
        expect(p).not.toBeNull();
        if (p) match(run, p.a, p.b);
      }
      expect(run.phase).toBe("won");
    }
  });
});

describe("score, timer, win and lose", () => {
  const fresh = (): Run => {
    const run = createRun(5);
    run.board = boardFrom([
      [1, 1, 2, 2],
      [3, 3, _, _],
    ]);
    return run;
  };

  it("pays more for quick successive matches", () => {
    const run = fresh();
    expect(match(run, { x: 1, y: 1 }, { x: 2, y: 1 })?.points).toBe(PAIR_POINTS);
    tick(run, 1);
    expect(match(run, { x: 3, y: 1 }, { x: 4, y: 1 })?.points).toBe(PAIR_POINTS + COMBO_POINTS);
    expect(run.combo).toBe(1);
  });

  it("a slow match resets the combo", () => {
    const run = fresh();
    match(run, { x: 1, y: 1 }, { x: 2, y: 1 });
    tick(run, 5);
    expect(match(run, { x: 3, y: 1 }, { x: 4, y: 1 })?.combo).toBe(0);
  });

  it("clearing the board wins with a time bonus and a booster", () => {
    const run = fresh();
    const hints = run.hints;
    match(run, { x: 1, y: 1 }, { x: 2, y: 1 });
    match(run, { x: 3, y: 1 }, { x: 4, y: 1 });
    const before = run.score;
    const time = run.time;
    const last = match(run, { x: 1, y: 2 }, { x: 2, y: 2 });
    expect(last?.cleared).toBe(true);
    expect(run.phase).toBe("won");
    expect(run.bonus).toBe(Math.ceil(time) * TIME_BONUS);
    expect(run.score).toBe(before + (last?.points ?? 0) + run.bonus);
    expect(run.hints).toBe(hints + 1);
    // Nothing moves on the win screen; the next level resets the clock
    expect(match(run, { x: 1, y: 1 }, { x: 2, y: 1 })).toBeNull();
    nextLevel(run);
    expect(run.level).toBe(2);
    expect(run.time).toBe(timeFor(2));
    expect(run.phase).toBe("play");
  });

  it("time running out ends the run, once", () => {
    const run = createRun(5);
    expect(tick(run, run.time - 0.5)).toBe(false);
    expect(tick(run, 1)).toBe(true);
    expect(run.phase).toBe("over");
    expect(tick(run, 1)).toBe(false);
    expect(parseRun(run)).toBeNull();
  });

  it("the clock gets shorter with the level, with a floor", () => {
    expect(timeFor(1)).toBeGreaterThan(timeFor(8));
    expect(timeFor(200)).toBe(150);
  });

  it("freeze stops the clock for a while, once at a time", () => {
    const run = createRun(5);
    const t0 = run.time;
    expect(useFreeze(run)).toBe(true);
    expect(useFreeze(run)).toBe(false);
    tick(run, FREEZE_TIME - 1);
    expect(run.time).toBe(t0);
    tick(run, 2);
    tick(run, 2);
    expect(run.time).toBe(t0 - 2);
  });

  it("hint finds an open pair and spends a hint; shuffle spends a shuffle", () => {
    const run = createRun(5);
    const h = run.hints;
    const pair = useHint(run);
    expect(pair && canMatch(run.board, pair.a, pair.b)).toBeTruthy();
    expect(run.hints).toBe(h - 1);
    const s = run.shuffles;
    const before = multiset(run.board);
    expect(useShuffle(run)).toBe(true);
    expect(run.shuffles).toBe(s - 1);
    expect(multiset(run.board)).toEqual(before);
    run.shuffles = 0;
    expect(useShuffle(run)).toBe(false);
  });

  it("a saved run round-trips through JSON", () => {
    const run = createRun(11, 3);
    const back = parseRun(JSON.parse(JSON.stringify(run)));
    expect(back?.board.cells).toEqual(run.board.cells);
    expect(back?.level).toBe(3);
    expect(parseRun({ level: 2 })).toBeNull();
  });
});
