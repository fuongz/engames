import { describe, expect, it } from "vitest";
import { BOSS_AT, COUNTDOWN, ENEMIES, H, ROUND_TIME, SHARD_GOAL } from "./config";
import { type GameState, type Input, createGame, update } from "./logic";

const IDLE: Input = { mx: 0, my: 0, skill: false };
const STEP = 1 / 60;

function run(s: GameState, seconds: number, input: (s: GameState) => Input = () => IDLE) {
  for (let t = 0; t < seconds && s.phase !== "over"; t += STEP) {
    update(s, STEP, input(s));
    s.events.length = 0;
  }
}

describe("round flow", () => {
  it("counts down 3-2-1 before play starts", () => {
    const s = createGame(1);
    const seen: number[] = [];
    for (let t = 0; t < COUNTDOWN + 0.1; t += STEP) {
      update(s, STEP, IDLE);
      for (const e of s.events) if (e.type === "countdown") seen.push(e.n);
      s.events.length = 0;
    }
    expect(seen).toEqual([2, 1]);
    expect(s.phase).toBe("play");
  });

  it("auto-fires two streams from the start", () => {
    const s = createGame(1);
    run(s, COUNTDOWN + 0.05);
    expect(s.bullets.length).toBe(2);
  });

  it("warns, then brings in the boss at BOSS_AT", () => {
    const s = createGame(1);
    s.player.invuln = 999;
    run(s, COUNTDOWN + BOSS_AT + 3);
    expect(s.bossSpawned).toBe(true);
    expect(s.boss).not.toBeNull();
  });

  it("ends at ROUND_TIME with one star for surviving", () => {
    const s = createGame(1);
    s.player.invuln = 1e9;
    run(s, COUNTDOWN + ROUND_TIME + 1);
    expect(s.phase).toBe("over");
    expect(s.result?.won).toBe(true);
    expect(s.result?.stars).toBeGreaterThanOrEqual(1);
  });
});

describe("combat", () => {
  it("a meteor takes two hits and scores 20", () => {
    const s = createGame(1);
    run(s, COUNTDOWN + 0.01);
    s.enemies = [];
    s.spawnTimer = 99;
    s.enemies.push({ id: 999, kind: "meteor", x: 400, y: s.player.y + 4, baseY: 0, vx: 0, vy: 0, hp: 2, maxHp: 2, age: 0, phase: 0, flash: 0 });
    run(s, 1);
    expect(s.score).toBe(ENEMIES.meteor.score);
  });

  it("ramming costs a heart and grants i-frames", () => {
    const s = createGame(1);
    run(s, COUNTDOWN + 0.01);
    s.spawnTimer = 99;
    s.enemies.push({ id: 999, kind: "fighter", x: s.player.x, y: s.player.y, baseY: s.player.y, vx: 0, vy: 0, hp: 1, maxHp: 1, age: 0, phase: 0, flash: 0 });
    run(s, STEP);
    expect(s.player.hearts).toBe(2);
    expect(s.player.invuln).toBeGreaterThan(1);
  });

  it("pickups upgrade bullets and skill charges", () => {
    const s = createGame(1);
    run(s, COUNTDOWN + 0.01);
    s.spawnTimer = 99;
    for (const kind of ["multi", "pierce", "energy"] as const) {
      s.pickups.push({ id: s.nextId++, kind, x: s.player.x, y: s.player.y, baseY: s.player.y, age: 0 });
      run(s, STEP);
    }
    expect(s.player.streams).toBe(3);
    expect(s.player.pierce).toBe(1);
    expect(s.skill.charges).toBe(1);
  });

  it("the skill freezes for the cut-in, then the beam fires", () => {
    const s = createGame(1);
    run(s, COUNTDOWN + 0.01);
    s.skill.charges = 1;
    update(s, STEP, { mx: 0, my: 0, skill: true });
    expect(s.phase).toBe("cutin");
    const frozen = s.elapsed;
    run(s, 0.5);
    expect(s.elapsed).toBe(frozen);
    run(s, 0.6);
    expect(s.skill.beam).toBeGreaterThan(0);
    expect(s.skill.charges).toBe(0);
  });
});

/** Dodges the nearest threat in its lane, fires the skill whenever the boss is up. */
function dodger(s: GameState): Input {
  const p = s.player;
  const threats = [...s.enemies.map((e) => ({ x: e.x, y: e.y })), ...s.shots.map((x) => ({ x: x.x, y: x.y }))].filter(
    (t) => t.x > p.x - 30 && t.x < p.x + 260 && Math.abs(t.y - p.y) < 60,
  );
  const near = threats.sort((a, b) => a.x - b.x)[0];
  const lane = s.boss?.attack ? s.boss.attack.y : null;
  let my = 0;
  if (near) my = near.y > p.y ? -1 : 1;
  else if (lane !== null && Math.abs(lane - p.y) < 50) my = lane > p.y ? -1 : 1;
  else my = Math.sign(H / 2 - p.y) * 0.3;
  if (p.y < 70) my = 1;
  if (p.y > H - 70) my = -1;
  return { mx: 0, my, skill: s.boss?.mode === "fight" };
}

describe("balance", () => {
  it("a dodging player with skills beats the boss most runs; a frozen one loses hearts", () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const dodge = seeds.map((seed) => {
      const s = createGame(seed);
      run(s, COUNTDOWN + ROUND_TIME + 2, dodger);
      return s;
    });
    const beaten = dodge.filter((s) => s.bossDefeated).length;
    expect(beaten).toBeGreaterThanOrEqual(4);
    for (const s of dodge.filter((x) => x.bossDefeated)) expect(s.shards).toBe(SHARD_GOAL);

    const idle = createGame(1);
    run(idle, COUNTDOWN + ROUND_TIME + 2);
    expect(idle.player.hitsTaken).toBeGreaterThan(0);
  });
});

describe("joystick", () => {
  it("ignores small drags, then moves at full keyboard speed in 8 directions", async () => {
    const { joystickDirection, JOY_DEADZONE } = await import("./joystick");
    expect(joystickDirection(JOY_DEADZONE - 1, 0, null)).toEqual({ mx: 0, my: 0, sector: null });
    expect(joystickDirection(20, 0, null)).toMatchObject({ mx: 1, my: 0, sector: 0 });
    expect(joystickDirection(0, -60, null)).toMatchObject({ mx: 0, my: -1, sector: 6 });
    const diag = joystickDirection(30, 30, null);
    expect(Math.hypot(diag.mx, diag.my)).toBeCloseTo(1);
  });

  it("holds the current direction near a sector edge", async () => {
    const { joystickDirection } = await import("./joystick");
    // 25° is just past the right/down-right edge (22.5°) but inside the hysteresis band
    const a = (25 * Math.PI) / 180;
    expect(joystickDirection(Math.cos(a) * 40, Math.sin(a) * 40, 0).sector).toBe(0);
    expect(joystickDirection(Math.cos(a) * 40, Math.sin(a) * 40, null).sector).toBe(1);
  });
});
