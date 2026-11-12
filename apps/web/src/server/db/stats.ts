import { eq, sql } from "drizzle-orm";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { game, gameStat, userGameStat } from "./schema";

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

/**
 * One more play of `slug`; returns the new global count. With `player` (a
 * signed-in player), also counts it in their `user_game_stat` row, which the
 * profile's per-game stats and play badges read.
 */
export async function addPlay(db: Db, slug: string, player?: { userId: string; now: number }): Promise<number> {
  const gameId = await gameIdOf(db, slug);
  const [row] = await db
    .insert(gameStat)
    .values({ gameId, plays: 1 })
    .onConflictDoUpdate({ target: gameStat.gameId, set: { plays: sql`${gameStat.plays} + 1` } })
    .returning({ plays: gameStat.plays });
  if (player)
    await db
      .insert(userGameStat)
      .values({ userId: player.userId, gameId, plays: 1, firstPlayedAt: player.now, lastPlayedAt: player.now })
      .onConflictDoUpdate({
        target: [userGameStat.userId, userGameStat.gameId],
        set: { plays: sql`${userGameStat.plays} + 1`, lastPlayedAt: sql`excluded.last_played_at` },
      });
  return row.plays;
}
