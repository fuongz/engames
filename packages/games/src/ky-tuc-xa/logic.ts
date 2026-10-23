import { mulberry32 } from "../core/math";
import {
  ACCELERATOR_SPEED,
  ARCADE_ENERGY_EVERY,
  BED_COST,
  BED_INCOME,
  BED_REACH,
  BOT_NAMES,
  BOT_SPEED,
  BOT_THINK,
  BUILDS,
  type BuildKind,
  COLS,
  CORRIDOR_W,
  CORRIDOR_X,
  COUNTDOWN,
  DOOR_COST,
  DOOR_HP,
  HALL,
  HALL_X,
  HALL_Y,
  HEAL_DECAY,
  HEAL_RATE,
  HUNTER_HIT,
  HUNTER_HIT_EVERY,
  HUNTER_HP,
  HUNTER_SPEED,
  LEVEL_EVERY,
  LEVEL_HIT,
  LEVEL_HP,
  MAX_RETREATS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RANGE_UNIT,
  REPAIR_COOLDOWN,
  REPAIR_FRACTION,
  RETREAT_AT,
  ROOM_COUNT,
  ROOM_H,
  ROOM_W,
  ROOM_X,
  ROW_Y,
  ROWS,
  STATION_REGEN,
  TILE,
  TURRET_DAMAGE,
  TURRET_INTERVAL,
  TURRET_RANGE,
  TURRET_UPGRADE,
  WATCHTOWER_RANGE,
} from "./config";

// Pure simulation: no DOM, no canvas. The renderer reads state and drains
// `events` each frame for sound, popups and effects.

export interface Pt {
  x: number;
  y: number;
}

export type BotName = (typeof BOT_NAMES)[number];

export interface Occupant {
  id: number;
  /** null = the player. */
  bot: BotName | null;
  x: number;
  y: number;
  path: Pt[];
  speed: number;
  /** Room they are heading to or sleeping in; -1 = wandering. */
  room: number;
  asleep: boolean;
  alive: boolean;
  /** Bots wait this long before picking a room. */
  delay: number;
  think: number;
}

export interface Building {
  kind: BuildKind;
  level: number;
  cooldown: number;
}

export interface Room {
  index: number;
  owner: number | null;
  bedLevel: number;
  doorLevel: number;
  doorHp: number;
  tiles: (Building | null)[];
  gold: number;
  energy: number;
  goldEarned: number;
  arcadeTimer: number;
  incomeTimer: number;
  repairCooldown: number;
  /** ad rule 5: a room whose light went out lost its sleeper. */
  dark: boolean;
}

export type HunterMode = "walk" | "attack" | "retreat" | "heal" | "dead";

export interface Hunter {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hit: number;
  level: number;
  levelTimer: number;
  mode: HunterMode;
  target: number | null;
  path: Pt[];
  hitTimer: number;
  flash: number;
  /** Brief pause after breaking a door. */
  rest: number;
  retreats: number;
}

export type Action =
  | { type: "sleep" }
  | { type: "build"; tile: number; kind: BuildKind }
  | { type: "upgradeTurret"; tile: number }
  | { type: "upgradeBed" }
  | { type: "upgradeDoor" }
  | { type: "repair" };

export type GameEvent =
  | { type: "tick"; n: number }
  | { type: "asleep"; room: number; player: boolean }
  | { type: "roomTaken"; room: number }
  | { type: "night" }
  | { type: "caught" }
  | { type: "income"; room: number; amount: number }
  | { type: "built"; room: number; tile: number; kind: BuildKind }
  | {
      type: "upgraded";
      room: number;
      what: "turret" | "bed" | "door";
      tile?: number;
    }
  | { type: "repaired"; room: number }
  | { type: "shot"; from: Pt; to: Pt; room: number }
  | { type: "doorHit"; room: number }
  | { type: "doorBroken"; room: number; player: boolean }
  | { type: "levelUp"; level: number }
  | { type: "retreat" }
  | { type: "hunterDown" }
  | { type: "end"; won: boolean };

export interface Result {
  won: boolean;
  /** Seconds since the hunter was released. */
  nightTime: number;
  level: number;
}

export interface GameState {
  phase: "setup" | "night" | "over";
  countdown: number;
  time: number;
  nightTime: number;
  rooms: Room[];
  occupants: Occupant[];
  hunter: Hunter | null;
  /** Room the player sleeps in, once asleep. */
  playerRoom: number | null;
  firstTarget: boolean;
  score: number;
  result: Result | null;
  events: GameEvent[];
  rng: () => number;
}

// ---------------------------------------------------------------- geometry

/** Column 0/2 rooms sit left of their corridor, 1/3 right of it. */
export const isLeft = (room: number) => room % 2 === 0;
const column = (room: number) => room % 4;
const corridorOf = (room: number) => (column(room) < 2 ? 0 : 1);
export const corridorX = (room: number) => CORRIDOR_X[corridorOf(room)];

export function roomRect(room: number) {
  return {
    x: ROOM_X[column(room)],
    y: ROW_Y[Math.floor(room / 4)],
    w: ROOM_W,
    h: ROOM_H,
  };
}

/** The tile grid inside a room. */
export function gridOrigin(room: number) {
  const r = roomRect(room);
  return { x: r.x + 14, y: r.y + 24 };
}

export function tileCenter(room: number, tile: number): Pt {
  const o = gridOrigin(room);
  return {
    x: o.x + (tile % COLS) * TILE + TILE / 2,
    y: o.y + Math.floor(tile / COLS) * TILE + TILE / 2,
  };
}

/** The bed sits in the top corner nearest the corridor. */
export const bedTile = (room: number) => (isLeft(room) ? COLS - 1 : 0);

/** The door is in the corridor wall, level with the bottom row. */
export function doorPos(room: number): Pt {
  const r = roomRect(room);
  const y = gridOrigin(room).y + (ROWS - 1) * TILE + TILE / 2;
  return { x: isLeft(room) ? r.x + r.w : r.x, y };
}

/** Where the hunter stands to hit a door. */
export function doorStand(room: number): Pt {
  const d = doorPos(room);
  return { x: d.x + (isLeft(room) ? 22 : -22), y: d.y };
}

export function tileAt(room: number, x: number, y: number): number | null {
  const o = gridOrigin(room);
  const c = Math.floor((x - o.x) / TILE);
  const r = Math.floor((y - o.y) / TILE);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  return r * COLS + c;
}

export function roomAt(x: number, y: number): number | null {
  for (let i = 0; i < ROOM_COUNT; i++) {
    const r = roomRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return null;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everywhere a person can stand: corridors, the hall, room floors and the door gaps between them. */
export const WALKABLE: Box[] = (() => {
  const boxes: Box[] = [];
  const top = ROW_Y[0];
  const bottom = ROW_Y[ROW_Y.length - 1] + ROOM_H;
  for (const cx of CORRIDOR_X)
    boxes.push({
      x: cx - CORRIDOR_W / 2,
      y: top,
      w: CORRIDOR_W,
      h: bottom - top,
    });
  boxes.push(HALL);
  for (let i = 0; i < ROOM_COUNT; i++) {
    const o = gridOrigin(i);
    boxes.push({ x: o.x, y: o.y, w: COLS * TILE, h: ROWS * TILE });
    const d = doorPos(i);
    const fx = isLeft(i)
      ? o.x + COLS * TILE - 2
      : corridorX(i) + CORRIDOR_W / 2 - 2;
    const tx = isLeft(i) ? corridorX(i) - CORRIDOR_W / 2 + 2 : o.x + 2;
    boxes.push({
      x: Math.min(fx, tx),
      y: d.y - 20,
      w: Math.abs(tx - fx),
      h: 40,
    });
  }
  return boxes;
})();

const inBox = (b: Box, x: number, y: number) =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const walkablePoint = (x: number, y: number) =>
  WALKABLE.some((b) => inBox(b, x, y));

/** A body of PLAYER_RADIUS fits if all four corners of its box stand on floor (they may be in different boxes). */
export function canStand(x: number, y: number) {
  const r = PLAYER_RADIUS;
  return (
    walkablePoint(x - r, y - r) &&
    walkablePoint(x + r, y - r) &&
    walkablePoint(x - r, y + r) &&
    walkablePoint(x + r, y + r)
  );
}

const inHall = (p: Pt) => inBox(HALL, p.x, p.y);

/** Corridor-and-hall route between two points that are each in a corridor or the hall. */
function route(from: Pt, to: Pt, toCorridorX: number): Pt[] {
  const fromCorridor = CORRIDOR_X.reduce((a, b) =>
    Math.abs(b - from.x) < Math.abs(a - from.x) ? b : a,
  );
  if (!inHall(from) && fromCorridor === toCorridorX)
    return [{ x: toCorridorX, y: from.y }, { x: toCorridorX, y: to.y }, to];
  const pts: Pt[] = [];
  if (!inHall(from))
    pts.push({ x: fromCorridor, y: from.y }, { x: fromCorridor, y: HALL_Y });
  else pts.push({ x: from.x, y: HALL_Y });
  pts.push({ x: toCorridorX, y: HALL_Y }, { x: toCorridorX, y: to.y }, to);
  return pts;
}

/** Corridor route to a room's bed (bots walk it; tests steer the player along it). */
export function pathToBed(from: Pt, room: number): Pt[] {
  const d = doorPos(room);
  const inside = { x: d.x + (isLeft(room) ? -26 : 26), y: d.y };
  const bed = tileCenter(room, bedTile(room));
  return [
    ...route(from, { x: corridorX(room), y: d.y }, corridorX(room)),
    inside,
    bed,
  ];
}

function pathToDoor(from: Pt, room: number): Pt[] {
  return route(from, doorStand(room), corridorX(room));
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** The free-or-taken bed the player is standing at, if any. */
export function bedNear(s: GameState): number | null {
  const me = s.occupants[0];
  if (me.asleep || !me.alive) return null;
  for (let i = 0; i < ROOM_COUNT; i++)
    if (dist(me, tileCenter(i, bedTile(i))) <= BED_REACH) return i;
  return null;
}

// ---------------------------------------------------------------- setup

export function createGame(seed = Date.now()): GameState {
  const rng = mulberry32(seed);
  const rooms: Room[] = [];
  for (let i = 0; i < ROOM_COUNT; i++) {
    rooms.push({
      index: i,
      owner: null,
      bedLevel: 1,
      doorLevel: 1,
      doorHp: DOOR_HP[0],
      tiles: new Array(COLS * ROWS).fill(null),
      gold: 0,
      energy: 0,
      goldEarned: 0,
      arcadeTimer: 0,
      incomeTimer: 0,
      repairCooldown: 0,
      dark: false,
    });
  }
  const occupants: Occupant[] = [];
  const spawn = (i: number) => ({
    x: HALL_X + (i - 2.5) * 26,
    y: HALL_Y + (i % 2 ? 18 : -18),
  });
  occupants.push({
    id: 0,
    bot: null,
    ...spawn(0),
    path: [],
    speed: PLAYER_SPEED,
    room: -1,
    asleep: false,
    alive: true,
    delay: 0,
    think: 0,
  });
  BOT_NAMES.forEach((name, i) => {
    occupants.push({
      id: i + 1,
      bot: name,
      ...spawn(i + 1),
      path: [],
      speed: BOT_SPEED[i],
      room: -1,
      asleep: false,
      alive: true,
      delay: 0.4 + rng() * 2.2,
      think: rng() * BOT_THINK,
    });
  });
  return {
    phase: "setup",
    countdown: COUNTDOWN,
    time: 0,
    nightTime: 0,
    rooms,
    occupants,
    hunter: null,
    playerRoom: null,
    firstTarget: true,
    score: 0,
    result: null,
    events: [],
    rng,
  };
}

export const player = (s: GameState) => s.occupants[0];

/** `move` is the player's stick or keys, each axis in [-1, 1]. */
export function update(
  s: GameState,
  dt: number,
  actions: Action[] = [],
  move: Pt = { x: 0, y: 0 },
) {
  if (s.phase === "over") return;
  s.time += dt;
  for (const a of actions) act(s, a);

  walkPlayer(s, move, dt);
  for (const o of s.occupants) if (o.bot) followPath(s, o, dt);

  if (s.phase === "setup") {
    const before = Math.ceil(s.countdown);
    s.countdown -= dt;
    const now = Math.ceil(s.countdown);
    if (now !== before && now >= 0) s.events.push({ type: "tick", n: now });
    for (const o of s.occupants)
      if (o.bot && !o.asleep && o.alive) botSeekRoom(s, o, dt);
    // ad: building already works during the countdown, once you are in bed
    for (const o of s.occupants)
      if (o.bot && o.asleep && o.alive) botThink(s, o, dt);
    if (s.countdown <= 0) startNight(s);
  } else {
    s.nightTime += dt;
    if (s.hunter) updateHunter(s, s.hunter, dt);
    fireTurrets(s, dt);
    for (const o of s.occupants)
      if (o.bot && o.asleep && o.alive) botThink(s, o, dt);
  }
  economy(s, dt);
  s.score = scoreOf(s);
}

/** How far the player is slid sideways to line up with an opening they are pushing into. */
const CORNER_ASSIST = 16;

/**
 * Free movement with wall collision, one axis at a time so walls slide. When an
 * axis is blocked but an opening (corridor mouth, doorway) is a few pixels to
 * the side, the player is eased into line with it, as in Pac-Man cornering.
 */
function walkPlayer(s: GameState, move: Pt, dt: number) {
  const me = s.occupants[0];
  if (!me.alive || me.asleep || s.phase !== "setup") return;
  const len = Math.hypot(move.x, move.y);
  if (len < 0.05) return;
  const step = Math.min(1, len) * me.speed * dt;
  const dx = (move.x / len) * step;
  const dy = (move.y / len) * step;
  if (Math.abs(dx) > 1e-6) {
    if (canStand(me.x + dx, me.y)) me.x += dx;
    else if (Math.abs(dy) < Math.abs(dx) * 0.5)
      me.y += assist((o) => canStand(me.x + dx, me.y + o), step);
  }
  if (Math.abs(dy) > 1e-6) {
    if (canStand(me.x, me.y + dy)) me.y += dy;
    else if (Math.abs(dx) < Math.abs(dy) * 0.5)
      me.x += assist((o) => canStand(me.x + o, me.y + dy), step);
  }
}

/** The sideways nudge toward the nearest offset that would let the move through (0 if none is close). */
function assist(fits: (offset: number) => boolean, step: number) {
  for (let off = 1; off <= CORNER_ASSIST; off++) {
    for (const sign of [-1, 1])
      if (fits(sign * off)) return sign * Math.min(off, step);
  }
  return 0;
}

function followPath(s: GameState, o: Occupant, dt: number) {
  if (!o.alive || o.asleep) return;
  let budget = o.speed * dt;
  while (budget > 0 && o.path.length > 0) {
    const next = o.path[0];
    const d = dist(o, next);
    if (d <= budget) {
      o.x = next.x;
      o.y = next.y;
      budget -= d;
      o.path.shift();
    } else {
      o.x += ((next.x - o.x) / d) * budget;
      o.y += ((next.y - o.y) / d) * budget;
      budget = 0;
    }
  }
  if (o.path.length === 0 && o.room >= 0) botArrive(s, o);
}

/** A bot at a bed: sleep if it is free, otherwise (ad rule 2) leave and pick again. */
function botArrive(s: GameState, o: Occupant) {
  const room = s.rooms[o.room];
  if (room.owner === null && s.phase === "setup") {
    claim(s, o, room);
    return;
  }
  o.room = -1;
  o.path = [{ x: corridorX(room.index), y: doorPos(room.index).y }];
}

function claim(s: GameState, o: Occupant, room: Room) {
  room.owner = o.id;
  o.room = room.index;
  o.asleep = true;
  const bed = tileCenter(room.index, bedTile(room.index));
  o.x = bed.x;
  o.y = bed.y;
  o.path = [];
  if (!o.bot) s.playerRoom = room.index;
  s.events.push({ type: "asleep", room: room.index, player: !o.bot });
}

function claimedBy(s: GameState, room: number, except: Occupant) {
  return s.occupants.some(
    (o) => o !== except && o.alive && o.room === room && (o.asleep || o.bot),
  );
}

function botSeekRoom(s: GameState, o: Occupant, dt: number) {
  if (o.room >= 0) return;
  o.delay -= dt;
  if (o.delay > 0) return;
  // Bots avoid rooms another bot is heading for, but happily race the player
  const free = s.rooms.filter(
    (r) => r.owner === null && !claimedBy(s, r.index, o),
  );
  if (free.length === 0) return;
  const pick = free[Math.floor(s.rng() * free.length)];
  o.room = pick.index;
  o.path = pathToBed(o, pick.index);
}

function startNight(s: GameState) {
  s.phase = "night";
  s.countdown = 0;
  for (const o of s.occupants) {
    if (o.asleep || !o.alive) continue;
    o.alive = false;
    if (!o.bot) {
      s.events.push({ type: "caught" });
      end(s, false);
      return;
    }
  }
  s.hunter = {
    x: HALL_X,
    y: HALL_Y,
    hp: HUNTER_HP,
    maxHp: HUNTER_HP,
    hit: HUNTER_HIT,
    level: 1,
    levelTimer: LEVEL_EVERY,
    mode: "heal",
    target: null,
    path: [],
    hitTimer: 0,
    flash: 0,
    rest: 1.2,
    retreats: 0,
  };
  s.events.push({ type: "night" });
}

// ---------------------------------------------------------------- economy & actions

function economy(s: GameState, dt: number) {
  for (const room of s.rooms) {
    if (room.owner === null || room.dark) continue;
    room.repairCooldown = Math.max(0, room.repairCooldown - dt);
    room.incomeTimer += dt;
    while (room.incomeTimer >= 1) {
      room.incomeTimer -= 1;
      const amount = BED_INCOME[room.bedLevel - 1];
      room.gold += amount;
      room.goldEarned += amount;
      s.events.push({ type: "income", room: room.index, amount });
    }
    const arcades = count(room, "arcade");
    if (arcades > 0) {
      room.arcadeTimer += dt * arcades;
      while (room.arcadeTimer >= ARCADE_ENERGY_EVERY) {
        room.arcadeTimer -= ARCADE_ENERGY_EVERY;
        room.energy += 1;
      }
    }
    const stations = count(room, "station");
    if (stations > 0)
      room.doorHp = Math.min(
        maxDoorHp(room),
        room.doorHp + maxDoorHp(room) * STATION_REGEN * stations * dt,
      );
  }
}

export const maxDoorHp = (room: Room) => DOOR_HP[room.doorLevel - 1];
export const count = (room: Room, kind: BuildKind) =>
  room.tiles.filter((b) => b?.kind === kind).length;

export function canBuild(room: Room, kind: BuildKind) {
  const spec = BUILDS[kind];
  if (count(room, kind) >= spec.limit) return false;
  return (spec.currency === "gold" ? room.gold : room.energy) >= spec.cost;
}

export const bedUpgradeCost = (room: Room) =>
  BED_COST[room.bedLevel - 1] ?? null;
export const doorUpgradeCost = (room: Room) =>
  DOOR_COST[room.doorLevel - 1] ?? null;
export const turretUpgradeCost = (b: Building) =>
  TURRET_UPGRADE[b.level - 1] ?? null;

function act(s: GameState, a: Action) {
  const me = player(s);
  if (a.type === "sleep") {
    const near = bedNear(s);
    if (near === null || s.phase !== "setup") return;
    const room = s.rooms[near];
    if (room.owner === null) claim(s, me, room);
    else s.events.push({ type: "roomTaken", room: near });
    return;
  }
  if (s.playerRoom === null) return;
  apply(s, s.rooms[s.playerRoom], a);
}

/** One purchase for any room (the player's actions and the bots' go through here). */
function apply(s: GameState, room: Room, a: Action): boolean {
  if (room.dark) return false;
  if (a.type === "build") {
    if (
      a.tile === bedTile(room.index) ||
      room.tiles[a.tile] ||
      !canBuild(room, a.kind)
    )
      return false;
    const spec = BUILDS[a.kind];
    if (spec.currency === "gold") room.gold -= spec.cost;
    else room.energy -= spec.cost;
    room.tiles[a.tile] = { kind: a.kind, level: 1, cooldown: 0 };
    s.events.push({
      type: "built",
      room: room.index,
      tile: a.tile,
      kind: a.kind,
    });
    return true;
  }
  if (a.type === "upgradeTurret") {
    const b = room.tiles[a.tile];
    if (b?.kind !== "turret") return false;
    const cost = turretUpgradeCost(b);
    if (cost === null || room.gold < cost) return false;
    room.gold -= cost;
    b.level++;
    s.events.push({
      type: "upgraded",
      room: room.index,
      what: "turret",
      tile: a.tile,
    });
    return true;
  }
  if (a.type === "upgradeBed") {
    const cost = bedUpgradeCost(room);
    if (cost === null || room.gold < cost) return false;
    room.gold -= cost;
    room.bedLevel++;
    s.events.push({ type: "upgraded", room: room.index, what: "bed" });
    return true;
  }
  if (a.type === "upgradeDoor") {
    const cost = doorUpgradeCost(room);
    if (cost === null || room.gold < cost) return false;
    room.gold -= cost;
    const ratio = room.doorHp / maxDoorHp(room);
    room.doorLevel++;
    // A new door comes in at the same health fraction, plus a little
    room.doorHp = Math.min(
      maxDoorHp(room),
      maxDoorHp(room) * ratio + maxDoorHp(room) * 0.15,
    );
    s.events.push({ type: "upgraded", room: room.index, what: "door" });
    return true;
  }
  if (a.type === "repair") {
    if (room.repairCooldown > 0 || room.doorHp >= maxDoorHp(room)) return false;
    room.doorHp = Math.min(
      maxDoorHp(room),
      room.doorHp + maxDoorHp(room) * REPAIR_FRACTION,
    );
    room.repairCooldown = REPAIR_COOLDOWN;
    s.events.push({ type: "repaired", room: room.index });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- turrets

export function turretRange(room: Room) {
  return (
    (TURRET_RANGE + (count(room, "watchtower") > 0 ? WATCHTOWER_RANGE : 0)) *
    RANGE_UNIT
  );
}

function fireTurrets(s: GameState, dt: number) {
  const h = s.hunter;
  if (!h || h.mode === "dead") return;
  for (const room of s.rooms) {
    if (room.owner === null || room.dark) continue;
    const range = turretRange(room);
    const speed = count(room, "accelerator") > 0 ? ACCELERATOR_SPEED : 1;
    room.tiles.forEach((b, tile) => {
      if (b?.kind !== "turret") return;
      b.cooldown = Math.max(0, b.cooldown - dt);
      if (b.cooldown > 0) return;
      const from = tileCenter(room.index, tile);
      if (dist(from, h) > range) return;
      b.cooldown = TURRET_INTERVAL / speed;
      h.hp -= TURRET_DAMAGE[b.level - 1];
      h.flash = 0.08;
      s.events.push({
        type: "shot",
        from,
        to: { x: h.x, y: h.y - 20 },
        room: room.index,
      });
    });
  }
  if (h.hp <= 0) {
    h.hp = 0;
    h.mode = "dead";
    s.events.push({ type: "hunterDown" });
    end(s, true);
  }
}

// ---------------------------------------------------------------- hunter

function updateHunter(s: GameState, h: Hunter, dt: number) {
  if (h.mode === "dead") return;
  h.flash = Math.max(0, h.flash - dt);
  h.levelTimer -= dt;
  if (h.levelTimer <= 0) {
    h.levelTimer += LEVEL_EVERY;
    h.level++;
    h.maxHp *= LEVEL_HP;
    h.hp *= LEVEL_HP;
    h.hit *= LEVEL_HIT;
    s.events.push({ type: "levelUp", level: h.level });
  }

  if (
    (h.mode === "walk" || h.mode === "attack") &&
    h.retreats < MAX_RETREATS &&
    h.hp < h.maxHp * RETREAT_AT
  ) {
    h.mode = "retreat";
    h.retreats++;
    h.path = route(h, { x: HALL_X, y: HALL_Y }, HALL_X);
    s.events.push({ type: "retreat" });
  }

  if (h.mode === "heal") {
    const cap = h.maxHp * healCap(h);
    h.hp = Math.min(cap, h.hp + h.maxHp * HEAL_RATE * dt);
    h.rest -= dt;
    if (h.hp >= cap && h.rest <= 0) chooseTarget(s, h);
    return;
  }

  if (h.mode === "walk" || h.mode === "retreat") {
    let budget = HUNTER_SPEED * (h.mode === "retreat" ? 1.7 : 1) * dt;
    while (budget > 0 && h.path.length > 0) {
      const next = h.path[0];
      const d = dist(h, next);
      if (d <= budget) {
        h.x = next.x;
        h.y = next.y;
        budget -= d;
        h.path.shift();
      } else {
        h.x += ((next.x - h.x) / d) * budget;
        h.y += ((next.y - h.y) / d) * budget;
        budget = 0;
      }
    }
    if (h.path.length === 0) {
      if (h.mode === "retreat") {
        h.mode = "heal";
        h.rest = 1;
      } else {
        h.mode = "attack";
        h.hitTimer = HUNTER_HIT_EVERY * 0.5;
      }
    }
    return;
  }

  // attack
  const room = h.target === null ? null : s.rooms[h.target];
  if (!room || room.dark || room.owner === null) {
    chooseTarget(s, h);
    return;
  }
  h.hitTimer -= dt;
  if (h.hitTimer > 0) return;
  h.hitTimer += HUNTER_HIT_EVERY;
  room.doorHp -= h.hit;
  s.events.push({ type: "doorHit", room: room.index });
  if (room.doorHp <= 0) breakDoor(s, h, room);
}

/** How far the hunter heals on this trip back to the hall. */
export const healCap = (h: Hunter) =>
  1 - Math.max(0, h.retreats - 1) * HEAL_DECAY;

/** Out of retreats: no more healing, it fights to the end. */
export const enraged = (h: Hunter) =>
  h.retreats >= MAX_RETREATS && h.mode !== "retreat" && h.mode !== "heal";

function breakDoor(s: GameState, h: Hunter, room: Room) {
  room.doorHp = 0;
  const victim = s.occupants.find((o) => o.id === room.owner);
  const isPlayer = victim !== undefined && !victim.bot;
  s.events.push({ type: "doorBroken", room: room.index, player: isPlayer });
  if (victim) victim.alive = false;
  room.dark = true;
  if (isPlayer) {
    end(s, false);
    return;
  }
  h.rest = 1;
  chooseTarget(s, h);
}

/** The weakest door is the most tempting; the very first target is never the player. */
function chooseTarget(s: GameState, h: Hunter) {
  const alive = s.rooms.filter((r) => r.owner !== null && !r.dark);
  let pool = alive;
  if (s.firstTarget) {
    const bots = alive.filter((r) => r.index !== s.playerRoom);
    if (bots.length > 0) pool = bots;
    s.firstTarget = false;
  }
  if (pool.length === 0) return;
  const weights = pool.map((r) => 1 / (r.doorHp + 40) ** 1.2);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = s.rng() * total;
  let pick = pool[0];
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      pick = pool[i];
      break;
    }
  }
  h.target = pick.index;
  h.mode = "walk";
  h.path = pathToDoor(h, pick.index);
}

// ---------------------------------------------------------------- bots

const BOT_SKILL: Record<BotName, number> = {
  novice: 0.35,
  apprentice: 0.5,
  expert1: 0.7,
  expert2: 0.8,
  master: 0.95,
};

function botThink(s: GameState, o: Occupant, dt: number) {
  o.think -= dt;
  if (o.think > 0) return;
  o.think = BOT_THINK;
  if (!o.bot) return;
  const room = s.rooms[o.room];
  // Weaker bots hesitate more often
  if (s.rng() > BOT_SKILL[o.bot]) return;
  planBuy(s, room);
}

/** Tiles ordered by distance to the door: turrets near the door hit the hunter first. */
export function tilesByDoor(room: number) {
  const d = doorPos(room);
  const tiles: number[] = [];
  for (let t = 0; t < COLS * ROWS; t++) if (t !== bedTile(room)) tiles.push(t);
  return tiles.sort(
    (a, b) => dist(tileCenter(room, a), d) - dist(tileCenter(room, b), d),
  );
}

/** A reasonable purchase for a room, used by bots (and the balance test). Returns true if it bought something. */
export function planBuy(s: GameState, room: Room): boolean {
  if (
    room.doorHp < maxDoorHp(room) * 0.45 &&
    apply(s, room, { type: "repair" })
  )
    return true;
  const order = tilesByDoor(room.index);
  const free = order.filter((t) => !room.tiles[t]);
  const turrets = order.filter((t) => room.tiles[t]?.kind === "turret");
  const weakest = [...turrets].sort(
    (a, b) => (room.tiles[a]?.level ?? 0) - (room.tiles[b]?.level ?? 0),
  )[0];
  const under = s.hunter?.mode === "attack" && s.hunter.target === room.index;
  const tryAll = (options: Action[]) => options.some((a) => apply(s, room, a));

  if (turrets.length === 0 && free.length > 0)
    return apply(s, room, { type: "build", tile: free[0], kind: "turret" });
  if (under) {
    // Spend on whatever holds the door right now
    return tryAll([
      { type: "upgradeDoor" },
      ...(free.length > 0 && turrets.length < 6
        ? [{ type: "build", tile: free[0], kind: "turret" } as Action]
        : []),
      ...(weakest !== undefined
        ? [{ type: "upgradeTurret", tile: weakest } as Action]
        : []),
    ]);
  }
  // Calm: grow income first, saving up for the next bed while it is within reach
  const bed = bedUpgradeCost(room);
  if (bed !== null) {
    if (room.gold >= bed) return apply(s, room, { type: "upgradeBed" });
    if (bed <= BED_INCOME[room.bedLevel - 1] * 35) return false;
  }
  const spareTile = free[free.length - 1];
  return tryAll([
    ...(free.length > 2 && turrets.length < 3 + room.bedLevel
      ? [{ type: "build", tile: free[0], kind: "turret" } as Action]
      : []),
    ...(weakest !== undefined
      ? [{ type: "upgradeTurret", tile: weakest } as Action]
      : []),
    { type: "upgradeDoor" },
    ...(spareTile !== undefined && free.length > 1
      ? ([
          { type: "build", tile: spareTile, kind: "arcade" },
          { type: "build", tile: spareTile, kind: "station" },
          { type: "build", tile: spareTile, kind: "watchtower" },
          { type: "build", tile: spareTile, kind: "accelerator" },
        ] as Action[])
      : []),
  ]);
}

// ---------------------------------------------------------------- end

function end(s: GameState, won: boolean) {
  if (s.phase === "over") return;
  s.phase = "over";
  s.result = { won, nightTime: s.nightTime, level: s.hunter?.level ?? 1 };
  s.score = scoreOf(s);
  s.events.push({ type: "end", won });
}

/** Gold earned, plus survival time, plus a bonus for taking the hunter down (bigger when fast). */
export function scoreOf(s: GameState) {
  const room = s.playerRoom === null ? null : s.rooms[s.playerRoom];
  const earned = room?.goldEarned ?? 0;
  const survival = Math.floor(s.nightTime) * 5;
  const bonus = s.result?.won
    ? 5000 + Math.max(0, 3000 - Math.floor(s.nightTime) * 10)
    : 0;
  return earned + survival + bonus;
}
