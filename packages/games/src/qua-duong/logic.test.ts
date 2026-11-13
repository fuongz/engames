import { describe, expect, it } from "vitest";
import {
  BACK_LIMIT,
  CATCH_TIME,
  COURIER_FROM,
  COURIER_VARIANTS,
  DOG_FROM,
  DUCK_HALF,
  HALF,
  HOP_TIME,
  LENGTH,
  NET_HALF,
  NET_WARN,
  NINJA_VARIANTS,
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
  inNet,
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
  Object.assign(l, { movers: [], blocks: [], coin: null, dir: 1, speed: 0, courier: false, period: 0, phase: 0 }, lane, { row });
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
    const lane: Lane = { row: 5, kind: "rail", dir: 1, speed: 0, courier: false, movers: [], blocks: [], coin: null, period: 8, phase: 0 };
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

// ---------------------------------------------------------------- the street's characters

/** Every lane from row 0 to `to` for a seed, in order. */
function world(seed: number, to = 600): Lane[] {
  const s = createRun(seed);
  const seen = new Map<number, Lane>();
  for (let target = 0; target <= to; target += 10) {
    s.maxRow = target;
    extend(s);
    for (const l of s.lanes) seen.set(l.row, l);
  }
  return [...seen.values()].sort((a, b) => a.row - b.row);
}

const SEEDS = [1, 2, 3, 42, 99, 2024];
const roads = (lanes: Lane[]) => lanes.filter((l) => l.kind === "road");

describe("courier lanes", () => {
  const all = SEEDS.flatMap((seed) => roads(world(seed)));
  const couriers = all.filter((l) => l.courier);

  it("come from COURIER_FROM, never two side by side, and more often further on", () => {
    expect(couriers.length).toBeGreaterThan(20);
    for (const l of couriers) expect(l.row).toBeGreaterThanOrEqual(COURIER_FROM);
    for (const seed of SEEDS) {
      const lanes = world(seed);
      for (let i = 1; i < lanes.length; i++) expect(lanes[i - 1].courier && lanes[i].courier, `seed ${seed} row ${lanes[i].row}`).toBe(false);
    }
    const share = (from: number, to: number) => {
      const r = all.filter((l) => l.row >= from && l.row < to);
      return r.filter((l) => l.courier).length / r.length;
    };
    expect(share(200, 600)).toBeGreaterThan(share(COURIER_FROM, 80));
  });

  it("ride clearly faster than ordinary lanes at the same rows", () => {
    for (const [from, to] of [
      [COURIER_FROM, 150],
      [150, 600],
    ]) {
      const band = all.filter((l) => l.row >= from && l.row < to);
      const avg = (ls: Lane[]) => ls.reduce((t, l) => t + l.speed, 0) / ls.length;
      const ratio = avg(band.filter((l) => l.courier)) / avg(band.filter((l) => !l.courier));
      expect(ratio, `rows ${from}–${to}`).toBeGreaterThan(1.3);
      expect(ratio, `rows ${from}–${to}`).toBeLessThan(1.8);
    }
  });

  it("are mostly couriers, in all four colours, and couriers ride nowhere else", () => {
    const movers = couriers.flatMap((l) => l.movers);
    expect(movers.filter((m) => m.kind === "courier").length / movers.length).toBeGreaterThan(0.65);
    expect(movers.every((m) => m.kind === "courier" || m.kind === "moto")).toBe(true);
    const looks = new Set(movers.filter((m) => m.kind === "courier").map((m) => m.v));
    expect(looks).toEqual(new Set([...Array(COURIER_VARIANTS).keys()]));
    for (const l of all) if (!l.courier) expect(l.movers.some((m) => m.kind === "courier")).toBe(false);
  });

  it("pick the same rider and colour for the same seed", () => {
    const looks = (seed: number) => roads(world(seed, 300)).map((l) => [l.courier, l.speed, l.movers.map((m) => `${m.kind}:${m.v ?? "-"}`)]);
    expect(looks(1234)).toEqual(looks(1234));
    expect(looks(1234)).not.toEqual(looks(4321));
  });
});

describe("scooter riders and dog-thief bikes", () => {
  const all = SEEDS.flatMap((seed) => roads(world(seed)));
  const movers = all.flatMap((l) => l.movers.map((m) => ({ m, l })));

  it("sun-covered scooter riders mix into moto lanes, in every variant", () => {
    const ninjas = movers.filter(({ m }) => m.kind === "ninja");
    expect(ninjas.length).toBeGreaterThan(50);
    expect(new Set(ninjas.map(({ m }) => m.v))).toEqual(new Set([...Array(NINJA_VARIANTS).keys()]));
    for (const { l } of ninjas) expect(l.courier || l.movers.some((x) => x.kind === "bus" || x.kind === "ba-gac")).toBe(false);
  });

  it("dog-thief bikes are rare: past DOG_FROM, one per lane at most, fewer lanes than buses", () => {
    const dogLanes = all.filter((l) => l.movers.some((m) => m.kind === "dog-thief"));
    const busLanes = all.filter((l) => l.movers.some((m) => m.kind === "bus"));
    expect(dogLanes.length).toBeGreaterThan(5);
    expect(dogLanes.length).toBeLessThan(busLanes.length / 2);
    for (const l of dogLanes) {
      expect(l.row).toBeGreaterThanOrEqual(DOG_FROM);
      expect(l.courier).toBe(false);
      expect(l.movers.filter((m) => m.kind === "dog-thief")).toHaveLength(1);
    }
  });

  it("every road gap, the one across the wrap too, leaves time to hop through", () => {
    const span = 2 * SPAN_HALF;
    for (const l of all) {
      const ms = [...l.movers].sort((a, b) => a.x0 - b.x0);
      for (let i = 0; i < ms.length; i++) {
        const a = ms[i];
        const b = ms[(i + 1) % ms.length];
        const gap = (b.x0 - b.len / 2 + (i === ms.length - 1 ? span : 0)) - (a.x0 + a.len / 2);
        expect((gap - 2 * DUCK_HALF) / l.speed, `row ${l.row}${l.courier ? " (courier)" : ""} gap ${i}`).toBeGreaterThanOrEqual(2 * HOP_TIME);
      }
    }
  });
});

describe("the dog-thief net", () => {
  const ROW = DOG_FROM + 5;

  /**
   * The duck on grass at ROW, column 0; a dog-thief bike in the road lane above
   * it, 3 cells left, riding right at 2 cells/s: it is level with the duck after
   * 1.5 s, so its net would go up after 1 s.
   */
  function scene(seed: number, opts: { phase?: State["phase"]; row?: number; boxed?: boolean } = {}) {
    const s = createRun(seed);
    s.phase = opts.phase ?? "play";
    const row = opts.row ?? ROW;
    s.maxRow = row;
    extend(s);
    s.row = row;
    s.x = 0;
    setLane(s, row - 1, { kind: "grass", blocks: opts.boxed ? [{ x: 0, kind: "hedge" }] : [] });
    setLane(s, row, { kind: "grass", blocks: opts.boxed ? [{ x: -1, kind: "hedge" }, { x: 1, kind: "hedge" }] : [] });
    setLane(s, row + 1, { kind: "road", dir: 1, speed: 2, movers: [{ x0: -3, len: 1, kind: "dog-thief" }] });
    setLane(s, row + 2, { kind: "grass" });
    return s;
  }

  /** Seeds whose roll for this bike's lap strikes, and ones that let it pass. */
  const rolls = [...Array(40).keys()].map((seed) => {
    const s = scene(seed + 1);
    return { seed: seed + 1, strikes: run(s, null, 1.2).some((e) => e.type === "net-warn") };
  });
  const striking = rolls.filter((r) => r.strikes).map((r) => r.seed);
  const passing = rolls.filter((r) => !r.strikes).map((r) => r.seed);

  it("strikes on a seeded roll: some seeds do, some don't, the same seed always the same", () => {
    expect(striking.length).toBeGreaterThan(5);
    expect(passing.length).toBeGreaterThan(5);
    const again = scene(striking[0]);
    expect(run(again, null, 1.2).some((e) => e.type === "net-warn")).toBe(true);
  });

  it("raises the net NET_WARN before the swipe, aimed to swing level with the duck", () => {
    const s = scene(striking[0]);
    const ev: { e: GameEvent; t: number }[] = [];
    for (let i = 0; i < Math.round(2 / STEP); i++) for (const e of step(s, null, STEP)) ev.push({ e, t: s.time });
    const warn = ev.find((x) => x.e.type === "net-warn");
    const swipe = ev.find((x) => x.e.type === "net-swipe");
    expect(warn?.t).toBeCloseTo(1, 1);
    expect((swipe?.t ?? 0) - (warn?.t ?? 0)).toBeCloseTo(NET_WARN, 1);
    expect(s.nets).toHaveLength(1);
    const n = s.nets[0];
    expect(n.row).toBe(ROW + 1);
    const lane = laneAt(s, ROW + 1) as Lane;
    expect(Math.abs(moverX(lane, lane.movers[0], n.at))).toBeLessThan(0.1);
  });

  it("a duck standing in the swipe is netted", () => {
    const s = scene(striking[0]);
    const ev = run(s, null, 2);
    expect(ev).toContainEqual({ type: "net-swipe", row: ROW + 1, hit: true });
    expect(ev).toContainEqual({ type: "die", cause: "netted" });
    expect(s.death).toBe("netted");
    expect(s.nets[0].hit).toBe(true);
  });

  it("covers the rows either side of the lane, NET_HALF either side of the bike", () => {
    const s = scene(striking[0]);
    run(s, null, 1.2);
    const n = s.nets[0];
    const lane = laneAt(s, n.row) as Lane;
    const bx = moverX(lane, lane.movers[0], n.at);
    expect(inNet(s, n, bx, n.row - 1)).toBe(true);
    expect(inNet(s, n, bx, n.row + 1)).toBe(true);
    expect(inNet(s, n, bx + NET_HALF - 0.05, n.row + 1)).toBe(true);
    expect(inNet(s, n, bx - NET_HALF + 0.05, n.row - 1)).toBe(true);
    expect(inNet(s, n, bx + NET_HALF + 0.05, n.row + 1)).toBe(false);
    expect(inNet(s, n, bx, n.row)).toBe(false);
    expect(inNet(s, n, bx, n.row + 2)).toBe(false);
  });

  it("can be dodged: a hop away from the lane, or two hops sideways, after the warning", () => {
    for (const moves of [["down"], ["right", "right"], ["left", "left"]] as Dir[][]) {
      const s = scene(striking[0]);
      run(s, null, 1.05);
      expect(s.nets).toHaveLength(1);
      for (const m of moves) run(s, m, HOP_TIME + STEP);
      const ev = run(s, null, 1);
      expect(ev, moves.join(" ")).toContainEqual({ type: "net-swipe", row: ROW + 1, hit: false });
      expect(s.phase, moves.join(" ")).toBe("play");
    }
    // One hop sideways is not enough
    const s = scene(striking[0]);
    run(s, null, 1.05);
    run(s, "right", HOP_TIME + STEP);
    expect(run(s, null, 1)).toContainEqual({ type: "die", cause: "netted" });
  });

  it("riding into the bike itself is an ordinary hit", () => {
    const s = scene(striking[0]);
    run(s, null, 1.05);
    const ev = [...run(s, "up", HOP_TIME + STEP), ...run(s, null, 1)];
    expect(ev).toContainEqual({ type: "die", cause: "hit" });
    expect(s.death).toBe("hit");
  });

  it("never goes for a duck that has no way out, before DOG_FROM, or before the run starts", () => {
    for (const seed of striking.slice(0, 5)) {
      expect(run(scene(seed, { boxed: true }), null, 2).some((e) => e.type === "net-warn"), `boxed ${seed}`).toBe(false);
      expect(run(scene(seed, { row: DOG_FROM - 6 }), null, 2).some((e) => e.type === "net-warn"), `early ${seed}`).toBe(false);
      const ready = scene(seed, { phase: "ready" });
      run(ready, null, 2);
      expect(ready.nets, `ready ${seed}`).toEqual([]);
      expect(ready.phase).toBe("ready");
    }
  });

  it("leaves the lane generator alone and replays exactly", () => {
    const play = () => {
      const s = scene(striking[0]);
      const before = s.rng.seed;
      const events: GameEvent[] = [];
      for (let i = 0; i < 200; i++) events.push(...step(s, i === 70 ? "down" : null, STEP));
      return { s, events, before };
    };
    const a = play();
    const b = play();
    expect(a.s.rng.seed).toBe(a.before);
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
    expect(a.events).toEqual(b.events);
  });
});
