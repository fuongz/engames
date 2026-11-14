import { mulberry32 } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import {
  CARD_COUNT,
  CARD_IDS,
  CARD_R,
  CARD_TICKETS,
  CARD_WEIGHTS,
  COIN_DROP_GAP,
  COIN_R,
  CORE_COUNT,
  CORE_R,
  FLIGHT_DOWN,
  FLIGHT_UP,
  GATE_AMP,
  HOLE_HALF,
  JAR_W,
  JAR_X,
  LAND_X,
  MAX_BODIES,
  MAX_SPEED,
  MINI_PRIZES,
  MINI_WEIGHTS,
  MIN_SLOT_WEIGHT,
  PREFILL_CORES,
  PRIZE_HOLD,
  PRIZE_QUEUE_MAX,
  PRIZE_SPIN_TIME,
  RARE_CARD,
  RARE_TICKETS,
  SEG_SIZE,
  SET_TICKETS,
  SHELF_D,
  SHELF_W,
  SIDE_WALL_D,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_SLOTS,
  SUPER_WEIGHTS,
  type Segment,
  DAILY_COINS,
  TRIAL_COINS,
  WELCOME_COINS,
  UNITS,
  WEIGHTS,
  WHEEL,
} from "./config";
import {
  type Flight,
  type GameEvent,
  SPIN_HOLD,
  type State,
  busy,
  createMachine,
  drainTickets,
  exchangeCard,
  exchangeSet,
  grantCard,
  grantCoins,
  hasSet,
  holeOnArrival,
  inJar,
  lidShut,
  onArrival,
  ownedCount,
  readyToShoot,
  spinSuper,
  update,
} from "./logic";
import { type Body, energy, stepShelf } from "./physics";

const DT = 1 / 60;
/** Coins the rules tests load a machine with (an account machine starts at 0, a trial at TRIAL_COINS). */
const START = 200;
/** Shots and minutes a TRIAL_COINS machine lasts with the button held (eight seeds; measured: see RE_NOTES.md). */
const TRIAL_LO = 500;
const TRIAL_HI = 1200;
const TRIAL_MIN_LO = 3;
const TRIAL_MIN_HI = 7.5;
/** Minutes the daily coins last on a played machine, mean of eight seeds (RE_NOTES.md "Simulated sessions"). */
const DAILY_HELD_LO = 2.5;
const DAILY_HELD_HI = 5.5;
const DAILY_TAP_LO = 4;
const DAILY_TAP_HI = 11;
const createRun = (seed: number, coins = START, album: unknown = null) => createMachine(seed, coins, album);
const steps = (seconds: number) => Math.ceil(seconds / DT) + 2;

function run(s: State, n: number, shoot = false) {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...update(s, { shoot }, DT));
  return ev;
}

/** Spin every Super spin waiting, as the shell's full-screen wheel does (each pays the moment it is spun). */
function spinAll(s: State) {
  const ev: GameEvent[] = [];
  while (s.superPending > 0) ev.push(...spinSuper(s));
  return ev;
}

/** One step of play with the shell's Super wheel: the machine, then any Super spin it earned. */
const play = (s: State, shoot: boolean) => [...update(s, { shoot }, DT), ...spinAll(s)];

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

/** Pushed off the front edge on the next steps: in the middle (the jar's section) unless `x` says otherwise. */
const atFront = (make: (x: number, y: number, vx: number, vy: number) => Body, x = SHELF_W / 2) => make(x, SHELF_D - 2, 0, 200);
/** A spot on the front edge clear of the robot jar. */
const OFF_JAR = 100;
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
 * landing spot (`hit`), or swung all the way to the left.
 * Returns every event up to and including the landing.
 */
function landOnGate(s: State, hit: boolean) {
  const ev = run(s, 1, true);
  while (!ev.some((e) => e.type === "gate")) {
    // One step moves the hole < 4 px, far inside the 18 px tolerance
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
    expect(s.cards).toEqual(Array(CARD_COUNT).fill(0));
    expect(s.seen).toEqual(Array(CARD_COUNT).fill(false));
    expect(s.bodies.filter((b) => b.kind === "coin").reduce((a, b) => a + b.stack, 0)).toBeGreaterThan(70);
    expect(s.bodies.filter((b) => b.kind === "core")).toHaveLength(PREFILL_CORES);
    expect(s.bodies.some((b) => b.kind === "card")).toBe(false);
    // Settled: nothing falls while nobody shoots
    const ev = run(s, 60 * 6);
    expect(ev.filter((e) => e.type === "fall")).toEqual([]);
    expect(s.coins).toBe(START);
  });

  it("carries a beta album it is given as one card of each owned cat, and only its valid shape", () => {
    const owned = [true, false, true, false, false, false, false, false, false, true];
    expect(createRun(1, 10, owned).cards).toEqual(owned.map((o) => (o ? 1 : 0)));
    expect(createRun(1, 10, owned).seen).toEqual(owned);
    expect(createRun(1, 10, "junk").cards).toEqual(Array(CARD_COUNT).fill(0));
    expect(createRun(1, 10, [true]).cards.filter((n) => n > 0)).toHaveLength(1);
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
    // No spread: every shot lands on the same spot
    expect(s.flights[0].aim).toBe(LAND_X);
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
    expect(ev).toContainEqual(expect.objectContaining({ type: "gate", hit: true, lid: false }));
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
    expect(ev).toContainEqual(expect.objectContaining({ type: "gate", hit: false, lid: false }));
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

  it(`spins queue while one runs, up to ${PRIZE_QUEUE_MAX}; then the lid shuts and the next coins bounce onto the shelf`, () => {
    const s = bare(14);
    s.prize = { seg: 0, t: 0, paid: false };
    for (let i = 0; i < PRIZE_QUEUE_MAX + 2; i++) arriving(s, 0);
    s.gate = 0;
    expect(lidShut(s)).toBe(false);
    const ev = update(s, { shoot: false }, DT);
    const gates = ev.filter((e) => e.type === "gate");
    expect(gates).toHaveLength(PRIZE_QUEUE_MAX + 2);
    // Four drop in; the two after them land on the shut lid, which is no hit
    expect(gates.filter((e) => e.type === "gate" && e.hit)).toHaveLength(PRIZE_QUEUE_MAX);
    expect(gates.filter((e) => e.type === "gate" && e.lid)).toHaveLength(2);
    expect(gates.every((e) => e.type === "gate" && !(e.hit && e.lid))).toBe(true);
    expect(s.stock).toBe(PRIZE_QUEUE_MAX);
    expect(lidShut(s)).toBe(true);
    expect(s.gateHits).toBe(PRIZE_QUEUE_MAX);
    expect(s.gateShots).toBe(PRIZE_QUEUE_MAX + 2);
    // Nothing swallowed: each lid bounce is a coin falling to the shelf
    expect(s.flights).toEqual([expect.objectContaining({ phase: "down", kind: "coin" }), expect.objectContaining({ phase: "down", kind: "coin" })]);
    const landed = run(s, steps(FLIGHT_DOWN));
    expect(landed.filter((e) => e.type === "land" && e.kind === "coin")).toHaveLength(2);
    expect(s.bodies.reduce((a, b) => a + b.stack, 0)).toBe(2);
    // The running spin, then the stock one at a time; the lid opens as soon as a lamp is free
    const later = run(s, steps((PRIZE_QUEUE_MAX + 1) * (PRIZE_SPIN_TIME + PRIZE_HOLD) + 0.5));
    expect(later.filter((e) => e.type === "prizeStart")).toHaveLength(PRIZE_QUEUE_MAX);
    expect([...ev, ...landed, ...later].filter((e) => e.type === "prizeWin")).toHaveLength(PRIZE_QUEUE_MAX + 1);
    expect(s.stock).toBe(0);
    expect(lidShut(s)).toBe(false);
    expect(s.prize).toBeNull();
  });

  it("a coin over the hole while the lid is shut is never swallowed: it comes down as one coin, no spin, no pop", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = bareCopy(seed);
      s.coins = 0;
      s.stock = PRIZE_QUEUE_MAX;
      s.prize = { seg: 0, t: 0, paid: false };
      const before = { stock: s.stock, hits: s.gateHits, tickets: s.lifetimeTickets };
      arriving(s, 0);
      s.gate = 0;
      const ev = update(s, { shoot: false }, DT);
      expect(ev).toContainEqual(expect.objectContaining({ type: "gate", hit: false, lid: true }));
      expect(s.stock).toBe(before.stock);
      expect(s.gateHits).toBe(before.hits);
      expect(s.flights.filter((f) => f.phase === "down" && f.kind === "coin")).toHaveLength(1);
      run(s, steps(FLIGHT_DOWN));
      expect(s.bodies.reduce((a, b) => a + (b.kind === "coin" ? b.stack : 0), 0)).toBe(1);
      expect(s.lifetimeTickets).toBe(before.tickets);
    }
  });

  it("the ready cue stays off while the lid will be shut when the coin arrives, and comes back when a lamp frees", () => {
    const s = bareCopy(9);
    s.coins = 100;
    s.stock = PRIZE_QUEUE_MAX;
    // A spin with plenty left to run: the stock cannot drop before a shot fired now lands
    s.prize = { seg: 0, t: 0, paid: false };
    for (let i = 0; i < 60; i++) {
      update(s, { shoot: false }, DT);
      expect(onArrival(s).lid).toBe(true);
      expect(readyToShoot(s)).toBe(false);
    }
    // Once the running spin ends the next one takes a lamp, the lid opens, and the cue shows again
    let cue = false;
    for (let i = 0; i < 60 * 4 && !cue; i++) {
      update(s, { shoot: false }, DT);
      cue = readyToShoot(s);
    }
    expect(cue).toBe(true);
    expect(onArrival(s).lid).toBe(false);
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
  it("has 10 to 12 slots of every kind, each wide enough for its whole tile, drawn as wide as its weight", () => {
    expect(WHEEL.length).toBeGreaterThanOrEqual(10);
    expect(WHEEL.length).toBeLessThanOrEqual(12);
    expect(WHEEL).toHaveLength(WEIGHTS.length);
    expect(UNITS).toBeCloseTo(100);
    expect(SEG_SIZE.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.PI * 2);
    for (let i = 0; i < WHEEL.length; i++) {
      expect(SEG_SIZE[i] / (Math.PI * 2)).toBeCloseTo(WEIGHTS[i] / UNITS, 9);
      expect(WEIGHTS[i]).toBeGreaterThanOrEqual(MIN_SLOT_WEIGHT);
    }
    // Coin values only from the tiles there are (1/2/4/6/8); ticket values likewise
    for (const w of WHEEL) {
      if (w.kind === "coins") expect([1, 2, 4, 6, 8]).toContain(w.value);
      if (w.kind === "tickets") expect([5, 10, 20, 30, 50, 100]).toContain(w.value);
    }
    for (const kind of ["tickets", "coins", "core", "card"] as const) expect(WHEEL.some((w) => w.kind === kind)).toBe(true);
  });

  it("pays coins on 35–45% of prize spins, about one coin a spin on average (so a hit is worth no less than a miss)", () => {
    const share = (pred: (w: Segment) => boolean) => WHEEL.reduce((a, w, i) => a + (pred(w) ? WEIGHTS[i] : 0), 0) / UNITS;
    const coinShare = share((w) => w.kind === "coins");
    expect(coinShare).toBeGreaterThanOrEqual(0.35);
    expect(coinShare).toBeLessThanOrEqual(0.45);
    const miniTotal = MINI_WEIGHTS.reduce((a, b) => a + b, 0);
    const miniCoins = MINI_PRIZES.reduce((a, p, i) => a + (p.kind === "coins" ? (p.value * MINI_WEIGHTS[i]) / miniTotal : 0), 0);
    const coinsPerSpin =
      WHEEL.reduce((a, w, i) => a + (w.kind === "coins" ? (w.value * WEIGHTS[i]) / UNITS : 0), 0) + share((w) => w.kind === "core") * miniCoins;
    // RE_NOTES.md: 0.97 from the coin slots + 0.046 from Mini spins. A miss puts one
    // coin on the shelf, a prize spin about the same: the jar, not the aim, drains
    expect(coinsPerSpin).toBeGreaterThanOrEqual(1);
    expect(coinsPerSpin).toBeLessThan(1.1);
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

  it.each([...new Set(WHEEL.flatMap((w) => (w.kind === "coins" ? [w.value] : [])))])("a %i-coin slot drops that many coins spread across the shelf, and no tickets", (n) => {
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
    expect(ownedCount(s.cards)).toBe(0);
  });

  it("different seeds pick different cards", () => {
    const picked = new Set<number>();
    for (let seed = 1; seed < 40; seed++) picked.add(spinOnto((w) => w.kind === "card", seed).s.flights[0].card);
    expect(picked.size).toBeGreaterThan(4);
  });

  it("picks the cat by CARD_WEIGHTS: the Ragdoll a quarter as often as each other cat, over many seeds", () => {
    const rare = CARD_IDS.indexOf(RARE_CARD);
    expect(CARD_WEIGHTS[rare] * 4).toBe(CARD_WEIGHTS[(rare + 1) % CARD_COUNT]);
    const total = CARD_WEIGHTS.reduce((a, b) => a + b, 0);
    expect(CARD_WEIGHTS[rare] / total).toBeCloseTo(1 / 37, 9);
    const seg = WHEEL.findIndex((w) => w.kind === "card");
    const counts = new Array(CARD_COUNT).fill(0);
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const s = bareCopy(seed);
      for (let i = 0; i < 60; i++) {
        // A card spin one step from paying
        s.prize = { seg, t: PRIZE_SPIN_TIME - DT / 2, paid: false };
        s.flights = [];
        update(s, { shoot: false }, DT);
        const f = s.flights.find((x) => x.kind === "card");
        if (!f) throw new Error("no card dropped");
        counts[f.card]++;
        n++;
      }
    }
    CARD_IDS.forEach((_, i) => {
      const p = CARD_WEIGHTS[i] / total;
      expect(Math.abs(counts[i] / n - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / n));
    });
    // About 2.7% against about 10.8% for each of the others
    expect(counts[rare] / n).toBeGreaterThan(0.02);
    expect(counts[rare] / n).toBeLessThan(0.034);
  }, 30_000);
});

describe("gate difficulty", () => {
  /**
   * A long session on an empty shelf (cleared every step) with lots of coins;
   * returns the share of coins that reached the gate over the hole: in it, or on
   * its lid while the stock was full (timing alone, whatever the stock).
   */
  function session(seed: number, fire: (s: State, frame: number) => boolean, shots: number) {
    const s = bareCopy(seed);
    s.coins = 1e6;
    let frame = 0;
    let over = 0;
    while (s.gateShots < shots && frame < 60 * 60 * 60) {
      for (const e of update(s, { shoot: fire(s, frame) }, DT)) if (e.type === "gate" && (e.hit || e.lid)) over++;
      s.bodies = [];
      frame++;
    }
    expect(s.gateShots).toBeGreaterThanOrEqual(shots);
    return over / s.gateShots;
  }

  it("every shot lands on one fixed spot, so the hole's swing alone decides: about 30% of the time it is there", () => {
    // The hole is over LAND_X while |GATE_AMP·sin φ| ≤ HOLE_HALF
    expect(LAND_X).toBe(0);
    const theory = Math.asin(HOLE_HALF / GATE_AMP) / (Math.PI / 2);
    expect(theory).toBeGreaterThan(0.28);
    expect(theory).toBeLessThan(0.32);
  });

  it("random fire times hit about 30%", () => {
    const r = mulberry32(77);
    const rate = session(3, () => r() < 0.06, 3000);
    expect(rate).toBeGreaterThan(0.26);
    expect(rate).toBeLessThan(0.34);
  });

  it("a held button (or Auto) cannot lock onto the gate: also about 30%", () => {
    const rate = session(4, () => true, 3000);
    expect(rate).toBeGreaterThan(0.26);
    expect(rate).toBeLessThan(0.34);
  });

  it("the ready cue is honest: a shot fired while it shows always drops in (never onto the lid)", () => {
    const s = bareCopy(5);
    s.coins = 1e6;
    let frame = 0;
    while (s.gateShots < 800 && frame < 60 * 60 * 60) {
      update(s, { shoot: s.cooldown <= DT && readyToShoot(s) }, DT);
      s.bodies = [];
      frame++;
    }
    expect(s.gateShots).toBeGreaterThanOrEqual(800);
    expect(s.gateHits).toBe(s.gateShots);
  }, 30_000);

  it("predicts the hole on arrival exactly as the coin will meet it", () => {
    const s = bareCopy(8);
    for (let i = 0; i < 40; i++) {
      update(s, { shoot: false }, DT);
      const want = holeOnArrival(s);
      const ev = run(s, 1, true);
      let all = ev;
      while (!all.some((e) => e.type === "gate")) all = [...all, ...update(s, { shoot: false }, DT)];
      const g = all.find((e) => e.type === "gate");
      expect(g?.type === "gate" && g.hole).toBeCloseTo(want, 6);
      s.cooldown = 0;
    }
  });

  it("well-timed taps (aimed at the green window, with ±0.1 s of human error) hit 75% or more", () => {
    // A player who has the rhythm: aims each tap at the middle of the next ready
    // window and misses the moment by a normal error with σ = 0.1 s (the window
    // itself lasts about 0.25 s).
    const r = mulberry32(91);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const s = bareCopy(6);
    s.coins = 1e6;
    while (s.gateShots < 600) {
      // Find the next whole ready window on a copy of the gate's clock
      const probe = { ...s, flights: [], bodies: [] } as State;
      const ready: boolean[] = [];
      for (let i = 0; i < 60 * 3; i++) {
        ready.push(readyToShoot(probe));
        update(probe, { shoot: false }, DT);
      }
      const from = Math.ceil(s.cooldown / DT) + 1;
      let i0 = ready.findIndex((x, i) => i >= from && x && !ready[i - 1]);
      if (i0 < 0) i0 = from;
      let i1 = i0;
      while (i1 < ready.length && ready[i1]) i1++;
      const target = Math.max(from, Math.round((i0 + i1 - 1) / 2 + (gauss() * 0.1) / DT));
      for (let i = 0; i < target; i++) {
        update(s, { shoot: false }, DT);
        s.bodies = [];
      }
      update(s, { shoot: true }, DT);
      s.bodies = [];
    }
    const rate = s.gateHits / s.gateShots;
    expect(rate).toBeGreaterThanOrEqual(0.75);
  }, 60_000);
});

describe("the shelf", () => {
  it("returns a coin pushed off the front: +1 coin, +1 ticket", () => {
    const s = bare();
    s.coins = 0;
    coinAt(s, OFF_JAR, SHELF_D - 2, 0, 200);
    const ev = run(s, 10);
    expect(ev).toContainEqual(expect.objectContaining({ type: "fall", edge: "front", stack: 1 }));
    expect(s.coins).toBe(1);
    expect(s.lifetimeTickets).toBe(1);
    expect(s.bodies).toHaveLength(0);
  });

  it("returns every coin of a stack", () => {
    const s = bare();
    s.coins = 0;
    coinAt(s, OFF_JAR, SHELF_D - 2, 0, 200, 3);
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
    for (let y = SHELF_D - 4; y > 115; y -= COIN_R * 2) coinAt(s, OFF_JAR, y);
    expect(run(s, 60 * 3).some((e) => e.type === "fall")).toBe(false);
    s.flights.push({ id: s.nextId++, t: 0, phase: "down", x: OFF_JAR, aim: 0, kind: "coin", core: -1, card: -1 });
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

describe("the robot jar", () => {
  it("covers about a tenth of the front edge, in the middle", () => {
    expect(JAR_W / SHELF_W).toBeGreaterThanOrEqual(0.09);
    expect(JAR_W / SHELF_W).toBeLessThanOrEqual(0.11);
    expect(JAR_X).toBe(SHELF_W / 2);
    expect(inJar(JAR_X)).toBe(true);
    expect(inJar(JAR_X - JAR_W / 2)).toBe(true);
    expect(inJar(JAR_X + JAR_W / 2)).toBe(true);
    expect(inJar(JAR_X - JAR_W / 2 - 0.01)).toBe(false);
    expect(inJar(JAR_X + JAR_W / 2 + 0.01)).toBe(false);
  });

  it("eats a coin pushed off the front in its section: no coin back, no ticket", () => {
    for (const x of [JAR_X, JAR_X - JAR_W / 2 + 1, JAR_X + JAR_W / 2 - 1]) {
      const s = bare();
      s.coins = 0;
      coinAt(s, x, SHELF_D - 2, 0, 200);
      const ev = run(s, 10);
      expect(ev).toContainEqual(expect.objectContaining({ type: "fall", edge: "front", kind: "coin", jar: true, stack: 1 }));
      expect(ev.some((e) => e.type === "tickets")).toBe(false);
      expect(s.coins).toBe(0);
      expect(s.lifetimeTickets).toBe(0);
      expect(s.returned).toBe(0);
      expect(s.eaten).toBe(1);
      expect(s.bodies).toHaveLength(0);
    }
  });

  it("eats a whole pile, and wakes nothing (an idle machine stays idle)", () => {
    const s = bare(4);
    s.coins = 0;
    run(s, 60 * 8);
    expect(s.idle).toBe(true);
    atFront((x, y, vx, vy) => coinAt(s, x, y, vx, vy, 3));
    run(s, 10);
    expect(s.eaten).toBe(3);
    expect(s.coins).toBe(0);
    expect(s.idle).toBe(true);
  });

  it("only eats coins: a capsule or a card falling in its section counts as usual", () => {
    for (const x of [JAR_X, JAR_X - JAR_W / 2 + 2, JAR_X + JAR_W / 2 - 2]) {
      const core = bare();
      atFront((cx, y, vx, vy) => capsuleAt(core, cx, y, vx, vy), x);
      const ce = run(core, 10);
      const fell = ce.find((e) => e.type === "fall");
      expect(fell?.type === "fall" && inJar(fell.x) && fell.kind === "core" && fell.edge === "front" && !fell.jar).toBe(true);
      expect(ce).toContainEqual({ type: "coreIn", count: 1 });
      expect(core.cores).toBe(1);
      expect(core.eaten).toBe(0);
      const card = bare();
      atFront((cx, y, vx, vy) => cardAt(card, 7, cx, y, vx, vy), x);
      const ke = run(card, 10);
      const cf = ke.find((e) => e.type === "fall");
      expect(cf?.type === "fall" && inJar(cf.x) && cf.kind === "card" && cf.edge === "front" && !cf.jar).toBe(true);
      expect(ke).toContainEqual({ type: "card", card: 7, fresh: true, count: 1 });
      expect(card.cards[7]).toBe(1);
      expect(card.eaten).toBe(0);
    }
  });

  it("leaves everything else off the front as before: the coin comes back with its ticket", () => {
    for (const x of [COIN_R + 2, JAR_X - JAR_W / 2 - COIN_R, JAR_X + JAR_W / 2 + COIN_R, SHELF_W - COIN_R - 2]) {
      const s = bare();
      s.coins = 0;
      coinAt(s, x, SHELF_D - 2, 0, 200, 2);
      const ev = run(s, 10);
      expect(ev).toContainEqual(expect.objectContaining({ type: "fall", edge: "front", jar: false, stack: 2 }));
      expect(s.coins).toBe(2);
      expect(s.lifetimeTickets).toBe(2);
      expect(s.eaten).toBe(0);
    }
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
    expect(s.superPending).toBe(0);
  });

  /** Push `n` capsules off the front, one after another. */
  function pushCores(s: State, n: number) {
    const ev: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      atFront((x, y, vx, vy) => capsuleAt(s, x, y, vx, vy), OFF_JAR);
      ev.push(...run(s, 10));
    }
    return ev;
  }

  it("the sixth core earns a Super spin: pending, nothing paid, the reels left to the Mini spins", () => {
    const s = bare();
    s.cores = CORE_COUNT - 1;
    s.queue = ["mini"];
    const ev = pushCores(s, 1);
    expect(ev).toContainEqual({ type: "coreIn", count: CORE_COUNT });
    expect(s.superPending).toBe(1);
    expect(s.cores).toBe(CORE_COUNT);
    // The Super spin never touches the reels: only the Mini spin runs there
    expect(ev.some((e) => e.type === "spinStart" && e.kind === "super")).toBe(false);
    const later = run(s, steps(SPIN_TIME + SPIN_HOLD + 3));
    expect(later.filter((e) => e.type === "spinWin").map((e) => e.type === "spinWin" && e.kind)).toEqual(["mini"]);
    // Still waiting for the shell's wheel, however long the machine runs
    expect(s.superPending).toBe(1);
    expect(s.supers).toBe(0);
    expect(s.cores).toBe(CORE_COUNT);
  });

  it("spinSuper pays one of the Super prizes exactly once, at once, then the meter resets", () => {
    const s = bare();
    s.cores = CORE_COUNT - 1;
    pushCores(s, 1);
    const before = s.lifetimeTickets;
    const ev = spinSuper(s);
    // The events the reels used to send, in the same order (jackpot.ts and the stats read them)
    expect(ev.map((e) => e.type)).toEqual(["spinStart", "spinWin", "tickets", "superReset"]);
    const start = ev[0];
    const win = ev[1];
    if (start.type !== "spinStart" || win.type !== "spinWin") throw new Error("events");
    expect(start.kind).toBe("super");
    expect(win.kind).toBe("super");
    expect(win.idx).toBe(start.idx);
    expect(win.prize).toEqual({ kind: "tickets", value: SUPER_PRIZES[start.idx] });
    expect(ev[2]).toEqual({ type: "tickets", amount: win.prize.value, source: "super" });
    // Paid now: on the lifetime count and waiting for the shell
    expect(s.lifetimeTickets - before).toBe(win.prize.value);
    expect(s.unpaid).toBe(s.lifetimeTickets);
    expect(s.supers).toBe(1);
    expect(s.cores).toBe(0);
    expect(s.superPending).toBe(0);
    // Once: nothing waiting, nothing paid, nothing changed
    const snap = JSON.stringify(s);
    expect(spinSuper(s)).toEqual([]);
    expect(JSON.stringify(s)).toBe(snap);
    // And the machine never pays it again on its own
    const later = run(s, steps(10));
    expect(later.some((e) => e.type === "spinWin" || e.type === "superReset")).toBe(false);
    expect(s.supers).toBe(1);
  });

  it("twelve cores earn two Super spins; each spin spends six", () => {
    const s = bare();
    const ev = pushCores(s, 2 * CORE_COUNT);
    expect(ev.filter((e) => e.type === "coreIn").map((e) => e.type === "coreIn" && e.count)).toEqual(
      Array.from({ length: 2 * CORE_COUNT }, (_, i) => i + 1),
    );
    expect(s.cores).toBe(2 * CORE_COUNT);
    expect(s.superPending).toBe(2);
    spinSuper(s);
    expect(s.cores).toBe(CORE_COUNT);
    expect(s.superPending).toBe(1);
    spinSuper(s);
    expect(s.cores).toBe(0);
    expect(s.superPending).toBe(0);
    expect(s.supers).toBe(2);
  });

  it("a core that arrives while the Super spin waits carries over to the next meter", () => {
    const s = bare();
    s.cores = CORE_COUNT - 1;
    pushCores(s, 2);
    expect(s.cores).toBe(CORE_COUNT + 1);
    expect(s.superPending).toBe(1);
    spinSuper(s);
    expect(s.cores).toBe(1);
    expect(s.superPending).toBe(0);
    expect(s.supers).toBe(1);
  });

  it("a meter the cores already cover earns its Super spin as the last one is spun", () => {
    // As a 1.3.x save can leave it: twelve cores but one Super spin owed
    const s = bare();
    s.cores = 2 * CORE_COUNT + 1;
    s.superPending = 1;
    spinSuper(s);
    expect(s.cores).toBe(CORE_COUNT + 1);
    expect(s.superPending).toBe(1);
    spinSuper(s);
    expect(s.superPending).toBe(0);
    expect(s.supers).toBe(2);
  });

  it("the prize is a seeded weighted pick: the same machine spins the same, and every prize comes up as often as its weight", () => {
    const a = bare(7);
    a.cores = CORE_COUNT;
    a.superPending = 1;
    const b = JSON.parse(JSON.stringify(a)) as State;
    expect(spinSuper(a)).toEqual(spinSuper(b));
    const counts = SUPER_PRIZES.map(() => 0);
    const s = bare(9);
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      s.cores = CORE_COUNT;
      s.superPending = 1;
      const start = spinSuper(s)[0];
      if (start.type === "spinStart") counts[start.idx]++;
    }
    const total = SUPER_WEIGHTS.reduce((x, y) => x + y, 0);
    SUPER_WEIGHTS.forEach((w, i) => {
      const p = w / total;
      expect(Math.abs(counts[i] / N - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / N) + 1e-9);
    });
  });

  it("the Super wheel shows every prize, never the same one side by side", () => {
    expect(SUPER_SLOTS).toHaveLength(18);
    for (let i = 0; i < SUPER_PRIZES.length; i++) expect(SUPER_SLOTS.filter((p) => p === i).length).toBeGreaterThanOrEqual(2);
    for (const p of SUPER_SLOTS) expect(p >= 0 && p < SUPER_PRIZES.length).toBe(true);
    for (let i = 0; i < SUPER_SLOTS.length; i++) expect(SUPER_SLOTS[(i + 1) % SUPER_SLOTS.length]).not.toBe(SUPER_SLOTS[i]);
  });
});

describe("cards: the inventory and the exchange", () => {
  it("a card flung at a side wall stays on the shelf", () => {
    const s = bare();
    atSide((x, y, vx, vy) => cardAt(s, 4, x, y, vx, vy));
    const ev = run(s, 30);
    expect(ev.some((e) => e.type === "fall" && e.edge === "side")).toBe(false);
    expect(s.bodies.some((b) => b.kind === "card" && b.card === 4)).toBe(true);
  });

  it("a card pushed off the front joins the inventory and pays nothing by itself", () => {
    const s = bare();
    atFront((x, y, vx, vy) => cardAt(s, 3, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "card", card: 3, fresh: true, count: 1 });
    expect(s.lifetimeTickets).toBe(0);
    expect(ev.some((e) => e.type === "tickets")).toBe(false);
    expect(s.cards[3]).toBe(1);
    expect(s.seen[3]).toBe(true);
    expect(s.cardsWon).toBe(1);
  });

  it("duplicates stack: British Shorthair x5", () => {
    const s = bare();
    const british = CARD_IDS.indexOf("british");
    for (let i = 0; i < 5; i++) {
      atFront((x, y, vx, vy) => cardAt(s, british, x, y, vx, vy));
      const ev = run(s, 10);
      expect(ev).toContainEqual({ type: "card", card: british, fresh: i === 0, count: i + 1 });
    }
    expect(s.cards[british]).toBe(5);
    expect(s.lifetimeTickets).toBe(0);
  });

  it("a full set pays nothing and resets nothing by itself: the player chooses when to exchange", () => {
    const s = bare();
    for (let c = 0; c < CARD_COUNT; c++) {
      atFront((x, y, vx, vy) => cardAt(s, c, x, y, vx, vy));
      run(s, 10);
    }
    expect(s.cards).toEqual(Array(CARD_COUNT).fill(1));
    expect(hasSet(s)).toBe(true);
    expect(s.lifetimeTickets).toBe(0);
    expect(s.sets).toBe(0);
  });

  it("pays the requested rates: 60 a common card, 300 the Ragdoll, 1000 a full set", () => {
    expect(CARD_TICKETS).toBe(60);
    expect(RARE_TICKETS).toBe(300);
    expect(SET_TICKETS).toBe(1000);
  });

  it("exchanges one card for tickets only, at the card's rate (the Ragdoll's is higher)", () => {
    const s = bare();
    s.coins = 0;
    const rare = CARD_IDS.indexOf(RARE_CARD);
    s.cards[0] = 2;
    s.cards[rare] = 1;
    expect(exchangeCard(s, 0)).toBe(CARD_TICKETS);
    expect(s.lifetimeTickets).toBe(CARD_TICKETS);
    expect(drainTickets(s)).toBe(CARD_TICKETS);
    expect(exchangeCard(s, 0)).toBe(CARD_TICKETS);
    expect(s.cards[0]).toBe(0);
    expect(exchangeCard(s, rare)).toBe(RARE_TICKETS);
    expect(s.lifetimeTickets).toBe(2 * CARD_TICKETS + RARE_TICKETS);
    // Never a coin
    expect(s.coins).toBe(0);
    // Nothing left of either, or no such cat: refused, nothing changes
    expect(exchangeCard(s, 0)).toBe(0);
    expect(exchangeCard(s, rare)).toBe(0);
    expect(exchangeCard(s, 99)).toBe(0);
    expect(exchangeCard(s, -1)).toBe(0);
    expect(exchangeCard(s, 1.5)).toBe(0);
    expect(s.lifetimeTickets).toBe(2 * CARD_TICKETS + RARE_TICKETS);
  });

  it("exchanges a full set, one of each cat, for the bigger bonus in tickets; refused without one", () => {
    const s = bare();
    s.coins = 0;
    s.cards = [2, 1, 1, 1, 1, 1, 1, 1, 1, 3];
    expect(exchangeSet(s)).toBe(SET_TICKETS);
    expect(s.cards).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
    expect(s.sets).toBe(1);
    expect(s.lifetimeTickets).toBe(SET_TICKETS);
    expect(exchangeSet(s)).toBe(0);
    expect(s.sets).toBe(1);
    expect(s.coins).toBe(0);
    // A set is worth more than its ten cards one by one
    const singles = CARD_IDS.reduce((a, id) => a + (id === RARE_CARD ? RARE_TICKETS : CARD_TICKETS), 0);
    expect(SET_TICKETS).toBeGreaterThan(singles);
  });

  it("has no coin exchange left: the exchanges take no reward choice and the old coin rates are gone", async () => {
    expect(exchangeCard.length).toBe(2);
    expect(exchangeSet.length).toBe(1);
    const config = await import("./config");
    for (const old of ["CARD_COINS", "RARE_COINS", "SET_COINS"]) expect(old in config).toBe(false);
  });

  it("a cat exchanged down to none stays seen", () => {
    const s = bare();
    atFront((x, y, vx, vy) => cardAt(s, 6, x, y, vx, vy));
    run(s, 10);
    exchangeCard(s, 6);
    expect(s.cards[6]).toBe(0);
    expect(s.seen[6]).toBe(true);
  });

  it("an exchange never wakes an idle machine: cards bring tickets, not coins", () => {
    const s = bare(4);
    s.coins = 0;
    run(s, 60 * 8);
    expect(s.idle).toBe(true);
    s.cards[2] = 1;
    s.seen[2] = true;
    expect(exchangeCard(s, 2)).toBe(CARD_TICKETS);
    expect(s.idle).toBe(true);
    expect(s.coins).toBe(0);
  });
});

describe("Prize Counter card packs", () => {
  it("a card goes straight into the inventory, seen, and counts as bought (not won off the shelf)", () => {
    const s = bare(5);
    const before = JSON.stringify(s.bodies);
    const card = grantCard(s);
    expect(card).toBeGreaterThanOrEqual(0);
    expect(card).toBeLessThan(CARD_COUNT);
    expect(s.cards[card]).toBe(1);
    expect(s.seen[card]).toBe(true);
    expect(s.packCards).toBe(1);
    expect(s.cardsWon).toBe(0);
    expect(s.lifetimeTickets).toBe(0);
    expect(JSON.stringify(s.bodies)).toBe(before);
  });

  it("is seeded: the same machine rolls the same cards", () => {
    const a = bareCopy(17);
    const b = bareCopy(17);
    const ra = Array.from({ length: 30 }, () => grantCard(a));
    const rb = Array.from({ length: 30 }, () => grantCard(b));
    expect(ra).toEqual(rb);
    expect(new Set(ra).size).toBeGreaterThan(4);
  });

  it("rolls cats by CARD_WEIGHTS: the Ragdoll a quarter as often as each other cat, over many seeds", () => {
    const total = CARD_WEIGHTS.reduce((a, b) => a + b, 0);
    const counts = new Array(CARD_COUNT).fill(0);
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const s = bareCopy(seed);
      for (let i = 0; i < 60; i++) {
        counts[grantCard(s)]++;
        n++;
      }
      expect(s.packCards).toBe(60);
    }
    CARD_IDS.forEach((_, i) => {
      const p = CARD_WEIGHTS[i] / total;
      expect(Math.abs(counts[i] / n - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / n));
    });
    const rare = CARD_IDS.indexOf(RARE_CARD);
    expect(counts[rare] / n).toBeGreaterThan(0.02);
    expect(counts[rare] / n).toBeLessThan(0.034);
  }, 30_000);
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
    play(s, true);
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
    atFront((x, y, vx, vy) => coinAt(s, x, y, vx, vy), OFF_JAR);
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
    atFront((x, y, vx, vy) => coinAt(s, x, y, vx, vy, 3), OFF_JAR);
    run(s, 10);
    expect(s.unpaid).toBe(3);
    atFront((x, y, vx, vy) => coinAt(s, x, y, vx, vy), OFF_JAR);
    run(s, 10);
    expect(drainTickets(s)).toBe(4);
    expect(s.lifetimeTickets).toBe(4);
    expect(s.unpaid).toBe(0);
  });
});

/** Held SHOOT from a machine until it idles; the numbers RE_NOTES.md reports. */
function heldSession(seed: number, coins: number, capMinutes = 15) {
  const s = createMachine(seed, coins);
  const sources = new Set<string>();
  let prizes = 0;
  let coinPrizes = 0;
  let n = 0;
  while (!s.idle && n < 60 * 60 * capMinutes) {
    for (const e of play(s, true)) {
      if (e.type === "tickets") sources.add(e.source);
      if (e.type === "prizeWin") {
        prizes++;
        if (e.segment.kind === "coins") coinPrizes++;
      }
    }
    drainTickets(s);
    n++;
  }
  const minutes = (n * DT) / 60;
  return { s, shots: s.shots, minutes, tickets: s.lifetimeTickets, perMinute: s.lifetimeTickets / minutes, prizes, coinPrizes, sources };
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Coins the player still has: on the balance, on the shelf and in the air (the jar's are the machine's). */
const coinsHeld = (s: State) =>
  s.coins + s.bodies.reduce((a, b) => a + (b.kind === "coin" ? b.stack : 0), 0) + s.flights.filter((f) => f.kind === "coin").length;

type Aim = "random" | "held" | "ideal";
/** Whether to fire this step: random taps (about one a second), the button held, or only on the ready cue. */
function fire(aim: Aim, s: State, r: () => number) {
  if (aim === "held") return true;
  if (aim === "random") return r() < 0.017;
  return s.cooldown <= DT && readyToShoot(s);
}

/**
 * The drain at steady state: a machine with coins to spare plays 200 shots to
 * settle, then `shots` more; the drain is the coins gone (balance, shelf and air
 * together) per shot. Coins only leave through the jar, so this is about the
 * jar's share of the front edge, whatever the aim.
 */
function steadyDrain(aim: Aim, seed: number, shots: number) {
  const s = createMachine(seed, 1_000_000);
  const r = mulberry32(seed + 1);
  while (s.shots < 200) play(s, fire(aim, s, r));
  const held0 = coinsHeld(s);
  const shots0 = s.shots;
  const eaten0 = s.eaten;
  while (s.shots < shots0 + shots) play(s, fire(aim, s, r));
  drainTickets(s);
  return { drain: (held0 - coinsHeld(s)) / (s.shots - shots0), jar: (s.eaten - eaten0) / (s.shots - shots0) };
}

/** The daily coins on a machine already played: the welcome held to idle, then `coins` more in style `play`. */
function dailySession(seed: number, coins: number, style: "held" | "taps") {
  const s = createMachine(seed, WELCOME_COINS);
  playToIdle(s);
  grantCoins(s, coins);
  const r = mulberry32(seed * 5 + 3);
  const t0 = s.t;
  const shots0 = s.shots;
  let n = 0;
  // A casual tapper: about two taps a second, no aim
  while (!s.idle && n < 60 * 60 * 30) {
    play(s, style === "held" || r() < 2 / 60);
    drainTickets(s);
    n++;
  }
  return { idle: s.idle, minutes: (s.t - t0) / 60, shots: s.shots - shots0 };
}

// The economy simulations play dozens of simulated minutes each, so they are opt-in:
// XVT_SIMS=1 bunx vitest run src/xu-vu-tru (run them whenever the tuning changes).
// The quick rules above cover idling, resuming and the jar on every run.
const SIMS = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.XVT_SIMS);

describe.skipIf(!SIMS)("continuous play", () => {
  it(
    "a 100-coin start with the button held lasts several minutes, nothing swallowed, tickets at a steady pace",
    () => {
      // Eight seeds, each played until the machine idles (15-minute cap). RE_NOTES.md
      // "Simulated sessions" has the 24-seed numbers.
      const runs = [11, 22, 33, 44, 55, 66, 77, 88].map((seed) => heldSession(seed, TRIAL_COINS));
      for (const r of runs) {
        expect(r.s.idle).toBe(true);
        for (const src of ["wheel", "front"]) expect(r.sources).toContain(src);
        // The jar kept coins on every run
        expect(r.s.eaten).toBeGreaterThan(0);
      }
      expect(mean(runs.map((r) => r.minutes))).toBeGreaterThanOrEqual(TRIAL_MIN_LO);
      expect(mean(runs.map((r) => r.minutes))).toBeLessThanOrEqual(TRIAL_MIN_HI);
      expect(mean(runs.map((r) => r.shots))).toBeGreaterThanOrEqual(TRIAL_LO);
      expect(mean(runs.map((r) => r.shots))).toBeLessThanOrEqual(TRIAL_HI);
      // Tickets a minute from the machine alone (cards are exchanged on the side)
      expect(mean(runs.map((r) => r.perMinute))).toBeGreaterThan(500);
      expect(mean(runs.map((r) => r.perMinute))).toBeLessThan(850);
      // Coins on 35–45% of prize spins in the tables; measured over the lot
      const share = runs.reduce((a, r) => a + r.coinPrizes, 0) / runs.reduce((a, r) => a + r.prizes, 0);
      expect(share).toBeGreaterThan(0.3);
      expect(share).toBeLessThan(0.47);
    },
    120_000,
  );

  it(
    "the jar is the drain: about a tenth of a coin a shot whatever the aim, and perfect aim never drains faster than random",
    () => {
      const SHOTS = 1500;
      const seeds = [13, 26, 39];
      const by = (aim: Aim) => {
        const rows = seeds.map((seed) => steadyDrain(aim, seed, SHOTS));
        return { drain: mean(rows.map((x) => x.drain)), jar: mean(rows.map((x) => x.jar)) };
      };
      const random = by("random");
      const held = by("held");
      const ideal = by("ideal");
      for (const d of [random, held, ideal]) {
        // Every style loses about JAR_W / SHELF_W of a coin a shot, and the jar takes it
        expect(d.drain).toBeGreaterThan(0.05);
        expect(d.drain).toBeLessThan(0.14);
        expect(d.jar).toBeGreaterThan(0.07);
        expect(d.jar).toBeLessThan(0.13);
      }
      // Roughly equal across aim styles (1.4.0: 0.131 / 0.095 / 0.080, a 0.050 spread; 1.3.x measured
      // 0.043. The Super spin no longer holds up the Mini spins on the reels, which moves careful aim's
      // Mini coins a little earlier and shifts the seeded runs)
      const all = [random.drain, held.drain, ideal.drain];
      expect(Math.max(...all) - Math.min(...all)).toBeLessThan(0.06);
      // A hit pays about a coin back plus tickets, so aim never costs coins
      expect(ideal.drain).toBeLessThanOrEqual(random.drain);
    },
    180_000,
  );

  it(
    "even perfect aim runs dry in the end: the jar keeps its share of every shot",
    () => {
      // Fires only on the ready cue (which already knows when the lid will be
      // shut): every coin is a prize spin. Prize spins pay about a coin back, so
      // this is the longest a coin lasts, and it still ends.
      const s = createMachine(22, 50);
      let n = 0;
      while (!s.idle && n < 60 * 60 * 90) {
        update(s, { shoot: s.cooldown <= DT && readyToShoot(s) }, DT);
        drainTickets(s);
        n++;
      }
      expect(s.idle).toBe(true);
      expect(s.gateHits).toBe(s.gateShots);
      expect(s.eaten).toBeGreaterThan(0);
    },
    180_000,
  );

  it(
    `the ${DAILY_COINS} daily coins on a played machine: about 3–5 minutes held, longer tapping`,
    () => {
      const seeds = [3, 14, 25, 36, 47, 58, 69, 80];
      const held = seeds.map((seed) => dailySession(seed, DAILY_COINS, "held"));
      const taps = seeds.map((seed) => dailySession(seed, DAILY_COINS, "taps"));
      for (const r of [...held, ...taps]) expect(r.idle).toBe(true);
      const heldMin = mean(held.map((r) => r.minutes));
      const tapMin = mean(taps.map((r) => r.minutes));
      expect(heldMin).toBeGreaterThanOrEqual(DAILY_HELD_LO);
      expect(heldMin).toBeLessThanOrEqual(DAILY_HELD_HI);
      expect(tapMin).toBeGreaterThanOrEqual(DAILY_TAP_LO);
      expect(tapMin).toBeLessThanOrEqual(DAILY_TAP_HI);
      expect(tapMin).toBeGreaterThan(heldMin);
      // About ten shots a coin: the jar's tenth
      expect(mean(held.map((r) => r.shots)) / DAILY_COINS).toBeGreaterThan(6);
      expect(mean(held.map((r) => r.shots)) / DAILY_COINS).toBeLessThan(16);
    },
    240_000,
  );

  it(
    `a day on one machine: idle, then the ${DAILY_COINS}-coin daily plays on from the same shelf`,
    () => {
      const s = createMachine(5, WELCOME_COINS);
      playToIdle(s);
      expect(s.idle).toBe(true);
      const day1 = { shots: s.shots, tickets: s.lifetimeTickets, cards: [...s.cards], cores: s.cores };
      grantCoins(s, DAILY_COINS);
      playToIdle(s);
      expect(s.idle).toBe(true);
      // The daily's coins and what the shelf gave back were shot; nothing was reset
      expect(s.shots - day1.shots).toBeGreaterThanOrEqual(DAILY_COINS);
      expect(s.lifetimeTickets).toBeGreaterThan(day1.tickets);
      for (let i = 0; i < CARD_COUNT; i++) expect(s.cards[i]).toBeGreaterThanOrEqual(day1.cards[i]);
    },
    60_000,
  );
});

describe("endless play", () => {
  it("has no end state: out of coins it idles for an hour of game time, whole, and plays on when coins come", () => {
    const s = createRun(31, 0);
    let events = 0;
    run(s, 60 * 10);
    expect(s.idle).toBe(true);
    const shelf = JSON.stringify(s.bodies);
    for (let i = 0; i < 60 * 60 * 60; i++) {
      // Now and then the player presses SHOOT with nothing to shoot
      for (const e of update(s, { shoot: i % 600 === 0 }, DT)) {
        events++;
        expect(e.type).toBe("dry");
      }
    }
    expect(events).toBeGreaterThan(0);
    expect(s.idle).toBe(true);
    expect(busy(s)).toBe(false);
    // Nothing on the machine says "over": only the idle flag
    expect(Object.keys(s).filter((k) => /over|ended|done|finish/i.test(k))).toEqual([]);
    // The shelf is untouched while it rests
    expect(JSON.stringify(s.bodies)).toBe(shelf);
    expect(grantCoins(s, 3)).toBe(3);
    expect(update(s, { shoot: true }, DT).some((e) => e.type === "shoot")).toBe(true);
  }, 60_000);
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
