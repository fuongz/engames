import { describe, expect, it } from "vitest";
import {
  CHIEF_EVERY,
  ENEMIES,
  HERO_MAX_HP,
  QUEUE_SIZE,
  SHIELDS,
  WEAPONS,
} from "./config";
import {
  type GameState,
  buy,
  canBuy,
  createGame,
  nextShield,
  nextWeapon,
  pickKind,
  slotX,
  update,
} from "./logic";

const STEP = 1 / 30;

function run(
  s: GameState,
  seconds: number,
  bot: (s: GameState) => void = () => {},
) {
  for (let t = 0; t < seconds && !s.over; t += STEP) {
    bot(s);
    update(s, STEP);
    s.events.length = 0;
  }
}

describe("the line", () => {
  it("starts full, packed from the front slot", () => {
    const s = createGame(1);
    expect(s.queue).toHaveLength(QUEUE_SIZE);
    expect(s.queue.map((e) => e.x)).toEqual(s.queue.map((_, i) => slotX(i)));
    // ad: the first few are club grunts, an axeman shows up around the 5th
    expect(s.queue.slice(0, 3).every((e) => e.kind === "grunt")).toBe(true);
  });

  it("steps forward and refills after a kill", () => {
    const s = createGame(1);
    s.queue[0].hp = 1;
    const second = s.queue[1].id;
    run(s, 2);
    expect(s.kills).toBeGreaterThanOrEqual(1);
    expect(s.queue[0].id).toBe(second);
    expect(s.queue[0].x).toBe(slotX(0));
    expect(s.queue).toHaveLength(QUEUE_SIZE);
  });

  it("sends a chief every 20th foe", () => {
    expect(pickKind(CHIEF_EVERY, 0.5)).toBe("chief");
    expect(pickKind(CHIEF_EVERY * 2, 0.5)).toBe("chief");
    expect(pickKind(3, 0.99)).toBe("grunt");
  });
});

describe("combat", () => {
  it("a kill pays gold in proportion to the foe's HP", () => {
    const s = createGame(2);
    let gold = 0;
    for (let t = 0; t < 10 && s.kills === 0; t += STEP) {
      update(s, STEP);
      for (const e of s.events) if (e.type === "kill") gold = e.gold;
      s.events.length = 0;
    }
    expect(gold).toBeGreaterThan(ENEMIES.grunt.hp * 5);
  });

  it("the hero loses HP to the front foe and to arrows, and can be defeated", () => {
    const s = createGame(3);
    run(s, 600);
    expect(s.over).toBe(true);
    expect(s.hp).toBe(0);
  });
});

describe("upgrades", () => {
  it("weapon: costs the next tier's price and raises damage", () => {
    const s = createGame(1);
    s.gold = 199;
    expect(canBuy(s, "weapon")).toBe(false);
    s.gold = 200;
    expect(buy(s, "weapon")).toBe(true);
    expect(WEAPONS[s.weapon].name.vi).toBe("Rìu");
    expect(s.gold).toBe(0);
    expect(nextWeapon(s)?.cost).toBe(WEAPONS[2].cost);
  });

  it("shield: raises max HP and heals the bonus", () => {
    const s = createGame(1);
    s.hp = 50;
    s.gold = 600;
    buy(s, "shield");
    expect(s.maxHp).toBe(HERO_MAX_HP + SHIELDS[1].hp);
    expect(s.hp).toBe(50 + SHIELDS[1].hp);
    expect(nextShield(s)?.name).toBe(SHIELDS[2].name);
  });
});

/** Buys whichever upgrade is cheapest whenever it can afford it. */
function cheapest(s: GameState) {
  for (;;) {
    const options = [
      { u: "weapon" as const, c: nextWeapon(s)?.cost },
      { u: "shield" as const, c: nextShield(s)?.cost },
    ].filter(
      (o): o is { u: "weapon" | "shield"; c: number } => o.c !== undefined,
    );
    const pick = options.sort((a, b) => a.c - b.c)[0];
    if (!pick || s.gold < pick.c || !buy(s, pick.u)) return;
  }
}

describe("balance", () => {
  it("never upgrading dies around the ad's 11 kills; upgrading goes several times further", () => {
    const seeds = [1, 2, 3, 4, 5];
    const idle = seeds.map((seed) => {
      const s = createGame(seed);
      run(s, 600);
      return s.kills;
    });
    const active = seeds.map((seed) => {
      const s = createGame(seed);
      run(s, 1200, cheapest);
      return s.kills;
    });
    for (const k of idle) expect(k).toBeGreaterThanOrEqual(7);
    for (const k of idle) expect(k).toBeLessThanOrEqual(20);
    const median = (xs: number[]) =>
      [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    expect(median(active)).toBeGreaterThanOrEqual(median(idle) * 4);
  });
});
