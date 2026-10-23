import type { Localized } from "../core/i18n";

// Tuning numbers and catalogs, nothing else. Balance is checked by logic.test.ts
// (a scripted baker plays a few weeks and has to stay solvent and progress).

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- the clock
// Minutes since midnight. A business day is the prep night before it plus the
// opening hours; the night's work is a budget of minutes, the shop is real time.

export const OPEN_AT = 9 * 60;
export const CLOSE_AT = 16 * 60 + 30;
/** The baker goes to bed at 22:00 and is back in the kitchen at 5:00. */
export const BED_AT = 22 * 60;
export const WAKE_AT = 5 * 60;
export const EVENING = BED_AT - CLOSE_AT;
export const PREP_BUDGET = EVENING + (OPEN_AT - WAKE_AT);
/** Real seconds the opening hours take. */
export const SELL_SECONDS = 240;
export const DISCOUNT_FROM = 15 * 60 + 30;
export const DISCOUNT = 0.3;
/** Customers come this much more often while the discount is on. */
export const DISCOUNT_RUSH = 1.5;
export const MARKET_TRIP = 30;

// ---------------------------------------------------------------- economy

export const START_COINS = 250;
export const START_REP = 50;
export const MAX_REP = 100;
export const FRESH_DAYS = 3;
export const FRIDGE_DAYS = 5;
export const DISPLAY_CAP = 50;
export const BIG_DISPLAY_CAP = 90;
export const MASTERY_BAKES = 3;
export const FAST_STARS = 2;
export const STAR_PRICE: Record<1 | 2 | 3, number> = { 1: 0.8, 2: 1, 3: 1.25 };
/** Too broke to bake anything: a neighbour's small loan, at most this often. */
export const BAILOUT = 100;
export const BAILOUT_EVERY = 5;
export const BAILOUT_BELOW = 60;

// ---------------------------------------------------------------- ingredients

export type IngredientId =
  | "flour"
  | "sugar"
  | "butter"
  | "eggs"
  | "milk"
  | "bakingPowder"
  | "vanilla"
  | "yeast"
  | "cream"
  | "strawberry"
  | "oil"
  | "chocolate";

/** How the kitchen measures it: on the scale, one by one, or by the teaspoon (5 g/ml). */
export type Measure = "pour" | "count" | "spoon";
export const SPOON = 5;

export interface Ingredient {
  id: IngredientId;
  name: Localized<string>;
  unit: "g" | "ml" | "egg";
  measure: Measure;
  /** Units in one pack at the market, and what the pack costs. */
  pack: number;
  price: number;
  /** Spoils after FRESH_DAYS closings (FRIDGE_DAYS with the fridge). */
  fresh: boolean;
  sprite: string;
}

export const INGREDIENTS: Ingredient[] = [
  {
    id: "flour",
    name: { vi: "Bột mì", en: "Flour" },
    unit: "g",
    measure: "pour",
    pack: 1000,
    price: 12,
    fresh: false,
    sprite: "ing-flour",
  },
  {
    id: "sugar",
    name: { vi: "Đường", en: "Sugar" },
    unit: "g",
    measure: "pour",
    pack: 1000,
    price: 12,
    fresh: false,
    sprite: "ing-sugar",
  },
  {
    id: "butter",
    name: { vi: "Bơ", en: "Butter" },
    unit: "g",
    measure: "pour",
    pack: 250,
    price: 20,
    fresh: false,
    sprite: "ing-butter",
  },
  {
    id: "eggs",
    name: { vi: "Trứng", en: "Eggs" },
    unit: "egg",
    measure: "count",
    pack: 10,
    price: 15,
    fresh: true,
    sprite: "ing-eggs",
  },
  {
    id: "milk",
    name: { vi: "Sữa tươi", en: "Milk" },
    unit: "ml",
    measure: "pour",
    pack: 1000,
    price: 10,
    fresh: true,
    sprite: "ing-milk",
  },
  {
    id: "bakingPowder",
    name: { vi: "Bột nở", en: "Baking powder" },
    unit: "g",
    measure: "spoon",
    pack: 100,
    price: 6,
    fresh: false,
    sprite: "ing-baking-powder",
  },
  {
    id: "vanilla",
    name: { vi: "Vani", en: "Vanilla" },
    unit: "ml",
    measure: "spoon",
    pack: 50,
    price: 15,
    fresh: false,
    sprite: "ing-vanilla",
  },
  {
    id: "yeast",
    name: { vi: "Men nở", en: "Yeast" },
    unit: "g",
    measure: "spoon",
    pack: 50,
    price: 6,
    fresh: false,
    sprite: "ing-yeast",
  },
  {
    id: "cream",
    name: { vi: "Kem tươi", en: "Cream" },
    unit: "ml",
    measure: "pour",
    pack: 500,
    price: 20,
    fresh: true,
    sprite: "ing-cream",
  },
  {
    id: "strawberry",
    name: { vi: "Dâu tây", en: "Strawberries" },
    unit: "g",
    measure: "pour",
    pack: 250,
    price: 18,
    fresh: true,
    sprite: "ing-strawberry",
  },
  {
    id: "oil",
    name: { vi: "Dầu ăn", en: "Oil" },
    unit: "ml",
    measure: "pour",
    pack: 1000,
    price: 15,
    fresh: false,
    sprite: "ing-oil",
  },
  {
    id: "chocolate",
    name: { vi: "Sô-cô-la", en: "Chocolate" },
    unit: "g",
    measure: "pour",
    pack: 200,
    price: 16,
    fresh: false,
    sprite: "ing-chocolate",
  },
];

// ---------------------------------------------------------------- recipes

export type RecipeId =
  | "cookie"
  | "cupcake"
  | "flan"
  | "donut"
  | "choux"
  | "shortcake";

export type MixMode = "cream" | "whisk" | "fold" | "knead" | "stir";
export type StoveMode = "caramel" | "fry" | "cook";
export type WaitMode = "proof" | "cool";
export type PipeMode = "frost" | "glaze" | "fill" | "cream";

/** One line of a recipe card, in order. */
export type Step =
  | { kind: "add"; ing: IngredientId; amount: number }
  /** Stir round the bowl `turns` times. */
  | { kind: "mix"; mode: MixMode; turns: number }
  /** Take it off the heat after `seconds` of real time. */
  | { kind: "stove"; mode: StoveMode; seconds: number }
  | { kind: "wait"; mode: WaitMode; minutes: number }
  | { kind: "oven"; temp: number; minutes: number }
  /** Decoration: squeeze to the right amount; it can cost a star, never the batch. */
  | { kind: "pipe"; mode: PipeMode };

export interface Recipe {
  id: RecipeId;
  name: Localized<string>;
  /** Coins to buy it in the recipe book; 0 = known from the start. */
  cost: number;
  /** Pieces one batch makes, and the 2★ price of one piece. */
  yield: number;
  base: number;
  /** Hands-on minutes; oven, stove and waiting time are added from the steps. */
  hands: number;
  /** Pieces a customer asks for in one line of an order. */
  qty: [number, number];
  steps: Step[];
  sprite: string;
}

const add = (ing: IngredientId, amount: number): Step => ({
  kind: "add",
  ing,
  amount,
});

export const RECIPES: Recipe[] = [
  {
    id: "cookie",
    name: { vi: "Bánh quy bơ", en: "Butter cookies" },
    cost: 0,
    yield: 12,
    base: 3,
    hands: 25,
    qty: [2, 4],
    sprite: "cake-cookie",
    steps: [
      add("butter", 100),
      add("sugar", 80),
      { kind: "mix", mode: "cream", turns: 4 },
      add("eggs", 1),
      add("flour", 200),
      { kind: "mix", mode: "fold", turns: 3 },
      { kind: "oven", temp: 180, minutes: 12 },
    ],
  },
  {
    id: "cupcake",
    name: { vi: "Cupcake vani", en: "Vanilla cupcakes" },
    cost: 0,
    yield: 6,
    base: 8,
    hands: 30,
    qty: [1, 2],
    sprite: "cake-cupcake",
    steps: [
      add("butter", 100),
      add("sugar", 100),
      { kind: "mix", mode: "cream", turns: 4 },
      add("eggs", 2),
      add("flour", 120),
      add("bakingPowder", 5),
      add("milk", 60),
      add("vanilla", 5),
      { kind: "mix", mode: "fold", turns: 3 },
      { kind: "oven", temp: 180, minutes: 18 },
      { kind: "pipe", mode: "frost" },
    ],
  },
  {
    id: "flan",
    name: { vi: "Bánh flan", en: "Caramel flan" },
    cost: 500,
    yield: 8,
    base: 7,
    hands: 25,
    qty: [1, 3],
    sprite: "cake-flan",
    steps: [
      add("sugar", 100),
      { kind: "stove", mode: "caramel", seconds: 5 },
      add("eggs", 4),
      add("sugar", 60),
      add("milk", 500),
      add("vanilla", 5),
      { kind: "mix", mode: "stir", turns: 2 },
      { kind: "oven", temp: 150, minutes: 40 },
    ],
  },
  {
    id: "donut",
    name: { vi: "Donut dâu", en: "Strawberry donuts" },
    cost: 800,
    yield: 10,
    base: 9,
    hands: 35,
    qty: [1, 3],
    sprite: "cake-donut",
    steps: [
      add("flour", 250),
      add("yeast", 5),
      add("sugar", 40),
      add("milk", 120),
      add("eggs", 1),
      { kind: "mix", mode: "knead", turns: 5 },
      { kind: "wait", mode: "proof", minutes: 40 },
      add("oil", 500),
      { kind: "stove", mode: "fry", seconds: 4 },
      add("strawberry", 50),
      { kind: "pipe", mode: "glaze" },
    ],
  },
  {
    id: "choux",
    name: { vi: "Bánh su kem", en: "Cream puffs" },
    cost: 1200,
    yield: 10,
    base: 9,
    hands: 40,
    qty: [2, 4],
    sprite: "cake-choux",
    steps: [
      add("butter", 80),
      add("milk", 120),
      { kind: "stove", mode: "cook", seconds: 4 },
      add("flour", 100),
      { kind: "mix", mode: "stir", turns: 3 },
      add("eggs", 3),
      { kind: "mix", mode: "fold", turns: 3 },
      { kind: "oven", temp: 200, minutes: 25 },
      add("cream", 250),
      { kind: "mix", mode: "whisk", turns: 4 },
      { kind: "pipe", mode: "fill" },
    ],
  },
  {
    id: "shortcake",
    name: { vi: "Bông lan dâu", en: "Strawberry shortcake" },
    cost: 2000,
    yield: 8,
    base: 16,
    hands: 45,
    qty: [1, 2],
    sprite: "cake-shortcake",
    steps: [
      add("eggs", 4),
      add("sugar", 120),
      { kind: "mix", mode: "whisk", turns: 5 },
      add("flour", 120),
      { kind: "mix", mode: "fold", turns: 3 },
      add("milk", 40),
      add("butter", 30),
      { kind: "oven", temp: 170, minutes: 30 },
      { kind: "wait", mode: "cool", minutes: 20 },
      add("cream", 400),
      { kind: "mix", mode: "whisk", turns: 4 },
      add("strawberry", 250),
      { kind: "pipe", mode: "cream" },
    ],
  },
];

/** Minutes of heat a stove step costs (the real seconds are only the skill part). */
export const STOVE_MINUTES = 15;

// ---------------------------------------------------------------- grading
// |actual − target| / target, in the order perfect → good → minor; past the last
// bound the batch fails.

export const MEASURE_BANDS = [0.05, 0.12, 0.25] as const;
/** Mixing, stove and oven timing: actual / target must sit in these ranges. */
export const TIMING_BANDS = [
  [0.9, 1.1],
  [0.8, 1.25],
  [0.6, 1.5],
] as const;
/** Oven dial error in °C. */
export const TEMP_BANDS = [0, 10, 25] as const;
/** Goods cost a star every this many; each minor costs one. */
export const GOODS_PER_STAR = 3;

// ---------------------------------------------------------------- upgrades

export type UpgradeId = "mixer" | "oven2" | "display" | "fridge";

export interface Upgrade {
  id: UpgradeId;
  name: Localized<string>;
  cost: number;
  sprite: string;
}

export const UPGRADES: Upgrade[] = [
  {
    id: "mixer",
    name: { vi: "Máy đánh trứng", en: "Stand mixer" },
    cost: 600,
    sprite: "tool-mixer",
  },
  {
    id: "fridge",
    name: { vi: "Tủ lạnh", en: "Fridge" },
    cost: 700,
    sprite: "tool-fridge",
  },
  {
    id: "display",
    name: { vi: "Tủ kính lớn", en: "Big display case" },
    cost: 900,
    sprite: "cake-box",
  },
  {
    id: "oven2",
    name: { vi: "Lò thứ hai", en: "Second oven" },
    cost: 1500,
    sprite: "tool-oven",
  },
];
/** With the mixer, whisking and creaming take this many fewer hands-on minutes. */
export const MIXER_SAVES = 10;

// ---------------------------------------------------------------- customers

export type CustomerId =
  | "cat"
  | "bear"
  | "bunny"
  | "corgi"
  | "panda"
  | "pig"
  | "penguin"
  | "frog"
  | "sheep"
  | "owl";

export interface Customer {
  id: CustomerId;
  name: Localized<string>;
  favourite: RecipeId;
  sprite: string;
}

export const CUSTOMERS: Customer[] = [
  {
    id: "cat",
    name: { vi: "Mèo Mướp", en: "Tabby" },
    favourite: "cookie",
    sprite: "customer-cat",
  },
  {
    id: "bear",
    name: { vi: "Gấu Beret", en: "Beret Bear" },
    favourite: "shortcake",
    sprite: "customer-bear",
  },
  {
    id: "bunny",
    name: { vi: "Thỏ Áo Mưa", en: "Raincoat Bunny" },
    favourite: "cupcake",
    sprite: "customer-bunny",
  },
  {
    id: "corgi",
    name: { vi: "Corgi", en: "Corgi" },
    favourite: "donut",
    sprite: "customer-corgi",
  },
  {
    id: "panda",
    name: { vi: "Gấu Trúc", en: "Panda" },
    favourite: "choux",
    sprite: "customer-panda",
  },
  {
    id: "pig",
    name: { vi: "Heo Hồng", en: "Pinky Pig" },
    favourite: "flan",
    sprite: "customer-pig",
  },
  {
    id: "penguin",
    name: { vi: "Cánh Cụt", en: "Penguin" },
    favourite: "cupcake",
    sprite: "customer-penguin",
  },
  {
    id: "frog",
    name: { vi: "Ếch Vàng", en: "Froggy" },
    favourite: "flan",
    sprite: "customer-frog",
  },
  {
    id: "sheep",
    name: { vi: "Cừu Bông", en: "Fluffy Sheep" },
    favourite: "choux",
    sprite: "customer-sheep",
  },
  {
    id: "owl",
    name: { vi: "Cú Phê Bình", en: "Critic Owl" },
    favourite: "shortcake",
    sprite: "customer-owl-critic",
  },
];
/** Everyday customers; the owl only comes as the food critic. */
export const REGULARS: CustomerId[] = [
  "cat",
  "bear",
  "bunny",
  "corgi",
  "panda",
  "pig",
  "penguin",
  "frog",
  "sheep",
];

// ---------------------------------------------------------------- demand

/** Customers a day: (BASE + rep·PER_REP + recipes·PER_RECIPE) × weekday × weather. */
export const DEMAND_BASE = 10;
export const DEMAND_PER_REP = 0.12;
export const DEMAND_PER_RECIPE = 1.5;
/** Monday first; the weekend is busy. */
export const WEEKDAY_DEMAND = [1, 1, 1, 1, 1.1, 1.3, 1.3];

export type Weather = "sunny" | "cloudy" | "rainy";
export const WEATHER: { id: Weather; chance: number; demand: number }[] = [
  { id: "sunny", chance: 0.4, demand: 1.1 },
  { id: "cloudy", chance: 0.35, demand: 1 },
  { id: "rainy", chance: 0.25, demand: 0.75 },
];

/** Arrivals per opening hour (9:00 … 16:00), relative: a late-morning and a tea-time rush. */
export const HOURLY = [0.6, 1.4, 1.2, 0.8, 0.7, 1.3, 1.2, 0.6];
export const FAVOURITE_WEIGHT = 3;
export const TREND_WEIGHT = 2;
/** Chance an order has a second line. */
export const SECOND_LINE = 0.25;
/** When what they wanted is gone, the chance they pick something else on display. */
export const SUBSTITUTE = 0.7;
/** Customers waiting in line at most; more than that and newcomers walk away. */
export const QUEUE_MAX = 4;
/** Real seconds a customer waits in line before leaving. */
export const PATIENCE = 24;
export const VIP_PATIENCE = 18;
export const PREORDER_PATIENCE = 32;

// ---------------------------------------------------------------- paying

/** Chance a customer pays the exact amount; the rest hand over a note. */
export const EXACT_PAY = 0.4;
export const NOTES = [10, 20, 50, 100, 200];
/** Coins in the till for giving change. */
export const CHANGE_COINS = [1, 2, 5, 10, 20, 50];
/** Orders of this many pieces or more go in a box. */
export const BOX_FROM = 4;
export const BOX_SIZES = [4, 6, 9, 12];
export const BOX_COST = 1;
/** Tip for picking the snuggest box. */
export const BOX_TIP = 2;
/** Tip per 3★ piece in an order, up to MAX_STAR_TIP. */
export const STAR_TIP = 1;
export const MAX_STAR_TIP = 3;

// ---------------------------------------------------------------- reputation

export const REP = {
  served: 0.3,
  walkedOff: -2,
  soldOut: -1,
  queueFull: -1,
  shortChange: -2,
  vipHappy: 6,
  vipSad: -6,
  preorderDone: 3,
  preorderMissed: -6,
} as const;

// ---------------------------------------------------------------- specials

/** From this day on, a closing can bring tomorrow's pre-order. */
export const PREORDER_FROM = 3;
export const PREORDER_CHANCE = 0.45;
export const PREORDER_PREMIUM = 1.2;
export const PREORDER_MIN_STARS = 2;
/** The food critic: from this day, never two days running. */
export const VIP_FROM = 4;
export const VIP_CHANCE = 0.2;
export const VIP_TIP = 20;
