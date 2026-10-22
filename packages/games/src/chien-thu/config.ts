// Layout and balance numbers. Layout values were measured from the reference
// ad recording (see RE_NOTES.md); balance values are our own tuning.

export const W = 540;
export const H = 900;

export const CENTER = { x: 270, y: 500 };
/** Radius enemies walk along (middle of the sand ring). */
export const TRACK_R = 222;
export const TRACK_INNER = 190;
export const TRACK_OUTER = 254;
/** Grass field inside the ring that holds the critter slots. */
export const FIELD_R = 188;

export const SLOT_R = 27;
/** Slot rows top to bottom, a hex-ish disc of 19 slots like the ad. */
export const SLOT_ROWS = [3, 4, 5, 4, 3];
export const SLOT_DX = 66;
export const SLOT_DY = 62;

// Path angles (screen space, y down). Enemies leave the gate just below the kid
// on the left, go down, round the bottom, up the right side, across the top
// and finish at the kid.
export const PATH_START = Math.PI - 0.22;
export const PATH_END = -Math.PI + 0.12;
export const PATH_LENGTH = TRACK_R * (PATH_START - PATH_END);

export const MAX_LEVEL = 8;
export const START_EGGS = 3;
export const START_BASE_HP = 10;
export const FIRST_WAVE_DELAY = 2.5;
export const WAVE_BREAK = 3;

export const BLADE_SPIN = 5; // rad/s
export const HIT_COOLDOWN = 0.22; // s, per critter/enemy pair

export const bladeCount = (level: number) => [1, 2, 2, 3, 3, 4, 4, 5][level - 1];
export const bladeDamage = (level: number) => Math.round(1.75 ** (level - 1));
/** Distance from critter centre to the middle of each blade. */
export const bladeOrbit = (level: number) => 48 + 6 * level;
export const bladeHalf = (level: number) => 24 + 3 * level;
export const critterSize = (level: number) => 22 + 2.2 * level;

export const summonCost = (summons: number) => 1 + Math.floor(summons / 3);

export type EnemyKind = "walker" | "miner" | "runner" | "shield" | "brute" | "egg";

export interface EnemySpec {
  hpMul: number;
  speed: number; // px/s along the path
  radius: number;
  damage: number; // base HP lost when it reaches the kid
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  walker: { hpMul: 1, speed: 54, radius: 15, damage: 1 },
  miner: { hpMul: 1.6, speed: 45, radius: 15, damage: 1 },
  runner: { hpMul: 0.6, speed: 84, radius: 14, damage: 1 },
  shield: { hpMul: 3, speed: 38, radius: 17, damage: 2 },
  brute: { hpMul: 9, speed: 34, radius: 21, damage: 4 },
  egg: { hpMul: 3, speed: 42, radius: 14, damage: 0 },
};

export const waveBaseHp = (wave: number) => 2 * 1.3 ** (wave - 1);
export const spawnInterval = (wave: number) => Math.max(0.45, 1.15 - 0.05 * wave);
export const EGG_DROP_CHANCE = 0.15;
export const WILD_EGG_REWARD = 2;

export interface Species {
  name: string;
  fromLevel: number;
  body: string;
  bodyDark: string;
  belly: string;
  accent: string;
  blade: "leek" | "jade" | "gold";
}

/** A critter evolves into a new species at these levels (the ad's "Đang tiến hóa"). */
export const SPECIES: Species[] = [
  { name: "Mầm Miêu", fromLevel: 1, body: "#8fe05a", bodyDark: "#4f9a2c", belly: "#effbd8", accent: "#ff5d8f", blade: "leek" },
  { name: "Thanh Long Miêu", fromLevel: 3, body: "#7fd85b", bodyDark: "#3f8f2e", belly: "#f6ffe6", accent: "#ff3d7f", blade: "jade" },
  { name: "Ếch Thanh Long", fromLevel: 5, body: "#5ccb6b", bodyDark: "#2f8a43", belly: "#fff6f0", accent: "#ff4f86", blade: "jade" },
  { name: "Long Vương", fromLevel: 7, body: "#46c3a8", bodyDark: "#1f7d6a", belly: "#fff3c8", accent: "#ffb000", blade: "gold" },
];

export const speciesFor = (level: number) =>
  SPECIES.reduce((found, s) => (level >= s.fromLevel ? s : found), SPECIES[0]);

export const LEVEL_COLORS = ["#62e04a", "#5fd8f0", "#9b8cff", "#ff8fd8", "#ffd23f", "#ffb02e", "#ff7a3d", "#ff4d6d"];
