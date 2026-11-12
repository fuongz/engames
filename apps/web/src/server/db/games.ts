import { eq } from "drizzle-orm";
import type { Db } from "./leaderboard";
import { game } from "./schema";

// SERVER-ONLY: turns a game slug into its `game.id`. Every table refers to a game
// by id (docs/standards/database.md); callers keep passing slugs, and the query
// functions resolve them here.

/**
 * slug → id, for the life of the isolate. A row's id never changes once made,
 * so a hit is always right; the first call per slug costs a query or two, the
 * rest none.
 */
const ids = new Map<string, number>();

/**
 * The id of `slug` in `game`, inserting the row on first use. That is how a new
 * game (or a new online board, "<slug>:<mode>") gets its row: no migration, no
 * seed. Only pass slugs the boundary has already validated, since every new
 * slug becomes a row.
 *
 * Safe under concurrency: INSERT OR IGNORE lets exactly one row in, and both
 * callers read back the same id.
 */
export async function gameIdOf(db: Db, slug: string): Promise<number> {
  const cached = ids.get(slug);
  if (cached !== undefined) return cached;
  const find = async () =>
    (await db.select({ id: game.id }).from(game).where(eq(game.slug, slug)).limit(1))[0]?.id;
  let id = await find();
  if (id === undefined) {
    await db.insert(game).values({ slug }).onConflictDoNothing();
    id = await find();
    if (id === undefined) throw new Error(`Could not register game "${slug}"`);
  }
  ids.set(slug, id);
  return id;
}

/**
 * Forget every cached id. For tests, which build a fresh database per case;
 * the Worker has one database, so it never needs this.
 */
export function forgetGameIds() {
  ids.clear();
}

/**
 * The reserved `game` row the portal itself writes under (inserted by migration
 * 0011): the daily check-in's `ticket_ledger` rows, whose `game_id` is NOT NULL
 * though a check-in comes from no game. Never a folder under packages/games, so
 * no boundary ever validates it as a game, and every query that hands game rows
 * to players either starts from a per-game table it never appears in or filters
 * it out (docs/standards/database.md).
 */
export const PORTAL_SLUG = "portal";
