import { describe, expect, it } from "vitest";
import { BED_INCOME, COUNTDOWN, DOOR_HP, TURRET_DAMAGE } from "./config";
import {
  type Action,
  type GameState,
  type Pt,
  bedTile,
  canStand,
  createGame,
  humans,
  scoreOf,
  tileCenter,
  doorStand,
  pathToBed,
  planBuy,
  player,
  roomOf,
  solo,
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
    update(s, STEP, solo(actions(s)));
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
    update(s, STEP, solo([], { x: dx / d, y: dy / d }));
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
  update(s, STEP, solo([{ type: "sleep" }]));
  s.events.length = 0;
  return roomOf(s)?.index ?? null;
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
    update(s, STEP, solo([{ type: "sleep" }]));
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
    for (let i = 0; i < 60; i++) update(near, STEP, solo([], { x: 0, y: -1 }));
    expect(player(near).y).toBeLessThan(430);
    // Straight up from the hall into the brick between corridors: blocked
    const y0 = me.y;
    for (let i = 0; i < 120; i++) update(s, STEP, solo([], { x: 0, y: -1 }));
    expect(player(s).y).toBeGreaterThan(y0 - 120);
  });
});

describe("economy", () => {
  it("sleeping earns gold every second (ad: +1 at level 1)", () => {
    const s = createGame(3);
    sleepFast(s);
    const room = (roomOf(s) ?? s.rooms[0]);
    const before = room.gold;
    run(s, 3);
    expect(room.gold - before).toBe(3 * BED_INCOME[0]);
  });

  it("builds a turret for 8 gold, never on the bed, and upgrades the door", () => {
    const s = createGame(4);
    sleepFast(s);
    run(s, COUNTDOWN);
    const room = (roomOf(s) ?? s.rooms[0]);
    room.gold = 100;
    update(s, STEP, solo([
      { type: "build", tile: bedTile(room.index), kind: "turret" },
    ]));
    expect(room.tiles[bedTile(room.index)]).toBeNull();
    const tile = tilesByDoor(room.index)[0];
    update(s, STEP, solo([
      { type: "build", tile, kind: "turret" },
      { type: "upgradeDoor" },
    ]));
    expect(room.tiles[tile]?.kind).toBe("turret");
    expect(room.doorLevel).toBe(2);
    expect(room.doorHp).toBeGreaterThan(DOOR_HP[0]);
  });

  it("turrets near the door shoot the hunter while it hits that door", () => {
    const s = createGame(5);
    sleepFast(s);
    run(s, COUNTDOWN);
    const room = (roomOf(s) ?? s.rooms[0]);
    room.gold = 8;
    update(s, STEP, solo([
      { type: "build", tile: tilesByDoor(room.index)[0], kind: "turret" },
    ]));
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
  const room = roomOf(s);
  if (s.phase === "night" && room && Math.floor(s.time * 30) % 30 === 0)
    planBuy(s, room);
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

/** Put a human seat straight into a free bed (the walk is covered above). */
function bedDown(s: GameState, seat: number) {
  const room = s.rooms.find((r) => r.owner === null && !s.occupants.some((o) => o.room === r.index));
  if (!room) throw new Error("no free room");
  Object.assign(s.occupants[seat], tileCenter(room.index, bedTile(room.index)));
  update(s, STEP, { [seat]: { actions: [{ type: "sleep" }] } });
  return room;
}

describe("co-op seats", () => {
  const crew = [{ name: "An" }, { name: "Bình" }, { name: "Chi" }];

  it("seats humans first and fills the rest with bots, six in all", () => {
    const s = createGame(1, crew);
    expect(s.occupants).toHaveLength(6);
    expect(humans(s).map((o) => o.name)).toEqual(["An", "Bình", "Chi"]);
    expect(s.occupants.slice(3).every((o) => o.bot !== null)).toBe(true);
    expect(createGame(1, Array.from({ length: 9 }, () => ({ name: "x" }))).occupants.every((o) => !o.bot)).toBe(true);
  });

  it("each seat moves and sleeps on its own input", () => {
    const s = createGame(2, crew.slice(0, 2));
    const y0 = s.occupants[1].y;
    for (let i = 0; i < 10; i++) update(s, STEP, { 1: { move: { x: 0, y: -1 } } });
    expect(s.occupants[1].y).toBeLessThan(y0);
    const room = bedDown(s, 1);
    expect(room.owner).toBe(1);
    expect(roomOf(s, 1)).toBe(room);
    expect(roomOf(s, 0)).toBeNull();
  });

  it("a human who misses the night is out, but the team plays on", () => {
    const s = createGame(3, crew.slice(0, 2));
    bedDown(s, 0);
    const seen: string[] = [];
    for (let t = 0; t < COUNTDOWN + 1; t += STEP) {
      update(s, STEP);
      for (const e of s.events) if (e.type === "caught") seen.push(`caught:${e.occupant}`);
      s.events.length = 0;
    }
    expect(seen).toEqual(["caught:1"]);
    expect(s.phase).toBe("night");
    expect(s.occupants[1].diedAt).toBe(0);
    expect(scoreOf(s, 1)).toBe(0);
  });

  it("the hunter never opens on a human's room", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = createGame(seed, crew);
      for (let i = 0; i < 3; i++) bedDown(s, i);
      run(s, COUNTDOWN + 4);
      const target = s.hunter?.target;
      expect(target).not.toBeNull();
      expect(s.occupants.some((o) => !o.bot && o.room === target)).toBe(false);
    }
  });

  it("the match ends only when every human is out", () => {
    const s = createGame(4, crew.slice(0, 2));
    bedDown(s, 0);
    bedDown(s, 1);
    run(s, COUNTDOWN + 1);
    const h = s.hunter;
    if (!h) throw new Error("no hunter");
    const breakRoom = (seat: number) => {
      const room = roomOf(s, seat);
      if (!room) throw new Error("no room");
      Object.assign(h, { mode: "attack", target: room.index, path: [], hitTimer: 0, hit: 1e9, rest: 0 });
      run(s, STEP * 2);
    };
    breakRoom(0);
    expect(s.occupants[0].alive).toBe(false);
    expect(s.phase).toBe("night");
    breakRoom(1);
    expect(s.phase).toBe("over");
    expect(s.result?.won).toBe(false);
  });

  it("taking the hunter down pays the bonus to every human", () => {
    const s = createGame(5, crew.slice(0, 2));
    bedDown(s, 0);
    bedDown(s, 1);
    run(s, COUNTDOWN + 1);
    const h = s.hunter;
    if (!h) throw new Error("no hunter");
    h.hp = 0.01;
    const room = roomOf(s, 0);
    if (!room) throw new Error("no room");
    room.tiles[tilesByDoor(room.index)[0]] = { kind: "turret", level: 1, cooldown: 0 };
    Object.assign(h, { mode: "attack", target: room.index, path: [], hitTimer: 99, ...doorStand(room.index) });
    run(s, 1);
    expect(s.result?.won).toBe(true);
    expect(scoreOf(s, 0)).toBeGreaterThanOrEqual(5000);
    expect(scoreOf(s, 1)).toBeGreaterThanOrEqual(5000);
  });

  it("an autopilot seat keeps buying for its room", () => {
    const s = createGame(6, crew.slice(0, 2));
    bedDown(s, 0);
    const room = bedDown(s, 1);
    s.occupants[1].autopilot = true;
    room.gold = 500;
    run(s, 5);
    expect(room.gold).toBeLessThan(500);
  });

  it("the whole state is plain data that survives JSON", () => {
    const s = createGame(7, crew);
    run(s, 3);
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    run(s, 2);
    run(copy, 2);
    expect(copy.occupants.map((o) => [o.x, o.y])).toEqual(s.occupants.map((o) => [o.x, o.y]));
    expect(copy.seed).toBe(s.seed);
  });
});
