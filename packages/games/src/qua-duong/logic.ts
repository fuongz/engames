// Pure rules for Qua Đường: the lane world, the duck's grid hops, river rides,
// trains, the ward officer's patience and the score. Deterministic: the world is
// a function of the seed, every mover's position is a function of the clock, and
// `step(state, input, dt)` at a fixed dt replays a run exactly — so a room can
// later run the same race server-side. No DOM, no Math.random.
import { clamp, lerp, nextRandom } from "@web-games/core/math";
import {
  AHEAD,
  BACK_LIMIT,
  type BlockKind,
  CATCH_TIME,
  COIN_CHANCE,
  COURIER_CHANCE,
  COURIER_FROM,
  COURIER_GAP,
  COURIER_PACE,
  COURIER_RAMP,
  COURIER_SHARE,
  COURIER_VARIANTS,
  DOG_CHANCE,
  DOG_FROM,
  DUCK_HALF,
  type FloaterKind,
  HALF,
  HOP_TIME,
  KEEP_BEHIND,
  LAND_SLACK,
  LENGTH,
  MAX_DEPOSIT,
  NET_CHANCE,
  NET_HALF,
  NET_WARN,
  NINJA_SHARE,
  NINJA_VARIANTS,
  RACE_COUNTDOWN,
  RACE_GOT_KEEP,
  RACE_SECONDS,
  RAIL_FROM,
  RAMP_ROWS,
  RIVER_GAP,
  RIVER_SPEED,
  ROAD_GAP,
  ROAD_SPEED,
  type SkinId,
  SPAN_HALF,
  STALL_LIMIT,
  STALL_WARN,
  START_ROWS,
  STEP,
  TICKETS_PER_COIN,
  TICKETS_PER_ROW,
  TRAIN_PERIOD,
  TRAIN_SPEED,
  TRAIN_WARN,
  type VehicleKind,
} from "./config";

export type Dir = "up" | "down" | "left" | "right";
export type LaneKind = "grass" | "road" | "river" | "rail";
export type Death = "hit" | "train" | "drown" | "edge" | "caught" | "netted";

export interface Block {
  x: number;
  kind: BlockKind;
}

/** A vehicle or floater. Its centre is `x0` at time 0 and moves with the lane. */
export interface Mover {
  x0: number;
  len: number;
  kind: VehicleKind | FloaterKind;
  /** Look variant, drawn from the seeded generator (couriers and scooter riders). */
  v?: number;
}

/**
 * A dog-thief bike's strike: its net goes up NET_WARN seconds before `at`, then
 * swipes the rows either side of its lane at `at`. Keyed by the bike (its lane
 * row and index) and its lap round the wrap span: one strike per lap.
 */
export interface Net {
  row: number;
  i: number;
  lap: number;
  /** World time of the swipe. */
  at: number;
  /** The swipe caught this duck. */
  hit: boolean;
}

export interface Lane {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  /** Cells per second (road and river). */
  speed: number;
  /** Road only: a courier lane, faster and mostly delivery riders. */
  courier: boolean;
  movers: Mover[];
  /** Grass only: cells that cannot be entered. */
  blocks: Block[];
  /** Column of an uncollected coin, if any. */
  coin: number | null;
  /** Rail only: seconds between trains, and where in that cycle time 0 falls. */
  period: number;
  phase: number;
}

export interface Hop {
  dir: Dir;
  fromX: number;
  fromRow: number;
  toX: number;
  toRow: number;
  /** 0 → 1 over HOP_TIME. */
  t: number;
}

export interface State {
  /** The seed the world was built from. */
  seed: number;
  /** mulberry32 state, consumed only by lane generation. */
  rng: { seed: number };
  /** Seconds since the run was created: every mover is a function of it. */
  time: number;
  phase: "ready" | "play" | "over";
  /** Contiguous rows, oldest first. */
  lanes: Lane[];
  /** The next row to generate. */
  genRow: number;
  /** Generator memory: current run of one lane kind, the guaranteed free column. */
  gen: { kind: LaneKind; left: number; pathX: number; prevKind: LaneKind | null; prevDir: 1 | -1; prevCourier: boolean };
  x: number;
  row: number;
  facing: Dir;
  hop: Hop | null;
  /** One input remembered while a hop is in the air. */
  queued: Dir | null;
  /** Standing on a floater and drifting with it. */
  riding: boolean;
  maxRow: number;
  coins: number;
  /** Seconds since the last new row. */
  stall: number;
  warned: boolean;
  /** Seconds since the officer's whistle, while he runs in. */
  catchT: number | null;
  /** Dog-thief strikes raised or swung near this duck, oldest first. */
  nets: Net[];
  death: Death | null;
  overT: number;
}

export type GameEvent =
  | { type: "start" }
  | { type: "hop"; dir: Dir }
  | { type: "bump" }
  | { type: "land"; kind: LaneKind; riding: boolean }
  | { type: "coin"; x: number; row: number }
  | { type: "row"; row: number }
  | { type: "stall-warn" }
  | { type: "whistle" }
  | { type: "train-warn"; row: number }
  | { type: "net-warn"; row: number }
  | { type: "net-swipe"; row: number; hit: boolean }
  | { type: "die"; cause: Death };

const STEP_OF: Record<Dir, [number, number]> = {
  up: [0, 1],
  down: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

// ---------------------------------------------------------------- the world as a function of time

const SPAN = SPAN_HALF * 2;
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Where a mover's centre is at `time`. Movers wrap at ±SPAN_HALF. */
export const moverX = (lane: Lane, m: Mover, time: number) => mod(m.x0 + lane.dir * lane.speed * time + SPAN_HALF, SPAN) - SPAN_HALF;

/** Seconds a whole train takes to cross. */
export const TRAIN_PASS = (SPAN + LENGTH.train) / TRAIN_SPEED;

/**
 * A rail lane at `time`: whether its light is blinking, and the train's centre
 * while one is crossing (null otherwise).
 */
export function trainAt(lane: Lane, time: number): { warn: boolean; x: number | null; local: number } {
  const local = mod(time + lane.phase, lane.period);
  const passing = local < TRAIN_PASS;
  const warn = passing || local >= lane.period - TRAIN_WARN;
  if (!passing) return { warn, x: null, local };
  const u = -SPAN_HALF - LENGTH.train / 2 + TRAIN_SPEED * local;
  return { warn, x: u * lane.dir, local };
}

export const difficulty = (row: number) => clamp(row / RAMP_ROWS, 0, 1);

export function laneAt(s: State, row: number): Lane | undefined {
  const first = s.lanes[0]?.row ?? 0;
  return s.lanes[row - first];
}

export const isBlocked = (lane: Lane, x: number) => lane.blocks.some((b) => b.x === x);

/** The duck's position right now, including a hop in the air (`lift` 0..1..0). */
export function duckPos(s: State): { x: number; row: number; lift: number } {
  const h = s.hop;
  if (!h) return { x: s.x, row: s.row, lift: 0 };
  return { x: lerp(h.fromX, h.toX, h.t), row: lerp(h.fromRow, h.toRow, h.t), lift: Math.sin(Math.PI * h.t) };
}

// ---------------------------------------------------------------- generation

type Range = { min: readonly [number, number]; max: readonly [number, number] };
const pick = (r: Range, d: number, u: number) => lerp(lerp(r.min[0], r.min[1], d), lerp(r.max[0], r.max[1], d), u);

function nextKind(s: State, row: number, rand: () => number): { kind: LaneKind; len: number } {
  if (row < START_ROWS) return { kind: "grass", len: START_ROWS - row };
  const d = difficulty(row);
  const prev = s.gen.kind;
  const weights: [LaneKind, number][] = [
    ["grass", prev === "grass" ? 0 : 0.3 - 0.08 * d],
    ["road", prev === "road" ? 0 : 0.38],
    ["river", prev === "river" || row < 6 ? 0 : 0.24 + 0.04 * d],
    ["rail", prev === "rail" || row < RAIL_FROM ? 0 : 0.08 + 0.04 * d],
  ];
  const total = weights.reduce((a, [, w]) => a + w, 0);
  let u = rand() * total;
  let kind: LaneKind = "grass";
  for (const [k, w] of weights) {
    if (u < w) {
      kind = k;
      break;
    }
    u -= w;
  }
  const r = rand();
  const len =
    kind === "grass"
      ? 1 + Math.floor(r * 2)
      : kind === "road"
        ? 1 + Math.floor(r * (2 + 2 * d))
        : kind === "river"
          ? 1 + Math.floor(r * (2 + d))
          : 1 + (r < 0.2 + 0.2 * d ? 1 : 0);
  return { kind, len };
}

type MoverKind = Pick<Mover, "kind" | "len" | "v">;

/** Lay movers along the whole wrap span, `gap()` apart; the gap across the wrap is at least `tail`. */
function fill(rand: () => number, kindOf: () => MoverKind, gap: () => number, tail = 1): Mover[] {
  const out: Mover[] = [];
  let u = rand() * 2;
  for (;;) {
    const k = kindOf();
    if (u + k.len > SPAN - tail && out.length > 0) break;
    out.push({ x0: -SPAN_HALF + u + k.len / 2, ...k });
    u += k.len + gap();
  }
  return out;
}

/** Chance a road lane at `row` is a courier lane. */
export const courierChance = (row: number) =>
  row < COURIER_FROM ? 0 : lerp(COURIER_CHANCE[0], COURIER_CHANCE[1], clamp((row - COURIER_FROM) / COURIER_RAMP, 0, 1));

function makeLane(s: State): Lane {
  const row = s.genRow++;
  const rand = () => nextRandom(s.rng);
  if (s.gen.left <= 0) {
    const n = nextKind(s, row, rand);
    s.gen.kind = n.kind;
    s.gen.left = n.len;
  }
  s.gen.left--;
  const kind = s.gen.kind;
  const d = difficulty(row);
  const lane: Lane = { row, kind, dir: 1, speed: 0, courier: false, movers: [], blocks: [], coin: null, period: 0, phase: 0 };

  if (kind === "grass") {
    const prevPath = s.gen.pathX;
    const nextPath = clamp(prevPath + Math.floor(rand() * 5) - 2, -HALF + 1, HALF - 1);
    s.gen.pathX = nextPath;
    const keepLo = Math.min(prevPath, nextPath);
    const keepHi = Math.max(prevPath, nextPath);
    const p = row < START_ROWS ? 0.22 : 0.12 + 0.16 * d;
    for (let x = -HALF; x <= HALF; x++) {
      const roll = rand();
      const kindRoll = rand();
      if (x >= keepLo && x <= keepHi) continue;
      if (row < START_ROWS && Math.abs(x) < 3) continue;
      if (roll < p) {
        const kinds: BlockKind[] = ["banana", "hedge", "stool", "food-cart"];
        lane.blocks.push({ x, kind: kinds[Math.floor(kindRoll * kinds.length)] });
      }
    }
  } else if (kind === "road") {
    // One kind of traffic per lane, alternating direction inside a run
    lane.dir = s.gen.prevKind === "road" ? (-s.gen.prevDir as 1 | -1) : rand() < 0.5 ? 1 : -1;
    const family = rand();
    // Never two courier lanes side by side
    lane.courier = !(s.gen.prevKind === "road" && s.gen.prevCourier) && rand() < courierChance(row);
    const busChance = 0.18 + 0.12 * d;
    const variant = (n: number) => Math.min(n - 1, Math.floor(rand() * n));
    const one = (kind: VehicleKind, v?: number): MoverKind => (v === undefined ? { kind, len: LENGTH[kind] } : { kind, len: LENGTH[kind], v });
    const motos = (): MoverKind => {
      const u = rand();
      if (u < 0.35) return one("moto-box");
      if (u < 0.35 + NINJA_SHARE) return one("ninja", variant(NINJA_VARIANTS));
      return one("moto");
    };
    const kindOf: () => MoverKind = lane.courier
      ? () => (rand() < COURIER_SHARE ? one("courier", variant(COURIER_VARIANTS)) : one("moto"))
      : family < busChance
        ? () => one("bus")
        : family < busChance + 0.22
          ? () => one("ba-gac")
          : motos;
    // Lanes average a pace of 1 (bus 0.85, cart 0.75, moto 1.15); couriers ride COURIER_PACE
    const pace = lane.courier ? COURIER_PACE : family < busChance ? 0.85 : family < busChance + 0.22 ? 0.75 : 1.15;
    const gapK = lane.courier ? COURIER_GAP : 1;
    lane.speed = pick(ROAD_SPEED, d, rand()) * pace;
    lane.movers = fill(rand, kindOf, () => pick(ROAD_GAP, d, rand()) * gapK, lerp(ROAD_GAP.min[0], ROAD_GAP.min[1], d) * gapK);
    // Now and then a dog-thief bike rides a moto lane in place of one rider
    const motoLane = !lane.courier && family >= busChance + 0.22;
    if (motoLane && row >= DOG_FROM && rand() < lerp(DOG_CHANCE[0], DOG_CHANCE[1], d)) {
      const i = Math.floor(rand() * lane.movers.length);
      const m = lane.movers[i];
      lane.movers[i] = { x0: m.x0, len: LENGTH["dog-thief"], kind: "dog-thief" };
    }
  } else if (kind === "river") {
    lane.dir = s.gen.prevKind === "river" ? (-s.gen.prevDir as 1 | -1) : rand() < 0.5 ? 1 : -1;
    lane.speed = pick(RIVER_SPEED, d, rand());
    const kindOf = (): { kind: FloaterKind; len: number } => {
      const u = rand();
      if (u < 0.3 - 0.1 * d) return { kind: "ghe", len: LENGTH.ghe };
      if (u < 0.7 - 0.1 * d) return { kind: "raft", len: rand() < 0.5 ? 2 : 3 };
      return { kind: "hyacinth", len: rand() < 0.5 + 0.3 * d ? 1 : 2 };
    };
    lane.movers = fill(rand, kindOf, () => pick(RIVER_GAP, d, rand()));
  } else {
    lane.dir = rand() < 0.5 ? 1 : -1;
    lane.period = pick(TRAIN_PERIOD, d, rand());
    lane.phase = rand() * lane.period;
  }

  if ((kind === "grass" || kind === "road") && row >= 2 && rand() < COIN_CHANCE) {
    const x = Math.floor(rand() * (HALF * 2 + 1)) - HALF;
    if (!isBlocked(lane, x)) lane.coin = x;
  }
  s.gen.prevKind = kind;
  s.gen.prevDir = lane.dir;
  s.gen.prevCourier = lane.courier;
  return lane;
}

/** Generate up to AHEAD rows past the furthest one reached, and forget old ones. */
export function extend(s: State) {
  while (s.genRow <= s.maxRow + AHEAD) s.lanes.push(makeLane(s));
  const keepFrom = s.maxRow - KEEP_BEHIND - BACK_LIMIT;
  while (s.lanes.length > 0 && s.lanes[0].row < keepFrom) s.lanes.shift();
}

export function createRun(seed: number): State {
  const s: State = {
    seed,
    rng: { seed },
    time: 0,
    phase: "ready",
    lanes: [],
    genRow: 0,
    gen: { kind: "grass", left: 0, pathX: 0, prevKind: null, prevDir: 1, prevCourier: false },
    x: 0,
    row: 0,
    facing: "up",
    hop: null,
    queued: null,
    riding: false,
    maxRow: 0,
    coins: 0,
    stall: 0,
    warned: false,
    catchT: null,
    nets: [],
    death: null,
    overT: 0,
  };
  extend(s);
  return s;
}

// ---------------------------------------------------------------- the duck

function die(s: State, cause: Death, ev: GameEvent[]) {
  const p = duckPos(s);
  s.x = p.x;
  s.row = Math.round(p.row);
  s.hop = null;
  s.queued = null;
  s.riding = false;
  s.phase = "over";
  s.death = cause;
  s.overT = 0;
  ev.push({ type: "die", cause });
}

function startCatch(s: State, ev: GameEvent[]) {
  if (s.catchT !== null) return;
  s.catchT = 0;
  s.queued = null;
  ev.push({ type: "whistle" });
}

function tryHop(s: State, dir: Dir, ev: GameEvent[]) {
  const [dx, dr] = STEP_OF[dir];
  s.facing = dir;
  const toRow = s.row + dr;
  const target = laneAt(s, toRow);
  if (toRow < 0 || !target) {
    ev.push({ type: "bump" });
    return;
  }
  const toX = target.kind === "river" ? s.x + dx : Math.round(s.x) + dx;
  if (Math.abs(toX) > HALF + 0.49 || (target.kind === "grass" && isBlocked(target, toX))) {
    ev.push({ type: "bump" });
    return;
  }
  s.hop = { dir, fromX: s.x, fromRow: s.row, toX, toRow, t: 0 };
  ev.push({ type: "hop", dir });
}

function land(s: State, ev: GameEvent[]) {
  const h = s.hop;
  if (!h) return;
  s.hop = null;
  s.row = h.toRow;
  s.x = h.toX;
  const lane = laneAt(s, s.row);
  if (!lane) return;
  if (lane.kind === "river") {
    const under = lane.movers.find((m) => Math.abs(moverX(lane, m, s.time) - s.x) <= m.len / 2 + LAND_SLACK);
    if (!under) {
      s.riding = false;
      die(s, "drown", ev);
      return;
    }
    // Snap onto the nearest cell of the floater
    const left = moverX(lane, under, s.time) - under.len / 2 + 0.5;
    const k = clamp(Math.round(s.x - left), 0, under.len - 1);
    s.x = left + k;
    s.riding = true;
  } else {
    s.riding = false;
    s.x = Math.round(s.x);
    if (lane.coin !== null && lane.coin === s.x) {
      lane.coin = null;
      s.coins++;
      ev.push({ type: "coin", x: s.x, row: s.row });
    }
  }
  ev.push({ type: "land", kind: lane.kind, riding: s.riding });
  if (s.row > s.maxRow) {
    s.maxRow = s.row;
    s.stall = 0;
    s.warned = false;
    extend(s);
    ev.push({ type: "row", row: s.row });
  } else if (s.row <= s.maxRow - BACK_LIMIT) {
    startCatch(s, ev);
  }
}

/** Is the duck under a vehicle or a train right now? */
function hitBy(s: State): Death | null {
  const p = duckPos(s);
  const h = s.hop;
  const row = h ? (h.t < 0.5 ? h.fromRow : h.toRow) : s.row;
  const lane = laneAt(s, row);
  if (!lane) return null;
  if (lane.kind === "road") {
    for (const m of lane.movers) if (Math.abs(moverX(lane, m, s.time) - p.x) < m.len / 2 + DUCK_HALF) return "hit";
  } else if (lane.kind === "rail") {
    const t = trainAt(lane, s.time);
    if (t.x !== null && Math.abs(t.x - p.x) < LENGTH.train / 2 + DUCK_HALF) return "train";
  }
  return null;
}

// ---------------------------------------------------------------- dog-thief nets
//
// A dog-thief bike that reaches a duck standing next to its lane may strike: a
// pure roll on (seed, bike, lap), never s.rng, so the lanes stay the same for
// every racer whatever their duck does. The net goes up NET_WARN seconds before
// the swipe, aimed so the bike is level with the duck when it swings; the swipe
// catches a duck in the row either side of the lane within NET_HALF of the bike.

/** A stable 0..1 for one bike's lap, independent of the lane generator. */
function roll(seed: number, row: number, i: number, lap: number) {
  const h = (seed ^ Math.imul(row + 1, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca77) ^ Math.imul(lap, 0xc2b2ae3d)) | 0;
  return nextRandom({ seed: h });
}

/** Which lap round the wrap span a mover is on at `time`. */
const lapOf = (lane: Lane, m: Mover, time: number) => Math.floor((m.x0 + lane.dir * lane.speed * time + SPAN_HALF) / SPAN);

/** A net's bike and its lane (null once the lane is forgotten). */
export function netBike(s: State, n: Net): { lane: Lane; mover: Mover } | null {
  const lane = laneAt(s, n.row);
  const mover = lane?.movers[n.i];
  return lane && mover ? { lane, mover } : null;
}

/** Would a swipe of `n` catch a duck at (x, row)? Measured from where the bike is at the swipe. */
export function inNet(s: State, n: Net, x: number, row: number): boolean {
  const b = netBike(s, n);
  return !!b && Math.abs(row - n.row) === 1 && Math.abs(x - moverX(b.lane, b.mover, n.at)) < NET_HALF;
}

/** A strike only goes for a duck that can get out of it: one hop away from the bike's lane, or two hops sideways. */
function canDodge(s: State, row: number, away: number, x: number) {
  const free = (r: number, cx: number) => {
    const l = r >= 0 ? laneAt(s, r) : undefined;
    return !!l && Math.abs(cx) <= HALF && !(l.kind === "grass" && isBlocked(l, cx));
  };
  if (free(away, x)) return true;
  return [-1, 1].some((d) => free(row, x + d) && free(row, x + 2 * d));
}

/** Raise a net for every dog-thief bike that has just come within NET_WARN of the duck's column. */
function raiseNets(s: State, before: number, ev: GameEvent[]) {
  const row = s.hop ? s.hop.toRow : s.row;
  const x = s.hop ? s.hop.toX : s.x;
  const here = laneAt(s, row);
  if (!here || (here.kind !== "grass" && here.kind !== "road")) return;
  for (const side of [-1, 1]) {
    const lane = laneAt(s, row + side);
    if (lane?.kind !== "road" || lane.row < DOG_FROM) continue;
    const aim = x - lane.dir * lane.speed * NET_WARN;
    lane.movers.forEach((m, i) => {
      if (m.kind !== "dog-thief") return;
      const was = moverX(lane, m, before);
      const now = moverX(lane, m, s.time);
      if (Math.abs(now - was) > SPAN_HALF || lane.dir * (was - aim) >= 0 || lane.dir * (now - aim) < 0) return;
      const lap = lapOf(lane, m, s.time);
      if (s.nets.some((n) => n.row === lane.row && n.i === i && n.lap === lap)) return;
      if (roll(s.seed, lane.row, i, lap) >= NET_CHANCE || !canDodge(s, row, row - side, x)) return;
      s.nets.push({ row: lane.row, i, lap, at: s.time + NET_WARN, hit: false });
      ev.push({ type: "net-warn", row: lane.row });
    });
  }
}

/** Swing every net whose moment has come; true when one caught the duck. */
function swingNets(s: State, before: number, ev: GameEvent[]): boolean {
  const p = duckPos(s);
  const h = s.hop;
  const row = h ? (h.t < 0.5 ? h.fromRow : h.toRow) : s.row;
  for (const n of s.nets) {
    if (before >= n.at || s.time < n.at) continue;
    n.hit = inNet(s, n, p.x, row);
    ev.push({ type: "net-swipe", row: n.row, hit: n.hit });
    if (n.hit) {
      die(s, "netted", ev);
      return true;
    }
  }
  return false;
}

/**
 * Advance the run by `dt` seconds with at most one new input. Call it at a fixed
 * dt (config STEP) and the same seed + inputs give the same run, step for step.
 */
export function step(s: State, input: Dir | null, dt: number): GameEvent[] {
  const ev: GameEvent[] = [];
  const before = s.time;
  s.time += dt;

  // The rail lights near the duck start blinking: the shell dings for them
  for (const lane of s.lanes) {
    if (lane.kind !== "rail" || Math.abs(lane.row - s.row) > 8) continue;
    const was = mod(before + lane.phase, lane.period);
    const now = mod(s.time + lane.phase, lane.period);
    const at = lane.period - TRAIN_WARN;
    if (was < at && now >= at) ev.push({ type: "train-warn", row: lane.row });
  }

  if (s.phase === "over") {
    s.overT += dt;
    return ev;
  }
  if (s.phase === "ready") {
    if (!input) return ev;
    s.phase = "play";
    ev.push({ type: "start" });
  }
  if (s.catchT !== null) {
    s.catchT += dt;
    if (s.catchT >= CATCH_TIME) die(s, "caught", ev);
    return ev;
  }

  if (input) {
    if (s.hop) s.queued = input;
    else tryHop(s, input, ev);
  }

  // A floater carries the duck, and a hop that left one
  const ridden = s.riding ? laneAt(s, s.hop ? s.hop.fromRow : s.row) : undefined;
  const drift = ridden && ridden.kind === "river" ? ridden.dir * ridden.speed * dt : 0;
  if (s.hop) {
    s.hop.fromX += drift;
    if (laneAt(s, s.hop.toRow)?.kind === "river" && s.hop.toRow === s.hop.fromRow) s.hop.toX += drift;
    s.hop.t += dt / HOP_TIME;
    if (s.hop.t >= 1) {
      land(s, ev);
      if (s.death !== null || s.catchT !== null) return ev;
      const q = s.queued;
      s.queued = null;
      if (q) tryHop(s, q, ev);
    }
  } else if (s.riding) {
    s.x += drift;
    if (Math.abs(s.x) > HALF + 0.5) {
      die(s, "edge", ev);
      return ev;
    }
  }

  if (swingNets(s, before, ev)) return ev;
  const hit = hitBy(s);
  if (hit) {
    die(s, hit, ev);
    return ev;
  }
  raiseNets(s, before, ev);
  // Old strikes are only kept long enough to draw (and not to strike twice in a lap)
  if (s.nets.length > 0) s.nets = s.nets.filter((n) => s.time - n.at < 4 && laneAt(s, n.row));

  s.stall += dt;
  if (!s.warned && s.stall >= STALL_WARN) {
    s.warned = true;
    ev.push({ type: "stall-warn" });
  }
  if (s.stall >= STALL_LIMIT && !s.hop) startCatch(s, ev);
  return ev;
}

/** The run's score: the furthest row reached. */
export const score = (s: State) => s.maxRow;

/** Read a stored best, accepting anything (old or hand-edited storage). */
export const parseBest = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Tickets a finished solo run pays into the shared wallet (one deposit, capped). */
export const ticketsFor = (rows: number, coins: number) =>
  Math.min(MAX_DEPOSIT, Math.max(0, Math.floor(rows) * TICKETS_PER_ROW + Math.floor(coins) * TICKETS_PER_COIN));

// ---------------------------------------------------------------- the online race
//
// 2–4 ducks on one seed. Each racer has its own State built from the same seed,
// so every racer sees the very same lanes, traffic and trains (movers are a
// function of the shared clock); only coins are per racer. The room steps every
// racer every tick, so their clocks stay equal.

export interface Racer {
  name: string;
  skin: SkinId;
  duck: State;
  /** Rows whose coin this racer took, newest last (the client clears them). */
  got: number[];
  /** Seconds into the race when this racer went out, or null. */
  outAt: number | null;
}

export interface Race {
  seed: number;
  phase: "countdown" | "play" | "over";
  /** Seconds left of the countdown. */
  countdown: number;
  /** Seconds since the countdown ended. */
  elapsed: number;
  racers: Racer[];
}

export interface RaceInput {
  dir: Dir | null;
  skin: SkinId | null;
}

export type RaceEvent = (GameEvent & { seat: number }) | { type: "go" } | { type: "time-up" };

/** The part of a duck's State a client needs; it rebuilds the lanes from the seed. */
export type DuckSnap = Omit<State, "lanes" | "rng" | "gen" | "genRow">;

export interface RaceSnap {
  seed: number;
  phase: Race["phase"];
  countdown: number;
  elapsed: number;
  racers: { name: string; skin: SkinId; got: number[]; outAt: number | null; duck: DuckSnap }[];
}

export function createRace(seed: number, names: string[]): Race {
  return {
    seed,
    phase: "countdown",
    countdown: RACE_COUNTDOWN,
    elapsed: 0,
    racers: names.map((name) => ({ name, skin: "vit-vang", duck: createRun(seed), got: [], outAt: null })),
  };
}

/** One step of `dt` seconds (a whole number of STEPs) with at most one input per racer. */
export function stepRace(r: Race, inputs: readonly (RaceInput | null)[], dt: number): RaceEvent[] {
  const out: RaceEvent[] = [];
  if (r.phase === "over") return out;
  const n = Math.max(1, Math.round(dt / STEP));
  for (let k = 0; k < n; k++) {
    if (r.phase === "countdown") {
      r.countdown -= STEP;
      if (r.countdown <= 1e-9) {
        r.countdown = 0;
        r.phase = "play";
        out.push({ type: "go" });
        for (const [seat, racer] of r.racers.entries()) {
          racer.duck.phase = "play";
          out.push({ type: "start", seat });
        }
      }
    } else r.elapsed += STEP;
    for (const [seat, racer] of r.racers.entries()) {
      const input = k === 0 ? inputs[seat] : null;
      if (input?.skin && r.phase === "countdown") racer.skin = input.skin;
      // During the countdown a duck stands still; its clock still runs
      const dir = r.phase === "play" ? (input?.dir ?? null) : null;
      const wasOut = racer.duck.phase === "over";
      for (const e of step(racer.duck, dir, STEP)) {
        if (e.type === "coin") {
          racer.got.push(e.row);
          if (racer.got.length > RACE_GOT_KEEP) racer.got.shift();
        }
        out.push({ ...e, seat });
      }
      if (!wasOut && racer.duck.phase === "over") racer.outAt = r.elapsed;
    }
    if (r.phase === "play") {
      if (r.racers.every((x) => x.duck.phase === "over")) r.phase = "over";
      else if (r.elapsed >= RACE_SECONDS - 1e-9) {
        r.phase = "over";
        out.push({ type: "time-up" });
      }
      if (r.phase === "over") break;
    }
  }
  return out;
}

/** Seats from first to last: furthest row, then more coins, then out later (or never). */
export function raceStandings(r: Race): number[] {
  const key = (x: Racer) => [score(x.duck), x.duck.coins, x.outAt ?? Number.POSITIVE_INFINITY];
  return r.racers
    .map((_, seat) => seat)
    .sort((a, b) => {
      const ka = key(r.racers[a]);
      const kb = key(r.racers[b]);
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
      return a - b;
    });
}

/** win: alone at the top; draw: tied at the top (same rows and coins); loss otherwise. */
export function raceOutcome(r: Race, seat: number): "win" | "loss" | "draw" {
  const top = raceStandings(r)[0];
  const best = r.racers[top];
  const me = r.racers[seat];
  const same = (a: Racer, b: Racer) => score(a.duck) === score(b.duck) && a.duck.coins === b.duck.coins;
  if (!same(me, best)) return "loss";
  return r.racers.filter((x) => same(x, best)).length > 1 ? "draw" : "win";
}

export function raceSnapshot(r: Race): RaceSnap {
  return {
    seed: r.seed,
    phase: r.phase,
    countdown: r.countdown,
    elapsed: r.elapsed,
    racers: r.racers.map((x) => {
      const { lanes: _l, rng: _r, gen: _g, genRow: _n, ...duck } = x.duck;
      return { name: x.name, skin: x.skin, got: [...x.got], outAt: x.outAt, duck: structuredClone(duck) };
    }),
  };
}

/**
 * Bring a client-side copy of a racer's duck (built with createRun(seed)) to a
 * snapshot: the duck's fields from the room, the lanes generated locally from
 * the same seed, the coins it took cleared.
 */
export function applyDuckSnap(local: State, snap: DuckSnap, got: readonly number[]) {
  Object.assign(local, structuredClone(snap));
  extend(local);
  for (const row of got) {
    const lane = laneAt(local, row);
    if (lane) lane.coin = null;
  }
}
