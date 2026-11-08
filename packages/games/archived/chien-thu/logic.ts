import { mulberry32 } from "@web-games/core/math";
import {
  BLADE_SPIN,
  CENTER,
  EGG_DROP_CHANCE,
  ENEMIES,
  FIRST_WAVE_DELAY,
  HIT_COOLDOWN,
  MAX_LEVEL,
  PATH_LENGTH,
  PATH_START,
  SLOT_DX,
  SLOT_DY,
  SLOT_ROWS,
  SPECIES,
  START_BASE_HP,
  START_EGGS,
  TRACK_R,
  WAVE_BREAK,
  WILD_EGG_REWARD,
  bladeCount,
  bladeDamage,
  bladeHalf,
  bladeOrbit,
  spawnInterval,
  summonCost,
  waveBaseHp,
  type EnemyKind,
} from "./config";

// Pure simulation: no DOM, no canvas. The renderer reads state and drains
// `events` each frame for sounds and particles.

export interface Vec {
  x: number;
  y: number;
}

export interface Slot extends Vec {
  index: number;
}

export interface Critter {
  id: number;
  level: number;
  slot: number;
  spin: number;
  /** Seconds left on the spawn/merge pop animation. */
  pop: number;
  cooldowns: Map<number, number>;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** Distance travelled along the ring path. */
  dist: number;
  flash: number;
}

export type GameEvent =
  | { type: "hit"; x: number; y: number; level: number }
  | { type: "kill"; x: number; y: number; kind: EnemyKind }
  | { type: "leak"; damage: number }
  | { type: "egg"; x: number; y: number; amount: number }
  | { type: "merge"; slot: number; level: number }
  | { type: "evolve"; level: number }
  | { type: "summon"; slot: number }
  | { type: "move"; slot: number }
  | { type: "wave"; wave: number }
  | { type: "waveClear"; wave: number }
  | { type: "gameover" };

export type WavePhase = "break" | "spawning" | "fighting";

export interface GameState {
  time: number;
  eggs: number;
  summons: number;
  baseHp: number;
  wave: number;
  phase: WavePhase;
  timer: number;
  queue: EnemyKind[];
  enemies: Enemy[];
  critters: Critter[];
  score: number;
  kills: number;
  over: boolean;
  /** Critter id currently held by the player; it neither attacks nor moves. */
  held: number | null;
  nextId: number;
  events: GameEvent[];
  rng: () => number;
}

export const SLOTS: Slot[] = (() => {
  const slots: Slot[] = [];
  SLOT_ROWS.forEach((count, row) => {
    const y = CENTER.y + (row - (SLOT_ROWS.length - 1) / 2) * SLOT_DY;
    for (let i = 0; i < count; i++) {
      const x = CENTER.x + (i - (count - 1) / 2) * SLOT_DX;
      slots.push({ x, y, index: slots.length });
    }
  });
  return slots;
})();

export function createGame(seed = Date.now()): GameState {
  const state: GameState = {
    time: 0,
    eggs: START_EGGS,
    summons: 0,
    baseHp: START_BASE_HP,
    wave: 0,
    phase: "break",
    timer: FIRST_WAVE_DELAY,
    queue: [],
    enemies: [],
    critters: [],
    score: 0,
    kills: 0,
    over: false,
    held: null,
    nextId: 1,
    events: [],
    rng: mulberry32(seed),
  };
  // Two level-1 critters on the top row, one slot apart, so the very first
  // move the tutorial asks for is the ad's opening merge.
  addCritter(state, 1, 0);
  addCritter(state, 1, 2);
  return state;
}

function addCritter(state: GameState, level: number, slot: number): Critter {
  const critter: Critter = { id: state.nextId++, level, slot, spin: state.rng() * Math.PI * 2, pop: 0.35, cooldowns: new Map() };
  state.critters.push(critter);
  return critter;
}

export const critterAt = (state: GameState, slot: number) => state.critters.find((c) => c.slot === slot);

export function enemyPos(enemy: Pick<Enemy, "dist">): Vec & { angle: number } {
  const angle = PATH_START - enemy.dist / TRACK_R;
  return { x: CENTER.x + Math.cos(angle) * TRACK_R, y: CENTER.y + Math.sin(angle) * TRACK_R, angle };
}

export function enemyHp(kind: EnemyKind, wave: number) {
  return Math.max(1, Math.round(waveBaseHp(wave) * ENEMIES[kind].hpMul));
}

/** Spawn order for a wave. Types unlock gradually; every 5th wave ends with a brute. */
export function buildWave(wave: number, rng: () => number): EnemyKind[] {
  const count = 8 + wave * 2;
  const pool: EnemyKind[] = ["walker"];
  if (wave >= 2) pool.push("miner");
  if (wave >= 3) pool.push("runner");
  if (wave >= 4) pool.push("shield");
  const list: EnemyKind[] = [];
  for (let i = 0; i < count; i++) list.push(pool[Math.floor(rng() * pool.length)]);
  // One wild egg roughly in the middle of every wave, like the "20" eggs in the ad.
  list.splice(Math.floor(count / 2), 0, "egg");
  if (wave % 5 === 0) list.push("brute");
  return list;
}

export function summonPrice(state: GameState) {
  return summonCost(state.summons);
}

export function canSummon(state: GameState) {
  return !state.over && state.eggs >= summonPrice(state) && state.critters.length < SLOTS.length;
}

/** Spend eggs to hatch a level-1 critter into a random empty slot. */
export function summon(state: GameState): Critter | null {
  if (!canSummon(state)) return null;
  const free = SLOTS.filter((s) => !critterAt(state, s.index));
  const slot = free[Math.floor(state.rng() * free.length)];
  state.eggs -= summonPrice(state);
  state.summons++;
  const critter = addCritter(state, 1, slot.index);
  state.events.push({ type: "summon", slot: slot.index });
  return critter;
}

export type DropResult = "merge" | "move" | "swap" | "none";

/**
 * Player dropped critter `id` on `slot`. Same level merges (the core loop of
 * the ad), empty slot moves, a different level swaps places.
 */
export function dropCritter(state: GameState, id: number, slot: number | null): DropResult {
  const critter = state.critters.find((c) => c.id === id);
  if (!critter || slot === null || slot === critter.slot) return "none";
  const target = critterAt(state, slot);
  if (!target) {
    critter.slot = slot;
    state.events.push({ type: "move", slot });
    return "move";
  }
  if (target.level === critter.level && target.level < MAX_LEVEL) {
    state.critters = state.critters.filter((c) => c !== critter);
    target.level++;
    target.pop = 0.45;
    state.events.push({ type: "merge", slot, level: target.level });
    if (SPECIES.some((s) => s.fromLevel === target.level)) state.events.push({ type: "evolve", level: target.level });
    return "merge";
  }
  target.slot = critter.slot;
  critter.slot = slot;
  state.events.push({ type: "move", slot });
  return "swap";
}

export function slotAt(x: number, y: number, radius: number): number | null {
  let best: number | null = null;
  let bestD = radius * radius;
  for (const s of SLOTS) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = s.index;
    }
  }
  return best;
}

/** Blade segments of a critter in world space, for both hit tests and drawing. */
export function blades(critter: Critter, at: Vec = SLOTS[critter.slot]) {
  const n = bladeCount(critter.level);
  const orbit = bladeOrbit(critter.level);
  const half = bladeHalf(critter.level);
  const out: { angle: number; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = critter.spin + (i * Math.PI * 2) / n;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    out.push({
      angle,
      x1: at.x + cos * (orbit - half),
      y1: at.y + sin * (orbit - half),
      x2: at.x + cos * (orbit + half),
      y2: at.y + sin * (orbit + half),
    });
  }
  return out;
}

function segmentDistSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2;
}

function startWave(state: GameState) {
  state.wave++;
  state.queue = buildWave(state.wave, state.rng);
  state.phase = "spawning";
  state.timer = 0;
  state.events.push({ type: "wave", wave: state.wave });
}

function spawn(state: GameState, kind: EnemyKind) {
  const hp = enemyHp(kind, state.wave);
  state.enemies.push({ id: state.nextId++, kind, hp, maxHp: hp, dist: 0, flash: 0 });
}

function kill(state: GameState, enemy: Enemy) {
  const { x, y } = enemyPos(enemy);
  state.events.push({ type: "kill", x, y, kind: enemy.kind });
  if (enemy.kind === "egg") {
    state.eggs += WILD_EGG_REWARD;
    state.events.push({ type: "egg", x, y, amount: WILD_EGG_REWARD });
    return;
  }
  state.kills++;
  state.score += enemy.maxHp;
  const drop = enemy.kind === "brute" ? 3 : state.rng() < EGG_DROP_CHANCE ? 1 : 0;
  if (drop) {
    state.eggs += drop;
    state.events.push({ type: "egg", x, y, amount: drop });
  }
}

export function update(state: GameState, dt: number) {
  if (state.over) return;
  state.time += dt;

  // Waves
  state.timer -= dt;
  if (state.phase === "break" && state.timer <= 0) startWave(state);
  if (state.phase === "spawning" && state.timer <= 0) {
    const kind = state.queue.shift();
    if (kind) spawn(state, kind);
    state.timer = spawnInterval(state.wave);
    if (state.queue.length === 0) state.phase = "fighting";
  }
  if (state.phase === "fighting" && state.enemies.length === 0) {
    state.events.push({ type: "waveClear", wave: state.wave });
    state.eggs += 1;
    state.phase = "break";
    state.timer = WAVE_BREAK;
  }

  // Enemies walk the ring
  for (const enemy of state.enemies) {
    enemy.dist += ENEMIES[enemy.kind].speed * dt;
    enemy.flash = Math.max(0, enemy.flash - dt);
  }
  const arrived = state.enemies.filter((e) => e.dist >= PATH_LENGTH);
  for (const enemy of arrived) {
    const damage = ENEMIES[enemy.kind].damage;
    if (damage > 0) {
      state.baseHp = Math.max(0, state.baseHp - damage);
      state.events.push({ type: "leak", damage });
    }
  }
  if (arrived.length) state.enemies = state.enemies.filter((e) => e.dist < PATH_LENGTH);

  // Critter blades
  for (const critter of state.critters) {
    critter.pop = Math.max(0, critter.pop - dt);
    for (const [id, t] of critter.cooldowns) {
      if (t - dt <= 0) critter.cooldowns.delete(id);
      else critter.cooldowns.set(id, t - dt);
    }
    if (critter.id === state.held) continue;
    critter.spin += BLADE_SPIN * dt;
    const segs = blades(critter);
    const damage = bladeDamage(critter.level);
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || critter.cooldowns.has(enemy.id)) continue;
      const pos = enemyPos(enemy);
      const reach = ENEMIES[enemy.kind].radius + 5;
      if (!segs.some((s) => segmentDistSq(pos.x, pos.y, s.x1, s.y1, s.x2, s.y2) <= reach * reach)) continue;
      enemy.hp -= damage;
      enemy.flash = 0.12;
      critter.cooldowns.set(enemy.id, HIT_COOLDOWN);
      state.events.push({ type: "hit", x: pos.x, y: pos.y, level: critter.level });
    }
  }
  const dead = state.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dead) kill(state, enemy);
  if (dead.length) state.enemies = state.enemies.filter((e) => e.hp > 0);

  if (state.baseHp <= 0) {
    state.over = true;
    state.events.push({ type: "gameover" });
  }
}
