// Numbers marked "ad" were read off the reference recording (RE_NOTES.md); the
// rest is our own tuning, checked by the balance test.

export const W = 540;
export const H = 960;

export const INTRO_TIME = 2.4; // ad: "Your mission: survive the air battle" card
export const STAGE_TIME = 48; // seconds of regular waves before the boss warning
export const WARNING_TIME = 2.6; // ad: WARNING / BEWARE stripes
export const CLEAR_TIME = 3;
export const SCROLL_SPEED = 70; // ocean and islands, px/s

export const MAX_HP = 100;
export const PLAYER_RADIUS = 9; // hitbox: just the cockpit, much smaller than the sprite
export const PLAYER_KEY_SPEED = 520;
export const INVULN_TIME = 0.9;

export const FIRE_INTERVAL = 0.1;
export const BULLET_SPEED = 1100;
export const MAX_POWER = 5;
export const WING_FIRE_INTERVAL = 0.2;
/** ad: two grey wingmen fly beside and slightly behind the lead plane. */
export const WINGMEN = [
  { dx: -50, dy: 22 },
  { dx: 50, dy: 22 },
];

export const ENERGY_FULL = 100;
export const RAPID_TIME = 5;
export const START_BOMBS = 2; // ad: bomb button bottom left
export const MAX_BOMBS = 5;
export const BOMB_DAMAGE = 40;
export const BOMB_BOSS_DAMAGE = 70;

export const DMG_ORB = 10;
export const DMG_MISSILE = 20;
export const DMG_RAM = 25;
export const HEAL_AMOUNT = 35;

export const ORB_RADIUS = 7;
export const MISSILE_RADIUS = 9;

export type EnemyKind = "zero" | "bomber" | "heli" | "boat";

export interface EnemySpec {
  hp: number;
  radius: number;
  score: number;
  coins: number;
  energy: number;
  /** Ships sit on the water: bullets hit them, the plane flies over them. */
  ground?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  zero: { hp: 3, radius: 20, score: 100, coins: 1, energy: 5 }, // ad: green fighters with a small HP bar
  heli: { hp: 16, radius: 28, score: 300, coins: 2, energy: 9 }, // ad: helicopter over the island
  boat: { hp: 20, radius: 24, score: 300, coins: 2, energy: 9, ground: true }, // ad: dark gunboats
  bomber: { hp: 30, radius: 38, score: 600, coins: 5, energy: 16 },
};

export const BOSS_HP = 1100;
export const BOSS_SCORE = 5000;
export const BOSS_COINS = 24;
/** Battleship hull hitbox, half-extents around its centre. */
export const BOSS_HALF_W = 64;
export const BOSS_HALF_H = 190;

export type PickupKind = "power" | "bomb" | "heal" | "coin";

/** HP and fire rate multiplier for later stages (the game loops after each boss). */
export function stageScale(stage: number) {
  return 1 + (stage - 1) * 0.35;
}

/** Seconds between regular waves. */
export function waveInterval(elapsed: number, stage: number) {
  return Math.max(1.5, 3.1 - elapsed * 0.025 - (stage - 1) * 0.3);
}
