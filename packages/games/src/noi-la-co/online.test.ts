import { describe, expect, it } from "vitest";
import { SEATS, STORM_END, TICK_RATE, WORD_MAX } from "./config";
import type { Snapshot } from "./logic";
import { noiLaCoOnline as game } from "./online";

const move = { x: 0, y: 0 };

describe("Nói Là Có online", () => {
  it("is a 2–8 player versus game at 20 Hz", () => {
    expect([game.slug, game.mode, game.minPlayers, game.maxPlayers, game.tickRate]).toEqual(["noi-la-co", "versus", 2, SEATS, TICK_RATE]);
  });

  it("takes only a stick, a jump, a dash and a typed word, never a position, a heart or a word id", () => {
    for (const a of [null, 1, "dash", {}, { type: "hurt", seat: 1 }, { type: "teleport", x: 3 }, { type: "word" }, { type: "word", text: 7 }, { type: "word", text: "   " }, { type: "spawn", word: "rong" }]) {
      expect(game.parseInput({ move, actions: [a] })).toBeNull();
    }
    expect(game.parseInput({ move: { x: 9, y: -9 }, actions: [] })).toEqual({ mx: 1, my: -1, dash: false, jump: false, word: null });
    expect(game.parseInput({ move: { x: Number.NaN, y: "up" as unknown as number }, actions: [{ type: "dash" }] })).toEqual({ mx: 0, my: 0, dash: true, jump: false, word: null });
    expect(game.parseInput({ move, actions: [{ type: "jump", z: 99 }] })).toEqual({ mx: 0, my: 0, dash: false, jump: true, word: null });
    expect(game.parseInput({ move, actions: [{ type: "word", text: "  Sóng thần ", hearts: 99 }] })).toEqual({ mx: 0, my: 0, dash: false, jump: false, word: "Sóng thần" });
    // Only the first word of a tick counts, and only the first four actions are read
    expect(game.parseInput({ move, actions: [{ type: "word", text: "lũ" }, { type: "word", text: "bom" }] })?.word).toBe("lũ");
    expect(game.parseInput({ move, actions: [{}, {}, {}, {}, { type: "dash" }] })).toBeNull();
  });

  it("drops a word longer than the limit instead of cutting it", () => {
    expect(game.parseInput({ move, actions: [{ type: "word", text: "a".repeat(WORD_MAX) }] })?.word).toHaveLength(WORD_MAX);
    expect(game.parseInput({ move, actions: [{ type: "word", text: "a".repeat(WORD_MAX + 1) }] })).toBeNull();
  });

  it("seats the humans, fills the eight with bots, and sends snapshots without tile heights", () => {
    const sim = game.create(42, [{ name: "An" }, { name: "Bình" }, { name: "Chi" }], {});
    const snap = JSON.parse(JSON.stringify(sim.snapshot())) as Snapshot & { h?: unknown };
    expect(snap.players.map((p) => p.name).slice(0, 3)).toEqual(["An", "Bình", "Chi"]);
    expect(snap.players.filter((p) => p.bot)).toHaveLength(SEATS - 3);
    expect(snap.phase).toBe("countdown");
    expect(snap.h).toBeUndefined();
    expect(JSON.stringify(snap).length).toBeLessThan(7000);
  });

  it("moves only the seat that pushed its stick", () => {
    const sim = game.create(7, [{ name: "An" }, { name: "Bình" }], {});
    const before = (sim.snapshot() as Snapshot).players.map((p) => ({ x: p.x, y: p.y }));
    for (let i = 0; i < 10; i++) sim.step([{ mx: 1, my: 0, dash: false, jump: false, word: null }, null]);
    const after = (sim.snapshot() as Snapshot).players;
    expect(after[0].x).toBeGreaterThan(before[0].x + 1);
    expect(after[1].x).toBeCloseTo(before[1].x, 9);
  });

  it("plays a dropped seat with the bot brain until the player is back", () => {
    const sim = game.create(5, [{ name: "An" }, { name: "Bình" }], {});
    sim.setAutopilot(1, true);
    expect((sim.snapshot() as Snapshot).players[1].auto).toBe(true);
    sim.setAutopilot(1, false);
    expect((sim.snapshot() as Snapshot).players[1].auto).toBe(false);
    // A bot seat is not anyone's to hand back
    sim.setAutopilot(5, true);
    expect((sim.snapshot() as Snapshot).players[5].auto).toBe(false);
  });

  it("runs a whole match to an end with a result and an outcome per human seat", () => {
    const sim = game.create(11, [{ name: "An" }, { name: "Bình" }], {});
    const seen = new Set<string>();
    let ticks = 0;
    while (!sim.over && ticks < TICK_RATE * (STORM_END + 40)) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    for (const type of ["go", "writer", "word", "hurt", "out", "end"]) expect(seen.has(type), type).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    for (const r of results) {
      expect(["win", "loss", "draw"]).toContain(r.outcome);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.detail.length).toBeLessThanOrEqual(40);
    }
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });
});
