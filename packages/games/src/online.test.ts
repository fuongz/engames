import { describe, expect, it } from "vitest";
import { kyTucXaOnline } from "./ky-tuc-xa/online";
import { findOnlineGame, onlineGames } from "./online";
import { games } from "./registry";

describe("registry", () => {
  it("lists exactly the games whose manifest declares online play", () => {
    const declared = games.filter((g) => g.online).map((g) => g.slug).sort();
    expect(Object.keys(onlineGames).sort()).toEqual(declared);
    for (const slug of declared) expect(findOnlineGame(slug)?.slug).toBe(slug);
    expect(findOnlineGame("constructor")).toBeUndefined();
  });
});

describe("Night Dorm online adapter", () => {
  const game = kyTucXaOnline;

  it("clamps moves and drops invalid actions", () => {
    expect(
      game.parseInput({
        move: { x: 9, y: -9 },
        actions: [{ type: "sleep" }, { type: "build", tile: 99, kind: "turret" }, { type: "build", tile: 1, kind: "nuke" }, { type: "repair" }],
      }),
    ).toEqual({ move: { x: 1, y: -1 }, actions: [{ type: "sleep" }, { type: "repair" }] });
    // At most four actions a tick, whatever is sent
    const flood = Array.from({ length: 9 }, () => ({ type: "repair" }));
    expect(game.parseInput({ move: { x: 0, y: 0 }, actions: flood })?.actions).toHaveLength(4);
  });

  it("runs a whole match to an end with a result per human seat", () => {
    const sim = game.create(7, [{ name: "An" }, { name: "Bình" }]);
    let ticks = 0;
    const seen = new Set<string>();
    while (!sim.over && ticks < game.tickRate * 600) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    // Nobody went to bed, so both are caught at nightfall
    expect(seen.has("caught")).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });
});
