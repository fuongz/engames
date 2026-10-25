import { clamp, nextRandom } from "@web-games/core/math";
import {
  BAILOUT,
  BAILOUT_BELOW,
  BAILOUT_EVERY,
  BIG_DISPLAY_CAP,
  BOX_COST,
  BOX_SIZES,
  BOX_TIP,
  CLOSE_AT,
  CUSTOMERS,
  type CustomerId,
  DEMAND_BASE,
  DEMAND_PER_RECIPE,
  DEMAND_PER_REP,
  DISCOUNT,
  DISCOUNT_FROM,
  DISCOUNT_RUSH,
  DISPLAY_CAP,
  EXACT_PAY,
  FAST_STARS,
  FAVOURITE_WEIGHT,
  FRESH_DAYS,
  FRIDGE_DAYS,
  GOODS_PER_STAR,
  HOURLY,
  INGREDIENTS,
  type Ingredient,
  type IngredientId,
  BEDTIME,
  COFFEE_ENERGY,
  COFFEE_SLEEP_COST,
  ENERGY_PER_MINUTE,
  FULL_SLEEP,
  LATEST_BED,
  MARKET_TRIP,
  MOOD_CHANGE,
  MOOD_REP,
  NAP_ENERGY,
  NAP_MINUTES,
  OPEN,
  SELL_ENERGY,
  SLEEP_ENERGY,
  START_ENERGY,
  START_MOOD,
  TIRED_BELOW,
  WAKE,
  AUTO_OPEN,
  MASTERY_BAKES,
  MAX_REP,
  MAX_STAR_TIP,
  MEASURE_BANDS,
  MIXER_SAVES,
  NOTES,
  OPEN_AT,
  PREORDER_CHANCE,
  PREORDER_FROM,
  PREORDER_MIN_STARS,
  PREORDER_PREMIUM,
  RECIPES,
  REGULARS,
  REP,
  type Recipe,
  type RecipeId,
  SECOND_LINE,
  SPOON,
  STAR_PRICE,
  STAR_TIP,
  START_COINS,
  START_REP,
  STOVE_MINUTES,
  SUBSTITUTE,
  type Step,
  TEMP_BANDS,
  TIMING_BANDS,
  TREND_WEIGHT,
  UPGRADES,
  type Upgrade,
  type UpgradeId,
  VIP_CHANCE,
  VIP_PER_TIER,
  VIP_FROM,
  VIP_TIP,
  WEATHER,
  WEEKDAY_DEMAND,
  type Weather,
  RECORDS,
  RECORD_MOOD,
  type RecordId,
} from "./config";
import {
  type Decor,
  charm,
  charmBoost,
  charmTier,
  furnitureWorth,
  startDecor,
} from "./furniture";

// The bakery's rules, pure: the save, the market, grading each baking step, the
// day's customers and the till. game.ts turns taps into calls here; the server
// imports save.ts (built on these types) to sanity-check every save.

export type Stars = 1 | 2 | 3;

/** Part of a pantry shelf: `days` closings before it spoils, -1 if it keeps. */
export interface Lot {
  qty: number;
  days: number;
}

/** Pieces on the display, grouped by cake and quality. */
export interface StockItem {
  recipe: RecipeId;
  stars: Stars;
  count: number;
  /** Ingredient cost of one piece, to price the waste. */
  cost: number;
}

/** Ordered at yesterday's closing, collected today at `at`. */
export interface Preorder {
  id: number;
  customer: CustomerId;
  recipe: RecipeId;
  qty: number;
  at: number;
}

/** A batch left running in the background: in an oven, proofing or cooling. */
export interface Job {
  id: number;
  recipe: RecipeId;
  cost: number;
  /** The timed step it is on, and the grades so far. */
  step: number;
  results: StepResult[];
  kind: "oven" | "wait";
  /** Night minute it started, and the oven dial (0 for waits). */
  start: number;
  temp: number;
}

export interface SaveData {
  v: 5;
  /** The business day being prepared (the night before) or sold. */
  day: number;
  /** "open": saved at opening, so a reload replays the day from 9:00. */
  phase: "prep" | "open";
  coins: number;
  rep: number;
  /** Minutes after 16:30 on tonight's clock; sleeping jumps it to WAKE. */
  night: number;
  /** 0–100: work drains it, sleep restores it; low energy means shaky hands. */
  energy: number;
  /** 0–100: good days lift it; it colours customers, sleep and reputation. */
  mood: number;
  /** Coffees drunk tonight (they cost sleep). */
  caffeine: number;
  /** Batches in the oven, proofing or cooling while the baker does something else. */
  jobs: Job[];
  recipes: RecipeId[];
  /** Records for the music box, and the one on it (null: the box is quiet). */
  records: RecordId[];
  playing: RecordId | null;
  /** Successful hand-made batches per recipe. */
  mastery: Partial<Record<RecipeId, number>>;
  upgrades: UpgradeId[];
  pantry: Partial<Record<IngredientId, Lot[]>>;
  stock: StockItem[];
  preorders: Preorder[];
  seed: number;
  /** Ingredient cost of tonight's batches, for the day report. */
  dayCost: number;
  vipDay: number;
  bailoutDay: number;
  stats: { served: number; bestProfit: number };
  /** The storefront: furniture owned and where it stands. */
  decor: Decor;
}

// ---------------------------------------------------------------- lookups

const byId = <T extends { id: string }>(list: T[], id: string): T => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`Unknown id ${id}`);
  return found;
};
export const ingredient = (id: IngredientId): Ingredient =>
  byId(INGREDIENTS, id);
export const recipe = (id: RecipeId): Recipe => byId(RECIPES, id);
export const upgrade = (id: UpgradeId): Upgrade => byId(UPGRADES, id);
export const customer = (id: CustomerId) => byId(CUSTOMERS, id);

export const has = (save: SaveData, id: UpgradeId) =>
  save.upgrades.includes(id);

// ---------------------------------------------------------------- randomness

/** A stream per (day, purpose), so one roll never shifts another. */
function rng(save: { seed: number }, day: number, purpose: number) {
  const state = {
    seed:
      (save.seed ^
        Math.imul(day, 0x9e3779b1) ^
        Math.imul(purpose, 0x85ebca6b)) |
      0,
  };
  nextRandom(state);
  return () => nextRandom(state);
}

function pickWeighted<T>(items: T[], weight: (t: T) => number, r: number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let x = r * total;
  for (const t of items) {
    x -= weight(t);
    if (x < 0) return t;
  }
  return items[items.length - 1];
}

const between = (r: number, lo: number, hi: number) =>
  lo + Math.floor(r * (hi - lo + 1));

// ---------------------------------------------------------------- a new bakery

export function newGame(seed: number): SaveData {
  return {
    v: 5,
    day: 1,
    phase: "prep",
    coins: START_COINS,
    rep: START_REP,
    night: 0,
    energy: START_ENERGY,
    mood: START_MOOD,
    caffeine: 0,
    jobs: [],
    recipes: RECIPES.filter((r) => r.cost === 0).map((r) => r.id),
    records: ["sheep"],
    playing: "sheep",
    mastery: {},
    upgrades: [],
    pantry: {},
    stock: [],
    preorders: [],
    seed: seed | 0,
    dayCost: 0,
    vipDay: -9,
    bailoutDay: -99,
    stats: { served: 0, bestProfit: 0 },
    decor: startDecor(),
  };
}

/** Coins plus what the recipes, equipment and furniture cost: the leaderboard number. */
export function assets(save: SaveData) {
  const recipes = save.recipes.reduce((s, id) => s + recipe(id).cost, 0);
  const kit = save.upgrades.reduce((s, id) => s + upgrade(id).cost, 0);
  return save.coins + recipes + kit + furnitureWorth(save.decor);
}

// ---------------------------------------------------------------- the clock

/** Wall clock (minutes since midnight) at a point of the night. */
export const clockAt = (night: number) => (CLOSE_AT + night) % (24 * 60);

export function formatClock(minutes: number) {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export const slept = (save: SaveData) => save.night >= WAKE;
/** Past 22:00 and still up. */
export const pastBedtime = (save: SaveData) =>
  !slept(save) && save.night >= BEDTIME;
/** Minutes until the next wall: 1:00 (bed, at the latest) before sleeping, 9:00 after. */
export const timeLeft = (save: SaveData) =>
  slept(save) ? OPEN - save.night : LATEST_BED - save.night;

/** 0 (rested) → 1 (exhausted): how much the hands shake. */
export const shake = (energy: number) =>
  clamp((TIRED_BELOW - energy) / TIRED_BELOW, 0, 1);

/** Where the clock stops by itself: 1:00 (bed) before sleeping, 9:30 (the shop opens) after. */
export const clockCap = (save: SaveData) =>
  slept(save) ? OPEN + AUTO_OPEN : LATEST_BED;
/** The shop may open from 9:00. */
export const canOpen = (save: SaveData) => save.night >= OPEN;
/** 9:30 and still closed: it opens by itself. */
export const mustOpen = (save: SaveData) => save.night >= OPEN + AUTO_OPEN;

/** Let `minutes` of the night pass while awake: energy drains with them. */
export function advance(save: SaveData, minutes: number): SaveData {
  const step = Math.max(0, Math.min(minutes, clockCap(save) - save.night));
  if (step <= 0) return save;
  return {
    ...save,
    night: save.night + step,
    energy: clamp(save.energy - step * ENERGY_PER_MINUTE, 0, 100),
  };
}

/** Minutes a background batch has been going. */
export const elapsed = (save: SaveData, job: { start: number }) =>
  Math.max(0, save.night - job.start);

/** Ovens in the kitchen, and how many hold a batch right now. */
export const ovens = (save: SaveData) => (has(save, "oven2") ? 2 : 1);
export const ovensBusy = (save: SaveData) =>
  save.jobs.filter((j) => j.kind === "oven").length;

/** Can the baker spend `minutes` working right now? */
function workable(save: SaveData, minutes: number): Refusal | null {
  if (save.energy <= 0) return "tired";
  if (timeLeft(save) < minutes) return "time";
  return null;
}

const spend = (save: SaveData, minutes: number): SaveData => ({
  ...save,
  night: save.night + minutes,
  energy: clamp(save.energy - minutes * ENERGY_PER_MINUTE, 0, 100),
});

const withMood = (save: SaveData, delta: number): SaveData => ({
  ...save,
  mood: clamp(save.mood + delta, 0, 100),
});

/** To bed until 5:30: sleep gives back energy (less when gloomy or after coffee) and sets the mood. */
export function goToBed(save: SaveData): { save: SaveData; hours: number } {
  if (slept(save)) return { save, hours: 0 };
  const hours = (WAKE - save.night) / 60;
  const restored = Math.max(
    0,
    hours * SLEEP_ENERGY * (0.6 + (0.4 * save.mood) / 100) -
      save.caffeine * COFFEE_SLEEP_COST,
  );
  const moodDelta =
    hours >= FULL_SLEEP
      ? MOOD_CHANGE.fullSleep
      : (FULL_SLEEP - hours) * MOOD_CHANGE.perShortHour;
  return {
    save: withMood(
      {
        ...save,
        night: WAKE,
        caffeine: 0,
        energy: clamp(save.energy + restored, 0, 100),
      },
      moodDelta,
    ),
    hours,
  };
}

/** Thirty minutes' rest: a little energy back (allowed even when exhausted). */
export function nap(save: SaveData): Outcome {
  if (timeLeft(save) < NAP_MINUTES) return { ok: false, why: "time" };
  return {
    ok: true,
    save: {
      ...save,
      night: save.night + NAP_MINUTES,
      energy: clamp(save.energy + NAP_ENERGY, 0, 100),
    },
  };
}

/** A coffee from the pantry: energy now, worse sleep tonight. */
export function drinkCoffee(save: SaveData): Outcome {
  const lots = save.pantry.coffee ?? [];
  if (!lots.some((l) => l.qty >= 1)) return { ok: false, why: "ingredients" };
  const i = lots.findIndex((l) => l.qty >= 1);
  const coffee = lots
    .map((l, k) => (k === i ? { ...l, qty: l.qty - 1 } : l))
    .filter((l) => l.qty > 0);
  return {
    ok: true,
    save: {
      ...save,
      pantry: { ...save.pantry, coffee },
      energy: clamp(save.energy + COFFEE_ENERGY, 0, 100),
      caffeine: save.caffeine + 1,
    },
  };
}

/** Customers' patience scales with the baker's mood (0.8× … 1.2×). */
export const patienceFactor = (mood: number) => 0.8 + (0.4 * mood) / 100;
/** A cheerful baker gets a coin more in tips; a glum one a coin less. */
export const moodTip = (mood: number) => (mood >= 70 ? 1 : mood < 30 ? -1 : 0);

// ---------------------------------------------------------------- pantry

export function pantryQty(save: SaveData, id: IngredientId) {
  return (save.pantry[id] ?? []).reduce((s, l) => s + l.qty, 0);
}

export const freshDays = (save: SaveData) =>
  has(save, "fridge") ? FRIDGE_DAYS : FRESH_DAYS;

const unitCost = (id: IngredientId) =>
  ingredient(id).price / ingredient(id).pack;

export type Cart = Partial<Record<IngredientId, number>>;

/** What the basket costs: packs of ingredients, plus any records in it. */
export const cartCost = (cart: Cart, records: RecordId[] = []) =>
  Object.entries(cart).reduce(
    (s, [id, packs]) => s + ingredient(id as IngredientId).price * (packs ?? 0),
    0,
  ) +
  records.reduce(
    (s, id) => s + (RECORDS.find((r) => r.id === id)?.price ?? 0),
    0,
  );

export type Refusal =
  | "tired"
  | "coins"
  | "time"
  | "empty"
  | "ingredients"
  | "display"
  | "owned"
  | "locked"
  | "layout";
export type Outcome =
  | { ok: true; save: SaveData }
  | { ok: false; why: Refusal };

/** One trip to the market: pay for the cart and spend MARKET_TRIP minutes. */
/**
 * Pay for the basket at the supermarket's till: ingredients go to the pantry,
 * records to the music box (the last one goes straight on).
 */
export function buyIngredients(
  save: SaveData,
  cart: Cart,
  records: RecordId[] = [],
): Outcome {
  const fresh = records.filter((id) => !save.records.includes(id));
  const cost = cartCost(cart, fresh);
  if (cost <= 0) return { ok: false, why: "empty" };
  if (cost > save.coins) return { ok: false, why: "coins" };
  const why = workable(save, MARKET_TRIP);
  if (why) return { ok: false, why };
  const pantry = { ...save.pantry };
  for (const [id, packs] of Object.entries(cart) as [IngredientId, number][]) {
    if (!packs) continue;
    const ing = ingredient(id);
    pantry[id] = [
      ...(pantry[id] ?? []),
      { qty: ing.pack * packs, days: ing.fresh ? freshDays(save) : -1 },
    ];
  }
  return {
    ok: true,
    save: {
      ...spend(save, MARKET_TRIP),
      coins: save.coins - cost,
      pantry,
      records: [...save.records, ...fresh],
      playing: fresh.length ? fresh[fresh.length - 1] : save.playing,
    },
  };
}

export function buyRecipe(save: SaveData, id: RecipeId): Outcome {
  if (save.recipes.includes(id)) return { ok: false, why: "owned" };
  const { cost } = recipe(id);
  if (cost > save.coins) return { ok: false, why: "coins" };
  return {
    ok: true,
    save: { ...save, coins: save.coins - cost, recipes: [...save.recipes, id] },
  };
}

export function buyUpgrade(save: SaveData, id: UpgradeId): Outcome {
  if (has(save, id)) return { ok: false, why: "owned" };
  const { cost } = upgrade(id);
  if (cost > save.coins) return { ok: false, why: "coins" };
  let pantry = save.pantry;
  // A new fridge keeps what is already on the shelf longer too
  if (id === "fridge") {
    pantry = Object.fromEntries(
      Object.entries(save.pantry).map(([k, lots]) => [
        k,
        (lots ?? []).map((l) =>
          l.days > 0 ? { ...l, days: l.days + FRIDGE_DAYS - FRESH_DAYS } : l,
        ),
      ]),
    );
  }
  return {
    ok: true,
    save: {
      ...save,
      coins: save.coins - cost,
      upgrades: [...save.upgrades, id],
      pantry,
    },
  };
}

// ---------------------------------------------------------------- baking

/** Everything a batch uses, summed per ingredient. */
export function needs(r: Recipe): Partial<Record<IngredientId, number>> {
  const out: Partial<Record<IngredientId, number>> = {};
  for (const s of r.steps)
    if (s.kind === "add") out[s.ing] = (out[s.ing] ?? 0) + s.amount;
  return out;
}

export function missing(save: SaveData, r: Recipe) {
  return (Object.entries(needs(r)) as [IngredientId, number][])
    .map(([ing, need]) => ({ ing, need, have: pantryQty(save, ing) }))
    .filter((x) => x.have < x.need);
}

const usesMixer = (r: Recipe) =>
  r.steps.some(
    (s) => s.kind === "mix" && (s.mode === "whisk" || s.mode === "cream"),
  );

/** Minutes of the night one batch takes, with the kitchen's upgrades. */
export function batchMinutes(save: SaveData, r: Recipe) {
  let m = r.hands - (has(save, "mixer") && usesMixer(r) ? MIXER_SAVES : 0);
  for (const s of r.steps) {
    if (s.kind === "oven") m += s.minutes;
    else if (s.kind === "wait") m += s.minutes;
    else if (s.kind === "stove") m += STOVE_MINUTES;
  }
  return Math.round(m);
}

export const stockCount = (stock: StockItem[]) =>
  stock.reduce((s, x) => s + x.count, 0);
export const displayCap = (save: SaveData) =>
  has(save, "display") ? BIG_DISPLAY_CAP : DISPLAY_CAP;
export const mastered = (save: SaveData, id: RecipeId) =>
  (save.mastery[id] ?? 0) >= MASTERY_BAKES;

export function canBake(save: SaveData, id: RecipeId): Refusal | null {
  const r = recipe(id);
  if (!save.recipes.includes(id)) return "owned";
  if (missing(save, r).length) return "ingredients";
  if (save.energy <= 0) return "tired";
  if (stockCount(save.stock) + r.yield > displayCap(save)) return "display";
  return null;
}

/** Take a batch's ingredients (oldest first) and its time; the bake itself comes after. */
export function startBatch(
  save: SaveData,
  id: RecipeId,
): (Outcome & { ok: false }) | { ok: true; save: SaveData; cost: number } {
  const why = canBake(save, id);
  if (why) return { ok: false, why };
  const r = recipe(id);
  const pantry = { ...save.pantry };
  let cost = 0;
  for (const [ing, need] of Object.entries(needs(r)) as [
    IngredientId,
    number,
  ][]) {
    // Fresh lots spoil first; dry goods (-1) last
    const lots = [...(pantry[ing] ?? [])].sort((a, b) =>
      a.days < 0 ? 1 : b.days < 0 ? -1 : a.days - b.days,
    );
    let left = need;
    const kept: Lot[] = [];
    for (const lot of lots) {
      const take = Math.min(lot.qty, left);
      left -= take;
      if (lot.qty - take > 0) kept.push({ ...lot, qty: lot.qty - take });
    }
    pantry[ing] = kept;
    cost += need * unitCost(ing);
  }
  return {
    ok: true,
    save: { ...save, pantry, dayCost: save.dayCost + cost },
    cost,
  };
}

export type FailKind = "burnt" | "raw" | "flat";
export type BakeResult = { stars: Stars } | { fail: FailKind };

/** Put a finished batch on the display; a good hand-made one counts towards mastery. */
export function finishBatch(
  save: SaveData,
  id: RecipeId,
  result: BakeResult,
  cost: number,
  byHand: boolean,
): SaveData {
  if ("fail" in result) return withMood(save, MOOD_CHANGE.failedBatch);
  const r = recipe(id);
  const piece = cost / r.yield;
  const stock = [...save.stock];
  const i = stock.findIndex((s) => s.recipe === id && s.stars === result.stars);
  if (i >= 0) {
    const s = stock[i];
    // Average the piece cost so the waste stays priced right
    stock[i] = {
      ...s,
      count: s.count + r.yield,
      cost: (s.cost * s.count + piece * r.yield) / (s.count + r.yield),
    };
  } else
    stock.push({
      recipe: id,
      stars: result.stars,
      count: r.yield,
      cost: piece,
    });
  const mastery = byHand
    ? { ...save.mastery, [id]: (save.mastery[id] ?? 0) + 1 }
    : save.mastery;
  return withMood(
    { ...save, stock, mastery },
    result.stars === 3 ? MOOD_CHANGE.threeStars : 0,
  );
}

/** "Làm nhanh": a mastered recipe without the steps, always FAST_STARS. */
export function fastBake(save: SaveData, id: RecipeId): Outcome {
  if (!mastered(save, id)) return { ok: false, why: "owned" };
  const started = startBatch(save, id);
  if (!started.ok) return started;
  return {
    ok: true,
    save: finishBatch(
      started.save,
      id,
      { stars: FAST_STARS },
      started.cost,
      false,
    ),
  };
}

// ---------------------------------------------------------------- grading the steps

export type Grade = "perfect" | "good" | "minor" | "major";
export type Note =
  | "exact"
  | "tooMuch"
  | "tooLittle"
  | "wrongIngredient"
  | "outOfOrder"
  | "undermixed"
  | "overmixed"
  | "underdone"
  | "overdone"
  | "tooHot"
  | "tooCold"
  | "sloppy";

export interface StepResult {
  grade: Grade;
  note: Note;
  fail?: FailKind;
  ing?: IngredientId;
}

const ORDER: Grade[] = ["perfect", "good", "minor", "major"];
export const worse = (a: StepResult, b: StepResult) =>
  ORDER.indexOf(b.grade) > ORDER.indexOf(a.grade) ? b : a;

/** Picking an ingredient off the shelf: wrong but in the recipe costs a star, not in it at all ruins the batch. */
export function gradePick(
  r: Recipe,
  stepIndex: number,
  picked: IngredientId,
): StepResult | null {
  const step = r.steps[stepIndex];
  if (step?.kind === "add" && step.ing === picked) return null;
  const inRecipe = r.steps.some((s) => s.kind === "add" && s.ing === picked);
  return inRecipe
    ? { grade: "minor", note: "outOfOrder", ing: picked }
    : { grade: "major", note: "wrongIngredient", fail: "flat", ing: picked };
}

/** Units the kitchen counts in: eggs one by one, spoons by SPOON, the rest by g/ml. */
export const measureUnits = (ing: IngredientId, amount: number) =>
  ingredient(ing).measure === "spoon" ? amount / SPOON : amount;

export function gradeAmount(
  ing: IngredientId,
  target: number,
  actual: number,
): StepResult {
  const note: Note =
    actual > target ? "tooMuch" : actual < target ? "tooLittle" : "exact";
  if (ingredient(ing).measure !== "pour") {
    const want = measureUnits(ing, target);
    const off = Math.abs(measureUnits(ing, actual) - want);
    if (off === 0) return { grade: "perfect", note, ing };
    if (off === 1 && want >= 3) return { grade: "minor", note, ing };
    return { grade: "major", note, fail: "flat", ing };
  }
  const k = Math.abs(actual - target) / target;
  const i = MEASURE_BANDS.findIndex((b) => k <= b);
  if (i < 0) return { grade: "major", note, fail: "flat", ing };
  return { grade: (["perfect", "good", "minor"] as const)[i], note, ing };
}

function gradeRatio(
  k: number,
  under: [Note, FailKind],
  over: [Note, FailKind],
): StepResult {
  const i = TIMING_BANDS.findIndex(([lo, hi]) => k >= lo && k <= hi);
  const [note, fail] = k < 1 ? under : over;
  if (i < 0) return { grade: "major", note, fail };
  return {
    grade: (["perfect", "good", "minor"] as const)[i],
    note: i === 0 ? "exact" : note,
  };
}

/** Mixing to `turns` rounds of the bowl. */
export const gradeMix = (turns: number, done: number) =>
  gradeRatio(done / turns, ["undermixed", "flat"], ["overmixed", "flat"]);

/** Off the heat after `seconds`. */
export const gradeStove = (seconds: number, done: number) =>
  gradeRatio(done / seconds, ["underdone", "raw"], ["overdone", "burnt"]);

/** The oven dial and the minutes in it; the worse of the two counts. */
export function gradeOven(
  step: Extract<Step, { kind: "oven" }>,
  temp: number,
  minutes: number,
): StepResult {
  const off = Math.abs(temp - step.temp);
  const i = TEMP_BANDS.findIndex((b) => off <= b);
  const note: Note = temp > step.temp ? "tooHot" : "tooCold";
  const heat: StepResult =
    i < 0
      ? { grade: "major", note, fail: temp > step.temp ? "burnt" : "raw" }
      : {
          grade: (["perfect", "good", "minor"] as const)[i],
          note: i === 0 ? "exact" : note,
        };
  return worse(
    heat,
    gradeRatio(
      minutes / step.minutes,
      ["underdone", "raw"],
      ["overdone", "burnt"],
    ),
  );
}

/** Decoration: the squeezed amount against the ideal (1); a mess costs a star at most. */
export function gradePipe(amount: number): StepResult {
  const g = gradeRatio(amount, ["sloppy", "flat"], ["sloppy", "flat"]);
  return g.grade === "major"
    ? { grade: "minor", note: "sloppy" }
    : g.grade === "perfect"
      ? g
      : { ...g, note: "sloppy" };
}

/** The batch: any major error ruins it; otherwise each minor (and every few goods) costs a star. */
export function bakeResult(results: StepResult[]): BakeResult {
  const major = results.find((r) => r.grade === "major");
  if (major) return { fail: major.fail ?? "flat" };
  const minors = results.filter((r) => r.grade === "minor").length;
  const goods = results.filter((r) => r.grade === "good").length;
  return {
    stars: clamp(
      3 - minors - Math.floor(goods / GOODS_PER_STAR),
      1,
      3,
    ) as Stars,
  };
}

// ---------------------------------------------------------------- tomorrow

export interface DayInfo {
  /** 0 = Monday. */
  weekday: number;
  weather: Weather;
  /** Customers expected (before the discount rush). */
  customers: number;
  trend: RecipeId | null;
  vip: boolean;
  /** The storefront's charm, and the customers it brings on top of the rest. */
  charm: number;
  charmCustomers: number;
}

export function dayInfo(save: SaveData): DayInfo {
  const r = rng(save, save.day, 1);
  const weekday = (save.day - 1) % 7;
  const w = pickWeighted(WEATHER, (x) => x.chance, r());
  const trendRoll = r();
  const trend =
    save.recipes.length >= 2 && trendRoll < 0.6
      ? save.recipes[Math.floor((trendRoll / 0.6) * save.recipes.length)]
      : null;
  const c = charm(save.decor);
  const vip =
    save.day >= VIP_FROM &&
    save.vipDay !== save.day - 1 &&
    r() < VIP_CHANCE + charmTier(c) * VIP_PER_TIER;
  const base =
    DEMAND_BASE +
    save.rep * DEMAND_PER_REP +
    save.recipes.length * DEMAND_PER_RECIPE;
  const plain = base * WEEKDAY_DEMAND[weekday] * w.demand;
  const customers = Math.round(plain * charmBoost(c));
  return {
    weekday,
    weather: w.id,
    customers,
    trend,
    vip,
    charm: c,
    charmCustomers: customers - Math.round(plain),
  };
}

export interface Line {
  recipe: RecipeId;
  qty: number;
}

export interface Visitor {
  id: number;
  customer: CustomerId;
  /** Minute of the day they walk in. */
  at: number;
  lines: Line[];
  kind: "regular" | "vip" | "preorder";
  preorder?: number;
  /** Only comes if the closing-time discount is on. */
  rush?: boolean;
  /** Pre-rolled: [substitute?, pays exact?, which note]. */
  rolls: [number, number, number];
}

function orderFor(
  save: SaveData,
  info: DayInfo,
  who: CustomerId,
  r: () => number,
  one = false,
): Line[] {
  const fav = customer(who).favourite;
  const weight = (id: RecipeId) =>
    (id === fav ? FAVOURITE_WEIGHT : 1) *
    (id === info.trend ? TREND_WEIGHT : 1);
  const first = pickWeighted(save.recipes, weight, r());
  const qty = (id: RecipeId) => (one ? 1 : between(r(), ...recipe(id).qty));
  const lines = [{ recipe: first, qty: qty(first) }];
  const rest = save.recipes.filter((id) => id !== first);
  if (rest.length && r() < SECOND_LINE) {
    const second = pickWeighted(rest, weight, r());
    lines.push({ recipe: second, qty: qty(second) });
  }
  return lines;
}

/** A minute inside opening hours, busier at the rushes. */
function arrival(r: () => number) {
  const hour = HOURLY.indexOf(pickWeighted(HOURLY, (w) => w, r()));
  const span = Math.min(60, CLOSE_AT - (OPEN_AT + hour * 60));
  return OPEN_AT + hour * 60 + r() * span;
}

/** Everyone who will come today, in order; the same list every time this day is played. */
export function planDay(save: SaveData): Visitor[] {
  const info = dayInfo(save);
  const r = rng(save, save.day, 2);
  const rolls = (): Visitor["rolls"] => [r(), r(), r()];
  const out: Omit<Visitor, "id">[] = [];
  const regular = () => REGULARS[Math.floor(r() * REGULARS.length)];
  for (let i = 0; i < info.customers; i++) {
    const who = regular();
    out.push({
      customer: who,
      at: arrival(r),
      lines: orderFor(save, info, who, r),
      kind: "regular",
      rolls: rolls(),
    });
  }
  // The discount draws extra customers in the last hour, if it is switched on
  const late = Math.round(
    info.customers *
      (HOURLY[HOURLY.length - 1] / HOURLY.reduce((a, b) => a + b, 0)) *
      (DISCOUNT_RUSH - 1) *
      2,
  );
  for (let i = 0; i < late; i++) {
    const who = regular();
    const at = DISCOUNT_FROM + r() * (CLOSE_AT - DISCOUNT_FROM);
    out.push({
      customer: who,
      at,
      lines: orderFor(save, info, who, r),
      kind: "regular",
      rush: true,
      rolls: rolls(),
    });
  }
  if (info.vip) {
    const at = 10 * 60 + r() * 5 * 60;
    out.push({
      customer: "owl",
      at,
      lines: orderFor(save, info, "owl", r, true),
      kind: "vip",
      rolls: rolls(),
    });
  }
  for (const p of save.preorders) {
    out.push({
      customer: p.customer,
      at: p.at,
      lines: [{ recipe: p.recipe, qty: p.qty }],
      kind: "preorder",
      preorder: p.id,
      rolls: rolls(),
    });
  }
  return out.sort((a, b) => a.at - b.at).map((v, id) => ({ ...v, id }));
}

// ---------------------------------------------------------------- the shop

/** One piece of cake on its way to a customer. */
export interface Piece {
  recipe: RecipeId;
  stars: Stars;
  cost: number;
}

/** Set aside at opening: the pieces each pre-order will collect, if there were enough. */
export function reserve(stock: StockItem[], preorders: Preorder[]) {
  const left = stock.map((s) => ({ ...s }));
  const held = new Map<number, Piece[]>();
  for (const p of preorders) {
    const fits = left
      .filter((s) => s.recipe === p.recipe && s.stars >= PREORDER_MIN_STARS)
      .sort((a, b) => a.stars - b.stars);
    if (fits.reduce((n, s) => n + s.count, 0) < p.qty) continue;
    const pieces: Piece[] = [];
    for (const s of fits) {
      while (s.count > 0 && pieces.length < p.qty) {
        s.count--;
        pieces.push({ recipe: s.recipe, stars: s.stars, cost: s.cost });
      }
    }
    held.set(p.id, pieces);
  }
  return { stock: left.filter((s) => s.count > 0), held };
}

/**
 * What a walk-in ends up ordering from what is on display: short lines shrink,
 * missing ones are swapped for something else (or dropped). `lost` is demand the
 * shop could not meet, for the report.
 */
export function arrive(
  stock: StockItem[],
  v: Visitor,
): { lines: Line[]; lost: Line[] } {
  const avail = new Map<RecipeId, number>();
  for (const s of stock)
    avail.set(s.recipe, (avail.get(s.recipe) ?? 0) + s.count);
  const lines: Line[] = [];
  const lost: Line[] = [];
  for (const l of v.lines) {
    const have = avail.get(l.recipe) ?? 0;
    if (have >= l.qty) {
      lines.push(l);
      avail.set(l.recipe, have - l.qty);
      continue;
    }
    lost.push({ recipe: l.recipe, qty: l.qty - have });
    if (have > 0) {
      lines.push({ recipe: l.recipe, qty: have });
      avail.set(l.recipe, 0);
      continue;
    }
    if (v.rolls[0] >= SUBSTITUTE) continue;
    const alt = [...avail.entries()]
      .filter(([id, n]) => n > 0 && !lines.some((x) => x.recipe === id))
      .sort((a, b) => b[1] - a[1])[0];
    if (!alt) continue;
    const qty = Math.min(l.qty, alt[1]);
    lines.push({ recipe: alt[0], qty });
    avail.set(alt[0], alt[1] - qty);
  }
  return { lines, lost };
}

export function piecePrice(p: Piece, discount: boolean, preorder: boolean) {
  return (
    recipe(p.recipe).base *
    STAR_PRICE[p.stars] *
    (discount ? 1 - DISCOUNT : 1) *
    (preorder ? PREORDER_PREMIUM : 1)
  );
}

export const orderTotal = (
  pieces: Piece[],
  discount: boolean,
  preorder: boolean,
) =>
  Math.max(
    1,
    Math.round(
      pieces.reduce((s, p) => s + piecePrice(p, discount, preorder), 0),
    ),
  );

/** What the customer hands over: the exact amount, or the smallest note that covers it. */
export function payment(total: number, v: Visitor) {
  if (v.rolls[1] < EXACT_PAY) return total;
  const notes = NOTES.filter((n) => n >= total);
  if (!notes.length) return Math.ceil(total / 50) * 50;
  // Mostly the smallest note; now and then a bigger one
  return notes[v.rolls[2] < 0.75 || notes.length === 1 ? 0 : 1];
}

export type BoxFit = "snug" | "loose" | "small";
export function boxFit(pieces: number, size: number): BoxFit {
  if (size < pieces) return "small";
  return size === BOX_SIZES.find((s) => s >= pieces) ? "snug" : "loose";
}

export interface Settlement {
  /** Coins into the till: what they paid minus the change given. */
  coins: number;
  tip: number;
  boxCost: number;
  /** Change given beyond what was due (lost), or short of it. */
  over: number;
  short: number;
  rep: number;
  mood: "happy" | "ok" | "angry";
  vip?: "happy" | "sad";
}

export function settle(
  v: Visitor,
  pieces: Piece[],
  paid: number,
  total: number,
  change: number,
  box: number | null,
  bakerMood = 50,
): Settlement {
  const due = paid - total;
  const over = Math.max(0, change - due);
  const short = Math.max(0, due - change);
  const boxCost = box ? BOX_COST : 0;
  let tip = 0;
  let rep: number = short ? REP.shortChange : REP.served;
  let vip: Settlement["vip"];
  if (!short) {
    if (box && boxFit(pieces.length, box) === "snug") tip += BOX_TIP;
    tip += Math.min(
      MAX_STAR_TIP,
      pieces.filter((p) => p.stars === 3).length * STAR_TIP,
    );
  }
  if (v.kind === "vip") {
    vip = pieces.every((p) => p.stars === 3) && !short ? "happy" : "sad";
    rep = vip === "happy" ? REP.vipHappy : REP.vipSad;
    if (vip === "happy") tip += VIP_TIP;
  }
  if (v.kind === "preorder" && !short) rep += REP.preorderDone - REP.served;
  if (!short) tip = Math.max(0, tip + moodTip(bakerMood));
  const mood =
    short || vip === "sad" ? "angry" : tip > 0 || over > 0 ? "happy" : "ok";
  return { coins: paid - change, tip, boxCost, over, short, rep, mood, vip };
}

// ---------------------------------------------------------------- closing

export interface Ledger {
  /** Cash kept: what customers paid minus the change given. */
  revenue: number;
  tips: number;
  boxes: number;
  /** Change given beyond what was due (already out of `revenue`). */
  overChange: number;
  served: number;
  walked: number;
  /** Pieces customers wanted but the display had run out of. */
  soldOut: Partial<Record<RecipeId, number>>;
  rep: number;
  vip: "none" | "happy" | "sad" | "missed";
  preorders: { done: number; missed: number };
}

export const emptyLedger = (): Ledger => ({
  revenue: 0,
  tips: 0,
  boxes: 0,
  overChange: 0,
  served: 0,
  walked: 0,
  soldOut: {},
  rep: 0,
  vip: "none",
  preorders: { done: 0, missed: 0 },
});

export interface DayReport {
  day: number;
  revenue: number;
  tips: number;
  boxes: number;
  overChange: number;
  ingredients: number;
  wasted: { pieces: number; cost: number };
  spoiled: number;
  profit: number;
  served: number;
  walked: number;
  soldOut: Partial<Record<RecipeId, number>>;
  rep: { before: number; after: number };
  vip: Ledger["vip"];
  preorders: Ledger["preorders"];
  bailout: number;
  tomorrow: Preorder[];
  /** The day's weather, for the closing scene. */
  weather: Weather;
  /** The storefront's charm, and how many customers it drew. */
  charm: number;
  charmCustomers: number;
}

/** Can't bake anything and can't afford a fresh start: the neighbour helps out. */
export function needsBailout(save: SaveData) {
  if (save.coins >= BAILOUT_BELOW || save.day - save.bailoutDay < BAILOUT_EVERY)
    return false;
  return save.recipes.every((id) => missing(save, recipe(id)).length > 0);
}

/** 16:30: count the till, bin what is left, spoil old produce and set up tomorrow. */
export function closeDay(
  save: SaveData,
  ledger: Ledger,
  leftover: StockItem[],
): { report: DayReport; next: SaveData } {
  const wasted = {
    pieces: stockCount(leftover),
    cost: leftover.reduce((s, x) => s + x.cost * x.count, 0),
  };
  const profit = ledger.revenue + ledger.tips - ledger.boxes - save.dayCost;
  let spoiled = 0;
  const pantry: SaveData["pantry"] = {};
  for (const [id, lots] of Object.entries(save.pantry) as [
    IngredientId,
    Lot[],
  ][]) {
    const kept: Lot[] = [];
    for (const lot of lots) {
      if (lot.days < 0) kept.push(lot);
      else if (lot.days > 1) kept.push({ ...lot, days: lot.days - 1 });
      else spoiled += lot.qty * unitCost(id);
    }
    if (kept.length) pantry[id] = kept;
  }
  const rep = clamp(
    Math.round(save.rep + ledger.rep + (save.mood - 50) / MOOD_REP),
    0,
    MAX_REP,
  );
  const moodDelta =
    (profit >= 0 ? MOOD_CHANGE.profit : MOOD_CHANGE.loss) +
    Math.max(MOOD_CHANGE.maxWalkOff, ledger.walked * MOOD_CHANGE.perWalkOff);
  const info = dayInfo(save);
  let next: SaveData = {
    ...save,
    day: save.day + 1,
    phase: "prep",
    coins: save.coins + ledger.revenue + ledger.tips - ledger.boxes,
    rep,
    night: 0,
    caffeine: 0,
    jobs: [],
    energy: clamp(save.energy - SELL_ENERGY, 0, 100),
    mood: clamp(
      save.mood + moodDelta + (save.playing ? RECORD_MOOD : 0),
      0,
      100,
    ),
    pantry,
    stock: [],
    dayCost: 0,
    vipDay: info.vip ? save.day : save.vipDay,
    stats: {
      served: save.stats.served + ledger.served,
      bestProfit: Math.max(save.stats.bestProfit, Math.round(profit)),
    },
  };
  next = { ...next, preorders: preordersFor(next) };
  let bailout = 0;
  if (needsBailout(next)) {
    bailout = BAILOUT;
    next = { ...next, coins: next.coins + BAILOUT, bailoutDay: next.day };
  }
  return {
    report: {
      day: save.day,
      revenue: ledger.revenue,
      tips: ledger.tips,
      boxes: ledger.boxes,
      overChange: ledger.overChange,
      ingredients: save.dayCost,
      wasted,
      spoiled,
      profit,
      served: ledger.served,
      walked: ledger.walked,
      soldOut: ledger.soldOut,
      rep: { before: save.rep, after: rep },
      vip: ledger.vip,
      preorders: ledger.preorders,
      bailout,
      tomorrow: next.preorders,
      weather: info.weather,
      charm: info.charm,
      charmCustomers: info.charmCustomers,
    },
    next,
  };
}

/** Tomorrow's pre-order, rolled at closing so the night can plan for it. */
function preordersFor(save: SaveData): Preorder[] {
  if (save.day < PREORDER_FROM) return [];
  const r = rng(save, save.day, 3);
  if (r() >= PREORDER_CHANCE) return [];
  // Pre-orders lean towards the special cakes
  const id = pickWeighted(save.recipes, (x) => recipe(x).base, r());
  const rec = recipe(id);
  const qty = Math.min(
    rec.yield,
    between(r(), rec.qty[1] + 1, rec.qty[1] * 2 + 1),
  );
  return [
    {
      id: save.day * 10,
      customer: REGULARS[Math.floor(r() * REGULARS.length)],
      recipe: id,
      qty,
      at: 11 * 60 + Math.floor(r() * 8) * 30,
    },
  ];
}

// ---------------------------------------------------------------- records

/** Buy a record at the market. */
export function buyRecord(
  save: SaveData,
  id: RecordId,
): { ok: true; save: SaveData } | { ok: false; why: "owned" | "coins" } {
  const r = RECORDS.find((x) => x.id === id);
  if (!r || save.records.includes(id)) return { ok: false, why: "owned" };
  if (save.coins < r.price) return { ok: false, why: "coins" };
  return {
    ok: true,
    save: {
      ...save,
      coins: save.coins - r.price,
      records: [...save.records, id],
      // A new record goes straight on
      playing: id,
    },
  };
}

/** Put an owned record on the box, or take it off (null). */
export function playRecord(save: SaveData, id: RecordId | null): SaveData {
  if (id !== null && !save.records.includes(id)) return save;
  return { ...save, playing: id };
}
