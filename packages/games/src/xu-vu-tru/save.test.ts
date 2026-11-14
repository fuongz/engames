import { describe, expect, it } from "vitest";
import { CARD_COUNT, COIN_R, CORE_COUNT, LAND_X, MAX_BODIES, MAX_STACK, PRIZE_QUEUE_MAX, SHELF_D, SHELF_W, SUPER_PRIZES, TRIAL_COINS, VERSION, WHEEL } from "./config";
import { type State, createMachine, drainTickets, exchangeCard, exchangeSet, grantCard, grantCoins, spinSuper, update } from "./logic";
import {
  type PackedV2,
  type PackedV3,
  type PackedV4,
  SAVE_MAX_BYTES,
  SCHEMA,
  fromSave,
  migrate,
  pack,
  parseSave,
  plausible,
  rules,
  toSave,
  toV3,
  toV4,
  toV5,
} from "./save";

const DT = 1 / 60;

function play(s: State, seconds: number, shoot = true) {
  for (let i = 0; i < seconds * 60; i++) {
    update(s, { shoot }, DT);
    drainTickets(s);
  }
  return s;
}

/** A machine mid-play: things on the shelf, in the air, on the wheel and the reels. */
function midPlay(seed = 3) {
  return play(createMachine(seed, 200), 40);
}

/** As crowded as a shelf gets: MAX_BODIES piles, capsules and cards, coins in the air, every spin queued. */
function fullShelf(): State {
  const s = midPlay(8);
  s.bodies = [];
  let id = s.nextId;
  for (let i = 0; i < MAX_BODIES + 20; i++) {
    const kind = i % 25 === 0 ? "core" : i % 31 === 0 ? "card" : "coin";
    s.bodies.push({
      id: id++,
      kind,
      core: kind === "core" ? i % 6 : -1,
      card: kind === "card" ? i % CARD_COUNT : -1,
      stack: kind === "coin" ? 1 + (i % MAX_STACK) : 1,
      // Long, ugly floats, the way the physics leaves them
      x: COIN_R + ((i * 37.123456789) % (SHELF_W - 2 * COIN_R)),
      y: 40 + ((i * 53.987654321) % (SHELF_D - 60)),
      vx: Math.sin(i) * 123.456789,
      vy: Math.cos(i) * 98.7654321,
      r: COIN_R,
    });
  }
  s.flights = Array.from({ length: 40 }, (_, i) => ({
    id: id++,
    t: -i * 0.06 + 0.0123456,
    phase: i % 2 ? ("up" as const) : ("down" as const),
    x: 20 + i * 9.87654,
    aim: (i % 7) - 3.3333,
    kind: "coin" as const,
    core: -1,
    card: -1,
  }));
  s.nextId = id;
  s.queue = ["mini", "mini", "mini", "mini"];
  s.cores = 2 * CORE_COUNT + 3;
  s.superPending = 2;
  s.stock = 4;
  s.cards = s.cards.map((_, i) => (i % 2 === 0 ? 999 : 0));
  s.seen = s.cards.map((n) => n > 0);
  s.lifetimeTickets = 987_654;
  s.shots = 400_000;
  s.gateShots = 399_000;
  s.gateHits = 100_000;
  return s;
}

describe("the save envelope", () => {
  it("carries the version, the schema and the machine, without unpaid tickets", () => {
    const s = midPlay();
    s.unpaid = 12;
    const save = toSave(s);
    expect(save.v).toBe(VERSION);
    expect(save.schema).toBe(SCHEMA);
    expect("unpaid" in save.state).toBe(false);
    expect(fromSave(save).unpaid).toBe(0);
  });

  it("round-trips a machine mid-play (floats rounded), and a second trip changes nothing", () => {
    const s = midPlay();
    const save = toSave(s);
    const back = fromSave(JSON.parse(JSON.stringify(save)));
    expect(back.coins).toBe(s.coins);
    expect(back.lifetimeTickets).toBe(s.lifetimeTickets);
    expect(back.cards).toEqual(s.cards);
    expect(back.seen).toEqual(s.seen);
    expect(back.queue).toEqual(s.queue);
    expect(back.bodies).toHaveLength(s.bodies.length);
    back.bodies.forEach((b, i) => {
      const o = s.bodies[i];
      expect({ ...b, x: 0, y: 0, vx: 0, vy: 0 }).toEqual({ ...o, x: 0, y: 0, vx: 0, vy: 0 });
      for (const k of ["x", "y", "vx", "vy"] as const) expect(Math.abs(b[k] - o[k])).toBeLessThanOrEqual(0.005);
    });
    expect(toSave(back)).toEqual(save);
  });

  it("resumes: a loaded machine plays on and idles like any other", () => {
    const s = fromSave(toSave(midPlay(12)));
    let n = 0;
    while (!s.idle && n < 60 * 60 * 15) {
      update(s, { shoot: true }, DT);
      n++;
    }
    expect(s.idle).toBe(true);
    expect(grantCoins(s, 5)).toBe(5);
    expect(s.idle).toBe(false);
  }, 30_000);

  it(`a full shelf stays far under the server's ${SAVE_MAX_BYTES / 1024} KB limit`, () => {
    const s = fullShelf();
    const json = JSON.stringify(toSave(s));
    expect(json.length).toBeLessThan(SAVE_MAX_BYTES / 4);
    // And the server accepts it as is
    expect(rules.parse(JSON.parse(json))).not.toBeNull();
  });

  it(`a guest's trial machine starts with ${TRIAL_COINS} coins and saves like any other`, () => {
    const trial = createMachine(4, TRIAL_COINS);
    const save = parseSave(JSON.parse(JSON.stringify(toSave(trial))));
    expect(save).not.toBeNull();
    expect(save && fromSave(save).coins).toBe(100);
  });
});

describe("migrate", () => {
  it("names what it can't use, and never throws", () => {
    expect(migrate(null)).toEqual({ ok: false, reason: "empty" });
    expect(migrate(undefined)).toEqual({ ok: false, reason: "empty" });
    for (const junk of [42, "save", [], true]) expect(migrate(junk)).toEqual({ ok: false, reason: "broken" });
    expect(migrate({ hello: 1 })).toEqual({ ok: false, reason: "broken" });
    expect(migrate({ v: "1.0.0", schema: 0, state: {} })).toEqual({ ok: false, reason: "broken" });
    expect(migrate({ v: "1.0.0", schema: SCHEMA, state: null })).toEqual({ ok: false, reason: "broken" });
    expect(migrate({ v: "1.0.0", schema: 1, state: "garbage" })).toEqual({ ok: false, reason: "broken" });
    expect(migrate({ v: "1.0.0", schema: 1, state: { bodies: [{}] } })).toEqual({ ok: false, reason: "broken" });
    expect(migrate({ v: "9.0.0", schema: SCHEMA + 1, state: {} })).toEqual({ ok: false, reason: "future" });
  });

  it("calls a pre-1.0 beta run legacy (a bare State stamped with RULES_VERSION)", () => {
    // What the beta wrote under the "run" key: the State itself, with v: 3 and tickets
    const { lifetimeTickets: _l, unpaid: _u, idle: _i, ...rest } = midPlay();
    const beta = { ...rest, v: 3, tickets: 412, over: false };
    expect(migrate(JSON.parse(JSON.stringify(beta)))).toEqual({ ok: false, reason: "legacy" });
  });

  it("walks schema 1 (the plain 1.0.0 State, album as owned flags) up to the current one", () => {
    const s = midPlay(21);
    s.prize = null;
    const owned = [true, false, false, true, false, true, false, false, false, false];
    const { cards: _c, seen: _s, ...rest } = s;
    const v1 = JSON.parse(JSON.stringify({ v: "1.0.0", schema: 1, state: { ...rest, album: owned } }));
    const m = migrate(v1);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.save.schema).toBe(SCHEMA);
    expect(m.save.v).toBe("1.0.0");
    const back = fromSave(m.save);
    expect(back.coins).toBe(s.coins);
    expect(back.lifetimeTickets).toBe(s.lifetimeTickets);
    expect(back.bodies.length).toBe(s.bodies.length);
    expect(back.cards).toEqual(owned.map((o) => (o ? 1 : 0)));
    expect(back.seen).toEqual(owned);
  });

  /** A live 1.0.0 save (schema 2): the album a bit mask, a prize running on the old 24-slot wheel, a coin on its way up. */
  function v100(seed: number, album: number, prize: { seg: number; t: number; paid: boolean } | null, stock: number) {
    const s = midPlay(seed);
    const { cards: _c, seen: _s, eaten: _e, packCards: _p, superPending: _sp, ...state } = pack(s);
    const v2: PackedV2 = { ...state, album, prize, stock };
    v2.flights = [...v2.flights, [v2.nextId, 0.2, 0, SHELF_W / 2, 27.5, 0, -1]];
    v2.nextId++;
    return { s, save: JSON.parse(JSON.stringify({ v: "1.0.0", schema: 2, state: v2 })) as { v: string; schema: number; state: PackedV2 } };
  }

  it("migrates a live 1.0.0 save to 1.1.0: coins, lifetime tickets and the shelf kept, the album as counts", () => {
    const { s, save } = v100(31, 0b1000100101, { seg: 20, t: 0.8, paid: false }, 2);
    const m = migrate(save);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.save.schema).toBe(SCHEMA);
    const back = fromSave(m.save);
    expect(back.coins).toBe(s.coins);
    expect(back.lifetimeTickets).toBe(s.lifetimeTickets);
    expect(back.shots).toBe(s.shots);
    expect(back.bodies.length).toBe(s.bodies.length);
    // Each owned cat becomes one card, and is seen; the rest none
    expect(back.cards).toEqual([1, 0, 1, 0, 0, 1, 0, 0, 0, 1]);
    expect(back.seen).toEqual([true, false, true, false, false, true, false, false, false, true]);
    // The old wheel's running spin (slot 20 does not exist now) goes back into the stock
    expect(WHEEL.length).toBeLessThanOrEqual(20);
    expect(back.prize).toBeNull();
    expect(back.stock).toBe(3);
    // The coin on its way up lands on the fixed spot
    expect(back.flights.filter((f) => f.phase === "up").every((f) => f.aim === LAND_X)).toBe(true);
    // And it plays on
    const ev = update(back, { shoot: true }, 1 / 60);
    expect(ev.some((e) => e.type === "shoot")).toBe(true);
  });

  it("a 1.0.0 spin that already paid is dropped, and a refund never overfills the stock", () => {
    const paid = migrate(v100(32, 0, { seg: 3, t: 1.9, paid: true }, 1).save);
    expect(paid.ok && fromSave(paid.save).stock).toBe(1);
    const full = migrate(v100(33, 0, { seg: 3, t: 0.2, paid: false }, PRIZE_QUEUE_MAX).save);
    expect(full.ok && fromSave(full.save).stock).toBe(PRIZE_QUEUE_MAX);
    const none = migrate(v100(34, 2 ** CARD_COUNT - 1, null, 0).save);
    expect(none.ok && fromSave(none.save).cards).toEqual(Array(CARD_COUNT).fill(1));
    // A broken 1.0.0 album is refused, never crashed on
    const bad = v100(35, 0, null, 0).save;
    (bad.state as unknown as Record<string, unknown>).album = "lots";
    expect(migrate(bad)).toEqual({ ok: false, reason: "broken" });
    expect(() => toV3({} as PackedV2)).toThrow();
  });

  /** A live 1.1.0 save (schema 3): a stash of cards, a prize spin running, coins in the air, no jar or pack counters. */
  function v110(seed: number) {
    const s = midPlay(seed);
    s.cards = [3, 0, 1, 2, 0, 1, 0, 0, 5, 1];
    s.seen = [true, true, true, true, false, true, false, false, true, true];
    s.prize = { seg: 3, t: 0.6, paid: false };
    s.stock = 2;
    const { eaten: _e, packCards: _p, superPending: _sp, ...state } = pack(s);
    const v3: PackedV3 = state;
    return { s, save: JSON.parse(JSON.stringify({ v: "1.1.0", schema: 3, state: v3 })) as { v: string; schema: number; state: PackedV3 } };
  }

  it("migrates a live 1.1.0 save to 1.2.0: everything kept, the jar and pack counters from 0", () => {
    const { s, save } = v110(41);
    expect("eaten" in save.state).toBe(false);
    const m = migrate(save);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.save.schema).toBe(SCHEMA);
    expect(m.save.v).toBe("1.1.0");
    const back = fromSave(m.save);
    expect(back.eaten).toBe(0);
    expect(back.packCards).toBe(0);
    // The machine itself is untouched: coins, tickets, the stash, the shelf, the running spin and the stock
    const { eaten: _e, packCards: _p, ...rest } = back;
    const { eaten: _e2, packCards: _p2, ...want } = fromSave(toSave(s));
    expect(rest).toEqual(want);
    expect(back.cards).toEqual([3, 0, 1, 2, 0, 1, 0, 0, 5, 1]);
    expect(back.prize).toEqual({ seg: 3, t: 0.6, paid: false });
    expect(back.stock).toBe(2);
    // Saved again it is a plain current save, and the server takes it after the old one
    const again = JSON.parse(JSON.stringify(toSave(back)));
    expect(migrate(again)).toEqual({ ok: true, save: again });
    const prev = parseSave(save);
    expect(prev && plausible(prev, again)).toBe(true);
    // Its old cards exchange for tickets only, and it plays on
    expect(exchangeCard(back, 0)).toBe(60);
    expect(back.coins).toBe(s.coins);
    expect(update(back, { shoot: true }, DT).some((e) => e.type === "shoot")).toBe(true);
  });

  it("walks a 1.0.0 save all the way up through 1.1.0", () => {
    const { save } = v100(36, 0b11, null, 1);
    const m = migrate(save);
    expect(m.ok && m.save.schema).toBe(SCHEMA);
    expect(m.ok && m.save.state.eaten).toBe(0);
    expect(m.ok && m.save.state.packCards).toBe(0);
    expect(m.ok && m.save.state.cards.slice(0, 3)).toEqual([1, 1, 0]);
  });

  it("refuses a broken 1.1.0 save, and a current one without the new counters", () => {
    const { save } = v110(42);
    (save.state as unknown as Record<string, unknown>).cards = "lots";
    expect(migrate(save)).toEqual({ ok: false, reason: "broken" });
    expect(() => toV4({} as PackedV3)).toThrow();
    const current = JSON.parse(JSON.stringify(toSave(midPlay(43))));
    delete current.state.eaten;
    expect(migrate(current)).toEqual({ ok: false, reason: "broken" });
    const noPending = JSON.parse(JSON.stringify(toSave(midPlay(43))));
    delete noPending.state.superPending;
    expect(migrate(noPending)).toEqual({ ok: false, reason: "broken" });
  });

  /** A live 1.3.x save (schema 4): no `superPending`; Super spins queued or running on the reels. */
  function v13(seed: number, over: Partial<PackedV4>) {
    const s = midPlay(seed);
    s.prize = null;
    const { superPending: _sp, ...state } = pack(s);
    const v4: PackedV4 = { ...state, ...over };
    return { s, save: JSON.parse(JSON.stringify({ v: "1.3.1", schema: 4, state: v4 })) as { v: string; schema: number; state: PackedV4 } };
  }

  it("migrates a 1.3.x save to 1.4.0: a Super spin waiting in the queue becomes pending, the Mini spins stay", () => {
    expect(SCHEMA).toBe(5);
    const { s, save } = v13(51, { cores: CORE_COUNT + 2, queue: ["super", "mini", "mini"], spin: { kind: "mini", idx: 2, t: 0.5, paid: false } });
    const m = migrate(save);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.save.schema).toBe(SCHEMA);
    expect(m.save.v).toBe("1.3.1");
    const back = fromSave(m.save);
    expect(back.superPending).toBe(1);
    expect(back.queue).toEqual(["mini", "mini"]);
    expect(back.spin).toEqual({ kind: "mini", idx: 2, t: 0.5, paid: false });
    expect(back.cores).toBe(CORE_COUNT + 2);
    // Nothing else moved
    expect(back.coins).toBe(s.coins);
    expect(back.lifetimeTickets).toBe(s.lifetimeTickets);
    expect(back.supers).toBe(s.supers);
    expect(back.bodies.length).toBe(s.bodies.length);
    // The server takes it after the old save, and the pending spin pays once
    const again = JSON.parse(JSON.stringify(toSave(back)));
    expect(migrate(again)).toEqual({ ok: true, save: again });
    const prev = parseSave(save);
    expect(prev && plausible(prev, again)).toBe(true);
    const ev = spinSuper(back);
    expect(ev.some((e) => e.type === "spinWin" && e.kind === "super")).toBe(true);
    expect(back.superPending).toBe(0);
    expect(back.cores).toBe(2);
    expect(spinSuper(back)).toEqual([]);
  });

  it("migrates a Super spin running on the 1.3.x reels: unpaid it becomes pending, paid it is gone", () => {
    const unpaid = migrate(v13(52, { cores: CORE_COUNT, queue: [], spin: { kind: "super", idx: 3, t: 1.2, paid: false } }).save);
    expect(unpaid.ok).toBe(true);
    if (!unpaid.ok) return;
    expect(unpaid.save.state.superPending).toBe(1);
    expect(unpaid.save.state.spin).toBeNull();
    // Paid already: its six cores are spent, the reels are cleared
    const paid = migrate(v13(53, { cores: 1, queue: ["mini"], spin: { kind: "super", idx: 3, t: 3.6, paid: true } }).save);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.save.state.superPending).toBe(0);
    expect(paid.save.state.spin).toBeNull();
    expect(paid.save.state.queue).toEqual(["mini"]);
    // Twelve cores and the next one not queued yet (1.3.x queued it after the first paid): both are owed
    const two = migrate(v13(54, { cores: 2 * CORE_COUNT + 1, queue: ["super"], spin: null }).save);
    expect(two.ok && two.save.state.superPending).toBe(2);
    // No Super spin anywhere: nothing pending
    const none = migrate(v13(55, { cores: 3, queue: ["mini"], spin: null }).save);
    expect(none.ok && none.save.state.superPending).toBe(0);
    expect(() => toV5({} as PackedV4)).toThrow();
  });

  it("a Super spin spun before a reload stays paid, once", () => {
    const s = midPlay(56);
    s.cores = CORE_COUNT;
    s.superPending = 1;
    const before = s.lifetimeTickets;
    const ev = spinSuper(s);
    const win = ev.find((e) => e.type === "spinWin");
    if (win?.type !== "spinWin") throw new Error("no win");
    expect(SUPER_PRIZES).toContain(win.prize.value);
    // The shell drains and saves at once; the page reloads before the wheel stops
    drainTickets(s);
    const back = fromSave(JSON.parse(JSON.stringify(toSave(s))));
    expect(back.lifetimeTickets).toBe(before + win.prize.value);
    expect(back.supers).toBe(s.supers);
    expect(back.superPending).toBe(0);
    expect(back.cores).toBe(0);
    // Nothing left to spin again
    expect(spinSuper(back)).toEqual([]);
    expect(back.lifetimeTickets).toBe(before + win.prize.value);
  });

  it("keeps the jar's and the Prize Counter's counters across a save", () => {
    const s = midPlay(44);
    s.eaten = 37;
    grantCard(s);
    grantCard(s);
    const back = fromSave(JSON.parse(JSON.stringify(toSave(s))));
    expect(back.eaten).toBe(37);
    expect(back.packCards).toBe(2);
    expect(back.cards).toEqual(s.cards);
  });

  it("leaves a current save as it is", () => {
    const save = JSON.parse(JSON.stringify(toSave(midPlay(5))));
    const m = migrate(save);
    expect(m).toEqual({ ok: true, save });
  });

  it("refuses a current save with a tampered field", () => {
    const good = () => JSON.parse(JSON.stringify(toSave(midPlay(6))));
    const bad = [
      (x: { state: Record<string, unknown> }) => (x.state.coins = -5),
      (x: { state: Record<string, unknown> }) => (x.state.coins = 1.5),
      (x: { state: Record<string, unknown> }) => (x.state.lifetimeTickets = "lots"),
      (x: { state: Record<string, unknown> }) => (x.state.stock = 99),
      (x: { state: Record<string, unknown> }) => (x.state.eaten = -1),
      (x: { state: Record<string, unknown> }) => (x.state.packCards = 0.5),
      (x: { state: Record<string, unknown> }) => (x.state.seen = 5000),
      (x: { state: Record<string, unknown> }) => (x.state.cards = [1, 2]),
      (x: { state: Record<string, unknown> }) => (x.state.cards = Array(CARD_COUNT).fill(-1)),
      // Cards of a cat never seen
      (x: { state: Record<string, unknown> }) => {
        x.state.seen = 0;
        x.state.cards = Array(CARD_COUNT).fill(1);
      },
      (x: { state: Record<string, unknown> }) => (x.state.queue = ["mega"]),
      // Super spins never sit on the reels in schema 5, and every pending one needs a full meter
      (x: { state: Record<string, unknown> }) => (x.state.queue = ["super"]),
      (x: { state: Record<string, unknown> }) => (x.state.spin = { kind: "super", idx: 0, t: 0, paid: false }),
      (x: { state: Record<string, unknown> }) => {
        x.state.cores = CORE_COUNT - 1;
        x.state.superPending = 1;
      },
      (x: { state: Record<string, unknown> }) => (x.state.superPending = -1),
      (x: { state: Record<string, unknown> }) => (x.state.superPending = 0.5),
      (x: { state: Record<string, unknown> }) => ((x.state.bodies as unknown[]).push([1, 0, 10, 10, 0, 0, 9, -1])),
      (x: { state: Record<string, unknown> }) => ((x.state.bodies as unknown[]).push([99_999_999, 1, 10, 10, 0, 0, 1, 7])),
      (x: { state: Record<string, unknown> }) => (x.state.spin = { kind: "super", idx: 40, t: 0, paid: false }),
    ];
    for (const tamper of bad) {
      const save = good();
      tamper(save);
      expect(migrate(save).ok).toBe(false);
    }
  });
});

describe("the server's rules", () => {
  const at = (s: State) => parseSave(JSON.parse(JSON.stringify(toSave(s))));

  it("scores a save by its lifetime tickets", () => {
    const s = midPlay(9);
    expect(s.lifetimeTickets).toBeGreaterThan(0);
    expect(rules.score?.(at(s))).toBe(s.lifetimeTickets);
  });

  it("accepts real play, one save after another", () => {
    const s = createMachine(10, 100);
    let prev = at(s);
    expect(prev && plausible(null, prev)).toBe(true);
    for (let i = 0; i < 4; i++) {
      play(s, 10);
      const next = at(s);
      expect(next && plausible(prev, next)).toBe(true);
      prev = next;
    }
    // Coins granted by the server (allowance, coupons) are fine
    grantCoins(s, 5000);
    const granted = at(s);
    expect(granted && plausible(prev, granted)).toBe(true);
  });

  it("accepts tickets from exchanged cards even with no shots between saves", () => {
    const s = midPlay(14);
    s.cards = Array(CARD_COUNT).fill(20);
    s.seen = s.cards.map(() => true);
    const prev = at(s);
    // Ten sets and a heap of Ragdolls in one go: well past the per-save slack
    for (let i = 0; i < 10; i++) exchangeSet(s);
    for (let i = 0; i < 10; i++) exchangeCard(s, 5);
    drainTickets(s);
    const next = at(s);
    expect(prev && next && plausible(prev, next)).toBe(true);
    // The same jump with no cards spent is refused
    if (!prev || !next) throw new Error("no save");
    const free = { ...prev, state: { ...prev.state, lifetimeTickets: next.state.lifetimeTickets } };
    expect(plausible(prev, free)).toBe(false);
  });

  it("accepts cards bought at the Prize Counter and exchanged with no shots between saves", () => {
    const s = midPlay(15);
    const prev = at(s);
    for (let i = 0; i < 25; i++) grantCard(s);
    const bought = at(s);
    expect(prev && bought && plausible(prev, bought)).toBe(true);
    for (let c = 0; c < CARD_COUNT; c++) while (s.cards[c] > 0) exchangeCard(s, c);
    drainTickets(s);
    const next = at(s);
    expect(bought && next && plausible(bought, next)).toBe(true);
  });

  it("refuses tickets going backwards, or out of thin air", () => {
    const s = midPlay(13);
    const prev = at(s);
    if (!prev) throw new Error("no save");
    const less = { ...prev, state: { ...prev.state, lifetimeTickets: prev.state.lifetimeTickets - 1 } };
    expect(plausible(prev, less)).toBe(false);
    const free = { ...prev, state: { ...prev.state, lifetimeTickets: prev.state.lifetimeTickets + 1_000_000 } };
    expect(plausible(prev, free)).toBe(false);
    const fresh = createMachine(1);
    const rich = at(fresh);
    if (!rich) throw new Error("no save");
    expect(plausible(null, { ...rich, state: { ...rich.state, lifetimeTickets: 9_000_000 } })).toBe(false);
  });
});
