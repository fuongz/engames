import {
  BOMB_BOSS_DAMAGE,
  BOMB_DAMAGE,
  BOSS_COINS,
  BOSS_HALF_H,
  BOSS_HALF_W,
  BOSS_HP,
  BOSS_SCORE,
  BULLET_SPEED,
  CLEAR_TIME,
  DMG_MISSILE,
  DMG_ORB,
  DMG_RAM,
  ENEMIES,
  ENERGY_FULL,
  type EnemyKind,
  FIRE_INTERVAL,
  H,
  HEAL_AMOUNT,
  INTRO_TIME,
  INVULN_TIME,
  MAX_BOMBS,
  MAX_HP,
  MAX_POWER,
  MISSILE_RADIUS,
  ORB_RADIUS,
  type PickupKind,
  PLAYER_KEY_SPEED,
  PLAYER_RADIUS,
  RAPID_TIME,
  STAGE_TIME,
  START_BOMBS,
  W,
  WARNING_TIME,
  WING_FIRE_INTERVAL,
  WINGMEN,
  stageScale,
  waveInterval,
} from "./config";

// Pure simulation: no DOM, no canvas. The renderer reads state and drains
// `events` each frame for sound and particles.

export interface Input {
  /** Finger drag since the last frame, in logical units (the plane follows it 1:1). */
  dx: number;
  dy: number;
  /** Keyboard axes in [-1, 1]. */
  mx: number;
  my: number;
  /** True on the frame the button was pressed. */
  skill: boolean;
  bomb: boolean;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  invuln: number;
  hitsTaken: number;
  power: number;
  fireTimer: number;
  wingTimer: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wing: boolean;
  dead?: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Swooping fighters turn by `turn` rad/s until `turnLeft` is used up. */
  turn: number;
  turnLeft: number;
  hp: number;
  maxHp: number;
  age: number;
  flash: number;
  fireTimer: number;
  /** Helicopters stop here for a while before leaving. */
  hoverY: number;
  hover: number;
  formation: number;
  dead?: boolean;
}

export interface Shot {
  id: number;
  kind: "orb" | "missile";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  dead?: boolean;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  dead?: boolean;
}

export type BossAttackKind = "chains" | "missiles" | "spread" | "spiral";

export interface Boss {
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  targetY: number;
  age: number;
  mode: "enter" | "fight" | "dying";
  attackTimer: number;
  attackIndex: number;
  burst: { kind: BossAttackKind; t: number; fired: number } | null;
  flash: number;
  dying: number;
}

export type Flow = "waves" | "warning" | "boss" | "clear";

export type GameEvent =
  | { type: "shot" }
  | { type: "hit"; x: number; y: number }
  | { type: "kill"; kind: EnemyKind; x: number; y: number }
  | { type: "hurt"; dmg: number }
  | { type: "pickup"; kind: PickupKind; x: number; y: number }
  | { type: "energyFull" }
  | { type: "rapid" }
  | { type: "bomb" }
  | { type: "warning" }
  | { type: "bossEnter" }
  | { type: "bossHit" }
  | { type: "bossAttack"; kind: BossAttackKind }
  | { type: "bossDie"; x: number; y: number }
  | { type: "stageClear"; stage: number }
  | { type: "stageStart"; stage: number }
  | { type: "end" };

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GameState {
  phase: "intro" | "play" | "over";
  flow: Flow;
  intro: number;
  /** Seconds into the current stage's wave section. */
  elapsed: number;
  /** Seconds since the run started, for animation. */
  time: number;
  stage: number;
  flowTimer: number;
  waveTimer: number;
  waveIndex: number;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  shots: Shot[];
  pickups: Pickup[];
  boss: Boss | null;
  bossesBeaten: number;
  energy: number;
  rapid: number;
  bombs: number;
  score: number;
  coins: number;
  kills: number;
  formations: Map<number, { left: number; killed: number }>;
  /** Visible area; taller than H on long phones (stage bleed). */
  bounds: Bounds;
  nextId: number;
  events: GameEvent[];
  rng: () => number;
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where the plane sits once the intro fly-in is over. */
export const homeY = (b: Bounds) => b.bottom - 190;

export function createGame(seed = Date.now()): GameState {
  const bounds = { left: 0, right: W, top: 0, bottom: H };
  return {
    phase: "intro",
    flow: "waves",
    intro: INTRO_TIME,
    elapsed: 0,
    time: 0,
    stage: 1,
    flowTimer: 0,
    waveTimer: 0.6,
    waveIndex: 0,
    player: {
      x: W / 2,
      y: H + 80,
      hp: MAX_HP,
      invuln: 0,
      hitsTaken: 0,
      power: 1,
      fireTimer: 0,
      wingTimer: 0,
    },
    bullets: [],
    enemies: [],
    shots: [],
    pickups: [],
    boss: null,
    bossesBeaten: 0,
    energy: 0,
    rapid: 0,
    bombs: START_BOMBS,
    score: 0,
    coins: 0,
    kills: 0,
    formations: new Map(),
    bounds,
    nextId: 1,
    events: [],
    rng: mulberry32(seed),
  };
}

export const energyReady = (s: GameState) =>
  s.energy >= ENERGY_FULL && s.rapid <= 0;

/** Horizontal play area: the logical width, trimmed to what is visible. */
function lane(s: GameState) {
  return {
    left: Math.max(s.bounds.left, 0),
    right: Math.min(s.bounds.right, W),
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const dist2 = (ax: number, ay: number, bx: number, by: number) =>
  (ax - bx) ** 2 + (ay - by) ** 2;

export function update(s: GameState, dt: number, input: Input) {
  if (s.phase === "over") return;
  s.time += dt;
  const p = s.player;

  if (s.phase === "intro") {
    s.intro -= dt;
    // Fly in from below the screen and settle
    const target = homeY(s.bounds);
    p.y += (target - p.y) * Math.min(1, dt * 2.6);
    if (s.intro <= 0) {
      s.phase = "play";
      p.y = Math.min(p.y, target + 20);
    }
    return;
  }

  p.invuln = Math.max(0, p.invuln - dt);
  const l = lane(s);
  p.x = clamp(
    p.x + input.dx + input.mx * PLAYER_KEY_SPEED * dt,
    l.left + 24,
    l.right - 24,
  );
  p.y = clamp(
    p.y + input.dy + input.my * PLAYER_KEY_SPEED * dt,
    s.bounds.top + 90,
    s.bounds.bottom - 40,
  );

  if (input.skill && energyReady(s)) {
    s.energy = 0;
    s.rapid = RAPID_TIME;
    s.events.push({ type: "rapid" });
  }
  if (input.bomb && s.bombs > 0) useBomb(s);
  s.rapid = Math.max(0, s.rapid - dt);

  fire(s, dt);
  direct(s, dt);
  moveAll(s, dt);
  if (s.boss) updateBoss(s, s.boss, dt);
  collide(s);
  sweep(s);
}

// ---------------------------------------------------------------- firing

/** Bullet offsets for a power level: one more stream per level, fanning from level 3. */
export function streams(level: number) {
  const n = level + 1;
  const out: { dx: number; angle: number }[] = [];
  for (let i = 0; i < n; i++) {
    const off = i - (n - 1) / 2;
    out.push({ dx: off * 10, angle: level >= 3 ? off * 0.045 : 0 });
  }
  return out;
}

function fire(s: GameState, dt: number) {
  const p = s.player;
  const rapid = s.rapid > 0;
  p.fireTimer -= dt;
  while (p.fireTimer <= 0) {
    const level = rapid ? Math.min(MAX_POWER + 1, p.power + 2) : p.power;
    for (const st of streams(level)) {
      s.bullets.push({
        id: s.nextId++,
        x: p.x + st.dx,
        y: p.y - 30,
        vx: Math.sin(st.angle) * BULLET_SPEED,
        vy: -Math.cos(st.angle) * BULLET_SPEED,
        wing: false,
      });
    }
    p.fireTimer += rapid ? FIRE_INTERVAL * 0.6 : FIRE_INTERVAL;
    s.events.push({ type: "shot" });
  }
  p.wingTimer -= dt;
  while (p.wingTimer <= 0) {
    for (const w of WINGMEN) {
      s.bullets.push({
        id: s.nextId++,
        x: p.x + w.dx,
        y: p.y + w.dy - 18,
        vx: 0,
        vy: -BULLET_SPEED * 0.9,
        wing: true,
      });
    }
    p.wingTimer += rapid ? WING_FIRE_INTERVAL * 0.5 : WING_FIRE_INTERVAL;
  }
}

function useBomb(s: GameState) {
  s.bombs--;
  s.player.invuln = Math.max(s.player.invuln, 1.5);
  for (const sh of s.shots) sh.dead = true;
  for (const e of s.enemies) {
    if (e.y < s.bounds.top - 10 || e.dead) continue;
    damage(s, e, BOMB_DAMAGE);
  }
  const b = s.boss;
  if (b && b.mode === "fight") {
    b.hp -= BOMB_BOSS_DAMAGE;
    b.flash = 0.3;
    if (b.hp <= 0) defeatBoss(s, b);
  }
  s.events.push({ type: "bomb" });
}

// ---------------------------------------------------------------- director

type Wave = "vee" | "swoop" | "column" | "heli" | "boats" | "bomber";

/** The first waves teach each threat once, then the mix turns random. */
const OPENING: Wave[] = [
  "vee",
  "swoop",
  "boats",
  "swoop",
  "heli",
  "vee",
  "bomber",
];

function direct(s: GameState, dt: number) {
  if (s.flow === "waves") {
    s.elapsed += dt;
    s.waveTimer -= dt;
    if (s.waveTimer <= 0 && s.elapsed < STAGE_TIME - 3) {
      spawnWave(s, pickWave(s));
      s.waveIndex++;
      s.waveTimer = waveInterval(s.elapsed, s.stage);
    }
    const airborne = s.enemies.some((e) => !ENEMIES[e.kind].ground);
    if (s.elapsed >= STAGE_TIME && (!airborne || s.elapsed >= STAGE_TIME + 4)) {
      s.flow = "warning";
      s.flowTimer = WARNING_TIME;
      s.events.push({ type: "warning" });
    }
  } else if (s.flow === "warning") {
    s.flowTimer -= dt;
    if (s.flowTimer <= 0) {
      s.flow = "boss";
      spawnBoss(s);
    }
  } else if (s.flow === "clear") {
    s.flowTimer -= dt;
    if (s.flowTimer <= 0) {
      s.stage++;
      s.flow = "waves";
      s.elapsed = 0;
      s.waveIndex = 0;
      s.waveTimer = 1;
      s.events.push({ type: "stageStart", stage: s.stage });
    }
  }
}

function pickWave(s: GameState): Wave {
  if (s.stage === 1 && s.waveIndex < OPENING.length)
    return OPENING[s.waveIndex];
  const table: [Wave, number][] = [
    ["vee", 3],
    ["swoop", 3],
    ["column", 2],
    ["boats", 2],
    ["heli", 2],
    ["bomber", s.elapsed > 12 ? 1.5 : 0],
  ];
  const total = table.reduce((n, [, w]) => n + w, 0);
  let r = s.rng() * total;
  for (const [wave, w] of table) {
    r -= w;
    if (r < 0) return wave;
  }
  return "vee";
}

function newFormation(s: GameState, size: number) {
  const id = s.nextId++;
  s.formations.set(id, { left: size, killed: 0 });
  return id;
}

function spawnWave(s: GameState, wave: Wave) {
  const top = s.bounds.top;
  const rng = s.rng;
  if (wave === "vee") {
    const f = newFormation(s, 5);
    const cx = 130 + rng() * (W - 260);
    for (let i = 0; i < 5; i++) {
      const rank = Math.ceil(i / 2);
      const side = i % 2 ? -1 : 1;
      spawnEnemy(s, "zero", cx + side * rank * 46, top - 40 - rank * 42, {
        vy: 190,
        formation: f,
      });
    }
  } else if (wave === "swoop") {
    const f = newFormation(s, 6);
    const fromLeft = rng() < 0.5;
    for (let i = 0; i < 6; i++) {
      spawnEnemy(
        s,
        "zero",
        (fromLeft ? 70 : W - 70) + (i % 2 ? 22 : -22),
        top - 30 - i * 66,
        {
          vy: 240,
          turn: fromLeft ? -0.7 : 0.7,
          turnLeft: 1.45,
          formation: f,
        },
      );
    }
  } else if (wave === "column") {
    const f = newFormation(s, 4);
    const x = clamp(s.player.x + (rng() - 0.5) * 120, 60, W - 60);
    for (let i = 0; i < 4; i++)
      spawnEnemy(s, "zero", x, top - 40 - i * 52, {
        vy: 320,
        formation: f,
        fireTimer: 99,
      });
  } else if (wave === "heli") {
    for (const fx of [0.28, 0.72]) {
      spawnEnemy(s, "heli", W * fx + (rng() - 0.5) * 60, top - 50, {
        vy: 150,
        hoverY: top + 200 + rng() * 120,
        fireTimer: 0.8,
      });
    }
  } else if (wave === "boats") {
    const n = 2 + (rng() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W + (rng() - 0.5) * 50;
      spawnEnemy(s, "boat", x, top - 40 - rng() * 120, {
        vy: 95,
        vx: (rng() - 0.5) * 20,
        fireTimer: 1 + rng(),
      });
    }
  } else {
    spawnEnemy(s, "bomber", 120 + rng() * (W - 240), top - 60, {
      vy: 55,
      fireTimer: 1.2,
    });
  }
}

function spawnEnemy(
  s: GameState,
  kind: EnemyKind,
  x: number,
  y: number,
  o: Partial<Enemy>,
) {
  const hp = Math.round(ENEMIES[kind].hp * stageScale(s.stage));
  s.enemies.push({
    id: s.nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    turn: 0,
    turnLeft: 0,
    hp,
    maxHp: hp,
    age: 0,
    flash: 0,
    // Only some fighters shoot, once, after they are well on screen
    fireTimer:
      kind === "zero" ? (s.rng() < 0.4 ? 0.7 + s.rng() * 1.2 : 99) : 1.5,
    hoverY: 0,
    hover: 0,
    formation: 0,
    ...o,
  });
}

// ---------------------------------------------------------------- movement

function orbSpeed(s: GameState) {
  return 230 * (1 + (s.stage - 1) * 0.08);
}

function aimedOrb(
  s: GameState,
  x: number,
  y: number,
  spread = 0,
  speed = orbSpeed(s),
) {
  const a = Math.atan2(s.player.y - y, s.player.x - x) + spread;
  orb(s, x, y, a, speed);
}

function orb(s: GameState, x: number, y: number, angle: number, speed: number) {
  s.shots.push({
    id: s.nextId++,
    kind: "orb",
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: ORB_RADIUS,
    hp: 1,
  });
}

function moveAll(s: GameState, dt: number) {
  const b = s.bounds;
  for (const u of s.bullets) {
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    if (u.y < b.top - 30) u.dead = true;
  }

  const rate = stageScale(s.stage) ** 0.5;
  for (const e of s.enemies) {
    e.age += dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.kind === "heli") {
      if (e.hover === 0 && e.y >= e.hoverY) {
        e.hover = 4.5;
        e.vy = 0;
      }
      if (e.hover > 0) {
        e.hover -= dt;
        if (e.hover <= 0) {
          e.hover = -1;
          e.vx = e.x < W / 2 ? -110 : 110;
          e.vy = 70;
        }
      }
    }
    if (e.turnLeft > 0) {
      const step = Math.min(e.turnLeft, Math.abs(e.turn) * dt);
      e.turnLeft -= step;
      const a = Math.atan2(e.vy, e.vx) + Math.sign(e.turn) * step;
      const v = Math.hypot(e.vx, e.vy);
      e.vx = Math.cos(a) * v;
      e.vy = Math.sin(a) * v;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Shooting, only while comfortably on screen and above the player
    const visible = e.y > b.top + 40 && e.y < s.player.y - 110;
    e.fireTimer -= dt * (e.kind === "zero" ? 1 : rate);
    if (e.fireTimer <= 0 && visible) {
      if (e.kind === "zero") {
        aimedOrb(s, e.x, e.y + 14);
        e.fireTimer = 99;
      } else if (e.kind === "heli") {
        for (const sp of [-0.18, 0, 0.18]) aimedOrb(s, e.x, e.y + 10, sp);
        e.fireTimer = 1.4;
      } else if (e.kind === "boat") {
        aimedOrb(s, e.x, e.y, 0, orbSpeed(s) * 0.85);
        e.fireTimer = 2.2;
      } else {
        for (const sp of [-0.28, 0, 0.28]) aimedOrb(s, e.x, e.y + 30, sp);
        e.fireTimer = 1.8;
      }
    } else if (e.fireTimer <= 0 && e.kind !== "zero") {
      e.fireTimer = 0.3;
    }

    if (e.y > b.bottom + 70 || e.x < -90 || e.x > W + 90) escaped(s, e);
  }

  for (const sh of s.shots) {
    sh.x += sh.vx * dt;
    sh.y += sh.vy * dt;
    if (
      sh.y > b.bottom + 30 ||
      sh.y < b.top - 400 ||
      sh.x < b.left - 30 ||
      sh.x > b.right + 30
    )
      sh.dead = true;
  }

  const p = s.player;
  for (const k of s.pickups) {
    k.age += dt;
    const d = Math.sqrt(dist2(k.x, k.y, p.x, p.y));
    if (k.kind === "coin" && k.age > 0.35 && d < 140) {
      // Magnet: coins near the plane fly to it
      k.vx = ((p.x - k.x) / d) * 620;
      k.vy = ((p.y - k.y) / d) * 620;
    } else {
      k.vx *= 0.96;
      k.vy += (60 - k.vy) * Math.min(1, dt * 2.5);
    }
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    if (k.kind !== "coin") k.x = clamp(k.x, 30, W - 30);
    if (k.y > b.bottom + 40) k.dead = true;
  }
}

/** An enemy left the screen alive: its formation can no longer be wiped out. */
function escaped(s: GameState, e: Enemy) {
  e.dead = true;
  const f = s.formations.get(e.formation);
  if (f) f.left = -99;
}

// ---------------------------------------------------------------- boss

const BOSS_CYCLE: BossAttackKind[] = ["chains", "missiles", "chains", "spread"];

function spawnBoss(s: GameState) {
  const hp = Math.round(BOSS_HP * stageScale(s.stage));
  s.boss = {
    hp,
    maxHp: hp,
    x: W / 2,
    y: s.bounds.top - BOSS_HALF_H - 60,
    targetY: s.bounds.top + 175,
    age: 0,
    mode: "enter",
    attackTimer: 1.2,
    attackIndex: 0,
    burst: null,
    flash: 0,
    dying: 0,
  };
  s.events.push({ type: "bossEnter" });
}

/** Where the bow guns sit, relative to the hull centre. */
export const BOSS_GUNS = { bow: 150, mid: 30 };

function updateBoss(s: GameState, boss: Boss, dt: number) {
  boss.age += dt;
  boss.flash = Math.max(0, boss.flash - dt);
  if (boss.mode === "dying") {
    boss.dying -= dt;
    boss.y += 30 * dt;
    if (boss.dying <= 0) s.boss = null;
    return;
  }
  if (boss.mode === "enter") {
    boss.y = Math.min(boss.targetY, boss.y + 95 * dt);
    if (boss.y >= boss.targetY) {
      boss.mode = "fight";
      boss.age = 0;
    }
    return;
  }

  boss.x = W / 2 + Math.sin(boss.age * 0.35) * 80;
  boss.y = boss.targetY + Math.sin(boss.age * 0.6) * 10;

  if (!boss.burst) {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      let kind = BOSS_CYCLE[boss.attackIndex % BOSS_CYCLE.length];
      if (kind === "spread" && boss.hp < boss.maxHp / 2) kind = "spiral";
      boss.attackIndex++;
      boss.burst = { kind, t: 0, fired: 0 };
      s.events.push({ type: "bossAttack", kind });
    }
    return;
  }

  const burst = boss.burst;
  burst.t += dt;
  const bowY = boss.y + BOSS_GUNS.bow;
  const speed = orbSpeed(s) * 1.1;
  let done = false;
  if (burst.kind === "chains") {
    // ad: four guns on the bow spit beads in four slightly fanned lines
    const due = Math.min(10, Math.floor(burst.t / 0.075) + 1);
    for (; burst.fired < due; burst.fired++) {
      for (const [i, a] of [-0.3, -0.1, 0.1, 0.3].entries()) {
        orb(s, boss.x + (i - 1.5) * 14, bowY, Math.PI / 2 + a, speed);
      }
    }
    done = burst.t >= 0.8;
  } else if (burst.kind === "missiles") {
    // ad: missiles drop from the top edge with a flame trail
    const due = Math.min(4, Math.floor(burst.t / 0.35) + 1);
    for (; burst.fired < due; burst.fired++) {
      const x = clamp(s.player.x + (s.rng() - 0.5) * 260, 40, W - 40);
      s.shots.push({
        id: s.nextId++,
        kind: "missile",
        x,
        y: s.bounds.top - 30,
        vx: 0,
        vy: 340,
        radius: MISSILE_RADIUS,
        hp: 2,
      });
    }
    done = burst.t >= 1.3;
  } else if (burst.kind === "spread") {
    const due = Math.min(3, Math.floor(burst.t / 0.4) + 1);
    for (; burst.fired < due; burst.fired++) {
      for (let i = -3; i <= 3; i++)
        aimedOrb(s, boss.x, boss.y + BOSS_GUNS.mid, i * 0.15, speed * 0.9);
    }
    done = burst.t >= 1;
  } else {
    const due = Math.floor(burst.t / 0.09) + 1;
    for (; burst.fired < due && burst.fired < 18; burst.fired++) {
      for (let k = 0; k < 4; k++)
        orb(
          s,
          boss.x,
          boss.y + BOSS_GUNS.mid,
          burst.fired * 0.26 + (k * Math.PI) / 2,
          speed * 0.75,
        );
    }
    done = burst.t >= 1.7;
  }
  if (done) {
    boss.burst = null;
    boss.attackTimer = 1.25 / stageScale(s.stage) ** 0.5;
  }
}

export function inBoss(boss: Boss, x: number, y: number, pad = 0) {
  // Tapered bow: the hull narrows over its last 90 px
  const dy = y - boss.y;
  if (Math.abs(dy) > BOSS_HALF_H + pad) return false;
  const taper = dy > BOSS_HALF_H - 90 ? 1 - (dy - (BOSS_HALF_H - 90)) / 110 : 1;
  return Math.abs(x - boss.x) <= BOSS_HALF_W * taper + pad;
}

// ---------------------------------------------------------------- collisions

function collide(s: GameState) {
  const p = s.player;
  const boss = s.boss && s.boss.mode === "fight" ? s.boss : null;

  for (const u of s.bullets) {
    if (u.dead) continue;
    for (const e of s.enemies) {
      if (e.dead || e.y < s.bounds.top - 10) continue;
      const r = ENEMIES[e.kind].radius;
      if (dist2(u.x, u.y, e.x, e.y) > r * r) continue;
      u.dead = true;
      damage(s, e, 1);
      s.events.push({ type: "hit", x: u.x, y: u.y });
      break;
    }
    if (u.dead) continue;
    for (const sh of s.shots) {
      if (
        sh.kind !== "missile" ||
        sh.dead ||
        dist2(u.x, u.y, sh.x, sh.y) > 16 * 16
      )
        continue;
      u.dead = true;
      if (--sh.hp <= 0) {
        sh.dead = true;
        s.score += 50;
        s.events.push({ type: "hit", x: sh.x, y: sh.y });
      }
      break;
    }
    if (u.dead || !boss) continue;
    if (inBoss(boss, u.x, u.y)) {
      u.dead = true;
      boss.hp -= 1;
      boss.flash = 0.06;
      s.events.push({ type: "bossHit" });
      if (boss.hp <= 0) defeatBoss(s, boss);
    }
  }

  for (const sh of s.shots) {
    if (
      sh.dead ||
      dist2(sh.x, sh.y, p.x, p.y) > (sh.radius + PLAYER_RADIUS) ** 2
    )
      continue;
    if (p.invuln > 0) continue;
    sh.dead = true;
    hurt(s, sh.kind === "missile" ? DMG_MISSILE : DMG_ORB);
  }

  for (const e of s.enemies) {
    const spec = ENEMIES[e.kind];
    if (e.dead || spec.ground || p.invuln > 0) continue;
    if (dist2(e.x, e.y, p.x, p.y) > (spec.radius * 0.8 + PLAYER_RADIUS) ** 2)
      continue;
    hurt(s, DMG_RAM);
    damage(s, e, 10);
  }
  if (boss && inBoss(boss, p.x, p.y, PLAYER_RADIUS)) hurt(s, DMG_RAM);

  for (const k of s.pickups) {
    if (k.dead || dist2(k.x, k.y, p.x, p.y) > 40 * 40) continue;
    k.dead = true;
    collect(s, k);
  }
}

function damage(s: GameState, e: Enemy, amount: number) {
  e.hp -= amount;
  e.flash = 0.08;
  if (e.hp <= 0 && !e.dead) kill(s, e);
}

function kill(s: GameState, e: Enemy) {
  e.dead = true;
  const spec = ENEMIES[e.kind];
  s.kills++;
  s.score += Math.round(spec.score * stageScale(s.stage));
  addEnergy(s, spec.energy);
  for (let i = 0; i < spec.coins; i++) dropCoin(s, e.x, e.y);
  s.events.push({ type: "kill", kind: e.kind, x: e.x, y: e.y });

  const f = s.formations.get(e.formation);
  if (f) {
    f.killed++;
    f.left--;
    // Wiping out a whole formation earns a crate, like the red squadrons in 1942
    if (f.left === 0) {
      spawnPickup(s, rewardKind(s), e.x, e.y);
      s.formations.delete(e.formation);
    }
  }
  if (e.kind === "bomber") spawnPickup(s, rewardKind(s), e.x, e.y);
  else if (s.kills % 30 === 0)
    spawnPickup(s, s.rng() < 0.5 ? "bomb" : "heal", e.x, e.y);
}

function rewardKind(s: GameState): PickupKind {
  if (s.player.power < MAX_POWER) return "power";
  if (s.player.hp < MAX_HP * 0.6) return "heal";
  return s.bombs < MAX_BOMBS ? "bomb" : "heal";
}

function dropCoin(s: GameState, x: number, y: number) {
  const a = s.rng() * Math.PI * 2;
  const v = 60 + s.rng() * 120;
  s.pickups.push({
    id: s.nextId++,
    kind: "coin",
    x,
    y,
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v - 40,
    age: 0,
  });
}

function spawnPickup(s: GameState, kind: PickupKind, x: number, y: number) {
  s.pickups.push({ id: s.nextId++, kind, x, y, vx: 0, vy: -60, age: 0 });
}

function addEnergy(s: GameState, amount: number) {
  if (s.rapid > 0) return;
  const before = s.energy;
  s.energy = Math.min(ENERGY_FULL, s.energy + amount);
  if (before < ENERGY_FULL && s.energy >= ENERGY_FULL)
    s.events.push({ type: "energyFull" });
}

function collect(s: GameState, k: Pickup) {
  const p = s.player;
  if (k.kind === "coin") {
    s.coins++;
    s.score += 10;
  } else if (k.kind === "power") {
    if (p.power < MAX_POWER) p.power++;
    else s.score += 1000;
  } else if (k.kind === "bomb") {
    s.bombs = Math.min(MAX_BOMBS, s.bombs + 1);
  } else {
    p.hp = Math.min(MAX_HP, p.hp + HEAL_AMOUNT);
  }
  s.events.push({ type: "pickup", kind: k.kind, x: k.x, y: k.y });
}

function defeatBoss(s: GameState, boss: Boss) {
  if (boss.mode === "dying") return;
  boss.mode = "dying";
  boss.dying = 2;
  boss.burst = null;
  s.bossesBeaten++;
  s.score += Math.round(BOSS_SCORE * stageScale(s.stage));
  for (let i = 0; i < BOSS_COINS; i++)
    dropCoin(s, boss.x + (s.rng() - 0.5) * 100, boss.y + (s.rng() - 0.5) * 260);
  spawnPickup(s, "heal", boss.x - 60, boss.y + 120);
  spawnPickup(s, rewardKind(s), boss.x + 60, boss.y + 120);
  // The ship's guns die with it
  for (const sh of s.shots) sh.dead = true;
  s.flow = "clear";
  s.flowTimer = CLEAR_TIME;
  s.events.push({ type: "bossDie", x: boss.x, y: boss.y });
  s.events.push({ type: "stageClear", stage: s.stage });
}

function hurt(s: GameState, dmg: number) {
  const p = s.player;
  if (p.invuln > 0 || s.phase !== "play") return;
  p.hp = Math.max(0, p.hp - dmg);
  p.hitsTaken++;
  p.invuln = INVULN_TIME;
  s.events.push({ type: "hurt", dmg });
  if (p.hp <= 0) {
    s.phase = "over";
    s.events.push({ type: "end" });
  }
}

function sweep(s: GameState) {
  s.bullets = s.bullets.filter((u) => !u.dead);
  s.enemies = s.enemies.filter((e) => !e.dead);
  s.shots = s.shots.filter((sh) => !sh.dead);
  s.pickups = s.pickups.filter((k) => !k.dead);
}
