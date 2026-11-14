// The world of Nói Là Có: the sandbank, the players on it and every word's
// event. Pure and deterministic given the seed inside the state, so the same
// file runs in the browser, in tests and in the realtime Worker, and a state is
// plain JSON. logic.ts runs the match on top of this; ai.ts reads it for bots.
import { clamp, nextRandom } from "@web-games/core/math";
import {
  DASH_COOLDOWN,
  DASH_SPEED,
  DASH_TIME,
  FLY_H,
  GRAVITY,
  GRID,
  GROUND_WORDS,
  HAY_TOP,
  HIGH,
  HUT_FLOOR,
  INVULNERABLE,
  JUMP_V,
  KNOCK_DECAY,
  MAX_ACTIVE,
  MAX_HEARTS,
  PLAYER_R,
  SLIDE,
  SPEED,
  STEP_UP,
  STORM_DRAIN,
  STORM_END,
  T,
  TREE,
  LEVEL_Y,
  WORDS,
  type WordId,
} from "./config";

// ---------------------------------------------------------------- types

/** One seat's input for one step. `word` is raw text from the writer. */
export interface Input {
  mx: number;
  my: number;
  dash: boolean;
  jump: boolean;
  word: string | null;
}

export const IDLE: Input = { mx: 0, my: 0, dash: false, jump: false, word: null };

export interface Player {
  seat: number;
  name: string;
  bot: boolean;
  /** A dropped human: the bot brain plays the seat until they return. */
  auto: boolean;
  x: number;
  y: number;
  /** Height of the feet, and its speed (up is positive). */
  z: number;
  vz: number;
  grounded: boolean;
  /** Velocity from steering, and from being knocked. */
  vx: number;
  vy: number;
  kx: number;
  ky: number;
  /** Heading in radians, atan2(x, y): 0 looks south, towards the camera. */
  face: number;
  hearts: number;
  alive: boolean;
  /** Play time when eliminated, null while alive. */
  outAt: number | null;
  inv: number;
  stun: number;
  dashT: number;
  dashCd: number;
  /** Seconds stood still under the sleep word, and whether the stun is a nap. */
  still: number;
  asleep: boolean;
  /** Words that landed while this player was alive. */
  survived: number;
  // The bot brain (unused for a human at the controls)
  skill: number;
  think: number;
  bx: number;
  by: number;
  wx: number;
  wy: number;
}

/** A moving or placed thing inside an event; what the fields mean is up to the word. */
export interface Ent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  k: number;
  target: number;
}

export interface Hazard {
  id: number;
  word: WordId;
  /** Seat that wrote it, -1 for the room. */
  by: number;
  t: number;
  dur: number;
  salt: number;
  a: number;
  b: number;
  ents: Ent[];
}

export type Cause = WordId | "storm";

export type GameEvent =
  | { type: "go" }
  | { type: "writer"; seat: number }
  | { type: "word"; word: WordId; by: number; auto: boolean }
  | { type: "hurt"; seat: number; cause: Cause; x: number; y: number }
  | { type: "out"; seat: number; cause: Cause }
  | { type: "heal"; seat: number }
  | { type: "slip"; seat: number }
  | { type: "sleep"; seat: number }
  | { type: "dash"; seat: number }
  | { type: "jump"; seat: number }
  | { type: "strike"; x: number; y: number; kind: "bolt" | "rocket" | "bomb" }
  | { type: "wave" }
  | { type: "roar" }
  | { type: "storm" }
  | { type: "end" };

export interface Turn {
  writer: number;
  left: number;
  /** A bot writes once `left` falls to this. */
  botAt: number;
}

export interface State {
  /** The running generator state, and the seed the sandbank was built from. */
  seed: number;
  seed0: number;
  /** Ground level per tile, row by row. Rebuilt from seed0 on a client (snapshots leave it out). */
  h: number[];
  phase: "countdown" | "play" | "over";
  countdown: number;
  /** Seconds of play. */
  time: number;
  overT: number;
  players: Player[];
  hazards: Hazard[];
  nextId: number;
  /** Who writes, in turn. */
  order: number[];
  orderI: number;
  turn: Turn | null;
  /** Seconds until the next writer is picked. */
  gap: number;
  /** Words landed so far. */
  words: number;
  last: { word: WordId; by: number; at: number } | null;
  /** The endless storm that ends long matches. */
  storm: Hazard | null;
  drain: number;
  events: GameEvent[];
}

// ---------------------------------------------------------------- helpers

export const rnd = (s: State) => nextRandom(s);
const between = (s: State, lo: number, hi: number) => lo + rnd(s) * (hi - lo);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const ent = (x: number, y: number, t = 0, k = 0, target = -1): Ent => ({ x, y, vx: 0, vy: 0, t, k, target });

/** A stable 0..1 for (a, b): which tiles a lava flow takes, decoration, and so on. */
export function hash(a: number, b: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export const living = (s: State) => s.players.filter((p) => p.alive);
export const active = (s: State, word: WordId) => s.hazards.find((h) => h.word === word);
export const flying = (s: State) => active(s, "dieu") !== undefined;

const tileOf = (v: number) => clamp(Math.floor(v), 0, GRID - 1);

// ---------------------------------------------------------------- the sandbank

/** Smooth value noise in 0..1 on a lattice of `cell` tiles. */
function noise(seed: number, x: number, y: number, cell: number) {
  const gx = x / cell;
  const gy = y / cell;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const v = (i: number, j: number) => hash(seed, (iy + j) * 977 + ix + i);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return top + (bottom - top) * sy;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Ground levels for a seed: a sandy shore all round, rolling grass, hills with
 * a top or two, and a few trees. Every step between neighbours is one level at
 * most (shore to hill never touch), so wherever you stand a jump gets you up
 * the next step, and trees stand alone, so they never wall anything in.
 */
export function makeHeights(seed: number): number[] {
  const r = { seed };
  const next = () => nextRandom(r);
  const salt = Math.floor(next() * 1e9);
  const h = new Array<number>(GRID * GRID).fill(1);
  const c = (GRID - 1) / 2;
  // The coast: a wobbly ring, wider in the corners, with a bay or two
  const inland: { i: number; v: number }[] = [];
  for (let ty = 0; ty < GRID; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      const i = ty * GRID + tx;
      const e = (Math.abs(tx - c) ** 4 + Math.abs(ty - c) ** 4) ** 0.25 / (GRID / 2);
      const coast = e + (noise(salt + 2, tx, ty, 4) - 0.5) * 0.3;
      if (Math.min(tx, ty, GRID - 1 - tx, GRID - 1 - ty) === 0 || coast > 0.9) h[i] = 0;
      else inland.push({ i, v: noise(salt, tx, ty, 6.5) * 0.7 + noise(salt + 1, tx, ty, 3) * 0.3 - e * 0.25 });
    }
  }
  // Hills by rank, so every map has about the same share of high ground
  inland.sort((p, q) => q.v - p.v);
  inland.forEach(({ i }, rank) => {
    const k = rank / inland.length;
    h[i] = k < 0.06 ? 3 : k < 0.2 ? 2 : 1;
  });
  // Never a cliff: a level more than one step above any neighbour comes down
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < h.length; i++) {
      const tx = i % GRID;
      const ty = Math.floor(i / GRID);
      for (const [dx, dy] of NEIGHBOURS) {
        if (tx + dx < 0 || tx + dx >= GRID || ty + dy < 0 || ty + dy >= GRID) continue;
        const n = h[(ty + dy) * GRID + tx + dx];
        if (h[i] > n + 1) {
          h[i] = n + 1;
          changed = true;
        }
      }
    }
  }
  // At least one hill to run up, in the middle if the noise made none
  if (h.filter((v) => v >= HIGH).length < 10) {
    const mx = Math.round(c) - 2 + Math.floor(next() * 3);
    const my = Math.round(c) - 2 + Math.floor(next() * 3);
    for (let j = -1; j <= 3; j++) for (let k = -1; k <= 3; k++) h[(my + j) * GRID + mx + k] = Math.max(h[(my + j) * GRID + mx + k], 1);
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) h[(my + j) * GRID + mx + k] = HIGH;
  }
  // Trees on open grass, well apart
  const trees: { x: number; y: number }[] = [];
  const want = 6 + Math.floor(next() * 3);
  for (let n = 0; n < 200 && trees.length < want; n++) {
    const tx = 3 + Math.floor(next() * (GRID - 6));
    const ty = 3 + Math.floor(next() * (GRID - 6));
    if (h[ty * GRID + tx] !== 1 || trees.some((t) => Math.abs(t.x - tx) + Math.abs(t.y - ty) < 5)) continue;
    trees.push({ x: tx, y: ty });
    h[ty * GRID + tx] = TREE;
  }
  return h;
}

/** The level of the tile under a point (TREE for a tree), before any hut or haystack. */
export const tileLevel = (s: State, x: number, y: number) => s.h[tileOf(y) * GRID + tileOf(x)] ?? 1;

/** The 2 x 2 footprints standing on the bank: the hut and the haystacks. */
export function footprints(s: State): { tx: number; ty: number; roof: boolean }[] {
  const out: { tx: number; ty: number; roof: boolean }[] = [];
  for (const hz of s.hazards) {
    if (hz.word === "choi") out.push({ tx: hz.a, ty: hz.b, roof: true });
    else if (hz.word === "dong-rom") for (const e of hz.ents) out.push({ tx: e.x, ty: e.y, roof: false });
  }
  return out;
}

const inFoot = (f: { tx: number; ty: number }, tx: number, ty: number) => tx >= f.tx && tx < f.tx + 2 && ty >= f.ty && ty < f.ty + 2;

export const raisedAt = (s: State, tx: number, ty: number) => footprints(s).some((f) => inFoot(f, tx, ty));

/** Ground level under a point: the bank's own, or HIGH on a hut floor or a haystack. */
export function levelAt(s: State, x: number, y: number) {
  const tx = tileOf(x);
  const ty = tileOf(y);
  return raisedAt(s, tx, ty) ? HIGH : (s.h[ty * GRID + tx] ?? 1);
}

/** Height of the surface under a point, in tiles: the ground, a hut floor or a haystack top. */
export function groundAt(s: State, x: number, y: number) {
  const tx = tileOf(x);
  const ty = tileOf(y);
  let top: number = LEVEL_Y[s.h[ty * GRID + tx] ?? 1];
  for (const f of footprints(s)) if (inFoot(f, tx, ty)) top = Math.max(top, f.roof ? HUT_FLOOR : HAY_TOP);
  return top;
}

/** Standing on (or just above) the ground. */
const onGround = (s: State, p: Player) => p.z < groundAt(s, p.x, p.y) + 0.12;

/** Under the hut's roof: lightning and fireworks cannot reach. */
export const roofAt = (s: State, x: number, y: number) => footprints(s).some((f) => f.roof && inFoot(f, tileOf(x), tileOf(y)));

/** The ground word in force, if any. */
export const ground = (s: State) => s.hazards.find((h) => GROUND_WORDS.includes(h.word))?.word ?? null;

export const onOil = (s: State, x: number, y: number) => active(s, "dau")?.ents.some((e) => dist(e.x, e.y, x, y) < T.oil.radius) ?? false;

// ---------------------------------------------------------------- lava, wave, fire: shapes the shell draws too

export function lavaPhase(hz: Hazard): { cycle: number; warn: boolean; k: number } {
  const span = T.lava.warn + T.lava.burn;
  const cycle = Math.floor(hz.t / span);
  const at = hz.t - cycle * span;
  return { cycle, warn: at < T.lava.warn, k: at < T.lava.warn ? at / T.lava.warn : (at - T.lava.warn) / T.lava.burn };
}

export function lavaAt(s: State, hz: Hazard, tx: number, ty: number) {
  if ((s.h[ty * GRID + tx] ?? 1) >= HIGH || raisedAt(s, tx, ty)) return false;
  return hash(hz.salt + lavaPhase(hz).cycle * 7919, ty * GRID + tx) < T.lava.share;
}

/** How far the wave has travelled from its side (negative while it is still gathering). */
export const waveTravel = (hz: Hazard) => (hz.t - T.tsunami.warn) * T.tsunami.speed;
/** A point's distance from the side the wave comes from. `a`: 0 west, 1 east, 2 north, 3 south. */
export const waveDepth = (hz: Hazard, x: number, y: number) => (hz.a === 0 ? x : hz.a === 1 ? GRID - x : hz.a === 2 ? y : GRID - y);
export const waveDir = (hz: Hazard) => (hz.a === 0 ? { x: 1, y: 0 } : hz.a === 1 ? { x: -1, y: 0 } : hz.a === 2 ? { x: 0, y: 1 } : { x: 0, y: -1 });

/** The dragon's fire: from the dragon through its target, across the bank. */
export function fireStrip(e: Ent) {
  const dx = e.vx - e.x;
  const dy = e.vy - e.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: e.x, y: e.y, dx: dx / d, dy: dy / d, len: GRID * 2 };
}

function stripDistance(strip: ReturnType<typeof fireStrip>, x: number, y: number) {
  const along = clamp((x - strip.x) * strip.dx + (y - strip.y) * strip.dy, 0, strip.len);
  return dist(strip.x + strip.dx * along, strip.y + strip.dy * along, x, y);
}

// ---------------------------------------------------------------- hurting and shoving

/** Take one heart off a player unless they are still flashing from the last hit. */
export function hurt(s: State, p: Player, cause: Cause, force = false): boolean {
  if (!p.alive || (p.inv > 0 && !force)) return false;
  p.hearts -= 1;
  p.inv = INVULNERABLE;
  s.events.push({ type: "hurt", seat: p.seat, cause, x: p.x, y: p.y });
  if (p.hearts <= 0) {
    p.alive = false;
    p.outAt = s.time;
    p.vx = p.vy = p.kx = p.ky = p.vz = 0;
    s.events.push({ type: "out", seat: p.seat, cause });
  }
  return true;
}

function knock(p: Player, dx: number, dy: number, speed: number, stun = 0) {
  const d = Math.hypot(dx, dy) || 1;
  p.kx = (dx / d) * speed;
  p.ky = (dy / d) * speed;
  p.stun = Math.max(p.stun, stun);
}

// ---------------------------------------------------------------- moving a player

/**
 * One step of one player's own movement from their input. The room runs it for
 * every seat; a client runs the same code on its own avatar to predict it.
 */
export function movePlayer(s: State, p: Player, input: Input, dt: number) {
  if (!p.alive) return;
  p.inv = Math.max(0, p.inv - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashT = Math.max(0, p.dashT - dt);
  const wasStunned = p.stun > 0;
  p.stun = Math.max(0, p.stun - dt);
  if (p.stun <= 0) p.asleep = false;

  let mx = clamp(input.mx, -1, 1);
  let my = clamp(input.my, -1, 1);
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  if (wasStunned) mx = my = 0;
  else if (active(s, "nguoc")) {
    mx = -mx;
    my = -my;
  }
  const steering = Math.hypot(mx, my) > 0.1;

  // The sleep word: stand still too long and you nod off
  if (active(s, "ngu") && !wasStunned) {
    p.still = steering ? Math.max(0, p.still - dt * 2) : p.still + dt;
    if (p.still >= T.sleep.still) {
      p.still = 0;
      p.stun = T.sleep.nap;
      p.asleep = true;
      s.events.push({ type: "sleep", seat: p.seat });
    }
  } else if (!active(s, "ngu")) p.still = 0;

  const fly = flying(s);
  const terrain = ground(s);
  let speed = SPEED;
  if (active(s, "ti-hon")) speed *= T.tiny.speed;
  if (terrain === "sa-mac") speed *= T.desert.speed;
  if (terrain === "dam-lay" && !fly && groundAt(s, p.x, p.y) < LEVEL_Y[HIGH]) speed *= T.swamp.speed;
  if (input.dash && !wasStunned && steering && p.dashCd <= 0) {
    p.dashT = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    s.events.push({ type: "dash", seat: p.seat });
  }
  if (p.dashT > 0) speed *= DASH_SPEED;

  const slippery = !fly && (terrain === "bang" || onOil(s, p.x, p.y));
  if (slippery) {
    const k = Math.min(1, SLIDE * dt);
    p.vx += (mx * speed - p.vx) * k;
    p.vy += (my * speed - p.vy) * k;
  } else {
    p.vx = mx * speed;
    p.vy = my * speed;
  }
  const decay = Math.exp(-KNOCK_DECAY * dt);
  p.kx *= decay;
  p.ky *= decay;
  shift(s, p, (p.vx + p.kx) * dt, (p.vy + p.ky) * dt);
  if (steering) p.face = Math.atan2(mx, my);

  // Up and down: a kite holds you above the ground, otherwise gravity and the jump
  const g = groundAt(s, p.x, p.y);
  if (fly) {
    p.z += (g + FLY_H - p.z) * Math.min(1, dt * 4);
    p.vz = 0;
    p.grounded = false;
    return;
  }
  if (input.jump && p.grounded && !wasStunned) {
    p.vz = JUMP_V;
    p.grounded = false;
    s.events.push({ type: "jump", seat: p.seat });
  }
  p.vz -= GRAVITY * dt;
  p.z += p.vz * dt;
  if (p.z <= g) {
    p.z = g;
    p.vz = 0;
    p.grounded = true;
  } else p.grounded = p.z - g < 0.01;
}

/**
 * Move a player by a vector, one axis at a time: kept on the sandbank, and
 * stopped by anything higher than a step above their feet (a hill face to
 * jump, a tree, the side of the hut).
 */
function shift(s: State, p: Player, dx: number, dy: number) {
  const lo = PLAYER_R;
  const hi = GRID - PLAYER_R;
  const wall = (x: number, y: number) => groundAt(s, x, y) > p.z + STEP_UP;
  if (dx !== 0) {
    const nx = clamp(p.x + dx, lo, hi);
    if (nx !== p.x + dx || wall(nx + Math.sign(dx) * PLAYER_R, p.y)) p.vx = p.kx = 0;
    else p.x = nx;
  }
  if (dy !== 0) {
    const ny = clamp(p.y + dy, lo, hi);
    if (ny !== p.y + dy || wall(p.x, ny + Math.sign(dy) * PLAYER_R)) p.vy = p.ky = 0;
    else p.y = ny;
  }
}

// ---------------------------------------------------------------- starting a word

function randomPoint(s: State) {
  for (let i = 0; i < 12; i++) {
    const p = { x: between(s, 0.6, GRID - 0.6), y: between(s, 0.6, GRID - 0.6) };
    if (tileLevel(s, p.x, p.y) !== TREE) return p;
  }
  return { x: GRID / 2, y: GRID / 2 };
}

function randomLiving(s: State): Player | null {
  const alive = living(s);
  return alive.length > 0 ? alive[Math.floor(rnd(s) * alive.length)] : null;
}

/** A point on the edge of the bank. */
function edgePoint(s: State) {
  const along = between(s, 0.5, GRID - 0.5);
  const side = Math.floor(rnd(s) * 4);
  return side === 0 ? { x: 0.2, y: along } : side === 1 ? { x: GRID - 0.2, y: along } : side === 2 ? { x: along, y: 0.2 } : { x: along, y: GRID - 0.2 };
}

/** A free 2 x 2 spot on low or grassy ground for a hut or a haystack. */
function freeFootprint(s: State, taken: { tx: number; ty: number }[]) {
  const busy = [...footprints(s), ...taken];
  for (let i = 0; i < 40; i++) {
    const tx = 1 + Math.floor(rnd(s) * (GRID - 3));
    const ty = 1 + Math.floor(rnd(s) * (GRID - 3));
    let ok = true;
    for (let j = 0; j < 2 && ok; j++) {
      for (let k = 0; k < 2 && ok; k++) {
        if ((s.h[(ty + j) * GRID + tx + k] ?? 1) >= HIGH || busy.some((f) => inFoot(f, tx + k, ty + j))) ok = false;
      }
    }
    if (ok) return { tx, ty };
  }
  return { tx: Math.floor(GRID / 2) - 1, ty: Math.floor(GRID / 2) - 1 };
}

const drop = (s: State, ...words: WordId[]) => {
  s.hazards = s.hazards.filter((h) => !words.includes(h.word));
};

/** A word lands: its event starts (or starts over), and the oldest gives way past the cap. */
export function spawnHazard(s: State, word: WordId, by: number): Hazard {
  drop(s, word);
  const hz: Hazard = { id: s.nextId++, word, by, t: 0, dur: WORDS[word].dur, salt: Math.floor(rnd(s) * 1e9), a: 0, b: 0, ents: [] };
  switch (word) {
    case "song-than":
      hz.a = Math.floor(rnd(s) * 4);
      break;
    case "loc-xoay": {
      const e = edgePoint(s);
      hz.ents.push(ent(e.x, e.y));
      break;
    }
    case "ong":
      for (let i = 0; i < T.bees.swarms; i++) {
        const e = edgePoint(s);
        hz.ents.push(ent(e.x, e.y, 0.6 + i * 0.3, 0, randomLiving(s)?.seat ?? -1));
      }
      break;
    case "trau-dien": {
      const e = edgePoint(s);
      hz.ents.push(ent(e.x, e.y, T.buffalo.aim + 0.6, 0, randomLiving(s)?.seat ?? -1));
      break;
    }
    case "ca-sau": {
      const shore: number[] = [];
      s.h.forEach((level, i) => {
        if (level === 0) shore.push(i);
      });
      for (let i = 0; i < T.croc.count && shore.length > 0; i++) {
        const tile = shore[Math.floor(rnd(s) * shore.length)];
        hz.ents.push(ent((tile % GRID) + 0.5, Math.floor(tile / GRID) + 0.5, 1, rnd(s) * Math.PI * 2));
      }
      break;
    }
    case "rong":
      hz.a = rnd(s) * Math.PI * 2;
      hz.ents.push(ent(GRID / 2 + Math.cos(hz.a) * T.dragon.orbit, GRID / 2 + Math.sin(hz.a) * T.dragon.orbit, T.dragon.glide));
      break;
    case "vo-chuoi":
      for (let i = 0; i < T.banana.count; i++) {
        const p = randomPoint(s);
        hz.ents.push(ent(p.x, p.y));
      }
      break;
    case "dau":
      for (let i = 0; i < T.oil.count; i++) {
        const p = { x: between(s, 2, GRID - 2), y: between(s, 2, GRID - 2) };
        hz.ents.push(ent(p.x, p.y));
      }
      break;
    case "thuoc":
      for (let i = 0; i < T.medkit.count; i++) {
        const p = { x: between(s, 1.5, GRID - 1.5), y: between(s, 1.5, GRID - 1.5) };
        hz.ents.push(ent(p.x, p.y));
      }
      break;
    case "choi": {
      const f = freeFootprint(s, []);
      hz.a = f.tx;
      hz.b = f.ty;
      break;
    }
    case "dong-rom": {
      const taken: { tx: number; ty: number }[] = [];
      for (let i = 0; i < 2; i++) {
        const f = freeFootprint(s, taken);
        taken.push(f);
        hz.ents.push(ent(f.tx, f.ty));
      }
      break;
    }
    // Sun and frost dry the flood and send the crocodiles off; the ground words replace one another
    case "sa-mac":
      drop(s, "lu", "ca-sau", "bang", "dam-lay");
      break;
    case "bang":
      drop(s, "lu", "ca-sau", "sa-mac", "dam-lay");
      break;
    case "dam-lay":
      drop(s, "sa-mac", "bang");
      break;
    default:
      break;
  }
  s.hazards.push(hz);
  while (s.hazards.length > MAX_ACTIVE) s.hazards.shift();
  return hz;
}

// ---------------------------------------------------------------- running the words

/** Marks that fall from the sky: a ring on the ground, then a strike. */
function stepMarks(s: State, hz: Hazard, dt: number, every: number, fuse: number, radius: number, cause: Cause, kind: "bolt" | "rocket", roofs: boolean, aim: () => { x: number; y: number } | null) {
  hz.a -= dt;
  if (hz.a <= 0 && hz.t < hz.dur - fuse) {
    hz.a += every;
    const at = aim();
    if (at) hz.ents.push(ent(clamp(at.x, 0.3, GRID - 0.3), clamp(at.y, 0.3, GRID - 0.3), fuse));
  }
  for (const e of hz.ents) {
    e.t -= dt;
    if (e.t > 0) continue;
    s.events.push({ type: "strike", x: e.x, y: e.y, kind });
    for (const p of living(s)) {
      if (dist(p.x, p.y, e.x, e.y) < radius && !(roofs && roofAt(s, p.x, p.y))) hurt(s, p, cause);
    }
  }
  hz.ents = hz.ents.filter((e) => e.t > 0);
}

const nearPlayer = (s: State, spread: number) => {
  const p = randomLiving(s);
  return p ? { x: p.x + between(s, -spread, spread), y: p.y + between(s, -spread, spread) } : null;
};

function stepHazard(s: State, hz: Hazard, dt: number) {
  const fly = flying(s);
  const alive = living(s);
  switch (hz.word) {
    case "lu":
      if (hz.t < T.flood.warn) break;
      for (const p of alive) if (!fly && p.z < T.flood.level) hurt(s, p, "lu");
      break;

    case "song-than": {
      const now = waveTravel(hz);
      const before = now - T.tsunami.speed * dt;
      if (before <= 0 && now > 0) s.events.push({ type: "wave" });
      if (now <= 0) break;
      const dir = waveDir(hz);
      for (const p of alive) {
        const depth = waveDepth(hz, p.x, p.y);
        if (depth > before && depth <= now && !fly && p.z < T.tsunami.top && hurt(s, p, "song-than")) knock(p, dir.x, dir.y, T.tsunami.push, 0.4);
      }
      break;
    }

    case "dung-nham":
      if (lavaPhase(hz).warn || fly) break;
      for (const p of alive) if (onGround(s, p) && lavaAt(s, hz, tileOf(p.x), tileOf(p.y))) hurt(s, p, "dung-nham");
      break;

    case "loc-xoay": {
      const e = hz.ents[0];
      let near: Player | null = null;
      for (const p of alive) if (!near || dist(p.x, p.y, e.x, e.y) < dist(near.x, near.y, e.x, e.y)) near = p;
      if (near) {
        const d = dist(near.x, near.y, e.x, e.y) || 1;
        e.x += ((near.x - e.x) / d) * T.tornado.speed * dt;
        e.y += ((near.y - e.y) / d) * T.tornado.speed * dt;
      }
      for (const p of alive) {
        const d = dist(p.x, p.y, e.x, e.y);
        if (d < T.tornado.hit) {
          if (hurt(s, p, "loc-xoay")) {
            const a = rnd(s) * Math.PI * 2;
            knock(p, Math.cos(a), Math.sin(a), T.tornado.toss, 0.5);
          }
        } else if (d < T.tornado.pull) shift(s, p, ((e.x - p.x) / d) * T.tornado.pullSpeed * dt, ((e.y - p.y) / d) * T.tornado.pullSpeed * dt);
      }
      break;
    }

    case "sam-set":
      stepMarks(s, hz, dt, T.lightning.every, T.lightning.fuse, T.lightning.radius, "sam-set", "bolt", true, () => nearPlayer(s, 0.5));
      break;

    case "phao-hoa":
      stepMarks(s, hz, dt, T.fireworks.every, T.fireworks.fuse, T.fireworks.radius, "phao-hoa", "rocket", true, () => (rnd(s) < 0.5 ? nearPlayer(s, 2.5) : randomPoint(s)));
      break;

    case "ong":
      for (const e of hz.ents) {
        e.t = Math.max(0, e.t - dt);
        let target: Player | undefined = s.players[e.target];
        if (!target?.alive) {
          target = randomLiving(s) ?? undefined;
          e.target = target?.seat ?? -1;
        }
        if (!target || e.t > 0) continue;
        const d = dist(target.x, target.y, e.x, e.y) || 1;
        e.x += ((target.x - e.x) / d) * T.bees.speed * dt;
        e.y += ((target.y - e.y) / d) * T.bees.speed * dt;
        for (const p of alive) {
          if (dist(p.x, p.y, e.x, e.y) >= T.bees.hit) continue;
          hurt(s, p, "ong");
          e.t = T.bees.rest;
          e.target = randomLiving(s)?.seat ?? -1;
          break;
        }
      }
      break;

    case "trau-dien": {
      const e = hz.ents[0];
      if (e.k === 0) {
        // Pawing the ground: it turns with its target until it goes
        let target: Player | undefined = s.players[e.target];
        if (!target?.alive) {
          target = randomLiving(s) ?? undefined;
          e.target = target?.seat ?? -1;
        }
        if (target) {
          const d = dist(target.x, target.y, e.x, e.y) || 1;
          e.vx = (target.x - e.x) / d;
          e.vy = (target.y - e.y) / d;
        }
        e.t -= dt;
        if (e.t <= 0 && (e.vx !== 0 || e.vy !== 0)) {
          e.k = 1;
          s.events.push({ type: "roar" });
        }
        break;
      }
      e.x += e.vx * T.buffalo.speed * dt;
      e.y += e.vy * T.buffalo.speed * dt;
      if (!fly) {
        for (const p of alive) {
          if (dist(p.x, p.y, e.x, e.y) < T.buffalo.hit && p.z < groundAt(s, e.x, e.y) + T.buffalo.over && hurt(s, p, "trau-dien")) knock(p, -e.vy, e.vx, T.buffalo.push, 0.4);
        }
      }
      if (e.x < -0.5 || e.x > GRID + 0.5 || e.y < -0.5 || e.y > GRID + 0.5) {
        e.x = clamp(e.x, 0.2, GRID - 0.2);
        e.y = clamp(e.y, 0.2, GRID - 0.2);
        hz.b += 1;
        if (hz.b >= T.buffalo.charges) hz.dur = hz.t;
        e.k = 0;
        e.t = T.buffalo.aim;
        e.target = randomLiving(s)?.seat ?? -1;
      }
      break;
    }

    case "ca-sau":
      for (const e of hz.ents) {
        e.t = Math.max(0, e.t - dt);
        let prey: Player | null = null;
        if (!fly) {
          for (const p of alive) {
            const d = dist(p.x, p.y, e.x, e.y);
            if (d < T.croc.sight && tileLevel(s, p.x, p.y) === 0 && p.z < 0.3 && (!prey || d < dist(prey.x, prey.y, e.x, e.y))) prey = p;
          }
        }
        if (e.t > 0) continue;
        if (prey) e.k = Math.atan2(prey.y - e.y, prey.x - e.x);
        else if (rnd(s) < dt * 0.6) e.k = rnd(s) * Math.PI * 2;
        const speed = prey ? T.croc.speed : T.croc.speed * 0.3;
        const nx = e.x + Math.cos(e.k) * speed * dt;
        const ny = e.y + Math.sin(e.k) * speed * dt;
        // Crocodiles never leave the wet sand
        if (nx > 0.2 && nx < GRID - 0.2 && ny > 0.2 && ny < GRID - 0.2 && tileLevel(s, nx, ny) === 0) {
          e.x = nx;
          e.y = ny;
        } else if (!prey) e.k = rnd(s) * Math.PI * 2;
        if (prey && dist(prey.x, prey.y, e.x, e.y) < T.croc.hit) {
          hurt(s, prey, "ca-sau");
          e.t = T.croc.rest;
        }
      }
      break;

    case "rong": {
      const e = hz.ents[0];
      e.t -= dt;
      if (e.k === 0) {
        hz.a += dt * 0.9;
        e.x = GRID / 2 + Math.cos(hz.a) * T.dragon.orbit;
        e.y = GRID / 2 + Math.sin(hz.a) * T.dragon.orbit;
        if (e.t <= 0) {
          const target = randomLiving(s);
          e.vx = target?.x ?? GRID / 2;
          e.vy = target?.y ?? GRID / 2;
          e.k = 1;
          e.t = T.dragon.inhale;
        }
      } else if (e.k === 1) {
        if (e.t <= 0) {
          e.k = 2;
          e.t = T.dragon.fire;
          s.events.push({ type: "roar" });
        }
      } else {
        const strip = fireStrip(e);
        for (const p of alive) if (stripDistance(strip, p.x, p.y) < T.dragon.half) hurt(s, p, "rong");
        if (e.t <= 0) {
          hz.b += 1;
          if (hz.b >= T.dragon.breaths) hz.dur = hz.t;
          e.k = 0;
          e.t = T.dragon.glide;
        }
      }
      break;
    }

    case "bom":
      hz.a -= dt;
      if (hz.a <= 0 && hz.b < T.bomb.count) {
        hz.a += T.bomb.every;
        hz.b += 1;
        const at = nearPlayer(s, 0.8) ?? randomPoint(s);
        hz.ents.push(ent(clamp(at.x, 0.4, GRID - 0.4), clamp(at.y, 0.4, GRID - 0.4), T.bomb.fuse));
      }
      for (const e of hz.ents) {
        e.t -= dt;
        if (e.t > 0) continue;
        s.events.push({ type: "strike", x: e.x, y: e.y, kind: "bomb" });
        if (!fly) for (const p of alive) if (dist(p.x, p.y, e.x, e.y) < T.bomb.radius) hurt(s, p, "bom");
      }
      hz.ents = hz.ents.filter((e) => e.t > 0);
      if (hz.b >= T.bomb.count && hz.ents.length === 0) hz.dur = hz.t;
      break;

    case "vo-chuoi":
      if (fly) break;
      for (const p of alive) {
        if (p.stun > 0 || !onGround(s, p)) continue;
        const i = hz.ents.findIndex((e) => dist(p.x, p.y, e.x, e.y) < T.banana.hit);
        if (i < 0) continue;
        hz.ents.splice(i, 1);
        knock(p, Math.sin(p.face), Math.cos(p.face), T.banana.slide, T.banana.stun);
        s.events.push({ type: "slip", seat: p.seat });
      }
      break;

    case "thuoc":
      for (const p of alive) {
        if (p.hearts >= MAX_HEARTS) continue;
        const i = hz.ents.findIndex((e) => dist(p.x, p.y, e.x, e.y) < T.medkit.hit);
        if (i < 0) continue;
        hz.ents.splice(i, 1);
        p.hearts += 1;
        s.events.push({ type: "heal", seat: p.seat });
      }
      if (hz.ents.length === 0) hz.dur = hz.t;
      break;

    default:
      break;
  }
}

export function stepHazards(s: State, dt: number) {
  for (const hz of [...s.hazards]) {
    hz.t += dt;
    stepHazard(s, hz, dt);
  }
  s.hazards = s.hazards.filter((h) => h.t < h.dur);
}

/** The storm that ends a long match: bolts no roof stops, then hearts drain for everyone. */
export function stepStorm(s: State, dt: number) {
  const hz = s.storm;
  if (!hz) return;
  hz.t += dt;
  const every = Math.max(0.25, T.stormEvery - hz.t * 0.006);
  stepMarks(s, hz, dt, every, T.lightning.fuse, T.lightning.radius, "storm", "bolt", false, () => nearPlayer(s, 0.7));
  if (s.time < STORM_END) return;
  s.drain -= dt;
  if (s.drain > 0) return;
  s.drain = STORM_DRAIN;
  for (const p of living(s)) hurt(s, p, "storm", true);
}

// ---------------------------------------------------------------- how dangerous is a spot (for the bots)

/** Rough danger at a point right now and in the next second or so; 3 or more means "you will be hit here". */
export function dangerAt(s: State, x: number, y: number, lag = 0): number {
  const fly = flying(s);
  const g = groundAt(s, x, y);
  const tile = tileLevel(s, x, y);
  // Hugging the edge leaves nowhere to run
  let d = 0.12 * Math.max(0, 1.5 - Math.min(x, y, GRID - x, GRID - y));
  // `lag`: a mark younger than this has not been noticed yet
  const marks = (hz: Hazard, radius: number, fuse: number, roofs: boolean) => {
    if (roofs && roofAt(s, x, y)) return;
    for (const e of hz.ents) if (fuse - e.t >= lag && dist(e.x, e.y, x, y) < radius + 0.35) d += 3;
  };
  for (const hz of s.hazards) {
    switch (hz.word) {
      case "lu":
        if (!fly && g < T.flood.level) d += hz.t < T.flood.warn - 1 ? 0.8 : 3;
        break;
      case "song-than":
        if (!fly && g < T.tsunami.top && waveDepth(hz, x, y) > waveTravel(hz) - 0.5) d += waveTravel(hz) > -T.tsunami.speed * 1.5 ? 3 : 1.2;
        break;
      case "dung-nham":
        if (!fly && lavaAt(s, hz, tileOf(x), tileOf(y))) d += lavaPhase(hz).warn && lavaPhase(hz).k < 0.55 ? 1 : 3;
        break;
      case "loc-xoay":
        d += Math.max(0, T.tornado.pull + 0.6 - dist(hz.ents[0].x, hz.ents[0].y, x, y)) * 1.4;
        break;
      case "sam-set":
        marks(hz, T.lightning.radius, T.lightning.fuse, true);
        break;
      case "phao-hoa":
        marks(hz, T.fireworks.radius, T.fireworks.fuse, true);
        break;
      case "bom":
        if (!fly) marks(hz, T.bomb.radius, T.bomb.fuse, false);
        break;
      case "ong":
        for (const e of hz.ents) d += Math.max(0, 2.2 - dist(e.x, e.y, x, y)) * 1.4;
        break;
      case "trau-dien": {
        if (fly) break;
        const e = hz.ents[0];
        const along = (x - e.x) * e.vx + (y - e.y) * e.vy;
        const off = Math.abs((x - e.x) * e.vy - (y - e.y) * e.vx);
        if (along > -0.5 && off < T.buffalo.hit + 0.6) d += e.k === 1 || e.t < 0.6 ? 3 : 1.5;
        break;
      }
      case "ca-sau":
        if (fly || tile !== 0) break;
        d += 1.2;
        for (const e of hz.ents) d += Math.max(0, 2.5 - dist(e.x, e.y, x, y));
        break;
      case "rong": {
        const e = hz.ents[0];
        const seen = e.k === 2 || (e.k === 1 && T.dragon.inhale - e.t >= lag);
        if (seen && stripDistance(fireStrip(e), x, y) < T.dragon.half + 0.4) d += 3;
        break;
      }
      case "vo-chuoi":
        if (!fly) for (const e of hz.ents) if (dist(e.x, e.y, x, y) < T.banana.hit + 0.25) d += 0.8;
        break;
      case "dau":
        if (!fly && onOil(s, x, y)) d += 0.35;
        break;
      case "dam-lay":
        if (!fly && g < LEVEL_Y[HIGH]) d += 0.15;
        break;
      default:
        break;
    }
  }
  if (s.storm) marks(s.storm, T.lightning.radius, T.lightning.fuse, false);
  return d;
}

/** The nearest medicine worth walking to, for a player short of hearts. */
export function medkitNear(s: State, p: Player): Ent | null {
  if (p.hearts >= MAX_HEARTS) return null;
  let best: Ent | null = null;
  for (const e of active(s, "thuoc")?.ents ?? []) if (!best || dist(e.x, e.y, p.x, p.y) < dist(best.x, best.y, p.x, p.y)) best = e;
  return best;
}
