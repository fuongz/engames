import { describe, expect, it } from "vitest";
import {
  ENEMIES,
  H,
  INTRO_TIME,
  MAX_HP,
  MAX_POWER,
  STAGE_TIME,
  WARNING_TIME,
  W,
} from "./config";
import {
  type GameState,
  type Input,
  createGame,
  streams,
  update,
} from "./logic";

const IDLE: Input = { dx: 0, dy: 0, mx: 0, my: 0, skill: false, bomb: false };
const STEP = 1 / 60;

function run(
  s: GameState,
  seconds: number,
  input: (s: GameState) => Input = () => IDLE,
) {
  for (let t = 0; t < seconds && s.phase !== "over"; t += STEP) {
    update(s, STEP, input(s));
    s.events.length = 0;
  }
}

function playing(seed = 1) {
  const s = createGame(seed);
  run(s, INTRO_TIME + 0.01);
  s.waveTimer = 999;
  return s;
}

describe("flow", () => {
  it("flies the plane in, then auto-fires main guns and both wingmen", () => {
    const s = createGame(1);
    run(s, INTRO_TIME - 0.1);
    expect(s.phase).toBe("intro");
    expect(s.bullets.length).toBe(0);
    run(s, 0.12);
    expect(s.phase).toBe("play");
    expect(s.bullets.filter((b) => !b.wing).length).toBe(2);
    expect(s.bullets.filter((b) => b.wing).length).toBe(2);
  });

  it("warns, brings in the battleship, and loops to stage 2 after it sinks", () => {
    const s = playing();
    s.player.invuln = 1e9;
    s.elapsed = STAGE_TIME;
    s.enemies = [];
    run(s, 0.1);
    expect(s.flow).toBe("warning");
    run(s, WARNING_TIME + 0.1);
    expect(s.boss?.mode).toBe("enter");
    run(s, 6);
    expect(s.boss?.mode).toBe("fight");
    if (s.boss) s.boss.hp = 1;
    run(s, 0.5);
    expect(s.bossesBeaten).toBe(1);
    expect(s.flow).toBe("clear");
    run(s, 4);
    expect(s.stage).toBe(2);
    expect(s.flow).toBe("waves");
  });

  it("ends the run when HP runs out", () => {
    const s = playing();
    s.player.hp = 5;
    s.shots.push({
      id: 999,
      kind: "orb",
      x: s.player.x,
      y: s.player.y,
      vx: 0,
      vy: 0,
      radius: 7,
      hp: 1,
    });
    run(s, STEP);
    expect(s.phase).toBe("over");
  });
});

describe("combat", () => {
  it("power levels add one stream each", () => {
    for (let l = 1; l <= MAX_POWER; l++) expect(streams(l).length).toBe(l + 1);
  });

  it("a fighter dies to three hits and drops a coin worth 10", () => {
    const s = playing();
    s.enemies.push({
      id: 900,
      kind: "zero",
      x: s.player.x,
      y: s.player.y - 200,
      vx: 0,
      vy: 0,
      turn: 0,
      turnLeft: 0,
      hp: 3,
      maxHp: 3,
      age: 0,
      flash: 0,
      fireTimer: 99,
      hoverY: 0,
      hover: 0,
      formation: 0,
    });
    run(s, 0.3);
    expect(s.kills).toBe(1);
    expect(s.score).toBe(ENEMIES.zero.score);
    run(s, 3);
    expect(s.coins).toBe(1);
  });

  it("wiping out a whole formation drops a power crate", () => {
    const s = playing();
    s.formations.set(77, { left: 2, killed: 0 });
    for (const dx of [-6, 6]) {
      s.enemies.push({
        id: s.nextId++,
        kind: "zero",
        x: s.player.x + dx,
        y: s.player.y - 240,
        vx: 0,
        vy: 0,
        turn: 0,
        turnLeft: 0,
        hp: 1,
        maxHp: 1,
        age: 0,
        flash: 0,
        fireTimer: 99,
        hoverY: 0,
        hover: 0,
        formation: 77,
      });
    }
    run(s, 0.3);
    expect(s.pickups.some((k) => k.kind === "power")).toBe(true);
    run(s, 4);
    expect(s.player.power).toBe(2);
  });

  it("orbs cost HP and grant brief invulnerability", () => {
    const s = playing();
    s.shots.push({
      id: 999,
      kind: "orb",
      x: s.player.x,
      y: s.player.y,
      vx: 0,
      vy: 0,
      radius: 7,
      hp: 1,
    });
    s.shots.push({
      id: 998,
      kind: "orb",
      x: s.player.x,
      y: s.player.y,
      vx: 0,
      vy: 0,
      radius: 7,
      hp: 1,
    });
    run(s, STEP);
    expect(s.player.hp).toBe(MAX_HP - 10);
    expect(s.player.invuln).toBeGreaterThan(0.5);
  });

  it("a bomb clears enemy fire and spends one charge", () => {
    const s = playing();
    for (let i = 0; i < 20; i++)
      s.shots.push({
        id: s.nextId++,
        kind: "orb",
        x: i * 20,
        y: 300,
        vx: 0,
        vy: 0,
        radius: 7,
        hp: 1,
      });
    run(s, STEP, () => ({ ...IDLE, bomb: true }));
    expect(s.shots.length).toBe(0);
    expect(s.bombs).toBe(1);
  });

  it("the skill only fires with a full gauge and widens the guns", () => {
    const s = playing();
    run(s, STEP, () => ({ ...IDLE, skill: true }));
    expect(s.rapid).toBe(0);
    s.energy = 100;
    s.bullets = [];
    run(s, STEP, () => ({ ...IDLE, skill: true }));
    expect(s.rapid).toBeGreaterThan(4);
    expect(s.energy).toBe(0);
  });

  it("the plane follows the finger 1:1 and stays on screen", () => {
    const s = playing();
    const x = s.player.x;
    run(s, STEP, () => ({ ...IDLE, dx: 30 }));
    expect(s.player.x).toBeCloseTo(x + 30);
    run(s, STEP, () => ({ ...IDLE, dx: 5000, dy: 5000 }));
    expect(s.player.x).toBeLessThanOrEqual(W);
    expect(s.player.y).toBeLessThanOrEqual(H);
  });
});

/** Steps away from incoming fire, drifts under targets, spends bombs when cornered. */
function pilot(s: GameState): Input {
  const p = s.player;
  const danger = (x: number, y: number) => {
    let d = 0;
    for (const sh of s.shots) {
      for (const k of [0.1, 0.25, 0.4]) {
        const r2 = (sh.x + sh.vx * k - x) ** 2 + (sh.y + sh.vy * k - y) ** 2;
        d += Math.exp(-r2 / 900) / k;
      }
    }
    for (const e of s.enemies) {
      if (ENEMIES[e.kind].ground) continue;
      const r2 = (e.x + e.vx * 0.3 - x) ** 2 + (e.y + e.vy * 0.3 - y) ** 2;
      d += Math.exp(-r2 / 2500) * 6;
    }
    return d;
  };
  const target = s.boss
    ? s.boss.x
    : (s.enemies.find((e) => e.y > 0 && e.y < p.y - 100)?.x ?? W / 2);
  let best = { dx: 0, dy: 0, score: Number.POSITIVE_INFINITY };
  for (const [ax, ay] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const dx = ax * 7;
    const dy = ay * 7;
    const x = p.x + dx;
    const y = p.y + dy;
    const score =
      danger(x, y) +
      Math.abs(x - target) * 0.004 +
      Math.abs(y - (H - 220)) * 0.004 +
      (x < 30 || x > W - 30 ? 5 : 0);
    if (score < best.score) best = { dx, dy, score };
  }
  const cornered = danger(p.x, p.y) > 4 && p.hp <= 40;
  return {
    dx: best.dx,
    dy: best.dy,
    mx: 0,
    my: 0,
    skill: s.boss?.mode === "fight",
    bomb: cornered && p.invuln <= 0,
  };
}

describe("balance", () => {
  it("a careful pilot sinks the first battleship in most runs; a pilot who never moves dies", () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const runs = seeds.map((seed) => {
      const s = createGame(seed);
      run(s, 140, pilot);
      return s;
    });
    const sunk = runs.filter((s) => s.bossesBeaten >= 1).length;
    expect(sunk).toBeGreaterThanOrEqual(4);

    const idle = createGame(1);
    run(idle, 140);
    expect(idle.phase).toBe("over");
    expect(idle.bossesBeaten).toBe(0);
  });
});
