import { describe, expect, it } from "vitest";
import { MAX_TIMEOUTS, RECONNECT_SECONDS } from "./config";
import { BLUE, RED, initialState, legalMoves, sq } from "./logic";
import { type Action, createMatch, matchScore, outcomeOf, redSeat, setAway, snapshotOf, stepMatch } from "./match";
import { coThuOnline, parseAction, redOf, turnOf } from "./online";

const tick = 1 / coThuOnline.tickRate;
const move = (from: number, to: number): Action => ({ type: "move", from, to });

describe("online adapter input", () => {
  it("accepts only a move between real squares, or a resignation", () => {
    expect(parseAction([{ type: "move", from: 1, to: 2 }])).toEqual({ type: "move", from: 1, to: 2 });
    expect(parseAction([{ type: "move", from: 1, to: 63 }])).toBeNull();
    expect(parseAction([{ type: "move", from: 1, to: 1 }])).toBeNull();
    expect(parseAction([{ type: "move", from: "1", to: 2 }])).toBeNull();
    expect(parseAction([{ type: "move", from: 1.5, to: 2 }])).toBeNull();
    expect(parseAction([{ type: "nuke" }, { type: "resign", extra: 1 }])).toEqual({ type: "resign" });
    expect(parseAction([null, 4, "x"])).toBeNull();
    expect(coThuOnline.parseInput({ move: { x: 0, y: 0 }, actions: [] })).toBeNull();
  });

  it("reads the host's settings, falling back to the defaults", () => {
    expect(redOf({ red: "guest" })).toBe("guest");
    expect(redOf({ red: "nobody" })).toBe("host");
    expect(turnOf({ turn: "0" })).toBe(0);
    expect(turnOf({ turn: "30" })).toBe(30);
    expect(turnOf({})).toBe(60);
  });
});

describe("an online match", () => {
  it("puts the host on Red by default, the guest when asked, and either on a coin toss", () => {
    expect(createMatch(1, ["An", "Bình"]).seats.map((s) => s.side)).toEqual([RED, BLUE]);
    expect(createMatch(1, ["An", "Bình"], "guest").seats.map((s) => s.side)).toEqual([BLUE, RED]);
    expect(redSeat("random", 4)).toBe(0);
    expect(redSeat("random", 5)).toBe(1);
  });

  it("plays only the mover's legal moves", () => {
    const m = createMatch(1, ["An", "Bình"]);
    const [legal] = legalMoves(initialState());
    // Blue (seat 1) can't move on Red's turn, and Red can't make an illegal move
    stepMatch(m, tick, [null, move(sq(0, 2), sq(0, 3))]);
    stepMatch(m, tick, [move(sq(6, 6), sq(6, 0)), null]);
    expect(m.game.ply).toBe(0);
    stepMatch(m, tick, [move(legal.from, legal.to), null]);
    expect(m.game.ply).toBe(1);
    expect(m.game.turn).toBe(BLUE);
    expect(m.events).toContainEqual({ type: "move", from: legal.from, to: legal.to, side: RED, auto: false });
  });

  it("ends on a resignation, from either seat, at any time", () => {
    const m = createMatch(1, ["An", "Bình"]);
    stepMatch(m, tick, [null, { type: "resign" }]);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
    expect(m.reason).toBe("resign");
    expect(outcomeOf(m, 0)).toBe("win");
    expect(outcomeOf(m, 1)).toBe("loss");
    expect(matchScore(m, 0)).toBeGreaterThan(0);
    expect(matchScore(m, 1)).toBe(0);
  });

  it("plays a move when the clock runs out, and forfeits after too many timeouts", () => {
    const m = createMatch(1, ["An", "Bình"], "host", 30);
    let autos = 0;
    for (let t = 0; t < 30 * coThuOnline.tickRate * MAX_TIMEOUTS * 2 + 10 && m.phase === "play"; t++) {
      stepMatch(m, tick, [null, null]);
      autos += m.events.filter((e) => e.type === "move" && e.auto).length;
      m.events.length = 0;
    }
    expect(autos).toBeGreaterThan(0);
    expect(m.phase).toBe("over");
    expect(m.reason).toBe("timeout");
  });

  it("waits forever with no clock, but forfeits a player who stays away", () => {
    const m = createMatch(3, ["An", "Bình"], "host", 0);
    for (let t = 0; t < 200 * coThuOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).toBe("play");
    expect(m.game.ply).toBe(0);
    setAway(m, 1, true);
    for (let t = 0; t < (RECONNECT_SECONDS - 1) * coThuOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).toBe("play");
    setAway(m, 1, false);
    setAway(m, 1, true);
    for (let t = 0; t < (RECONNECT_SECONDS + 1) * coThuOnline.tickRate; t++) stepMatch(m, tick, [null, null]);
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
    expect(m.reason).toBe("away");
  });

  it("sends a snapshot without the repetition keys", () => {
    const m = createMatch(1, ["An", "Bình"]);
    const snap = snapshotOf(m);
    expect(snap.game.keys).toEqual([]);
    expect(m.game.keys.length).toBe(1);
  });

  it("runs a whole match through the adapter, with a result per seat", () => {
    const sim = coThuOnline.create(5, [{ name: "An" }, { name: "Bình" }], { red: "host", turn: "30" });
    const seen = new Set<string>();
    let ticks = 0;
    while (!sim.over && ticks < 400_000) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    expect(seen.has("move")).toBe(true);
    expect(seen.has("over")).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    expect(results.every((r) => r.outcome !== undefined && r.detail.length > 0)).toBe(true);
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });
});
