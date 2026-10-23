// Numbers marked "ad" were read off the reference recording (RE_NOTES.md); the
// rest is our tuning, checked by the balance simulation in logic.test.ts.

export const W = 540;
export const H = 960;

/** Feet line of every fighter on the dirt road. */
export const GROUND_Y = 520;
export const ROAD_TOP = 360;
export const ROAD_BOTTOM = 650;

export const HERO_X = 92;
export const QUEUE_X0 = 186; // front enemy stands right in front of the hero
export const SPACING = 90; // ad: tightly packed queue, ~5½ visible
export const QUEUE_SIZE = 7; // kept filled from the right edge
export const WALK_SPEED = 300; // px/s when the queue steps forward

export const HERO_MAX_HP = 145; // ad
export const HERO_ATTACK = 1.0; // s between swings (ad: ~1/s)
export const ENEMY_ATTACK = 1.25; // s between swings (ad)
export const HERO_MISS = 0.08;
export const HERO_CRIT = 0.15; // ad: "20" with a flame = double damage
export const ENEMY_MISS = 0.12; // ad: "MISS" over the hero

export const ARROW_INTERVAL = 3.4;
export const ARROW_SPEED = 560;

export const GOLD_PER_HP = 7; // ad: a 30 HP axeman pays ~210

export type EnemyKind = "grunt" | "axe" | "archer" | "helmet" | "chief";

export interface EnemySpec {
  hp: number;
  damage: number;
  /** Arrow damage while standing behind the front (archers only). */
  arrow?: number;
  label: string;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  grunt: { hp: 14, damage: 5, label: "Lính gậy" }, // ad: 14 HP, hits for 5
  axe: { hp: 30, damage: 8, label: "Lính rìu" }, // ad: 30 HP, hits 7–9
  archer: { hp: 10, damage: 3, arrow: 4, label: "Cung thủ" }, // ad: 10 HP, shoots over the line
  helmet: { hp: 55, damage: 12, label: "Lính mũ sắt" }, // ad: 55 HP
  chief: { hp: 150, damage: 12, label: "Tù trưởng" }, // ours: every 20th foe
};

export const CHIEF_EVERY = 20;

/** Later foes are tougher: +4% HP and +3% damage per enemy spawned so far. */
export const hpScale = (n: number) => 1 + n * 0.04;
export const damageScale = (n: number) => 1 + n * 0.03;

/**
 * Ours (the ad never heals): each kill restores a little HP, so a run is a race
 * between upgrades and scaling instead of a fixed countdown.
 */
export const killHeal = (maxHp: number) => Math.round(3 + maxHp * 0.02);

export interface WeaponTier {
  name: string;
  damage: number;
  /** Price to buy THIS tier (the button shows the next tier's price). */
  cost: number;
}

/** ad: stick, then an axe for 200. The rest continue the ladder. */
export const WEAPONS: WeaponTier[] = [
  { name: "Gậy gỗ", damage: 10, cost: 0 },
  { name: "Rìu", damage: 18, cost: 200 },
  { name: "Kiếm sắt", damage: 30, cost: 650 },
  { name: "Búa chiến", damage: 48, cost: 1600 },
  { name: "Kiếm lửa", damage: 75, cost: 3800 },
  { name: "Thần kiếm", damage: 115, cost: 8500 },
  { name: "Long đao", damage: 175, cost: 19000 },
  { name: "Thiên kiếm", damage: 265, cost: 42000 },
];

export interface ShieldTier {
  name: string;
  /** Extra max HP (also healed on purchase). */
  hp: number;
  block: number;
  cost: number;
}

/** ad: a shield for 600. Each tier adds max HP (healed on buy) and block chance. */
export const SHIELDS: ShieldTier[] = [
  { name: "Không khiên", hp: 0, block: 0, cost: 0 },
  { name: "Khiên gỗ", hp: 60, block: 0.1, cost: 600 },
  { name: "Khiên sắt", hp: 130, block: 0.15, cost: 1500 },
  { name: "Khiên vàng", hp: 220, block: 0.2, cost: 3600 },
  { name: "Khiên rồng", hp: 340, block: 0.25, cost: 8000 },
  { name: "Khiên thần", hp: 500, block: 0.3, cost: 18000 },
  { name: "Thiên khiên", hp: 720, block: 0.35, cost: 40000 },
];
