import { describe, expect, it } from "vitest";
import { BED_INCOME, COUNTDOWN, DOOR_HP, TURRET_DAMAGE } from "./config";
import {
  type Action,
  type GameState,
  type Pt,
  bedTile,
  canStand,
  createGame,
  doorStand,
  pathToBed,
  planBuy,
  player,
  tilesByDoor,
  update,
} from "./logic";

const STEP = 1 / 30;

function run(
  s: GameState,
  seconds: number,
  actions: (s: GameState) => Action[] = () => [],
) {
  for (let t = 0; t < seconds && s.phase !== "over"; t += STEP) {
    update(s, STEP, actions(s));
    s.events.length = 0;
  }
}

/** Steer the player along a path with the stick, as a person would. */
function walk(s: GameState, path: Pt[], seconds = 12) {
  const pts = [...path];
  for (
    let t = 0;
    t < seconds && pts.length > 0 && s.phase === "setup";
    t += STEP
  ) {
    const me = player(s);
    const next = pts[0];
    const dx = next.x - me.x;
    const dy = next.y - me.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      pts.shift();
      continue;
    }
    update(s, STEP, [], { x: dx / d, y: dy / d });
    s.events.length = 0;
  }
  return pts.length === 0;
}

/** Walk to the nearest room no bot is heading for, and get into bed. */
function sleepFast(s: GameState) {
  const me = player(s);
  const free = s.rooms
    .filter(
      (r) =>
        r.owner === null &&
        !s.occupants.some((o) => o.bot && o.room === r.index),
    )
    .sort(
      (a, b) =>
        pathLength(pathToBed(me, a.index), me) -
        pathLength(pathToBed(me, b.index), me),
    )[0];
  if (!free) return null;
  walk(s, pathToBed(me, free.index));
  update(s, STEP, [{ type: "sleep" }]);
  s.events.length = 0;
  return s.playerRoom;
}

function pathLength(path: Pt[], from: Pt) {
  let len = 0;
  let p = from;
  for (const q of path) {
    len += Math.hypot(q.x - p.x, q.y - p.y);
    p = q;
  }
  return len;
}

describe("setup", () => {
  it("everyone finds a bed before the countdown ends", () => {
    const s = createGame(1);
    expect(sleepFast(s)).not.toBeNull();
    run(s, COUNTDOWN);
    expect(s.phase).toBe("night");
    expect(s.occupants.every((o) => o.asleep)).toBe(true);
    expect(s.rooms.filter((r) => r.owner !== null).length).toBe(6);
  });

  it("staying out of bed when the countdown ends is fatal", () => {
    const s = createGame(1);
    run(s, COUNTDOWN + 1);
    expect(s.phase).toBe("over");
    expect(s.result?.won).toBe(false);
  });

  it("a taken bed refuses you (ad rule 2)", () => {
    const s = createGame(2);
    run(s, 10);
    const taken = s.rooms.find((r) => r.owner !== null);
    if (!taken) throw new Error("no bot asleep yet");
    expect(walk(s, pathToBed(player(s), taken.index))).toBe(true);
    update(s, STEP, [{ type: "sleep" }]);
    expect(s.events.map((e) => e.type)).toContain("roomTaken");
    expect(player(s).asleep).toBe(false);
  });

  it("walls stop the player; corridors, doors and rooms do not", () => {
    const s = createGame(3);
    const me = player(s);
    expect(canStand(me.x, me.y)).toBe(true);
    // Every room's route is walkable all the way to the bed
    for (const room of s.rooms) {
      const t = createGame(3);
      expect(
        walk(t, pathToBed(player(t), room.index), 20),
        `room ${room.index}`,
      ).toBe(true);
    }
    // Slightly past a corridor mouth, pushing straight up still slides you in
    const near = createGame(3);
    const p = player(near);
    p.x = 300 - 40 + 3; // corridor A's left edge is at 260; the body overhangs by 6px
    p.y = 470;
    for (let i = 0; i < 60; i++) update(near, STEP, [], { x: 0, y: -1 });
    expect(player(near).y).toBeLessThan(430);
    // Straight up from the hall into the brick between corridors: blocked
    const y0 = me.y;
    for (let i = 0; i < 120; i++) update(s, STEP, [], { x: 0, y: -1 });
    expect(player(s).y).toBeGreaterThan(y0 - 120);
  });
});

describe("economy", () => {
  it("sleeping earns gold every second (ad: +1 at level 1)", () => {
    const s = createGame(3);
    sleepFast(s);
    const room = s.rooms[s.playerRoom ?? 0];
    const before = room.gold;
    run(s, 3);
    expect(room.gold - before).toBe(3 * BED_INCOME[0]);
  });

  it("builds a turret for 8 gold, never on the bed, and upgrades the door", () => {
    const s = createGame(4);
    sleepFast(s);
    run(s, COUNTDOWN);
    const room = s.rooms[s.playerRoom ?? 0];
    room.gold = 100;
    update(s, STEP, [
      { type: "build", tile: bedTile(room.index), kind: "turret" },
    ]);
    expect(room.tiles[bedTile(room.index)]).toBeNull();
    const tile = tilesByDoor(room.index)[0];
    update(s, STEP, [
      { type: "build", tile, kind: "turret" },
      { type: "upgradeDoor" },
    ]);
    expect(room.tiles[tile]?.kind).toBe("turret");
    expect(room.doorLevel).toBe(2);
    expect(room.doorHp).toBeGreaterThan(DOOR_HP[0]);
  });

  it("turrets near the door shoot the hunter while it hits that door", () => {
    const s = createGame(5);
    sleepFast(s);
    run(s, COUNTDOWN);
    const room = s.rooms[s.playerRoom ?? 0];
    room.gold = 8;
    update(s, STEP, [
      { type: "build", tile: tilesByDoor(room.index)[0], kind: "turret" },
    ]);
    const h = s.hunter;
    if (!h) throw new Error("no hunter");
    const stand = doorStand(room.index);
    Object.assign(h, {
      mode: "attack",
      target: room.index,
      path: [],
      x: stand.x,
      y: stand.y,
      hitTimer: 99,
    });
    const hp = h.hp;
    run(s, 1);
    expect(hp - h.hp).toBeGreaterThanOrEqual(TURRET_DAMAGE[0]);
  });
});

/** A sensible player: one purchase a second with the same planner the bots use. */
const builder = (s: GameState): Action[] => {
  if (
    s.phase === "night" &&
    s.playerRoom !== null &&
    Math.floor(s.time * 30) % 30 === 0
  )
    planBuy(s, s.rooms[s.playerRoom]);
  return [];
};

describe("balance", () => {
  it("a builder usually takes the hunter down; a sleeper who never builds is eaten", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const results = seeds.map((seed) => {
      const s = createGame(seed);
      sleepFast(s);
      run(s, 600, builder);
      return s;
    });
    const wins = results.filter((s) => s.result?.won).length;
    const times = results.map((s) => Math.round(s.nightTime));
    // Winnable but not automatic, and a win takes a few minutes
    for (const s of results.filter((r) => r.result?.won))
      expect(s.nightTime).toBeGreaterThan(150);
    expect(wins, `wins ${wins}/8, night times ${times}`).toBeGreaterThanOrEqual(
      4,
    );
    expect(wins, `wins ${wins}/8, night times ${times}`).toBeLessThanOrEqual(7);

    const idle = createGame(1);
    sleepFast(idle);
    run(idle, 900);
    expect(idle.result?.won).toBe(false);
    expect(idle.nightTime).toBeLessThan(120);
  });
});
