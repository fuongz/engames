import { describe, expect, it } from "vitest";
import { mulberry32 } from "@web-games/core/math";
import {
  BOOK_BOOST,
  EMPTY_PULL,
  EXTEND_SPEED,
  ITEMS,
  type ItemKind,
  LEVEL_TIME,
  PIVOT,
  POLISH_BOOST,
  REST_LEN,
  STRENGTH_BOOST,
  SWING_MAX,
  SWING_SPEED,
  goalFor,
  goalStep,
} from "./config";
import {
  type GameEvent,
  type Item,
  type State,
  boardValue,
  buy,
  canBuy,
  createRun,
  firstHit,
  generateLevel,
  leaveShop,
  openShop,
  pullSpeed,
  rollSack,
  tipOf,
  update,
  payout,
} from "./logic";

const DT = 1 / 60;
const noBuffs = { strength: false, lucky: false, polish: false, book: false };

function item(
  kind: ItemKind,
  x: number,
  y: number,
  extra: Partial<Item> = {},
): Item {
  return {
    id: 99,
    kind,
    x,
    y,
    r: ITEMS[kind].r,
    dir: 1,
    speed: 0,
    minX: 0,
    maxX: 540,
    ...extra,
  };
}

/** A run with one hand-placed board and the claw pointing straight down. */
function rig(items: Item[]): State {
  const s = createRun(1);
  s.items = items;
  s.claw.phase = 0;
  s.claw.angle = 0;
  return s;
}

/** Fire straight down and step until the claw is back; returns every event. */
function shoot(s: State, opts: { dynamiteAt?: "grab" } = {}) {
  aimDown(s);
  const events = update(s, { fire: true }, DT);
  for (
    let i = 0;
    i < 60 * 30 && s.phase === "play" && s.claw.mode !== "swing";
    i++
  ) {
    const grabbed = events.some((e) => e.type === "grab");
    events.push(
      ...update(s, { dynamite: opts.dynamiteAt === "grab" && grabbed }, DT),
    );
  }
  return events;
}

/** The swing advances one step before the claw leaves: start it so that step lands on straight down. */
function aimDown(s: State) {
  s.claw.phase = -SWING_SPEED * DT;
}

describe("the claw", () => {
  it("swings like a pendulum, about ±70°", () => {
    const s = rig([]);
    s.items = [item("rockS", 20, 900)]; // keep the level alive
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < 60 * 6; i++) {
      update(s, {}, DT);
      lo = Math.min(lo, s.claw.angle);
      hi = Math.max(hi, s.claw.angle);
    }
    expect(hi).toBeCloseTo(SWING_MAX, 1);
    expect(lo).toBeCloseTo(-SWING_MAX, 1);
    expect(SWING_MAX).toBeCloseTo((70 * Math.PI) / 180);
    expect(s.claw.len).toBe(REST_LEN);
  });

  it("fires on input, extends at constant speed and stops swinging", () => {
    const s = rig([item("rockS", 20, 900)]);
    const ev = update(s, { fire: true }, DT);
    expect(ev).toContainEqual({ type: "fire" });
    const angle = s.claw.angle;
    update(s, {}, 0.1);
    const len = s.claw.len;
    update(s, {}, 0.1);
    expect(s.claw.len - len).toBeCloseTo(EXTEND_SPEED * 0.1);
    expect(s.claw.angle).toBe(angle);
    // Firing again mid-flight does nothing
    expect(update(s, { fire: true }, DT)).not.toContainEqual({ type: "fire" });
  });

  it("grabs the first thing it touches and reels it in", () => {
    const near = item("goldS", PIVOT.x, 400, { id: 1 });
    const far = item("diamond", PIVOT.x, 700, { id: 2 });
    const s = rig([near, far]);
    const ev = shoot(s);
    const grab = ev.find((e) => e.type === "grab");
    expect(grab && grab.type === "grab" && grab.item.id).toBe(1);
    expect(ev.find((e) => e.type === "land")).toMatchObject({
      value: ITEMS.goldS.value,
    });
    expect(s.money).toBe(ITEMS.goldS.value);
    expect(s.items.map((i) => i.id)).toEqual([2]);
    expect(s.claw.mode).toBe("swing");
  });

  it("comes back empty after missing", () => {
    const s = rig([item("goldL", 60, 300)]);
    const ev = shoot(s);
    expect(ev.map((e) => e.type)).toContain("miss");
    expect(s.money).toBe(0);
    expect(s.claw.len).toBe(REST_LEN);
  });

  it("reels heavy loads slower, and strength speeds them up", () => {
    const heavy = pullSpeed(item("goldL", 0, 0), false);
    const light = pullSpeed(item("goldS", 0, 0), false);
    expect(heavy).toBeLessThan(light / 3);
    expect(pullSpeed(item("rockL", 0, 0), false)).toBeLessThan(
      pullSpeed(item("rockS", 0, 0), false),
    );
    expect(pullSpeed(null, false)).toBe(EMPTY_PULL);
    expect(pullSpeed(item("goldL", 0, 0), true)).toBeCloseTo(
      heavy * STRENGTH_BOOST,
    );
    // Measured: the big nugget takes much longer to come home
    const time = (kind: ItemKind) => {
      const s = rig([item(kind, PIVOT.x, 600)]);
      let n = 0;
      aimDown(s);
      update(s, { fire: true }, DT);
      while (s.claw.mode !== "swing" && n < 6000) {
        update(s, {}, DT);
        n++;
      }
      return n;
    };
    expect(time("goldL")).toBeGreaterThan(time("goldS") * 2);
  });

  it("moles walk and turn at their lane's ends", () => {
    const m = item("mole", 100, 500, {
      speed: 60,
      dir: -1,
      minX: 80,
      maxX: 460,
    });
    const s = rig([m, item("rockS", 20, 900)]);
    for (let i = 0; i < 60; i++) update(s, {}, DT);
    expect(m.dir).toBe(1);
    expect(m.x).toBeGreaterThan(80);
  });
});

describe("scoring", () => {
  it("pays the table values, with polish and the rock book", () => {
    expect(payout("goldS", noBuffs)).toBe(50);
    expect(payout("goldL", noBuffs)).toBe(500);
    expect(payout("diamond", noBuffs)).toBe(600);
    expect(payout("diamond", { ...noBuffs, polish: true })).toBe(
      600 * POLISH_BOOST,
    );
    expect(payout("moleDiamond", { ...noBuffs, polish: true })).toBe(
      2 + 600 * POLISH_BOOST,
    );
    expect(payout("rockL", { ...noBuffs, book: true })).toBe(
      ITEMS.rockL.value * BOOK_BOOST,
    );
    expect(payout("goldM", { ...noBuffs, book: true })).toBe(150);
  });

  it("dynamite blows up the held load and the claw comes back fast", () => {
    const s = rig([item("rockL", PIVOT.x, 500)]);
    s.dynamite = 1;
    const ev = shoot(s, { dynamiteAt: "grab" });
    expect(ev.map((e) => e.type)).toContain("boom");
    expect(s.dynamite).toBe(0);
    expect(s.money).toBe(0);
    expect(ev.some((e) => e.type === "land")).toBe(false);
  });

  it("dynamite does nothing without a stick or without a load", () => {
    const s = rig([item("rockL", PIVOT.x, 500), item("rockS", 20, 900)]);
    s.dynamite = 0;
    const ev = shoot(s, { dynamiteAt: "grab" });
    expect(ev.map((e) => e.type)).not.toContain("boom");
    expect(s.money).toBe(ITEMS.rockL.value);
  });
});

describe("mystery sacks", () => {
  it("hold money, a stick of dynamite or strength", () => {
    const rnd = mulberry32(7);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const o = rollSack(rnd, false);
      kinds.add(o.kind);
      if (o.kind === "money") expect(o.amount).toBeGreaterThanOrEqual(20);
    }
    expect([...kinds].sort()).toEqual(["dynamite", "money", "strength"]);
  });

  it("pay more with the lucky clover", () => {
    const avg = (lucky: boolean) => {
      const rnd = mulberry32(3);
      let n = 0;
      for (let i = 0; i < 2000; i++) {
        const o = rollSack(rnd, lucky);
        if (o.kind === "money") n += o.amount;
      }
      return n / 2000;
    };
    expect(avg(true)).toBeGreaterThan(avg(false) * 2);
  });

  it("apply when landed", () => {
    const saw = { money: false, dynamite: false, strength: false };
    for (
      let seed = 1;
      seed < 60 && !(saw.money && saw.dynamite && saw.strength);
      seed++
    ) {
      const s = rig([item("sack", PIVOT.x, 400), item("rockS", 20, 900)]);
      s.rng.seed = seed;
      const ev = shoot(s);
      const land = ev.find((e) => e.type === "land");
      if (land?.type !== "land" || !land.sack) throw new Error("no sack");
      saw[land.sack.kind] = true;
      if (land.sack.kind === "money") expect(s.money).toBe(land.sack.amount);
      if (land.sack.kind === "dynamite") expect(s.dynamite).toBe(1);
      if (land.sack.kind === "strength") expect(s.buffs.strength).toBe(true);
    }
    expect(saw).toEqual({ money: true, dynamite: true, strength: true });
  });
});

describe("levels", () => {
  it("time up with the goal met clears the level; short of it ends the run", () => {
    const win = rig([item("rockS", 20, 900)]);
    win.money = win.goal;
    let ev: GameEvent[] = [];
    for (let i = 0; i < 60 * (LEVEL_TIME + 1) && win.phase === "play"; i++)
      ev = update(win, {}, DT);
    expect(ev).toContainEqual({ type: "end", won: true });
    expect(win.phase).toBe("cleared");

    const lose = rig([item("rockS", 20, 900)]);
    lose.money = lose.goal - 1;
    for (let i = 0; i < 60 * (LEVEL_TIME + 1) && lose.phase === "play"; i++)
      ev = update(lose, {}, DT);
    expect(ev).toContainEqual({ type: "end", won: false });
    expect(lose.phase).toBe("over");
    // Nothing moves once it is over
    expect(update(lose, { fire: true }, DT)).toEqual([]);
  });

  it("counts down the last ten seconds", () => {
    const s = rig([item("rockS", 20, 900)]);
    s.money = s.goal;
    const ticks: number[] = [];
    while (s.phase === "play")
      for (const e of update(s, {}, DT))
        if (e.type === "tick") ticks.push(e.sec);
    expect(ticks).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it("ends early when the board is empty", () => {
    const s = rig([item("goldS", PIVOT.x, 400)]);
    s.money = s.goal;
    const ev = shoot(s);
    expect(ev).toContainEqual({ type: "end", won: true });
  });

  it("goals rise every level and money carries over", () => {
    for (let l = 2; l < 30; l++)
      expect(goalStep(l)).toBeGreaterThan(goalStep(l - 1));
    expect(goalFor(3)).toBe(goalStep(1) + goalStep(2) + goalStep(3));
  });

  it("generates the same board from the same seed and level", () => {
    expect(generateLevel(4, 123)).toEqual(generateLevel(4, 123));
    expect(generateLevel(4, 123)).not.toEqual(generateLevel(4, 124));
    expect(generateLevel(4, 123)).not.toEqual(generateLevel(5, 123));
  });

  it("keeps every board in bounds, without overlaps", () => {
    for (let seed = 1; seed <= 20; seed++)
      for (let l = 1; l <= 15; l++) {
        const items = generateLevel(l, seed);
        for (const it of items) {
          expect(it.x - it.r).toBeGreaterThanOrEqual(0);
          expect(it.x + it.r).toBeLessThanOrEqual(540);
          expect(it.y - it.r).toBeGreaterThan(
            tipOf({
              phase: 0,
              angle: 0,
              len: REST_LEN,
              mode: "swing",
              held: null,
            }).y,
          );
          expect(it.y + it.r).toBeLessThanOrEqual(960);
        }
        const fixed = items.filter((i) => i.speed === 0);
        for (const a of fixed)
          for (const b of fixed)
            if (a !== b)
              expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(
                a.r + b.r,
              );
      }
  });

  it("puts comfortably more value on every board than the level needs", () => {
    for (let seed = 1; seed <= 40; seed++)
      for (let l = 1; l <= 30; l++) {
        expect(boardValue(generateLevel(l, seed))).toBeGreaterThanOrEqual(
          1.6 * goalStep(l),
        );
      }
  });

  it("deeper levels: more rocks and moles, fewer small nuggets, gold further down", () => {
    const stats = (l: number) => {
      let rocks = 0;
      let moles = 0;
      let small = 0;
      let goldY = 0;
      let gold = 0;
      for (let seed = 1; seed <= 30; seed++)
        for (const it of generateLevel(l, seed)) {
          if (it.kind.startsWith("rock")) rocks++;
          if (it.kind.startsWith("mole")) moles++;
          if (it.kind === "goldS") small++;
          if (it.kind.startsWith("gold")) {
            goldY += it.y;
            gold++;
          }
        }
      return { rocks, moles, small, goldY: goldY / gold };
    };
    const a = stats(1);
    const b = stats(8);
    expect(b.rocks).toBeGreaterThan(a.rocks);
    expect(b.moles).toBeGreaterThan(a.moles);
    expect(b.small).toBeLessThan(a.small);
    expect(b.goldY).toBeGreaterThan(a.goldY);
  });
});

/** A simple player: waits for the swing to line up with something worth its time. */
function playLevel(s: State) {
  let waited = 0;
  const worth = (it: Item) => {
    if (it.kind.startsWith("rock") || it.kind === "mole") return 0;
    const d = Math.hypot(it.x - PIVOT.x, it.y - PIVOT.y);
    const v = it.kind === "sack" ? 150 : payout(it.kind, s.buffs);
    return v / (d / EXTEND_SPEED + d / pullSpeed(it, s.buffs.strength) + 0.8);
  };
  while (s.phase === "play") {
    let fire = false;
    if (s.claw.mode === "swing") {
      waited += DT;
      const best = Math.max(0, ...s.items.map(worth));
      const hit = firstHit(s);
      if (
        hit &&
        ((worth(hit) > 0 && worth(hit) >= best * 0.55) || waited > 2.5)
      )
        fire = true;
      if (fire) waited = 0;
    }
    const held = s.claw.held;
    update(s, { fire, dynamite: !!held && held.kind.startsWith("rock") }, DT);
  }
}

describe("balance", () => {
  it("a simple bot clears the early levels on most boards", () => {
    for (let l = 1; l <= 8; l++) {
      let cleared = 0;
      const runs = 20;
      for (let seed = 1; seed <= runs; seed++) {
        const s = createRun(seed * 7919);
        s.level = l;
        s.money = goalFor(l - 1);
        s.phase = "cleared";
        leaveShop(s);
        s.level = l; // leaveShop advanced it; lay the intended level out again
        s.items = generateLevel(l, s.seed);
        s.goal = goalFor(l);
        playLevel(s);
        if (s.phase === "cleared") cleared++;
      }
      expect(cleared / runs, `level ${l}`).toBeGreaterThanOrEqual(
        l <= 3 ? 0.85 : 0.5,
      );
    }
  });
});

describe("the shop", () => {
  function cleared(money: number) {
    const s = createRun(42);
    s.money = money;
    s.phase = "cleared";
    openShop(s);
    return s;
  }

  it("offers 3–4 different items at prices that vary", () => {
    const prices = new Set<number>();
    for (let seed = 1; seed < 30; seed++) {
      const s = createRun(seed);
      s.phase = "cleared";
      openShop(s);
      expect(s.phase).toBe("shop");
      expect(s.offers.length).toBeGreaterThanOrEqual(3);
      expect(s.offers.length).toBeLessThanOrEqual(4);
      expect(new Set(s.offers.map((o) => o.kind)).size).toBe(s.offers.length);
      for (const o of s.offers) if (o.kind === "dynamite") prices.add(o.price);
    }
    expect(prices.size).toBeGreaterThan(3);
  });

  it("takes the money once, and the item works next level", () => {
    const s = cleared(5000);
    s.offers = [
      { kind: "dynamite", price: 100, sold: false },
      { kind: "strength", price: 200, sold: false },
      { kind: "clover", price: 50, sold: false },
      { kind: "polish", price: 300, sold: false },
    ];
    expect(buy(s, 0)).toBe(true);
    expect(buy(s, 0)).toBe(false);
    expect(buy(s, 1)).toBe(true);
    expect(buy(s, 2)).toBe(true);
    expect(buy(s, 3)).toBe(true);
    expect(s.money).toBe(5000 - 650);
    expect(s.dynamite).toBe(1);
    expect(s.buffs.strength).toBe(false);
    leaveShop(s);
    expect(s.level).toBe(2);
    expect(s.phase).toBe("play");
    expect(s.buffs).toEqual({
      strength: true,
      lucky: true,
      polish: true,
      book: false,
    });
    expect(s.money).toBe(5000 - 650);
    expect(s.time).toBe(LEVEL_TIME);
    // Buffs last one level only
    s.phase = "cleared";
    leaveShop(s);
    expect(s.buffs).toEqual(noBuffs);
  });

  it("refuses what the bank cannot pay for", () => {
    const s = cleared(40);
    s.offers = [{ kind: "book", price: 45, sold: false }];
    expect(canBuy(s, 0)).toBe(false);
    expect(buy(s, 0)).toBe(false);
    expect(s.money).toBe(40);
  });

  it("can be skipped", () => {
    const s = cleared(900);
    leaveShop(s);
    expect(s.level).toBe(2);
    expect(s.money).toBe(900);
    expect(s.goal).toBe(goalFor(2));
  });
});
