// Rules of Mèo Vũ Trụ: the ship, its three weapon families, pickups, lives and
// the wave flow. Pure and deterministic given a seed: the enemy side lives in
// waves.ts (same rules), the shell in game.ts.
import { type Point, clamp } from "@web-games/core/math";
import {
  BOLT,
  type BulletKind,
  BONE_SCORE,
  DEATH_POWER_LOSS,
  DRAG_SPEED,
  ENEMIES,
  type EnemyKind,
  type Family,
  FISH_PER_MISSILE,
  FISH_SCORE,
  H,
  KEY_SPEED,
  LASER,
  MAGNET_R,
  MAX_LIVES,
  MAX_MISSILES,
  MAX_POWER,
  MISSILE_BOSS_SHARE,
  MISSILE_FLIGHT,
  type PathKind,
  PICKUP_FALL,
  PICKUP_R,
  type PickupKind,
  POWER_BONUS,
  RESPAWN_DELAY,
  SHIELD_TIME,
  SHIP_BODY_R,
  SHIP_HIT_R,
  SHIP_MARGIN,
  SHIP_MAX_Y,
  SHIP_MIN_Y,
  SHIP_START,
  SPREAD,
  START_LIVES,
  START_MISSILES,
  W,
  WAVE_OUTRO,
  type WaveDef,
} from "./config";
import {
  direct,
  dropCan,
  enemyFire,
  moveEnemy,
  rand,
  range,
  scaling,
  stageInfo,
  startWave,
} from "./waves";

export { stageInfo, waveDef, scaling } from "./waves";

export interface Ship {
  x: number;
  y: number;
  alive: boolean;
  /** Seconds until respawn while dead. */
  respawn: number;
  /** Seconds of invulnerability left. */
  shield: number;
  /** Seconds until the next shot. */
  cd: number;
  /** Last horizontal speed, for the banking tilt. */
  vx: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  family: "spread" | "laser";
  /** Enemies it may still hit (laser bolts pass through). */
  pierce: number;
  hit: number[];
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  age: number;
  /** Seconds of white hit flash left. */
  flash: number;
  /** Colour variant (UFO cats, rocks). */
  color: number;
  mode: "enter" | "slot" | "dive" | "path" | "kami" | "rock" | "mini" | "boss";
  /** Formation slot. */
  gx: number;
  gy: number;
  /** Segment start and progress (enter, dive); wind-up time (kami); sweep time (boss3). */
  sx: number;
  sy: number;
  p: number;
  tx: number;
  side: number;
  path: PathKind;
  vx: number;
  vy: number;
  spin: number;
  /** Attack timers (mini-boss, bosses). */
  cd: number[];
  phase: number;
  dead: boolean;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: BulletKind;
  r: number;
}

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Which weapon a can holds. */
  family: Family;
  spin: number;
}

export interface Bomb {
  x: number;
  y: number;
  sy: number;
  t: number;
}

export interface Wave {
  def: WaveDef;
  /** Seconds since the wave (or its clear) began. */
  t: number;
  state: "fight" | "clear";
  spawns: { at: number; e: Enemy }[];
  kills: number;
  /** The kill that drops this wave's fish can. */
  canAt: number;
  canDone: boolean;
  /** How far the formation has crept down. */
  creep: number;
  diveCd: number;
  kamiLeft: number;
  kamiCd: number;
  rockCd: number;
  fishCd: number;
}

export interface State {
  rng: { seed: number };
  phase: "play" | "over";
  t: number;
  score: number;
  lives: number;
  /** Fish toward the next missile. */
  fish: number;
  fishTotal: number;
  missiles: number;
  family: Family;
  power: number;
  /** 0-based global wave index; see stageInfo. */
  stage: number;
  ship: Ship;
  shots: Shot[];
  enemies: Enemy[];
  bullets: Bullet[];
  pickups: Pickup[];
  bombs: Bomb[];
  wave: Wave;
  nextId: number;
}

export interface Input {
  /** Steer toward this point (drag / mouse), at most DRAG_SPEED. */
  tx?: number;
  ty?: number;
  /** Or move in this direction (keys), -1..1 each. */
  dx?: number;
  dy?: number;
  missile?: boolean;
}

export type GameEvent =
  | { type: "fire"; family: Family }
  | { type: "zap"; pts: Point[] }
  | { type: "hit"; x: number; y: number; boss: boolean }
  | {
      type: "kill";
      kind: EnemyKind;
      x: number;
      y: number;
      score: number;
      color: number;
    }
  | { type: "pickup"; kind: PickupKind; x: number; y: number; score: number }
  | { type: "power"; family: Family; power: number; switched: boolean }
  | { type: "missileGain" }
  | { type: "launch" }
  | { type: "boom"; x: number; y: number }
  | { type: "hurt"; x: number; y: number }
  | { type: "respawn" }
  | { type: "wave"; stage: number }
  | { type: "clear"; bonus: number }
  | { type: "bossPhase"; phase: number; x: number; y: number }
  | { type: "bossDown"; kind: EnemyKind; x: number; y: number; score: number }
  | { type: "over" };

export const isBoss = (k: EnemyKind) =>
  k === "boss1" || k === "boss2" || k === "boss3";

/** A fresh run. `stage` and `power` let tests (and a future resume) start mid-run. */
export function createRun(
  seed: number,
  opts: { stage?: number; power?: number; family?: Family } = {},
): State {
  const s: State = {
    rng: { seed },
    phase: "play",
    t: 0,
    score: 0,
    lives: START_LIVES,
    fish: 0,
    fishTotal: 0,
    missiles: START_MISSILES,
    family: opts.family ?? "spread",
    power: opts.power ?? 1,
    stage: opts.stage ?? 0,
    ship: {
      ...SHIP_START,
      alive: true,
      respawn: 0,
      shield: SHIELD_TIME,
      cd: 0.4,
      vx: 0,
    },
    shots: [],
    enemies: [],
    bullets: [],
    pickups: [],
    bombs: [],
    // Replaced at once by startWave
    wave: null as unknown as Wave,
    nextId: 1,
  };
  startWave(s);
  return s;
}

// ---------------------------------------------------------------- weapons

const lvl = (s: State) => clamp(s.power, 1, MAX_POWER) - 1;

/** Seconds between shots for the current weapon. */
export function fireRate(s: State) {
  return s.family === "spread"
    ? SPREAD.rate
    : s.family === "laser"
      ? LASER.rate
      : BOLT.rate;
}

function fire(s: State, ev: GameEvent[]) {
  const { ship } = s;
  const i = lvl(s);
  const nose = { x: ship.x, y: ship.y - 34 };
  if (s.family === "spread") {
    const n = SPREAD.streams[i];
    for (let k = 0; k < n; k++) {
      const a =
        -Math.PI / 2 + ((k - (n - 1) / 2) * SPREAD.gap[i] * Math.PI) / 180;
      s.shots.push({
        x: nose.x + (k - (n - 1) / 2) * 4,
        y: nose.y,
        vx: Math.cos(a) * SPREAD.speed,
        vy: Math.sin(a) * SPREAD.speed,
        dmg: SPREAD.dmg[i],
        family: "spread",
        pierce: 1,
        hit: [],
      });
    }
    ship.cd += SPREAD.rate;
    ev.push({ type: "fire", family: "spread" });
  } else if (s.family === "laser") {
    const n = LASER.beams[i];
    for (let k = 0; k < n; k++)
      s.shots.push({
        x: nose.x + (k - (n - 1) / 2) * LASER.spacing,
        y: nose.y,
        vx: 0,
        vy: -LASER.speed,
        dmg: LASER.dmg[i],
        family: "laser",
        pierce: LASER.pierce[i],
        hit: [],
      });
    ship.cd += LASER.rate;
    ev.push({ type: "fire", family: "laser" });
  } else {
    // Lightning: strike the nearest enemy ahead, then jump to its neighbours
    const first = nearest(s, nose, BOLT.reach, [], true);
    if (!first) {
      ship.cd = 0.05;
      return;
    }
    const pts: Point[] = [nose];
    const hit: number[] = [];
    let cur: Enemy | null = first;
    let dmg = BOLT.dmg[i];
    while (cur && hit.length < BOLT.targets[i]) {
      hit.push(cur.id);
      pts.push({ x: cur.x, y: cur.y });
      damage(s, cur, dmg, ev);
      dmg = BOLT.dmg[i] * BOLT.chainShare;
      cur = nearest(s, cur, BOLT.chainR, hit, false);
    }
    ship.cd += BOLT.rate;
    ev.push({ type: "fire", family: "bolt" }, { type: "zap", pts });
  }
}

const targetable = (e: Enemy) =>
  !e.dead && e.y > -20 && e.y < H + 20 && e.x > -20 && e.x < W + 20;

function nearest(
  s: State,
  from: Point,
  reach: number,
  skip: number[],
  ahead: boolean,
) {
  let best: Enemy | null = null;
  let bestD = reach;
  for (const e of s.enemies) {
    if (!targetable(e) || skip.includes(e.id)) continue;
    if (ahead && e.y > from.y + 30) continue;
    const d =
      Math.hypot(e.x - from.x, e.y - from.y) -
      (isBoss(e.kind) || e.kind === "mini" ? e.r * 0.6 : 0);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function damage(s: State, e: Enemy, dmg: number, ev: GameEvent[]) {
  if (e.dead) return;
  // A boss is armoured while it flies in
  if ((isBoss(e.kind) && e.age < 2.4) || (e.kind === "mini" && e.age < 2))
    return;
  e.hp -= dmg;
  e.flash = 0.07;
  ev.push({
    type: "hit",
    x: e.x,
    y: e.y,
    boss: isBoss(e.kind) || e.kind === "mini",
  });
  if (e.hp <= 0) kill(s, e, ev);
}

function kill(s: State, e: Enemy, ev: GameEvent[]) {
  e.dead = true;
  const def = ENEMIES[e.kind];
  const k = scaling(s.stage);
  const score = Math.round(def.score * k.round);
  s.score += score;
  if (isBoss(e.kind)) {
    ev.push({ type: "bossDown", kind: e.kind, x: e.x, y: e.y, score });
    s.pickups.push({
      kind: "heart",
      x: e.x,
      y: e.y,
      vx: 0,
      vy: -160,
      family: "spread",
      spin: 0,
    });
    dropCan(s, e.x - 40, e.y);
    // The boss's crew bail out with it
    for (const o of s.enemies) if (!o.dead && o !== e) kill(s, o, ev);
  } else {
    ev.push({
      type: "kill",
      kind: e.kind,
      x: e.x,
      y: e.y,
      score,
      color: e.color,
    });
  }
  if (rand(s) < def.fish)
    for (let i = 0; i < def.fishN; i++) drop(s, "fish", e.x, e.y);
  else if (rand(s) < 0.3) drop(s, "bone", e.x, e.y);
  if (rand(s) < def.orb) drop(s, "orb", e.x, e.y);
  if (e.kind === "mini") dropCan(s, e.x + 30, e.y);
  const w = s.wave;
  w.kills++;
  if (!w.canDone && w.kills >= w.canAt) {
    w.canDone = true;
    dropCan(s, e.x, e.y);
  }
}

function drop(s: State, kind: PickupKind, x: number, y: number) {
  s.pickups.push({
    kind,
    x: x + range(s, -12, 12),
    y,
    vx: range(s, -70, 70),
    vy: range(s, -180, -80),
    family: "spread",
    spin: range(s, -4, 4),
  });
}

// ---------------------------------------------------------------- pickups

/** Apply a pickup; exported for tests. */
export function collect(s: State, p: Pickup, ev: GameEvent[]) {
  let score = 0;
  switch (p.kind) {
    case "fish":
      score = FISH_SCORE;
      s.fish++;
      s.fishTotal++;
      if (s.fish >= FISH_PER_MISSILE) {
        s.fish -= FISH_PER_MISSILE;
        if (s.missiles < MAX_MISSILES) {
          s.missiles++;
          ev.push({ type: "missileGain" });
        }
      }
      break;
    case "bone":
      score = BONE_SCORE;
      break;
    case "can": {
      const switched = p.family !== s.family;
      if (switched) s.family = p.family;
      else if (s.power < MAX_POWER) s.power++;
      else score = POWER_BONUS;
      ev.push({ type: "power", family: s.family, power: s.power, switched });
      break;
    }
    case "orb":
      if (s.power < MAX_POWER) s.power++;
      else score = POWER_BONUS;
      ev.push({
        type: "power",
        family: s.family,
        power: s.power,
        switched: false,
      });
      break;
    case "heart":
      if (s.lives < MAX_LIVES) s.lives++;
      else score = POWER_BONUS * 2;
      break;
  }
  s.score += score;
  ev.push({ type: "pickup", kind: p.kind, x: p.x, y: p.y, score });
}

// ---------------------------------------------------------------- lives

function hurt(s: State, ev: GameEvent[]) {
  const { ship } = s;
  if (!ship.alive || ship.shield > 0) return;
  ship.alive = false;
  ship.respawn = RESPAWN_DELAY;
  s.lives--;
  s.power = Math.max(1, s.power - DEATH_POWER_LOSS);
  ev.push({ type: "hurt", x: ship.x, y: ship.y });
  if (s.lives <= 0) {
    s.phase = "over";
    ev.push({ type: "over" });
  }
}

/** Launch a missile if there is one; it bursts MISSILE_FLIGHT later. */
export function launch(s: State, ev: GameEvent[]) {
  if (s.missiles <= 0 || !s.ship.alive || s.bombs.length) return false;
  s.missiles--;
  s.bombs.push({ x: s.ship.x, y: s.ship.y - 30, sy: s.ship.y - 30, t: 0 });
  ev.push({ type: "launch" });
  return true;
}

function boom(s: State, b: Bomb, ev: GameEvent[]) {
  ev.push({ type: "boom", x: b.x, y: b.y });
  s.bullets = [];
  for (const e of s.enemies) {
    if (!targetable(e)) continue;
    if (isBoss(e.kind)) damage(s, e, e.maxHp * MISSILE_BOSS_SHARE, ev);
    else if (e.kind === "mini") damage(s, e, e.maxHp * 0.4, ev);
    else damage(s, e, e.hp + 1, ev);
  }
}

// ---------------------------------------------------------------- frame

const hits = (
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
) => (ax - bx) ** 2 + (ay - by) ** 2 < (ar + br) ** 2;

/** Advance one step. Returns what happened, for sound and effects. */
export function update(s: State, input: Input, dt: number): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase !== "play") return ev;
  s.t += dt;
  const w = s.wave;
  w.t += dt;
  const { ship } = s;

  // Ship
  if (ship.alive) {
    const x0 = ship.x;
    if (input.tx !== undefined && input.ty !== undefined) {
      const dx = input.tx - ship.x;
      const dy = input.ty - ship.y;
      const d = Math.hypot(dx, dy);
      const step = DRAG_SPEED * dt;
      if (d <= step) {
        ship.x = input.tx;
        ship.y = input.ty;
      } else {
        ship.x += (dx / d) * step;
        ship.y += (dy / d) * step;
      }
    } else if (input.dx || input.dy) {
      const dx = input.dx ?? 0;
      const dy = input.dy ?? 0;
      const d = Math.max(1, Math.hypot(dx, dy));
      ship.x += (dx / d) * KEY_SPEED * dt;
      ship.y += (dy / d) * KEY_SPEED * dt;
    }
    ship.x = clamp(ship.x, SHIP_MARGIN, W - SHIP_MARGIN);
    ship.y = clamp(ship.y, SHIP_MIN_Y, SHIP_MAX_Y);
    ship.vx = (ship.x - x0) / dt;
    ship.shield = Math.max(0, ship.shield - dt);
    if (input.missile) launch(s, ev);
    ship.cd -= dt;
    if (ship.cd <= 0) {
      if (ship.cd < -fireRate(s)) ship.cd = 0;
      fire(s, ev);
    }
  } else {
    ship.respawn -= dt;
    if (ship.respawn <= 0) {
      ship.alive = true;
      ship.x = SHIP_START.x;
      ship.y = SHIP_START.y;
      ship.shield = SHIELD_TIME;
      ship.cd = 0.3;
      ev.push({ type: "respawn" });
    }
  }

  // Enemies
  if (w.state === "fight") {
    if (direct(s, dt, ev)) {
      w.state = "clear";
      w.t = 0;
      const def = w.def;
      if (def.kind !== "bonus") {
        const { chapter, wave, round } = stageInfo(s.stage);
        const bonus = (500 + 100 * (wave - 1) + 1000 * (chapter - 1)) * round;
        s.score += bonus;
        ev.push({ type: "clear", bonus });
      } else ev.push({ type: "clear", bonus: 0 });
    }
  } else if (w.t >= WAVE_OUTRO) {
    s.stage++;
    startWave(s);
    ev.push({ type: "wave", stage: s.stage });
  }
  for (const e of s.enemies) {
    if (e.mode !== "boss" && e.mode !== "mini") {
      moveEnemy(s, e, dt);
      enemyFire(s, e, dt);
    }
  }

  // Player shots
  for (const sh of s.shots) {
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    if (sh.y < -40) continue;
    for (const e of s.enemies) {
      if (sh.pierce <= 0) break;
      if (e.dead || e.y < -30 || sh.hit.includes(e.id)) continue;
      if (
        !hits(
          sh.x,
          sh.y,
          sh.family === "laser" ? LASER.r : SPREAD.r,
          e.x,
          e.y,
          e.r,
        )
      )
        continue;
      sh.hit.push(e.id);
      sh.pierce--;
      damage(s, e, sh.dmg, ev);
    }
  }
  s.shots = s.shots.filter(
    (sh) => sh.pierce > 0 && sh.y > -60 && sh.x > -40 && sh.x < W + 40,
  );

  // Enemy bullets
  for (const b of s.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.kind === "yarn") {
      // Yarn balls bounce off the side walls on their way down
      if ((b.x < b.r && b.vx < 0) || (b.x > W - b.r && b.vx > 0)) b.vx = -b.vx;
    }
    if (ship.alive && hits(b.x, b.y, b.r, ship.x, ship.y, SHIP_HIT_R)) {
      if (ship.shield <= 0) {
        b.y = H + 999;
        hurt(s, ev);
      }
    }
  }
  s.bullets = s.bullets.filter(
    (b) => b.y < H + 30 && b.y > -60 && b.x > -40 && b.x < W + 40,
  );

  // Bodies
  for (const e of s.enemies) {
    if (e.dead || !ship.alive) continue;
    const r = isBoss(e.kind)
      ? e.r * 0.85
      : e.kind === "mini"
        ? e.r * 0.8
        : e.r * 0.7;
    if (!hits(e.x, e.y, r, ship.x, ship.y, SHIP_BODY_R)) continue;
    if (ship.shield > 0) {
      // A shielded ship rams small things out of the way
      if (!isBoss(e.kind) && e.kind !== "mini") damage(s, e, e.hp + 1, ev);
      continue;
    }
    hurt(s, ev);
    if (!isBoss(e.kind) && e.kind !== "mini") damage(s, e, e.hp + 1, ev);
  }

  // Missiles
  for (const b of s.bombs) {
    b.t += dt;
    b.y = b.sy + (H * 0.38 - b.sy) * Math.min(1, b.t / MISSILE_FLIGHT);
    if (b.t >= MISSILE_FLIGHT) boom(s, b, ev);
  }
  s.bombs = s.bombs.filter((b) => b.t < MISSILE_FLIGHT);

  // Pickups fall, drift into the ship when close, and are caught
  for (const p of s.pickups) {
    p.vy = Math.min(PICKUP_FALL[p.kind], p.vy + 420 * dt);
    p.vx *= 1 - Math.min(1, 2 * dt);
    p.x = clamp(p.x + p.vx * dt, 16, W - 16);
    p.y += p.vy * dt;
    if (!ship.alive) continue;
    const d = Math.hypot(ship.x - p.x, ship.y - p.y);
    if (d < MAGNET_R) {
      const pull = Math.min(d, 560 * dt);
      p.x += ((ship.x - p.x) / Math.max(d, 1)) * pull;
      p.y += ((ship.y - p.y) / Math.max(d, 1)) * pull;
    }
    if (d < PICKUP_R) {
      collect(s, p, ev);
      p.y = H + 999;
    }
  }
  s.pickups = s.pickups.filter((p) => p.y < H + 40);

  // Rocks that fell past, and the dead
  s.enemies = s.enemies.filter(
    (e) => !e.dead && !(e.mode === "rock" && e.y > H + 60),
  );
  return ev;
}
