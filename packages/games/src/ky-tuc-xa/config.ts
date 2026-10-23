// Numbers marked "ad" were read off the reference recording (RE_NOTES.md); the
// rest is our own tuning, checked by the balance test in logic.test.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- map
// A dorm wider than the screen: two corridors, eight rooms along each (four on
// either side), and a hall across the middle where everyone starts and where
// the hunter heals. Each room is a 4×3 grid of build tiles with the bed in the
// corner nearest its corridor and a door into that corridor.

export const TILE = 48;
export const COLS = 4;
export const ROWS = 3;
export const ROOM_W = 220;
export const ROOM_H = 192;
export const CORRIDOR_W = 80;
/** Left edge of each room column: corridor A's left/right rooms, then corridor B's. */
export const ROOM_X = [40, 340, 560, 860];
/** Centre line of corridors A and B. */
export const CORRIDOR_X = [300, 820];
/** Top edge of each room row; the hall sits between rows 1 and 2. */
export const ROW_Y = [40, 232, 584, 776];
export const HALL = { x: 40, y: 424, w: 1040, h: 160 };
export const HALL_Y = HALL.y + HALL.h / 2;
export const HALL_X = HALL.x + HALL.w / 2;
export const ROOM_COUNT = 16;
export const WORLD_W = 1120;
export const WORLD_H = 1008;

// ---------------------------------------------------------------- setup phase

export const COUNTDOWN = 30; // ad: red 30 → 0
export const BOT_NAMES = [
  "novice",
  "apprentice",
  "expert1",
  "expert2",
  "master",
] as const; // ad: Tân Thủ, Tập Sự, Chuyên Gia I/II, Bậc Thầy
export const PLAYER_SPEED = 200;
export const PLAYER_RADIUS = 9;
/** How close to a free bed the "Sleep" button appears. */
export const BED_REACH = 40;
export const BOT_SPEED = [118, 126, 134, 140, 146];

// ---------------------------------------------------------------- economy

/** Gold per second while asleep, by bed level. ad: +1 a second at level 1. */
export const BED_INCOME = [1, 2, 4, 7, 12, 20];
/** Gold to go from level i+1 to i+2. */
export const BED_COST = [16, 45, 110, 260, 600];

export const DOOR_HP = [200, 420, 880, 1800, 3600, 7000];
export const DOOR_COST = [12, 40, 110, 280, 650];

export const REPAIR_FRACTION = 0.35;
export const REPAIR_COOLDOWN = 14;

export type BuildKind =
  | "turret"
  | "arcade"
  | "station"
  | "watchtower"
  | "accelerator";

export interface BuildSpec {
  currency: "gold" | "energy";
  cost: number;
  /** How many one room may hold. ad: "Có thể xây 1/4", "0/1". */
  limit: number;
  tab: "basic" | "workshop";
}

export const BUILDS: Record<BuildKind, BuildSpec> = {
  turret: { currency: "gold", cost: 8, limit: 99, tab: "basic" }, // ad: Tháp Chói, 8
  arcade: { currency: "gold", cost: 120, limit: 2, tab: "basic" }, // ad: Máy Chơi Game, 200
  station: { currency: "energy", cost: 40, limit: 4, tab: "basic" }, // ad: Đài Sửa Chữa, 64, 1/4
  watchtower: { currency: "energy", cost: 120, limit: 1, tab: "workshop" }, // ad: Tháp Canh, 256
  accelerator: { currency: "energy", cost: 260, limit: 1, tab: "workshop" }, // ad: Máy Gia Tốc Hạt, 2048
};

/** ad: "Tạo ra: 1 Tia Chớp/2s". */
export const ARCADE_ENERGY_EVERY = 2;
/** Door HP restored per second by each repair station, as a fraction of max. */
export const STATION_REGEN = 0.012;

// ---------------------------------------------------------------- turrets

export const TURRET_DAMAGE = [4, 8, 15, 28, 52, 95, 170]; // ad: Tấn Công 4 at level 1
export const TURRET_UPGRADE = [14, 30, 70, 150, 320, 650];
export const TURRET_RANGE = 4; // ad: Phạm Vi Tấn Công 4
/** Pixels per range point: short enough that a turret covers its own door, not the whole corridor. */
export const RANGE_UNIT = 34;
export const TURRET_INTERVAL = 0.9;
export const WATCHTOWER_RANGE = 1.5; // extra range points
export const ACCELERATOR_SPEED = 1.5;

// ---------------------------------------------------------------- hunter

export const HUNTER_HP = 1500;
export const HUNTER_HIT = 16;
export const HUNTER_HIT_EVERY = 1;
export const HUNTER_SPEED = 90;
/** Every LEVEL_EVERY seconds the hunter grows: HP and hits scale up. */
export const LEVEL_EVERY = 40;
export const LEVEL_HP = 1.38;
export const LEVEL_HIT = 1.38;
export const RETREAT_AT = 0.22;
export const HEAL_RATE = 0.09; // of max HP per second
/** Each trip to heal restores less: 100%, 85%, 70% of max HP. */
export const HEAL_DECAY = 0.15;
/** After this many retreats the hunter is enraged: it stops retreating and fights to the end. */
export const MAX_RETREATS = 3;

/** Bots and the player use the same rules; bots buy every BOT_THINK seconds. */
export const BOT_THINK = 1.6;
