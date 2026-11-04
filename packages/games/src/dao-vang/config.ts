// Tuning numbers and tables for Đào Vàng. Genre conventions are noted in
// RE_NOTES.md; every number here is our own, checked by logic.test.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- the claw

/** The rope hangs from the winch drum here. */
export const PIVOT = { x: 270, y: 164 };
/** Rope length at rest (the claw just under the drum). */
export const REST_LEN = 70;
/** Widest swing either side of straight down, in radians (≈70°). */
export const SWING_MAX = (70 * Math.PI) / 180;
/** Swing phase speed, rad/s: one full left-right-left in ≈2.7 s. */
export const SWING_SPEED = (2 * Math.PI) / 2.7;
/** How fast the claw shoots out, px/s. */
export const EXTEND_SPEED = 520;
/** Reeling in with nothing on the hook, px/s. */
export const EMPTY_PULL = 720;
/** Reeling in with a load: PULL / weight, px/s (capped at EMPTY_PULL). */
export const PULL = 660;
/** Strength (potion or sack) multiplies the reel speed by this. */
export const STRENGTH_BOOST = 1.6;
/** Radius of the claw's grabbing tip. */
export const CLAW_R = 14;
/** The claw gives up and comes back when its tip passes these. */
export const BOUNDS = { left: 6, right: W - 6, bottom: H - 10 };

// ---------------------------------------------------------------- the level

export const LEVEL_TIME = 60;
/** The earth starts here; objects are placed between these depths. */
export const GROUND_Y = 178;
export const BOARD_TOP = 280;
export const BOARD_BOTTOM = 920;
export const BOARD_MARGIN = 22;

/** Money the level itself must add to the bank: rises 120 a level. */
export const goalStep = (level: number) => 550 + 120 * (level - 1);
/** The bank must hold this much when the clock runs out (money carries over). */
export function goalFor(level: number) {
  let g = 0;
  for (let l = 1; l <= level; l++) g += goalStep(l);
  return g;
}
/** The valuables on a board add up to at least this many times the level's step. */
export const BOARD_RATIO = 2.1;

// ---------------------------------------------------------------- objects

export type ItemKind =
  | "goldS"
  | "goldM"
  | "goldL"
  | "rockS"
  | "rockL"
  | "diamond"
  | "sack"
  | "mole"
  | "moleDiamond";

export interface ItemSpec {
  r: number;
  value: number;
  /** Reel speed is PULL / weight: big gold and big rocks crawl. */
  weight: number;
}

export const ITEMS: Record<ItemKind, ItemSpec> = {
  // Small gold is r=21 rather than tiny so it reads on a phone
  goldS: { r: 21, value: 50, weight: 1.5 },
  goldM: { r: 31, value: 150, weight: 2.6 },
  goldL: { r: 52, value: 500, weight: 6 },
  rockS: { r: 24, value: 15, weight: 2.8 },
  rockL: { r: 44, value: 35, weight: 6.5 },
  diamond: { r: 18, value: 600, weight: 1.3 },
  sack: { r: 25, value: 0, weight: 1.6 },
  mole: { r: 22, value: 2, weight: 1.3 },
  moleDiamond: { r: 24, value: 602, weight: 1.6 },
};

/** Where on the board (0 = top, 1 = bottom) each valuable likes to sit. */
export const DEPTH: Record<ItemKind, number> = {
  goldS: 0.22,
  goldM: 0.45,
  goldL: 0.72,
  rockS: 0.35,
  rockL: 0.55,
  diamond: 0.82,
  sack: 0.5,
  mole: 0.6,
  moleDiamond: 0.8,
};

/** Valuables drawn for a level, by weight: cheap gold fades out, diamonds come in. */
export function valuableWeights(level: number): [ItemKind, number][] {
  return [
    ["goldS", Math.max(0.6, 5 - level * 0.6)],
    ["goldM", 3.2],
    ["goldL", 1.4 + level * 0.12],
    ["diamond", level < 2 ? 0 : Math.min(2.6, 0.2 + level * 0.25)],
  ];
}
export const rocksFor = (level: number) => Math.min(11, 3 + level);
export const molesFor = (level: number) =>
  level < 2 ? 0 : Math.min(4, Math.ceil((level - 1) / 2));
/** From this level a mole may carry a diamond. */
export const MOLE_DIAMOND_FROM = 3;
export const sacksFor = (level: number) => (level % 3 === 0 ? 2 : 1);
export const MOLE_SPEED = [45, 85];

// ---------------------------------------------------------------- sacks

export type SackOutcome =
  | { kind: "money"; amount: number }
  | { kind: "dynamite" }
  | { kind: "strength" };

/** Chance of each outcome and the money range, plain and with the lucky clover. */
export const SACK = {
  plain: { money: 0.6, dynamite: 0.2, min: 20, max: 300 },
  lucky: { money: 0.7, dynamite: 0.15, min: 200, max: 800 },
};

// ---------------------------------------------------------------- the shop

export type ShopKind = "dynamite" | "strength" | "clover" | "polish" | "book";
export const SHOP_KINDS: ShopKind[] = [
  "dynamite",
  "strength",
  "clover",
  "polish",
  "book",
];
/** Base price and how much it climbs per level; each offer varies ±40%. */
export const PRICES: Record<ShopKind, { base: number; perLevel: number }> = {
  dynamite: { base: 60, perLevel: 12 },
  strength: { base: 120, perLevel: 25 },
  clover: { base: 70, perLevel: 15 },
  polish: { base: 150, perLevel: 30 },
  book: { base: 30, perLevel: 8 },
};
export const PRICE_SPREAD = 0.4;
export const OFFERS = [3, 4];

export const POLISH_BOOST = 1.5;
export const BOOK_BOOST = 3;
export const START_DYNAMITE = 0;
export const MAX_DYNAMITE = 9;
