// The Lucky Jar (Hũ may mắn) rules (docs/standards/jackpot.md). Pure, so the
// server enforces them and the portal's batcher and tests read the same numbers.

/** The one shared pool's row id in `jackpot_pool`. */
export const JACKPOT_ID = "arcade";
/** Every coin a game feeds the jar adds this many tickets to the pool. */
export const TICKETS_PER_COIN = 2;
/** Per player, per game, per Vietnam day: at most this many tickets go into the pool. */
export const DAILY_CONTRIBUTION_CAP = 2_000;
/** Per player, per Vietnam day, across every game: at most this many rolls. */
export const DAILY_ROLLS = 8;
/** The chance of a roll at the seed (the lowest the pool goes). */
export const BASE_CHANCE = 0.005;
/** One contribute request carries at most this many coins (more is pointless: the cap clamps it). */
export const MAX_CONTRIBUTION_COINS = 1_000_000;

/**
 * The chance that one roll wins, from the pool's fill between seed and cap:
 * `p = 0.005 + 0.995 · fill³`, `fill = (pool − seed) / (cap − seed)`. Flat near
 * the seed (½ % a roll), steep near the cap, and 1 at the cap, so a full jar
 * always drops. A pool below the seed (an admin edit) counts as the seed.
 */
export function jackpotChance(pool: number, seed: number, cap: number): number {
  if (pool >= cap) return 1;
  const fill = Math.min(1, Math.max(0, (pool - seed) / (cap - seed)));
  return BASE_CHANCE + (1 - BASE_CHANCE) * fill ** 3;
}
