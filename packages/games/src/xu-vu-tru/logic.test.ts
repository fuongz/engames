import { describe, expect, it } from "vitest";
import {
  BETA_START_COINS,
  COIN_R,
  CORE_COUNT,
  CORE_R,
  FLIGHT_UP,
  MAX_BODIES,
  MAX_SPEED,
  SEG_SIZE,
  SHELF_D,
  SHELF_W,
  SIDE_WALL_D,
  SPIN_PRIZES,
  SPIN_TIME,
  SUPER_SHOWER,
  SUPER_TICKETS,
  SUPER_TIME,
  WHEEL,
} from "./config";
import { type GameEvent, SPIN_HOLD, type State, createRun, segmentAt, update } from "./logic";
import { type Body, energy, stepShelf } from "./physics";

const DT = 1 / 60;

function run(s: State, steps: number, shoot = false) {
  const ev: GameEvent[] = [];
  for (let i = 0; i < steps; i++) ev.push(...update(s, { shoot }, DT));
  return ev;
}

/** A run with an empty shelf: only what a test puts there. */
function bare(seed = 1): State {
  const s = createRun(seed);
  s.bodies = [];
  s.respawns = [];
  s.flights = [];
  return s;
}

const coinAt = (s: State, x: number, y: number, vx = 0, vy = 0, stack = 1): Body => {
  const b: Body = { id: s.nextId++, kind: "coin", core: -1, stack, x, y, vx, vy, r: COIN_R };
  s.bodies.push(b);
  return b;
};

const capsuleAt = (s: State, core: number, x: number, y: number, vy = 0): Body => {
  const b: Body = { id: s.nextId++, kind: "core", core, stack: 1, x, y, vx: 0, vy, r: CORE_R };
  s.bodies.push(b);
  return b;
};

describe("a fresh run", () => {
  it("starts with the beta coins, a full shelf and all six capsules, at rest", () => {
    const s = createRun(42);
    expect(s.coins).toBe(BETA_START_COINS);
    expect(s.tickets).toBe(0);
    expect(s.bodies.filter((b) => b.kind === "coin").reduce((a, b) => a + b.stack, 0)).toBeGreaterThan(70);
    for (let c = 0; c < CORE_COUNT; c++)
      expect(s.bodies.some((b) => b.core === c) || s.respawns.some((r) => r.core === c)).toBe(true);
    // Settled: nothing falls while nobody shoots
    const ev = run(s, 60 * 6);
    expect(ev.filter((e) => e.type === "fall")).toEqual([]);
    expect(s.coins).toBe(BETA_START_COINS);
  });

  it("is deterministic for a seed and different across seeds", () => {
    expect(JSON.stringify(createRun(7))).toBe(JSON.stringify(createRun(7)));
    expect(JSON.stringify(createRun(7))).not.toBe(JSON.stringify(createRun(8)));
  });

  it("replays a whole session exactly from its seed and inputs", () => {
    const play = () => {
      const s = createRun(99);
      const log: string[] = [];
      for (let i = 0; i < 60 * 40; i++) {
        const shoot = i % 97 < 60;
        for (const e of update(s, { shoot }, DT)) log.push(e.type);
      }
      return { s: JSON.stringify(s), log: log.join(",") };
    };
    const a = play();
    const b = play();
    expect(a.s).toBe(b.s);
    expect(a.log).toBe(b.log);
  });

  it("is JSON-safe (a saved run resumes identically)", () => {
    const s = createRun(5);
    run(s, 600, true);
    const copy = JSON.parse(JSON.stringify(s)) as State;
    const ea = run(s, 600, true);
    const eb = run(copy, 600, true);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(s));
    expect(eb).toEqual(ea);
  });
});

describe("shooting and the wheel", () => {
  it("spends one coin per shot, and a dry press does nothing", () => {
    const s = createRun(3);
    const ev = run(s, 1, true);
    expect(ev.some((e) => e.type === "shoot")).toBe(true);
    expect(s.coins).toBe(BETA_START_COINS - 1);
    expect(s.flights).toHaveLength(1);
    const dry = createRun(3, 0);
    const dev = run(dry, 1, true);
    expect(dev.map((e) => e.type)).toContain("dry");
    expect(dry.flights).toHaveLength(0);
  });

  it("pays the segment facing the chute when the coin arrives", () => {
    const s = bare(11);
    s.tickets = 0;
    run(s, 1, true);
    const ev: GameEvent[] = [];
    let seg = -1;
    for (let i = 0; i < 60 && !ev.some((e) => e.type === "hit"); i++) {
      ev.push(...update(s, { shoot: false }, DT));
      const h = ev.find((e) => e.type === "hit");
      if (h && h.type === "hit") seg = h.seg;
    }
    expect(seg).toBe(segmentAt(s.wheel));
    const segment = WHEEL[seg];
    if (segment.kind === "tickets") expect(s.tickets).toBe(segment.value);
  });

  it("covers every slot, with the core and BONUS slots narrower than ticket slots", () => {
    const seen = new Set<number>();
    for (let a = 0; a < 3600; a++) seen.add(segmentAt((a / 3600) * Math.PI * 2));
    expect(seen.size).toBe(WHEEL.length);
    const core = WHEEL.findIndex((w) => w.kind === "core");
    const tickets = WHEEL.findIndex((w) => w.kind === "tickets");
    expect(SEG_SIZE[core]).toBeLessThan(SEG_SIZE[tickets]);
    expect(SEG_SIZE.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.PI * 2);
  });

  /** Shoot once with the wheel turned so that `kind` is what the coin meets. */
  function shootInto(kind: "core" | "bonus", cores: boolean[]) {
    for (let a = 0; a < 720; a++) {
      const s = bare(2);
      s.cores = [...cores];
      s.wheel = (a / 720) * Math.PI * 2;
      run(s, 1, true);
      const ev = run(s, Math.ceil(FLIGHT_UP / DT) + 1);
      const h = ev.find((e) => e.type === "hit");
      if (h && h.type === "hit" && h.segment.kind === kind) return { s, ev };
    }
    throw new Error(`never hit ${kind}`);
  }

  it("a core slot lights the next dark core", () => {
    const { s, ev } = shootInto("core", [true, true, false, false, true, false]);
    expect(s.cores).toEqual([true, true, true, false, true, false]);
    expect(ev).toContainEqual({ type: "coreLit", core: 2, via: "wheel" });
  });

  it("the BONUS slot queues a Bonus Spin that pays one of the reel prizes", () => {
    const { s, ev } = shootInto("bonus", Array(CORE_COUNT).fill(false));
    expect(ev.some((e) => e.type === "spinStart") || s.queued === 1).toBe(true);
    const before = s.tickets;
    const later = run(s, Math.ceil((SPIN_TIME + SPIN_HOLD) / DT) + 5);
    const win = [...ev, ...later].find((e) => e.type === "spinWin");
    expect(win && win.type === "spinWin" && (SPIN_PRIZES as readonly number[]).includes(win.prize)).toBe(true);
    if (win && win.type === "spinWin") expect(s.tickets - before).toBeGreaterThanOrEqual(win.prize);
    expect(s.spin).toBeNull();
  });
});

describe("the shelf", () => {
  it("returns a coin pushed off the front: +1 coin, +1 ticket", () => {
    const s = bare();
    s.coins = 0;
    coinAt(s, SHELF_W / 2, SHELF_D - 2, 0, 200);
    const ev = run(s, 10);
    expect(ev).toContainEqual(expect.objectContaining({ type: "fall", edge: "front", stack: 1 }));
    expect(s.coins).toBe(1);
    expect(s.tickets).toBe(1);
    expect(s.bodies).toHaveLength(0);
  });

  it("returns every coin of a stack", () => {
    const s = bare();
    s.coins = 0;
    coinAt(s, SHELF_W / 2, SHELF_D - 2, 0, 200, 3);
    run(s, 10);
    expect(s.coins).toBe(3);
    expect(s.tickets).toBe(3);
  });

  it("loses a coin over a side gutter", () => {
    const s = bare();
    s.coins = 5;
    coinAt(s, 3, SIDE_WALL_D + 60, -300, 0);
    const ev = run(s, 10);
    expect(ev).toContainEqual(expect.objectContaining({ type: "fall", edge: "side" }));
    expect(s.coins).toBe(5);
    expect(s.tickets).toBe(0);
  });

  it("keeps coins in along the walled back of the sides", () => {
    const s = bare();
    coinAt(s, 20, SIDE_WALL_D - 60, -400, 0);
    const ev = run(s, 60);
    expect(ev.some((e) => e.type === "fall")).toBe(false);
    expect(s.bodies[0].x).toBeGreaterThanOrEqual(COIN_R - 1e-6);
  });

  it("the pusher shoves a row of coins forward until the front one drops", () => {
    const s = bare();
    s.coins = 0;
    // A packed column from just in front of the pusher to the edge
    for (let y = SHELF_D - 4; y > 115; y -= COIN_R * 2) coinAt(s, SHELF_W / 2, y);
    expect(run(s, 60 * 3).some((e) => e.type === "fall")).toBe(false);
    s.flights.push({ id: s.nextId++, t: 0, phase: "down", from: "wheel", x: SHELF_W / 2, core: -1 });
    const ev = run(s, 60 * 8);
    expect(ev.some((e) => e.type === "fall" && e.edge === "front")).toBe(true);
    expect(s.coins).toBeGreaterThan(0);
  });

  it("a capsule pushed off the front lights its core and gives a Bonus Spin", () => {
    const s = bare();
    capsuleAt(s, 3, SHELF_W / 2, SHELF_D - 2, 150);
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "coreLit", core: 3, via: "capsule" });
    expect(ev.some((e) => e.type === "spinStart")).toBe(true);
    expect(s.cores[3]).toBe(true);
  });

  it("a capsule lost to a gutter comes back while its core is dark", () => {
    const s = bare();
    capsuleAt(s, 1, 4, SIDE_WALL_D + 60).vx = -300;
    const ev = run(s, 60 * 5);
    expect(ev).toContainEqual(expect.objectContaining({ type: "fall", edge: "side", core: 1 }));
    expect(s.cores[1]).toBe(false);
    expect(s.bodies.some((b) => b.core === 1) || s.flights.some((f) => f.core === 1)).toBe(true);
  });

  it("lighting all six cores pays the Super Bonus, showers coins, then resets with fresh capsules", () => {
    const s = bare();
    s.cores = [true, true, true, true, true, false];
    capsuleAt(s, 5, SHELF_W / 2, SHELF_D - 2, 150);
    const ev = run(s, 10);
    expect(ev.some((e) => e.type === "super")).toBe(true);
    expect(s.supers).toBe(1);
    expect(s.tickets).toBeGreaterThanOrEqual(SUPER_TICKETS);
    expect(s.flights.filter((f) => f.from === "hub")).toHaveLength(SUPER_SHOWER);
    const later = run(s, Math.ceil(SUPER_TIME / DT) + 120);
    expect(later.some((e) => e.type === "reset")).toBe(true);
    expect(s.cores.every((c) => !c)).toBe(true);
    for (let c = 0; c < CORE_COUNT; c++)
      expect(s.bodies.some((b) => b.core === c) || s.flights.some((f) => f.core === c)).toBe(true);
  });

  it("stacks a coin dropped onto a coin, and caps the number of bodies", () => {
    const s = bare();
    for (let i = 0; i < MAX_BODIES + 30; i++) coinAt(s, 20 + (i % 13) * 31, 110 + Math.floor(i / 13) * 16);
    const total = s.bodies.reduce((a, b) => a + b.stack, 0);
    update(s, { shoot: false }, DT);
    expect(s.bodies.length).toBeLessThanOrEqual(MAX_BODIES);
    // Nothing is created or destroyed by merging (only by falling)
    expect(s.bodies.reduce((a, b) => a + b.stack, 0) + s.returned).toBeLessThanOrEqual(total);
  });
});

describe("physics stays sane", () => {
  it("energy stays bounded and every speed under the cap through a long run", () => {
    const s = createRun(17);
    let maxE = 0;
    for (let i = 0; i < 60 * 90; i++) {
      update(s, { shoot: i % 50 < 35 }, DT);
      maxE = Math.max(maxE, energy(s.bodies));
      for (const b of s.bodies) expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
    }
    // A full shelf creeping at pusher speed is ~100 bodies × ½·m·v² with v ≈ 80
    expect(maxE).toBeLessThan(2e6);
  });

  it("a crowded shelf comes to rest instead of jittering", () => {
    const s = createRun(23);
    run(s, 60 * 20, true);
    // Stop shooting; the pusher keeps moving but the pile settles
    run(s, 60 * 6);
    const loose = s.bodies.filter((b) => b.y > 140 && Math.hypot(b.vx, b.vy) > 5);
    expect(loose.length).toBeLessThan(s.bodies.length * 0.1);
  });

  it("separates two discs dropped on top of each other without launching them", () => {
    const bodies: Body[] = [
      { id: 1, kind: "coin", core: -1, stack: 1, x: 200, y: 200, vx: 0, vy: 0, r: COIN_R },
      { id: 2, kind: "coin", core: -1, stack: 1, x: 200, y: 200, vx: 0, vy: 0, r: COIN_R },
    ];
    for (let i = 0; i < 30; i++) stepShelf(bodies, 40, 0, DT);
    expect(Math.hypot(bodies[0].x - bodies[1].x, bodies[0].y - bodies[1].y)).toBeGreaterThan(COIN_R * 2 - 1);
    expect(energy(bodies)).toBeLessThan(1);
  });
});

describe("the end of a run", () => {
  it("ends once, when coins are gone and the shelf is at rest", () => {
    const s = createRun(31, 0);
    s.tickets = 77;
    const ev = run(s, 60 * 15);
    const overs = ev.filter((e) => e.type === "over");
    expect(overs).toHaveLength(1);
    expect(overs[0]).toEqual({ type: "over", tickets: s.tickets, supers: 0 });
    expect(s.over).toBe(true);
    expect(run(s, 10, true)).toEqual([]);
  });

  it("a full 200-coin run of random play finishes with tickets and a few bonuses", () => {
    let seed = 1;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const s = createRun(4242);
    let steps = 0;
    while (!s.over && steps < 60 * 60 * 10) {
      update(s, { shoot: rnd() < 0.3 }, DT);
      steps++;
    }
    expect(s.over).toBe(true);
    expect(s.shots).toBeGreaterThan(BETA_START_COINS);
    expect(s.tickets).toBeGreaterThan(s.shots);
    expect(s.returned).toBeGreaterThan(0);
  });
});
