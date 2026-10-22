import {
  BEAM_DPS,
  BEAM_HALF,
  BEAM_TIME,
  BOSS_AT,
  BOSS_HP,
  BOSS_RADIUS,
  BOSS_SCORE,
  BOSS_WARNING,
  BULLET_SPACING,
  BULLET_SPEED,
  COUNTDOWN,
  CUTIN_TIME,
  ENEMIES,
  ENERGY_FULL,
  FIRE_INTERVAL,
  H,
  INVULN_TIME,
  MAX_HEARTS,
  MAX_PIERCE,
  MAX_STREAMS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  ROUND_TIME,
  SHARD_GOAL,
  SKILL_CAP,
  SKILL_START_MAX,
  W,
  type EnemyKind,
  type PickupKind,
  spawnInterval,
} from "./config";

// Pure simulation: no DOM, no canvas. The renderer reads state and drains
// `events` each frame for sound and particles.

export interface Input {
  /** Analog movement, each axis in [-1, 1]. */
  mx: number;
  my: number;
  /** True on the frame the skill button was pressed. */
  skill: boolean;
}

export interface Player {
  x: number;
  y: number;
  hearts: number;
  hitsTaken: number;
  invuln: number;
  fireTimer: number;
  streams: number;
  pierce: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  pierceLeft: number;
  hit: Set<number>;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  baseY: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  age: number;
  phase: number;
  flash: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  baseY: number;
  age: number;
}

/** Boss projectile. */
export interface Shot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export type BossAttack = { kind: "beam"; t: number; y: number };

export interface Boss {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  targetX: number;
  age: number;
  mode: "enter" | "fight" | "dying";
  attackTimer: number;
  attackIndex: number;
  attack: BossAttack | null;
  flash: number;
  dying: number;
}

export type Phase = "countdown" | "play" | "cutin" | "over";

export type GameEvent =
  | { type: "countdown"; n: number }
  | { type: "go" }
  | { type: "shot" }
  | { type: "hit"; x: number; y: number }
  | { type: "kill"; kind: EnemyKind; x: number; y: number; score: number }
  | { type: "hurt" }
  | { type: "pickup"; kind: PickupKind }
  | { type: "charge" }
  | { type: "skill" }
  | { type: "beam" }
  | { type: "bossWarning" }
  | { type: "bossEnter" }
  | { type: "bossHit" }
  | { type: "bossAttack"; kind: "fan" | "rain" | "beam" }
  | { type: "bossDie"; x: number; y: number }
  | { type: "waveClear"; wave: number }
  | { type: "end"; won: boolean };

export interface Result {
  won: boolean;
  stars: number;
}

export interface GameState {
  phase: Phase;
  countdown: number;
  /** Seconds of play; the round ends at ROUND_TIME. Frozen during the skill cut-in. */
  elapsed: number;
  wave: number;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  pickups: Pickup[];
  shots: Shot[];
  boss: Boss | null;
  bossSpawned: boolean;
  bossDefeated: boolean;
  bossWarning: number;
  skill: { charges: number; max: number; energy: number; cutin: number; beam: number };
  score: number;
  shards: number;
  kills: number;
  /** Visible horizontal extent; wider than W on long phones (stage bleed). */
  bounds: { left: number; right: number };
  spawnTimer: number;
  scripted: number;
  result: Result | null;
  nextId: number;
  events: GameEvent[];
  rng: () => number;
}

/** Teaching drops, so every run sees each power-up early (the ad shows all three). */
const SCRIPTED: { at: number; kind: PickupKind }[] = [
  { at: 6, kind: "pierce" },
  { at: 16, kind: "energy" },
  { at: 26, kind: "multi" },
];

const BOSS_ATTACKS = ["fan", "rain", "beam"] as const;

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame(seed = Date.now()): GameState {
  return {
    phase: "countdown",
    countdown: COUNTDOWN,
    elapsed: 0,
    wave: 1,
    player: { x: 180, y: H / 2, hearts: MAX_HEARTS, hitsTaken: 0, invuln: 0, fireTimer: 0, streams: 2, pierce: 0 },
    bullets: [],
    enemies: [],
    pickups: [],
    shots: [],
    boss: null,
    bossSpawned: false,
    bossDefeated: false,
    bossWarning: 0,
    skill: { charges: 0, max: SKILL_START_MAX, energy: 0, cutin: 0, beam: 0 },
    score: 0,
    shards: 0,
    kills: 0,
    bounds: { left: 0, right: W },
    spawnTimer: 1.2,
    scripted: 0,
    result: null,
    nextId: 1,
    events: [],
    rng: mulberry32(seed),
  };
}

export const timeLeft = (s: GameState) => Math.max(0, ROUND_TIME - s.elapsed);

/** The skill beam band: from just ahead of the rider to the right edge. */
export function beamRect(s: GameState) {
  return { x: s.player.x + 40, y: s.player.y - BEAM_HALF, w: s.bounds.right - s.player.x, h: BEAM_HALF * 2 };
}

export function canUseSkill(s: GameState) {
  return s.phase === "play" && s.skill.charges > 0 && s.skill.beam <= 0;
}

export function update(s: GameState, dt: number, input: Input) {
  if (s.phase === "over") return;

  if (s.phase === "countdown") {
    const before = Math.ceil(s.countdown);
    s.countdown -= dt;
    const now = Math.ceil(s.countdown);
    if (now !== before && now > 0) s.events.push({ type: "countdown", n: now });
    if (s.countdown <= 0) {
      s.phase = "play";
      s.events.push({ type: "go" });
    }
    return;
  }

  if (s.phase === "cutin") {
    s.skill.cutin -= dt;
    if (s.skill.cutin <= 0) {
      s.phase = "play";
      s.skill.beam = BEAM_TIME;
      s.events.push({ type: "beam" });
    }
    return;
  }

  s.elapsed += dt;
  const p = s.player;
  p.invuln = Math.max(0, p.invuln - dt);

  // Movement, kept to the left ~70% of the screen like the ad
  const span = s.bounds.right - s.bounds.left;
  p.x = clamp(p.x + input.mx * PLAYER_SPEED * dt, s.bounds.left + 50, s.bounds.left + span * 0.7);
  p.y = clamp(p.y + input.my * PLAYER_SPEED * dt, 40, H - 34);

  if (input.skill && canUseSkill(s)) {
    s.skill.charges--;
    s.skill.cutin = CUTIN_TIME;
    p.invuln = Math.max(p.invuln, BEAM_TIME + 0.6);
    s.phase = "cutin";
    s.events.push({ type: "skill" });
    return;
  }

  autoFire(s, dt);
  direct(s, dt);
  moveAll(s, dt);
  if (s.boss) updateBoss(s, s.boss, dt);
  collide(s);
  if (s.skill.beam > 0) applyBeam(s, dt);

  if (s.phase === "play" && s.elapsed >= ROUND_TIME) end(s, true);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function autoFire(s: GameState, dt: number) {
  const p = s.player;
  p.fireTimer -= dt;
  while (p.fireTimer <= 0) {
    for (let i = 0; i < p.streams; i++) {
      const offset = (i - (p.streams - 1) / 2) * BULLET_SPACING;
      s.bullets.push({ id: s.nextId++, x: p.x + 46, y: p.y + 4 + offset, pierceLeft: p.pierce, hit: new Set() });
    }
    p.fireTimer += FIRE_INTERVAL;
    s.events.push({ type: "shot" });
  }
}

/** Spawn director: warning → boss at BOSS_AT, regular traffic otherwise. */
function direct(s: GameState, dt: number) {
  const next = SCRIPTED[s.scripted];
  if (next && s.elapsed >= next.at) {
    spawnPickup(s, next.kind, s.bounds.right + 30, 120 + s.rng() * (H - 240));
    s.scripted++;
  }

  if (!s.bossSpawned && s.elapsed >= BOSS_AT) {
    s.bossSpawned = true;
    s.bossWarning = BOSS_WARNING;
    s.events.push({ type: "bossWarning" });
  }
  if (s.bossWarning > 0) {
    s.bossWarning -= dt;
    if (s.bossWarning <= 0) spawnBoss(s);
  }

  s.spawnTimer -= dt;
  if (s.spawnTimer > 0) return;
  const bossUp = s.boss !== null && s.boss.mode !== "dying";
  // The boss brings its own meteors; regular traffic pauses around it
  if (bossUp || s.bossWarning > 0) {
    s.spawnTimer = 1.8;
    return;
  }
  s.spawnTimer = spawnInterval(s.elapsed, s.wave);

  const r = s.rng();
  const late = s.elapsed > 12 || s.wave > 1;
  if (r < 0.18) {
    // Fighter trio in a slanted line
    const y = 90 + s.rng() * (H - 180);
    for (let i = 0; i < 3; i++) spawnEnemy(s, "fighter", s.bounds.right + 40 + i * 46, y + (i - 1) * 52);
  } else if (late && r < 0.18 + (s.wave > 1 ? 0.24 : 0.18)) {
    spawnEnemy(s, "crystal", s.bounds.right + 60, 80 + s.rng() * (H - 160));
  } else if (r < 0.62) {
    spawnEnemy(s, "fighter", s.bounds.right + 40, 50 + s.rng() * (H - 100));
  } else {
    spawnEnemy(s, "meteor", s.bounds.right + 40, 50 + s.rng() * (H - 100));
  }
}

function spawnEnemy(s: GameState, kind: EnemyKind, x: number, y: number) {
  const spec = ENEMIES[kind];
  const speedUp = s.wave > 1 ? 1.2 : 1;
  const vy = kind === "meteor" ? (s.rng() - 0.5) * 90 : 0;
  s.enemies.push({
    id: s.nextId++,
    kind,
    x,
    y,
    baseY: y,
    vx: -spec.speed * speedUp * (0.85 + s.rng() * 0.3),
    vy,
    hp: spec.hp,
    maxHp: spec.hp,
    age: 0,
    phase: s.rng() * Math.PI * 2,
    flash: 0,
  });
}

function spawnPickup(s: GameState, kind: PickupKind, x: number, y: number) {
  s.pickups.push({ id: s.nextId++, kind, x, y, baseY: y, age: 0 });
}

function spawnBoss(s: GameState) {
  s.boss = {
    hp: BOSS_HP,
    maxHp: BOSS_HP,
    x: s.bounds.right + 180,
    y: H / 2,
    targetX: s.bounds.right - 120,
    age: 0,
    mode: "enter",
    attackTimer: 1.6,
    attackIndex: 0,
    attack: null,
    flash: 0,
    dying: 0,
  };
  s.events.push({ type: "bossEnter" });
}

function moveAll(s: GameState, dt: number) {
  for (const b of s.bullets) b.x += BULLET_SPEED * dt;
  s.bullets = s.bullets.filter((b) => b.x < s.bounds.right + 40);

  for (const e of s.enemies) {
    e.age += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.x += e.vx * dt;
    if (e.kind === "fighter") e.y = e.baseY + Math.sin(e.age * 3 + e.phase) * 38;
    else if (e.kind === "crystal") e.y = e.baseY + Math.sin(e.age * 1.2 + e.phase) * 14;
    else e.y += e.vy * dt;
  }
  s.enemies = s.enemies.filter((e) => e.x > s.bounds.left - 80 && e.y > -80 && e.y < H + 80);

  for (const k of s.pickups) {
    k.age += dt;
    k.x -= 95 * dt;
    k.y = k.baseY + Math.sin(k.age * 2.5) * 12;
  }
  s.pickups = s.pickups.filter((k) => k.x > s.bounds.left - 40);

  for (const sh of s.shots) {
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
  }
  s.shots = s.shots.filter((sh) => sh.x > s.bounds.left - 30 && sh.x < s.bounds.right + 30 && sh.y > -30 && sh.y < H + 30);
}

function updateBoss(s: GameState, boss: Boss, dt: number) {
  boss.age += dt;
  boss.flash = Math.max(0, boss.flash - dt);

  if (boss.mode === "dying") {
    boss.dying -= dt;
    boss.x += 40 * dt;
    if (boss.dying <= 0) s.boss = null;
    return;
  }
  if (boss.mode === "enter") {
    boss.x = Math.max(boss.targetX, boss.x - 220 * dt);
    if (boss.x <= boss.targetX) boss.mode = "fight";
    return;
  }

  boss.y = H / 2 + Math.sin(boss.age * 0.7) * 120;
  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0 && !boss.attack) {
    const kind = BOSS_ATTACKS[boss.attackIndex % BOSS_ATTACKS.length];
    boss.attackIndex++;
    boss.attackTimer = 2.4;
    s.events.push({ type: "bossAttack", kind });
    if (kind === "fan") {
      const aim = Math.atan2(s.player.y - boss.y, s.player.x - (boss.x - 70));
      for (let i = -3; i <= 3; i++) {
        const a = aim + i * 0.16;
        s.shots.push({ id: s.nextId++, x: boss.x - 70, y: boss.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, radius: 11 });
      }
    } else if (kind === "rain") {
      for (let i = -1; i <= 1; i++) spawnEnemy(s, "meteor", boss.x - 60, boss.y + i * 70);
    } else {
      boss.attack = { kind: "beam", t: 0, y: s.player.y };
    }
  }

  // Boss beam: 0.9 s of warning line, then 0.7 s of damage along that row
  if (boss.attack) {
    boss.attack.t += dt;
    const live = boss.attack.t >= 0.9 && boss.attack.t < 1.6;
    if (live && Math.abs(s.player.y - boss.attack.y) < 28 && s.player.x < boss.x) hurt(s);
    if (boss.attack.t >= 1.6) boss.attack = null;
  }
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

function collide(s: GameState) {
  const p = s.player;
  const boss = s.boss && s.boss.mode !== "dying" ? s.boss : null;

  for (const b of s.bullets) {
    for (const e of s.enemies) {
      if (e.hp <= 0 || b.hit.has(e.id)) continue;
      const r = ENEMIES[e.kind].radius + 6;
      if (dist2(b.x, b.y, e.x, e.y) > r * r) continue;
      e.hp -= 1;
      e.flash = 0.1;
      b.hit.add(e.id);
      b.pierceLeft--;
      s.events.push({ type: "hit", x: b.x, y: b.y });
      if (b.pierceLeft < 0) break;
    }
    if (b.pierceLeft >= 0 && boss && boss.mode === "fight" && dist2(b.x, b.y, boss.x, boss.y) < BOSS_RADIUS ** 2) {
      boss.hp -= 1;
      boss.flash = 0.08;
      b.pierceLeft = -1;
      s.events.push({ type: "bossHit" });
    }
  }
  s.bullets = s.bullets.filter((b) => b.pierceLeft >= 0);

  for (const e of s.enemies) {
    if (e.hp > 0 && dist2(e.x, e.y, p.x, p.y) < (ENEMIES[e.kind].radius + PLAYER_RADIUS) ** 2 && p.invuln <= 0) {
      e.hp = 0;
      e.maxHp = -1; // rammed: explodes without score
      hurt(s);
    }
  }
  for (const e of s.enemies.filter((e) => e.hp <= 0)) kill(s, e);
  s.enemies = s.enemies.filter((e) => e.hp > 0);

  for (const sh of s.shots) {
    if (dist2(sh.x, sh.y, p.x, p.y) < (sh.radius + PLAYER_RADIUS) ** 2 && p.invuln <= 0) {
      sh.radius = -1;
      hurt(s);
    }
  }
  s.shots = s.shots.filter((sh) => sh.radius > 0);

  if (boss && dist2(boss.x, boss.y, p.x, p.y) < (BOSS_RADIUS + PLAYER_RADIUS) ** 2) hurt(s);
  if (boss && boss.hp <= 0) defeatBoss(s, boss);

  for (const k of s.pickups) {
    if (dist2(k.x, k.y, p.x, p.y) < (24 + PLAYER_RADIUS + 10) ** 2) {
      k.age = -1;
      applyPickup(s, k.kind);
    }
  }
  s.pickups = s.pickups.filter((k) => k.age >= 0);
}

function applyBeam(s: GameState, dt: number) {
  s.skill.beam -= dt;
  const r = beamRect(s);
  const inBand = (y: number, radius: number) => y + radius > r.y && y - radius < r.y + r.h;
  for (const e of s.enemies) {
    if (e.x > r.x - 20 && inBand(e.y, ENEMIES[e.kind].radius)) {
      e.hp -= BEAM_DPS * dt * 3; // trash melts fast; the boss number below is what matters
      e.flash = 0.05;
    }
  }
  for (const e of s.enemies.filter((e) => e.hp <= 0)) kill(s, e);
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  s.shots = s.shots.filter((sh) => !(sh.x > r.x && inBand(sh.y, sh.radius)));
  const boss = s.boss;
  if (boss && boss.mode === "fight" && inBand(boss.y, BOSS_RADIUS)) {
    boss.hp -= BEAM_DPS * dt;
    boss.flash = 0.05;
    if (boss.hp <= 0) defeatBoss(s, boss);
  }
}

function kill(s: GameState, e: Enemy) {
  const rammed = e.maxHp < 0;
  const spec = ENEMIES[e.kind];
  const score = rammed ? 0 : spec.score;
  s.score += score;
  s.events.push({ type: "kill", kind: e.kind, x: e.x, y: e.y, score });
  if (rammed) return;
  s.kills++;
  addEnergy(s, spec.energy);
  const roll = s.rng();
  if (e.kind === "crystal" && roll < 0.55) {
    const kinds: PickupKind[] = ["pierce", "multi", "energy", "energy"];
    spawnPickup(s, kinds[Math.floor(s.rng() * kinds.length)], e.x, e.y);
  } else if (e.kind !== "crystal" && roll < 0.05) {
    spawnPickup(s, "energy", e.x, e.y);
  }
}

function addEnergy(s: GameState, amount: number) {
  const k = s.skill;
  k.energy += amount;
  while (k.energy >= ENERGY_FULL && k.charges < k.max) {
    k.energy -= ENERGY_FULL;
    k.charges++;
    s.events.push({ type: "charge" });
  }
  if (k.charges >= k.max) k.energy = Math.min(k.energy, ENERGY_FULL);
}

function applyPickup(s: GameState, kind: PickupKind) {
  const p = s.player;
  if (kind === "pierce") p.pierce = Math.min(MAX_PIERCE, p.pierce + 1);
  else if (kind === "multi") p.streams = Math.min(MAX_STREAMS, p.streams + 1);
  else if (kind === "energy") addEnergy(s, ENERGY_FULL);
  else {
    s.skill.max = Math.min(SKILL_CAP, s.skill.max + 1);
    addEnergy(s, ENERGY_FULL);
  }
  s.score += 10;
  s.events.push({ type: "pickup", kind });
}

function defeatBoss(s: GameState, boss: Boss) {
  if (boss.mode === "dying") return;
  boss.mode = "dying";
  boss.dying = 1.6;
  boss.attack = null;
  s.bossDefeated = true;
  s.score += BOSS_SCORE;
  s.shards = Math.min(SHARD_GOAL, s.shards + SHARD_GOAL);
  s.events.push({ type: "bossDie", x: boss.x, y: boss.y });
  s.events.push({ type: "waveClear", wave: s.wave });
  s.wave++;
  spawnPickup(s, "multi", boss.x - 80, boss.y - 90);
  spawnPickup(s, "capacity", boss.x - 80, boss.y);
  spawnPickup(s, "pierce", boss.x - 80, boss.y + 90);
}

function hurt(s: GameState) {
  const p = s.player;
  if (p.invuln > 0 || s.phase !== "play") return;
  p.hearts--;
  p.hitsTaken++;
  p.invuln = INVULN_TIME;
  s.events.push({ type: "hurt" });
  if (p.hearts <= 0) end(s, false);
}

function end(s: GameState, won: boolean) {
  if (s.phase === "over") return;
  s.phase = "over";
  const stars = won ? 1 + (s.bossDefeated ? 1 : 0) + (s.player.hitsTaken === 0 ? 1 : 0) : 0;
  s.result = { won, stars };
  s.events.push({ type: "end", won });
}
