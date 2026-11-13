import { describe, expect, it } from "vitest";
import {
  BACK_LIMIT,
  CATCH_TIME,
  HALF,
  HOP_TIME,
  LENGTH,
  SPAN_HALF,
  STALL_LIMIT,
  STALL_WARN,
  STEP,
  TRAIN_SPEED,
  TRAIN_WARN,
} from "./config";
import {
  type Dir,
  type GameEvent,
  type Lane,
  type State,
  TRAIN_PASS,
  createRun,
  duckPos,
  extend,
  isBlocked,
  laneAt,
  moverX,
  step,
  trainAt,
} from "./logic";

/** Run `secs` of fixed steps, feeding `input` on the first one only. */
function run(s: State, input: Dir | null, secs: number): GameEvent[] {
  const out: GameEvent[] = [];
  const n = Math.round(secs / STEP);
  for (let i = 0; i < n; i++) out.push(...step(s, i === 0 ? input : null, STEP));
  return out;
}

/** Turn row `row` into a hand-built lane, for collision tests. */
function setLane(s: State, row: number, lane: Partial<Lane>) {
  const l = laneAt(s, row);
  if (!l) throw new Error(`no lane ${row}`);
  Object.assign(l, { movers: [], blocks: [], coin: null, dir: 1, speed: 0, period: 0, phase: 0 }, lane, { row });
  return l;
}

const started = (seed = 7) => {
  const s = createRun(seed);
  s.phase = "play";
  return s;
};

const shape = (s: State) => s.lanes.map((l) => ({ ...l, coin: l.coin }));

describe("world generation", () => {
  it("is the same for the same seed, and differs between seeds", () => {
    const a = createRun(1234);
    const b = createRun(1234);
    expect(shape(a)).toEqual(shape(b));
    expect(shape(createRun(99))).not.toEqual(shape(a));
  });

  it("starts on safe grass, with the start column free", () => {
    const s = createRun(5);
    for (let r = 0; r < 4; r++) {
      const l = laneAt(s, r);
      expect(l?.kind).toBe("grass");
      expect(l && isBlocked(l, 0)).toBe(false);
    }
  });

  it("generates every lane kind over a long run, and adjacent grass rows always share a free column", () => {
    const s = createRun(42);
    const seen = new Map<number, Lane>();
    for (let target = 0; target <= 600; target += 10) {
      s.maxRow = target;
      extend(s);
      for (const l of s.lanes) seen.set(l.row, l);
    }
    const lanes = [...seen.values()].sort((a, b) => a.row - b.row);
    expect(lanes.map((l) => l.row)).toEqual(lanes.map((_, i) => i));
    expect(new Set(lanes.map((l) => l.kind))).toEqual(new Set(["grass", "road", "river", "rail"]));
    const free = (lane: Lane) => [...Array(HALF * 2 + 1)].map((_, i) => i - HALF).filter((x) => !isBlocked(lane, x));
    for (let i = 1; i < lanes.length; i++) {
      const [a, b] = [lanes[i - 1], lanes[i]];
      if (b.kind === "grass") expect(free(b).length, `row ${b.row} has room`).toBeGreaterThan(0);
      if (a.kind === "grass" && b.kind === "grass") expect(free(b).some((x) => free(a).includes(x)), `rows ${a.row}/${b.row}`).toBe(true);
      if (b.kind === "river") expect(b.movers.length).toBeGreaterThan(2);
    }
    // Harder further out: faster roads on average
    const avg = (from: number, to: number) => {
      const r = lanes.filter((l) => l.kind === "road" && l.row >= from && l.row < to);
      return r.reduce((t, l) => t + l.speed, 0) / r.length;
    };
    expect(avg(300, 600)).toBeGreaterThan(avg(0, 120));
  });

  it("replays exactly: same seed and inputs give the same run", () => {
    const script: (Dir | null)[] = [];
    for (let i = 0; i < 1200; i++) script.push(i % 23 === 0 ? (["up", "up", "left", "up", "right"] as const)[(i / 23) % 5] : null);
    const play = () => {
      const s = createRun(777);
      const events: GameEvent[] = [];
      for (const input of script) events.push(...step(s, input, STEP));
      return { s, events };
    };
    const a = play();
    const b = play();
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
    expect(a.events).toEqual(b.events);
  });

  it("puts movers on a clock, independent of when a lane was generated", () => {
    const s = createRun(3);
    const lane = s.lanes.find((l) => l.kind === "road");
    if (!lane) throw new Error("expected a road");
    const m = lane.movers[0];
    const x0 = moverX(lane, m, 0);
    expect(moverX(lane, m, 1)).toBeCloseTo(wrapTo(x0 + lane.dir * lane.speed), 6);
  });
});

const wrapTo = (x: number) => ((((x + SPAN_HALF) % (2 * SPAN_HALF)) + 2 * SPAN_HALF) % (2 * SPAN_HALF)) - SPAN_HALF;

describe("hopping", () => {
  it("hops one cell in HOP_TIME, and scores the furthest row", () => {
    const s = started();
    setLane(s, 1, { kind: "grass" });
    const ev = run(s, "up", HOP_TIME + STEP);
    expect(ev.map((e) => e.type)).toContain("hop");
    expect(s.row).toBe(1);
    expect(s.maxRow).toBe(1);
    run(s, "down", HOP_TIME + STEP);
    expect(s.row).toBe(0);
    expect(s.maxRow).toBe(1);
  });

  it("the first input starts the run", () => {
    const s = createRun(1);
    setLane(s, 1, { kind: "grass" });
    expect(run(s, null, 1)).toEqual([]);
    expect(s.phase).toBe("ready");
    const ev = run(s, "up", 0.2);
    expect(ev[0]).toEqual({ type: "start" });
    expect(s.phase).toBe("play");
  });

  it("buffers one input during a hop (the latest wins)", () => {
    const s = started();
    setLane(s, 1, { kind: "grass" });
    setLane(s, 2, { kind: "grass" });
    step(s, "up", STEP);
    step(s, "left", STEP);
    step(s, "up", STEP);
    run(s, null, HOP_TIME * 2 + STEP * 2);
    expect(s.row).toBe(2);
    expect(s.x).toBe(0);
  });

  it("bumps into blocks and the playfield edge", () => {
    const s = started();
    setLane(s, 1, { kind: "grass", blocks: [{ x: 0, kind: "banana" }] });
    expect(run(s, "up", 0.2).map((e) => e.type)).toContain("bump");
    expect(s.row).toBe(0);
    s.x = HALF;
    expect(run(s, "right", 0.2).map((e) => e.type)).toContain("bump");
    expect(s.x).toBe(HALF);
    expect(run(s, "down", 0.2).map((e) => e.type)).toContain("bump");
  });

  it("collects a coin on landing", () => {
    const s = started();
    setLane(s, 1, { kind: "grass", coin: 0 });
    const ev = run(s, "up", 0.2);
    expect(ev).toContainEqual({ type: "coin", x: 0, row: 1 });
    expect(s.coins).toBe(1);
    expect(laneAt(s, 1)?.coin).toBeNull();
  });
});

describe("collisions", () => {
  it("a vehicle in the duck's lane flattens it", () => {
    const s = started();
    // A motorbike 2 cells left, riding right at 4 cells/s: it reaches x=0 in ~0.4 s
    setLane(s, 1, { kind: "road", dir: 1, speed: 4, movers: [{ x0: -2, len: 1, kind: "moto" }] });
    run(s, "up", HOP_TIME + STEP);
    expect(s.row).toBe(1);
    const ev = run(s, null, 0.5);
    expect(ev).toContainEqual({ type: "die", cause: "hit" });
    expect(s.phase).toBe("over");
  });

  it("a gap lets the duck through", () => {
    const s = started();
    setLane(s, 1, { kind: "road", dir: 1, speed: 4, movers: [{ x0: 5, len: 1, kind: "moto" }] });
    setLane(s, 2, { kind: "grass" });
    run(s, "up", HOP_TIME + STEP);
    run(s, "up", HOP_TIME + STEP);
    expect(s.row).toBe(2);
    expect(s.phase).toBe("play");
  });

  it("a long bus hits along its whole length", () => {
    const s = started();
    setLane(s, 0, { kind: "road", dir: -1, speed: 0, movers: [{ x0: 1.6, len: 3, kind: "bus" }] });
    expect(run(s, null, STEP)).toContainEqual({ type: "die", cause: "hit" });
  });
});

describe("river", () => {
  it("falling in the water drowns", () => {
    const s = started();
    setLane(s, 1, { kind: "river", dir: 1, speed: 1, movers: [{ x0: 8, len: 2, kind: "raft" }] });
    expect(run(s, "up", 0.2)).toContainEqual({ type: "die", cause: "drown" });
    expect(s.death).toBe("drown");
  });

  it("a floater carries the duck with the current", () => {
    const s = started();
    setLane(s, 1, { kind: "river", dir: 1, speed: 1.5, movers: [{ x0: 0, len: 3, kind: "ghe" }] });
    run(s, "up", HOP_TIME + STEP);
    expect(s.riding).toBe(true);
    const x = s.x;
    run(s, null, 1);
    expect(s.x).toBeCloseTo(x + 1.5, 1);
    expect(s.phase).toBe("play");
  });

  it("snaps onto a cell of the floater, and side hops stay with it", () => {
    const s = started();
    setLane(s, 1, { kind: "river", dir: -1, speed: 0, movers: [{ x0: 0.3, len: 3, kind: "raft" }] });
    run(s, "up", HOP_TIME + STEP);
    expect(s.x).toBeCloseTo(0.3, 6);
    run(s, "left", HOP_TIME + STEP);
    expect(s.riding).toBe(true);
    expect(s.x).toBeCloseTo(-0.7, 6);
  });

  it("being carried past the edge ends the run", () => {
    const s = started();
    setLane(s, 1, { kind: "river", dir: 1, speed: 2, movers: [{ x0: HALF - 1, len: 3, kind: "ghe" }] });
    s.x = HALF - 1;
    run(s, "up", HOP_TIME + STEP);
    expect(s.riding).toBe(true);
    expect(run(s, null, 2)).toContainEqual({ type: "die", cause: "edge" });
  });

  it("hopping from a floater to the bank lands on a whole column", () => {
    const s = started();
    setLane(s, 1, { kind: "river", dir: 1, speed: 0, movers: [{ x0: 0.4, len: 3, kind: "ghe" }] });
    setLane(s, 2, { kind: "grass" });
    run(s, "up", HOP_TIME + STEP);
    run(s, "up", HOP_TIME + STEP);
    expect(s.row).toBe(2);
    expect(Number.isInteger(s.x)).toBe(true);
  });
});

describe("rail", () => {
  it("blinks TRAIN_WARN seconds before the train, which then crosses at TRAIN_SPEED", () => {
    const lane: Lane = { row: 5, kind: "rail", dir: 1, speed: 0, movers: [], blocks: [], coin: null, period: 8, phase: 0 };
    expect(trainAt(lane, 8 - TRAIN_WARN - 0.05).warn).toBe(false);
    expect(trainAt(lane, 8 - TRAIN_WARN + 0.05).warn).toBe(true);
    expect(trainAt(lane, 8 - TRAIN_WARN + 0.05).x).toBeNull();
    const a = trainAt(lane, 8.1).x;
    const b = trainAt(lane, 8.2).x;
    expect(a).not.toBeNull();
    expect((b ?? 0) - (a ?? 0)).toBeCloseTo(TRAIN_SPEED * 0.1, 6);
    expect(trainAt(lane, 8 + TRAIN_PASS + 0.01).x).toBeNull();
  });

  it("dings once per train, then a train on the duck's lane hits it", () => {
    const s = started();
    // Next train arrives 2 s from now, moving left
    setLane(s, 0, { kind: "rail", dir: -1, period: 9, phase: 9 - 2 });
    const ev = run(s, null, 2 + TRAIN_PASS);
    expect(ev.filter((e) => e.type === "train-warn")).toHaveLength(1);
    expect(ev).toContainEqual({ type: "die", cause: "train" });
    // It hit while crossing the middle, half a span in
    expect(s.overT).toBeGreaterThan(0);
  });

  it("a train is long enough to cover the playfield as it passes", () => {
    expect(LENGTH.train).toBeGreaterThan(HALF * 2);
  });
});

describe("the ward officer", () => {
  it("whistles a warning, then catches a duck that stands still too long", () => {
    const s = started();
    const ev = run(s, null, STALL_WARN + 0.05);
    expect(ev).toContainEqual({ type: "stall-warn" });
    expect(s.phase).toBe("play");
    const ev2 = run(s, null, STALL_LIMIT - STALL_WARN + CATCH_TIME + 0.1);
    expect(ev2).toContainEqual({ type: "whistle" });
    expect(ev2).toContainEqual({ type: "die", cause: "caught" });
    expect(s.death).toBe("caught");
  });

  it("ignores inputs while he runs in", () => {
    const s = started();
    run(s, null, STALL_LIMIT + 0.05);
    expect(s.catchT).not.toBeNull();
    setLane(s, 1, { kind: "grass" });
    run(s, "up", 0.3);
    expect(s.row).toBe(0);
  });

  it("each new row resets his patience", () => {
    const s = started();
    for (let r = 1; r <= 3; r++) {
      setLane(s, r, { kind: "grass" });
      run(s, null, STALL_LIMIT - 1);
      run(s, "up", HOP_TIME + STEP);
    }
    expect(s.catchT).toBeNull();
    expect(s.maxRow).toBe(3);
  });

  it("going too far back sends him straight away", () => {
    const s = started();
    for (let r = 1; r <= BACK_LIMIT + 1; r++) setLane(s, r, { kind: "grass" });
    for (let r = 1; r <= BACK_LIMIT + 1; r++) run(s, "up", HOP_TIME + STEP);
    const evs: GameEvent[] = [];
    for (let i = 0; i < BACK_LIMIT; i++) evs.push(...run(s, "down", HOP_TIME + STEP));
    expect(evs).toContainEqual({ type: "whistle" });
    expect(duckPos(s).row).toBe(1);
  });
});
