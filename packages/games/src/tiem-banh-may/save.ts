import type { SaveRules } from "../saves";
import {
  CUSTOMERS,
  INGREDIENTS,
  MAX_REP,
  OPEN,
  RECIPES,
  WAKE,
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

/**
 * Version 1 counted the night as minutes of work (bed 22:00, up at 5:00) and
 * had no energy or mood: map it onto the version-2 night and give defaults.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  // v2 → v3: batches can run in the background
  if (raw.v === 2) return { ...raw, v: 3, jobs: [] };
  if (raw.v !== 1) return raw;
  const used = typeof raw.prepUsed === "number" ? raw.prepUsed : 0;
  // v1: 330 minutes of evening, then the morning from 5:00
  const night = used < 330 ? used : Math.max(WAKE, WAKE - 30 + (used - 330));
  const { prepUsed: _, ...rest } = raw;
  return { ...rest, v: 3, night, energy: 80, mood: 60, caffeine: 0, jobs: [] };
}

/** The save, if it has the right shape (older versions are upgraded); null otherwise. */
export function parseSave(raw: unknown): SaveData | null {
  if (!isObj(raw)) return null;
  const s = migrate(raw);
  if (s.v !== 3) return null;
  if (
    !Array.isArray(s.jobs) ||
    s.jobs.length > 6 ||
    !s.jobs.every(
      (j) =>
        isObj(j) &&
        isInt(j.id, 0, 1e9) &&
        RECIPE_IDS.has(j.recipe as string) &&
        isNum(j.cost, 0, 1e5) &&
        isInt(j.step, 0, 30) &&
        Array.isArray(j.results) &&
        j.results.length <= 60 &&
        j.results.every(
          (r) =>
            isObj(r) &&
            typeof r.grade === "string" &&
            typeof r.note === "string",
        ) &&
        (j.kind === "oven" || j.kind === "wait") &&
        isNum(j.start, 0, OPEN) &&
        isInt(j.temp, 0, 300),
    )
  )
    return null;
  if (
    !isNum(s.energy, 0, 100) ||
    !isNum(s.mood, 0, 100) ||
    !isInt(s.caffeine, 0, 50)
  )
    return null;
  if (!isInt(s.day, 1, 100_000) || (s.phase !== "prep" && s.phase !== "open"))
    return null;
  if (
    !isInt(s.coins, -1_000_000, 1_000_000_000) ||
    !isNum(s.rep, 0, MAX_REP) ||
    !isNum(s.night, 0, OPEN)
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
