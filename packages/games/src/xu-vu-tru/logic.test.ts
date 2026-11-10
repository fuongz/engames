import { describe, expect, it } from "vitest";
import {
  BETA_START_COINS,
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
  SEG_SIZE,
  SET_TICKETS,
  SHELF_D,
  SHELF_W,
  SIDE_WALL_D,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_SPIN_TIME,
  type Segment,
  WHEEL,
} from "./config";
import { type GameEvent, SPIN_HOLD, grantCoins, type State, createRun, ownedCount, segmentAt, update } from "./logic";
import { type Body, energy, stepShelf } from "./physics";

const DT = 1 / 60;
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

/** Shoot once with the wheel turned so the coin meets a slot matching `want`; returns the run just after the hit. */
const BARE = JSON.stringify(bare(2));
function shootInto(want: (seg: Segment) => boolean, seed = 2) {
  for (let a = 0; a < 1440; a++) {
    const s = JSON.parse(BARE) as State;
    s.seed = seed;
    s.wheel = (a / 1440) * Math.PI * 2;
    const ev = run(s, 1, true);
    for (let i = 0; i < steps(FLIGHT_UP) && !ev.some((e) => e.type === "hit"); i++) ev.push(...update(s, { shoot: false }, DT));
    const h = ev.find((e) => e.type === "hit");
    if (h && h.type === "hit" && want(h.segment)) return { s, ev, segment: h.segment };
  }
  throw new Error("never hit the wanted slot");
}

describe("a fresh run", () => {
  it("starts with the beta coins, a full shelf, two capsules and an empty album, at rest", () => {
    const s = createRun(42);
    expect(s.coins).toBe(BETA_START_COINS);
    expect(s.tickets).toBe(0);
    expect(s.cores).toBe(0);
    expect(s.album).toEqual(Array(CARD_COUNT).fill(false));
    expect(s.bodies.filter((b) => b.kind === "coin").reduce((a, b) => a + b.stack, 0)).toBeGreaterThan(70);
    expect(s.bodies.filter((b) => b.kind === "core")).toHaveLength(PREFILL_CORES);
    expect(s.bodies.some((b) => b.kind === "card")).toBe(false);
    // Settled: nothing falls while nobody shoots
    const ev = run(s, 60 * 6);
    expect(ev.filter((e) => e.type === "fall")).toEqual([]);
    expect(s.coins).toBe(BETA_START_COINS);
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
    expect(a.log).toContain("hit");
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

  it("has every kind of slot, every slot reachable, and narrow core and card slots", () => {
    const seen = new Set<number>();
    for (let a = 0; a < 7200; a++) seen.add(segmentAt((a / 7200) * Math.PI * 2));
    expect(seen.size).toBe(WHEEL.length);
    expect(SEG_SIZE.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.PI * 2);
    const coinValues = new Set(WHEEL.flatMap((w) => (w.kind === "coins" ? [w.value] : [])));
    expect([...coinValues].sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 8]);
    const ticket = WHEEL.findIndex((w) => w.kind === "tickets");
    for (const kind of ["core", "card"] as const) {
      const i = WHEEL.findIndex((w) => w.kind === kind);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(SEG_SIZE[i]).toBeLessThan(SEG_SIZE[ticket]);
    }
  });

  it("pays the segment facing the chute when the coin arrives", () => {
    const s = bare(11);
    run(s, 1, true);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 60 && !ev.some((e) => e.type === "hit"); i++) ev.push(...update(s, { shoot: false }, DT));
    const h = ev.find((e) => e.type === "hit");
    expect(h && h.type === "hit" && h.seg).toBe(segmentAt(s.wheel));
  });

  it("a ticket slot adds its tickets and the coin does not drop", () => {
    const { s, ev, segment } = shootInto((w) => w.kind === "tickets");
    expect(segment.kind).toBe("tickets");
    if (segment.kind !== "tickets") return;
    expect(s.tickets).toBe(segment.value);
    expect(ev).toContainEqual({ type: "tickets", amount: segment.value, source: "wheel" });
    expect(s.flights).toHaveLength(0);
    const later = run(s, steps(FLIGHT_DOWN + 0.5));
    expect(later.some((e) => e.type === "land")).toBe(false);
    expect(s.bodies).toHaveLength(0);
    expect(s.coins).toBe(BETA_START_COINS - 1);
  });

  it.each([1, 2, 4, 6, 8])("a %i-coin slot drops that many coins spread across the shelf, and no tickets", (n) => {
    const { s, ev } = shootInto((w) => w.kind === "coins" && w.value === n);
    expect(s.tickets).toBe(0);
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
    expect(s.tickets).toBe(0);
  });

  it("a core slot drops a capsule (nothing else) and starts a Mini spin, but does not fill the meter", () => {
    const { s, ev } = shootInto((w) => w.kind === "core");
    expect(s.tickets).toBe(0);
    expect(s.flights).toHaveLength(1);
    expect(s.flights[0].kind).toBe("core");
    const later = run(s, steps(FLIGHT_DOWN));
    const all = [...ev, ...later];
    expect(all.filter((e) => e.type === "land").map((e) => e.type === "land" && e.kind)).toEqual(["core"]);
    expect(s.bodies.map((b) => b.kind)).toEqual(["core"]);
    expect(s.cores).toBe(0);
    const start = all.find((e) => e.type === "spinStart");
    expect(start && start.type === "spinStart" && start.kind).toBe("mini");
    const before = { tickets: s.tickets, coins: s.coins };
    const rest = run(s, steps(SPIN_TIME + SPIN_HOLD));
    const win = rest.find((e) => e.type === "spinWin");
    expect(win?.type).toBe("spinWin");
    if (win?.type !== "spinWin") return;
    expect(MINI_PRIZES).toContainEqual(win.prize);
    if (win.prize.kind === "tickets") expect(s.tickets - before.tickets).toBe(win.prize.value);
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
    expect(s.tickets).toBe(0);
  });

  it("a card slot drops one of the ten cards and pays nothing yet", () => {
    const { s } = shootInto((w) => w.kind === "card");
    expect(s.flights).toHaveLength(1);
    const f = s.flights[0];
    expect(f.kind).toBe("card");
    expect(f.card).toBeGreaterThanOrEqual(0);
    expect(f.card).toBeLessThan(CARD_COUNT);
    const ev = run(s, steps(FLIGHT_DOWN));
    expect(ev).toContainEqual(expect.objectContaining({ type: "land", kind: "card" }));
    expect(s.bodies).toEqual([expect.objectContaining({ kind: "card", card: f.card })]);
    expect(s.tickets).toBe(0);
    expect(ownedCount(s.album)).toBe(0);
  });

  it("different seeds pick different cards", () => {
    const picked = new Set<number>();
    for (let seed = 1; seed < 40; seed++) picked.add(shootInto((w) => w.kind === "card", seed).s.flights[0].card);
    expect(picked.size).toBeGreaterThan(4);
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
    s.flights.push({ id: s.nextId++, t: 0, phase: "down", x: SHELF_W / 2, kind: "coin", core: -1, card: -1 });
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
    expect(s.tickets).toBe(0);
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
    expect(s.tickets).toBe(win.prize.value);
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
    expect(s.tickets).toBe(CARD_TICKETS);
    expect(s.album[3]).toBe(true);
    expect(s.cardsWon).toBe(1);
  });

  it("a duplicate still pays 60 and leaves the album as it was", () => {
    const s = bare();
    s.album[3] = true;
    atFront((x, y, vx, vy) => cardAt(s, 3, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "card", card: 3, fresh: false, owned: 1 });
    expect(s.tickets).toBe(CARD_TICKETS);
    expect(ownedCount(s.album)).toBe(1);
  });

  it("the tenth distinct card pays the 1000-ticket set bonus and starts the album over", () => {
    const s = bare();
    s.album = Array.from({ length: CARD_COUNT }, (_, i) => i !== 7);
    atFront((x, y, vx, vy) => cardAt(s, 7, x, y, vx, vy));
    const ev = run(s, 10);
    expect(ev).toContainEqual({ type: "card", card: 7, fresh: true, owned: CARD_COUNT });
    expect(ev.some((e) => e.type === "setComplete")).toBe(true);
    expect(s.tickets).toBe(CARD_TICKETS + SET_TICKETS);
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
    expect(s.tickets).toBe(order.length * CARD_TICKETS + SET_TICKETS);
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

  it("waits for a queued spin before ending", () => {
    const s = createRun(31, 0);
    s.queue = ["mini"];
    const ev = run(s, 60 * 15);
    expect(ev.findIndex((e) => e.type === "spinWin")).toBeLessThan(ev.findIndex((e) => e.type === "over"));
  });

  it(
    "a full 200-coin run of held-button play drains slowly and pays from every source",
    () => {
      const s = createRun(4242);
      const sources = new Set<string>();
      let n = 0;
      while (!s.over && n < 60 * 60 * 15) {
        for (const e of update(s, { shoot: true }, DT)) if (e.type === "tickets") sources.add(e.source);
        n++;
      }
      expect(s.over).toBe(true);
      // Coins drain slowly: a run lasts well past the starting stake
      expect(s.shots).toBeGreaterThan(BETA_START_COINS * 1.5);
      expect(s.shots).toBeLessThan(BETA_START_COINS * 10);
      expect(s.tickets).toBeGreaterThan(s.shots);
      expect(s.returned).toBeGreaterThan(0);
      for (const src of ["wheel", "front", "mini"]) expect(sources).toContain(src);
    },
    30_000,
  );
});

describe("grantCoins", () => {
  it("adds coins to a live run and leaves tickets alone", () => {
    const s = createRun(1);
    const coins = s.coins;
    const tickets = s.tickets;
    expect(grantCoins(s, 100)).toBe(100);
    expect(s.coins).toBe(coins + 100);
    expect(s.tickets).toBe(tickets);
  });

  it("ignores a finished run and bad amounts", () => {
    const s = createRun(1);
    expect(grantCoins(s, 0)).toBe(0);
    expect(grantCoins(s, -5)).toBe(0);
    expect(grantCoins(s, Number.NaN)).toBe(0);
    expect(grantCoins(s, 2.9)).toBe(2);
    s.over = true;
    const coins = s.coins;
    expect(grantCoins(s, 100)).toBe(0);
    expect(s.coins).toBe(coins);
  });
});
