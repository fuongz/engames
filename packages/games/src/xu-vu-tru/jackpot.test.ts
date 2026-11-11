import type { GameJackpot, JackpotRoll } from "@web-games/core";
import { describe, expect, it } from "vitest";
import { CARD_R, COIN_R, CORE_COUNT, CORE_R, JAR_W, JAR_X, SHELF_D, SPIN_TIME, SUPER_SPIN_TIME, VERSION } from "./config";
import { createJarFeed, jarCoins, supersPaid } from "./jackpot";
import { type GameEvent, SPIN_HOLD, type State, createMachine, inJar, update } from "./logic";
import type { Body } from "./physics";
import { SCHEMA, fromSave, migrate, toSave } from "./save";

// The machine's side of the Lucky Jar (jackpot.ts): what feeds it, what rolls
// it, and that a guest does neither. The portal's batching and the server's
// draw are tested in apps/web (jackpot.test.ts); here ctx.jackpot is a fake
// that records what the game asked for.

const DT = 1 / 60;
const steps = (seconds: number) => Math.ceil(seconds / DT) + 2;

function run(s: State, n: number, shoot = false) {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...update(s, { shoot }, DT));
  return ev;
}

/** A machine with an empty shelf: only what a test puts there. */
function bare(seed = 1): State {
  const s = createMachine(seed, 0);
  s.bodies = [];
  s.flights = [];
  return s;
}

const put = (s: State, b: Omit<Body, "id">) => s.bodies.push({ id: s.nextId++, ...b });
/** Something about to be pushed off the front edge at x (the jar's section by default). */
const coinOff = (s: State, x = JAR_X, stack = 1) => put(s, { kind: "coin", core: -1, card: -1, stack, x, y: SHELF_D - 2, vx: 0, vy: 200, r: COIN_R });
const coreOff = (s: State, x = JAR_X) => put(s, { kind: "core", core: 1, card: -1, stack: 1, x, y: SHELF_D - 2, vx: 0, vy: 200, r: CORE_R });
const cardOff = (s: State, x = JAR_X) => put(s, { kind: "card", core: -1, card: 3, stack: 1, x, y: SHELF_D - 2, vx: 0, vy: 200, r: CARD_R });

/** A fake ctx.jackpot: records contributions and rolls, answers rolls with `answer` (or rejects with `fail`). */
function fakeJar(answer: JackpotRoll = { won: false, pool: 12_345 }, fail?: Error) {
  const contributed: number[] = [];
  let rolls = 0;
  let listener: ((s: { pool: number; cap: number }) => void) | null = null;
  const pending: (() => void)[] = [];
  const jackpot: GameJackpot = {
    contribute: (n) => contributed.push(n),
    roll: () => {
      rolls++;
      return new Promise<JackpotRoll>((resolve, reject) => pending.push(() => (fail ? reject(fail) : resolve(answer))));
    },
    state: async () => ({ pool: 12_000, cap: 50_000, recent: [] }),
    onState: (cb) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
  };
  return {
    jackpot,
    contributed,
    rolls: () => rolls,
    /** Answer the oldest roll still out, and let its callbacks run. */
    async answer() {
      pending.shift()?.();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
    push: (pool: number, cap = 50_000) => listener?.({ pool, cap }),
    listening: () => listener !== null,
  };
}

/** Run a machine with a jar feed on it, feeding every step's events, as game.ts does. */
function playFed(s: State, n: number, feed: { feed(evs: GameEvent[]): unknown }, shoot = false) {
  const all: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    const evs = update(s, { shoot }, DT);
    feed.feed(evs);
    all.push(...evs);
  }
  return all;
}

describe("eaten coins (logic)", () => {
  it("the jar's coins come out as one `eaten` event per pile, the pile's size", () => {
    const s = bare();
    coinOff(s, JAR_X, 3);
    coinOff(s, JAR_X + JAR_W / 2 - 1, 1);
    const ev = run(s, 12);
    const eaten = ev.filter((e) => e.type === "eaten");
    expect(eaten.length).toBeGreaterThanOrEqual(1);
    expect(jarCoins(ev)).toBe(s.eaten);
    expect(s.eaten).toBeGreaterThanOrEqual(3);
    // Every `eaten` comes with its coin fall into the jar
    const falls = ev.filter((e) => e.type === "fall" && e.jar);
    expect(falls.reduce((n, e) => n + (e.type === "fall" ? e.stack : 0), 0)).toBe(jarCoins(ev));
  });

  it("never for capsules or cards, even in the jar's section, nor for coins off the rest of the edge", () => {
    for (const x of [JAR_X, JAR_X - JAR_W / 2 + 2, JAR_X + JAR_W / 2 - 2]) {
      const core = bare();
      coreOff(core, x);
      expect(jarCoins(run(core, 12))).toBe(0);
      expect(core.cores).toBe(1);
      const card = bare();
      cardOff(card, x);
      expect(jarCoins(run(card, 12))).toBe(0);
      expect(card.cards[3]).toBe(1);
    }
    const s = bare();
    coinOff(s, 60, 2);
    const ev = run(s, 12);
    expect(ev.some((e) => e.type === "fall" && e.edge === "front" && !inJar(e.x))).toBe(true);
    expect(jarCoins(ev)).toBe(0);
    expect(s.coins).toBe(2);
  });

  it("over a long session, the eaten events add up to exactly what the jar kept", () => {
    for (const seed of [3, 11]) {
      const s = createMachine(seed, 400);
      let fed = 0;
      for (let i = 0; i < steps(90); i++) {
        const ev = update(s, { shoot: true }, DT);
        fed += jarCoins(ev);
        for (const e of ev) if (e.type === "fall" && e.jar) expect(e.kind).toBe("coin");
      }
      expect(s.eaten).toBeGreaterThan(0);
      expect(fed).toBe(s.eaten);
    }
  });
});

describe("the jar feed: contributions", () => {
  it("signed in, every eaten event becomes one contribute(coins) call", () => {
    const f = fakeJar();
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => true });
    const s = bare();
    coinOff(s, JAR_X, 2);
    playFed(s, 12, feed);
    expect(f.contributed).toEqual([2]);
    coinOff(s, JAR_X, 1);
    playFed(s, 12, feed);
    expect(f.contributed).toEqual([2, 1]);
    expect(f.contributed.reduce((a, b) => a + b, 0)).toBe(s.eaten);
  });

  it("feeds nothing for capsules, cards or coins that come back", () => {
    const f = fakeJar();
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => true });
    const s = bare();
    coreOff(s, JAR_X);
    playFed(s, 12, feed);
    cardOff(s, JAR_X - 10);
    playFed(s, 12, feed);
    coinOff(s, 60, 3);
    playFed(s, 12, feed);
    expect(f.contributed).toEqual([]);
    expect(f.rolls()).toBe(0);
  });

  it("matches the jar over a real session", () => {
    const f = fakeJar();
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => true });
    const s = createMachine(5, 300);
    playFed(s, steps(80), feed, true);
    expect(s.eaten).toBeGreaterThan(0);
    expect(f.contributed.every((n) => Number.isSafeInteger(n) && n > 0)).toBe(true);
    expect(f.contributed.reduce((a, b) => a + b, 0)).toBe(s.eaten);
  });
});

describe("the jar feed: rolls", () => {
  /** A machine whose sixth core is about to be pushed off the front (a Super spin follows). */
  function superReady() {
    const s = bare();
    s.cores = CORE_COUNT - 1;
    coreOff(s, 60);
    return s;
  }

  it("a Super spin that pays asks for exactly one roll, when it pays", async () => {
    const f = fakeJar({ won: true, amount: 23_410, pool: 5000 });
    const got: JackpotRoll[] = [];
    let started = 0;
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => true, onRollStart: () => started++, onRoll: (r) => got.push(r) });
    const s = superReady();
    const before = playFed(s, 12, feed);
    expect(before.some((e) => e.type === "spinStart" && e.kind === "super")).toBe(true);
    // Running, not paid yet: no roll
    expect(f.rolls()).toBe(0);
    const ev = playFed(s, steps(SUPER_SPIN_TIME + SPIN_HOLD), feed);
    expect(supersPaid(ev)).toBe(1);
    expect(f.rolls()).toBe(1);
    expect(started).toBe(1);
    expect(feed.rolling).toBe(true);
    // Long after: still the one
    playFed(s, steps(5), feed);
    expect(f.rolls()).toBe(1);
    await f.answer();
    expect(got).toEqual([{ won: true, amount: 23_410, pool: 5000 }]);
    expect(feed.rolling).toBe(false);
    expect(feed.pool).toBe(5000);
  });

  it("Mini spins never roll", () => {
    const f = fakeJar();
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => true });
    const s = bare();
    s.queue = ["mini", "mini"];
    const ev = playFed(s, steps(2 * (SPIN_TIME + SPIN_HOLD) + 1), feed);
    expect(ev.filter((e) => e.type === "spinWin")).toHaveLength(2);
    expect(f.rolls()).toBe(0);
  });

  it("two Super spins in a row roll twice, one after the other", async () => {
    const f = fakeJar();
    const got: JackpotRoll[] = [];
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => true, onRoll: (r) => got.push(r) });
    const s = bare();
    s.queue = ["super", "super"];
    playFed(s, steps(2 * (SUPER_SPIN_TIME + SPIN_HOLD) + 1), feed);
    expect(s.supers).toBe(2);
    // The second waits for the first's answer
    expect(f.rolls()).toBe(1);
    await f.answer();
    expect(f.rolls()).toBe(2);
    await f.answer();
    expect(got).toHaveLength(2);
    expect(feed.rolling).toBe(false);
  });

  it("a failed roll is silent: no answer, no throw, the feed carries on", async () => {
    const f = fakeJar(undefined, new Error("sign-in-required"));
    let failed = 0;
    const got: JackpotRoll[] = [];
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => true, onRoll: (r) => got.push(r), onRollFailed: () => failed++ });
    const s = bare();
    s.queue = ["super"];
    playFed(s, steps(SUPER_SPIN_TIME + 0.5), feed);
    expect(f.rolls()).toBe(1);
    await f.answer();
    expect(failed).toBe(1);
    expect(got).toEqual([]);
    expect(feed.rolling).toBe(false);
  });

  it("a roll that throws at once is caught too", async () => {
    let failed = 0;
    const jackpot: GameJackpot = {
      contribute: () => {},
      roll: () => {
        throw new Error("boom");
      },
      state: () => Promise.reject(new Error("offline")),
      onState: () => () => {},
    };
    const feed = createJarFeed({ jackpot, signedIn: () => true, onRollFailed: () => failed++ });
    expect(() => feed.feed([{ type: "spinWin", kind: "super", idx: 0, prize: { kind: "tickets", value: 80 } }])).not.toThrow();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(failed).toBe(1);
    expect(feed.pool).toBeNull();
  });
});

describe("the jar feed: guests", () => {
  it("a guest never contributes or rolls, but still sees the pool", async () => {
    const f = fakeJar();
    const pools: number[] = [];
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => false, onPool: (p) => pools.push(p) });
    await Promise.resolve();
    await Promise.resolve();
    expect(feed.pool).toBe(12_000);
    expect(feed.cap).toBe(50_000);
    f.push(12_345);
    expect(feed.pool).toBe(12_345);
    expect(pools).toEqual([12_000, 12_345]);
    // Coins into the jar, a full session, and a Super spin: nothing asked
    const s = bare();
    coinOff(s, JAR_X, 3);
    playFed(s, 12, feed);
    s.queue = ["super"];
    const ev = playFed(s, steps(SUPER_SPIN_TIME + SPIN_HOLD), feed);
    expect(s.eaten).toBe(3);
    expect(supersPaid(ev)).toBe(1);
    const t = createMachine(9, 200);
    playFed(t, steps(40), feed, true);
    expect(t.eaten).toBeGreaterThan(0);
    expect(f.contributed).toEqual([]);
    expect(f.rolls()).toBe(0);
    expect(feed.feed(ev)).toEqual({ coins: 0, rolls: 0 });
  });

  it("signing out mid-game stops both at once", () => {
    const f = fakeJar();
    let signedIn = true;
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => signedIn });
    const s = bare();
    coinOff(s, JAR_X, 1);
    playFed(s, 12, feed);
    expect(f.contributed).toEqual([1]);
    signedIn = false;
    coinOff(s, JAR_X, 2);
    s.queue = ["super"];
    playFed(s, steps(SUPER_SPIN_TIME + SPIN_HOLD), feed);
    expect(f.contributed).toEqual([1]);
    expect(f.rolls()).toBe(0);
  });

  it("without ctx.jackpot (outside the portal, online) it does nothing at all", () => {
    const feed = createJarFeed({ jackpot: undefined, signedIn: () => true });
    const s = bare();
    coinOff(s, JAR_X, 2);
    s.queue = ["super"];
    const ev = playFed(s, steps(SUPER_SPIN_TIME + SPIN_HOLD), feed);
    expect(supersPaid(ev)).toBe(1);
    expect(feed.feed(ev)).toEqual({ coins: 0, rolls: 0 });
    expect(feed.pool).toBeNull();
    expect(feed.rolling).toBe(false);
  });

  it("stops following the pool once disposed", () => {
    const f = fakeJar();
    const feed = createJarFeed({ jackpot: f.jackpot, signedIn: () => false });
    expect(f.listening()).toBe(true);
    feed.dispose();
    expect(f.listening()).toBe(false);
  });
});

describe("saves in 1.3.0", () => {
  it("the Lucky Jar changes nothing saved: schema 4 as in 1.2.0, a 1.2.0 save loads as it was", () => {
    expect(VERSION).toBe("1.3.0");
    expect(SCHEMA).toBe(4);
    const s = createMachine(4, 120);
    run(s, steps(20), true);
    const old = { ...toSave(s), v: "1.2.0" };
    const m = migrate(JSON.parse(JSON.stringify(old)));
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(toSave(fromSave(m.save)).state).toEqual(toSave(s).state);
    expect(toSave(s).v).toBe("1.3.0");
  });
});
