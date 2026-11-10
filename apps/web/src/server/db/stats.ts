import { eq, sql } from "drizzle-orm";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { game, gameStat } from "./schema";

// SERVER-ONLY implementation behind server/stats.ts: how many times each game
// was started, across every player.

/** Every game's play count, by slug (games never played are missing). */
export async function playCounts(db: Db): Promise<Record<string, number>> {
  const rows = await db
    .select({ slug: game.slug, plays: gameStat.plays })
    .from(gameStat)
    .innerJoin(game, eq(game.id, gameStat.gameId));
  return Object.fromEntries(rows.map((r) => [r.slug, r.plays]));
}

/** One more play of `slug`; returns the new count. */
export async function addPlay(db: Db, slug: string): Promise<number> {
  const [row] = await db
    .insert(gameStat)
    .values({ gameId: await gameIdOf(db, slug), plays: 1 })
    .onConflictDoUpdate({ target: gameStat.gameId, set: { plays: sql`${gameStat.plays} + 1` } })
    .returning({ plays: gameStat.plays });
  return row.plays;
}
