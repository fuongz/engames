import { clamp } from "@web-games/core/math";
import { describe, expect, it } from "vitest";
import {
  BOLT,
  FISH_PER_MISSILE,
  LASER,
  MISSILE_BOSS_SHARE,
  MISSILE_FLIGHT,
  RESPAWN_DELAY,
  SHIP_START,
  SPREAD,
  STAGES_PER_ROUND,
  W,
} from "./config";
import {
  type GameEvent,
  type Input,
  type Pickup,
  type State,
  collect,
  createRun,
  isBoss,
  launch,
  scaling,
  stageInfo,
  update,
  waveDef,
} from "./logic";
import { makeEnemy } from "./waves";

const DT = 1 / 60;

const can = (family: Pickup["family"]): Pickup => ({
  kind: "can",
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  family,
  spin: 0,
});
const item = (kind: Pickup["kind"]): Pickup => ({
  kind,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  family: "spread",
  spin: 0,
});

/** Step without enemies getting in the way: clear the board each frame. */
function quiet(s: State) {
  s.enemies = [];
  s.wave.spawns = [];
  s.wave.kamiLeft = 0;
}

function run(
  s: State,
  seconds: number,
  input: (s: State) => Input = () => ({}),
) {
  const ev: GameEvent[] = [];
  for (let i = 0; i < seconds / DT && s.phase === "play"; i++)
    ev.push(...update(s, input(s), DT));
  return ev;
}

/**
 * A simple dodging bot: line up under the lowest enemy, but take the spot along
 * the bottom row with the least incoming fire over the next half second.
 */
function bot(s: State): Input {
  const { ship } = s;
  let goal = W / 2;
  let lowest = -1e9;
  for (const e of s.enemies)
    if (!e.dead && e.y > 0 && e.y < ship.y - 120 && e.y > lowest) {
      lowest = e.y;
      goal = e.x;
    }
  let best = ship.x;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let dx = -180; dx <= 180; dx += 15) {
    const x = clamp(ship.x + dx, 30, W - 30);
    // Where the ship is at time t on its way there, at a thumb's pace
    const at = (t: number) =>
      ship.x + Math.sign(x - ship.x) * Math.min(Math.abs(x - ship.x), 700 * t);
    let danger = 0;
    for (const b of s.bullets)
      for (let t = 0; t <= 0.8; t += 0.04) {
        const bx = b.x + b.vx * t;
        const by = b.y + b.vy * t;
        if (Math.hypot(bx - at(t), by - SHIP_START.y) < b.r + 20)
          danger += 1 / (t + 0.1);
      }
    for (const e of s.enemies) {
      if (e.dead) continue;
      for (let t = 0; t <= 0.6; t += 0.1) {
        const ex = e.mode === "kami" && e.p <= 0 ? e.x + e.vx * t : e.x;
        const ey =
          e.mode === "kami" && e.p <= 0
            ? e.y + e.vy * t
            : e.mode === "rock"
              ? e.y + e.vy * t
              : e.y;
        if (Math.hypot(ex - at(t), ey - SHIP_START.y) < e.r + 40)
          danger += 2 / (t + 0.1);
      }
    }
    const cost = danger * 100 + Math.abs(x - goal) * 0.05 + Math.abs(dx) * 0.02;
    if (cost < bestCost) {
      bestCost = cost;
      best = x;
    }
  }
  return { tx: best, ty: SHIP_START.y };
}

describe("start", () => {
  it("begins at chapter 1, wave 1 with the spread gun at power 1", () => {
    const s = createRun(1);
    expect(stageInfo(s.stage)).toEqual({ round: 1, chapter: 1, wave: 1 });
    expect(s.family).toBe("spread");
    expect(s.power).toBe(1);
    expect(s.lives).toBe(3);
    expect(s.missiles).toBe(1);
  });
});

describe("weapons", () => {
  it("a can of the same colour adds a level, another colour switches and keeps the level", () => {
    const s = createRun(1, { power: 4 });
    const ev: GameEvent[] = [];
    collect(s, can("spread"), ev);
    expect([s.family, s.power]).toEqual(["spread", 5]);
    collect(s, can("laser"), ev);
    expect([s.family, s.power]).toEqual(["laser", 5]);
    collect(s, can("bolt"), ev);
    expect([s.family, s.power]).toEqual(["bolt", 5]);
    collect(s, can("bolt"), ev);
    expect(s.power).toBe(6);
  });

  it("orbs add a level up to 10, then pay score", () => {
    const s = createRun(1, { power: 9 });
    const ev: GameEvent[] = [];
    collect(s, item("orb"), ev);
    expect(s.power).toBe(10);
    const before = s.score;
    collect(s, item("orb"), ev);
    collect(s, can("spread"), ev);
    expect(s.power).toBe(10);
    expect(s.score).toBeGreaterThan(before);
  });

  it("spread fires more streams and laser more beams as power rises", () => {
    for (const [family, table] of [
      ["spread", SPREAD.streams],
      ["laser", LASER.beams],
    ] as const) {
      for (const power of [1, 5, 10]) {
        const s = createRun(1, { family, power });
        quiet(s);
        s.ship.cd = 0;
        update(s, {}, DT);
        expect(s.shots.length).toBe(table[power - 1]);
      }
    }
    expect(SPREAD.streams[9]).toBeGreaterThan(SPREAD.streams[0]);
  });

  it("laser bolts pierce; lightning chains to neighbours", () => {
    const s = createRun(1, { family: "laser", power: 10 });
    quiet(s);
    const row = [0, 1, 2, 3].map((i) =>
      makeEnemy(s, "saucer", s.ship.x, 400 - i * 60, "rock"),
    );
    for (const e of row) {
      e.vy = 0;
      s.enemies.push(e);
    }
    s.ship.cd = 0;
    s.wave.spawns = [];
    for (let i = 0; i < 30; i++) update(s, {}, DT);
    // One bolt passes through the whole column: every saucer in it is hurt (or gone)
    expect(row.every((e) => e.hp < e.maxHp)).toBe(true);
    expect(LASER.pierce[9]).toBeGreaterThanOrEqual(row.length);

    const b = createRun(1, { family: "bolt", power: 5 });
    quiet(b);
    for (let i = 0; i < 5; i++) {
      const e = makeEnemy(b, "saucer", 150 + i * 60, 400, "rock");
      e.vy = 0;
      b.enemies.push(e);
    }
    b.ship.cd = 0;
    const ev = update(b, {}, DT);
    const zap = ev.find((e) => e.type === "zap");
    expect(zap && zap.type === "zap" && zap.pts.length - 1).toBe(
      BOLT.targets[4],
    );
  });
});

describe("pickups and missiles", () => {
  it(`every ${FISH_PER_MISSILE} dried fish is a missile`, () => {
    const s = createRun(1);
    const ev: GameEvent[] = [];
    for (let i = 0; i < FISH_PER_MISSILE; i++) collect(s, item("fish"), ev);
    expect(s.missiles).toBe(2);
    expect(ev.some((e) => e.type === "missileGain")).toBe(true);
  });

  it("a missile clears bullets, kills ordinary enemies and dents a boss", () => {
    const s = createRun(1, { stage: 9 });
    quiet(s);
    const boss = makeEnemy(s, "boss1", W / 2, 215, "boss");
    boss.age = 10;
    s.enemies.push(boss);
    for (let i = 0; i < 5; i++)
      s.enemies.push(makeEnemy(s, "saucer", 80 + i * 90, 400, "slot"));
    s.bullets.push({ x: 100, y: 500, vx: 0, vy: 0, kind: "hairball", r: 9 });
    const ev: GameEvent[] = [];
    expect(launch(s, ev)).toBe(true);
    expect(s.missiles).toBe(0);
    expect(launch(s, ev)).toBe(false);
    const hp = boss.hp;
    const all = run(s, MISSILE_FLIGHT + 0.05);
    expect(all.some((e) => e.type === "boom")).toBe(true);
    expect(s.bullets.length).toBe(0);
    expect(s.enemies.filter((e) => e.kind === "saucer").length).toBe(0);
    expect(hp - boss.hp).toBeGreaterThanOrEqual(
      boss.maxHp * MISSILE_BOSS_SHARE * 0.99,
    );
  });

  it("kills score and drop fish on a seeded schedule", () => {
    const s = createRun(7, { power: 10 });
    run(s, 20);
    expect(s.score).toBeGreaterThan(0);
    expect(
      s.fishTotal + s.pickups.filter((p) => p.kind === "fish").length,
    ).toBeGreaterThan(0);
  });
});

describe("lives", () => {
  it("a hit costs a life and two power levels, then respawns with a shield", () => {
    const s = createRun(1, { power: 5 });
    quiet(s);
    s.ship.shield = 0;
    s.bullets.push({
      x: s.ship.x,
      y: s.ship.y,
      vx: 0,
      vy: 0,
      kind: "hairball",
      r: 9,
    });
    const ev = update(s, {}, DT);
    expect(ev.some((e) => e.type === "hurt")).toBe(true);
    expect(s.lives).toBe(2);
    expect(s.power).toBe(3);
    expect(s.ship.alive).toBe(false);
    const later = run(s, RESPAWN_DELAY + 0.1, () => {
      quiet(s);
      return {};
    });
    expect(later.some((e) => e.type === "respawn")).toBe(true);
    expect(s.ship.shield).toBeGreaterThan(2);
    // The shield shrugs off a hit
    s.bullets.push({
      x: s.ship.x,
      y: s.ship.y,
      vx: 0,
      vy: 0,
      kind: "hairball",
      r: 9,
    });
    update(s, {}, DT);
    expect(s.lives).toBe(2);
  });

  it("power never drops below 1, and the last life ends the run once", () => {
    const s = createRun(1, { power: 1 });
    quiet(s);
    const ev: GameEvent[] = [];
    for (let i = 0; i < 3; i++) {
      s.ship.alive = true;
      s.ship.shield = 0;
      s.bullets.push({
        x: s.ship.x,
        y: s.ship.y,
        vx: 0,
        vy: 0,
        kind: "hairball",
        r: 9,
      });
      ev.push(...update(s, {}, DT));
    }
    expect(s.power).toBe(1);
    expect(s.phase).toBe("over");
    expect(ev.filter((e) => e.type === "over").length).toBe(1);
    expect(update(s, {}, DT)).toEqual([]);
  });
});

describe("waves", () => {
  it("3 chapters of 10 waves, each ending in its own boss, then a tougher loop", () => {
    for (let c = 0; c < 3; c++) {
      const def = waveDef(c * 10 + 9);
      expect(def).toEqual({ kind: "boss", boss: c + 1 });
      const kinds = new Set(
        Array.from({ length: 10 }, (_, i) => waveDef(c * 10 + i).kind),
      );
      for (const k of [
        "grid",
        "lines",
        "kamikaze",
        "rocks",
        "mini",
        "bonus",
        "boss",
      ])
        expect(kinds.has(k as never)).toBe(true);
    }
    expect(stageInfo(STAGES_PER_ROUND)).toEqual({
      round: 2,
      chapter: 1,
      wave: 1,
    });
    expect(scaling(STAGES_PER_ROUND).hp).toBeGreaterThan(scaling(0).hp);
    expect(scaling(STAGES_PER_ROUND).speed).toBeGreaterThan(scaling(0).speed);
  });

  it("clearing every wave walks through all three chapters into round 2", () => {
    const s = createRun(3);
    s.lives = 99;
    const waves: number[] = [];
    for (let i = 0; i < 60 * 60 * 30 && s.stage < STAGES_PER_ROUND + 1; i++) {
      for (const e of update(s, {}, DT))
        if (e.type === "wave") waves.push(e.stage);
      for (const e of s.enemies) if (e.y > -10) e.dead = true;
    }
    expect(waves).toEqual(
      Array.from({ length: STAGES_PER_ROUND + 1 }, (_, i) => i + 1),
    );
  });

  for (const boss of [1, 2, 3]) {
    it(`a bot at mid power beats the chapter ${boss} boss in time`, () => {
      const s = createRun(boss * 11, { stage: boss * 10 - 1, power: 5 });
      s.lives = 99;
      let t = 0;
      let down = false;
      while (t < 150 && !down) {
        for (const e of update(s, bot(s), DT))
          if (e.type === "bossDown") down = true;
        t += DT;
      }
      expect(down).toBe(true);
      expect(s.enemies.some((e) => isBoss(e.kind))).toBe(false);
    });
  }
});

describe("determinism and balance", () => {
  it("the same seed and inputs replay exactly", () => {
    const a = createRun(42);
    const b = createRun(42);
    run(a, 40, bot);
    run(b, 40, bot);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = createRun(43);
    run(c, 40, bot);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  it("a simple dodging bot clears chapter 1, waves 1–5 most of the time", () => {
    let cleared = 0;
    const N = 20;
    for (let seed = 1; seed <= N; seed++) {
      const s = createRun(seed * 977);
      for (let t = 0; t < 400 && s.phase === "play" && s.stage < 5; t += DT)
        update(s, bot(s), DT);
      if (s.stage >= 5) cleared++;
    }
    expect(cleared / N).toBeGreaterThanOrEqual(0.7);
  });
});
