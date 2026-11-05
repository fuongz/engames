// Tuning numbers and tables for Mèo Vũ Trụ. No logic here.

/** Logical portrait canvas. The playfield is exactly this rectangle; the bleed only shows more stars. */
export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- ship

export const SHIP_START = { x: W / 2, y: H - 150 };
/** The ship stays in the lower part of the field, clear of the formation. */
export const SHIP_MIN_Y = 420;
export const SHIP_MAX_Y = H - 70;
export const SHIP_MARGIN = 26;
/** Hit circle against bullets: much smaller than the sprite, so grazes are forgiven. */
export const SHIP_HIT_R = 11;
/** Body circle against enemies and rocks. */
export const SHIP_BODY_R = 20;
/** Drag follows the finger this fast at most (px/s), keys move at KEY_SPEED. */
export const DRAG_SPEED = 2200;
export const KEY_SPEED = 470;
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const RESPAWN_DELAY = 1.2;
export const SHIELD_TIME = 2.6;
/** Weapon levels lost with a life (never below 1). */
export const DEATH_POWER_LOSS = 2;
export const MAX_POWER = 10;

// ---------------------------------------------------------------- weapons

export type Family = "spread" | "laser" | "bolt";
export const FAMILIES: Family[] = ["spread", "laser", "bolt"];

/** Per power level 1–10 (index 0–9). */
export const SPREAD = {
  rate: 0.17,
  speed: 900,
  streams: [1, 2, 3, 3, 4, 5, 5, 6, 7, 7],
  dmg: [1, 1, 1, 1.15, 1.15, 1.15, 1.3, 1.3, 1.4, 1.55],
  /** Degrees between neighbouring streams. */
  gap: [0, 5, 7, 7, 7, 7, 7, 6.5, 6.5, 6.5],
  r: 7,
};

export const LASER = {
  rate: 0.11,
  speed: 1500,
  beams: [1, 1, 1, 2, 2, 2, 3, 3, 3, 3],
  dmg: [0.9, 1.15, 1.4, 0.95, 1.15, 1.35, 1.05, 1.2, 1.4, 1.6],
  /** Enemies one bolt can pass through. */
  pierce: [1, 1, 2, 2, 2, 3, 3, 3, 4, 5],
  /** Horizontal gap between parallel beams. */
  spacing: 16,
  r: 6,
  /** Drawn length of a bolt. */
  len: 46,
};

export const BOLT = {
  rate: 0.22,
  /** How far the first strike reaches from the ship. */
  reach: 560,
  /** Each jump of the chain reaches this far. */
  chainR: 180,
  targets: [1, 2, 2, 3, 3, 4, 4, 5, 5, 6],
  dmg: [2, 2.6, 3.2, 3.8, 4.4, 5, 5.6, 6.2, 6.8, 7.6],
  /** Chain jumps hit for this share of the first strike. */
  chainShare: 0.6,
};

// ---------------------------------------------------------------- enemies

export type EnemyKind =
  | "grunt"
  | "jet"
  | "gunner"
  | "saucer"
  | "kitten"
  | "ufo"
  | "rock"
  | "mini"
  | "boss1"
  | "boss2"
  | "boss3";

export interface EnemyDef {
  hp: number;
  r: number;
  score: number;
  /** Chance a kill drops dried fish; `fishN` of them. */
  fish: number;
  fishN: number;
  /** Chance a kill drops a power orb. */
  orb: number;
  /** Shots per second while in range (before chapter scaling). */
  fire: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: {
    hp: 3,
    r: 25,
    score: 100,
    fish: 0.45,
    fishN: 1,
    orb: 0.03,
    fire: 0.04,
  },
  jet: { hp: 4, r: 25, score: 150, fish: 0.5, fishN: 1, orb: 0.04, fire: 0.06 },
  gunner: {
    hp: 5,
    r: 25,
    score: 200,
    fish: 0.5,
    fishN: 1,
    orb: 0.04,
    fire: 0.16,
  },
  saucer: {
    hp: 12,
    r: 30,
    score: 400,
    fish: 1,
    fishN: 3,
    orb: 0.25,
    fire: 0.08,
  },
  kitten: { hp: 2, r: 19, score: 150, fish: 0.3, fishN: 1, orb: 0.03, fire: 0 },
  ufo: {
    hp: 3,
    r: 25,
    score: 100,
    fish: 0.45,
    fishN: 1,
    orb: 0.03,
    fire: 0.04,
  },
  rock: { hp: 3, r: 30, score: 50, fish: 0.12, fishN: 1, orb: 0.02, fire: 0 },
  mini: { hp: 150, r: 62, score: 3000, fish: 1, fishN: 8, orb: 1, fire: 0 },
  boss1: { hp: 650, r: 105, score: 8000, fish: 1, fishN: 14, orb: 0, fire: 0 },
  boss2: { hp: 800, r: 105, score: 12000, fish: 1, fishN: 16, orb: 0, fire: 0 },
  boss3: { hp: 950, r: 110, score: 16000, fish: 1, fishN: 18, orb: 0, fire: 0 },
};

export const BOSS_NAMES = ["boss1", "boss2", "boss3"] as const;

// ---------------------------------------------------------------- enemy bullets

export type BulletKind = "hairball" | "dart" | "yarn";
export const BULLETS: Record<BulletKind, { r: number; speed: number }> = {
  hairball: { r: 9, speed: 210 },
  dart: { r: 6, speed: 280 },
  yarn: { r: 15, speed: 165 },
};
/** Never more than this many enemy bullets on screen (fairness on a phone). */
export const BULLET_CAP = 46;
/** Ordinary enemies hold fire when this close above the ship, so a shot is always dodgeable. */
export const NO_FIRE_BAND = 170;

// ---------------------------------------------------------------- pickups

export type PickupKind = "fish" | "bone" | "can" | "orb" | "heart";
export const PICKUP_FALL: Record<PickupKind, number> = {
  fish: 150,
  bone: 170,
  can: 115,
  orb: 125,
  heart: 110,
};
export const PICKUP_R = 46;
/** Pickups this close drift into the ship. */
export const MAGNET_R = 110;
export const FISH_SCORE = 50;
export const BONE_SCORE = 20;
export const POWER_BONUS = 500;
/** Dried fish collected per missile. */
export const FISH_PER_MISSILE = 30;
export const START_MISSILES = 1;
export const MAX_MISSILES = 9;

// ---------------------------------------------------------------- missile

/** Seconds from launch to the blast. */
export const MISSILE_FLIGHT = 0.45;
export const MISSILE_DMG = 60;
/** Bosses lose this share of their full HP to a missile. */
export const MISSILE_BOSS_SHARE = 0.12;

// ---------------------------------------------------------------- waves

export type PathKind = "snake" | "loop";

export interface LineGroup {
  kind: EnemyKind;
  count: number;
  path: PathKind;
  side: -1 | 1;
  /** Seconds after the wave starts. */
  delay: number;
}

export type WaveDef =
  /** Formation grid that sways and creeps down; `dive` = dives started per second. */
  | { kind: "grid"; rows: EnemyKind[]; cols: number; dive: number }
  /** Lines of enemies snaking or looping in, round and round until shot. */
  | { kind: "lines"; groups: LineGroup[] }
  /** Kamikaze robo-kittens: wind up at the top, then dash at the ship. */
  | { kind: "kamikaze"; count: number; at: number }
  /** Space-junk rain for `dur` seconds, with a few kittens mixed in. */
  | { kind: "rocks"; dur: number; every: number; kittens: number }
  /** The big saucer mini-boss with looping escorts. */
  | { kind: "mini"; escorts: number }
  /** Fish rain, no enemies. */
  | { kind: "bonus"; dur: number }
  | { kind: "boss"; boss: 1 | 2 | 3 };

const L = (
  kind: EnemyKind,
  count: number,
  path: PathKind,
  side: -1 | 1,
  delay: number,
): LineGroup => ({
  kind,
  count,
  path,
  side,
  delay,
});

/** Three chapters of ten waves. After chapter 3 the run loops with tougher numbers. */
export const CHAPTERS: WaveDef[][] = [
  [
    { kind: "grid", rows: ["ufo", "ufo", "ufo"], cols: 6, dive: 0 },
    {
      kind: "lines",
      groups: [L("grunt", 7, "snake", -1, 0), L("grunt", 7, "snake", 1, 3.5)],
    },
    { kind: "grid", rows: ["jet", "ufo", "ufo"], cols: 6, dive: 0.25 },
    { kind: "kamikaze", count: 10, at: 3 },
    { kind: "rocks", dur: 18, every: 0.55, kittens: 0 },
    {
      kind: "grid",
      rows: ["gunner", "ufo", "ufo", "grunt"],
      cols: 6,
      dive: 0.3,
    },
    {
      kind: "lines",
      groups: [
        L("jet", 6, "loop", -1, 0),
        L("jet", 6, "loop", 1, 2),
        L("grunt", 8, "snake", -1, 6),
      ],
    },
    { kind: "mini", escorts: 4 },
    { kind: "bonus", dur: 9 },
    { kind: "boss", boss: 1 },
  ],
  [
    { kind: "grid", rows: ["gunner", "jet", "ufo", "ufo"], cols: 7, dive: 0.4 },
    {
      kind: "lines",
      groups: [
        L("jet", 6, "loop", -1, 0),
        L("jet", 6, "loop", 1, 1.5),
        L("jet", 6, "loop", -1, 5),
      ],
    },
    { kind: "rocks", dur: 20, every: 0.5, kittens: 6 },
    {
      kind: "grid",
      rows: ["saucer", "gunner", "ufo", "ufo"],
      cols: 6,
      dive: 0.4,
    },
    { kind: "kamikaze", count: 14, at: 4 },
    {
      kind: "lines",
      groups: [
        L("gunner", 8, "snake", -1, 0),
        L("grunt", 8, "snake", 1, 2.5),
        L("jet", 6, "loop", -1, 6),
      ],
    },
    { kind: "grid", rows: ["jet", "jet", "gunner", "ufo"], cols: 7, dive: 0.6 },
    { kind: "mini", escorts: 6 },
    { kind: "bonus", dur: 9 },
    { kind: "boss", boss: 2 },
  ],
  [
    {
      kind: "grid",
      rows: ["saucer", "gunner", "gunner", "ufo", "ufo"],
      cols: 7,
      dive: 0.5,
    },
    { kind: "kamikaze", count: 18, at: 5 },
    {
      kind: "lines",
      groups: [
        L("gunner", 8, "loop", -1, 0),
        L("gunner", 8, "loop", 1, 1.5),
        L("saucer", 4, "snake", -1, 5),
        L("jet", 8, "snake", 1, 7),
      ],
    },
    { kind: "rocks", dur: 22, every: 0.42, kittens: 10 },
    {
      kind: "grid",
      rows: ["saucer", "saucer", "jet", "jet", "ufo"],
      cols: 7,
      dive: 0.7,
    },
    {
      kind: "lines",
      groups: [
        L("jet", 8, "loop", -1, 0),
        L("jet", 8, "loop", 1, 0.8),
        L("gunner", 8, "snake", -1, 5),
      ],
    },
    { kind: "mini", escorts: 8 },
    {
      kind: "grid",
      rows: ["saucer", "gunner", "jet", "jet", "ufo"],
      cols: 7,
      dive: 0.9,
    },
    { kind: "bonus", dur: 9 },
    { kind: "boss", boss: 3 },
  ],
];

export const WAVES_PER_CHAPTER = 10;
export const STAGES_PER_ROUND = CHAPTERS.length * WAVES_PER_CHAPTER;

/** Seconds of wave title before enemies arrive, and the pause after a clear. */
export const WAVE_INTRO = 1.8;
export const WAVE_OUTRO = 1.8;

/** Enemy HP by chapter, then ×(1 + ROUND_HP·(round−1)) for each loop. */
export const CHAPTER_HP = [1, 1.35, 1.7];
export const ROUND_HP = 0.6;
/** Enemy fire rate by chapter, and per loop. */
export const CHAPTER_FIRE = [1, 1.2, 1.4];
export const ROUND_FIRE = 0.35;
/** Enemy bullet and dash speed per loop. */
export const ROUND_SPEED = 0.1;

/** Grid geometry. */
export const GRID = {
  top: 105,
  dx: 68,
  dy: 64,
  sway: 46,
  creep: 5,
  maxCreep: 130,
};
