import { describe, expect, it } from "vitest";
import { RACE_COUNTDOWN, RACE_SECONDS, RACE_TICK_RATE } from "./config";
import { type RaceSnap, applyDuckSnap, createRace, createRun, laneAt, raceStandings, stepRace, ticketsFor } from "./logic";
import { quaDuongOnline as game } from "./online";

const move = { x: 0, y: 0 };
const hop = (dir: string) => ({ move, actions: [{ type: "hop", dir }] });
const TICKS_TO_GO = Math.ceil(RACE_COUNTDOWN * RACE_TICK_RATE) + 1;

describe("Qua Đường online race", () => {
  it("accepts only hops and skins, never a client score or position", () => {
    for (const a of [null, 1, "hop", {}, { type: "hop" }, { type: "hop", dir: "north" }, { type: "score", score: 999 }, { type: "teleport", row: 500 }]) {
      expect(game.parseInput({ move, actions: [a] })).toBeNull();
    }
    expect(game.parseInput(hop("up"))).toEqual({ dir: "up", skin: null });
    expect(game.parseInput({ move: { x: 9, y: 9 }, actions: [{ type: "hop", dir: "left", row: 99 }] })).toEqual({ dir: "left", skin: null });
    expect(game.parseInput({ move, actions: [{ type: "skin", id: "vit-vang" }] })).toEqual({ dir: null, skin: "vit-vang" });
    expect(game.parseInput({ move, actions: [{ type: "skin", id: "golden-unicorn" }] })).toBeNull();
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(4);
    expect(game.mode).toBe("versus");
  });

  it("downgrades a paid skin the signed ticket does not own to the free duck", () => {
    const raw = { move, actions: [{ type: "skin", id: "vit-kinh-ram" }] };
    expect(game.parseInput(raw)).toEqual({ dir: null, skin: "vit-vang" });
    expect(game.parseInput(raw, { cosmetics: ["vit-ao-mua"] })).toEqual({ dir: null, skin: "vit-vang" });
    expect(game.parseInput(raw, { cosmetics: ["vit-kinh-ram"] })).toEqual({ dir: null, skin: "vit-kinh-ram" });
  });

  it("shares one world: every racer gets the same lanes from the seed", () => {
    const sim = game.create(42, [{ name: "An" }, { name: "Bình" }, { name: "Chi" }], {});
    const snap = sim.snapshot() as RaceSnap;
    expect(snap.seed).toBe(42);
    expect(snap.racers.map((r) => r.name)).toEqual(["An", "Bình", "Chi"]);
    expect(snap.phase).toBe("countdown");
    // Snapshots carry no lanes: a client rebuilds them from the seed
    expect(JSON.stringify(snap)).not.toContain("movers");
  });

  it("ignores hops in the countdown, then moves only the duck that hopped", () => {
    const sim = game.create(7, [{ name: "An" }, { name: "Bình" }], {});
    sim.step([{ dir: "up", skin: null }, null]);
    expect((sim.snapshot() as RaceSnap).racers[0].duck.row).toBe(0);
    for (let i = 0; i < TICKS_TO_GO; i++) sim.step([null, null]);
    const events = sim.drainEvents() as { type: string }[];
    expect(events.some((e) => e.type === "go")).toBe(true);
    sim.step([{ dir: "up", skin: null }, null]);
    for (let i = 0; i < 10; i++) sim.step([null, null]);
    const s = sim.snapshot() as RaceSnap;
    expect(s.phase).toBe("play");
    expect(s.racers[0].duck.row).toBe(1);
    expect(s.racers[1].duck.row).toBe(0);
    // The clocks stay together
    expect(s.racers[0].duck.time).toBeCloseTo(s.racers[1].duck.time, 9);
  });

  it("keeps the skin chosen in the countdown in snapshots", () => {
    const sim = game.create(3, [{ name: "An" }, { name: "Bình" }], {});
    sim.step([{ dir: null, skin: "vit-shipper" }, null]);
    expect((sim.snapshot() as RaceSnap).racers.map((r) => r.skin)).toEqual(["vit-shipper", "vit-vang"]);
  });

  it("ends when everyone is out, with per-seat results and the furthest duck winning", () => {
    const sim = game.create(11, [{ name: "An" }, { name: "Bình" }], {});
    for (let i = 0; i < TICKS_TO_GO; i++) sim.step([null, null]);
    // An hops forward a couple of times; Bình never moves. The officer catches both.
    sim.step([{ dir: "up", skin: null }, null]);
    for (let i = 0; i < 6; i++) sim.step([null, null]);
    sim.step([{ dir: "up", skin: null }, null]);
    let ticks = 0;
    while (!sim.over && ticks < RACE_TICK_RATE * (RACE_SECONDS + 5)) {
      sim.step([null, null]);
      ticks++;
    }
    expect(sim.over).toBe(true);
    const r = sim.results();
    expect(r.map((x) => x.seat)).toEqual([0, 1]);
    expect(r[0].score).toBeGreaterThan(r[1].score);
    expect(r[0].outcome).toBe("win");
    expect(r[1].outcome).toBe("loss");
    expect(r[0].detail).toContain("#1/2");
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });

  it("stops at the time limit while a racer is still out there, and still ranks by rows", () => {
    const race = createRace(5, ["An", "Bình"]);
    const dt = 1 / RACE_TICK_RATE;
    let timeUp = false;
    let ticks = 0;
    while (race.phase !== "over" && ticks < RACE_TICK_RATE * (RACE_SECONDS + 10)) {
      // An keeps the ward officer patient (as if hopping); Bình is caught early
      race.racers[0].duck.stall = 0;
      if (stepRace(race, [null, null], dt).some((e) => e.type === "time-up")) timeUp = true;
      ticks++;
    }
    expect(timeUp).toBe(true);
    expect(race.elapsed).toBeCloseTo(RACE_SECONDS, 3);
    expect(race.racers[0].duck.phase).toBe("play");
    expect(race.racers[1].duck.phase).toBe("over");
    // Same rows and coins: the one still running at the end ranks first
    expect(raceStandings(race)).toEqual([0, 1]);
  });

  it("a tie at the top is a draw for both", () => {
    const sim = game.create(9, [{ name: "An" }, { name: "Bình" }], {});
    while (!sim.over) sim.step([null, null]);
    expect(sim.results().map((r) => r.outcome)).toEqual(["draw", "draw"]);
  });

  it("drains events once and keeps snapshots independent of the sim", () => {
    const sim = game.create(4, [{ name: "An" }, { name: "Bình" }], {});
    const before = sim.snapshot() as RaceSnap;
    for (let i = 0; i < TICKS_TO_GO + 5; i++) sim.step([null, null]);
    expect(before.racers[0].duck.time).toBe(0);
    expect(sim.drainEvents().length).toBeGreaterThan(0);
    expect(sim.drainEvents()).toEqual([]);
    sim.setAutopilot(1, true);
    sim.step([null, null]);
  });

  it("lets a client rebuild a racer's duck and the coins it took from a snapshot", () => {
    const sim = game.create(21, [{ name: "An" }, { name: "Bình" }], {});
    for (let i = 0; i < TICKS_TO_GO; i++) sim.step([null, null]);
    const snap = sim.snapshot() as RaceSnap;
    const local = createRun(snap.seed);
    const coinRow = local.lanes.find((l) => l.coin !== null)?.row;
    applyDuckSnap(local, snap.racers[0].duck, coinRow === undefined ? [] : [coinRow]);
    expect(local.phase).toBe("play");
    expect(local.time).toBeCloseTo(snap.racers[0].duck.time, 9);
    if (coinRow !== undefined) expect(laneAt(local, coinRow)?.coin).toBeNull();
  });
});

describe("Qua Đường ticket payout", () => {
  it("pays rows plus coins, as whole tickets, within one deposit's cap", () => {
    expect(ticketsFor(0, 0)).toBe(0);
    expect(ticketsFor(40, 3)).toBe(55);
    expect(ticketsFor(10.7, 1.2)).toBe(15);
    expect(ticketsFor(-5, -1)).toBe(0);
    expect(ticketsFor(100000, 0)).toBe(5000);
  });
});
