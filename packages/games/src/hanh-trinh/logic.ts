import { mulberry32 } from "@web-games/core/math";
import {
  ARROW_INTERVAL,
  ARROW_SPEED,
  CHIEF_EVERY,
  ENEMIES,
  ENEMY_ATTACK,
  ENEMY_MISS,
  GOLD_PER_HP,
  HERO_ATTACK,
  HERO_CRIT,
  HERO_MAX_HP,
  HERO_MISS,
  HERO_X,
  QUEUE_SIZE,
  QUEUE_X0,
  SHIELDS,
  SPACING,
  WALK_SPEED,
  WEAPONS,
  damageScale,
  hpScale,
  killHeal,
  type EnemyKind,
} from "./config";

// Pure simulation: no DOM, no canvas. The renderer reads state and drains
// `events` each frame for animation, numbers and sound.

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  damage: number;
  x: number;
  attackTimer: number;
  shotTimer: number;
}

export interface Arrow {
  id: number;
  x: number;
  damage: number;
}

export type Upgrade = "weapon" | "shield";

export type GameEvent =
  | { type: "heroSwing" }
  | { type: "heroHit"; targetId: number; x: number; damage: number; crit: boolean }
  | { type: "heroMiss"; x: number }
  | { type: "enemySwing"; id: number }
  | { type: "hurt"; damage: number; source: "melee" | "arrow" }
  | { type: "enemyMiss" }
  | { type: "block" }
  | { type: "arrowFired"; id: number; fromId: number }
  | { type: "kill"; id: number; kind: EnemyKind; x: number; gold: number; heal: number }
  | { type: "upgrade"; upgrade: Upgrade; tier: number }
  | { type: "defeat" };

export interface GameState {
  time: number;
  hp: number;
  maxHp: number;
  weapon: number;
  shield: number;
  heroTimer: number;
  queue: Enemy[];
  arrows: Arrow[];
  gold: number;
  kills: number;
  spawned: number;
  over: boolean;
  nextId: number;
  events: GameEvent[];
  rng: () => number;
}

export const slotX = (index: number) => QUEUE_X0 + index * SPACING;

export function createGame(seed = Date.now()): GameState {
  const s: GameState = {
    time: 0,
    hp: HERO_MAX_HP,
    maxHp: HERO_MAX_HP,
    weapon: 0,
    shield: 0,
    heroTimer: 0.6,
    queue: [],
    arrows: [],
    gold: 0,
    kills: 0,
    spawned: 0,
    over: false,
    nextId: 1,
    events: [],
    rng: mulberry32(seed),
  };
  // The ad opens with the line already formed
  for (let i = 0; i < QUEUE_SIZE; i++) spawn(s, slotX(i));
  return s;
}

/** Which foe joins the back of the line next. Opens gently, mixes in tougher kinds. */
export function pickKind(n: number, roll: number): EnemyKind {
  if (n > 0 && n % CHIEF_EVERY === 0) return "chief";
  if (n < 4) return "grunt";
  if (n < 9) return roll < 0.55 ? "grunt" : roll < 0.8 ? "axe" : "archer";
  return roll < 0.38 ? "grunt" : roll < 0.62 ? "axe" : roll < 0.8 ? "archer" : "helmet";
}

function spawn(s: GameState, x: number) {
  s.spawned++;
  const kind = pickKind(s.spawned, s.rng());
  const spec = ENEMIES[kind];
  const hp = Math.round(spec.hp * hpScale(s.spawned));
  s.queue.push({
    id: s.nextId++,
    kind,
    hp,
    maxHp: hp,
    damage: Math.max(1, Math.round(spec.damage * damageScale(s.spawned))),
    x,
    attackTimer: ENEMY_ATTACK * (0.6 + s.rng() * 0.4),
    shotTimer: ARROW_INTERVAL * (0.4 + s.rng() * 0.6),
  });
}

export const nextWeapon = (s: GameState) => WEAPONS[s.weapon + 1] ?? null;
export const nextShield = (s: GameState) => SHIELDS[s.shield + 1] ?? null;

export function canBuy(s: GameState, upgrade: Upgrade) {
  const next = upgrade === "weapon" ? nextWeapon(s) : nextShield(s);
  return !s.over && next !== null && s.gold >= next.cost;
}

export function buy(s: GameState, upgrade: Upgrade): boolean {
  if (!canBuy(s, upgrade)) return false;
  if (upgrade === "weapon") {
    s.weapon++;
    s.gold -= WEAPONS[s.weapon].cost;
    s.events.push({ type: "upgrade", upgrade, tier: s.weapon });
  } else {
    const before = SHIELDS[s.shield].hp;
    s.shield++;
    const tier = SHIELDS[s.shield];
    s.gold -= tier.cost;
    // New max HP, and the bonus is healed right away
    s.maxHp += tier.hp - before;
    s.hp = Math.min(s.maxHp, s.hp + tier.hp - before);
    s.events.push({ type: "upgrade", upgrade, tier: s.shield });
  }
  return true;
}

/** Front enemy is in melee range only once it has walked into its slot. */
const arrived = (e: Enemy, index: number) => Math.abs(e.x - slotX(index)) < 2;

function hurt(s: GameState, damage: number, source: "melee" | "arrow") {
  if (s.rng() < SHIELDS[s.shield].block) {
    s.events.push({ type: "block" });
    return;
  }
  s.hp = Math.max(0, s.hp - damage);
  s.events.push({ type: "hurt", damage, source });
  if (s.hp <= 0) {
    s.over = true;
    s.events.push({ type: "defeat" });
  }
}

export function update(s: GameState, dt: number) {
  if (s.over) return;
  s.time += dt;

  // The line steps forward to fill gaps
  s.queue.forEach((e, i) => {
    const target = slotX(i);
    e.x = e.x > target ? Math.max(target, e.x - WALK_SPEED * dt) : target;
  });
  while (s.queue.length < QUEUE_SIZE) {
    const last = s.queue.at(-1);
    spawn(s, Math.max(slotX(s.queue.length), (last?.x ?? 0) + SPACING));
  }

  const front = s.queue[0];
  const engaged = front !== undefined && arrived(front, 0);

  // Hero swings at the front foe
  s.heroTimer -= dt;
  if (engaged && s.heroTimer <= 0) {
    s.heroTimer = HERO_ATTACK;
    s.events.push({ type: "heroSwing" });
    const roll = s.rng();
    if (roll < HERO_MISS) {
      s.events.push({ type: "heroMiss", x: front.x });
    } else {
      const crit = roll > 1 - HERO_CRIT;
      const damage = WEAPONS[s.weapon].damage * (crit ? 2 : 1);
      front.hp -= damage;
      s.events.push({ type: "heroHit", targetId: front.id, x: front.x, damage, crit });
      if (front.hp <= 0) {
        const gold = Math.round(front.maxHp * GOLD_PER_HP * (0.9 + s.rng() * 0.2));
        s.gold += gold;
        s.kills++;
        s.queue.shift();
        const heal = Math.min(s.maxHp - s.hp, killHeal(s.maxHp));
        s.hp += heal;
        s.events.push({ type: "kill", id: front.id, kind: front.kind, x: front.x, gold, heal });
      }
    }
  } else if (!engaged) {
    s.heroTimer = Math.max(s.heroTimer, 0.35); // a beat after the next foe steps up
  }

  // Front foe swings back
  const attacker = s.queue[0];
  if (attacker && arrived(attacker, 0)) {
    attacker.attackTimer -= dt;
    if (attacker.attackTimer <= 0) {
      attacker.attackTimer = ENEMY_ATTACK;
      s.events.push({ type: "enemySwing", id: attacker.id });
      if (s.rng() < ENEMY_MISS) s.events.push({ type: "enemyMiss" });
      else hurt(s, attacker.damage, "melee");
    }
  }

  // Archers further back shoot over the line
  s.queue.forEach((e, i) => {
    const arrow = ENEMIES[e.kind].arrow;
    if (!arrow || i === 0 || i > 4 || !arrived(e, i)) return;
    e.shotTimer -= dt;
    if (e.shotTimer <= 0) {
      e.shotTimer = ARROW_INTERVAL;
      const a: Arrow = { id: s.nextId++, x: e.x - 20, damage: Math.max(1, Math.round(arrow * damageScale(s.spawned))) };
      s.arrows.push(a);
      s.events.push({ type: "arrowFired", id: a.id, fromId: e.id });
    }
  });

  for (const a of s.arrows) a.x -= ARROW_SPEED * dt;
  const landed = s.arrows.filter((a) => a.x <= HERO_X + 14);
  s.arrows = s.arrows.filter((a) => a.x > HERO_X + 14);
  for (const a of landed) if (!s.over) hurt(s, a.damage, "arrow");
}
