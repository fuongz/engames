// Numbers marked "ad" were measured from the reference recording (RE_NOTES.md);
// the rest is our own tuning, checked by the balance test.

export const W = 960;
export const H = 540;

export const COUNTDOWN = 3; // ad: "Chuẩn Bị Bắt Đầu" 3-2-1
export const ROUND_TIME = 60; // ad: timer starts at 00:59
export const BOSS_AT = 40; // ad: boss warning at 00:20 left
export const BOSS_WARNING = 2.2;

export const PLAYER_SPEED = 430;
export const PLAYER_RADIUS = 16; // hitbox, much smaller than the sprite
export const MAX_HEARTS = 3; // ad: three hearts over the rider
export const INVULN_TIME = 1.6;

export const FIRE_INTERVAL = 0.15;
export const BULLET_SPEED = 980;
export const BULLET_SPACING = 14;
export const MAX_STREAMS = 5;
export const MAX_PIERCE = 3;

export const SKILL_START_MAX = 2; // ad: "0/2"
export const SKILL_CAP = 3; // ad: purple "2→3" bubble
export const ENERGY_FULL = 100;
export const CUTIN_TIME = 1.0; // ad: portrait sweeps across before the beam
export const BEAM_TIME = 2.4;
export const BEAM_HALF = 85;
export const BEAM_DPS = 34;

export const SHARD_GOAL = 10; // ad: "0/10", boss drops "×10"

export type EnemyKind = "fighter" | "meteor" | "crystal";

export interface EnemySpec {
  hp: number;
  radius: number;
  speed: number;
  score: number;
  energy: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  fighter: { hp: 1, radius: 20, speed: 250, score: 20, energy: 6 }, // ad: +20
  meteor: { hp: 2, radius: 22, speed: 320, score: 20, energy: 6 }, // ad: +20
  crystal: { hp: 9, radius: 38, speed: 110, score: 80, energy: 20 }, // ad: +80
};

export const BOSS_HP = 240;
export const BOSS_RADIUS = 92;
export const BOSS_SCORE = 500;

export type PickupKind = "pierce" | "multi" | "energy" | "capacity";

export const PICKUP_TEXT: Record<PickupKind, string> = {
  pierce: "Cấp đạn xuyên.", // ad
  multi: "Tăng số lượng đạn.", // ad
  energy: "Cung cấp Năng Lượng Tinh Tú.", // ad
  capacity: "Mở rộng Năng Lượng Tinh Tú.",
};

/** Seconds between spawns at a given elapsed time; wave 2 (after the boss) is denser. */
export function spawnInterval(elapsed: number, wave: number) {
  if (wave >= 2) return 0.42;
  return Math.max(0.55, 1.15 - elapsed * 0.016);
}
