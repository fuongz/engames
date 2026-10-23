import type { SaveRules } from "../saves";
import {
  CUSTOMERS,
  INGREDIENTS,
  MAX_REP,
  PREP_BUDGET,
  RECIPES,
  START_COINS,
  UPGRADES,
} from "./config";
import { type SaveData, assets } from "./logic";

// What the server accepts as a save. The client keeps the bakery (it is a
// single-player game), so this only refuses what no real play can produce:
// broken shapes, days running backwards, money out of thin air.

const RECIPE_IDS = new Set<string>(RECIPES.map((r) => r.id));
const UPGRADE_IDS = new Set<string>(UPGRADES.map((u) => u.id));
const INGREDIENT_IDS = new Set<string>(INGREDIENTS.map((i) => i.id));
const CUSTOMER_IDS = new Set<string>(CUSTOMERS.map((c) => c.id));

/** Far above a perfect day (≈70 customers × 8 pieces × the dearest 3★ price). */
const MAX_DAY_INCOME = 15_000;
/** Days a save may jump at once (played offline for a while). */
const MAX_DAY_JUMP = 7;

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, lo: number, hi: number): x is number =>
  Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const isNum = (x: unknown, lo: number, hi: number): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
const ids = (x: unknown, known: Set<string>) =>
  Array.isArray(x) &&
  x.every((i) => typeof i === "string" && known.has(i)) &&
  new Set(x).size === x.length;

/** The save, if it has the right shape; null otherwise. */
export function parseSave(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  const s = raw;
  if (!isInt(s.day, 1, 100_000) || (s.phase !== "prep" && s.phase !== "open"))
    return null;
  if (
    !isInt(s.coins, -1_000_000, 1_000_000_000) ||
    !isNum(s.rep, 0, MAX_REP) ||
    !isNum(s.prepUsed, 0, PREP_BUDGET)
  )
    return null;
  if (!ids(s.recipes, RECIPE_IDS) || !ids(s.upgrades, UPGRADE_IDS)) return null;
  if (
    !isObj(s.mastery) ||
    !Object.entries(s.mastery).every(
      ([k, v]) => RECIPE_IDS.has(k) && isInt(v, 0, 1_000_000),
    )
  )
    return null;
  if (
    !isObj(s.pantry) ||
    !Object.entries(s.pantry).every(
      ([k, lots]) =>
        INGREDIENT_IDS.has(k) &&
        Array.isArray(lots) &&
        lots.every(
          (l) => isObj(l) && isNum(l.qty, 0, 1e7) && isInt(l.days, -1, 30),
        ),
    )
  )
    return null;
  if (
    !Array.isArray(s.stock) ||
    !s.stock.every(
      (x) =>
        isObj(x) &&
        RECIPE_IDS.has(x.recipe as string) &&
        isInt(x.stars, 1, 3) &&
        isInt(x.count, 0, 1000) &&
        isNum(x.cost, 0, 1000),
    )
  )
    return null;
  if (
    !Array.isArray(s.preorders) ||
    !s.preorders.every(
      (p) =>
        isObj(p) &&
        isInt(p.id, 0, 1e9) &&
        CUSTOMER_IDS.has(p.customer as string) &&
        RECIPE_IDS.has(p.recipe as string) &&
        isInt(p.qty, 1, 100) &&
        isInt(p.at, 0, 1440),
    )
  )
    return null;
  if (
    !isInt(s.seed, -(2 ** 31), 2 ** 31) ||
    !isNum(s.dayCost, 0, 1e7) ||
    !isInt(s.vipDay, -100, 100_000) ||
    !isInt(s.bailoutDay, -100, 100_000)
  )
    return null;
  if (
    !isObj(s.stats) ||
    !isInt(s.stats.served, 0, 1e9) ||
    !isNum(s.stats.bestProfit, -1e9, 1e9)
  )
    return null;
  return s as unknown as SaveData;
}

/** Could `next` follow `prev` in real play? */
export function plausible(prev: SaveData | null, next: SaveData) {
  if (!prev)
    return (
      next.day <= MAX_DAY_JUMP &&
      next.coins <= START_COINS + next.day * MAX_DAY_INCOME
    );
  if (next.day < prev.day || next.day - prev.day > MAX_DAY_JUMP) return false;
  if (next.seed !== prev.seed) return false;
  return next.coins - prev.coins <= (next.day - prev.day + 1) * MAX_DAY_INCOME;
}

export const rules: SaveRules = {
  parse: parseSave,
  plausible: (prev, next) =>
    plausible(prev as SaveData | null, next as SaveData),
  // The board ranks the bakery's worth, worked out from the save itself
  score: (save) => assets(save as SaveData),
};
