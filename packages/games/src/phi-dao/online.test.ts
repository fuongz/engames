import { describe, expect, it } from "vitest";
import { phiDaoOnline as game } from "./online";
import type { Run } from "./logic";
const move = { x: 0, y: 0 };
describe("Knife Bloom online", () => {
  it("accepts only throw actions and cannot accept client score or state", () => {
    for (const a of [
      null,
      1,
      "throw",
      {},
      { type: "score", score: 999999 },
      { type: "hit" },
    ]) {
      expect(game.parseInput({ move, actions: [a] })).toBeNull();
    }
    expect(game.parseInput({ move, actions: [{ type: "throw" }] })).toEqual({
      skin: "classic",
    });
    expect(
      game.parseInput(
        { move, actions: [{ type: "throw", skin: "dragon" }] },
        { cosmetics: ["dragon"] },
      ),
    ).toEqual({ skin: "dragon" });
    expect(
      game.parseInput({
        move,
        actions: [{ type: "throw", skin: "unowned-super-knife" }],
      }),
    ).toBeNull();
    expect(
      game.parseInput({
        move,
        actions: [{ type: "throw", skin: { score: 999 } }],
      }),
    ).toBeNull();
    expect(game.maxPlayers).toBe(2);
  });
  it("keeps the selected skin and impact location in snapshots and confirmed events", () => {
    const sim = game.create(4, [{ name: "An" }], {});
    sim.step([{ skin: "dragon" }]);
    expect((sim.snapshot() as Run).flights[0]?.skin).toBe("dragon");
    sim.step([null]);
    const state = sim.snapshot() as Run;
    expect(state.knives[0]?.skin).toBe("dragon");
    expect(sim.drainEvents()).toEqual([
      { type: "throw", seat: 0, skin: "dragon", stage: 1 },
      {
        type: "hit",
        seat: 0,
        skin: "dragon",
        angle: state.knives[0]?.angle,
        stage: 1,
      },
    ]);
  });
  it("shares server score, finishes, and returns results for both humans", () => {
    const sim = game.create(4, [{ name: "An" }, { name: "Bình" }], {});
    for (let i = 0; i < 6000 && !sim.over; i++) sim.step([true, i % 5 === 0]);
    expect(sim.over).toBe(true);
    const r = sim.results();
    expect(r.map((x) => x.seat)).toEqual([0, 1]);
    expect(r[0].score).toBe(r[1].score);
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({
      phase: "over",
    });
    expect(sim.drainEvents().length).toBeGreaterThan(0);
    expect(sim.drainEvents()).toEqual([]);
  });
  it("snapshots are complete and independent; disconnect does not invent throws", () => {
    const sim = game.create(4, [{ name: "An" }, { name: "Bình" }], {});
    const old = sim.snapshot() as Run;
    sim.setAutopilot(1, true);
    for (let i = 0; i < 60; i++) sim.step([null, null]);
    expect(old.elapsed).toBe(0);
    expect((sim.snapshot() as Run).hits).toEqual([0, 0]);
    sim.setAutopilot(1, false);
    for (let i = 0; i < 10; i++) sim.step([null, i === 0]);
    expect((sim.snapshot() as Run).hits).toEqual([0, 1]);
  });
});

describe("paid knife entitlement", () => {
  it("keeps the shot but downgrades a forged paid skin to the free default", () => {
    const raw = { move, actions: [{ type: "throw", skin: "dragon" }] };
    expect(game.parseInput(raw)).toEqual({ skin: "classic" });
    expect(game.parseInput(raw, { cosmetics: [] })).toEqual({
      skin: "classic",
    });
    expect(game.parseInput(raw, { cosmetics: ["dragon"] })).toEqual({
      skin: "dragon",
    });
  });
});
