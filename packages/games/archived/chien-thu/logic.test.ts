import { describe, expect, it } from "vitest";
import { CENTER, PATH_LENGTH, SLOT_R, TRACK_INNER } from "./config";
import { SLOTS, buildWave, createGame, critterAt, dropCritter, enemyPos, summon, update, type GameState } from "./logic";

const distFromCenter = (i: number) => Math.hypot(SLOTS[i].x - CENTER.x, SLOTS[i].y - CENTER.y);

describe("layout", () => {
  it("has 19 slots, all inside the grass field", () => {
    expect(SLOTS).toHaveLength(19);
    for (const s of SLOTS) expect(distFromCenter(s.index) + SLOT_R).toBeLessThan(TRACK_INNER);
  });

  it("starts enemies at the gate and ends them at the kid, both on the left", () => {
    const start = enemyPos({ dist: 0 });
    const end = enemyPos({ dist: PATH_LENGTH });
    expect(start.x).toBeLessThan(CENTER.x - 200);
    expect(end.x).toBeLessThan(CENTER.x - 200);
    expect(start.y).toBeGreaterThan(CENTER.y); // gate below
    expect(end.y).toBeLessThan(CENTER.y); // kid above
  });
});

describe("merging", () => {
  it("merges two same-level critters into one higher level", () => {
    const g = createGame(1);
    expect(dropCritter(g, g.critters[0].id, 2)).toBe("merge");
    expect(g.critters).toHaveLength(1);
    expect(critterAt(g, 2)?.level).toBe(2);
  });

  it("emits an evolve event when a merge reaches a new species", () => {
    const g = createGame(1);
    g.critters[0].level = 2;
    g.critters[1].level = 2;
    dropCritter(g, g.critters[0].id, 2);
    expect(g.events.some((e) => e.type === "evolve" && e.level === 3)).toBe(true);
  });

  it("moves into empty slots and swaps different levels", () => {
    const g = createGame(1);
    const [a, b] = g.critters;
    expect(dropCritter(g, a.id, 9)).toBe("move");
    b.level = 2;
    expect(dropCritter(g, a.id, b.slot)).toBe("swap");
    expect(a.slot).toBe(2);
    expect(b.slot).toBe(9);
  });
});

describe("economy", () => {
  it("spends eggs to summon and refuses when broke", () => {
    const g = createGame(1);
    let n = 0;
    while (summon(g)) n++;
    expect(n).toBe(3); // 3 starting eggs at cost 1
    expect(g.eggs).toBe(0);
  });

  it("every wave contains exactly one wild egg", () => {
    for (let w = 1; w <= 12; w++) expect(buildWave(w, () => 0.5).filter((k) => k === "egg")).toHaveLength(1);
  });
});

/** Greedy player: hatch whenever possible, merge pairs, keep big critters on the rim. */
function bot(g: GameState) {
  while (summon(g));
  const byLevel = new Map<number, number[]>();
  for (const c of g.critters) byLevel.set(c.level, [...(byLevel.get(c.level) ?? []), c.id]);
  for (const ids of byLevel.values()) {
    const target = ids.length >= 2 && g.critters.find((c) => c.id === ids[1]);
    if (target) {
      dropCritter(g, ids[0], target.slot);
      return;
    }
  }
  const rim = [...SLOTS].sort((a, b) => distFromCenter(b.index) - distFromCenter(a.index)).map((s) => s.index);
  const sorted = [...g.critters].sort((a, b) => b.level - a.level);
  sorted.forEach((c, i) => {
    if (c.slot !== rim[i]) dropCritter(g, c.id, rim[i]);
  });
}

function play(seed: number, active: boolean) {
  const g = createGame(seed);
  for (let t = 0; t < 30 * 60 * 15 && !g.over; t++) {
    if (active && t % 30 === 0) bot(g);
    update(g, 1 / 30);
    g.events.length = 0;
  }
  return g.wave;
}

describe("balance", () => {
  it("an idle player loses early, an active one goes much further", () => {
    const idle = play(7, false);
    const active = [1, 2, 3].map((s) => play(s, true));
    expect(idle).toBeLessThanOrEqual(4);
    for (const w of active) expect(w).toBeGreaterThanOrEqual(idle + 3);
  });
});
