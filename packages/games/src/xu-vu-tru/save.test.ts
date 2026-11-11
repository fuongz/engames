import { describe, expect, it } from "vitest";
import { CARD_COUNT, COIN_R, MAX_BODIES, MAX_STACK, SHELF_D, SHELF_W, TRIAL_COINS, VERSION } from "./config";
import { type State, createMachine, drainTickets, grantCoins, update } from "./logic";
import { SAVE_MAX_BYTES, SCHEMA, fromSave, migrate, pack, parseSave, plausible, rules, toSave } from "./save";

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
  s.queue = ["super", "mini", "mini", "mini"];
  s.stock = 4;
  s.album = s.album.map((_, i) => i % 2 === 0);
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
    expect(back.album).toEqual(s.album);
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

  it("walks schema 1 (the plain State) up to the current one", () => {
    const s = midPlay(21);
    const v1 = JSON.parse(JSON.stringify({ v: "1.0.0", schema: 1, state: s }));
    const m = migrate(v1);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.save.schema).toBe(SCHEMA);
    expect(m.save.v).toBe("1.0.0");
    expect(m.save.state).toEqual(pack(s));
    const back = fromSave(m.save);
    expect(back.coins).toBe(s.coins);
    expect(back.lifetimeTickets).toBe(s.lifetimeTickets);
    expect(back.bodies.length).toBe(s.bodies.length);
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
      (x: { state: Record<string, unknown> }) => (x.state.album = 5000),
      (x: { state: Record<string, unknown> }) => (x.state.queue = ["mega"]),
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
