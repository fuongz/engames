// The enemy side of Mèo Vũ Trụ, pure like logic.ts: which enemies a wave sends,
// how each kind moves, and when it shoots. logic.ts owns the state and calls in.
import {
  clamp,
  easeOutCubic,
  lerp,
  nextRandom,
  smoothstep,
} from "@web-games/core/math";
import {
  BULLET_CAP,
  BULLETS,
  type BulletKind,
  CHAPTER_FIRE,
  CHAPTER_HP,
  CHAPTERS,
  ENEMIES,
  type EnemyKind,
  GRID,
  H,
  NO_FIRE_BAND,
  ROUND_FIRE,
  ROUND_HP,
  ROUND_SPEED,
  STAGES_PER_ROUND,
  W,
  WAVE_INTRO,
  WAVES_PER_CHAPTER,
  type WaveDef,
} from "./config";
import type { Enemy, GameEvent, State } from "./logic";

// ---------------------------------------------------------------- stage maths

/** 0-based stage → 1-based round (loop), chapter and wave. */
export function stageInfo(stage: number) {
  return {
    round: Math.floor(stage / STAGES_PER_ROUND) + 1,
    chapter: (Math.floor(stage / WAVES_PER_CHAPTER) % CHAPTERS.length) + 1,
    wave: (stage % WAVES_PER_CHAPTER) + 1,
  };
}

export function waveDef(stage: number): WaveDef {
  const { chapter, wave } = stageInfo(stage);
  return CHAPTERS[chapter - 1][wave - 1];
}

/** Multipliers for this stage: enemy HP, fire rate, bullet/dash speed. */
export function scaling(stage: number) {
  const { round, chapter } = stageInfo(stage);
  return {
    hp: CHAPTER_HP[chapter - 1] * (1 + ROUND_HP * (round - 1)),
    fire: CHAPTER_FIRE[chapter - 1] * (1 + ROUND_FIRE * (round - 1)),
    speed: 1 + ROUND_SPEED * (round - 1),
    round,
  };
}

// ---------------------------------------------------------------- helpers

export const rand = (s: State) => nextRandom(s.rng);
export const range = (s: State, lo: number, hi: number) =>
  lo + (hi - lo) * rand(s);

export function makeEnemy(
  s: State,
  kind: EnemyKind,
  x: number,
  y: number,
  mode: Enemy["mode"],
): Enemy {
  const def = ENEMIES[kind];
  const hp = def.hp * scaling(s.stage).hp;
  return {
    id: s.nextId++,
    kind,
    x,
    y,
    hp,
    maxHp: hp,
    r: def.r,
    age: 0,
    flash: 0,
    color: 0,
    mode,
    gx: 0,
    gy: 0,
    sx: x,
    sy: y,
    p: 0,
    tx: x,
    side: 1,
    path: "snake",
    vx: 0,
    vy: 0,
    spin: 0,
    cd: [1.5, 2.5, 4],
    phase: 1,
    dead: false,
  };
}

/** An enemy bullet from x,y toward angle `a` (radians, 90° = straight down). */
export function shoot(
  s: State,
  x: number,
  y: number,
  a: number,
  kind: BulletKind,
  speedK = 1,
) {
  if (s.bullets.length >= BULLET_CAP * (kind === "yarn" ? 1.2 : 1)) return;
  const v = BULLETS[kind].speed * scaling(s.stage).speed * speedK;
  s.bullets.push({
    x,
    y,
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v,
    kind,
    r: BULLETS[kind].r,
  });
}

/** Angle from x,y to the ship (straight down when the ship is gone). */
export function aimAt(s: State, x: number, y: number) {
  if (!s.ship.alive) return Math.PI / 2;
  return Math.atan2(s.ship.y - y, s.ship.x - x);
}

const DEG = Math.PI / 180;

// ---------------------------------------------------------------- waves

/** Set up the wave at s.stage: its spawn queue and counters. */
export function startWave(s: State) {
  const def = waveDef(s.stage);
  s.wave = {
    def,
    t: 0,
    state: "fight",
    spawns: [],
    kills: 0,
    canAt: Number.POSITIVE_INFINITY,
    canDone: false,
    creep: 0,
    diveCd: 3,
    kamiLeft: 0,
    kamiCd: 0,
    rockCd: 0,
    fishCd: 0,
  };
  const w = s.wave;
  const at = WAVE_INTRO;
  switch (def.kind) {
    case "grid": {
      let i = 0;
      def.rows.forEach((kind, gy) => {
        const side = gy % 2 ? 1 : -1;
        for (let gx = 0; gx < def.cols; gx++) {
          const e = makeEnemy(
            s,
            kind,
            W / 2 + side * (W / 2 + 90),
            -60 - gy * 24,
            "enter",
          );
          e.gx = gx;
          e.gy = gy;
          e.side = side;
          e.color = (gx + gy) % 4;
          w.spawns.push({ at: at + i++ * 0.08, e });
        }
      });
      w.canAt = Math.ceil(i * 0.55);
      break;
    }
    case "lines": {
      let n = 0;
      for (const g of def.groups) {
        for (let i = 0; i < g.count; i++) {
          const e = makeEnemy(s, g.kind, -200, -200, "path");
          e.path = g.path;
          e.side = g.side;
          e.color = (n + i) % 4;
          e.x = pathStart(e).x;
          e.y = pathStart(e).y;
          w.spawns.push({ at: at + g.delay + i * 0.42, e });
        }
        n += g.count;
      }
      w.canAt = Math.ceil(n * 0.55);
      break;
    }
    case "kamikaze":
      w.kamiLeft = def.count;
      w.kamiCd = at;
      w.canAt = Math.ceil(def.count / 2);
      break;
    case "rocks":
      w.rockCd = at;
      w.canAt = 8;
      for (let i = 0; i < def.kittens; i++) {
        const e = makeEnemy(s, "kitten", range(s, 60, W - 60), -50, "kami");
        e.p = 0.9;
        e.tx = e.x;
        w.spawns.push({
          at: at + 3 + (i * (def.dur - 4)) / Math.max(1, def.kittens),
          e,
        });
      }
      break;
    case "mini": {
      w.spawns.push({ at, e: makeEnemy(s, "mini", W / 2, -90, "mini") });
      for (let i = 0; i < def.escorts; i++) {
        const e = makeEnemy(s, "ufo", -200, -200, "path");
        e.path = "loop";
        e.side = i % 2 ? 1 : -1;
        e.color = i % 4;
        Object.assign(e, pathStart(e));
        w.spawns.push({ at: at + 1.5 + Math.floor(i / 2) * 0.5, e });
      }
      w.canAt = Math.max(1, Math.ceil(def.escorts / 2));
      break;
    }
    case "bonus":
      w.fishCd = at;
      break;
    case "boss": {
      const kind = (["boss1", "boss2", "boss3"] as const)[def.boss - 1];
      const e = makeEnemy(s, kind, W / 2, -170, "boss");
      e.cd = [2, 3, 6];
      w.spawns.push({ at: at - 0.6, e });
      break;
    }
  }
}

/** Spawns, dives and timed waves; returns whether the wave is over. */
export function direct(s: State, dt: number, ev: GameEvent[]): boolean {
  const w = s.wave;
  const def = w.def;
  const k = scaling(s.stage);
  while (w.spawns.length && w.spawns[0].at <= w.t) {
    // Kept sorted by time below; grid and lines push in order already
    const next = w.spawns.shift();
    if (next) s.enemies.push(next.e);
  }
  w.spawns.sort((a, b) => a.at - b.at);

  if (def.kind === "grid") {
    w.creep = Math.min(GRID.maxCreep, w.creep + GRID.creep * dt);
    w.diveCd -= dt;
    if (def.dive > 0 && w.diveCd <= 0 && w.t > WAVE_INTRO + 3) {
      w.diveCd = range(s, 0.5, 1.5) / def.dive;
      const divers = s.enemies.filter((e) => e.mode === "dive").length;
      const ready = s.enemies.filter((e) => e.mode === "slot");
      if (ready.length && divers < 2 + stageInfo(s.stage).chapter) {
        const e = ready[Math.floor(rand(s) * ready.length)];
        e.mode = "dive";
        e.p = 0;
        e.sx = e.x;
        e.sy = e.y;
        e.tx = clamp(s.ship.x + range(s, -60, 60), 40, W - 40);
        e.side = rand(s) < 0.5 ? -1 : 1;
      }
    }
  }
  if (def.kind === "kamikaze" && w.kamiLeft > 0) {
    w.kamiCd -= dt;
    const active = s.enemies.filter((e) => e.kind === "kitten").length;
    if (w.kamiCd <= 0 && active < def.at) {
      w.kamiCd = 0.7;
      w.kamiLeft--;
      const e = makeEnemy(s, "kitten", range(s, 50, W - 50), -50, "kami");
      e.p = 0.9;
      e.tx = e.x;
      s.enemies.push(e);
    }
  }
  if (def.kind === "rocks" && w.t < WAVE_INTRO + def.dur) {
    w.rockCd -= dt;
    if (w.rockCd <= 0) {
      w.rockCd = def.every * range(s, 0.7, 1.3);
      const r = range(s, 20, 42);
      const e = makeEnemy(s, "rock", range(s, 30, W - 30), -r - 10, "rock");
      e.r = r;
      e.hp = e.maxHp = (r / 10) * k.hp;
      e.vx = range(s, -50, 50);
      e.vy = range(s, 150, 250) * k.speed;
      e.spin = range(s, -2, 2);
      e.color = Math.floor(rand(s) * 3);
      s.enemies.push(e);
    }
  }
  if (def.kind === "bonus" && w.t < WAVE_INTRO + def.dur) {
    w.fishCd -= dt;
    if (w.fishCd <= 0) {
      w.fishCd = 0.11;
      s.pickups.push({
        kind: rand(s) < 0.85 ? "fish" : "bone",
        x: range(s, 30, W - 30),
        y: -30,
        vx: range(s, -20, 20),
        vy: range(s, 120, 200),
        family: "spread",
        spin: range(s, -3, 3),
      });
    }
    if (!w.canDone && w.t > WAVE_INTRO + 3) {
      w.canDone = true;
      dropCan(s, W / 2, -30);
      s.pickups.push({
        kind: "orb",
        x: W / 3,
        y: -30,
        vx: 0,
        vy: 120,
        family: "spread",
        spin: 0,
      });
    }
  }

  // Bosses and the saucer
  for (const e of s.enemies) {
    if (e.mode === "boss") bossAct(s, e, dt, ev);
    else if (e.mode === "mini") miniAct(s, e, dt);
  }

  const empty =
    w.spawns.length === 0 && w.kamiLeft === 0 && s.enemies.length === 0;
  if (def.kind === "rocks") return empty && w.t > WAVE_INTRO + def.dur;
  if (def.kind === "bonus") return w.t > WAVE_INTRO + def.dur + 2.5;
  return empty;
}

export function dropCan(s: State, x: number, y: number) {
  const families = ["spread", "laser", "bolt"] as const;
  s.pickups.push({
    kind: "can",
    x,
    y,
    vx: range(s, -30, 30),
    vy: -120,
    family: families[Math.floor(rand(s) * 3)],
    spin: 0,
  });
}

// ---------------------------------------------------------------- movement

/** Where a formation enemy belongs right now. */
export function slotOf(s: State, e: Enemy) {
  const def = s.wave.def;
  const cols = def.kind === "grid" ? def.cols : 6;
  return {
    x:
      W / 2 +
      (e.gx - (cols - 1) / 2) * GRID.dx +
      Math.sin(s.t * 0.9) * GRID.sway,
    y: GRID.top + s.wave.creep + e.gy * GRID.dy,
  };
}

function pathStart(e: Enemy) {
  return e.path === "snake"
    ? pathPos(e, 0)
    : { x: W / 2 + e.side * 330, y: -80 };
}

const SNAKE_V = 100;
const SNAKE_PERIOD = (H + 160) / SNAKE_V;

function pathPos(e: Enemy, t: number): { x: number; y: number } {
  if (e.path === "snake") {
    const u = t % SNAKE_PERIOD;
    return {
      x: W / 2 + e.side * 185 * Math.sin(1.5 * t),
      y: -70 + SNAKE_V * u,
    };
  }
  const liss = (u: number) => ({
    x: W / 2 + e.side * 195 * Math.sin(0.85 * u),
    y: 280 + 160 * Math.sin(1.7 * u),
  });
  const p = liss(t);
  if (t >= 1.6) return p;
  const k = smoothstep(t / 1.6);
  return { x: lerp(W / 2 + e.side * 330, p.x, k), y: lerp(-80, p.y, k) };
}

/** Move one ordinary enemy (bosses move in bossAct). */
export function moveEnemy(s: State, e: Enemy, dt: number) {
  e.age += dt;
  e.flash = Math.max(0, e.flash - dt);
  const k = scaling(s.stage);
  switch (e.mode) {
    case "enter": {
      e.p = Math.min(1, e.p + dt / 1.4);
      const slot = slotOf(s, e);
      const q = easeOutCubic(e.p);
      e.x = lerp(e.sx, slot.x, q) + Math.sin(e.p * Math.PI) * 60 * -e.side;
      e.y = lerp(e.sy, slot.y, q);
      if (e.p >= 1) e.mode = "slot";
      break;
    }
    case "slot": {
      const slot = slotOf(s, e);
      e.x = slot.x;
      e.y = slot.y + Math.sin(s.t * 2 + e.gx) * 3;
      break;
    }
    case "dive": {
      e.p += dt / 2.7;
      const q = Math.min(1, e.p);
      e.x =
        lerp(e.sx, e.tx, smoothstep(Math.min(1, q * 1.5))) +
        e.side * 70 * Math.sin(q * Math.PI * 2);
      e.y = e.sy + (H + 90 - e.sy) * q ** 1.5;
      if (e.p >= 1) {
        // Back in at the top and home to its slot
        const slot = slotOf(s, e);
        e.mode = "enter";
        e.p = 0;
        e.sx = slot.x;
        e.sy = -70;
        e.x = slot.x;
        e.y = -70;
      }
      break;
    }
    case "path": {
      const p = pathPos(e, e.age);
      e.vx = p.x - e.x;
      e.x = p.x;
      e.y = p.y;
      break;
    }
    case "kami": {
      if (e.p > 0) {
        // Wind-up at the top: a readable warning before the dash
        e.p -= dt;
        e.x = lerp(e.x, e.tx, Math.min(1, dt * 3));
        e.y = lerp(e.y, 110, Math.min(1, dt * 3.5));
        if (e.p <= 0) {
          const a = aimAt(s, e.x, e.y);
          const v = 340 * k.speed;
          e.vx = Math.cos(a) * v;
          e.vy = Math.max(120, Math.sin(a) * v);
        }
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.y > H + 60 || e.x < -60 || e.x > W + 60) {
          e.x = e.tx = range(s, 50, W - 50);
          e.y = -50;
          e.p = 0.9;
        }
      }
      break;
    }
    case "rock":
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.p += e.spin * dt;
      break;
    case "mini":
    case "boss":
      break;
  }
}

/** Ordinary enemies' shots: random, capped, and never point-blank. */
export function enemyFire(s: State, e: Enemy, dt: number) {
  const def = ENEMIES[e.kind];
  if (def.fire <= 0 || e.mode === "enter" || !s.ship.alive) return;
  if (e.y < 30 || e.y > s.ship.y - NO_FIRE_BAND) return;
  if (s.wave.t < WAVE_INTRO + 1.5) return;
  const rate = def.fire * scaling(s.stage).fire * (e.mode === "dive" ? 3 : 1);
  if (rand(s) >= rate * dt) return;
  if (e.kind === "gunner")
    shoot(s, e.x + 18, e.y + 6, aimAt(s, e.x, e.y), "dart");
  else {
    // Mostly straight down, leaning a little toward the ship
    const a =
      Math.PI / 2 + clamp((aimAt(s, e.x, e.y) - Math.PI / 2) * 0.35, -0.3, 0.3);
    shoot(s, e.x, e.y + 16, a, "hairball");
  }
}

function fan(
  s: State,
  x: number,
  y: number,
  mid: number,
  n: number,
  gap: number,
  kind: BulletKind,
  k = 1,
) {
  for (let i = 0; i < n; i++)
    shoot(s, x, y, mid + (i - (n - 1) / 2) * gap * DEG, kind, k);
}

function miniAct(s: State, e: Enemy, dt: number) {
  const f = scaling(s.stage).fire;
  e.age += dt;
  e.flash = Math.max(0, e.flash - dt);
  if (e.age < 2) {
    e.y = lerp(-90, 190, easeOutCubic(e.age / 2));
    return;
  }
  e.x = W / 2 + Math.sin((e.age - 2) * 0.55) * 160;
  e.y = 190 + Math.sin(e.age * 1.3) * 12;
  e.cd[0] -= dt * f;
  e.cd[1] -= dt * f;
  if (e.cd[0] <= 0) {
    e.cd[0] = 2.4;
    fan(s, e.x, e.y + 40, aimAt(s, e.x, e.y), 5, 13, "hairball");
  }
  if (e.cd[1] <= 0) {
    e.cd[1] = 3.7;
    for (const dx of [-50, 0, 50])
      shoot(s, e.x + dx, e.y + 40, Math.PI / 2, "dart");
  }
}

/** Boss moves and patterns. Three phases by HP: ⅔ and ⅓ each add an attack. */
function bossAct(s: State, e: Enemy, dt: number, ev: GameEvent[]) {
  const f = scaling(s.stage).fire;
  e.age += dt;
  e.flash = Math.max(0, e.flash - dt);
  if (e.age < 2.4) {
    e.y = lerp(-170, 215, easeOutCubic(e.age / 2.4));
    return;
  }
  const phase = e.hp > (e.maxHp * 2) / 3 ? 1 : e.hp > e.maxHp / 3 ? 2 : 3;
  if (phase > e.phase) {
    e.phase = phase;
    ev.push({ type: "bossPhase", phase, x: e.x, y: e.y });
    // Each new phase drops help: an orb, then a can
    if (phase === 2)
      s.pickups.push({
        kind: "orb",
        x: e.x,
        y: e.y + 60,
        vx: 40,
        vy: -100,
        family: "spread",
        spin: 0,
      });
    else dropCan(s, e.x, e.y + 60);
  }
  const t = e.age - 2.4;
  const hurry = 1 + (e.phase - 1) * 0.18;
  for (let i = 0; i < e.cd.length; i++) e.cd[i] -= dt * f * hurry;

  if (e.kind === "boss1") {
    // Captain on the cat-food can: fish cannon bursts, claw fans, then kittens
    e.x = W / 2 + Math.sin(t * 0.5) * (100 + 25 * e.phase);
    e.y = 215 + Math.sin(t * 1.1) * 14;
    if (e.cd[0] <= 0) {
      e.cd[0] = 1.6;
      fan(s, e.x, e.y + 95, aimAt(s, e.x, e.y + 95), 3, 12, "hairball");
    }
    if (e.phase >= 2 && e.cd[1] <= 0) {
      e.cd[1] = 2.6;
      fan(s, e.x - 125, e.y + 90, 100 * DEG, 4, 14, "dart");
      fan(s, e.x + 125, e.y + 90, 80 * DEG, 4, 14, "dart");
    }
    if (e.phase >= 3 && e.cd[2] <= 0) {
      e.cd[2] = 7;
      for (const dx of [-125, 125]) {
        const k = makeEnemy(s, "kitten", e.x + dx, e.y + 80, "kami");
        k.p = 1;
        k.tx = clamp(e.x + dx * 1.4, 50, W - 50);
        s.enemies.push(k);
      }
    }
  } else if (e.kind === "boss2") {
    // Robo-cat: bouncing yarn balls, dart rings, then side-to-side dashes
    if (e.phase < 3) e.x = W / 2 + Math.sin(t * 0.45) * 110;
    else {
      e.tx = Math.floor(t / 3) % 2 ? W - 150 : 150;
      e.x = lerp(e.x, e.tx, Math.min(1, dt * 2.2));
    }
    e.y = 215 + Math.sin(t * 0.9) * 12;
    if (e.cd[0] <= 0) {
      e.cd[0] = 2;
      shoot(s, e.x, e.y + 90, (rand(s) < 0.5 ? 70 : 110) * DEG, "yarn");
    }
    if (e.phase >= 2 && e.cd[1] <= 0) {
      e.cd[1] = 3;
      const off = rand(s) * 30;
      for (let i = 0; i < 12; i++)
        shoot(s, e.x, e.y + 20, (off + i * 30) * DEG, "dart", 0.62);
    }
    if (e.phase >= 3 && e.cd[2] <= 0) {
      e.cd[2] = 1.1;
      fan(s, e.x, e.y + 60, aimAt(s, e.x, e.y + 60), 2, 8, "dart");
    }
  } else {
    // Cat queen on the fish battleship: turret darts, a sweeping mouth stream, then escorts
    e.x = W / 2 + Math.sin(t * 0.4) * 95;
    e.y = 215 + Math.sin(t * 1.2) * 10;
    if (e.cd[0] <= 0) {
      e.cd[0] = 0.9;
      e.spin = e.spin > 0 ? -1 : 1;
      const tx = e.x + e.spin * 120;
      shoot(s, tx, e.y - 10, aimAt(s, tx, e.y - 10), "dart");
    }
    if (e.phase >= 2) {
      // A sweep runs while e.p > 0
      if (e.p > 0) {
        const before = e.p;
        e.p -= dt;
        if (Math.floor(before / 0.18) !== Math.floor(e.p / 0.18)) {
          const k = 1 - e.p / 1.6;
          const a = (e.vx > 0 ? lerp(55, 125, k) : lerp(125, 55, k)) * DEG;
          shoot(s, e.x, e.y + 100, a, "hairball", 0.8);
        }
      } else if (e.cd[1] <= 0) {
        e.cd[1] = 3.6;
        e.p = 1.6;
        e.vx = e.vx > 0 ? -1 : 1;
      }
    }
    if (e.phase >= 3 && e.cd[2] <= 0) {
      e.cd[2] = 9;
      if (s.enemies.filter((x) => x.kind === "ufo").length < 6) {
        for (let i = 0; i < 3; i++) {
          const u = makeEnemy(s, "ufo", -200, -200, "path");
          u.path = "loop";
          u.side = i % 2 ? 1 : -1;
          u.color = (i + e.id) % 4;
          Object.assign(u, pathStart(u));
          u.age = -i * 0.5;
          s.enemies.push(u);
        }
      }
    }
  }
}
