import { clamp, mulberry32 } from "@web-games/core/math";
import {
  CELL,
  MAX_HP,
  PLAYER_SPEED,
  WALLS,
  WEAPONS,
  WORLD_H,
  WORLD_W,
} from "./config";

export interface Vec {
  x: number;
  y: number;
}
export interface Enemy extends Vec {
  id: number;
  kind: "drone" | "runner" | "brute" | "boss";
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  flash: number;
}
export interface Bullet extends Vec {
  vx: number;
  vy: number;
  life: number;
  damage: number;
  plasma: boolean;
}
export interface Pickup extends Vec {
  life: number;
}
export type Event = {
  type: "shot" | "kill" | "hit" | "heal" | "blast" | "wave" | "over";
  x: number;
  y: number;
  boss?: boolean;
};
export interface State {
  player: Vec;
  hp: number;
  invuln: number;
  angle: number;
  weapon: number;
  fire: number;
  enemies: Enemy[];
  bullets: Bullet[];
  pickups: Pickup[];
  kills: number;
  score: number;
  wave: number;
  remaining: number;
  spawn: number;
  intermission: number;
  banner: number;
  energy: number;
  elapsed: number;
  over: boolean;
  nextId: number;
  random: () => number;
  field: number[];
  fieldTime: number;
}
export interface Input {
  x: number;
  y: number;
  blast?: boolean;
}
const COLS = WORLD_W / CELL;
const ROWS = WORLD_H / CELL;
export function blocked(x: number, y: number, r = 14): boolean {
  return (
    x < r + 30 ||
    x > WORLD_W - r - 30 ||
    y < r + 30 ||
    y > WORLD_H - r - 30 ||
    WALLS.some(
      (w) =>
        x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h,
    )
  );
}
export function move(p: Vec, dx: number, dy: number, r: number) {
  if (!blocked(p.x + dx, p.y, r)) p.x += dx;
  if (!blocked(p.x, p.y + dy, r)) p.y += dy;
}
export function lineClear(a: Vec, b: Vec) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 14);
  for (let i = 1; i <= n; i++)
    if (blocked(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 2))
      return false;
  return true;
}
function cell(p: Vec) {
  return Math.floor(p.y / CELL) * COLS + Math.floor(p.x / CELL);
}
function flow(s: State) {
  s.field = Array(COLS * ROWS).fill(Infinity);
  const start = cell(s.player);
  s.field[start] = 0;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    for (const next of [at - COLS, at + COLS, at - 1, at + 1]) {
      if (
        next < 0 ||
        next >= COLS * ROWS ||
        Math.abs((next % COLS) - (at % COLS)) > 1 ||
        s.field[next] !== Infinity
      )
        continue;
      const x = ((next % COLS) + 0.5) * CELL,
        y = (Math.floor(next / COLS) + 0.5) * CELL;
      if (blocked(x, y, 18)) continue;
      s.field[next] = s.field[at] + 1;
      queue.push(next);
    }
  }
}
export function createGame(seed = 1): State {
  return {
    player: { x: 540, y: 960 },
    hp: MAX_HP,
    invuln: 0,
    angle: -Math.PI / 2,
    weapon: 0,
    fire: 0,
    enemies: [],
    bullets: [],
    pickups: [],
    kills: 0,
    score: 0,
    wave: 0,
    remaining: 0,
    spawn: 0,
    intermission: 0.8,
    banner: 0,
    energy: 100,
    elapsed: 0,
    over: false,
    nextId: 0,
    random: mulberry32(seed),
    field: [],
    fieldTime: 0,
  };
}
export function selectWeapon(s: State, index: number) {
  if (WEAPONS[index] && s.kills >= WEAPONS[index].unlock) s.weapon = index;
}
function spawnEnemy(s: State) {
  const boss = s.wave % 5 === 0 && s.remaining === 1;
  const roll = s.random();
  const kind: Enemy["kind"] = boss
    ? "boss"
    : roll < 0.18 && s.wave > 2
      ? "brute"
      : roll < 0.45 && s.wave > 1
        ? "runner"
        : "drone";
  const radius = boss ? 27 : kind === "brute" ? 21 : 13;
  const hp =
    (boss ? 1300 : kind === "brute" ? 130 : kind === "runner" ? 28 : 40) *
    (1 + s.wave * 0.12);
  let pos: Vec = { x: 90, y: 90 };
  for (let i = 0; i < 30; i++) {
    const side = Math.floor(s.random() * 4);
    pos =
      side < 2
        ? {
            x: side === 0 ? 72 : WORLD_W - 72,
            y: 90 + s.random() * (WORLD_H - 180),
          }
        : {
            x: 90 + s.random() * (WORLD_W - 180),
            y: side === 2 ? 72 : WORLD_H - 72,
          };
    if (Math.hypot(pos.x - s.player.x, pos.y - s.player.y) > 340) break;
  }
  s.enemies.push({
    ...pos,
    id: s.nextId++,
    kind,
    hp,
    maxHp: hp,
    radius,
    speed: boss
      ? 68
      : kind === "runner"
        ? 130
        : kind === "brute"
          ? 53
          : 69 + s.wave * 2,
    flash: 0,
  });
  s.remaining--;
}
export function update(s: State, input: Input, dt: number): Event[] {
  const events: Event[] = [];
  if (s.over) return events;
  s.elapsed += dt;
  s.invuln = Math.max(0, s.invuln - dt);
  s.banner = Math.max(0, s.banner - dt);
  const length = Math.max(1, Math.hypot(input.x, input.y));
  move(
    s.player,
    (input.x / length) * PLAYER_SPEED * dt,
    (input.y / length) * PLAYER_SPEED * dt,
    14,
  );
  s.fieldTime -= dt;
  if (s.fieldTime <= 0) {
    flow(s);
    s.fieldTime = 0.3;
  }
  if (s.remaining === 0 && s.enemies.length === 0) {
    s.intermission -= dt;
    if (s.intermission <= 0) {
      s.wave++;
      s.remaining = 32 + s.wave * 8;
      s.banner = 2.5;
      s.intermission = 3;
      events.push({ type: "wave", ...s.player, boss: s.wave % 5 === 0 });
    }
  }
  s.spawn -= dt;
  if (s.remaining > 0 && s.spawn <= 0 && s.enemies.length < 100) {
    spawnEnemy(s);
    s.spawn = Math.max(0.12, 0.25 - s.wave * 0.01);
  }
  const hurt = (e: Enemy, damage: number) => {
    if (e.hp <= 0) return;
    e.hp -= damage;
    e.flash = 0.09;
    if (e.hp > 0) return;
    s.kills++;
    s.score += e.kind === "boss" ? 2500 : e.kind === "brute" ? 100 : 25;
    s.energy = Math.min(100, s.energy + 3);
    events.push({ type: "kill", x: e.x, y: e.y, boss: e.kind === "boss" });
    if (s.kills % 16 === 0 || e.kind === "boss")
      s.pickups.push({ x: e.x, y: e.y, life: 20 });
  };
  if (input.blast && s.energy >= 100) {
    s.energy = 0;
    events.push({ type: "blast", ...s.player });
    for (const e of s.enemies)
      if (Math.hypot(e.x - s.player.x, e.y - s.player.y) < 300) hurt(e, 220);
  }
  let target: Enemy | undefined;
  let distance = 300;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - s.player.x, e.y - s.player.y);
    if (d < distance && lineClear(s.player, e)) {
      target = e;
      distance = d;
    }
  }
  s.fire -= dt;
  if (target) {
    s.angle = Math.atan2(target.y - s.player.y, target.x - s.player.x);
    if (s.fire <= 0) {
      const w = WEAPONS[s.weapon];
      s.fire = w.interval;
      for (let i = 0; i < w.pellets; i++) {
        const a =
          s.angle +
          (i - (w.pellets - 1) / 2) * w.spread +
          (s.random() - 0.5) * 0.025;
        s.bullets.push({
          x: s.player.x,
          y: s.player.y,
          vx: Math.cos(a) * w.speed,
          vy: Math.sin(a) * w.speed,
          life: 0.85,
          damage: w.damage,
          plasma: s.weapon === 2,
        });
      }
      events.push({ type: "shot", ...s.player });
    }
  }
  for (const b of s.bullets) {
    b.life -= dt;
    // Swept substeps prevent fast bullets crossing a wall or a small enemy.
    const steps = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 8);
    for (let i = 0; i < steps && b.life > 0; i++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      if (blocked(b.x, b.y, 2)) {
        b.life = 0;
        break;
      }
      for (const e of s.enemies)
        if (
          e.hp > 0 &&
          Math.hypot(e.x - b.x, e.y - b.y) < e.radius + (b.plasma ? 8 : 3)
        ) {
          hurt(e, b.damage);
          b.life = 0;
          break;
        }
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0);
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  for (const e of s.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    let aim: Vec = s.player;
    if (!lineClear(e, s.player)) {
      const at = cell(e);
      let best = s.field[at];
      let next = at;
      for (const n of [at - COLS, at + COLS, at - 1, at + 1])
        if (s.field[n] < best) {
          best = s.field[n];
          next = n;
        }
      aim = {
        x: ((next % COLS) + 0.5) * CELL,
        y: (Math.floor(next / COLS) + 0.5) * CELL,
      };
    }
    const a = Math.atan2(aim.y - e.y, aim.x - e.x);
    move(e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt, e.radius);
    if (
      Math.hypot(e.x - s.player.x, e.y - s.player.y) < e.radius + 14 &&
      s.invuln <= 0
    ) {
      s.hp = Math.max(0, s.hp - (e.kind === "boss" ? 28 : 12));
      s.invuln = 0.75;
      events.push({ type: "hit", ...s.player });
    }
  }
  // Separate neighbours without displacing any creature through scenery.
  for (let i = 0; i < s.enemies.length; i++)
    for (let j = i + 1; j < s.enemies.length; j++) {
      const a = s.enemies[i],
        b = s.enemies[j],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const d = Math.hypot(dx, dy),
        overlap = a.radius + b.radius - d;
      if (overlap > 0 && d > 0.01) {
        const push = Math.min(overlap / 2, 60 * dt);
        move(a, (-dx / d) * push, (-dy / d) * push, a.radius);
        move(b, (dx / d) * push, (dy / d) * push, b.radius);
      }
    }
  for (const p of s.pickups) {
    p.life -= dt;
    if (Math.hypot(p.x - s.player.x, p.y - s.player.y) < 35 && s.hp < MAX_HP) {
      s.hp = clamp(s.hp + 30, 0, MAX_HP);
      p.life = 0;
      events.push({ type: "heal", ...p });
    }
  }
  s.pickups = s.pickups.filter((p) => p.life > 0);
  if (s.hp <= 0) {
    s.over = true;
    events.push({ type: "over", ...s.player });
  }
  return events;
}
