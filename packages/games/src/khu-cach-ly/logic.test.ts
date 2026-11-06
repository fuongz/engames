import { describe, expect, it } from "vitest";
import {
  blocked,
  createGame,
  lineClear,
  move,
  selectWeapon,
  update,
  type Enemy,
} from "./logic";
const idle = { x: 0, y: 0 };
function enemy(x: number, y: number, hp = 40): Enemy {
  return {
    id: 1,
    x,
    y,
    hp,
    maxHp: hp,
    radius: 13,
    speed: 0,
    flash: 0,
    kind: "drone",
  };
}
describe("quarantine combat", () => {
  it("replays the same seeded inputs deterministically", () => {
    const a = createGame(123),
      b = createGame(123);
    for (let i = 0; i < 3600; i++) {
      const input = {
        x: Math.sin(i / 130),
        y: Math.cos(i / 150),
        blast: i % 600 === 0,
      };
      expect(update(a, input, 1 / 60)).toEqual(update(b, input, 1 / 60));
    }
    const { random: _a, ...sa } = a,
      { random: _b, ...sb } = b;
    expect(sa).toEqual(sb);
    expect(a.wave).toBeGreaterThan(0);
    expect(a.bullets.length).toBeLessThan(60);
  });
  it("gives time to learn but requires movement to survive the horde", () => {
    const s = createGame(42);
    for (let i = 0; i < 60 * 90 && !s.over; i++) update(s, idle, 1 / 60);
    expect(s.over).toBe(true);
    expect(s.elapsed).toBeGreaterThan(15);
    expect(s.elapsed).toBeLessThan(70);
    expect(s.kills).toBeGreaterThanOrEqual(25);
  });
  it("blocks walls and permits sliding along them", () => {
    const p = { x: 160, y: 220 };
    move(p, 20, 12, 14);
    expect(p).toEqual({ x: 160, y: 232 });
    expect(blocked(0, 0)).toBe(true);
    expect(lineClear({ x: 150, y: 240 }, { x: 450, y: 240 })).toBe(false);
  });
  it("sweeps fast bullets so neither enemies nor walls can be skipped", () => {
    const s = createGame();
    s.intermission = 100;
    s.enemies = [enemy(550, 960)];
    s.fire = 100;
    s.bullets = [
      { x: 500, y: 960, vx: 6000, vy: 0, life: 1, damage: 100, plasma: false },
    ];
    expect(
      update(s, idle, 1 / 60).filter((e) => e.type === "kill"),
    ).toHaveLength(1);
    expect(s.kills).toBe(1);
    s.enemies = [enemy(450, 240)];
    s.bullets = [
      { x: 150, y: 240, vx: 20000, vy: 0, life: 1, damage: 100, plasma: false },
    ];
    update(s, idle, 1 / 60);
    expect(s.enemies[0].hp).toBe(40);
    expect(s.bullets).toHaveLength(0);
  });
  it("charges the pulse from kills and never kills the same enemy twice", () => {
    const s = createGame();
    s.intermission = 100;
    s.enemies = [enemy(570, 960), enemy(590, 960), enemy(970, 960)];
    const events = update(s, { ...idle, blast: true }, 1 / 60);
    expect(events.filter((e) => e.type === "kill")).toHaveLength(2);
    expect(s.kills).toBe(2);
    expect(s.energy).toBe(6);
    expect(s.enemies).toHaveLength(1);
    expect(
      update(s, { ...idle, blast: true }, 1 / 60).some(
        (e) => e.type === "blast",
      ),
    ).toBe(false);
  });
  it("can shoot creatures at point-blank range", () => {
    const s = createGame();
    s.intermission = 100;
    s.enemies = [enemy(s.player.x, s.player.y)];
    update(s, idle, 1 / 60);
    expect(s.enemies[0].hp).toBe(24);
  });
  it("unlocks weapons only at their kill thresholds", () => {
    const s = createGame();
    selectWeapon(s, 2);
    expect(s.weapon).toBe(0);
    s.kills = 25;
    selectWeapon(s, 1);
    expect(s.weapon).toBe(1);
    selectWeapon(s, -1);
    expect(s.weapon).toBe(1);
    s.kills = 70;
    selectWeapon(s, 2);
    expect(s.weapon).toBe(2);
  });
  it("reports death once and stops the simulation", () => {
    const s = createGame();
    s.hp = 1;
    s.fire = 100;
    s.enemies = [enemy(540, 960)];
    expect(
      update(s, idle, 1 / 60).filter((e) => e.type === "over"),
    ).toHaveLength(1);
    const elapsed = s.elapsed;
    expect(update(s, idle, 1 / 60)).toEqual([]);
    expect(s.elapsed).toBe(elapsed);
  });
  it("routes a pursuing creature around the central wall", () => {
    const s = createGame();
    s.player = { x: 540, y: 780 };
    s.fire = 1000;
    s.intermission = 1000;
    s.invuln = 1000;
    s.enemies = [{ ...enemy(540, 540, 10000), speed: 90 }];
    for (let i = 0; i < 900; i++) {
      update(s, idle, 1 / 60);
      expect(blocked(s.enemies[0].x, s.enemies[0].y, 12)).toBe(false);
    }
    expect(
      Math.hypot(s.enemies[0].x - s.player.x, s.enemies[0].y - s.player.y),
    ).toBeLessThan(40);
  });
  it("starts a fresh wave only after all remaining spawns are defeated", () => {
    const s = createGame();
    s.wave = 4;
    s.intermission = 0;
    update(s, idle, 1 / 60);
    expect(s.wave).toBe(5);
    s.remaining = 1;
    s.spawn = 0;
    update(s, idle, 1 / 60);
    expect(s.enemies.some((e) => e.kind === "boss")).toBe(true);
    for (let i = 0; i < 240; i++) update(s, idle, 1 / 60);
    expect(s.wave).toBe(5);
  });
});
