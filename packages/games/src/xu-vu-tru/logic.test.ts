import { mulberry32 } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import {
  AIM_SPREAD,
  CARD_COUNT,
  CARD_R,
  CARD_TICKETS,
  COIN_DROP_GAP,
  COIN_R,
  CORE_COUNT,
  CORE_R,
  FLIGHT_DOWN,
  FLIGHT_UP,
  MAX_BODIES,
  MAX_SPEED,
  MINI_PRIZES,
  PREFILL_CORES,
  PRIZE_HOLD,
  PRIZE_QUEUE_MAX,
  PRIZE_SPIN_TIME,
  SEG_SIZE,
  SET_TICKETS,
  SHELF_D,
  SHELF_W,
  SIDE_WALL_D,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_SPIN_TIME,
  type Segment,
  DAILY_COINS,
  TRIAL_COINS,
  WELCOME_COINS,
  UNITS,
  WEIGHTS,
  WHEEL,
} from "./config";
import { type Flight, type GameEvent, SPIN_HOLD, grantCoins, type State, createMachine, drainTickets, ownedCount, update } from "./logic";
import { type Body, energy, stepShelf } from "./physics";

const DT = 1 / 60;
/** Coins the rules tests load a machine with (an account machine starts at 0, a trial at TRIAL_COINS). */
const START = 200;
/** Shots a TRIAL_COINS machine lasts with the button held (measured: see RE_NOTES.md). */
const TRIAL_LO = 220;
const TRIAL_HI = 600;
const createRun = (seed: number, coins = START, album: unknown = null) => createMachine(seed, coins, album);
const steps = (seconds: number) => Math.ceil(seconds / DT) + 2;

function run(s: State, n: number, shoot = false) {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...update(s, { shoot }, DT));
  return ev;
}

/** A run with an empty shelf: only what a test puts there. */
function bare(seed = 1): State {
  const s = createRun(seed);
  s.bodies = [];
  s.flights = [];
  return s;
}

const put = (s: State, b: Omit<Body, "id">): Body => {
  const body = { id: s.nextId++, ...b };
  s.bodies.push(body);
  return body;
};
const coinAt = (s: State, x: number, y: number, vx = 0, vy = 0, stack = 1) =>
  put(s, { kind: "coin", core: -1, card: -1, stack, x, y, vx, vy, r: COIN_R });
const capsuleAt = (s: State, x: number, y: number, vx = 0, vy = 0) =>
  put(s, { kind: "core", core: 2, card: -1, stack: 1, x, y, vx, vy, r: CORE_R });
const cardAt = (s: State, card: number, x: number, y: number, vx = 0, vy = 0) =>
  put(s, { kind: "card", core: -1, card, stack: 1, x, y, vx, vy, r: CARD_R });

/** Pushed off the front edge on the next steps. */
const atFront = (make: (x: number, y: number, vx: number, vy: number) => Body) => make(SHELF_W / 2, SHELF_D - 2, 0, 200);
/** Out over the left gutter on the next steps. */
/** Something flung at the left wall near the front, where the gutters used to be. */
const atSide = (make: (x: number, y: number, vx: number, vy: number) => Body) => make(4, SIDE_WALL_D - 60, -300, 0);

const BARE = JSON.stringify(bare(2));
const bareCopy = (seed = 2) => {
  const s = JSON.parse(BARE) as State;
  s.seed = seed;
  return s;
};

/**
 * Shoot once and park the gate until the coin lands: the hole centred under the
 * coin (`hit`), or swung to the far left with the coin at the band's right edge.
 * Returns every event up to and including the landing.
 */
function landOnGate(s: State, hit: boolean) {
  const ev = run(s, 1, true);
  const f = s.flights[s.flights.length - 1];
  while (!ev.some((e) => e.type === "gate")) {
    // One step moves the hole < 4 px, far inside the 15 px tolerance
    f.aim = hit ? 0 : AIM_SPREAD;
    s.gate = hit ? 0 : -Math.PI / 2;
    ev.push(...update(s, { shoot: false }, DT));
  }
  return ev;
}

/** A coin one step from landing on the gate at `aim`. */
const arriving = (s: State, aim = 0): Flight => {
  const f: Flight = { id: s.nextId++, t: FLIGHT_UP - DT / 2, phase: "up", x: SHELF_W / 2, aim, kind: "coin", core: -1, card: -1 };
  s.flights.push(f);
  return f;
};

/** Run a prize spin that stops on a slot matching `want`; returns the run just after it pays. */
function spinOnto(want: (seg: Segment) => boolean, seed = 2) {
  const seg = WHEEL.findIndex(want);
  if (seg < 0) throw new Error("no such slot");
  const s = bareCopy(seed);
  s.prize = { seg, t: 0, paid: false };
  const ev: GameEvent[] = [];
  for (let i = 0; i < steps(PRIZE_SPIN_TIME) && !ev.some((e) => e.type === "prizeWin"); i++) ev.push(...update(s, { shoot: false }, DT));
  const segment = WHEEL[seg];
  return { s, ev, segment };
}

describe("a fresh run", () => {
  it("starts with the coins it is given, a full shelf, two capsules and an empty album, at rest", () => {
    const s = createRun(42);
    expect(s.coins).toBe(START);
    expect(s.lifetimeTickets).toBe(0);
    expect(s.cores).toBe(0);
    expect(s.album).toEqual(Array(CARD_COUNT).fill(false));
    expect(s.bodies.filter((b) => b.kind === "coin").reduce((a, b) => a + b.stack, 0)).toBeGreaterThan(70);
    expect(s.bodies.filter((b) => b.kind === "core")).toHaveLength(PREFILL_CORES);
    expect(s.bodies.some((b) => b.kind === "card")).toBe(false);
    // Settled: nothing falls while nobody shoots
    const ev = run(s, 60 * 6);
    expect(ev.filter((e) => e.type === "fall")).toEqual([]);
    expect(s.coins).toBe(START);
  });

  it("carries the album it is given, and only its valid shape", () => {
    const owned = [true, false, true, false, false, false, false, false, false, true];
    expect(createRun(1, 10, owned).album).toEqual(owned);
    expect(createRun(1, 10, "junk").album).toEqual(Array(CARD_COUNT).fill(false));
    expect(createRun(1, 10, [true]).album.filter(Boolean)).toHaveLength(1);
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
    expect(a.log).toContain("gate");
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

describe("shooting and the gate", () => {
  it("spends one coin per shot, and a dry press does nothing", () => {
    const s = createRun(3);
    const ev = run(s, 1, true);
    expect(ev.some((e) => e.type === "shoot")).toBe(true);
    expect(s.coins).toBe(START - 1);
    expect(s.flights).toHaveLength(1);
    expect(Math.abs(s.flights[0].aim)).toBeLessThanOrEqual(AIM_SPREAD);
    const dry = createRun(3, 0);
    const dev = run(dry, 1, true);
    expect(dev.map((e) => e.type)).toContain("dry");
    expect(dry.flights).toHaveLength(0);
  });

  it("the coin lands on the gate FLIGHT_UP after the press", () => {
    const s = bare(11);
    const ev = run(s, 1, true);
    let n = 1;
    while (!ev.some((e) => e.type === "gate")) {
      ev.push(...update(s, { shoot: false }, DT));
      n++;
    }
    expect(n * DT).toBeGreaterThanOrEqual(FLIGHT_UP);
    expect(n * DT).toBeLessThan(FLIGHT_UP + 2 * DT);
  });

  it("a coin that reaches the hole is swallowed, starts a prize spin and does not drop", () => {
    const s = bare(12);
    const ev = landOnGate(s, true);
    expect(ev).toContainEqual(expect.objectContaining({ type: "gate", hit: true, full: false }));
    expect(ev.some((e) => e.type === "prizeStart")).toBe(true);
    expect(s.prize).not.toBeNull();
    expect(s.flights).toHaveLength(0);
    // Nothing reaches the shelf before the spin pays
    const later = run(s, steps(FLIGHT_DOWN + 0.5));
    expect(later.some((e) => e.type === "land")).toBe(false);
    expect(s.bodies).toHaveLength(0);
    expect(s.coins).toBe(START - 1);
    expect(s.gateHits).toBe(1);
    expect(s.gateShots).toBe(1);
  });

  it("a miss bounces off and drops exactly one coin on the shelf, and starts no spin", () => {
    const s = bare(13);
    const ev = landOnGate(s, false);
    expect(ev).toContainEqual(expect.objectContaining({ type: "gate", hit: false, full: false }));
    expect(s.flights).toEqual([expect.objectContaining({ phase: "down", kind: "coin" })]);
    const x = s.flights[0].x;
    expect(x).toBeGreaterThan(COIN_R);
    expect(x).toBeLessThan(SHELF_W - COIN_R);
    const later = run(s, steps(FLIGHT_DOWN));
    expect(later.filter((e) => e.type === "land")).toEqual([expect.objectContaining({ kind: "coin" })]);
    expect(s.bodies.reduce((a, b) => a + b.stack, 0)).toBe(1);
    expect([...ev, ...later].some((e) => e.type === "prizeStart")).toBe(false);
    expect(s.prize).toBeNull();
    expect(s.stock).toBe(0);
    expect(s.lifetimeTickets).toBe(0);
  });

  it("different seeds drop a missed coin at different spots", () => {
    const xs = new Set<number>();
    for (let seed = 1; seed < 12; seed++) {
      const s = bareCopy(seed);
      landOnGate(s, false);
      xs.add(Math.round(s.flights[0].x));
    }
    expect(xs.size).toBeGreaterThan(8);
  });

  it(`spins queue while one runs, up to ${PRIZE_QUEUE_MAX}; a hit beyond that is swallowed for nothing`, () => {
    const s = bare(14);
    s.prize = { seg: 0, t: 0, paid: false };
    for (let i = 0; i < PRIZE_QUEUE_MAX + 2; i++) arriving(s, 0);
    s.gate = 0;
    const ev = update(s, { shoot: false }, DT);
    const gates = ev.filter((e) => e.type === "gate");
    expect(gates).toHaveLength(PRIZE_QUEUE_MAX + 2);
    expect(gates.filter((e) => e.type === "gate" && e.hit)).toHaveLength(PRIZE_QUEUE_MAX + 2);
    expect(gates.filter((e) => e.type === "gate" && e.full)).toHaveLength(2);
    expect(s.stock).toBe(PRIZE_QUEUE_MAX);
    expect(s.flights).toHaveLength(0);
    expect(s.gateHits).toBe(PRIZE_QUEUE_MAX + 2);
    // The running spin, then the stock one at a time
    const later = run(s, steps((PRIZE_QUEUE_MAX + 1) * (PRIZE_SPIN_TIME + PRIZE_HOLD) + 0.5));
    expect(later.filter((e) => e.type === "prizeStart")).toHaveLength(PRIZE_QUEUE_MAX);
    expect([...ev, ...later].filter((e) => e.type === "prizeWin")).toHaveLength(PRIZE_QUEUE_MAX + 1);
    expect(s.stock).toBe(0);
    expect(s.prize).toBeNull();
  });

  it("a prize spin runs PRIZE_SPIN_TIME, then pays its slot once", () => {
    const s = bare(15);
    s.stock = 1;
    const ev = run(s, 1);
    const start = ev.find((e) => e.type === "prizeStart");
    expect(start?.type).toBe("prizeStart");
    const before = run(s, Math.floor(PRIZE_SPIN_TIME / DT) - 2);
    expect(before.some((e) => e.type === "prizeWin")).toBe(false);
    const after = run(s, steps(PRIZE_HOLD + 0.2));
    const wins = after.filter((e) => e.type === "prizeWin");
    expect(wins).toHaveLength(1);
    expect(wins[0].type === "prizeWin" && start?.type === "prizeStart" && wins[0].seg === start.seg).toBe(true);
    expect(s.prize).toBeNull();
  });
});

describe("the prize wheel", () => {
  it("has every kind of slot, the coin values 1/2/4/6/8, and draws each slot as wide as its weight", () => {
    expect(WHEEL).toHaveLength(WEIGHTS.length);
    expect(UNITS).toBeCloseTo(100);
    expect(SEG_SIZE.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.PI * 2);
    for (let i = 0; i < WHEEL.length; i++) expect(SEG_SIZE[i] / (Math.PI * 2)).toBeCloseTo(WEIGHTS[i] / UNITS, 9);
    const coinValues = new Set(WHEEL.flatMap((w) => (w.kind === "coins" ? [w.value] : [])));
    expect([...coinValues].sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 8]);
    for (const kind of ["tickets", "core", "card"] as const) expect(WHEEL.some((w) => w.kind === kind)).toBe(true);
  });

  it("picks slots in proportion to their weights, over many seeds", () => {
    const counts = new Array(WHEEL.length).fill(0);
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = bareCopy(seed);
      for (let i = 0; i < 100; i++) {
        s.prize = null;
        s.stock = 1;
        for (const e of update(s, { shoot: false }, DT)) if (e.type === "prizeStart") counts[e.seg]++;
        n++;
      }
      s.flights = [];
    }
    expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
    WHEEL.forEach((_, i) => {
      const p = WEIGHTS[i] / UNITS;
      // Within 4 standard errors, slot by slot
      expect(Math.abs(counts[i] / n - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / n));
    });
  });

  it("a ticket slot adds its tickets and drops nothing", () => {
    const { s, ev, segment } = spinOnto((w) => w.kind === "tickets");
    expect(segment.kind).toBe("tickets");
    if (segment.kind !== "tickets") return;
    expect(s.lifetimeTickets).toBe(segment.value);
    expect(ev).toContainEqual({ type: "tickets", amount: segment.value, source: "wheel" });
    expect(s.flights).toHaveLength(0);
    const later = run(s, steps(FLIGHT_DOWN + 0.5));
    expect(later.some((e) => e.type === "land")).toBe(false);
    expect(s.bodies).toHaveLength(0);
  });

  it.each([1, 2, 4, 6, 8])("a %i-coin slot drops that many coins spread across the shelf, and no tickets", (n) => {
    const { s, ev } = spinOnto((w) => w.kind === "coins" && w.value === n);
    expect(s.lifetimeTickets).toBe(0);
    expect(ev.some((e) => e.type === "tickets")).toBe(false);
    expect(s.flights).toHaveLength(n);
    // One coin per equal band of the shelf
    const xs = s.flights.map((f) => f.x).sort((a, b) => a - b);
    const lo = COIN_R + 6;
    const band = (SHELF_W - 2 * lo) / n;
    xs.forEach((x, i) => {
      expect(x).toBeGreaterThanOrEqual(lo + i * band);
      expect(x).toBeLessThanOrEqual(lo + (i + 1) * band);
    });
    const later = run(s, steps(FLIGHT_DOWN + n * COIN_DROP_GAP));
    expect(later.filter((e) => e.type === "land" && e.kind === "coin")).toHaveLength(n);
    expect(s.bodies.reduce((a, b) => a + b.stack, 0)).toBe(n);
    expect(s.lifetimeTickets).toBe(0);
  });

  it("a core slot drops a capsule (nothing else) and starts a Mini spin, but does not fill the meter", () => {
    const { s, ev } = spinOnto((w) => w.kind === "core");
    expect(s.lifetimeTickets).toBe(0);
    expect(s.flights).toHaveLength(1);
    expect(s.flights[0].kind).toBe("core");
    const later = run(s, steps(FLIGHT_DOWN));
    const all = [...ev, ...later];
    expect(all.filter((e) => e.type === "land").map((e) => e.type === "land" && e.kind)).toEqual(["core"]);
    expect(s.bodies.map((b) => b.kind)).toEqual(["core"]);
    expect(s.cores).toBe(0);
    const start = all.find((e) => e.type === "spinStart");
    expect(start && start.type === "spinStart" && start.kind).toBe("mini");
    const before = { tickets: s.lifetimeTickets, coins: s.coins };
    const rest = run(s, steps(SPIN_TIME + SPIN_HOLD));
    const win = rest.find((e) => e.type === "spinWin");
    expect(win?.type).toBe("spinWin");
    if (win?.type !== "spinWin") return;
    expect(MINI_PRIZES).toContainEqual(win.prize);
    if (win.prize.kind === "tickets") expect(s.lifetimeTickets - before.tickets).toBe(win.prize.value);
    else expect(s.coins - before.coins).toBe(win.prize.value);
    expect(s.spin).toBeNull();
  });

  it("a Mini spin that lands on coins adds them to the balance", () => {
    const s = bare();
    s.coins = 0;
    const idx = MINI_PRIZES.findIndex((p) => p.kind === "coins");
    s.spin = { kind: "mini", idx, t: 0, paid: false };
    const ev = run(s, steps(SPIN_TIME));
    expect(ev).toContainEqual({ type: "coinsWon", amount: MINI_PRIZES[idx].value });
    expect(s.coins).toBe(MINI_PRIZES[idx].value);
    expect(s.lifetimeTickets).toBe(0);
  });

  it("a card slot drops one of the ten cards and pays nothing yet", () => {
    const { s } = spinOnto((w) => w.kind === "card");
    expect(s.flights).toHaveLength(1);
    const f = s.flights[0];
    expect(f.kind).toBe("card");
    expect(f.card).toBeGreaterThanOrEqual(0);
    expect(f.card).toBeLessThan(CARD_COUNT);
    const ev = run(s, steps(FLIGHT_DOWN));
    expect(ev).toContainEqual(expect.objectContaining({ type: "land", kind: "card" }));
    expect(s.bodies).toEqual([expect.objectContaining({ kind: "card", card: f.card })]);
    expect(s.lifetimeTickets).toBe(0);
    expect(ownedCount(s.album)).toBe(0);
  });

  it("different seeds pick different cards", () => {
    const picked = new Set<number>();
    for (let seed = 1; seed < 40; seed++) picked.add(spinOnto((w) => w.kind === "card", seed).s.flights[0].card);
    expect(picked.size).toBeGreaterThan(4);
  });
});

describe("gate difficulty", () => {
  /** A long session on an empty shelf (cleared every step) with lots of coins; returns the gate hit rate. */
  function session(seed: number, fire: (s: State, frame: number) => boolean, shots: number) {
    const s = bareCopy(seed);
    s.coins = 1e6;
    let frame = 0;
    while (s.gateShots < shots && frame < 60 * 60 * 60) {
      update(s, { shoot: fire(s, frame) }, DT);
      s.bodies = [];
      frame++;
    }
    expect(s.gateShots).toBeGreaterThanOrEqual(shots);
    return s.gateHits / s.gateShots;
  }

  it("random fire times hit about 25%", () => {
    const r = mulberry32(77);
    const rate = session(3, () => r() < 0.06, 3000);
    expect(rate).toBeGreaterThan(0.22);
    expect(rate).toBeLessThan(0.29);
  });

  it("a held button (or Auto) cannot lock onto the gate: also about 25%", () => {
    const rate = session(4, () => true, 3000);
    expect(rate).toBeGreaterThan(0.22);
    expect(rate).toBeLessThan(0.29);
  });

  it("ideally timed shots (hole centred under the landing band on arrival) hit about 45%", () => {
    // The oracle peeks one shot ahead on a copy and fires only when the hole will
    // be centred under the band's middle (within half a step of travel); it never
    // sees where in the band the coin will land.
    const holeOnArrival = (s: State) => {
      const c = JSON.parse(JSON.stringify(s)) as State;
      c.flights = [];
      let ev = update(c, { shoot: true }, DT);
      while (!ev.some((e) => e.type === "gate")) ev = update(c, { shoot: false }, DT);
      const g = ev.find((e) => e.type === "gate");
      return g?.type === "gate" ? g.hole : Number.NaN;
    };
    const rate = session(5, (s) => s.cooldown <= DT && s.flights.length === 0 && Math.abs(holeOnArrival(s)) < 1.8, 800);
    expect(rate).toBeGreaterThan(0.39);
    expect(rate).toBeLessThan(0.52);
  }, 60_000);
});

describe("the shelf", () => {
  it("returns a coin pushed off the front: +1 coin, +1 ticket", () => {
    const s = bare();
    s.coins = 0;
    coinAt(s, SHELF_W / 2, SHELF_D - 2, 0, 200);
    const ev = run(s, 10);
    expect(ev).toContainEqual(expect.objectContaining({ type: "fall", edge: "front", stack: 1 }));
    expect(s.coins).toBe(1);
    expect(s.lifetimeTickets).toBe(1);
    expect(s.bodies).toHaveLength(0);
  });

  it("returns every coin of a stack", () => {
    const s = bare();
    s.coins = 0;
    coinAt(s, SHELF_W / 2, SHELF_D - 2, 0, 200, 3);
    run(s, 10);
    expect(s.coins).toBe(3);
    expect(s.lifetimeTickets).toBe(3);
  });

  it("never loses a coin off a side: the walls run the whole shelf", () => {
    const s = bare();
    s.coins = 5;
    coinAt(s, 3, SIDE_WALL_D - 30, -300, 0);
    const ev = run(s, 10);
    expect(ev.some((e) => e.type === "fall" && e.edge === "side")).toBe(false);
    expect(s.bodies[0]?.x ?? COIN_R).toBeGreaterThanOrEqual(COIN_R - 1e-6);
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
    for (let y = SHELF_D - 4; y > 115; y -= COIN_R * 2) coinAt(s, SHELF_W / 2, y);
    expect(run(s, 60 * 3).some((e) => e.type === "fall")).toBe(false);
    s.flights.push({ id: s.nextId++, t: 0, phase: "down", x: SHELF_W / 2, aim: 0, kind: "coin", core: -1, card: -1 });
    const ev = run(s, 60 * 8);
    expect(ev.some((e) => e.type === "fall" && e.edge === "front")).toBe(true);
    expect(s.coins).toBeGreaterThan(0);
  });

  it("stacks a coin dropped onto a coin, and caps the number of bodies", () => {
    const s = bare();
    for (let i = 0; i < MAX_BODIES + 30; i++) coinAt(s, 20 + (i % 13) * 31, 110 + Math.floor(i / 13) * 16);
    const total = s.bodies.reduce((a, b) => a + b.stack, 0);
    update(s, { shoot: false }, DT);
    expect(s.bodies.length).toBeLessThanOrEqual(MAX_BODIES);
    expect(s.bodies.reduce((a, b) => a + b.stack, 0) + s.returned).toBeLessThanOrEqual(total);
  });
});

describe("energy cores and the Super spin", () => {
  it("a capsule flung at a side wall stays on the shelf", () => {
    const s = bare();
    atSide((x, y, vx, vy) => capsuleAt(s, x, y, vx, vy));
    const ev = run(s, 30);
    expect(ev.some((e) => e.type === "fall" && e.edge === "side")).toBe(false);
    expect(s.bodies.some((b) => b.kind === "core")).toBe(true);
  });

  it("a capsule pushed off the front counts one core, and pays nothing by itself", () => {
    const s = bare();
    atFront((x, y, vx, vy) => capsuleAt(s, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "coreIn", count: 1 });
    expect(s.cores).toBe(1);
    expect(s.lifetimeTickets).toBe(0);
    expect(s.queue).toEqual([]);
  });

  it("the sixth core starts a Super spin that pays one of its prizes, then the meter resets", () => {
    const s = bare();
    s.cores = CORE_COUNT - 1;
    s.queue = ["mini"];
    atFront((x, y, vx, vy) => capsuleAt(s, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "coreIn", count: CORE_COUNT });
    // The Super spin jumps the queue
    const start = ev.find((e) => e.type === "spinStart");
    expect(start && start.type === "spinStart" && start.kind).toBe("super");
    expect(s.queue).toEqual(["mini"]);
    expect(s.cores).toBe(CORE_COUNT);
    const later = run(s, steps(SUPER_SPIN_TIME));
    const win = later.find((e) => e.type === "spinWin");
    expect(win?.type).toBe("spinWin");
    if (win?.type !== "spinWin") return;
    expect(win.kind).toBe("super");
    expect(SUPER_PRIZES).toContain(win.prize.value);
    expect(s.lifetimeTickets).toBe(win.prize.value);
    expect(later.some((e) => e.type === "superReset")).toBe(true);
    expect(s.cores).toBe(0);
    expect(s.supers).toBe(1);
  });

  it("a core that arrives while the Super spin runs carries over to the next meter", () => {
    const s = bare();
    s.cores = CORE_COUNT - 1;
    atFront((x, y, vx, vy) => capsuleAt(s, x, y, vx, vy));
    run(s, 10);
    atFront((x, y, vx, vy) => capsuleAt(s, x, y, vx, vy));
    run(s, 10);
    expect(s.cores).toBe(CORE_COUNT + 1);
    run(s, steps(SUPER_SPIN_TIME + SPIN_HOLD));
    expect(s.cores).toBe(1);
    expect(s.supers).toBe(1);
    expect(s.spin).toBeNull();
  });
});

describe("cards and the album", () => {
  it("a card flung at a side wall stays on the shelf", () => {
    const s = bare();
    atSide((x, y, vx, vy) => cardAt(s, 4, x, y, vx, vy));
    const ev = run(s, 30);
    expect(ev.some((e) => e.type === "fall" && e.edge === "side")).toBe(false);
    expect(s.bodies.some((b) => b.kind === "card" && b.card === 4)).toBe(true);
  });

  it("a card pushed off the front pays 60 tickets and joins the album", () => {
    const s = bare();
    atFront((x, y, vx, vy) => cardAt(s, 3, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "card", card: 3, fresh: true, owned: 1 });
    expect(s.lifetimeTickets).toBe(CARD_TICKETS);
    expect(s.album[3]).toBe(true);
    expect(s.cardsWon).toBe(1);
  });

  it("a duplicate still pays 60 and leaves the album as it was", () => {
    const s = bare();
    s.album[3] = true;
    atFront((x, y, vx, vy) => cardAt(s, 3, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "card", card: 3, fresh: false, owned: 1 });
    expect(s.lifetimeTickets).toBe(CARD_TICKETS);
    expect(ownedCount(s.album)).toBe(1);
  });

  it("the tenth distinct card pays the 1000-ticket set bonus and starts the album over", () => {
    const s = bare();
    s.album = Array.from({ length: CARD_COUNT }, (_, i) => i !== 7);
    atFront((x, y, vx, vy) => cardAt(s, 7, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "card", card: 7, fresh: true, owned: CARD_COUNT });
    expect(ev.some((e) => e.type === "setComplete")).toBe(true);
    expect(s.lifetimeTickets).toBe(CARD_TICKETS + SET_TICKETS);
    expect(s.album).toEqual(Array(CARD_COUNT).fill(false));
    expect(s.sets).toBe(1);
  });

  it("collecting all ten one by one (with duplicates) pays exactly one set bonus", () => {
    const s = bare();
    const order = [0, 1, 1, 2, 3, 4, 4, 5, 6, 7, 8, 9];
    for (const c of order) {
      atFront((x, y, vx, vy) => cardAt(s, c, x, y, vx, vy));
      run(s, 10);
    }
    expect(s.sets).toBe(1);
    expect(s.cardsWon).toBe(order.length);
    expect(s.lifetimeTickets).toBe(order.length * CARD_TICKETS + SET_TICKETS);
    expect(ownedCount(s.album)).toBe(0);
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
    expect(maxE).toBeLessThan(2e6);
  });

  it("a crowded shelf comes to rest instead of jittering", () => {
    const s = createRun(23);
    run(s, 60 * 20, true);
    run(s, 60 * 6);
    const loose = s.bodies.filter((b) => b.y > 140 && Math.hypot(b.vx, b.vy) > 5);
    expect(loose.length).toBeLessThan(s.bodies.length * 0.1);
  });

  it("separates two discs dropped on top of each other without launching them", () => {
    const bodies: Body[] = [
      { id: 1, kind: "coin", core: -1, card: -1, stack: 1, x: 200, y: 200, vx: 0, vy: 0, r: COIN_R },
      { id: 2, kind: "coin", core: -1, card: -1, stack: 1, x: 200, y: 200, vx: 0, vy: 0, r: COIN_R },
    ];
    for (let i = 0; i < 30; i++) stepShelf(bodies, 40, 0, DT);
    expect(Math.hypot(bodies[0].x - bodies[1].x, bodies[0].y - bodies[1].y)).toBeGreaterThan(COIN_R * 2 - 1);
    expect(energy(bodies)).toBeLessThan(1);
  });
});

/** Hold SHOOT until the machine idles (or `cap` seconds pass); returns the frames played. */
function playToIdle(s: State, cap = 60 * 15, drain?: (n: number) => void) {
  let n = 0;
  while (!s.idle && n < 60 * cap) {
    update(s, { shoot: true }, DT);
    if (drain) drain(drainTickets(s));
    n++;
  }
  return n;
}

describe("out of coins: the machine idles, and resumes on a grant", () => {
  it("idles once, when coins are gone and the shelf is at rest, and keeps its shelf", () => {
    const s = createRun(31, 0);
    const shelf = s.bodies.length;
    const ev = run(s, 60 * 15);
    expect(ev.filter((e) => e.type === "idle")).toHaveLength(1);
    expect(s.idle).toBe(true);
    expect(s.bodies.length).toBe(shelf);
    // Still running: pressing SHOOT answers with the dry click, and nothing else happens
    const more = run(s, 30, true);
    expect(more.some((e) => e.type === "dry")).toBe(true);
    expect(more.some((e) => e.type === "shoot" || e.type === "idle")).toBe(false);
    expect(s.idle).toBe(true);
  });

  it("waits for a queued spin before idling", () => {
    const s = createRun(31, 0);
    s.queue = ["mini"];
    const ev = run(s, 60 * 15);
    expect(ev.findIndex((e) => e.type === "spinWin")).toBeLessThan(ev.findIndex((e) => e.type === "idle"));
  });

  it("waits for the prize stock to pay out before idling", () => {
    const s = createRun(31, 0);
    s.stock = 2;
    const ev = run(s, 60 * 20);
    const wins = ev.flatMap((e, i) => (e.type === "prizeWin" ? [i] : []));
    expect(wins).toHaveLength(2);
    expect(wins[1]).toBeLessThan(ev.findIndex((e) => e.type === "idle"));
  });

  it("resumes on a grant where it stood, spends it, and idles again", () => {
    const s = createRun(31, 0);
    run(s, 60 * 15);
    expect(s.idle).toBe(true);
    const shots = s.shots;
    const tickets = s.lifetimeTickets;
    expect(grantCoins(s, 50)).toBe(50);
    expect(s.idle).toBe(false);
    expect(s.coins).toBe(50);
    const ev = run(s, 1, true);
    expect(ev.some((e) => e.type === "shoot")).toBe(true);
    playToIdle(s);
    expect(s.idle).toBe(true);
    expect(s.coins).toBe(0);
    // Every granted coin was shot, plus whatever the shelf gave back
    expect(s.shots - shots).toBeGreaterThanOrEqual(50);
    expect(s.lifetimeTickets).toBeGreaterThan(tickets);
  }, 30_000);

  it("a coin pushed off the front wakes an idle machine", () => {
    const s = bare(4);
    s.coins = 0;
    run(s, 60 * 8);
    expect(s.idle).toBe(true);
    atFront((x, y, vx, vy) => coinAt(s, x, y, vx, vy));
    run(s, 10);
    expect(s.coins).toBe(1);
    expect(s.idle).toBe(false);
  });
});

describe("tickets drain to the shell", () => {
  it("hands over every ticket earned exactly once, and they add up to the machine's lifetime", () => {
    const s = createRun(77, 120);
    let drained = 0;
    let fromEvents = 0;
    let n = 0;
    while (!s.idle && n < 60 * 60 * 10) {
      for (const e of update(s, { shoot: true }, DT)) if (e.type === "tickets") fromEvents += e.amount;
      const d = drainTickets(s);
      expect(Number.isInteger(d) && d >= 0).toBe(true);
      drained += d;
      n++;
    }
    expect(s.idle).toBe(true);
    expect(drained).toBeGreaterThan(0);
    expect(drained).toBe(fromEvents);
    expect(drained).toBe(s.lifetimeTickets);
    expect(s.unpaid).toBe(0);
    expect(drainTickets(s)).toBe(0);
  }, 30_000);

  it("keeps undrained tickets waiting (nothing is lost between drains)", () => {
    const s = bare(3);
    atFront((x, y, vx, vy) => coinAt(s, x, y, vx, vy, 3));
    run(s, 10);
    expect(s.unpaid).toBe(3);
    atFront((x, y, vx, vy) => coinAt(s, x, y, vx, vy));
    run(s, 10);
    expect(drainTickets(s)).toBe(4);
    expect(s.lifetimeTickets).toBe(4);
    expect(s.unpaid).toBe(0);
  });
});

describe("continuous play", () => {
  it(
    "200 coins with the button held last 600–1000 shots (3–5 minutes) and pay from every source",
    () => {
      // Four seeds, each played until the machine idles (or a 15-minute cap): their mean
      // must sit in the target, and each one near it. RE_NOTES.md has a wider simulation.
      const runs = [101, 202, 303, 404].map((seed) => {
        const s = createRun(seed);
        const sources = new Set<string>();
        let n = 0;
        while (!s.idle && n < 60 * 60 * 15) {
          for (const e of update(s, { shoot: true }, DT)) if (e.type === "tickets") sources.add(e.source);
          n++;
        }
        expect(s.idle).toBe(true);
        expect(s.shots).toBeGreaterThan(450);
        expect(s.shots).toBeLessThan(1300);
        expect(s.returned).toBeGreaterThan(0);
        for (const src of ["wheel", "front"]) expect(sources).toContain(src);
        return { shots: s.shots, tickets: s.lifetimeTickets, minutes: (n * DT) / 60 };
      });
      const mean = (k: "shots" | "tickets" | "minutes") => runs.reduce((a, r) => a + r[k], 0) / runs.length;
      expect(mean("shots")).toBeGreaterThanOrEqual(600);
      expect(mean("shots")).toBeLessThanOrEqual(1000);
      expect(mean("minutes")).toBeGreaterThanOrEqual(2.5);
      expect(mean("minutes")).toBeLessThanOrEqual(5.5);
      expect(mean("tickets")).toBeGreaterThan(2000);
      expect(mean("tickets")).toBeLessThan(5000);
    },
    60_000,
  );

  it(
    `a ${TRIAL_COINS}-coin trial (or welcome) machine plays a few minutes before it idles`,
    () => {
      const runs = [11, 22, 33, 44].map((seed) => {
        const s = createMachine(seed, TRIAL_COINS);
        const frames = playToIdle(s);
        expect(s.idle).toBe(true);
        return { shots: s.shots, minutes: (frames * DT) / 60, tickets: s.lifetimeTickets };
      });
      const mean = (k: "shots" | "minutes" | "tickets") => runs.reduce((a, r) => a + r[k], 0) / runs.length;
      expect(mean("shots")).toBeGreaterThanOrEqual(TRIAL_LO);
      expect(mean("shots")).toBeLessThanOrEqual(TRIAL_HI);
      expect(mean("tickets")).toBeGreaterThan(500);
    },
    60_000,
  );

  it(
    `a day on one machine: idle, then the ${DAILY_COINS}-coin daily plays on from the same shelf`,
    () => {
      const s = createMachine(5, WELCOME_COINS);
      playToIdle(s);
      expect(s.idle).toBe(true);
      const day1 = { shots: s.shots, tickets: s.lifetimeTickets, album: [...s.album], cores: s.cores };
      grantCoins(s, DAILY_COINS);
      playToIdle(s);
      expect(s.idle).toBe(true);
      // The daily's coins and what the shelf gave back were shot; nothing was reset
      expect(s.shots - day1.shots).toBeGreaterThanOrEqual(DAILY_COINS);
      expect(s.lifetimeTickets).toBeGreaterThan(day1.tickets);
      expect(ownedCount(s.album)).toBeGreaterThanOrEqual(0);
    },
    60_000,
  );
});

describe("grantCoins", () => {
  it("adds coins and leaves tickets alone", () => {
    const s = createRun(1);
    const coins = s.coins;
    const tickets = s.lifetimeTickets;
    expect(grantCoins(s, 100)).toBe(100);
    expect(s.coins).toBe(coins + 100);
    expect(s.lifetimeTickets).toBe(tickets);
    expect(s.unpaid).toBe(0);
  });

  it("ignores bad amounts", () => {
    const s = createRun(1);
    expect(grantCoins(s, 0)).toBe(0);
    expect(grantCoins(s, -5)).toBe(0);
    expect(grantCoins(s, Number.NaN)).toBe(0);
    expect(grantCoins(s, Number.POSITIVE_INFINITY)).toBe(0);
    expect(grantCoins(s, 2.9)).toBe(2);
  });
});

describe("new machines", () => {
  it(`an account machine starts at 0 coins; a guest's trial at ${TRIAL_COINS}`, () => {
    expect(TRIAL_COINS).toBe(100);
    expect(createMachine(9).coins).toBe(0);
    const trial = createMachine(9, TRIAL_COINS);
    expect(trial.coins).toBe(100);
    expect(trial.lifetimeTickets).toBe(0);
    expect(trial.idle).toBe(false);
  });
});
